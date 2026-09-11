import { reviewHash } from '../creator/review.mjs';
import { localClock } from '../creator/time.mjs';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const timestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const url = (value) => {
  if (!text(value)) return false;
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
};
const clone = (value) => structuredClone(value);
const ACTION_TYPES = new Set([
  'public_reply', 'request_channel_permission', 'agree_next_step', 'follow_through', 'share_resource', 'ask_timing',
]);
const CHANNELS = new Set(['threads_public', 'threads_dm', 'email', 'call', 'other']);
const EVIDENCE_KINDS = new Set([
  'action_candidate', 'opportunity_explored', 'recipient_interest', 'channel_permission', 'question',
  'agreed_step', 'commitment', 'silence',
]);
const BASES = new Set(['provider_observed', 'owner_reported']);
const TERMINAL_OUTCOMES = new Set(['fulfilled', 'declined', 'withdrawn', 'uncertain']);
const ACTION_STATES = new Set(['draft', 'approved', 'rejected', 'attempt_pending', 'unknown', 'succeeded']);
const UNRESOLVED_ACTION_STATES = new Set(['attempt_pending', 'unknown', 'approved', 'draft']);
const PRIVATE_CHANNELS = new Set(['threads_dm', 'email', 'call', 'other']);

function exactKeys(value, allowed, label) {
  assert(value && Object.getPrototypeOf(value) === Object.prototype, `${label} must be a plain JSON object.`);
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  assert(unexpected.length === 0, `${label} contains unsupported fields: ${unexpected.join(', ')}.`);
}

function validateTimezone(timezone) {
  assert(text(timezone), 'Saved timezone required.');
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(); } catch { throw new Error('Valid saved timezone required.'); }
}

function assertScope(workspace, value) {
  assert(value.account_id === workspace.account_id && value.platform === workspace.platform,
    'Record account and platform must match the private workspace.');
}

function validateSource(source) {
  exactKeys(source, ['url', 'relevant_excerpt', 'availability', 'evidence_ref'], 'Evidence source');
  assert(source && url(source.url) && text(source.relevant_excerpt), 'Evidence needs a source link and relevant excerpt.');
  assert(source.relevant_excerpt.length <= 500, 'Relevant excerpt must be 500 characters or fewer; do not store full threads.');
  assert(['available', 'unavailable'].includes(source.availability), 'Source availability must be explicit.');
  assert(text(source.evidence_ref), 'Source evidence reference required.');
}

function validateOffer(workspace, offer) {
  exactKeys(offer, ['schema_version', 'record_type', 'id', 'account_id', 'platform', 'status', 'checked_at', 'evidence_ref'], 'Offer record');
  assert(offer?.schema_version === 'conversation-offer.v1' && offer.record_type === 'offer', 'Unsupported offer record.');
  assertScope(workspace, offer);
  assert(text(offer.id) && ['active', 'inactive'].includes(offer.status), 'Offer identity and status required.');
  assert(timestamp(offer.checked_at) && text(offer.evidence_ref), 'Offer evidence and time required.');
}

function validateEvidence(workspace, evidence) {
  exactKeys(evidence, ['schema_version', 'record_type', 'id', 'account_id', 'platform', 'conversation_id', 'offer_id',
    'kind', 'observed_at', 'evidence_basis', 'source', 'private_identifiers', 'explicit', 'relevant_to_offer',
    'channel', 'question_key', 'step_key'], 'Evidence record');
  assert(evidence?.schema_version === 'conversation-evidence.v1' && evidence.record_type === 'evidence', 'Unsupported evidence record.');
  assertScope(workspace, evidence);
  assert(text(evidence.id) && text(evidence.conversation_id), 'Evidence and conversation identity required.');
  assert(evidence.offer_id === null || text(evidence.offer_id), 'Offer identity must be a string or null.');
  assert(EVIDENCE_KINDS.has(evidence.kind) && BASES.has(evidence.evidence_basis), 'Known evidence kind and basis required.');
  assert(timestamp(evidence.observed_at), 'Evidence observation time required.');
  validateSource(evidence.source);
  assert(Array.isArray(evidence.private_identifiers) && evidence.private_identifiers.every(text),
    'Private identifiers must be an explicit string array.');
  assert(evidence.private_identifiers.length <= 20 && evidence.private_identifiers.every((entry) => entry.length <= 200),
    'Private identifiers must stay minimal.');
  if (['recipient_interest', 'channel_permission', 'agreed_step', 'commitment'].includes(evidence.kind)) {
    assert(evidence.explicit === true, `${evidence.kind} must be explicit; silence or inference is not permission.`);
  }
  if (evidence.kind === 'recipient_interest') {
    assert(evidence.offer_id !== null && evidence.relevant_to_offer === true,
      'A lead requires explicit interest in relevant help or an identified offer.');
  }
  if (evidence.kind === 'channel_permission') assert(CHANNELS.has(evidence.channel), 'Channel permission must name the permitted channel.');
  if (evidence.kind === 'question') assert(text(evidence.question_key), 'Question evidence needs a safe host-assigned grouping key.');
  if (evidence.kind === 'agreed_step') assert(text(evidence.step_key), 'Agreed-step evidence needs a stable host-assigned step key.');
}

