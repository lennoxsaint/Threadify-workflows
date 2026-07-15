import fs from 'node:fs';
import path from 'node:path';
import {
  evaluateCandidate,
  evaluateLearningWindow,
} from '../../workflows/qualified-buyer-research/reference-policy.mjs';

const root = path.resolve(new URL('../..', import.meta.url).pathname);

const allowedTools = new Set([
  'get_connection_defaults',
  'list_accounts',
  'list_dispatcher_tools',
  'run_workflow',
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
  'edit_draft',
  'save_final_draft',
  'upload_media',
  'validate_post',
  'schedule_post',
  'publish_now',
  'get_publish_status',
  'get_schedule_status',
  'get_schedule_report',
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
  'generate_content',
  'edit_draft',
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

  for (const tool of manifest.required_mcp_tools ?? []) {
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
  assert(/orchestration-only/i.test(readme), 'README must say orchestration-only');
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

const files = walk(root);
const manifestFiles = files.filter((file) => file.endsWith(path.join('manifest.json')));
assert(manifestFiles.length === 8, `expected 8 workflow manifests, found ${manifestFiles.length}`);
for (const file of manifestFiles) validateManifest(file);

for (const file of files) {
  if (/\.(md|json)$/.test(file)) validateRedaction(file);
  if (file.endsWith('.receipt.json')) validateReceipt(file);
  if (file.endsWith('.threadify-ready-output.json')) validateReadyOutput(file);
}

validateReadmeClaims();
validateQualifiedBuyerResearchFixtures();

if (failures.length) {
  console.error('Threadify Workflows validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Threadify Workflows validation passed: ${manifestFiles.length} workflows, ${files.length} files checked.`);
