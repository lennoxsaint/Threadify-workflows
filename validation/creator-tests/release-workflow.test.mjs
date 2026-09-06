import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('PR checks install dependencies, retain upgrade history and verify an explicit candidate without publishing', () => {
  const workflow = fs.readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const primary = workflow.split('  isolated-client-installs:')[0];
  assert.match(primary, /fetch-depth: 0/);
  assert.ok(primary.indexOf('npm ci --ignore-scripts') > 0);
  assert.ok(primary.indexOf('npm ci --ignore-scripts') < primary.indexOf('run: npm test'));
  assert.match(primary, /npm run release:build -- --candidate --commit "\$GITHUB_SHA"/);
  assert.match(primary, /node scripts\/verify-release-assets\.mjs dist/);
  assert.doesNotMatch(primary, /gh release create|git push|grep -Eri/);
});

test('release workflow installs locked dependencies before tests and includes the plugin archive without retired dispatch', () => {
  const workflow = fs.readFileSync(new URL('../../.github/workflows/release.yml', import.meta.url), 'utf8');
  assert.ok(workflow.indexOf('npm ci --ignore-scripts') > 0);
  assert.ok(workflow.indexOf('npm ci --ignore-scripts') < workflow.indexOf('run: npm test'));
  assert.match(workflow, /dist\/threadify-workflows-plugin\.tar\.gz/);
  assert.doesNotMatch(workflow, /FULL_CIRCLE_SYNC_TOKEN|full-circle\/dispatches/);
  assert.match(workflow, /--target "\$GITHUB_SHA"/);
});
