#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { growthLoopMain } from '../../lib/growth-loop-cli.mjs';

export { growthLoopMain };

const invokedPath = process.argv[1] ? fs.realpathSync(path.resolve(process.argv[1])) : null;
const modulePath = fs.realpathSync(fileURLToPath(import.meta.url));

if (invokedPath === modulePath) {
  growthLoopMain().then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

