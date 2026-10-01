import crypto from 'node:crypto';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const CHECKPOINT_HOURS = { engagement_72h: 72, commercial_7d: 168 };
const METRICS = new Set(['engagement_rate', 'click_rate', 'subscription_rate', 'revenue_per_1000_views']);

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function publicAccount(account) {
  return {
    label: account.label,
    verified: account.verified,
    id_sha256: hash(account.id),
  };
}

function finiteNonNegative(value) {
  return Number.isFinite(value) && value >= 0;
}

function roundRate(value) {
  return Number(value.toFixed(8));
}

function observedRate(observation) {
  const metric = observation.context.hypothesis.primary_metric;
  const metrics = observation.metrics ?? {};
  if (metric === 'engagement_rate') {
    if (!finiteNonNegative(metrics.views) || metrics.views === 0) return null;
    const fields = ['likes', 'replies', 'reposts', 'quotes', 'shares'];
    if (!fields.every((field) => finiteNonNegative(metrics[field]))) return null;
    return roundRate(fields.reduce((sum, field) => sum + metrics[field], 0) / metrics.views);
  }
  if (metric === 'click_rate') {
    if (!finiteNonNegative(metrics.views) || metrics.views === 0 || !finiteNonNegative(metrics.tracked_clicks)) return null;
    return roundRate(metrics.tracked_clicks / metrics.views);
  }
  if (metric === 'subscription_rate') {
    if (!finiteNonNegative(metrics.tracked_clicks) || metrics.tracked_clicks === 0 || !finiteNonNegative(metrics.subscriptions)) return null;
    return roundRate(metrics.subscriptions / metrics.tracked_clicks);
  }
  if (metric === 'revenue_per_1000_views') {
    if (!finiteNonNegative(metrics.views) || metrics.views === 0 || !finiteNonNegative(metrics.revenue_cents)) return null;
    return roundRate((metrics.revenue_cents / metrics.views) * 1000);
  }
  return null;
}

function validateObservation(observation, workspace) {
  assert(observation?.schema_version === 'growth-loop-observation.v1', 'Expected growth-loop-observation.v1.');
  assert(typeof observation.observation_id === 'string' && observation.observation_id, 'Observation ID is required.');
  assert(typeof observation.post_id === 'string' && observation.post_id, 'Post ID is required.');
  assert(Object.hasOwn(CHECKPOINT_HOURS, observation.checkpoint), 'Checkpoint must be engagement_72h or commercial_7d.');
  assert(observation.account_id === workspace.config.account.id, 'Observation account does not match the verified account.');
  assert(observation.authoritative === true && observation.evidence_ref, 'Authoritative evidence reference is required.');
  const published = Date.parse(observation.published_at);
  const checked = Date.parse(observation.checked_at);
  assert(Number.isFinite(published) && Number.isFinite(checked) && checked >= published, 'Valid publication and check times are required.');
  const requiredHours = CHECKPOINT_HOURS[observation.checkpoint];
  assert(checked - published >= requiredHours * 60 * 60 * 1000,
    `${observation.checkpoint} evidence must be at least ${requiredHours} hours mature.`);
  const hypothesis = observation.context?.hypothesis;
  assert(hypothesis?.id && hypothesis.statement && hypothesis.changed_dimension && hypothesis.changed_value,
    'A complete single-dimension hypothesis is required.');
  assert(METRICS.has(hypothesis.primary_metric), 'Unsupported primary metric.');
  if (observation.checkpoint === 'engagement_72h') {
    assert(hypothesis.primary_metric === 'engagement_rate', 'The 72-hour checkpoint requires engagement rate.');
  } else {
    assert(['click_rate', 'subscription_rate', 'revenue_per_1000_views'].includes(hypothesis.primary_metric),
      'The 7-day checkpoint requires a commercial metric.');
  }
  assert(observation.matched_baseline && finiteNonNegative(observation.matched_baseline.rate)
    && Number.isSafeInteger(observation.matched_baseline.sample_size)
    && observation.matched_baseline.sample_size >= 0, 'A matched baseline is required.');
  assert(typeof observation.safety_issue === 'boolean' && typeof observation.rights_issue === 'boolean',
    'Safety and rights checks are required.');
}

