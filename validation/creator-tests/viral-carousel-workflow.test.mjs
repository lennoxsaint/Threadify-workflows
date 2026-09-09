import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  createCarouselReview, inspectSchedulingContext, approveMediaTransfer,
  approveSchedule, performMediaTransfer, performSchedule, reconcileSchedule,
} from '../../lib/creator/viral-carousel-workflow.mjs';

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const now = '2026-09-09T00:00:00Z';
const media = Array.from({ length: 8 }, (_, index) => ({
  path: `/private/carousel/${String(index + 1).padStart(2, '0')}.png`,
  sha256: hash(`slide-${index + 1}`), order: index + 1,
}));
const manifest = { session_id: 'controlled-mutation-1', ordered_media: media,
  caption: 'A synthetic carousel caption.', accepted_edits: 7 };

function connector(overrides = {}) {
  const calls = [];
  const value = {
    calls,
    async get_connection_defaults() { calls.push('get_connection_defaults'); return { account_id: 'acct-1', handle: '@example', timezone: 'Australia/Perth' }; },
    async get_capabilities() { calls.push('get_capabilities'); return { ordered_carousel_media: true, upload_media: true, schedule_post: true }; },
    async get_best_time() { calls.push('get_best_time'); return { evidence_id: 'best-1', account_id: 'acct-1', timezone: 'Australia/Perth', checked_at: now, valid_until: '2026-09-09T01:00:00Z', recommended_at: '2026-09-09T00:30:00Z' }; },
    async list_scheduled_posts() { calls.push('list_scheduled_posts'); return []; },
    async upload_media(request) { calls.push('upload_media'); return { status: 'uploaded', media_refs: request.ordered_media.map((item) => `media-${item.order}`) }; },
    async schedule_post() { calls.push('schedule_post'); return { status: 'scheduled', provider_ref: 'post-1' }; },
    async get_schedule_status() { calls.push('get_schedule_status'); return { status: 'not_found' }; },
    ...overrides,
  };
  return value;
}

async function ready() {
  const review = createCarouselReview(manifest);
  const context = await inspectSchedulingContext({ connector: connector(), account_id: 'acct-1', timezone: 'Australia/Perth', scheduled_at: '2026-09-09T00:30:00Z', now });
  return { review, context };
}

test('local review preserves exact ordered carousel media and performs no provider action', () => {
  const review = createCarouselReview(manifest);
  assert.deepEqual(review.ordered_media.map((item) => item.sha256), media.map((item) => item.sha256));
  assert.equal(review.accepted_edits, 7);
  assert.equal(review.provider_writes, 0);
});

test('fresh preflight rejects wrong account, absent capabilities, stale evidence and occupied slots', async () => {
  const base = { account_id: 'acct-1', timezone: 'Australia/Perth', scheduled_at: '2026-09-09T00:30:00Z', now };
  await assert.rejects(inspectSchedulingContext({ ...base, connector: connector({ async get_connection_defaults() { return { account_id: 'wrong', timezone: 'Australia/Perth' }; } }) }), /account/);
  await assert.rejects(inspectSchedulingContext({ ...base, connector: connector({ async get_capabilities() { return { ordered_carousel_media: true, upload_media: false, schedule_post: true }; } }) }), /capability/);
  await assert.rejects(inspectSchedulingContext({ ...base, connector: connector({ async get_best_time() { return { evidence_id: 'old', account_id: 'acct-1', timezone: 'Australia/Perth', checked_at: '2026-09-08T00:00:00Z', valid_until: '2026-09-08T01:00:00Z', recommended_at: base.scheduled_at }; } }) }), /stale/);
  await assert.rejects(inspectSchedulingContext({ ...base, connector: connector({ async list_scheduled_posts() { return [{ account_id: 'acct-1', scheduled_at: base.scheduled_at }]; } }) }), /occupied/);
});

test('media transfer and scheduling require separate current hash-bound approvals', async () => {
  const { review, context } = await ready();
  const transfer = approveMediaTransfer({ review, context, confirmation: { approved: true, at: now, evidence_ref: 'owner-transfer' } });
  assert.throws(() => approveSchedule({ review, context, uploaded_media: [], confirmation: transfer }), /approval/);
  const changed = structuredClone(review); changed.ordered_media.reverse();
  await assert.rejects(performMediaTransfer({ transaction: { review: changed, context, transfer_approval: transfer }, connector: connector(), persist: async () => {} }), /stale/);
  const saved = [];
  const uploaded = await performMediaTransfer({ transaction: { review, context, transfer_approval: transfer }, connector: connector(), persist: async (record) => saved.push(structuredClone(record)) });
  assert.equal(saved[0].media_transfer.state, 'intent_persisted');
  const scheduleApproval = approveSchedule({ review, context, uploaded_media: uploaded.media_transfer.media_refs,
    confirmation: { approved: true, at: now, evidence_ref: 'owner-schedule', action: 'schedule_post' } });
  assert.notEqual(scheduleApproval.approval_hash, transfer.approval_hash);
});

test('crash ambiguity persists intent, prevents duplicate requests, and requires status plus calendar reconciliation', async () => {
  const { review, context } = await ready();
  const transfer = approveMediaTransfer({ review, context, confirmation: { approved: true, at: now, evidence_ref: 'owner-transfer' } });
  const uploaded = await performMediaTransfer({ transaction: { review, context, transfer_approval: transfer }, connector: connector(), persist: async () => {} });
  const final_approval = approveSchedule({ review, context, uploaded_media: uploaded.media_transfer.media_refs,
    confirmation: { approved: true, at: now, evidence_ref: 'owner-schedule', action: 'schedule_post' } });
  const transaction = { ...uploaded, final_approval };
  let persisted;
  let writes = 0;
  const crashing = connector({ async schedule_post() { writes += 1; throw new Error('connection lost'); } });
  await assert.rejects(performSchedule({ transaction, connector: crashing, persist: async (record) => { persisted = structuredClone(record); } }), /ambiguous/);
  assert.equal(persisted.schedule.state, 'outcome_unknown');
  assert.equal(writes, 1);
  await assert.rejects(performSchedule({ transaction: persisted, connector: crashing, persist: async () => {} }), /reconcile/);
  let statusReads = 0; let calendarReads = 0;
  const ambiguous = connector({ async get_schedule_status() { statusReads += 1; return { status: 'unknown' }; }, async list_scheduled_posts() { calendarReads += 1; return []; } });
  await assert.rejects(reconcileSchedule({ transaction: persisted, connector: ambiguous, persist: async () => {} }), /ambiguous/);
  assert.deepEqual([statusReads, calendarReads], [1, 1]);
  assert.equal(writes, 1);
});

test('successful schedule is requested once and duplicate prevention survives repeated calls', async () => {
  const { review, context } = await ready();
  const transfer_approval = approveMediaTransfer({ review, context, confirmation: { approved: true, at: now, evidence_ref: 'transfer' } });
  const provider = connector();
  const uploaded = await performMediaTransfer({ transaction: { review, context, transfer_approval }, connector: provider, persist: async () => {} });
  const final_approval = approveSchedule({ review, context, uploaded_media: uploaded.media_transfer.media_refs,
    confirmation: { approved: true, at: now, evidence_ref: 'schedule', action: 'schedule_post' } });
  const completed = await performSchedule({ transaction: { ...uploaded, final_approval }, connector: provider, persist: async () => {} });
  assert.equal(completed.schedule.state, 'scheduled');
  await assert.rejects(performSchedule({ transaction: completed, connector: provider, persist: async () => {} }), /already/);
  assert.equal(provider.calls.filter((name) => name === 'schedule_post').length, 1);
});
