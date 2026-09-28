import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import Ajv from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import {
  approveDelivery,
  approveMediaTransfer,
  createManualFallback,
  deliveryHash,
  executeDelivery,
  executeMediaTransfer,
  prepareDelivery,
  reconcileDelivery,
} from '../../lib/youtube-synthesizer-delivery.mjs'

const now = '2026-09-29T02:00:00.000Z'
const later = '2026-09-29T06:00:00.000Z'
const hash = 'a'.repeat(64)
const thread = Array.from({ length: 8 }, (_, index) => `Exact approved post ${index + 1}.`)

function input(overrides = {}) {
  const orderedThreadSha256 = deliveryHash(thread)
  return {
    record_type: 'YouTubeSynthesizerDeliveryInputV1',
    ordered_thread: thread,
    synthesis_output_sha256: hash,
    target: { platform: 'threads', account_id: 'acct-1', account_handle: '@creator' },
    action: 'schedule',
    timezone: 'Australia/Perth',
    scheduled_at: later,
    best_time_evidence: {
      account_id: 'acct-1', timezone: 'Australia/Perth', recommended_at: later,
      evidence_ref: 'best-time-1', checked_at: now, valid_until: '2026-09-29T03:00:00.000Z',
    },
    calendar: [],
    calendar_evidence: {
      account_id: 'acct-1', timezone: 'Australia/Perth', evidence_ref: 'calendar-1',
      checked_at: now, valid_until: '2026-09-29T03:00:00.000Z',
    },
    image: null,
    automation: {
      auto_plug: null,
      auto_repost: null,
      global_auto_repost: { known: true, enabled: false, evidence_ref: 'settings-1' },
    },
    prepared_at: now,
    connection: { account_id: 'acct-1', account_handle: '@creator', timezone: 'Australia/Perth', evidence_ref: 'connection-1' },
    capabilities: { validate_post: true, schedule: true, publish_now: true, readback: true, evidence_ref: 'capabilities-1' },
    validation: {
      status: 'passed', account_id: 'acct-1', ordered_thread_sha256: orderedThreadSha256,
      evidence_ref: 'validation-1', checked_at: now, valid_until: '2026-09-29T03:00:00.000Z',
    },
    ...overrides,
  }
}

function approve(packet, at = now) {
  return approveDelivery(packet, {
    approved: true,
    kind: 'delivery',
    action: packet.timing.action,
    binding_sha256: packet.approval_packet.binding_sha256,
    idempotency_key: packet.approval_packet.idempotency_key,
    evidence_ref: 'owner-final-approval',
    at,
  })
}

function connector(overrides = {}) {
  return {
    async schedule_post(request) { return { status: 'accepted', idempotency_key: request.idempotency_key } },
    async publish_now(request) { return { status: 'accepted', idempotency_key: request.idempotency_key } },
    async get_schedule_status({ idempotency_key }) {
      return {
        status: 'scheduled', idempotency_key, account_id: 'acct-1', account_handle: '@creator',
        ordered_thread_sha256: deliveryHash(thread), media_url: null, scheduled_at: later,
      }
    },
    async list_scheduled_posts() { return [] },
    async get_publish_status({ idempotency_key }) {
      return {
        status: 'published', idempotency_key, account_id: 'acct-1', account_handle: '@creator',
        ordered_thread_sha256: deliveryHash(thread), media_url: null, provider_ref: 'post-1',
      }
    },
    async upload_media() { return { status: 'uploaded', provider_url: 'https://cdn.example.test/image.png' } },
    ...overrides,
  }
}

