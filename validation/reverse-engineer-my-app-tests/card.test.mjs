import assert from 'node:assert/strict';
import test from 'node:test';
import { checkPosts, lowercasePosts } from '../../plugins/threadify/skills/threadify-reverse-engineer-my-app/scripts/casing-guard.mjs';
import { PLUG_DELAY_MINUTES, buildCard, buildReceipt, checkReadback, scheduleArgs } from '../../plugins/threadify/skills/threadify-reverse-engineer-my-app/scripts/app-card.mjs';

const KEEP = ['BoardKit', 'PDF', 'I'];
const ORIGINALS = [
  'I Built One-Tap Export Into BoardKit. Any Board Becomes A PDF.',
  'Why I Built Dark Mode: My Eyes At 2am.',
  'Jumping Between Boards Was Slow. Now 12 Shortcuts Do It.',
  'When The Network Drops, BoardKit Keeps Your Draft Open.',
  'BoardKit Ships With 8 Templates.',
  'Anyone Can X-Ray An App Now. Building Is Cheap, Distribution Is Expensive.',
  'Which Card Do You Search For Most?',
];
const lower = (text) => lowercasePosts({ posts: [{ original: text, keep: KEEP }] }).posts[0].final;
const PLUG_ORIGINAL = 'Jumping Between Boards All Day? BoardKit Puts 12 Shortcuts Under Your Fingers. Join 2,013+ Creators - 7-Day Free Trial: https://app.example.com/start';
const PLUG_FINAL = lower(PLUG_ORIGINAL);
const TEMPLATE = { source: 'viral', skeleton: '{group} are like "{cliche}!" no it\'s not. {proof}' };

function plan(overrides = {}) {
  return {
    account: '@owner',
    timezone: 'Australia/Perth',
    now: '2026-10-13T00:00:00Z',
    ownership: 'yes',
    app: { name: 'BoardKit', source: 'rea', features: 8, observed_at: '2026-10-13T02:00:00Z', map_sha256: 'f'.repeat(64) },
    posts: ORIGINALS.map((original, index) => ({
      original,
      final: lower(original),
      keep: KEEP,
      draft_id: `draft-${index + 1}`,
      model: 'claude-opus-5-5',
      feature_id: `F${index + 1}`,
      feature_name: `feature ${index + 1}`,
      angle: `angle_${index + 1}`,
      angle_label: `angle ${index + 1}`,
      fact_check: 'PASS',
      validated: true,
      slot: { iso: `2026-10-${String(14 + index).padStart(2, '0')}T18:30:00+08:00`, local: `day ${index + 1}, 6:30 pm` },
      template: TEMPLATE,
      auto_plug: { original: PLUG_ORIGINAL, final: PLUG_FINAL, keep: KEEP, destination: 'https://app.example.com/start', validated: true, plug_check: 'PASS' },
    })),
    ...overrides,
  };
}

test('the casing guard proves lower(original) == lower(final) for every post and rejects rewording', () => {
  const result = checkPosts({ posts: ORIGINALS.map((original) => ({ original, final: lower(original), keep: KEEP })) });
  assert.equal(result.status, 'PASS');
  assert.ok(result.posts.every((post) => post.lower_equal));
  assert.equal(lower(ORIGINALS[0]), 'I built one-tap export into BoardKit. any board becomes a PDF.');
  const reworded = checkPosts({ posts: [{ original: ORIGINALS[0], final: lower(ORIGINALS[0]).replace('built', 'made') }] });
  assert.equal(reworded.status, 'FAIL');
  const properNoun = checkPosts({ posts: [{ original: ORIGINALS[4], final: ORIGINALS[4].toLowerCase(), keep: KEEP }] });
  assert.deepEqual(properNoun.posts[0].reasons, ['proper_noun_lowercased:BoardKit']);
});

test('the card stays blocked until every proof is in', () => {
  assert.match(buildCard(plan({ ownership: 'no' })).missing.join(' '), /ownership question/);
  assert.match(buildCard(plan({ posts: plan().posts.slice(0, 6) })).missing.join(' '), /exactly 7 posts \(got 6\)/);
  const unchecked = plan();
  unchecked.posts[2].fact_check = 'FAIL';
  assert.match(buildCard(unchecked).missing.join(' '), /post 3: the fact check/);
  const reworded = plan();
  reworded.posts[0].final = `${reworded.posts[0].final} extra.`;
  assert.match(buildCard(reworded).missing.join(' '), /post 1: the casing guard failed/);
  const sameDay = plan();
  sameDay.posts[1].slot = { iso: '2026-10-14T20:30:00+08:00', local: 'x' };
  assert.match(buildCard(sameDay).missing.join(' '), /7 different days/);
  const past = plan();
  past.posts[0].slot = { iso: '2026-10-12T18:30:00+08:00', local: 'x' };
  assert.match(buildCard(past).missing.join(' '), /post 1: a time in the future/);
  const noPlug = plan();
  delete noPlug.posts[4].auto_plug;
  assert.match(buildCard(noPlug).missing.join(' '), /post 5: its Auto Plug/);
});

