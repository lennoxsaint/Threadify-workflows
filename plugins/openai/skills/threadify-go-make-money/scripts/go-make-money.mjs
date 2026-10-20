#!/usr/bin/env node
// Go Make Money: the deterministic parts. The agent reads the raw rows through
// Threadify; this script does every number so the model never does sums in its head.
//
//   node go-make-money.mjs goal     --text "go make money: get me to 1,000 paying members by Dec 31" [--current N] [--today YYYY-MM-DD] [--dir run]
//   node go-make-money.mjs funnel   --dir run --attribution <read_link_attribution.json> [--performance <read_post_performance.json>] [--dest your-site.com] [--match text]
//   node go-make-money.mjs page-text --url <public landing page> --out run/page.txt
//   node go-make-money.mjs belief   --dir run --kind page-mismatch --promise promise.txt --page page.txt
//   node go-make-money.mjs belief   --dir run --kind cta-reach --youtube data/youtube.json [--cta-seconds N]
//   node go-make-money.mjs judge    --dir run [--judge auto|codex|claude] [--timeout-sec 240]
//   node go-make-money.mjs short-seller --dir run --file short-seller.json --page page.txt
//   node go-make-money.mjs rank-decisions --dir run --file decisions.json
//   node go-make-money.mjs check-copy --file post.txt [--keep "Claude,Threadify"]
//   node go-make-money.mjs ledger read|save|grade [--ledger file] [--entry entry.json] [--dir run]
//   node go-make-money.mjs report   --dir run
//
// Unknown stays unknown: a number the tools did not return is null and shows as
// UNKNOWN, never 0. No customer names or emails are read or written: only
// aggregates. JSON on stdout. Exit 0 on success, 1 on usage, FAIL or bad input.
// No dependencies: Node 18+ only (fetch is built in).
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const UNKNOWN = 'UNKNOWN';
export const NEEDS_BASELINE = 'needs real baseline';
// A step with fewer people going in than this is a small sample: shown, but not
// named the leak while a bigger step exists.
export const MIN_SAMPLE = 20;
// Rule-of-thumb yardsticks so steps of very different sizes can be compared.
// They are not promises and not benchmarks for any one business.
export const YARDSTICKS = { 'views->clicks': 0.01, 'clicks->signups': 0.05, 'signups->paid': 0.05 };
export const STAGES = [
  { id: 'views', label: 'views on posts with a tracked link' },
  { id: 'clicks', label: 'clicks (unique per link)' },
  { id: 'signups', label: 'signups' },
  { id: 'paid', label: 'paid' },
];

const isNum = (value) => typeof value === 'number' && Number.isFinite(value);
const num = (value) => (isNum(value) ? value : null);
const addKnown = (total, value) => (total === null || value === null ? null : total + value);
const round = (value, places = 2) => (value === null ? null : Math.round(value * 10 ** places) / 10 ** places);
const pct = (rate) => (rate === null ? null : round(rate * 100, 2));
const show = (value) => (value === null || value === undefined ? UNKNOWN : value);
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
/** The word for a count: plural(1, 'signup') is 'signup', plural(2, 'signup') and plural(UNKNOWN, 'signup') are 'signups'. */
export const plural = (count, one, many = `${one}s`) => (count === 1 ? one : many);
// Stage ids as a counted noun: "1 signup", "2 signups".
const STAGE_ONE = { views: 'view', clicks: 'click', signups: 'signup', paid: 'paid' };
const stageWord = (count, id) => (count === 1 ? STAGE_ONE[id] ?? id : id);

// ---------------------------------------------------------------------------
// 1. Goal and pace (altitude).
// ---------------------------------------------------------------------------
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function parseCount(text) {
  const match = String(text).trim().toLowerCase().match(/^(\d[\d,]*(?:\.\d+)?)\s*(k)?$/);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, '')) * (match[2] ? 1000 : 1);
  return Number.isFinite(value) ? Math.round(value) : null;
}

const isoDay = (date) => date.toISOString().slice(0, 10);
const dayUtc = (y, m, d) => {
  const date = new Date(Date.UTC(y, m, d));
  return date.getUTCMonth() === m && date.getUTCDate() === d ? date : null;
};

/** Parse "Dec 31", "31 December 2026", "2026-12-31", "12/31", "end of year" into YYYY-MM-DD. */
export function parseDeadline(text, today) {
  const now = new Date(`${today}T00:00:00Z`);
  const year = now.getUTCFullYear();
  const raw = String(text ?? '').toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, '$1').replace(/[.,]/g, ' ').trim();
  const roll = (m, d, y) => {
    let date = dayUtc(y ?? year, m, d);
    if (date && y === undefined && date < now) date = dayUtc(year + 1, m, d);
    return date ? isoDay(date) : null;
  };
  let m = raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return roll(Number(m[2]) - 1, Number(m[3]), Number(m[1]));
  if (/\bend of (the )?year\b|\bnew year'?s eve\b|\beoy\b/.test(raw)) return roll(11, 31);
  m = raw.match(/\b([a-z]{3})[a-z]*\s+(\d{1,2})(?:\s+(\d{4}))?\b/);
  if (m && MONTHS.includes(m[1])) return roll(MONTHS.indexOf(m[1]), Number(m[2]), m[3] ? Number(m[3]) : undefined);
  m = raw.match(/\b(\d{1,2})\s+([a-z]{3})[a-z]*(?:\s+(\d{4}))?\b/);
  if (m && MONTHS.includes(m[2])) return roll(MONTHS.indexOf(m[2]), Number(m[1]), m[3] ? Number(m[3]) : undefined);
  m = raw.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/);
  if (m) return roll(Number(m[1]) - 1, Number(m[2]), m[3] ? Number(m[3]) : undefined);
  return null;
}

/** "go make money: get me to 1,000 paying members by Dec 31" -> goal, metric, deadline. */
export function parseGoal(text, today) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  const match = clean.match(/\bto\s+(\d[\d,]*(?:\.\d+)?\s*k?)\s+(.+?)\s+(?:by|before)\s+(.+?)\s*[.!]?$/i);
  if (!match) return { status: 'unparsed', goal: null, metric: null, deadline: null, problems: ['say it as: get me to <N> paying <customers/members> by <date>'] };
  const goal = parseCount(match[1]);
  const metric = match[2].toLowerCase();
  const deadline = parseDeadline(match[3], today);
  const problems = [];
  if (!goal) problems.push(`could not read the goal number from "${match[1]}"`);
  if (!deadline) problems.push(`could not read the date from "${match[3]}"`);
  return { status: problems.length ? 'unparsed' : 'ok', goal, metric, deadline, problems };
}

