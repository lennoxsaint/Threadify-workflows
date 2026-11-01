import fs from 'node:fs';
import path from 'node:path';
import { buildRunwayReview, renderRunwayReview } from './greatest-hits-runway.mjs';

export function greatestHitsMain(args) {
  const [command, ...rest] = args;
  if (command !== 'review') throw new Error('Usage: greatest-hits review --input input.json --output-dir new-private-directory');
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    if (!['--input', '--output-dir'].includes(rest[index]) || !rest[index + 1] || options[rest[index]]) throw new Error('Expected unique --input and --output-dir');
    options[rest[index]] = rest[index + 1];
  }
  if (!options['--input'] || !options['--output-dir']) throw new Error('Both --input and --output-dir required');
  const packet = buildRunwayReview(JSON.parse(fs.readFileSync(options['--input'], 'utf8')));
  const output = path.resolve(options['--output-dir']);
  // Atomic reservation, private permissions, no overwrites or recursive cleanup.
  fs.mkdirSync(output, { mode: 0o700 });
  fs.writeFileSync(path.join(output, 'review.private.json'), `${JSON.stringify(packet, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  fs.writeFileSync(path.join(output, 'review.private.html'), renderRunwayReview(packet), { mode: 0o600, flag: 'wx' });
  return { output, counts: packet.counts, revision: packet.revision, providerOperations: 'not_attempted' };
}
