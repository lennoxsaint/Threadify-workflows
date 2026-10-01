import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Ajv from 'ajv/dist/2020.js';

function setupFixture() {
  return {
    schema_version: 'growth-loop-setup.v1',
    account: { id: 'account-lennox', label: '@lennox_saint', verified: true },
    timezone: 'Australia/Perth',
    goal: 'balanced',
    offer: { id: 'offer-threadify', label: 'Threadify', verified: true },
    draft_save: {
      mode: 'automatic',
      approved: true,
      approved_at: '2026-10-01T01:00:00Z',
      scope: 'six_daily_drafts',
    },
    daily_slots: ['07:30', '10:00', '12:30', '15:00', '17:30', '20:00'],
    scheduler: {
      adapter: 'codex',
      route: 'manual',
      interval_hours: 6,
      job_id: null,
      next_run_at: null,
      verified: false,
    },
  };
}

function invoke(args) {
  return spawnSync(process.execPath, [path.resolve('bin/threadify-workflows.mjs'), 'growth-loop', ...args], {
    cwd: path.resolve('.'),
    encoding: 'utf8',
  });
}

function createWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'growth-loop-'));
  fs.chmodSync(root, 0o700);
  const inputFile = path.join(root, 'setup.json');
  fs.writeFileSync(inputFile, `${JSON.stringify(setupFixture())}\n`, { mode: 0o600 });
  const result = invoke(['setup', '--state', root, '--input', inputFile, '--revision', '0']);
  assert.equal(result.status, 0, result.stderr);
  return { root, revision: JSON.parse(result.stdout).revision };
}

function observation({
  id = 'observation-a',
  postId = 'post-a',
  publishedAt = '2026-09-20T00:00:00Z',
  checkedAt = '2026-09-23T01:00:00Z',
  likes = 50,
  views = 1000,
  hypothesisId = 'specific-number-hook',
  hypothesisStatement = 'A specific number in the opening improves engagement rate.',
  changedDimension = 'opening',
  changedValue = 'specific-number',
} = {}) {
  return {
    schema_version: 'growth-loop-observation.v1',
    observation_id: id,
    post_id: postId,
    checkpoint: 'engagement_72h',
    account_id: 'account-lennox',
    published_at: publishedAt,
    checked_at: checkedAt,
    evidence_ref: `threadify://analytics/${postId}/72h`,
    authoritative: true,
    context: {
      source_lane: 'viral_vault',
      topic: 'broad',
      template_id: 'numbered-contrarian-hook',
      format: 'text',
      goal: 'balanced',
      time_band: 'morning',
      hypothesis: {
        id: hypothesisId,
        statement: hypothesisStatement,
        changed_dimension: changedDimension,
        changed_value: changedValue,
        primary_metric: 'engagement_rate',
      },
    },
    metrics: { views, likes, replies: 5, reposts: 5, quotes: 2, shares: 3 },
    matched_baseline: { sample_size: 10, rate: 0.04 },
    safety_issue: false,
    rights_issue: false,
  };
}

function sixCardDay() {
  const definitions = [
    ['greatest_hits', 'proven', 'broad', 'listicle', 'gh-list'],
    ['greatest_hits', 'proven', 'expertise', 'contrast', 'gh-contrast'],
    ['viral_vault', 'proven', 'personal', 'story', 'vv-story'],
    ['viral_vault', 'proven', 'broad', 'listicle', 'vv-list'],
    ['my_vault', 'challenger', 'expertise', 'contrast', 'mv-contrast'],
    ['my_vault', 'challenger', 'personal', 'story', 'mv-story'],
  ];
  return {
    schema_version: 'growth-loop-day.v1',
    date: '2026-10-02',
    cards: definitions.map(([sourceLane, role, topic, structure, templateId], index) => ({
      card_id: `card-${index + 1}`,
      slot: setupFixture().daily_slots[index],
      source_lane: sourceLane,
      source_ref: {
        id: `${sourceLane}-${index + 1}`,
        url: `https://example.com/source-${index + 1}`,
        rights_verified: true,
        evidence_ref: `threadify://vault/source-${index + 1}`,
      },
      role,
      topic,
      structure,
      template: { id: templateId, exact_pattern: `${structure}: hook -> proof -> close` },
      body: `Exact private draft body number ${index + 1}.`,
      cta: index === 3 ? { type: 'offer', offer_id: 'offer-threadify' } : { type: 'none' },
      hypothesis_id: index === 4 ? 'specific-number-hook' : index === 5 ? 'proof-before-advice' : null,
    })),
  };
}