/** required_net_new_per_week = ceil((goal - current) / weeks_left). Unknown baseline stays unknown. */
export function pace({ goal, current, deadline, today }) {
  const days = Math.round((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  const weeksLeft = round(days / 7, 2);
  const base = { goal, deadline, today, days_left: days, weeks_left: weeksLeft };
  if (!isNum(current)) {
    return { ...base, current: UNKNOWN, remaining: UNKNOWN, required_net_new_per_week: UNKNOWN, label: NEEDS_BASELINE,
      line: `Goal ${goal} by ${deadline}: ${weeksLeft} ${plural(weeksLeft, 'week')} left. Current is UNKNOWN (${NEEDS_BASELINE}), so the weekly pace is UNKNOWN.` };
  }
  const remaining = goal - current;
  if (remaining <= 0) return { ...base, current, remaining, required_net_new_per_week: 0, label: 'goal reached', line: `Goal ${goal} reached: current is ${current}.` };
  if (days <= 0) return { ...base, current, remaining, required_net_new_per_week: UNKNOWN, label: 'deadline passed', line: `The deadline ${deadline} has passed with ${remaining} to go.` };
  const perWeek = Math.ceil(remaining / (days / 7));
  return { ...base, current, remaining, required_net_new_per_week: perWeek, label: 'measured baseline',
    line: `${current} now, ${goal} by ${deadline}: ${remaining} to go in ${weeksLeft} ${plural(weeksLeft, 'week')} = ${perWeek} net new per week.` };
}

// ---------------------------------------------------------------------------
// 2. Funnel from raw rows (depth).
// ---------------------------------------------------------------------------
const firstLine = (text) => (typeof text === 'string' ? text.split(/\r?\n/).map((s) => s.trim()).find(Boolean)?.slice(0, 90) ?? null : null);

/** read_post_performance result(s) -> Map(post id -> views). */
export function collectViews(performance) {
  const views = new Map();
  if (!performance) return views;
  for (const result of Array.isArray(performance) ? performance : [performance]) {
    for (const row of result?.posts ?? []) {
      const id = row.post_id ?? row.threads_post_id;
      if (!id) continue;
      views.set(String(id), { views: num((row.metrics ?? row).views), first_line: firstLine(row.text ?? row.text_preview) });
    }
  }
  return views;
}

const destKey = (link) => {
  const url = link.destination_url ?? link.original_url ?? null;
  if (!url) return UNKNOWN;
  try { const u = new URL(url); return `${u.host}${u.pathname.replace(/\/$/, '') || '/'}`; } catch { return url; }
};

/** Build the funnel views -> clicks -> signups -> paid from raw link rows and post rows. */
export function buildFunnel({ attribution, performance = null, match = null, dest = null, yardsticks = YARDSTICKS }) {
  if (!Array.isArray(attribution?.links)) throw new Error('attribution must be a read_link_attribution result with a links array');
  const needle = match ? String(match).toLowerCase() : null;
  const host = dest ? String(dest).toLowerCase() : null;
  const links = attribution.links
    .filter((link) => !host || String(link.destination_url ?? link.original_url ?? '').toLowerCase().includes(host))
    .filter((link) => !needle || [link.destination_url, link.original_url, link.root_post_text, link.tracked_url]
      .some((field) => String(field ?? '').toLowerCase().includes(needle)));
  const tracking = attribution.conversion_tracking ?? null;
  const measurable = tracking ? tracking.measurable !== false : true;
  const posts = collectViews(performance);
  let views = performance ? 0 : null;
  let clicksOnViewed = performance ? 0 : null;
  let clicks = 0;
  let signups = measurable ? 0 : null;
  let paid = measurable ? 0 : null;
  const seenPosts = new Set();
  let viewedPosts = 0;
  const destinations = new Map();
  const rows = [];
  for (const link of links) {
    const unique = num(link.unique_clicks) ?? num(link.clicks);
    const conversions = measurable ? num(link.conversions) : null;
    const sales = measurable ? num(link.sales) : null;
    clicks = addKnown(clicks, unique);
    signups = addKnown(signups, conversions);
    paid = addKnown(paid, sales);
    const postId = String(link.root_threads_post_id ?? link.final_threads_post_id ?? '');
    const post = posts.get(postId) ?? posts.get(String(link.final_threads_post_id ?? ''));
    if (performance && post && post.views !== null) {
      if (!seenPosts.has(postId)) { seenPosts.add(postId); viewedPosts += 1; views += post.views; }
      clicksOnViewed = addKnown(clicksOnViewed, unique);
    }
    const place = destKey(link);
    const dest = destinations.get(place) ?? { destination: place, links: 0, clicks: 0, signups: measurable ? 0 : null, paid: measurable ? 0 : null };
    dest.links += 1; dest.clicks = addKnown(dest.clicks, unique); dest.signups = addKnown(dest.signups, conversions); dest.paid = addKnown(dest.paid, sales);
    destinations.set(place, dest);
    rows.push({ tracked: link.tracked_url ?? null, destination: place, post_first_line: firstLine(link.root_post_text), source_kind: link.source_kind ?? null,
      published_at: link.published_at ?? null, views: post?.views ?? null, clicks: unique, signups: conversions, paid: sales });
  }
  const linkedPosts = new Set(links.map((l) => String(l.root_threads_post_id ?? l.final_threads_post_id ?? '')).filter(Boolean)).size;
  if (performance && viewedPosts === 0) { views = null; clicksOnViewed = null; }
  const counts = { views, clicks, signups, paid };
  // views -> clicks compares like with like: only clicks on posts whose views were read.
  // When that is not every click, say so, so the two click numbers never look like a mismatch.
  const clicksNote = clicksOnViewed !== null && (clicksOnViewed !== clicks || viewedPosts !== linkedPosts)
    ? `${clicksOnViewed} of ${show(clicks)} ${plural(clicks, 'click')} ${clicksOnViewed === 1 ? 'is' : 'are'} on the ${viewedPosts} of ${linkedPosts} linked ${plural(linkedPosts, 'post')} with views`
    : null;
  const steps = [
    { id: 'views->clicks', from: 'views', to: 'clicks', upstream: views, downstream: clicksOnViewed, note: clicksNote },
    { id: 'clicks->signups', from: 'clicks', to: 'signups', upstream: clicks, downstream: signups, note: null },
    { id: 'signups->paid', from: 'signups', to: 'paid', upstream: signups, downstream: paid, note: null },
  ].map((step) => {
    const rate = step.upstream === null || step.downstream === null || step.upstream === 0 ? null : step.downstream / step.upstream;
    const yardstick = yardsticks[step.id] ?? null;
    return { ...step, rate: round(rate, 6), rate_pct: pct(rate), lost: step.upstream === null || step.downstream === null ? null : step.upstream - step.downstream,
      yardstick, vs_yardstick: rate === null || !yardstick ? null : round(rate / yardstick, 4), small_sample: step.upstream !== null && step.upstream < MIN_SAMPLE };
  });
  const leak = pickLeak(steps);
  return {
    window_days: attribution.window_days ?? attribution.days ?? null,
    match: match ?? null,
    destination_filter: dest ?? null,
    links: links.length,
    linked_posts: linkedPosts,
    views_coverage: performance ? { linked_posts_with_views: viewedPosts, linked_posts: linkedPosts } : UNKNOWN,
    conversion_tracking: tracking ? { state: tracking.state ?? null, measurable: tracking.measurable ?? null, last_event_at: tracking.last_event_at ?? null } : UNKNOWN,
    summary_check: attribution.summary ? { tool_unique_clicks: num(attribution.summary.unique_clicks), tool_conversions: num(attribution.summary.conversions), tool_sales: num(attribution.summary.sales) } : null,
    stages: STAGES.map((stage) => ({ ...stage, count: counts[stage.id] })),
    steps,
    leak,
    by_destination: [...destinations.values()].sort((a, b) => (b.clicks ?? 0) - (a.clicks ?? 0)),
    rows: rows.sort((a, b) => (b.clicks ?? 0) - (a.clicks ?? 0)),
  };
}

/** The leak: the step furthest below its yardstick, ignoring small samples while a bigger step exists. Ties go to the later step. */
export function pickLeak(steps) {
  const known = steps.filter((step) => step.vs_yardstick !== null);
  if (!known.length) return { step: null, reason: 'not enough data: every step has an UNKNOWN count' };
  const big = known.filter((step) => !step.small_sample);
  const pool = big.length ? big : known;
  let best = pool[0];
  for (const step of pool.slice(1)) if (step.vs_yardstick <= best.vs_yardstick) best = step;
  const share = Math.round(best.vs_yardstick * 100);
  return {
    step: best.id, from: best.from, to: best.to, upstream: best.upstream, downstream: best.downstream, rate_pct: best.rate_pct, lost: best.lost,
    small_sample: best.small_sample,
    line: `${best.from} -> ${best.to}: ${best.downstream} of ${best.upstream} (${best.rate_pct}%), ${share}% of the ${round(best.yardstick * 100, 2)}% yardstick${best.small_sample ? ' (small sample)' : ''}.${best.note ? ` Note: ${best.note}.` : ''}`,
    note: best.note ?? null,
  };
}

/** The exact rows behind the leak (receipts). Aggregates only. */
export function leakReceipts(funnel, limit = 5) {
  const step = funnel.leak?.step;
  if (!step) return [];
  const rows = [...funnel.rows];
  if (step === 'views->clicks') rows.sort((a, b) => (b.views ?? -1) - (a.views ?? -1));
  if (step === 'signups->paid') rows.sort((a, b) => (b.signups ?? -1) - (a.signups ?? -1));
  return rows.slice(0, limit).map(({ tracked, destination, post_first_line, views, clicks, signups, paid }) => ({ tracked, destination, post_first_line, views, clicks, signups, paid }));
}

// ---------------------------------------------------------------------------
// 3. Landing page text (public page only, no cookies).
// ---------------------------------------------------------------------------
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Decode numeric (&#39; &#x27;) and common named (&amp; &lt; &gt; &quot; &apos; &nbsp;) entities in one pass, so &amp;lt; stays &lt;. */
export function decodeEntities(text) {
  return String(text ?? '').replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (whole, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : Number(body.slice(1));
      const valid = Number.isInteger(code) && code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff);
      return valid ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

export function htmlToText(html) {
  return String(html ?? '')
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/h\d|\/li|\/section|\/a|\/button)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[#a-z0-9]+;/gi, (entity) => decodeEntities(entity))
    .split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------
// 4. Challenge one belief.
// ---------------------------------------------------------------------------
const STOP = new Set(('a about above after again against all also am an and any are as at be because been before being below between both but by can did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its just like me more most my no nor not now of off on once only or other our out over own same she should so some such than that the their them then there these they this those through to too under until up very was we were what when where which while who why will with would you your yours get got make made want need know thing things really still even every much many one two three here\'s it\'s i\'m don\'t can\'t you\'re that\'s what\'s let\'s video watch link below free').split(/\s+/));
const WORDS = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
const stem = (word) => word.toLowerCase().replace(/[’]/g, "'").replace(/'s$/, '').replace(/(ies)$/, 'y').replace(/(?<=[a-z]{3})(es|s)$/, '');

/** The promise's key words (4+ letters, not filler), stemmed and deduped. */
export function keyTerms(text) {
  const terms = [];
  for (const word of String(text ?? '').match(WORDS) ?? []) {
    const lower = word.toLowerCase();
    if (lower.length < 4 || STOP.has(lower) || /^\d+$/.test(lower)) continue;
    const s = stem(lower);
    if (!terms.includes(s)) terms.push(s);
  }
  return terms;
}

export const PAGE_MISMATCH = { supported_below: 0.4, not_supported_from: 0.6, min_terms: 3 };

/** Belief "the link lands on a page that doesn't match what the post/video promised". */
export function testPageMismatch(promise, page) {
  const terms = keyTerms(promise);
  const pageText = String(page ?? '').trim();
  if (!pageText) return { kind: 'page-mismatch', verdict: 'unknown', reason: 'no landing page text was read', terms, found: [], missing: [] };
  if (terms.length < PAGE_MISMATCH.min_terms) return { kind: 'page-mismatch', verdict: 'unknown', reason: `the promise has only ${terms.length} ${plural(terms.length, 'key word')}, too few to test`, terms, found: [], missing: [] };
  const pageWords = new Set((pageText.match(WORDS) ?? []).map(stem));
  const found = terms.filter((t) => pageWords.has(t));
  const missing = terms.filter((t) => !pageWords.has(t));
  const score = round(found.length / terms.length, 2);
  const verdict = score < PAGE_MISMATCH.supported_below ? 'supported' : score >= PAGE_MISMATCH.not_supported_from ? 'not supported' : 'unknown';
  const reason = verdict === 'unknown'
    ? `mixed: the page uses ${found.length} of the promise's ${terms.length} ${plural(terms.length, 'key word')} (${Math.round(score * 100)}%)`
    : `the page uses ${found.length} of the promise's ${terms.length} ${plural(terms.length, 'key word')} (${Math.round(score * 100)}%)`;
  return { kind: 'page-mismatch', verdict, score, reason, terms, found, missing: missing.slice(0, 15) };
}

/** Normalise YouTube analytics rows: an array, {videos: [...]}, or one reader object. */
export function loadVideos(data) {
  const list = Array.isArray(data) ? data : Array.isArray(data?.videos) ? data.videos : data ? [data] : [];
  return list.map((v) => {
    const a = v.analytics ?? {};
    const curve = Array.isArray(v.retention) ? v.retention : Array.isArray(v.retention_curve) ? v.retention_curve
      : v.retention_30s ? [[v.retention_30s.ratio_point, v.retention_30s.audience_watch_ratio]] : [];
    return {
      video_id: v.video_id ?? null, title: v.title ?? null, duration_s: num(v.duration_s ?? v.duration),
      views: num(v.views ?? a.views ?? v.views_public), avg_pct: num(v.average_view_percentage ?? a.averageViewPercentage),
      avg_duration_s: num(v.average_view_duration ?? a.averageViewDuration), cta_seconds: num(v.cta_seconds),
      curve: curve.map((p) => (Array.isArray(p) ? [Number(p[0]), Number(p[1])] : [Number(p.ratio ?? p.elapsedVideoTimeRatio), Number(p.watch_ratio ?? p.audienceWatchRatio)]))
        .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)).sort((p, q) => p[0] - q[0]),
    };
  });
}

/** Share of starters still watching at a point of the video, by straight-line interpolation of the curve. Null outside the curve. */
export function reachAt(curve, ratio) {
  if (!curve.length) return null;
  for (let i = 0; i < curve.length; i += 1) {
    const [x, y] = curve[i];
    if (Math.abs(x - ratio) < 1e-9) return y;
    if (x > ratio) {
      if (i === 0) return null;
      const [x0, y0] = curve[i - 1];
      return y0 + ((y - y0) * (ratio - x0)) / (x - x0);
    }
  }
  return null;
}

/** Belief "people don't get far enough to see the CTA". Needs a CTA time; the curve is strong evidence, the average is weak. */
export function testCtaReach(videos, ctaSeconds = null) {
  const per = videos.map((v) => {
    const cta = ctaSeconds ?? v.cta_seconds;
    const base = { video_id: v.video_id, title: v.title, cta_seconds: show(cta), avg_pct: show(v.avg_pct), avg_duration_s: show(v.avg_duration_s) };
    if (!isNum(cta)) return { ...base, verdict: 'unknown', reason: 'no CTA timestamp for this video' };
    const reach = v.duration_s ? reachAt(v.curve, cta / v.duration_s) : null;
    if (reach !== null) {
      const share = round(reach * 100, 1);
      return { ...base, reach_at_cta_pct: share, strength: 'retention curve', verdict: reach < 0.5 ? 'supported' : 'not supported',
        reason: `${share}% of viewers are still watching at the CTA (${cta} s)` };
    }
    if (isNum(v.avg_duration_s)) {
      return { ...base, strength: 'average only (weak)', verdict: v.avg_duration_s < cta ? 'supported' : 'not supported',
        reason: `the average view lasts ${v.avg_duration_s} s and the CTA is at ${cta} s` };
    }
    return { ...base, verdict: 'unknown', reason: 'no retention curve or average view duration' };
  });
  const known = per.filter((p) => p.verdict !== 'unknown');
  const supported = known.filter((p) => p.verdict === 'supported').length;
  const verdict = !known.length ? 'unknown' : supported * 2 >= known.length ? 'supported' : 'not supported';
  const reason = !known.length ? 'no video has both a CTA timestamp and retention data' : `${supported} of ${known.length} ${plural(known.length, 'video')} with data ${supported === 1 ? 'loses' : 'lose'} most viewers before the CTA`;
  return { kind: 'cta-reach', verdict, reason, videos: per };
}

// ---------------------------------------------------------------------------
// 5. Outside judge: a different model sees the diagnosis and the raw table, not the chat.
// ---------------------------------------------------------------------------
/** "Note on views -> clicks: 247 of 257 clicks are on the 41 of 44 linked posts with views." for every step that carries a note. */
export const stepNotes = (funnel, arrow = '->') => (funnel?.steps ?? []).filter((s) => s.note).map((s) => `Note on ${s.from} ${arrow} ${s.to}: ${s.note}.`);

export function funnelTable(funnel) {
  const lines = ['| stage | count |', '|---|---|', ...funnel.stages.map((s) => `| ${s.label} | ${show(s.count)} |`), '',
    '| step | in | out | rate | yardstick | small sample |', '|---|---|---|---|---|---|',
    ...funnel.steps.map((s) => `| ${s.from} -> ${s.to} | ${show(s.upstream)} | ${show(s.downstream)} | ${s.rate_pct === null ? UNKNOWN : `${s.rate_pct}%`} | ${s.yardstick === null ? '-' : `${round(s.yardstick * 100, 2)}%`} | ${s.small_sample ? 'yes' : 'no'} |`),
    ...stepNotes(funnel).flatMap((line) => ['', line])];
  const dests = funnel.by_destination.slice(0, 8).map((d) => `| ${d.destination} | ${d.links} | ${show(d.clicks)} | ${show(d.signups)} | ${show(d.paid)} |`);
  return [...lines, '', '| destination | links | unique clicks | signups | paid |', '|---|---|---|---|---|', ...dests].join('\n');
}

export function judgePrompt({ goal, funnel, beliefs = [], diagnosis = '' }) {
  return [
    'You are an outside judge. You have not seen the conversation. Check one funnel diagnosis against the raw table below and nothing else.',
    'Do not trust the diagnosis because it is written down. Agree only if the numbers support it. Dispute it if the numbers point to a different leak, if a sample is too small to say, or if the belief verdicts do not follow from the evidence.',
    '',
    `Goal: ${goal?.pace?.line ?? goal?.line ?? UNKNOWN}`,
    '',
    'Raw funnel (computed by a script from per-link and per-post rows):',
    funnelTable(funnel),
    '',
    `Leak named by the script: ${funnel.leak?.line ?? 'none'}`,
    ...beliefs.map((b) => `Belief test (${b.kind}): ${b.verdict}. ${b.reason}.`),
    '',
    `Diagnosis to judge: ${diagnosis || '(none written)'}`,
    '',
    'Reply with JSON only, no other text: {"verdict": "agree" or "dispute", "reasons": ["2 to 4 short reasons, each citing a number from the table"], "biggest_risk": "one line"}',
  ].join('\n');
}

export function judgeCommand(kind, prompt, { lastMessageFile = null } = {}) {
  // -o (--output-last-message) writes only the judge's final message, so log lines never reach raw_reply.
  if (kind === 'codex') return { bin: 'codex', args: ['exec', '-s', 'read-only', '--skip-git-repo-check', ...(lastMessageFile ? ['-o', lastMessageFile] : []), prompt], label: 'Codex (codex exec, read-only sandbox), a different model' };
  return { bin: 'claude', args: ['-p', prompt, '--tools', '', '--strict-mcp-config', '--no-session-persistence', '--output-format', 'json'], label: 'a fresh Claude instance with no prior context (Codex is not installed)' };
}

export function extractVerdict(text) {
  const source = String(text ?? '');
  let found = null;
  for (let i = source.indexOf('{'); i !== -1; i = source.indexOf('{', i + 1)) {
    let depth = 0;
    let inString = false;
    for (let j = i; j < source.length; j += 1) {
      const ch = source[j];
      if (inString) { if (ch === '\\') j += 1; else if (ch === '"') inString = false; } else if (ch === '"') inString = true;
      else if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          try {
            const value = JSON.parse(source.slice(i, j + 1));
            if (value && ['agree', 'dispute'].includes(value.verdict)) found = value;
          } catch { /* not JSON */ }
          break;
        }
      }
    }
  }
  if (!found) return null;
  return { verdict: found.verdict, reasons: Array.isArray(found.reasons) ? found.reasons.map(String) : [], biggest_risk: found.biggest_risk ? String(found.biggest_risk) : null };
}

const stripAnsi = (text) => String(text ?? '').replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\r/g, '');

/** The model codex exec names in its header ("model: gpt-..."), on stdout or stderr, with or without colour codes. */
export function codexModel(...outputs) {
  return (stripAnsi(outputs.join('\n')).match(/^\s*model:\s*(\S+)/m) ?? [])[1] ?? null;
}

const LOG_LINE = /^\s*(?:\d{4}-\d\d-\d\dT\S+\s+(?:ERROR|WARN|INFO|DEBUG|TRACE)\b|hook: |(?:ERROR|WARN|warning):)/;

/** Fallback when no last-message file was written: drop colour codes and log lines, keep the reply. */
export function cleanJudgeOutput(text) {
  return stripAnsi(text).split('\n').filter((line) => !LOG_LINE.test(line)).join('\n').trim();
}

function commandExists(bin) {
  const probe = spawnSync(bin, ['--version'], { stdio: 'ignore', timeout: 10_000 });
  return !probe.error;
}

function runJudge({ bin, args, cwd, timeoutMs, silenceMs }) {
  return new Promise((resolve) => {
    const started = Date.now();
    let child;
    try { child = spawn(bin, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }); } catch (error) { resolve({ code: null, stdout: '', stderr: error.message, killed: 'could not start', ms: 0 }); return; }
    let stdout = '';
    let stderr = '';
    let last = Date.now();
    let killed = null;
    const stop = (why) => { killed = why; child.kill('SIGTERM'); };
    const watchdog = setInterval(() => { if (Date.now() - last > silenceMs) stop(`silent for ${Math.round(silenceMs / 1000)} s`); }, 2000);
    const cap = setTimeout(() => stop(`over the ${Math.round(timeoutMs / 1000)} s limit`), timeoutMs);
    child.stdout.on('data', (chunk) => { last = Date.now(); stdout += chunk; });
    child.stderr.on('data', (chunk) => { last = Date.now(); stderr += chunk; });
    child.on('error', (error) => { stderr += error.message; });
    child.on('close', (code) => { clearInterval(watchdog); clearTimeout(cap); resolve({ code, stdout, stderr, killed, ms: Date.now() - started }); });
  });
}

