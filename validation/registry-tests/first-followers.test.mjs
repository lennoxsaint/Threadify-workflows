import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { describeWorkflow, loadWorkflowRegistry } from '../../lib/workflow-registry.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const source = path.join(root, 'plugins/threadify/skills/threadify-first-followers/SKILL.md');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'workflows/first-followers/manifest.json'), 'utf8'));

test('First Followers registers generate and schedule tools and never sends or publishes', () => {
  const workflow = describeWorkflow(loadWorkflowRegistry({ root }), 'first-followers');
  assert.equal(workflow.skill_name, 'threadify-first-followers');
  assert.equal(workflow.title, 'First Followers');
  for (const tool of ['get_connection_defaults', 'generate_content', 'best_time_to_post', 'schedule_post', 'get_schedule_status']) {
    assert.ok(workflow.required_mcp_tools.includes(tool), `needs ${tool}`);
  }
  for (const tool of ['publish_now', 'send_reply', 'generate_replies', 'enable_auto_reply', 'edit_draft', 'reschedule_post', 'cancel_schedule']) {
    assert.ok(![...workflow.required_mcp_tools, ...workflow.optional_mcp_tools].includes(tool), `must not use ${tool}`);
  }
  assert.ok(manifest.triggers.includes('first followers'));
  assert.equal(manifest.approval_gate.required, true);
  assert.ok(manifest.receipt.must_prove.includes('fallback state'));
});

test('First Followers keeps every follow and send in the owner\'s hands', () => {
  const skill = fs.readFileSync(source, 'utf8');
  assert.match(skill, /Never follow, like, comment, reply, repost, post or DM from the browser/);
  assert.match(skill, /The owner follows and sends every card by hand/);
  assert.match(skill, /At most 20 welcomes per day/);
  assert.match(skill, /No links in any comment\. No duplicate comment text\./);
  assert.match(skill, /No flattery templates/);
  assert.match(skill, /No DMs/);
  assert.match(skill, /under 18, a private account, anyone who seems distressed, and brands, bots/);
  assert.match(skill, /Never claim follow-back rates/);
  assert.match(skill, /since you started/);
  assert.match(skill, /Receipts and the scoreboard are counts only/);
  assert.match(skill, /welcome to threads, <first name>! just followed you\./);
  assert.match(skill, /the third comment ends with "followed!"/);
  assert.match(skill, /Schedule only on an explicit "yes"/);
  assert.match(skill, /Never reword Threadify's output/);
  assert.match(skill, /references\/demo-feedback-rules\.md/);
  assert.match(skill, /owner-overlay\.md/);
  assert.match(skill, /http:\/\/127\.0\.0\.1:8048\/first-followers\.html/);
  assert.match(skill, /Never ask for post history/);
  assert.doesNotMatch(skill, /`publish_now`|`send_reply`/);
});
