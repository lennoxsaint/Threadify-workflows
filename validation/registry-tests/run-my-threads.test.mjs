import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { describeWorkflow, loadWorkflowRegistry } from '../../lib/workflow-registry.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const sourceDir = path.join(root, 'plugins/threadify/skills/threadify-run-my-threads');
const read = (relative) => fs.readFileSync(path.join(sourceDir, relative), 'utf8');

test('Run My Threads registers the daily generate, greatest-hit, validate and schedule tools', () => {
  const workflow = describeWorkflow(loadWorkflowRegistry({ root }), 'run-my-threads');
  assert.equal(workflow.skill_name, 'threadify-run-my-threads');
  assert.deepEqual(workflow.required_mcp_tools, [
    'get_connection_defaults',
    'list_scheduled_posts',
    'greatest_hits',
    'get_post_thread',
    'search_posts',
    'save_draft',
    'generate_content',
    'validate_post',
    'schedule_post',
    'get_schedule_status',
  ]);
  // cancel_schedule is recovery only: a stored text that does not match the card, after the owner's reply.
  assert.deepEqual(workflow.optional_mcp_tools, [
    'best_time_to_post',
    'list_offers',
    'list_vault_items',
    'list_vault_suggestions',
    'cancel_schedule',
  ]);
  for (const tool of ['publish_now', 'edit_draft', 'reschedule_post']) {
    assert.ok(![...workflow.required_mcp_tools, ...workflow.optional_mcp_tools].includes(tool), `must not use ${tool}`);
  }
});

test('Run My Threads allows save_draft only for exact greatest-hit reposts', () => {
  const skill = read('SKILL.md');
  assert.match(skill, /`save_draft` is allowed only for an exact greatest-hit repost/);
  assert.match(skill, /byte-identical to the original\. Never use it for anything else/);
  assert.match(skill, /`unchanged: true`/);
  assert.match(skill, /never rewrite/);
  assert.match(skill, /Never lowercase a greatest hit/);
  assert.match(skill, /last 60 days/);
  assert.match(skill, /stale-fact check/);
  // Every save_draft mention is about the greatest hit.
  for (const line of skill.split('\n').filter((text) => text.includes('save_draft'))) {
    assert.match(line, /greatest[- ]hit|Greatest hit/, line);
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
  assert.match(skill, /Five posts a day, 35 a week/);
  assert.match(skill, /6 threads and 29 short-form posts/);
  assert.match(skill, /"skip 2"/);
  assert.match(skill, /without `draft_id`, because Threadify schedules a draft's stored text/);
  assert.match(skill, /never replay the batch/);
  assert.match(skill, /usage not exposed by this host/);
  assert.match(skill, /Never write, rewrite, shorten or edit post copy yourself, and never use `edit_draft`/);
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

test('Run My Threads encodes the week, hooks and CTA levels', () => {
  const skill = read('SKILL.md');
  assert.match(skill, /`teacher` → `storyteller` → `synthesizer`/);
  assert.match(skill, /`listicle-plug` is used only on CTA slots/);
  assert.match(skill, /\*\*Growth\*\* 0 a week/);
  assert.match(skill, /\*\*Balanced\*\* \(default\) 2 a day, 14 a week \(one or two a day tops out at 14, not 15\)/);
  assert.match(skill, /\*\*Conversion\*\* 25 a week, 3 or 4 a day/);
  assert.match(skill, /Never a CTA or link in post 1/);
  assert.match(skill, /scripts\/week-plan\.mjs/);
  assert.match(skill, /scripts\/hook-check\.mjs/);
  assert.match(skill, /ask Threadify once for a replacement/);
  assert.match(skill, /Never hand-edit/);
  assert.match(skill, /`strict_facts: true`/);
  assert.match(skill, /a number in a hook only if it really happened/);
  assert.match(skill, /list_vault_suggestions/);
  assert.match(skill, /list_vault_items/);
  assert.match(skill, /references\/hook-bank\.md/);
  assert.match(skill, /references\/threads-playbook\.md/);
  assert.match(skill, /auto_plug: \{content: <exact plug text>, trigger: "time", delay_minutes: 15\}/);
  assert.match(skill, /read the receipt's `auto_plug` echo/);
  assert.match(skill, /Decide Auto Plug before the first plan/);
  assert.match(skill, /otherwise, or when unsure, `auto_plug: false`/);
  assert.match(skill, /The offer link may appear only in the CTA post/);
  assert.match(skill, /within 90 minutes/);
  assert.match(skill, /~\/\.threadify-workflows\/state\/run-my-threads\//);
  assert.ok(skill.split('\n').length <= 110, 'SKILL.md stays readable');
});

test('Run My Threads playbook is public, concise and free of private branding', () => {
  const playbook = read('references/threads-playbook.md');
  const bank = read('references/hook-bank.md');
  assert.ok(playbook.split('\n').length <= 250, 'playbook stays under 250 lines');
  for (const text of [playbook, bank]) {
    assert.doesNotMatch(text, /full circle|saints college|thriends|let's fucking grow|borrowed life|earned life|lennox|thread-score|\+\d+%/i);
  }
  for (const heading of ['## Hook', '## Hold', '## Help', '## CTA', '## Structures', '## Short-form types', '## Long-form']) {
    assert.ok(playbook.includes(`${heading}\n`), `playbook has ${heading}`);
  }
  assert.match(playbook, /Rule of Two/);
  assert.match(playbook, /RSS test/);
  assert.match(playbook, /a number only if it really happened/);
  assert.match(bank, /a number only if it really happened/);
});
