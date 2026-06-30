// Workflow simulator: walks each workflow manifest end-to-end against a mock Threadify MCP server
// (lib/mock-mcp-client.mjs) using the generic driver engine (lib/engine.mjs), and asserts the
// safety properties every manifest in this repo claims:
//
//   1. Every tool a workflow actually calls is one it DECLARED in required_mcp_tools.
//   2. The mutating tool (schedule_post / remember — none for draft-only workflows) is NEVER
//      called without explicit approval.
//   3. When approval is withheld, OR any tool up to and including the mutating call is
//      unavailable, the workflow produces a valid fallback artifact instead of pretending the
//      action happened — and still never calls the mutating tool.
//   4. Every produced receipt/ready-output/ledger conforms to its declared JSON Schema
//      (schemas/*.json), via lib/json-schema-lite.mjs.
//
// This is the dynamic counterpart to validation/schema-checks/validate.mjs (which checks static
// manifest/fixture shape) — it actually exercises the call sequencing and gating logic an agent
// is supposed to follow, the way `npm run simulate` (wired into `npm test`) can catch a workflow
// regression before a redacted example file would.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MockMcpClient } from './lib/mock-mcp-client.mjs';
import { runWorkflow, criticalTools, mutatingTools } from './lib/engine.mjs';
import { makeReceipt, makeReadyOutput, makeLedger } from './lib/artifacts.mjs';
import { validate as validateSchema } from './lib/json-schema-lite.mjs';
import { WORKFLOW_CONFIGS } from './workflow-configs.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const failures = [];
let scenarios = 0;

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, relPath), 'utf8'));
}

function loadSchemas() {
  const dir = path.join(root, 'schemas');
  const schemas = {};
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    schemas[file.replace(/\.json$/, '')] = readJson(path.join('schemas', file));
  }
  return schemas;
}

function assertValid(schemaId, schemas, artifact, label) {
  const schema = schemas[schemaId];
  if (!schema) {
    failures.push(`${label}: unknown schema id "${schemaId}"`);
    return;
  }
  for (const err of validateSchema(schema, artifact, label)) failures.push(err);
}

function assertSubset(label, calledTools, declaredTools) {
  const declared = new Set(declaredTools);
  for (const tool of new Set(calledTools)) {
    if (!declared.has(tool)) {
      failures.push(`${label}: called undeclared tool "${tool}" (not in manifest.required_mcp_tools)`);
    }
  }
}

function assertNoMutation(label, succeededTools, mutating) {
  for (const tool of mutating) {
    if (succeededTools.includes(tool)) {
      failures.push(`${label}: mutating tool "${tool}" completed without a completed approval`);
    }
  }
}

// Builds the receipt/ledger/ready-output artifact(s) a real workflow would emit for one
// simulator run, then validates them against the schemas the manifest itself declares.
function buildAndValidate(workflowId, manifest, outcome, toolPath, schemas, label) {
  const fallbackUsed = outcome.outcome !== 'scheduled' && outcome.outcome !== 'written';
  const action = outcome.outcome === 'scheduled' || outcome.outcome === 'written'
    ? WORKFLOW_CONFIGS[workflowId].mutatingTool
    : `manual_${workflowId.replace(/-/g, '_')}_packet_fallback`;
  const status = outcome.outcome === 'scheduled' ? 'scheduled'
    : outcome.outcome === 'written' ? 'written'
    : 'fallback_ready';

  if (manifest.receipt.schema === 'memory-update-ledger.v1') {
    const item = {
      candidate_id: 'mem-candidate-1',
      memory_class: 'workflow_lesson',
      memory_text: 'Sample candidate memory text produced by the simulator.',
      approved: outcome.outcome === 'written',
      write_status: outcome.outcome === 'written' ? 'written' : 'not_executed',
      readback_status: outcome.outcome === 'written'
        ? (outcome.readbackOk ? 'verified' : 'failed')
        : 'not_executed',
      source_note: 'simulator-generated source artifact',
      action_taken: outcome.outcome === 'written' ? 'written' : 'proposal_only',
    };
    const ledger = makeLedger({
      workflowId, adapter: 'generic-mcp', sourceArtifact: 'simulator-source-artifact',
      items: [item], fallbackUsed,
    });
    assertValid('memory-update-ledger.v1', schemas, ledger, `${label} ledger`);
    return;
  }

  const receipt = makeReceipt({
    workflowId, adapter: 'generic-mcp', accountHandle: '@example_creator', action,
    approvedText: ['simulator-generated approved text'], status, toolPath, fallbackUsed,
  });
  assertValid('workflow-receipt.v1', schemas, receipt, `${label} receipt`);

  const fallbackSchema = manifest.fallback.artifact_schema;
  if (fallbackUsed && fallbackSchema === 'threadify-ready-output.v1') {
    const ready = makeReadyOutput({
      workflowId, posts: [{ text: 'Simulator-generated draft post text.' }],
      approvalState: outcome.outcome === 'draft'
        ? (outcome.approve ? 'draft_packet_ready' : 'pending_user_review')
        : 'pending_user_review',
      fallbackReason: outcome.reason ?? 'Workflow is draft-only in v0.',
    });
    assertValid('threadify-ready-output.v1', schemas, ready, `${label} ready-output`);
  }
}

