import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { createSetup, displaySetup, approveSetup, beginImport, reconcileImport } from '../../lib/creator/setup.mjs';
import { createFeedback, prepareFeedbackShare, reconcileFeedbackShare, prepareReminder } from '../../lib/creator/learning.mjs';
import { runCreatorCommand } from '../../lib/creator/runtime.mjs';
const read = (name) => JSON.parse(fs.readFileSync(new URL(`../../schemas/${name}`, import.meta.url)));
const ajv = new Ajv({ strict: true, allErrors: true }); addFormats(ajv);
ajv.addSchema(read('creator-records.v1.json'));
const validate = ajv.compile(read('creator-lifecycle.v1.json'));
const valid = (v) => assert.equal(validate(v), true, ajv.errorsText(validate.errors));
const invalid = (v) => assert.equal(validate(v), false);
const now = '2026-09-07T00:00:00Z';

test('setup schema validates preview, pending, unknown and exact saved readback states', () => {
  const setup = createSetup({ id: 'setup', user_id: 'synthetic-owner', now, candidates: [{ id: 'source', origin: 'user',
    url: 'https://www.threads.net/@example/post/abc', extraction: { status: 'ready', full_text: 'Synthetic source', evidence_ref: 'synthetic-extraction' } }] });
  valid(setup); valid(displaySetup(setup));
  const approved = approveSetup(setup, displaySetup(setup), { at: now, evidence_ref: 'synthetic-owner' }); valid(approved);
  const pending = beginImport(approved, 'source', { user_id: 'synthetic-owner', connected: true, can_import: true,
    remaining_slots: 2, checked_at: now, valid_until: '2026-09-07T00:05:00Z', evidence_ref: 'synthetic-access' }, now); valid(pending);
  valid(reconcileImport(pending, 'source', { status: 'unknown', evidence_ref: 'synthetic-timeout' }));
  const saved = reconcileImport(pending, 'source', { status: 'saved', authoritative: true, user_id: 'synthetic-owner',
    checked_at: now, source_url: setup.items[0].url, full_text: 'Synthetic source', item_id: 'synthetic-item',
    in_my_vault: true, evidence_ref: 'synthetic-readback' }); valid(saved);
  const missing = structuredClone(saved); missing.items[0].receipt = null; invalid(missing);
  const fake = structuredClone(saved); fake.items[0].receipt.in_my_vault = false; invalid(fake);
  const noAttempt = structuredClone(pending); noAttempt.items[0].attempts = []; invalid(noAttempt);
});

test('feedback schema requires consent and readback for shared states, with local defaults intact', () => {
  const event = createFeedback({ id: 'feedback', account_id: 'synthetic-owner', review_id: 'review', card_id: 'card',
    instruction: 'Clarify', original_parts: ['Synthetic original'], final_parts: ['Synthetic revision'], rating: null, now }); valid(event);
  const pending = prepareFeedbackShare(event, { opt_in: true, content_hash: event.hash, at: now, evidence_ref: 'synthetic-opt-in' }); valid(pending);
  valid(reconcileFeedbackShare(pending, { status: 'unknown', evidence_ref: 'synthetic-timeout' }));
  const sent = reconcileFeedbackShare(pending, { status: 'sent', authoritative: true, provider_ref: 'synthetic-provider',
    content_hash: event.hash, account_id: 'synthetic-owner', checked_at: now, evidence_ref: 'synthetic-readback' }); valid(sent);
  const noConsent = structuredClone(sent); noConsent.share_approval = null; invalid(noConsent);
  const fakeRule = structuredClone(event); fakeRule.durable_rule = true; invalid(fakeRule);
  const badRating = structuredClone(event); badRating.content.rating = 6; invalid(badRating);
});

test('reminder preparation schemas never allow a fabricated created state', () => {
  for (const options of [{}, { requested: true }, { requested: true, native_supported: true,
    capability_evidence_ref: 'synthetic-capability', local_time: '08:00', timezone: 'UTC' }]) {
    const result = prepareReminder({ plan_id: 'plan', ...options }); valid(result); invalid({ ...result, created: true });
  }
});

test('schema validates actual private workspace and disk envelope; invalid revisions fail', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'creator-schema-state-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await runCreatorCommand('plan', { root, revision: 0, input: { id: 'plan', horizon: 'day', now,
    start_date: '2026-09-07', sources: [], preferences: { account_id: 'synthetic-owner', timezone: 'UTC', posts_per_day: 1, times: ['09:00'] } } });
  const envelope = JSON.parse(fs.readFileSync(path.join(root, 'state.json'))); valid(envelope); valid(envelope.payload);
  invalid({ ...envelope, revision: 0 }); invalid({ ...envelope, checksum: 'invalid' });
  invalid({ ...envelope.payload, schema_version: 'creator-workspace.v2' });
});
