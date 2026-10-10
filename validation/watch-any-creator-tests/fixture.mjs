// Synthetic corpus for Watch Any Creator tests. Every title, number and
// transcript line is made up; no third-party transcript is committed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const OBSERVED_AT = '2026-10-10T00:00:00.000Z';
const DAY = 86_400_000;

// Small deterministic generator so every run builds the same corpus.
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const LONG_TOPICS = ['pricing', 'hiring', 'sales', 'offers', 'leads'];
const SHORT_TOPICS = ['pricing', 'hiring', 'sales', 'offers', 'leads'];

// Letters, not digits, so only the titles meant to carry a number do.
function tag(index) {
  let out = '';
  let value = index + 26;
  while (value > 0) { out = String.fromCharCode(97 + (value % 26)) + out; value = Math.floor(value / 26); }
  return out;
}

function publishDate(index) {
  return new Date(Date.parse(OBSERVED_AT) - (30 + index * 3) * DAY).toISOString();
}

/**
 * 120 long-form videos and 160 Shorts. Long-form titles with a number get
 * three times the views per day; long videos of 20-40 minutes get double.
 * Shorts that say "stop" get four times. Openings that ask a question get
 * double. Everything else is noise.
 */
export function buildPages() {
  const next = random(45);
  const long = [];
  for (let index = 0; index < 120; index += 1) {
    const topic = LONG_TOPICS[index % LONG_TOPICS.length];
    const hasNumber = index % 2 === 0;
    const midLength = index % 3 === 0;
    const askQuestion = index % 4 < 2;
    const title = hasNumber
      ? `${(index % 9) + 2} ${topic} lessons from building company ${tag(index)}`
      : `the ${topic} lesson from building company ${tag(index)}`;
    const days = 30 + index * 3;
    let perDay = 100 * (0.8 + next() * 0.4);
    if (hasNumber) perDay *= 3;
    if (midLength) perDay *= 2;
    if (askQuestion) perDay *= 2;
    const seconds = midLength ? 1500 + index : 400 + index;
    long.push({
      type: 'video',
      id: `synthL${String(index).padStart(4, '0')}`,
      url: `https://www.youtube.com/watch?v=synthL${String(index).padStart(4, '0')}`,
      title,
      viewCountInt: Math.round(perDay * days),
      viewCountText: Math.round(perDay * days).toLocaleString('en-US'),
      likeCountInt: Math.round(perDay),
      commentCountInt: 10,
      publishDate: publishDate(index),
      lengthSeconds: seconds,
      channel: { handle: '@SyntheticCreator' },
      description: 'Shared boilerplate description for every video.',
      _askQuestion: askQuestion,
    });
  }
  const shorts = [];
  for (let index = 0; index < 160; index += 1) {
    const topic = SHORT_TOPICS[index % SHORT_TOPICS.length];
    const warning = index % 2 === 1;
    const days = 30 + index * 3;
    let perDay = 500 * (0.8 + next() * 0.4);
    if (warning) perDay *= 4;
    shorts.push({
      type: 'short',
      id: `synthS${String(index).padStart(4, '0')}`,
      url: `https://www.youtube.com/watch?v=synthS${String(index).padStart(4, '0')}`,
      title: warning ? `stop doing this with ${topic} ${tag(index)}` : `a ${topic} idea worth trying ${tag(index)}`,
      viewCountInt: Math.round(perDay * days),
      likeCountInt: Math.round(perDay / 10),
      commentCountInt: 3,
      publishDate: publishDate(index),
      durationMs: (15 + (index % 50)) * 1000,
      description: 'Shared boilerplate description for every Short.',
    });
  }
  return { long, shorts };
}

/** ScrapeCreators-shaped transcript: timed segments, first sentence asks or states. */
export function transcriptFor(video) {
  const opener = video._askQuestion
    ? 'why do most founders still guess their prices?'
    : 'this is the story of my first company.';
  return {
    success: true,
    credits_charged: 1,
    videoId: video.id,
    transcript: [
      { text: opener, startMs: '0', endMs: '4000' },
      { text: 'here is what the numbers showed over ten years', startMs: '4000', endMs: '9000' },
      { text: 'this line is past the first minute and never read', startMs: '61000', endMs: '65000' },
    ],
  };
}

/** Write the corpus cache layout the skill documents into a temp directory. */
export function writeCorpus({ withTranscripts = true, duplicateFirstPage = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'watch-any-creator-'));
  const corpus = path.join(root, 'corpus');
  const { long, shorts } = buildPages();
  const strip = (entry) => Object.fromEntries(Object.entries(entry).filter(([name]) => !name.startsWith('_')));
  const page = (list, field, entries, number) => {
    fs.mkdirSync(path.join(corpus, list), { recursive: true });
    fs.writeFileSync(path.join(corpus, list, `page-${String(number).padStart(4, '0')}.json`), JSON.stringify({
      success: true, credits_charged: 1, [field]: entries.map(strip), continuationToken: null,
    }));
  };
  for (let start = 0, number = 1; start < long.length; start += 30, number += 1) page('videos', 'videos', long.slice(start, start + 30), number);
  // The same first page again, as a "latest" sort would return it.
  if (duplicateFirstPage) page('videos', 'videos', long.slice(0, 30), 99);
  for (let start = 0, number = 1; start < shorts.length; start += 48, number += 1) page('shorts', 'shorts', shorts.slice(start, start + 48), number);
  if (withTranscripts) {
    fs.mkdirSync(path.join(corpus, 'transcripts'), { recursive: true });
    for (const video of long) fs.writeFileSync(path.join(corpus, 'transcripts', `${video.id}.json`), JSON.stringify(transcriptFor(video)));
  }
  fs.writeFileSync(path.join(corpus, 'channel.json'), JSON.stringify({ handle: '@SyntheticCreator', name: 'Synthetic Creator', videoCount: 300 }));
  fs.writeFileSync(path.join(corpus, 'manifest.json'), JSON.stringify({
    record_type: 'WatchAnyCreatorCorpusV1',
    creator_handle: '@SyntheticCreator',
    provider: 'scrapecreators',
    observed_at: OBSERVED_AT,
    counts: { long_listed: 150, shorts_listed: 160, transcripts: withTranscripts ? 120 : 0 },
  }));
  return { root, corpus, long, shorts };
}
