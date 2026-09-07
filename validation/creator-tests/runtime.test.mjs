import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runCreatorCommand } from '../../lib/creator/runtime.mjs';

const now = '2026-09-07T00:00:00Z';
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'creator-runtime-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
const plan = (horizon) => ({
  id: 'synthetic-plan', now, horizon, start_date: '2026-09-07',
  preferences: { account_id: 'synthetic-creator', timezone: 'Australia/Perth', posts_per_day: 1, times: ['09:00'] },
  sources: Array.from({ length: 28 }, (_, i) => ({ id: `source-${i}`, url: `https://example.com/${i}`,
    lane: 'my_vault', topic: 'Synthetic writing practice', qualified: true, relevance: 1,
    evidence_ref: 'synthetic-owner-source', available_until: '2026-11-01T00:00:00Z' })),
});
const review = (blueprint, dayIndex = 0) => ({
  id: `review-${dayIndex + 1}`, plan_id: blueprint.id, date: blueprint.days[dayIndex].date, now,
  cards: blueprint.days[dayIndex].slots.map((s) => ({
    id: s.id, account_id: blueprint.preferences.account_id, timezone: s.timezone,
    scheduled_at: `${s.local_date}T${s.local_time}:00+08:00`, parts: ['Synthetic local writing example.'], media: [],
    source: { id: s.source_id, url: s.source_url }, adaptation_mode: 'structure_only',
    method: 'host_authored', format: s.format, cta: 'none', gaps: [], draft_id: null,
  })),
});

for (const expired of ['rights', 'claims_review', 'replacement_fact']) {
  test(`literal delivery refreshes ${expired} against attempt time, not the saved proof clock`, async (t) => {
    const root = await fixture(t);
    const call = (command, input, revision) => runCreatorCommand(command, { root, input, revision });
    const created = await call('plan', plan('day'), 0);
    const daily = review(created.result);
    const card = daily.cards[0];
    Object.assign(card, { parts: ['I wrote 12 notes.'], adaptation_mode: 'literal_fill_in', draft_id: 'synthetic-draft' });
    const current = { verified: true, evidence_ref: 'synthetic-permission', valid_until: '2026-09-08T00:00:00Z' };
    const source = { schema_version: 'creator-source.v1', ...card.source, author: 'synthetic-author',
      parts: ['I wrote 10 notes.'], rights: { ...current, basis: 'licensed' }, claims_review: { ...current } };
    const proof = { adaptation: { source, mode: 'literal_fill_in', template_parts: ['I wrote {{COUNT}} notes.'],
      required_source_spans: ['10'], all_specifics_replaced: true,
      placeholders: [{ key: 'COUNT', kind: 'number', source_text: '10', replacement: '12', evidence_ref: 'count' }] },
    context: { account_id: card.account_id, now, facts: { count: { ...current, value: '12' } } } };
    const evidence = expired === 'replacement_fact' ? proof.context.facts.count : source[expired];
    evidence.valid_until = '2026-09-07T00:10:00Z';
    daily.reuse_proofs = { [card.id]: proof };
    const later = '2026-09-07T00:20:00Z';
    const rejection = /rights-gated|Current claims review|current verified fact/;
    await assert.rejects(call('add-review', { ...daily, now: later }, 1), rejection);
    const added = await call('add-review', daily, 1);
    await call('approve', { review_id: daily.id, displayed: added.result,
      confirmation: { evidence_ref: 'synthetic-owner', at: now } }, 2);
    const attempt = { review_id: daily.id, card_id: card.id, now: later, preflight: {
      card_hash: added.result.cards[0].hash, account_id: card.account_id, timezone: card.timezone,
      checked_at: later, valid_until: '2026-09-07T00:25:00Z', evidence_ref: 'synthetic-preflight', occupied_instants: [],
      facts: true, offers: true, source_availability: true, validation: true, calendar: true, timezone_offset: true,
    } };
    await assert.rejects(call('begin-attempt', attempt, 3), rejection);
    const unchanged = await call('continue', { plan_id: created.result.id });
    assert.equal(unchanged.revision, 3);
    assert.equal(unchanged.result.cards[0].attempts.length, 0);
    evidence.valid_until = '2026-09-08T00:00:00Z';
    proof.context.now = later;
    await call('edit', { review_id: daily.id, card, reuse_proof: proof, now: later }, 3);
    assert.equal((await call('begin-attempt', attempt, 4)).result.action, 'attempt_persisted');
  });
}

