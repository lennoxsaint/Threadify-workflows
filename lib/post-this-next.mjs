import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const GOAL_DEFINITIONS = Object.freeze({
  most_useful_now: Object.freeze({
    label: 'Most useful now',
    criteria: Object.freeze({
      audience_relevance: 30,
      evidence: 25,
      specificity: 20,
      feed_novelty: 15,
      cta_offer_fit: 10,
    }),
  }),
  engagement_pattern_fit: Object.freeze({
    label: 'Best match to owned engagement patterns',
    criteria: Object.freeze({
      verified_pattern_alignment: 35,
      hook: 25,
      format_fit: 15,
      topic_fit: 15,
      feed_novelty: 10,
    }),
  }),
  closest_to_ready: Object.freeze({
    label: 'Closest to publishable',
    criteria: Object.freeze({
      factual_support: 30,
      opening: 20,
      specificity: 20,
      voice: 15,
      cta: 15,
    }),
  }),
});

const ELIGIBLE_STATUSES = new Set(['draft', 'saved', 'review', 'ready']);
const PROVIDER_ADAPTERS = new Set(['custom_jev', 'jev_code', 'compatible_jev', 'manual']);
const CLEAR_CONFIDENCE = 0.8;
const CLEAR_MARGIN_POINTS = 10;

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonical(value));
}

function requireNonEmpty(value, field) {
  if (typeof value !== 'string' || !value.trim()) fail(`${field} is required`);
  return value.trim();
}

function requireSha256(value, field) {
  if (!/^[a-f0-9]{64}$/.test(value ?? '')) fail(`${field} must be a SHA-256`);
  return value;
}

function validateProvider(provider) {
  if (!provider || !PROVIDER_ADAPTERS.has(provider.adapter)) fail('provider.adapter is invalid');
  if (provider.adapter === 'manual') {
    if (provider.privacy_route !== 'local_only') fail('manual provider must remain local_only');
    return;
  }
  if (!['zdr', 'non_zdr_owner_approved'].includes(provider.privacy_route)) {
    fail('Jev provider privacy route must be recorded');
  }
  requireNonEmpty(provider.model, 'provider.model');
  if (provider.cost_usd !== null && (!Number.isFinite(provider.cost_usd) || provider.cost_usd < 0)) {
    fail('provider.cost_usd must be null or non-negative');
  }
  if (!Number.isFinite(provider.latency_ms) || provider.latency_ms < 0) {
    fail('provider.latency_ms must be non-negative');
  }
}

function prepareInput(input) {
  if (!input || input.schema_version !== 1) fail('schema_version must be 1');
  requireNonEmpty(input.observed_at, 'observed_at');
  if (!input.account?.verified) fail('a verified account is required');
  const accountLabel = requireNonEmpty(input.account.label, 'account.label');
  if (!input.coverage?.complete) fail('complete draft coverage is required');
  if (!Number.isInteger(input.coverage.pages_read) || input.coverage.pages_read < 1) {
    fail('coverage.pages_read must be a positive integer');
  }
  if (!Array.isArray(input.coverage.gaps) || input.coverage.gaps.length) {
    fail('complete draft coverage cannot contain gaps');
  }
  validateProvider(input.provider);
  if (input.provider.adapter !== 'manual' && input.data_handling_acknowledged !== true) {
    fail('external Jev data handling must be acknowledged');
  }
  if (!Array.isArray(input.goals) || input.goals.length === 0) fail('at least one goal is required');
  const goals = [...new Set(input.goals)];
  if (goals.length !== input.goals.length) fail('goals must be unique');
  for (const goal of goals) if (!GOAL_DEFINITIONS[goal]) fail(`unknown goal: ${goal}`);
  if (!Array.isArray(input.drafts) || input.drafts.length === 0) fail('drafts must be a non-empty array');
  const seen = new Set();
  const drafts = input.drafts.map((draft, index) => {
    const draftId = requireNonEmpty(draft?.draft_id, `drafts[${index}].draft_id`);
    if (seen.has(draftId)) fail(`duplicate draft_id: ${draftId}`);
    seen.add(draftId);
    const text = requireNonEmpty(draft.text, `drafts[${index}].text`);
    const status = requireNonEmpty(draft.status, `drafts[${index}].status`).toLowerCase();
    return {
      draft_id: draftId,
      status,
      updated_at: requireNonEmpty(draft.updated_at, `drafts[${index}].updated_at`),
      content_sha256: sha256(text),
    };
  });
  const eligible = drafts.filter((draft) => ELIGIBLE_STATUSES.has(draft.status));
  if (!eligible.length) fail('no eligible unscheduled or unpublished drafts were found');
  const snapshot = {
    account_label: accountLabel,
    observed_at: input.observed_at,
    coverage: input.coverage,
    drafts: eligible,
  };
  return {
    accountLabel,
    drafts,
    eligible,
    goals,
    snapshotSha256: sha256(canonicalJson(snapshot)),
  };
}

