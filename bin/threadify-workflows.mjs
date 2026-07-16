#!/usr/bin/env node
import readline from 'node:readline/promises';
import process from 'node:process';
import {
  install,
  rollback,
  status,
  uninstall,
  update,
} from '../lib/installer.mjs';

function parse(argv) {
  const [command = 'status', ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (value === '--json') options.json = true;
    else if (value === '--enable-auto-update') options.autoUpdate = true;
    else if (value === '--disable-auto-update') options.autoUpdate = false;
    else if (value === '--on-use') options.onUse = true;
    else if (value === '--scheduled') options.scheduled = true;
    else if (value === '--skip-jitter') options.skipJitter = true;
    else if (value === '--purge-state') options.purgeState = true;
    else if (['--targets', '--source-bundle', '--source-manifest', '--version'].includes(value)) {
      const key = {
        '--targets': 'targets',
        '--source-bundle': 'sourceBundle',
        '--source-manifest': 'sourceManifest',
        '--version': 'version',
      }[value];
      options[key] = rest[++index];
    } else {
      throw new Error(`unknown_option:${value}`);
    }
  }
  return { command, options };
}

function help() {
  return `Threadify Workflows stable updater

Usage:
  threadify-workflows install [--enable-auto-update|--disable-auto-update] [--targets all]
  threadify-workflows update [--on-use|--scheduled]
  threadify-workflows status
  threadify-workflows rollback [--version 0.4.0]
  threadify-workflows uninstall [--purge-state]

The updater installs only validated GitHub stable releases. It never updates unrelated skills.
`;
}

async function resolveConsent(command, options) {
  if (command !== 'install' || options.autoUpdate !== undefined || !process.stdin.isTTY) return options;
  const interfaceInstance = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await interfaceInstance.question('Enable daily and on-use stable updates? [y/N] ');
  interfaceInstance.close();
  return { ...options, autoUpdate: /^y(es)?$/i.test(answer.trim()) };
}

async function main() {
  const parsed = parse(process.argv.slice(2));
  if (['help', '--help', '-h'].includes(parsed.command)) {
    process.stdout.write(help());
    return;
  }
  const options = await resolveConsent(parsed.command, parsed.options);
  let result;
  if (parsed.command === 'install') result = await install(options);
  else if (parsed.command === 'update') result = await update(options);
  else if (parsed.command === 'status') result = status(options);
  else if (parsed.command === 'rollback') result = rollback(options);
  else if (parsed.command === 'uninstall') result = uninstall(options);
  else throw new Error(`unknown_command:${parsed.command}`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ status: 'failed', error: String(error.message ?? error) }, null, 2)}\n`);
  process.exit(1);
});
