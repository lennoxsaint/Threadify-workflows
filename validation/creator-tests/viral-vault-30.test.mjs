import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  beginViralVaultSchedule,
  completeViralVaultLocal,
  createViralVaultPacket,
  createViralVaultPlan,
  decideViralVaultCard,
  displayNextViralVaultCard,
  recordViralVaultValidation,
  reconcileViralVaultSchedule,
  viralVaultHash,
} from '../../lib/creator/viral-vault-30.mjs';
import { runCreatorCommand } from '../../lib/creator/runtime.mjs';

const account = 'synthetic-creator';
const timezone = 'Australia/Perth';
const now = '2026-10-01T00:00:00Z';
const validUntil = '2026-11-01T00:00:00Z';
const times = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00'];

function planInput(goal = 'balanced') {
  return { id: 'vault-plan', now, start_date: '2026-10-01', preferences: {
    account_id: account, timezone, goal, times,
    offer: goal === 'reach_first' ? undefined : { id: 'offer-1', verified: true, evidence_ref: 'synthetic-offer' },
  } };
}

function evidence(basis, value) {
  return { basis, verified: true, evidence_ref: `synthetic-${basis}`, valid_until: validUntil, ...(value === undefined ? {} : { value }) };
}

function dayFixture(plan, date = '2026-10-01') {
  const lanes = ['greatest_hit', 'greatest_hit', 'viral_vault', 'viral_vault', 'my_vault', 'my_vault'];
  const topics = ['broad', 'broad', 'expertise', 'expertise', 'personal', 'personal'];
  const roles = ['proven', 'proven', 'proven', 'proven', 'challenger', 'challenger'];
  const structures = ['listicle', 'story_arc', 'before_after', 'listicle', 'story_arc', 'proof_receipt'];
  const cards = []; const reuse_proofs = {}; const suggestions = {};
  for (let index = 0; index < 6; index++) {
    const id = `card-${index + 1}`;
    const url = `https://example.com/source-${index + 1}`;
    const source = { schema_version: 'creator-source.v1', id: `source-${index + 1}`, url,
      author: `synthetic-author-${index + 1}`, owner_account_id: lanes[index] === 'greatest_hit' ? account : 'licensed-source',
      rights: evidence(lanes[index] === 'greatest_hit' ? 'owned' : 'licensed'), claims_review: evidence('claims') };
    let adaptation; let parts; let mode;
    if (lanes[index] === 'greatest_hit') {
      parts = [`Owned synthetic post ${index + 1}.`]; source.parts = [...parts]; mode = 'exact_repost';
      adaptation = { source, mode };
    } else {
      source.parts = [`Original ${10 + index} example ${index + 1}.`];
      parts = [`Creator ${20 + index} example ${index + 1}.`]; mode = 'literal_fill_in';
      adaptation = { source, mode, template_parts: [`{{TOPIC}} {{NUMBER}} example ${index + 1}.`],
        required_source_spans: ['Original', String(10 + index)], all_specifics_replaced: true,
        placeholders: [
          { key: 'TOPIC', kind: 'topic', source_text: 'Original', replacement: 'Creator', evidence_ref: `${id}-topic` },
          { key: 'NUMBER', kind: 'number', source_text: String(10 + index), replacement: String(20 + index), evidence_ref: `${id}-number` },
        ] };
    }
    cards.push({ id, account_id: account, timezone, parts, source: { id: source.id, url, author: source.author, lane: lanes[index] },
      adaptation_mode: mode, method: 'host_authored', topic: topics[index], role: roles[index], viral_structure: structures[index],
      taxonomy: structures[index] === 'listicle' ? 'listicle' : 'one-liner', cta: index === 0 ? 'earned' : 'none',
      offer_id: index === 0 ? 'offer-1' : null, lead_oriented: index === 0, draft_id: `draft-${index + 1}` });
    reuse_proofs[id] = { adaptation, context: { account_id: account, now, facts: mode === 'literal_fill_in' ? {
      [`${id}-topic`]: evidence('fact', 'Creator'), [`${id}-number`]: evidence('fact', String(20 + index)),
    } : {} } };
    suggestions[id] = { instant: `${date}T${times[index]}:00+08:00`, evidence_ref: `synthetic-time-${index + 1}` };
  }
  return { cards, reuse_proofs, suggestions };
}

