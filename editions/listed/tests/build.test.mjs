import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildEdition, checkEdition, writeEdition } from '../build.mjs';
import { collectReleaseFiles } from '../../../lib/release-files.mjs';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const buildScript = fileURLToPath(new URL('../build.mjs', import.meta.url));
const editionDir = path.join(repoRoot, 'editions/listed');
const skillSource = 'skills/threadify-daily-posts-heartbeat';

// A throwaway repo root holding only what the build reads, plus the committed package and lock.
function scratchRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'listed-edition-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.cpSync(path.join(repoRoot, skillSource), path.join(root, skillSource), { recursive: true });
  for (const entry of ['edition.json', 'shared', 'assets', 'package', 'package.lock.json']) {
    fs.cpSync(path.join(editionDir, entry), path.join(root, 'editions/listed', entry), { recursive: true });
  }
  return root;
}
const runCli = (...args) => spawnSync(process.execPath, [buildScript, ...args], { encoding: 'utf8' });
const editEditionJson = (root, change) => {
  const file = path.join(root, 'editions/listed/edition.json');
  const edition = JSON.parse(fs.readFileSync(file, 'utf8'));
  change(edition);
  fs.writeFileSync(file, JSON.stringify(edition, null, 2));
};

test('the committed package and lock match a fresh build of the repo', () => {
  assert.deepEqual(checkEdition({ root: repoRoot }), []);
});

test('the build is reproducible: two builds and a written package are byte-identical', (t) => {
  const first = buildEdition({ root: repoRoot });
  const second = buildEdition({ root: repoRoot });
  assert.deepEqual([...first.files.keys()], [...second.files.keys()]);
  for (const [relative, content] of first.files) assert.ok(content.equals(second.files.get(relative)), relative);
  assert.ok(first.lock.equals(second.lock));

  const root = scratchRoot(t);
  fs.rmSync(path.join(root, 'editions/listed/package'), { recursive: true });
  fs.rmSync(path.join(root, 'editions/listed/package.lock.json'));
  writeEdition({ root });
  writeEdition({ root });
  for (const [relative, content] of first.files) {
    assert.ok(fs.readFileSync(path.join(root, 'editions/listed/package', relative)).equals(content), relative);
  }
  assert.ok(fs.readFileSync(path.join(root, 'editions/listed/package.lock.json')).equals(first.lock));
  assert.equal(runCli('--check', '--root', root).status, 0);
});

test('the package carries only the selected skill, rewritten links and portable manifests', () => {
  const { files } = buildEdition({ root: repoRoot });
  assert.deepEqual([...files.keys()], [
    '.agents/plugins/marketplace.json',
    'threadify/assets/icon.png',
    'threadify/assets/logo.png',
    'threadify/mcp.json',
    'threadify/plugin.json',
    'threadify/skills/threadify-daily-posts-heartbeat/SKILL.md',
    'threadify/skills/threadify-daily-posts-heartbeat/references/connect.md',
  ]);
  const skill = files.get('threadify/skills/threadify-daily-posts-heartbeat/SKILL.md').toString('utf8');
  assert.match(skill, /\(references\/connect\.md\)/);
  assert.doesNotMatch(skill, /threadify-001|workflow-manifest|Advanced workflow/);
  const mcp = JSON.parse(files.get('threadify/mcp.json'));
  assert.deepEqual(mcp.mcpServers, { threadify: { type: 'streamable-http', url: 'https://www.threadify.app/api/mcp/threadify' } });
  const plugin = JSON.parse(files.get('threadify/plugin.json'));
  assert.equal(plugin.extensions['com.openai'].interface.logo, './assets/logo.png');
});

test('--check fails on a hand edit inside the committed package', (t) => {
  const root = scratchRoot(t);
  const file = path.join(root, 'editions/listed/package/threadify/skills/threadify-daily-posts-heartbeat/SKILL.md');
  fs.appendFileSync(file, '\nA hand edit.\n');
  const result = runCli('--check', '--root', root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /package file differs from build: threadify\/skills\/threadify-daily-posts-heartbeat\/SKILL\.md/);

  fs.writeFileSync(path.join(root, 'editions/listed/package/threadify/extra.md'), 'stray');
  assert.match(runCli('--check', '--root', root).stderr, /unexpected file in package: threadify\/extra\.md/);
});

test('--check detects an upstream skill change, including in a dropped file', (t) => {
  const root = scratchRoot(t);
  fs.appendFileSync(path.join(root, skillSource, 'SKILL.md'), '\nAn upstream change.\n');
  let result = runCli('--check', '--root', root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /source changed since the last build \(review, then rebuild\): skills\/threadify-daily-posts-heartbeat\/SKILL\.md/);

  const dropped = scratchRoot(t);
  fs.appendFileSync(path.join(dropped, skillSource, 'references/workflow-readme.md'), '\nA change in a dropped file.\n');
  result = runCli('--check', '--root', dropped);
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stderr, /package file differs/);
  assert.match(result.stderr, /source changed .*references\/workflow-readme\.md/);
});

test('a replace rule must match exactly once or the build fails', (t) => {
  const root = scratchRoot(t);
  editEditionJson(root, (edition) => { edition.skills[0].replace[0].find = 'text that is not in the skill'; });
  assert.throws(() => buildEdition({ root }), /replace rule #1 \(SKILL\.md\) matched 0 times; it must match exactly once/);
  const result = runCli('--root', root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /matched 0 times/);

  editEditionJson(root, (edition) => { edition.skills[0].replace[0].find = 'approval'; });
  assert.throws(() => buildEdition({ root }), /matched \d+ times/);
});

test('a drop glob that matches nothing fails the build', (t) => {
  const root = scratchRoot(t);
  editEditionJson(root, (edition) => { edition.skills[0].drop.push('references/renamed-*.md'); });
  assert.throws(() => buildEdition({ root }), /drop glob matched nothing: references\/renamed-\*\.md/);
});

test('the self-installed release bundle never includes the listed edition', () => {
  const released = collectReleaseFiles(repoRoot);
  assert.ok(released.length > 0);
  assert.deepEqual(released.filter((file) => file.startsWith('editions/')), []);
});