function validateAction(workspace, action) {
  exactKeys(action, ['schema_version', 'id', 'account_id', 'platform', 'conversation_id', 'offer_id', 'action_type',
    'channel', 'destination', 'exact_text', 'evidence_ids', 'created_at', 'updated_at', 'state', 'approval', 'attempts'],
  'Conversation action');
  assert(action?.schema_version === 'conversation-action.v1' && text(action.id), 'Conversation action identity required.');
  assertScope(workspace, action);
  assert(text(action.conversation_id) && text(action.offer_id), 'Action conversation and offer identity required.');
  assert(ACTION_TYPES.has(action.action_type) && CHANNELS.has(action.channel), 'Known action type and channel required.');
  assert(text(action.destination) && text(action.exact_text), 'Exact destination and reviewed copy required.');
  assert(action.exact_text.length <= 10_000, 'Exact action copy exceeds 10,000 characters.');
  assert(Array.isArray(action.evidence_ids) && action.evidence_ids.length > 0
    && action.evidence_ids.every(text) && new Set(action.evidence_ids).size === action.evidence_ids.length,
  'Action needs unique evidence IDs.');
  assert(timestamp(action.created_at) && timestamp(action.updated_at), 'Action timestamps required.');
  assert(ACTION_STATES.has(action.state) && Array.isArray(action.attempts), 'Known action state and attempts required.');
  if (action.approval !== null) {
    exactKeys(action.approval, ['action_hash', 'display_hash', 'decision', 'evidence_ref', 'at'], 'Action approval');
    assert(/^[0-9a-f]{64}$/.test(action.approval.action_hash) && /^[0-9a-f]{64}$/.test(action.approval.display_hash)
      && action.approval.decision === 'approve' && text(action.approval.evidence_ref) && timestamp(action.approval.at),
    'Invalid exact action approval.');
  }
  for (const [index, attempt] of action.attempts.entries()) {
    exactKeys(attempt, ['schema_version', 'number', 'idempotency_key', 'action_hash', 'account_id', 'destination',
      'exact_text_sha256', 'started_at', 'outcome', 'reinspections', 'receipt_ids'], 'Action attempt');
    assert(attempt?.schema_version === 'conversation-attempt.v1' && attempt.number === index + 1
      && text(attempt.idempotency_key) && /^[0-9a-f]{64}$/.test(attempt.action_hash)
      && text(attempt.account_id) && text(attempt.destination) && /^[0-9a-f]{64}$/.test(attempt.exact_text_sha256)
      && timestamp(attempt.started_at) && ['pending', 'unknown', 'confirmed_not_sent', 'succeeded'].includes(attempt.outcome),
    'Invalid conversation action attempt.');
    assert(Array.isArray(attempt.reinspections) && attempt.reinspections.length > 0
      && Array.isArray(attempt.receipt_ids) && attempt.receipt_ids.every(text), 'Attempt source inspections and receipt IDs required.');
    for (const inspection of attempt.reinspections) {
      exactKeys(inspection, ['source_url', 'availability', 'checked_at', 'valid_until', 'evidence_ref'], 'Source reinspection');
      assert(url(inspection?.source_url) && inspection.availability === 'available' && timestamp(inspection.checked_at)
        && timestamp(inspection.valid_until) && text(inspection.evidence_ref), 'Invalid stored source reinspection.');
    }
  }
}

function validateCommitment(workspace, commitment) {
  exactKeys(commitment, ['schema_version', 'id', 'account_id', 'platform', 'conversation_id', 'offer_id', 'promised_by',
    'exact_promise', 'made_at', 'due_at', 'evidence_ids', 'status', 'outcome_id'], 'Commitment record');
  assert(commitment?.schema_version === 'conversation-commitment.v1' && text(commitment.id), 'Commitment identity required.');
  assertScope(workspace, commitment);
  assert(text(commitment.conversation_id) && text(commitment.offer_id) && ['owner', 'recipient'].includes(commitment.promised_by)
    && text(commitment.exact_promise) && timestamp(commitment.made_at), 'Explicit promise, identities, owner and time required.');
  assert(commitment.due_at === null || timestamp(commitment.due_at), 'Commitment due time must be explicit or null.');
  assert(Array.isArray(commitment.evidence_ids) && commitment.evidence_ids.length > 0
    && commitment.evidence_ids.every(text), 'Commitment evidence required.');
  assert(['open', ...TERMINAL_OUTCOMES].includes(commitment.status), 'Unknown commitment status.');
  assert(commitment.status === 'open' ? commitment.outcome_id === undefined : text(commitment.outcome_id),
    'Terminal commitments require one outcome identity.');
}

function validateOutcome(workspace, outcome) {
  exactKeys(outcome, ['schema_version', 'id', 'account_id', 'platform', 'conversation_id', 'offer_id', 'commitment_id',
    'status', 'occurred_at', 'evidence_basis', 'evidence_ref'], 'Outcome record');
  assert(outcome?.schema_version === 'conversation-outcome.v1' && text(outcome.id) && TERMINAL_OUTCOMES.has(outcome.status),
    'Outcome must be fulfilled, declined, withdrawn or uncertain.');
  assertScope(workspace, outcome);
  assert(text(outcome.conversation_id) && text(outcome.offer_id) && timestamp(outcome.occurred_at)
    && BASES.has(outcome.evidence_basis) && text(outcome.evidence_ref), 'Outcome identities and evidence required.');
  assert(outcome.commitment_id === null || text(outcome.commitment_id), 'Commitment identity must be a string or null.');
}

