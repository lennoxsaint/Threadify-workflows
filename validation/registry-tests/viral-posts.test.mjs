import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import { describeWorkflow, loadWorkflowRegistry } from '../../lib/workflow-registry.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const source = path.join(root, 'plugins/threadify/skills/threadify-viral-posts/SKILL.md');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'workflows/viral-posts/manifest.json'), 'utf8'));
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));

test('Viral Posts registers only Threadify read, generate, validate and schedule tools', () => {
  const workflow = describeWorkflow(loadWorkflowRegistry({ root }), 'viral-posts');
  assert.equal(workflow.skill_name, 'threadify-viral-posts');
  assert.equal(workflow.title, 'Viral Posts');
  const tools = [...workflow.required_mcp_tools, ...(workflow.optional_mcp_tools ?? [])];
  for (const tool of [
    'get_connection_defaults', 'greatest_hits', 'search_posts', 'read_post_performance', 'get_post_thread',
    'list_viral_items', 'get_viral_item', 'query_brain', 'generate_content', 'validate_post',
    'best_time_to_post', 'list_scheduled_posts', 'schedule_post', 'get_schedule_status',
  ]) {
    assert.ok(tools.includes(tool), `needs ${tool}`);
  }
  for (const tool of [
    'publish_now', 'save_draft', 'edit_draft', 'cancel_schedule', 'reschedule_post', 'send_reply',
    'create_offer', 'update_offer', 'remember', 'correct_memory', 'tombstone_memory', 'record_feedback',
  ]) {
    assert.ok(!tools.includes(tool), `must not use ${tool}`);
  }
  assert.equal(manifest.approval_gate.required, true);
  assert.equal(manifest.approval_gate.type, 'explicit-final-approval');
  assert.ok(manifest.approval_gate.must_show.includes('exact text of every part of every post'));
  assert.ok(manifest.approval_gate.must_show.includes('exact time and timezone for every post'));
  assert.ok(manifest.receipt.must_prove.includes('fallback state'));
  assert.ok(manifest.receipt.must_prove.includes('readback status (scheduled, never published)'));
  assert.ok(manifest.triggers.includes('viral posts'));
});

test('Viral Posts keeps the creator lessons as rules', () => {
  const skill = fs.readFileSync(source, 'utf8');
  assert.match(skill, /Copy the proven skeleton line for line/);
  assert.match(skill, /80 characters or less/);
  assert.match(skill, /voice and energy of the creator's own top posts/);
  assert.match(skill, /fresh-reader check/);
  assert.match(skill, /Show every part of a thread/);
  assert.match(skill, /Never invent a number, quote, name or story/);
  assert.match(skill, /top 10% by views at least twice/);
  assert.match(skill, /view count/);
});

test('Viral Posts keeps the tool order, calendar check and approval gate', () => {
  const skill = fs.readFileSync(source, 'utf8');
  const order = ['get_connection_defaults', 'greatest_hits', 'get_post_thread', 'list_viral_items', 'query_brain',
    'generate_content', 'validate_post', 'best_time_to_post', 'list_scheduled_posts', 'schedule_post', 'get_schedule_status'];
  let last = -1;
  for (const tool of order) {
    const at = skill.indexOf(`\`${tool}\``);
    assert.ok(at > last, `${tool} appears in workflow order`);
    last = at;
  }
  assert.match(skill, /must equal its `total_in_window`/);
  assert.match(skill, /at least 2 hours clear/);
  assert.match(skill, /no new post repeats text already queued/);
  assert.match(skill, /Nothing is scheduled without it/);
  assert.match(skill, /Never route around it/);
  assert.match(skill, /stable idempotency key/);
  assert.match(skill, /never make a new key to force a second write/);
  assert.match(skill, /"scheduled", never "published"/);
  assert.match(skill, /## Local fallback/);
  assert.match(skill, /## Receipt/);
  assert.match(skill, /references\/threadify-001\.md/);
  assert.doesNotMatch(skill, /`publish_now`/);
  assert.doesNotMatch(skill, /craft_viral_post/, 'the ChatGPT address does not list craft_viral_post');
  assert.doesNotMatch(skill, /—/, 'no em dashes in user-facing text');
});

test('Viral Posts README and bundled skill stay in step with the source', () => {
  const readme = fs.readFileSync(path.join(root, 'workflows/viral-posts/README.md'), 'utf8');
  assert.match(readme, /\/threadify-viral-posts/);
  assert.match(readme, /never publishes now/i);
  assert.doesNotMatch(readme, /—/);
  const bundled = fs.readFileSync(path.join(root, 'skills/threadify-viral-posts/SKILL.md'), 'utf8');
  assert.ok(bundled.startsWith(fs.readFileSync(source, 'utf8').trimEnd()), 'bundled skill starts with the source skill');
  assert.match(bundled, /references\/demo-feedback-rules\.md/);
});

test('Viral Posts receipt fixtures match the workflow receipt schema', () => {
  const validate = new Ajv({ strict: false }).compile(readJson('schemas/workflow-receipt.v1.json'));
  const pending = readJson('validation/mock-fixtures/viral-posts.awaiting-approval.receipt.json');
  const fallback = readJson('validation/mock-fixtures/viral-posts.fallback.receipt.json');
  for (const receipt of [pending, fallback]) {
    assert.ok(validate(receipt), JSON.stringify(validate.errors));
    assert.equal(receipt.workflow_id, 'viral-posts');
    assert.ok(!receipt.tool_path.includes('publish_now'));
    for (const template of receipt.templates) assert.ok(template.evidence.length >= 2, 'a template needs two evidence posts');
  }
  assert.equal(pending.status, 'awaiting_approval');
  assert.deepEqual(pending.approved_text, []);
  assert.ok(!pending.tool_path.includes('schedule_post'), 'nothing is scheduled before the yes');
  assert.equal(pending.schedule_proposal.calendar_listed, pending.schedule_proposal.calendar_total_in_window);
  assert.equal(fallback.fallback_used, true);
  assert.deepEqual(fallback.tool_path, []);
});
