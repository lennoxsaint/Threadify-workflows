import crypto from 'node:crypto'

const DELIVERY_VERSION = '1.0.0'
const HASH = /^[a-f0-9]{64}$/

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const hasText = (value) => typeof value === 'string' && value.trim().length > 0
const isTimestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value))

function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  assert(value && Object.getPrototypeOf(value) === Object.prototype, 'Delivery data must be plain JSON without undefined values.')
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
}

export const deliveryHash = (value) => crypto.createHash('sha256').update(canonical(value)).digest('hex')

function validateTimezone(timezone) {
  assert(hasText(timezone), 'Exact timezone required.')
  new Intl.DateTimeFormat('en', { timeZone: timezone }).format()
}

function validateThread(thread) {
  assert(Array.isArray(thread) && thread.length >= 8, 'A complete ordered long-form thread with at least eight posts is required.')
  assert(thread.every((part) => hasText(part) && [...part].length <= 500), 'Every thread post must contain 1–500 characters.')
}

function validateAutomation(automation) {
  assert(automation && automation.auto_plug === null && automation.auto_repost === null,
    'Synthesizer delivery cannot silently add Auto Plug or per-post Auto Repost.')
  assert(automation.global_auto_repost && automation.global_auto_repost.known === true
    && typeof automation.global_auto_repost.enabled === 'boolean'
    && hasText(automation.global_auto_repost.evidence_ref),
  'Fresh account-wide Auto Repost visibility is required.')
}

