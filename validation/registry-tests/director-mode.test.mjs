import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { describeWorkflow, loadWorkflowRegistry } from '../../lib/workflow-registry.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const source = path.join(root, 'plugins/threadify/skills/threadify-director-mode/SKILL.md');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'workflows/director-mode/manifest.json'), 'utf8'));

test('Director Mode registers upload and schedule tools and never publishes now', () => {
  const workflow = describeWorkflow(loadWorkflowRegistry({ root }), 'director-mode');
  assert.equal(workflow.skill_name, 'threadify-director-mode');
  assert.equal(workflow.title, 'Director Mode');
  for (const tool of ['get_connection_defaults', 'generate_content', 'create_media_upload', 'best_time_to_post', 'schedule_post', 'get_schedule_status']) {
    assert.ok(workflow.required_mcp_tools.includes(tool), `needs ${tool}`);
  }
  for (const tool of ['publish_now', 'send_reply', 'edit_draft', 'reschedule_post', 'cancel_schedule']) {
    assert.ok(![...workflow.required_mcp_tools, ...workflow.optional_mcp_tools].includes(tool), `must not use ${tool}`);
  }
  assert.ok(manifest.triggers.includes('director mode'));
  assert.equal(manifest.approval_gate.required, true);
  assert.ok(manifest.receipt.must_prove.includes('fallback state'));
});

test('Director Mode keeps the original, raw media local and scheduling behind one exact yes', () => {
  const skill = fs.readFileSync(source, 'utf8');
  const post = fs.readFileSync(path.join(path.dirname(source), 'references/post.md'), 'utf8');
  assert.match(skill, /Stop editing\. Start directing\./);
  assert.match(skill, /It is free\./);
  assert.match(skill, /\*\*Never touch the original\.\*\*/);
  assert.match(skill, /Raw media stays on this computer/);
  for (const level of ['Level 1 · Speed', 'Level 2 · Altitude', 'Level 3 · Depth', 'Level 4 · Range']) assert.ok(skill.includes(level), level);
  assert.match(skill, /fresh\*\* judge that has never seen this conversation, the script or the plan/);
  assert.match(skill, /Print both scores/);
  assert.match(skill, /Never NC, ND or SA/);
  assert.match(skill, /never lands on a word onset/);
  assert.match(skill, /at most 3 words at a time/);
  assert.match(skill, /references\/demo-feedback-rules\.md/);
  assert.match(skill, /owner-overlay\.md/);
  assert.match(skill, /director-mode\.mjs/);
  assert.doesNotMatch(skill, /`publish_now`/);
  assert.match(post, /`get_connection_defaults` first/);
  assert.match(post, /Never call `publish_now`/);
  assert.match(post, /Only on an exact "yes"/);
  assert.match(post, /Never reword Threadify's output/);
  assert.match(post, /casing-guard\.mjs/);
  assert.match(post, /`create_media_upload`/);
  assert.match(post, /`get_schedule_status`/);
});