async function judge(args) {
  const dir = path.resolve(argValue(args, '--dir', '.'));
  const goal = readJsonIf(path.join(dir, 'goal.json'));
  const funnel = readJson(path.join(dir, 'funnel.json'));
  const beliefs = readJsonIf(path.join(dir, 'beliefs.json'))?.tests ?? [];
  const diagnosis = fs.existsSync(path.join(dir, 'diagnosis.txt')) ? fs.readFileSync(path.join(dir, 'diagnosis.txt'), 'utf8').trim() : '';
  const prompt = judgePrompt({ goal, funnel, beliefs, diagnosis });
  fs.writeFileSync(path.join(dir, 'judge-prompt.txt'), prompt);
  const wanted = argValue(args, '--judge', 'auto');
  const kind = wanted === 'auto' ? (commandExists('codex') ? 'codex' : 'claude') : wanted;
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'gmm-judge-'));
  const lastMessageFile = path.join(scratch, 'last-message.txt');
  const command = judgeCommand(kind, prompt, { lastMessageFile });
  const timeoutMs = Number(argValue(args, '--timeout-sec', 240)) * 1000;
  const run = await runJudge({ ...command, cwd: dir, timeoutMs, silenceMs: Math.min(timeoutMs, 150_000) });
  let text = cleanJudgeOutput(run.stdout);
  let model = null;
  if (kind === 'claude') {
    try { const parsed = JSON.parse(run.stdout); text = String(parsed.result ?? ''); model = parsed.model ?? Object.keys(parsed.modelUsage ?? {})[0] ?? null; } catch { /* plain text */ }
  } else {
    model = codexModel(run.stderr, run.stdout);
    const last = fs.existsSync(lastMessageFile) ? fs.readFileSync(lastMessageFile, 'utf8').trim() : '';
    if (last) text = last;
  }
  fs.rmSync(scratch, { recursive: true, force: true });
  const verdict = extractVerdict(text);
  const result = {
    judge: kind, judge_label: command.label, model: model ?? UNKNOWN, seconds: round(run.ms / 1000, 1),
    status: run.killed ? 'silent' : verdict ? 'ok' : 'no_verdict',
    note: run.killed ? `The judge was stopped: ${run.killed}. No verdict; say so on screen.` : verdict ? null : `The judge replied without a readable verdict (exit ${run.code}). Show its reply as is.`,
    ...(verdict ?? { verdict: null, reasons: [], biggest_risk: null }),
    raw_reply: text.slice(-3000),
  };
  fs.writeFileSync(path.join(dir, 'judge.json'), JSON.stringify(result, null, 2));
  return result;
}