function writeInput(root, name, value) {
  const file = path.join(root, name);
  fs.writeFileSync(file, `${JSON.stringify(value)}\n`, { mode: 0o600 });
  return file;
}

test('the public CLI creates private versioned state and returns a body-free status', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'growth-loop-'));
  fs.chmodSync(root, 0o700);
  const inputFile = path.join(root, 'setup.json');
  fs.writeFileSync(inputFile, `${JSON.stringify(setupFixture())}\n`, { mode: 0o600 });

  const setup = invoke(['setup', '--state', root, '--input', inputFile, '--revision', '0']);
  assert.equal(setup.status, 0, setup.stderr);
  const created = JSON.parse(setup.stdout);
  assert.equal(created.revision, 1);
  assert.equal(created.status.account.label, '@lennox_saint');
  assert.equal(created.status.scheduler.interval_hours, 6);
  assert.equal(fs.statSync(path.join(root, 'state.json')).mode & 0o777, 0o600);

  const status = invoke(['status', '--state', root]);
  assert.equal(status.status, 0, status.stderr);
  const readback = JSON.parse(status.stdout);
  assert.equal(readback.revision, 1);
  assert.equal(readback.status.paused, false);
  assert.equal(readback.status.observation_count, 0);
  assert.equal(readback.status.day_count, 0);
  assert.equal(readback.status.draft_save_scope, 'six_daily_drafts');
  assert.doesNotMatch(status.stdout, /draft_body|post_text|exact_copy/);
  assert.doesNotMatch(status.stdout, /account-lennox/);
  assert.match(readback.status.account.id_sha256, /^[a-f0-9]{64}$/);
});

test('setup requires explicit automatic draft-save approval and runner proof is read back', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'growth-loop-consent-'));
  fs.chmodSync(root, 0o700);
  const missingConsent = setupFixture();
  delete missingConsent.draft_save;
  const blockedFile = writeInput(root, 'missing-consent.json', missingConsent);
  const blocked = invoke(['setup', '--state', root, '--input', blockedFile, '--revision', '0']);
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /draft-save approval/i);

  const setupFile = writeInput(root, 'setup.json', setupFixture());
  const setup = invoke(['setup', '--state', root, '--input', setupFile, '--revision', '0']);
  assert.equal(setup.status, 0, setup.stderr);
  const runnerFile = writeInput(root, 'runner.json', {
    schema_version: 'growth-loop-runner.v1',
    scheduler: {
      adapter: 'codex',
      route: 'native_automation',
      interval_hours: 6,
      timezone: 'Australia/Perth',
      job_id: 'job-growth-loop-37',
      next_run_at: '2026-10-01T12:00:00+08:00',
      verified: true,
      verified_invocation_id: 'run-growth-loop-37',
      device_requirement: 'Mac awake with network access',
      pause_command: 'Disable Growth Loop automation job-growth-loop-37',
    },
  });
  const configured = invoke(['configure-runner', '--state', root, '--input', runnerFile, '--revision', '1']);
  assert.equal(configured.status, 0, configured.stderr);
  const scheduler = JSON.parse(configured.stdout).status.scheduler;
  assert.equal(scheduler.verified, true);
  assert.equal(scheduler.job_id, 'job-growth-loop-37');
  assert.equal(scheduler.verified_invocation_id, 'run-growth-loop-37');

  const status = invoke(['status', '--state', root]);
  assert.equal(JSON.parse(status.stdout).status.scheduler.next_run_at, '2026-10-01T12:00:00+08:00');
});

