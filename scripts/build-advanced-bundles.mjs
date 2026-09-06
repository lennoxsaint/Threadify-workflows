import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const check = process.argv.includes('--check');
const workflows = {
  'threadify-crosspost-x-after-threads': 'crosspost-x-after-threads',
  'threadify-daily-posts-heartbeat': 'daily-posts-heartbeat',
  'threadify-personal-brain-sync': 'personal-brain-sync-current-self',
  'threadify-weekly-winner-replication': 'weekly-winner-replication',
  'threadify-x-article-from-daily-post': 'x-article-from-daily-post',
  'threadify-youtube-edit': 'youtube-edit',
  'threadify-qualified-buyer-research': 'qualified-buyer-research',
};
const expected = new Map();
for (const [name, workflow] of Object.entries(workflows)) {
  const source = path.join(root, 'plugins/threadify/skills', name);
  let skill = fs.readFileSync(path.join(source, 'SKILL.md'), 'utf8');
  if (!skill.startsWith('---\n')) {
    const description = skill.split('\n\n')[1].replace(/\s+/g, ' ').trim();
    skill = `---\nname: ${name}\ndescription: ${JSON.stringify('Advanced workflow. ' + description)}\n---\n\n${skill}`;
    skill = skill.replaceAll(`workflows/${workflow}/manifest.json`, 'references/workflow-manifest.json');
    skill += '\nResolve references against this skill directory. For a new creator Day, Week or Month, use the primary creator skills instead.\n';
    expected.set(`${name}/references/workflow-manifest.json`, fs.readFileSync(path.join(root, 'workflows', workflow, 'manifest.json')));
    expected.set(`${name}/references/workflow-readme.md`, fs.readFileSync(path.join(root, 'workflows', workflow, 'README.md')));
  } else {
    for (const file of fs.readdirSync(path.join(source, 'references'))) {
      expected.set(`${name}/references/${file}`, fs.readFileSync(path.join(source, 'references', file)));
    }
  }
  expected.set(`${name}/SKILL.md`, Buffer.from(skill));
}
const failures = [];
function audit(directory, relative) {
  const info = fs.lstatSync(directory, { throwIfNoEntry: false });
  if (!info) return;
  if (info.isSymbolicLink()) { failures.push(`symlink ${relative}`); return; }
  if (info.isDirectory()) {
    if (![...expected.keys()].some((file) => file.startsWith(`${relative}/`))) failures.push(`unexpected ${relative}`);
    else for (const entry of fs.readdirSync(directory)) audit(path.join(directory, entry), `${relative}/${entry}`);
  } else if (!info.isFile() || !expected.has(relative)) failures.push(`unexpected ${relative}`);
}
const skillsRoot = path.join(root, 'skills');
if (fs.lstatSync(skillsRoot).isSymbolicLink()) throw new Error('Symlink skills root is not a build destination.');
for (const name of Object.keys(workflows)) audit(path.join(skillsRoot, name), name);
if (failures.length) throw new Error(`Advanced bundle audit failed: ${failures.join(', ')}`);
for (const [relative, content] of expected) {
  const file = path.join(skillsRoot, relative);
  if (check) {
    if (!fs.existsSync(file) || !fs.readFileSync(file).equals(content)) failures.push(relative);
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
}
if (failures.length) throw new Error(`Advanced bundle drift: ${failures.join(', ')}`);
console.log(`Advanced bundles ${check ? 'verified' : 'built'}: ${Object.keys(workflows).length} skills, ${expected.size} files.`);
