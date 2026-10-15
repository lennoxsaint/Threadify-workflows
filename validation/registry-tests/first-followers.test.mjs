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

test('First Followers stages comments for the owner to publish and never sends', () => {
  const skill = fs.readFileSync(source, 'utf8');
  const posts = fs.readFileSync(path.join(path.dirname(source), 'references/posts.md'), 'utf8');
  const schedule = fs.readFileSync(path.join(path.dirname(source), 'references/schedule.md'), 'utf8');
  assert.match(skill, /The human publishes every comment\./);
  assert.match(skill, /click Follow only within the owner's batch approval/);
  assert.match(skill, /never clicks Post, Publish or any reply-send button, never presses Enter in a composer, and never unfollows, likes, reposts, quotes or DMs/);
  assert.match(skill, /Stage these comments one at a time for you to publish, and follow each person at the step shown\?/);
  assert.match(skill, /That one yes covers staging and the follows for this batch only/);
  assert.match(skill, /10 people per run by default, at most 20 people and 40 comments per day per account/);
  assert.match(skill, /No links in any comment\. No duplicate comment text/);
  assert.match(skill, /No flattery templates/);
  assert.match(skill, /No DMs/);
  assert.match(skill, /under 18, a private account, anyone who seems distressed, and brands, bots/);
  assert.match(skill, /Never say someone is new to Threads unless their posts show it/);
  assert.match(skill, /welcome to threads! just followed you/);
  assert.match(skill, /otherwise "just followed you!"/);
  assert.match(skill, /If comment 1 or 2 was not published, do not follow/);
  assert.match(skill, /Stop at once on any Threads warning, action block, rate limit or captcha/);
  assert.match(skill, /copy mode/);
  assert.match(skill, /no single host is required/);
  assert.match(skill, /`get_brain_overview` and `query_brain`/);
  assert.match(skill, /save each with `remember`/);
  assert.match(skill, /read back with `query_brain`/);
  assert.match(skill, /"always" also writes/);
  assert.match(skill, /first-followers\.mjs check-drafts --ledger/);
  assert.match(skill, /first-followers\.mjs diff/);
  assert.match(skill, /~\/\.threadify\/first-followers\/ledger\.jsonl/);
  assert.match(skill, /Want me to run this for you on a schedule\?/);
  assert.match(skill, /Never create a schedule silently/);
  assert.match(skill, /Re-check tomorrow: I'll see who followed back\./);
  assert.match(skill, /Never claim follow-back rates/);
  assert.match(skill, /since you started/);
  assert.match(skill, /Receipts and the scoreboard are counts only/);
  assert.match(skill, /references\/demo-feedback-rules\.md/);
  assert.match(skill, /owner-overlay\.md/);
  assert.match(skill, /http:\/\/127\.0\.0\.1:8048\/first-followers\.html/);
  assert.match(skill, /Never ask for post history/);
  assert.doesNotMatch(skill, /`publish_now`|`send_reply`/);
  assert.match(posts, /Schedule only on an explicit "yes"/);
  assert.match(posts, /Never reword Threadify's output/);
  assert.match(schedule, /Never create one silently/);
  assert.match(schedule, /The schedule's own prompt is never approval/);
});

test('First Followers manifest lists only allowed Brain tools and no send tools', () => {
  assert.ok(manifest.optional_mcp_tools.includes('remember'));
  assert.ok(manifest.optional_mcp_tools.includes('query_brain'));
  assert.ok(manifest.optional_mcp_tools.includes('get_brain_overview'));
  assert.ok(manifest.fallback.instructions.some((line) => /never clicks Post/.test(line)));
});
