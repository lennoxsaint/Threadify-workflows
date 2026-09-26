import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  approveMarketAction, beginMarketActionAttempt, buildMarketPipeline, editMarketAction,
  reconcileMarketActionAttempt, writeMarketPipelineArtifacts,
} from '../../lib/market-to-pipeline.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const fixtureFile = path.join(root, 'workflows/market-to-pipeline/synthetic-market.json');
const fixture = () => JSON.parse(fs.readFileSync(fixtureFile, 'utf8'));

test('validates the synthetic input and generated state against the public schema', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(root, 'schemas/market-to-pipeline.v1.json'), 'utf8'));
  const ajv = new Ajv2020({ strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const input = fixture();
  assert.equal(validate(input), true, JSON.stringify(validate.errors));
  const state = buildMarketPipeline(input);
  assert.equal(validate(state), true, JSON.stringify(validate.errors));
});

test('builds a capped private pipeline, seven-post campaign, and body-free receipt', () => {
  const result = buildMarketPipeline(fixture());
  assert.equal(result.status, 'prepared_privately');
  assert.equal(result.pipeline.length, 5);
  assert.equal(result.campaign.posts.length, 7);
  assert.equal(result.coverage.raw_signal_count, 10);
  assert.equal(result.coverage.quoted_micro, 300000);
  assert.equal(result.coverage.charged_micro, 230000);
  assert.equal(result.receipts[0].provider_writes_performed, false);
  assert.equal(result.receipts[0].raw_signal_bodies_retained_in_receipt, false);
  assert.equal(result.receipts[0].contact_destinations_retained_in_receipt, false);
  const serialized = JSON.stringify(result.receipts[0]);
  assert.equal(serialized.includes('casey@example.invalid'), false);
  assert.equal(serialized.includes('losing track of high-intent replies'), false);
});

test('keeps warm permission, verified contact, lawful basis, suppression, and offer fit as separate gates', () => {
  const result = buildMarketPipeline(fixture());
  const byId = Object.fromEntries(result.pipeline.map((entry) => [entry.prospect_id, entry]));
  assert.equal(byId['prospect-warm-ready'].readiness.status, 'ready_for_approval');
  assert.equal(byId['prospect-warm-no-permission'].readiness.status, 'research');
  assert.deepEqual(byId['prospect-warm-no-permission'].readiness.blockers, ['channel_permission_missing']);
  assert.equal(byId['prospect-cold-unlawful'].contact.work_contact_verified, true);
  assert.equal(byId['prospect-cold-unlawful'].readiness.status, 'research');
  assert.equal(byId['prospect-cold-unlawful'].readiness.blockers.includes('documented_lawful_basis_missing'), true);
  assert.equal(byId['prospect-cold-ready'].readiness.status, 'ready_for_approval');
  assert.equal(byId['prospect-excluded'].readiness.status, 'rejected');
  assert.equal(byId['prospect-excluded'].readiness.blockers.includes('suppressed'), true);
});

test('requires a quote before spend, respects the run cap, and gates contact enrichment behind company fit', () => {
  const noQuote = fixture();
  noQuote.sources[2].pricing_status = 'free';
  assert.throws(() => buildMarketPipeline(noQuote), /paid_source_requires_price_preview/);
  const overBudget = fixture();
  overBudget.sources[2].quoted_micro = 2_950_001;
  assert.throws(() => buildMarketPipeline(overBudget), /quoted_spend_exceeds_cap/);
  const tooMany = fixture();
  tooMany.market_scope.raw_signal_cap = 9;
  assert.throws(() => buildMarketPipeline(tooMany), /raw_signal_cap_exceeded/);
  const noFitGate = fixture();
  noFitGate.sources[2].fit_gate_prospect_ids = [];
  assert.throws(() => buildMarketPipeline(noFitGate), /treg_contact_requires_fit_gate/);
});

test('blocks identifiers in campaign copy and requires exactly seven evidence-linked posts', () => {
  const leaked = fixture();
  leaked.campaign.posts[0].exact_text += ' Ada Example';
  assert.throws(() => buildMarketPipeline(leaked), /campaign_private_identifier/);
  const short = fixture();
  short.campaign.posts.pop();
  assert.throws(() => buildMarketPipeline(short), /campaign_must_have_exactly_seven_posts/);
  const unknownTheme = fixture();
  unknownTheme.campaign.posts[0].evidence_theme_ids = ['missing-theme'];
  assert.throws(() => buildMarketPipeline(unknownTheme), /campaign_post_unknown_theme/);
});

