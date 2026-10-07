import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewPacket } from '../../plugins/threadify/skills/threadify-money-posts/scripts/review-packet.mjs';

function fixture() {
  return { account: '@example', timezone: 'UTC', posts: [1, 2, 3].map(n => ({
    id: String(n), scheduled_at: `2030-01-0${n}T09:00:00Z`, destination: 'https://example.org/offer',
    copy: { original: 'a useful example. old ending.', final: 'a useful example. old ending.', mode: 'unchanged' },
    plug: { original: 'try the tool https://example.org/offer', final: 'try the tool https://example.org/offer', mode: 'unchanged' },
    review: { facts: { status: 'verified', evidence: 'synthetic source reviewed; no outcome claim' }, destination: { status: 'verified', evidence: 'synthetic destination provides the tool' } },
    hook: { status: 'unproven', adapted_opening: 'a useful example.', reason: 'no relevant performance evidence' },
  })) };
}
function approved(packet) {
  const result = reviewPacket({ packet });
  assert.equal(result.status, 'PASS');
  return { packet, approval: { reply: 'yes', packet_sha256: result.packet_sha256 },
    validations: result.hashes.flatMap(h => ['post', 'plug'].map(kind => ({ id: h.id, kind, account: packet.account, sha256: h[`${kind}_sha256`], valid: true, validated_at: new Date().toISOString() }))) };
}
test('unchanged copy and honest unproven hooks are reviewable but not schedulable', () => {
  const result = reviewPacket({ packet: fixture() });
  assert.equal(result.proof_state, 'review_ready'); assert.deepEqual(result.schedule_args, []);
});
test('unauthorized wording changes fail; requested casing uses the unchanged guard', () => {
  const packet = fixture(); packet.posts[0].copy.final += ' new words';
  assert.match(reviewPacket({ packet }).errors.join(), /unauthorized/);
  packet.posts[0].copy = { original: 'A useful example. old ending.', final: 'a useful example. old ending.', mode: 'lowercase', owner_request: 'lowercase please' };
  assert.equal(reviewPacket({ packet }).status, 'PASS');
  packet.posts[0].copy.final += '!'; assert.equal(reviewPacket({ packet }).status, 'FAIL');
});
test('owner edits require an explicit request and resolved source review', () => {
  const packet = fixture(); Object.assign(packet.posts[0].copy, { mode: 'owner-requested edit', final: 'a useful example. stronger ending.' });
  assert.equal(reviewPacket({ packet }).status, 'FAIL');
  packet.posts[0].copy.owner_request = 'strengthen the ending';
  assert.equal(reviewPacket({ packet }).status, 'PASS');
  packet.posts[0].review.facts = { status: 'unsupported', evidence: 'invented result' };
  assert.equal(reviewPacket({ packet }).status, 'FAIL');
});
test('bounded sentence revision rejects any unrelated copy change', () => {
  const previous = fixture(); previous.posts[0].copy.mode = 'owner-requested edit'; previous.posts[0].copy.owner_request = 'strengthen ending only';
  const packet = structuredClone(previous); packet.posts[0].copy.final = 'a useful example. stronger ending.';
  const changes = [{ path: 'posts.0.copy.final', before: 'old ending.', after: 'stronger ending.' }];
  assert.equal(reviewPacket({ packet, previous, changes }).status, 'PASS');
  packet.posts[1].plug.final += ' ';
  assert.match(reviewPacket({ packet, previous, changes }).errors.join(), /undeclared/);
});
test('source-backed hook retains metrics and limitations; incomplete evidence fails', () => {
  const packet = fixture(); packet.posts[0].hook = { status: 'source-backed', source: 'synthetic-post', metric: { name: 'views', value: 8000 }, original_opening: 'a useful thought.', adapted_opening: 'a useful example.', limitations: 'source success is not hook causality' };
  assert.equal(reviewPacket({ packet }).status, 'PASS');
  delete packet.posts[0].hook.limitations; assert.equal(reviewPacket({ packet }).status, 'FAIL');
});
test('destination mismatch or unsupported offer claims block review', () => {
  const packet = fixture(); packet.posts[0].destination = 'https://example.org/other';
  assert.match(reviewPacket({ packet }).errors.join(), /destination mismatch/);
  packet.posts[0].destination = 'https://example.org/offer'; packet.posts[0].review.destination.status = 'mismatch';
  assert.equal(reviewPacket({ packet }).status, 'FAIL');
});
test('synthetic rehearsal: revision invalidates approval, renewed approval schedules exact text, readback verifies', () => {
  const packet = fixture(); const old = approved(packet);
  Object.assign(packet.posts[0].copy, { mode: 'owner-requested edit', owner_request: 'strengthen ending', final: 'a useful example. stronger ending.' });
  assert.equal(reviewPacket(old).status, 'FAIL');
  const current = approved(packet); const result = reviewPacket(current);
  assert.equal(result.proof_state, 'approved'); assert.equal(result.schedule_args.length, 3);
  assert.ok(result.schedule_args.every(a => !('draft_id' in a) && !('platforms' in a) && !('auto_repost' in a)));
  const readbacks = result.schedule_args.map((a, i) => ({ ...a, id: packet.posts[i].id, status: 'scheduled' }));
  assert.equal(reviewPacket({ ...current, readbacks }).proof_state, 'scheduled_verified');
  readbacks[0].auto_plug.content += '!';
  assert.equal(reviewPacket({ ...current, readbacks }).status, 'FAIL');
});
test('approval cannot substitute wrong-account or stale-text validation; plug affects keys', () => {
  const input = approved(fixture()); input.validations[0].account = '@other';
  assert.equal(reviewPacket(input).status, 'FAIL');
  const a = reviewPacket(approved(fixture())).schedule_args[0].idempotency_key;
  const packet = fixture(); Object.assign(packet.posts[0].plug, {mode: 'owner-requested edit', owner_request: 'shorten CTA', final: 'get it https://example.org/offer'});
  const b = reviewPacket(approved(packet)).schedule_args[0].idempotency_key; assert.notEqual(a,b);
});
test('irrelevant zero-conversion sentence may be removed on request without changing analytical evidence', () => {
  const packet = fixture(); const analysis = { conversions: 0, revenue: 0 }; const before = structuredClone(analysis);
  Object.assign(packet.posts[0].copy, { original: 'a useful example. zero attributed conversions.', final: 'a useful example.', mode: 'owner-requested edit', owner_request: 'remove the zero-conversion sentence' });
  assert.equal(reviewPacket({ packet }).status, 'PASS'); assert.deepEqual(analysis,before);
});

test('expired provider validation cannot authorize scheduling', () => {
  const input = approved(fixture()); input.validations[0].validated_at = '2000-01-01T00:00:00Z';
  assert.equal(reviewPacket(input).status, 'FAIL');
});
