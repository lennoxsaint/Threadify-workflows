import { createHash } from 'node:crypto';
import { readState, updateState } from './store.mjs';
import { resolveAdaptation } from './sources.mjs';
import { localClock, resolveLocalTime } from './time.mjs';

const LANES = ['greatest_hit', 'greatest_hit', 'viral_vault', 'viral_vault', 'my_vault', 'my_vault'];
const TOPICS = ['broad', 'broad', 'expertise', 'expertise', 'personal', 'personal'];
const ROLES = ['proven', 'proven', 'proven', 'proven', 'challenger', 'challenger'];
const GOALS = new Set(['reach_first', 'balanced', 'lead_first']);
const ACTIVE = new Set(['pending', 'edited_pending', 'validated', 'approved_unscheduled']);
const TERMINAL = new Set(['scheduled', 'reviewed_local', 'leave_for_tomorrow', 'rejected']);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const timestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));

function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  assert(value && Object.getPrototypeOf(value) === Object.prototype, 'Viral Vault records must be plain JSON.');
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

export const viralVaultHash = (value) => createHash('sha256').update(canonical(value)).digest('hex');

function isoDate(value) {
  assert(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'ISO local date required.');
  const parsed = new Date(`${value}T00:00:00Z`);
  assert(Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value, 'Valid local date required.');
  return parsed;
}

function addDays(value, amount) {
  const date = isoDate(value);
  return new Date(date.getTime() + amount * 86_400_000).toISOString().slice(0, 10);
}

function preferences(input) {
  assert(text(input?.account_id) && text(input?.timezone), 'Account and timezone are required.');
  new Intl.DateTimeFormat('en', { timeZone: input.timezone }).format();
  assert(GOALS.has(input.goal), 'Choose reach_first, balanced, or lead_first.');
  assert(Array.isArray(input.times) && input.times.length === 6
    && input.times.every((time) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))
    && new Set(input.times).size === 6, 'Choose exactly six distinct local posting times.');
  if (input.goal !== 'reach_first') {
    assert(text(input.offer?.id) && input.offer?.verified === true && text(input.offer?.evidence_ref),
      'Balanced and lead-first setup requires one verified offer.');
  }
  return {
    account_id: input.account_id,
    timezone: input.timezone,
    goal: input.goal,
    times: [...input.times],
    offer: input.goal === 'reach_first' ? null : structuredClone(input.offer),
  };
}

export function createViralVaultPlan(input) {
  assert(text(input?.id) && timestamp(input.now), 'Plan ID and current time are required.');
  isoDate(input.start_date);
  const setup = preferences(input.preferences);
  const days = Array.from({ length: 30 }, (_, dayIndex) => {
    const date = addDays(input.start_date, dayIndex);
    return {
      day: dayIndex + 1,
      date,
      drafting: dayIndex === 0 ? 'due' : 'just_in_time',
      slots: LANES.map((lane, index) => ({
        slot: index + 1,
        lane,
        topic: TOPICS[(index + dayIndex * 2) % TOPICS.length],
        role: ROLES[(index + dayIndex) % ROLES.length],
        local_time: setup.times[index],
        timezone: setup.timezone,
        copy_state: 'blueprint_only',
      })),
    };
  });
  return {
    schema_version: 'viral-vault-30-plan.v1',
    id: input.id,
    created_at: input.now,
    protocol: 'literal-template-public-v1',
    label: '30 days, six posts per day, drafted one day at a time',
    preferences: setup,
    days,
  };
}

