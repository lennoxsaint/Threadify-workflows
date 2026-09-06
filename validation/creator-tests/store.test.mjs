import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, stat, symlink, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { readState, updateState, inspectWriterLock, recoverWriterLock } from '../../lib/creator/store.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'creator-store-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return path.join(root, 'private');
}

test('atomic updates persist revisions and owner-only permissions across reopen', async (t) => {
  const root = await fixture(t);
  assert.deepEqual(await readState(root), { revision: 0, payload: null });
  await updateState(root, 0, () => ({ state: 'attempt_pending', attempts: [{ key: 'synthetic' }] }));
  assert.deepEqual(await readState(root), { revision: 1, payload: { state: 'attempt_pending', attempts: [{ key: 'synthetic' }] } });
  assert.equal((await stat(root)).mode & 0o777, 0o700);
  assert.equal((await stat(path.join(root, 'state.json'))).mode & 0o777, 0o600);
});

test('stale revisions and callback failures never overwrite accepted state', async (t) => {
  const root = await fixture(t);
  await updateState(root, 0, () => ({ keep: true }));
  const before = await readFile(path.join(root, 'state.json'), 'utf8');
  await assert.rejects(updateState(root, 0, () => ({ keep: false })), /revision/);
  await assert.rejects(updateState(root, 1, () => { throw new Error('interrupted calculation'); }), /interrupted/);
  assert.equal(await readFile(path.join(root, 'state.json'), 'utf8'), before);
  await updateState(root, 1, (payload) => ({ ...payload, recovered: true }));
  assert.equal((await readState(root)).revision, 2);
});

test('live lock rejects a second writer; first writer completes without losing data', async (t) => {
  const root = await fixture(t);
  let ready; const entered = new Promise((r) => { ready = r; });
  let release; const paused = new Promise((r) => { release = r; });
  const first = updateState(root, 0, async () => { ready(); await paused; return { first: true }; });
  await entered;
  try {
    await assert.rejects(updateState(root, 0, () => ({ second: true })), /locked/);
    const lock = await inspectWriterLock(root);
    assert.equal(lock.liveness, 'alive');
    await assert.rejects(recoverWriterLock(root, lock.token), /dead/);
  }
  finally { release(); }
  await first;
  assert.deepEqual((await readState(root)).payload, { first: true });
});

test('a real terminated writer preserves accepted state and allows only verified dead-lock recovery', async (t) => {
  const root = await fixture(t); await updateState(root, 0, () => ({ state: 'attempt_pending' }));
  const module = new URL('../../lib/creator/store.mjs', import.meta.url).href;
  const code = `import { updateState } from ${JSON.stringify(module)}; await updateState(process.argv[1], 1, () => process.exit(23));`;
  const exit = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', code, root], { stdio: 'ignore' });
    child.once('error', reject); child.once('exit', resolve);
  });
  assert.equal(exit, 23);
  assert.equal((await readState(root)).payload.state, 'attempt_pending');
  const lock = await inspectWriterLock(root); assert.equal(lock.liveness, 'dead');
  await assert.rejects(recoverWriterLock(root, 'wrong-token'), /exact/);
  const recovered = await recoverWriterLock(root, lock.token);
  assert.equal(recovered.state.revision, 1);
  assert.equal(await inspectWriterLock(root), null);
  await updateState(root, 1, (p) => ({ ...p, recovered: true }));
  assert.equal((await readState(root)).payload.state, 'attempt_pending');
});

test('corruption and unknown schemas fail closed instead of silently restoring stale data', async (t) => {
  const root = await fixture(t); await updateState(root, 0, () => ({ state: 'unknown' }));
  const file = path.join(root, 'state.json');
  const original = JSON.parse(await readFile(file, 'utf8'));
  await writeFile(file, JSON.stringify({ ...original, payload: { state: 'approved' } }));
  await assert.rejects(readState(root), /integrity/);
  await assert.rejects(updateState(root, 1, () => ({})), /integrity/);
  await writeFile(file, JSON.stringify({ ...original, schema_version: 'future' }));
  await assert.rejects(readState(root), /schema/);
});

test('symlinked roots or state and broad directory permissions are refused', async (t) => {
  const root = await fixture(t); const other = `${root}-other`;
  await mkdir(other, { mode: 0o700 }); await symlink(other, root);
  await assert.rejects(readState(root), /symlink/);
  await rm(root); await mkdir(root, { mode: 0o755 });
  await assert.rejects(readState(root), /private/);
  await rm(root, { recursive: true }); await mkdir(root, { mode: 0o700 });
  await writeFile(path.join(other, 'target'), '{}');
  await symlink(path.join(other, 'target'), path.join(root, 'state.json'));
  await assert.rejects(readState(root), /symlink/);
});
