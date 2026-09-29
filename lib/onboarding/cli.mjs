import { probeSetupClient, routineProposal } from './adapters.mjs';
import { startSetup, resumeSetup, inspectSetup, verifySetup } from './setup.mjs';
import { discoverSetupFiles } from './discovery.mjs';
import { reviewHash } from '../creator/review.mjs';
export async function setupMain(argv) {
  const [command = 'help', ...args] = argv;
  if (['help', '--help'].includes(command)) {
    console.log('threadify-workflows setup <start|resume|status|verify|discover|summary-hash> --state /private/directory [--revision N]\nJSON input on stdin. Never put secrets in setup records. resume takes a named event.'); return;
  }
  let root, revision;
  for (let i = 0; i < args.length; i++) {
    const key = args[i++];
    if (!args[i]) throw new Error('Missing option value.');
    if (key === '--state') root = args[i];
    else if (key === '--revision' && /^\d+$/.test(args[i])) revision = Number(args[i]);
    else throw new Error('Use --state and --revision only.');
  }
  let body = ''; let bytes = 0;
  if (!process.stdin.isTTY) for await (const chunk of process.stdin) {
    bytes += Buffer.byteLength(chunk); if (bytes > 2_000_000) throw new Error('Setup input exceeds 2 MB.'); body += chunk;
  }
  const input = body.trim() ? JSON.parse(body) : {};
  if (!root && !['summary-hash', 'probe-client', 'routine-proposal'].includes(command)) throw new Error('Private --state directory required.');
  let result;
  if (command === 'probe-client') result = probeSetupClient(input.client);
  else if (command === 'routine-proposal') result = routineProposal(input);
  else if (command === 'start') result = await startSetup(root, input);
  else if (command === 'resume') result = await resumeSetup(root, revision, input);
  else if (command === 'status') result = await inspectSetup(root);
  else if (command === 'verify') result = await verifySetup(root);
  else if (command === 'discover') result = await discoverSetupFiles(root, input);
  else if (command === 'summary-hash') result = { summary_hash: reviewHash(input) };
  else throw new Error('Unknown setup command.');
  console.log(JSON.stringify(result, null, 2));
}
