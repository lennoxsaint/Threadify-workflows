import { marketContentReceipt } from './market-content.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const PRIVATE_CHANNELS = new Set(['threads_dm', 'email', 'linkedin_dm', 'phone']);
const SIGNAL_KINDS = new Set([
  'problem', 'failed_attempt', 'desired_outcome', 'recipient_interest', 'channel_permission',
  'company_fit', 'current_role', 'work_contact_verification', 'lawful_basis',
]);
const ACTION_STATES = new Set(['draft', 'ready_for_approval', 'approved', 'attempt_pending', 'unknown', 'sent']);

function fail(message) { throw new Error(message); }
function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) fail(`${label}_must_be_nonempty_text`);
  return value.trim();
}
function iso(value, label) {
  text(value, label);
  if (Number.isNaN(Date.parse(value))) fail(`${label}_must_be_iso_timestamp`);
  return value;
}
function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label}_must_be_object`);
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length) fail(`${label}_unexpected_keys:${unexpected.sort().join(',')}`);
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
export function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
}
function unique(values, label) {
  if (new Set(values).size !== values.length) fail(`${label}_must_be_unique`);
}
function isCurrent(value, observedAt, days = 30) {
  const age = Date.parse(observedAt) - Date.parse(value);
  return age >= 0 && age <= days * 24 * 60 * 60 * 1000;
}
function atOrAfter(value, earlier, label) {
  if (Date.parse(value) < Date.parse(earlier)) fail(`${label}_out_of_order`);
}
function actionBinding(state, prospect) {
  const evidenceIds = [...new Set([...prospect.signal_ids, ...prospect.action.evidence_ids,
    prospect.contact.permission_signal_id, prospect.contact.lawful_basis_signal_id].filter(Boolean))];
  const evidence = evidenceIds.map((signalId) => {
    const signal = state.signals.find((entry) => entry.signal_id === signalId);
    if (!signal) fail(`action_binding_unknown_evidence:${signalId}`);
    return { signal_id: signalId, signal_sha256: sha256(signal) };
  }).sort((left, right) => left.signal_id.localeCompare(right.signal_id));
  return {
    binding_version: 1,
    run_id: state.run_id,
    threadify_account_ref: state.account.threadify_account_ref,
    prospect_id: prospect.prospect_id,
    stable_company_id: prospect.stable_company_id,
    lane: prospect.lane,
    role: prospect.role,
    action_id: prospect.action.action_id,
    action_type: prospect.action.action_type,
    exact_text: prospect.action.exact_text,
    contact: structuredClone(prospect.contact),
    readiness: structuredClone(prospect.readiness),
    evidence,
  };
}

function currentActionHash(state, prospect) { return sha256(actionBinding(state, prospect)); }

function rejectSensitivePublicText(value, label, sensitiveValues) {
  const normalized = String(value).toLowerCase();
  for (const sensitive of sensitiveValues) {
    const needle = String(sensitive ?? '').trim().toLowerCase();
    if (needle.length >= 3 && normalized.includes(needle)) fail(`public_text_contains_private_material:${label}`);
  }
}

function validateOffer(offer) {
  exactKeys(offer, ['offer_id', 'version', 'name', 'outcome', 'ideal_customer', 'exclusions'], 'offer');
  for (const key of ['offer_id', 'version', 'name', 'outcome', 'ideal_customer']) text(offer[key], `offer_${key}`);
  if (!Array.isArray(offer.exclusions) || offer.exclusions.some((entry) => !String(entry).trim())) fail('offer_exclusions_invalid');
}

function validateScope(scope) {
  exactKeys(scope, ['label', 'geographies', 'jurisdictions', 'window_start', 'window_end', 'raw_signal_cap',
    'qualified_cap', 'spend_cap_micro', 'currency'], 'market_scope');
  text(scope.label, 'market_scope_label');
  for (const field of ['geographies', 'jurisdictions']) {
    if (!Array.isArray(scope[field]) || !scope[field].length || scope[field].some((entry) => !String(entry).trim())) {
      fail(`market_scope_${field}_invalid`);
    }
  }
  iso(scope.window_start, 'market_scope_window_start');
  iso(scope.window_end, 'market_scope_window_end');
  if (Date.parse(scope.window_end) < Date.parse(scope.window_start)) fail('market_scope_window_invalid');
  if (!Number.isInteger(scope.raw_signal_cap) || scope.raw_signal_cap < 1 || scope.raw_signal_cap > 50) fail('raw_signal_cap_must_be_1_to_50');
  if (!Number.isInteger(scope.qualified_cap) || scope.qualified_cap < 1 || scope.qualified_cap > 10) fail('qualified_cap_must_be_1_to_10');
  if (!Number.isInteger(scope.spend_cap_micro) || scope.spend_cap_micro < 0 || scope.spend_cap_micro > 3_000_000) {
    fail('spend_cap_micro_must_be_at_most_3000000');
  }
  if (scope.currency !== 'USD') fail('market_scope_currency_must_be_USD');
}

function validateAccount(account) {
  exactKeys(account, ['threadify_account_ref', 'verified_at', 'capabilities'], 'account');
  text(account.threadify_account_ref, 'threadify_account_ref');
  iso(account.verified_at, 'account_verified_at');
  if (!Array.isArray(account.capabilities) || account.capabilities.some((entry) => !String(entry).trim())) fail('account_capabilities_invalid');
}

function validateSource(source) {
  exactKeys(source, ['source_id', 'provider', 'stage', 'sequence', 'endpoint', 'observed_at', 'requested_count',
    'returned_count', 'complete', 'auth_mode', 'pricing_status', 'quoted_micro', 'charged_micro', 'call_id',
    'evidence_ref', 'fit_gate_prospect_ids', 'limitations'], `source:${source?.source_id ?? 'unknown'}`);
  for (const key of ['source_id', 'provider', 'stage', 'endpoint', 'auth_mode', 'pricing_status', 'evidence_ref']) {
    text(source[key], `source_${key}`);
  }
  if (!['threadify', 'treg', 'local'].includes(source.provider)) fail('source_provider_invalid');
  if (!['buyer_signal', 'discovery', 'company_fit', 'person', 'contact'].includes(source.stage)) fail('source_stage_invalid');
  if (!Number.isInteger(source.sequence) || source.sequence < 1) fail('source_sequence_invalid');
  iso(source.observed_at, 'source_observed_at');
  for (const key of ['requested_count', 'returned_count', 'quoted_micro', 'charged_micro']) {
    if (!Number.isInteger(source[key]) || source[key] < 0) fail(`source_${key}_invalid`);
  }
  if (source.returned_count > source.requested_count && source.requested_count !== 0) fail('source_returned_exceeds_requested');
  if (typeof source.complete !== 'boolean') fail('source_complete_must_be_boolean');
  if (!['free', 'quoted', 'unavailable'].includes(source.pricing_status)) fail('source_pricing_status_invalid');
  if (source.pricing_status === 'unavailable' && (source.returned_count || source.charged_micro)) fail('unavailable_source_cannot_have_results');
  if (source.charged_micro > 0 && source.pricing_status !== 'quoted') fail('paid_source_requires_price_preview');
  if (source.charged_micro > source.quoted_micro) fail('source_charge_exceeds_quote');
  if (source.provider === 'treg' && source.returned_count > 0) text(source.call_id, 'treg_call_id');
  if (source.call_id !== null && typeof source.call_id !== 'string') fail('source_call_id_invalid');
  if (!Array.isArray(source.fit_gate_prospect_ids) || source.fit_gate_prospect_ids.some((entry) => !String(entry).trim())) {
    fail('source_fit_gate_prospect_ids_invalid');
  }
  if (!Array.isArray(source.limitations) || source.limitations.some((entry) => !String(entry).trim())) fail('source_limitations_invalid');
}

function validateSignal(signal, sources, prospectIds, scope) {
  exactKeys(signal, ['signal_id', 'source_id', 'observed_at', 'kind', 'summary', 'public_url', 'rights_basis',
    'explicit', 'relevant_to_offer', 'channel', 'prospect_ids'], `signal:${signal?.signal_id ?? 'unknown'}`);
  for (const key of ['signal_id', 'source_id', 'kind', 'summary', 'rights_basis']) text(signal[key], `signal_${key}`);
  if (!sources.has(signal.source_id)) fail(`signal_unknown_source:${signal.signal_id}`);
  if (!SIGNAL_KINDS.has(signal.kind)) fail(`signal_kind_invalid:${signal.signal_id}`);
  iso(signal.observed_at, 'signal_observed_at');
  if (Date.parse(signal.observed_at) < Date.parse(scope.window_start) || Date.parse(signal.observed_at) > Date.parse(scope.window_end)) {
    fail(`signal_outside_market_window:${signal.signal_id}`);
  }
  if (signal.public_url !== null && typeof signal.public_url !== 'string') fail('signal_public_url_invalid');
  if (typeof signal.explicit !== 'boolean' || typeof signal.relevant_to_offer !== 'boolean') fail('signal_boolean_fields_invalid');
  if (signal.channel !== null && !['public_reply', ...PRIVATE_CHANNELS].includes(signal.channel)) fail('signal_channel_invalid');
  if (!Array.isArray(signal.prospect_ids) || !signal.prospect_ids.length) fail(`signal_prospect_ids_missing:${signal.signal_id}`);
  for (const id of signal.prospect_ids) if (!prospectIds.has(id)) fail(`signal_unknown_prospect:${signal.signal_id}:${id}`);
}

function validateContact(contact) {
  exactKeys(contact, ['channel', 'destination', 'work_contact_verified', 'verified_at', 'verifier', 'permission_signal_id',
    'lawful_basis_signal_id', 'jurisdiction', 'provider_account_ref', 'sender_identity', 'sender_contact', 'unsubscribe_supported',
    'suppression_checked', 'suppressed'], 'contact');
  if (!['public_reply', ...PRIVATE_CHANNELS].includes(contact.channel)) fail('contact_channel_invalid');
  text(contact.destination, 'contact_destination');
  for (const key of ['work_contact_verified', 'unsubscribe_supported', 'suppression_checked', 'suppressed']) {
    if (typeof contact[key] !== 'boolean') fail(`contact_${key}_must_be_boolean`);
  }
  for (const key of ['verified_at', 'verifier', 'permission_signal_id', 'lawful_basis_signal_id']) {
    if (contact[key] !== null && typeof contact[key] !== 'string') fail(`contact_${key}_invalid`);
  }
  if (contact.verified_at !== null) iso(contact.verified_at, 'contact_verified_at');
  for (const key of ['jurisdiction', 'provider_account_ref', 'sender_identity', 'sender_contact']) {
    text(contact[key], `contact_${key}`);
  }
}

function validateProspect(prospect) {
  exactKeys(prospect, ['prospect_id', 'display_name', 'stable_company_id', 'company_name', 'role', 'lane', 'signal_ids',
    'fit_score', 'fit_reasons', 'excluded', 'contact', 'action'], `prospect:${prospect?.prospect_id ?? 'unknown'}`);
  for (const key of ['prospect_id', 'display_name', 'stable_company_id', 'company_name', 'role']) text(prospect[key], `prospect_${key}`);
  if (!['warm', 'cold_b2b'].includes(prospect.lane)) fail('prospect_lane_invalid');
  if (!Array.isArray(prospect.signal_ids) || !prospect.signal_ids.length) fail('prospect_signal_ids_missing');
  if (!Number.isInteger(prospect.fit_score) || prospect.fit_score < 0 || prospect.fit_score > 100) fail('prospect_fit_score_invalid');
  if (!Array.isArray(prospect.fit_reasons) || !prospect.fit_reasons.length || prospect.fit_reasons.some((entry) => !String(entry).trim())) {
    fail('prospect_fit_reasons_invalid');
  }
  if (typeof prospect.excluded !== 'boolean') fail('prospect_excluded_must_be_boolean');
  validateContact(prospect.contact);
  exactKeys(prospect.action, ['action_id', 'action_type', 'exact_text', 'evidence_ids'], 'action');
  for (const key of ['action_id', 'action_type', 'exact_text']) text(prospect.action[key], `action_${key}`);
  if (!Array.isArray(prospect.action.evidence_ids) || !prospect.action.evidence_ids.length) fail('action_evidence_ids_missing');
}

function readiness(prospect, signals, observedAt) {
  const blockers = [];
  if (prospect.excluded) blockers.push('offer_exclusion');
  if (prospect.fit_score < 70) blockers.push('fit_below_70');
  if (!prospect.contact.suppression_checked) blockers.push('suppression_not_checked');
  if (prospect.contact.suppressed) blockers.push('suppressed');
  const evidence = prospect.signal_ids.map((id) => signals.get(id));
  const interest = evidence.find((signal) => signal?.kind === 'recipient_interest' && signal.explicit && signal.relevant_to_offer);
  if (prospect.lane === 'warm') {
    if (!interest) blockers.push('explicit_recipient_interest_missing');
    if (PRIVATE_CHANNELS.has(prospect.contact.channel)) {
      const permission = signals.get(prospect.contact.permission_signal_id);
      if (!permission || permission.kind !== 'channel_permission' || !permission.explicit
        || permission.channel !== prospect.contact.channel || !permission.prospect_ids.includes(prospect.prospect_id)) {
        blockers.push('channel_permission_missing');
      }
    }
  } else {
    if (prospect.contact.channel === 'public_reply') blockers.push('cold_b2b_requires_business_channel');
    const currentRole = evidence.find((signal) => signal?.kind === 'current_role' && signal.explicit
      && signal.relevant_to_offer);
    if (!currentRole) blockers.push('current_relevant_role_missing');
    if (!prospect.contact.work_contact_verified || !prospect.contact.verified_at
      || !isCurrent(prospect.contact.verified_at, observedAt)) blockers.push('current_work_contact_verification_missing');
    const lawfulBasis = signals.get(prospect.contact.lawful_basis_signal_id);
    if (!lawfulBasis || lawfulBasis.kind !== 'lawful_basis' || !lawfulBasis.explicit || !lawfulBasis.relevant_to_offer
      || lawfulBasis.channel !== prospect.contact.channel
      || !lawfulBasis.prospect_ids.includes(prospect.prospect_id)) blockers.push('documented_lawful_basis_missing');
    if (!prospect.contact.sender_identity.trim() || !prospect.contact.sender_contact.trim()) blockers.push('sender_identity_missing');
    if (!prospect.contact.unsubscribe_supported) blockers.push('unsubscribe_missing');
  }
  return {
    status: prospect.excluded || prospect.contact.suppressed ? 'rejected' : blockers.length ? 'research' : 'ready_for_approval',
    blockers: [...new Set(blockers)].sort(),
  };
}

function validateCampaign(campaign, themes, sensitiveValues, buyerGrounded = false) {
  exactKeys(campaign, ['platform', 'posts'], 'campaign');
  if (!['threads', 'x', 'linkedin', 'bluesky'].includes(campaign.platform)) fail('campaign_platform_invalid');
  if (!Array.isArray(campaign.posts) || campaign.posts.length !== 7) fail('campaign_must_have_exactly_seven_posts');
  unique(campaign.posts.map((post) => post.post_id), 'campaign_post_ids');
  for (const post of campaign.posts) {
    exactKeys(post, ['post_id', 'angle', 'exact_text', 'evidence_theme_ids', 'limitation'], `campaign_post:${post?.post_id ?? 'unknown'}`);
    for (const key of ['post_id', 'angle', 'exact_text', 'limitation']) text(post[key], `campaign_post_${key}`);
    if (!Array.isArray(post.evidence_theme_ids) || (!buyerGrounded && !post.evidence_theme_ids.length)) fail('campaign_post_evidence_missing');
    for (const themeId of post.evidence_theme_ids) if (!themes.has(themeId)) fail(`campaign_post_unknown_theme:${themeId}`);
    rejectSensitivePublicText(post.exact_text, `campaign:${post.post_id}:text`, sensitiveValues);
    rejectSensitivePublicText(post.limitation, `campaign:${post.post_id}:limitation`, sensitiveValues);
  }
}

export function buildMarketPipeline(input) {
  exactKeys(input, ['record_type', 'schema_version', 'run_id', 'observed_at', 'offer', 'market_scope', 'account',
    'sources', 'signals', 'themes', 'prospects', 'campaign', 'content_context'], 'input');
  if (input.record_type !== 'MarketToPipelineInputV1' || input.schema_version !== 1) fail('unsupported_market_to_pipeline_input');
  text(input.run_id, 'run_id');
  iso(input.observed_at, 'observed_at');
  validateOffer(input.offer);
  validateScope(input.market_scope);
  validateAccount(input.account);
  if (Date.parse(input.account.verified_at) > Date.parse(input.observed_at)) fail('account_verification_after_observation');
  if (!Array.isArray(input.sources) || !input.sources.length) fail('sources_missing');
  input.sources.forEach(validateSource);
  unique(input.sources.map((entry) => entry.source_id), 'source_ids');
  unique(input.sources.map((entry) => entry.sequence), 'source_sequences');
  const sources = new Map(input.sources.map((entry) => [entry.source_id, entry]));
  const totalQuoted = input.sources.reduce((sum, source) => sum + source.quoted_micro, 0);
  const totalCharged = input.sources.reduce((sum, source) => sum + source.charged_micro, 0);
  if (totalQuoted > input.market_scope.spend_cap_micro) fail('quoted_spend_exceeds_cap');
  if (totalCharged > input.market_scope.spend_cap_micro) fail('charged_spend_exceeds_cap');
  if (!Array.isArray(input.prospects) || !input.prospects.length) fail('prospects_missing');
  input.prospects.forEach(validateProspect);
  unique(input.prospects.map((entry) => entry.prospect_id), 'prospect_ids');
  unique(input.prospects.map((entry) => entry.action.action_id), 'action_ids');
  const prospectIds = new Set(input.prospects.map((entry) => entry.prospect_id));
  if (!Array.isArray(input.signals) || !input.signals.length) fail('signals_missing');
  if (input.signals.length > input.market_scope.raw_signal_cap) fail('raw_signal_cap_exceeded');
  input.signals.forEach((signal) => validateSignal(signal, sources, prospectIds, input.market_scope));
  unique(input.signals.map((entry) => entry.signal_id), 'signal_ids');
  const signals = new Map(input.signals.map((entry) => [entry.signal_id, entry]));
  for (const source of input.sources) {
    const observed = input.signals.filter((signal) => signal.source_id === source.source_id).length;
    if (observed > source.returned_count) fail(`source_signal_count_exceeds_returned:${source.source_id}`);
    if (source.provider === 'treg' && ['person', 'contact'].includes(source.stage)) {
      if (!source.fit_gate_prospect_ids.length) fail(`treg_${source.stage}_requires_fit_gate`);
      for (const prospectId of source.fit_gate_prospect_ids) {
        if (!prospectIds.has(prospectId)) fail(`source_unknown_fit_gate_prospect:${prospectId}`);
        const prospect = input.prospects.find((entry) => entry.prospect_id === prospectId);
        const fitSignal = prospect.signal_ids.map((id) => signals.get(id)).find((signal) => signal?.kind === 'company_fit');
        if (!fitSignal || sources.get(fitSignal.source_id).sequence >= source.sequence) fail(`treg_${source.stage}_before_fit_gate:${prospectId}`);
      }
    }
  }
  for (const prospect of input.prospects) {
    for (const signalId of [...prospect.signal_ids, ...prospect.action.evidence_ids]) {
      const signal = signals.get(signalId);
      if (!signal || !signal.prospect_ids.includes(prospect.prospect_id)) fail(`prospect_signal_mismatch:${prospect.prospect_id}:${signalId}`);
    }
    if (!input.market_scope.jurisdictions.includes(prospect.contact.jurisdiction)) fail(`prospect_outside_jurisdiction:${prospect.prospect_id}`);
  }
  if (!Array.isArray(input.themes) || !input.themes.length) fail('themes_missing');
  unique(input.themes.map((entry) => entry.theme_id), 'theme_ids');
  const themes = new Map();
  for (const theme of input.themes) {
    exactKeys(theme, ['theme_id', 'summary', 'signal_ids', 'deidentified'], `theme:${theme?.theme_id ?? 'unknown'}`);
    text(theme.theme_id, 'theme_id');
    text(theme.summary, 'theme_summary');
    if (theme.deidentified !== true) fail(`theme_must_be_deidentified:${theme.theme_id}`);
    if (!Array.isArray(theme.signal_ids) || !theme.signal_ids.length) fail(`theme_signals_missing:${theme.theme_id}`);
    for (const signalId of theme.signal_ids) if (!signals.has(signalId)) fail(`theme_unknown_signal:${theme.theme_id}:${signalId}`);
    themes.set(theme.theme_id, theme);
  }
  const contentGrounding = marketContentReceipt(input);
  const identifiers = input.prospects.flatMap((prospect) => [prospect.display_name, prospect.company_name,
    prospect.contact.destination, prospect.contact.provider_account_ref, prospect.contact.sender_contact]);
  const privateBodies = input.signals.map((signal) => signal.summary).filter((summary) => summary.length >= 12);
  const sensitiveValues = [...identifiers, ...privateBodies, ...(input.content_context?.buyer_language ?? []).map((entry) => entry.text)];
  for (const source of input.sources) {
    rejectSensitivePublicText(source.endpoint, `source:${source.source_id}:endpoint`, sensitiveValues);
    source.limitations.forEach((limitation, index) => rejectSensitivePublicText(limitation,
      `source:${source.source_id}:limitation:${index}`, sensitiveValues));
  }
  validateCampaign(input.campaign, themes, sensitiveValues, Boolean(input.content_context));

  const ranked = input.prospects.map((prospect) => ({ prospect, readiness: readiness(prospect, signals, input.observed_at) }))
    .sort((left, right) => right.prospect.fit_score - left.prospect.fit_score
      || left.prospect.prospect_id.localeCompare(right.prospect.prospect_id));
  const seen = new Set();
  const deduped = [];
  for (const candidate of ranked) {
    const key = `${candidate.prospect.stable_company_id.toLowerCase()}\u0000${candidate.prospect.contact.destination.toLowerCase()}`;
    if (!seen.has(key)) { seen.add(key); deduped.push(candidate); }
  }
  const selected = deduped.slice(0, input.market_scope.qualified_cap);
  const pipeline = selected.map(({ prospect, readiness: gate }) => {
    const prepared = {
      ...structuredClone(prospect),
      readiness: gate,
      action: {
        ...structuredClone(prospect.action),
        action_hash: null,
        idempotency_key: null,
        state: gate.status === 'ready_for_approval' ? 'ready_for_approval' : 'draft',
        approval: null,
        attempts: [],
      },
    };
    const hash = currentActionHash(input, prepared);
    prepared.action.action_hash = hash;
    prepared.action.idempotency_key = sha256({ run_id: input.run_id, action_id: prospect.action.action_id,
      action_hash: hash });
    return prepared;
  });
  const receipt = {
    record_type: 'MarketToPipelinePublicReceiptV1',
    schema_version: 1,
    run_id: input.run_id,
    status: 'prepared_privately',
    observed_at: input.observed_at,
    offer_id: input.offer.offer_id,
    offer_version: input.offer.version,
    market_scope_sha256: sha256(input.market_scope),
    source_receipts: input.sources.map((source) => ({
      source_id_sha256: sha256(source.source_id),
      provider: source.provider,
      stage: source.stage,
      requested_count: source.requested_count,
      returned_count: source.returned_count,
      complete: source.complete,
      pricing_status: source.pricing_status,
      quoted_micro: source.quoted_micro,
      charged_micro: source.charged_micro,
      call_id_sha256: source.call_id ? sha256(source.call_id) : null,
      evidence_ref_sha256: sha256(source.evidence_ref),
      limitations: structuredClone(source.limitations),
    })),
    raw_signal_count: input.signals.length,
    considered_prospect_count: input.prospects.length,
    selected_prospect_count: pipeline.length,
    ready_for_approval_count: pipeline.filter((entry) => entry.readiness.status === 'ready_for_approval').length,
    warm_count: pipeline.filter((entry) => entry.lane === 'warm').length,
    cold_b2b_count: pipeline.filter((entry) => entry.lane === 'cold_b2b').length,
    total_quoted_micro: totalQuoted,
    total_charged_micro: totalCharged,
    spend_cap_micro: input.market_scope.spend_cap_micro,
    action_bindings: pipeline.map((entry) => ({ action_id_sha256: sha256(entry.action.action_id), action_hash: entry.action.action_hash,
      state: entry.action.state, blocker_count: entry.readiness.blockers.length })),
    content_grounding: contentGrounding,
    campaign_post_count: input.campaign.posts.length,
    campaign_sha256: sha256(input.campaign),
    provider_write_status: 'none_confirmed',
    provider_writes_performed: false,
    raw_signal_bodies_retained_in_receipt: false,
    contact_destinations_retained_in_receipt: false,
    fallback_state: input.sources.some((source) => !source.complete || source.pricing_status === 'unavailable')
      ? 'partial_source_coverage' : 'none',
  };
  return {
    record_type: 'MarketToPipelineStateV1',
    schema_version: 1,
    run_id: input.run_id,
    status: 'prepared_privately',
    observed_at: input.observed_at,
    offer: structuredClone(input.offer),
    market_scope: structuredClone(input.market_scope),
    account: structuredClone(input.account),
    coverage: {
      raw_signal_count: input.signals.length,
      raw_signal_cap: input.market_scope.raw_signal_cap,
      considered_prospect_count: input.prospects.length,
      deduped_prospect_count: deduped.length,
      selected_prospect_count: pipeline.length,
      qualified_cap: input.market_scope.qualified_cap,
      quoted_micro: totalQuoted,
      charged_micro: totalCharged,
      spend_cap_micro: input.market_scope.spend_cap_micro,
    },
    sources: structuredClone(input.sources),
    signals: structuredClone(input.signals),
    themes: structuredClone(input.themes),
    pipeline,
    ...(input.content_context ? { content_context: structuredClone(input.content_context) } : {}),
    campaign: structuredClone(input.campaign),
    receipts: [receipt],
  };
}

function findAction(state, actionId) {
  if (state?.record_type !== 'MarketToPipelineStateV1') fail('unsupported_market_to_pipeline_state');
  const prospect = state.pipeline.find((entry) => entry.action.action_id === actionId);
  if (!prospect) fail(`unknown_action:${actionId}`);
  if (!ACTION_STATES.has(prospect.action.state)) fail('action_state_invalid');
  return prospect;
}

export function approveMarketAction(state, { action_id, action_hash, approved_at }) {
  const next = structuredClone(state);
  const prospect = findAction(next, action_id);
  iso(approved_at, 'approved_at');
  atOrAfter(approved_at, next.observed_at, 'approved_at');
  if (prospect.action.state !== 'ready_for_approval') fail('action_not_ready_for_approval');
  if (prospect.action.action_hash !== currentActionHash(next, prospect)) fail('action_binding_changed');
  if (prospect.action.action_hash !== action_hash) fail('approval_hash_mismatch');
  prospect.action.state = 'approved';
  prospect.action.approval = { action_hash, approved_at,
    account_ref_sha256: sha256(prospect.contact.provider_account_ref) };
  return next;
}

export function editMarketAction(state, { action_id, exact_text }) {
  const next = structuredClone(state);
  const prospect = findAction(next, action_id);
  text(exact_text, 'exact_text');
  if (['attempt_pending', 'unknown', 'sent'].includes(prospect.action.state)) fail('cannot_edit_action_after_attempt');
  prospect.action.exact_text = exact_text.trim();
  const hash = currentActionHash(next, prospect);
  prospect.action.action_hash = hash;
  prospect.action.idempotency_key = sha256({ run_id: next.run_id, action_id, action_hash: hash });
  prospect.action.approval = null;
  prospect.action.state = prospect.readiness.status === 'ready_for_approval' ? 'ready_for_approval' : 'draft';
  return next;
}

export function beginMarketActionAttempt(state, { action_id, action_hash, attempt_id, started_at, account_ref,
  account_verified_at }) {
  const next = structuredClone(state);
  const prospect = findAction(next, action_id);
  text(attempt_id, 'attempt_id');
  iso(started_at, 'started_at');
  text(account_ref, 'account_ref');
  iso(account_verified_at, 'account_verified_at');
  if (prospect.action.state === 'unknown') fail('unknown_action_requires_reconciliation');
  if (prospect.action.state !== 'approved') fail('action_requires_exact_approval');
  if (!prospect.action.approval?.approved_at) fail('action_requires_exact_approval');
  atOrAfter(started_at, prospect.action.approval.approved_at, 'attempt_started_at');
  if (account_ref !== prospect.contact.provider_account_ref) fail('attempt_account_mismatch');
  if (!isCurrent(account_verified_at, started_at, 5 / (24 * 60))) fail('attempt_requires_fresh_account_readback');
  if (prospect.action.action_hash !== currentActionHash(next, prospect)) fail('action_binding_changed');
  if (prospect.action.action_hash !== action_hash || prospect.action.approval?.action_hash !== action_hash) fail('attempt_hash_mismatch');
  if (prospect.action.approval?.account_ref_sha256 !== sha256(account_ref)) fail('attempt_approval_account_mismatch');
  if (prospect.action.attempts.some((entry) => entry.attempt_id === attempt_id)) fail('duplicate_attempt_id');
  prospect.action.attempts.push({ attempt_id, action_hash, started_at, status: 'pending', checked_at: null,
    account_ref_sha256: sha256(account_ref), account_verified_at, provider_ref_sha256: null,
    evidence_ref_sha256: null, reconciliations: [] });
  prospect.action.state = 'attempt_pending';
  return next;
}

export function reconcileMarketActionAttempt(state, { action_id, attempt_id, status, checked_at, provider_ref, evidence_ref }) {
  const next = structuredClone(state);
  const prospect = findAction(next, action_id);
  iso(checked_at, 'checked_at');
  if (!['succeeded', 'confirmed_not_sent', 'unknown'].includes(status)) fail('reconciliation_status_invalid');
  const attempt = prospect.action.attempts.at(-1);
  const resolvingUnknown = prospect.action.state === 'unknown';
  if (!['attempt_pending', 'unknown'].includes(prospect.action.state)) fail('no_pending_attempt_to_reconcile');
  if (!attempt || attempt.attempt_id !== attempt_id
    || (resolvingUnknown ? attempt.status !== 'unknown' : attempt.status !== 'pending')) fail('pending_attempt_mismatch');
  if (resolvingUnknown && status === 'unknown') fail('unknown_reconciliation_requires_decisive_readback');
  atOrAfter(checked_at, attempt.checked_at ?? attempt.started_at, 'reconciliation_checked_at');
  if (status === 'succeeded' && !String(provider_ref ?? '').trim()) fail('successful_reconciliation_requires_provider_ref');
  text(evidence_ref, 'evidence_ref');
  attempt.status = status;
  attempt.checked_at = checked_at;
  attempt.provider_ref_sha256 = provider_ref ? sha256(provider_ref) : null;
  attempt.evidence_ref_sha256 = sha256(evidence_ref);
  attempt.reconciliations ??= [];
  attempt.reconciliations.push({ status, checked_at, provider_ref_sha256: attempt.provider_ref_sha256,
    evidence_ref_sha256: attempt.evidence_ref_sha256 });
  prospect.action.state = status === 'succeeded' ? 'sent' : status === 'unknown' ? 'unknown' : 'approved';
  next.receipts.push({
    record_type: 'MarketToPipelineActionReceiptV1', schema_version: 1, run_id: next.run_id,
    action_id, action_hash: prospect.action.action_hash, attempt_id, status, checked_at,
    provider_ref_sha256: attempt.provider_ref_sha256, evidence_ref_sha256: attempt.evidence_ref_sha256,
    exact_text_retained: false, destination_retained: false,
  });
  return next;
}

export function marketPipelinePublicReceipt(state) {
  if (state?.record_type !== 'MarketToPipelineStateV1') fail('unsupported_market_to_pipeline_state');
  const base = state.receipts.find((entry) => entry.record_type === 'MarketToPipelinePublicReceiptV1');
  if (!base) fail('public_receipt_missing');
  const actions = state.pipeline.map((entry) => entry.action);
  const sentCount = actions.filter((action) => action.state === 'sent').length;
  const pendingCount = actions.filter((action) => action.state === 'attempt_pending').length;
  const unknownCount = actions.filter((action) => action.state === 'unknown').length;
  const confirmedNotSentCount = actions.flatMap((action) => action.attempts)
    .filter((attempt) => attempt.status === 'confirmed_not_sent').length;
  const writeStatus = unknownCount ? 'unknown' : pendingCount ? 'attempt_pending'
    : sentCount ? 'succeeded' : 'none_confirmed';
  const status = writeStatus === 'unknown' ? 'provider_write_unknown'
    : writeStatus === 'attempt_pending' ? 'provider_attempt_pending'
      : writeStatus === 'succeeded' ? 'provider_write_reconciled' : 'prepared_privately';
  return {
    ...structuredClone(base),
    status,
    provider_write_status: writeStatus,
    provider_writes_performed: sentCount > 0 ? true
      : ['unknown', 'attempt_pending'].includes(writeStatus) ? null : false,
    provider_write_count: sentCount,
    pending_attempt_count: pendingCount,
    unknown_attempt_count: unknownCount,
    confirmed_not_sent_count: confirmedNotSentCount,
    action_bindings: state.pipeline.map((entry) => ({ action_id_sha256: sha256(entry.action.action_id),
      action_hash: entry.action.action_hash, state: entry.action.state,
      blocker_count: entry.readiness.blockers.length })),
    reconciliation_receipts: state.receipts
      .filter((entry) => entry.record_type === 'MarketToPipelineActionReceiptV1')
      .map((entry) => ({ action_id_sha256: sha256(entry.action_id), action_hash: entry.action_hash,
        attempt_id_sha256: sha256(entry.attempt_id), status: entry.status, checked_at: entry.checked_at,
        provider_ref_sha256: entry.provider_ref_sha256, evidence_ref_sha256: entry.evidence_ref_sha256,
        exact_text_retained: false, destination_retained: false })),
  };
}

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export function renderPipelineHtml(state) {
  const receipt = marketPipelinePublicReceipt(state);
  const providerSummary = receipt.provider_write_status === 'succeeded'
    ? `${receipt.provider_write_count} provider write(s) confirmed by authoritative readback`
    : receipt.provider_write_status === 'unknown' ? 'provider write outcome unknown; retry blocked until reconciliation'
      : receipt.provider_write_status === 'attempt_pending' ? 'provider attempt pending; no result inferred'
        : 'no provider write confirmed';
  const cards = state.pipeline.map((entry) => `<article><h2>${escapeHtml(entry.display_name)} · ${escapeHtml(entry.company_name)}</h2>