function classifyObservation(observation) {
  const rate = observedRate(observation);
  const commercialAttributionKnown = observation.checkpoint !== 'commercial_7d'
    || observation.attribution?.post_level === true;
  const comparable = rate !== null && observation.matched_baseline.sample_size >= 5 && commercialAttributionKnown;
  let result = 'unknown';
  if (comparable) {
    if (rate > observation.matched_baseline.rate) result = 'positive';
    else if (rate < observation.matched_baseline.rate) result = 'negative';
    else result = 'neutral';
  }
  return {
    observed_rate: rate,
    comparable,
    result,
    commercial_attribution: commercialAttributionKnown ? 'known' : 'unknown',
  };
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function rebuildHypotheses(observations) {
  const grouped = new Map();
  for (const observation of observations) {
    const definition = observation.context.hypothesis;
    if (!grouped.has(definition.id)) grouped.set(definition.id, { definition, observations: [] });
    const group = grouped.get(definition.id);
    const identity = ({ id, statement, changed_dimension, changed_value }) => ({ id, statement, changed_dimension, changed_value });
    assert(hash(identity(group.definition)) === hash(identity(definition)), `Hypothesis ${definition.id} changed definition.`);
    group.observations.push(observation);
  }
  return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([id, group]) => {
    const comparable = group.observations.filter((item) => item.analysis.comparable);
    const reachTests = comparable.filter((item) => item.checkpoint === 'engagement_72h');
    const basis = reachTests;
    const positiveCount = basis.filter((item) => item.analysis.result === 'positive').length;
    const distinctDays = new Set(basis.map((item) => item.published_at.slice(0, 10))).size;
    const medianObserved = median(basis.map((item) => item.analysis.observed_rate));
    const medianBaseline = median(basis.map((item) => item.matched_baseline.rate));
    const hasSafetyOrRightsIssue = group.observations.some((item) => item.safety_issue || item.rights_issue);
    const commercialTests = comparable.filter((item) => item.checkpoint === 'commercial_7d');
    const commercialRegression = commercialTests.some((item) => item.analysis.result === 'negative') ? 'present'
      : commercialTests.length ? 'absent' : 'unknown';
    const promoted = basis.length >= 3 && distinctDays >= 2 && positiveCount >= 2
      && medianObserved > medianBaseline && !hasSafetyOrRightsIssue && commercialRegression !== 'present';
    return {
      id,
      statement: group.definition.statement,
      changed_dimension: group.definition.changed_dimension,
      changed_value: group.definition.changed_value,
      primary_metric: 'engagement_rate',
      status: promoted ? 'promoted' : 'testing',
      comparable_test_count: basis.length,
      positive_test_count: positiveCount,
      distinct_test_days: distinctDays,
      median_observed_rate: medianObserved,
      median_baseline_rate: medianBaseline,
      commercial_regression: commercialRegression,
      safety_or_rights_issue: hasSafetyOrRightsIssue,
    };
  });
}

export function setGrowthLoopPaused(workspace, paused, now = new Date().toISOString()) {
  assert(workspace?.schema_version === 'growth-loop-workspace.v1', 'Growth Loop is not set up.');
  assert(typeof paused === 'boolean', 'Pause state must be boolean.');
  workspace.paused = paused;
  workspace.updated_at = now;
  return growthLoopStatus(workspace);
}

