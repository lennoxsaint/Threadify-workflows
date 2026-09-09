#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { reserveReleaseOutput, collectReleaseFiles } from '../lib/release-files.mjs';
import { pluginArchive } from '../lib/release-archive.mjs';
import { readReleaseMetadata } from '../lib/release-metadata.mjs';
import { collectViralCarouselBundle, VIRAL_CAROUSEL_RELEASE } from '../lib/viral-carousel-bundle.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const candidate = process.argv.includes('--candidate');

function git(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Cannot verify release source Git state.');
  return result.stdout.trim();
}

function option(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

for (const script of ['build-qbr-bundle.mjs', 'build-creator-bundles.mjs', 'build-advanced-bundles.mjs']) {
  const render = spawnSync(process.execPath, [path.join(root, 'scripts', script), '--check'], {
    cwd: root,
    stdio: 'inherit',
  });
  if (render.status !== 0) process.exit(render.status ?? 1);
}

const intent = readReleaseMetadata(root);
if (intent.release !== true && !candidate) {
  console.log('Release intent is disabled; no assets produced.');
  process.exit(0);
}
const head = git(['rev-parse', 'HEAD']);
const commit = option('--commit', process.env.GITHUB_SHA) ?? head;
if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error(`invalid release commit: ${commit}`);
if (commit !== head) throw new Error('Release commit must match the checked-out HEAD.');
const worktreeDirty = git(['status', '--porcelain', '--untracked-files=all']).length > 0;
if (worktreeDirty && !candidate) throw new Error('Stable builds require a clean worktree; use --candidate for explicitly labeled local verification.');
const out = reserveReleaseOutput(path.resolve(option('--out', path.join(root, 'dist'))), { sourceRoot: root });

const skillRoot = 'plugins/threadify/skills/threadify-qualified-buyer-research';
const pluginFiles = collectReleaseFiles(root);
const skillFiles = pluginFiles.filter((file) => file.startsWith(`${skillRoot}/`))
  .map((file) => file.slice(skillRoot.length + 1));
const cliFiles = pluginFiles.filter((file) => file.startsWith('bin/') || file.startsWith('lib/'));
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
for (const file of collectViralCarouselBundle()) {
  const target = `plugin/vendor/viral-carousel-maker/${file.relative}`;
  entries.set(target, { sha256: sha256(file.content), bytes: file.content.length, mode: '0644', content_base64: file.content.toString('base64') });
}

const sortedEntries = [...entries.entries()].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
const source = { kind: candidate ? 'candidate' : 'stable', base_commit: head, worktree_dirty: worktreeDirty,
  content_manifest_sha256: sha256(Buffer.from(JSON.stringify(sortedEntries.map(([name, entry]) => ({ name, sha256: entry.sha256, mode: entry.mode }))))) };

const bundle = {
  record_type: candidate ? 'ThreadifyWorkflowsCandidateBundleV1' : 'ThreadifyWorkflowsInstallBundleV1',
  source,
  release: {
    release_version: intent.release_version,
    skill_version: intent.skill_version,
    plugin_version: intent.plugin_version,
    rules_version: intent.rules_version,
    commit,
    change_class: intent.change_class,
  },
  bundled_viral_carousel_maker: VIRAL_CAROUSEL_RELEASE,
  files: Object.fromEntries(sortedEntries),
};
const bundleContent = Buffer.from(`${JSON.stringify(bundle)}\n`);
const bundleFile = path.join(out, 'threadify-workflows-bundle.json');
fs.writeFileSync(bundleFile, bundleContent, { flag: 'wx' });
const archiveName = `threadify-workflows-plugin${candidate ? '-candidate' : ''}.tar.gz`;
const archiveContent = pluginArchive(sortedEntries);
fs.writeFileSync(path.join(out, archiveName), archiveContent, { flag: 'wx' });

const manifest = {
  record_type: candidate ? 'CandidateReleaseManifestV1' : 'StableReleaseManifestV1',
  source,
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
    { name: archiveName, sha256: sha256(archiveContent), bytes: archiveContent.length },
  ],
};
const manifestContent = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
const manifestName = candidate ? 'candidate-release-manifest.json' : 'stable-release-manifest.json';
fs.writeFileSync(path.join(out, manifestName), manifestContent, { flag: 'wx' });
fs.writeFileSync(
  path.join(out, 'checksums.txt'),
  `${sha256(bundleContent)}  threadify-workflows-bundle.json\n${sha256(archiveContent)}  ${archiveName}\n${sha256(manifestContent)}  ${manifestName}\n`,
  { flag: 'wx' },
);
fs.copyFileSync(path.join(root, 'release', 'CHANGELOG.md'), path.join(out, 'CHANGELOG.md'), fs.constants.COPYFILE_EXCL);
console.log(`Built ${candidate ? 'local candidate (not a stable release)' : 'stable release'} ${intent.release_version}: ${entries.size} bundled files.`);
