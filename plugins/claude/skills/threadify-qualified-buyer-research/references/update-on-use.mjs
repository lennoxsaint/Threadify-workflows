#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const stateRoot = process.env.THREADIFY_WORKFLOWS_HOME
  ? path.resolve(process.env.THREADIFY_WORKFLOWS_HOME)
  : path.join(os.homedir(), '.threadify-workflows');
const configFile = path.join(stateRoot, 'config.json');
const currentCli = path.join(stateRoot, 'current', 'cli', 'bin', 'threadify-workflows.mjs');

function output(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

if (!fs.existsSync(configFile) || !fs.existsSync(currentCli)) {
  output({
    status: 'update_failed_using_cached_version',
    fallback: 'managed_updater_not_installed',
    next_step: 'Run `threadify-workflows install` from the main Threadify Workflows repository.',
  });
  process.exit(0);
}

const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
if (config.auto_update_enabled !== true) {
  output({
    status: 'auto_update_disabled',
    active_versions: config.active_versions ?? null,
    next_step: 'Run `threadify-workflows install --enable-auto-update` if the owner consents.',
  });
  process.exit(0);
}

const result = spawnSync(process.execPath, [currentCli, 'update', '--on-use', '--json'], {
  encoding: 'utf8',
  env: process.env,
});
if (result.status !== 0) {
  output({
    status: 'update_failed_using_cached_version',
    fallback: String(result.stderr || result.stdout || 'updater_failed').trim(),
    active_versions: config.active_versions ?? null,
  });
  process.exit(0);
}
process.stdout.write(result.stdout);
