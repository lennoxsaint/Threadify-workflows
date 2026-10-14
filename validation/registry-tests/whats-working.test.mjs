import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { describeWorkflow, loadWorkflowRegistry } from '../../lib/workflow-registry.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const source = path.join(root, 'plugins/threadify/skills/threadify-whats-working/SKILL.md');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'workflows/whats-working/manifest.json'), 'utf8'));

test("What's Working registers read, generate and schedule tools and never publishes now", () => {
  const workflow = describeWorkflow(loadWorkflowRegistry({ root }), 'whats-working');
  assert.equal(workflow.skill_name, 'threadify-whats-working');
  assert.equal(workflow.title, "What's Working");
  for (const tool of ['search_posts', 'generate_content', 'schedule_post', 'get_schedule_status']) {
    assert.ok(workflow.required_mcp_tools.includes(tool), `needs ${tool}`);
  }
  for (const tool of ['publish_now', 'edit_draft', 'reschedule_post', 'cancel_schedule']) {
    assert.ok(![...workflow.required_mcp_tools, ...workflow.optional_mcp_tools].includes(tool), `must not use ${tool}`);
  }
  assert.ok(manifest.triggers.includes('is threads dead'));
});

test("What's Working is honest about the window, unknowns and approval", () => {
  const skill = fs.readFileSync(source, 'utf8');
  assert.match(skill, /Say "this year" only when the read starts on 1 January/);
  assert.match(skill, /say "unknown", never 0/);
  assert.match(skill, /Never schedule without the owner's "yes" to the exact packet/);
  assert.match(skill, /Schedule only on an explicit "yes"/);
  assert.match(skill, /references\/demo-feedback-rules\.md/);
  assert.match(skill, /`search_posts` with `query: "\*"`/);
  assert.match(skill, /`to` is exclusive/);
  assert.match(skill, /owner-overlay\.md/);
  assert.doesNotMatch(skill, /`publish_now`/);
  assert.equal(manifest.approval_gate.required, true);
});
