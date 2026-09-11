import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT_FILES = new Set(['README.md', 'CONTEXT.md', 'catalog.json', 'LICENSE.md', 'CONTRIBUTING.md', 'SECURITY.md',
  'PUBLICATION_CHECKLIST.md', 'package.json', 'package-lock.json', '.mcp.json', '.gitignore', '.gitmodules']);
const ROOT_DIRECTORIES = new Set(['adapters', 'assets', 'bin', 'docs', 'examples', 'lib',
  'plugins', 'public-rules', 'release', 'schemas', 'scripts', 'shared', 'skills', 'validation', 'workflows']);
const SPECIAL_FILES = ['.codex-plugin/plugin.json', '.agents/plugins/marketplace.json'];

export function reserveReleaseOutput(output, { sourceRoot } = {}) {
  if (typeof output !== 'string' || !path.isAbsolute(output)) throw new Error('Absolute release output required.');
  const target = path.resolve(output);
  if (target === path.parse(target).root || target === os.homedir()) throw new Error('Choose a new dedicated release directory.');
  if (sourceRoot) {
    const relative = path.relative(path.resolve(sourceRoot), target);
    if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)
      && relative !== 'dist' && !relative.startsWith(`dist${path.sep}`))) {
      throw new Error('In-repository release output must be a new directory under dist.');
    }
  }
  // Atomic reservation: even an empty existing directory is not ours to reuse.
  // No recursive deletion, automatic cleanup or overwriting on a failed build.
  fs.mkdirSync(target, { mode: 0o700 });
  return target;
}

export function collectReleaseFiles(root) {
  const files = [];
  function visit(relative) {
    const full = path.join(root, relative);
    const info = fs.lstatSync(full, { throwIfNoEntry: false });
    if (!info) return;
    if (info.isSymbolicLink()) throw new Error(`Refusing release symlink: ${relative}`);
    if (info.isFile()) { files.push(relative); return; }
    if (!info.isDirectory()) throw new Error(`Unsupported release entry: ${relative}`);
    for (const entry of fs.readdirSync(full).sort()) {
      if (entry.startsWith('.') || ['node_modules', 'dist', 'tmp', 'writer.lock', 'state.json'].includes(entry)
        || /\.(?:log|tmp|pem|key)$/.test(entry)) continue;
      visit(`${relative}/${entry}`);
    }
  }
  for (const file of ROOT_FILES) visit(file);
  for (const directory of ROOT_DIRECTORIES) visit(directory);
  for (const file of SPECIAL_FILES) {
    // Check every parent too; lstat of a leaf alone would follow directory links.
    const pieces = file.split('/');
    for (let count = 1; count < pieces.length; count++) {
      const parent = pieces.slice(0, count).join('/');
      if (fs.lstatSync(path.join(root, parent), { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error(`Refusing release symlink: ${parent}`);
    }
    visit(file);
  }
  return files.sort();
}
