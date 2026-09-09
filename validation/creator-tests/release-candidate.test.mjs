import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fetchLatestStable } from '../../lib/installer.mjs';
import { collectReleaseFiles } from '../../lib/release-files.mjs';
const root = fileURLToPath(new URL('../..', import.meta.url));
const script = path.join(root, 'scripts/build-release-assets.mjs');
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

test('unapproved candidate source cannot produce stable assets', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-disabled-release-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const source = path.join(temp, 'source');
  for (const file of collectReleaseFiles(root)) {
    const destination = path.join(source, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(root, file), destination);
  }
  const intentFile = path.join(source, 'release/release-intent.json');
  const intent = JSON.parse(fs.readFileSync(intentFile));
  intent.release = false;
  fs.writeFileSync(intentFile, `${JSON.stringify(intent, null, 2)}\n`);
  for (const build of ['build-qbr-bundle.mjs', 'build-advanced-bundles.mjs']) {
    const result = spawnSync(process.execPath, [path.join(source, 'scripts', build)], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  const out = path.join(temp, 'stable');
  const result = spawnSync(process.execPath, [path.join(source, 'scripts/build-release-assets.mjs'), '--out', out], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Release intent is disabled/);
  assert.equal(fs.existsSync(out), false);
  const lockPath = path.join(source, 'package-lock.json');
  const lock = JSON.parse(fs.readFileSync(lockPath));
  lock.packages[''].version = '999.0.0';
  fs.writeFileSync(lockPath, JSON.stringify(lock));
  const rejected = spawnSync(process.execPath,
    [path.join(source, 'scripts/build-release-assets.mjs'), '--candidate', '--out', out],
    { encoding: 'utf8' });
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /package\/lock\/release version drift/);
  assert.equal(fs.existsSync(out), false);
});

