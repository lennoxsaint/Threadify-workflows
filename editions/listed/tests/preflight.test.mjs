import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { preflight, parseFrontMatter } from '../preflight.mjs';

const preflightScript = fileURLToPath(new URL('../preflight.mjs', import.meta.url));
const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
const realPackage = fileURLToPath(new URL('../package/threadify', import.meta.url));
const errorCodes = (dir) => preflight(dir).filter((finding) => finding.level === 'error').map((finding) => finding.code);

test('the committed listed package passes the preflight', () => {
  assert.deepEqual(preflight(realPackage), []);
  const result = spawnSync(process.execPath, [preflightScript, realPackage], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout);
});

test('a minimal valid fixture passes, so each bad fixture isolates one fault', () => {
  assert.deepEqual(errorCodes(fixture('good-minimal')), []);
});

const BAD = [
  ['bad-mcp-no-schema', 'listed_mcp_schema_missing'],
  ['bad-mcp-no-type', 'listed_mcp_server_type_invalid'],
  ['bad-app-json', 'app_configuration_excluded'],
  ['bad-display-name-long', 'submission_display_name_too_long'],
  ['bad-plans-link', 'listed_policy_plans_link'],
  ['bad-local-helper', 'listed_policy_local_helper'],
  ['bad-logo-not-square', 'raster_image_not_square'],
];

for (const [name, code] of BAD) {
  test(`${name} fails with ${code}`, () => {
    assert.deepEqual(errorCodes(fixture(name)), [code]);
    const result = spawnSync(process.execPath, [preflightScript, fixture(name), '--json'], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    const report = JSON.parse(result.stdout);
    assert.equal(report.ok, false);
    assert.deepEqual(report.findings.map((finding) => finding.code), [code]);
  });
}

test('a missing plugin folder and a missing argument are reported', () => {
  assert.deepEqual(errorCodes(path.join(fixture('good-minimal'), 'nope')), ['plugin_root_missing']);
  assert.equal(spawnSync(process.execPath, [preflightScript], { encoding: 'utf8' }).status, 2);
});

test('front matter parsing handles quoted values and reports malformed blocks', () => {
  assert.deepEqual(parseFrontMatter('---\nname: a\ndescription: "Says \\"hi\\"."\n---\nBody\n').data, { name: 'a', description: 'Says "hi".' });
  assert.equal(parseFrontMatter('No front matter').error, 'skill_frontmatter_missing');
  assert.equal(parseFrontMatter('---\nname: a\n').error, 'skill_frontmatter_unclosed');
  assert.equal(parseFrontMatter('---\nname: "unterminated\n---\n').error, 'skill_frontmatter_yaml_malformed');
});
