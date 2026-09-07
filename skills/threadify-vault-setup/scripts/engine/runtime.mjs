import { createHorizon } from './planner.mjs';
import { resolveAdaptation } from './sources.mjs';
import { readState, updateState } from './store.mjs';
import { createReviewPack, displayReview, approveReview, replaceCard, recordValidation, beginAttempt, reconcileAttempt, reviewHash } from './review.mjs';
import { localClock, resolveLocalTime } from './time.mjs';
import { createSetup, displaySetup, approveSetup, beginImport, reconcileImport } from './setup.mjs';
import { createFeedback, prepareFeedbackShare, reconcileFeedbackShare, prepareReminder } from './learning.mjs';
import { recordOutcome } from './outcomes.mjs';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const RESOLVED = new Set(['scheduled', 'published', 'observed', 'reviewed_local']);
const SETUP_WRITES = new Set(['setup', 'approve-setup', 'begin-import', 'reconcile-import']);
const LEARNING_WRITES = new Set(['record-feedback', 'begin-feedback-share', 'reconcile-feedback']);
const MUTATIONS = new Set(['plan', 'refresh-day', 'add-review', 'record-validation', 'approve', 'edit', 'begin-attempt', 'reconcile', 'record-outcome', 'complete-local', ...SETUP_WRITES, ...LEARNING_WRITES]);
const READS = new Set(['status', 'continue', 'display', 'resolve-source', 'display-setup', 'display-feedback', 'prepare-reminder']);
const initial = () => ({ schema_version: 'creator-workspace.v1', plans: [], reviews: [], feedback: [], setups: [] });
function workspace(payload) {
  const data = payload ?? initial();
  assert(data.schema_version === 'creator-workspace.v1', 'Unsupported creator workspace schema.');
  return { ...data, setups: data.setups ?? [] };
}
function getSetup(data, id) {
  const setup = data.setups.find((s) => s.id === id);
  assert(setup, 'Unknown setup.');
  return setup;
}
function getFeedback(data, id) {
  const event = data.feedback.find((e) => e.content.id === id);
  assert(event, 'Unknown feedback event.');
  return event;
}
function getReview(data, id) {
  const review = data.reviews.find((r) => r.id === id);
  assert(review, 'Unknown daily review.');
  return review;
}
function getPlan(data, id) {
  const plan = data.plans.find((p) => p.id === id);
  assert(plan, 'Unknown horizon plan.');
  return plan;
}
function sourceHistory(data, accountId) {
  const cards = data.reviews.flatMap((r) => r.cards).filter((c) => c.content.account_id === accountId);
  return { ids: cards.map((c) => c.content.source.id), urls: cards.map((c) => c.content.source.url) };
}
function summary(data) {
  const cards = data.reviews.flatMap((r) => r.cards);
  return { plans: data.plans.length, daily_reviews: data.reviews.length,
    plan_list: data.plans.map((p) => ({ id: p.id, label: p.label, account_id: p.preferences.account_id, start_date: p.days[0].date })),
    draft: cards.filter((c) => c.state === 'draft').length,
    validated: cards.filter((c) => c.state === 'validated').length,
    approved: cards.filter((c) => c.state === 'approved').length,
    scheduled: cards.filter((c) => c.state === 'scheduled').length,
    published: cards.filter((c) => ['published', 'observed'].includes(c.state)).length,
    local_reviewed: cards.filter((c) => c.state === 'reviewed_local').length,
    vault_saved: data.setups.flatMap((s) => s.items).filter((i) => i.state === 'saved').length,
    local_feedback: data.feedback.length,
    feedback_sent: data.feedback.filter((e) => e.state === 'sent').length,
    unresolved: cards.filter((c) => !RESOLVED.has(c.state)).length,
    provider_writes_performed: false };
}

