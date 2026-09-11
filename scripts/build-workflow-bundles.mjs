#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCatalogDocument,
  loadWorkflowRegistry,
  renderClientCompatibility,
  renderWorkflowCatalog,
} from '../lib/workflow-registry.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const check = process.argv.includes('--check');
const registry = loadWorkflowRegistry({ root });
const outputs = new Map([
  ['catalog.json', `${JSON.stringify(buildCatalogDocument(registry), null, 2)}\n`],
  ['docs/workflow-catalog.md', renderWorkflowCatalog(registry)],
  ['docs/client-compatibility.md', renderClientCompatibility(registry)],
]);
const failures = [];
const expectedSkillNames = new Set(registry.workflows
  .filter((workflow) => workflow.kind === 'skill')
  .map((workflow) => workflow.skill_name));
const skillsRoot = path.join(root, 'skills');
const actualSkillNames = fs.readdirSync(skillsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
for (const name of expectedSkillNames) {
  if (!actualSkillNames.includes(name)) failures.push(`missing skill bundle ${name}`);
}
for (const name of actualSkillNames) {
  if (!expectedSkillNames.has(name)) failures.push(`unregistered skill bundle ${name}`);
}
if (failures.length) {
  console.error(`Workflow bundle inventory invalid: ${failures.join(', ')}`);
  process.exit(1);
}
for (const [relative, content] of outputs) {
  const file = path.join(root, relative);
  if (check) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) failures.push(relative);
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
}
if (failures.length) {
  console.error(`Workflow registry artifact drift: ${failures.join(', ')}`);
  process.exit(1);
}
console.log(`Workflow registry artifacts ${check ? 'verified' : 'built'}: ${registry.workflows.length} workflows, ${outputs.size} files.`);
