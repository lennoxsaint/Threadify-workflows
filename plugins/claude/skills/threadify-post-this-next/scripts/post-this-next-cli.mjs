import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { writePostThisNextArtifacts } from './post-this-next.mjs';

function parse(argv) {
  const [command, ...rest] = argv;
  const options = { command };
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (!['--input', '--output-dir'].includes(flag) || !value) {
      throw new Error('usage: post-this-next review --input PATH --output-dir PATH');
    }
    options[flag.slice(2)] = value;
  }
  return options;
}

export function postThisNextMain(argv = process.argv.slice(2)) {
  const options = parse(argv);
  if (options.command !== 'review' || !options.input || !options['output-dir']) {
    throw new Error('usage: post-this-next review --input PATH --output-dir PATH');
  }
  const input = JSON.parse(fs.readFileSync(path.resolve(options.input), 'utf8'));
  return writePostThisNextArtifacts(input, path.resolve(options['output-dir']));
}

const invokedPath = process.argv[1] ? fs.realpathSync(path.resolve(process.argv[1])) : null;
const modulePath = fs.realpathSync(fileURLToPath(import.meta.url));

if (invokedPath === modulePath) {
  try {
    process.stdout.write(`${JSON.stringify(postThisNextMain(), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
