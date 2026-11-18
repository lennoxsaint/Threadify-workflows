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
const sameText = (text) => (text ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const longestFixedRun = (skeleton) => skeleton.split(/\[[^\]]*\]/)
  .map((run) => run.replace(/[^\p{L}\p{N}'\s]+/gu, ' ').trim().split(/\s+/).filter(Boolean))
  .reduce((best, run) => (run.length > best.length ? run : best), []);

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
  assert.match(skill, /If the creator sends a post back with a note, change only what the note names and keep the skeleton/);
  assert.match(skill, /flat or boring, or rejects the skeleton, switch to another eligible template/);
  assert.match(skill, /the longest stretch of fixed words between placeholders \(most words; the first on a tie\), as written in the evidence posts/);
  assert.match(skill, /Keep only the returned posts whose text fits the skeleton/);
  assert.match(skill, /no stretch of at least two fixed words, the search cannot find its uses: label it "tired check incomplete"/);
  assert.doesNotMatch(skill, /fixed words up to the first placeholder/);
  assert.match(skill, /`account\.username` with no @; use that same form in every fingerprint and key/);
  assert.match(skill, /at least twice, with two different fills/);
  assert.match(skill, /a reposted or recycled post counts once/);
  assert.match(skill, /only a plug \(a link or a call to action\) that the other evidence posts do not have, the template is the parts they share/);
  assert.match(skill, /never copy the plug/);
  assert.match(skill, /The filled-in words are new: they differ from every evidence post and every use found in the tired check/);
  assert.match(skill, /per evidence post its first line, date, views, media type, part count, fill and whether its text was complete/);
  assert.match(skill, /If `get_post_thread` fails for an evidence post, its text is not read in full: label the template "shape unverified". If it returns no `media_type`, label the template "media unknown"/);
  assert.match(skill, /A reposted copy counts as a use here, because the audience saw it again/);
  assert.match(skill, /ranked at a tenth of that total, rounded down/);
  assert.match(skill, /or that differ only in a number such as an age or a year, are one fill/);
  assert.match(skill, /Each check is pass or fail: "pass with a flag" or "the creator should confirm" is a fail/);
  assert.match(skill, /changing who or what it is about makes a new claim, and that fails/);
  assert.match(skill, /this holds even when more uses may be hidden/);
  assert.match(skill, /recent posts with no text cannot show a use, so they count as missing/);
  const gate = skill.slice(skill.indexOf('6. **'), skill.indexOf('7. **Schedule after the yes.**'));
  assert.match(gate, /its evidence posts: per post its first line, date, views, media type, part count, fill and whether its text was complete/);
  assert.match(gate, /every draft saved so far, by id, each marked proposed, excluded or not picked/);
  for (const line of ['template, its label and its evidence posts: per post its first line, date, views, media type, part count, fill and whether its text was complete',
    'every draft already saved by generation, by id, marked proposed, excluded or not picked']) {
    assert.ok(manifest.approval_gate.must_show.includes(line), line);
  }
  const readme = fs.readFileSync(path.join(root, 'workflows/viral-posts/README.md'), 'utf8');
  assert.match(readme, /It writes text posts only: a template that went viral with a picture or video is shown but left out/);
  assert.match(readme, /except Threadify's validator \(the 500-character rule is checked by hand\)/);
});

test('Viral Posts shows and rechecks the global auto-repost setting and full queued text', () => {
  const skill = fs.readFileSync(source, 'utf8');
  assert.match(skill, /`automation\.global_auto_repost`/);
  assert.match(skill, /it is unknown, never off/);
  const gate = skill.slice(skill.indexOf('6. **'), skill.indexOf('7. **Schedule after the yes.**'));
  assert.match(gate, /the global auto-repost setting exactly as read/);
  assert.match(gate, /This workflow never changes it/);
  assert.match(gate, /nothing can be scheduled until the creator checks it/);
  assert.match(gate, /saved draft <id> keeps the old wording/);
  const step7 = skill.slice(skill.indexOf('7. **Schedule after the yes.**'));
  assert.match(step7, /a changed or unknown setting blocks every post until a new yes/);
  assert.match(step7, /the per-post `auto_repost`; the creator's global auto-repost setting still applies/);
  assert.match(skill, /preview ends in "…" or that has more than one part, call `get_schedule_status` once for its full text/);
  assert.match(skill, /the comparison is unresolved: no post is proposed until it is fetched/);
  assert.match(step7, /at every dispatch, fetch the full text again with `get_schedule_status` for every queued post whose preview ends in "…" or that has more than one part/);
  assert.match(step7, /never reuse text fetched earlier/);
  assert.doesNotMatch(step7, /for any id whose preview or part count changed/);
  assert.match(skill, /Without it, skip `list_viral_items`, `get_viral_item` and every later save/);
  assert.match(skill, /After the drafting yes only, call `list_viral_items`/);
  assert.match(skill, /it is empty only when no tool was called/);
  for (const line of ['global auto-repost setting as read (on with its trigger, off or unknown)', 'each hand-fixed post: the saved draft keeps the old wording']) {
    assert.ok(manifest.approval_gate.must_show.includes(line), line);
  }
  assert.ok(manifest.receipt.must_prove.includes('global auto-repost setting at the gate and at each dispatch'));
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
  assert.match(step7, /Never pass `draft_id`: a saved draft can be edited after the gate, and the tool does not say which text wins/);
  assert.doesNotMatch(skill, /Threadify schedules a draft's stored text/, 'no unproven claim about draft_id');
  assert.match(step7, /`posts` as `\[\{"text": \.\.\.\}\]` objects, one per part in order, or `text` for a single post/);
  assert.match(step7, /`account` as the account from step 1/);
  assert.doesNotMatch(step7, /pass its `draft_id`/);
  assert.match(step7, /as plain strings \(not `\{text\}` objects\)/);
  assert.match(step7, /Leave out `platforms` \(so it goes to Threads only\), `auto_plug` and the per-post `auto_repost`/);
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
    const at = steps.indexOf(`\`${tool}\``, last + 1);
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
      assert.ok(new Set(hits.map((post) => sameText(post.fill))).size >= 2, `${template.template_id} needs two different fills over the top 10% line`);
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
  const names = ['awaiting-approval', 'fallback', 'after-yes', 'drafting-declined', 'fallback-after-error'];
  const receipts = names.map((name) => readJson(`validation/mock-fixtures/viral-posts.${name}.receipt.json`));
  for (const receipt of receipts) {
    assert.ok(validate(receipt), JSON.stringify(validate.errors));
    const line = receipt.top_10_line;
    assert.equal(line.rank, Math.max(1, Math.floor(line.account_post_count / 10)), 'the line is the post at a tenth of the count');
    const used = new Set([...(receipt.checks ?? []), ...(receipt.posts ?? [])].map((row) => row.template_id));
    const labels = ['used', 'eligible', 'unproven', 'tired', 'needs_media', 'media_unknown', 'shape_unverified'];
    for (const template of receipt.templates) {
      assert.ok(labels.includes(template.status), `${template.template_id} has a known label`);
      assert.equal(template.top_10_percent_views, line.views);
      if (template.evidence.some((post) => post.source_complete !== true)) {
        assert.equal(template.status, 'shape_unverified', `${template.template_id} copies a cut-off post`);
      } else if (template.evidence.some((post) => post.media_type === 'unknown')) {
        assert.equal(template.status, 'media_unknown', `${template.template_id} waits for the picture answer`);
      } else if (template.evidence.some((post) => post.media_type !== 'TEXT_POST')) {
        assert.equal(template.status, 'needs_media', `${template.template_id} went viral with media`);
      } else if (new Set(template.evidence.filter((post) => post.views >= line.views).map((post) => sameText(post.fill))).size < 2) {
        assert.equal(template.status, 'unproven', `${template.template_id} hit the top 10% with fewer than two different fills`);
      } else if (template.tired_check?.last_three?.length === 3) {
        const allUnder = template.tired_check.last_three.every((use) => use.views < line.views);
        assert.equal(template.status === 'tired', allUnder, `${template.template_id} is tired exactly when its last three uses fell under the line`);
      }
      if (template.tired_check) assert.equal(template.tired_check.recycled_copies, 'count as uses', 'a reposted copy counts as a use');
      for (const post of template.evidence) {
        for (const key of ['first_line', 'date', 'views', 'media_type', 'part_count', 'fill', 'source_complete']) {
          assert.ok(key in post, `${template.template_id} evidence shows ${key}`);
        }
        if (post.plug_part_left_out) {
          assert.match(template.gate_note ?? '', /plug is not copied/, `${template.template_id} shows the plug at the gate`);
          for (const draft of (receipt.posts ?? []).filter((p) => p.template_id === template.template_id)) {
            assert.ok(draft.parts.length < post.part_count, `${template.template_id} does not copy the plug part`);
          }
        }
      }
      if (template.status !== 'used') assert.ok(!used.has(template.template_id), `${template.template_id} stays out of the batch`);
      for (const flag of template.flags ?? []) assert.equal(flag, 'tired_check_incomplete', 'the only usable flag');
    }
    for (const check of receipt.checks ?? []) {
      assert.equal(check.energy_matches_evidence, true, `${check.template_id} reads at its evidence energy`);
      assert.equal(check.fill_is_new, true, `${check.template_id} does not repeat an evidence or tired-check fill`);
    }
    for (const post of receipt.posts ?? []) {
      const template = receipt.templates.find((t) => t.template_id === post.template_id);
      for (const flag of template.flags ?? []) assert.ok(post.gate_flags?.includes(flag) || post.state !== 'proposed', `${flag} is shown at the gate`);
    }
    for (const slot of receipt.schedule_proposal?.slots ?? []) {
      if (receipt.fallback_used) assert.equal(slot.idempotency_key, undefined, 'a local packet makes no write key');
      else assert.match(slot.idempotency_key, /^viral-posts:[^:@]+:[^:]+:[0-9a-f]{12}$/);
    }
    const account = receipt.account_handle.replace(/^@/, '');
    for (const post of receipt.posts ?? []) {
      const print = crypto.createHash('sha256')
        .update(JSON.stringify([account, post.parts, post.media, post.scheduled_at])).digest('hex');
      assert.equal(post.fingerprint, print, `${post.template_id} fingerprint uses the account with no @`);
      assert.equal(post.idempotency_key, `viral-posts:${account}:${post.template_id}:${print.slice(0, 12)}`, 'the whole key rebuilds');
      if (post.text_source === 'hand_fixed') {
        assert.ok(post.gate_flags?.some((flag) => flag.includes(`saved draft ${post.saved_draft_id} keeps the old wording`)));
      }
      if (post.schedule_call) {
        assert.equal(post.schedule_call.idempotency_key, post.idempotency_key);
        for (const banned of ['platforms', 'auto_plug', 'auto_repost', 'draft_id']) assert.ok(!(banned in post.schedule_call), `no ${banned}`);
        assert.equal(post.schedule_call.account, account, 'the write names the approved account');
        assert.equal(post.schedule_call.content_type, post.parts.length > 1 ? 'long-form' : 'short-form');
        assert.deepEqual(post.schedule_call.posts?.map((part) => part.text) ?? [post.schedule_call.text], post.parts, 'the exact approved text goes by value');
        assert.ok(post.saved_draft_id, 'the draft id stays in the receipt as where the text came from');
      }
    }
    if (!receipt.fallback_used) assert.ok(receipt.global_auto_repost?.read, 'the setting is read in step 1');
    for (const template of receipt.templates.filter((t) => t.status === 'used' || t.status === 'eligible')) {
      if (receipt.fallback_used) continue;
      const run = longestFixedRun(template.skeleton);
      if (run.length >= 2) {
        assert.equal(template.tired_check_query, run.join(' '), `${template.template_id} searches its longest stretch of fixed words`);
      } else {
        assert.equal(template.tired_check_query, null, `${template.template_id} has no stretch search can find`);
        assert.ok(template.flags?.includes('tired_check_incomplete'), `${template.template_id} is flagged tired check incomplete`);
      }
    }
  }
  assert.ok(receipts[0].templates.some((t) => t.status === 'unproven' && t.evidence.filter((post) => post.views >= receipts[0].top_10_line.views).length >= 2),
    'the pending fixture covers a recycled post counted once');
  assert.ok(receipts[0].templates.some((t) => t.evidence.some((post) => post.plug_part_left_out)), 'the pending fixture covers a plug part');
  const tired = receipts[0].templates.find((t) => t.status === 'tired');
  assert.ok(tired, 'the pending fixture covers a tired template');
  assert.ok(new Set(tired.tired_check.last_three.map((use) => sameText(use.fill))).size < 3, 'its last three uses include a reposted copy');
  for (const receipt of [receipts[0], receipts[2]]) {
    const marks = new Map(receipt.gate_drafts.map((draft) => [draft.draft_id, draft.marked]));
    assert.deepEqual([...marks.keys()].sort(), [...receipt.drafts_saved].sort(), 'every saved draft is named at the gate');
    for (const mark of marks.values()) assert.ok(['proposed', 'excluded', 'not_picked'].includes(mark));
    for (const post of receipt.posts.filter((p) => p.saved_draft_id)) {
      assert.notEqual(marks.get(post.saved_draft_id), 'not_picked', `${post.template_id} draft is marked for what it became`);
    }
  }
  assert.ok(receipts[1].templates.some((t) => t.status === 'shape_unverified'), 'the fallback fixture covers a cut-off paste');
  assert.ok(receipts[1].templates.some((t) => t.status === 'media_unknown'), 'the fallback fixture covers an unanswered picture question');
  assert.ok(receipts[0].templates.some((t) => t.status === 'unproven'), 'the pending fixture covers a one-hit shape');
  assert.ok(receipts[0].templates.some((t) => t.status === 'used' && t.flags?.includes('tired_check_incomplete')), 'covers a flagged template');

  const pending = receipts[0];
  assert.ok(pending.global_auto_repost.gate_line.startsWith(pending.global_auto_repost.read.enabled ? 'on:' : 'off'));
  const queue = pending.queue_text_check;
  assert.deepEqual(queue.fetched_full_text, queue.cut_off_or_multi_part, 'every cut-off or multi-part queued post is read in full');
  assert.deepEqual(queue.unresolved, []);
  const collided = new Set(queue.collisions.map((hit) => hit.template_id));
  assert.ok(collided.size > 0, 'covers a post that repeats queued text');
  const slotKeys = new Map(pending.schedule_proposal.slots.map((slot) => [slot.template_id, slot.idempotency_key]));
  for (const post of pending.posts) {
    if (collided.has(post.template_id)) {
      assert.equal(post.state, 'blocked', `${post.template_id} repeats queued text`);
      assert.ok(!slotKeys.has(post.template_id));
      continue;
    }
    assert.equal(post.state, 'proposed');
    assert.equal(post.idempotency_key, slotKeys.get(post.template_id), 'the gate shows the key the yes binds');
  }
  assert.ok(pending.posts.some((post) => post.text_source === 'hand_fixed'), 'covers a hand-fixed post');

  const declined = receipts[3];
  assert.equal(declined.drafting_yes, false);
  assert.deepEqual(declined.drafts_saved, []);
  assert.ok(!declined.posts);
  for (const tool of ['list_viral_items', 'get_viral_item', 'query_brain', 'generate_content', 'schedule_post']) {
    assert.ok(!declined.tool_path.includes(tool), `no ${tool} without the drafting yes`);
  }
  const afterError = receipts[4];
  assert.equal(afterError.fallback_used, true);
  assert.deepEqual(afterError.tool_path, ['get_connection_defaults'], 'the failed call stays in tool_path');
  assert.match(afterError.tool_outcomes[0].outcome, /^error/);

  const after = receipts[2];
  assert.ok(after.drafting_yes);
  assert.deepEqual(after.fingerprint_of, ['account', 'parts', 'media', 'scheduled_at']);
  const print = (post, at = post.scheduled_at) => crypto.createHash('sha256')
    .update(JSON.stringify([after.account_handle.replace(/^@/, ''), post.parts, post.media, at])).digest('hex');
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
      assert.deepEqual(post.auto_repost_at_dispatch, after.global_auto_repost.read, 'the setting at dispatch matches the gate');
      assert.ok(post.scheduled_post_id, 'a scheduled post keeps its returned id');
      assert.ok(confirmed, 'scheduled only after a matching readback');
    } else {
      assert.ok(!confirmed, `${post.state} is never reported as scheduled`);
    }
    if (post.state === 'blocked') assert.ok(!post.scheduled_post_id && post.blocked_reason);
    if (!confirmed) assert.notEqual(post.state, 'scheduled');
  }
  const dispatchChecks = new Map(after.dispatch_queue_checks.map((check) => [check.template_id, check]));
  for (const post of after.posts) {
    const check = dispatchChecks.get(post.template_id);
    assert.ok(check, `${post.template_id} rechecks queued text at dispatch`);
    assert.deepEqual(check.fetched_full_text, check.cut_off_or_multi_part, 'every cut-off or multi-part queued post is read again at dispatch');
    assert.equal(check.reused_earlier_text, false);
    assert.deepEqual(check.unresolved, []);
    if (post.schedule_call) assert.deepEqual(check.collisions, [], `${post.template_id} was written only after a clean fresh check`);
  }
  const edited = after.posts.find((post) => dispatchChecks.get(post.template_id).collisions
    .some((hit) => ['id', 'preview', 'part_count'].every((field) => hit.unchanged_since_gate?.includes(field))));
  assert.equal(edited?.state, 'blocked', 'a later-part edit with the same id, preview and part count still blocks the post');
  assert.ok(!edited.schedule_call);
  assert.ok(!JSON.stringify(after).includes('published'), 'the receipt never says published');
});
