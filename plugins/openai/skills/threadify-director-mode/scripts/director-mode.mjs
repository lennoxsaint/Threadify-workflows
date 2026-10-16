#!/usr/bin/env node
// Director Mode media mechanics. The agent directs; this script does the cutting.
// Node 18+, no npm packages. Shells out to ffmpeg, ffprobe and whisper-cli.
// The original video is never written to: every output goes to a sibling `director/` folder.
//
//   node director-mode.mjs check [--model <ggml.bin>]
//   node director-mode.mjs transcribe <video> [--out <words.json>] [--model <ggml.bin>]
//   node director-mode.mjs cut-plan <video> --words <words.json> [--out plan.json] [--keep-retake r1,r2]
//   node director-mode.mjs render --plan <plan.json> --out <vN.mp4> [--order <order.json>] [--level N --label Speed]
//   node director-mode.mjs contact-sheet <video> --words <words.json> --out <judge-dir>
//   node director-mode.mjs sfx search "<query>" [--allow-by] [--max-seconds 2]
//   node director-mode.mjs sfx fetch <openverse-id> --dir <director-dir> [--allow-by]
//   node director-mode.mjs captions --words <words.json> --out <captions.ass>
//   node director-mode.mjs mix <video> --cues <cues.json> --words <words.json> --out <mix.wav>
//   node director-mode.mjs finalize <video> --out <final.mp4> [--audio mix.wav] [--captions captions.ass] [--title "..."] [--overlay title.mov]
//   node director-mode.mjs verify --final <final.mp4> --ref <words.json> [--edl <edl.json>]
//
// Every command prints JSON on stdout (the scoreboard line is in `scoreboard`). Exit 1 on failure.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const MAX_GAP = 0.3; // dead air longer than this is cut
export const KEEP_GAP = 0.1; // ...down to this much
export const PAD = 0.05; // room tone kept after speech at every cut (40-80 ms band)
export const LEAD = 0.07; // ...and before speech: soft onsets ("and", "f", "h") start below the silence threshold
export const FPS = 30;
export const SFX_UNDER_LU = 15; // sound effects sit this far under the voice
export const SFX_MIN_UNDER_LU = 12; // verification floor
export const SFX_CACHE_LUFS = -20;
export const SFX_ATTACK = 0.15; // the loud start of a sound may not cover a word onset
export const MAX_FINAL_MB = 95;
const OPENVERSE = 'https://api.openverse.org/v1/audio/';
export const JUDGE_RUBRIC = `# Outside judge: the first 3 seconds

You are judging the first 3 seconds of a short talking-head video. You have only this folder:
first-3s.jpg (6 frames from seconds 0-3), first-3s.txt (the words said in seconds 0-3),
contact-sheet.jpg (one frame per second of the whole video) and transcript.txt (every word with its second).
You know nothing else about the video, its maker or how it was edited. Judge it as a stranger scrolling past.

Score the opening out of 10. Check each of these seven and say pass or fail with a few words of evidence:
1. at most 12 words in the first 3 seconds
2. proof on screen or in the words (a number, a result, something you can see)
3. curiosity: it opens a question the viewer wants answered
4. specificity: concrete, not vague
5. viewer relevance: the viewer can tell why this is for them
6. no preamble (no greeting, no "so", no "in this video")
7. one breath: it reads as one clean sentence

Reply with JSON only:
{"score": <0-10>, "checks": {"words_12": {"pass": true, "why": ""}, "proof": {}, "curiosity": {}, "specificity": {}, "relevance": {}, "no_preamble": {}, "one_breath": {}}, "top_fault": "<the single change that would raise the score most>"}
`;
// Models and the Openverse cache live here; `--home <dir>` moves them (for example for a rehearsal).
let HOME_DIR = path.join(os.homedir(), '.threadify', 'director-mode');
const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/';

// ---------- pure logic (unit tested) ----------

const round = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d;
export const normWord = (w) => String(w).toLowerCase().replace(/[^\p{L}\p{N}']+/gu, '').replace(/^'+|'+$/g, '');
const FILLERS = new Set(['um', 'uh', 'erm', 'er', 'ah', 'hmm', 'mm']);

/** Parse whisper-cli -oj output (-ml 1 -sow: one segment per word) into [{w, start, end}] in seconds. */
export function parseWhisperJson(json) {
  const words = [];
  let inNote = false; // "(keyboard clicking)" and "[ Silence ]" are sound notes, not words
  for (const seg of json.transcription ?? []) {
    const text = String(seg.text ?? '').trim();
    if (!text) continue;
    if (inNote || /^[([*]/.test(text)) {
      inNote = !/[)\]*]$/.test(text);
      continue;
    }
    const start = seg.offsets.from / 1000;
    const end = Math.max(start + 0.02, seg.offsets.to / 1000);
    if (!normWord(text) && words.length) { words[words.length - 1].w += text; continue; } // stray punctuation
    words.push({ w: text, start: round(start), end: round(end) });
  }
  return words;
}

/** Parse ffmpeg silencedetect stderr into [[start, end]]. */
export function parseSilences(stderr, duration) {
  const out = [];
  let open = null;
  for (const line of stderr.split('\n')) {
    const s = line.match(/silence_start: (-?[\d.]+)/);
    const e = line.match(/silence_end: ([\d.]+)/);
    if (s) open = Math.max(0, Number(s[1]));
    if (e && open !== null) { out.push([open, Number(e[1])]); open = null; }
  }
  if (open !== null) out.push([open, duration]);
  return out;
}

const mergeIntervals = (list) => {
  const sorted = list.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const [a, b] of sorted) {
    if (out.length && a <= out[out.length - 1][1]) out[out.length - 1][1] = Math.max(out[out.length - 1][1], b);
    else out.push([a, b]);
  }
  return out;
};

const subtract = (whole, holes) => {
  let parts = [whole];
  for (const [a, b] of holes) {
    parts = parts.flatMap(([x, y]) => (b <= x || a >= y ? [[x, y]] : [[x, a], [b, y]].filter(([p, q]) => q - p > 1e-6)));
  }
  return parts;
};

const snap = ([a, b], fps) => [Math.floor(a * fps + 1e-6) / fps, Math.ceil(b * fps - 1e-6) / fps];

/** Speech islands: the stretches between detected silences. Each island becomes one line the agent can move. */
export function speechIslands(silences, duration, minLength = 0.08) {
  const holes = mergeIntervals(silences.map(([a, b]) => [Math.max(0, a), Math.min(duration, b)]));
  return subtract([0, duration], holes).filter(([a, b]) => b - a >= minLength).map(([a, b]) => ({ start: round(a), end: round(b) }));
}

const lineWords = (line) => line.words.map((x) => normWord(x.w)).filter(Boolean);

function lcsLength(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  }
  return dp[0][0];
}

