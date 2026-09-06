import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLocalTime } from '../../lib/creator/time.mjs';

test('ordinary and fractional-offset local times resolve to exact instants', () => {
  assert.equal(resolveLocalTime('2026-09-08', '09:00', 'Australia/Perth').instant, '2026-09-08T01:00:00.000Z');
  assert.equal(resolveLocalTime('2026-09-08', '09:00', 'Asia/Kathmandu').instant, '2026-09-08T03:15:00.000Z');
});
test('DST gaps and repeated times require a new time or explicit occurrence', () => {
  assert.equal(resolveLocalTime('2026-03-08', '02:30', 'America/New_York').status, 'nonexistent');
  const repeated = resolveLocalTime('2026-11-01', '01:30', 'America/New_York');
  assert.equal(repeated.status, 'ambiguous');
  assert.equal(repeated.candidates.length, 2);
  assert.equal(resolveLocalTime('2026-11-01', '01:30', 'America/New_York', repeated.candidates[1]).instant, repeated.candidates[1]);
  assert.throws(() => resolveLocalTime('2026-11-01', '01:30', 'America/New_York', '2026-11-01T09:30:00Z'), /match/);
});
