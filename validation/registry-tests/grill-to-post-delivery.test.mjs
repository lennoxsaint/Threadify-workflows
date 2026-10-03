import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { approvalHash, beginSchedule, firstLineReplacement, readDelivery, reconcileSchedule, verifyDraft } from '../../lib/grill-to-post.mjs';

const now = '2026-10-03T12:00:00Z';
const checkedAt = '2026-10-03T12:00:01Z';
const script = fileURLToPath(new URL('../../lib/grill-to-post.mjs', import.meta.url));
const row = (id = 'thread') => ({
  action: 'schedule_post', account_id: 'synthetic-account', draft_id: `synthetic-${id}`,
  parts: ['A synthetic opening.\r\n\r\nKeep  two spaces. 🙂', 'Second part\nwith a final newline.\n'],
  media: [{ id: 'synthetic-media', alt_text: 'Unchanged image' }],
  scheduled_at: '2026-10-04T09:00:00+08:00', timezone: 'Australia/Perth', auto_repost: { enabled: false },
});
const approval = (r) => ({ row_hash: approvalHash(r), evidence_ref: 'synthetic-owner-approval', at: now });
const receipt = (attempt, status = 'scheduled') => ({
  account_id: attempt.row.account_id, draft_id: attempt.row.draft_id, idempotency_key: attempt.idempotency_key,
  evidence_ref: 'synthetic-provider-readback', checked_at: checkedAt, status,
  ...(status === 'scheduled' ? { authoritative: true, provider_ref: 'synthetic-schedule', row: attempt.row } : {}),
});

