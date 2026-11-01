import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildRunwayReview, reconcileRunwayIntent, renderRunwayReview, rowFingerprint } from '../../lib/greatest-hits-runway.mjs';

const source = (id, kind = 'short') => ({ id, revision: 'r1', kind, family: id, historyComplete: true,
  lastUsedAt: null, hydrated: true, chain: Array.from({ length: kind === 'thread' ? 2 : 1 }, (_, index) => ({ text: `Synthetic ${id} part ${index + 1}`, media: [] })),
  performanceAt: '2030-01-01T00:00:00Z', openingLikes: 50, freshness: 'confirmed', changedClaims: [] });
function fixture() {
  return { account: 'synthetic-account', timezone: 'Australia/Perth', snapshotAt: '2030-01-02T00:00:00Z',
    window: { start: '2030-01-03T00:00:00Z', end: '2030-01-04T00:00:00Z' },
    policy: { minOpeningLikes: 50, cooldownDays: 90 },
    sources: [source('a'), source('b', 'thread')],
    calendar: { complete: true, account: 'synthetic-account', snapshotAt: '2030-01-02T00:00:00Z',
      start: '2030-01-02T23:30:00Z', end: '2030-01-04T00:30:00Z',
      rows: [{ id: 'queued-1', account: 'synthetic-account', at: '2030-01-03T01:00:00Z' }] },
    slots: [{ id: 'preserved', at: '2030-01-03T01:00:00Z', kind: 'short', existingId: 'queued-1' },
      { id: 'new', at: '2030-01-03T04:00:00Z', kind: 'short', source: 'a' },
      { id: 'thread', at: '2030-01-03T07:00:00Z', kind: 'thread', source: 'b' }] };
}

test('occupied days retain queued items and fill independent slots, with deterministic revisions', () => {
  const input = fixture(), before = JSON.stringify(input), packet = buildRunwayReview(input);
  assert.deepEqual(packet.counts, { positions: 3, proposed: 2, existing: 1, gaps: 0 });
  assert.equal(JSON.stringify(input), before);
  assert.equal(buildRunwayReview(input).revision, packet.revision);
  assert.equal(packet.providerOperations, 'not_attempted');
});

test('a synthetic fortnight keeps 55 proposals, four existing positions and 11 thread gaps', () => {
  const input = fixture();
  input.window = { start: '2030-01-03T00:00:00Z', end: '2030-01-17T00:00:00Z' };
  input.calendar.start = '2030-01-02T23:30:00Z'; input.calendar.end = '2030-01-17T00:30:00Z';
  input.slots = []; input.sources = []; input.calendar.rows = [];
  for (let day = 0; day < 14; day++) for (let position = 0; position < 5; position++) {
    const id = `day-${day}-position-${position}`, kind = position ? 'short' : 'thread';
    const at = new Date(Date.parse(input.window.start) + day * 86400000 + position * 4 * 3600000).toISOString();
    if ((!position && day < 3) || (!day && position === 1)) {
      input.calendar.rows.push({ id, account: input.account, at });
      input.slots.push({ id, kind, at, existingId: id });
    } else {
      input.slots.push({ id, kind, at, source: id });
      if (position) input.sources.push(source(id));
    }
  }
  assert.deepEqual(buildRunwayReview(input).counts, { positions: 70, proposed: 55, existing: 4, gaps: 11 });
});

test('partial, wrong-account and insufficient calendar coverage never approve empty space', () => {
  for (const edit of [(x) => x.calendar.complete = false, (x) => x.calendar.account = 'other',
    (x) => x.calendar.end = '2030-01-03T08:00:00Z']) {
    const input = fixture(); edit(input);
    const packet = buildRunwayReview(input);
    assert.equal(packet.counts.proposed, 0);
    assert.ok(packet.rows[1].blockers.includes('calendar_coverage_unverified'));
  }
});

test('hook-only threads, missing media hydration, stale claims, weak or unknown performance and cooldown remain gaps', () => {
  for (const edit of [(s) => s.chain.pop(), (s) => delete s.chain[1].media, (s) => s.hydrated = false,
    (s) => s.freshness = 'unknown', (s) => s.openingLikes = 49, (s) => delete s.performanceAt,
    (s) => s.historyComplete = false, (s) => s.lastUsedAt = '2030-01-01T00:00:00Z']) {
    const input = fixture(); edit(input.sources[1]);
    assert.equal(buildRunwayReview(input).rows[2].state, 'gap');
  }
});

test('missing thread inventory remains an honest gap and does not consume a short', () => {
  const input = fixture(); input.slots[2].source = 'missing';
  const packet = buildRunwayReview(input);
  assert.equal(packet.rows[2].state, 'gap');
  assert.deepEqual(packet.rows[2].blockers, ['source_unavailable']);
});

test('family duplicates include queued posts, conflicts use live calendar, and rejected slots do not consume inventory', () => {
  const input = fixture(); input.calendar.rows[0].family = 'a';
  assert.ok(buildRunwayReview(input).rows[1].blockers.includes('duplicate_source_or_family'));
  delete input.calendar.rows[0].family;
  input.slots[1].at = '2030-01-03T01:20:00Z';
  input.slots.push({ id: 'retry-slot', at: '2030-01-03T10:00:00Z', kind: 'short', source: 'a' });
  const packet = buildRunwayReview(input);
  assert.ok(packet.rows[1].blockers.includes('live_calendar_conflict'));
  assert.equal(packet.rows[3].state, 'proposed');
  input.slots[1].at = '2030-01-03T06:00:00Z';
  assert.ok(buildRunwayReview(input).rows[2].blockers.includes('proposal_spacing_conflict'));
});