// ---------------------------------------------------------------------------
// 6. Short seller and 7. three decisions (checked, not written, by the script).
// ---------------------------------------------------------------------------
const squash = (text) => decodeEntities(text).toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();

/** Exactly 3 claims; each quotes the page word for word and says what would make a buyer doubt it. */
export function checkShortSeller(data, pageText) {
  const claims = Array.isArray(data?.claims) ? data.claims : [];
  const problems = [];
  if (claims.length !== 3) problems.push(`needs exactly 3 claims, got ${claims.length}`);
  const page = squash(pageText);
  const rows = claims.map((c, i) => {
    const quote = String(c.quote ?? '').trim();
    const onPage = Boolean(quote) && page.includes(squash(quote));
    if (!onPage) problems.push(`claim ${i + 1}: the quote is not on the page word for word`);
    if (!String(c.doubt ?? '').trim()) problems.push(`claim ${i + 1}: says nothing about why a buyer would doubt it`);
    if (!String(c.evidence ?? '').trim()) problems.push(`claim ${i + 1}: has no evidence`);
    return { quote, on_page: onPage, doubt: c.doubt ?? null, evidence: c.evidence ?? null };
  });
  return { status: problems.length ? 'FAIL' : 'PASS', problems, claims: rows };
}

const score1to3 = (value) => (Number.isInteger(value) && value >= 1 && value <= 3 ? value : null);

