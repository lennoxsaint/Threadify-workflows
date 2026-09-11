import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  actionHash,
  beginActionAttempt,
  createConversationWorkspace,
  decideAction,
  displayActionReview,
  groupQuestions,
  importConversationRecords,
  planFollowThrough,
  planNextActions,
  prepareAction,
  prepareReminder,
  recordActionReceipt,
  recordCommitment,
  recordOutcome,
  saveQuestionContent,
  summarizeWeeklyOutcomes,
} from '../../lib/conversations/index.mjs';
import { reviewHash } from '../../lib/creator/review.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(await readFile(path.resolve(here, '../../examples/conversations/walkthrough.fixture.json'), 'utf8'));

function empty() { return createConversationWorkspace(fixture.init); }
function loaded() { return importConversationRecords(empty(), fixture.evidence_import); }
function prepared(workspace = loaded(), overrides = {}) { return prepareAction(workspace, { ...fixture.action, ...overrides }); }
function approved(workspace = prepared()) {
  const display = displayActionReview(workspace, fixture.action.id);
  return decideAction(workspace, display, fixture.decision);
}
function begun(workspace = approved(), overrides = {}) {
  return beginActionAttempt(workspace, { ...fixture.attempt, ...overrides });
}

test('Your Next Moves requests Offer Builder, returns at most three evidenced candidates, then resumes unresolved work', () => {
  assert.deepEqual(planNextActions(empty()), {
    schema_version: 'conversation-next-actions.v1', status: 'offer_required', actions: [], review_now: null,
    next_workflow: 'offer-builder', reason: 'missing_active_offer',
  });
  const candidates = planNextActions(loaded());
  assert.equal(candidates.status, 'candidates');
  assert.equal(candidates.actions.length, 3);
  assert(candidates.actions.every((entry) => entry.evidence.source.url && entry.evidence.source.relevant_excerpt));
  const resume = planNextActions(prepared());
  assert.equal(resume.status, 'resume_unresolved');
  assert.deepEqual(resume.actions.map((entry) => entry.id), [fixture.action.id]);
  assert.equal(resume.review_now, fixture.action.id);

  const offerOnly = importConversationRecords(empty(), { import_key: 'offer-only', imported_at: fixture.init.now,
    records: [fixture.evidence_import.records[0]] });
  assert.equal(planNextActions(offerOnly).status, 'no_candidates');
});

test('imports are idempotent by exact key and record IDs fail closed on conflicting facts', () => {
  const once = loaded();
  assert.deepEqual(importConversationRecords(once, fixture.evidence_import), once);
  assert.throws(() => importConversationRecords(once, { ...fixture.evidence_import,
    records: fixture.evidence_import.records.slice(0, -1) }), /Import key/);
  assert.throws(() => importConversationRecords(once, { import_key: 'other-key', imported_at: fixture.evidence_import.imported_at,
    records: [{ ...fixture.evidence_import.records[1], observed_at: '2026-09-09T00:00:00Z' }] }), /Evidence ID/);
  assert.throws(() => importConversationRecords(once, { import_key: 'raw-thread', imported_at: fixture.evidence_import.imported_at,
    records: [{ ...fixture.evidence_import.records[1], id: 'raw-thread', full_thread: 'private transcript body' }] }),
  /unsupported fields: full_thread/);
});

test('review displays one exact action and any edit invalidates its approval', () => {
  const draft = prepared();
  const display = displayActionReview(draft, fixture.action.id);
  assert.equal(display.action.exact_text, fixture.action.exact_text);
  assert.equal(display.consent.ready, true);
  const accepted = decideAction(draft, display, fixture.decision);
  assert.equal(accepted.actions[0].state, 'approved');
  const edited = prepareAction(accepted, { ...fixture.action, exact_text: `${fixture.action.exact_text} Thanks.`, now: '2026-09-11T07:53:00Z' });
  assert.equal(edited.actions[0].state, 'draft');
  assert.equal(edited.actions[0].approval, null);
  assert.throws(() => decideAction(edited, display, fixture.decision), /changed since display/);
});

test('a rejected action stays as history while Your Next Moves advances to unused evidence', () => {
  const draft = prepared();
  const display = displayActionReview(draft, fixture.action.id);
  const rejected = decideAction(draft, display, { ...fixture.decision, decision: 'reject' });
  const next = planNextActions(rejected);
  assert.equal(next.status, 'candidates');
  assert.deepEqual(next.actions.map((entry) => entry.evidence.id), ['candidate-two', 'candidate-three']);
  assert(!next.actions.some((entry) => entry.evidence.id === 'candidate-one'));
});

