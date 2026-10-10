import assert from 'node:assert/strict';
import test from 'node:test';
import { checkPosts, lowercasePosts } from '../../plugins/threadify/skills/threadify-watch-any-creator/scripts/casing-guard.mjs';
import { buildCard, buildReceipt, checkReadback, scheduleArgs } from '../../plugins/threadify/skills/threadify-watch-any-creator/scripts/watch-card.mjs';

const ORIGINAL = 'I had Claude watch 5,000 videos from @SomeCreator. Rule 1: Put A Number In The Title.';

function plan(overrides = {}) {
  const lowered = lowercasePosts({ posts: [{ id: 'post', original: ORIGINAL, keep: ['Claude', 'I'] }] }).posts[0].final;
  return {
    account: '@owner',
    timezone: 'Australia/Perth',
    now: '2026-10-10T00:00:00Z',
    watched: { creator: '@SomeCreator', videos: 5000, long: 524, shorts: 4476, transcripts: 524, observed_at: '2026-10-10T00:00:00Z', provider: 'scrapecreators' },
    thread: { draft_id: 'draft-thread', post_count: 10, thread_sha256: 'abc', readback: 'match', structure: 'PASS' },
    post: { original: ORIGINAL, final: lowered, keep: ['Claude', 'I'], draft_id: 'draft-post', validated: true },
    auto_plug: { original: 'Grab The Kit', final: 'grab the kit', destination: 'https://example.com/kit', validated: true },
    slot: { iso: '2026-10-11T18:30:00+08:00', local: 'Sun 11 Oct, 6:30 pm' },
    ...overrides,
  };
}

test('the casing guard proves lower(original) == lower(final) and rejects a reworded post', () => {
  const lowered = lowercasePosts({ posts: [{ id: 'post', original: ORIGINAL, keep: ['Claude'] }] });
  assert.equal(lowered.status, 'PASS');
  assert.equal(lowered.posts[0].lower_equal, true);
  assert.match(lowered.posts[0].final, /^i had Claude watch 5,000 videos from @SomeCreator\. rule 1: put a number in the title\.$/);
  const thread = ['Hook Post', '1. Rule\n\ncopy this: [X]'];
  assert.equal(checkPosts({ posts: [{ original: thread, final: thread.map((text) => text.toLowerCase()) }] }).status, 'PASS');
  const reworded = checkPosts({ posts: [{ original: ORIGINAL, final: ORIGINAL.replace('watch', 'see') }] });
  assert.equal(reworded.status, 'FAIL');
  assert.equal(reworded.posts[0].lower_equal, false);
  const handle = checkPosts({ posts: [{ original: ORIGINAL, final: ORIGINAL.replace('@SomeCreator', '@somecreator') }] });
  assert.equal(handle.status, 'FAIL', 'handles keep their exact casing');
});

