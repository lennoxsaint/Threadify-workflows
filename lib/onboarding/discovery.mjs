import fs from 'node:fs/promises';
import path from 'node:path';
import { readState } from '../creator/store.mjs';
const relevant = /brand|voice|writing|audience|offer|about|bio|profile|content|position|journal|story|values|business|persona|notes/i;
const forbidden = /(?:^|[._ -])(secret|credential|password|token|keychain|private.key|id_rsa|id_ed25519)(?:[._ -]|$)/i;
const extensions = new Set(['.md', '.txt', '.pdf', '.docx', '.rtf']);

// Inventory names only. The agent selects relevant files and confirms extracted
// facts before any provider upload. Symlinks never expand approved search scope.
export async function discoverSetupFiles(root, { maxEntries = 5000, maxResults = 100 } = {}) {
  const { payload: s } = await readState(root);
  if (s?.kind !== 'threadify-setup.v1' || !s.discovery) throw new Error('Approve search roots first.');
  if (!Number.isInteger(maxEntries) || maxEntries < 1 || maxEntries > 20_000 || !Number.isInteger(maxResults) || maxResults < 1 || maxResults > 200) throw new Error('Invalid bounded search limits.');
  const roots = s.discovery.roots.map((p) => {
    if (!path.isAbsolute(p) || path.resolve(p) === path.parse(p).root) throw new Error('Dedicated absolute search roots required.');
    return path.resolve(p);
  });
  const excludes = s.discovery.exclude.map((p) => path.resolve(p));
  const files = []; const unavailable = []; let visited = 0; let limited = false;
  const excluded = (p) => excludes.some((x) => p === x || p.startsWith(x + path.sep));
  async function walk(p, depth = 0) {
    if (excluded(p)) return;
    if (visited >= maxEntries || files.length >= maxResults) { limited = true; return; }
    visited++;
    let stat;
    try { stat = await fs.lstat(p); }
    catch (error) { if (['ENOENT', 'EACCES', 'EPERM'].includes(error.code)) { unavailable.push({ path: p, reason: error.code }); return; } throw error; }
    if (stat.isSymbolicLink()) return;
    if (depth === 0 && await fs.realpath(p) !== p) { unavailable.push({ path: p, reason: 'symlink_ancestor' }); return; }
    const name = path.basename(p);
    if (name.startsWith('.') || forbidden.test(name) || ['node_modules', 'Library', 'vendor', 'dist'].includes(name)) return;
    if (stat.isDirectory()) {
      if (depth >= 5) { limited = true; return; }
      let names;
      try { names = await fs.readdir(p); } catch (error) { if (['EACCES', 'EPERM'].includes(error.code)) { unavailable.push({ path: p, reason: error.code }); return; } throw error; }
      const sorted = names.sort();
      for (let i = 0; i < sorted.length; i++) { await walk(path.join(p, sorted[i]), depth + 1); if (visited >= maxEntries || files.length >= maxResults) { limited ||= i < sorted.length - 1; break; } }
    } else if (stat.isFile() && stat.size <= 10_000_000 && extensions.has(path.extname(name).toLowerCase()) && relevant.test(p)) {
      files.push({ path: p, bytes: stat.size, modified_at: stat.mtime.toISOString(), content_read: false });
    }
  }
  for (const p of roots) await walk(p);
  return { candidates: files, unavailable, limited, visited, uploaded: false, next: 'Read only relevant candidates inside approved scope; show sourced facts for confirmation.' };
}
