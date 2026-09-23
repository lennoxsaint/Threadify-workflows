import { createHash } from 'node:crypto';
import { validateAutomation, validateGlobalRepost } from './automation.mjs';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const text = (v) => typeof v === 'string' && v.trim().length > 0;
const timestamp = (v) => typeof v === 'string' && Number.isFinite(Date.parse(v));
const DELIVERY = new Set(['attempt_pending', 'unknown', 'scheduled', 'published', 'observed']);
const GATES = ['facts', 'offers', 'source_availability', 'validation', 'calendar', 'timezone_offset'];

function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${Array.from(value, canonical).join(',')}]`;
  assert(value && Object.getPrototypeOf(value) === Object.prototype, 'Review data must be plain JSON without undefined values.');
  return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}

export const reviewHash = (value) => createHash('sha256').update(canonical(value)).digest('hex');

function validateCard(c) {
  assert(c && text(c.id) && text(c.account_id) && text(c.timezone), 'Card identity, account and timezone required.');
  new Intl.DateTimeFormat('en', { timeZone: c.timezone }).format();
  assert(timestamp(c.scheduled_at) && /(?:Z|[+-]\d{2}:\d{2})$/.test(c.scheduled_at), 'Explicit proposed time with offset required.');
  assert(Array.isArray(c.parts) && c.parts.length > 0 && c.parts.every(text), 'Exact nonempty copy required.');
  assert(Array.isArray(c.media) && Array.isArray(c.gaps), 'Explicit media and gaps required.');
  assert(c.source && text(c.source.id) && text(c.source.url), 'Source lineage required.');
  assert(['structure_only', 'literal_fill_in', 'exact_repost'].includes(c.adaptation_mode), 'Adaptation mode required.');
  assert(['host_authored', 'threadify_brain'].includes(c.method), 'Accurate drafting method required.');
  if ('auto_plug' in c || 'auto_repost' in c || 'automation_context' in c) {
    validateAutomation(c.auto_plug, true); validateAutomation(c.auto_repost);
    validateGlobalRepost(c.automation_context);
    assert(!c.auto_repost || (c.automation_context.known && !c.automation_context.enabled), 'Account-wide Auto Repost overrides this per-post request.');
  }
  reviewHash(c);
}

function find(pack, id) {
  assert(pack?.schema_version === 'creator-review.v1', 'Unsupported review schema.');
  const card = pack.cards.find((c) => c.content.id === id);
  assert(card, 'Unknown review card.');
  return card;
}

export function createReviewPack({ id, cards, now }) {
  assert(text(id) && timestamp(now), 'Review pack ID and creation time required.');
  assert(Array.isArray(cards) && cards.length >= 1 && cards.length <= 5, 'Review one through five cards daily.');
  cards.forEach(validateCard);
  assert(new Set(cards.map((c) => c.id)).size === cards.length, 'Card IDs must be unique.');
  return { schema_version: 'creator-review.v1', id, created_at: now,
    cards: cards.map((content) => ({ content: structuredClone(content), state: 'draft', validation: null,
      validation_history: [], approval: null, attempts: [] })) };
}

// Host-normalized evidence is not independently verified by this local engine.
// Record its origin explicitly; a local check cannot masquerade as validate_post.
export function recordValidation(pack, id, receipt, now) {
  const next = structuredClone(pack); const card = find(next, id);
  assert(!DELIVERY.has(card.state) && card.state !== 'reviewed_local', 'Resolve delivery before recording validation.');
  assert(text(receipt?.id) && text(receipt.evidence_ref), 'Validation ID and evidence required.');
  reviewHash(receipt);
  assert(receipt.card_hash === reviewHash(card.content) && receipt.account_id === card.content.account_id,
    'Validation must match exact card and account.');
  assert(['local', 'threadify'].includes(receipt.kind) && ['passed', 'failed'].includes(receipt.status), 'Known validation origin and result required.');
  assert(Array.isArray(receipt.issues) && receipt.issues.every(text)
    && (receipt.status === 'passed' ? receipt.issues.length === 0 : receipt.issues.length > 0), 'Validation result must agree with its issues.');
  if (receipt.kind === 'threadify') assert(receipt.authoritative === true && receipt.tool === 'validate_post'
    && text(card.content.draft_id) && receipt.draft_id === card.content.draft_id, 'Matching authoritative provider validation required.');
  assert(timestamp(now) && timestamp(receipt.checked_at) && timestamp(receipt.valid_until)
    && Date.parse(receipt.checked_at) >= Date.parse(pack.created_at)
    && Date.parse(receipt.checked_at) <= Date.parse(now)
    && Date.parse(now) - Date.parse(receipt.checked_at) <= 300_000
    && Date.parse(receipt.valid_until) > Date.parse(now), 'Fresh validation evidence required.');
  const history = card.validation_history ?? [];
  const existing = history.find((r) => r.id === receipt.id);
  if (existing) {
    assert(reviewHash(existing) === reviewHash(receipt), 'Validation ID already contains different evidence.');
    return next;
  }
  assert(!history.length || Date.parse(receipt.checked_at) >= Date.parse(history.at(-1).checked_at), 'Validation evidence cannot move backwards in time.');
  card.validation = structuredClone(receipt);
  card.validation_history = [...history, structuredClone(receipt)];
  if (receipt.status === 'failed') { card.state = 'draft'; card.approval = null; }
  else card.state = card.approval?.card_hash === receipt.card_hash ? 'approved' : 'validated';
  return next;
}

// Return this exact content to the owner, not a summary that omits changed fields.
export function displayReview(pack, ids = pack.cards.map((c) => c.content.id)) {
  assert(ids.length > 0 && new Set(ids).size === ids.length, 'Display IDs must be nonempty and unique.');
  const cards = ids.map((id) => {
    const { content } = find(pack, id); validateCard(content);
    return { id, hash: reviewHash(content), content: structuredClone(content) };
  });
  const display = { schema_version: 'creator-display.v1', pack_id: pack.id, cards };
  return { ...display, hash: reviewHash(display) };
}

export function approveReview(pack, displayed, confirmation) {
  assert(text(confirmation?.evidence_ref) && timestamp(confirmation.at), 'Explicit owner approval evidence and time required.');
  const { hash, ...body } = displayed;
  assert(hash === reviewHash(body), 'Invalid or mutated display.');
  const current = displayReview(pack, displayed.cards.map((c) => c.id));
  assert(current.hash === hash, 'Review changed since display; show affected cards again.');
  const next = structuredClone(pack);
  for (const entry of current.cards) {
    const card = find(next, entry.id);
    assert(!DELIVERY.has(card.state), 'Cannot approve while delivery needs reconciliation.');
    assert(card.validation?.status !== 'failed', 'Resolve failed validation before approval.');
    card.approval = { card_hash: entry.hash, display_hash: hash, evidence_ref: confirmation.evidence_ref, at: confirmation.at };
    card.state = 'approved';
  }
  return next;
}

export function replaceCard(pack, content) {
  validateCard(content);
  const next = structuredClone(pack); const card = find(next, content.id);
  assert(!DELIVERY.has(card.state), 'Resolve delivery before editing this card.');
  if (reviewHash(content) !== reviewHash(card.content)) {
    card.content = structuredClone(content); card.approval = null; card.validation = null; card.state = 'draft';
  }
  return next;
}

// Persist the returned pending state BEFORE calling the provider. This function
// performs no write itself. A crash after dispatch therefore cannot look retryable.
export function beginAttempt(pack, id, preflight, now) {
  const next = structuredClone(pack); const card = find(next, id); const c = card.content;
  assert(!DELIVERY.has(card.state), 'Must reconcile prior delivery before retry.');
  validateCard(c);
  const hash = reviewHash(c);
  assert(card.approval?.card_hash === hash && card.state === 'approved', 'Exact current approval required.');
  assert(text(c.draft_id), 'A real editable draft is required to schedule.');
  // Match Threadify schedule_post's minimum; the host must still check the
  // current provider contract and allow time for dispatch before calling it.
  assert(timestamp(now) && Date.parse(c.scheduled_at) - Date.parse(now) >= 300_000,
    'Proposed time must be at least five minutes in the future.');
  assert(preflight?.card_hash === hash && preflight.account_id === c.account_id && preflight.timezone === c.timezone,
    'Matching preflight account, timezone and review hash required.');
  assert(GATES.every((gate) => preflight[gate] === true) && text(preflight.evidence_ref), 'Every preflight check must pass with evidence.');
  if ('automation_context' in c) {
    assert(c.automation_context.known && preflight.automation_verified === true && preflight.automation
      && reviewHash(preflight.automation) === reviewHash({ auto_plug: c.auto_plug, auto_repost: c.auto_repost, global_repost: c.automation_context }),
    'Fresh automation settings must match the browser approval, including account-wide Auto Repost.');
  }
  assert(timestamp(preflight.checked_at) && Date.parse(preflight.checked_at) <= Date.parse(now)
    && Date.parse(now) - Date.parse(preflight.checked_at) <= 300_000
    && Date.parse(preflight.valid_until) > Date.parse(now), 'Fresh preflight required.');
  assert(Array.isArray(preflight.occupied_instants) && preflight.occupied_instants.every(timestamp), 'Calendar occupancy evidence required.');
  assert(!preflight.occupied_instants.some((t) => Date.parse(t) === Date.parse(c.scheduled_at)), 'Proposed slot is occupied.');
  assert(!next.cards.some((other) => other.content.id !== id && DELIVERY.has(other.state)
    && other.content.account_id === c.account_id && Date.parse(other.content.scheduled_at) === Date.parse(c.scheduled_at)),
  'Proposed slot is occupied by another local delivery attempt.');
  card.attempts.push({ schema_version: 'creator-attempt.v1', number: card.attempts.length + 1,
    card_hash: hash, idempotency_key: `creator-${reviewHash({ pack_id: pack.id, id, hash })}`,
    started_at: now, outcome: 'pending', preflight: structuredClone(preflight), receipt: null });
  card.state = 'attempt_pending';
  return next;
}

export function reconcileAttempt(pack, id, receipt) {
  const next = structuredClone(pack); const card = find(next, id);
  assert(['attempt_pending', 'unknown'].includes(card.state), 'No unresolved delivery attempt.');
  const attempt = card.attempts.at(-1);
  assert(attempt && attempt.card_hash === reviewHash(card.content), 'Attempt and card must match.');
  assert(text(receipt?.evidence_ref), 'Receipt evidence required.');
  if (receipt.status === 'unknown') {
    card.state = 'unknown'; attempt.outcome = 'unknown'; attempt.receipt = structuredClone(receipt);
    return next;
  }
  assert(receipt.authoritative === true && timestamp(receipt.checked_at)
    && Date.parse(receipt.checked_at) >= Date.parse(attempt.started_at), 'Fresh authoritative reconciliation required.');
  if (receipt.status === 'not_found') {
    assert(receipt.idempotency_key === attempt.idempotency_key && receipt.account_id === card.content.account_id,
      'Absence reconciliation must match the attempted key and account.');
    card.state = 'approved'; attempt.outcome = 'confirmed_absent';
  } else {
    assert(receipt.status === 'scheduled' && text(receipt.provider_ref), 'Confirmed schedule receipt required.');
    assert(Date.parse(receipt.scheduled_at) === Date.parse(card.content.scheduled_at), 'Schedule readback must match scheduled_at.');
    for (const field of ['account_id', 'draft_id', 'parts', 'media']) {
      assert(canonical(receipt[field]) === canonical(card.content[field]), `Schedule readback must match ${field}.`);
    }
    if ('automation_context' in card.content) {
      assert(receipt.automation_verified === true && receipt.automation
        && reviewHash(receipt.automation) === reviewHash({ auto_plug: card.content.auto_plug,
          auto_repost: card.content.auto_repost, global_repost: card.content.automation_context }),
      'Schedule readback must match approved automation settings.');
    }
    card.state = 'scheduled'; attempt.outcome = 'scheduled';
  }
  attempt.receipt = structuredClone(receipt);
  return next;
}