test('the card is blocked until every proof is in, then shows the exact post', () => {
  assert.equal(buildCard(plan({ thread: { draft_id: 'd', post_count: 10, readback: 'differs', structure: 'PASS' } })).status, 'blocked');
  assert.match(buildCard(plan({ slot: { iso: '2026-10-11 18:30', local: 'x' } })).missing.join(' '), /ISO with the timezone offset/);
  assert.match(buildCard(plan({ slot: { iso: '2026-10-09T18:30:00+08:00', local: 'x' } })).missing.join(' '), /a time in the future/);
  assert.match(buildCard(plan({ post: { original: ORIGINAL, final: `${ORIGINAL} Extra.`, validated: true } })).missing.join(' '), /casing guard failed/);
  assert.match(buildCard(plan({ auto_plug: undefined })).missing.join(' '), /Auto Plug decision/);
  const ready = buildCard(plan());
  assert.equal(ready.status, 'ready');
  assert.equal(ready.card.split('\n')[0], 'Watch Any Creator · @owner · Australia/Perth');
  assert.match(ready.card, /Watched: @SomeCreator · 5,000 videos \(524 long-form, 4,476 Shorts\) · 524 transcripts · observed 2026-10-10/);
  assert.match(ready.card, /Thread: 10 posts saved as a Threadify draft, read back, not scheduled/);
  assert.match(ready.card, /Post, written by Threadify \(lowercased, casing guard PASS: lower\(original\) == lower\(final\)\):/);
  assert.match(ready.card, /Auto Plug, 15 min after \(lowercased, casing guard PASS/);
  assert.match(ready.card, /When: Sun 11 Oct, 6:30 pm · 2026-10-11T18:30:00\+08:00 \(Australia\/Perth\)/);
  assert.match(ready.card, /Reply "yes" to schedule it, or "no" to schedule nothing\.$/);
  const noPlug = buildCard(plan({ auto_plug: { unavailable: 'Auto Plug is not on this plan' } }));
  assert.match(noPlug.card, /\nAuto Plug: none \(Auto Plug is not on this plan\)\n/);
});

test('only the exact "yes" to the unchanged card returns schedule_post arguments', () => {
  const current = plan();
  const { card_sha256: hash } = buildCard(current);
  for (const reply of ['ok', 'sure', 'yes please', '', undefined]) assert.equal(scheduleArgs({ plan: current, card_sha256: hash, reply }).status, 'not_approved');
  assert.equal(scheduleArgs({ plan: { ...current, slot: { ...current.slot, iso: '2026-10-11T20:30:00+08:00' } }, card_sha256: hash, reply: 'yes' }).status, 'card_changed');
  const approved = scheduleArgs({ plan: current, card_sha256: hash, reply: ' Yes ' });
  assert.equal(approved.status, 'approved');
  const args = approved.schedule_post;
  assert.equal(args.text, current.post.final, 'lowercased copy goes as exact text');
  assert.equal(args.draft_id, undefined, 'never the draft_id for changed text');
  assert.deepEqual(args.auto_plug, { content: 'grab the kit', trigger: 'time', delay_minutes: 15 });
  assert.equal(args.scheduled_at, '2026-10-11T18:30:00+08:00');
  assert.match(args.idempotency_key, /^watch-any-creator-[0-9a-f]{32}$/);
  assert.equal(args.platforms, undefined);
  assert.equal(args.auto_repost, undefined);
  const unchangedPlan = plan({ post: { original: ORIGINAL, final: ORIGINAL, draft_id: 'draft-post', validated: true } });
  const unchanged = scheduleArgs({ plan: unchangedPlan, card_sha256: buildCard(unchangedPlan).card_sha256, reply: 'yes' }).schedule_post;
  assert.equal(unchanged.draft_id, 'draft-post');
  assert.equal(unchanged.content_type, 'short-form');
  assert.equal(unchanged.text, undefined);
});

test('the readback must match the card, and the receipt holds no post text', () => {
  const current = plan();
  const match = checkReadback({ plan: current, status: { text: current.post.final, scheduled_at: '2026-10-11T10:30:00Z', auto_plug: { content: 'grab the kit' }, status: 'scheduled' } });
  assert.deepEqual(match, { status: 'MATCH', differences: [], provider_status: 'scheduled' });
  const mismatch = checkReadback({ plan: current, status: { text: ORIGINAL, scheduled_at: '2026-10-11T11:30:00Z' } });
  assert.deepEqual(mismatch.differences, ['text', 'time', 'auto_plug_missing']);
  const receipt = buildReceipt({ plan: current, card_sha256: buildCard(current).card_sha256, reply: 'yes', scheduled_post_id: 'sched-1', readback: match, rule_ids: ['youtube_long:title_number'] });
  assert.equal(receipt.approval, 'yes');
  assert.equal(receipt.thread.scheduled, false);
  assert.equal(receipt.readback, 'MATCH');
  assert.equal(receipt.raw_bodies_retained_in_receipt, false);
  const serialized = JSON.stringify(receipt);
  assert.ok(!serialized.includes('watch 5,000 videos') && !serialized.includes('grab the kit'), 'body-free');
  assert.equal(buildReceipt({ plan: current, reply: 'no' }).action, 'none');
});
