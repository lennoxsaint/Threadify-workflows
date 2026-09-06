import { reviewHash } from './review.mjs';
import { canonicalSourceUrl, importSourceType } from './urls.mjs';
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const text = (s) => typeof s === 'string' && s.trim().length > 0;
const validTime = (s) => typeof s === 'string' && Number.isFinite(Date.parse(s));
const DISCLOSURE = 'Saving qualifying posts to My Vault can also publish them into shared Viral. Saving a source does not grant rights to copy it.';

export function createSetup({ id, user_id, now, candidates }) {
  assert(text(id) && text(user_id) && validTime(now), 'Setup identity, owner and time required.');
  assert(Array.isArray(candidates) && candidates.length <= 25, 'Guided setup accepts at most 20 user links plus five shared selections.');
  assert(candidates.filter((c) => c.origin === 'user').length <= 20 && candidates.filter((c) => c.origin === 'shared_viral').length <= 5, 'Keep setup to 20 user links plus five shared selections.');
  assert(new Set(candidates.map((c) => c.id)).size === candidates.length, 'Unique candidate IDs required.');
  const seen = new Map();
  const items = candidates.map((candidate) => {
    assert(text(candidate.id) && ['user', 'shared_viral'].includes(candidate.origin), 'Candidate ID and origin required.');
    const url = canonicalSourceUrl(candidate.url); const source_type = importSourceType(url);
    const item = { id: candidate.id, url, source_type, origin: candidate.origin,
      full_text: candidate.extraction?.full_text ?? null, extraction_evidence: candidate.extraction?.evidence_ref ?? null,
      state: 'ready', reason: null, duplicate_of: null, attempts: [], receipt: null };
    if (seen.has(url)) { item.state = 'duplicate'; item.duplicate_of = seen.get(url); }
    else if (candidate.extraction?.status !== 'ready' || !text(item.full_text) || !text(item.extraction_evidence)) {
      item.state = 'unavailable'; item.reason = candidate.extraction?.error ?? 'Complete extracted source evidence is unavailable.';
    }
    if (item.state === 'ready' && candidate.saved_readback) {
      const receipt = candidate.saved_readback;
      assert(validTime(receipt.checked_at) && Date.parse(receipt.checked_at) <= Date.parse(now)
        && Date.parse(now) - Date.parse(receipt.checked_at) <= 300_000, 'Fresh existing-item readback required.');
      validateSavedReceipt(item, user_id, receipt);
      item.state = 'saved'; item.receipt = structuredClone(receipt);
    }
    item.initial_state = item.state;
    if (!seen.has(url)) seen.set(url, candidate.id);
    return item;
  });
  return { schema_version: 'creator-setup.v1', id, user_id, created_at: now, items, approval: null };
}

export function displaySetup(setup) {
  assert(setup.schema_version === 'creator-setup.v1', 'Unsupported setup schema.');
  const eligible = setup.items.filter((i) => !['duplicate', 'unavailable'].includes(i.state));
  const preview = { schema_version: 'creator-setup-display.v1', setup_id: setup.id, user_id: setup.user_id,
    disclosure: DISCLOSURE, coverage_note: `${eligible.length} usable sources. ${eligible.length < 10 ? 'Below the suggested 10–20 starter links; proceed with an explicit coverage gap or add stronger sources.' : 'Review the selected sources before saving.'}`,
    items: setup.items.map(({ id, url, source_type, origin, full_text, extraction_evidence, reason, duplicate_of, initial_state }) =>
      ({ id, url, source_type, origin, full_text, extraction_evidence, reason, duplicate_of, initial_state })) };
  return { ...preview, hash: reviewHash(preview) };
}