const shareRun = (a, b, n) => {
  const grams = new Set();
  for (let i = 0; i + n <= a.length; i += 1) grams.add(a.slice(i, i + n).join(' '));
  for (let j = 0; j + n <= b.length; j += 1) if (grams.has(b.slice(j, j + n).join(' '))) return true;
  return false;
};

/**
 * Restarted lines. A line is a retake when one of the next three lines (within 12 s) says the same thing again:
 * they share a run of 3+ words (or the whole of a 2-word line) and at least 30% of the earlier line's words.
 * The last take is kept, so the earlier line is the one cut.
 */
export function findRetakes(lines, { lookahead = 3, maxSeconds = 12, minShare = 0.3 } = {}) {
  const out = [];
  lines.forEach((line, i) => {
    const a = lineWords(line);
    if (a.length < 2) return;
    for (let j = i + 1; j <= Math.min(lines.length - 1, i + lookahead); j += 1) {
      if (lines[j].start - line.end > maxSeconds) break;
      const b = lineWords(lines[j]);
      const run = a.length === 2 ? 2 : 3;
      if (shareRun(a, b, run) && lcsLength(a, b) / a.length >= minShare) {
        out.push({ id: `r${out.length + 1}`, line: i, restart: j, text: line.words.map((x) => x.w).join(' ') });
        return;
      }
    }
  });
  return out;
}

/**
 * Build the Level 1 cut plan from speech islands. Dead air longer than maxGap shrinks to keepGap (a pad of
 * room tone kept on each side of speech, so no word edge is clipped), islands with no words (clicks, breaths)
 * go, filler-only lines go, and retakes go (the last clean take is kept).
 */
export function buildCutPlan({ words, silences, duration, fps = FPS, maxGap = MAX_GAP, keepGap = KEEP_GAP,
  pad = PAD, lead: leadPad = LEAD, keepRetakes = [] }) {
  const p = Math.min(0.08, Math.max(0.04, Math.min(pad, keepGap / 2)));
  const lp = Math.min(0.08, Math.max(0.04, leadPad));
  const islands = speechIslands(silences, duration);
  const assigned = islands.map((island) => ({ ...island, words: [] }));
  for (const x of words) {
    const mid = (x.start + x.end) / 2;
    let best = 0;
    assigned.forEach((island, k) => {
      const dist = (m, s) => (m < s.start ? s.start - m : m > s.end ? m - s.end : 0);
      if (dist(mid, island) < dist(mid, assigned[best])) best = k;
    });
    if (assigned.length) assigned[best].words.push(x);
  }
  let lines = assigned.filter((island) => island.words.some((x) => normWord(x.w)));
  const noiseDropped = assigned.length - lines.length;
  const fillers = lines.filter((l) => lineWords(l).every((t) => FILLERS.has(t))).length;
  lines = lines.filter((l) => !lineWords(l).every((t) => FILLERS.has(t)));
  const retakes = findRetakes(lines).filter((r) => !keepRetakes.includes(r.id));
  const cut = new Set(retakes.map((r) => r.line));
  retakes.forEach((r) => { r.removed = [lines[r.line].start, lines[r.line].end]; delete r.line; delete r.restart; });
  const kept = lines.filter((_, k) => !cut.has(k)).map((line) => ({ ...line, holes: [] }));
  // Restarts inside one breath ("when I say it... when I say it is just one prompt"): the same 4 words
  // again within 20 words. Cut from between the words before the first take to between the words before the restart.
  for (const line of kept) {
    const t = line.words.map((x) => normWord(x.w));
    for (let i = 0; i + 4 <= t.length; i += 1) {
      let j = -1;
      for (let k = i + 4; k + 4 <= t.length && k - i <= 20; k += 1) {
        if (t.slice(k, k + 4).every((x, n) => x && x === t[i + n])) { j = k; break; }
      }
      if (j < 0) continue;
      const w = line.words;
      const a = i > 0 ? (w[i - 1].end + w[i].start) / 2 : -Infinity; // a restart at the line's start drops the whole head
      const b = (w[j - 1].end + w[j].start) / 2;
      if (b > a + 0.1) {
        retakes.push({ id: `r${retakes.length + 1}`, text: w.slice(i, j).map((x) => x.w).join(' '), removed: [round(Number.isFinite(a) ? a : line.start), round(b)], inline: true });
        line.holes.push([a, b]);
        line.words = [...w.slice(0, i), ...w.slice(j)];
        t.splice(i, j - i);
      }
    }
  }
  const inlineVetoed = retakes.filter((r) => r.inline && keepRetakes.includes(r.id));
  if (inlineVetoed.length) throw new Error(`inline retakes can't be kept yet: ${inlineVetoed.map((r) => r.id).join(', ')}`);
  let gapsCut = 0;
  const out = kept.map((line, n) => {
    const prev = kept[n - 1];
    const next = kept[n + 1];
    const before = prev ? line.start - prev.end : line.start;
    const after = next ? next.start - line.end : duration - line.end;
    const lead = before > maxGap ? lp : before / 2;
    const tail = after > maxGap ? p : after / 2;
    if (after > maxGap) gapsCut += 1;
    if (!prev && before > maxGap) gapsCut += 1;
    const segs = subtract([Math.max(0, line.start - lead), Math.min(duration, line.end + tail)], line.holes)
      .map((seg) => snap(seg, fps).map((v) => round(v, 4)));
    return { id: `L${n + 1}`, text: line.words.map((x) => x.w).join(' '), start: line.start, end: line.end,
      words: line.words.map((x) => ({ w: x.w, start: x.start, end: x.end })), segments: segs };
  });
  const planned = out.reduce((sum, l) => sum + l.segments.reduce((s, [a, b]) => s + b - a, 0), 0);
  return { schema: 'director-cut-plan-v1', fps, duration: round(duration), lines: out, retakes,
    stats: { gaps_cut: gapsCut, retakes_cut: retakes.length, noise_cut: noiseDropped, fillers_cut: fillers,
      source_seconds: round(duration, 2), planned_seconds: round(planned, 2) } };
}

