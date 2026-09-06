import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { reserveReleaseOutput, collectReleaseFiles } from '../../lib/release-files.mjs';
const fixture = (t) => { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-release-test-')); t.after(() => fs.rmSync(root, { recursive: true, force: true })); return root; };

test('release output never deletes, replaces or reuses existing paths', (t) => {
  const root = fixture(t); const existing = path.join(root, 'existing'); fs.mkdirSync(existing);
  fs.writeFileSync(path.join(existing, 'owner.txt'), 'preserve');
  for (const target of [root, existing, path.parse(root).root, os.homedir()]) assert.throws(() => reserveReleaseOutput(target));
  assert.equal(fs.readFileSync(path.join(existing, 'owner.txt'), 'utf8'), 'preserve');
  const link = path.join(root, 'link'); fs.symlinkSync(existing, link); assert.throws(() => reserveReleaseOutput(link));
  const output = path.join(root, 'new-release'); assert.equal(reserveReleaseOutput(output), output);
  assert.throws(() => reserveReleaseOutput(output));
  assert.deepEqual(fs.readdirSync(output), []);
  assert.throws(() => reserveReleaseOutput(path.join(root, 'docs'), { sourceRoot: root }), /under dist/);
});

test('release inventory includes public package files but excludes local runtime material and output', (t) => {
  const root = fixture(t);
  for (const file of ['README.md', 'package.json', '.mcp.json', '.codex-plugin/plugin.json', 'skills/example/SKILL.md',
    '.env', '.codex/goals/private.md', 'dist/old.json', 'tmp/private.md', 'notes/private.md', 'skills/example/.env']) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), 'synthetic');
  }
  assert.deepEqual(collectReleaseFiles(root), ['.codex-plugin/plugin.json', '.mcp.json', 'README.md', 'package.json', 'skills/example/SKILL.md'].sort());
});

test('release inventory refuses symlinked public files instead of dereferencing outside material', (t) => {
  const root = fixture(t); fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(path.join(root, 'private.txt'), 'private');
  fs.symlinkSync(path.join(root, 'private.txt'), path.join(root, 'docs', 'public.md'));
  assert.throws(() => collectReleaseFiles(root), /symlink/i);
});

test('release inventory checks special manifest parents and never follows linked skill directories', (t) => {
  const root = fixture(t); const outside = fixture(t);
  fs.writeFileSync(path.join(outside, 'plugin.json'), '{}');
  fs.symlinkSync(outside, path.join(root, '.codex-plugin'));
  assert.throws(() => collectReleaseFiles(root), /symlink/i);
  fs.unlinkSync(path.join(root, '.codex-plugin'));
  fs.mkdirSync(path.join(root, 'skills'));
  fs.symlinkSync(outside, path.join(root, 'skills', 'private'));
  assert.throws(() => collectReleaseFiles(root), /symlink/i);
});

test('actual release CLI refuses an existing output without deleting its contents', (t) => {
  const root = fixture(t); fs.writeFileSync(path.join(root, 'owner.txt'), 'preserve');
  const script = fileURLToPath(new URL('../../scripts/build-release-assets.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script, '--candidate', '--out', root], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /EEXIST/);
  assert.deepEqual(fs.readdirSync(root), ['owner.txt']);
  assert.equal(fs.readFileSync(path.join(root, 'owner.txt'), 'utf8'), 'preserve');
});
