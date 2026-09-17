import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import { buildLeadDesk } from './lead-desk.mjs';
import { LeadDeskReview } from './lead-desk-review.mjs';
import { serveLeadDesk } from './lead-desk-review-server.mjs';

function option(argv, flag) {
  const index = argv.indexOf(flag);
  if (index < 0 || !argv[index + 1] || argv[index + 1].startsWith('--')) throw new Error(`${flag} requires a value`);
  return argv[index + 1];
}

export async function leadDeskMain(argv) {
  if (argv[0] === 'status') {
    if (argv.length !== 3 || argv[1] !== '--state') throw new Error('usage: threadify-workflows lead-desk status --state /absolute/review.json');
    process.stdout.write(`${JSON.stringify(new LeadDeskReview(option(argv, '--state')).status(), null, 2)}\n`);
    return;
  }
  if (argv[0] === 'serve') {
    if (argv.length !== 5 || !argv.includes('--input') || !argv.includes('--state')) throw new Error('usage: threadify-workflows lead-desk serve --input /absolute/input.json --state /absolute/review.json');
    const inputFile = option(argv, '--input');
    if (!path.isAbsolute(inputFile)) throw new Error('absolute_input_file_required');
    const review = new LeadDeskReview(option(argv, '--state'));
    review.initialize(buildLeadDesk(JSON.parse(fs.readFileSync(inputFile, 'utf8'))));
    const { url } = await serveLeadDesk(review);
    process.stdout.write(`${JSON.stringify({ status: 'serving', url, state_file: review.file, external_effects: { sent: false } }, null, 2)}\n`);
    return;
  }
  if (argv.length) throw new Error('usage: threadify-workflows lead-desk < input.json');
  let body = '';
  for await (const chunk of process.stdin) { body += chunk; if (body.length > 2_000_000) throw new Error('input exceeds 2 MB'); }
  if (!body.trim()) throw new Error('JSON input is required on stdin');
  process.stdout.write(`${JSON.stringify(buildLeadDesk(JSON.parse(body)), null, 2)}\n`);
}
