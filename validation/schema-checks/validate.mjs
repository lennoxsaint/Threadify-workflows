import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readReleaseMetadata } from '../../lib/release-metadata.mjs';
import {
  calibrateVoice,
  classifyOwnerEdits,
  evaluateCandidate,
  evaluateLearningWindow,
  evaluateOutcome,
  evaluateQuerySample,
  evaluateQueryRun,
  evaluateReplyDraft,
} from '../../workflows/qualified-buyer-research/reference-policy.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

const allowedTools = new Set([
  'get_connection_defaults',
  'list_offers',
  'create_offer',
  'update_offer',
  'get_capabilities',
  'get_best_time',
  'list_accounts',
  'list_dispatcher_tools',
  'call_agent_action',
  'query_brain',
  'get_brain_overview',
  'remember',
  'correct_memory',
  'tombstone_memory',
  'export_memory_packet',
  'import_memory_packet',
  'ingest_vault_url',
  'generate_content',
  'save_draft',
  'list_vault_items',
  'get_vault_item',
  'list_viral_items',
  'get_viral_item',
  'edit_draft',
  'save_final_draft',
  'upload_media',
  'validate_post',
  'schedule_post',
  'publish_now',
  'get_publish_status',
  'get_schedule_status',
  'list_scheduled_posts',
  'cancel_schedule',
  'reschedule_post',
  'greatest_hits',
  'generate_replies',
  'send_reply',
  'enable_auto_reply',
  'get_auto_reply_status',
  'record_feedback',
  'audit_log',
]);

const disallowedPublicTools = new Set([
  'generate_replies',
  'publish_now',
  'send_reply',
  'enable_auto_reply',
]);

const requiredManifestFields = [
  'workflow_id',
  'version',
  'title',
  'summary',
  'supported_adapters',
  'required_mcp_tools',
  'free_capabilities',
  'paid_capability_stubs',
  'approval_gate',
  'fallback',
  'receipt',
];

const requiredReceiptFields = [
  'workflow_id',
  'adapter',
  'account_handle',
  'action',
  'approved_text',
  'approved_text_sha256',
  'status',
  'timestamp',
  'timezone',
  'tool_path',
  'fallback_used',
];

const forbiddenContent = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /xox[baprs]-[A-Za-z0-9-]{20,}/,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
  /threads_account_id/i,
  /access_token/i,
  /refresh_token/i,
  /member email/i,
  /private lesson/i,
];

const failures = [];

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    failures.push(`${rel(file)} is not valid JSON: ${error.message}`);
    return null;
  }
}