test('binds approval to exact text, persists pending before delivery, and blocks ambiguous retry', () => {
  const built = buildMarketPipeline(fixture());
  const original = built.pipeline.find((entry) => entry.action.action_id === 'action-warm-reply').action;
  const approved = approveMarketAction(built, { action_id: original.action_id, action_hash: original.action_hash,
    approved_at: '2026-09-26T04:05:00Z' });
  assert.equal(approved.pipeline[0].action.state, 'approved');
  const edited = editMarketAction(approved, { action_id: original.action_id, exact_text: `${original.exact_text} One more sentence.` });
  assert.equal(edited.pipeline[0].action.state, 'ready_for_approval');
  assert.equal(edited.pipeline[0].action.approval, null);
  assert.notEqual(edited.pipeline[0].action.action_hash, original.action_hash);
  assert.throws(() => beginMarketActionAttempt(edited, { action_id: original.action_id, action_hash: original.action_hash,
    attempt_id: 'attempt-wrong', started_at: '2026-09-26T04:06:00Z' }), /action_requires_exact_approval/);
  const pending = beginMarketActionAttempt(approved, { action_id: original.action_id, action_hash: original.action_hash,
    attempt_id: 'attempt-1', started_at: '2026-09-26T04:06:00Z' });
  assert.equal(pending.pipeline[0].action.state, 'attempt_pending');
  assert.equal(pending.pipeline[0].action.attempts.at(-1).status, 'pending');
  const unknown = reconcileMarketActionAttempt(pending, { action_id: original.action_id, attempt_id: 'attempt-1',
    status: 'unknown', checked_at: '2026-09-26T04:07:00Z', provider_ref: null,
    evidence_ref: 'synthetic:provider-timeout' });
  assert.equal(unknown.pipeline[0].action.state, 'unknown');
  assert.throws(() => beginMarketActionAttempt(unknown, { action_id: original.action_id, action_hash: original.action_hash,
    attempt_id: 'attempt-2', started_at: '2026-09-26T04:08:00Z' }), /unknown_action_requires_reconciliation/);
  assert.equal(JSON.stringify(unknown.receipts.at(-1)).includes(original.exact_text), false);
});

test('writes private JSON, CSV, HTML and a public receipt without a network call', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'threadify-market-pipeline-'));
  try {
    const result = writeMarketPipelineArtifacts(buildMarketPipeline(fixture()), directory);
    assert.equal(fs.existsSync(result.state_file), true);
    assert.equal(fs.existsSync(path.join(directory, 'pipeline.private.csv')), true);
    assert.equal(fs.existsSync(path.join(directory, 'review.private.html')), true);
    const receipt = fs.readFileSync(result.receipt_file, 'utf8');
    assert.equal(receipt.includes('devon@example.invalid'), false);
    assert.equal(receipt.includes('provider_writes_performed'), true);
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
});

test('runs the public CLI build and status flow deterministically', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'threadify-market-pipeline-cli-'));
  try {
    const build = spawnSync(process.execPath, [path.join(root, 'bin/threadify-workflows.mjs'), 'market-to-pipeline',
      'build', '--input', fixtureFile, '--output-dir', directory], { cwd: root, encoding: 'utf8' });
    assert.equal(build.status, 0, build.stderr);
    const built = JSON.parse(build.stdout);
    assert.equal(built.status, 'prepared_privately');
    const status = spawnSync(process.execPath, [path.join(root, 'bin/threadify-workflows.mjs'), 'market-to-pipeline',
      'status', '--state', built.state_file], { cwd: root, encoding: 'utf8' });
    assert.equal(status.status, 0, status.stderr);
    const inspected = JSON.parse(status.stdout);
    assert.equal(inspected.actions.length, 5);
    assert.equal(inspected.actions.filter((entry) => entry.action_state === 'ready_for_approval').length, 2);
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
});

test('produces identical action and campaign hashes from the frozen fixture', () => {
  const first = buildMarketPipeline(fixture());
  const second = buildMarketPipeline(fixture());
  assert.deepEqual(first.pipeline.map((entry) => entry.action.action_hash),
    second.pipeline.map((entry) => entry.action.action_hash));
  assert.equal(first.receipts[0].campaign_sha256, second.receipts[0].campaign_sha256);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});