function runScenario(workflowId, manifest, config, schemas, { approve, failTool }, label) {
  scenarios += 1;
  const client = new MockMcpClient();
  if (failTool) client.failTool(failTool);
  return runWorkflow(client, config, { approve }).then((outcome) => {
    assertSubset(label, client.callLog, manifest.required_mcp_tools);
    const mutating = mutatingTools(config);
    const mutationHappened = outcome.outcome === 'scheduled' || outcome.outcome === 'written';
    if (!mutationHappened) assertNoMutation(label, client.succeeded, mutating);
    if (config.kind !== 'draft-only' && !approve && outcome.outcome !== 'fallback') {
      failures.push(`${label}: expected a fallback outcome when approval is withheld, got "${outcome.outcome}"`);
    }
    buildAndValidate(workflowId, manifest, outcome, client.callLog, schemas, label);
    return outcome;
  });
}

async function main() {
  const schemas = loadSchemas();
  const workflowDirs = fs.readdirSync(path.join(root, 'workflows'));

  for (const dir of workflowDirs) {
    const manifestPath = path.join('workflows', dir, 'manifest.json');
    if (!fs.existsSync(path.join(root, manifestPath))) continue;
    const manifest = readJson(manifestPath);
    const workflowId = manifest.workflow_id;
    const config = WORKFLOW_CONFIGS[workflowId];
    if (!config) {
      failures.push(`${workflowId}: no simulator config in workflow-configs.mjs`);
      continue;
    }

    // Scenario A: full approval, every tool available -> happy path.
    await runScenario(workflowId, manifest, config, schemas, { approve: true }, `${workflowId} [approved]`);

    // Scenario B: approval withheld (not applicable to draft-only workflows, which never mutate).
    if (config.kind !== 'draft-only') {
      await runScenario(workflowId, manifest, config, schemas, { approve: false }, `${workflowId} [denied]`);
    }

    // Scenario C: each declared tool unavailable, one at a time, with approval granted. A
    // critical-path failure (everything through the mutating call) must fall back; a best-effort
    // tool (readback/feedback) failing must not erase an already-completed mutation.
    const critical = new Set(criticalTools(config));
    for (const tool of manifest.required_mcp_tools) {
      const outcome = await runScenario(
        workflowId, manifest, config, schemas, { approve: true, failTool: tool },
        `${workflowId} [${tool} unavailable]`,
      );
      const mutationHappened = outcome.outcome === 'scheduled' || outcome.outcome === 'written';
      if (critical.has(tool) && mutationHappened) {
        failures.push(`${workflowId} [${tool} unavailable]: a critical-path failure still produced "${outcome.outcome}"`);
      }
      if (!critical.has(tool) && config.kind !== 'draft-only' && !mutationHappened) {
        failures.push(`${workflowId} [${tool} unavailable]: a best-effort tool failure should not have blocked the mutation, got "${outcome.outcome}"`);
      }
    }
  }

  // Every config must correspond to a real workflow (catches a stale entry after a workflow is removed).
  const manifestIds = new Set(
    workflowDirs
      .filter((dir) => fs.existsSync(path.join(root, 'workflows', dir, 'manifest.json')))
      .map((dir) => readJson(path.join('workflows', dir, 'manifest.json')).workflow_id),
  );
  for (const id of Object.keys(WORKFLOW_CONFIGS)) {
    if (!manifestIds.has(id)) failures.push(`workflow-configs.mjs: "${id}" has no matching workflow manifest`);
  }

  if (failures.length) {
    console.error('Threadify Workflows simulator failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(`Threadify Workflows simulator passed: ${scenarios} scenarios across ${manifestIds.size} workflows.`);
}

main();
