import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeedback, prepareFeedbackShare, reconcileFeedbackShare, prepareReminder } from '../../lib/creator/learning.mjs';
const now = '2026-09-07T00:00:00Z';
const feedback = () => createFeedback({ id: 'feedback-1', account_id: 'synthetic-account', review_id: 'review-1', card_id: 'card-1',
  original_parts: ['Original synthetic copy.'], final_parts: ['Edited synthetic copy.'], instruction: 'Make this shorter.', rating: null, now });

test('feedback stays local by default and retains exact original, final and instruction', () => {
  const event = feedback();
  assert.equal(event.state, 'local_only');
  assert.equal(event.share_approval, null);
  assert.deepEqual(event.content.original_parts, ['Original synthetic copy.']);
  assert.equal(event.content.rating, null);
  assert.equal(event.durable_rule, false);
  assert.throws(() => prepareFeedbackShare(event, { at: now }), /opt-in/);
});
test('sharing requires explicit exact-content opt-in and preserves unknown outcomes without retry', () => {
  const event = feedback();
  const approval = { opt_in: true, content_hash: event.hash, evidence_ref: 'synthetic-owner', at: now };
  const pending = prepareFeedbackShare(event, approval);
  assert.equal(pending.state, 'share_pending');
  assert.equal(event.state, 'local_only');
  assert.throws(() => prepareFeedbackShare(pending, approval), /reconcile/);
  const unknown = reconcileFeedbackShare(pending, { status: 'unknown', evidence_ref: 'timeout' });
  assert.throws(() => prepareFeedbackShare(unknown, approval), /reconcile/);
  assert.throws(() => reconcileFeedbackShare(unknown, { status: 'sent', evidence_ref: 'provider' }), /matching/);
  const sent = reconcileFeedbackShare(unknown, { status: 'sent', authoritative: true, evidence_ref: 'provider', provider_ref: 'synthetic-receipt',
    content_hash: event.hash, account_id: event.content.account_id, checked_at: now });
  assert.equal(sent.state, 'sent');
});
test('feedback approval cannot be reused for changed content or an unrelated account', () => {
  const event = feedback(); const changed = structuredClone(event); changed.content.final_parts = ['Other'];
  assert.throws(() => prepareFeedbackShare(changed, { opt_in: true, content_hash: event.hash, evidence_ref: 'owner', at: now }), /changed/);
});
test('unsupported reminders explicitly report no creation and preserve manual continuation', () => {
  const result = prepareReminder({ plan_id: 'plan-1', requested: true, native_supported: false });
  assert.equal(result.created, false);
  assert.equal(result.status, 'unsupported');
  assert.equal(result.manual_continuation, true);
});
test('supported reminders prepare review-only work, not scheduling authority or creation proof', () => {
  const result = prepareReminder({ plan_id: 'plan-1', requested: true, native_supported: true,
    capability_evidence_ref: 'synthetic-host-capability', local_time: '08:00', timezone: 'Australia/Perth' });
  assert.equal(result.created, false);
  assert.equal(result.status, 'prepared_needs_confirmation');
  assert.match(result.spec.prompt, /review only/);
  assert.match(result.spec.prompt, /Never schedule/);
  assert.throws(() => prepareReminder({ plan_id: 'p', requested: true, native_supported: true, local_time: '99:00', timezone: 'Unknown' }));
});