test('validation persists across CLI processes without granting approval or delivery', async (t) => {
  const root = await fixture(t);
  const run = (command, revision, input) => {
    const result = spawnSync(process.execPath, ['bin/threadify-workflows.mjs', 'creator', command, '--state', root,
      ...(revision === null ? [] : ['--revision', String(revision)])], { input: JSON.stringify(input), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const p = run('plan', 0, plan('day'));
  const r = run('add-review', p.revision, review(p.result));
  const card = r.result.cards[0];
  const v = run('record-validation', r.revision, { review_id: 'review-1', card_id: card.id, now,
    receipt: { id: 'synthetic-check', card_hash: card.hash, account_id: card.content.account_id,
      status: 'passed', kind: 'local', issues: [], checked_at: now, valid_until: '2026-09-07T00:05:00Z', evidence_ref: 'synthetic-local-check' } });
  assert.equal(v.result.states[0].state, 'validated');
  const status = run('status', null, {}).result;
  assert.equal(status.validated, 1);
  assert.equal(status.approved, 0);
  assert.equal(status.scheduled, 0);
  const resumed = run('continue', null, { plan_id: p.result.id }).result;
  assert.equal(resumed.action, 'resume_review');
  assert.equal(resumed.cards[0].validation.kind, 'local');
  assert.equal(resumed.cards[0].approval, null);
});

test('disconnected Day and resumed Week/Month survive separate CLI invocations without fake provider receipts', async (t) => {
  for (const horizon of ['day', 'week', 'month']) {
    const root = path.join(await fixture(t), horizon);
    const call = (command, input = {}, revision) => {
      const cli = new URL('../../bin/threadify-workflows.mjs', import.meta.url);
      const result = spawnSync(process.execPath, [cli.pathname, 'creator', command, '--state', root,
        ...(revision === undefined ? [] : ['--revision', String(revision)])], { input: JSON.stringify(input), encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      return JSON.parse(result.stdout);
    };
    const created = call('plan', plan(horizon), 0);
    assert.equal(created.revision, 1);
    const daily = review(created.result);
    call('add-review', daily, 1);
    const displayed = call('display', { review_id: daily.id });
    assert.equal(displayed.result.cards[0].content.draft_id, null);
    call('approve', { review_id: daily.id, displayed: displayed.result, confirmation: { evidence_ref: 'synthetic-owner-approval', at: now } }, 2);
    call('complete-local', { review_id: daily.id, evidence_ref: 'synthetic-owner-local-handoff', now }, 3);
    const resumed = call('continue', { plan_id: created.result.id });
    assert.equal(resumed.result.action, horizon === 'day' ? 'horizon_reviewed_locally' : 'prepare_day');
    if (horizon !== 'day') {
      assert.equal(resumed.result.day.date, '2026-09-08');
      const tomorrow = review(created.result, 1);
      const nextDisplay = call('add-review', tomorrow, 4);
      call('approve', { review_id: tomorrow.id, displayed: nextDisplay.result, confirmation: { evidence_ref: 'synthetic-day-two-owner', at: now } }, 5);
      call('complete-local', { review_id: tomorrow.id, evidence_ref: 'synthetic-day-two-handoff', now }, 6);
      assert.equal(call('continue', { plan_id: created.result.id }).result.day.date, '2026-09-09');
    }
    const status = call('status');
    assert.equal(status.result.scheduled, 0);
    assert.equal(status.result.published, 0);
    assert.equal(status.result.local_reviewed, horizon === 'day' ? 1 : 2);
    assert.equal(status.result.provider_writes_performed, false);
  }
});

test('review creation cannot overwrite an existing plan/day or silently replace planned sources', async (t) => {
  const root = await fixture(t);
  const created = await runCreatorCommand('plan', { root, revision: 0, input: plan('week') });
  const daily = review(created.result);
  await runCreatorCommand('add-review', { root, revision: 1, input: daily });
  await assert.rejects(runCreatorCommand('add-review', { root, revision: 2, input: { ...daily, id: 'other' } }), /already/);
  const root2 = await fixture(t);
  await runCreatorCommand('plan', { root: root2, revision: 0, input: plan('week') });
  daily.cards[0].source.id = 'unreviewed-source';
  await assert.rejects(runCreatorCommand('add-review', { root: root2, revision: 1, input: daily }), /blueprint/);
});

test('upfront continuation resolves existing later work before filling earlier missing days', async (t) => {
  const root = await fixture(t);
  const call = (command, input, revision) => runCreatorCommand(command, { root, input, revision });
  const p = await call('plan', { ...plan('week'), mode: 'upfront' }, 0);
  const later = review(p.result, 2); later.cards[0].draft_id = 'synthetic-later-draft';
  const r = await call('add-review', later, 1);
  const continued = await call('continue', { plan_id: p.result.id });
  assert.equal(continued.result.action, 'resume_review');
  assert.equal(continued.result.review_id, later.id);
  await call('approve', { review_id: later.id, displayed: r.result,
    confirmation: { evidence_ref: 'synthetic-owner', at: now } }, 2);
  const card = r.result.cards[0];
  await call('begin-attempt', { review_id: later.id, card_id: card.id, now, preflight: {
    card_hash: card.hash, account_id: card.content.account_id, timezone: card.content.timezone,
    checked_at: now, valid_until: '2026-09-07T00:05:00Z', evidence_ref: 'synthetic-preflight', occupied_instants: [],
    facts: true, offers: true, source_availability: true, validation: true, calendar: true, timezone_offset: true,
  } }, 3);
  await call('add-review', review(p.result), 4);
  const pending = await call('continue', { plan_id: p.result.id });
  assert.equal(pending.result.action, 'reconcile_attempts');
  assert.equal(pending.result.review_id, later.id);
  assert.equal(pending.revision, 5);
});

test('card edits preserve plan account/day while allowing reviewed time and source changes', async (t) => {
  const root = await fixture(t);
  const input = plan('day'); input.preferences.posts_per_day = 2; input.preferences.times = ['09:00', '10:00'];
  const p = await runCreatorCommand('plan', { root, revision: 0, input });
  const daily = review(p.result);
  const shown = await runCreatorCommand('add-review', { root, revision: 1, input: daily });
  await runCreatorCommand('approve', { root, revision: 2, input: { review_id: daily.id,
    displayed: shown.result, confirmation: { evidence_ref: 'synthetic-owner', at: now } } });
  for (const change of [{ account_id: 'another-account' }, { scheduled_at: '2026-09-08T09:00:00+08:00' }]) {
    await assert.rejects(runCreatorCommand('edit', { root, revision: 3,
      input: { review_id: daily.id, card: { ...daily.cards[0], ...change } } }), /plan account|review day/);
    assert.equal((await runCreatorCommand('status', { root })).revision, 3);
  }
  const card = { ...daily.cards[0], scheduled_at: '2026-09-07T11:00:00+08:00',
    source: { id: 'new-reviewed-source', url: 'https://example.com/new-source' }, parts: ['Changed synthetic copy.'] };
  const edited = await runCreatorCommand('edit', { root, revision: 3, input: { review_id: daily.id, card } });
  assert.deepEqual(edited.result.states.map((c) => c.state), ['draft', 'approved']);
  assert.equal((await runCreatorCommand('display', { root, input: { review_id: daily.id } })).result.cards[0].content.source.id, card.source.id);
});

test('unknown commands and stale revisions fail without changing stored state', async (t) => {
  const root = await fixture(t);
  await runCreatorCommand('plan', { root, revision: 0, input: plan('day') });
  await assert.rejects(runCreatorCommand('publish-now', { root, revision: 1, input: {} }), /Unsupported/);
  await assert.rejects(runCreatorCommand('plan', { root, revision: 0, input: plan('week') }), /revision/);
  assert.equal((await runCreatorCommand('status', { root, input: {} })).revision, 1);
});

test('pending delivery reserves the account slot across separate plans', async (t) => {
  const root = await fixture(t);
  let revision = 0;
  const call = async (command, input) => {
    const result = await runCreatorCommand(command, { root, revision, input });
    revision = result.revision; return result.result;
  };
  const first = await call('plan', plan('day'));
  const second = await call('plan', { ...plan('day'), id: 'second-plan' });
  const prepare = async (p, id) => {
    const daily = review(p); daily.id = id; daily.cards[0].draft_id = `draft-${id}`;
    const shown = await call('add-review', daily);
    await call('approve', { review_id: id, displayed: shown,
      confirmation: { evidence_ref: 'synthetic-owner', at: now } });
    const card = shown.cards[0];
    return { review_id: id, card_id: card.id, now, preflight: {
      card_hash: card.hash, account_id: card.content.account_id, timezone: card.content.timezone,
      checked_at: now, valid_until: '2026-09-07T00:05:00Z', evidence_ref: 'synthetic-calendar', occupied_instants: [],
      facts: true, offers: true, source_availability: true, validation: true, calendar: true, timezone_offset: true,
    } };
  };
  const a = await prepare(first, 'first-review');
  const b = await prepare(second, 'second-review');
  const pending = await call('begin-attempt', a);
  const before = revision;
  await assert.rejects(call('begin-attempt', b), /another local delivery/);
  assert.equal((await runCreatorCommand('status', { root })).revision, before);
  await call('reconcile', { review_id: a.review_id, card_id: a.card_id, receipt: {
    status: 'not_found', authoritative: true, checked_at: '2026-09-07T00:00:01Z',
    account_id: a.preflight.account_id, idempotency_key: pending.card.attempts[0].idempotency_key,
    evidence_ref: 'synthetic-confirmed-absence',
  } });
  assert.equal((await call('begin-attempt', b)).action, 'attempt_persisted');
});

test('prepared attempts are committed before return and continuation reconciles before retry', async (t) => {
  const root = await fixture(t);
  const call = (command, input, revision) => runCreatorCommand(command, { root, input, revision });
  const created = await call('plan', plan('week'), 0);
  const daily = review(created.result); daily.cards[0].draft_id = 'synthetic-draft';
  const added = await call('add-review', daily, 1);
  await call('approve', { review_id: daily.id, displayed: added.result, confirmation: { evidence_ref: 'synthetic-owner', at: now } }, 2);
  const card = added.result.cards[0];
  const input = { review_id: daily.id, card_id: card.id, now, preflight: {
    card_hash: card.hash, account_id: card.content.account_id, timezone: card.content.timezone,
    checked_at: now, valid_until: '2026-09-07T00:05:00Z', evidence_ref: 'synthetic-preflight', occupied_instants: [],
    facts: true, offers: true, source_availability: true, validation: true, calendar: true, timezone_offset: true,
  } };
  const pending = await call('begin-attempt', input, 3);
  assert.equal(pending.revision, 4);
  assert.equal(pending.result.action, 'attempt_persisted');
  const resumed = await call('continue', { plan_id: created.result.id });
  assert.equal(resumed.result.action, 'reconcile_attempts');
  assert.equal(resumed.result.cards[0].attempts[0].idempotency_key, pending.result.card.attempts[0].idempotency_key);
  await assert.rejects(call('begin-attempt', input, 4), /reconcile/);
  await call('reconcile', { review_id: daily.id, card_id: card.id, receipt: {
    ...card.content, status: 'scheduled', authoritative: true, checked_at: '2026-09-07T00:00:01Z',
    provider_ref: 'synthetic-schedule', evidence_ref: 'synthetic-readback',
  } }, 4);
  assert.equal((await call('continue', { plan_id: created.result.id })).result.action, 'prepare_day');
  assert.equal((await call('status', {})).result.scheduled, 1);
  await call('record-outcome', { review_id: daily.id, card_id: card.id, receipt: {
    id: 'synthetic-publication', status: 'published', account_id: card.content.account_id, post_id: 'synthetic-post',
    schedule_ref: 'synthetic-schedule', content_hash: card.hash, authoritative: true, evidence_ref: 'synthetic-publication-read',
    published_at: '2026-09-08T00:00:00Z', checked_at: '2026-09-08T00:01:00Z',
  } }, 5);
  assert.equal((await call('status', {})).result.published, 1);
});

test('runtime rejects mismatched local times and unverified literal reuse before storing a review', async (t) => {
  const root = await fixture(t);
  const created = await runCreatorCommand('plan', { root, revision: 0, input: plan('day') });
  const daily = review(created.result);
  daily.cards[0].scheduled_at = '2026-09-07T09:00:00Z';
  await assert.rejects(runCreatorCommand('add-review', { root, revision: 1, input: daily }), /match/);
  daily.cards[0].scheduled_at = '2026-09-07T09:00:00+08:00';
  daily.cards[0].adaptation_mode = 'exact_repost';
  await assert.rejects(runCreatorCommand('add-review', { root, revision: 1, input: daily }), /source-rights/);
  assert.equal((await runCreatorCommand('status', { root })).result.daily_reviews, 0);
});

test('separate setups share import reservations without crossing user boundaries', async (t) => {
  const root = await fixture(t);
  let revision = 0;
  const call = async (command, input) => {
    const result = await runCreatorCommand(command, { root, revision, input });
    revision = result.revision; return result.result;
  };
  const prepare = async (id, post, user = 'synthetic-user') => {
    const shown = await call('setup', { id, user_id: user, now, candidates: [{ id: 'item',
      url: `https://www.threads.com/@example/post/${post}`, origin: 'user',
      extraction: { status: 'ready', full_text: 'Synthetic source', evidence_ref: 'synthetic-extraction' } }] });
    await call('approve-setup', { setup_id: id, displayed: shown,
      confirmation: { evidence_ref: 'synthetic-owner', at: now } });
    return { setup_id: id, item_id: 'item', now, access: { user_id: user, connected: true,
      can_import: true, youtube_access: false, remaining_slots: 1, checked_at: now,
      valid_until: '2026-09-07T00:05:00Z', evidence_ref: 'synthetic-capacity' } };
  };
  const a = await prepare('first', 'one');
  const b = await prepare('second', 'two');
  const duplicate = await prepare('duplicate', 'one');
  const otherUser = await prepare('other-user', 'one', 'another-user');
  const pending = await call('begin-import', a);
  const before = revision;
  await assert.rejects(call('begin-import', b), /capacity.*reserved/i);
  await assert.rejects(call('begin-import', { ...duplicate, access: { ...duplicate.access, remaining_slots: 10 } }), /source.*unresolved/i);
  assert.equal((await runCreatorCommand('status', { root })).revision, before);
  assert.equal((await call('begin-import', otherUser)).action, 'import_attempt_persisted');
  await call('reconcile-import', { setup_id: a.setup_id, item_id: a.item_id, receipt: {
    status: 'not_found', authoritative: true, checked_at: '2026-09-07T00:00:01Z',
    user_id: a.access.user_id, source_url: pending.item.url, attempt_key: pending.item.attempts[0].key,
    evidence_ref: 'synthetic-confirmed-absence',
  } });
  assert.equal((await call('begin-import', b)).action, 'import_attempt_persisted');
});

test('Vault setup commits pending import before returning and persists exact saved readback', async (t) => {
  const root = await fixture(t);
  const call = (command, input, revision) => runCreatorCommand(command, { root, input, revision });
  const candidate = { id: 'selected', url: 'https://www.threads.com/@example/post/selected', origin: 'user',
    extraction: { status: 'ready', full_text: 'Synthetic selected text', evidence_ref: 'synthetic-extraction' } };
  const preview = await call('setup', { id: 'setup-1', user_id: 'synthetic-user', candidates: [candidate], now }, 0);
  await call('approve-setup', { setup_id: 'setup-1', displayed: preview.result, confirmation: { evidence_ref: 'synthetic-owner', at: now } }, 1);
  const input = { setup_id: 'setup-1', item_id: candidate.id, now, access: { user_id: 'synthetic-user', connected: true,
    can_import: true, youtube_access: false, remaining_slots: 1, checked_at: now, valid_until: '2026-09-07T00:05:00Z', evidence_ref: 'synthetic-access' } };
  const pending = await call('begin-import', input, 2);
  assert.equal(pending.result.action, 'import_attempt_persisted');
  assert.equal(pending.revision, 3);
  await assert.rejects(call('begin-import', input, 3), /reconcil/);
  await call('reconcile-import', { setup_id: 'setup-1', item_id: candidate.id, receipt: {
    status: 'saved', item_id: 'synthetic-vault-item', source_url: candidate.url, user_id: 'synthetic-user',
    full_text: candidate.extraction.full_text, authoritative: true, in_my_vault: true,
    evidence_ref: 'synthetic-my-vault-read', checked_at: '2026-09-07T00:00:01Z',
  } }, 3);
  assert.equal((await call('status', {})).result.vault_saved, 1);
});

test('feedback is persisted locally before opt-in and reminder preparation does not create state or providers', async (t) => {
  const root = await fixture(t);
  const call = (command, input, revision) => runCreatorCommand(command, { root, input, revision });
  const created = await call('plan', plan('day'), 0);
  const daily = review(created.result); await call('add-review', daily, 1);
  const recorded = await call('record-feedback', { id: 'feedback-1', review_id: daily.id, card_id: daily.cards[0].id,
    account_id: daily.cards[0].account_id, original_parts: daily.cards[0].parts, final_parts: ['Shorter synthetic copy.'],
    instruction: 'Shorten this.', rating: null, now }, 2);
  assert.equal(recorded.result.state, 'local_only');
  const status = await call('status', {}); assert.equal(status.result.feedback_sent, 0);
  await assert.rejects(call('begin-feedback-share', { feedback_id: 'feedback-1', approval: { at: now } }, 3), /opt-in/);
  const pending = await call('begin-feedback-share', { feedback_id: 'feedback-1', approval: {
    opt_in: true, content_hash: recorded.result.hash, evidence_ref: 'synthetic-explicit-share', at: now } }, 3);
  assert.equal(pending.result.action, 'feedback_share_persisted');
  assert.equal((await call('display-feedback', { feedback_id: 'feedback-1' })).result.state, 'share_pending');
  const reminder = await call('prepare-reminder', { plan_id: created.result.id, requested: true, native_supported: false });
  assert.equal(reminder.result.created, false);
  assert.equal(reminder.revision, 4);
});

test('fresh sources fill an unresolved blueprint day without changing other days or lane rotation', async (t) => {
  const root = await fixture(t);
  const input = plan('week'); input.sources = [];
  const created = await runCreatorCommand('plan', { root, revision: 0, input });
  const original = created.result.days[1];
  const refreshed = await runCreatorCommand('refresh-day', { root, revision: 1, input: {
    plan_id: input.id, date: original.date, now, sources: plan('week').sources, evidence_ref: 'synthetic-new-source-read',
  } });
  assert.equal(refreshed.result.slots[0].requested_lane, original.slots[0].requested_lane);
  assert.notEqual(refreshed.result.slots[0].source_id, null);
  const first = await runCreatorCommand('continue', { root, input: { plan_id: input.id } });
  assert.equal(first.result.day.date, '2026-09-07');
  assert.equal(first.result.day.slots[0].source_id, null);
});

test('new plans carry source history from prior reviews for the same creator', async (t) => {
  const root = await fixture(t);
  const created = await runCreatorCommand('plan', { root, revision: 0, input: plan('day') });
  await runCreatorCommand('add-review', { root, revision: 1, input: review(created.result) });
  const next = await runCreatorCommand('plan', { root, revision: 2, input: { ...plan('day'), id: 'second-plan' } });
  assert.notEqual(next.result.days[0].slots[0].source_id, created.result.days[0].slots[0].source_id);
});