function validateImage(image) {
  if (image === null) return
  assert(image && ['local', 'provider'].includes(image.kind) && hasText(image.reference) && HASH.test(image.sha256 ?? ''),
    'Optional image must have a local/provider reference and SHA-256.')
  if (image.kind === 'local') {
    assert(hasText(image.mime_type) && Number.isInteger(image.bytes) && image.bytes > 0 && !('provider_url' in image),
      'Local image MIME type and byte count required; provider URL must not be invented.')
  } else {
    assert(hasText(image.provider_url) && /^https:\/\//.test(image.provider_url), 'Provider image requires an HTTPS URL.')
  }
}

function threadBinding(input) {
  return {
    ordered_thread: structuredClone(input.ordered_thread),
    ordered_thread_sha256: deliveryHash(input.ordered_thread),
    synthesis_output_sha256: input.synthesis_output_sha256,
  }
}

function timingBinding(input) {
  if (input.action === 'publish_now') return { action: 'publish_now', timezone: input.timezone, scheduled_at: null, best_time_evidence: null }
  return {
    action: 'schedule',
    timezone: input.timezone,
    scheduled_at: input.scheduled_at,
    best_time_evidence: structuredClone(input.best_time_evidence),
  }
}

function assertEvidenceFreshAt(evidence, instant, label) {
  assert(evidence && isTimestamp(evidence.checked_at) && isTimestamp(evidence.valid_until)
    && Date.parse(evidence.checked_at) <= Date.parse(instant)
    && Date.parse(evidence.valid_until) > Date.parse(instant),
  `${label} must be fresh at approval.`)
}

function deliveryBinding(packet, providerImage = packet.image?.kind === 'provider' ? packet.image : null) {
  return {
    workflow_id: 'youtube-synthesizer',
    schema_version: 'youtube-synthesizer-delivery.v1',
    ...packet.thread,
    target: structuredClone(packet.target),
    timing: structuredClone(packet.timing),
    image: providerImage ? {
      sha256: providerImage.sha256,
      reference: providerImage.reference,
      provider_url: providerImage.provider_url,
    } : null,
    automation: structuredClone(packet.automation),
  }
}

function approvalEnvelope(packet, providerImage = packet.image?.kind === 'provider' ? packet.image : null) {
  const binding = deliveryBinding(packet, providerImage)
  const bindingSha256 = deliveryHash(binding)
  return {
    binding,
    binding_sha256: bindingSha256,
    idempotency_key: `youtube-synthesizer-delivery-${bindingSha256}`,
  }
}

function validatePreparation(input) {
  assert(input?.record_type === 'YouTubeSynthesizerDeliveryInputV1', 'Unsupported delivery input.')
  validateThread(input.ordered_thread)
  assert(HASH.test(input.synthesis_output_sha256 ?? ''), 'Exact synthesis output SHA-256 required.')
  assert(input.target?.platform === 'threads' && hasText(input.target.account_id) && hasText(input.target.account_handle),
    'Exact target Threads account ID and handle required.')
  assert(['schedule', 'publish_now'].includes(input.action ?? 'schedule'), 'Action must be schedule or publish_now.')
  validateTimezone(input.timezone)
  assert(isTimestamp(input.prepared_at), 'Preparation timestamp required.')
  validateImage(input.image ?? null)
  validateAutomation(input.automation)
  assert(input.connection?.account_id === input.target.account_id
    && input.connection?.account_handle === input.target.account_handle
    && input.connection?.timezone === input.timezone
    && hasText(input.connection.evidence_ref), 'Fresh connection readback must match the exact target and timezone.')
  assert(input.capabilities?.validate_post === true
    && input.capabilities?.[input.action ?? 'schedule'] === true
    && input.capabilities?.readback === true
    && hasText(input.capabilities.evidence_ref), 'Required validation, action, and readback capabilities are unavailable.')
  assert(input.validation?.status === 'passed'
    && input.validation.account_id === input.target.account_id
    && input.validation.ordered_thread_sha256 === deliveryHash(input.ordered_thread)
    && hasText(input.validation.evidence_ref)
    && isTimestamp(input.validation.checked_at)
    && isTimestamp(input.validation.valid_until)
    && Date.parse(input.validation.checked_at) <= Date.parse(input.prepared_at)
    && Date.parse(input.validation.valid_until) > Date.parse(input.prepared_at),
  'Fresh authoritative validation must match the exact thread and account.')

  const action = input.action ?? 'schedule'
  if (action === 'schedule') {
    assert(isTimestamp(input.scheduled_at) && Date.parse(input.scheduled_at) > Date.parse(input.prepared_at),
      'Scheduling requires a future timestamp.')
    assert(input.best_time_evidence?.account_id === input.target.account_id
      && input.best_time_evidence?.timezone === input.timezone
      && input.best_time_evidence?.recommended_at === input.scheduled_at
      && hasText(input.best_time_evidence?.evidence_ref)
      && isTimestamp(input.best_time_evidence?.checked_at)
      && isTimestamp(input.best_time_evidence?.valid_until)
      && Date.parse(input.best_time_evidence.checked_at) <= Date.parse(input.prepared_at)
      && Date.parse(input.best_time_evidence.valid_until) > Date.parse(input.prepared_at),
    'Default scheduling requires fresh best-time evidence for the exact account, timezone, and instant.')
    assert(Array.isArray(input.calendar)
      && input.calendar_evidence?.account_id === input.target.account_id
      && input.calendar_evidence?.timezone === input.timezone
      && hasText(input.calendar_evidence?.evidence_ref)
      && isTimestamp(input.calendar_evidence?.checked_at)
      && isTimestamp(input.calendar_evidence?.valid_until)
      && Date.parse(input.calendar_evidence.checked_at) <= Date.parse(input.prepared_at)
      && Date.parse(input.calendar_evidence.valid_until) > Date.parse(input.prepared_at),
    'Fresh calendar evidence for the exact account and timezone is required.')
    assert(!input.calendar.some((entry) => entry.account_id === input.target.account_id
      && Date.parse(entry.scheduled_at) === Date.parse(input.scheduled_at)), 'Proposed schedule slot is occupied.')
  } else {
    assert(input.scheduled_at == null && input.best_time_evidence == null, 'Publish-now cannot carry a scheduled time or best-time claim.')
  }
}

export function prepareDelivery(input) {
  const normalized = { ...structuredClone(input), action: input.action ?? 'schedule', image: input.image ?? null }
  validatePreparation(normalized)
  const packet = {
    record_type: 'YouTubeSynthesizerDeliveryV1',
    schema_version: 'youtube-synthesizer-delivery.v1',
    module_version: DELIVERY_VERSION,
    state: normalized.image?.kind === 'local' ? 'awaiting_media_transfer_approval' : 'awaiting_delivery_approval',
    prepared_at: normalized.prepared_at,
    thread: threadBinding(normalized),
    target: structuredClone(normalized.target),
    timing: timingBinding(normalized),
    image: structuredClone(normalized.image),
    automation: structuredClone(normalized.automation),
    evidence: {
      connection: structuredClone(normalized.connection),
      capabilities: structuredClone(normalized.capabilities),
      validation: structuredClone(normalized.validation),
      calendar: normalized.action === 'schedule' ? structuredClone(normalized.calendar_evidence) : null,
    },
    approval_packet: null,
    media_transfer: null,
    delivery: null,
    provider_writes: 0,
  }
  if (packet.state === 'awaiting_delivery_approval') packet.approval_packet = approvalEnvelope(packet)
  return packet
}

export function approveMediaTransfer(packet, confirmation) {
  assert(packet?.state === 'awaiting_media_transfer_approval' && packet.image?.kind === 'local',
    'A local image awaiting transfer approval is required.')
  const binding = {
    action: 'upload_media',
    account_id: packet.target.account_id,
    image: structuredClone(packet.image),
  }
  const bindingSha256 = deliveryHash(binding)
  assert(confirmation?.approved === true && confirmation.kind === 'media_transfer'
    && confirmation.binding_sha256 === bindingSha256 && hasText(confirmation.evidence_ref)
    && isTimestamp(confirmation.at)
    && Date.parse(confirmation.at) >= Date.parse(packet.prepared_at),
  'Exact current local-image transfer approval required.')
  const next = structuredClone(packet)
  next.media_transfer = {
    state: 'approved',
    binding,
    binding_sha256: bindingSha256,
    approval: structuredClone(confirmation),
    idempotency_key: `youtube-synthesizer-media-${bindingSha256}`,
  }
  next.state = 'media_transfer_approved'
  return next
}

export async function executeMediaTransfer({ packet, connector, persist }) {
  assert(packet?.state === 'media_transfer_approved' && packet.media_transfer?.state === 'approved',
    'Approved media-transfer packet required.')
  assert(typeof connector?.upload_media === 'function' && typeof persist === 'function',
    'Threadify media upload and durable persistence are required.')
  const next = structuredClone(packet)
  const writesAfterDispatch = packet.provider_writes + 1
  const request = {
    account_id: next.target.account_id,
    media: [{ reference: next.image.reference, sha256: next.image.sha256, mime_type: next.image.mime_type }],
    idempotency_key: next.media_transfer.idempotency_key,
  }
  next.media_transfer.state = 'intent_persisted'
  next.media_transfer.request = request
  next.state = 'media_transfer_pending'
  await persist(structuredClone(next))
  try {
    const receipt = await connector.upload_media(request)
    assert(receipt?.status === 'uploaded' && hasText(receipt.provider_url) && /^https:\/\//.test(receipt.provider_url),
      'Media upload receipt is incomplete.')
    next.image = {
      kind: 'provider',
      reference: next.image.reference,
      sha256: next.image.sha256,
      provider_url: receipt.provider_url,
    }
    next.media_transfer.state = 'uploaded'
    next.media_transfer.receipt = structuredClone(receipt)
    next.provider_writes = writesAfterDispatch
    next.approval_packet = approvalEnvelope(next, next.image)
    next.state = 'awaiting_delivery_approval'
    await persist(structuredClone(next))
    return next
  } catch (error) {
    next.media_transfer.state = 'outcome_unknown'
    next.media_transfer.error = error.message
    next.state = 'media_transfer_unknown'
    next.provider_writes = writesAfterDispatch
    await persist(structuredClone(next))
    throw new Error('Media-transfer outcome is ambiguous; do not retry without authoritative reconciliation.')
  }
}

export function approveDelivery(packet, confirmation) {
  assert(packet?.state === 'awaiting_delivery_approval' && packet.approval_packet,
    'A complete delivery approval packet is required.')
  const current = approvalEnvelope(packet, packet.image?.kind === 'provider' ? packet.image : null)
  assert(current.binding_sha256 === packet.approval_packet.binding_sha256
    && current.idempotency_key === packet.approval_packet.idempotency_key,
  'Delivery changed after preparation; prepare and display a new approval packet.')
  assert(confirmation?.approved === true && confirmation.kind === 'delivery'
    && confirmation.binding_sha256 === packet.approval_packet.binding_sha256
    && confirmation.idempotency_key === packet.approval_packet.idempotency_key
    && confirmation.action === packet.timing.action
    && hasText(confirmation.evidence_ref) && isTimestamp(confirmation.at)
    && Date.parse(confirmation.at) >= Date.parse(packet.prepared_at),
  'Explicit exact delivery approval required.')
  assertEvidenceFreshAt(packet.evidence.validation, confirmation.at, 'Exact-post validation')
  if (packet.timing.action === 'schedule') {
    assertEvidenceFreshAt(packet.timing.best_time_evidence, confirmation.at, 'Best-time evidence')
    assertEvidenceFreshAt(packet.evidence.calendar, confirmation.at, 'Calendar evidence')
  }
  const next = structuredClone(packet)
  next.delivery = { state: 'approved', approval: structuredClone(confirmation), request: null, receipt: null }
  next.state = 'delivery_approved'
  return next
}

function deliveryRequest(packet) {
  const request = {
    account_id: packet.target.account_id,
    account_handle: packet.target.account_handle,
    platform: 'threads',
    ordered_thread: structuredClone(packet.thread.ordered_thread),
    ordered_thread_sha256: packet.thread.ordered_thread_sha256,
    media_url: packet.image?.provider_url ?? null,
    media_sha256: packet.image?.sha256 ?? null,
    timezone: packet.timing.timezone,
    global_auto_repost: structuredClone(packet.automation.global_auto_repost),
    auto_plug: null,
    auto_repost: null,
    idempotency_key: packet.approval_packet.idempotency_key,
  }
  if (packet.timing.action === 'schedule') {
    request.scheduled_at = packet.timing.scheduled_at
    request.best_time_evidence = structuredClone(packet.timing.best_time_evidence)
  }
  return request
}

export async function executeDelivery({ packet, connector, persist }) {
  assert(packet?.state === 'delivery_approved' && packet.delivery?.state === 'approved', 'Approved delivery required.')
  assert(typeof persist === 'function', 'Durable persistence is required before provider dispatch.')
  const method = packet.timing.action === 'schedule' ? 'schedule_post' : 'publish_now'
  assert(typeof connector?.[method] === 'function', `Threadify ${method} capability is unavailable.`)
  const next = structuredClone(packet)
  const writesAfterDispatch = packet.provider_writes + 1
  const request = deliveryRequest(next)
  next.delivery = { ...next.delivery, state: 'intent_persisted', method, request, requested_at: next.delivery.approval.at }
  next.state = 'delivery_pending'
  await persist(structuredClone(next))
  try {
    const receipt = await connector[method](request)
    next.delivery.state = 'reconciliation_required'
    next.delivery.receipt = structuredClone(receipt)
    next.state = 'reconciliation_required'
    next.provider_writes = writesAfterDispatch
    await persist(structuredClone(next))
    return next
  } catch (error) {
    next.delivery.state = 'outcome_unknown'
    next.delivery.error = error.message
    next.state = 'outcome_unknown'
    next.provider_writes = writesAfterDispatch
    await persist(structuredClone(next))
    throw new Error('Delivery outcome is ambiguous; reconcile provider state before any retry.')
  }
}

function exactReadback(packet, receipt, expectedStatus) {
  const request = packet.delivery.request
  return receipt?.status === expectedStatus
    && receipt.idempotency_key === request.idempotency_key
    && receipt.account_id === request.account_id
    && receipt.account_handle === request.account_handle
    && receipt.ordered_thread_sha256 === request.ordered_thread_sha256
    && (receipt.media_url ?? null) === request.media_url
}

export async function reconcileDelivery({ packet, connector, persist, checked_at }) {
  assert(['reconciliation_required', 'outcome_unknown'].includes(packet?.state), 'Only an unresolved delivery can be reconciled.')
  assert(typeof persist === 'function' && isTimestamp(checked_at), 'Durable persistence and reconciliation timestamp required.')
  const next = structuredClone(packet)
  const request = next.delivery.request
  let readback
  if (next.timing.action === 'schedule') {
    assert(typeof connector?.get_schedule_status === 'function' && typeof connector?.list_scheduled_posts === 'function',
      'Schedule status and calendar readback are required.')
    const status = await connector.get_schedule_status({ idempotency_key: request.idempotency_key })
    const calendar = await connector.list_scheduled_posts({
      account_id: request.account_id,
      timezone: request.timezone,
      from: request.scheduled_at,
      to: request.scheduled_at,
    })
    const matches = Array.isArray(calendar) ? calendar.filter((entry) => entry.idempotency_key === request.idempotency_key) : []
    readback = exactReadback(next, status, 'scheduled') ? status
      : matches.length === 1 && exactReadback(next, matches[0], 'scheduled') ? matches[0]
        : null
    if (readback) assert(Date.parse(readback.scheduled_at) === Date.parse(request.scheduled_at), 'Schedule readback time mismatch.')
  } else {
    assert(typeof connector?.get_publish_status === 'function', 'Publish status readback is required.')
    const status = await connector.get_publish_status({ idempotency_key: request.idempotency_key })
    readback = exactReadback(next, status, 'published') ? status : null
  }
  if (!readback) {
    next.delivery.state = 'outcome_unknown'
    next.delivery.reconciled_at = checked_at
    next.delivery.readback = null
    next.state = 'outcome_unknown'
    await persist(structuredClone(next))
    throw new Error('Delivery outcome remains ambiguous; duplicate retry is blocked.')
  }
  next.delivery.state = readback.status
  next.delivery.reconciled_at = checked_at
  next.delivery.readback = structuredClone(readback)
  next.state = readback.status
  await persist(structuredClone(next))
  return next
}

export function createManualFallback(packet, reason) {
  assert(packet?.record_type === 'YouTubeSynthesizerDeliveryV1' && hasText(reason), 'Delivery packet and fallback reason required.')
  assert(packet.provider_writes === 0, 'Manual fallback cannot hide an attempted provider write.')
  assert(!['media_transfer_pending', 'media_transfer_unknown', 'delivery_pending', 'reconciliation_required', 'outcome_unknown', 'scheduled', 'published'].includes(packet.state),
    'Manual fallback is unavailable after provider dispatch or completion.')
  return {
    record_type: 'YouTubeSynthesizerDeliveryFallbackV1',
    schema_version: 'youtube-synthesizer-delivery.v1',
    status: 'manual_private_handoff',
    reason,
    approval_packet: structuredClone(packet.approval_packet),
    ordered_thread: structuredClone(packet.thread.ordered_thread),
    target: structuredClone(packet.target),
    timing: structuredClone(packet.timing),
    image: structuredClone(packet.image),
    automation: structuredClone(packet.automation),
    provider_writes: 0,
  }
}
