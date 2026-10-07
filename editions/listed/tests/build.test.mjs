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
const selected = JSON.parse(fs.readFileSync(path.join(editionDir, 'edition.json'), 'utf8')).skills;

// A throwaway repo root holding only what the build reads, plus the committed package and lock.
function scratchRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'listed-edition-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const { source } of selected) fs.cpSync(path.join(repoRoot, source), path.join(root, source), { recursive: true });
  for (const entry of ['edition.json', 'shared', 'assets', 'overrides', 'package', 'package.lock.json']) {
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

test('the package carries only the selected skills, rewritten links and portable manifests', () => {
  const { files } = buildEdition({ root: repoRoot });
  const keys = [...files.keys()];
  assert.deepEqual(keys.filter((key) => !key.startsWith('threadify/skills/')), [
    '.agents/plugins/marketplace.json',
    'threadify/assets/icon.png',
    'threadify/assets/logo.png',
    'threadify/assets/screenshots/1-review.png',
    'threadify/assets/screenshots/2-review-crosspost.png',
    'threadify/assets/screenshots/3-calendar.png',
    'threadify/mcp.json',
    'threadify/plugin.json',
  ]);
  const shipped = [...new Set(keys.filter((key) => key.startsWith('threadify/skills/')).map((key) => key.split('/')[2]))];
  assert.deepEqual(shipped, selected.map(({ name }) => name).sort());
  for (const { name } of selected) {
    const prefix = `threadify/skills/${name}/`;
    assert.ok(files.has(`${prefix}references/connect.md`), `${name} ships the connection guide`);
    for (const key of keys.filter((item) => item.startsWith(prefix))) {
      assert.doesNotMatch(key, /workflow-manifest|workflow-readme|threadify-001|agents\/openai\.yaml/, key);
    }
    const skill = files.get(`${prefix}SKILL.md`).toString('utf8');
    assert.match(skill, /\(references\/connect\.md\)/, name);
    assert.doesNotMatch(skill, /threadify-001|workflow-manifest|Advanced workflow/, name);
  }
  const mcp = JSON.parse(files.get('threadify/mcp.json'));
  assert.deepEqual(mcp.mcpServers, { threadify: { type: 'streamable-http', url: 'https://www.threadify.app/api/mcp/threadify' } });
  const plugin = JSON.parse(files.get('threadify/plugin.json'));
  assert.equal(plugin.extensions['com.openai'].interface.logo, './assets/logo.png');
});

test('every skill that schedules reviews first and passes the approval', () => {
  const { files } = buildEdition({ root: repoRoot });
  for (const { name } of selected) {
    const text = [...files].filter(([key]) => key.startsWith(`threadify/skills/${name}/`) && key.endsWith('.md'))
      .map(([, content]) => content.toString('utf8')).join('\n');
    if (!text.includes('`schedule_post`')) continue;
    assert.match(text, /`review_post`/, `${name} schedules without review_post`);
    assert.match(text, /`approval`/, `${name} schedules without passing the approval`);
  }
});

test('descriptions are distinct and name a Threads or Threadify intent', () => {
  const descriptions = selected.map(({ description }) => description);
  assert.equal(new Set(descriptions).size, descriptions.length);
  for (const { name, description } of selected) {
    assert.match(description, /Use when the person asks to /, name);
    assert.match(description.slice(description.indexOf('Use when')), /Threads|Threadify|X Article/, name);
  }
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

const overridden = selected.filter((skill) => skill.override !== undefined);

test('an override ships the hand-written skill, not the upstream files', () => {
  assert.deepEqual(overridden.map(({ name }) => name).sort(), ['threadify-create-my-week', 'threadify-get-set-up', 'threadify-inbound-replies']);
  const { files } = buildEdition({ root: repoRoot });
  for (const { name, source, override, description } of overridden) {
    const shipped = [...files.keys()].filter((key) => key.startsWith(`threadify/skills/${name}/`)).map((key) => key.slice(`threadify/skills/${name}/`.length));
    assert.deepEqual(shipped.sort(), ['SKILL.md', 'references/connect.md'], name);
    const written = fs.readFileSync(path.join(editionDir, override, 'SKILL.md'), 'utf8');
    const built = files.get(`threadify/skills/${name}/SKILL.md`).toString('utf8');
    // Only the description line differs: edition.json owns every listed description.
    assert.equal(built.replace(/^description: .*$/m, ''), written.replace(/^description: .*$/m, ''), name);
    assert.ok(built.includes(`description: ${JSON.stringify(description)}`), name);
    // The upstream skill carries local helpers; none of them ship.
    assert.ok(fs.readdirSync(path.join(repoRoot, source)).length > 1, `${name} upstream has more than SKILL.md`);
  }
});

test('--check names an upstream change to an overridden skill, so the rewrite gets reviewed', (t) => {
  const root = scratchRoot(t);
  fs.appendFileSync(path.join(root, 'skills/threadify-inbound-replies/SKILL.md'), '\nAn upstream change.\n');
  const result = runCli('--check', '--root', root);
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stderr, /package file differs/);
  assert.match(result.stderr, /source changed .*skills\/threadify-inbound-replies\/SKILL\.md/);

  const edited = scratchRoot(t);
  fs.appendFileSync(path.join(edited, 'editions/listed/overrides/threadify-get-set-up/SKILL.md'), '\nA hand edit.\n');
  const stale = runCli('--check', '--root', edited);
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /package file differs from build: threadify\/skills\/threadify-get-set-up\/SKILL\.md/);
});

test('an override refuses drop and replace rules, a missing folder and a folder under another name', (t) => {
  const root = scratchRoot(t);
  const index = selected.findIndex(({ name }) => name === 'threadify-get-set-up');
  editEditionJson(root, (edition) => { edition.skills[index].replace = [{ file: 'SKILL.md', find: 'Get set up', replace: 'Set up' }]; });
  assert.throws(() => buildEdition({ root }), /threadify-get-set-up is an override; edit overrides\/threadify-get-set-up instead of using drop or replace rules/);
  editEditionJson(root, (edition) => { delete edition.skills[index].replace; edition.skills[index].drop = ['references/*']; });
  assert.throws(() => buildEdition({ root }), /is an override/);
  editEditionJson(root, (edition) => { delete edition.skills[index].drop; edition.skills[index].override = 'overrides/threadify-inbound-replies'; });
  assert.throws(() => buildEdition({ root }), /threadify-get-set-up override must be overrides\/threadify-get-set-up/);
  editEditionJson(root, (edition) => { edition.skills[index].override = 'overrides/threadify-get-set-up'; });
  fs.rmSync(path.join(root, 'editions/listed/overrides/threadify-get-set-up'), { recursive: true });
  assert.throws(() => buildEdition({ root }), /threadify-get-set-up override folder is missing/);
});

test('the self-installed release bundle never includes the listed edition', () => {
  const released = collectReleaseFiles(repoRoot);
  assert.ok(released.length > 0);
  assert.deepEqual(released.filter((file) => file.startsWith('editions/')), []);
});
