import crypto from 'node:crypto';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
};
const digest = (value) => sha256(JSON.stringify(canonical(value)));
const validHash = (value) => /^[a-f0-9]{64}$/.test(value ?? '');

function mediaBinding(review) {
  return review.ordered_media.map(({ order, sha256: media_sha256 }) => ({ order, sha256: media_sha256 }));
}

function contextBinding(context) {
  return {
    account_id: context.account_id,
    account_handle: context.account_handle,
    timezone: context.timezone,
    scheduled_at: context.scheduled_at,
    best_time_evidence: context.best_time_evidence,
    connector_evidence_hash: context.connector_evidence_hash,
  };
}

function assertApprovalCurrent(approval, kind, binding) {
  assert(approval?.kind === kind && approval.approved === true, `Separate ${kind} approval required.`);
  assert(approval.binding_hash === digest(binding), `${kind} approval is stale or does not bind the exact request.`);
}

export function createCarouselReview(manifest) {
  assert(manifest && manifest.accepted_edits === 7, 'Controlled mutation requires exactly seven accepted parent/child edits.');
  assert(typeof manifest.caption === 'string' && manifest.caption.trim(), 'Exact carousel caption required.');
  assert(Array.isArray(manifest.ordered_media) && manifest.ordered_media.length >= 2, 'Ordered final-media manifest required.');
  manifest.ordered_media.forEach((item, index) => {
    assert(item.order === index + 1 && validHash(item.sha256) && typeof item.path === 'string' && item.path, 'Carousel media must be contiguous, ordered and hash-bound.');
  });
  const content = {
    workflow_id: 'viral-carousel-maker',
    source_session_id: manifest.session_id,
    accepted_edits: manifest.accepted_edits,
    caption: manifest.caption,
    ordered_media: structuredClone(manifest.ordered_media),
  };
  return { ...content, review_hash: digest(content), state: 'local_review', provider_writes: 0 };
}

export async function inspectSchedulingContext({ connector, account_id, timezone, scheduled_at, now }) {
  for (const name of ['get_connection_defaults', 'get_capabilities', 'get_best_time', 'list_scheduled_posts']) {
    assert(typeof connector?.[name] === 'function', `Missing required connector read capability: ${name}.`);
  }
  assert(Number.isFinite(Date.parse(now)) && Number.isFinite(Date.parse(scheduled_at)), 'Valid evidence and schedule timestamps required.');
  const connection = await connector.get_connection_defaults();
  assert(connection?.account_id === account_id, 'Wrong or unknown exact account; scheduling stopped.');
  assert(connection?.timezone === timezone, 'Wrong or unknown account timezone; scheduling stopped.');
  const capabilities = await connector.get_capabilities();
  assert(capabilities?.ordered_carousel_media === true && capabilities?.upload_media === true && capabilities?.schedule_post === true,
    'Required ordered-media, upload, or scheduling capability is absent.');
  const best = await connector.get_best_time({ account_id, timezone });
  assert(best?.account_id === account_id && best?.timezone === timezone && typeof best.evidence_id === 'string', 'Best-time evidence does not bind the exact account and timezone.');
  assert(Date.parse(best.checked_at) <= Date.parse(now) && Date.parse(best.valid_until) > Date.parse(now), 'Best-time evidence is stale or future-dated.');
  assert(best.recommended_at === scheduled_at, 'Scheduled time is not supported by the fresh best-time evidence.');
  const calendar = await connector.list_scheduled_posts({ account_id, timezone, from: scheduled_at, to: scheduled_at });
  assert(Array.isArray(calendar), 'Calendar evidence unavailable.');
  assert(!calendar.some((entry) => entry.account_id === account_id && Date.parse(entry.scheduled_at) === Date.parse(scheduled_at)), 'Proposed slot is occupied.');
  const evidence = { connection, capabilities, best_time: best, calendar, checked_at: now };
  return {
    account_id, account_handle: connection.handle, timezone, scheduled_at,
    best_time_evidence: { evidence_id: best.evidence_id, checked_at: best.checked_at, valid_until: best.valid_until, recommended_at: best.recommended_at },
    connector_evidence_hash: digest(evidence), checked_at: now,
  };
}

export function approveMediaTransfer({ review, context, confirmation }) {
  assert(confirmation?.approved === true && typeof confirmation.evidence_ref === 'string' && confirmation.evidence_ref, 'Explicit media-transfer approval required.');
  const binding = { review_hash: review.review_hash, ordered_media: mediaBinding(review), account_id: context.account_id, action: 'upload_media' };
  return { kind: 'media_transfer', approved: true, at: confirmation.at, evidence_ref: confirmation.evidence_ref,
    binding_hash: digest(binding), approval_hash: digest({ binding, confirmation }) };
}