<p><strong>${escapeHtml(entry.lane)}</strong> · fit ${entry.fit_score}/100 · ${escapeHtml(entry.readiness.status)}</p>
<p>${escapeHtml(entry.fit_reasons.join(' · '))}</p><p><strong>Channel:</strong> ${escapeHtml(entry.contact.channel)} · ${escapeHtml(entry.contact.destination)}</p>
<pre>${escapeHtml(entry.action.exact_text)}</pre><p><code>${entry.action.action_hash}</code></p>
<p>${entry.readiness.blockers.length ? `Blocked: ${escapeHtml(entry.readiness.blockers.join(', '))}` : 'Exact approval required before any provider call.'}</p></article>`).join('\n');
  const posts = state.campaign.posts.map((post) => `<article><h2>${escapeHtml(post.post_id)} · ${escapeHtml(post.angle)}</h2><pre>${escapeHtml(post.exact_text)}</pre><p>${escapeHtml(post.limitation)}</p></article>`).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Market to Pipeline private review</title><style>body{font:16px system-ui;max-width:920px;margin:40px auto;padding:0 20px;background:#f6f4ef;color:#181818}article{background:white;border:1px solid #ddd;border-radius:14px;padding:18px;margin:16px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere}code{overflow-wrap:anywhere}</style></head><body><h1>Market to Pipeline</h1><p>Private review · ${escapeHtml(state.status)} · ${escapeHtml(providerSummary)}</p><h1>Qualified pipeline</h1>${cards}<h1>Seven-post campaign</h1>${posts}</body></html>`;
}