function validateCard(content, plan, now, reuseProof) {
  assert(content && text(content.id) && content.account_id === plan.preferences.account_id
    && content.timezone === plan.preferences.timezone, 'Card identity, account, and timezone must match the plan.');
  assert(Array.isArray(content.parts) && content.parts.length > 0 && content.parts.every(text), 'Exact nonempty post parts required.');
  assert(content.source && text(content.source.id) && text(content.source.url) && text(content.source.author)
    && LANES.includes(content.source.lane), 'Complete source lineage and a supported source lane are required.');
  assert(['exact_repost', 'literal_fill_in'].includes(content.adaptation_mode), 'This workflow accepts exact repost or literal fill-in only.');
  assert(content.method === 'host_authored', 'Literal cards must be resolved deterministically, never provider-generated.');
  assert(['broad', 'expertise', 'personal'].includes(content.topic), 'Supported topic required.');
  assert(['proven', 'challenger'].includes(content.role), 'Supported experiment role required.');
  assert(text(content.viral_structure) && text(content.taxonomy), 'Structure and Threadify taxonomy are required.');
  assert(['none', 'earned'].includes(content.cta), 'CTA must be none or earned.');
  if (content.cta === 'earned') {
    assert(plan.preferences.goal !== 'reach_first' && content.offer_id === plan.preferences.offer.id,
      'An earned CTA must use the verified selected offer.');
  } else assert(content.offer_id === null, 'Cards without a CTA cannot bind an offer.');
  assert(content.draft_id === null || text(content.draft_id), 'Draft ID must be null or a nonempty provider ID.');
  assert(reuseProof?.context?.account_id === content.account_id
    && reuseProof.adaptation?.source?.id === content.source.id
    && reuseProof.adaptation.source.url === content.source.url,
  'Every literal card requires matching source-rights evidence.');
  const resolved = resolveAdaptation(reuseProof.adaptation, { ...reuseProof.context, now });
  assert(resolved.mode === content.adaptation_mode && canonical(resolved.parts) === canonical(content.parts),
    'Card copy must exactly match the rights-gated deterministic adaptation.');
  return viralVaultHash(content);
}

function validatePortfolio(cards, plan, now, reuseProofs) {
  assert(Array.isArray(cards) && cards.length === 6, 'A daily queue must contain exactly six cards.');
  assert(new Set(cards.map((card) => card.id)).size === 6, 'Daily card IDs must be unique.');
  cards.forEach((card) => validateCard(card, plan, now, reuseProofs?.[card.id]));
  assert(canonical(cards.map((card) => card.source.lane).sort()) === canonical([...LANES].sort()),
    'Daily sources must be exactly two Greatest Hits, two Viral Vault, and two My Vault cards.');
  assert(cards.filter((card) => card.role === 'proven').length === 4
    && cards.filter((card) => card.role === 'challenger').length === 2, 'Daily roles must be four proven and two challenger cards.');
  for (const topic of ['broad', 'expertise', 'personal']) {
    assert(cards.filter((card) => card.topic === topic).length === 2, `Daily topics must contain exactly two ${topic} cards.`);
  }
  assert(new Set(cards.map((card) => card.viral_structure)).size >= 3
    && cards.some((card) => card.viral_structure === 'listicle'), 'Use at least three structures including one listicle.');
  const ctas = cards.filter((card) => card.cta === 'earned');
  assert(ctas.length <= 1, 'At most one earned CTA is allowed each day.');
  if (plan.preferences.goal === 'reach_first') assert(ctas.length === 0, 'Reach-first queues have no CTA.');
  const leadCards = cards.filter((card) => card.lead_oriented === true).length;
  if (plan.preferences.goal === 'balanced') assert(leadCards === 1, 'Balanced queues require exactly one offer-aligned card.');
  if (plan.preferences.goal === 'lead_first') assert(leadCards === 3, 'Lead-first queues require exactly three buyer-problem cards.');
}

function currentCard(packet) {
  if (packet.blocked_card_id) return packet.cards.find((card) => card.content.id === packet.blocked_card_id);
  return packet.cards.find((card) => ACTIVE.has(card.state)) ?? null;
}

function display(card, packet) {
  if (!card) return { schema_version: 'viral-vault-30-display.v1', packet_id: packet.id, complete: true };
  const body = {
    schema_version: 'viral-vault-30-display.v1',
    packet_id: packet.id,
    day: packet.day,
    position: packet.cards.indexOf(card) + 1,
    total: 6,
    card: {
      content: structuredClone(card.content),
      content_hash: viralVaultHash(card.content),
      state: card.state,
      validation: structuredClone(card.validation),
      suggested_at: card.time_suggestions.at(-1).instant,
      suggestion_evidence_ref: card.time_suggestions.at(-1).evidence_ref,
    },
  };
  return { ...body, display_hash: viralVaultHash(body) };
}

