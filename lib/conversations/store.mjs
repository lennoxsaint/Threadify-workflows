import { mkdir, lstat, open, rename, unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { reviewHash } from '../creator/review.mjs';

const assert = (condition, message) => { if (!condition) throw new Error(message); };

async function privateRoot(root) {
  assert(process.platform !== 'win32', 'Private conversation state requires POSIX permissions; use a supported private host workspace.');
  assert(typeof root === 'string' && path.isAbsolute(root) && path.resolve(root) !== path.parse(root).root
    && path.resolve(root) !== os.homedir(), 'Choose a dedicated absolute private conversation state directory.');
  await mkdir(root, { recursive: true, mode: 0o700 });
  const info = await lstat(root);
  assert(!info.isSymbolicLink(), 'Conversation state root must not be a symlink.');
  assert(info.isDirectory() && (info.mode & 0o077) === 0 && info.uid === process.getuid(),
    'Conversation state directory must be private and owned by this user.');
}

async function readEnvelope(root) {
  let handle;
  try {
    handle = await open(path.join(root, 'state.json'), constants.O_RDONLY | constants.O_NOFOLLOW);
    const info = await handle.stat();
    assert(info.isFile() && (info.mode & 0o077) === 0 && info.uid === process.getuid(),
      'Conversation state file must be private and owner-controlled.');
    const data = JSON.parse(await handle.readFile('utf8'));
    assert(data.schema_version === 'conversation-state.v1', 'Unsupported conversation state schema.');
    assert(Number.isSafeInteger(data.revision) && data.revision > 0, 'Invalid conversation state revision.');
    const { checksum, ...body } = data;
    assert(checksum === reviewHash(body), 'Conversation state integrity failure; preserve file and reconcile before recovery.');
    return { revision: data.revision, payload: data.payload };
  } catch (error) {
    if (error.code === 'ENOENT') return { revision: 0, payload: null };
    if (error.code === 'ELOOP') throw new Error('Conversation state file must not be a symlink.');
    throw error;
  } finally { await handle?.close(); }
}

export async function readConversationState(root) {
  await privateRoot(root);
  return readEnvelope(root);
}

export async function inspectConversationWriterLock(root) {
  await privateRoot(root);
  let handle;
  try {
    handle = await open(path.join(root, 'writer.lock'), constants.O_RDONLY | constants.O_NOFOLLOW);
    const info = await handle.stat();
    assert(info.isFile() && info.uid === process.getuid() && (info.mode & 0o077) === 0, 'Private owner lock required.');
    const lock = JSON.parse(await handle.readFile('utf8'));
    assert(Number.isSafeInteger(lock.pid) && lock.pid > 0 && typeof lock.token === 'string',
      'Invalid conversation lock; manual inspection required.');
    let liveness = 'unknown';
    if (lock.hostname === os.hostname()) {
      try { process.kill(lock.pid, 0); liveness = 'alive'; }
      catch (error) { if (error.code === 'ESRCH') liveness = 'dead'; }
    }
    return { ...lock, liveness, inode: info.ino };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  } finally { await handle?.close(); }
}

// Recovery is explicit and exact. Lock age never grants takeover permission.
export async function recoverConversationWriterLock(root, expectedToken) {
  const lock = await inspectConversationWriterLock(root);
  assert(lock && lock.token === expectedToken && lock.liveness === 'dead',
    'Only the exact verified dead conversation writer lock may be recovered.');
  const fresh = await inspectConversationWriterLock(root);
  assert(fresh?.token === expectedToken && fresh.inode === lock.inode && fresh.liveness === 'dead',
    'Conversation writer lock changed; inspect again.');
  await unlink(path.join(root, 'writer.lock'));
  return { recovered: true, state: await readEnvelope(root) };
}

/**
 * Serialize one local mutation with an exclusive lock and compare-and-swap
 * revision. The callback must perform no external action. A pending action is
 * persisted here before the host separately contacts a provider.
 */
export async function updateConversationState(root, expectedRevision, change) {
  await privateRoot(root);
  assert(Number.isSafeInteger(expectedRevision) && expectedRevision >= 0, 'Expected conversation revision required.');
  const lockPath = path.join(root, 'writer.lock');
  let lock;
  try { lock = await open(lockPath, 'wx', 0o600); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error('Conversation state is locked; verify writer liveness before recovery.');
    throw error;
  }
  const temp = path.join(root, `.state-${randomUUID()}.tmp`);
  let temporary; let committed = false;
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, hostname: os.hostname(), token: randomUUID() }));
    await lock.sync();
    const current = await readEnvelope(root);
    assert(current.revision === expectedRevision, 'Conversation state revision changed; reload before updating.');
    const payload = await change(structuredClone(current.payload));
    const body = { schema_version: 'conversation-state.v1', revision: current.revision + 1, payload };
    const checksum = reviewHash(body);
    temporary = await open(temp, 'wx', 0o600);
    await temporary.writeFile(`${JSON.stringify({ ...body, checksum })}\n`);
    await temporary.sync(); await temporary.close(); temporary = null;
    await rename(temp, path.join(root, 'state.json')); committed = true;
    const directory = await open(root, constants.O_RDONLY);
    try { await directory.sync(); } finally { await directory.close(); }
    return { revision: body.revision, payload: structuredClone(payload) };
  } catch (error) {
    if (committed) throw new Error('Conversation state rename completed but durability is uncertain; read back before retry.', { cause: error });
    throw error;
  } finally {
    await temporary?.close();
    if (!committed) await unlink(temp).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    await lock.close(); await unlink(lockPath);
  }
}