function validateReceipt(receipt) {
  exactKeys(receipt, ['schema_version', 'id', 'status', 'evidence_basis', 'evidence_ref', 'checked_at', 'idempotency_key',
    'action_hash', 'account_id', 'destination', 'exact_text_sha256', 'provider_ref'], 'Action receipt');
  assert(receipt?.schema_version === 'conversation-action-receipt.v1' && text(receipt.id)
    && ['succeeded', 'confirmed_not_sent', 'unknown'].includes(receipt.status), 'Known action receipt required.');
  assert(BASES.has(receipt.evidence_basis) && text(receipt.evidence_ref) && timestamp(receipt.checked_at)
    && text(receipt.idempotency_key) && /^[0-9a-f]{64}$/.test(receipt.action_hash)
    && text(receipt.account_id) && text(receipt.destination) && /^[0-9a-f]{64}$/.test(receipt.exact_text_sha256),
  'Receipt identity, basis, evidence and exact action binding required.');
  assert(receipt.provider_ref === undefined || text(receipt.provider_ref), 'Provider receipt reference must be nonempty when present.');
  if (receipt.status === 'confirmed_not_sent') {
    assert(receipt.evidence_basis === 'provider_observed', 'Confirmed absence must retain provider-observed origin.');
  }
}

function validateContent(content) {
  exactKeys(content, ['schema_version', 'id', 'question_key', 'evidence_ids', 'exact_text', 'authorship', 'created_at',
    'privacy_check'], 'Question content');
  assert(content?.schema_version === 'conversation-content.v1' && text(content.id) && text(content.question_key)
    && text(content.exact_text) && content.authorship === 'host_authored' && timestamp(content.created_at),
  'Safe content needs exact host-authored copy, question key and time.');
  assert(Array.isArray(content.evidence_ids) && content.evidence_ids.length > 0 && content.evidence_ids.every(text),
    'Content needs evidenced questions.');
  assert(content.privacy_check?.passed === true && Number.isInteger(content.privacy_check.identifier_count)
    && content.privacy_check.identifier_count >= 0 && /^[0-9a-f]{64}$/.test(content.privacy_check.identifiers_sha256),
  'Stored content needs a valid private-identifier check.');
  exactKeys(content.privacy_check, ['passed', 'identifier_count', 'identifiers_sha256'], 'Content privacy check');
}

function validateImport(record) {
  exactKeys(record, ['schema_version', 'import_key', 'records_hash', 'imported_at'], 'Import receipt');
  assert(record?.schema_version === 'conversation-import.v1' && text(record.import_key)
    && /^[0-9a-f]{64}$/.test(record.records_hash) && timestamp(record.imported_at), 'Invalid conversation import receipt.');
}

function actionBinding(action) {
  return {
    schema_version: action.schema_version,
    id: action.id,
    account_id: action.account_id,
    platform: action.platform,
    conversation_id: action.conversation_id,
    offer_id: action.offer_id,
    action_type: action.action_type,
    channel: action.channel,
    destination: action.destination,
    exact_text: action.exact_text,
    evidence_ids: action.evidence_ids,
  };
}

export const actionHash = (action) => reviewHash(actionBinding(action));

function findAction(workspace, id) {
  const action = workspace.actions.find((entry) => entry.id === id);
  assert(action, 'Unknown conversation action.');
  validateAction(workspace, action);
  return action;
}

function findEvidence(workspace, ids) {
  return ids.map((id) => {
    const evidence = workspace.evidence.find((entry) => entry.id === id);
    assert(evidence, `Unknown conversation evidence: ${id}.`);
    validateEvidence(workspace, evidence);
    return evidence;
  });
}

function consentForAction(workspace, action) {
  const evidence = findEvidence(workspace, action.evidence_ids).filter((entry) => entry.conversation_id === action.conversation_id
    && entry.offer_id === action.offer_id);
  const interest = evidence.find((entry) => entry.kind === 'recipient_interest' && entry.explicit === true
    && entry.relevant_to_offer === true);
  const permission = evidence.find((entry) => entry.kind === 'channel_permission' && entry.explicit === true
    && entry.channel === action.channel);
  const required = action.action_type === 'agree_next_step' || PRIVATE_CHANNELS.has(action.channel);
  return { required, interest_evidence_id: interest?.id ?? null, permission_evidence_id: permission?.id ?? null,
    ready: !required || Boolean(interest && permission) };
}

export function createConversationWorkspace(input) {
  exactKeys(input, ['id', 'account_id', 'platform', 'timezone', 'now'], 'Workspace initialization');
  assert(input && text(input.id) && text(input.account_id), 'Workspace and account identity required.');
  assert(input.platform === 'threads', 'The conversation engine currently supports scoped Threads evidence only.');
  validateTimezone(input.timezone);
  assert(timestamp(input.now), 'Workspace creation time required.');
  const workspace = {
    schema_version: 'conversation-workspace.v1',
    id: input.id,
    account_id: input.account_id,
    platform: input.platform,
    timezone: input.timezone,
    created_at: input.now,
    offers: [], evidence: [], actions: [], commitments: [], outcomes: [], content: [], imports: [], receipts: [],
  };
  validateWorkspace(workspace);
  return workspace;
}

