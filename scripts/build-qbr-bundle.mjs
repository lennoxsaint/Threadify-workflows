#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const references = path.join(
  root,
  'plugins',
  'threadify',
  'skills',
  'threadify-qualified-buyer-research',
  'references',
);
const check = process.argv.includes('--check');
const sources = [
  ['docs/threadify-001.md', 'threadify-001.md'],
  ['workflows/qualified-buyer-research/manifest.json', 'workflow-manifest.json'],
  ['workflows/qualified-buyer-research/README.md', 'workflow-readme.md'],
  ['workflows/qualified-buyer-research/reference-policy.mjs', 'reference-policy.mjs'],
  ['public-rules/qualified-buyer-research.v1.json', 'public-rules.v1.json'],
  ['schemas/qualified-buyer-research.v1.json', 'qualified-buyer-research.v1.json'],
  ['schemas/durable-rule.v1.json', 'durable-rule.v1.json'],
  ['schemas/public-rule-proposal.v1.json', 'public-rule-proposal.v1.json'],
  ['schemas/stable-release-manifest.v1.json', 'stable-release-manifest.v1.json'],
  ['schemas/update-receipt.v1.json', 'update-receipt.v1.json'],
  ['release/release-intent.json', 'release-metadata.json'],
  ['scripts/qualified-buyer-update-on-use.mjs', 'update-on-use.mjs'],
];

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
  skill: 'threadify-qualified-buyer-research',
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
