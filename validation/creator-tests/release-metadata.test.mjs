import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readReleaseMetadata } from '../../lib/release-metadata.mjs';
const root = fileURLToPath(new URL('../..', import.meta.url));
const files = ['release/release-intent.json', 'package.json', 'package-lock.json',
  '.codex-plugin/plugin.json', 'public-rules/qualified-buyer-research.v1.json'];

test('release identity accepts explicit disabled or enabled intent without enabling it', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-metadata-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const originals = Object.fromEntries(files.map((file) => [file, JSON.parse(fs.readFileSync(path.join(root, file)))]));
  function fixture(file, change) {
    for (const name of files) {
      const value = structuredClone(originals[name]);
      if (file === name) change(value);
      const target = path.join(temp, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, JSON.stringify(value));
    }
  }
  for (const enabled of [false, true]) {
    fixture(files[0], (value) => { value.release = enabled; });
    assert.equal(readReleaseMetadata(temp).release, enabled);
    assert.equal(JSON.parse(fs.readFileSync(path.join(temp, files[0]))).release, enabled);
  }
  for (const [file, change, error] of [
    [files[0], (v) => { v.release = 'false'; }, /boolean/],
    [files[0], (v) => { v.release_version = 'latest'; }, /release_version/],
    [files[0], (v) => { v.change_class = 'unknown'; }, /change_class/],
    ['package.json', (v) => { v.version = '999.0.0'; }, /version drift/],
    ['package-lock.json', (v) => { v.packages[''].version = '999.0.0'; }, /version drift/],
    ['package-lock.json', (v) => { v.name = 'another-package'; }, /name drift/],
    ['.codex-plugin/plugin.json', (v) => { v.version = '999.0.0'; }, /plugin version/],
    [files[4], (v) => { v.rules_version = '999.0.0'; }, /rules version/],
  ]) {
    fixture(file, change);
    assert.throws(() => readReleaseMetadata(temp), error);
  }
});
