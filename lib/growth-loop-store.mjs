import crypto, { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, rename, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const assert = (condition, message) => { if (!condition) throw new Error(message); };

function checksum(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function ensurePrivateRoot(root) {
  assert(process.platform !== 'win32', 'Private state requires POSIX permissions; use a supported private host workspace.');
  assert(typeof root === 'string' && path.isAbsolute(root), 'State must be an absolute directory.');
  const resolved = path.resolve(root);
  assert(resolved !== path.parse(resolved).root && resolved !== os.homedir(), 'Choose a dedicated private state directory.');
  await mkdir(resolved, { recursive: true, mode: 0o700 });
  const info = await lstat(resolved);
  assert(!info.isSymbolicLink(), 'State root must not be a symlink.');
  assert(info.isDirectory() && info.uid === process.getuid() && (info.mode & 0o077) === 0,
    'State directory must be private and owned by this user.');
}

async function readEnvelope(root) {
  let handle;
  try {
    handle = await open(path.join(root, 'state.json'), constants.O_RDONLY | constants.O_NOFOLLOW);
    const info = await handle.stat();
    assert(info.isFile() && info.uid === process.getuid() && (info.mode & 0o077) === 0,
      'State file must be private and owner-controlled.');
    const envelope = JSON.parse(await handle.readFile('utf8'));
    const { checksum: storedChecksum, ...body } = envelope;
    assert(body.schema_version === 'growth-loop-state.v1', 'Unsupported Growth Loop state schema.');
    assert(Number.isSafeInteger(body.revision) && body.revision > 0, 'Invalid state revision.');
    assert(storedChecksum === checksum(body), 'State integrity failure; inspect before recovery.');
    return { revision: body.revision, payload: body.payload };
  } catch (error) {
    if (error.code === 'ENOENT') return { revision: 0, payload: null };
    if (error.code === 'ELOOP') throw new Error('State file must not be a symlink.');
    throw error;
  } finally {
    await handle?.close();
  }
}

export async function readGrowthLoopState(root) {
  await ensurePrivateRoot(root);
  return readEnvelope(root);
}

export async function updateGrowthLoopState(root, expectedRevision, change) {
  await ensurePrivateRoot(root);
  assert(Number.isSafeInteger(expectedRevision) && expectedRevision >= 0, 'Expected revision required.');
  const lockPath = path.join(root, 'writer.lock');
  let lock;
  try {
    lock = await open(lockPath, 'wx', 0o600);
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error('State is locked; inspect the writer before recovery.');
    throw error;
  }
  const temporaryPath = path.join(root, `.state-${randomUUID()}.tmp`);
  let temporary;
  let committed = false;
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, hostname: os.hostname(), token: randomUUID() }));
    await lock.sync();
    const current = await readEnvelope(root);
    assert(current.revision === expectedRevision, 'State revision changed; reload before updating.');
    const payload = await change(structuredClone(current.payload));
    const body = { schema_version: 'growth-loop-state.v1', revision: current.revision + 1, payload };
    temporary = await open(temporaryPath, 'wx', 0o600);
    await temporary.writeFile(`${JSON.stringify({ ...body, checksum: checksum(body) })}\n`);
    await temporary.sync();
    await temporary.close();
    temporary = null;
    await rename(temporaryPath, path.join(root, 'state.json'));
    committed = true;
    const directory = await open(root, constants.O_RDONLY);
    try { await directory.sync(); } finally { await directory.close(); }
    return { revision: body.revision, payload: structuredClone(payload) };
  } catch (error) {
    if (committed) throw new Error('State rename completed but durability is uncertain; read back before retry.', { cause: error });
    throw error;
  } finally {
    await temporary?.close();
    if (!committed) await unlink(temporaryPath).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    await lock.close();
    await unlink(lockPath);
  }
}