test('prepares a schema-valid immutable scheduling approval packet by default', () => {
  const source = input({ action: undefined })
  const packet = prepareDelivery(source)
  assert.equal(packet.state, 'awaiting_delivery_approval')
  assert.equal(packet.timing.action, 'schedule')
  assert.match(packet.approval_packet.idempotency_key, /^youtube-synthesizer-delivery-[a-f0-9]{64}$/)
  assert.equal(packet.provider_writes, 0)

  const ajv = new Ajv({ strict: false })
  addFormats(ajv)
  const schema = JSON.parse(fs.readFileSync(new URL('../../schemas/youtube-synthesizer-delivery.v1.json', import.meta.url)))
  const validate = ajv.compile(schema)
  assert.equal(validate(source), true, JSON.stringify(validate.errors))
  assert.equal(validate(packet), true, JSON.stringify(validate.errors))
  assert.equal(validate(input({ calendar_evidence: { evidence_ref: 'missing-account-and-time' } })), false)
})

test('rejects changed copy, occupied slots, hidden automation, and stale evidence', () => {
  assert.throws(() => prepareDelivery(input({ calendar: [{ account_id: 'acct-1', scheduled_at: later }] })), /occupied/)
  assert.throws(() => prepareDelivery(input({ automation: { auto_plug: { content: 'hidden' }, auto_repost: null, global_auto_repost: { known: true, enabled: false, evidence_ref: 'settings' } } })), /Auto Plug/)
  assert.throws(() => prepareDelivery(input({ validation: { ...input().validation, valid_until: now } })), /validation/)
  assert.throws(() => prepareDelivery(input({ best_time_evidence: { ...input().best_time_evidence, checked_at: later } })), /best-time/)
  assert.throws(() => prepareDelivery(input({ calendar_evidence: { ...input().calendar_evidence, valid_until: now } })), /calendar/)
  const packet = prepareDelivery(input())
  packet.thread.ordered_thread[0] = 'Changed after preparation.'
  assert.throws(() => approve(packet), /approval/)
})

test('requires separate local-image transfer approval before final delivery approval', async () => {
  let packet = prepareDelivery(input({ image: { kind: 'local', reference: 'owner-image.png', sha256: 'b'.repeat(64), mime_type: 'image/png', bytes: 1234 } }))
  assert.equal(packet.state, 'awaiting_media_transfer_approval')
  assert.throws(() => approveDelivery(packet, {}), /approval packet/)
  const binding = { action: 'upload_media', account_id: 'acct-1', image: packet.image }
  packet = approveMediaTransfer(packet, {
    approved: true, kind: 'media_transfer', binding_sha256: deliveryHash(binding), evidence_ref: 'owner-upload-approval', at: now,
  })
  const persisted = []
  packet = await executeMediaTransfer({ packet, connector: connector(), persist: async (state) => persisted.push(state.state) })
  assert.deepEqual(persisted, ['media_transfer_pending', 'awaiting_delivery_approval'])
  assert.equal(packet.image.provider_url, 'https://cdn.example.test/image.png')
  assert.equal(packet.provider_writes, 1)
  assert.equal(approve(packet).state, 'delivery_approved')
})

test('counts an ambiguous image upload as a provider attempt and forbids zero-write fallback', async () => {
  let packet = prepareDelivery(input({ image: { kind: 'local', reference: 'owner-image.png', sha256: 'b'.repeat(64), mime_type: 'image/png', bytes: 1234 } }))
  const binding = { action: 'upload_media', account_id: 'acct-1', image: packet.image }
  packet = approveMediaTransfer(packet, {
    approved: true, kind: 'media_transfer', binding_sha256: deliveryHash(binding), evidence_ref: 'owner-upload-approval', at: now,
  })
  const persisted = []
  await assert.rejects(executeMediaTransfer({
    packet,
    connector: connector({ async upload_media() { throw new Error('connection lost') } }),
    persist: async (state) => persisted.push(state),
  }), /ambiguous/)
  packet = persisted.at(-1)
  assert.equal(packet.provider_writes, 1)
  assert.throws(() => createManualFallback(packet, 'Try manually'), /provider write/)
})

