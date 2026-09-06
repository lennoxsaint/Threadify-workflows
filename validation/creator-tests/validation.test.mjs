import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewPack, displayReview, approveReview, replaceCard, recordValidation, beginAttempt } from '../../lib/creator/review.mjs';
const now = '2026-09-07T00:00:00Z';
const content = (id) => ({ id, account_id: 'synthetic-creator', timezone: 'UTC',
  scheduled_at: '2026-09-08T09:00:00Z', parts: ['Synthetic copy'], media: [], gaps: [],
  source: { id: 'source', url: 'https://example.com/source' }, adaptation_mode: 'structure_only',
  method: 'host_authored', draft_id: null });
const pack = () => createReviewPack({ id: 'review', cards: [content('a'), content('b')], now });
const receipt = (p, extra = {}) => ({ id: 'validation-1', card_hash: displayReview(p, ['a']).cards[0].hash,
  account_id: 'synthetic-creator', kind: 'local', status: 'passed', checked_at: now,
  valid_until: '2026-09-07T00:05:00Z', evidence_ref: 'synthetic-local-check', issues: [], ...extra });
const approve = (p) => approveReview(p, displayReview(p), { at: now, evidence_ref: 'synthetic-owner' });

test('validation is evidenced, distinct from approval, and local checks never claim provider validation', () => {
  const p = pack(); const validated = recordValidation(p, 'a', receipt(p), now);
  assert.deepEqual(validated.cards.map((c) => c.state), ['validated', 'draft']);
  assert.equal(validated.cards[0].validation.kind, 'local');
  assert.equal(validated.cards[0].approval, null);
  assert.equal(p.cards[0].state, 'draft');
  assert.throws(() => beginAttempt(validated, 'a', {}, now), /approval/);
  assert.equal(approve(validated).cards[0].state, 'approved');
});

test('failed validation invalidates only the affected approval and cannot be approved away', () => {
  const p = approve(pack());
  const failed = recordValidation(p, 'a', receipt(p, { status: 'failed', issues: ['Unsupported claim'] }), now);
  assert.deepEqual(failed.cards.map((c) => c.state), ['draft', 'approved']);
  assert.equal(failed.cards[0].approval, null);
  assert.throws(() => approve(failed), /validation/i);
  const fixed = recordValidation(failed, 'a', receipt(failed, { id: 'validation-2' }), now);
  assert.equal(fixed.cards[0].validation_history.length, 2);
  const changed = replaceCard(fixed, { ...content('a'), parts: ['Corrected synthetic copy'] });
  assert.equal(changed.cards[0].validation, null);
  assert.equal(changed.cards[0].validation_history.length, 2);
});

test('stale, future, mismatched and contradictory validation evidence cannot change state', () => {
  const p = pack();
  for (const extra of [{ card_hash: 'wrong' }, { account_id: 'wrong' }, { checked_at: '2026-09-08T00:00:00Z' },
    { valid_until: now }, { status: 'unknown' }, { issues: ['failed check'] }, { kind: 'threadify' },
    { status: 'failed', issues: [] }]) {
    assert.throws(() => recordValidation(p, 'a', receipt(p, extra), now));
  }
  assert.equal(p.cards[0].state, 'draft');
});

test('validation replay cannot overwrite evidence; fresh revalidation preserves exact owner approval', () => {
  const p = approve(pack()); const r = receipt(p);
  const checked = recordValidation(p, 'a', r, now);
  assert.equal(checked.cards[0].state, 'approved');
  assert.deepEqual(checked.cards[0].approval, p.cards[0].approval);
  assert.deepEqual(recordValidation(checked, 'a', r, now), checked);
  assert.throws(() => recordValidation(checked, 'a', { ...r, evidence_ref: 'different' }, now), /ID/);
  checked.cards[0].state = 'unknown';
  assert.throws(() => recordValidation(checked, 'a', { ...r, id: 'next' }, now), /delivery/);
});

test('provider validation requires an editable draft and records its real origin separately', () => {
  const p = pack(); p.cards[0].content.draft_id = 'synthetic-draft';
  const r = receipt(p, { kind: 'threadify', tool: 'validate_post', authoritative: true, draft_id: 'synthetic-draft' });
  assert.equal(recordValidation(p, 'a', r, now).cards[0].validation.kind, 'threadify');
  assert.throws(() => recordValidation(p, 'a', { ...r, draft_id: 'wrong' }, now), /provider/);
  assert.throws(() => recordValidation(p, 'a', { ...r, tool: 'save_draft' }, now), /provider/);
});
