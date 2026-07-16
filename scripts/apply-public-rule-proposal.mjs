#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const proposalFile = process.argv[2];
if (!proposalFile) throw new Error('usage: node scripts/apply-public-rule-proposal.mjs proposal.json');
const proposal = JSON.parse(fs.readFileSync(path.resolve(proposalFile), 'utf8'));

const forbiddenKeys = /(student|member|email|account_id|private_message|raw_outcome|voice_sample|personal_diction|access_token|refresh_token)/i;
function scan(value, trail = 'proposal') {
  if (Array.isArray(value)) return value.forEach((item, index) => scan(item, `${trail}[${index}]`));
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.test(key)) throw new Error(`private_field_rejected:${trail}.${key}`);
    scan(child, `${trail}.${key}`);
  }
}
scan(proposal);
if (proposal.record_type !== 'PublicRuleProposalV1') throw new Error('invalid_proposal_type');
if (proposal.privacy_result !== 'passed') throw new Error('privacy_check_must_pass');
if (!['draft_proposal', 'promotion_recommended'].includes(proposal.promotion_state)) {
  throw new Error('proposal_not_release_eligible');
}
if (!proposal.synthetic_reproduction?.deterministic || proposal.synthetic_reproduction?.passed !== true) {
  throw new Error('deterministic_synthetic_reproduction_required');
}

const rulesFile = path.join(root, 'public-rules', 'qualified-buyer-research.v1.json');
const ruleset = JSON.parse(fs.readFileSync(rulesFile, 'utf8'));
const change = proposal.change ?? {};
const proposedRule = change.rule;
if (!proposedRule || proposedRule.record_type !== 'DurableRuleV1') throw new Error('proposal_rule_missing');
if (proposedRule.scope !== proposal.scope) throw new Error('proposal_scope_mismatch');
const existingIndex = ruleset.rules.findIndex((rule) => rule.rule_id === proposedRule.rule_id);
if (existingIndex >= 0 && ruleset.rules[existingIndex].hard_gate === true) {
  throw new Error('immutable_hard_gate_mutation_rejected');
}
if (proposedRule.hard_gate === true && change.operation !== 'add_rule') {
  throw new Error('hard_gate_change_requires_manual_release_authoring');
}

function bumpPatch(version) {
  const parts = String(version).split('.').map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) throw new Error(`invalid_version:${version}`);
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}

const releaseVersion = proposal.target_release_version ?? bumpPatch(ruleset.rules_version);
proposedRule.introduced_version ??= releaseVersion;
if (existingIndex >= 0) ruleset.rules[existingIndex] = proposedRule;
else ruleset.rules.push(proposedRule);
ruleset.rules_version = releaseVersion;
if (proposal.scope === 'candidate') ruleset.candidate_policy_version = releaseVersion;
else ruleset.message_policy_version = releaseVersion;
fs.writeFileSync(rulesFile, `${JSON.stringify(ruleset, null, 2)}\n`);

const packageFile = path.join(root, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
packageJson.version = releaseVersion;
fs.writeFileSync(packageFile, `${JSON.stringify(packageJson, null, 2)}\n`);

const pluginFile = path.join(root, '.codex-plugin', 'plugin.json');
const plugin = JSON.parse(fs.readFileSync(pluginFile, 'utf8'));
plugin.version = releaseVersion;
fs.writeFileSync(pluginFile, `${JSON.stringify(plugin, null, 2)}\n`);

const intentFile = path.join(root, 'release', 'release-intent.json');
const intent = JSON.parse(fs.readFileSync(intentFile, 'utf8'));
intent.release_version = releaseVersion;
intent.plugin_version = releaseVersion;
intent.rules_version = releaseVersion;
intent.change_class = 'rules_only';
intent.summary = proposal.change.summary ?? `Qualified Buyer Research public rule proposal ${proposal.proposal_id}.`;
fs.writeFileSync(intentFile, `${JSON.stringify(intent, null, 2)}\n`);

const fixtureDirectory = path.join(root, 'validation', 'mock-fixtures', 'public-rule-proposals');
fs.mkdirSync(fixtureDirectory, { recursive: true });
fs.writeFileSync(
  path.join(fixtureDirectory, `${proposal.proposal_id}.json`),
  `${JSON.stringify({
    proposal_id: proposal.proposal_id,
    synthetic_reproduction: proposal.synthetic_reproduction,
    expected_rule_id: proposedRule.rule_id,
    expected_privacy_result: 'passed',
  }, null, 2)}\n`,
);

const changelogFile = path.join(root, 'release', 'CHANGELOG.md');
const priorChangelog = fs.readFileSync(changelogFile, 'utf8');
const entry = `## ${releaseVersion}\n\n- ${proposal.change.summary ?? proposedRule.instruction}\n- Evidence: ${proposal.evidence_class}; promotion state: ${proposal.promotion_state}.\n- Synthetic fixture: ${proposal.proposal_id}.\n\n`;
fs.writeFileSync(changelogFile, priorChangelog.replace('# Threadify Workflows stable releases\n\n', `# Threadify Workflows stable releases\n\n${entry}`));

const render = spawnSync(process.execPath, [path.join(root, 'scripts', 'build-qbr-bundle.mjs')], {
  cwd: root,
  stdio: 'inherit',
});
if (render.status !== 0) process.exit(render.status ?? 1);
console.log(JSON.stringify({ status: 'proposal_applied', proposal_id: proposal.proposal_id, release_version: releaseVersion }, null, 2));
