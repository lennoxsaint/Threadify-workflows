import test from 'node:test';
import assert from 'node:assert/strict';
import { recordOutcome } from '../../lib/creator/outcomes.mjs';
import { reviewHash } from '../../lib/creator/review.mjs';
const content = { id: 'card', account_id: 'account', parts: ['Synthetic copy'], media: [] };
const pack = () => ({ schema_version: 'creator-review.v1', id: 'review', cards: [{ content, state: 'scheduled',
  attempts: [{ started_at: '2026-09-07T00:00:00Z', outcome: 'scheduled', receipt: { provider_ref: 'schedule-1' } }] }] });
const published = () => ({ id: 'publication-1', status: 'published', account_id: 'account', post_id: 'post-1',
  schedule_ref: 'schedule-1', content_hash: reviewHash(content), authoritative: true, evidence_ref: 'synthetic-live-read',
  published_at: '2026-09-08T00:00:00Z', checked_at: '2026-09-08T00:01:00Z' });

test('publication requires matching provider evidence and never follows from a schedule alone', () => {
  const p = pack(); assert.equal(p.cards[0].state, 'scheduled');
  const result = recordOutcome(p, 'card', published());
  assert.equal(result.cards[0].state, 'published');
  assert.equal(p.cards[0].state, 'scheduled');
  for (const field of ['account_id', 'schedule_ref', 'content_hash']) {
    assert.throws(() => recordOutcome(p, 'card', { ...published(), [field]: 'wrong' }), /match/);
  }
  const draft = pack(); draft.cards[0].state = 'draft';
  assert.throws(() => recordOutcome(draft, 'card', published()), /scheduled/);
});

test('observations retain unknown metrics as null without assigning follower causality', () => {
  const p = recordOutcome(pack(), 'card', published());
  const receipt = { id: 'observation-1', status: 'observed', account_id: 'account', post_id: 'post-1',
    authoritative: true, evidence_ref: 'synthetic-metrics', checked_at: '2026-09-09T00:00:00Z', metrics: { views: 100, likes: null } };
  const result = recordOutcome(p, 'card', receipt);
  assert.equal(result.cards[0].state, 'observed');
  assert.equal(result.cards[0].outcomes.at(-1).receipt.metrics.likes, null);
  assert.equal(result.cards[0].outcome_attribution, 'directional_only');
  assert.throws(() => recordOutcome(p, 'card', { ...receipt, metrics: { likes: -1 } }), /metrics/);
  assert.throws(() => recordOutcome(p, 'card', { ...receipt, post_id: 'other' }), /match/);
  assert.throws(() => recordOutcome(p, 'card', { ...receipt, checked_at: '2026-09-01T00:00:00Z' }), /chronological/);
});

test('outcome event IDs are replay-safe and cannot overwrite a different receipt', () => {
  const p = recordOutcome(pack(), 'card', published());
  assert.deepEqual(recordOutcome(p, 'card', published()), p);
  assert.throws(() => recordOutcome(p, 'card', { ...published(), post_id: 'changed' }), /different/);
  assert.throws(() => recordOutcome(pack(), 'card', { ...published(), authoritative: false }), /authoritative/);
});