function continuation(data, planId) {
  const plan = getPlan(data, planId);
  const reviews = plan.days.map((day) => data.reviews.find((r) => r.plan_id === planId && r.date === day.date)).filter(Boolean);
  const unresolvedReviews = reviews.map((review) => ({ review,
    cards: review.cards.filter((c) => !RESOLVED.has(c.state)) })).filter((entry) => entry.cards.length);
  const pending = unresolvedReviews.find((entry) => entry.cards.some((c) => ['unknown', 'attempt_pending'].includes(c.state)));
  const existing = pending ?? unresolvedReviews[0];
  if (existing) return { action: pending ? 'reconcile_attempts' : 'resume_review',
    review_id: existing.review.id, cards: existing.cards };
  for (const day of plan.days) {
    const review = reviews.find((r) => r.date === day.date);
    if (!review) return { action: 'prepare_day', plan_id: planId, day, preferences: plan.preferences,
      note: 'Refresh evidence, fill source gaps and prepare exact drafts for review; nothing is scheduled.' };
  }
  const localOnly = data.reviews.filter((r) => r.plan_id === planId).every((r) => r.cards.every((c) => c.state === 'reviewed_local'));
  return { action: localOnly ? 'horizon_reviewed_locally' : 'horizon_delivery_recorded', plan_id: planId,
    note: 'Review and schedule records do not prove publication or growth.' };
}

function addReview(data, input) {
  const plan = getPlan(data, input.plan_id);
  const day = plan.days.find((d) => d.date === input.date);
  assert(day, 'Review day is outside the blueprint.');
  assert(!data.reviews.some((r) => r.id === input.id || (r.plan_id === input.plan_id && r.date === input.date)), 'Daily review already exists; resume or edit it.');
  assert(Array.isArray(input.cards) && input.cards.length === day.slots.length, 'Daily review must match blueprint volume.');
  for (const slot of day.slots) {
    const card = input.cards.find((c) => c.id === slot.id);
    assert(card && card.account_id === plan.preferences.account_id && card.timezone === slot.timezone
      && card.source?.id === slot.source_id && card.source?.url === slot.source_url && card.format === slot.format,
    'Review identity, source, account, timezone and format must match the blueprint.');
    assert(slot.source_id !== null, 'Resolve missing blueprint sources before creating a review.');
    resolveLocalTime(slot.local_date, slot.local_time, slot.timezone, card.scheduled_at);
    assert(card.cta === 'none' || (slot.cta === 'earned_optional' && card.offer_id === slot.offer_id), 'CTA must match the selected plan offer.');
    validateReuse(card, input.reuse_proofs?.[card.id], input.now);
  }
  const review = { ...createReviewPack(input), plan_id: input.plan_id, date: input.date };
  review.reuse_evidence = Object.fromEntries(input.cards.filter((c) => c.adaptation_mode !== 'structure_only')
    .map((c) => [c.id, structuredClone(input.reuse_proofs[c.id])]));
  data.reviews.push(review);
  return displayReview(review);
}

function validateReuse(card, proof, now = proof?.context?.now) {
  if (card.adaptation_mode === 'structure_only') return;
  assert(proof && proof.context?.account_id === card.account_id && proof.adaptation?.source?.id === card.source.id
    && proof.adaptation.source.url === card.source.url, 'Literal review requires matching source-rights evidence.');
  const resolved = resolveAdaptation(proof.adaptation, { ...proof.context, now });
  assert(resolved.mode === card.adaptation_mode && JSON.stringify(resolved.parts) === JSON.stringify(card.parts),
    'Literal review copy must match the rights-gated deterministic source resolution.');
  assert(card.method === 'host_authored', 'Literal reuse must preserve exact copy, not Brain regeneration.');
}

