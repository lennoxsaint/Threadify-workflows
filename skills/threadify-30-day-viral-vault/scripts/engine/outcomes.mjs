import { reviewHash } from './review.mjs';
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const text = (v) => typeof v === 'string' && v.trim().length > 0;
const time = (v) => typeof v === 'string' && Number.isFinite(Date.parse(v));
const METRICS = new Set(['views', 'likes', 'replies', 'reposts', 'quotes', 'shares']);

export function recordOutcome(pack, cardId, receipt) {
  assert(pack.schema_version === 'creator-review.v1', 'Unsupported review schema.');
  const next = structuredClone(pack); const card = next.cards.find((c) => c.content.id === cardId);
  assert(card && text(receipt?.id) && ['published', 'observed'].includes(receipt.status), 'Known card and outcome event required.');
  const hash = reviewHash(receipt);
  const existing = (card.outcomes ?? []).find((e) => e.id === receipt.id);
  assert(!existing || existing.hash === hash, 'Outcome ID already holds different evidence.');
  if (existing) return next;
  assert(receipt.authoritative === true && text(receipt.evidence_ref) && time(receipt.checked_at), 'Current authoritative outcome evidence required.');
  assert(receipt.account_id === card.content.account_id && text(receipt.post_id), 'Outcome must match the account and identify a provider post.');
  if (receipt.status === 'published') {
    assert(card.state === 'scheduled', 'A matching scheduled record must precede publication evidence.');
    const attempt = card.attempts.at(-1);
    assert(attempt?.outcome === 'scheduled' && receipt.schedule_ref === attempt.receipt.provider_ref
      && receipt.content_hash === reviewHash(card.content), 'Publication must match the scheduled content and receipt.');
    assert(time(receipt.published_at) && Date.parse(receipt.published_at) >= Date.parse(attempt.started_at)
      && Date.parse(receipt.checked_at) >= Date.parse(receipt.published_at), 'Publication evidence must be chronological.');
    card.publication = { post_id: receipt.post_id, published_at: receipt.published_at, evidence_ref: receipt.evidence_ref };
  } else {
    assert(['published', 'observed'].includes(card.state) && receipt.post_id === card.publication?.post_id, 'Observation must match a confirmed published post.');
    const last = card.outcomes?.at(-1)?.receipt.checked_at ?? card.publication.published_at;
    assert(Date.parse(receipt.checked_at) >= Date.parse(last), 'Observation evidence must be chronological.');
    assert(receipt.metrics && typeof receipt.metrics === 'object' && !Array.isArray(receipt.metrics)
      && Object.keys(receipt.metrics).length > 0 && Object.entries(receipt.metrics).every(([key, value]) =>
        METRICS.has(key) && (value === null || (Number.isSafeInteger(value) && value >= 0))), 'Observed metrics must be known nonnegative counts or null.');
  }
  card.outcomes = [...(card.outcomes ?? []), { schema_version: 'creator-outcome.v1', id: receipt.id, hash, receipt: structuredClone(receipt) }];
  card.state = receipt.status; card.outcome_attribution = 'directional_only';
  return next;
}