function validation(displayed, at = now) {
  return { id: `validation-${displayed.card.content.id}`, content_hash: displayed.card.content_hash,
    account_id: account, status: 'passed', kind: 'threadify', issues: [], checked_at: at,
    valid_until: '2026-10-01T00:05:00Z', evidence_ref: 'synthetic-validation', authoritative: true,
    tool: 'validate_post', draft_id: displayed.card.content.draft_id };
}

test('plan is exactly 30 rolling blueprint days with six confirmed slots and no upfront copy', () => {
  const plan = createViralVaultPlan(planInput());
  assert.equal(plan.days.length, 30);
  assert.equal(plan.days[0].drafting, 'due');
  assert.ok(plan.days.slice(1).every((day) => day.drafting === 'just_in_time'));
  assert.ok(plan.days.every((day) => day.slots.length === 6 && day.slots.every((slot) => slot.copy_state === 'blueprint_only')));
  assert.equal(plan.days.at(-1).date, '2026-10-30');
  assert.throws(() => createViralVaultPlan({ ...planInput(), preferences: { ...planInput().preferences, times: times.slice(0, 5) } }), /six/);
});

test('daily packet enforces the portfolio and exposes only the current card', () => {
  const plan = createViralVaultPlan(planInput()); const fixture = dayFixture(plan);
  const created = createViralVaultPacket({ plan, id: 'packet-1', date: '2026-10-01', now, ...fixture });
  assert.equal(created.packet.cards.length, 6);
  assert.equal(created.display.position, 1);
  assert.equal(created.display.card.content.id, 'card-1');
  const serialized = JSON.stringify(created.display);
  assert.doesNotMatch(serialized, /card-2|Creator 23|draft-6/);
  const invalid = structuredClone(fixture); invalid.cards[5].source.lane = 'viral_vault';
  assert.throws(() => createViralVaultPacket({ plan, id: 'bad', date: '2026-10-01', now, ...invalid }), /two Greatest Hits/);
});

test('approval persists an idempotent attempt and advances only after exact schedule readback', () => {
  const plan = createViralVaultPlan(planInput()); const created = createViralVaultPacket({ plan, id: 'packet-1', date: '2026-10-01', now, ...dayFixture(plan) });
  const receipt = validation(created.display);
  let packet = recordViralVaultValidation(created.packet, { card_id: 'card-1', receipt, now });
  const shown = displayNextViralVaultCard(packet);
  packet = decideViralVaultCard(packet, { action: 'approve', displayed: shown,
    confirmation: { at: now, evidence_ref: 'synthetic-owner-approval' } });
  assert.equal(displayNextViralVaultCard(packet).card.content.id, 'card-1');
  const begun = beginViralVaultSchedule(packet, { card_id: 'card-1', now, preflight: {
    checked_at: now, valid_until: '2026-10-01T00:05:00Z', evidence_ref: 'synthetic-preflight',
    account_id: account, timezone, content_hash: shown.card.content_hash, scheduled_at: shown.card.suggested_at,
    account_verified: true, timezone_verified: true, facts: true, rights: true, validation: true, calendar: true,
  } });
  assert.match(begun.request.idempotency_key, /^viral-vault-/);
  assert.equal(begun.packet.cards[0].delivery.state, 'attempt_pending');
  assert.throws(() => beginViralVaultSchedule(begun.packet, { card_id: 'card-1', now, preflight: {} }), /attempt|preflight/);
  packet = reconcileViralVaultSchedule(begun.packet, { card_id: 'card-1', receipt: {
    ...begun.request, status: 'scheduled', authoritative: true, provider_ref: 'synthetic-schedule', evidence_ref: 'synthetic-readback',
  } });
  assert.equal(packet.cards[0].state, 'scheduled');
  assert.equal(displayNextViralVaultCard(packet).card.content.id, 'card-2');
});

