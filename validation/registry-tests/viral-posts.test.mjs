import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
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
  assert.match(skill, /three most recent uses by date/);
  assert.match(skill, /Label it "tired"/);
  assert.match(skill, /10 most recent posts with view counts/);
  assert.match(skill, /"tired check incomplete"/);
  assert.match(skill, /Only a clear yes passes/);
  assert.match(skill, /read in full: every part of a thread, no cut-off text/);
  assert.match(skill, /Label the template "needs media"/);
  assert.match(skill, /sort_by: "recent"/);
  assert.match(skill, /give it only the post text/);
  assert.match(skill, /ranked at a tenth of that total/);
  assert.match(skill, /"media unknown"/);
  assert.match(skill, /reads at the energy of its evidence posts/);
  assert.match(skill, /A shape seen only in the library is "unproven" for this creator/);
  assert.doesNotMatch(skill, /library post with clear engagement/);
  assert.match(skill, /Leave out every template labelled unproven, tired, needs media, media unknown or shape unverified/);
  assert.match(skill, /"tired check incomplete" template may be used only with that flag shown next to it at the gate/);
  assert.match(skill, /a tenth of that count, rounded down/);
  assert.match(skill, /Writing it again needs a new drafting yes/);
  assert.doesNotMatch(skill, /fix it \(or write it again\)/);
});

