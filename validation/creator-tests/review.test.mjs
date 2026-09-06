import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewPack, displayReview, approveReview, replaceCard, beginAttempt, reconcileAttempt } from '../../lib/creator/review.mjs';

const now = '2026-09-07T00:00:00Z';
const card = (id) => ({
  id, account_id: 'creator-1', timezone: 'Australia/Perth',
  scheduled_at: '2026-09-08T09:00:00+08:00', parts: [`Synthetic ${id}`], media: [],
  source: { id: `source-${id}`, url: 'https://example.com/source' },
  adaptation_mode: 'structure_only', gaps: [], draft_id: `draft-${id}`,
  method: 'host_authored', format: 'short_form', cta: 'none',
});
const pack = () => createReviewPack({ id: 'day-1', cards: [card('a'), card('b')], now });
const approved = () => {
  const p = pack(); return approveReview(p, displayReview(p), { evidence_ref: 'synthetic-owner-approval', at: now });
};
const gates = (p, id = 'a') => ({
  card_hash: displayReview(p, [id]).cards[0].hash,
  checked_at: now, valid_until: '2026-09-07T00:05:00Z',
  account_id: 'creator-1', timezone: 'Australia/Perth',
  facts: true, offers: true, source_availability: true, validation: true, calendar: true, timezone_offset: true,
  evidence_ref: 'synthetic-fresh-provider-read', occupied_instants: [],
});
const receipt = (p, id = 'a') => ({
  status: 'scheduled', provider_ref: `schedule-${id}`, checked_at: '2026-09-07T00:00:01Z',
  authoritative: true, evidence_ref: 'synthetic-schedule-readback',
  ...structuredClone(p.cards.find((c) => c.content.id === id).content),
});

test('batch approval binds the full displayed cards; individual review remains optional', () => {
  const p = pack(); const view = displayReview(p);
  assert.equal(view.cards.length, 2);
  const result = approveReview(p, view, { evidence_ref: 'owner', at: now });
  assert.ok(result.cards.every((c) => c.state === 'approved'));
  assert.ok(p.cards.every((c) => c.state === 'draft'));
  const single = approveReview(p, displayReview(p, ['b']), { evidence_ref: 'owner', at: now });
  assert.deepEqual(single.cards.map((c) => c.state), ['draft', 'approved']);
});

test('copy, source, media, account, timezone, time and gaps changes invalidate only that card', () => {
  const changes = [
    (c) => { c.parts[0] += ' changed'; }, (c) => { c.source.url += '/other'; },
    (c) => { c.media.push('https://example.com/image.png'); },
    (c) => { c.account_id = 'creator-2'; }, (c) => { c.timezone = 'Europe/London'; },
    (c) => { c.scheduled_at = '2026-09-08T10:00:00+08:00'; },
    (c) => { c.gaps.push('Changed claim evidence'); },
  ];
  for (const change of changes) {
    const p = approved(); const c = card('a'); change(c);
    const next = replaceCard(p, c);
    assert.deepEqual(next.cards.map((x) => x.state), ['draft', 'approved']);
    assert.equal(next.cards[0].approval, null);
    assert.throws(() => approveReview(next, displayReview(p), { evidence_ref: 'owner', at: now }), /changed/);
  }
});

test('mutated or incomplete displays cannot authorize a batch', () => {
  const p = pack(); const view = displayReview(p); view.cards[0].content.parts = ['Tampered'];
  assert.throws(() => approveReview(p, view, { evidence_ref: 'owner', at: now }), /display/);
  assert.throws(() => displayReview(p, ['a', 'a']), /unique/);
  assert.throws(() => approveReview(p, displayReview(p), { at: now }), /evidence/);
});

test('pending attempts block edits and retries across interruption; exact receipts preserve successes', () => {
  const p = approved(); const pending = beginAttempt(p, 'a', gates(p), now);
  assert.equal(pending.cards[0].state, 'attempt_pending');
  const restored = JSON.parse(JSON.stringify(pending));
  assert.throws(() => beginAttempt(restored, 'a', gates(p), now), /reconcile/);
  assert.throws(() => replaceCard(restored, card('a')), /delivery/);
  const scheduled = reconcileAttempt(restored, 'a', receipt(restored));
  assert.deepEqual(scheduled.cards.map((c) => c.state), ['scheduled', 'approved']);
  assert.throws(() => beginAttempt(scheduled, 'a', gates(p), now), /reconcile/);
  assert.equal(scheduled.cards[0].attempts[0].outcome, 'scheduled');
  assert.notEqual(scheduled.cards[0].state, 'published');
});

test('unknown results remain unresolved; definitive absence permits a retry with the same key', () => {
  const p = approved(); const pending = beginAttempt(p, 'a', gates(p), now);
  const uncertain = reconcileAttempt(pending, 'a', { status: 'unknown', evidence_ref: 'timeout' });
  assert.throws(() => beginAttempt(uncertain, 'a', gates(p), now), /reconcile/);
  assert.throws(() => reconcileAttempt(uncertain, 'a', { status: 'not_found', evidence_ref: 'unverified' }), /authoritative/);
  const absent = reconcileAttempt(uncertain, 'a', { status: 'not_found', authoritative: true, evidence_ref: 'provider-reconciliation', checked_at: '2026-09-07T00:00:01Z', account_id: 'creator-1', idempotency_key: uncertain.cards[0].attempts[0].idempotency_key });
  const retried = beginAttempt(absent, 'a', gates(p), '2026-09-07T00:00:02Z');
  assert.equal(retried.cards[0].attempts[0].idempotency_key, retried.cards[0].attempts[1].idempotency_key);
  assert.equal(retried.cards[0].attempts.length, 2);
});

test('mismatching schedule readback never becomes scheduled', () => {
  for (const field of ['account_id', 'draft_id', 'scheduled_at', 'parts', 'media']) {
    const p = approved(); const pending = beginAttempt(p, 'a', gates(p), now);
    const bad = receipt(pending); bad[field] = field === 'parts' || field === 'media' ? ['wrong'] : 'wrong';
    assert.throws(() => reconcileAttempt(pending, 'a', bad), /match/);
    assert.equal(pending.cards[0].state, 'attempt_pending');
  }
});

test('scheduling needs approval, a real draft and all fresh matching gates; occupied slots block', () => {
  assert.throws(() => beginAttempt(pack(), 'a', gates(pack()), now), /approval/);
  const p = approved();
  for (const field of ['facts', 'offers', 'source_availability', 'validation', 'calendar', 'timezone_offset']) {
    const preflight = gates(p); preflight[field] = false;
    assert.throws(() => beginAttempt(p, 'a', preflight, now), /preflight/);
  }
  const stale = gates(p); stale.valid_until = now;
  assert.throws(() => beginAttempt(p, 'a', stale, now), /fresh/i);
  const occupied = gates(p); occupied.occupied_instants = ['2026-09-08T01:00:00Z'];
  assert.throws(() => beginAttempt(p, 'a', occupied, now), /occupied/);
  const local = pack(); local.cards[0].content.draft_id = null;
  const localApproved = approveReview(local, displayReview(local), { evidence_ref: 'owner', at: now });
  assert.throws(() => beginAttempt(localApproved, 'a', gates(localApproved), now), /draft/);
});
