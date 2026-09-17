import process from 'node:process';
import { buildLeadDesk } from './lead-desk.mjs';
export async function leadDeskMain(argv) {
  if (argv.length) throw new Error('usage: threadify-workflows lead-desk < input.json');
  let body = '';
  for await (const chunk of process.stdin) { body += chunk; if (body.length > 2_000_000) throw new Error('input exceeds 2 MB'); }
  if (!body.trim()) throw new Error('JSON input is required on stdin');
  process.stdout.write(`${JSON.stringify(buildLeadDesk(JSON.parse(body)), null, 2)}\n`);
}