function validateCriterion(value, field, manual) {
  if (!value || !Number.isInteger(value.score) || value.score < 0 || value.score > 4) {
    fail(`${field}.score must be an integer from 0 through 4`);
  }
  if (manual) {
    if (value.confidence !== null) fail(`${field}.confidence must be null for manual scoring`);
  } else if (!Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1) {
    fail(`${field}.confidence must be between 0 and 1`);
  }
}

function rankGoal(input, goal, eligible) {
  const definition = GOAL_DEFINITIONS[goal];
  const evaluations = input.evaluations?.[goal];
  if (!Array.isArray(evaluations) || evaluations.length !== eligible.length) {
    fail(`${goal} evaluations must cover exactly every eligible draft`);
  }
  const eligibleById = new Map(eligible.map((draft) => [draft.draft_id, draft]));
  const seen = new Set();
  const manual = input.provider.adapter === 'manual';
  const rankings = evaluations.map((evaluation, evaluationIndex) => {
    const draftId = requireNonEmpty(evaluation?.draft_id, `${goal}[${evaluationIndex}].draft_id`);
    if (seen.has(draftId) || !eligibleById.has(draftId)) {
      fail(`${goal} evaluations must cover exactly every eligible draft`);
    }
    seen.add(draftId);
    const draft = eligibleById.get(draftId);
    if (requireSha256(evaluation.content_sha256, `${goal}.${draftId}.content_sha256`) !== draft.content_sha256) {
      fail(`${goal}.${draftId} content hash does not match the frozen draft`);
    }
    const criteria = evaluation.criteria;
    if (!criteria || Object.keys(criteria).length !== Object.keys(definition.criteria).length) {
      fail(`${goal}.${draftId} must contain the exact goal criteria`);
    }
    let weighted = 0;
    const confidences = [];
    for (const [criterionName, weight] of Object.entries(definition.criteria)) {
      if (!Object.hasOwn(criteria, criterionName)) fail(`${goal}.${draftId} is missing ${criterionName}`);
      validateCriterion(criteria[criterionName], `${goal}.${draftId}.${criterionName}`, manual);
      weighted += (criteria[criterionName].score / 4) * weight;
      if (!manual) confidences.push(criteria[criterionName].confidence);
    }
    return {
      draft_id: draftId,
      content_sha256: draft.content_sha256,
      normalized_score: Math.round(weighted * 100) / 100,
      min_confidence: manual ? null : Math.min(...confidences),
    };
  }).sort((left, right) => right.normalized_score - left.normalized_score
    || ((right.min_confidence ?? -1) - (left.min_confidence ?? -1))
    || left.draft_id.localeCompare(right.draft_id));

  if (rankings.length === 1) {
    return {
      status: manual ? 'manual_shortlist' : 'only_candidate',
      recommended_draft_id: manual ? null : rankings[0].draft_id,
      runner_up_draft_id: null,
      top_two_draft_ids: [rankings[0].draft_id],
      lead_points: null,
      abstention_reason: manual ? 'Manual fallback cannot make a Jev recommendation.' : null,
      rankings,
    };
  }
  const leadPoints = Math.round((rankings[0].normalized_score - rankings[1].normalized_score) * 100) / 100;
  if (manual) {
    return {
      status: 'manual_shortlist',
      recommended_draft_id: null,
      runner_up_draft_id: rankings[1].draft_id,
      top_two_draft_ids: rankings.slice(0, 2).map((ranking) => ranking.draft_id),
      lead_points: leadPoints,
      abstention_reason: 'Manual fallback cannot make a Jev recommendation.',
      rankings,
    };
  }
  const confidenceClear = rankings[0].min_confidence >= CLEAR_CONFIDENCE;
  const marginClear = leadPoints >= CLEAR_MARGIN_POINTS;
  const recommended = confidenceClear && marginClear;
  const reasons = [];
  if (!confidenceClear) reasons.push(`winner confidence is below ${CLEAR_CONFIDENCE}`);
  if (!marginClear) reasons.push(`lead margin is below ${CLEAR_MARGIN_POINTS} points`);
  return {
    status: recommended ? 'recommended' : 'abstained',
    recommended_draft_id: recommended ? rankings[0].draft_id : null,
    runner_up_draft_id: rankings[1].draft_id,
    top_two_draft_ids: rankings.slice(0, 2).map((ranking) => ranking.draft_id),
    lead_points: leadPoints,
    abstention_reason: recommended ? null : reasons.join('; '),
    rankings,
  };
}

