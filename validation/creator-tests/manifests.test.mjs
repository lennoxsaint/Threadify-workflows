import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
const root = new URL('../..', import.meta.url);
const read = (p) => JSON.parse(fs.readFileSync(new URL(p, root)));
test('four primary manifests preserve disconnected use and separately gated connected capabilities', () => {
  const validate = new Ajv({ strict: true }).compile(read('schemas/workflow-manifest.v1.json'));
  for (const id of ['vault-setup', 'create-my-day', 'create-my-week', 'create-my-month']) {
    const manifest = read(`workflows/${id}/manifest.json`);
    assert.equal(validate(manifest), true, JSON.stringify(validate.errors));
    assert.equal(manifest.workflow_id, id);
    assert.deepEqual(manifest.required_mcp_tools, []);
    assert.ok(manifest.optional_mcp_tools.includes('get_connection_defaults'));
    assert.equal(manifest.approval_gate.required, true);
    assert.equal(manifest.approval_gate.type, 'explicit-final-approval');
    assert.ok(manifest.receipt.must_prove.includes('fallback state'));
    assert.ok(!manifest.optional_mcp_tools.includes('publish_now'));
    if (id !== 'vault-setup') assert.ok(manifest.optional_mcp_tools.includes('save_draft'));
  }
});

test('YouTube edit-only mode does not require a Threadify connection or grant promotion authority', () => {
  const manifest = read('workflows/youtube-edit/manifest.json');
  assert.deepEqual(manifest.required_mcp_tools, []);
  assert.ok(manifest.optional_mcp_tools.includes('schedule_post'));
  assert.ok(manifest.optional_mcp_tools.includes('upload_media'));
  assert.ok(manifest.modes.some((mode) => mode.id === 'edit-only'));
  assert.equal(manifest.approval_gate.required, true);
  assert.ok(manifest.fallback.instructions.some((text) => text.includes('explicit opt-in')));
});

test('compatibility delivery workflows remain usable without optional feedback sharing', () => {
  for (const id of ['weekly-winner-replication', 'daily-greatest-hits', 'daily-posts-heartbeat']) {
    const manifest = read(`workflows/${id}/manifest.json`);
    const connected = new Set(['get_connection_defaults', 'greatest_hits', 'validate_post',
      'schedule_post', 'get_schedule_status', 'list_scheduled_posts']);
    assert.ok(manifest.required_mcp_tools.every((tool) => connected.has(tool)));
    assert.ok(manifest.optional_mcp_tools.includes('record_feedback'));
    assert.equal(manifest.approval_gate.required, true);
  }
});

test('advanced workflows do not require feedback sharing to run their core capability', () => {
  const validate = new Ajv({ strict: true }).compile(read('schemas/workflow-manifest.v1.json'));
  for (const id of ['crosspost-x-after-threads', 'x-article-from-daily-post',
    'personal-brain-sync-current-self', 'qualified-buyer-research']) {
    const manifest = read(`workflows/${id}/manifest.json`);
    assert.equal(validate(manifest), true, JSON.stringify(validate.errors));
    assert.ok(!manifest.required_mcp_tools.includes('record_feedback'), id);
    assert.ok(manifest.optional_mcp_tools.includes('record_feedback'), id);
    assert.ok(manifest.fallback.instructions.some((text) => text.includes('explicit opt-in')), id);
    assert.equal(manifest.approval_gate.required, true);
  }
});
