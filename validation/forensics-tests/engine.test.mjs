import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dedupeItems, runForensics } from '../../lib/ai-content-forensics.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

function packet({ count = 24, platform = 'threads', duplicate = false } = {}) {
  const observedAt = '2026-09-24T04:00:00Z';
  const items = Array.from({ length: count }, (_, index) => ({
    evidence_id: `post-${index + 1}`,
    source_id: 'owned-export',
    platform,
    creator_handle: '@creator',
    native_id: `native-${index + 1}`,
    url: `https://example.test/post/${index + 1}`,
    published_at: `2026-09-${String((index % 23) + 1).padStart(2, '0')}T00:00:00Z`,
    format_family: 'root_post',
    title: null,
    text: `Specific owned example ${index + 1}`,
    metrics: { views: (index + 1) * 100, likes: index + 1, replies: index, reposts: 0 },
    source_kind: 'owned',
    rights_basis: 'owner export',
  }));
  if (duplicate) items.push({ ...items[0], evidence_id: 'duplicate-native', metrics: { ...items[0].metrics, views: 9999 } });
  const categories = ['opener', 'proof', 'structure', 'media', 'cta', 'proof', 'structure', 'opener', 'media', 'cta'];
  const findingCandidates = categories.map((category, index) => ({
    finding_id: `finding-${index + 1}`,
    rank: index + 1,
    category,
    claim: `Observed rule ${index + 1}`,
    explanation: `The bounded corpus supports finding ${index + 1}; this is an observed association, not causation.`,
    copy_this: `[specific proof ${index + 1}] + [portable action]`,
    evidence_ids: index === 0 && count >= 20
      ? [`aggregate:${platform}:root_post:views`]
      : [`post-${(index % count) + 1}`],
    limitation: 'Observed in this bounded corpus only.',
  }));
  return {
    record_type: 'AIContentForensicsInputV1',
    schema_version: 1,
    run_id: 'forensics-test-run',
    creator: { display_name: 'Creator', handle: '@creator', publisher_handle: '@publisher' },
    destination_platform: 'threads',
    observed_at: observedAt,
    sources: [{
      source_id: 'owned-export', provider: 'local', platform, auth_mode: 'local_export',
      observed_at: observedAt, requested_count: items.length, returned_count: items.length,
      complete: true, cache_status: null, evidence_ref: 'local:test-fixture',
    }],
    items,
    finding_candidates: findingCandidates,
    hook: 'I inspected a bounded creator corpus to find the patterns that survived an evidence check. Here are seven worth testing.',
    action_post: 'What to do now:\nChoose one supported pattern, change one dimension, and measure the next bounded sample without calling correlation causation.',
    cta_post: 'Run AI Content Forensics on a corpus you own or have permission to inspect. The output is a draft for review, not a growth guarantee.',
  };
}

test('prepares an exact evidence-bound ten-post package and body-free receipt', () => {
  const result = runForensics(packet());
  assert.equal(result.status, 'prepared_locally');
  assert.equal(result.thread.length, 10);
  assert.equal(result.thread.slice(1, 8).every((post) => post.includes('\n\ncopy this: ')), true);
  assert.equal(result.coverage.cohorts[0].comparison_status, 'comparative');
  assert.equal(result.coverage.cohorts[0].primary_metric, 'views');
  assert.equal(result.insight_audit.selected.length, 7);
  assert.equal(result.insight_audit.runner_ups.length, 3);
  assert.equal(result.receipt.provider_writes_performed, false);
  assert.equal(result.receipt.raw_bodies_retained_in_receipt, false);
  assert.equal(JSON.stringify(result.receipt).includes('Specific owned example'), false);
});

test('deduplicates native identity and exact-text reruns while preserving the strongest observation', () => {
  const input = packet({ duplicate: true });
  input.items.push({
    ...input.items[1], evidence_id: 'rerun-body', native_id: 'rerun-native',
    published_at: '2026-09-24T00:00:00Z', metrics: { ...input.items[1].metrics, views: 8888 },
  });
  input.sources[0].requested_count += 1;
  input.sources[0].returned_count += 1;
  const result = runForensics(input);
  assert.equal(result.coverage.input_item_count, 26);
  assert.equal(result.coverage.unique_item_count, 24);
  assert.equal(result.coverage.duplicate_native_count, 1);
  assert.equal(result.coverage.duplicate_body_count, 1);
  assert.equal(result.insight_audit.selected[1].evidence_ids[0], 'rerun-body');
  const validated = dedupeItems(input.items);
  assert.equal(validated.items.find((item) => item.native_id === 'native-1').metrics.views, 9999);
  assert.equal(validated.items.find((item) => item.text === 'Specific owned example 2').metrics.views, 8888);
});