export function validateWorkspace(workspace) {
  exactKeys(workspace, ['schema_version', 'id', 'account_id', 'platform', 'timezone', 'created_at', 'offers', 'evidence',
    'actions', 'commitments', 'outcomes', 'content', 'imports', 'receipts'], 'Conversation workspace');
  assert(workspace?.schema_version === 'conversation-workspace.v1' && text(workspace.id), 'Unsupported conversation workspace.');
  assert(text(workspace.account_id) && workspace.platform === 'threads' && timestamp(workspace.created_at),
    'Workspace identity and creation time required.');
  validateTimezone(workspace.timezone);
  for (const field of ['offers', 'evidence', 'actions', 'commitments', 'outcomes', 'content', 'imports', 'receipts']) {
    assert(Array.isArray(workspace[field]), `Workspace ${field} must be an array.`);
  }
  workspace.offers.forEach((entry) => validateOffer(workspace, entry));
  workspace.evidence.forEach((entry) => validateEvidence(workspace, entry));
  workspace.actions.forEach((entry) => validateAction(workspace, entry));
  workspace.commitments.forEach((entry) => validateCommitment(workspace, entry));
  workspace.outcomes.forEach((entry) => validateOutcome(workspace, entry));
  workspace.content.forEach(validateContent);
  workspace.imports.forEach(validateImport);
  workspace.receipts.forEach(validateReceipt);
  for (const [field, identity] of [['offers', 'id'], ['evidence', 'id'], ['actions', 'id'], ['commitments', 'id'],
    ['outcomes', 'id'], ['content', 'id'], ['imports', 'import_key'], ['receipts', 'id']]) {
    assert(new Set(workspace[field].map((entry) => entry[identity])).size === workspace[field].length,
      `Workspace ${field} identities must be unique.`);
  }
  for (const action of workspace.actions) {
    const evidence = findEvidence(workspace, action.evidence_ids);
    assert(evidence.every((entry) => entry.conversation_id === action.conversation_id)
      && evidence.some((entry) => entry.offer_id === action.offer_id), 'Stored action evidence identity mismatch.');
    if (['approved', 'attempt_pending', 'unknown', 'succeeded'].includes(action.state)) {
      assert(action.approval?.action_hash === actionHash(action), 'Stored action approval does not bind exact current action.');
    } else assert(action.approval === null, 'Draft or rejected action cannot retain approval.');
    if (action.state === 'attempt_pending') assert(action.attempts.at(-1)?.outcome === 'pending', 'Pending action attempt mismatch.');
    if (action.state === 'unknown') assert(action.attempts.at(-1)?.outcome === 'unknown', 'Unknown action attempt mismatch.');
    if (action.state === 'succeeded') assert(action.attempts.some((attempt) => attempt.outcome === 'succeeded'), 'Successful action receipt missing.');
  }
  for (const commitment of workspace.commitments) {
    const evidence = findEvidence(workspace, commitment.evidence_ids);
    assert(evidence.some((entry) => entry.kind === 'commitment' && entry.explicit === true)
      && evidence.every((entry) => entry.conversation_id === commitment.conversation_id && entry.offer_id === commitment.offer_id),
    'Stored commitment evidence identity mismatch.');
  }
  for (const outcome of workspace.outcomes) {
    if (outcome.commitment_id !== null) {
      const commitment = workspace.commitments.find((entry) => entry.id === outcome.commitment_id);
      assert(commitment && commitment.outcome_id === outcome.id && commitment.status === outcome.status,
        'Stored outcome and commitment terminal state mismatch.');
    }
  }
  for (const content of workspace.content) {
    const evidence = findEvidence(workspace, content.evidence_ids);
    assert(evidence.every((entry) => entry.kind === 'question' && entry.question_key === content.question_key),
      'Stored content question evidence mismatch.');
    const identifiers = [...new Set([workspace.account_id, ...evidence.flatMap((entry) => [entry.conversation_id,
      entry.source.url, ...entry.private_identifiers])])].filter(text);
    const lowered = content.exact_text.toLocaleLowerCase();
    assert(!identifiers.some((identifier) => lowered.includes(identifier.toLocaleLowerCase()))
      && content.privacy_check.identifiers_sha256 === reviewHash(identifiers.sort()), 'Stored content private-identifier check mismatch.');
  }
  for (const receipt of workspace.receipts) {
    const matches = workspace.actions.flatMap((action) => action.attempts.map((attempt) => ({ action, attempt })))
      .filter(({ attempt }) => attempt.receipt_ids.includes(receipt.id));
    assert(matches.length === 1, 'Stored receipt must belong to exactly one action attempt.');
    const [{ action, attempt }] = matches;
    assert(receipt.idempotency_key === attempt.idempotency_key && receipt.action_hash === attempt.action_hash
      && receipt.account_id === attempt.account_id && receipt.account_id === action.account_id
      && receipt.destination === attempt.destination && receipt.exact_text_sha256 === attempt.exact_text_sha256,
    'Stored receipt does not match its exact action attempt.');
  }
  reviewHash(workspace);
  return true;
}