export function createViralVaultPacket({ plan, id, date, now, cards, reuse_proofs, suggestions, previous_packet = null }) {
  assert(plan?.schema_version === 'viral-vault-30-plan.v1' && text(id) && timestamp(now), 'Plan, packet ID, and current time are required.');
  const day = plan.days.find((candidate) => candidate.date === date);
  assert(day, 'Packet date must be inside the 30-day blueprint.');
  const carried = previous_packet?.cards.filter((card) => card.state === 'leave_for_tomorrow') ?? [];
  assert(carried.length + cards.length === 6, 'Carry skipped cards first, then top up the queue to exactly six.');
  const contents = [...carried.map((card) => structuredClone(card.content)), ...cards];
  validatePortfolio(contents, plan, now, reuse_proofs);
  for (const carriedCard of carried) {
    assert(viralVaultHash(carriedCard.content) === viralVaultHash(contents.find((card) => card.id === carriedCard.content.id)),
      'Carried cards must remain byte-for-byte unchanged.');
  }
  const seen = new Set();
  for (const card of contents) {
    const key = `${card.source.id}\n${card.source.url}`;
    assert(!seen.has(key), 'Duplicate daily sources are not allowed.');
    seen.add(key);
  }
  const queue = contents.map((content, index) => {
    const instant = suggestions?.[content.id]?.instant;
    const evidenceRef = suggestions?.[content.id]?.evidence_ref;
    assert(timestamp(instant) && text(evidenceRef), 'Each card requires an evidenced schedule suggestion.');
    const clock = localClock(instant, plan.preferences.timezone);
    assert(clock.date === date && clock.time === day.slots[index].local_time,
      'Each suggestion must match its confirmed plan slot in the verified timezone.');
    resolveLocalTime(clock.date, clock.time, plan.preferences.timezone, instant);
    return {
      content: structuredClone(content),
      state: 'pending',
      carried_from: carried.some((card) => card.content.id === content.id) ? previous_packet.id : null,
      validation: null,
      validation_history: [],
      approval: null,
      delivery: null,
      time_suggestions: [{ instant: new Date(instant).toISOString(), evidence_ref: evidenceRef, recorded_at: now }],
    };
  });
  const packet = {
    schema_version: 'viral-vault-30-packet.v1', id, plan_id: plan.id, day: day.day, date, created_at: now,
    protocol: plan.protocol, cards: queue, blocked_card_id: null,
    reuse_evidence: Object.fromEntries(contents.map((content) => [content.id, structuredClone(reuse_proofs[content.id])])),
  };
  return { packet, display: display(currentCard(packet), packet) };
}

export function displayNextViralVaultCard(packet) {
  assert(packet?.schema_version === 'viral-vault-30-packet.v1', 'Unsupported packet.');
  return display(currentCard(packet), packet);
}

function assertValidationReceipt(card, receipt, now) {
  assert(text(receipt?.id) && text(receipt.evidence_ref) && ['local', 'threadify'].includes(receipt.kind)
    && ['passed', 'failed'].includes(receipt.status), 'Complete validation receipt required.');
  assert(receipt.content_hash === viralVaultHash(card.content) && receipt.account_id === card.content.account_id,
    'Validation must bind the exact card and account.');
  assert(timestamp(receipt.checked_at) && timestamp(receipt.valid_until) && timestamp(now)
    && Date.parse(receipt.checked_at) <= Date.parse(now)
    && Date.parse(now) - Date.parse(receipt.checked_at) <= 300_000
    && Date.parse(receipt.valid_until) > Date.parse(now), 'Fresh validation evidence required.');
  assert(Array.isArray(receipt.issues)
    && (receipt.status === 'passed' ? receipt.issues.length === 0 : receipt.issues.length > 0),
  'Validation result must agree with its issues.');
  if (receipt.kind === 'threadify') assert(receipt.authoritative === true && receipt.tool === 'validate_post'
    && text(card.content.draft_id) && receipt.draft_id === card.content.draft_id, 'Provider validation must match the editable draft.');
}