test('labels small cohorts descriptive-only and rejects aggregate claims for them', () => {
  const input = packet({ count: 12 });
  const result = runForensics(input);
  assert.equal(result.coverage.cohorts[0].comparison_status, 'descriptive_only');
  assert.equal(result.coverage.cohorts[0].primary_metric, null);
  assert.equal(result.coverage.cohorts[0].metric_valid_count, 12);
  input.finding_candidates[0].evidence_ids = ['aggregate:threads:root_post:views'];
  assert.throws(() => runForensics(input), /finding_unknown_evidence/);
});

test('rejects unknown evidence and over-limit destination posts', () => {
  const unknown = packet();
  unknown.finding_candidates[2].evidence_ids = ['missing-evidence'];
  assert.throws(() => runForensics(unknown), /finding_unknown_evidence/);
  const long = packet();
  long.finding_candidates[0].explanation = 'x'.repeat(600);
  assert.throws(() => runForensics(long), /thread_post_too_long/);
});

test('rejects ambiguous evidence identities and source coverage drift', () => {
  const duplicateEvidence = packet();
  duplicateEvidence.items[1].evidence_id = duplicateEvidence.items[0].evidence_id;
  assert.throws(() => runForensics(duplicateEvidence), /duplicate_item_evidence_id/);

  const platformDrift = packet();
  platformDrift.items[0].platform = 'youtube';
  assert.throws(() => runForensics(platformDrift), /item_source_platform_mismatch/);

  const partialSource = packet();
  partialSource.sources[0].returned_count -= 1;
  assert.throws(() => runForensics(partialSource), /source_returned_count_mismatch/);

  const tooFewCandidates = packet();
  tooFewCandidates.finding_candidates.pop();
  assert.throws(() => runForensics(tooFewCandidates), /at_least_ten_findings_required/);
});

test('writes ten optional SVG and HTML cards with evidence hashes', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'threadify-forensics-'));
  try {
    const result = runForensics(packet(), { visualDirectory: directory });
    assert.equal(result.receipt.visuals_generated, 10);
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
    assert.equal(manifest.length, 10);
    assert.equal(fs.existsSync(path.join(directory, '01-forensics.svg')), true);
    assert.equal(fs.existsSync(path.join(directory, '10-forensics.html')), true);
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
});

test('CLI accepts private stdin and the package contains no provider network adapter', () => {
  const cli = spawnSync(process.execPath, ['lib/ai-content-forensics-cli.mjs'], {
    cwd: root, input: JSON.stringify(packet()), encoding: 'utf8',
  });
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(JSON.parse(cli.stdout).thread.length, 10);
  assert.equal(fs.existsSync(path.join(root, 'lib/scrape-creators-read.mjs')), false);
});

test('local importer normalizes JSONL and CSV exports without retaining a source path', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'threadify-forensics-import-'));
  try {
    const jsonl = path.join(directory, 'posts.jsonl');
    fs.writeFileSync(jsonl, [
      JSON.stringify({ post_id: 'one', created_at: '2026-09-01', caption: 'First owned post', views: '1,200', likes: 20 }),
      JSON.stringify({ post_id: 'two', created_at: '2026-09-02', caption: 'Second owned post', views: 900, likes: 10 }),
    ].join('\n'));
    const args = [
      'lib/ai-content-forensics-import.mjs', '--source', jsonl, '--platform', 'threads',
      '--creator', '@creator', '--source-id', 'owned-jsonl', '--source-kind', 'owned',
      '--rights-basis', 'owner export', '--observed-at', '2026-09-24T04:00:00Z',
    ];
    const imported = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
    assert.equal(imported.status, 0, imported.stderr);
    const result = JSON.parse(imported.stdout);
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].metrics.views, 1200);
    assert.match(result.source.evidence_ref, /^local-file-sha256:[0-9a-f]{64}$/);
    assert.doesNotMatch(JSON.stringify(result.source), new RegExp(directory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

    const csv = path.join(directory, 'videos.csv');
    fs.writeFileSync(csv, 'video_id,upload_date,title,description,view_count,like_count\nvid-1,20260903,"A, useful title",Owned description,5000,50\n');
    const csvRun = spawnSync(process.execPath, [
      'lib/ai-content-forensics-import.mjs', '--source', csv, '--platform', 'youtube',
      '--creator', '@creator', '--rights-basis', 'public metadata', '--source-kind', 'public',
      '--observed-at', '2026-09-24T04:00:00Z',
    ], { cwd: root, encoding: 'utf8' });
    assert.equal(csvRun.status, 0, csvRun.stderr);
    const csvResult = JSON.parse(csvRun.stdout);
    assert.equal(csvResult.items[0].title, 'A, useful title');
    assert.equal(csvResult.items[0].published_at, '2026-09-03T00:00:00.000Z');
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
});
