import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Ajv from 'ajv/dist/2020.js';

import {
  GOAL_DEFINITIONS,
  reviewPostThisNext,
  writePostThisNextArtifacts,
} from '../../lib/post-this-next.mjs';

function criterion(score, confidence = 0.92) {
  return { score, confidence };
}

function evaluation(draftId, definition, score, confidence = 0.92) {
  return {
    draft_id: draftId,
    content_sha256: null,
    criteria: Object.fromEntries(
      Object.keys(definition.criteria).map((name) => [name, criterion(score, confidence)]),
    ),
  };
}

function fixture({ goals = ['most_useful_now'], adapter = 'custom_jev' } = {}) {
  const drafts = [
    { draft_id: 'draft-a', status: 'draft', text: 'A specific useful post with owned proof.', updated_at: '2026-09-21T01:00:00Z' },
    { draft_id: 'draft-b', status: 'saved', text: 'A generic post that still needs work.', updated_at: '2026-09-21T02:00:00Z' },
    { draft_id: 'draft-c', status: 'scheduled', text: 'Already scheduled and therefore ineligible.', updated_at: '2026-09-21T03:00:00Z' },
  ];
  const evaluations = {};
  for (const goal of goals) {
    const definition = GOAL_DEFINITIONS[goal];
    evaluations[goal] = [
      evaluation('draft-a', definition, 4),
      evaluation('draft-b', definition, 2),
    ];
    for (const item of evaluations[goal]) {
      const draft = drafts.find((candidate) => candidate.draft_id === item.draft_id);
      item.content_sha256 = crypto.createHash('sha256').update(draft.text).digest('hex');
    }
  }
  return {
    schema_version: 1,
    observed_at: '2026-09-21T04:00:00Z',
    account: { label: '@example_creator', verified: true },
    coverage: { complete: true, pages_read: 3, gaps: [] },
    data_handling_acknowledged: true,
    goals,
    drafts,
    evaluations,
    provider: {
      adapter,
      model: adapter === 'manual' ? null : 'typesafe-ai/jev',
      privacy_route: adapter === 'manual' ? 'local_only' : 'zdr',
      cost_usd: adapter === 'manual' ? null : 0.0001,
      latency_ms: adapter === 'manual' ? null : 240,
    },
  };
}

test('a clear Jev result recommends one eligible draft and preserves the runner-up', () => {
  const result = reviewPostThisNext(fixture());
  assert.equal(result.eligible_draft_count, 2);
  assert.equal(result.excluded_draft_count, 1);
  assert.equal(result.goals.most_useful_now.status, 'recommended');
  assert.equal(result.goals.most_useful_now.recommended_draft_id, 'draft-a');
  assert.equal(result.goals.most_useful_now.runner_up_draft_id, 'draft-b');
  assert.equal(result.goals.most_useful_now.rankings[0].normalized_score, 100);
  assert.equal(result.external_actions_performed, false);
  assert.equal(result.claims.traffic_prediction, false);
});

test('close or uncertain Jev results abstain and return the top two', () => {
  const input = fixture();
  const definition = GOAL_DEFINITIONS.most_useful_now;
  const hashes = Object.fromEntries(input.evaluations.most_useful_now.map((item) => [item.draft_id, item.content_sha256]));
  input.evaluations.most_useful_now = [
    evaluation('draft-a', definition, 3, 0.79),
    evaluation('draft-b', definition, 3, 0.95),
  ];
  for (const item of input.evaluations.most_useful_now) item.content_sha256 = hashes[item.draft_id];
  const result = reviewPostThisNext(input);
  assert.equal(result.goals.most_useful_now.status, 'abstained');
  assert.equal(result.goals.most_useful_now.recommended_draft_id, null);
  assert.deepEqual(result.goals.most_useful_now.top_two_draft_ids, ['draft-b', 'draft-a']);
  assert.match(result.goals.most_useful_now.abstention_reason, /confidence|margin/);
});

test('comparison mode supports all three goals without making a traffic forecast', () => {
  const goals = ['most_useful_now', 'engagement_pattern_fit', 'closest_to_ready'];
  const result = reviewPostThisNext(fixture({ goals }));
  assert.deepEqual(Object.keys(result.goals), goals);
  assert.equal(result.claims.traffic_prediction, false);
  assert.match(result.claims.engagement_language, /pattern fit/i);
});