export function approveSchedule({ review, context, uploaded_media, confirmation }) {
  assert(confirmation?.approved === true && confirmation.action === 'schedule_post'
    && typeof confirmation.evidence_ref === 'string' && confirmation.evidence_ref, 'Separate explicit final schedule approval required.');
  assert(Array.isArray(uploaded_media) && uploaded_media.length === review.ordered_media.length, 'All ordered media must be uploaded before final approval.');
  const binding = { review_hash: review.review_hash, caption: review.caption, ordered_media: mediaBinding(review), uploaded_media,
    ...contextBinding(context), action: 'schedule_post' };
  return { kind: 'schedule', approved: true, at: confirmation.at, evidence_ref: confirmation.evidence_ref,
    binding_hash: digest(binding), approval_hash: digest({ binding, confirmation }) };
}

export async function performMediaTransfer({ transaction, connector, persist }) {
  assert(!transaction.media_transfer, 'Media-transfer request already attempted; reconcile it instead of duplicating it.');
  const binding = { review_hash: transaction.review.review_hash, ordered_media: mediaBinding(transaction.review),
    account_id: transaction.context.account_id, action: 'upload_media' };
  assertApprovalCurrent(transaction.transfer_approval, 'media_transfer', binding);
  const request = { account_id: transaction.context.account_id, ordered_media: structuredClone(transaction.review.ordered_media),
    idempotency_key: digest({ binding, approval_hash: transaction.transfer_approval.approval_hash }) };
  let next = { ...structuredClone(transaction), media_transfer: { state: 'intent_persisted', request, requested_at: transaction.transfer_approval.at } };
  await persist(next);
  try {
    const receipt = await connector.upload_media(request);
    assert(receipt?.status === 'uploaded' && Array.isArray(receipt.media_refs) && receipt.media_refs.length === request.ordered_media.length, 'Upload receipt is incomplete.');
    next.media_transfer = { ...next.media_transfer, state: 'uploaded', media_refs: receipt.media_refs, receipt: structuredClone(receipt) };
    await persist(next);
    return next;
  } catch (error) {
    next.media_transfer = { ...next.media_transfer, state: 'outcome_unknown', error: error.message };
    await persist(next);
    throw new Error('Media-transfer outcome is ambiguous; reconcile before any retry.');
  }
}

export async function performSchedule({ transaction, connector, persist }) {
  assert(transaction.media_transfer?.state === 'uploaded', 'Completed media transfer required.');
  assert(!transaction.schedule, transaction.schedule?.state === 'scheduled' ? 'Schedule already completed; duplicate prevented.' : 'Schedule request already attempted; reconcile before any retry.');
  const binding = { review_hash: transaction.review.review_hash, caption: transaction.review.caption,
    ordered_media: mediaBinding(transaction.review), uploaded_media: transaction.media_transfer.media_refs,
    ...contextBinding(transaction.context), action: 'schedule_post' };
  assertApprovalCurrent(transaction.final_approval, 'schedule', binding);
  const request = { account_id: transaction.context.account_id, caption: transaction.review.caption,
    ordered_media: transaction.media_transfer.media_refs.map((media_ref, index) => ({ order: index + 1, media_ref, sha256: transaction.review.ordered_media[index].sha256 })),
    scheduled_at: transaction.context.scheduled_at, timezone: transaction.context.timezone,
    best_time_evidence: transaction.context.best_time_evidence,
    idempotency_key: digest({ binding, approval_hash: transaction.final_approval.approval_hash }) };
  let next = { ...structuredClone(transaction), schedule: { state: 'intent_persisted', request, requested_at: transaction.final_approval.at } };
  await persist(next);
  try {
    const receipt = await connector.schedule_post(request);
    assert(receipt?.status === 'scheduled' && receipt.provider_ref, 'Schedule receipt is incomplete.');
    next.schedule = { ...next.schedule, state: 'scheduled', receipt: structuredClone(receipt) };
    await persist(next);
    return next;
  } catch (error) {
    next.schedule = { ...next.schedule, state: 'outcome_unknown', error: error.message };
    await persist(next);
    throw new Error('Schedule outcome is ambiguous; reconcile status and calendar before any retry.');
  }
}

export async function reconcileSchedule({ transaction, connector, persist }) {
  assert(transaction.schedule?.state === 'outcome_unknown', 'Only an unknown schedule outcome can be reconciled.');
  assert(typeof connector?.get_schedule_status === 'function' && typeof connector?.list_scheduled_posts === 'function', 'Status and calendar reads are both required.');
  const status = await connector.get_schedule_status({ idempotency_key: transaction.schedule.request.idempotency_key });
  const calendar = await connector.list_scheduled_posts({ account_id: transaction.context.account_id,
    from: transaction.context.scheduled_at, to: transaction.context.scheduled_at });
  const matches = calendar.filter((entry) => entry.account_id === transaction.context.account_id
    && Date.parse(entry.scheduled_at) === Date.parse(transaction.context.scheduled_at)
    && entry.idempotency_key === transaction.schedule.request.idempotency_key);
  if (status?.status === 'scheduled' || matches.length === 1) {
    const next = structuredClone(transaction); next.schedule.state = 'scheduled';
    next.schedule.reconciliation = { status, calendar_match: matches[0] ?? null };
    await persist(next); return next;
  }
  throw new Error('Schedule outcome remains ambiguous; retry blocked to prevent duplicates.');
}