export function importConversationRecords(workspace, input) {
  validateWorkspace(workspace);
  exactKeys(input, ['import_key', 'imported_at', 'records'], 'Conversation import');
  assert(text(input?.import_key) && timestamp(input.imported_at), 'Import key and time required.');
  assert(Array.isArray(input.records) && input.records.length > 0, 'Import needs at least one minimal record.');
  const recordsHash = reviewHash(input.records);
  const prior = workspace.imports.find((entry) => entry.import_key === input.import_key);
  if (prior) {
    assert(prior.records_hash === recordsHash, 'Import key already contains different records.');
    return clone(workspace);
  }
  const next = clone(workspace);
  for (const record of input.records) {
    if (record.record_type === 'offer') {
      validateOffer(next, record);
      const existing = next.offers.find((entry) => entry.id === record.id);
      if (existing) assert(reviewHash(existing) === reviewHash(record), 'Offer ID already contains different evidence.');
      else next.offers.push(clone(record));
    } else {
      validateEvidence(next, record);
      const existing = next.evidence.find((entry) => entry.id === record.id);
      if (existing) assert(reviewHash(existing) === reviewHash(record), 'Evidence ID already contains different evidence.');
      else next.evidence.push(clone(record));
    }
  }
  next.imports.push({ schema_version: 'conversation-import.v1', import_key: input.import_key,
    records_hash: recordsHash, imported_at: input.imported_at });
  validateWorkspace(next);
  return next;
}

function evidenceSummary(evidence) {
  return {
    id: evidence.id,
    conversation_id: evidence.conversation_id,
    offer_id: evidence.offer_id,
    kind: evidence.kind,
    observed_at: evidence.observed_at,
    evidence_basis: evidence.evidence_basis,
    source: clone(evidence.source),
  };
}

export function planNextActions(workspace, input = {}) {
  validateWorkspace(workspace);
  const limit = input.limit ?? 3;
  assert(Number.isInteger(limit) && limit >= 1 && limit <= 3, 'Your Next Moves supports one through three actions.');
  if (input.offer_id !== undefined) assert(text(input.offer_id), 'Offer identity must be nonempty.');
  const unresolved = workspace.actions.filter((action) => UNRESOLVED_ACTION_STATES.has(action.state)
    && (!input.offer_id || action.offer_id === input.offer_id));
  const priority = { attempt_pending: 0, unknown: 0, approved: 1, draft: 2 };
  unresolved.sort((a, b) => priority[a.state] - priority[b.state] || Date.parse(a.created_at) - Date.parse(b.created_at));
  if (unresolved.length) {
    const actions = unresolved.slice(0, limit).map((action) => ({ ...actionBinding(action), state: action.state,
      consent: consentForAction(workspace, action), evidence: findEvidence(workspace, action.evidence_ids).map(evidenceSummary) }));
    return { schema_version: 'conversation-next-actions.v1', status: 'resume_unresolved', actions,
      review_now: actions.find((entry) => entry.state === 'draft')?.id ?? null,
      review_policy: 'display_and_decide_one_action_at_a_time' };
  }
  const activeOffers = workspace.offers.filter((offer) => offer.status === 'active'
    && (!input.offer_id || offer.id === input.offer_id));
  if (activeOffers.length !== 1) {
    return { schema_version: 'conversation-next-actions.v1', status: 'offer_required', actions: [], review_now: null,
      next_workflow: 'offer-builder', reason: activeOffers.length === 0 ? 'missing_active_offer' : 'select_one_offer' };
  }
  const offer = activeOffers[0];
  const usedEvidence = new Set(workspace.actions.flatMap((action) => action.evidence_ids));
  const candidates = workspace.evidence.filter((entry) => entry.kind === 'action_candidate' && entry.offer_id === offer.id
    && !usedEvidence.has(entry.id)).sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at)).slice(0, limit)
    .map((entry) => evidenceSummary(entry));
  return { schema_version: 'conversation-next-actions.v1', status: candidates.length ? 'candidates' : 'no_candidates',
    offer_id: offer.id, actions: candidates.map((entry) => ({ state: 'candidate', evidence: entry })), review_now: null,
    review_policy: 'prepare_then_display_and_decide_one_action_at_a_time' };
}

export function prepareAction(workspace, input) {
  validateWorkspace(workspace);
  exactKeys(input, ['id', 'conversation_id', 'offer_id', 'action_type', 'channel', 'destination', 'exact_text',
    'evidence_ids', 'now'], 'Action preparation');
  const now = input?.now;
  assert(timestamp(now), 'Action preparation time required.');
  assert(workspace.offers.some((offer) => offer.id === input.offer_id && offer.status === 'active'),
    'Action preparation requires a confirmed active offer reference.');
  const candidate = {
    schema_version: 'conversation-action.v1',
    id: input.id,
    account_id: workspace.account_id,
    platform: workspace.platform,
    conversation_id: input.conversation_id,
    offer_id: input.offer_id,
    action_type: input.action_type,
    channel: input.channel,
    destination: input.destination,
    exact_text: input.exact_text,
    evidence_ids: clone(input.evidence_ids),
    created_at: now,
    updated_at: now,
    state: 'draft', approval: null, attempts: [],
  };
  validateAction(workspace, candidate);
  const supporting = findEvidence(workspace, candidate.evidence_ids);
  assert(supporting.every((entry) => entry.conversation_id === candidate.conversation_id),
    'Action evidence must match the conversation identity.');
  assert(supporting.some((entry) => entry.offer_id === candidate.offer_id), 'Action evidence must support the offer identity.');
  if (candidate.action_type === 'request_channel_permission') {
    assert(candidate.channel === 'threads_public', 'Ask for channel permission only in the existing public conversation.');
  }
  const next = clone(workspace);
  const index = next.actions.findIndex((entry) => entry.id === candidate.id);
  if (index < 0) next.actions.push(candidate);
  else {
    const current = next.actions[index];
    assert(!['attempt_pending', 'unknown', 'succeeded'].includes(current.state),
      'Resolve or preserve the prior attempt before editing this action.');
    if (actionHash(current) === actionHash(candidate)) return next;
    candidate.created_at = current.created_at;
    candidate.attempts = clone(current.attempts);
    next.actions[index] = candidate;
  }
  validateWorkspace(next);
  return next;
}

