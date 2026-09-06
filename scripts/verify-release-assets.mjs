#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Local integrity check only. Source privacy validation and extracted-content
// tests remain separate gates; matching hashes do not make content public-safe.
const directory = path.resolve(process.argv[2] ?? 'dist');
const hash = (content) => crypto.createHash('sha256').update(content).digest('hex');
const read = (name) => fs.readFileSync(path.join(directory, name));
const manifests = ['candidate-release-manifest.json', 'stable-release-manifest.json']
  .filter((name) => fs.existsSync(path.join(directory, name)));
assert.equal(manifests.length, 1, 'Exactly one release manifest is required.');
const manifestName = manifests[0];
const candidate = manifestName.startsWith('candidate-');
const manifestBytes = read(manifestName);
const manifest = JSON.parse(manifestBytes);
assert.equal(manifest.record_type, candidate ? 'CandidateReleaseManifestV1' : 'StableReleaseManifestV1');
const archiveName = `threadify-workflows-plugin${candidate ? '-candidate' : ''}.tar.gz`;
const expectedAssets = ['threadify-workflows-bundle.json', archiveName];
assert.deepEqual(manifest.assets.map((asset) => asset.name).sort(), [...expectedAssets].sort());
const checksums = [];
for (const asset of manifest.assets) {
  const bytes = read(asset.name);
  assert.equal(bytes.length, asset.bytes, `Asset size mismatch: ${asset.name}`);
  assert.equal(hash(bytes), asset.sha256, `Asset hash mismatch: ${asset.name}`);
  checksums.push(`${asset.sha256}  ${asset.name}`);
}
checksums.push(`${hash(manifestBytes)}  ${manifestName}`);
assert.deepEqual(read('checksums.txt').toString().trim().split('\n').sort(), checksums.sort());
assert.ok(read('CHANGELOG.md').length > 0, 'Changelog is required.');
const bundle = JSON.parse(read('threadify-workflows-bundle.json'));
assert.equal(bundle.record_type, candidate ? 'ThreadifyWorkflowsCandidateBundleV1' : 'ThreadifyWorkflowsInstallBundleV1');
assert.deepEqual(bundle.source, manifest.source);
for (const [key, value] of Object.entries(bundle.release)) assert.equal(value, manifest[key], `Release identity mismatch: ${key}`);
assert.ok(Object.keys(bundle.files).length > 0, 'Bundle must contain files.');
for (const [name, entry] of Object.entries(bundle.files)) {
  assert.ok(/^(plugin|skill|cli)\//.test(name) && !/[\\\r\n\0]/.test(name)
    && name.split('/').every((part) => part && part !== '.' && part !== '..'), 'Invalid bundle path.');
  const bytes = Buffer.from(entry.content_base64, 'base64');
  assert.equal(bytes.length, entry.bytes, `File size mismatch: ${name}`);
  assert.equal(hash(bytes), entry.sha256, `File hash mismatch: ${name}`);
}
console.log(`Verified ${candidate ? 'candidate' : 'stable'} artifact integrity: ${manifest.release_version}, ${Object.keys(bundle.files).length} entries. No host, privacy or publication proof implied.`);