test('the ready card shows all seven exact posts, plugs, times and the action', () => {
  const ready = buildCard(plan());
  assert.equal(ready.status, 'ready');
  const lines = ready.card.split('\n');
  assert.equal(lines[0], 'Reverse Engineer My App · @owner · Australia/Perth');
  assert.equal(lines[1], 'App: BoardKit · mapped from REA, logged out · 8 features with evidence · observed 2026-10-13');
  assert.match(ready.card, /Ownership: you said yes, you own this app or have written permission to analyse it/);
  for (const original of ORIGINALS) assert.ok(ready.card.includes(lower(original)));
  assert.equal(ready.card.split(`Auto Plug, 50 min after (lowercased, casing guard PASS, plug check PASS): ${PLUG_FINAL}`).length - 1, 7);
  assert.equal(ready.card.match(/written by Threadify \(model claude-opus-5-5\) · facts PASS · lowercased, casing guard PASS/g).length, 7);
  assert.match(ready.card, /7\) day 7, 6:30 pm · 2026-10-20T18:30:00\+08:00 · angle 7 · F7: feature 7/);
  assert.match(ready.card, /Reply "yes" to schedule all 7, or "no" to schedule nothing\.$/);
  assert.ok(!ready.card.includes('—'), 'no em dashes');
  const without = buildCard(plan({ auto_plug_unavailable: 'Auto Plug is not on this plan' }));
  assert.equal(without.card.match(/Auto Plug: none \(Auto Plug is not on this plan\)/g).length, 7);
});

test('nothing is scheduled without the exact "yes" to the unchanged card', () => {
  const current = plan();
  const { card_sha256: hash } = buildCard(current);
  for (const reply of ['no', 'ok', 'sure', 'yes please', 'yes but change day 3', '', undefined]) {
    const result = scheduleArgs({ plan: current, card_sha256: hash, reply });
    assert.equal(result.status, 'not_approved', `${reply} must not schedule`);
    assert.equal(result.schedule_post, undefined);
  }
  const moved = plan();
  moved.posts[3].slot = { ...moved.posts[3].slot, iso: '2026-10-17T20:30:00+08:00' };
  assert.equal(scheduleArgs({ plan: moved, card_sha256: hash, reply: 'yes' }).status, 'card_changed');
  assert.equal(scheduleArgs({ plan: plan({ ownership: 'no' }), card_sha256: hash, reply: 'yes' }).status, 'blocked');
  const approved = scheduleArgs({ plan: current, card_sha256: hash, reply: 'yes' });
  assert.equal(approved.status, 'approved');
  assert.equal(approved.schedule_post.length, 7);
  for (const [index, call] of approved.schedule_post.entries()) {
    assert.equal(call.text, current.posts[index].final, 'lowercased copy goes as exact text');
    assert.equal(call.draft_id, undefined);
    assert.deepEqual(call.auto_plug, { content: PLUG_FINAL, trigger: 'time', delay_minutes: PLUG_DELAY_MINUTES });
    assert.equal(call.platforms, undefined);
    assert.equal(call.auto_repost, undefined);
    assert.match(call.idempotency_key, /^reverse-engineer-my-app-[0-9a-f]{32}$/);
  }
  assert.equal(new Set(approved.schedule_post.map((call) => call.idempotency_key)).size, 7);
  assert.equal(PLUG_DELAY_MINUTES, 50, 'same Auto Plug delay as Monetize My Week');
});

test('every row is read back, and the receipt holds no post text', () => {
  const current = plan();
  const statuses = current.posts.map((post) => ({ text: post.final, scheduled_at: post.slot.iso, auto_plug: { content: PLUG_FINAL, delay_minutes: 50 }, status: 'scheduled' }));
  const match = checkReadback({ plan: current, statuses });
  assert.equal(match.status, 'MATCH');
  const bad = statuses.map((status) => ({ ...status }));
  bad[2] = { text: 'something else', scheduled_at: '2026-10-16T19:30:00+08:00', status: 'scheduled' };
  const mismatch = checkReadback({ plan: current, statuses: bad });
  assert.equal(mismatch.status, 'MISMATCH');
  assert.deepEqual(mismatch.rows[2].differences, ['text', 'time', 'auto_plug_missing']);
  assert.equal(checkReadback({ plan: current, statuses: statuses.slice(0, 6) }).status, 'MISMATCH', 'a missing readback is not a match');
  for (const state of ['failed', 'cancelled', undefined]) {
    const echoed = statuses.map((status) => ({ ...status }));
    echoed[4] = { ...echoed[4], status: state };
    const result = checkReadback({ plan: current, statuses: echoed });
    assert.equal(result.status, 'MISMATCH', `a ${state ?? 'missing'} provider state is not a match even when the text echoes`);
    assert.deepEqual(result.rows[4].differences, [`provider_status:${state ?? 'missing'}`]);
  }
  const receipt = buildReceipt({ plan: current, card_sha256: buildCard(current).card_sha256, reply: 'yes', scheduled_post_ids: current.posts.map((_, index) => `sched-${index + 1}`), readback: match });
  assert.equal(receipt.approval, 'yes');
  assert.equal(receipt.ownership, 'owner_confirmed');
  assert.equal(receipt.posts.length, 7);
  assert.equal(receipt.posts[0].model, 'claude-opus-5-5');
  assert.equal(receipt.raw_bodies_retained_in_receipt, false);
  const serialized = JSON.stringify(receipt);
  for (const original of ORIGINALS) assert.ok(!serialized.includes(lower(original)), 'body-free');
  assert.ok(!serialized.includes(PLUG_FINAL));
  const refused = buildReceipt({ plan: current, reply: 'no' });
  assert.equal(refused.action, 'none');
  assert.ok(refused.posts.every((post) => post.scheduled_at === null));
});
