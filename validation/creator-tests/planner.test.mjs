import test from 'node:test';
import assert from 'node:assert/strict';
import { createHorizon } from '../../lib/creator/planner.mjs';

const lanes = ['greatest_hit', 'viral', 'my_vault', 'experiment'];
const candidates = () => Array.from({ length: 160 }, (_, i) => ({
  id: `source-${i}`, url: `https://example.com/${i}`, lane: lanes[i % 4],
  topic: `Synthetic topic ${i}`, qualified: true, relevance: 1 - i / 200,
  evidence_ref: 'synthetic-review', available_until: '2026-11-01T00:00:00Z',
}));
const input = () => ({
  id: 'plan-1', start_date: '2026-09-07', horizon: 'week', now: '2026-09-07T00:00:00Z',
  preferences: { account_id: 'creator-1', timezone: 'Australia/Perth', times: ['09:00', '11:00', '13:00', '15:00', '17:00'] },
  sources: candidates(), used_source_ids: [], used_source_urls: [],
});

test('default week has a full blueprint, five balanced slots and only Day 1 drafting due', () => {
  const result = createHorizon(input());
  assert.equal(result.days.length, 7);
  assert.deepEqual(result.days[0].slots.map((s) => s.requested_lane).sort(), ['experiment', 'greatest_hit', 'my_vault', 'viral', 'viral']);
  assert.equal(result.days[0].drafting, 'due');
  assert.ok(result.days.slice(1).every((d) => d.drafting === 'just_in_time'));
  assert.ok(result.days.every((d) => d.slots.length === 5));
  assert.deepEqual(result.days.filter((d) => d.slots.some((s) => s.format === 'long_form')).map((d) => d.date), ['2026-09-08', '2026-09-10', '2026-09-12']);
  assert.ok(result.days.flatMap((d) => d.slots).every((s) => s.cta === 'none'));
});

test('month means 28 days, upfront means drafting due, and no selected source is repeated', () => {
  const params = input(); params.horizon = 'month'; params.mode = 'upfront';
  const result = createHorizon(params);
  assert.equal(result.label, '28 days (4 weeks)');
  assert.equal(result.days.length, 28);
  assert.ok(result.days.every((d) => d.drafting === 'due'));
  const ids = result.days.flatMap((d) => d.slots.map((s) => s.source_id));
  assert.equal(new Set(ids).size, 140);
  assert.equal(result.days.at(-1).date, '2026-10-04');
});

test('volumes one through five rotate categories and long form replaces a slot', () => {
  for (let volume = 1; volume <= 5; volume++) {
    const params = input(); params.preferences.posts_per_day = volume;
    const result = createHorizon(params);
    assert.ok(result.days.every((d) => d.slots.length === volume));
    assert.equal(new Set(result.days.flatMap((d) => d.slots.map((s) => s.requested_lane))).size, 4);
    assert.equal(result.days.flatMap((d) => d.slots).filter((s) => s.format === 'long_form').length, 3);
  }
});

test('empty and weak sources leave honest gaps; qualified substitutions explain their lane', () => {
  const params = input(); params.sources = [];
  let result = createHorizon(params);
  assert.ok(result.days.flatMap((d) => d.slots).every((s) => s.source_id === null && s.gaps.length > 0));
  params.sources = [candidates()[1], { ...candidates()[2], qualified: false }];
  result = createHorizon(params);
  assert.equal(result.days[0].slots[0].selected_lane, 'viral');
  assert.match(result.days[0].slots[0].substitution_reason, /greatest_hit/);
  assert.equal(result.days.flatMap((d) => d.slots).filter((s) => s.source_id).length, 1);
});

test('used IDs, duplicate URLs and stale sources never fill multiple slots', () => {
  const params = input(); params.used_source_ids = ['source-0'];
  params.used_source_urls = ['https://example.com/1'];
  params.sources = candidates().slice(0, 5);
  params.sources[3].url = params.sources[2].url;
  params.sources[4].available_until = params.now;
  const slots = createHorizon(params).days.flatMap((d) => d.slots);
  assert.equal(slots.filter((s) => s.source_id).length, 1);
});

test('conversion requires a current selected offer; cadence is adjustable and CTA at most one daily', () => {
  const params = input(); params.preferences.commercial_mode = 'conversion';
  assert.throws(() => createHorizon(params), /offer/);
  params.preferences.offer = { id: 'offer-1', verified: true, evidence_ref: 'synthetic-owner', valid_until: '2026-10-01T00:00:00Z' };
  params.preferences.long_form_days = [1, 5];
  const result = createHorizon(params);
  assert.equal(result.days.flatMap((d) => d.slots).filter((s) => s.format === 'long_form').length, 2);
  assert.ok(result.days.every((d) => d.slots.filter((s) => s.cta === 'earned_optional').length === 1));
});

test('invalid volume, date, time, timezone, horizon and mode fail rather than silently defaulting', () => {
  const changes = [
    (p) => { p.preferences.posts_per_day = 6; },
    (p) => { p.start_date = '2026-02-30'; },
    (p) => { p.preferences.times = ['25:00']; },
    (p) => { p.preferences.timezone = 'Made/Up'; },
    (p) => { p.horizon = 'year'; },
    (p) => { p.mode = 'automatic_publish'; },
  ];
  for (const change of changes) { const params = input(); change(params); assert.throws(() => createHorizon(params)); }
});