export function recordViralVaultValidation(packet, input) {
  const next = structuredClone(packet); const card = currentCard(next);
  assert(card && card.content.id === input.card_id, 'Only the displayed card can be validated.');
  const receipt = input.receipt;
  assertValidationReceipt(card, receipt, input.now);
  card.validation = structuredClone(receipt);
  card.validation_history.push(structuredClone(receipt));
  card.state = receipt.status === 'passed' ? 'validated' : 'edited_pending';
  return next;
}

function assertDisplay(packet, shown) {
  const live = displayNextViralVaultCard(packet);
  assert(shown?.display_hash === live.display_hash && canonical(shown) === canonical(live),
    'Displayed card is stale or does not match the current queue position.');
  return live.card;
}

export function decideViralVaultCard(packet, input) {
  const next = structuredClone(packet); const shown = assertDisplay(next, input.displayed);
  const card = currentCard(next);
  assert(card && card.content.id === shown.content.id, 'Only the displayed card can be decided.');
  assert(['approve', 'edit', 'edit_and_approve', 'skip', 'reject'].includes(input.action), 'Unsupported card decision.');
  if (input.action === 'edit' || input.action === 'edit_and_approve') {
    assert(Array.isArray(input.parts) && input.parts.length > 0 && input.parts.every(text), 'Exact edited parts required.');
    card.content.parts = structuredClone(input.parts);
    const proof = input.reuse_proof;
    assert(proof?.context?.account_id === card.content.account_id && proof.adaptation?.source?.id === card.content.source.id
      && proof.adaptation.source.url === card.content.source.url, 'Edited literal copy requires refreshed matching source-rights evidence.');
    const resolved = resolveAdaptation(proof.adaptation, { ...proof.context, now: input.now });
    assert(resolved.mode === card.content.adaptation_mode && canonical(resolved.parts) === canonical(card.content.parts),
      'Edited copy must exactly match the refreshed rights-gated adaptation.');
    next.reuse_evidence[card.content.id] = structuredClone(proof);
    card.validation = null; card.approval = null; card.state = 'edited_pending';
    if (input.action === 'edit') return next;
    assertValidationReceipt(card, input.validation, input.now);
    assert(input.validation.status === 'passed', 'Edit and approve requires passing validation.');
    card.validation = structuredClone(input.validation);
    card.validation_history.push(structuredClone(input.validation));
  }
  if (input.action === 'skip') { card.state = 'leave_for_tomorrow'; return next; }
  if (input.action === 'reject') { card.state = 'rejected'; return next; }
  assert(card.validation?.status === 'passed' && card.validation.content_hash === viralVaultHash(card.content),
    'Fresh passing validation for the exact displayed copy is required.');
  assert(text(input.confirmation?.evidence_ref) && timestamp(input.confirmation.at), 'Explicit exact-card approval required.');
  const scheduledAt = card.time_suggestions.at(-1).instant;
  const binding = { packet_id: next.id, card_id: card.content.id, content_hash: viralVaultHash(card.content),
    account_id: card.content.account_id, draft_id: card.content.draft_id, scheduled_at: scheduledAt };
  card.approval = { ...structuredClone(input.confirmation), binding, approval_hash: viralVaultHash({ binding, confirmation: input.confirmation }) };
  card.delivery = { state: 'approved_unscheduled', idempotency_key: `viral-vault-${viralVaultHash(binding)}`, attempts: [] };
  card.state = 'approved_unscheduled'; next.blocked_card_id = card.content.id;
  return next;
}