test('recipient interest, channel permission and exact user approval remain separate gates', () => {
  const withoutPermission = importConversationRecords(empty(), { import_key: 'no-permission', imported_at: fixture.evidence_import.imported_at,
    records: fixture.evidence_import.records.filter((entry) => entry.id !== 'permission-one') });
  const draft = prepared(withoutPermission, { evidence_ids: ['candidate-one', 'interest-one'] });
  const display = displayActionReview(draft, fixture.action.id);
  assert.equal(display.consent.ready, false);
  const userApproved = decideAction(draft, display, fixture.decision);
  assert.throws(() => beginActionAttempt(userApproved, fixture.attempt), /Recipient interest and channel permission/);

  assert.throws(() => prepareAction(loaded(), { ...fixture.action, id: 'unsolicited-permission-dm',
    action_type: 'request_channel_permission', evidence_ids: ['candidate-one'], now: fixture.action.now }),
  /existing public conversation/);
  const publicRequest = prepareAction(loaded(), { ...fixture.action, id: 'public-permission-request',
    action_type: 'request_channel_permission', channel: 'threads_public', evidence_ids: ['candidate-one'], now: fixture.action.now });
  assert.equal(publicRequest.actions.at(-1).state, 'draft');
});

test('unavailable or stale source reinspection blocks action and historical evidence remains stored', () => {
  const workspace = approved();
  assert.throws(() => beginActionAttempt(workspace, { ...fixture.attempt, reinspections: fixture.attempt.reinspections.map((entry) => ({
    ...entry, availability: 'unavailable',
  })) }), /Unavailable sources/);
  assert.throws(() => beginActionAttempt(workspace, { ...fixture.attempt, reinspections: fixture.attempt.reinspections.map((entry) => ({
    ...entry, checked_at: '2026-09-11T07:40:00Z',
  })) }), /Fresh source/);
  assert.equal(workspace.evidence.find((entry) => entry.id === 'candidate-three').source.availability, 'unavailable');
});

test('pending and unknown attempts cannot replay; exact receipts are idempotent and successes are immutable', () => {
  const pending = begun();
  assert.equal(pending.actions[0].state, 'attempt_pending');
  assert.throws(() => beginActionAttempt(pending, fixture.attempt), /approval/);
  const attempt = pending.actions[0].attempts.at(-1);
  const baseReceipt = { ...fixture.receipt, idempotency_key: attempt.idempotency_key, action_hash: attempt.action_hash,
    account_id: pending.account_id, destination: pending.actions[0].destination,
    exact_text_sha256: reviewHash(pending.actions[0].exact_text) };
  const uncertain = recordActionReceipt(pending, { action_id: fixture.action.id,
    receipt: { ...baseReceipt, id: 'unknown-receipt', status: 'unknown', evidence_basis: 'owner_reported' } });
  assert.equal(uncertain.actions[0].state, 'unknown');
  assert.throws(() => beginActionAttempt(uncertain, fixture.attempt), /approval/);
  const succeeded = recordActionReceipt(pending, { action_id: fixture.action.id, receipt: baseReceipt });
  assert.equal(succeeded.actions[0].state, 'succeeded');
  assert.deepEqual(recordActionReceipt(succeeded, { action_id: fixture.action.id, receipt: baseReceipt }), succeeded);
  assert.throws(() => recordActionReceipt(succeeded, { action_id: fixture.action.id,
    receipt: { ...baseReceipt, evidence_ref: 'changed' } }), /different evidence/);
});

test('only provider-observed confirmed absence permits a safe retry with the same idempotency key', () => {
  const pending = begun(); const attempt = pending.actions[0].attempts.at(-1);
  const receipt = { ...fixture.receipt, id: 'absence', status: 'confirmed_not_sent', evidence_basis: 'owner_reported',
    idempotency_key: attempt.idempotency_key, action_hash: attempt.action_hash, account_id: pending.account_id,
    destination: pending.actions[0].destination, exact_text_sha256: reviewHash(pending.actions[0].exact_text) };
  assert.throws(() => recordActionReceipt(pending, { action_id: fixture.action.id, receipt }), /provider-observed origin/);
  const retryable = recordActionReceipt(pending, { action_id: fixture.action.id,
    receipt: { ...receipt, evidence_basis: 'provider_observed' } });
  assert.equal(retryable.actions[0].state, 'approved');
  const retried = beginActionAttempt(retryable, { ...fixture.attempt, now: '2026-09-11T08:00:00Z',
    reinspections: fixture.attempt.reinspections.map((entry) => ({ ...entry, checked_at: '2026-09-11T07:59:00Z', valid_until: '2026-09-11T08:09:00Z' })) });
  assert.equal(retried.actions[0].attempts[0].idempotency_key, retried.actions[0].attempts[1].idempotency_key);
});

