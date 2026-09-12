import { runCreatorCommand } from './runtime.mjs';
import { startBrowserReview, browserReviewStatus, waitForBrowserReview, recordBrowserHostNote } from './browser-review.mjs';

export async function creatorMain(argv) {
  const [command = 'help', ...args] = argv;
  if (['help', '--help', '-h'].includes(command)) {
    process.stdout.write(`Threadify creator engine (local only)
Usage: threadify-workflows creator COMMAND --state /absolute/private/directory [--revision N]
JSON input is read from stdin, not command arguments. Output is JSON.
Reads: status, continue, display, resolve-source, display-setup, display-feedback, prepare-reminder
Browser: review-editor (starts loopback editor), review-wait, review-submission (reads saved intent), apply-browser-review, review-note
Writes: plan, refresh-day, add-review, record-validation, approve, edit, begin-attempt, reconcile, record-outcome, complete-local,
        setup, approve-setup, begin-import, reconcile-import,
        record-feedback, begin-feedback-share, reconcile-feedback
Writes require the revision returned by status or the previous command.
This engine never calls Threadify or publishes. Persist an attempt before a separately approved host provider call.
`);
    return;
  }
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (!['--state', '--revision'].includes(args[i]) || args[i + 1] === undefined) throw new Error('Expected --state PATH or --revision N.');
    const key = args[i++];
    if (key === '--state') options.root = args[i];
    else {
      if (!/^\d+$/.test(args[i])) throw new Error('Revision must be a nonnegative integer.');
      options.revision = Number(args[i]);
    }
  }
  if (!options.root) throw new Error('Explicit private --state directory required.');
  let body = ''; let bytes = 0;
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) {
    bytes += Buffer.byteLength(chunk, 'utf8');
    if (bytes > 2_000_000) throw new Error('Creator JSON input exceeds 2 MB; use a smaller operation.');
    body += chunk;
  }
  options.input = body.trim() ? JSON.parse(body) : {};
  if (command === 'review-editor') {
    const editor = await startBrowserReview({ root: options.root, input: options.input,
      onSubmit: (event) => process.stdout.write(`${JSON.stringify(event)}\n`) });
    process.stdout.write(`${JSON.stringify({ action: 'browser_review_ready', url: editor.url, session_root: editor.sessionRoot })}\n`);
    return;
  }
  if (command === 'review-submission') {
    process.stdout.write(`${JSON.stringify(await browserReviewStatus(options.root, options.input.session_root), null, 2)}\n`);
    return;
  }
  if (command === 'review-wait') {
    process.stdout.write(`${JSON.stringify(await waitForBrowserReview(options.root, options.input.session_root, options.input.timeout_ms), null, 2)}\n`);
    return;
  }
  if (command === 'review-note') {
    const result = await recordBrowserHostNote(options.input.session_root, options.revision, options.input);
    process.stdout.write(`${JSON.stringify({ revision: result.revision, host_status: result.payload.host_status })}\n`);
    return;
  }
  const result = await runCreatorCommand(command, options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