export function reviewPostThisNext(input) {
  const prepared = prepareInput(input);
  const goals = Object.fromEntries(prepared.goals.map((goal) => [
    goal,
    rankGoal(input, goal, prepared.eligible),
  ]));
  return {
    schema_version: 1,
    workflow_id: 'post-this-next',
    generated_at: input.observed_at,
    account_label: prepared.accountLabel,
    snapshot_sha256: prepared.snapshotSha256,
    eligible_draft_count: prepared.eligible.length,
    excluded_draft_count: prepared.drafts.length - prepared.eligible.length,
    goals,
    provider: input.provider,
    thresholds: {
      clear_confidence: CLEAR_CONFIDENCE,
      clear_margin_points: CLEAR_MARGIN_POINTS,
      calibration_status: 'provisional_advisory_only',
    },
    claims: {
      traffic_prediction: false,
      engagement_language: 'Owned engagement pattern fit is not a forecast of future traffic or performance.',
    },
    external_actions_performed: false,
  };
}

function renderMarkdown(result) {
  const sections = Object.entries(result.goals).map(([goal, decision]) => {
    const choice = decision.recommended_draft_id
      ? `Recommendation: \`${decision.recommended_draft_id}\``
      : `Top two for owner choice: ${decision.top_two_draft_ids.map((id) => `\`${id}\``).join(', ')}`;
    return `## ${GOAL_DEFINITIONS[goal].label}\n\n**Status:** ${decision.status}  \n${choice}  \n**Lead:** ${decision.lead_points ?? 'not applicable'} points${decision.abstention_reason ? `  \n**Why no recommendation:** ${decision.abstention_reason}` : ''}`;
  });
  return `# Post This Next\n\n**Account:** ${result.account_label}  \n**Eligible drafts:** ${result.eligible_draft_count}  \n**Snapshot:** \`${result.snapshot_sha256}\`\n\n${sections.join('\n\n')}\n\nNo draft was edited, saved, scheduled, published, or deleted. Engagement pattern fit is not a traffic forecast.\n`;
}

export function writePostThisNextArtifacts(input, outputDirectory) {
  const result = reviewPostThisNext(input);
  fs.mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
  const files = {
    result: path.join(outputDirectory, 'post-this-next-result.json'),
    markdown: path.join(outputDirectory, 'post-this-next-result.md'),
    receipt: path.join(outputDirectory, 'post-this-next-receipt.json'),
  };
  const resultText = `${JSON.stringify(result, null, 2)}\n`;
  fs.writeFileSync(files.result, resultText, { mode: 0o600 });
  fs.writeFileSync(files.markdown, renderMarkdown(result), { mode: 0o600 });
  const receipt = {
    schema_version: 1,
    workflow_id: result.workflow_id,
    account_label: result.account_label,
    snapshot_sha256: result.snapshot_sha256,
    result_sha256: sha256(resultText),
    eligible_draft_count: result.eligible_draft_count,
    goal_statuses: Object.fromEntries(Object.entries(result.goals).map(([goal, value]) => [goal, value.status])),
    provider: result.provider,
    fallback_state: input.provider.adapter === 'manual' ? 'used' : 'not_used',
    external_actions_performed: false,
  };
  fs.writeFileSync(files.receipt, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  return { ...files, result_sha256: receipt.result_sha256 };
}
