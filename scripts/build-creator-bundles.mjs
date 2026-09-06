import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const check = process.argv.includes('--check');
const names = ['threadify-vault-setup', 'threadify-create-my-day', 'threadify-create-my-week', 'threadify-create-my-month'];
const engine = fs.readdirSync(path.join(root, 'lib/creator')).filter((f) => f.endsWith('.mjs')).sort();
const expected = new Map(engine.map((name) => [`scripts/engine/${name}`, fs.readFileSync(path.join(root, 'lib/creator', name))]));
for (const name of ['creator-system.md', 'creator-engine.md']) expected.set(`references/${name}`, fs.readFileSync(path.join(root, 'docs', name)));
expected.set('references/creator-records.v1.json', fs.readFileSync(path.join(root, 'schemas/creator-records.v1.json')));
expected.set('references/creator-lifecycle.v1.json', fs.readFileSync(path.join(root, 'schemas/creator-lifecycle.v1.json')));
expected.set('scripts/creator.mjs', Buffer.from("import { creatorMain } from './engine/cli.mjs';\ncreatorMain(process.argv.slice(2)).catch((error) => { process.stderr.write(JSON.stringify({ status: 'failed', error: error.message }) + '\\n'); process.exitCode = 1; });\n"));
const failures = [];
const allowedFiles = new Set(['SKILL.md', ...expected.keys()]);
const allowedDirectories = new Set(['', 'scripts', 'scripts/engine', 'references']);

// Audit every destination before writing any bundle. Never follow links or
// silently retain extra material that would become part of a public package.
function auditDestination(directory, name, relative = '') {
  const info = fs.lstatSync(directory, { throwIfNoEntry: false });
  if (!info) return;
  if (info.isSymbolicLink() || !info.isDirectory()) {
    failures.push(`${name}/${relative}: symlink or non-directory destination`);
    return;
  }
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) failures.push(`symlink ${name}/${child}`);
    else if (entry.isDirectory() && allowedDirectories.has(child)) {
      auditDestination(path.join(directory, entry.name), name, child);
    } else if (!entry.isFile() || !allowedFiles.has(child)) {
      failures.push(`unexpected ${name}/${child}`);
    }
  }
}

const skillsRoot = path.join(root, 'skills');
const skillsInfo = fs.lstatSync(skillsRoot, { throwIfNoEntry: false });
if (skillsInfo && (skillsInfo.isSymbolicLink() || !skillsInfo.isDirectory())) {
  failures.push('symlink or non-directory skills root');
} else {
  for (const name of names) auditDestination(path.join(skillsRoot, name), name);
}
if (failures.length) {
  console.error('Creator bundle audit failed: ' + failures.join(', '));
  process.exit(1);
}
for (const name of names) {
  for (const [relative, content] of expected) {
    const target = path.join(root, 'skills', name, relative);
    if (check) {
      if (!fs.existsSync(target) || !fs.readFileSync(target).equals(content)) failures.push(`${name}/${relative}`);
    } else {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
    }
  }
}
if (failures.length) { console.error('Creator bundle drift: ' + failures.join(', ')); process.exitCode = 1; }
else console.log(`Creator bundles ${check ? 'verified' : 'built'}: ${names.length} skills, ${expected.size} files each.`);