/** Rank 3 decisions by impact on paid conversion x speed x reversibility (each 1-3). */
export function rankDecisions(data) {
  const list = Array.isArray(data?.decisions) ? data.decisions : [];
  const problems = [];
  if (list.length !== 3) problems.push(`needs exactly 3 decisions, got ${list.length}`);
  const ranked = list.map((d, i) => {
    const impact = score1to3(d.impact);
    const speed = score1to3(d.speed);
    const reversibility = score1to3(d.reversibility);
    if ([impact, speed, reversibility].includes(null)) problems.push(`decision ${i + 1}: impact, speed and reversibility must each be 1, 2 or 3`);
    if (!Array.isArray(d.for) || !d.for.length) problems.push(`decision ${i + 1}: needs an argument for`);
    if (!Array.isArray(d.against) || !d.against.length) problems.push(`decision ${i + 1}: needs an argument against`);
    if (!['offer', 'post', 'landing-page-pr', 'other'].includes(d.fix_kind)) problems.push(`decision ${i + 1}: fix_kind must be offer, post, landing-page-pr or other`);
    return { order: i, title: d.title, fix_kind: d.fix_kind, for: d.for ?? [], against: d.against ?? [], impact, speed, reversibility,
      score: impact && speed && reversibility ? impact * speed * reversibility : 0 };
  }).sort((a, b) => b.score - a.score || (b.impact ?? 0) - (a.impact ?? 0) || a.order - b.order)
    .map(({ order, ...rest }, i) => ({ rank: i + 1, ...rest }));
  return { status: problems.length ? 'FAIL' : 'PASS', problems, decisions: ranked, rule: 'score = impact on paid conversion x speed x reversibility (each 1-3); ties: higher impact, then the order given' };
}