test('scan enforces maturity, is replay-safe, and promotes only after three comparable tests across two days', () => {
  const { root } = createWorkspace();
  const immature = observation({ checkedAt: '2026-09-22T23:59:59Z' });
  const immatureFile = writeInput(root, 'immature.json', {
    schema_version: 'growth-loop-scan.v1', observations: [immature],
  });
  const blocked = invoke(['scan', '--state', root, '--input', immatureFile, '--revision', '1']);
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /72 hours/);

  const firstFile = writeInput(root, 'first.json', {
    schema_version: 'growth-loop-scan.v1', observations: [observation()],
  });
  const first = invoke(['scan', '--state', root, '--input', firstFile, '--revision', '1']);
  assert.equal(first.status, 0, first.stderr);
  const firstResult = JSON.parse(first.stdout);
  assert.equal(firstResult.accepted[0].result, 'positive');
  assert.equal(firstResult.accepted[0].observed_rate, 0.065);
  assert.equal(firstResult.hypotheses[0].status, 'testing');

  const replay = invoke(['scan', '--state', root, '--input', firstFile, '--revision', '2']);
  assert.equal(replay.status, 0, replay.stderr);
  assert.equal(JSON.parse(replay.stdout).replayed_observation_ids[0], 'observation-a');
  const replayStatus = invoke(['status', '--state', root]);
  assert.equal(JSON.parse(replayStatus.stdout).status.observation_count, 1);

  const conflicting = observation({ likes: 1 });
  const conflictFile = writeInput(root, 'conflict.json', {
    schema_version: 'growth-loop-scan.v1', observations: [conflicting],
  });
  const conflict = invoke(['scan', '--state', root, '--input', conflictFile, '--revision', '3']);
  assert.notEqual(conflict.status, 0);
  assert.match(conflict.stderr, /conflicting replay/i);

  const second = observation({
    id: 'observation-b', postId: 'post-b',
    publishedAt: '2026-09-21T00:00:00Z', checkedAt: '2026-09-24T01:00:00Z', likes: 40,
  });
  const third = observation({
    id: 'observation-c', postId: 'post-c',
    publishedAt: '2026-09-22T00:00:00Z', checkedAt: '2026-09-25T01:00:00Z', likes: 1,
  });
  const promotionFile = writeInput(root, 'promotion.json', {
    schema_version: 'growth-loop-scan.v1', observations: [second, third],
  });
  const promoted = invoke(['scan', '--state', root, '--input', promotionFile, '--revision', '3']);
  assert.equal(promoted.status, 0, promoted.stderr);
  const promotedResult = JSON.parse(promoted.stdout);
  assert.equal(promotedResult.hypotheses[0].status, 'promoted');
  assert.equal(promotedResult.hypotheses[0].comparable_test_count, 3);
  assert.equal(promotedResult.hypotheses[0].positive_test_count, 2);
  assert.deepEqual(promotedResult.next_challenger_hypothesis_ids, ['specific-number-hook']);
});

