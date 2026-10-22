#!/usr/bin/env node
// Slop Score: the deterministic parts of a blind "human or slop?" test. Five of
// the owner's own Threads posts meet five plain-AI twins on the same topics;
// the owner swipes all ten blind, then every card gets a Slop Score from
// Unslop's scorer (hedge_gate.mjs, copied unchanged from Threadify Unslop).
// The agent makes the MCP calls; this script deals, scores, guards and renders.
//
//   node slop-score.mjs candidates --dir run [--file perf.json] [--now ISO]   (or performance JSON on stdin)
//   node slop-score.mjs deal       --dir run --file cards.json [--seed N] [--now ISO]
//   node slop-score.mjs reveal     --dir run --guesses human,slop,... (10, in card order)
//   node slop-score.mjs fix        --dir run --original original.txt --final final.txt [--keep "Threadify,Claude"]
//   node slop-score.mjs guard      --original original.txt --final final.txt [--keep "..."]
//   node slop-score.mjs plug-check --link <offer link> (--file plug.txt | --text "...")
//   node slop-score.mjs card       --dir run
//
// cards.json: {"handle": "@handle", "posts": [{"id", "topic", "text"}] x5, "twins": [{"topic", "text"}] x5}
// Pure Node 18+, no dependencies and no network. JSON on stdout. Exit 0 on
// success, 1 on usage, FAIL or bad input. Deterministic with --seed and --now.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { scoreText } from './hedge_gate.mjs';
import { checkText } from './casing-guard.mjs';

export const CARDS_PER_SIDE = 5;
export const WINDOW_DAYS = 30;
export const TWIN_LABEL = 'AI twin · plain Claude, no context';
export const OWNER_LABEL = 'your post';
export const TWIN_PROMPT = (topic) => `write a Threads post about ${topic}`;
// Slop Score: every hedge costs 30 points, every other tell 10, capped at 100.
export const SLOP_POINTS = { hedging: 30, corporate: 10, ai_tells: 10, over_formatting: 10 };
export const SLOP_MAX = 100;
export const FAMILY_NAMES = { hedging: 'hedging', ai_tells: 'AI phrases', corporate: 'corporate voice', over_formatting: 'over-formatting' };
export const FAMILY_ORDER = ['hedging', 'ai_tells', 'corporate', 'over_formatting'];
export const PLUG_MIN = 100;
export const PLUG_MAX = 250;
export const SCORE_RULE = "Slop Score: 30 points per hedge, 10 per other AI tell, capped at 100. Scorer: Unslop's four families (hedging, AI phrases, corporate voice, over-formatting).";

const DAY_MS = 24 * 60 * 60 * 1000;
const URL_PATTERN = /https?:\/\/\S+|www\.\S+/giu;
export const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
const normalise = (text) => String(text ?? '').toLowerCase().replace(/[‘’ʼ]/g, "'").replace(/\s+/g, ' ').trim();
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const readJsonIf = (file) => (fs.existsSync(file) ? readJson(file) : null);
const write = (dir, name, value) => {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
  return file;
};
const firstLine = (text) => String(text ?? '').split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? '';
const short = (text, max = 60) => { const line = firstLine(text); return line.length > max ? `${line.slice(0, max - 3)}...` : line; };

// ---------------------------------------------------------------------------
// Scoring: Unslop's scorer, mapped to 0-100.
// ---------------------------------------------------------------------------
/** Slop Score 0-100 plus the exact flagged words per family. */
export function slopScore(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('text must be a non-empty string');
  const { hits, score: weighted } = scoreText(text);
  const flagged = Object.fromEntries(FAMILY_ORDER.map((family) => [family, []]));
  for (const hit of hits) {
    // Over-formatting hits can span a whole line, so they show by name ("em dash", "3 emoji").
    flagged[hit.family].push(hit.family === 'over_formatting' ? hit.marker : hit.phrase.replace(/\s+/g, ' '));
  }
  const points = FAMILY_ORDER.reduce((total, family) => total + flagged[family].length * SLOP_POINTS[family], 0);
  return { slop: Math.min(SLOP_MAX, points), points, unslop_weighted: weighted, hedges: flagged.hedging.length, flagged };
}

/** "hedging: "might", "i think" · AI phrases: "here's the thing"" or "nothing flagged". */
export function flaggedLine(flagged) {
  const parts = FAMILY_ORDER.filter((family) => flagged[family].length)
    .map((family) => `${FAMILY_NAMES[family]}: ${flagged[family].map((phrase) => `"${phrase}"`).join(', ')}`);
  return parts.length ? parts.join(' · ') : 'nothing flagged';
}

