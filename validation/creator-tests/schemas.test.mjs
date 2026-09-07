import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { createHorizon } from '../../lib/creator/planner.mjs';
import { createReviewPack, displayReview, approveReview, recordValidation, beginAttempt, reconcileAttempt, reviewHash } from '../../lib/creator/review.mjs';
import { recordOutcome } from '../../lib/creator/outcomes.mjs';

const schema = JSON.parse(fs.readFileSync(new URL('../../schemas/creator-records.v1.json', import.meta.url)));
const ajv = new Ajv({ strict: true, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const now = '2026-09-07T00:00:00Z';
const horizon = (kind) => createHorizon({ id: 'synthetic-plan', now, start_date: '2026-09-07', horizon: kind,
  preferences: { account_id: 'synthetic-owner', timezone: 'UTC', times: ['09:00'], posts_per_day: 1 }, sources: [] });
const review = () => createReviewPack({ id: 'synthetic-review', now, cards: [{ id: 'card', account_id: 'synthetic-owner',
  timezone: 'UTC', scheduled_at: '2026-09-08T09:00:00Z', parts: ['Synthetic copy'], media: [], gaps: [],
  method: 'host_authored', adaptation_mode: 'structure_only', source: { id: 'source', url: 'https://example.com/source' }, draft_id: null }] });
const valid = (record) => assert.equal(validate(record), true, ajv.errorsText(validate.errors));
const invalid = (record) => assert.equal(validate(record), false, 'malformed record must fail');

test('strict JSON Schema validates actual Day, Week, Month and preference outputs', () => {
  for (const kind of ['day', 'week', 'month']) { const p = horizon(kind); valid(p); valid(p.preferences); }
  const month = horizon('month'); month.days.pop(); invalid(month);
  const p = horizon('day').preferences; p.posts_per_day = 6; invalid(p);
  p.posts_per_day = 1; p.times = ['25:00']; invalid(p);
  p.times = ['09:00']; p.commercial_mode = 'conversion'; invalid(p);
});

test('source schemas preserve missing permission but reject invalid lineage and malformed evidence', () => {
  const source = { schema_version: 'creator-source.v1', id: 'source', author: 'Synthetic author',
    url: 'https://example.com/source', parts: ['Synthetic source'] };
  valid(source);
  invalid({ ...source, parts: [] }); invalid({ ...source, url: 'file:///private/source' });
  invalid({ ...source, rights: { basis: 'licensed', verified: true } });
  valid({ ...source, rights: { basis: 'licensed', verified: false, evidence_ref: 'synthetic-unverified', valid_until: now } });
});

test('review schemas distinguish draft, validated and approved without manufacturing receipts', () => {
  const p = review(); valid(p);
  const r = { id: 'validation', card_hash: displayReview(p).cards[0].hash, account_id: 'synthetic-owner',
    kind: 'local', status: 'passed', issues: [], checked_at: now, valid_until: '2026-09-07T00:05:00Z', evidence_ref: 'synthetic-check' };
  const checked = recordValidation(p, 'card', r, now); valid(checked);
  const approved = approveReview(checked, displayReview(checked), { at: now, evidence_ref: 'synthetic-owner' }); valid(approved);
  const broken = structuredClone(approved); broken.cards[0].approval = null; invalid(broken);
  const delivered = structuredClone(p); delivered.cards[0].state = 'published'; invalid(delivered);
  const falseValidation = structuredClone(checked); falseValidation.cards[0].validation.status = 'failed'; invalid(falseValidation);
  const futureSchema = structuredClone(p); futureSchema.schema_version = 'creator-review.v2'; invalid(futureSchema);
});

test('schemas accept actual pending, scheduled, published and observed records and reject broken envelopes', () => {
  const p = review(); p.cards[0].content.draft_id = 'synthetic-draft';
  const approved = approveReview(p, displayReview(p), { at: now, evidence_ref: 'synthetic-owner' });
  const preflight = { card_hash: reviewHash(p.cards[0].content), account_id: 'synthetic-owner', timezone: 'UTC',
    checked_at: now, valid_until: '2026-09-07T00:05:00Z', evidence_ref: 'synthetic-preflight', occupied_instants: [],
    facts: true, offers: true, source_availability: true, validation: true, calendar: true, timezone_offset: true };
  const pending = beginAttempt(approved, 'card', preflight, now); valid(pending); valid(pending.cards[0].attempts[0]);
  const scheduled = reconcileAttempt(pending, 'card', { ...p.cards[0].content, status: 'scheduled',
    provider_ref: 'synthetic-schedule', authoritative: true, checked_at: now, evidence_ref: 'synthetic-readback' }); valid(scheduled);
  const published = recordOutcome(scheduled, 'card', { id: 'synthetic-publication', status: 'published', account_id: 'synthetic-owner',
    post_id: 'synthetic-post', schedule_ref: 'synthetic-schedule', content_hash: reviewHash(p.cards[0].content),
    published_at: '2026-09-08T09:00:00Z', checked_at: '2026-09-08T09:01:00Z', authoritative: true, evidence_ref: 'synthetic-public-readback' });
  valid(published); valid(published.cards[0].outcomes[0]);
  const observed = recordOutcome(published, 'card', { id: 'synthetic-observation', status: 'observed', account_id: 'synthetic-owner',
    post_id: 'synthetic-post', checked_at: '2026-09-09T09:00:00Z', authoritative: true, evidence_ref: 'synthetic-metrics', metrics: { views: null, likes: 2 } }); valid(observed);
  const broken = structuredClone(pending); broken.cards[0].attempts = []; invalid(broken);
  const badHash = structuredClone(published); badHash.cards[0].outcomes[0].hash = 'not-a-hash'; invalid(badHash);
  const noReadback = structuredClone(scheduled); noReadback.cards[0].attempts[0].receipt = null; invalid(noReadback);
  const badMetrics = structuredClone(observed); badMetrics.cards[0].outcomes.at(-1).receipt.metrics.likes = -1; invalid(badMetrics);
  const inventedMetric = structuredClone(observed); inventedMetric.cards[0].outcomes.at(-1).receipt.metrics.causal_followers = 20; invalid(inventedMetric);
});