test('Follow Through separates missing timing, due preparation and immutable terminal outcomes', () => {
  let workspace = loaded();
  for (const commitment of fixture.commitments) workspace = recordCommitment(workspace, commitment);
  const open = planFollowThrough(workspace, { now: fixture.weekly.as_of });
  assert.deepEqual(open.needs_timing_question, ['commitment-needs-time']);
  assert.deepEqual(open.due_for_preparation, ['commitment-due']);
  assert.equal(open.silence_grants_permission, false);
  assert.equal(open.automatic_reminders, false);
  const completed = recordOutcome(workspace, fixture.outcome);
  assert.deepEqual(planFollowThrough(completed, { now: fixture.weekly.as_of }).terminal,
    [{ id: 'commitment-due', status: 'fulfilled' }]);
  assert.throws(() => recordOutcome(completed, { ...fixture.outcome, id: 'outcome-two', status: 'withdrawn' }), /immutable/);
  assert.deepEqual(prepareReminder(completed, { now: fixture.weekly.as_of }), {
    schema_version: 'conversation-reminder.v1', status: 'host_native_opt_in_required', created: false, automatic: false,
    candidate_commitment_ids: ['commitment-needs-time'], instruction: 'The host may offer a native reminder only after explicit user opt-in.',
  });
});

test('commitment evidence must match the same offer identity', () => {
  const wrongOffer = { ...fixture.evidence_import.records.find((entry) => entry.id === 'promise-one'), id: 'wrong-offer-promise', offer_id: 'other-offer' };
  const workspace = importConversationRecords(loaded(), { import_key: 'wrong-offer', imported_at: fixture.evidence_import.imported_at,
    records: [wrongOffer] });
  assert.throws(() => recordCommitment(workspace, { ...fixture.commitments[0], id: 'wrong-offer-commitment',
    evidence_ids: [wrongOffer.id] }), /same conversation and offer/);
});

test('Questions to Content groups single and repeated questions and rejects private identifiers in host copy', () => {
  const workspace = loaded();
  const groups = groupQuestions(workspace, { offer_id: 'offer-main' });
  assert.deepEqual(groups.groups.map((entry) => [entry.question_key, entry.occurrence, entry.count]), [
    ['reply-to-next-step', 'repeated', 2], ['follow-up-frequency', 'single', 1],
  ]);
  const saved = saveQuestionContent(workspace, fixture.content);
  assert.equal(saved.content[0].authorship, 'host_authored');
  assert.equal(saved.content[0].privacy_check.passed, true);
  assert.throws(() => saveQuestionContent(workspace, { ...fixture.content, id: 'unsafe-content',
    exact_text: 'This came from synthetic-recipient-two.' }), /private identifier/);
  assert.throws(() => saveQuestionContent(workspace, { ...fixture.content, id: 'unsafe-link',
    exact_text: 'See https://example.invalid/threads/conversation-two.' }), /private identifier/);
});

test('Weekly Buyer Outcomes uses seven saved-timezone dates and never turns missing coverage into zero', () => {
  let workspace = loaded();
  for (const commitment of fixture.commitments) workspace = recordCommitment(workspace, commitment);
  workspace = recordOutcome(workspace, fixture.outcome);
  const weekly = summarizeWeeklyOutcomes(workspace, fixture.weekly);
  assert.deepEqual(weekly.window, { start_local_date: '2026-09-05', end_local_date: '2026-09-11',
    as_of: fixture.weekly.as_of, calendar_days: 7 });
  assert.equal(weekly.explored_opportunities.observed_minimum, 1);
  assert.equal(weekly.explored_opportunities.total, null);
  assert.equal(weekly.leads.observed_minimum, 1);
  assert.equal(weekly.leads.total, null);
  assert.equal(weekly.agreed_steps.observed_minimum, 1);
  assert.equal(weekly.outcomes.owner_reported, 0);
  assert.equal(weekly.outcomes.provider_observed, 1);

  const publicQuestionsOnly = importConversationRecords(empty(), { import_key: 'questions-only', imported_at: fixture.evidence_import.imported_at,
    records: [fixture.evidence_import.records[0], fixture.evidence_import.records.find((entry) => entry.id === 'question-three')] });
  const missing = summarizeWeeklyOutcomes(publicQuestionsOnly, { as_of: fixture.weekly.as_of });
  assert.equal(missing.leads.observed_minimum, 0);
  assert.equal(missing.leads.total, null);
  assert.equal(missing.leads.coverage, 'unknown');
});

test('action preparation cannot bypass missing or inactive confirmed offer context', () => {
  const workspace = loaded();
  const inactive = structuredClone(workspace);
  inactive.offers.forEach((offer) => { offer.status = 'inactive'; });
  assert.throws(() => prepared(inactive), /confirmed active offer/);
  assert.throws(() => prepared({ ...workspace, offers: [] }), /confirmed active offer/);
});