// ---------------------------------------------------------------------------
// Candidates: the owner's own posts from the last 30 days, reposts removed.
// ---------------------------------------------------------------------------
export function collectCandidates(performance, { now = new Date().toISOString(), days = WINDOW_DAYS } = {}) {
  const pages = Array.isArray(performance) ? performance : Array.isArray(performance?.performance) ? performance.performance : [performance];
  const cutoff = Date.parse(now) - days * DAY_MS;
  const seenIds = new Set();
  const seenText = new Set();
  const posts = [];
  let skipped = 0;
  for (const page of pages) {
    if (!Array.isArray(page?.posts)) throw new Error('expected read_post_performance results, each with posts');
    for (const row of page.posts) {
      const id = String(row.post_id ?? row.threads_post_id ?? row.id ?? '');
      const text = typeof row.text === 'string' ? row.text : row.text_preview;
      const published = row.published_at ? Date.parse(row.published_at) : NaN;
      const words = normalise(String(text ?? '').replace(URL_PATTERN, ' ')).match(/[\p{L}\p{N}']+/gu) ?? [];
      if (!id || seenIds.has(id) || typeof text !== 'string' || words.length < 5 || (Number.isFinite(published) && published < cutoff) || seenText.has(normalise(text))) { skipped += 1; continue; }
      seenIds.add(id);
      seenText.add(normalise(text));
      posts.push({ id, published_at: row.published_at ?? null, first_line: short(text, 80), chars: [...text].length, text });
    }
  }
  return { status: 'ok', window_days: days, count: posts.length, skipped, enough: posts.length >= CARDS_PER_SIDE, posts };
}

// ---------------------------------------------------------------------------
// Deal: validate the ten cards and shuffle them with a stored seed.
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Same seed, same order: Fisher-Yates over the items as given. */
export function seededShuffle(items, seed) {
  const numeric = Number.isInteger(Number(seed)) ? Number(seed) : parseInt(sha256(String(seed)).slice(0, 8), 16);
  const random = mulberry32(numeric);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The hook used for the reuse check: the first line, or its first five words. */
const hookKeys = (text) => {
  const line = normalise(firstLine(text));
  const words = line.match(/[\p{L}\p{N}']+/gu) ?? [];
  return [`line:${line}`, ...(words.length >= 5 ? [`words:${words.slice(0, 5).join(' ')}`] : [])];
};

/** Pairs of texts that reuse a hook. Empty when every hook is new. */
export function reusedHooks(texts) {
  const seen = new Map();
  const clashes = [];
  texts.forEach((text, index) => {
    for (const hook of hookKeys(text)) {
      if (seen.has(hook) && seen.get(hook) !== index) { clashes.push([seen.get(hook), index]); break; }
      if (!seen.has(hook)) seen.set(hook, index);
    }
  });
  return clashes;
}

export function validateCards(input, { candidates = null } = {}) {
  const errors = [];
  const posts = Array.isArray(input?.posts) ? input.posts : [];
  const twins = Array.isArray(input?.twins) ? input.twins : [];
  if (posts.length !== CARDS_PER_SIDE) errors.push(`need exactly ${CARDS_PER_SIDE} of your posts, got ${posts.length}`);
  if (twins.length !== CARDS_PER_SIDE) errors.push(`need exactly ${CARDS_PER_SIDE} AI twins, got ${twins.length}`);
  for (const [index, card] of [...posts, ...twins].entries()) {
    if (typeof card?.text !== 'string' || !card.text.trim()) errors.push(`card ${index + 1} has no text`);
    if (typeof card?.topic !== 'string' || !card.topic.trim()) errors.push(`card ${index + 1} has no topic`);
  }
  if (errors.length) return errors;
  const topics = posts.map((post) => normalise(post.topic));
  if (new Set(topics).size !== topics.length) errors.push('your 5 posts must cover 5 different topics');
  const twinTopics = twins.map((twin) => normalise(twin.topic));
  if ([...twinTopics].sort().join('\u0000') !== [...topics].sort().join('\u0000')) errors.push('each AI twin must match exactly one of your posts by topic');
  const ids = posts.map((post) => String(post.id ?? ''));
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) errors.push('each of your posts needs its own post id');
  if (candidates) {
    const own = new Map(candidates.posts.map((post) => [post.id, post]));
    for (const post of posts) {
      const known = own.get(String(post.id));
      if (!known) errors.push(`post ${post.id} is not one of your own posts from the last ${candidates.window_days} days`);
      else if (normalise(known.text) !== normalise(post.text)) errors.push(`post ${post.id} text must be your post exactly as Threadify returned it`);
    }
  }
  for (const [a, b] of reusedHooks([...posts, ...twins].map((card) => card.text))) {
    errors.push(`cards ${a + 1} and ${b + 1} share a hook; never reuse a hook in one batch`);
  }
  return errors;
}

export function deal(input, { seed = null, now = new Date().toISOString(), candidates = null } = {}) {
  const errors = validateCards(input, { candidates });
  if (errors.length) return { status: 'FAIL', errors };
  const usedSeed = seed === null || seed === undefined ? crypto.randomInt(1, 2 ** 31) : Number.isInteger(Number(seed)) ? Number(seed) : String(seed);
  const pile = [
    ...input.posts.map((post) => ({ source: 'you', label: OWNER_LABEL, topic: post.topic.trim(), post_id: String(post.id), text: post.text })),
    ...input.twins.map((twin) => ({ source: 'twin', label: TWIN_LABEL, topic: twin.topic.trim(), prompt: TWIN_PROMPT(twin.topic.trim()), text: twin.text })),
  ].map((card, index) => ({ pile_index: index, ...card }));
  const cards = seededShuffle(pile, usedSeed).map((card, index) => ({ n: index + 1, ...card }));
  const deck = { record_type: 'SlopScoreDeckV1', handle: input.handle ?? null, seed: usedSeed, dealt_at: now, cards };
  const deckSha = sha256(JSON.stringify(cards));
  return {
    status: 'ok', deck: { ...deck, deck_sha256: deckSha }, seed: usedSeed, deck_sha256: deckSha,
    blind: cards.map(({ n, text }) => ({ n, text })),
    line: `10 cards shuffled · seed ${usedSeed}. Tap human or slop for each one.`,
  };
}

/** Re-deal from the stored seed and refuse a deck whose order or text no longer matches it. */
export function verifyDeck(deck) {
  if (!Array.isArray(deck?.cards) || deck.seed === undefined) return false;
  const pile = [...deck.cards].sort((a, b) => a.pile_index - b.pile_index).map(({ n, ...card }) => card);
  if (pile.some((card, index) => card.pile_index !== index)) return false;
  const replay = seededShuffle(pile, deck.seed).map((card, index) => ({ n: index + 1, ...card }));
  const sameOrder = JSON.stringify(replay) === JSON.stringify(deck.cards);
  return sameOrder && (!deck.deck_sha256 || deck.deck_sha256 === sha256(JSON.stringify(deck.cards)));
}

// ---------------------------------------------------------------------------
// Reveal: hit rate, a Slop Score per card, averages and the worst twin.
// ---------------------------------------------------------------------------
export function parseGuesses(value) {
  const list = Array.isArray(value) ? value : String(value ?? '').split(/[\s,]+/).filter(Boolean);
  return list.map((guess) => {
    const word = String(guess).toLowerCase();
    if (['human', 'h', 'you', 'real'].includes(word)) return 'human';
    if (['slop', 's', 'ai', 'bot'].includes(word)) return 'slop';
    throw new Error(`guess "${guess}" must be human or slop`);
  });
}

export const isCorrect = (source, guess) => (source === 'you' ? guess === 'human' : guess === 'slop');
const mean = (values) => (values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null);

export function reveal(deck, guessesInput) {
  if (!verifyDeck(deck)) return { status: 'FAIL', errors: ['the deck changed after it was dealt: it no longer matches its seed'] };
  const guesses = parseGuesses(guessesInput);
  if (guesses.length !== deck.cards.length) return { status: 'FAIL', errors: [`need ${deck.cards.length} guesses in card order, got ${guesses.length}`] };
  const cards = deck.cards.map((card, index) => {
    const scored = slopScore(card.text);
    return { n: card.n, source: card.source, label: card.label, topic: card.topic, guess: guesses[index], correct: isCorrect(card.source, guesses[index]), slop: scored.slop, hedges: scored.hedges, flagged: scored.flagged };
  });
  const hits = cards.filter((card) => card.correct).length;
  const yours = cards.filter((card) => card.source === 'you');
  const twins = cards.filter((card) => card.source === 'twin');
  const worst = [...twins].sort((a, b) => b.slop - a.slop || a.n - b.n)[0];
  return {
    status: 'ok', handle: deck.handle, seed: deck.seed, hits, total: cards.length,
    hit_rate: Math.round((hits / cards.length) * 100),
    average: { your_posts: mean(yours.map((card) => card.slop)), ai_twins: mean(twins.map((card) => card.slop)) },
    worst_twin: { n: worst.n, topic: worst.topic, slop: worst.slop, prompt: TWIN_PROMPT(worst.topic) },
    cards,
  };
}

// ---------------------------------------------------------------------------
// Fix: Threadify's post on the worst twin's topic, casing-only, re-scored.
// ---------------------------------------------------------------------------
export function casingGuard(original, final, keep) {
  const a = String(original ?? '');
  const b = String(final ?? '');
  const lowerEqual = a.toLowerCase() === b.toLowerCase();
  const check = checkText(a, b, keep && keep.length ? keep : undefined);
  const status = lowerEqual && check.status === 'PASS' ? 'PASS' : 'FAIL';
  return {
    status, lower_equal: lowerEqual, unchanged: a === b, reasons: check.reasons,
    original_sha256: sha256(a), final_sha256: sha256(b),
    line: `guard: lower(original) == lower(final) ${status}`,
  };
}

export function fix({ deck, revealed, original, final, keep = [] }) {
  const guard = casingGuard(original, final, keep);
  if (guard.status !== 'PASS') {
    return { status: 'FAIL', guard, show: original, line: `${guard.line}. Showing Threadify's original text unchanged.` };
  }
  const clashes = reusedHooks([...deck.cards.map((card) => card.text), final]).filter(([, b]) => b === deck.cards.length);
  const scored = slopScore(final);
  const before = revealed.worst_twin.slop;
  return {
    status: clashes.length ? 'FAIL' : 'ok', guard, topic: revealed.worst_twin.topic,
    before, after: scored.slop, flagged: scored.flagged,
    hook_reused_from: clashes.map(([a]) => deck.cards[a].n),
    ...(clashes.length ? { errors: ['the new post reuses a hook from the deck; ask Threadify for another'] } : {}),
    line: `slop ${before} -> ${scored.slop}`,
    final,
  };
}

// ---------------------------------------------------------------------------
// Auto Plug check: 100-250 characters, ending with the offer's plain link.
// ---------------------------------------------------------------------------
const stripSlash = (url) => url.replace(/\/+$/, '');

export function plugCheck(text, link) {
  const reasons = [];
  const plug = String(text ?? '').trim();
  const target = String(link ?? '').trim();
  const length = [...plug].length;
  if (!target) reasons.push("the offer's link is missing");
  if (length < PLUG_MIN) reasons.push(`too short: ${length} characters (needs ${PLUG_MIN}-${PLUG_MAX})`);
  if (length > PLUG_MAX) reasons.push(`too long: ${length} characters (needs ${PLUG_MIN}-${PLUG_MAX})`);
  const urls = plug.match(URL_PATTERN) ?? [];
  if (urls.some((url) => /[?&]utm_/i.test(url)) || /[?&]utm_/i.test(target)) reasons.push('tracking tags (utm_) found: Threadify tracks its own links, so use the plain link');
  if (target) {
    const last = urls.at(-1) ?? '';
    const endsWithLink = plug.endsWith(target) || (last && stripSlash(last) === stripSlash(target) && plug.endsWith(last));
    if (!endsWithLink) reasons.push(`must end with the offer's link exactly: ${target}`);
    if (urls.some((url) => stripSlash(url) !== stripSlash(target))) reasons.push('only the offer\'s own link may appear');
  }
  if (plug.includes('—')) reasons.push('em dash found: use " - " or "·"');
  const hedges = scoreText(plug).hits.filter((hit) => hit.family === 'hedging').map((hit) => hit.phrase);
  if (hedges.length) reasons.push(`hedges found: ${hedges.map((phrase) => `"${phrase}"`).join(', ')}`);
  return { status: reasons.length ? 'FAIL' : 'PASS', characters: length, reasons, line: `Auto Plug check ${reasons.length ? 'FAIL' : 'PASS'} · ${length} characters` };
}

// ---------------------------------------------------------------------------
// The scored card, as plain chat text (phone-readable: four short columns).
// ---------------------------------------------------------------------------
export function renderCard(revealed, fixed = null) {
  const rows = revealed.cards.map((card) => `| ${card.n} | ${card.source === 'you' ? 'you' : 'AI twin'} | ${card.guess} ${card.correct ? '✓' : '✗'} | ${card.slop} |`);
  const flags = revealed.cards.map((card) => `#${card.n} ${card.label} · ${card.topic} · slop ${card.slop}: ${flaggedLine(card.flagged)}`);
  const lines = [
    `Slop Score · ${revealed.handle ?? '@handle'} · your posts vs plain AI`,
    `You got ${revealed.hits} of ${revealed.total} right.`,
    '',
    '| # | Who wrote it | You said | Slop |',
    '|---|---|---|---|',
    ...rows,
    '',
    'Flagged words',
    ...flags,
    '',
    `Your posts: average slop ${revealed.average.your_posts} · AI twins: average slop ${revealed.average.ai_twins}`,
    `Worst twin: #${revealed.worst_twin.n} · ${revealed.worst_twin.topic} · slop ${revealed.worst_twin.slop}`,
  ];
  if (fixed && fixed.status === 'ok') {
    lines.push(`Fix · Threadify, written from your Brain · ${fixed.topic} · ${fixed.line}`, `Fix flagged words: ${flaggedLine(fixed.flagged)}`);
  }
  lines.push('', SCORE_RULE);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CLI.
// ---------------------------------------------------------------------------
function argValue(args, name, fallback = undefined) {
  const at = args.indexOf(name);
  return at >= 0 && at + 1 < args.length ? args[at + 1] : fallback;
}

async function readStdin() {
  if (process.stdin.isTTY) return '';
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

const readText = (file) => fs.readFileSync(path.resolve(file), 'utf8').replace(/\s+$/u, '');
const keepList = (value) => (value ? String(value).split(',').map((word) => word.trim()).filter(Boolean) : []);

export async function main(argv) {
  const [command, ...args] = argv;
  const dir = path.resolve(argValue(args, '--dir', '.'));
  const now = argValue(args, '--now', new Date().toISOString());
  switch (command) {
    case 'candidates': {
      const file = argValue(args, '--file');
      const input = JSON.parse(file ? fs.readFileSync(path.resolve(file), 'utf8') : await readStdin());
      const result = collectCandidates(input, { now });
      write(dir, 'candidates.json', result);
      return { ...result, posts: result.posts.map(({ text, ...post }) => post) };
    }
    case 'deal': {
      const file = argValue(args, '--file');
      if (!file) return { status: 'usage', usage: 'deal --dir run --file cards.json [--seed N]' };
      const result = deal(readJson(path.resolve(file)), { seed: argValue(args, '--seed', null), now, candidates: readJsonIf(path.join(dir, 'candidates.json')) });
      if (result.status !== 'ok') return result;
      write(dir, 'deck.json', result.deck);
      const { deck, ...shown } = result;
      return shown;
    }
    case 'reveal': {
      const deck = readJsonIf(path.join(dir, 'deck.json'));
      if (!deck) return { status: 'usage', usage: 'run deal first: deck.json is missing' };
      const result = reveal(deck, argValue(args, '--guesses', ''));
      if (result.status !== 'ok') return result;
      write(dir, 'reveal.json', result);
      return { ...result, card: renderCard(result) };
    }
    case 'fix': {
      const deck = readJsonIf(path.join(dir, 'deck.json'));
      const revealed = readJsonIf(path.join(dir, 'reveal.json'));
      const original = argValue(args, '--original');
      const final = argValue(args, '--final', original);
      if (!deck || !revealed || !original) return { status: 'usage', usage: 'fix --dir run --original original.txt --final final.txt (after deal and reveal)' };
      const result = fix({ deck, revealed, original: readText(original), final: readText(final), keep: keepList(argValue(args, '--keep')) });
      write(dir, 'fix.json', result);
      return { ...result, card: result.status === 'ok' ? renderCard(revealed, result) : undefined };
    }
    case 'guard': {
      const original = argValue(args, '--original');
      const final = argValue(args, '--final');
      if (!original || !final) return { status: 'usage', usage: 'guard --original original.txt --final final.txt [--keep "Threadify,Claude"]' };
      return casingGuard(readText(original), readText(final), keepList(argValue(args, '--keep')));
    }
    case 'plug-check': {
      const file = argValue(args, '--file');
      const text = file ? readText(file) : argValue(args, '--text', '');
      return plugCheck(text, argValue(args, '--link', ''));
    }
    case 'card': {
      const revealed = readJsonIf(path.join(dir, 'reveal.json'));
      if (!revealed) return { status: 'usage', usage: 'run reveal first: reveal.json is missing' };
      return { status: 'ok', card: renderCard(revealed, readJsonIf(path.join(dir, 'fix.json'))) };
    }
    default:
      return { status: 'usage', usage: 'slop-score.mjs candidates|deal|reveal|fix|guard|plug-check|card (see the header of this file)' };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    const result = await main(process.argv.slice(2));
    if (result) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result && ['usage', 'FAIL'].includes(result.status) ? 1 : 0;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: 'failed', error: error.message }, null, 2)}\n`);
    process.exitCode = 1;
  }
}
