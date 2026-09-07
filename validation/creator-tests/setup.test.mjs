import test from 'node:test';
import assert from 'node:assert/strict';
import { createSetup, displaySetup, approveSetup, beginImport, reconcileImport } from '../../lib/creator/setup.mjs';
const now = '2026-09-07T00:00:00Z';
const candidate = (id = 'a') => ({ id, url: `https://www.threads.com/@example/post/${id}`, origin: 'user',
  extraction: { status: 'ready', full_text: `Synthetic source ${id}`, evidence_ref: 'synthetic-extract' } });
const setup = () => createSetup({ id: 'setup-1', user_id: 'synthetic-user', now, candidates: [candidate(), candidate('b')] });
const approved = () => { const s = setup(); return approveSetup(s, displaySetup(s), { evidence_ref: 'owner', at: now }); };
const access = () => ({ user_id: 'synthetic-user', connected: true, can_import: true, youtube_access: true,
  remaining_slots: 5, checked_at: now, valid_until: '2026-09-07T00:05:00Z', evidence_ref: 'synthetic-defaults-and-cap' });

test('preview discloses shared publication and carries honest low-source coverage', () => {
  const s = setup(); const view = displaySetup(s);
  assert.match(view.disclosure, /shared Viral/);
  assert.match(view.coverage_note, /2/);
  assert.equal(view.items[0].full_text, 'Synthetic source a');
  assert.throws(() => beginImport(s, 'a', access(), now), /approval/);
  const tampered = structuredClone(view); tampered.disclosure = '';
  assert.throws(() => approveSetup(s, tampered, { evidence_ref: 'owner', at: now }), /display/);
});

test('duplicate URL variants and failed extraction are explicit, not counted as imported', () => {
  const s = createSetup({ id: 's', user_id: 'u', now, candidates: [candidate(),
    { ...candidate('duplicate'), url: 'https://www.threads.net/@example/post/a?utm_source=test' },
    { ...candidate('broken'), extraction: { status: 'failed', error: 'not available' } }] });
  assert.deepEqual(s.items.map((i) => i.state), ['ready', 'duplicate', 'unavailable']);
  assert.equal(s.items[1].duplicate_of, 'a');
  assert.equal(s.items[2].reason, 'not available');
});

test('import respects connection, capacity and YouTube access, with no fabricated saved receipt', () => {
  const s = approved();
  for (const change of [(a) => { a.connected = false; }, (a) => { a.remaining_slots = 0; }, (a) => { a.user_id = 'other'; }]) {
    const a = access(); change(a); assert.throws(() => beginImport(s, 'a', a, now));
  }
  const youtube = createSetup({ id: 's', user_id: 'synthetic-user', now,
    candidates: [{ ...candidate(), url: 'https://youtu.be/abcdefghijk' }] });
  const a = access(); a.youtube_access = false;
  assert.throws(() => beginImport(approveSetup(youtube, displaySetup(youtube), { evidence_ref: 'owner', at: now }), 'a', a, now), /YouTube/);
});

test('saved requires exact My Vault readback; partial success persists and unknown imports cannot retry', () => {
  let s = beginImport(approved(), 'a', access(), now);
  const readback = { status: 'saved', item_id: 'vault-a', user_id: s.user_id, source_url: candidate().url,
    full_text: candidate().extraction.full_text, in_my_vault: true, authoritative: true,
    evidence_ref: 'synthetic-get-vault-item', checked_at: '2026-09-07T00:00:01Z' };
  assert.throws(() => reconcileImport(s, 'a', { ...readback, full_text: 'wrong' }), /match/);
  s = reconcileImport(s, 'a', readback);
  s = beginImport(s, 'b', access(), now);
  s = reconcileImport(s, 'b', { status: 'unknown', evidence_ref: 'timeout' });
  assert.deepEqual(s.items.map((i) => i.state), ['saved', 'unknown']);
  assert.throws(() => beginImport(s, 'a', access(), now), /reconcile|saved/);
  assert.throws(() => beginImport(s, 'b', access(), now), /reconcil/);
});

test('a shared capacity snapshot cannot authorize more pending imports than available slots', () => {
  const a = access(); a.remaining_slots = 1;
  const s = beginImport(approved(), 'a', a, now);
  assert.throws(() => beginImport(s, 'b', a, now), /capacity/);
});

test('already-saved source readback avoids another import, while stale or wrong-owner evidence fails', () => {
  const c = candidate();
  c.saved_readback = { status: 'saved', item_id: 'existing', user_id: 'u', source_url: c.url,
    full_text: c.extraction.full_text, in_my_vault: true, authoritative: true, evidence_ref: 'existing-read', checked_at: now };
  const s = createSetup({ id: 's', user_id: 'u', now, candidates: [c] });
  assert.equal(s.items[0].state, 'saved');
  assert.equal(s.items[0].attempts.length, 0);
  assert.equal(displaySetup(s).items[0].initial_state, 'saved');
  c.saved_readback.user_id = 'other';
  assert.throws(() => createSetup({ id: 's', user_id: 'u', now, candidates: [c] }), /match/);
  c.saved_readback.user_id = 'u'; c.saved_readback.checked_at = '2026-09-06T00:00:00Z';
  assert.throws(() => createSetup({ id: 's', user_id: 'u', now, candidates: [c] }), /Fresh/);
});
