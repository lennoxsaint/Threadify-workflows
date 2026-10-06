import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { describeWorkflow, loadWorkflowRegistry } from '../../lib/workflow-registry.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const sourceDir = path.join(root, 'plugins/threadify/skills/threadify-run-my-threads');
const read = (relative) => fs.readFileSync(path.join(sourceDir, relative), 'utf8');

test('Run My Threads registers exactly the daily generate, validate and schedule tools', () => {
  const workflow = describeWorkflow(loadWorkflowRegistry({ root }), 'run-my-threads');
  assert.equal(workflow.skill_name, 'threadify-run-my-threads');
  assert.deepEqual(workflow.required_mcp_tools, [
    'get_connection_defaults',
    'list_scheduled_posts',
    'generate_content',
    'validate_post',
    'schedule_post',
    'get_schedule_status',
  ]);
  // cancel_schedule is recovery only: a stored text that does not match the card, after the owner's reply.
  assert.deepEqual(workflow.optional_mcp_tools, ['best_time_to_post', 'cancel_schedule']);
  for (const tool of ['publish_now', 'edit_draft', 'save_draft', 'reschedule_post']) {
    assert.ok(![...workflow.required_mcp_tools, ...workflow.optional_mcp_tools].includes(tool), `must not use ${tool}`);
  }
});

test('Run My Threads keeps the model fallback chain in one place', () => {
  const models = JSON.parse(read('references/generation-models.json'));
  assert.equal(models.parameter, 'selectedModel');
  assert.deepEqual(models.fallback_chain, ['claude-opus', 'claude-sonnet', 'gemini-3.1-pro-preview', 'gemini']);
  assert.match(models.summary, /Claude Opus 5\.5 when your plan allows it, Gemini as fallback/);
  const skill = read('SKILL.md');
  assert.match(skill, /references\/generation-models\.json/);
  assert.match(skill, /is not available on your plan/);
  assert.match(skill, /Never claim a model the response does not confirm/);
  // Ids live only in the reference file, never duplicated into the skill text.
  assert.doesNotMatch(skill, /gemini-3\.1-pro-preview|claude-sonnet/);
});

test('Run My Threads gates scheduling on one exact yes and never rewrites Threadify copy', () => {
  const skill = read('SKILL.md');
  assert.match(skill, /I don't write posts anymore\. I approve them\./);
  assert.match(skill, /Never write, rewrite, shorten or edit post copy yourself/);
  assert.match(skill, /scripts\/casing-guard\.mjs/);
  assert.match(skill, /On FAIL, use Threadify's original unchanged/);
  assert.match(skill, /Never publish now/);
  assert.match(skill, /Never schedule without the owner's "yes" to the exact card/);
  assert.match(skill, /link tracking can replace URLs when a post is scheduled/);
  assert.match(skill, /offer `cancel_schedule` for that post; cancel only after the owner's reply/);
  assert.match(skill, /Never move, replace or overwrite an occupied slot/);
  assert.match(skill, /Never create a second daily schedule/);
  assert.match(skill, /default 5, owner may choose 1 to 5/);
  assert.match(skill, /"skip 2"/);
  assert.match(skill, /without `draft_id`, because Threadify schedules a draft's stored text/);
  assert.match(skill, /never replay the batch/);
  assert.match(skill, /usage not exposed by this host/);
  assert.match(skill, /Never estimate/);
  assert.doesNotMatch(skill, /guaranteed|guarantee/i);
});

test('Run My Threads creates one 05:30 daily schedule and reuses an existing one', () => {
  const schedule = read('references/daily-schedule.md');
  assert.match(schedule, /exactly one host schedule/);
  assert.match(schedule, /default time is 05:30/);
  assert.match(schedule, /Find before you create/);
  assert.match(schedule, /Never create a second schedule/);
  assert.match(schedule, /kind = "heartbeat"/);
  assert.match(schedule, /FREQ=DAILY;BYHOUR=5;BYMINUTE=30/);
  assert.match(schedule, /`\/schedule`/);
  assert.match(schedule, /Do not use `\/loop`/);
  assert.match(schedule, /never approval to schedule posts/);
});