export function beginViralVaultSchedule(packet, input) {
  const next = structuredClone(packet); const card = currentCard(next);
  assert(card?.state === 'approved_unscheduled' && card.content.id === input.card_id, 'An approved unscheduled current card is required.');
  assert(text(card.content.draft_id), 'Connected scheduling requires a real editable draft ID.');
  assert(card.delivery.state === 'approved_unscheduled' && card.delivery.attempts.length === 0,
    'A schedule attempt already exists; reconcile it before any retry.');
  assert(timestamp(input.now) && timestamp(input.preflight?.checked_at) && timestamp(input.preflight?.valid_until)
    && Date.parse(input.preflight.checked_at) <= Date.parse(input.now)
    && Date.parse(input.now) - Date.parse(input.preflight.checked_at) <= 300_000
    && Date.parse(input.preflight.valid_until) > Date.parse(input.now), 'Fresh schedule preflight required.');
  for (const gate of ['account_verified', 'timezone_verified', 'facts', 'rights', 'validation', 'calendar']) {
    assert(input.preflight[gate] === true, `Schedule preflight failed: ${gate}.`);
  }
  assert(text(input.preflight.evidence_ref) && input.preflight.account_id === card.content.account_id
    && input.preflight.timezone === card.content.timezone
    && input.preflight.content_hash === viralVaultHash(card.content)
    && Date.parse(input.preflight.scheduled_at) === Date.parse(card.approval.binding.scheduled_at),
  'Schedule preflight must bind the exact account, timezone, copy, and time.');
  const proof = next.reuse_evidence?.[card.content.id];
  assert(proof, 'Current literal reuse evidence is required before scheduling.');
  const resolved = resolveAdaptation(proof.adaptation, { ...proof.context, now: input.now });
  assert(resolved.mode === card.content.adaptation_mode && canonical(resolved.parts) === canonical(card.content.parts),
    'Rights, claims, or replacement evidence expired before scheduling.');
  const request = { account_id: card.content.account_id, draft_id: card.content.draft_id,
    parts: structuredClone(card.content.parts), scheduled_at: card.approval.binding.scheduled_at,
    timezone: card.content.timezone, idempotency_key: card.delivery.idempotency_key };
  card.delivery.state = 'attempt_pending';
  card.delivery.attempts.push({ request, started_at: input.now, outcome: 'pending', receipt: null });
  return { packet: next, request };
}

export function reconcileViralVaultSchedule(packet, input) {
  const next = structuredClone(packet); const card = currentCard(next);
  assert(card && card.content.id === input.card_id && card.delivery?.state === 'attempt_pending', 'A pending current schedule attempt is required.');
  const attempt = card.delivery.attempts.at(-1); const receipt = input.receipt;
  assert(text(receipt?.evidence_ref), 'Authoritative schedule readback evidence required.');
  if (receipt.status === 'unknown') {
    attempt.outcome = 'unknown'; attempt.receipt = structuredClone(receipt);
    card.delivery.state = 'approved_unscheduled'; card.delivery.retry_queued = false;
    card.state = 'approved_unscheduled'; return next;
  }
  assert(receipt.status === 'scheduled' && receipt.authoritative === true && text(receipt.provider_ref)
    && receipt.idempotency_key === attempt.request.idempotency_key, 'Exact authoritative scheduled readback required.');
  for (const field of ['account_id', 'draft_id', 'parts', 'scheduled_at']) {
    assert(canonical(receipt[field]) === canonical(attempt.request[field]), `Schedule readback must match ${field}.`);
  }
  attempt.outcome = 'scheduled'; attempt.receipt = structuredClone(receipt);
  card.delivery.state = 'scheduled'; card.state = 'scheduled'; next.blocked_card_id = null;
  return next;
}

export function completeViralVaultLocal(packet, input) {
  const next = structuredClone(packet); const card = currentCard(next);
  assert(card?.state === 'approved_unscheduled' && card.content.draft_id === null, 'Only an approved disconnected current card can be handed off locally.');
  assert(text(input.evidence_ref) && timestamp(input.now), 'Explicit local handoff evidence required.');
  card.state = 'reviewed_local'; card.delivery = { state: 'reviewed_local', evidence_ref: input.evidence_ref, at: input.now };
  next.blocked_card_id = null; return next;
}