export function displayActionReview(workspace, actionId) {
  validateWorkspace(workspace);
  const action = findAction(workspace, actionId);
  assert(!['attempt_pending', 'unknown', 'succeeded'].includes(action.state), 'This action is not available for review.');
  const body = {
    schema_version: 'conversation-review-display.v1',
    workspace_id: workspace.id,
    action: actionBinding(action),
    evidence: findEvidence(workspace, action.evidence_ids).map(evidenceSummary),
    consent: consentForAction(workspace, action),
    proof_note: 'Host-supplied evidence; the local engine does not inspect or verify a provider.',
  };
  return { ...body, hash: reviewHash(body) };
}

export function decideAction(workspace, displayed, decision) {
  validateWorkspace(workspace);
  assert(['approve', 'reject'].includes(decision?.decision) && timestamp(decision.at) && text(decision.evidence_ref),
    'Decision must be explicit approve or reject with owner evidence and time.');
  const { hash, ...body } = displayed ?? {};
  assert(hash === reviewHash(body) && body.workspace_id === workspace.id, 'Invalid or mutated review display.');
  const current = displayActionReview(workspace, body.action?.id);
  assert(current.hash === hash, 'Action changed since display; review the exact action again.');
  const next = clone(workspace);
  const action = findAction(next, current.action.id);
  if (decision.decision === 'reject') {
    action.approval = null;
    action.state = 'rejected';
  } else {
    action.approval = { action_hash: actionHash(action), display_hash: hash, decision: 'approve',
      evidence_ref: decision.evidence_ref, at: decision.at };
    action.state = 'approved';
  }
  action.updated_at = decision.at;
  return next;
}

function validateReinspections(workspace, action, reinspections, now) {
  const sources = [...new Set(findEvidence(workspace, action.evidence_ids).map((entry) => entry.source.url))];
  assert(Array.isArray(reinspections) && reinspections.length === sources.length,
    'Fresh source reinspection is required for every action source.');
  for (const sourceUrl of sources) {
    const inspection = reinspections.find((entry) => entry.source_url === sourceUrl);
    assert(inspection && inspection.availability === 'available' && text(inspection.evidence_ref),
      'Unavailable sources preserve historical facts but cannot supply current action permission.');
    assert(timestamp(inspection.checked_at) && timestamp(inspection.valid_until)
      && Date.parse(inspection.checked_at) >= Date.parse(action.approval.at)
      && Date.parse(inspection.checked_at) <= Date.parse(now)
      && Date.parse(now) - Date.parse(inspection.checked_at) <= 300_000
      && Date.parse(inspection.valid_until) > Date.parse(now), 'Fresh source reinspection required before external action.');
  }
}

export function beginActionAttempt(workspace, input) {
  validateWorkspace(workspace);
  exactKeys(input, ['action_id', 'now', 'reinspections'], 'Action attempt input');
  assert(timestamp(input?.now), 'Attempt time required.');
  const next = clone(workspace);
  const action = findAction(next, input.action_id);
  assert(action.state === 'approved' && action.approval?.action_hash === actionHash(action), 'Exact current user approval required.');
  assert(consentForAction(next, action).ready, 'Recipient interest and channel permission are separate from user approval and both are required.');
  validateReinspections(next, action, input.reinspections, input.now);
  const key = `conversation-${reviewHash({ workspace_id: next.id, action_id: action.id, action_hash: actionHash(action) })}`;
  action.attempts.push({ schema_version: 'conversation-attempt.v1', number: action.attempts.length + 1,
    idempotency_key: key, action_hash: actionHash(action), started_at: input.now, outcome: 'pending',
    account_id: action.account_id, destination: action.destination, exact_text_sha256: reviewHash(action.exact_text),
    reinspections: clone(input.reinspections), receipt_ids: [] });
  action.state = 'attempt_pending';
  action.updated_at = input.now;
  return next;
}