test('Viral Posts discloses saves before drafting and guards the write after the yes', () => {
  const skill = fs.readFileSync(source, 'utf8');
  const saves = skill.indexOf('## What the run saves before any schedule');
  assert.ok(saves > 0 && saves < skill.indexOf('## Steps'), 'saves are disclosed before the steps');
  assert.match(skill, /saves one draft and one chat in the account and uses one generation/);
  assert.match(skill, /uses one viral allowance/);
  assert.match(skill, /it never covers scheduling/);
  const step7 = skill.slice(skill.indexOf('7. **Schedule after the yes.**'));
  const recheck = step7.indexOf('**Recheck.**');
  const intent = step7.indexOf('**Save the intent first.**');
  const write = step7.indexOf('`schedule_post`');
  assert.ok(recheck >= 0 && recheck < intent && intent < write, 'recheck and saved intent come before the write');
  assert.match(step7, /`list_scheduled_posts` again for the window/);
  assert.match(step7, /Never move an approved time yourself/);
  assert.match(step7, /the approved time as an ISO instant/);
  assert.match(step7, /`\[account, parts, media, scheduled_at\]` \(as `JSON\.stringify` writes it\)/);
  assert.match(step7, /they must equal what the gate showed/);
  assert.match(step7, /without `draft_id`, because Threadify schedules a draft's stored text/);
  assert.match(step7, /Leave out `platforms`, `auto_plug` and `auto_repost`/);
  const gate = skill.slice(skill.indexOf('6. **'), skill.indexOf('7. **Schedule after the yes.**'));
  assert.match(gate, /fingerprint and stable idempotency key/, 'the gate shows what the yes binds');
  assert.match(step7, /the result is unknown/);
  assert.match(step7, /its status shows the post queued/);
  assert.match(skill, /label that template "shape unverified" and leave it out of the batch/);
});

test('Viral Posts keeps the tool order, calendar check and approval gate', () => {
  const skill = fs.readFileSync(source, 'utf8');
  const steps = skill.slice(skill.indexOf('## Steps'));
  const order = ['get_connection_defaults', 'greatest_hits', 'get_post_thread', 'list_viral_items', 'query_brain',
    'generate_content', 'validate_post', 'best_time_to_post', 'list_scheduled_posts', 'schedule_post', 'get_schedule_status'];
  let last = -1;
  for (const tool of order) {
    const at = steps.indexOf(`\`${tool}\``);
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
    for (const template of receipt.templates.filter((t) => t.status === 'used')) {
      const hits = template.evidence.filter((post) => post.views >= receipt.top_10_line.views);
      assert.ok(hits.length >= 2, `${template.template_id} needs two evidence posts over the top 10% line`);
    }
  }
  assert.equal(pending.status, 'awaiting_approval');
  assert.deepEqual(pending.approved_text, []);
  assert.ok(!pending.tool_path.includes('schedule_post'), 'nothing is scheduled before the yes');
  assert.equal(pending.schedule_proposal.calendar_listed, pending.schedule_proposal.calendar_total_in_window);
  assert.equal(fallback.fallback_used, true);
  assert.deepEqual(fallback.tool_path, []);
});

test('Viral Posts fixtures keep cut-off, media, stale-calendar and unknown-write cases blocked or unverified', () => {
  const validate = new Ajv({ strict: false }).compile(readJson('schemas/workflow-receipt.v1.json'));
  const names = ['awaiting-approval', 'fallback', 'after-yes'];
  const receipts = names.map((name) => readJson(`validation/mock-fixtures/viral-posts.${name}.receipt.json`));
  for (const receipt of receipts) {
    assert.ok(validate(receipt), JSON.stringify(validate.errors));
    const line = receipt.top_10_line;
    assert.equal(line.rank, Math.max(1, Math.floor(line.account_post_count / 10)), 'the line is the post at a tenth of the count');
    const used = new Set([...(receipt.checks ?? []), ...(receipt.posts ?? [])].map((row) => row.template_id));
    const labels = ['used', 'unproven', 'tired', 'needs_media', 'media_unknown', 'shape_unverified'];
    for (const template of receipt.templates) {
      assert.ok(labels.includes(template.status), `${template.template_id} has a known label`);
      assert.equal(template.top_10_percent_views, line.views);
      if (template.evidence.some((post) => post.source_complete !== true)) {
        assert.equal(template.status, 'shape_unverified', `${template.template_id} copies a cut-off post`);
      } else if (template.evidence.some((post) => post.media_type === 'unknown')) {
        assert.equal(template.status, 'media_unknown', `${template.template_id} waits for the picture answer`);
      } else if (template.evidence.some((post) => post.media_type !== 'TEXT_POST')) {
        assert.equal(template.status, 'needs_media', `${template.template_id} went viral with media`);
      } else if (template.evidence.filter((post) => post.views >= line.views).length < 2) {
        assert.equal(template.status, 'unproven', `${template.template_id} hit the top 10% less than twice`);
      }
      if (template.status !== 'used') assert.ok(!used.has(template.template_id), `${template.template_id} stays out of the batch`);
      for (const flag of template.flags ?? []) assert.equal(flag, 'tired_check_incomplete', 'the only usable flag');
    }
    for (const check of receipt.checks ?? []) assert.equal(check.energy_matches_evidence, true, `${check.template_id} reads at its evidence energy`);
    for (const post of receipt.posts ?? []) {
      const template = receipt.templates.find((t) => t.template_id === post.template_id);
      for (const flag of template.flags ?? []) assert.ok(post.gate_flags?.includes(flag) || post.state !== 'proposed', `${flag} is shown at the gate`);
    }
    for (const slot of receipt.schedule_proposal?.slots ?? []) {
      if (receipt.fallback_used) assert.equal(slot.idempotency_key, undefined, 'a local packet makes no write key');
      else assert.match(slot.idempotency_key, /^viral-posts:[^:]+:[^:]+:[0-9a-f]{12}$/);
    }
  }
  assert.ok(receipts[1].templates.some((t) => t.status === 'shape_unverified'), 'the fallback fixture covers a cut-off paste');
  assert.ok(receipts[1].templates.some((t) => t.status === 'media_unknown'), 'the fallback fixture covers an unanswered picture question');
  assert.ok(receipts[0].templates.some((t) => t.status === 'unproven'), 'the pending fixture covers a one-hit shape');
  assert.ok(receipts[0].templates.some((t) => t.status === 'used' && t.flags?.includes('tired_check_incomplete')), 'covers a flagged template');

  const pending = receipts[0];
  const slotKeys = new Map(pending.schedule_proposal.slots.map((slot) => [slot.template_id, slot.idempotency_key]));
  for (const post of pending.posts) {
    assert.equal(post.state, 'proposed');
    const gatePrint = crypto.createHash('sha256')
      .update(JSON.stringify([pending.account_handle, post.parts, post.media, post.scheduled_at])).digest('hex');
    assert.equal(post.fingerprint, gatePrint, 'the gate shows the fingerprint the yes binds');
    assert.equal(post.idempotency_key, slotKeys.get(post.template_id));
    assert.ok(post.idempotency_key.endsWith(`:${gatePrint.slice(0, 12)}`));
  }

  const after = receipts[2];
  assert.ok(after.drafting_yes);
  assert.deepEqual(after.fingerprint_of, ['account', 'parts', 'media', 'scheduled_at']);
  const print = (post, at = post.scheduled_at) => crypto.createHash('sha256')
    .update(JSON.stringify([after.account_handle, post.parts, post.media, at])).digest('hex');
  const states = new Set(after.posts.map((post) => post.state));
  for (const state of ['scheduled', 'blocked', 'schedule_unverified']) assert.ok(states.has(state), `covers ${state}`);
  assert.ok(after.templates.some((t) => t.status === 'needs_media'), 'covers a media template');
  for (const post of after.posts) {
    assert.equal(post.fingerprint, print(post), `${post.template_id} fingerprint binds account, parts, media and time`);
    assert.ok(post.idempotency_key.endsWith(`:${post.fingerprint.slice(0, 12)}`));
    const moved = new Date(Date.parse(post.scheduled_at) + 3600e3).toISOString();
    assert.notEqual(print(post, moved).slice(0, 12), post.fingerprint.slice(0, 12), 'a new time makes a new key');
    const confirmed = post.readback?.status === 'scheduled' && post.readback.account_matches
      && post.readback.text_matches && post.readback.time_matches;
    if (post.state === 'scheduled') {
      assert.ok(post.scheduled_post_id, 'a scheduled post keeps its returned id');
      assert.ok(confirmed, 'scheduled only after a matching readback');
    } else {
      assert.ok(!confirmed, `${post.state} is never reported as scheduled`);
    }
    if (post.state === 'blocked') assert.ok(!post.scheduled_post_id && post.blocked_reason);
    if (!confirmed) assert.notEqual(post.state, 'scheduled');
  }
  assert.ok(!JSON.stringify(after).includes('published'), 'the receipt never says published');
});