test('the public result schema accepts the complete decision contract', () => {
  const schema = JSON.parse(fs.readFileSync(path.resolve('schemas/post-this-next.v1.json'), 'utf8'));
  const validate = new Ajv({ strict: true }).compile(schema);
  const result = reviewPostThisNext(fixture({
    goals: ['most_useful_now', 'engagement_pattern_fit', 'closest_to_ready'],
  }));
  assert.equal(validate(result), true, JSON.stringify(validate.errors));
});

test('complete verified coverage and content-bound evaluations are mandatory', () => {
  const incomplete = fixture();
  incomplete.coverage.complete = false;
  incomplete.coverage.gaps = ['final page unavailable'];
  assert.throws(() => reviewPostThisNext(incomplete), /complete draft coverage/);

  const wrongAccount = fixture();
  wrongAccount.account.verified = false;
  assert.throws(() => reviewPostThisNext(wrongAccount), /verified account/);

  const missing = fixture();
  missing.evaluations.most_useful_now.pop();
  assert.throws(() => reviewPostThisNext(missing), /exactly every eligible draft/);

  const stale = fixture();
  stale.evaluations.most_useful_now[0].content_sha256 = '0'.repeat(64);
  assert.throws(() => reviewPostThisNext(stale), /content hash/);
});

test('manual fallback remains a shortlist and never impersonates a Jev recommendation', () => {
  const input = fixture({ adapter: 'manual' });
  for (const item of input.evaluations.most_useful_now) {
    for (const value of Object.values(item.criteria)) value.confidence = null;
  }
  const result = reviewPostThisNext(input);
  assert.equal(result.goals.most_useful_now.status, 'manual_shortlist');
  assert.equal(result.goals.most_useful_now.recommended_draft_id, null);
  assert.deepEqual(result.goals.most_useful_now.top_two_draft_ids, ['draft-a', 'draft-b']);
});

test('artifacts are private and the receipt contains no draft bodies', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'post-this-next-'));
  const written = writePostThisNextArtifacts(fixture(), directory);
  const receiptText = fs.readFileSync(written.receipt, 'utf8');
  const resultText = fs.readFileSync(written.result, 'utf8');
  assert.doesNotMatch(receiptText, /specific useful post|generic post/i);
  assert.doesNotMatch(resultText, /specific useful post|generic post/i);
  assert.equal(fs.statSync(written.receipt).mode & 0o777, 0o600);
  assert.equal(JSON.parse(receiptText).external_actions_performed, false);
});

test('the bundled CLI reviews a normalized result through its public command', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'post-this-next-cli-'));
  const inputFile = path.join(directory, 'input.json');
  const outputDirectory = path.join(directory, 'output');
  fs.writeFileSync(inputFile, `${JSON.stringify(fixture())}\n`, { mode: 0o600 });
  const cli = path.resolve('tools/post-this-next/cli.mjs');
  const run = spawnSync(process.execPath, [cli, 'review', '--input', inputFile, '--output-dir', outputDirectory], {
    cwd: path.resolve('.'),
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr);
  const response = JSON.parse(run.stdout);
  assert.match(response.result_sha256, /^[a-f0-9]{64}$/);
  assert.equal(fs.existsSync(response.receipt), true);
});

test('the package CLI exposes post-this-next as a stable command', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'post-this-next-package-cli-'));
  const inputFile = path.join(directory, 'input.json');
  const outputDirectory = path.join(directory, 'output');
  fs.writeFileSync(inputFile, `${JSON.stringify(fixture())}\n`, { mode: 0o600 });
  const run = spawnSync(process.execPath, [
    path.resolve('bin/threadify-workflows.mjs'),
    'post-this-next',
    'review',
    '--input',
    inputFile,
    '--output-dir',
    outputDirectory,
  ], { cwd: path.resolve('.'), encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(fs.existsSync(JSON.parse(run.stdout).result), true);
});

test('the generated installed skill carries a self-contained runnable CLI', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'post-this-next-installed-'));
  const inputFile = path.join(directory, 'input.json');
  const outputDirectory = path.join(directory, 'output');
  fs.writeFileSync(inputFile, `${JSON.stringify(fixture())}\n`, { mode: 0o600 });
  const run = spawnSync(process.execPath, [
    path.resolve('skills/threadify-post-this-next/scripts/post-this-next-cli.mjs'),
    'review',
    '--input',
    inputFile,
    '--output-dir',
    outputDirectory,
  ], { cwd: directory, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const response = JSON.parse(run.stdout);
  assert.equal(fs.existsSync(response.result), true);
  assert.equal(JSON.parse(fs.readFileSync(response.result, 'utf8')).workflow_id, 'post-this-next');
});
