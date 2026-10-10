import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { LONG, SHORT, hookFeatures, loadCorpus, normalizeListing, transcriptHead, estimateCredits } from '../../lib/watch-any-creator.mjs';
import { writeCorpus } from './fixture.mjs';

const config = { list: 'videos', creator: '@SyntheticCreator', sourceId: 'cache-test', rightsBasis: 'synthetic', position: 'p#0' };

test('a ScrapeCreators long-form entry becomes a forensics corpus item', () => {
  const { item, extra } = normalizeListing({
    type: 'video', id: 'abcDEF12345', url: 'https://www.youtube.com/watch?v=abcDEF12345', title: 'How I priced my first offer',
    viewCountInt: 4542681, likeCountInt: 119894, commentCountInt: 3500, publishedTime: '2023-10-10T01:08:14.077Z',
    publishDate: '2023-08-05T11:00:21-07:00', lengthText: '51:46', lengthSeconds: 3106, description: 'boilerplate',
    channel: { handle: '@SyntheticCreator' },
  }, config);
  assert.equal(item.platform, 'youtube');
  assert.equal(item.format_family, LONG);
  assert.equal(item.native_id, 'abcDEF12345');
  assert.equal(item.published_at, '2023-08-05T18:00:21.000Z', 'publishDate wins over publishedTime');
  assert.deepEqual(item.metrics, { views: 4542681, likes: 119894, replies: 3500, reposts: null });
  assert.equal(item.text, '', 'never the description or a transcript body');
  assert.equal(item.source_kind, 'public');
  assert.equal(extra.duration_seconds, 3106);
});

test('a ScrapeCreators Short keeps its own format family and parses durationMs', () => {
  const { item, extra } = normalizeListing({
    type: 'short', id: 'shortID0001', title: 'You need the right foundation', viewCountInt: 9538159,
    publishDate: '2024-02-22T07:00:11-08:00', durationMs: 54000, durationFormatted: '00:00:54',
  }, { ...config, list: 'shorts' });
  assert.equal(item.format_family, SHORT);
  assert.equal(item.url, 'https://www.youtube.com/watch?v=shortID0001');
  assert.equal(extra.duration_seconds, 54);
});

test('unknown numbers stay unknown and foreign or broken entries are skipped', () => {
  const { item, extra } = normalizeListing({ url: 'https://www.youtube.com/shorts/fromUrl123', title: 'x', viewCountText: '3.5K', durationFormatted: '1:02:03' }, { ...config, list: 'shorts' });
  assert.equal(item.native_id, 'fromUrl123');
  assert.equal(item.format_family, SHORT, 'no type: the folder decides');
  assert.equal(item.metrics.views, null, 'abbreviated counts are not exact numbers');
  assert.equal(item.published_at, null);
  assert.equal(extra.duration_seconds, 3723);
  assert.deepEqual(normalizeListing({ title: 'no id' }, config), { skipped: 'no_video_id' });
  assert.deepEqual(normalizeListing({ id: 'abcdefgh', title: 'theirs', channel: { handle: '@Someone' } }, config), { skipped: 'other_channel' });
});

test('transcript heads read only the first minute or the first 150 words', () => {
  const timed = transcriptHead({ transcript: [
    { text: 'why do most people lose money?', startMs: '0' },
    { text: 'here is the answer', startMs: '5000' },
    { text: 'past the first minute', startMs: '61000' },
  ] });
  assert.equal(timed.timed, true);
  assert.equal(timed.text, 'why do most people lose money? here is the answer');
  assert.ok(!timed.text.includes('past the first minute'));
  const supadata = transcriptHead({ content: [{ text: 'in 2019 i was broke', offset: 0 }, { text: 'later', offset: 70000 }] });
  assert.equal(supadata.text, 'in 2019 i was broke');
  const untimed = transcriptHead('word '.repeat(400));
  assert.equal(untimed.timed, false);
  assert.equal(untimed.head_words, 150);
  const features = hookFeatures(timed);
  assert.equal(features.hook_question, true);
  assert.equal(features.hook_contrarian, true);
  assert.ok(features.opening_quote.split(' ').length <= 12, 'quotes stay under twelve words');
});

test('a corpus cache loads, dedupes repeated pages and keeps Shorts apart', () => {
  const { root, corpus } = writeCorpus();
  try {
    const loaded = loadCorpus(corpus);
    assert.equal(loaded.counts.listed_long, 150, 'listing entries counted with the repeated page');
    assert.equal(loaded.counts.duplicate_listings, 30);
    assert.equal(loaded.counts.unique_videos, 280);
    assert.equal(loaded.counts.analysed_long, 120);
    assert.equal(loaded.counts.analysed_shorts, 160);
    assert.equal(loaded.counts.transcripts_matched, 120);
    assert.equal(loaded.counts.credits_charged_in_cache, 129);
    assert.deepEqual(loaded.source.gaps, []);
    assert.equal(loaded.source.complete, true);
    assert.equal(loaded.manifest.creator_handle, '@SyntheticCreator');
    const serialized = JSON.stringify([...loaded.extras.values()]);
    assert.ok(!serialized.includes('past the first minute'), 'no transcript text beyond the first minute');
    assert.ok(!serialized.includes('here is what the numbers showed over ten years'), 'quotes are capped');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a manifest count that disagrees with the cache is a gap, and the wrong creator stops', () => {
  const { root, corpus } = writeCorpus({ withTranscripts: false });
  try {
    const loaded = loadCorpus(corpus);
    assert.equal(loaded.source.complete, true);
    const manifestFile = path.join(corpus, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    fs.writeFileSync(manifestFile, JSON.stringify({ ...manifest, counts: { ...manifest.counts, shorts_listed: 999 } }));
    const partial = loadCorpus(corpus);
    assert.equal(partial.source.complete, false);
    assert.match(partial.source.gaps[0], /shorts_listed 999, cache holds 160/);
    fs.writeFileSync(path.join(corpus, 'channel.json'), JSON.stringify({ handle: '@SomeoneElse' }));
    assert.throws(() => loadCorpus(corpus), /wrong_creator/);
    fs.rmSync(manifestFile);
    assert.throws(() => loadCorpus(corpus), /corpus_manifest_missing/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the credit estimate counts every page and transcript before a paid pull', () => {
  const estimate = estimateCredits({ long_count: 524, shorts_count: 4476 });
  assert.deepEqual(estimate.calls, { channel: 1, long_pages: 18, shorts_pages: 94, transcripts: 524 });
  assert.equal(estimate.estimated_credits, 637);
  assert.equal(estimate.listing_credits, 113);
  assert.equal(estimateCredits({ long_count: 60, shorts_count: 0, transcripts: 0, sorts: 2 }).calls.long_pages, 4);
  assert.throws(() => estimateCredits({ long_count: -1, shorts_count: 0 }), /long_count_must_be_a_whole_number/);
});
