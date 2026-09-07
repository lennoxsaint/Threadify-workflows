import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, rm, readFile, writeFile, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('../..', import.meta.url));

test('bundle check and build reject unknown files and symlinks without overwriting them', async (t) => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'creator-bundle-audit-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  for (const directory of ['scripts', 'lib/creator', 'docs', 'skills', 'schemas']) {
    await cp(path.join(root, directory), path.join(temp, directory), { recursive: true });
  }
  const run = (check = true) => spawnSync(process.execPath,
    [path.join(temp, 'scripts/build-creator-bundles.mjs'), ...(check ? ['--check'] : [])], { encoding: 'utf8' });
  assert.equal(run().status, 0);
  const unexpected = path.join(temp, 'skills/threadify-create-my-day/references/private-note.md');
  const earlierBundle = path.join(temp, 'skills/threadify-vault-setup/references/creator-engine.md');
  const original = await readFile(earlierBundle, 'utf8');
  await writeFile(earlierBundle, 'synthetic local edit');
  await writeFile(unexpected, 'synthetic unexpected material');
  for (const check of [true, false]) {
    const result = run(check);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unexpected.*private-note/);
  }
  assert.equal(await readFile(unexpected, 'utf8'), 'synthetic unexpected material');
  assert.equal(await readFile(earlierBundle, 'utf8'), 'synthetic local edit', 'audit must finish before writing any bundle');
  await writeFile(earlierBundle, original);
  await rm(unexpected);
  const target = path.join(temp, 'skills/threadify-vault-setup/scripts/engine/cli.mjs');
  const outside = path.join(temp, 'outside.mjs');
  await writeFile(outside, 'synthetic owner file');
  await rm(target);
  await symlink(outside, target);
  for (const check of [true, false]) {
    const result = run(check);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /symlink.*cli.mjs/);
  }
  assert.equal(await readFile(outside, 'utf8'), 'synthetic owner file');
  await rm(target);
  await symlink(path.join(temp, 'nonexistent.mjs'), target);
  assert.match(run(false).stderr, /symlink.*cli.mjs/);
  await rm(target);
  const engineDirectory = path.dirname(target);
  await rm(engineDirectory, { recursive: true });
  await symlink(path.join(temp, 'lib/creator'), engineDirectory);
  assert.match(run().stderr, /symlink.*scripts\/engine/);
});

test('all four creator skills run from isolated copies without the source repository', async (t) => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'creator-bundles-test-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  for (const name of ['threadify-vault-setup', 'threadify-create-my-day', 'threadify-create-my-week', 'threadify-create-my-month']) {
    const target = path.join(temp, name);
    await cp(path.join(root, 'skills', name), target, { recursive: true });
    const skill = await readFile(path.join(target, 'SKILL.md'), 'utf8');
    assert.match(skill, /^---\nname: threadify-/);
    for (const reference of ['creator-system.md', 'creator-engine.md']) assert.ok((await readFile(path.join(target, 'references', reference), 'utf8')).length > 100);
    const result = spawnSync(process.execPath, [path.join(target, 'scripts/creator.mjs'), 'status', '--state', path.join(temp, `state-${name}`)],
      { cwd: temp, input: '{}', encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).result.provider_writes_performed, false);
    assert.deepEqual(JSON.parse(result.stdout).result.plan_list, []);
  }
});