export function configureGrowthLoopRunner(workspace, input, now = new Date().toISOString()) {
  assert(workspace?.schema_version === 'growth-loop-workspace.v1', 'Growth Loop is not set up.');
  assert(input?.schema_version === 'growth-loop-runner.v1' && input.scheduler, 'Expected growth-loop-runner.v1.');
  const scheduler = input.scheduler;
  assert(['codex', 'claude', 'cursor', 'gemini', 'openclaw', 'hermes', 'manual'].includes(scheduler.adapter),
    'Unsupported scheduler adapter.');
  assert(typeof scheduler.route === 'string' && scheduler.route && scheduler.interval_hours === 6,
    'Runner route and six-hour interval are required.');
  assert(scheduler.timezone === workspace.config.timezone, 'Runner timezone must match the Growth Loop timezone.');
  assert(typeof scheduler.verified === 'boolean', 'Runner verification state is required.');
  if (scheduler.verified) {
    assert(scheduler.job_id && Number.isFinite(Date.parse(scheduler.next_run_at))
      && scheduler.verified_invocation_id && scheduler.device_requirement && scheduler.pause_command,
    'Verified runner proof requires job ID, next run, real invocation, device requirement, and pause command.');
  }
  workspace.config.scheduler = structuredClone(scheduler);
  workspace.updated_at = now;
  return growthLoopStatus(workspace);
}

export function displayGrowthLoopHypotheses(workspace) {
  assert(workspace?.schema_version === 'growth-loop-workspace.v1', 'Growth Loop is not set up.');
  return {
    workflow_id: 'growth-loop',
    hypotheses: structuredClone(workspace.hypotheses),
    next_challenger_hypothesis_ids: nextHypothesisIds(workspace),
  };
}

export function displayGrowthLoopRun(workspace, date) {
  assert(workspace?.schema_version === 'growth-loop-workspace.v1', 'Growth Loop is not set up.');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(date ?? ''), 'An ISO --date is required.');
  const day = workspace.days.find((item) => item.date === date);
  const intents = workspace.save_intents.filter((item) => item.date === date);
  return {
    workflow_id: 'growth-loop',
    date,
    paused: workspace.paused,
    scheduler: structuredClone(workspace.config.scheduler),
    day: day ? summarizeDay(day) : null,
    save_receipts: intents.map((intent) => ({
      intent_id: intent.intent_id,
      card_id: intent.card_id,
      account_label: workspace.config.account.label,
      account_id_sha256: hash(intent.account_id),
      provider_draft_id: intent.receipt?.provider_draft_id ?? null,
      content_sha256: intent.content_sha256,
      status: intent.status,
      authoritative: intent.receipt?.authoritative ?? false,
    })),
  };
}

export function applyGrowthLoopScan(workspace, input, now = new Date().toISOString()) {
  assert(workspace?.schema_version === 'growth-loop-workspace.v1', 'Growth Loop is not set up.');
  assert(!workspace.paused, 'Growth Loop is paused.');
  assert(input?.schema_version === 'growth-loop-scan.v1' && Array.isArray(input.observations) && input.observations.length,
    'Expected growth-loop-scan.v1 with at least one observation.');
  const accepted = [];
  const replayed = [];
  for (const raw of input.observations) {
    validateObservation(raw, workspace);
    const observationHash = hash(raw);
    const existing = workspace.observations.find((item) => item.observation_id === raw.observation_id
      || (item.post_id === raw.post_id && item.checkpoint === raw.checkpoint));
    if (existing) {
      assert(existing.input_sha256 === observationHash, `Conflicting replay for ${raw.post_id}/${raw.checkpoint}.`);
      replayed.push(raw.observation_id);
      continue;
    }
    const analysis = classifyObservation(raw);
    workspace.observations.push({ ...structuredClone(raw), input_sha256: observationHash, analysis });
    accepted.push({
      observation_id: raw.observation_id,
      post_id: raw.post_id,
      checkpoint: raw.checkpoint,
      observed_rate: analysis.observed_rate,
      comparable: analysis.comparable,
      result: analysis.result,
      commercial_attribution: analysis.commercial_attribution,
    });
  }
  workspace.hypotheses = rebuildHypotheses(workspace.observations);
  workspace.updated_at = now;
  return {
    accepted,
    replayed_observation_ids: replayed,
    hypotheses: structuredClone(workspace.hypotheses),
    next_challenger_hypothesis_ids: workspace.hypotheses
      .filter((item) => item.status === 'promoted' && !item.safety_or_rights_issue)
      .sort((left, right) => right.median_observed_rate - left.median_observed_rate || left.id.localeCompare(right.id))
      .slice(0, 2).map((item) => item.id),
  };
}