function directory(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'grill-delivery-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function cli(command, root, input) {
  const result = spawnSync(process.execPath, [script, command, root], { input: JSON.stringify(input), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('accepted scheduling with a lost response resumes in a new process without another dispatch', (t) => {
  const root = directory(t); const r = row(); const input = { row: r, approval: approval(r), now };
  const first = cli('begin', root, input);
  assert.equal(first.next_action, 'dispatch');
  const calls = [];
  const provider = new Map();
  function schedule(attempt) {
    const saved = cli('read', root);
    const persisted = Object.values(saved.rows).flat()[0];
    assert.equal(persisted.status, 'attempt_pending');
    assert.deepEqual(persisted.row, r);
    assert.deepEqual(persisted.approval, approval(r));
    assert.equal(persisted.idempotency_key, attempt.idempotency_key);
    calls.push(attempt.idempotency_key);
    provider.set(attempt.idempotency_key, receipt(attempt));
    throw new Error('Accepted, but response was lost');
  }
  assert.throws(() => schedule(first.attempt), /response was lost/);
  // Simulate restart before even recording the timeout. Each CLI call is a new process.
  const resumed = cli('begin', root, input);
  assert.equal(resumed.next_action, 'reconcile');
  assert.equal(resumed.attempt.idempotency_key, first.attempt.idempotency_key);
  const reconciled = cli('reconcile', root, provider.get(resumed.attempt.idempotency_key));
  assert.equal(reconciled.status, 'scheduled_confirmed');
  assert.equal(cli('begin', root, input).next_action, 'done');
  assert.equal(calls.length, 1);
  assert.equal(Object.values(cli('read', root).rows).flat().length, 1);
});

test('unknown delivery cannot retry on an empty calendar or changed approved copy', async (t) => {
  const root = directory(t); const r = row();
  const { attempt } = await beginSchedule(root, r, approval(r), now);
  await reconcileSchedule(root, receipt(attempt, 'unknown'));
  assert.equal((await beginSchedule(root, r, approval(r), now)).next_action, 'reconcile');
  await assert.rejects(reconcileSchedule(root, { ...receipt(attempt, 'not_found'), authoritative: true }), /Scheduled provider reference/);
  await assert.rejects(reconcileSchedule(root, { ...receipt(attempt, 'not_accepted'), authoritative: true }), /Definitive non-acceptance/);
  const changed = { ...r, parts: ['Different text'] };
  await assert.rejects(beginSchedule(root, changed, approval(changed), now), /Resolve the existing delivery/);
  const stored = Object.values((await readDelivery(root)).rows).flat();
  assert.equal(stored.length, 1);
  assert.equal(stored[0].status, 'schedule_unverified');
  assert.equal(stored[0].idempotency_key, attempt.idempotency_key);
});

test('definitive non-acceptance permits the same key while preserving confirmed sibling rows', async (t) => {
  const root = directory(t); const first = row();
  const second = { ...row('list'), scheduled_at: '2026-10-05T09:00:00+08:00' };
  const a = await beginSchedule(root, first, approval(first), now);
  await reconcileSchedule(root, receipt(a.attempt));
  const b = await beginSchedule(root, second, approval(second), now);
  await reconcileSchedule(root, { ...receipt(b.attempt, 'not_accepted'), authoritative: true, definitive: true });
  const retry = await beginSchedule(root, second, approval(second), checkedAt);
  assert.equal(retry.next_action, 'dispatch');
  assert.equal(retry.attempt.idempotency_key, b.attempt.idempotency_key);
  assert.equal((await beginSchedule(root, first, approval(first), checkedAt)).next_action, 'done');
  const states = Object.values((await readDelivery(root)).rows).flat().map((a) => a.status);
  assert.deepEqual(states, ['scheduled_confirmed', 'failed', 'attempt_pending']);
});

test('mismatched schedule evidence cannot confirm or unlock a retry', async (t) => {
  const root = directory(t); const r = row();
  const { attempt } = await beginSchedule(root, r, approval(r), now);
  for (const field of ['parts', 'media', 'scheduled_at', 'timezone', 'auto_repost']) {
    const bad = receipt(attempt);
    bad.row = { ...r, [field]: field === 'parts' || field === 'media' ? [] : 'changed' };
    await assert.rejects(reconcileSchedule(root, bad), /exact approved row/);
  }
  for (const field of ['account_id', 'draft_id', 'idempotency_key']) {
    await assert.rejects(reconcileSchedule(root, { ...receipt(attempt), [field]: 'wrong' }), /unresolved|same account/);
  }
  await assert.rejects(reconcileSchedule(root, { ...receipt(attempt), authoritative: false }), /Authoritative/);
  assert.equal((await beginSchedule(root, r, approval(r), now)).next_action, 'reconcile');
});

test('failed persistence and stale concurrent writes never return a dispatch', async (t) => {
  const root = directory(t); const r = row();
  fs.writeFileSync(path.join(root, 'writer.lock'), 'synthetic existing writer', { mode: 0o600 });
  await assert.rejects(beginSchedule(root, r, approval(r), now), /locked/);
  assert.equal(fs.existsSync(path.join(root, 'state.json')), false);
  fs.unlinkSync(path.join(root, 'writer.lock'));
  const results = await Promise.allSettled([
    beginSchedule(root, r, approval(r), now), beginSchedule(root, r, approval(r), now),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled' && result.value.next_action === 'dispatch').length, 1);
  for (const result of results) {
    if (result.status === 'rejected') assert.match(result.reason.message, /locked|revision changed/);
  }
  assert.equal(Object.values((await readDelivery(root)).rows).flat().length, 1);
});

test('approval binds every row field, and expired slots never create an attempt', async (t) => {
  const root = directory(t); const r = row();
  for (const [field, value] of Object.entries({ account_id: 'other', draft_id: 'other', parts: ['other'], media: [],
    scheduled_at: '2026-10-05T09:00:00+08:00', timezone: 'Etc/UTC', auto_repost: { enabled: true } })) {
    await assert.rejects(beginSchedule(root, { ...r, [field]: value }, approval(r), now), /Exact current approval/);
  }
  const late = { ...r, scheduled_at: now };
  await assert.rejects(beginSchedule(root, late, approval(late), now), /five minutes/);
  assert.deepEqual((await readDelivery(root)).rows, {});
});

test('selected first line preserves exact wording, whitespace, Unicode, body and remaining parts', () => {
  const original = row(); const before = structuredClone(original);
  const selected = '  “Exactly THIS,” she said... e\u0301 🙂  ';
  const expected = firstLineReplacement(original, selected);
  assert.equal(expected.parts[0], `${selected}\r\n\r\nKeep  two spaces. 🙂`);
  assert.equal(expected.parts[1], original.parts[1]);
  assert.deepEqual(expected.media, original.media);
  assert.deepEqual(original, before);
  assert.equal(verifyDraft(expected, structuredClone(expected)).status, 'exact_match');
  for (const altered of [selected.trim(), selected.normalize('NFC'), 'A paraphrase']) {
    const actual = { ...expected, parts: [expected.parts[0].replace(selected, altered), expected.parts[1]] };
    assert.throws(() => verifyDraft(expected, actual), /exact parts/);
  }
});

test('full draft readback rejects hidden body, later part, media or identity changes', () => {
  const expected = firstLineReplacement(row(), 'The exact selection');
  for (const actual of [
    { ...expected, parts: [expected.parts[0].replace('two spaces', 'different body'), expected.parts[1]] },
    { ...expected, parts: [expected.parts[0], 'Changed second part'] },
    { ...expected, media: [] }, { ...expected, draft_id: 'new-draft' }, { ...expected, account_id: 'wrong-account' },
  ]) assert.throws(() => verifyDraft(expected, actual), /must match exact/);
  assert.throws(() => firstLineReplacement(row(), 'A line\nAnd another'), /one exact first line/);
  assert.equal(firstLineReplacement({ ...row(), parts: ['One line only'] }, 'Exact').parts[0], 'Exact');
});

test('installed helper is self-contained and preserves exact wording through its CLI', (t) => {
  const root = directory(t);
  const installed = path.join(root, 'skill');
  fs.cpSync(fileURLToPath(new URL('../../skills/threadify-grill-to-post', import.meta.url)), installed, { recursive: true });
  const result = spawnSync(process.execPath, [path.join(installed, 'references/lib/grill-to-post.mjs'), 'first-line'], {
    input: JSON.stringify({ draft: row(), selected: '  Exact 🙂  ' }), encoding: 'utf8', cwd: root,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).parts[0], '  Exact 🙂  \r\n\r\nKeep  two spaces. 🙂');
});
