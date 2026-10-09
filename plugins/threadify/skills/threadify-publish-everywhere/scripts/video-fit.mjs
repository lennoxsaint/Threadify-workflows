#!/usr/bin/env node
// Publish Everywhere: where can this one video go?
//
// Reads a video's facts (size, length, shape, container) and decides, per
// platform, whether it fits the limits in references/platform-limits.json.
// A platform that cannot take the video is dropped with a plain reason. It
// also picks the YouTube format: vertical or square and 3 minutes or less is
// a Short, everything else is a long video.
//
//   node video-fit.mjs probe <path-or-https-url>   runs ffprobe, prints the facts
//   node video-fit.mjs decide < {"video": {...}, "connected": {...}, "youtube_long_uploads_cleared": true|false|null}
//
// Output is JSON on stdout. Exit 0 when the video can go somewhere, 1 when
// nothing can take it or the input is bad. `probe` exits 0 with
// status "ffprobe_missing" when ffprobe is not installed, so the agent asks
// the owner for the length and shape instead of guessing.
// No dependencies and no network of its own: Node 18+ only.
import { spawnSync } from 'node:child_process';
import { realpathSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const LIMITS = JSON.parse(readFileSync(path.join(here, '../references/platform-limits.json'), 'utf8'));
export const PLATFORM_ORDER = ['youtube', 'threads', 'x'];

const BYTES_PER_MB = 1024 * 1024;
const round = (value, places = 1) => Math.round(value * 10 ** places) / 10 ** places;

/** "4 min 5 s", "45 s", "1 h 2 min": how a creator would say a length. */
export function sayDuration(seconds) {
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  const out = [];
  if (hours) out.push(`${hours} h`);
  if (minutes) out.push(`${minutes} min`);
  if (rest || !out.length) out.push(`${rest} s`);
  return out.join(' ');
}

/** mp4 or mov from the file name; anything else is null. */
export function containerFromName(name) {
  const extension = path.extname(String(name).split(/[?#]/)[0]).toLowerCase().replace('.', '');
  if (extension === 'mp4' || extension === 'm4v') return 'mp4';
  if (extension === 'mov' || extension === 'qt') return 'mov';
  return null;
}

/** Turn `ffprobe -print_format json -show_format -show_streams` output into plain facts. */
export function factsFromFfprobe(probe, { source, sizeBytes } = {}) {
  const format = probe?.format ?? {};
  const streams = Array.isArray(probe?.streams) ? probe.streams : [];
  const video = streams.find((stream) => stream.codec_type === 'video' && stream.disposition?.attached_pic !== 1);
  if (!video) throw new Error('no video stream found');
  const audio = streams.find((stream) => stream.codec_type === 'audio');
  // Phones store vertical video sideways with a rotation flag. Swap so the
  // width and height match what a viewer sees.
  const rotation = Number(
    video.side_data_list?.find((entry) => entry.rotation !== undefined)?.rotation ?? video.tags?.rotate ?? 0,
  );
  const sideways = Math.abs(rotation) % 180 === 90;
  const width = sideways ? video.height : video.width;
  const height = sideways ? video.width : video.height;
  const bytes = Number(sizeBytes ?? format.size);
  const duration = Number(format.duration ?? video.duration);
  const formatNames = String(format.format_name ?? '').split(',');
  const named = containerFromName(source ?? format.filename ?? '');
  // ffprobe reports MP4 and MOV as one family ("mov,mp4,m4a,..."), so the file
  // name picks between them and ffprobe confirms the family.
  const container = named && (formatNames.includes('mp4') || formatNames.includes('mov')) ? named : null;
  return {
    source: source ?? format.filename ?? null,
    size_mb: Number.isFinite(bytes) ? round(bytes / BYTES_PER_MB, 2) : null,
    duration_seconds: Number.isFinite(duration) ? round(duration, 1) : null,
    width: Number.isFinite(width) ? width : null,
    height: Number.isFinite(height) ? height : null,
    container,
    container_reported: format.format_name ?? null,
    video_codec: video.codec_name ?? null,
    audio_codec: audio?.codec_name ?? null,
  };
}

/** vertical, square or horizontal, from what the viewer sees. */
export function shapeOf({ width, height }) {
  if (!(width > 0) || !(height > 0)) return null;
  if (width === height) return 'square';
  return height > width ? 'vertical' : 'horizontal';
}

/** Vertical or square and 3 minutes or less is a Short; everything else is long. */
export function youtubeFormat(video) {
  const shape = shapeOf(video);
  const rules = LIMITS.youtube_format;
  const short = rules.short_shapes.includes(shape) && video.duration_seconds <= rules.short_max_duration_seconds;
  return {
    format: short ? 'short' : 'long',
    reason: short
      ? `${shape} video of ${sayDuration(video.duration_seconds)} (3 minutes or less), so YouTube format is short`
      : `${shape} video of ${sayDuration(video.duration_seconds)}, so YouTube format is long (a Short must be vertical or square and 3 minutes or less)`,
  };
}

function missingFacts(video) {
  const missing = [];
  if (!(video?.duration_seconds > 0)) missing.push('length in seconds');
  if (!(video?.width > 0) || !(video?.height > 0)) missing.push('shape (width x height)');
  if (!(video?.size_mb > 0)) missing.push('file size in MB');
  // null means "known, and not MP4 or MOV" (a stop); undefined means nobody said.
  if (video?.container === undefined) missing.push('file type (MP4 or MOV)');
  return missing;
}

/**
 * Decide each platform. `connected` says which platforms the brand has
 * connected. `youtube_long_uploads_cleared` is true, false or null (unknown):
 * a channel not cleared for long uploads is held to 15 minutes.
 */
export function decide({ video, connected = {}, youtube_long_uploads_cleared: cleared = null } = {}) {
  const missing = missingFacts(video);
  if (missing.length) {
    return { status: 'ask', ask: missing.map((fact) => `What is the video's ${fact}?`), platforms: {}, kept: [], dropped: [] };
  }
  const contentType = LIMITS.containers[video.container] ?? null;
  const platforms = {};
  for (const id of PLATFORM_ORDER) {
    const limit = LIMITS.platforms[id];
    const drop = (reason) => ({ decision: 'drop', reason });
    if (!connected[id]) {
      platforms[id] = { decision: 'not_connected', reason: `${limit.label} is not connected to this brand` };
    } else if (!contentType) {
      platforms[id] = drop('the file is not an MP4 or MOV; convert it to MP4 first');
    } else if (video.size_mb > LIMITS.storage_max_mb) {
      platforms[id] = drop(`the file is ${video.size_mb} MB and Threadify stores up to ${LIMITS.storage_max_mb} MB (1 GB)`);
    } else if (video.duration_seconds > limit.max_duration_seconds) {
      platforms[id] = drop(`the video is ${sayDuration(video.duration_seconds)} and ${limit.label} takes up to ${sayDuration(limit.max_duration_seconds)}`);
    } else if (limit.uncleared_max_duration_seconds && video.duration_seconds > limit.uncleared_max_duration_seconds && cleared !== true) {
      const held = sayDuration(limit.uncleared_max_duration_seconds);
      platforms[id] = cleared === false
        ? drop(`the video is ${sayDuration(video.duration_seconds)} and this channel is not cleared for long uploads, so ${limit.label} holds it to ${held}`)
        : { decision: 'ask', reason: `the video is ${sayDuration(video.duration_seconds)}; ${limit.label} holds a channel to ${held} until it is cleared for long uploads`, ask: `Is your ${limit.label} channel cleared (verified) for uploads longer than ${held}?` };
    } else {
      platforms[id] = { decision: 'keep', reason: `${sayDuration(video.duration_seconds)} and ${video.size_mb} MB fit ${limit.label}` };
      if (limit.metered) platforms[id].note = 'X is metered: this post counts against your X allowance';
    }
  }
  const pick = (decision) => PLATFORM_ORDER.filter((id) => platforms[id].decision === decision);
  const kept = pick('keep');
  const dropped = pick('drop').map((id) => ({ platform: id, reason: platforms[id].reason }));
  const ask = pick('ask').map((id) => platforms[id].ask);
  const result = {
    status: ask.length ? 'ask' : kept.length ? 'ok' : 'stop',
    content_type: contentType,
    shape: shapeOf(video),
    platforms,
    kept,
    dropped,
    not_connected: pick('not_connected'),
  };
  if (ask.length) result.ask = ask;
  if (platforms.youtube.decision === 'keep') result.youtube = youtubeFormat(video);
  if (result.status === 'stop') {
    result.message = contentType
      ? 'No connected platform can take this video. Nothing was uploaded or scheduled.'
      : 'Only MP4 or MOV video works. Convert the file to MP4, then run this again. Nothing was uploaded or scheduled.';
  }
  return result;
}

/** Run ffprobe on a local path or public URL. Never throws for a missing ffprobe. */
export function probe(source, { run = spawnSync } = {}) {
  const isUrl = /^https:\/\//i.test(source);
  let sizeBytes;
  if (!isUrl) sizeBytes = statSync(source).size;
  const result = run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', source], { encoding: 'utf8' });
  if (result.error?.code === 'ENOENT') {
    return {
      status: 'ffprobe_missing',
      video: { source, size_mb: sizeBytes === undefined ? null : round(sizeBytes / BYTES_PER_MB, 2), container: containerFromName(source) },
      ask: ["How long is the video, in minutes and seconds?", 'Is it vertical, square or horizontal (width x height if you know it)?'],
    };
  }
  if (result.status !== 0) throw new Error(`ffprobe could not read the file: ${String(result.stderr ?? '').trim().split('\n')[0]}`);
  return { status: 'ok', video: factsFromFfprobe(JSON.parse(result.stdout), { source, sizeBytes }) };
}

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return JSON.parse(data);
}

async function main(argv) {
  const [command, source] = argv;
  let result;
  if (command === 'probe' && source) result = probe(source);
  else if (command === 'decide') result = decide(await readStdin());
  else throw new Error('usage: video-fit.mjs probe <path-or-https-url> | decide < input.json');
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status === 'stop') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: 'failed', error: error.message })}\n`);
    process.exitCode = 1;
  });
}
