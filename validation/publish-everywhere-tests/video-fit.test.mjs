import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import test from 'node:test';
import {
  LIMITS,
  containerFromName,
  decide,
  factsFromFfprobe,
  probe,
  sayDuration,
  youtubeFormat,
} from '../../plugins/threadify/skills/threadify-publish-everywhere/scripts/video-fit.mjs';

const script = 'plugins/threadify/skills/threadify-publish-everywhere/scripts/video-fit.mjs';
const fixture = (name) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const all = { youtube: true, threads: true, x: true };
const video = (overrides = {}) => ({ size_mb: 80, duration_seconds: 60, width: 1080, height: 1920, container: 'mp4', ...overrides });

test('the limits table holds the published numbers', () => {
  assert.equal(LIMITS.storage_max_mb, 1024);
  assert.equal(LIMITS.platforms.threads.max_duration_seconds, 300);
  assert.equal(LIMITS.platforms.x.max_duration_seconds, 20 * 60);
  assert.equal(LIMITS.platforms.x.metered, true);
  assert.equal(LIMITS.platforms.youtube.max_duration_seconds, 12 * 60 * 60);
  assert.equal(LIMITS.platforms.youtube.uncleared_max_duration_seconds, 15 * 60);
  assert.equal(LIMITS.youtube_format.short_max_duration_seconds, 180);
  assert.deepEqual(LIMITS.containers, { mp4: 'video/mp4', mov: 'video/quicktime' });
  assert.equal(LIMITS.youtube_title_max_characters, 100);
});

test('a short vertical video goes everywhere as a YouTube short', () => {
  const result = decide({ video: video(), connected: all });
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.kept, ['youtube', 'threads', 'x']);
  assert.deepEqual(result.dropped, []);
  assert.equal(result.content_type, 'video/mp4');
  assert.equal(result.youtube.format, 'short');
  assert.match(result.platforms.x.note, /X is metered/);
});

test('Threads is dropped above 300 seconds with a plain reason, exactly at the edge it stays', () => {
  assert.equal(decide({ video: video({ duration_seconds: 300 }), connected: all }).platforms.threads.decision, 'keep');
  const result = decide({ video: video({ duration_seconds: 301 }), connected: all });
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.kept, ['youtube', 'x']);
  assert.deepEqual(result.dropped, [{ platform: 'threads', reason: 'the video is 5 min 1 s and Threads takes up to 5 min' }]);
});

test('X is dropped above 20 minutes', () => {
  assert.equal(decide({ video: video({ duration_seconds: 1200 }), connected: all, youtube_long_uploads_cleared: true }).platforms.x.decision, 'keep');
  const result = decide({ video: video({ duration_seconds: 1201 }), connected: all, youtube_long_uploads_cleared: true });
  assert.deepEqual(result.kept, ['youtube']);
  assert.match(result.platforms.x.reason, /X takes up to 20 min/);
});

test('YouTube over 15 minutes depends on whether the channel is cleared for long uploads', () => {
  const long = video({ duration_seconds: 901, width: 1920, height: 1080 });
  assert.equal(decide({ video: video({ duration_seconds: 900 }), connected: all }).platforms.youtube.decision, 'keep');
  const unknown = decide({ video: long, connected: all });
  assert.equal(unknown.status, 'ask', 'unknown clearance is a question, never a guess');
  assert.match(unknown.ask[0], /cleared \(verified\) for uploads longer than 15 min/);
  const notCleared = decide({ video: long, connected: all, youtube_long_uploads_cleared: false });
  assert.equal(notCleared.platforms.youtube.decision, 'drop');
  assert.match(notCleared.platforms.youtube.reason, /not cleared for long uploads, so YouTube holds it to 15 min/);
  assert.equal(notCleared.youtube, undefined, 'no format for a dropped YouTube');
  const cleared = decide({ video: long, connected: all, youtube_long_uploads_cleared: true });
  assert.equal(cleared.platforms.youtube.decision, 'keep');
  assert.equal(cleared.youtube.format, 'long');
  const tooLong = decide({ video: video({ duration_seconds: 12 * 3600 + 1 }), connected: all, youtube_long_uploads_cleared: true });
  assert.equal(tooLong.status, 'stop');
  assert.match(tooLong.platforms.youtube.reason, /YouTube takes up to 12 h/);
});

test('a file above 1 GB is dropped from every platform and the run stops', () => {
  assert.equal(decide({ video: video({ size_mb: 1024 }), connected: all }).status, 'ok');
  const result = decide({ video: video({ size_mb: 1024.1 }), connected: all });
  assert.equal(result.status, 'stop');
  assert.deepEqual(result.kept, []);
  assert.equal(result.dropped.length, 3);
  for (const entry of result.dropped) assert.match(entry.reason, /Threadify stores up to 1024 MB \(1 GB\)/);
  assert.match(result.message, /Nothing was uploaded or scheduled/);
});

