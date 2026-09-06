export const IMMUTABLE_HARD_GATES = Object.freeze([
  'approval_before_send',
  'permission_before_dm',
  'no_pitch_first_comment',
  'no_fabricated_proof',
  'verified_account_only',
]);

export const QUERY_LIMITS = Object.freeze({ max_rewrites: 10, max_results_inspected: 50 });
export const OWNER_EDIT_DIMENSIONS = Object.freeze([
  'truth',
  'relevance',
  'mechanism',
  'action',
  'tradeoff',
  'voice',
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
      intendedProblemMatches >= 1 && firstPersonOwnershipMatches >= 1
        ? 'continue_inspection'
        : 'rewrite_query',
  };
}

export function evaluateQueryRun(run = {}) {
  const rewriteCount = Math.max(0, Number(run.rewrite_count ?? 0));
  const totalResultsInspected = Math.max(0, Number(run.total_results_inspected ?? 0));
  const qualifiedCandidateStages = Array.isArray(run.candidate_stages_observed)
    ? run.candidate_stages_observed
    : [];
  const qualifiedCandidates = qualifiedCandidateStages.filter((stage) =>
    ['public_reply_ready', 'dm_permission_ready', 'call_ready', 'offer_ready'].includes(stage),
  ).length;
  const targetCount = Math.max(1, Number(run.target_count ?? 1));

  if (qualifiedCandidates >= targetCount) {
    return {
      status: 'target_reached',
      stop_reason:
        targetCount === 1 ? 'default_single_candidate_reached' : 'explicit_batch_target_reached',
      rewrite_count: rewriteCount,
      total_results_inspected: totalResultsInspected,
    };
  }
  if (rewriteCount >= QUERY_LIMITS.max_rewrites) {
    return {
      status: 'no_qualified_candidate',
      stop_reason: 'rewrite_cap_reached',
      rewrite_count: rewriteCount,
      total_results_inspected: totalResultsInspected,
    };
  }
  if (totalResultsInspected >= QUERY_LIMITS.max_results_inspected) {
    return {
      status: 'no_qualified_candidate',
      stop_reason: 'result_cap_reached',
      rewrite_count: rewriteCount,
      total_results_inspected: totalResultsInspected,
    };
  }
  return {
    status: 'continue_search',
    stop_reason: null,
    rewrite_count: rewriteCount,
    total_results_inspected: totalResultsInspected,
  };
}

export function calibrateVoice(samples = []) {
  const approvedSamples = Array.isArray(samples)
    ? samples.filter((sample) => typeof sample === 'string' && sample.trim().length > 0).slice(0, 5)
    : [];
  if (approvedSamples.length >= 3) {
    return {
      approved_sample_count: approvedSamples.length,
      voice_confidence: 'high',
      mode: 'approved_samples',
    };
  }
  return {
    approved_sample_count: approvedSamples.length,
    voice_confidence: 'low',
    mode: 'plain_human_fallback',
  };
}

export function evaluateReplyDraft(draft = {}) {
  const branch = draft.evidence_gap ? 'diagnostic_aca' : 'clear_context_mechanism';
  const reasons = [];
  if (!['public_reply_ready', 'dm_permission_ready', 'call_ready', 'offer_ready'].includes(draft.candidate_stage)) {
    reasons.push('candidate_not_public_reply_eligible');
  }
  if (!draft.acknowledges_signal) reasons.push('exact_signal_not_acknowledged');
  if (
    draft.offer_mentioned ||
    draft.link_included ||
    draft.dm_ask ||
    draft.call_ask ||
    draft.paid_ask
  ) {
    reasons.push('offer_not_allowed_in_first_public_reply');
  }
  if (draft.lived_experience_used && !draft.lived_experience_approved) {
    reasons.push('unapproved_or_fabricated_lived_experience');
  }

  if (branch === 'diagnostic_aca') {
    if (Number(draft.question_count ?? 0) !== 1) reasons.push('diagnostic_requires_one_question');
  } else {
    if (Number(draft.mechanism_count ?? 0) !== 1) reasons.push('clear_context_requires_one_mechanism');
    if (!draft.practical_next_move) reasons.push('missing_practical_next_move');
    if (!draft.honest_tradeoff) reasons.push('missing_honest_tradeoff');
  }

  return { branch, ready: reasons.length === 0, reasons };
}