test('approval keys bind account, source, revision, full chain, media and exact time', () => {
  const row = buildRunwayReview(fixture()).rows[2];
  for (const edit of [(r) => r.account = 'other', (r) => r.source = 'other', (r) => r.revision = 'r2',
    (r) => r.chain[1].text += ' edit', (r) => r.chain[1].media.push('synthetic-asset'), (r) => r.at = '2030-01-03T08:00:00Z']) {
    const changed = structuredClone(row); edit(changed);
    assert.notEqual(rowFingerprint(changed), row.fingerprint);
    assert.throws(() => reconcileRunwayIntent(changed, { complete: true, rows: [] }), /changed/);
  }
});

test('uncertain writes require unique complete exact readback; absence never permits a blind retry', () => {
  const intent = buildRunwayReview(fixture()).rows[2];
  const remote = { id: 'scheduled-1', status: 'scheduled', account: intent.account, at: intent.at, chain: intent.chain };
  assert.equal(reconcileRunwayIntent(intent, { complete: true, rows: [remote] }).state, 'scheduled_confirmed');
  for (const readback of [{ complete: false, rows: [remote] }, { complete: true, rows: [] },
    { complete: true, rows: [remote, { ...remote, id: 'duplicate' }] },
    { complete: true, rows: [{ ...remote, chain: [{ text: 'only the hook', media: [] }] }] },
    ...['cancelled', 'failed', 'published', undefined].map((status) => ({ complete: true, rows: [{ ...remote, status }] }))]) {
    assert.deepEqual(reconcileRunwayIntent(intent, readback), { state: 'schedule_unverified', scheduledPostId: null, retryAllowed: false });
  }
});

test('invalid identities, duplicated slots, calendar IDs and offset-free times fail closed', () => {
  for (const edit of [(x) => x.account = '', (x) => x.slots[1].at = '2030-01-03T04:00:00',
    (x) => x.slots.push({ ...x.slots[1] }), (x) => x.calendar.rows.push({ ...x.calendar.rows[0] }),
    (x) => x.sources.push({ ...x.sources[0] }), (x) => x.policy.cooldownDays = -1,
    (x) => x.slots[0].existingId = 'missing']) {
    const input = fixture(); edit(input); assert.throws(() => buildRunwayReview(input));
  }
});

test('impossible dates and times cannot roll into another approved day', () => {
  for (const at of ['2030-02-30T08:00:00Z', '2030-02-29T08:00:00Z', '2030-04-31T08:00:00Z',
    '2030-01-03T24:00:00Z', '2030-01-03T04:60:00Z']) {
    const input = fixture(); input.slots[1].at = at;
    assert.throws(() => buildRunwayReview(input), /slot outside window/);
  }
  const input = fixture(); input.snapshotAt = '2030-02-30T08:00:00Z';
  assert.throws(() => buildRunwayReview(input), /dated snapshot/);
});

test('portable page escapes all copy and assets, includes complete thread, no remote loads or approval controls', () => {
  const input = fixture(); input.sources[1].chain[1] = { text: '<script>alert("test")</script>', media: ['https://example.invalid/<img>'] };
  const html = renderRunwayReview(buildRunwayReview(input));
  assert.match(html, /&lt;script&gt;/); assert.match(html, /Part 2/);
  assert.match(html, /default-src 'none'/); assert.match(html, /viewport/);
  assert.match(html, /read-only and cannot approve/); assert.match(html, /unavailable/);
  assert.doesNotMatch(html, /<script|<img|<iframe|contenteditable|<button|<form/i);
});

test('malformed chain parts leave an independent gap and exact seconds remain visible for review', () => {
  const input = fixture(); input.sources[0].chain = [null]; input.slots[2].at = '2030-01-03T07:00:37Z';
  const packet = buildRunwayReview(input), html = renderRunwayReview(packet);
  assert.equal(packet.rows[1].state, 'gap');
  assert.ok(packet.rows[1].blockers.includes('full_chain_or_media_unverified'));
  assert.equal(packet.rows[2].state, 'proposed');
  assert.ok(html.includes('2030-01-03T07:00:37Z'));
});

test('installed CLI exports private files, refuses overwrite and has no provider calls', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'runway-test-'));
  try {
    const inputFile = path.join(temp, 'input.json'), output = path.join(temp, 'review');
    fs.writeFileSync(inputFile, JSON.stringify(fixture()));
    const args = ['bin/threadify-workflows.mjs', 'greatest-hits', 'review', '--input', inputFile, '--output-dir', output];
    const run = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(JSON.parse(run.stdout).providerOperations, 'not_attempted');
    assert.ok(fs.existsSync(path.join(output, 'review.private.html')));
    if (process.platform !== 'win32') {
      assert.equal(fs.statSync(output).mode & 0o777, 0o700);
      assert.equal(fs.statSync(path.join(output, 'review.private.json')).mode & 0o777, 0o600);
    }
    assert.notEqual(spawnSync(process.execPath, args).status, 0);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