function rel(file) {
  return path.relative(root, file);
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    // engines/eddy is an external submodule (the Eddy project). It is validated
    // by its own repo and uses its own receipt/manifest conventions, so skip it.
    if (path.relative(root, full) === path.join('engines', 'eddy')) continue;
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function validateManifest(file) {
  const manifest = readJson(file);
  if (!manifest) return;

  for (const field of requiredManifestFields) {
    assert(Object.hasOwn(manifest, field), `${rel(file)} missing ${field}`);
  }

  assert(manifest.approval_gate?.required === true, `${rel(file)} must require approval`);
  assert(
    manifest.approval_gate?.type === 'explicit-final-approval',
    `${rel(file)} must use explicit-final-approval`,
  );

  for (const tool of [...(manifest.required_mcp_tools ?? []), ...(manifest.optional_mcp_tools ?? [])]) {
    assert(allowedTools.has(tool), `${rel(file)} references unknown MCP tool ${tool}`);
    assert(!disallowedPublicTools.has(tool), `${rel(file)} uses disallowed public v0 tool ${tool}`);
  }

  assert(
    (manifest.fallback?.instructions ?? []).length > 0,
    `${rel(file)} must include fallback instructions`,
  );
  assert(
    (manifest.receipt?.must_prove ?? []).includes('fallback state'),
    `${rel(file)} receipt must prove fallback state`,
  );
}

function validateReceipt(file) {
  const receipt = readJson(file);
  if (!receipt) return;
  for (const field of requiredReceiptFields) {
    assert(Object.hasOwn(receipt, field), `${rel(file)} missing receipt field ${field}`);
  }
  if (receipt.workflow_id === 'qualified-buyer-research') {
    for (const field of [
      'offer_context_version',
      'voice_context_version',
      'voice_confidence',
      'query_quality',
      'query_run',
      'fit_evidence',
      'supporting_signals',
      'solution_awareness',
      'commercial_evidence',
      'language_bank_route',
      'reply_branch',
      'staged_variant',
      'sent_variant',
      'owner_edit_dimensions',
    ]) {
      assert(Object.hasOwn(receipt, field), `${rel(file)} missing buyer-research receipt field ${field}`);
    }
  }
}

function validateReadyOutput(file) {
  const artifact = readJson(file);
  if (!artifact) return;
  for (const field of ['workflow_id', 'posts', 'approval_state', 'fallback_reason']) {
    assert(Object.hasOwn(artifact, field), `${rel(file)} missing ready-output field ${field}`);
  }
}

function validateRedaction(file) {
  const text = fs.readFileSync(file, 'utf8');
  for (const pattern of forbiddenContent) {
    assert(!pattern.test(text), `${rel(file)} contains forbidden or secret-like content: ${pattern}`);
  }
}

function validateReadmeClaims() {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  assert(/MCP ready/i.test(readme), 'README must include MCP ready claim');
  assert(/local drafting/i.test(readme), 'README must describe useful local drafting');
  assert(!/fully automated growth/i.test(readme), 'README overclaims fully automated growth');
  assert(!/guaranteed/i.test(readme), 'README must not use guarantee language');
}

function validateQualifiedBuyerResearchFixtures() {
  const file = path.join(
    root,
    'validation',
    'mock-fixtures',
    'qualified-buyer-research.scenarios.json',
  );
  const fixture = readJson(file);
  if (!fixture) return;

  const requiredCandidateNames = [
    'stale post is rejected',
    'seller funnel is rejected',
    'advice post is research rejection',
    'current first person pain is public reply ready',
    'like only is not DM permission',
    'explicit DM permission is DM ready',
    'duplicate is rejected',
    'suppressed person is rejected',
    'wrong account blocks composer work',
    'genuine pain outside the offer is research only',
    'correct audience with out of scope problem is research only',
    'authored situation evidence maps audience problem and transformation',
    'missing offer context stops public action',
    'seller who matches the offer can be public reply ready',
    'anonymous quoted pain is language research only',
    'saturated disputed thread is research only',
    'outcome fit qualifies without solution awareness',
    'situation match qualifies despite vague profile label',
    'matching identity with wrong situation is research only',
    'current problem without supporting signal is research only',
    'public reply readiness ignores low rank score',
    'call stage requires later commercial evidence',
  ];
  const candidateNames = new Set((fixture.candidate_scenarios ?? []).map((scenario) => scenario.name));
  for (const name of requiredCandidateNames) {
    assert(candidateNames.has(name), `${rel(file)} missing candidate scenario: ${name}`);
  }

  for (const scenario of fixture.candidate_scenarios ?? []) {
    const actual = evaluateCandidate(scenario.input);
    assert(actual.stage === scenario.expected_stage, `${scenario.name}: expected stage ${scenario.expected_stage}, got ${actual.stage}`);
    if (scenario.expected_reason) {
      assert(actual.reasons.includes(scenario.expected_reason), `${scenario.name}: missing reason ${scenario.expected_reason}`);
    }
    if (scenario.expected_status) {
      assert(actual.status === scenario.expected_status, `${scenario.name}: expected status ${scenario.expected_status}, got ${actual.status}`);
    }
    if (scenario.expected_language_bank_route) {
      assert(actual.language_bank_route === scenario.expected_language_bank_route, `${scenario.name}: expected language route ${scenario.expected_language_bank_route}, got ${actual.language_bank_route}`);
    }
  }

  const requiredQueryNames = [
    'irrelevant token matches rewrite the query',
    'mapped buyer language continues to inspection',
    'one precise owned match is enough to inspect',
  ];
  const queryNames = new Set((fixture.query_scenarios ?? []).map((scenario) => scenario.name));
  for (const name of requiredQueryNames) {
    assert(queryNames.has(name), `${rel(file)} missing query scenario: ${name}`);
  }

  for (const scenario of fixture.query_scenarios ?? []) {
    const actual = evaluateQuerySample(scenario.input);
    assert(
      actual.action === scenario.expected_action,
      `${scenario.name}: expected ${scenario.expected_action}, got ${actual.action}`,
    );
  }

  for (const scenario of fixture.query_run_scenarios ?? []) {
    const actual = evaluateQueryRun(scenario.input);
    assert(actual.status === scenario.expected_status, `${scenario.name}: expected status ${scenario.expected_status}, got ${actual.status}`);
    assert(actual.stop_reason === scenario.expected_stop_reason, `${scenario.name}: expected stop ${scenario.expected_stop_reason}, got ${actual.stop_reason}`);
  }

  for (const scenario of fixture.reply_scenarios ?? []) {
    const actual = evaluateReplyDraft(scenario.input);
    assert(actual.branch === scenario.expected_branch, `${scenario.name}: expected branch ${scenario.expected_branch}, got ${actual.branch}`);
    assert(actual.ready === scenario.expected_ready, `${scenario.name}: expected ready ${scenario.expected_ready}, got ${actual.ready}`);
    if (scenario.expected_reason) assert(actual.reasons.includes(scenario.expected_reason), `${scenario.name}: missing reason ${scenario.expected_reason}`);
  }

  for (const scenario of fixture.voice_scenarios ?? []) {
    const actual = calibrateVoice(scenario.input);
    assert(actual.voice_confidence === scenario.expected_confidence, `${scenario.name}: expected confidence ${scenario.expected_confidence}, got ${actual.voice_confidence}`);
    assert(actual.mode === scenario.expected_mode, `${scenario.name}: expected mode ${scenario.expected_mode}, got ${actual.mode}`);
  }

  for (const scenario of fixture.owner_edit_scenarios ?? []) {
    const actual = classifyOwnerEdits(scenario.input);
    assert(actual.learning_target === scenario.expected_learning_target, `${scenario.name}: wrong learning target`);
    assert(actual.candidate_policy_mutated === scenario.expected_candidate_policy_mutated, `${scenario.name}: candidate policy mutation mismatch`);
    assert(JSON.stringify(actual.changed_dimensions) === JSON.stringify(scenario.expected_changed_dimensions), `${scenario.name}: owner edit dimensions mismatch`);
  }

  for (const scenario of fixture.outcome_scenarios ?? []) {
    const actual = evaluateOutcome(scenario.input);
    assert(actual.qualified_progression === scenario.expected_progression, `${scenario.name}: progression mismatch`);
  }

  const requiredLearningNames = [
    'pending outcomes do not change policy',
    'ten outcomes create proposal only',
    'two proven batches promote soft change',
    'hard gate never self modifies',
  ];
  const learningNames = new Set((fixture.learning_scenarios ?? []).map((scenario) => scenario.name));
  for (const name of requiredLearningNames) {
    assert(learningNames.has(name), `${rel(file)} missing learning scenario: ${name}`);
  }

  for (const scenario of fixture.learning_scenarios ?? []) {
    const actual = evaluateLearningWindow(scenario.input);
    assert(actual.result === scenario.expected_result, `${scenario.name}: expected ${scenario.expected_result}, got ${actual.result}`);
  }
}

function validateQualifiedBuyerResearchSchema() {
  const file = path.join(root, 'schemas', 'qualified-buyer-research.v1.json');
  const schema = readJson(file);
  if (!schema) return;
  assert(Boolean(schema.$defs?.OfferContextV1), `${rel(file)} missing OfferContextV1`);
  const required = new Set(schema.$defs?.CandidateEvaluationV1?.required ?? []);
  for (const field of ['query_quality', 'offer_context_version', 'fit_evidence', 'solution_awareness', 'commercial_evidence']) {
    assert(required.has(field), `${rel(file)} CandidateEvaluationV1 must require ${field}`);
  }
  for (const definition of ['QueryRunV1', 'VoiceContextV1']) {
    assert(Boolean(schema.$defs?.[definition]), `${rel(file)} missing ${definition}`);
  }
  const fitRequired = new Set(schema.$defs?.CandidateEvaluationV1?.properties?.fit_evidence?.required ?? []);
  assert(fitRequired.has('situation_evidence_source'), `${rel(file)} fit evidence must require situation_evidence_source`);
  const outcomeRequired = new Set(schema.$defs?.OutcomeEventV1?.required ?? []);
  assert(outcomeRequired.has('observed_within_hours'), `${rel(file)} OutcomeEventV1 must require observed_within_hours`);
  const updateRequired = new Set(schema.$defs?.PolicyUpdateEventV1?.required ?? []);
  assert(updateRequired.has('policy_family'), `${rel(file)} PolicyUpdateEventV1 must require policy_family`);
}

function validateDurableRuleContracts() {
  const rulesFile = path.join(root, 'public-rules', 'qualified-buyer-research.v1.json');
  const ruleset = readJson(rulesFile);
  if (!ruleset) return;
  assert(ruleset.record_type === 'PublicDurableRulesetV1', `${rel(rulesFile)} has wrong record type`);
  assert(/^\d+\.\d+\.\d+$/.test(ruleset.rules_version ?? ''), `${rel(rulesFile)} has invalid rules version`);
  assert(Array.isArray(ruleset.rules) && ruleset.rules.length >= 10, `${rel(rulesFile)} must contain durable rules`);
  const ids = new Set();
  for (const rule of ruleset.rules ?? []) {
    assert(rule.record_type === 'DurableRuleV1', `${rel(rulesFile)} contains a non-DurableRuleV1 record`);
    assert(['candidate', 'message'].includes(rule.scope), `${rel(rulesFile)} contains invalid scope ${rule.scope}`);
    assert(rule.rule_id?.startsWith(`${rule.scope}.`), `${rel(rulesFile)} rule scope mismatch ${rule.rule_id}`);
    assert(!ids.has(rule.rule_id), `${rel(rulesFile)} duplicates ${rule.rule_id}`);
    ids.add(rule.rule_id);
    assert(typeof rule.hard_gate === 'boolean', `${rel(rulesFile)} ${rule.rule_id} missing hard_gate`);
  }
  for (const schemaName of [
    'durable-rule.v1.json',
    'public-rule-proposal.v1.json',
    'stable-release-manifest.v1.json',
    'update-receipt.v1.json',
  ]) {
    const schemaFile = path.join(root, 'schemas', schemaName);
    const schema = readJson(schemaFile);
    assert(Boolean(schema?.required?.length), `${rel(schemaFile)} must declare required fields`);
  }
  const releaseIntentFile = path.join(root, 'release', 'release-intent.json');
  const releaseIntent = readReleaseMetadata(root);
  assert(typeof releaseIntent?.release === 'boolean', `${rel(releaseIntentFile)} must explicitly declare stable release intent`);
  assert(releaseIntent?.rules_version === ruleset.rules_version, `${rel(releaseIntentFile)} rules version drift`);
  const plugin = readJson(path.join(root, '.codex-plugin', 'plugin.json'));
  assert(plugin?.version === releaseIntent?.plugin_version, 'Codex plugin version must match release intent');
}

const files = walk(root);
const manifestFiles = files.filter(
  (file) => file.startsWith(path.join(root, 'workflows') + path.sep)
    && file.endsWith(path.join('manifest.json')),
);
assert(manifestFiles.length === 14, `expected 14 workflow manifests, found ${manifestFiles.length}`);
for (const file of manifestFiles) validateManifest(file);

for (const file of files) {
  if (/\.(md|json)$/.test(file)) validateRedaction(file);
  if (file.endsWith('.receipt.json')) validateReceipt(file);
  if (file.endsWith('.threadify-ready-output.json')) validateReadyOutput(file);
}

validateReadmeClaims();
validateQualifiedBuyerResearchFixtures();
validateQualifiedBuyerResearchSchema();
validateDurableRuleContracts();

if (failures.length) {
  console.error('Threadify Workflows validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Threadify Workflows validation passed: ${manifestFiles.length} workflows, ${files.length} files checked.`);