export function classifyOwnerEdits(event = {}) {
  const stagedComponents = event.staged_components ?? {};
  const sentComponents = event.sent_components ?? {};
  const semanticDimensions = OWNER_EDIT_DIMENSIONS.filter((dimension) => dimension !== 'voice');
  const changedDimensions = semanticDimensions.filter(
    (dimension) => JSON.stringify(stagedComponents[dimension] ?? null) !== JSON.stringify(sentComponents[dimension] ?? null),
  );
  if (JSON.stringify(event.staged_voice_traits ?? []) !== JSON.stringify(event.sent_voice_traits ?? [])) {
    changedDimensions.push('voice');
  }
  return {
    staged_text: String(event.staged_text ?? ''),
    sent_text: String(event.sent_text ?? ''),
    changed_dimensions: changedDimensions,
    learning_target: 'message_policy',
    candidate_policy_mutated: false,
  };
}

export function evaluateOutcome(outcome = {}) {
  const progressionSignals = [
    'new_pain',
    'new_failed_attempt',
    'new_stakes',
    'new_desired_outcome',
    'permission',
    'resource_accepted',
    'call',
    'offer',
    'payment',
  ];
  const observedWithinHours = Number(outcome.observed_within_hours);
  const insideWindow = Number.isFinite(observedWithinHours) && observedWithinHours >= 0 && observedWithinHours <= 72;
  const qualifiedProgression = insideWindow && progressionSignals.some((signal) => Boolean(outcome[signal]));
  return {
    qualified_progression: qualifiedProgression,
    window_hours: 72,
    observed_within_hours: Number.isFinite(observedWithinHours) ? observedWithinHours : null,
    window_status: insideWindow ? 'inside_72h' : 'outside_or_missing_72h',
    ignored_vanity_signals: ['like', 'generic_reply'],
  };
}

export function evaluateCandidate(candidate) {
  const reasons = [];
  const ageHours = Number(candidate.age_hours);
  const hasCurrentProblem = Boolean(candidate.first_person_problem);
  const supportingSignals = ['failed_attempt', 'stakes', 'asks_for_help'].filter((field) =>
    Boolean(candidate[field]),
  );
  const evaluationMetadata = {
    supporting_signals: supportingSignals,
    solution_awareness: candidate.solution_awareness ?? 'unknown',
    commercial_evidence: candidate.commercial_evidence ?? { present: false, rationale: '' },
    language_bank_route: 'none',
  };

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
      ...evaluationMetadata,
    };
  }

  if (stale && candidate.allow_stale_research_only) {
    return {
      stage: 'research_only',
      status: 'eligible_for_language_research_only',
      score,
      reasons: ['stale_research_only_override'],
      approval_state: 'no_public_action',
      ...evaluationMetadata,
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
      ...evaluationMetadata,
    };
  }
  if (!candidate.problem_authored_by_candidate) {
    eligibilityReasons.push('problem_not_authored_by_candidate');
  }
  if (!candidate.full_context_inspected) {
    eligibilityReasons.push('full_context_not_inspected');
  }

  if (supportingSignals.length === 0) eligibilityReasons.push('missing_supporting_signal');

  const fitEvidence = candidate.fit_evidence ?? {};
  const situationFit = fitEvidence.situation ?? fitEvidence.audience;
  const desiredOutcomeFit = fitEvidence.desired_outcome ?? fitEvidence.transformation;
  if (situationFit === 'no_match') eligibilityReasons.push('situation_not_mapped_to_offer');
  if (!['match', 'no_match'].includes(situationFit)) eligibilityReasons.push('situation_fit_unknown');
  if ((fitEvidence.situation_evidence_source ?? candidate.situation_evidence_source) === 'profile_supporting_only') {
    eligibilityReasons.push('profile_label_cannot_establish_situation_fit');
  }
  if (fitEvidence.problem === 'no_match') eligibilityReasons.push('problem_not_mapped_to_offer');
  if (!['match', 'no_match'].includes(fitEvidence.problem)) eligibilityReasons.push('problem_fit_unknown');
  if (desiredOutcomeFit === 'no_match') {
    eligibilityReasons.push('desired_outcome_not_mapped_to_offer');
  }
  if (!['match', 'no_match'].includes(desiredOutcomeFit)) eligibilityReasons.push('desired_outcome_fit_unknown');
  if (fitEvidence.exclusions_clear !== true) eligibilityReasons.push('offer_exclusion_not_cleared');
  if (candidate.safe_public_context !== true) eligibilityReasons.push('unsafe_or_disputed_public_context');
  if (candidate.distinct_public_value !== true) eligibilityReasons.push('no_distinct_public_value');

  if (eligibilityReasons.length > 0) {
    const fitReasons = new Set([
      'situation_not_mapped_to_offer',
      'problem_not_mapped_to_offer',
      'desired_outcome_not_mapped_to_offer',
    ]);
    const hasOffOfferFit = eligibilityReasons.some((reason) => fitReasons.has(reason));
    const hasUnknownFit = eligibilityReasons.some((reason) => reason.endsWith('_fit_unknown'));
    const hasUnprovenSituation = eligibilityReasons.includes('profile_label_cannot_establish_situation_fit');
    return {
      stage: 'research_only',
      status: hasOffOfferFit ? 'adjacent_research_only' : 'not_action_eligible',
      score,
      reasons: eligibilityReasons,
      approval_state: 'no_public_action',
      ...evaluationMetadata,
      language_bank_route: hasOffOfferFit
        ? 'adjacent_off_offer_research'
        : hasUnknownFit || hasUnprovenSituation
          ? 'none'
          : 'active_buyer_language_bank',
    };
  }

  const commercialEvidencePresent = candidate.commercial_evidence?.present === true;
  const laterStageReasons = [];
  if (candidate.offer_discussion_allowed && !commercialEvidencePresent) {
    laterStageReasons.push('commercial_evidence_required_for_offer');
  }
  if (candidate.call_invite_allowed && !commercialEvidencePresent) {
    laterStageReasons.push('commercial_evidence_required_for_call');
  }

  if (
    candidate.offer_discussion_allowed &&
    candidate.dm_permission_explicit &&
    commercialEvidencePresent &&
    score >= 75
  ) {
    return { stage: 'offer_ready', status: 'eligible', score, reasons, approval_state: 'approval_required', ...evaluationMetadata, language_bank_route: 'active_buyer_language_bank' };
  }
  if (
    candidate.call_invite_allowed &&
    candidate.dm_permission_explicit &&
    commercialEvidencePresent &&
    score >= 75
  ) {
    return { stage: 'call_ready', status: 'eligible', score, reasons, approval_state: 'approval_required', ...evaluationMetadata, language_bank_route: 'active_buyer_language_bank' };
  }
  if (candidate.dm_permission_explicit && score >= 60) {
    return {
      stage: 'dm_permission_ready',
      status: 'eligible',
      score,
      reasons: laterStageReasons,
      approval_state: 'approval_required',
      ...evaluationMetadata,
      language_bank_route: 'active_buyer_language_bank',
    };
  }
  return {
    stage: 'public_reply_ready',
    status: 'eligible',
    score,
    reasons: laterStageReasons,
    approval_state: 'approval_required',
    ...evaluationMetadata,
    language_bank_route: 'active_buyer_language_bank',
  };
}

