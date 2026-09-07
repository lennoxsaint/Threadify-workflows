import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';

// Build from the already hashed in-memory bundle, never reread changing sources.
// System tar owns the archive format; Node owns deterministic gzip compression.
export function pluginArchive(entries) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'threadify-archive-'));
  try {
    const names = [];
    for (const [name, entry] of entries) {
      if (!name.startsWith('plugin/')) continue;
      const relative = name.slice(7);
      if (!relative || relative.includes('\\') || /[\r\n\0]/.test(relative)
        || relative.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error('Invalid plugin archive path.');
      const target = `threadify-workflows/${relative}`;
      const file = path.join(temp, target);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(entry.content_base64, 'base64'), { flag: 'wx' });
      fs.chmodSync(file, Number.parseInt(entry.mode, 8));
      fs.utimesSync(file, 946684800, 946684800);
      names.push(target);
    }
    names.sort();
    const version = spawnSync('tar', ['--version'], { encoding: 'utf8' });
    if (version.status !== 0) throw new Error('System tar is required to build plugin archives.');
    const bsd = version.stdout.includes('bsdtar');
    if (!bsd && !version.stdout.includes('GNU tar')) throw new Error('Supported archive builders are BSD tar and GNU tar.');
    const flags = bsd ? ['--uid', '0', '--gid', '0', '--uname', 'root', '--gname', 'root', '--no-xattrs', '--no-acls', '--no-fflags']
      : ['--owner=0', '--group=0', '--numeric-owner'];
    const archiveEnv = { ...process.env, COPYFILE_DISABLE: '1', LC_ALL: 'C', TZ: 'UTC' };
    delete archiveEnv.TAR_OPTIONS;
    const archive = spawnSync('tar', ['--format=ustar', ...flags, '-cf', '-', '-T', '-'], {
      cwd: temp, input: names.join('\n') + '\n', maxBuffer: 64 * 1024 * 1024,
      env: archiveEnv,
    });
    if (archive.status !== 0) throw new Error(`Plugin archive failed: ${String(archive.stderr)}`);
    return gzipSync(archive.stdout, { level: 9 });
  } finally {
    // Only this invocation's newly allocated staging directory is removed.
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