export function renderPipelineCsv(state) {
  const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const header = ['prospect_id', 'display_name', 'company_name', 'role', 'lane', 'fit_score', 'readiness', 'channel',
    'destination', 'action_id', 'action_hash', 'action_state', 'blockers'];
  const rows = state.pipeline.map((entry) => [entry.prospect_id, entry.display_name, entry.company_name, entry.role,
    entry.lane, entry.fit_score, entry.readiness.status, entry.contact.channel, entry.contact.destination,
    entry.action.action_id, entry.action.action_hash, entry.action.state, entry.readiness.blockers.join('|')]);
  return `${[header, ...rows].map((row) => row.map(quote).join(',')).join('\n')}\n`;
}

function safeWrite(file, content) {
  fs.writeFileSync(file, content, { mode: 0o600, flag: 'wx' });
}

export function writeMarketPipelineArtifacts(state, outputDirectory) {
  const target = path.resolve(outputDirectory);
  fs.mkdirSync(target, { recursive: true, mode: 0o700 });
  if (!fs.statSync(target).isDirectory()) fail('output_directory_invalid');
  fs.chmodSync(target, 0o700);
  const publicReceipt = marketPipelinePublicReceipt(state);
  safeWrite(path.join(target, 'pipeline.private.json'), `${JSON.stringify(state, null, 2)}\n`);
  safeWrite(path.join(target, 'pipeline.private.csv'), renderPipelineCsv(state));
  safeWrite(path.join(target, 'review.private.html'), renderPipelineHtml(state));
  safeWrite(path.join(target, 'receipt.public.json'), `${JSON.stringify(publicReceipt, null, 2)}\n`);
  return { output_directory: target, state_file: path.join(target, 'pipeline.private.json'),
    receipt_file: path.join(target, 'receipt.public.json') };
}

export function saveMarketPipelineState(file, state) {
  const target = path.resolve(file);
  const directory = path.dirname(target);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
  const replace = (destination, content) => {
    const temporary = path.join(directory, `.${path.basename(destination)}.${process.pid}.${crypto.randomUUID()}.tmp`);
    fs.writeFileSync(temporary, content, { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporary, destination);
  };
  replace(target, `${JSON.stringify(state, null, 2)}\n`);
  replace(path.join(directory, 'pipeline.private.csv'), renderPipelineCsv(state));
  replace(path.join(directory, 'review.private.html'), renderPipelineHtml(state));
  replace(path.join(directory, 'receipt.public.json'), `${JSON.stringify(marketPipelinePublicReceipt(state), null, 2)}\n`);
}
