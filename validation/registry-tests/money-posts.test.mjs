import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { describeWorkflow, loadWorkflowRegistry } from '../../lib/workflow-registry.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const source = path.join(root, 'plugins/threadify/skills/threadify-money-posts/SKILL.md');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'workflows/money-posts/manifest.json'), 'utf8'));

test('Money Posts registers the ranking, generation and schedule tools and never publishes now', () => {
  const workflow = describeWorkflow(loadWorkflowRegistry({ root }), 'money-posts');
  assert.equal(workflow.skill_name, 'threadify-money-posts');
  assert.equal(workflow.title, 'Money Posts');
  assert.deepEqual(workflow.required_mcp_tools, [
    'get_connection_defaults',
    'read_link_attribution',
    'read_post_performance',
    'generate_content',
    'list_offers',
    'list_scheduled_posts',
    'best_time_to_post',
    'validate_post',
    'schedule_post',
    'get_schedule_status',
  ]);
  assert.deepEqual(workflow.optional_mcp_tools, ['get_post_thread', 'search_posts', 'save_draft']);
  for (const tool of ['publish_now', 'edit_draft', 'reschedule_post', 'cancel_schedule']) {
    assert.ok(![...workflow.required_mcp_tools, ...workflow.optional_mcp_tools].includes(tool), `must not use ${tool}`);
  }
  assert.deepEqual(manifest.triggers, ['money posts', 'which of my posts actually get clicks', 'stop chasing views']);
});

test('Money Posts approval shows the exact packet before any scheduling', () => {
  assert.equal(manifest.approval_gate.required, true);
  assert.equal(manifest.approval_gate.type, 'explicit-final-approval');
  assert.deepEqual(manifest.approval_gate.must_show, [
    'account and timezone',
    'three exact posts',
    'three exact Auto Plugs and destination',
    'three local dates and times',
    'action',
  ]);
  const skill = fs.readFileSync(source, 'utf8');
  assert.match(skill, /Never publish now/);
  assert.match(skill, /Schedule only on an explicit "yes"/);
  assert.match(skill, /Never schedule without the owner's "yes" to the exact packet/);
  assert.match(skill, /schedule_post` three times/);
  assert.match(skill, /get_schedule_status`/);
  assert.match(skill, /without `draft_id`, because Threadify schedules a draft's stored text/);
  assert.doesNotMatch(skill, /`publish_now`/);
});

test('Money Posts ranks by clicks per 1,000 views from a link-to-post join', () => {
  const skill = fs.readFileSync(source, 'utf8');
  assert.match(skill, /clicks per 1,000 views = unique clicks \/ views × 1000/);
  assert.match(skill, /`root_threads_post_id` \(fallback `final_threads_post_id`\)/);
  assert.match(skill, /`days: 90`/);
  assert.match(skill, /scripts\/rank-money-posts\.mjs/);
  assert.match(skill, /Big posts with no link/);
  assert.match(skill, /Say "conversions", exactly as the tool labels them\. Never say "sales" unless that row's revenue is above 0/);
  assert.match(skill, /Missing data stays unknown/);
  assert.match(skill, /No performance predictions/);
  assert.match(skill, /2-4 patterns/);
});

test('Money Posts cold start uses labelled proxy signals below 5 linked posts or 30 clicks', () => {
  const skill = fs.readFileSync(source, 'utf8');
  assert.match(skill, /fewer than 5 linked posts, or fewer than 30 clicks in 90 days/);
  assert.match(skill, /replies per 1,000 views/);
  assert.match(skill, /replies asking how, for the link, or where/);
  assert.match(skill, /Label every proxy number "proxy, not clicks"/);
  assert.match(skill, /7 days/);
  assert.match(skill, /Otherwise give a dated note/);
});

test('Money Posts lets only Threadify write copy and guards the only allowed change', () => {
  const skill = fs.readFileSync(source, 'utf8');
  assert.match(skill, /The agent never writes or edits post copy/);
  assert.match(skill, /`generate_content`/);
  assert.match(skill, /scripts\/casing-guard\.mjs/);
  assert.match(skill, /`lower\(original\) == lower\(final\)` must be true/);
  assert.match(skill, /If the guard fails, show the original unchanged/);
  assert.match(skill, /keeping proper nouns/);
  assert.match(skill, /Threadify links on Threads are auto-tracked, so add no UTM tags/);
  assert.match(skill, /saying only the @handle and timezone/);
  assert.match(skill, /Never print credentials/);
  assert.doesNotMatch(skill, /guaranteed|guarantee/i);
  assert.ok(skill.split('\n').length <= 80, 'SKILL.md stays short');
});
