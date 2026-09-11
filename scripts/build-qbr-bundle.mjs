#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadWorkflowRegistry, listWorkflows } from '../lib/workflow-registry.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const check = process.argv.includes('--check');
const registry = loadWorkflowRegistry({ root });
const standalone = listWorkflows(registry, { kind: 'skill' })
  .filter((workflow) => workflow.bundle.standalone);
if (standalone.length !== 1) {
  throw new Error(`Expected one standalone skill bundle, found ${standalone.map((workflow) => workflow.workflow_id).join(', ')}`);
}
const workflow = standalone[0];
const references = path.join(root, 'plugins', 'threadify', 'skills', workflow.skill_name, 'references');
const sources = (workflow.bundle.references ?? []).map(({ source, target }) => [source, target]);
if (sources.length === 0) throw new Error(`${workflow.workflow_id} has no standalone bundle references`);

function normalize(buffer) {
  const text = buffer.toString('utf8').replace(/\r\n/g, '\n');
  return Buffer.from(text.endsWith('\n') ? text : `${text}\n`);
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

const expected = new Map();
for (const [source, target] of sources) {
  expected.set(target, normalize(fs.readFileSync(path.join(root, source))));
}
const metadata = {
  record_type: 'SelfContainedSkillBundleV1',
  skill: workflow.skill_name,
  generated_from: sources.map(([source, target]) => ({
    source,
    target,
    sha256: sha256(expected.get(target)),
  })),
};
expected.set('bundle-metadata.json', Buffer.from(`${JSON.stringify(metadata, null, 2)}\n`));

if (check) {
  const failures = [];
  for (const [target, content] of expected) {
    const file = path.join(references, target);
    if (!fs.existsSync(file)) {
      failures.push(`missing ${path.relative(root, file)}`);
      continue;
    }
    if (!fs.readFileSync(file).equals(content)) failures.push(`drift ${path.relative(root, file)}`);
  }
  const actualNames = fs.existsSync(references)
    ? fs.readdirSync(references).filter((name) => !name.startsWith('.')).sort()
    : [];
  const expectedNames = [...expected.keys()].sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    failures.push(`unexpected reference files: ${actualNames.filter((name) => !expected.has(name)).join(', ')}`);
  }
  if (failures.length) {
    console.error('Qualified Buyer Research bundle drift detected:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(`Qualified Buyer Research bundle parity passed: ${expected.size} files.`);
  process.exit(0);
}

fs.mkdirSync(references, { recursive: true });
for (const name of fs.readdirSync(references)) {
  if (!expected.has(name)) fs.rmSync(path.join(references, name), { recursive: true, force: true });
}
for (const [target, content] of expected) {
  const file = path.join(references, target);
  fs.writeFileSync(file, content);
  if (target.endsWith('.mjs')) fs.chmodSync(file, 0o755);
}
console.log(`Rendered Qualified Buyer Research self-contained bundle: ${expected.size} files.`);
