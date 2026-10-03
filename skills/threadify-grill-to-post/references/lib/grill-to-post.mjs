import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { reviewHash } from './creator/review.mjs';
import { readState, updateState } from './creator/store.mjs';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const timestamp = (value) => text(value) && Number.isFinite(Date.parse(value));
const identity = (row) => reviewHash([row.account_id, row.draft_id]);
export const approvalHash = reviewHash;

function validateDraft(draft) {
  assert(text(draft?.account_id) && text(draft.draft_id), 'Account and existing draft ID required.');
  assert(Array.isArray(draft.parts) && draft.parts.length > 0 && draft.parts.every(text), 'Exact draft parts required.');
  assert(Array.isArray(draft.media), 'Exact media required, including an empty array when absent.');
}

// No AI editing: replace only the first line and preserve every other character.
export function firstLineReplacement(draft, selected) {
  validateDraft(draft);
  assert(text(selected) && !/[\r\n]/.test(selected), 'Select one exact first line.');
  const expected = structuredClone(draft);
  const boundary = expected.parts[0].search(/[\r\n]/);
  expected.parts[0] = selected + (boundary < 0 ? '' : expected.parts[0].slice(boundary));
  return expected;
}

export function verifyDraft(expected, actual) {
  validateDraft(expected); validateDraft(actual);
  for (const field of ['account_id', 'draft_id', 'parts', 'media']) {
    assert(reviewHash(expected[field]) === reviewHash(actual[field]), `Draft readback must match exact ${field}.`);
  }
  return { status: 'exact_match' };
}

function validateRow(row) {
  validateDraft(row);
  assert(row.action === 'schedule_post', 'Only scheduling is supported.');
  assert(timestamp(row.scheduled_at) && /(?:Z|[+-]\d{2}:\d{2})$/.test(row.scheduled_at), 'Exact schedule instant with offset required.');
  assert(text(row.timezone), 'Creator timezone required.');
  new Intl.DateTimeFormat('en', { timeZone: row.timezone }).format();
  assert(row.auto_repost && typeof row.auto_repost.enabled === 'boolean', 'Approved auto-repost setting required.');
  reviewHash(row);
}

function journal(payload) {
  if (payload === null) return { schema_version: 'grill-to-post-delivery.v1', rows: {} };
  assert(payload.schema_version === 'grill-to-post-delivery.v1', 'Use the existing dedicated Grill To Post delivery directory.');
  return payload;
}

export async function readDelivery(root) {
  return journal((await readState(root)).payload);
}

// Return a dispatch instruction only after the pending attempt is durable.
// The host supplies real approval/preflight evidence and makes the provider call.
export async function beginSchedule(root, row, approval, now) {
  validateRow(row);
  const hash = approvalHash(row);
  assert(approval?.row_hash === hash && text(approval.evidence_ref) && timestamp(approval.at)
    && timestamp(now) && Date.parse(approval.at) <= Date.parse(now), 'Exact current approval evidence required.');
  const current = await readState(root);
  let result;
  await updateState(root, current.revision, (payload) => {
    const state = journal(payload);
    const attempts = state.rows[identity(row)] ?? [];
    const previous = attempts.at(-1);
    if (previous && previous.status !== 'failed') {
      assert(previous.row_hash === hash, 'Resolve the existing delivery before changing this draft; never schedule a second copy.');
      result = { next_action: previous.status === 'scheduled_confirmed' ? 'done' : 'reconcile', attempt: previous };
      return state;
    }
    assert(Date.parse(row.scheduled_at) - Date.parse(now) >= 300_000, 'Schedule must be at least five minutes in the future.');
    const attempt = { row: structuredClone(row), row_hash: hash, approval: structuredClone(approval),
      idempotency_key: `grill-to-post-${hash}`, started_at: now, status: 'attempt_pending', receipt: null };
    state.rows[identity(row)] = [...attempts, attempt];
    result = { next_action: 'dispatch', attempt };
    return state;
  });
  return result;
}

// An empty calendar is not authoritative failure. Unknown attempts stay blocked.
export async function reconcileSchedule(root, receipt) {
  assert(text(receipt?.account_id) && text(receipt.draft_id), 'Receipt identity required.');
  const current = await readState(root);
  const saved = await updateState(root, current.revision, (payload) => {
    const state = journal(payload);
    const attempt = state.rows[identity(receipt)]?.at(-1);
    assert(attempt && ['attempt_pending', 'schedule_unverified'].includes(attempt.status), 'No unresolved scheduling attempt.');
    assert(receipt.idempotency_key === attempt.idempotency_key && text(receipt.evidence_ref)
      && timestamp(receipt.checked_at) && Date.parse(receipt.checked_at) >= Date.parse(attempt.started_at),
    'Fresh receipt for the same account, draft and idempotency key required.');
    if (receipt.status === 'unknown') attempt.status = 'schedule_unverified';
    else {
      assert(receipt.authoritative === true, 'Authoritative provider readback required.');
      if (receipt.status === 'not_accepted') {
        assert(receipt.definitive === true, 'Definitive non-acceptance required before retry.');
        attempt.status = 'failed';
      } else {
        assert(receipt.status === 'scheduled' && text(receipt.provider_ref), 'Scheduled provider reference required.');
        assert(reviewHash(receipt.row) === attempt.row_hash, 'Readback must match the exact approved row.');
        attempt.status = 'scheduled_confirmed';
      }
    }
    attempt.receipt = structuredClone(receipt);
    return state;
  });
  return saved.payload.rows[identity(receipt)].at(-1);
}

// CLI input is private JSON on stdin. This module never contacts a provider.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    const [command, root] = process.argv.slice(2);
    const input = command === 'read' ? {} : JSON.parse(readFileSync(0, 'utf8'));
    let result;
    if (command === 'read') result = await readDelivery(root);
    else if (command === 'begin') result = await beginSchedule(root, input.row, input.approval, input.now);
    else if (command === 'reconcile') result = await reconcileSchedule(root, input);
    else if (command === 'first-line') result = firstLineReplacement(input.draft, input.selected);
    else if (command === 'verify-draft') result = verifyDraft(input.expected, input.actual);
    else if (command === 'hash') { validateRow(input); result = { row_hash: approvalHash(input) }; }
    else throw new Error('Use read, hash, begin, reconcile, first-line or verify-draft.');
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