function countBy(values) {
  return values.reduce((counts, value) => ({ ...counts, [value]: (counts[value] ?? 0) + 1 }), {});
}

function nextHypothesisIds(workspace) {
  return workspace.hypotheses
    .filter((item) => item.status === 'promoted' && !item.safety_or_rights_issue)
    .sort((left, right) => right.median_observed_rate - left.median_observed_rate || left.id.localeCompare(right.id))
    .slice(0, 2).map((item) => item.id);
}

export function prepareGrowthLoopDay(workspace, input, now = new Date().toISOString()) {
  assert(workspace?.schema_version === 'growth-loop-workspace.v1', 'Growth Loop is not set up.');
  assert(!workspace.paused, 'Growth Loop is paused.');
  assert(input?.schema_version === 'growth-loop-day.v1' && /^\d{4}-\d{2}-\d{2}$/.test(input.date),
    'Expected growth-loop-day.v1 with an ISO date.');
  assert(Array.isArray(input.cards) && input.cards.length === 6, 'Exactly six daily cards are required.');
  const cardIds = input.cards.map((card) => card.card_id);
  assert(new Set(cardIds).size === 6 && cardIds.every(Boolean), 'Six unique card IDs are required.');
  const slots = input.cards.map((card) => card.slot);
  assert(new Set(slots).size === 6
    && [...slots].sort().join('|') === [...workspace.config.daily_slots].sort().join('|'),
  'Cards must use each configured daily slot exactly once.');
  const sourceCounts = countBy(input.cards.map((card) => card.source_lane));
  assert(sourceCounts.greatest_hits === 2 && sourceCounts.viral_vault === 2 && sourceCounts.my_vault === 2,
    'Cards require exactly two Greatest Hits, two Viral Vault, and two My Vault sources.');
  const roleCounts = countBy(input.cards.map((card) => card.role));
  assert(roleCounts.proven === 4 && roleCounts.challenger === 2,
    'Cards require exactly four proven and two challenger roles.');
  const topicCounts = countBy(input.cards.map((card) => card.topic));
  assert(topicCounts.broad === 2 && topicCounts.expertise === 2 && topicCounts.personal === 2,
    'Cards require exactly two broad, two expertise, and two personal topics.');
  const structures = new Set(input.cards.map((card) => card.structure));
  assert(structures.size >= 3 && structures.has('listicle'), 'Use at least three structures including a listicle.');
  const ctaCards = input.cards.filter((card) => card.cta?.type !== 'none');
  assert(ctaCards.length <= 1, 'At most one earned CTA is allowed.');
  if (ctaCards.length) {
    assert(workspace.config.offer?.verified === true
      && ctaCards[0].cta.offer_id === workspace.config.offer.id, 'CTA must use the verified offer.');
  }
  for (const card of input.cards) {
    assert(card.source_ref?.id && card.source_ref?.evidence_ref && card.source_ref?.rights_verified === true,
      `Card ${card.card_id} needs a rights-verified source reference.`);
    assert(card.template?.id && card.template?.exact_pattern, `Card ${card.card_id} needs an exact reusable template.`);
    assert(typeof card.body === 'string' && card.body.trim(), `Card ${card.card_id} needs an exact draft body.`);
    if (card.role === 'proven') assert(card.hypothesis_id === null, `Proven card ${card.card_id} cannot change a hypothesis.`);
  }
  const expectedHypotheses = nextHypothesisIds(workspace);
  assert(expectedHypotheses.length === 2, 'Two promoted hypotheses are required for the challenger slots.');
  const challengerHypotheses = input.cards.filter((card) => card.role === 'challenger').map((card) => card.hypothesis_id).sort();
  assert(challengerHypotheses.every(Boolean)
    && challengerHypotheses.join('|') === [...expectedHypotheses].sort().join('|'),
  'Challenger cards must bind the two highest-ranked promoted hypotheses exactly once.');

  const inputHash = hash(input);
  const existing = workspace.days.find((day) => day.date === input.date);
  if (existing) {
    assert(existing.input_sha256 === inputHash, `A different six-card plan already exists for ${input.date}.`);
    return summarizeDay(existing);
  }
  const day = {
    schema_version: 'growth-loop-day-record.v1',
    date: input.date,
    input_sha256: inputHash,
    created_at: now,
    cards: input.cards.map((card) => ({
      ...structuredClone(card),
      content_sha256: hash(card.body),
    })),
  };
  workspace.days.push(day);
  workspace.updated_at = now;
  return summarizeDay(day);
}