export function recordActionReceipt(workspace, input) {
  validateWorkspace(workspace);
  exactKeys(input, ['action_id', 'receipt'], 'Receipt input');
  const receipt = input?.receipt;
  validateReceipt(receipt);
  const existing = workspace.receipts.find((entry) => entry.id === receipt.id);
  if (existing) {
    assert(reviewHash(existing) === reviewHash(receipt), 'Receipt ID already contains different evidence.');
    return clone(workspace);
  }
  const next = clone(workspace);
  const action = findAction(next, input.action_id);
  assert(['attempt_pending', 'unknown'].includes(action.state), 'No unresolved action attempt; successful actions are preserved.');
  const attempt = action.attempts.at(-1);
  assert(attempt && receipt.idempotency_key === attempt.idempotency_key && receipt.action_hash === attempt.action_hash
    && receipt.account_id === attempt.account_id && receipt.destination === attempt.destination
    && receipt.exact_text_sha256 === attempt.exact_text_sha256, 'Receipt must match exact action, account, destination and copy.');
  assert(Date.parse(receipt.checked_at) >= Date.parse(attempt.started_at), 'Receipt predates the action attempt.');
  if (receipt.status === 'confirmed_not_sent') {
    assert(receipt.evidence_basis === 'provider_observed', 'Retry requires host-supplied provider absence evidence.');
    action.state = 'approved';
    attempt.outcome = 'confirmed_not_sent';
  } else if (receipt.status === 'succeeded') {
    action.state = 'succeeded';
    attempt.outcome = 'succeeded';
  } else {
    action.state = 'unknown';
    attempt.outcome = 'unknown';
  }
  attempt.receipt_ids.push(receipt.id);
  action.updated_at = receipt.checked_at;
  next.receipts.push(clone(receipt));
  return next;
}

export function recordCommitment(workspace, input) {
  validateWorkspace(workspace);
  exactKeys(input, ['schema_version', 'id', 'account_id', 'platform', 'conversation_id', 'offer_id', 'promised_by',
    'exact_promise', 'made_at', 'due_at', 'evidence_ids'], 'Commitment input');
  const record = { ...clone(input), status: 'open' };
  validateCommitment(workspace, record);
  const evidence = findEvidence(workspace, input.evidence_ids);
  assert(evidence.some((entry) => entry.kind === 'commitment' && entry.explicit === true)
    && evidence.every((entry) => entry.conversation_id === input.conversation_id && entry.offer_id === input.offer_id),
  'Commitment needs matching explicit promise evidence for the same conversation and offer.');
  const existing = workspace.commitments.find((entry) => entry.id === input.id);
  if (existing) {
    assert(reviewHash(existing) === reviewHash(record), 'Commitment ID already contains different facts.');
    return clone(workspace);
  }
  const next = clone(workspace); next.commitments.push(record); return next;
}

export function recordOutcome(workspace, input) {
  validateWorkspace(workspace);
  exactKeys(input, ['schema_version', 'id', 'account_id', 'platform', 'conversation_id', 'offer_id', 'commitment_id',
    'status', 'occurred_at', 'evidence_basis', 'evidence_ref'], 'Outcome input');
  validateOutcome(workspace, input);
  const existing = workspace.outcomes.find((entry) => entry.id === input.id);
  if (existing) {
    assert(reviewHash(existing) === reviewHash(input), 'Outcome ID already contains different evidence.');
    return clone(workspace);
  }
  const next = clone(workspace);
  if (input.commitment_id !== null) {
    const commitment = next.commitments.find((entry) => entry.id === input.commitment_id);
    assert(commitment && commitment.conversation_id === input.conversation_id && commitment.offer_id === input.offer_id,
      'Outcome commitment must match conversation and offer identity.');
    assert(commitment.status === 'open', 'Terminal commitment outcome is immutable.');
    commitment.status = input.status;
    commitment.outcome_id = input.id;
  }
  next.outcomes.push(clone(input));
  return next;
}

export function planFollowThrough(workspace, input) {
  validateWorkspace(workspace);
  assert(timestamp(input?.now), 'Follow-through time required.');
  const open = workspace.commitments.filter((entry) => entry.status === 'open');
  return {
    schema_version: 'conversation-follow-through.v1',
    needs_timing_question: open.filter((entry) => entry.due_at === null).map((entry) => entry.id),
    due_for_preparation: open.filter((entry) => entry.due_at !== null && Date.parse(entry.due_at) <= Date.parse(input.now)).map((entry) => entry.id),
    upcoming: open.filter((entry) => entry.due_at !== null && Date.parse(entry.due_at) > Date.parse(input.now)).map((entry) => entry.id),
    terminal: workspace.commitments.filter((entry) => TERMINAL_OUTCOMES.has(entry.status)).map((entry) => ({ id: entry.id, status: entry.status })),
    silence_grants_permission: false,
    automatic_reminders: false,
  };
}

export function groupQuestions(workspace, input = {}) {
  validateWorkspace(workspace);
  const questions = workspace.evidence.filter((entry) => entry.kind === 'question'
    && (!input.offer_id || entry.offer_id === input.offer_id));
  const groups = new Map();
  for (const entry of questions) {
    const group = groups.get(entry.question_key) ?? [];
    group.push(entry); groups.set(entry.question_key, group);
  }
  return { schema_version: 'conversation-question-groups.v1', groups: [...groups.entries()].map(([questionKey, entries]) => ({
    question_key: questionKey,
    occurrence: entries.length === 1 ? 'single' : 'repeated',
    count: entries.length,
    evidence: entries.map(evidenceSummary),
  })).sort((a, b) => b.count - a.count || a.question_key.localeCompare(b.question_key)),
  drafting: 'host_authored_only' };
}

