import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildCatalogDocument,
  describeWorkflow,
  listWorkflows,
  loadWorkflowRegistry,
} from '../../lib/workflow-registry.mjs';

const root = path.resolve(new URL('../..', import.meta.url).pathname);

test('registry discovers every canonical manifest and separates skills from recipes', () => {
  const registry = loadWorkflowRegistry({ root });
  const manifestIds = fs.readdirSync(path.join(root, 'workflows'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, 'workflows', entry.name, 'manifest.json')))
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(registry.workflows.map((workflow) => workflow.workflow_id).sort(), manifestIds);
  assert.ok(listWorkflows(registry, { kind: 'skill' }).every((workflow) => workflow.skill_name));
  assert.ok(listWorkflows(registry, { kind: 'recipe' }).every((workflow) => workflow.skill_name === null));
});

test('catalog records expose install entrypoints and preserve standalone QBR', () => {
  const registry = loadWorkflowRegistry({ root });
  const catalog = buildCatalogDocument(registry);
  assert.equal(catalog.record_type, 'ThreadifyWorkflowCatalogV1');
  for (const workflow of catalog.workflows.filter((entry) => entry.kind === 'skill')) {
    assert.equal(workflow.entrypoint, `skills/${workflow.skill_name}/SKILL.md`);
    assert.ok(fs.existsSync(path.join(root, workflow.source_entrypoint)));
    assert.ok(fs.existsSync(path.join(root, workflow.source_manifest)));
  }
  const qbr = describeWorkflow(registry, 'qualified-buyer-research');
  assert.equal(qbr.bundle.standalone, true);
  assert.ok(qbr.bundle.references.length > 0);
  assert.throws(() => describeWorkflow(registry, 'missing-workflow'), /unknown_workflow/);
});

test('loader discovers a new manifest without a registry list edit', (t) => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'threadify-registry-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  fs.mkdirSync(path.join(fixture, 'workflows', 'sample'), { recursive: true });
  fs.writeFileSync(path.join(fixture, 'workflows', 'sample', 'README.md'), '# Sample\n');
  const manifestFile = path.join(fixture, 'workflows', 'sample', 'manifest.json');
  const manifest = {
    workflow_id: 'sample', version: '0.1.0', title: 'Sample', summary: 'Sample recipe.',
    kind: 'recipe', entrypoint: { skill_id: null, source: 'workflows/sample/README.md' },
    bundle: { kind: 'recipe', standalone: false }, dependencies: { workflows: [], files: [] },
    triggers: ['show sample'], io: {
      inputs: [{ name: 'request', schema_ref: 'inline:request' }],
      outputs: [{ name: 'result', schema_ref: 'inline:result' }],
    }, supported_adapters: ['codex'], required_mcp_tools: [], optional_mcp_tools: [],
    free_capabilities: [], paid_capability_stubs: [],
    approval_gate: { required: true, type: 'explicit-final-approval', must_show: [] },
    fallback: { mode: 'local', instructions: ['Work locally.'] },
    receipt: { schema: 'workflow-receipt.v1', must_prove: ['fallback state'] },
  };
  fs.writeFileSync(manifestFile, JSON.stringify(manifest));
  assert.equal(loadWorkflowRegistry({ root: fixture }).workflows[0].workflow_id, 'sample');
  manifest.bundle.references = [{ source: 'workflows/sample/README.md', target: '../escape.md' }];
  fs.writeFileSync(manifestFile, JSON.stringify(manifest));
  assert.throws(() => loadWorkflowRegistry({ root: fixture }), /bundle_target.*escapes_registry_root/);
});
