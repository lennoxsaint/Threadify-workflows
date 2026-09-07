import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

function checkout(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'threadify-proposal-'));
  const root = path.join(directory, 'repo');
  fs.cpSync(sourceRoot, root, {
    recursive: true,
    filter: (source) => !source.includes(`${path.sep}.git`) && !source.includes(`${path.sep}dist`),
  });
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return root;
}

function proposal(overrides = {}) {
  return {
    record_type: 'PublicRuleProposalV1',
    proposal_id: 'qbr-message-test-rule',
    scope: 'message',
    change: {
      operation: 'add_rule',
      summary: 'Add one evidence-producing next step.',
      rule: {
        record_type: 'DurableRuleV1',
        rule_id: 'message.evidence-producing-step',
        scope: 'message',
        instruction: 'Offer one smaller evidence-producing next step when it helps the person make progress.',
        evidence_class: 'comparable_outcomes',
        hard_gate: false,
        introduced_version: '0.4.1',
      },
    },
    evidence_class: 'comparable_outcomes',
    aggregate_evidence: { comparable_completed_outcomes: 20, batch_count: 2, batches: [] },
    synthetic_reproduction: { deterministic: true, passed: true, fixture: 'message-next-step' },
    privacy_result: 'passed',
    rollback: { restore_version: '0.4.0' },
    promotion_state: 'promotion_recommended',
    target_release_version: '0.4.1',
    ...overrides,
  };
}

function runProposal(root, value) {
  const file = path.join(root, 'proposal.json');
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  return spawnSync(process.execPath, ['scripts/apply-public-rule-proposal.mjs', file], {
    cwd: root,
    encoding: 'utf8',
  });
}

test('valid redacted proposal updates rules, release intent, changelog, fixture, and self-contained bundle', (t) => {
  const root = checkout(t);
  const result = runProposal(root, proposal());
  assert.equal(result.status, 0, result.stderr);
  const rules = JSON.parse(fs.readFileSync(path.join(root, 'public-rules', 'qualified-buyer-research.v1.json'), 'utf8'));
  assert.equal(rules.rules_version, '0.4.1');
  assert.equal(rules.rules.some((rule) => rule.rule_id === 'message.evidence-producing-step'), true);
  const intent = JSON.parse(fs.readFileSync(path.join(root, 'release', 'release-intent.json'), 'utf8'));
  assert.equal(intent.release_version, '0.4.1');
  assert.equal(intent.change_class, 'rules_only');
  assert.equal(fs.existsSync(path.join(root, 'validation', 'mock-fixtures', 'public-rule-proposals', 'qbr-message-test-rule.json')), true);
  assert.equal(fs.readFileSync(path.join(root, 'release', 'CHANGELOG.md'), 'utf8').includes('## 0.4.1'), true);
  assert.equal(fs.readFileSync(path.join(root, 'plugins', 'threadify', 'skills', 'threadify-qualified-buyer-research', 'references', 'public-rules.v1.json'), 'utf8').includes('0.4.1'), true);
  const installedRules = JSON.parse(fs.readFileSync(path.join(root, 'skills', 'threadify-qualified-buyer-research', 'references', 'public-rules.v1.json'), 'utf8'));
  assert.ok(installedRules.rules.some((rule) => rule.rule_id === 'message.evidence-producing-step'));
  const parity = spawnSync(process.execPath, ['scripts/build-advanced-bundles.mjs', '--check'], { cwd: root, encoding: 'utf8' });
  assert.equal(parity.status, 0, parity.stderr);
});

test('public proposal application rejects immutable hard-gate mutation', (t) => {
  const root = checkout(t);
  const value = proposal();
  value.change.operation = 'replace_rule';
  value.change.rule.rule_id = 'candidate.offer-context-first';
  value.change.rule.scope = 'candidate';
  value.scope = 'candidate';
  const result = runProposal(root, value);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /immutable_hard_gate_mutation_rejected/);
});

test('a version-changing proposal preserves dependency lock data and updates package identity', (t) => {
  const root = checkout(t);
  const lockFile = path.join(root, 'package-lock.json');
  const original = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  const result = runProposal(root, proposal({ target_release_version: '0.4.2' }));
  assert.equal(result.status, 0, result.stderr);
  const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  assert.equal(lock.version, '0.4.2');
  assert.equal(lock.packages[''].version, '0.4.2');
  original.version = '0.4.2';
  original.packages[''].version = '0.4.2';
  assert.deepEqual(lock, original);
});

test('public proposal application rejects private voice material', (t) => {
  const root = checkout(t);
  const value = proposal({ voice_samples: ['private'] });
  const result = runProposal(root, value);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /private_field_rejected/);
});

test('advanced bundles parse CRLF markdown with and without frontmatter', (t) => {
  const root = checkout(t);
  const source = path.join(root, 'plugins', 'threadify', 'skills');
  for (const name of fs.readdirSync(source)) {
    const file = path.join(source, name, 'SKILL.md');
    if (fs.existsSync(file)) fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/\r?\n/g, '\r\n'));
  }
  for (const args of [[], ['--check']]) {
    const result = spawnSync(process.execPath, ['scripts/build-advanced-bundles.mjs', ...args], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  const qbr = fs.readFileSync(path.join(root, 'skills', 'threadify-qualified-buyer-research', 'SKILL.md'), 'utf8');
  assert.equal(qbr, fs.readFileSync(path.join(source, 'threadify-qualified-buyer-research', 'SKILL.md'), 'utf8'));
  const legacy = fs.readFileSync(path.join(root, 'skills', 'threadify-youtube-edit', 'SKILL.md'), 'utf8');
  assert.match(legacy, /^---\nname: threadify-youtube-edit\ndescription:/);
  assert.ok(legacy.includes('references/workflow-manifest.json'));
});