test('candidate builds are reproducible, identify source state and cannot enter the stable installer', async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-candidate-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  for (const name of ['first', 'second']) {
    const result = spawnSync(process.execPath, [script, '--candidate', '--out', path.join(temp, name)], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  const first = path.join(temp, 'first'); const second = path.join(temp, 'second');
  const verify = () => spawnSync(process.execPath, [path.join(root, 'scripts/verify-release-assets.mjs'), second], { encoding: 'utf8' });
  const verified = verify();
  assert.equal(verified.status, 0, verified.stderr);
  assert.match(verified.stdout, /Verified candidate artifact integrity/);
  const secondBundle = path.join(second, 'threadify-workflows-bundle.json');
  const originalBundle = fs.readFileSync(secondBundle);
  fs.appendFileSync(secondBundle, ' ');
  assert.notEqual(verify().status, 0, 'corrupt asset must fail');
  fs.writeFileSync(secondBundle, originalBundle);
  const secondArchive = path.join(second, 'threadify-workflows-plugin-candidate.tar.gz');
  fs.renameSync(secondArchive, secondArchive + '.held');
  assert.notEqual(verify().status, 0, 'missing archive must fail');
  fs.renameSync(secondArchive + '.held', secondArchive);
  assert.ok(!fs.existsSync(path.join(first, 'stable-release-manifest.json')));
  for (const name of fs.readdirSync(first)) assert.deepEqual(fs.readFileSync(path.join(first, name)), fs.readFileSync(path.join(second, name)), name);
  const bundlePath = path.join(first, 'threadify-workflows-bundle.json');
  const manifestPath = path.join(first, 'candidate-release-manifest.json');
  const bundle = JSON.parse(fs.readFileSync(bundlePath)); const manifest = JSON.parse(fs.readFileSync(manifestPath));
  assert.equal(bundle.record_type, 'ThreadifyWorkflowsCandidateBundleV1');
  assert.equal(manifest.record_type, 'CandidateReleaseManifestV1');
  assert.equal(manifest.source.kind, 'candidate');
  assert.equal(typeof manifest.source.worktree_dirty, 'boolean');
  assert.match(manifest.source.content_manifest_sha256, /^[a-f0-9]{64}$/);
  assert.equal(bundle.bundled_viral_carousel_maker.version, '0.2.0');
  assert.equal(bundle.bundled_viral_carousel_maker.commit_sha, '7a2cf34ee51404311a1a287e2f04c2c8e7523ce3');
  assert.equal(bundle.bundled_viral_carousel_maker.demo_contract_sha256, 'f489877952820eec3da0951771f6bd75c286dc9d0969b0cefe1eceda00a6a8b9');
  assert.equal(bundle.bundled_viral_carousel_maker.bundled_content_sha256, 'ffa234d4f15c8be4fecfb372c99db0b18368af809db7d7fe7339855bcc3dec88');
  const demoEntry = bundle.files['plugin/vendor/viral-carousel-maker/src/viral_carousel_maker/contracts/controlled-mutation-demo-contract.json'];
  assert.equal(demoEntry.sha256, bundle.bundled_viral_carousel_maker.demo_contract_sha256);
  assert.ok(bundle.files['plugin/vendor/viral-carousel-maker/src/viral_carousel_maker/controlled_mutation.py']);
  assert.ok(bundle.files['plugin/vendor/viral-carousel-maker/skills/source/viral-carousel-maker/SKILL.md']);
  assert.ok(bundle.files['plugin/vendor/viral-carousel-maker/examples/specs/threads-soft-cta.yaml']);
  assert.ok(!Object.keys(bundle.files).some((name) => /lennox[^/]*reference/i.test(name)));
  assert.equal(manifest.assets[0].sha256, hash(fs.readFileSync(bundlePath)));
  const archivePath = path.join(first, 'threadify-workflows-plugin-candidate.tar.gz');
  assert.ok(fs.existsSync(archivePath));
  assert.equal(manifest.assets.find((asset) => asset.name.endsWith('.tar.gz')).sha256, hash(fs.readFileSync(archivePath)));
  const unpacked = path.join(temp, 'archive'); fs.mkdirSync(unpacked);
  const untar = spawnSync('tar', ['-xzf', archivePath, '-C', unpacked], { encoding: 'utf8' });
  assert.equal(untar.status, 0, untar.stderr);
  for (const [name, entry] of Object.entries(bundle.files).filter(([name]) => name.startsWith('plugin/'))) {
    assert.equal(hash(fs.readFileSync(path.join(unpacked, 'threadify-workflows', name.slice(7)))), entry.sha256);
  }
  for (const entry of Object.values(bundle.files)) assert.equal(entry.sha256, hash(Buffer.from(entry.content_base64, 'base64')));
  assert.ok(bundle.files['plugin/skills/threadify-create-my-day/SKILL.md']);
  assert.ok(!Object.keys(bundle.files).some((p) => p.includes('/.codex/goals/') || p.includes('/node_modules/')));
  await assert.rejects(() => fetchLatestStable({ sourceBundle: bundlePath, sourceManifest: manifestPath }), /invalid_release_manifest_type/);
  const extracted = path.join(temp, 'extracted');
  fs.mkdirSync(extracted);
  for (const [name, entry] of Object.entries(bundle.files)) {
    assert.ok(!name.startsWith('/') && !name.includes('\\') && name.split('/').every((part) => part && part !== '.' && part !== '..'));
    const destination = path.join(extracted, name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, Buffer.from(entry.content_base64, 'base64'), { flag: 'wx', mode: Number.parseInt(entry.mode, 8) });
    assert.equal(hash(fs.readFileSync(destination)), entry.sha256);
  }
  for (const surface of ['plugin', 'cli']) {
    const result = spawnSync(process.execPath, [path.join(extracted, surface, 'bin/threadify-workflows.mjs'), 'creator', 'status', '--state', path.join(temp, `state-${surface}`)], { input: '{}', encoding: 'utf8', cwd: temp });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).revision, 0);
  }
});

test('candidate builder rejects a commit label different from the checked-out source before creating output', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-source-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const out = path.join(temp, 'rejected');
  const result = spawnSync(process.execPath, [script, '--candidate', '--commit', '0'.repeat(40), '--out', out], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must match the checked-out HEAD/);
  assert.equal(fs.existsSync(out), false);
});