test('ambiguous scheduling blocks the next card and queues no retry', () => {
  const plan = createViralVaultPlan(planInput()); const created = createViralVaultPacket({ plan, id: 'packet-1', date: '2026-10-01', now, ...dayFixture(plan) });
  let packet = recordViralVaultValidation(created.packet, { card_id: 'card-1', receipt: validation(created.display), now });
  packet = decideViralVaultCard(packet, { action: 'approve', displayed: displayNextViralVaultCard(packet),
    confirmation: { at: now, evidence_ref: 'synthetic-owner' } });
  packet = beginViralVaultSchedule(packet, { card_id: 'card-1', now, preflight: {
    checked_at: now, valid_until: '2026-10-01T00:05:00Z', evidence_ref: 'synthetic-preflight',
    account_id: account, timezone, content_hash: displayNextViralVaultCard(packet).card.content_hash,
    scheduled_at: displayNextViralVaultCard(packet).card.suggested_at,
    account_verified: true, timezone_verified: true, facts: true, rights: true, validation: true, calendar: true,
  } }).packet;
  packet = reconcileViralVaultSchedule(packet, { card_id: 'card-1', receipt: { status: 'unknown', evidence_ref: 'synthetic-timeout' } });
  assert.equal(packet.cards[0].delivery.retry_queued, false);
  assert.equal(displayNextViralVaultCard(packet).card.content.id, 'card-1');
});

test('skip carries exact content to tomorrow while accepting a new suggestion', () => {
  const plan = createViralVaultPlan(planInput()); const firstFixture = dayFixture(plan);
  let first = createViralVaultPacket({ plan, id: 'packet-1', date: '2026-10-01', now, ...firstFixture }).packet;
  const originalHash = viralVaultHash(first.cards[0].content);
  first = decideViralVaultCard(first, { action: 'skip', displayed: displayNextViralVaultCard(first) });
  const secondFixture = dayFixture(plan, '2026-10-02');
  secondFixture.cards = secondFixture.cards.slice(1);
  secondFixture.suggestions['card-1'] = { instant: '2026-10-02T09:00:00+08:00', evidence_ref: 'synthetic-new-time' };
  const second = createViralVaultPacket({ plan, id: 'packet-2', date: '2026-10-02', now: '2026-10-02T00:00:00Z',
    ...secondFixture, previous_packet: first }).packet;
  assert.equal(second.cards[0].carried_from, 'packet-1');
  assert.equal(viralVaultHash(second.cards[0].content), originalHash);
  assert.equal(second.cards[0].time_suggestions[0].instant, '2026-10-02T01:00:00.000Z');
});

test('rights failure blocks literal reuse instead of degrading to structure-only', () => {
  const plan = createViralVaultPlan(planInput()); const fixture = dayFixture(plan);
  fixture.reuse_proofs['card-3'].adaptation.source.rights.basis = 'unknown';
  assert.throws(() => createViralVaultPacket({ plan, id: 'packet-1', date: '2026-10-01', now, ...fixture }), /exactly match|rights-gated/);
});

test('disconnected exact approval can advance only through an explicit local handoff', () => {
  const plan = createViralVaultPlan(planInput()); const fixture = dayFixture(plan); fixture.cards[0].draft_id = null;
  const created = createViralVaultPacket({ plan, id: 'packet-1', date: '2026-10-01', now, ...fixture });
  const local = { ...validation(created.display), kind: 'local' };
  delete local.authoritative; delete local.tool; delete local.draft_id;
  let packet = recordViralVaultValidation(created.packet, { card_id: 'card-1', receipt: local, now });
  packet = decideViralVaultCard(packet, { action: 'approve', displayed: displayNextViralVaultCard(packet),
    confirmation: { at: now, evidence_ref: 'synthetic-owner' } });
  packet = completeViralVaultLocal(packet, { evidence_ref: 'synthetic-local-handoff', now });
  assert.equal(packet.cards[0].state, 'reviewed_local');
  assert.equal(displayNextViralVaultCard(packet).card.content.id, 'card-2');
});

test('creator CLI persists and resumes the workflow across calls', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'viral-vault-30-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const created = await runCreatorCommand('vault30-plan', { root, revision: 0, input: planInput() });
  const added = await runCreatorCommand('vault30-add-day', { root, revision: created.revision,
    input: { plan_id: created.result.id, id: 'packet-1', date: '2026-10-01', now, ...dayFixture(created.result) } });
  assert.equal(added.result.card.content.id, 'card-1');
  const resumed = await runCreatorCommand('vault30-continue', { root, input: { plan_id: created.result.id } });
  assert.equal(resumed.result.display_hash, added.result.display_hash);
  assert.equal((await runCreatorCommand('vault30-status', { root, input: {} })).result.provider_writes_performed, false);
});
