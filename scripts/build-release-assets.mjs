#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(new URL('..', import.meta.url).pathname);

function option(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function walk(directory, relative = '') {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'dist'].includes(entry.name)) continue;
    const nextRelative = path.posix.join(relative, entry.name);
    if (nextRelative === 'engines/eddy') continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(full, nextRelative));
    else if (entry.isFile()) files.push(nextRelative);
  }
  return files.sort();
}

const render = spawnSync(process.execPath, [path.join(root, 'scripts', 'build-qbr-bundle.mjs')], {
  cwd: root,
  stdio: 'inherit',
});
if (render.status !== 0) process.exit(render.status ?? 1);

const intent = JSON.parse(fs.readFileSync(path.join(root, 'release', 'release-intent.json'), 'utf8'));
if (intent.release !== true) {
  console.log('Release intent is disabled; no assets produced.');
  process.exit(0);
}
const commit = option('--commit', process.env.GITHUB_SHA)
  ?? spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error(`invalid release commit: ${commit}`);
const out = path.resolve(option('--out', path.join(root, 'dist')));
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const skillRoot = 'plugins/threadify/skills/threadify-qualified-buyer-research';
const pluginFiles = walk(root).filter((file) => !file.startsWith('.github/'));
const skillFiles = walk(path.join(root, skillRoot));
const cliFiles = [
  ...walk(path.join(root, 'bin')).map((file) => `bin/${file}`),
  ...walk(path.join(root, 'lib')).map((file) => `lib/${file}`),
];
const entries = new Map();

function add(sourceRelative, targetRelative) {
  const source = path.join(root, ...sourceRelative.split('/'));
  const content = fs.readFileSync(source);
  const mode = (fs.statSync(source).mode & 0o111) ? '0755' : '0644';
  entries.set(targetRelative, {
    sha256: sha256(content),
    bytes: content.length,
    mode,
    content_base64: content.toString('base64'),
  });
}

for (const file of pluginFiles) add(file, `plugin/${file}`);
for (const file of skillFiles) add(`${skillRoot}/${file}`, `skill/${file}`);
for (const file of cliFiles) add(file, `cli/${file}`);

const bundle = {
  record_type: 'ThreadifyWorkflowsInstallBundleV1',
  release: {
    release_version: intent.release_version,
    skill_version: intent.skill_version,
    plugin_version: intent.plugin_version,
    rules_version: intent.rules_version,
    commit,
    change_class: intent.change_class,
  },
  files: Object.fromEntries([...entries.entries()].sort(([left], [right]) => left.localeCompare(right))),
};
const bundleContent = Buffer.from(`${JSON.stringify(bundle)}\n`);
const bundleFile = path.join(out, 'threadify-workflows-bundle.json');
fs.writeFileSync(bundleFile, bundleContent);

const manifest = {
  record_type: 'StableReleaseManifestV1',
  release_version: intent.release_version,
  skill_version: intent.skill_version,
  plugin_version: intent.plugin_version,
  rules_version: intent.rules_version,
  commit,
  change_class: intent.change_class,
  assets: [
    {
      name: 'threadify-workflows-bundle.json',
      sha256: sha256(bundleContent),
      bytes: bundleContent.length,
    },
  ],
};
const manifestContent = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(path.join(out, 'stable-release-manifest.json'), manifestContent);
fs.writeFileSync(
  path.join(out, 'checksums.txt'),
  `${sha256(bundleContent)}  threadify-workflows-bundle.json\n${sha256(manifestContent)}  stable-release-manifest.json\n`,
);
fs.copyFileSync(path.join(root, 'release', 'CHANGELOG.md'), path.join(out, 'CHANGELOG.md'));
console.log(`Built stable release ${intent.release_version}: ${entries.size} bundled files.`);