export function saveQuestionContent(workspace, input) {
  validateWorkspace(workspace);
  exactKeys(input, ['schema_version', 'id', 'question_key', 'evidence_ids', 'exact_text', 'authorship', 'created_at'],
    'Question content input');
  assert(input?.schema_version === 'conversation-content.v1' && text(input.id) && text(input.question_key)
    && text(input.exact_text) && input.authorship === 'host_authored' && timestamp(input.created_at),
  'Safe content needs exact host-authored copy, question key and time.');
  assert(Array.isArray(input.evidence_ids) && input.evidence_ids.length > 0, 'Content needs evidenced questions.');
  const evidence = findEvidence(workspace, input.evidence_ids);
  assert(evidence.every((entry) => entry.kind === 'question' && entry.question_key === input.question_key),
    'Content evidence must be questions in one exact group.');
  const identifiers = [...new Set([workspace.account_id, ...evidence.flatMap((entry) => [entry.conversation_id,
    entry.source.url, ...entry.private_identifiers])])].filter(text);
  const lowered = input.exact_text.toLocaleLowerCase();
  assert(!identifiers.some((identifier) => lowered.includes(identifier.toLocaleLowerCase())),
    'Host-authored content contains a private identifier or source link.');
  const record = { ...clone(input), privacy_check: { passed: true, identifier_count: identifiers.length,
    identifiers_sha256: reviewHash(identifiers.sort()) } };
  const existing = workspace.content.find((entry) => entry.id === input.id);
  if (existing) {
    assert(reviewHash(existing) === reviewHash(record), 'Content ID already contains different exact copy.');
    return clone(workspace);
  }
  const next = clone(workspace); next.content.push(record); return next;
}

function subtractLocalDays(localDate, days) {
  const date = new Date(`${localDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function inLocalWindow(value, timezone, startDate, endDate, asOf) {
  if (!timestamp(value) || Date.parse(value) > Date.parse(asOf)) return false;
  const date = localClock(value, timezone).date;
  return date >= startDate && date <= endDate;
}

function metric(records, coverage, identity) {
  const unique = new Map(records.map((entry) => [identity(entry), entry]));
  const values = [...unique.values()];
  const observed = values.length;
  return {
    total: coverage === 'complete' ? observed : null,
    observed_minimum: observed,
    coverage,
    owner_reported: values.filter((entry) => entry.evidence_basis === 'owner_reported').length,
    provider_observed: values.filter((entry) => entry.evidence_basis === 'provider_observed').length,
  };
}

export function summarizeWeeklyOutcomes(workspace, input) {
  validateWorkspace(workspace);
  assert(timestamp(input?.as_of), 'Weekly outcomes as-of time required.');
  const coverage = input.coverage ?? {};
  const allowedCoverage = new Set(['complete', 'partial', 'unavailable', 'unknown']);
  const getCoverage = (name) => {
    const value = coverage[name] ?? 'unknown';
    assert(allowedCoverage.has(value), `Unknown ${name} coverage.`);
    return value;
  };
  const endDate = localClock(input.as_of, workspace.timezone).date;
  const startDate = subtractLocalDays(endDate, 6);
  const recentEvidence = workspace.evidence.filter((entry) => inLocalWindow(entry.observed_at, workspace.timezone, startDate, endDate, input.as_of));
  const opportunities = recentEvidence.filter((entry) => entry.kind === 'opportunity_explored');
  const leads = recentEvidence.filter((entry) => entry.kind === 'recipient_interest' && entry.explicit === true
    && entry.relevant_to_offer === true && entry.offer_id !== null);
  const agreedSteps = recentEvidence.filter((entry) => entry.kind === 'agreed_step' && entry.explicit === true);
  const outcomes = workspace.outcomes.filter((entry) => inLocalWindow(entry.occurred_at, workspace.timezone, startDate, endDate, input.as_of));
  return {
    schema_version: 'conversation-weekly-outcomes.v1',
    timezone: workspace.timezone,
    window: { start_local_date: startDate, end_local_date: endDate, as_of: input.as_of, calendar_days: 7 },
    explored_opportunities: metric(opportunities, getCoverage('explored_opportunities'), (entry) => entry.conversation_id),
    leads: metric(leads, getCoverage('leads'), (entry) => entry.conversation_id),
    agreed_steps: metric(agreedSteps, getCoverage('agreed_steps'), (entry) => `${entry.conversation_id}:${entry.step_key}`),
    outcomes: metric(outcomes, getCoverage('outcomes'), (entry) => entry.id),
    qualification_note: 'Public questions alone are not leads; explicit interest in relevant help or an identified offer is required.',
    proof_note: 'Counts use host-supplied owner reports and provider observations. The local engine does not verify providers.',
  };
}

export function prepareReminder(workspace, input) {
  const followThrough = planFollowThrough(workspace, input);
  return {
    schema_version: 'conversation-reminder.v1',
    status: 'host_native_opt_in_required',
    created: false,
    automatic: false,
    candidate_commitment_ids: [...followThrough.needs_timing_question, ...followThrough.due_for_preparation],
    instruction: 'The host may offer a native reminder only after explicit user opt-in.',
  };
}