test('prepare-day enforces the six-card mix and draft saves reconcile against authoritative receipts', () => {
  const { root } = createWorkspace();
  const firstHypothesis = [
    observation({ id: 'a1', postId: 'a1' }),
    observation({ id: 'a2', postId: 'a2', publishedAt: '2026-09-21T00:00:00Z', checkedAt: '2026-09-24T01:00:00Z' }),
    observation({ id: 'a3', postId: 'a3', publishedAt: '2026-09-22T00:00:00Z', checkedAt: '2026-09-25T01:00:00Z' }),
  ];
  const secondHypothesis = [
    observation({
      id: 'b1', postId: 'b1', hypothesisId: 'proof-before-advice',
      hypothesisStatement: 'Leading with proof improves engagement rate.',
      changedDimension: 'proof_placement', changedValue: 'before-advice',
    }),
    observation({
      id: 'b2', postId: 'b2', publishedAt: '2026-09-21T00:00:00Z', checkedAt: '2026-09-24T01:00:00Z',
      hypothesisId: 'proof-before-advice', hypothesisStatement: 'Leading with proof improves engagement rate.',
      changedDimension: 'proof_placement', changedValue: 'before-advice',
    }),
    observation({
      id: 'b3', postId: 'b3', publishedAt: '2026-09-22T00:00:00Z', checkedAt: '2026-09-25T01:00:00Z',
      hypothesisId: 'proof-before-advice', hypothesisStatement: 'Leading with proof improves engagement rate.',
      changedDimension: 'proof_placement', changedValue: 'before-advice',
    }),
  ];
  const scanFile = writeInput(root, 'six-observations.json', {
    schema_version: 'growth-loop-scan.v1', observations: [...firstHypothesis, ...secondHypothesis],
  });
  const scan = invoke(['scan', '--state', root, '--input', scanFile, '--revision', '1']);
  assert.equal(scan.status, 0, scan.stderr);
  assert.equal(JSON.parse(scan.stdout).next_challenger_hypothesis_ids.length, 2);

  const invalidDay = sixCardDay();
  invalidDay.cards[0].role = 'challenger';
  const invalidFile = writeInput(root, 'invalid-day.json', invalidDay);
  const blocked = invoke(['prepare-day', '--state', root, '--input', invalidFile, '--revision', '2']);
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /four proven and two challenger/i);

  const dayFile = writeInput(root, 'day.json', sixCardDay());
  const prepared = invoke(['prepare-day', '--state', root, '--input', dayFile, '--revision', '2']);
  assert.equal(prepared.status, 0, prepared.stderr);
  const preparedResult = JSON.parse(prepared.stdout);
  assert.equal(preparedResult.day.card_count, 6);
  assert.equal(preparedResult.day.proven_count, 4);
  assert.equal(preparedResult.day.challenger_count, 2);
  assert.doesNotMatch(prepared.stdout, /Exact private draft body/);

  const intentFile = writeInput(root, 'intent.json', {
    schema_version: 'growth-loop-save-intent.v1',
    date: '2026-10-02',
    card_id: 'card-1',
    account_id: 'account-lennox',
    idempotency_key: 'growth-loop:2026-10-02:card-1',
  });
  const intent = invoke(['begin-save', '--state', root, '--input', intentFile, '--revision', '3']);
  assert.equal(intent.status, 0, intent.stderr);
  const intentResult = JSON.parse(intent.stdout);
  assert.equal(intentResult.operation.body, 'Exact private draft body number 1.');
  assert.match(intentResult.operation.content_sha256, /^[a-f0-9]{64}$/);

  const receiptFile = writeInput(root, 'receipt.json', {
    schema_version: 'growth-loop-save-receipt.v1',
    intent_id: intentResult.operation.intent_id,
    account_id: 'account-lennox',
    idempotency_key: 'growth-loop:2026-10-02:card-1',
    provider_draft_id: 'draft-provider-1',
    content_sha256: intentResult.operation.content_sha256,
    status: 'saved',
    authoritative: true,
    checked_at: '2026-10-01T04:00:00Z',
  });
  const reconciled = invoke(['reconcile-save', '--state', root, '--input', receiptFile, '--revision', '4']);
  assert.equal(reconciled.status, 0, reconciled.stderr);
  assert.equal(JSON.parse(reconciled.stdout).receipt.status, 'saved');
  assert.doesNotMatch(reconciled.stdout, /Exact private draft body/);

  const status = invoke(['status', '--state', root]);
  assert.equal(JSON.parse(status.stdout).status.pending_save_count, 0);
  const run = invoke(['display-run', '--state', root, '--date', '2026-10-02']);
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stdout, /account-lennox|Exact private draft body/);
  assert.equal(JSON.parse(run.stdout).save_receipts[0].account_label, '@lennox_saint');
});

