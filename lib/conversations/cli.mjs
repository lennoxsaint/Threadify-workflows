import { runConversationCommand } from './runtime.mjs';

const HELP = `Threadify buyer conversation engine (private local state only)
Usage: threadify-workflows conversations COMMAND --state /absolute/private/directory [--revision N]
JSON input is read from stdin, not command arguments. Output is JSON.
Reads: status, next-actions, review, follow-through, questions-to-content, weekly-outcomes, reminder
Writes: init, add-evidence, prepare-action, decide, begin-attempt, receipt, commit, outcome, save-content
Writes require the revision returned by status or the previous command.
The engine performs no research, generation, send, provider verification or reminder creation.
Persist begin-attempt before the separately approved host provider call; reconcile it with receipt.
`;

export async function conversationMain(argv) {
  const [command = 'help', ...args] = argv;
  if (['help', '--help', '-h'].includes(command)) {
    process.stdout.write(HELP);
    return;
  }
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    if (!['--state', '--revision'].includes(args[index]) || args[index + 1] === undefined) {
      throw new Error('Expected --state PATH or --revision N.');
    }
    const key = args[index++];
    if (key === '--state') options.root = args[index];
    else {
      if (!/^\d+$/.test(args[index])) throw new Error('Revision must be a nonnegative integer.');
      options.revision = Number(args[index]);
    }
  }
  if (!options.root) throw new Error('Explicit private --state directory required.');
  let body = ''; let bytes = 0;
  if (!process.stdin.isTTY) {
    process.stdin.setEncoding('utf8');
    for await (const chunk of process.stdin) {
      bytes += Buffer.byteLength(chunk, 'utf8');
      if (bytes > 2_000_000) throw new Error('Conversation JSON input exceeds 2 MB; use a smaller operation.');
      body += chunk;
    }
  }
  options.input = body.trim() ? JSON.parse(body) : {};
  const result = await runConversationCommand(command, options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
