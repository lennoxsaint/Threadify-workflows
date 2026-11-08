#!/usr/bin/env node
// Point this checkout's git hooks at .githooks/, so every commit and push runs
// scripts/guard-plugins.mjs. `npm install` runs this through the prepare
// script. It changes nothing outside this repository's own git config, does
// nothing when the folder is not this repository's checkout (for example when
// npm installs the package from GitHub), and never fails an install.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
try {
  const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8' });
  const isCheckout = top.status === 0 && path.resolve(top.stdout.trim()) === root && fs.existsSync(path.join(root, '.githooks', 'pre-commit'));
  if (isCheckout) {
    const set = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: root, encoding: 'utf8' });
    if (set.status === 0) console.log('git hooks: commits and pushes now run scripts/guard-plugins.mjs');
  }
} catch {
  // Never block an install over hooks.
}