test('seven-day commercial evidence is unknown without attribution and blocks promotion only when a regression is attributable', () => {
  const { root } = createWorkspace();
  const reach = [
    observation({ id: 'reach-1', postId: 'reach-1' }),
    observation({ id: 'reach-2', postId: 'reach-2', publishedAt: '2026-09-21T00:00:00Z', checkedAt: '2026-09-24T01:00:00Z' }),
    observation({ id: 'reach-3', postId: 'reach-3', publishedAt: '2026-09-22T00:00:00Z', checkedAt: '2026-09-25T01:00:00Z' }),
  ];
  const reachFile = writeInput(root, 'reach.json', { schema_version: 'growth-loop-scan.v1', observations: reach });
  const promoted = invoke(['scan', '--state', root, '--input', reachFile, '--revision', '1']);
  assert.equal(promoted.status, 0, promoted.stderr);
  assert.equal(JSON.parse(promoted.stdout).hypotheses[0].status, 'promoted');

  const wrongMetric = observation({
    id: 'commercial-wrong-metric', postId: 'commercial-wrong-metric',
    publishedAt: '2026-09-20T00:00:00Z', checkedAt: '2026-09-27T01:00:00Z',
  });
  wrongMetric.checkpoint = 'commercial_7d';
  wrongMetric.attribution = { post_level: true, method: 'utm' };
  const wrongMetricFile = writeInput(root, 'commercial-wrong-metric.json', {
    schema_version: 'growth-loop-scan.v1', observations: [wrongMetric],
  });
  const wrongMetricResult = invoke(['scan', '--state', root, '--input', wrongMetricFile, '--revision', '2']);
  assert.notEqual(wrongMetricResult.status, 0);
  assert.match(wrongMetricResult.stderr, /commercial metric/i);

  const unattributed = observation({
    id: 'commercial-unknown', postId: 'commercial-unknown',
    publishedAt: '2026-09-20T00:00:00Z', checkedAt: '2026-09-27T01:00:00Z',
  });
  unattributed.checkpoint = 'commercial_7d';
  unattributed.context.hypothesis.primary_metric = 'click_rate';
  unattributed.metrics = { views: 1000, tracked_clicks: 5 };
  unattributed.matched_baseline = { sample_size: 10, rate: 0.02 };
  unattributed.attribution = { post_level: false, method: null };
  const unknownFile = writeInput(root, 'commercial-unknown.json', {
    schema_version: 'growth-loop-scan.v1', observations: [unattributed],
  });
  const unknown = invoke(['scan', '--state', root, '--input', unknownFile, '--revision', '2']);
  assert.equal(unknown.status, 0, unknown.stderr);
  assert.equal(JSON.parse(unknown.stdout).accepted[0].result, 'unknown');
  assert.equal(JSON.parse(unknown.stdout).hypotheses[0].commercial_regression, 'unknown');
  assert.equal(JSON.parse(unknown.stdout).hypotheses[0].status, 'promoted');

  const regression = structuredClone(unattributed);
  regression.observation_id = 'commercial-known';
  regression.post_id = 'commercial-known';
  regression.evidence_ref = 'threadify://analytics/commercial-known/7d';
  regression.attribution = { post_level: true, method: 'utm' };
  const regressionFile = writeInput(root, 'commercial-regression.json', {
    schema_version: 'growth-loop-scan.v1', observations: [regression],
  });
  const regressed = invoke(['scan', '--state', root, '--input', regressionFile, '--revision', '3']);
  assert.equal(regressed.status, 0, regressed.stderr);
  assert.equal(JSON.parse(regressed.stdout).hypotheses[0].commercial_regression, 'present');
  assert.equal(JSON.parse(regressed.stdout).hypotheses[0].status, 'testing');
  assert.deepEqual(JSON.parse(regressed.stdout).next_challenger_hypothesis_ids, []);

  const commercialOnlyWorkspace = createWorkspace();
  const commercialOnly = [0, 1, 2].map((offset) => {
    const item = observation({
      id: `commercial-only-${offset}`,
      postId: `commercial-only-${offset}`,
      publishedAt: `2026-09-2${offset}T00:00:00Z`,
      checkedAt: `2026-09-2${offset + 7}T01:00:00Z`,
    });
    item.checkpoint = 'commercial_7d';
    item.context.hypothesis.primary_metric = 'click_rate';
    item.metrics = { views: 1000, tracked_clicks: 30 };
    item.matched_baseline = { sample_size: 10, rate: 0.02 };
    item.attribution = { post_level: true, method: 'utm' };
    return item;
  });
  const commercialOnlyFile = writeInput(commercialOnlyWorkspace.root, 'commercial-only.json', {
    schema_version: 'growth-loop-scan.v1', observations: commercialOnly,
  });
  const commercialOnlyResult = invoke([
    'scan', '--state', commercialOnlyWorkspace.root, '--input', commercialOnlyFile, '--revision', '1',
  ]);
  assert.equal(commercialOnlyResult.status, 0, commercialOnlyResult.stderr);
  assert.equal(JSON.parse(commercialOnlyResult.stdout).hypotheses[0].status, 'testing');
});