/** Resolve an order (["L3", "L1", {"id": "L2", "start_word": 2}]) into source segments. Lines left out are cut. */
export function orderSegments(plan, order, pad = PAD) {
  const ids = order ?? plan.lines.map((l) => l.id);
  const seen = new Set();
  const segments = [];
  for (const item of ids) {
    const spec = typeof item === 'string' ? { id: item } : item;
    const line = plan.lines.find((l) => l.id === spec.id);
    if (!line) throw new Error(`unknown line ${spec.id}`);
    if (seen.has(spec.id)) throw new Error(`line ${spec.id} used twice; move lines, don't repeat them`);
    seen.add(spec.id);
    let segs = line.segments.map((s) => [...s]);
    if (spec.start_word) {
      const w = line.words[spec.start_word];
      if (!w) throw new Error(`${spec.id} has no word ${spec.start_word}`);
      const cut = Math.max(w.start - pad, line.words[spec.start_word - 1].end);
      segs = segs.map(([a, b]) => [Math.max(a, cut), b]).filter(([a, b]) => b - a > 0.04);
    }
    if (spec.end_word !== undefined) {
      const w = line.words[spec.end_word];
      if (!w) throw new Error(`${spec.id} has no word ${spec.end_word}`);
      const nextStart = line.words[spec.end_word + 1]?.start ?? Infinity;
      const cut = Math.min(w.end + pad, nextStart);
      segs = segs.map(([a, b]) => [a, Math.min(b, cut)]).filter(([a, b]) => b - a > 0.04);
    }
    segs = segs.map((s) => snap(s, plan.fps).map((v) => round(v, 4)));
    for (const s of segs) {
      const last = segments[segments.length - 1];
      if (last && Math.abs(last[1] - s[0]) < 1e-3) last[1] = s[1];
      else segments.push(s);
    }
  }
  return segments;
}

/** Map source-time words through an ordered segment list to output time (for captions, cues and checks). */
export function wordsThroughSegments(lines, segments) {
  const all = lines.flatMap((l) => l.words);
  const out = [];
  let t = 0;
  for (const [a, b] of segments) {
    for (const x of all) {
      const mid = (x.start + x.end) / 2;
      if (mid >= a && mid < b) out.push({ w: x.w, start: round(t + Math.max(0, x.start - a)), end: round(t + Math.min(b, x.end) - a) });
    }
    t += b - a;
  }
  return out;
}

