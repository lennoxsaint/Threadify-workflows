import { reviewHash } from './review.mjs';
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const text = (s) => typeof s === 'string' && s.trim().length > 0;
const time = (s) => typeof s === 'string' && Number.isFinite(Date.parse(s));
const parts = (p) => Array.isArray(p) && p.length > 0 && p.every(text);

export function createFeedback(input) {
  assert(['id', 'account_id', 'review_id', 'card_id', 'instruction'].every((key) => text(input[key])) && time(input.now), 'Feedback identity, instruction and time required.');
  assert(parts(input.original_parts) && parts(input.final_parts), 'Exact original and final parts required.');
  assert(input.rating === null || (Number.isInteger(input.rating) && input.rating >= 1 && input.rating <= 5), 'Rating must be null or one through five.');
  const content = { id: input.id, account_id: input.account_id, review_id: input.review_id, card_id: input.card_id,
    original_parts: [...input.original_parts], final_parts: [...input.final_parts], instruction: input.instruction, rating: input.rating, created_at: input.now };
  return { schema_version: 'creator-feedback.v1', content, hash: reviewHash(content), state: 'local_only',
    share_approval: null, receipt: null, durable_rule: false };
}

export function prepareFeedbackShare(event, approval) {
  assert(event.schema_version === 'creator-feedback.v1' && reviewHash(event.content) === event.hash, 'Feedback content changed; record a new event.');
  assert(event.state === 'local_only', 'Existing feedback share must reconcile before another attempt.');
  assert(approval?.opt_in === true && approval.content_hash === event.hash && text(approval.evidence_ref) && time(approval.at), 'Explicit exact-content opt-in required before sending feedback.');
  return { ...structuredClone(event), state: 'share_pending',
    share_approval: { opt_in: true, content_hash: event.hash, evidence_ref: approval.evidence_ref, at: approval.at } };
}

export function reconcileFeedbackShare(event, receipt) {
  assert(['share_pending', 'unknown'].includes(event.state), 'No unresolved feedback share.');
  assert(text(receipt?.evidence_ref), 'Feedback receipt evidence required.');
  if (receipt.status !== 'unknown') {
    assert(receipt.status === 'sent' && receipt.authoritative === true && text(receipt.provider_ref)
      && receipt.content_hash === event.hash && receipt.account_id === event.content.account_id
      && time(receipt.checked_at) && Date.parse(receipt.checked_at) >= Date.parse(event.share_approval.at),
    'Authoritative matching feedback receipt required.');
  }
  return { ...structuredClone(event), state: receipt.status, receipt: structuredClone(receipt) };
}

export function prepareReminder(input) {
  assert(text(input.plan_id), 'Plan ID required.');
  if (input.requested !== true) return { status: 'not_requested', created: false, manual_continuation: true };
  if (input.native_supported !== true) return { status: 'unsupported', created: false, manual_continuation: true,
    reason: 'No supported native reminder capability was verified. Continue My Plan remains available manually.' };
  assert(text(input.capability_evidence_ref) && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input.local_time), 'Verified native capability and chosen reminder time required.');
  assert(text(input.timezone), 'Chosen reminder timezone required.');
  new Intl.DateTimeFormat('en', { timeZone: input.timezone }).format();
  // The plan identifier is data, not a free-form instruction source.
  assert(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(input.plan_id), 'Reminder plan ID must be a safe local identifier.');
  const spec = { plan_id: input.plan_id, frequency: 'daily', local_time: input.local_time, timezone: input.timezone,
    prompt: `Continue local creator plan ${JSON.stringify(input.plan_id)}. Prepare the next daily drafts for review only. Resume unresolved work first and refresh evidence. Never schedule, publish, import sources, send feedback, or infer approval from this reminder. Stop at the horizon boundary. Notify only when a review pack is ready or owner action is required; stay quiet when nothing actionable changed.` };
  return { status: 'prepared_needs_confirmation', created: false, manual_continuation: true,
    spec, hash: reviewHash(spec), capability_evidence_ref: input.capability_evidence_ref };
}