test('pause, resume, hypothesis display, and run display are explicit and body-free', () => {
  const { root } = createWorkspace();
  const paused = invoke(['pause', '--state', root, '--revision', '1']);
  assert.equal(paused.status, 0, paused.stderr);
  assert.equal(JSON.parse(paused.stdout).status.paused, true);

  const scanFile = writeInput(root, 'blocked-scan.json', {
    schema_version: 'growth-loop-scan.v1', observations: [observation()],
  });
  const blockedScan = invoke(['scan', '--state', root, '--input', scanFile, '--revision', '2']);
  assert.notEqual(blockedScan.status, 0);
  assert.match(blockedScan.stderr, /paused/i);

  const dayFile = writeInput(root, 'blocked-day.json', sixCardDay());
  const blocked = invoke(['prepare-day', '--state', root, '--input', dayFile, '--revision', '2']);
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /paused/i);

  const resumed = invoke(['resume', '--state', root, '--revision', '2']);
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.equal(JSON.parse(resumed.stdout).status.paused, false);

  const hypotheses = invoke(['display-hypotheses', '--state', root]);
  assert.equal(hypotheses.status, 0, hypotheses.stderr);
  assert.deepEqual(JSON.parse(hypotheses.stdout).hypotheses, []);
  assert.doesNotMatch(hypotheses.stdout, /draft_body|exact private/i);

  const run = invoke(['display-run', '--state', root, '--date', '2026-10-02']);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout).day, null);
  assert.equal(JSON.parse(run.stdout).scheduler.interval_hours, 6);
  assert.doesNotMatch(run.stdout, /draft_body|exact private/i);
});

test('the public schema, manifest, catalog, and generated installed CLI expose Growth Loop', () => {
  const manifest = JSON.parse(fs.readFileSync(path.resolve('workflows/growth-loop/manifest.json'), 'utf8'));
  assert.equal(manifest.workflow_id, 'growth-loop');
  assert.equal(manifest.entrypoint.skill_id, 'threadify-growth-loop');
  assert.deepEqual(manifest.dependencies.workflows, ['30-day-viral-vault']);
  assert.deepEqual(manifest.supported_adapters, ['generic-mcp', 'codex', 'claude', 'cursor', 'gemini', 'openclaw', 'hermes']);
  assert.equal(manifest.optional_mcp_tools.includes('save_draft'), true);
  assert.equal(manifest.optional_mcp_tools.includes('schedule_post'), false);

  const catalog = JSON.parse(fs.readFileSync(path.resolve('catalog.json'), 'utf8'));
  assert.equal(catalog.workflows.some((workflow) => workflow.workflow_id === 'growth-loop'), true);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'growth-loop-installed-'));
  fs.chmodSync(root, 0o700);
  const inputFile = writeInput(root, 'setup.json', setupFixture());
  const installed = spawnSync(process.execPath, [
    path.resolve('skills/threadify-growth-loop/scripts/growth-loop-cli.mjs'),
    'setup', '--state', root, '--input', inputFile, '--revision', '0',
  ], { cwd: root, encoding: 'utf8' });
  assert.equal(installed.status, 0, installed.stderr);
  const output = JSON.parse(installed.stdout);
  const schema = JSON.parse(fs.readFileSync(path.resolve('schemas/growth-loop.v1.json'), 'utf8'));
  const validate = new Ajv({ strict: true }).compile(schema);
  assert.equal(validate(output), true, JSON.stringify(validate.errors));
});
