#!/usr/bin/env node
// Move every copy of the release version forward in one step, so a release never
// drifts across package.json, the four plugin manifests, the release intent,
// installation.md and the changelog. Generated bundles are refreshed afterwards.
//
//   node scripts/bump-version.mjs [patch|minor|major|<x.y.z>] --summary "<line>" [--summary "<line>" ...]
//   node scripts/bump-version.mjs patch --summary-file <path>   # one changelog line per non-empty line
//   add --dry-run to print the plan without writing anything.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const FILES = {
  pkg: 'package.json',
  lock: 'package-lock.json',
  codexPlugin: '.codex-plugin/plugin.json',
  claudePlugin: 'plugins/claude/.claude-plugin/plugin.json',
  compatibilityPlugin: 'plugins/threadify/.codex-plugin/plugin.json',
  openaiPlugin: 'plugins/openai/plugin.json',
  intent: 'release/release-intent.json',
  installation: 'installation.md',
  changelog: 'release/CHANGELOG.md',
};
const BUNDLE_SCRIPTS = ['build-qbr-bundle.mjs', 'build-creator-bundles.mjs', 'build-advanced-bundles.mjs', 'build-workflow-bundles.mjs', 'build-claude-plugin.mjs', 'build-openai-plugin.mjs'];

function fail(message) {
  console.error(`bump-version: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const options = { bump: 'patch', summaries: [], dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--summary') options.summaries.push(argv[++index] ?? '');
    else if (arg.startsWith('--summary=')) options.summaries.push(arg.slice('--summary='.length));
    else if (arg === '--summary-file') {
      const file = argv[++index];
      if (!file) fail('--summary-file needs a path');
      options.summaries.push(...fs.readFileSync(file, 'utf8').split(/\r?\n/));
    } else if (arg === '--dry-run') options.dryRun = true;
    else if (arg.startsWith('--')) fail(`unknown option ${arg}`);
    else options.bump = arg;
  }
  options.summaries = options.summaries.map((line) => line.trim()).filter(Boolean);
  if (options.summaries.length === 0) fail('at least one --summary line (or a non-empty --summary-file) is required');
  return options;
}

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version));
  if (!match) fail(`invalid version ${version}`);
  return match.slice(1).map(Number);
}

function nextVersion(current, bump) {
  const [major, minor, patch] = parseVersion(current);
  if (bump === 'patch') return `${major}.${minor}.${patch + 1}`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  if (bump === 'major') return `${major + 1}.0.0`;
  const [nextMajor, nextMinor, nextPatch] = parseVersion(bump);
  const higher = nextMajor > major
    || (nextMajor === major && (nextMinor > minor || (nextMinor === minor && nextPatch > patch)));
  if (!higher) fail(`${bump} is not higher than the current version ${current}`);
  return bump;
}

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const readText = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const writes = new Map();
const planJson = (file, value) => writes.set(file, `${JSON.stringify(value, null, 2)}\n`);
const planText = (file, value) => writes.set(file, value);

const options = parseArgs(process.argv.slice(2));
const intent = readJson(FILES.intent);
const current = intent.release_version;
if (intent.plugin_version !== current) fail(`release intent has release_version ${current} but plugin_version ${intent.plugin_version}`);
const next = nextVersion(current, options.bump);

for (const key of ['codexPlugin', 'claudePlugin', 'compatibilityPlugin', 'openaiPlugin']) {
  const manifest = readJson(FILES[key]);
  if (manifest.version !== current) fail(`${FILES[key]} is at ${manifest.version}, expected ${current}`);
  manifest.version = next;
  planJson(FILES[key], manifest);
}

const pkg = readJson(FILES.pkg);
if (pkg.version !== current) fail(`package.json is at ${pkg.version}, expected ${current}`);
pkg.version = next;
planJson(FILES.pkg, pkg);

const lock = readJson(FILES.lock);
lock.version = next;
if (lock.packages?.['']) lock.packages[''].version = next;
planJson(FILES.lock, lock);

planJson(FILES.intent, { ...intent, release_version: next, plugin_version: next, summary: options.summaries.join(' ') });

const installation = readText(FILES.installation);
if (!installation.includes(current)) fail(`installation.md does not mention ${current}`);
planText(FILES.installation, installation.split(current).join(next));

const changelog = readText(FILES.changelog).replace(/\r\n/g, '\n');
if (!changelog.startsWith('# ')) fail('release/CHANGELOG.md must start with a version heading');
if (changelog.startsWith(`# ${next}\n`)) fail(`release/CHANGELOG.md already has a ${next} entry`);
const entry = `# ${next}\n\n${options.summaries.map((line) => `- ${line}`).join('\n')}\n\n`;
planText(FILES.changelog, `${entry}${changelog}`);

console.log(JSON.stringify({
  status: options.dryRun ? 'planned' : 'bumped',
  previous: current,
  version: next,
  files: [...writes.keys()],
  summaries: options.summaries,
}, null, 2));
if (options.dryRun) process.exit(0);

for (const [file, content] of writes) fs.writeFileSync(path.join(root, file), content);

// Generated bundles copy release/release-intent.json into skill references, so refresh them.
for (const script of BUNDLE_SCRIPTS) {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', script)], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) fail(`${script} failed`);
}