test('a failed post-dispatch persistence write cannot double-count one provider attempt', async () => {
  let packet = prepareDelivery(input({ image: { kind: 'local', reference: 'owner-image.png', sha256: 'b'.repeat(64), mime_type: 'image/png', bytes: 1234 } }))
  const binding = { action: 'upload_media', account_id: 'acct-1', image: packet.image }
  packet = approveMediaTransfer(packet, {
    approved: true, kind: 'media_transfer', binding_sha256: deliveryHash(binding), evidence_ref: 'owner-upload-approval', at: now,
  })
  const imageStates = []
  await assert.rejects(executeMediaTransfer({
    packet,
    connector: connector(),
    persist: async (state) => {
      imageStates.push(state)
      if (state.state === 'awaiting_delivery_approval') throw new Error('disk full')
    },
  }), /ambiguous/)
  assert.equal(imageStates.at(-1).provider_writes, 1)

  packet = approve(prepareDelivery(input()))
  const deliveryStates = []
  await assert.rejects(executeDelivery({
    packet,
    connector: connector(),
    persist: async (state) => {
      deliveryStates.push(state)
      if (state.state === 'reconciliation_required') throw new Error('disk full')
    },
  }), /ambiguous/)
  assert.equal(deliveryStates.at(-1).provider_writes, 1)
})

test('final approval must occur before validation, best-time, and calendar evidence expires', () => {
  const packet = prepareDelivery(input())
  assert.throws(() => approve(packet, '2026-09-29T03:00:00.000Z'), /fresh at approval/)
})

test('persists intent, dispatches once, then requires exact schedule readback', async () => {
  const calls = []
  const fake = connector({
    async schedule_post(request) { calls.push(['schedule_post', request]); return { status: 'accepted' } },
    async get_schedule_status({ idempotency_key }) {
      calls.push(['get_schedule_status', idempotency_key])
      return {
        status: 'scheduled', idempotency_key, account_id: 'acct-1', account_handle: '@creator',
        ordered_thread_sha256: deliveryHash(thread), media_url: null, scheduled_at: later,
      }
    },
  })
  let packet = approve(prepareDelivery(input()))
  const states = []
  packet = await executeDelivery({ packet, connector: fake, persist: async (state) => states.push(state.state) })
  assert.deepEqual(states, ['delivery_pending', 'reconciliation_required'])
  assert.equal(calls.filter(([name]) => name === 'schedule_post').length, 1)
  await assert.rejects(executeDelivery({ packet, connector: fake, persist: async () => {} }), /Approved delivery/)
  packet = await reconcileDelivery({ packet, connector: fake, persist: async () => {}, checked_at: '2026-09-29T02:01:00.000Z' })
  assert.equal(packet.state, 'scheduled')
})

test('publish-now is explicit and reconciles without a calendar or scheduled time', async () => {
  const publishInput = input({
    action: 'publish_now',
    scheduled_at: null,
    best_time_evidence: null,
    calendar: undefined,
    calendar_evidence: null,
  })
  let packet = approve(prepareDelivery(publishInput))
  packet = await executeDelivery({ packet, connector: connector(), persist: async () => {} })
  packet = await reconcileDelivery({ packet, connector: connector(), persist: async () => {}, checked_at: '2026-09-29T02:01:00.000Z' })
  assert.equal(packet.state, 'published')
})

test('ambiguous provider outcomes stay blocked and manual fallback proves zero writes', async () => {
  const fallback = createManualFallback(prepareDelivery(input()), 'Threadify MCP unavailable')
  assert.equal(fallback.status, 'manual_private_handoff')
  assert.equal(fallback.provider_writes, 0)

  let packet = approve(prepareDelivery(input()))
  const states = []
  await assert.rejects(executeDelivery({
    packet,
    connector: connector({ async schedule_post() { throw new Error('connection lost') } }),
    persist: async (state) => states.push(state),
  }), /ambiguous/)
  packet = states.at(-1)
  await assert.rejects(reconcileDelivery({
    packet,
    connector: connector({ async get_schedule_status() { return { status: 'unknown' } } }),
    persist: async () => {},
    checked_at: '2026-09-29T02:01:00.000Z',
  }), /remains ambiguous/)
})
