import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {
  inspectConversationWriterLock,
  readConversationState,
  recoverConversationWriterLock,
  updateConversationState,
} from '../../lib/conversations/store.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'conversation-store-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return path.join(root, 'private');
}

test('conversation state uses private POSIX permissions and atomic revisions', async (t) => {
  const root = await fixture(t);
  assert.deepEqual(await readConversationState(root), { revision: 0, payload: null });
  await updateConversationState(root, 0, () => ({ schema_version: 'synthetic', state: 'attempt_pending' }));
  assert.equal((await readConversationState(root)).revision, 1);
  assert.equal((await stat(root)).mode & 0o777, 0o700);
  assert.equal((await stat(path.join(root, 'state.json'))).mode & 0o777, 0o600);
});

test('interrupted calculations and concurrent writers never overwrite accepted conversation state', async (t) => {
  const root = await fixture(t);
  await updateConversationState(root, 0, () => ({ keep: true }));
  const before = await readFile(path.join(root, 'state.json'), 'utf8');
  await assert.rejects(updateConversationState(root, 0, () => ({ keep: false })), /revision/);
  await assert.rejects(updateConversationState(root, 1, () => { throw new Error('interrupted conversation update'); }), /interrupted/);
  assert.equal(await readFile(path.join(root, 'state.json'), 'utf8'), before);

  let entered; const ready = new Promise((resolve) => { entered = resolve; });
  let release; const paused = new Promise((resolve) => { release = resolve; });
  const first = updateConversationState(root, 1, async (payload) => { entered(); await paused; return { ...payload, first: true }; });
  await ready;
  try { await assert.rejects(updateConversationState(root, 1, () => ({ second: true })), /locked/); }
  finally { release(); }
  await first;
  assert.deepEqual((await readConversationState(root)).payload, { keep: true, first: true });
});

test('a terminated writer leaves accepted pending state and needs exact dead-lock recovery', async (t) => {
  const root = await fixture(t);
  await updateConversationState(root, 0, () => ({ state: 'attempt_pending' }));
  const module = new URL('../../lib/conversations/store.mjs', import.meta.url).href;
  const code = `import { updateConversationState } from ${JSON.stringify(module)}; await updateConversationState(process.argv[1], 1, () => process.exit(23));`;
  const exit = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', code, root], { stdio: 'ignore' });
    child.once('error', reject); child.once('exit', resolve);
  });
  assert.equal(exit, 23);
  assert.equal((await readConversationState(root)).payload.state, 'attempt_pending');
  const lock = await inspectConversationWriterLock(root);
  assert.equal(lock.liveness, 'dead');
  await assert.rejects(recoverConversationWriterLock(root, 'wrong-token'), /exact/);
  assert.equal((await recoverConversationWriterLock(root, lock.token)).state.revision, 1);
});

test('symlinks, broad permissions and checksum changes fail closed', async (t) => {
  const root = await fixture(t); const other = `${root}-other`;
  await mkdir(other, { mode: 0o700 }); await symlink(other, root);
  await assert.rejects(readConversationState(root), /symlink/);
  await rm(root); await mkdir(root, { mode: 0o755 }); await chmod(root, 0o755);
  await assert.rejects(readConversationState(root), /private/);
  await rm(root, { recursive: true }); await mkdir(root, { mode: 0o700 });
  await updateConversationState(root, 0, () => ({ state: 'unknown' }));
  const file = path.join(root, 'state.json'); const original = JSON.parse(await readFile(file, 'utf8'));
  await writeFile(file, JSON.stringify({ ...original, payload: { state: 'succeeded' } }));
  await assert.rejects(readConversationState(root), /integrity/);
  await writeFile(file, '{}');
  await assert.rejects(readConversationState(root), /schema/);
});