function summarizeDay(day) {
  return {
    date: day.date,
    card_count: day.cards.length,
    proven_count: day.cards.filter((card) => card.role === 'proven').length,
    challenger_count: day.cards.filter((card) => card.role === 'challenger').length,
    cta_count: day.cards.filter((card) => card.cta.type !== 'none').length,
    card_receipts: day.cards.map((card) => ({
      card_id: card.card_id,
      slot: card.slot,
      role: card.role,
      hypothesis_id: card.hypothesis_id,
      content_sha256: card.content_sha256,
    })),
  };
}

export function beginGrowthLoopSave(workspace, input, now = new Date().toISOString()) {
  assert(workspace?.schema_version === 'growth-loop-workspace.v1', 'Growth Loop is not set up.');
  assert(!workspace.paused, 'Growth Loop is paused.');
  assert(input?.schema_version === 'growth-loop-save-intent.v1' && input.date && input.card_id
    && input.idempotency_key, 'Expected a complete growth-loop-save-intent.v1.');
  assert(input.account_id === workspace.config.account.id, 'Save account does not match the verified account.');
  const day = workspace.days.find((item) => item.date === input.date);
  assert(day, `No prepared Growth Loop day exists for ${input.date}.`);
  const card = day.cards.find((item) => item.card_id === input.card_id);
  assert(card, `Unknown card ${input.card_id}.`);
  const inputHash = hash(input);
  let intent = workspace.save_intents.find((item) => item.idempotency_key === input.idempotency_key);
  if (intent) {
    assert(intent.input_sha256 === inputHash, 'Save idempotency key was already used for a different operation.');
  } else {
    intent = {
      intent_id: `save-${hash(`${input.account_id}:${input.idempotency_key}`).slice(0, 24)}`,
      input_sha256: inputHash,
      account_id: input.account_id,
      date: input.date,
      card_id: input.card_id,
      idempotency_key: input.idempotency_key,
      content_sha256: card.content_sha256,
      body: card.body,
      status: 'pending',
      created_at: now,
      receipt: null,
    };
    workspace.save_intents.push(intent);
    workspace.updated_at = now;
  }
  return {
    intent_id: intent.intent_id,
    account_label: workspace.config.account.label,
    account_id_sha256: hash(intent.account_id),
    idempotency_key: intent.idempotency_key,
    body: intent.body,
    content_sha256: intent.content_sha256,
    status: intent.status,
  };
}