test('only MP4 or MOV: anything else stops with a convert message', () => {
  assert.equal(containerFromName('/Users/me/Clip.MP4'), 'mp4');
  assert.equal(containerFromName('https://cdn.example.com/a/clip.mov?download=1'), 'mov');
  assert.equal(containerFromName('clip.mkv'), null);
  assert.equal(containerFromName('clip.webm'), null);
  assert.equal(decide({ video: video({ container: 'mov' }), connected: all }).content_type, 'video/quicktime');
  const result = decide({ video: video({ container: null }), connected: all });
  assert.equal(result.status, 'stop');
  assert.match(result.message, /Only MP4 or MOV video works\. Convert the file to MP4/);
  assert.match(result.platforms.youtube.reason, /not an MP4 or MOV/);
});

test('YouTube format: vertical or square and 3 minutes or less is short, otherwise long', () => {
  assert.equal(youtubeFormat(video({ duration_seconds: 180 })).format, 'short');
  assert.equal(youtubeFormat(video({ duration_seconds: 180, width: 1080, height: 1080 })).format, 'short');
  assert.equal(youtubeFormat(video({ duration_seconds: 181 })).format, 'long');
  assert.equal(youtubeFormat(video({ duration_seconds: 30, width: 1920, height: 1080 })).format, 'long');
  assert.match(youtubeFormat(video({ duration_seconds: 30, width: 1920, height: 1080 })).reason, /horizontal video of 30 s, so YouTube format is long/);
});

test('a platform that is not connected is reported, not silently skipped', () => {
  const result = decide({ video: video(), connected: { youtube: true, threads: true, x: false } });
  assert.deepEqual(result.kept, ['youtube', 'threads']);
  assert.deepEqual(result.not_connected, ['x']);
  assert.equal(result.platforms.x.reason, 'X is not connected to this brand');
});

test('missing facts become questions, never guesses', () => {
  const result = decide({ video: { size_mb: 80, container: 'mp4' }, connected: all });
  assert.equal(result.status, 'ask');
  assert.deepEqual(result.ask, ["What is the video's length in seconds?", "What is the video's shape (width x height)?"]);
});

test('ffprobe output becomes plain facts, with phone rotation applied', () => {
  const phone = factsFromFfprobe(fixture('ffprobe-vertical-phone.json'));
  assert.deepEqual(phone, {
    source: 'clip.mov',
    size_mb: 70,
    duration_seconds: 58.4,
    width: 1080,
    height: 1920,
    container: 'mov',
    container_reported: 'mov,mp4,m4a,3gp,3g2,mj2',
    video_codec: 'hevc',
    audio_codec: 'aac',
  });
  assert.equal(decide({ video: phone, connected: all }).youtube.format, 'short');
  const episode = factsFromFfprobe(fixture('ffprobe-long-horizontal.json'));
  assert.equal(episode.container, 'mp4');
  assert.equal(episode.size_mb, 600);
  const result = decide({ video: episode, connected: all, youtube_long_uploads_cleared: true });
  assert.deepEqual(result.kept, ['youtube']);
  assert.deepEqual(result.dropped.map((entry) => entry.platform), ['threads', 'x']);
  assert.equal(result.youtube.format, 'long');
  assert.throws(() => factsFromFfprobe({ streams: [{ codec_type: 'audio' }], format: {} }), /no video stream/);
});

test('a missing ffprobe falls back to asking for length and shape', () => {
  const result = probe('https://cdn.example.com/clip.mp4', { run: () => ({ error: { code: 'ENOENT' } }) });
  assert.equal(result.status, 'ffprobe_missing');
  assert.equal(result.video.container, 'mp4');
  assert.equal(result.ask.length, 2);
  assert.match(result.ask[0], /How long is the video/);
  const ok = probe('https://cdn.example.com/episode.mp4', { run: () => ({ status: 0, stdout: JSON.stringify(fixture('ffprobe-long-horizontal.json')) }) });
  assert.equal(ok.status, 'ok');
  assert.equal(ok.video.duration_seconds, 1500);
  assert.throws(() => probe('https://cdn.example.com/x.mp4', { run: () => ({ status: 1, stderr: 'Invalid data found' }) }), /ffprobe could not read the file: Invalid data found/);
});

test('durations read the way a creator says them, and the CLI exits 1 on a stop', () => {
  assert.equal(sayDuration(45), '45 s');
  assert.equal(sayDuration(300), '5 min');
  assert.equal(sayDuration(3725), '1 h 2 min 5 s');
  const run = (input) => spawnSync(process.execPath, [script, 'decide'], { input: JSON.stringify(input), encoding: 'utf8' });
  assert.equal(run({ video: video(), connected: all }).status, 0);
  assert.equal(run({ video: video({ size_mb: 2000 }), connected: all }).status, 1);
  assert.equal(spawnSync(process.execPath, [script, 'nonsense'], { encoding: 'utf8' }).status, 1);
});