export function approveSetup(setup, displayed, confirmation) {
  assert(text(confirmation?.evidence_ref) && validTime(confirmation.at), 'Explicit setup approval evidence required.');
  const { hash, ...body } = displayed;
  assert(hash === reviewHash(body) && hash === displaySetup(setup).hash, 'Setup display changed; show the exact preview again.');
  const next = structuredClone(setup);
  next.approval = { hash, evidence_ref: confirmation.evidence_ref, at: confirmation.at };
  return next;
}

export function beginImport(setup, itemId, access, now, otherSetups = []) {
  const next = structuredClone(setup); const item = next.items.find((i) => i.id === itemId);
  assert(next.approval?.hash === displaySetup(next).hash, 'Exact setup approval required.');
  assert(item && item.state === 'ready', 'Item is unavailable, already saved, or requires reconciliation before retry.');
  assert(validTime(now) && validTime(access.checked_at) && Date.parse(access.checked_at) <= Date.parse(now)
    && Date.parse(now) - Date.parse(access.checked_at) <= 300_000 && Date.parse(access.valid_until) > Date.parse(now), 'Fresh import access and limits required.');
  assert(access.user_id === next.user_id && access.connected === true && access.can_import === true && text(access.evidence_ref), 'Connected authorized Vault access required; local source work remains available.');
  assert(Number.isSafeInteger(access.remaining_slots) && access.remaining_slots > 0, 'Vault capacity unavailable; refresh limits before importing.');
  const otherItems = otherSetups.filter((s) => s.id !== next.id && s.user_id === next.user_id).flatMap((s) => s.items);
  assert(!otherItems.some((i) => i.url === item.url && ['import_pending', 'unknown'].includes(i.state)),
    'This source has an unresolved import in another setup; reconcile it first.');
  const reserved = [...next.items, ...otherItems].filter((i) => ['import_pending', 'unknown'].includes(i.state)
    || (i.state === 'saved' && i.attempts.length > 0 && Date.parse(i.receipt.checked_at) >= Date.parse(access.checked_at))).length;
  assert(reserved < access.remaining_slots, 'Vault capacity is reserved by local setups; refresh limits before importing.');
  assert(item.source_type !== 'youtube' || access.youtube_access === true, 'YouTube import access unavailable.');
  const key = `creator-import-${reviewHash({ setup: next.id, user: next.user_id, url: item.url })}`;
  item.attempts.push({ key, started_at: now, outcome: 'pending' }); item.state = 'import_pending';
  return next;
}

export function reconcileImport(setup, itemId, receipt) {
  const next = structuredClone(setup); const item = next.items.find((i) => i.id === itemId);
  assert(item && ['import_pending', 'unknown'].includes(item.state), 'No unresolved import.');
  assert(text(receipt?.evidence_ref), 'Import receipt evidence required.');
  const attempt = item.attempts.at(-1);
  if (receipt.status === 'unknown') item.state = 'unknown';
  else {
    assert(receipt.authoritative === true && receipt.user_id === next.user_id && validTime(receipt.checked_at)
      && Date.parse(receipt.checked_at) >= Date.parse(attempt.started_at), 'Authoritative current My Vault readback required.');
    assert(canonicalSourceUrl(receipt.source_url) === item.url, 'Readback source must match the approved URL.');
    if (receipt.status === 'not_found') {
      assert(receipt.attempt_key === attempt.key, 'Absence must match the attempted import key.');
      item.state = 'ready';
    } else {
      validateSavedReceipt(item, next.user_id, receipt);
      item.state = 'saved';
    }
  }
  attempt.outcome = item.state; attempt.receipt = structuredClone(receipt); item.receipt = structuredClone(receipt);
  return next;
}

function validateSavedReceipt(item, userId, receipt) {
  assert(receipt.authoritative === true && receipt.user_id === userId && text(receipt.evidence_ref)
    && canonicalSourceUrl(receipt.source_url) === item.url && receipt.status === 'saved'
    && text(receipt.item_id) && receipt.in_my_vault === true && receipt.full_text === item.full_text,
  'Saved readback must match owner, source, exact extracted text and My Vault membership.');
}
