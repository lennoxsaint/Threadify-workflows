#!/usr/bin/env node
// Repository guard: refuses a commit or push when the plugins would fail the
// Claude plugin directory's rules or have drifted from their sources.
//
// It runs `npm run validate`, which rebuilds nothing and checks everything: the
// workflow manifests, every generated bundle, and plugins/claude against
// lib/claude-plugin-policy.mjs (file count, file sizes and types, credential
// reads, download-and-run commands, external engines).
//
// Callers:
//   .githooks/pre-commit and .githooks/pre-push   node scripts/guard-plugins.mjs
//   .claude/settings.json (Claude Code hook)       node scripts/guard-plugins.mjs --claude-hook
//
// With --claude-hook it reads the hook's JSON from stdin and only checks Bash
// commands that commit, push or open or merge a pull request; it exits 2 to
// block the command and tells Claude why. Installing the git hooks:
// `npm install` runs scripts/install-git-hooks.mjs, or run it directly.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const claudeHook = process.argv.includes('--claude-hook');
const GUARDED_COMMAND = /\bgit\b[^|;&\n]*\b(?:commit|push)\b|\bgh\s+pr\s+(?:create|merge)\b/;

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
  });
}

async function shouldCheck() {
  if (!claudeHook) return true;
  let input = {};
  try { input = JSON.parse(await readStdin() || '{}'); } catch { return false; }
  const command = String(input?.tool_input?.command ?? '');
  return GUARDED_COMMAND.test(command);
}

if (!(await shouldCheck())) process.exit(0);

// Run the package's `validate` script step by step with this Node, so the guard
// needs no npm on PATH and no shell on any platform. Steps are `node <file> ...`
// or `npm run <script>`, joined with &&.
function steps(scriptName, seen = new Set()) {
  if (seen.has(scriptName)) throw new Error(`script cycle at ${scriptName}`);
  seen.add(scriptName);
  const script = packageJson.scripts?.[scriptName];
  if (!script) throw new Error(`package.json has no ${scriptName} script`);
  return script.split('&&').map((part) => part.trim().split(/\s+/)).flatMap((words) => {
    if (words[0] === 'node') return [words.slice(1)];
    if (words[0] === 'npm' && words[1] === 'run') return steps(words.filter((word) => !word.startsWith('-'))[2], seen);
    throw new Error(`guard can't run this step of ${scriptName}: ${words.join(' ')}`);
  });
}
const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
let output = '';
let result = { status: 0 };
for (const args of steps('validate')) {
  result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
  output += `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.status !== 0) break;
}
if (result.status === 0) {
  for (const line of output.split('\n').filter((text) => /warning/i.test(text))) process.stderr.write(`${line}\n`);
  process.exit(0);
}
const reason = output.split('\n')
  .filter((line) => line.trim() && !/^\s+at\s|^Node\.js v|^node:internal|^\s*\^+\s*$|^file:\/\/|^\s+throw |\b(?:passed|verified|built):/.test(line))
  .slice(0, 40)
  .join('\n');
process.stderr.write([
  'Blocked by the plugin guard (scripts/guard-plugins.mjs): npm run validate failed.',
  reason || `npm run validate exited with ${result.status ?? result.error?.message}`,
  '',
  `Fix it from ${path.relative(process.cwd(), root) || '.'}: edit the source files, run npm run bundle:build, then npm run validate.`,
  'The Claude plugin directory rules are in lib/claude-plugin-policy.mjs. Do not bypass this check.',
].join('\n') + '\n');
process.exit(claudeHook ? 2 : 1);