export async function runCreatorCommand(command, { root, revision, input = {} }) {
  assert(MUTATIONS.has(command) || READS.has(command), 'Unsupported creator command. No publish command exists.');
  if (command === 'resolve-source') return { result: resolveAdaptation(input.adaptation, input.context) };
  if (READS.has(command)) {
    const state = await readState(root); const data = workspace(state.payload);
    if (command === 'prepare-reminder') {
      const plan = getPlan(data, input.plan_id);
      return { revision: state.revision, result: prepareReminder({ ...input, timezone: input.timezone ?? plan.preferences.timezone }) };
    }
    if (command === 'display-feedback') {
      const event = getFeedback(data, input.feedback_id);
      return { revision: state.revision, result: { content: event.content, hash: event.hash, state: event.state } };
    }
    const result = command === 'status' ? summary(data)
      : command === 'continue' ? continuation(data, input.plan_id)
        : command === 'display-setup' ? displaySetup(getSetup(data, input.setup_id))
        : displayReview(getReview(data, input.review_id), input.card_ids);
    return { revision: state.revision, result };
  }
  let result;
  const state = await updateState(root, revision, (payload) => {
    const data = workspace(payload);
    if (LEARNING_WRITES.has(command)) {
      if (command === 'record-feedback') {
        const card = getReview(data, input.review_id).cards.find((c) => c.content.id === input.card_id);
        assert(card && card.content.account_id === input.account_id
          && JSON.stringify(card.content.parts) === JSON.stringify(input.original_parts), 'Feedback original must match the current reviewed card; record feedback before applying the edit.');
        const event = createFeedback(input);
        const existing = data.feedback.find((e) => e.content.id === event.content.id);
        assert(!existing || existing.hash === event.hash, 'Feedback ID already records different content; use a new event ID.');
        if (!existing) data.feedback.push(event);
        result = { feedback_id: event.content.id, hash: event.hash, state: existing?.state ?? event.state };
      } else {
        const current = getFeedback(data, input.feedback_id);
        const next = command === 'begin-feedback-share' ? prepareFeedbackShare(current, input.approval)
          : reconcileFeedbackShare(current, input.receipt);
        data.feedback[data.feedback.indexOf(current)] = next;
        result = command === 'begin-feedback-share' ? { action: 'feedback_share_persisted', event: next, provider_writes_performed: false }
          : { feedback_id: next.content.id, state: next.state };
      }
    } else if (SETUP_WRITES.has(command)) {
      if (command === 'setup') {
        assert(!data.setups.some((s) => s.id === input.id), 'Setup already exists; resume its saved state.');
        const setup = createSetup(input); data.setups.push(setup); result = displaySetup(setup);
      } else {
        const current = getSetup(data, input.setup_id);
        const next = command === 'approve-setup' ? approveSetup(current, input.displayed, input.confirmation)
          : command === 'begin-import' ? beginImport(current, input.item_id, input.access, input.now, data.setups)
            : reconcileImport(current, input.item_id, input.receipt);
        data.setups[data.setups.indexOf(current)] = next;
        result = command === 'begin-import' ? { action: 'import_attempt_persisted', setup_id: next.id,
          item: next.items.find((i) => i.id === input.item_id), provider_writes_performed: false }
          : { setup_id: next.id, states: next.items.map((i) => ({ id: i.id, state: i.state })) };
      }
    } else if (command === 'plan') {
      assert(!data.plans.some((p) => p.id === input.id), 'Plan already exists; continue it.');
      const history = sourceHistory(data, input.preferences?.account_id);
      result = createHorizon({ ...input, used_source_ids: [...(input.used_source_ids ?? []), ...history.ids],
        used_source_urls: [...(input.used_source_urls ?? []), ...history.urls] }); data.plans.push(result);
    } else if (command === 'refresh-day') {
      const plan = getPlan(data, input.plan_id);
      const index = plan.days.findIndex((d) => d.date === input.date);
      assert(index >= 0 && typeof input.evidence_ref === 'string' && input.evidence_ref.trim(), 'Known day and fresh source evidence reference required.');
      assert(!data.reviews.some((r) => r.plan_id === plan.id && r.date === input.date), 'Day already has a review; edit affected cards explicitly instead.');
      const reserved = plan.days.filter((d) => d.date !== input.date).flatMap((d) => d.slots).filter((s) => s.source_id);
      const history = sourceHistory(data, plan.preferences.account_id);
      const refreshed = createHorizon({ id: plan.id, start_date: input.date, horizon: 'day', now: input.now,
        lane_offset: index * plan.preferences.posts_per_day, preferences: plan.preferences, sources: input.sources,
        used_source_ids: [...reserved.map((s) => s.source_id), ...history.ids],
        used_source_urls: [...reserved.map((s) => s.source_url), ...history.urls] }).days[0];
      refreshed.drafting = plan.days[index].drafting;
      const change = { date: input.date, at: input.now, evidence_ref: input.evidence_ref,
        previous_hash: reviewHash(plan.days[index]), current_hash: reviewHash(refreshed) };
      plan.days[index] = refreshed; plan.refresh_history = [...(plan.refresh_history ?? []), change];
      result = refreshed;
    } else if (command === 'add-review') result = addReview(data, input);
    else {
      const current = getReview(data, input.review_id);
      let next;
      if (command === 'approve') next = approveReview(current, input.displayed, input.confirmation);
      if (command === 'record-validation') next = recordValidation(current, input.card_id, input.receipt, input.now);
      if (command === 'edit') {
        const preferences = getPlan(data, current.plan_id).preferences;
        assert(input.card?.account_id === preferences.account_id,
          'Edited card must retain the plan account; create a separate plan for another account.');
        assert(localClock(input.card.scheduled_at, input.card.timezone).date === current.date,
          'Edited card must remain on its review day; prepare a destination-day plan/review for another date.');
        validateReuse(input.card, input.reuse_proof, input.now);
        next = replaceCard(current, input.card);
        next.reuse_evidence = { ...(next.reuse_evidence ?? {}) };
        if (input.card.adaptation_mode === 'structure_only') delete next.reuse_evidence[input.card.id];
        else next.reuse_evidence[input.card.id] = structuredClone(input.reuse_proof);
        const ctas = next.cards.filter((c) => c.content.cta !== 'none');
        assert(ctas.length <= (preferences.commercial_mode === 'growth' ? 0 : 1)
          && ctas.every((c) => c.content.offer_id === preferences.offer.id), 'Edited daily CTA exceeds the selected commercial policy.');
      }
      if (command === 'begin-attempt') {
        const card = current.cards.find((c) => c.content.id === input.card_id);
        assert(card, 'Unknown review card.');
        // A saved proof clock cannot keep expired rights, claims or replacement
        // facts valid when an upfront draft is scheduled on a later day.
        validateReuse(card.content, current.reuse_evidence?.[card.content.id], input.now);
        const occupied = data.reviews.filter((r) => r.id !== current.id).flatMap((r) => r.cards)
          .some((other) => ['attempt_pending', 'unknown', 'scheduled', 'published', 'observed'].includes(other.state)
            && other.content.account_id === card.content.account_id
            && Date.parse(other.content.scheduled_at) === Date.parse(card.content.scheduled_at));
        assert(!occupied, 'Proposed slot is occupied by another local delivery attempt.');
        next = beginAttempt(current, input.card_id, input.preflight, input.now);
      }
      if (command === 'reconcile') next = reconcileAttempt(current, input.card_id, input.receipt);
      if (command === 'record-outcome') next = recordOutcome(current, input.card_id, input.receipt);
      if (command === 'complete-local') {
        assert(typeof input.evidence_ref === 'string' && input.evidence_ref.trim() && Number.isFinite(Date.parse(input.now)), 'Explicit local handoff evidence required.');
        assert(current.cards.every((c) => c.state === 'approved' && c.content.draft_id === null), 'Only approved disconnected drafts can be completed locally.');
        next = structuredClone(current);
        for (const c of next.cards) { c.state = 'reviewed_local'; c.local_handoff = { evidence_ref: input.evidence_ref, at: input.now }; }
      }
      data.reviews[data.reviews.indexOf(current)] = next;
      result = command === 'begin-attempt'
        ? { action: 'attempt_persisted', review_id: next.id, card: next.cards.find((c) => c.content.id === input.card_id),
          note: 'The pending attempt is committed before this response. Host may now perform only the separately approved provider action, then reconcile its receipt.' }
        : { review_id: next.id, states: next.cards.map((c) => ({ id: c.content.id, state: c.state })) };
    }
    return data;
  });
  return { revision: state.revision, result };
}