/** Caption groups: lowercase, at most 3 words, broken at sentence ends and pauses. */
export function groupCaptions(words, { maxWords = 3, maxPause = 0.5 } = {}) {
  const groups = [];
  let g = [];
  words.forEach((x, k) => {
    const text = x.w.toLowerCase().replace(/[^\p{L}\p{N}'%$&+-]+/gu, '');
    if (text) g.push({ w: text, start: x.start, end: x.end });
    const next = words[k + 1];
    if (g.length && (!next || g.length >= maxWords || /[.?!,;:]$/.test(x.w) || next.start - x.end > maxPause)) { groups.push(g); g = []; }
  });
  return groups;
}

const assTime = (s) => {
  const cs = Math.max(0, Math.round(s * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const sec = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
};

/** Burned word-highlight captions as ASS: the word being said turns accent orange. */
export function captionsAss(words, { accent = '&H004A6BFF', width = 1920, height = 1080 } = {}) {
  const groups = groupCaptions(words);
  const head = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height}\nWrapStyle: 2\n\n[V4+ Styles]\n`
    + 'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n'
    + 'Style: Cap,Arial,84,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,5,0,2,80,80,120,1\n\n'
    + '[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';
  const lines = [];
  groups.forEach((g, gi) => {
    const groupEnd = Math.min(g[g.length - 1].end + 0.15, groups[gi + 1]?.[0].start ?? Infinity);
    g.forEach((x, k) => {
      const end = k + 1 < g.length ? g[k + 1].start : groupEnd;
      if (end <= x.start) return;
      const text = g.map((y, n) => (n === k ? `{\\c${accent}}${y.w}{\\c&H00FFFFFF&}` : y.w)).join(' ');
      lines.push(`Dialogue: 0,${assTime(x.start)},${assTime(end)},Cap,,0,0,0,,${text}`);
    });
  });
  return { ass: head + lines.join('\n') + '\n', groups: groups.length, max_words: Math.max(0, ...groups.map((g) => g.length)) };
}

/** Openverse licence rule: CC0 / public domain always; CC BY only on opt-in; never NC, ND or SA. */
export function licenceAllowed(item, { allowBy = false } = {}) {
  const lic = String(item?.license ?? '').toLowerCase().trim();
  if (/nc|nd|sa/.test(lic.replace(/^cc0$/, ''))) return false;
  if (lic === 'cc0' || lic === 'pdm') return true;
  return allowBy && lic === 'by';
}

export function creditFor(item) {
  const lic = String(item.license ?? '').toLowerCase();
  const entry = { id: item.id, title: item.title ?? 'untitled', creator: item.creator ?? 'unknown',
    licence: lic === 'pdm' ? 'Public Domain Mark' : lic === 'cc0' ? 'CC0 1.0' : `CC ${lic.toUpperCase()} ${item.license_version ?? ''}`.trim(),
    url: item.foreign_landing_url ?? item.landing ?? null, needs_credit: lic === 'by' };
  if (entry.needs_credit) entry.credit_line = `"${entry.title}" by ${entry.creator} (${entry.licence}) ${entry.url}`;
  return entry;
}

/** Gain in dB that puts a sound effect `under` LU below the speech. */
export function sfxGainDb(speechLufs, sfxLufs, under = SFX_UNDER_LU) {
  if (!Number.isFinite(speechLufs) || !Number.isFinite(sfxLufs)) throw new Error('loudness must be a number');
  return round(speechLufs - under - sfxLufs, 2);
}

/** Place a cue so its attack never covers a word onset. Returns the nearest safe time, or null. */
export function placeCue(at, onsets, { attack = SFX_ATTACK, guard = 0.03, search = 0.6, step = 0.01, duration = Infinity } = {}) {
  const clear = (t) => t >= 0 && t + attack <= duration && !onsets.some((o) => o > t - guard && o < t + attack + guard);
  for (let d = 0; d <= search + 1e-9; d += step) {
    if (clear(at - d)) return round(at - d);
    if (clear(at + d)) return round(at + d);
  }
  return null;
}

/** Segment edges that cut through sound louder than the silence threshold (a clipped word shows up here). */
export function hotEdges(levels, segments, thresholdDb, window = 0.02) {
  const loudest = (from, to) => Math.max(-Infinity, ...levels.filter(([t]) => t >= from - 1e-6 && t < to).map(([, db]) => db));
  const hot = [];
  segments.forEach(([a, b], k) => {
    const head = loudest(a, a + window);
    const tail = loudest(b - window, b);
    if (k > 0 && head > thresholdDb) hot.push({ segment: k, edge: 'start', at: a, db: round(head, 1) });
    if (k < segments.length - 1 && tail > thresholdDb) hot.push({ segment: k, edge: 'end', at: b, db: round(tail, 1) });
  });
  return hot;
}

/** Words of `ref` that are missing from `got` (longest-common-subsequence alignment). */
export function diffWords(ref, got) {
  const a = ref.map((x) => normWord(x.w)).filter(Boolean);
  const refKept = ref.filter((x) => normWord(x.w));
  const b = got.map((x) => normWord(x.w)).filter(Boolean);
  const dp = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  }
  const missingIdx = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i += 1; j += 1; } else if (dp[i + 1][j] >= dp[i][j + 1]) { missingIdx.push(i); i += 1; } else j += 1;
  }
  while (i < a.length) { missingIdx.push(i); i += 1; }
  // "any time" heard as "anytime" is the same speech, not a lost word.
  const gotSet = new Set(b);
  const missing = missingIdx.filter((k) => !(gotSet.has(a[k] + (a[k + 1] ?? '')) || gotSet.has((a[k - 1] ?? '') + a[k])))
    .map((k) => refKept[k]);
  return { ref_words: a.length, final_words: b.length, matched: dp[0][0], missing, match_rate: a.length ? round(dp[0][0] / a.length, 3) : 1 };
}

export const scoreboardLine = ({ level, label, changed, seconds, file }) =>
  `L${level} ${label} | ${changed} | ${round(seconds, 1)}s | ${file}`;

/** Bitrate (bits/s) that keeps a video under the size cap with some headroom. */
export function videoBitrate(durationSeconds, { capMb = MAX_FINAL_MB, audioBps = 192000, ceiling = 12_000_000 } = {}) {
  const budget = (capMb * 1_000_000 * 8 * 0.9) / Math.max(1, durationSeconds) - audioBps;
  return Math.max(1_000_000, Math.min(ceiling, Math.floor(budget)));
}

export function pickModel(paths) {
  const rank = ['small.en', 'base.en', 'small', 'base', 'medium.en', 'medium', 'large-v3-turbo', 'large-v3', 'tiny.en', 'tiny'];
  const usable = paths.filter((p) => /ggml-.*\.bin$/.test(p) && !/for-tests/.test(p));
  for (const r of rank) {
    const hit = usable.find((p) => path.basename(p) === `ggml-${r}.bin`);
    if (hit) return hit;
  }
  return usable[0] ?? null;
}

// ---------- side effects ----------

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28, ...opts });
  if (r.error) throw new Error(`${cmd}: ${r.error.message}`);
  if (r.status !== 0 && !opts.allowFail) throw new Error(`${cmd} failed (${r.status}): ${(r.stderr || '').trim().split('\n').slice(-4).join(' | ')}`);
  return r;
}

const which = (bin) => {
  const r = spawnSync('sh', ['-c', `command -v ${bin}`], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
};

export function probe(file) {
  const r = run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate,sample_rate',
    '-of', 'json', file]);
  const j = JSON.parse(r.stdout);
  const v = j.streams.find((s) => s.codec_type === 'video');
  const a = j.streams.find((s) => s.codec_type === 'audio');
  const [n, d] = String(v?.avg_frame_rate ?? '30/1').split('/').map(Number);
  return { duration: Number(j.format.duration), size: Number(j.format.size), video: v ?? null, audio: a ?? null, fps: d ? n / d : FPS };
}

function directorDirFor(video) {
  const dir = path.join(path.dirname(path.resolve(video)), 'director');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function guardOut(out, sources) {
  const resolved = path.resolve(out);
  for (const s of sources) if (s && path.resolve(s) === resolved) throw new Error(`refusing to overwrite the source ${s}`);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  return resolved;
}

function modelCandidates(explicit) {
  const dirs = [path.join(HOME_DIR, 'models'), '/opt/homebrew/share/whisper.cpp', '/usr/local/share/whisper.cpp',
    path.join(os.homedir(), 'whisper.cpp', 'models'), path.join(os.homedir(), '.cache', 'whisper')];
  const found = [];
  if (explicit) found.push(explicit);
  for (const d of dirs) {
    try { for (const f of fs.readdirSync(d)) found.push(path.join(d, f)); } catch { /* not there */ }
  }
  return found.filter((p) => fs.existsSync(p));
}

function findModel(explicit) {
  if (explicit) {
    if (!fs.existsSync(explicit)) throw new Error(`model not found: ${explicit}`);
    return explicit;
  }
  return pickModel(modelCandidates());
}

const downloadHint = (name = 'ggml-base.en.bin') =>
  `mkdir -p "${path.join(HOME_DIR, 'models')}" && curl -L -o "${path.join(HOME_DIR, 'models', name)}" ${MODEL_URL}${name}`;

function cmdCheck(flags) {
  const bins = Object.fromEntries(['ffmpeg', 'ffprobe', 'whisper-cli'].map((b) => [b, which(b)]));
  const filters = bins.ffmpeg ? run('ffmpeg', ['-hide_banner', '-filters']).stdout : '';
  const need = ['ass', 'drawtext', 'loudnorm', 'ebur128', 'tile', 'silencedetect', 'amix', 'adelay'];
  const filterState = Object.fromEntries(need.map((f) => [f, new RegExp(`\\s${f}\\s`).test(filters)]));
  const model = findModel(flags.model);
  const fixes = [];
  if (!bins.ffmpeg || !bins.ffprobe) fixes.push('install ffmpeg (macOS: brew install ffmpeg)');
  if (!bins['whisper-cli']) fixes.push('install whisper.cpp (macOS: brew install whisper-cpp)');
  if (!model) fixes.push(`download a speech model (148 MB): ${downloadHint()}`);
  if (!filterState.ass) fixes.push('ffmpeg lacks libass: captions need it (brew reinstall ffmpeg, or use a build with libass)');
  if (!filterState.drawtext) fixes.push('ffmpeg lacks drawtext: the title card falls back to a HyperFrames overlay or is skipped');
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (nodeMajor < 18) fixes.push('Node 18 or newer is required');
  const ok = Boolean(bins.ffmpeg && bins.ffprobe && bins['whisper-cli'] && model && filterState.ass && nodeMajor >= 18);
  return { ok, bins, filters: filterState, model, node: process.versions.node, fixes };
}

function silencesFor(file, duration) {
  const vol = run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'volumedetect', '-f', 'null', '-']).stderr;
  const mean = Number(vol.match(/mean_volume: (-?[\d.]+) dB/)?.[1] ?? -30);
  const noise = Math.max(-50, Math.min(-28, mean - 14));
  const r = run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', `silencedetect=noise=${noise}dB:d=0.25`, '-f', 'null', '-']);
  return { noise_db: noise, mean_db: mean, silences: parseSilences(r.stderr, duration) };
}

function cmdTranscribe(video, flags) {
  const model = findModel(flags.model);
  if (!model) throw new Error(`no whisper model. ${downloadHint()}`);
  const dir = path.basename(path.dirname(path.resolve(video))) === 'director' ? path.dirname(path.resolve(video)) : directorDirFor(video);
  const base = path.basename(video).replace(/\.[^.]+$/, '');
  const out = guardOut(flags.out ?? path.join(dir, `${base}.words.json`), [video]);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'director-'));
  try {
    const wav = path.join(tmp, 'audio16k.wav');
    run('ffmpeg', ['-v', 'error', '-y', '-i', video, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav]);
    const duration = probe(video).duration;
    const sil = silencesFor(wav, duration);
    // Whisper's word times drift on long audio, so each speech island is transcribed on its own:
    // island edges come from the audio itself and words can't land in the wrong island.
    const islands = speechIslands(sil.silences, duration);
    const clips = islands.map((island, k) => {
      const from = Math.max(0, island.start - 0.1);
      const to = Math.min(duration, island.end + 0.1);
      const file = path.join(tmp, `i${k}.wav`);
      run('ffmpeg', ['-v', 'error', '-y', '-ss', from.toFixed(3), '-t', (to - from).toFixed(3), '-i', wav, '-c:a', 'pcm_s16le', file]);
      return { ...island, from, file };
    });
    const words = [];
    for (let k = 0; k < clips.length; k += 24) {
      const batch = clips.slice(k, k + 24);
      const args = ['-m', model, '-ml', '1', '-sow', '-oj', '-np', '-t', String(Math.min(8, os.cpus().length))];
      if (flags.lang) args.push('-l', flags.lang);
      batch.forEach((c) => args.push('-f', c.file));
      batch.forEach((c) => args.push('-of', c.file.replace(/\.wav$/, '')));
      run('whisper-cli', args);
      for (const c of batch) {
        const json = JSON.parse(fs.readFileSync(c.file.replace(/\.wav$/, '.json'), 'utf8'));
        for (const x of parseWhisperJson(json)) {
          const start = Math.min(c.end, Math.max(c.start, c.from + x.start));
          const end = Math.min(c.end, Math.max(start + 0.02, c.from + x.end));
          words.push({ w: x.w, start: round(start), end: round(end) });
        }
      }
    }
    const doc = { schema: 'director-words-v1', source: path.resolve(video), model: path.basename(model), duration: round(duration), words, ...sil };
    fs.writeFileSync(out, JSON.stringify(doc, null, 2));
    return { out, words: words.length, islands: islands.length, silences: sil.silences.length, model: path.basename(model), text: words.map((x) => x.w).join(' ') };
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

function cmdCutPlan(video, flags) {
  const doc = JSON.parse(fs.readFileSync(flags.words, 'utf8'));
  const info = probe(video);
  const plan = buildCutPlan({ words: doc.words, silences: doc.silences, duration: info.duration, fps: info.fps || FPS,
    keepRetakes: String(flags['keep-retake'] ?? '').split(',').filter(Boolean) });
  plan.source = path.resolve(video);
  plan.noise_db = doc.noise_db;
  const out = guardOut(flags.out ?? path.join(directorDirFor(video), 'plan.json'), [video]);
  fs.writeFileSync(out, JSON.stringify(plan, null, 2));
  return { out, ...plan.stats, retakes: plan.retakes.map((r) => ({ id: r.id, cut: r.text })),
    lines: plan.lines.map((l) => `${l.id} [${l.start}s] ${l.text}`) };
}

function cmdRender(flags) {
  const plan = JSON.parse(fs.readFileSync(flags.plan, 'utf8'));
  const order = flags.order ? JSON.parse(fs.readFileSync(flags.order, 'utf8')) : null;
  const segments = orderSegments(plan, order ? order.order ?? order : null);
  if (!segments.length) throw new Error('nothing to render');
  const out = guardOut(flags.out, [plan.source]);
  const args = ['-v', 'error', '-y'];
  segments.forEach(([a, b]) => args.push('-threads', '2', '-ss', a.toFixed(4), '-t', (b - a).toFixed(4), '-i', plan.source));
  const fade = 'afade=t=in:d=0.006,areverse,afade=t=in:d=0.006,areverse';
  const graph = segments.map((_, k) => `[${k}:v]setpts=PTS-STARTPTS,fps=${FPS}[v${k}];[${k}:a]aresample=48000,asetpts=PTS-STARTPTS,${fade}[a${k}]`).join(';')
    + ';' + segments.map((_, k) => `[v${k}][a${k}]`).join('') + `concat=n=${segments.length}:v=1:a=1[cv][ca];[cv]format=yuv420p[vout]`;
  const graphFile = `${out}.graph.txt`;
  fs.writeFileSync(graphFile, graph);
  args.push('-/filter_complex', graphFile, '-map', '[vout]', '-map', '[ca]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
    '-r', String(FPS), '-fps_mode', 'cfr', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', out);
  const t0 = Date.now();
  run('ffmpeg', args);
  fs.rmSync(graphFile, { force: true });
  const info = probe(out);
  const lineIds = (order ? order.order ?? order : plan.lines.map((l) => l.id)).map((x) => (typeof x === 'string' ? x : x.id));
  const words = wordsThroughSegments(plan.lines, segments);
  let t = 0;
  const joins = segments.slice(0, -1).map(([a, b]) => round((t += b - a)));
  fs.writeFileSync(`${out}.edl.json`, JSON.stringify({ schema: 'director-edl-v1', source: plan.source, noise_db: plan.noise_db, order: lineIds, segments, joins, words }, null, 2));
  const level = flags.level ?? '?';
  const changed = flags.changed ?? (order ? `order ${lineIds.join(' ')}` : `cut ${plan.stats.gaps_cut} gaps, ${plan.stats.retakes_cut} retakes`);
  return { out, edl: `${out}.edl.json`, seconds: round(info.duration, 2), segments: segments.length, render_seconds: round((Date.now() - t0) / 1000, 1),
    scoreboard: scoreboardLine({ level, label: flags.label ?? 'Render', changed, seconds: info.duration, file: path.relative(path.dirname(path.dirname(out)), out) }) };
}

function cmdContactSheet(video, flags) {
  const dir = guardOut(path.join(flags.out, 'x'), [video]) && path.resolve(flags.out);
  const info = probe(video);
  const cols = 6;
  const rows = Math.ceil(Math.min(info.duration, 120) / cols);
  run('ffmpeg', ['-v', 'error', '-y', '-i', video, '-t', '120', '-vf', `fps=1,scale=320:-2,tile=${cols}x${rows}`, '-frames:v', '1', path.join(dir, 'contact-sheet.jpg')]);
  run('ffmpeg', ['-v', 'error', '-y', '-i', video, '-t', '3', '-vf', 'fps=2,scale=480:-2,tile=3x2', '-frames:v', '1', path.join(dir, 'first-3s.jpg')]);
  const words = JSON.parse(fs.readFileSync(flags.words, 'utf8')).words;
  const opening = words.filter((x) => x.start < 3).map((x) => x.w).join(' ');
  const full = words.map((x) => `[${x.start.toFixed(1)}] ${x.w}`).join(' ');
  fs.writeFileSync(path.join(dir, 'first-3s.txt'), `${opening}\n`);
  fs.writeFileSync(path.join(dir, 'transcript.txt'), `${full}\n`);
  fs.writeFileSync(path.join(dir, 'rubric.md'), JUDGE_RUBRIC);
  return { dir, files: ['rubric.md', 'contact-sheet.jpg', 'first-3s.jpg', 'first-3s.txt', 'transcript.txt'], opening, opening_words: opening.split(/\s+/).filter(Boolean).length };
}

// --- Openverse (no key; anonymous limit 20/min and 200/day; page_size above 20 returns 401) ---

function rateState() {
  const file = path.join(HOME_DIR, 'openverse', 'rate.json');
  let calls = [];
  try { calls = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* first call */ }
  return { file, calls: calls.filter((t) => Date.now() - t < 86_400_000) };
}

async function openverseGet(url) {
  const state = rateState();
  if (state.calls.length >= 190) throw new Error('Openverse daily budget reached (200/day anonymous); use cached sounds or try tomorrow');
  const wait = 3200 - (Date.now() - (state.calls[state.calls.length - 1] ?? 0));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  state.calls.push(Date.now());
  fs.mkdirSync(path.dirname(state.file), { recursive: true });
  fs.writeFileSync(state.file, JSON.stringify(state.calls));
  const res = await fetch(url, { headers: { 'User-Agent': 'threadify-director-mode/1.0' } });
  if (!res.ok) throw new Error(`Openverse ${res.status} for ${url}`);
  return res;
}

async function cmdSfxSearch(query, flags) {
  const allowBy = Boolean(flags['allow-by']);
  const maxSeconds = Number(flags['max-seconds'] ?? 2);
  const licences = `cc0,pdm${allowBy ? ',by' : ''}`;
  const url = `${OPENVERSE}?${new URLSearchParams({ q: query, license: licences, page_size: '20', mature: 'false' })}`;
  const cacheFile = path.join(HOME_DIR, 'openverse', `search-${crypto.createHash('sha256').update(url).digest('hex').slice(0, 16)}.json`);
  let data;
  let cached = false;
  try { data = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); cached = true; } catch {
    data = await (await openverseGet(url)).json();
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(data));
  }
  const items = (data.results ?? []).filter((it) => licenceAllowed(it, { allowBy }))
    .filter((it) => it.duration && it.duration / 1000 <= maxSeconds)
    .map((it) => ({ id: it.id, title: it.title, creator: it.creator, license: it.license, license_version: it.license_version,
      seconds: round(it.duration / 1000, 2), url: it.url, foreign_landing_url: it.foreign_landing_url }));
  for (const it of items) {
    const f = path.join(HOME_DIR, 'openverse', 'items', `${it.id}.json`);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify(it));
  }
  return { query, cached, licences, results: items.slice(0, Number(flags.n ?? 8)) };
}

async function cmdSfxFetch(id, flags) {
  if (!/^[\w-]+$/.test(id)) throw new Error('bad Openverse id');
  const dir = path.resolve(flags.dir);
  const sfxDir = path.join(dir, 'sfx');
  fs.mkdirSync(sfxDir, { recursive: true });
  const itemFile = path.join(HOME_DIR, 'openverse', 'items', `${id}.json`);
  let item;
  try { item = JSON.parse(fs.readFileSync(itemFile, 'utf8')); } catch { item = await (await openverseGet(`${OPENVERSE}${id}/`)).json(); }
  if (!licenceAllowed(item, { allowBy: Boolean(flags['allow-by']) })) throw new Error(`refused: licence ${item.license} is not allowed (CC0/PDM, or CC BY with --allow-by)`);
  const cacheWav = path.join(HOME_DIR, 'openverse', 'wav', `${id}.wav`);
  if (!fs.existsSync(cacheWav)) {
    fs.mkdirSync(path.dirname(cacheWav), { recursive: true });
    const res = await openverseGet(item.url);
    const raw = `${cacheWav}.src`;
    fs.writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
    run('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-t', '2', '-af', `loudnorm=I=${SFX_CACHE_LUFS}:TP=-2:LRA=11`, '-ar', '48000', '-ac', '2', cacheWav]);
    fs.rmSync(raw, { force: true });
  }
  const local = path.join(sfxDir, `${id}.wav`);
  fs.copyFileSync(cacheWav, local);
  const creditsFile = path.join(dir, 'credits.json');
  let credits = [];
  try { credits = JSON.parse(fs.readFileSync(creditsFile, 'utf8')); } catch { /* new */ }
  if (!credits.some((c) => c.id === id)) credits.push(creditFor(item));
  fs.writeFileSync(creditsFile, JSON.stringify(credits, null, 2));
  return { file: local, credit: creditFor(item), credits: creditsFile };
}

function cmdCaptions(flags) {
  const src = JSON.parse(fs.readFileSync(flags.words, 'utf8'));
  const res = captionsAss(src.words);
  const out = guardOut(flags.out, []);
  fs.writeFileSync(out, res.ass);
  return { out, groups: res.groups, max_words: res.max_words };
}

export function integratedLufs(file, extra = []) {
  const r = run('ffmpeg', ['-hide_banner', '-nostats', ...extra, '-i', file, '-vn', '-af', 'loudnorm=print_format=json', '-f', 'null', '-']);
  const from = r.stderr.lastIndexOf('{');
  const json = r.stderr.slice(from, r.stderr.indexOf('}', from) + 1);
  return Number(JSON.parse(json).input_i);
}

function maxMomentary(file) {
  const r = run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128', '-f', 'null', '-']);
  const values = [...r.stderr.matchAll(/ M:\s*(-?[\d.]+)/g)].map((m) => Number(m[1])).filter(Number.isFinite);
  return values.length ? Math.max(...values) : -Infinity;
}

function cmdMix(video, flags) {
  const cues = JSON.parse(fs.readFileSync(flags.cues, 'utf8'));
  const list = (cues.cues ?? cues).slice(0, 4);
  if ((cues.cues ?? cues).length > 4) throw new Error('at most 4 sound effects');
  const words = JSON.parse(fs.readFileSync(flags.words, 'utf8')).words;
  const onsets = words.map((x) => x.start);
  const info = probe(video);
  const speech = integratedLufs(video);
  const out = guardOut(flags.out, [video]);
  const placed = [];
  for (const c of list) {
    const file = path.resolve(path.dirname(path.resolve(flags.cues)), c.file);
    const at = placeCue(Number(c.at), onsets, { duration: info.duration });
    if (at === null) { placed.push({ ...c, skipped: 'no gap clear of word onsets nearby' }); continue; }
    const sfxLufs = integratedLufs(file);
    const level = Number.isFinite(sfxLufs) && sfxLufs > -70 ? sfxLufs : SFX_CACHE_LUFS;
    placed.push({ ...c, file, at, moved_ms: Math.round((at - Number(c.at)) * 1000), gain_db: sfxGainDb(speech, level, c.under_lu ?? SFX_UNDER_LU) });
  }
  const used = placed.filter((p) => !p.skipped);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'director-mix-'));
  const bus = path.join(tmp, 'sfx-bus.wav');
  if (used.length) {
    const args = ['-v', 'error', '-y', '-f', 'lavfi', '-t', String(info.duration), '-i', 'anullsrc=r=48000:cl=stereo'];
    used.forEach((p) => args.push('-i', p.file));
    const graph = used.map((p, k) => `[${k + 1}:a]aresample=48000,volume=${p.gain_db}dB,afade=t=out:st=${Math.max(0, (p.max_seconds ?? 1.2) - 0.2)}:d=0.2,atrim=0:${p.max_seconds ?? 1.2},adelay=${Math.round(p.at * 1000)}:all=1[s${k}]`).join(';')
      + `;[0:a]${used.map((_, k) => `[s${k}]`).join('')}amix=inputs=${used.length + 1}:normalize=0:duration=first[bus]`;
    run('ffmpeg', [...args, '-filter_complex', graph, '-map', '[bus]', '-c:a', 'pcm_s16le', bus]);
    run('ffmpeg', ['-v', 'error', '-y', '-i', video, '-i', bus, '-filter_complex', '[0:a]aresample=48000[v];[v][1:a]amix=inputs=2:normalize=0:duration=first[m]',
      '-map', '[m]', '-c:a', 'pcm_s16le', out]);
  } else run('ffmpeg', ['-v', 'error', '-y', '-i', video, '-vn', '-ar', '48000', '-c:a', 'pcm_s16le', out]);
  const sfxMax = used.length ? maxMomentary(bus) : -Infinity;
  fs.rmSync(tmp, { recursive: true, force: true });
  const under = round(speech - sfxMax, 1);
  return { out, speech_lufs: round(speech, 1), sfx_max_momentary_lufs: Number.isFinite(sfxMax) ? round(sfxMax, 1) : null,
    sfx_under_speech_lu: Number.isFinite(under) ? under : null, pass: !used.length || under >= SFX_MIN_UNDER_LU, cues: placed };
}

function fontFile() {
  return ['/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/System/Library/Fonts/Helvetica.ttc', '/Library/Fonts/Arial Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'].find((f) => fs.existsSync(f));
}

function cmdFinalize(video, flags) {
  const out = guardOut(flags.out, [video]);
  const dir = path.dirname(out);
  const info = probe(video);
  const inputs = ['-i', path.resolve(video)];
  let audioMap = '0:a';
  if (flags.audio) { inputs.push('-i', path.resolve(flags.audio)); audioMap = '1:a'; }
  let overlayIndex = null;
  if (flags.overlay) { overlayIndex = inputs.filter((x) => x === '-i').length; inputs.push('-i', path.resolve(flags.overlay)); }
  const chain = ['scale=1920:1080:force_original_aspect_ratio=decrease', 'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0d0d0d', 'setsar=1'];
  const tmpFiles = [];
  if (flags.captions) {
    const name = '.director-captions.ass';
    fs.copyFileSync(path.resolve(flags.captions), path.join(dir, name));
    tmpFiles.push(path.join(dir, name));
    chain.push(`ass=${name}`);
  }
  let title = 'none';
  if (flags.title && overlayIndex === null) {
    const font = fontFile();
    const name = '.director-title.txt';
    fs.writeFileSync(path.join(dir, name), String(flags.title));
    tmpFiles.push(path.join(dir, name));
    chain.push(`drawtext=${font ? `fontfile='${font}':` : ''}textfile=${name}:fontsize=68:fontcolor=white:box=1:boxcolor=0x0d0d0d@0.8:boxborderw=28:`
      + "x=(w-text_w)/2:y=110:enable='between(t,0.15,2.65)':alpha='if(lt(t,0.45),(t-0.15)/0.3,if(gt(t,2.35),(2.65-t)/0.3,1))'");
    title = 'drawtext';
  }
  let graph = `[0:v]${chain.join(',')}[base]`;
  if (overlayIndex !== null) { graph += `;[base][${overlayIndex}:v]overlay=(W-w)/2:0:eof_action=pass[vout]`; title = 'overlay'; } else graph += ';[base]null[vout]';
  const rate = videoBitrate(info.duration);
  const encode = (bps) => run('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', graph, '-map', '[vout]', '-map', audioMap,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-maxrate', String(bps), '-bufsize', String(bps * 2), '-r', String(FPS), '-fps_mode', 'cfr',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out], { cwd: dir });
  try {
    encode(rate);
    if (fs.statSync(out).size > MAX_FINAL_MB * 1_000_000) encode(Math.floor(rate * 0.7));
  } finally { tmpFiles.forEach((f) => fs.rmSync(f, { force: true })); }
  const fin = probe(out);
  return { out, seconds: round(fin.duration, 2), mb: round(fin.size / 1_000_000, 1), width: fin.video?.width, height: fin.video?.height, title,
    scoreboard: scoreboardLine({ level: flags.level ?? 4, label: flags.label ?? 'Range', changed: flags.changed ?? 'captions, sound, title card', seconds: fin.duration, file: path.relative(path.dirname(dir), out) }) };
}

function cmdVerify(flags) {
  const fin = probe(flags.final);
  const decode = run('ffmpeg', ['-v', 'error', '-i', flags.final, '-f', 'null', '-'], { allowFail: true });
  const checks = {
    plays: decode.status === 0 && !decode.stderr.trim(),
    h264_1920x1080: fin.video?.codec_name === 'h264' && fin.video?.width === 1920 && fin.video?.height === 1080,
    fps_30: Math.abs(fin.fps - FPS) < 0.05,
    aac: fin.audio?.codec_name === 'aac',
    under_95mb: fin.size <= MAX_FINAL_MB * 1_000_000,
  };
  const result = { final: flags.final, seconds: round(fin.duration, 2), mb: round(fin.size / 1_000_000, 1), checks };
  if (flags.ref) {
    const t = cmdTranscribe(flags.final, { model: flags.model, out: path.join(path.dirname(path.resolve(flags.final)), 'final.words.json') });
    const ref = JSON.parse(fs.readFileSync(flags.ref, 'utf8')).words;
    const got = JSON.parse(fs.readFileSync(t.out, 'utf8')).words;
    const d = diffWords(ref, got);
    const edl = flags.edl ? JSON.parse(fs.readFileSync(flags.edl, 'utf8')) : { joins: [], segments: [] };
    const near = (x) => edl.joins.some((j) => Math.abs(j - x.start) < 0.4 || Math.abs(j - x.end) < 0.4);
    result.words = { ...d, missing: d.missing.map((x) => ({ w: x.w, at: x.start, near_join: near(x) })) };
    if (edl.segments.length) {
      // Measure the source audio at every cut edge: a quiet edge cannot have clipped a word, so a word the
      // re-transcription missed next to a quiet edge is a transcription difference, not a clip.
      const r = run('ffmpeg', ['-hide_banner', '-nostats', '-i', edl.source, '-vn', '-ac', '1', '-af',
        'aresample=16000,asetnsamples=n=160,astats=metadata=1:reset=1,ametadata=mode=print:key=lavfi.astats.Overall.RMS_level', '-f', 'null', '-']);
      const levels = [];
      let t = null;
      for (const line of r.stderr.split('\n')) {
        const pt = line.match(/pts_time:([\d.]+)/);
        const db = line.match(/RMS_level=(-?[\d.]+|-inf)/);
        if (pt) t = Number(pt[1]);
        if (db && t !== null) levels.push([t, db[1] === '-inf' ? -120 : Number(db[1])]);
      }
      const threshold = Number(flags['threshold-db'] ?? edl.noise_db ?? -40);
      result.hot_edges = hotEdges(levels, edl.segments, threshold);
      result.edge_threshold_db = threshold;
      // A word is clipped when it went missing next to a cut that ran through sound.
      const hotJoins = result.hot_edges.map((h) => edl.joins[h.edge === 'end' ? h.segment : h.segment - 1]);
      result.words.missing.forEach((m) => { m.at_hot_edge = hotJoins.some((j) => Math.abs(j - m.at) < 0.4); });
      checks.no_clipped_words_at_joins = !result.words.missing.some((m) => m.at_hot_edge);
    } else checks.no_clipped_words_at_joins = !result.words.missing.some((m) => m.near_join);
  }
  result.pass = Object.values(checks).every(Boolean);
  return result;
}

function parseFlags(argv) {
  const pos = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) {
      const name = argv[i].slice(2);
      if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) flags[name] = true;
      else { flags[name] = argv[i + 1]; i += 1; }
    } else pos.push(argv[i]);
  }
  return { pos, flags };
}

async function main() {
  const { pos, flags } = parseFlags(process.argv.slice(2));
  if (typeof flags.home === 'string') HOME_DIR = path.resolve(flags.home);
  const [cmd, a, b] = pos;
  const need = (v, name) => { if (!v) throw new Error(`missing ${name}`); return v; };
  const commands = {
    check: () => cmdCheck(flags),
    transcribe: () => cmdTranscribe(need(a, '<video>'), flags),
    'cut-plan': () => cmdCutPlan(need(a, '<video>'), { ...flags, words: need(flags.words, '--words') }),
    render: () => cmdRender({ ...flags, plan: need(flags.plan, '--plan'), out: need(flags.out, '--out') }),
    'contact-sheet': () => cmdContactSheet(need(a, '<video>'), { ...flags, out: need(flags.out, '--out'), words: need(flags.words, '--words') }),
    sfx: () => (a === 'search' ? cmdSfxSearch(need(b, '<query>'), flags) : a === 'fetch' ? cmdSfxFetch(need(b, '<id>'), { ...flags, dir: need(flags.dir, '--dir') }) : Promise.reject(new Error('sfx search|fetch'))),
    captions: () => cmdCaptions({ ...flags, words: need(flags.words, '--words'), out: need(flags.out, '--out') }),
    mix: () => cmdMix(need(a, '<video>'), { ...flags, cues: need(flags.cues, '--cues'), words: need(flags.words, '--words'), out: need(flags.out, '--out') }),
    finalize: () => cmdFinalize(need(a, '<video>'), { ...flags, out: need(flags.out, '--out') }),
    verify: () => cmdVerify({ ...flags, final: need(flags.final, '--final') }),
  };
  if (!commands[cmd]) throw new Error(`usage: director-mode.mjs ${Object.keys(commands).join('|')} ...`);
  const t0 = Date.now();
  const result = await commands[cmd]();
  result.elapsed_seconds = round((Date.now() - t0) / 1000, 1);
  console.log(JSON.stringify(result, null, 2));
  if (result.ok === false || result.pass === false) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  main().catch((error) => { console.error(`director-mode: ${error.message}`); process.exit(1); });
}
