export const IMMUTABLE_HARD_GATES = Object.freeze([
  'approval_before_send',
  'permission_before_dm',
  'no_pitch_first_comment',
  'no_fabricated_proof',
  'verified_account_only',
]);

const SCORE_FIELDS = ['pain', 'intent', 'fit', 'warmth', 'permission_readiness'];

function clampScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  return Math.min(5, Math.max(1, number));
}

export function scoreCandidate(scores = {}) {
  const positive = SCORE_FIELDS.reduce((total, field) => total + clampScore(scores[field]), 0);
  const risk = clampScore(scores.risk);
  return Math.round(((positive + (6 - risk)) / 30) * 100);
}

export function evaluateQuerySample(results = []) {
  const sample = Array.isArray(results) ? results.slice(0, 5) : [];
  const intendedProblemMatches = sample.filter((result) => result.intended_problem_match).length;
  const firstPersonOwnershipMatches = sample.filter(
    (result) => result.intended_problem_match && result.first_person_owned,
  ).length;

  return {
    sample_size: sample.length,
    intended_problem_matches: intendedProblemMatches,
    first_person_ownership_matches: firstPersonOwnershipMatches,
    action:
      sample.length === 5 && intendedProblemMatches >= 1 && firstPersonOwnershipMatches >= 1
        ? 'continue_inspection'
        : 'rewrite_query',
  };
}

export function evaluateCandidate(candidate) {
  const reasons = [];
  const ageHours = Number(candidate.age_hours);
  const hasCurrentProblem = Boolean(
    candidate.first_person_problem ||
      candidate.failed_attempt ||
      candidate.stakes ||
      candidate.asks_for_help,
  );

  if (!candidate.account_verified) reasons.push('wrong_account');
  if (candidate.duplicate) reasons.push('duplicate_candidate');
  if (candidate.suppressed) reasons.push('suppressed_candidate');
  if (candidate.profile_conflict) reasons.push('profile_contradicts_need');
  if (candidate.intent === 'seller_funnel') reasons.push('seller_funnel');
  if (candidate.intent === 'teaching_or_advice') reasons.push('teaching_not_asking');
  if (!hasCurrentProblem) reasons.push('no_current_first_person_problem');
  if (!candidate.useful_reply_without_pitch) reasons.push('no_useful_non_pitch_reply');

  const stale = Number.isFinite(ageHours) && ageHours > 168;
  if (stale && !candidate.allow_stale_research_only) reasons.push('stale_over_seven_days');

  const score = scoreCandidate(candidate.scores);
  if (reasons.length > 0) {
    return {
      stage: 'reject',
      status: reasons.includes('wrong_account') ? 'blocked_wrong_account' : 'rejected',
      score,
      reasons,
      approval_state: 'not_eligible',
    };
  }

  if (stale && candidate.allow_stale_research_only) {
    return {
      stage: 'research_only',
      status: 'eligible_for_language_research_only',
      score,
      reasons: ['stale_research_only_override'],
      approval_state: 'no_public_action',
    };
  }

  const eligibilityReasons = [];
  if (!candidate.offer_context_loaded || !candidate.offer_context_version) {
    return {
      stage: 'research_only',
      status: 'missing_offer_context',
      score,
      reasons: ['missing_offer_context'],
      approval_state: 'no_public_action',
    };
  }
  if (!candidate.problem_authored_by_candidate) {
    eligibilityReasons.push('problem_not_authored_by_candidate');
  }
  if (!candidate.full_context_inspected) {
    eligibilityReasons.push('full_context_not_inspected');
  }

  const fitEvidence = candidate.fit_evidence ?? {};
  if (fitEvidence.audience !== 'match') eligibilityReasons.push('audience_not_mapped_to_offer');
  if (fitEvidence.problem !== 'match') eligibilityReasons.push('problem_not_mapped_to_offer');
  if (fitEvidence.transformation !== 'match') {
    eligibilityReasons.push('transformation_not_mapped_to_offer');
  }
  if (fitEvidence.exclusions_clear !== true) eligibilityReasons.push('offer_exclusion_not_cleared');
  if (candidate.safe_public_context !== true) eligibilityReasons.push('unsafe_or_disputed_public_context');
  if (candidate.distinct_public_value !== true) eligibilityReasons.push('no_distinct_public_value');

  if (eligibilityReasons.length > 0) {
    return {
      stage: 'research_only',
      status: 'not_action_eligible',
      score,
      reasons: eligibilityReasons,
      approval_state: 'no_public_action',
    };
  }

  if (candidate.offer_discussion_allowed && score >= 75) {
    return { stage: 'offer_ready', status: 'eligible', score, reasons, approval_state: 'approval_required' };
  }
  if (candidate.call_invite_allowed && score >= 75) {
    return { stage: 'call_ready', status: 'eligible', score, reasons, approval_state: 'approval_required' };
  }
  if (candidate.dm_permission_explicit && score >= 60) {
    return {
      stage: 'dm_permission_ready',
      status: 'eligible',
      score,
      reasons,
      approval_state: 'approval_required',
    };
  }
  if (score >= 60) {
    return {
      stage: 'public_reply_ready',
      status: 'eligible',
      score,
      reasons,
      approval_state: 'approval_required',
    };
  }
  return {
    stage: 'research_only',
    status: 'insufficient_public_action_evidence',
    score,
    reasons: ['score_below_public_reply_threshold'],
    approval_state: 'no_public_action',
  };
}

export function evaluateLearningWindow(window) {
  if (String(window.target ?? '').startsWith('hard_gate.')) {
    return {
      result: 'blocked_immutable_gate',
      completed_outcomes: Number(window.completed_outcomes ?? 0),
    };
  }

  const completedOutcomes = Number(window.completed_outcomes ?? 0);
  if (completedOutcomes < 10) {
    return { result: 'no_change_insufficient_evidence', completed_outcomes: completedOutcomes };
  }

  const batches = Array.isArray(window.batches) ? window.batches : [];
  if (completedOutcomes < 20 || batches.length < 2) {
    return { result: 'proposed_change', completed_outcomes: completedOutcomes };
  }

  const firstTwoBatches = batches.slice(0, 2);
  const proofPasses = firstTwoBatches.every((batch) => {
    const lift = Number(batch.candidate_progression_rate) - Number(batch.baseline_progression_rate);
    return (
      Number(batch.completed_outcomes) >= 10 &&
      lift >= 0.2 &&
      Number(batch.false_positive_rate_after) <= Number(batch.false_positive_rate_before) &&
      Number(batch.hard_gate_breaches) === 0
    );
  });

  return {
    result: proofPasses ? 'auto_apply_soft_change' : 'hold_proposed_change',
    completed_outcomes: completedOutcomes,
  };
}