export function reconcileGrowthLoopSave(workspace, receipt, now = new Date().toISOString()) {
  assert(workspace?.schema_version === 'growth-loop-workspace.v1', 'Growth Loop is not set up.');
  assert(receipt?.schema_version === 'growth-loop-save-receipt.v1' && receipt.intent_id,
    'Expected growth-loop-save-receipt.v1.');
  const intent = workspace.save_intents.find((item) => item.intent_id === receipt.intent_id);
  assert(intent, `Unknown save intent ${receipt.intent_id}.`);
  assert(receipt.authoritative === true, 'An authoritative provider readback is required.');
  assert(receipt.status === 'saved' && receipt.provider_draft_id, 'Receipt must confirm a saved provider draft.');
  assert(receipt.account_id === intent.account_id && receipt.idempotency_key === intent.idempotency_key,
    'Receipt account or idempotency key does not match the save intent.');
  assert(receipt.content_sha256 === intent.content_sha256, 'Receipt content hash does not match the save intent.');
  const receiptHash = hash(receipt);
  if (intent.receipt) {
    assert(intent.receipt_sha256 === receiptHash, 'Conflicting save receipt; inspect provider state before retry.');
  } else {
    intent.status = 'saved';
    intent.receipt = structuredClone(receipt);
    intent.receipt_sha256 = receiptHash;
    intent.reconciled_at = now;
    workspace.updated_at = now;
  }
  return {
    intent_id: intent.intent_id,
    card_id: intent.card_id,
    account_id: intent.account_id,
    provider_draft_id: intent.receipt.provider_draft_id,
    content_sha256: intent.content_sha256,
    status: intent.status,
    authoritative: true,
  };
}

function validateSetup(input) {
  assert(input?.schema_version === 'growth-loop-setup.v1', 'Expected growth-loop-setup.v1 input.');
  assert(input.account?.verified === true && input.account.id && input.account.label, 'A verified account is required.');
  assert(typeof input.timezone === 'string' && input.timezone, 'Timezone is required.');
  assert(['reach', 'balanced'].includes(input.goal), 'Goal must be reach or balanced.');
  if (input.goal === 'balanced') {
    assert(input.offer?.verified === true && input.offer.id && input.offer.label,
      'Balanced mode requires a verified offer.');
  }
  assert(input.draft_save?.mode === 'automatic' && input.draft_save.approved === true
    && input.draft_save.scope === 'six_daily_drafts' && Number.isFinite(Date.parse(input.draft_save.approved_at)),
  'Explicit automatic draft-save approval for six daily drafts is required.');
  assert(Array.isArray(input.daily_slots) && input.daily_slots.length === 6
    && new Set(input.daily_slots).size === 6 && input.daily_slots.every((value) => TIME.test(value)),
  'Exactly six unique local daily slots are required.');
  assert(input.scheduler && input.scheduler.interval_hours === 6, 'The maturity scan interval must be six hours.');
  assert(['codex', 'claude', 'cursor', 'gemini', 'openclaw', 'hermes', 'manual'].includes(input.scheduler.adapter),
    'Unsupported scheduler adapter.');
}

export function createGrowthLoopWorkspace(input, now = new Date().toISOString()) {
  validateSetup(input);
  return {
    schema_version: 'growth-loop-workspace.v1',
    created_at: now,
    updated_at: now,
    paused: false,
    config: structuredClone(input),
    observations: [],
    hypotheses: [],
    days: [],
    save_intents: [],
  };
}

export function growthLoopStatus(workspace) {
  assert(workspace?.schema_version === 'growth-loop-workspace.v1', 'Growth Loop is not set up.');
  return {
    workflow_id: 'growth-loop',
    account: publicAccount(workspace.config.account),
    timezone: workspace.config.timezone,
    goal: workspace.config.goal,
    draft_save_scope: workspace.config.draft_save.scope,
    paused: workspace.paused,
    scheduler: structuredClone(workspace.config.scheduler),
    observation_count: workspace.observations.length,
    hypothesis_count: workspace.hypotheses.length,
    day_count: workspace.days.length,
    pending_save_count: workspace.save_intents.filter((item) => item.status === 'pending').length,
    next_challenger_hypothesis_ids: nextHypothesisIds(workspace),
    updated_at: workspace.updated_at,
    external_actions_performed: false,
  };
}