// ---------------------------------------------------------------------------
// 8. Public copy guard (with casing-guard.mjs for lower(original) == lower(final)).
// ---------------------------------------------------------------------------
const PROTECTED = /https?:\/\/\S+|www\.\S+|[@#][\p{L}\p{N}_.]+/giu;
export const GUARANTEES = [
  /\bguarantee[ds]?\b/i, /\bguaranteed\b/i, /\brisk[\s-]?free\b/i, /\byou(?:'ll| will)\s+(?:make|earn|get)\s+(?:\$|\d)/i,
  /\b(?:make|earn)\s+\$\s?\d[\d,.]*k?\s+(?:a|per|in|every)\b/i, /\bpassive income\b/i,
];

/** Public copy: no em dashes, lowercase (proper nouns kept), no revenue or customer guarantees, no emails, one CTA link at most. */
export function checkCopy(text, keep = []) {
  const body = String(text ?? '');
  const problems = [];
  if (/[—]/.test(body)) problems.push('has an em dash (—); use a comma, colon or full stop');
  if (/\s–\s/.test(body)) problems.push('has a spaced en dash ( – ); use a comma, colon or full stop');
  const kept = new Set(keep.map(String));
  const unprotected = body.replace(PROTECTED, ' ');
  const capitals = [...new Set((unprotected.match(/[\p{L}\p{N}'’]+/gu) ?? []).filter((w) => w !== w.toLowerCase() && !kept.has(w)))];
  if (capitals.length) problems.push(`not lowercase: ${capitals.slice(0, 8).join(', ')} (add real proper nouns to --keep)`);
  for (const re of GUARANTEES) if (re.test(body)) problems.push(`sounds like a revenue or customer guarantee: "${body.match(re)[0]}"`);
  if (EMAIL.test(body.replace(/https?:\/\/\S+/g, ' '))) problems.push('contains an email address');
  const links = body.match(/https?:\/\/\S+|www\.\S+/gi) ?? [];
  if (links.length > 1) problems.push(`has ${links.length} links; one CTA only`);
  return { status: problems.length ? 'FAIL' : 'PASS', problems, links: links.length, characters: [...body.trim()].length };
}

// ---------------------------------------------------------------------------
// 9. Ledger: make it durable, grade yesterday's fix on the same numbers.
// ---------------------------------------------------------------------------
export const ledgerPath = () => path.join(os.homedir(), '.threadify', 'go-make-money', 'ledger.json');

export function readLedger(file = ledgerPath()) {
  if (!fs.existsSync(file)) return { version: 1, entries: [] };
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { version: 1, entries: Array.isArray(data.entries) ? data.entries : [] };
}

export function validateEntry(entry) {
  const problems = [];
  if (!isNum(entry?.goal?.number) || !entry?.goal?.metric || !entry?.goal?.deadline) problems.push('goal needs number, metric and deadline');
  if (!(isNum(entry?.baseline) || entry?.baseline === UNKNOWN)) problems.push('baseline must be a number or UNKNOWN');
  if (entry?.pace === undefined) problems.push('pace is missing (a number or UNKNOWN)');
  if (!entry?.leak?.step) problems.push('leak.step is missing');
  if (!entry?.decision) problems.push('decision is missing');
  if (!entry?.fix?.kind) problems.push('fix.kind is missing (offer, post, landing-page-pr or none)');
  if (!entry?.date) problems.push('date is missing');
  if (EMAIL.test(JSON.stringify(entry ?? {}))) problems.push('the entry contains an email address; store aggregates only');
  return problems;
}

export function saveEntry(entry, file = ledgerPath()) {
  const problems = validateEntry(entry);
  if (problems.length) return { status: 'FAIL', problems };
  const ledger = readLedger(file);
  ledger.entries.push(entry);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, `${JSON.stringify(ledger, null, 2)}\n`, { mode: 0o600 });
  return { status: 'saved', ledger: file, entries: ledger.entries.length };
}

/** Grade the last saved fix: the same funnel step, before vs now. Attributed, not caused. */
export function gradeLast(ledger, funnel) {
  const last = ledger.entries.at(-1);
  if (!last) return { status: 'no_ledger', line: 'No earlier run: nothing to grade yet.' };
  const step = funnel.steps.find((s) => s.id === last.leak.step);
  const before = isNum(last.leak.rate_pct) ? last.leak.rate_pct : null;
  const now = step?.rate_pct ?? null;
  const base = { status: 'graded', fix: last.fix, decision: last.decision, saved: last.date, step: last.leak.step,
    before: { in: show(last.leak.upstream), out: show(last.leak.downstream), rate_pct: show(before) },
    now: { in: show(step?.upstream ?? null), out: show(step?.downstream ?? null), rate_pct: show(now) } };
  if (before === null || now === null) return { ...base, verdict: 'unknown', line: `${last.leak.step}: before ${show(before)}%, now ${show(now)}%: cannot grade.` };
  const verdict = now > before ? 'improved' : now < before ? 'worse' : 'no change yet';
  const small = step.small_sample ? ' (small sample)' : '';
  return { ...base, verdict, small_sample: step.small_sample,
    line: `${last.leak.step}: ${before}% before the fix, ${now}% now: ${verdict}${small}. Attributed, not caused.` };
}

// ---------------------------------------------------------------------------
// Local HTML report (what goes on camera). Phone-width friendly, big leak card.
// ---------------------------------------------------------------------------
const esc = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (value) => (value === null || value === undefined || value === UNKNOWN ? UNKNOWN : isNum(value) ? value.toLocaleString('en-US') : String(value));
const VERDICT_CLASS = { supported: 'no', 'not supported': 'ok', unknown: 'unk', agree: 'ok', dispute: 'no' };

export function renderReport(run) {
  const { goal, funnel, beliefs, judge: verdict, shortSeller, decisions, fix, grade } = run;
  const notYet = '<p class="muted">Not run yet.</p>';
  const leak = funnel?.leak;
  const leakStep = leak?.step ? funnel.steps.find((s) => s.id === leak.step) : null;
  const stageRows = funnel ? funnel.stages.map((s, i) => {
    const step = funnel.steps[i - 1];
    const isLeak = step && step.id === leak?.step;
    return `<tr class="${isLeak ? 'leakrow' : ''}"><td>${esc(s.label)}</td><td class="n">${esc(fmt(s.count))}</td><td class="n">${step ? (step.rate_pct === null ? UNKNOWN : `${step.rate_pct}%`) : ''}</td></tr>`;
  }).join('') : '';
  const receipts = funnel ? leakReceipts(funnel, 4).map((r) => `<li>${esc(r.post_first_line ?? r.tracked ?? 'link')} <span class="muted">→ ${esc(r.destination)}</span>: ${esc(fmt(r.clicks))} ${plural(r.clicks, 'click')}, ${esc(fmt(r.signups))} ${plural(r.signups, 'signup')}</li>`).join('') : '';
  const beliefCards = (beliefs ?? []).map((b) => `<div class="pill ${VERDICT_CLASS[b.verdict] ?? 'unk'}">${esc(b.kind === 'page-mismatch' ? 'Page matches the promise?' : 'People reach the CTA?')}<b>${esc(b.verdict === 'supported' ? 'your belief: supported' : b.verdict === 'not supported' ? 'your belief: not supported' : 'unknown')}</b><span>${esc(b.reason)}</span>${b.missing?.length ? `<small>missing on the page: ${esc(b.missing.slice(0, 8).join(', '))}</small>` : ''}</div>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Go Make Money report</title><style>
:root{--bg:#0d0d0d;--panel:#1a1a1a;--line:#333;--text:#fff;--muted:rgba(255,255,255,.7);--accent:#ff6b4a;--ok:#4ecdc4;--no:#ff6b4a;--unk:#c9c9c9}
:root[data-theme="light"]{--bg:#fafafa;--panel:#fff;--line:#ddd;--text:#111;--muted:#555}
*{box-sizing:border-box}html,body{max-width:100%;overflow-x:hidden}body{margin:0;background:var(--bg);color:var(--text);font:18px/1.45 system-ui,-apple-system,sans-serif;overflow-wrap:anywhere}
main{max-width:1100px;margin:auto;padding:24px 16px 56px}h1{font-size:clamp(26px,3.4vw,44px);margin:0 0 4px}h2{font-size:clamp(20px,2.2vw,28px);margin:30px 0 10px}.muted{color:var(--muted)}
.goal{font-size:clamp(18px,2vw,26px);background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.leak{background:var(--panel);border:3px solid var(--accent);border-radius:16px;padding:22px 20px;margin:18px 0}
.leak .tag{color:var(--accent);font-weight:800;letter-spacing:.08em;text-transform:uppercase;font-size:clamp(14px,1.4vw,20px)}
.leak .big{font-size:clamp(44px,7.5vw,120px);font-weight:900;line-height:1.02;margin:6px 0}.leak .big small{font-size:.38em;color:var(--muted);font-weight:700;display:block}
.leak .line{font-size:clamp(18px,2vw,28px)}.leak ul{margin:12px 0 0;padding-left:20px;font-size:clamp(15px,1.4vw,20px)}
table{width:100%;border-collapse:collapse;font-size:clamp(16px,1.6vw,22px)}td,th{padding:10px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}td.n{text-align:right;white-space:nowrap}
tr.leakrow td{color:var(--accent);font-weight:800}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:700px){.grid{grid-template-columns:1fr}}
.pill{background:var(--panel);border:2px solid var(--line);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:4px}.pill b{font-size:clamp(20px,2.2vw,30px)}
.pill.ok{border-color:var(--ok)}.pill.ok b{color:var(--ok)}.pill.no{border-color:var(--no)}.pill.no b{color:var(--no)}.pill.unk b{color:var(--unk)}.pill small{color:var(--muted)}
ol.cards{padding:0;list-style:none;display:grid;gap:10px}ol.cards li{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.score{float:right;color:var(--muted);font-size:15px}.for{color:var(--ok)}.against{color:var(--no)}q{font-style:italic}
.foot{color:var(--muted);font-size:14px;margin-top:26px}
</style></head><body><main>
<h1>Go Make Money</h1>
<div class="goal">${goal ? esc(goal.pace?.line ?? '') : 'Goal not set.'}${goal?.pace?.label === NEEDS_BASELINE ? ` <b style="color:var(--accent)">(${NEEDS_BASELINE})</b>` : ''}</div>
${leak?.step ? `<section class="leak"><div class="tag">The leak</div><div class="big">${esc(fmt(leakStep.upstream))} ${esc(stageWord(leakStep.upstream, leak.from))} → ${esc(fmt(leakStep.downstream))} ${esc(stageWord(leakStep.downstream, leak.to))}<small>${esc(leakStep.rate_pct === null ? UNKNOWN : `${leakStep.rate_pct}%`)} make it through${leak.small_sample ? ' (small sample)' : ''}</small></div><div class="line">${esc(leak.line)}</div>${receipts ? `<ul>${receipts}</ul>` : ''}</section>` : '<section class="leak"><div class="tag">The leak</div><div class="line">Not enough data to name a leak yet.</div></section>'}
<h2>Funnel (raw rows${funnel?.window_days ? `, ${esc(funnel.window_days)} days` : ''})</h2>
${funnel ? `<table><thead><tr><th>stage</th><th class="n">count</th><th class="n">from the step above</th></tr></thead><tbody>${stageRows}</tbody></table>${stepNotes(funnel, '→').map((line) => `<p class="muted">${esc(line)}</p>`).join('')}` : notYet}
<h2>Your belief, tested</h2>${beliefCards ? `<div class="grid">${beliefCards}</div>` : notYet}
<h2>Outside judge</h2>${verdict ? `<div class="pill ${VERDICT_CLASS[verdict.verdict] ?? 'unk'}"><span class="muted">${esc(verdict.judge_label)} · ${esc(verdict.model)}</span><b>${esc(verdict.verdict ?? 'no verdict')}</b>${(verdict.reasons ?? []).map((r) => `<span>${esc(r)}</span>`).join('')}${verdict.note ? `<small>${esc(verdict.note)}</small>` : ''}</div>` : notYet}
<h2>The short seller: 3 claims a buyer would doubt</h2>${shortSeller?.claims?.length ? `<ol class="cards">${shortSeller.claims.map((c) => `<li><q>${esc(c.quote)}</q><br>${esc(c.doubt)}<br><span class="muted">${esc(c.evidence)}</span></li>`).join('')}</ol>` : notYet}
<h2>Three decisions</h2>${decisions?.decisions?.length ? `<ol class="cards">${decisions.decisions.map((d) => `<li><span class="score">impact ${d.impact} × speed ${d.speed} × reversible ${d.reversibility} = ${d.score}</span><b>${d.rank}. ${esc(d.title)}</b><br><span class="for">for: ${esc(d.for.join('; '))}</span><br><span class="against">against: ${esc(d.against.join('; '))}</span></li>`).join('')}</ol>` : notYet}
<h2>Fix #1, read back</h2>${fix?.readbacks?.length ? `<ol class="cards">${fix.readbacks.map((r) => `<li><b>${esc(r.what)}</b><br>${esc(r.readback)}${r.url ? `<br><span class="muted">${esc(r.url)}</span>` : ''}</li>`).join('')}</ol>` : notYet}
${grade?.status === 'graded' ? `<h2>Last fix, graded</h2><div class="goal">${esc(grade.line)}</div>` : ''}
<p class="foot">Every number comes from raw Threadify rows (per link, per post) counted by a script. UNKNOWN means the tools did not return it. Clicks and signups are attributed, not caused. No revenue or customer result is promised. ${esc(run.run_at ?? '')}</p>
</main></body></html>
`;
}

// ---------------------------------------------------------------------------
// CLI.
// ---------------------------------------------------------------------------
function argValue(args, name, fallback = undefined) {
  const at = args.indexOf(name);
  return at >= 0 && at + 1 < args.length ? args[at + 1] : fallback;
}
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const readJsonIf = (file) => (fs.existsSync(file) ? readJson(file) : null);
const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const write = (dir, name, value) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, name), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`); return path.join(dir, name); };
// MCP results are saved as returned; accept the bare result or {structuredContent} / {result} wrappers.
const unwrap = (value) => value?.structuredContent ?? value?.result ?? value;

async function main(argv) {
  const [command, ...args] = argv;
  const dir = path.resolve(argValue(args, '--dir', '.'));
  switch (command) {
    case 'goal': {
      const today = argValue(args, '--today', todayLocal());
      const parsed = parseGoal(argValue(args, '--text', ''), today);
      if (parsed.status !== 'ok') return { status: 'fix', ...parsed };
      const currentArg = argValue(args, '--current');
      const current = currentArg === undefined || /^unknown$/i.test(currentArg) ? null : Number(currentArg);
      const result = { status: 'ok', ...parsed, pace: pace({ goal: parsed.goal, current: Number.isFinite(current) ? current : null, deadline: parsed.deadline, today }) };
      if (argValue(args, '--dir')) write(dir, 'goal.json', result);
      return result;
    }
    case 'funnel': {
      const attribution = unwrap(readJson(path.resolve(argValue(args, '--attribution'))));
      const perfFile = argValue(args, '--performance');
      const performance = perfFile ? perfFile.split(',').map((f) => unwrap(readJson(path.resolve(f)))) : null;
      const funnel = buildFunnel({ attribution, performance, match: argValue(args, '--match', null), dest: argValue(args, '--dest', null) });
      funnel.window_days ??= Number(argValue(args, '--days', NaN)) || null;
      write(dir, 'funnel.json', funnel);
      return { status: 'ok', funnel: path.join(dir, 'funnel.json'), stages: funnel.stages, steps: funnel.steps.map(({ id, upstream, downstream, rate_pct, small_sample, note }) => ({ id, in: show(upstream), out: show(downstream), rate_pct: show(rate_pct), small_sample, ...(note ? { note } : {}) })),
        leak: funnel.leak, receipts: leakReceipts(funnel), by_destination: funnel.by_destination.slice(0, 6), summary_check: funnel.summary_check, views_coverage: funnel.views_coverage, table: funnelTable(funnel) };
    }
    case 'page-text': {
      const url = argValue(args, '--url');
      if (!url) return { status: 'usage', usage: 'go-make-money.mjs page-text --url <public page> --out <file>' };
      const response = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (go-make-money; public page read)', accept: 'text/html' } });
      const text = htmlToText(await response.text());
      const out = path.resolve(argValue(args, '--out', path.join(dir, 'page.txt')));
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, `${text}\n`);
      return { status: response.ok ? 'ok' : 'fix', http: response.status, final_url: response.url, out, characters: text.length, first_lines: text.split('\n').slice(0, 8) };
    }
    case 'belief': {
      const kind = argValue(args, '--kind');
      let result;
      if (kind === 'page-mismatch') {
        result = testPageMismatch(fs.readFileSync(path.resolve(argValue(args, '--promise')), 'utf8'), fs.readFileSync(path.resolve(argValue(args, '--page')), 'utf8'));
      } else if (kind === 'cta-reach') {
        const file = argValue(args, '--youtube');
        const cta = argValue(args, '--cta-seconds');
        result = file && fs.existsSync(path.resolve(file))
          ? testCtaReach(loadVideos(readJson(path.resolve(file))), cta === undefined ? null : Number(cta))
          : { kind: 'cta-reach', verdict: 'unknown', reason: 'no YouTube analytics file in data/ (avg % viewed, retention and CTA timestamps)', videos: [] };
      } else return { status: 'usage', usage: 'belief --kind page-mismatch|cta-reach' };
      const saved = readJsonIf(path.join(dir, 'beliefs.json')) ?? { tests: [] };
      saved.tests = [...saved.tests.filter((t) => t.kind !== result.kind), result];
      write(dir, 'beliefs.json', saved);
      return { status: 'ok', ...result };
    }
    case 'judge':
      return judge(args);
    case 'short-seller': {
      const result = checkShortSeller(readJson(path.resolve(argValue(args, '--file'))), fs.readFileSync(path.resolve(argValue(args, '--page')), 'utf8'));
      write(dir, 'short-seller.json', result);
      return result;
    }
    case 'rank-decisions': {
      const result = rankDecisions(readJson(path.resolve(argValue(args, '--file'))));
      write(dir, 'decisions.json', result);
      return result;
    }
    case 'check-copy': {
      const keep = String(argValue(args, '--keep', '')).split(',').map((s) => s.trim()).filter(Boolean);
      return checkCopy(fs.readFileSync(path.resolve(argValue(args, '--file')), 'utf8').trim(), keep);
    }
    case 'ledger': {
      const [action] = args;
      const file = path.resolve(argValue(args, '--ledger', ledgerPath()));
      if (action === 'read') { const ledger = readLedger(file); return { status: ledger.entries.length ? 'ok' : 'empty', ledger: file, entries: ledger.entries.length, last: ledger.entries.at(-1) ?? null }; }
      if (action === 'save') return saveEntry(readJson(path.resolve(argValue(args, '--entry'))), file);
      if (action === 'grade') { const grade = gradeLast(readLedger(file), readJson(path.join(dir, 'funnel.json'))); write(dir, 'grade.json', grade); return grade; }
      return { status: 'usage', usage: 'ledger read|save --entry entry.json|grade --dir run' };
    }
    case 'report': {
      const run = {
        goal: readJsonIf(path.join(dir, 'goal.json')), funnel: readJsonIf(path.join(dir, 'funnel.json')), beliefs: readJsonIf(path.join(dir, 'beliefs.json'))?.tests ?? [],
        judge: readJsonIf(path.join(dir, 'judge.json')), shortSeller: readJsonIf(path.join(dir, 'short-seller.json')), decisions: readJsonIf(path.join(dir, 'decisions.json')),
        fix: readJsonIf(path.join(dir, 'fix.json')), grade: readJsonIf(path.join(dir, 'grade.json')), run_at: new Date().toISOString(),
      };
      return { status: 'ok', report: write(dir, 'report.html', renderReport(run)) };
    }
    default:
      return { status: 'usage', usage: 'go-make-money.mjs goal|funnel|page-text|belief|judge|short-seller|rank-decisions|check-copy|ledger|report (see the header of this file)' };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    const result = await main(process.argv.slice(2));
    if (result) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result && ['usage', 'fix', 'FAIL'].includes(result.status) ? 1 : 0;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: 'failed', error: error.message }, null, 2)}\n`);
    process.exitCode = 1;
  }
}