export function evaluateLearningWindow(window) {
  if (String(window.target ?? '').startsWith('hard_gate.')) {
    return {
      result: 'immutable_gate_protected',
      completed_outcomes: Number(window.completed_outcomes ?? 0),
    };
  }

  const completedOutcomes = Number(window.completed_outcomes ?? 0);
  const comparableCompletedOutcomes = Number(window.comparable_completed_outcomes ?? 0);
  const evidenceClass = String(window.evidence_class ?? 'outcome_batch');
  if (['safety_defect', 'correctness_defect'].includes(evidenceClass)) {
    if (!window.synthetic_reproduction_passed || !window.privacy_check_passed) {
      return {
        result: 'hold_proposed_change',
        completed_outcomes: completedOutcomes,
        comparable_completed_outcomes: comparableCompletedOutcomes,
      };
    }
    return {
      result: 'immediate_proposal',
      completed_outcomes: completedOutcomes,
      comparable_completed_outcomes: comparableCompletedOutcomes,
    };
  }
  if (comparableCompletedOutcomes < 10) {
    return { result: 'no_change_insufficient_evidence', completed_outcomes: completedOutcomes, comparable_completed_outcomes: comparableCompletedOutcomes };
  }

  const batches = Array.isArray(window.batches) ? window.batches : [];
  if (comparableCompletedOutcomes < 20 || batches.length < 2) {
    return { result: 'proposed_change', completed_outcomes: completedOutcomes, comparable_completed_outcomes: comparableCompletedOutcomes };
  }

  const firstTwoBatches = batches.slice(0, 2);
  const proofPasses = firstTwoBatches.every((batch) => {
    const lift = Number(batch.candidate_progression_rate) - Number(batch.baseline_progression_rate);
    return (
      batch.comparable === true &&
      Number(batch.completed_outcomes) >= 10 &&
      lift >= 0.2 &&
      Number(batch.false_positive_rate_after) <= Number(batch.false_positive_rate_before) &&
      Number(batch.hard_gate_breaches) === 0
    );
  });

  return {
    result: proofPasses ? 'promotion_recommended' : 'hold_proposed_change',
    completed_outcomes: completedOutcomes,
    comparable_completed_outcomes: comparableCompletedOutcomes,
  };
}