function workspace(payload) {
  const data = payload ?? { schema_version: 'creator-workspace.v1', plans: [], reviews: [], feedback: [], setups: [] };
  assert(data.schema_version === 'creator-workspace.v1', 'Unsupported creator workspace schema.');
  return { ...data, viral_vault_plans: data.viral_vault_plans ?? [], viral_vault_packets: data.viral_vault_packets ?? [] };
}

function getPlan(data, id) {
  const plan = data.viral_vault_plans.find((candidate) => candidate.id === id); assert(plan, 'Unknown 30-Day Viral Vault plan.'); return plan;
}
function getPacket(data, id) {
  const packet = data.viral_vault_packets.find((candidate) => candidate.id === id); assert(packet, 'Unknown 30-Day Viral Vault packet.'); return packet;
}

const READS = new Set(['vault30-status', 'vault30-next', 'vault30-continue']);
const WRITES = new Set(['vault30-plan', 'vault30-add-day', 'vault30-record-validation', 'vault30-decide',
  'vault30-begin-attempt', 'vault30-reconcile', 'vault30-complete-local']);
export const isViralVaultCommand = (command) => READS.has(command) || WRITES.has(command);

export async function runViralVaultCommand(command, { root, revision, input = {} }) {
  assert(isViralVaultCommand(command), 'Unsupported 30-Day Viral Vault command.');
  if (READS.has(command)) {
    const state = await readState(root); const data = workspace(state.payload);
    let result;
    if (command === 'vault30-status') result = { plans: data.viral_vault_plans.length, packets: data.viral_vault_packets.length,
      scheduled: data.viral_vault_packets.flatMap((packet) => packet.cards).filter((card) => card.state === 'scheduled').length,
      provider_writes_performed: false };
    else {
      const packet = command === 'vault30-next' ? getPacket(data, input.packet_id)
        : [...data.viral_vault_packets].reverse().find((candidate) => candidate.plan_id === input.plan_id && currentCard(candidate));
      result = packet ? displayNextViralVaultCard(packet) : { complete: true, note: 'No unresolved packet. Prepare the next blueprint day if Day 30 has not passed.' };
    }
    return { revision: state.revision, result };
  }
  let result;
  const state = await updateState(root, revision, (payload) => {
    const data = workspace(payload);
    if (command === 'vault30-plan') {
      assert(!data.viral_vault_plans.some((plan) => plan.id === input.id), 'Plan already exists; continue it.');
      const plan = createViralVaultPlan(input); data.viral_vault_plans.push(plan); result = plan;
    } else if (command === 'vault30-add-day') {
      const plan = getPlan(data, input.plan_id);
      assert(!data.viral_vault_packets.some((packet) => packet.id === input.id || (packet.plan_id === plan.id && packet.date === input.date)),
        'Packet already exists for this plan/day.');
      const previous = input.previous_packet_id ? getPacket(data, input.previous_packet_id) : null;
      const created = createViralVaultPacket({ ...input, plan, previous_packet: previous });
      data.viral_vault_packets.push(created.packet); result = created.display;
    } else {
      const packet = getPacket(data, input.packet_id); let next;
      if (command === 'vault30-record-validation') next = recordViralVaultValidation(packet, input);
      if (command === 'vault30-decide') next = decideViralVaultCard(packet, input);
      if (command === 'vault30-begin-attempt') {
        const begun = beginViralVaultSchedule(packet, input); next = begun.packet; result = { action: 'schedule_attempt_persisted', request: begun.request };
      }
      if (command === 'vault30-reconcile') next = reconcileViralVaultSchedule(packet, input);
      if (command === 'vault30-complete-local') next = completeViralVaultLocal(packet, input);
      data.viral_vault_packets[data.viral_vault_packets.indexOf(packet)] = next;
      if (!result) result = { packet_id: next.id, current: displayNextViralVaultCard(next) };
    }
    return data;
  });
  return { revision: state.revision, result };
}

export { LANES, TOPICS, ROLES, TERMINAL };
