import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadWorkflowRegistry, listWorkflows } from '../lib/workflow-registry.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const check = process.argv.includes('--check');
const registry = loadWorkflowRegistry({ root });
const workflows = listWorkflows(registry, { kind: 'skill' })
  .filter((workflow) => workflow.bundle.kind !== 'creator');
const expected = new Map();
function collectSourceFiles(directory, relative = '') {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    const full = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink in canonical skill source: ${child}`);
    if (entry.isDirectory()) files.push(...collectSourceFiles(full, child));
    else if (entry.isFile() && child !== 'SKILL.md') files.push([child, fs.readFileSync(full)]);
    else if (!entry.isFile()) throw new Error(`Unsupported canonical skill source: ${child}`);
  }
  return files;
}
for (const workflow of workflows) {
  const name = workflow.skill_name;
  const source = path.dirname(path.join(root, workflow.source_entrypoint));
  let skill = fs.readFileSync(path.join(source, 'SKILL.md'), 'utf8');
  for (const [relative, content] of collectSourceFiles(source)) expected.set(`${name}/${relative}`, content);
  if (!/^---\r?\n/.test(skill)) {
    const paragraph = skill.split(/\r?\n\r?\n/).find((text) =>
      text.trim() && !text.startsWith('#') && !text.startsWith('Ask:') &&
      !text.startsWith('Follow [Threadify-001:'));
    if (!paragraph?.trim()) throw new Error(`Missing skill description paragraph: ${name}`);
    const description = paragraph.replace(/\s+/g, ' ').trim();
    skill = `---\nname: ${name}\ndescription: ${JSON.stringify('Advanced workflow. ' + description)}\n---\n\n${skill}`;
    skill = skill.replaceAll(`workflows/${workflow.workflow_id}/manifest.json`, 'references/workflow-manifest.json');
    skill = skill.replaceAll('https://github.com/lennoxsaint/Threadify-workflows/blob/main/docs/threadify-001.md', 'references/threadify-001.md');
    skill += '\nResolve references against this skill directory. For a new creator Day, Week or Month, use the primary creator skills instead.\n';
  }
  expected.set(`${name}/SKILL.md`, Buffer.from(skill));
  expected.set(`${name}/references/workflow-manifest.json`, fs.readFileSync(path.join(root, workflow.source_manifest)));
  expected.set(`${name}/references/workflow-readme.md`, fs.readFileSync(path.join(root, 'workflows', workflow.workflow_id, 'README.md')));
  expected.set(`${name}/references/threadify-001.md`, fs.readFileSync(path.join(root, 'docs/threadify-001.md')));
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
for (const { skill_name: name } of workflows) audit(path.join(skillsRoot, name), name);
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
console.log(`Advanced bundles ${check ? 'verified' : 'built'}: ${workflows.length} skills, ${expected.size} files.`);
