#!/usr/bin/env node
// Go Make Money: the deterministic parts. The agent reads the raw rows through
// Threadify; this script does every number so the model never does sums in its head.
//
//   node go-make-money.mjs money    --dir run --attribution <read_link_attribution.json> [--offers <list_offers.json>]
//   node go-make-money.mjs goal     --text "go make money: get me to 1,000 paying members by Dec 31" [--current N] [--today YYYY-MM-DD] [--dir run]
//   node go-make-money.mjs funnel   --dir run --attribution <read_link_attribution.json> [--performance <read_post_performance.json>] [--dest your-site.com] [--match text]
//   node go-make-money.mjs page-text --url <public landing page> --out run/page.txt
//   node go-make-money.mjs belief   --dir run --kind page-mismatch --promise promise.txt --page page.txt
//   node go-make-money.mjs belief   --dir run --kind cta-reach --youtube data/youtube.json [--cta-seconds N]
//   node go-make-money.mjs judge    --dir run [--judge auto|codex|claude] [--timeout-sec 240]
//   node go-make-money.mjs short-seller --dir run --file short-seller.json --page page.txt
//   node go-make-money.mjs rank-decisions --dir run --file decisions.json
//   node go-make-money.mjs check-copy --file post.txt [--keep "Claude,Threadify"] [--channel threads|site]
//   node go-make-money.mjs ledger read|save|grade [--ledger file] [--entry entry.json] [--dir run]
//   node go-make-money.mjs library  --dir run --attribution <read_link_attribution.json> [--limit 5]
//   node go-make-money.mjs report   --dir run
//   node go-make-money.mjs checkin  --dir run --at 2026-10-31T09:00 [--tz Australia/Perth] [--how "Claude scheduled task"] [--prompt text]
//   node go-make-money.mjs celebrate --dir run   (reads reward-input.json, writes reward.html)
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
import { randomUUID } from 'node:crypto';
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
    if (!['offer', 'post', 'page-copy', 'landing-page-pr', 'other'].includes(d.fix_kind)) problems.push(`decision ${i + 1}: fix_kind must be offer, post, page-copy, landing-page-pr or other`);
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
// Outcome counts this small, said in public, tell readers nobody buys. A warning,
// not a FAIL: the agent reframes the line as a discovery or a win instead.
const WEAK_PROOF = /(?<![\w.,])(?:0|1|zero|one|no|only [1-9]\d?)\s+(?:paid|sales?|sign-?ups?|customers?|buyers?|members?|subscribers?|conversions?)\b(?![\s-]+(?:ads?|calls?|pages?|pitch(?:es)?|teams?|tax|funnels?|skills?|experience|emails?|scripts?|copy|decks?|forms?|plans?|tiers?|traffic|media|needed|required)\b)/gi;

// channel "threads" (posts and Auto Plugs) is lowercase with proper nouns kept;
// channel "site" (page and offer copy) keeps the site's own casing.
export function checkCopy(text, keep = [], { channel = 'threads' } = {}) {
  const body = String(text ?? '');
  const problems = [];
  const warnings = [];
  if (/[—]/.test(body)) problems.push('has an em dash (—); use a comma, colon or full stop');
  if (/\s–\s/.test(body)) problems.push('has a spaced en dash ( – ); use a comma, colon or full stop');
  const kept = new Set(keep.map(String));
  const unprotected = body.replace(PROTECTED, ' ');
  const capitals = [...new Set((unprotected.match(/[\p{L}\p{N}'’]+/gu) ?? []).filter((w) => w !== w.toLowerCase() && !kept.has(w)))];
  if (channel !== 'site' && capitals.length) problems.push(`not lowercase: ${capitals.slice(0, 8).join(', ')} (add real proper nouns to --keep)`);
  if (channel !== 'site') for (const hit of new Set(body.match(WEAK_PROOF) ?? [])) warnings.push(`"${hit}" kills social proof in public; frame it as the discovery or the win`);
  for (const re of GUARANTEES) if (re.test(body)) problems.push(`sounds like a revenue or customer guarantee: "${body.match(re)[0]}"`);
  if (EMAIL.test(body)) problems.push('contains an email address');
  const links = body.match(/https?:\/\/\S+|www\.\S+/gi) ?? [];
  if (links.length > 1) problems.push(`has ${links.length} links; one CTA only`);
  return { status: problems.length ? 'FAIL' : 'PASS', channel, problems, warnings, links: links.length, characters: [...body.trim()].length };
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
  if (!entry?.fix?.kind) problems.push('fix.kind is missing (offer, post, page-copy, landing-page-pr or none)');
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
// 1. The money activity: where the owner's money clicks already go.
// ---------------------------------------------------------------------------
const offerUrl = (offer) => offer?.destination_url ?? offer?.url ?? offer?.link ?? offer?.cta_url ?? offer?.landing_page_url ?? null;
const urlKey = (url) => { try { const u = new URL(url); return `${u.host.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '') || '/'}`; } catch { return null; } };

/** Rank where tracked clicks and signups go, and match each place to an existing offer. The agent confirms it with the owner. */
export function moneyActivity({ attribution, offers = null }) {
  if (!Array.isArray(attribution?.links)) throw new Error('attribution must be a read_link_attribution result with a links array');
  const list = Array.isArray(offers) ? offers : offers?.offers ?? [];
  const measurable = attribution.conversion_tracking ? attribution.conversion_tracking.measurable !== false : true;
  const places = new Map();
  let total = 0;
  for (const link of attribution.links) {
    const where = urlKey(link.destination_url ?? link.original_url ?? '') ?? UNKNOWN;
    const unique = num(link.unique_clicks) ?? num(link.clicks) ?? 0;
    total += unique;
    const place = places.get(where) ?? { destination: where, clicks: 0, signups: null, paid: null, links: 0, auto_plug_clicks: 0 };
    const conversions = measurable ? num(link.conversions) : null;
    const sales = measurable ? num(link.sales) : null;
    place.clicks += unique; place.links += 1;
    if (conversions !== null) place.signups = (place.signups ?? 0) + conversions;
    if (sales !== null) place.paid = (place.paid ?? 0) + sales;
    if (link.source_kind === 'auto_plug') place.auto_plug_clicks += unique;
    places.set(where, place);
  }
  const ranked = [...places.values()].sort((a, b) => (b.paid ?? 0) - (a.paid ?? 0) || b.clicks - a.clicks || (b.signups ?? 0) - (a.signups ?? 0)).map((place) => {
    const host = place.destination.split('/')[0];
    const offer = list.find((o) => urlKey(offerUrl(o) ?? '') === place.destination) ?? list.find((o) => (urlKey(offerUrl(o) ?? '') ?? '').split('/')[0] === host) ?? null;
    return { ...place, share_pct: total ? round((place.clicks / total) * 100, 1) : null, offer: offer ? { name: offer.name ?? offer.title ?? null, destination: offerUrl(offer) } : null };
  });
  const top = ranked[0] ?? null;
  return {
    total_clicks: total, places: ranked.slice(0, 6), offers: list.map((o) => ({ name: o.name ?? o.title ?? null, destination: offerUrl(o) })),
    line: top ? `Your money activity looks like: ${top.offer?.name ? `the "${top.offer.name}" offer at ` : ''}${top.destination}, with ${top.clicks} of ${total} tracked ${plural(total, 'click')} (${top.share_pct}%), ${top.signups === null ? 'signups unknown' : `${top.signups} ${plural(top.signups, 'signup')}`} and ${top.paid === null ? 'paid unknown' : `${top.paid} paid`}.` : 'No tracked clicks yet: ask the owner what they sell and where.',
  };
}

// ---------------------------------------------------------------------------
// 9. Libraries: the owner's own proven posts and plugs, ranked by clicks.
// ---------------------------------------------------------------------------
/** Root posts ranked by the tracked clicks they earned, plus the plug replies to read (get_post_thread) for the CTA library. */
export function buildLibrary({ attribution, limit = 5 }) {
  if (!Array.isArray(attribution?.links)) throw new Error('attribution must be a read_link_attribution result with a links array');
  const roots = new Map();
  const plugs = new Map();
  for (const link of attribution.links) {
    const id = String(link.root_threads_post_id ?? link.final_threads_post_id ?? '');
    if (!id) continue;
    const root = roots.get(id) ?? { root_post_id: id, text: link.root_post_text ?? null, clicks: 0, signups: 0, destinations: [] };
    const clicks = num(link.unique_clicks) ?? num(link.clicks) ?? 0;
    const signups = num(link.conversions) ?? 0;
    root.clicks += clicks;
    root.signups += signups;
    if (link.source_kind === 'auto_plug' && link.final_threads_post_id) {
      const plugId = String(link.final_threads_post_id);
      const plug = plugs.get(plugId) ?? { plug_post_id: plugId, root_post_id: id, clicks: 0, signups: 0 };
      plug.clicks += clicks;
      plug.signups += signups;
      plugs.set(plugId, plug);
    }
    const place = urlKey(link.destination_url ?? link.original_url ?? '');
    if (place && !root.destinations.includes(place)) root.destinations.push(place);
    roots.set(id, root);
  }
  const ranked = [...roots.values()].sort((a, b) => b.clicks - a.clicks || b.signups - a.signups);
  return {
    posts_by_clicks: ranked.slice(0, limit).map((r) => ({ root_post_id: r.root_post_id, clicks: r.clicks, signups: r.signups, text: r.text, destinations: r.destinations })),
    plugs_to_read: [...plugs.values()].sort((a, b) => b.clicks - a.clicks || b.signups - a.signups).slice(0, limit)
      .map((plug) => ({ plug_post_id: plug.plug_post_id, root_post_id: plug.root_post_id, plug_clicks: plug.clicks, plug_signups: plug.signups, root_first_line: firstLine(roots.get(plug.root_post_id)?.text) })),
    rule: 'templateize the WHOLE post (every line\'s job), not just the hook; the plug library ranks each Auto Plug by the clicks it earned itself',
  };
}

// ---------------------------------------------------------------------------
// 11. Why it is a big deal: the leak at its rule-of-thumb yardstick. Not a promise.
// ---------------------------------------------------------------------------
export function upside(funnel) {
  const leak = funnel?.leak;
  const step = leak?.step ? funnel.steps.find((s) => s.id === leak.step) : null;
  if (!step || !isNum(step.upstream) || !isNum(step.downstream) || !step.yardstick) return null;
  const atYardstick = Math.floor(step.upstream * step.yardstick);
  if (atYardstick <= step.downstream) return null;
  return { step: step.id, upstream: step.upstream, now: step.downstream, at_yardstick: atYardstick, yardstick_pct: round(step.yardstick * 100, 2), from: step.from, to: step.to,
    line: `The same ${step.upstream} ${stageWord(step.upstream, step.from)} at the ${round(step.yardstick * 100, 2)}% rule of thumb would be ${atYardstick} ${stageWord(atYardstick, step.to)}, not ${step.downstream}. A yardstick, not a promise.` };
}

// ---------------------------------------------------------------------------
// 12. The check-in: a calendar reminder any host can open (the fallback when the
// host has no native scheduler). Nothing is sent anywhere.
// ---------------------------------------------------------------------------
const icsText = (text) => String(text).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
// RFC 5545 content lines are at most 75 octets; longer ones continue on a line that starts with a space.
const icsFold = (line) => {
  const parts = [];
  let current = '';
  let octets = 0;
  for (const ch of line) {
    const size = Buffer.byteLength(ch);
    if (octets + size > (parts.length ? 74 : 75)) { parts.push(current); current = ''; octets = 0; }
    current += ch;
    octets += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
};

export function checkinIcs({ at, prompt, tz = null, uid = null, title = 'Go Make Money check-in with Claude' }) {
  const match = String(at ?? '').match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::(\d\d))?$/);
  if (!match) throw new Error('--at must be a local date-time like 2026-10-31T09:00');
  const [y, mo, d, h, mi, sec = '00'] = match.slice(1);
  const probe = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi));
  if (probe.getUTCFullYear() !== +y || probe.getUTCMonth() !== +mo - 1 || probe.getUTCDate() !== +d || probe.getUTCHours() !== +h || probe.getUTCMinutes() !== +mi || +sec > 59) {
    throw new Error('--at must be a real local date-time like 2026-10-31T09:00');
  }
  if (tz) { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); } catch { throw new Error('--tz must be a timezone name like Australia/Perth'); } }
  const start = `${y}${mo}${d}T${h}${mi}${sec}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const dt = tz ? `DTSTART;TZID=${tz}:${start}` : `DTSTART:${start}`;
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Threadify Workflows//Go Make Money//EN', 'BEGIN:VEVENT', `UID:${uid ?? `gmm-checkin-${randomUUID()}`}@threadify-workflows`, `DTSTAMP:${stamp}`, dt,
    'DURATION:PT15M', `SUMMARY:${icsText(title)}`, `DESCRIPTION:${icsText(`Open Claude and paste:\n${prompt}`)}`, 'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(title)}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR']
    .map(icsFold).join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------------------
// Local HTML report (what goes on camera). Phone-width friendly, big leak card.
// ---------------------------------------------------------------------------
const esc =(text) => String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
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
// The reward page: the celebration at the end of a run. Threadify-branded, fun,
// and useful: what was done, why, why it is a big deal, the next step, the value,
// the check-in and a star for the repo. Every number comes from the run files.
// ---------------------------------------------------------------------------
export const REPO_URL = 'https://github.com/lennoxsaint/Threadify-workflows';
export const THREADIFY_URL = 'https://www.threadify.app/home?utm_source=threadify-workflows&utm_medium=reward-page&utm_campaign=go-make-money&utm_content=reward__go_make_money__open_threadify';

export function renderReward(run) {
  const { goal, funnel, beliefs = [], judge: verdict, shortSeller, fix, checkin, reward = {}, grade } = run;
  const leak = funnel?.leak?.step ? funnel.steps.find((s) => s.id === funnel.leak.step) : null;
  const gain = upside(funnel);
  const p = goal?.pace ?? null;
  const progress = p && isNum(p.current) && isNum(p.goal) && p.goal > 0 ? Math.min(100, round((p.current / p.goal) * 100, 1)) : null;
  const shipped = (reward.what?.length ? reward.what : (fix?.readbacks ?? []).map((r) => `${r.what}: ${r.readback}`)).filter(Boolean);
  const badges = [
    ['🔎', 'Leak found', Boolean(funnel?.leak?.step)],
    ['🧪', 'Belief tested', beliefs.length > 0],
    ['⚖️', 'Second opinion', Boolean(verdict?.verdict)],
    ['🛡️', 'Short seller survived', Boolean(shortSeller?.claims?.length)],
    ['🚀', 'Fix shipped', shipped.length > 0],
    ['📅', 'Check-in booked', Boolean(checkin?.at && checkin?.scheduled)],
  ];
  const unlocked = badges.filter((b) => b[2]).length;
  const value = [
    funnel ? [fmt(funnel.links), `tracked ${plural(funnel.links, 'link')} read row by row`] : null,
    funnel?.linked_posts ? [fmt(funnel.linked_posts), `linked ${plural(funnel.linked_posts, 'post')} matched to their views`] : null,
    beliefs.length ? [String(beliefs.length), `${plural(beliefs.length, 'belief')} checked against your own numbers`] : null,
    verdict?.verdict ? ['1', `second model checked the diagnosis (${verdict.verdict})`] : null,
    shortSeller?.claims?.length ? [String(shortSeller.claims.length), 'doubts a skeptical buyer would have, found before they cost you'] : null,
    shipped.length ? [String(shipped.length), `${plural(shipped.length, 'change')} shipped after one yes`] : null,
  ].filter(Boolean);
  const share = reward.share ?? (leak ? `i gave Claude my real money goal and my real Threadify numbers. it found the exact step where my ${stageWord(2, leak.from)} leak, tested my theory, and shipped the fix after one yes.` : 'i gave Claude my real money goal and my real Threadify numbers, and it shipped one fix after one yes.');
  const stamp = run.run_at ? new Date(run.run_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', ...((reward.tz ?? checkin?.tz) ? { timeZone: reward.tz ?? checkin.tz } : {}) }) : '';
  const post = reward.post?.text ? `<div class="thread"><div class="av">T</div><div><p class="who">You${reward.post.when ? ` <span>· scheduled ${esc(reward.post.when)}</span>` : ''}</p><p class="ptxt">${esc(reward.post.text)}</p>${reward.post.plug ? `<div class="reply"><p class="who">You <span>· Auto Plug${reward.post.plug_delay ? `, ${esc(reward.post.plug_delay)}` : ''}</span></p><p class="ptxt">${esc(reward.post.plug)}</p></div>` : ''}</div></div>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>You shipped it</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&family=Space+Mono:wght@700&display=swap" rel="stylesheet"><style>
:root{--bg:#0a0a0a;--panel:#151515;--line:#2a2a2a;--text:#fff;--muted:rgba(255,255,255,.66);--red:#ff0000;--soft:rgba(255,0,0,.12)}
@media (prefers-color-scheme:light){:root:not([data-theme="dark"]){--bg:#fafafa;--panel:#fff;--line:#e6e6e6;--text:#0a0a0a;--muted:#5a5a5a;--soft:rgba(255,0,0,.08)}}
*{box-sizing:border-box}html,body{max-width:100%;overflow-x:hidden}body{margin:0;background:var(--bg);color:var(--text);font:18px/1.5 Inter,system-ui,-apple-system,sans-serif;overflow-wrap:anywhere}
main{max-width:860px;margin:auto;padding:28px 16px 64px}canvas#c{position:fixed;inset:0;pointer-events:none;z-index:5}
.mono{font-family:'Space Mono',ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase;font-size:13px;color:var(--red)}
h1{font-size:clamp(34px,6.4vw,68px);line-height:1.02;margin:8px 0 10px;font-weight:900;letter-spacing:-.02em}h1 em{font-style:normal;color:var(--red)}
h2{font-size:clamp(20px,2.6vw,28px);margin:38px 0 12px;font-weight:800}.muted{color:var(--muted)}
.card{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:18px 18px}
.bar{height:14px;background:var(--line);border-radius:99px;overflow:hidden;margin:10px 0 4px}.bar i{display:block;height:100%;background:var(--red);border-radius:99px;width:0;transition:width 1.4s cubic-bezier(.2,.8,.2,1)}
.badges{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}@media(max-width:620px){.badges{grid-template-columns:repeat(2,1fr)}}
.badge{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px;text-align:center;font-weight:700;font-size:15px;opacity:.4}
.badge b{display:block;font-size:30px;margin-bottom:4px}.badge.on{opacity:1;border-color:var(--red);box-shadow:0 0 0 3px var(--soft);animation:pop .6s cubic-bezier(.2,1.6,.4,1) both}@keyframes pop{from{transform:scale(.5);opacity:0}to{transform:scale(1);opacity:1}}
.leak{border:3px solid var(--red)}.big{font-size:clamp(40px,8vw,92px);font-weight:900;line-height:1;margin:6px 0}.big small{display:block;font-size:.3em;color:var(--muted);font-weight:700;margin-top:8px}
ul.done{list-style:none;padding:0;margin:0;display:grid;gap:8px}ul.done li{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:12px 14px 12px 44px;position:relative}ul.done li:before{content:'✓';position:absolute;left:14px;top:11px;color:var(--red);font-weight:900}
.vals{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:620px){.vals{grid-template-columns:1fr}}.vals .card b{display:block;font-size:34px;font-weight:900;color:var(--red)}
.thread{display:flex;gap:12px;background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:16px}.av{flex:none;width:38px;height:38px;border-radius:50%;background:var(--red);color:#fff;display:grid;place-items:center;font-weight:900}
.who{margin:0;font-weight:700}.who span{color:var(--muted);font-weight:400;font-size:15px}.ptxt{white-space:pre-wrap;margin:6px 0 0}.reply{border-left:2px solid var(--line);margin-top:14px;padding-left:12px}
.next{background:var(--red);color:#fff;border-radius:18px;padding:20px}.next .mono{color:#fff;opacity:.85}.next p{margin:6px 0 0;font-size:clamp(20px,2.6vw,26px);font-weight:800}
.cta{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.btn{display:inline-flex;gap:8px;align-items:center;padding:16px 22px;border-radius:999px;font-weight:800;text-decoration:none;border:0;cursor:pointer;font-size:18px}
.btn.star{background:var(--text);color:var(--bg)}.btn.ghost{background:transparent;color:var(--text);border:2px solid var(--line)}.btn:active{transform:scale(.97)}
.share{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start}.share p{flex:1 1 280px;margin:0}
.foot{color:var(--muted);font-size:14px;margin-top:34px}
@media (prefers-reduced-motion:reduce){.badge.on{animation:none}.bar i{transition:none}}
</style></head><body><canvas id="c"></canvas><main>
<div class="mono">Threadify · Go Make Money · ${unlocked}/${badges.length} unlocked</div>
<h1>${esc(reward.headline ?? 'You found the leak.')} <em>${esc(reward.headline_2 ?? 'You shipped the fix.')}</em></h1>
<p class="muted">${esc(p?.line ?? 'Goal not set.')}</p>
${progress !== null ? `<div class="bar" aria-label="progress to goal"><i data-w="${progress}"></i></div><p class="muted">${esc(fmt(p.current))} of ${esc(fmt(p.goal))} (${progress}%)</p>` : ''}
<h2>Achievements</h2><div class="badges">${badges.map(([icon, label, on], i) => `<div class="badge${on ? ' on' : ''}" style="animation-delay:${300 + i * 140}ms"><b>${on ? icon : '🔒'}</b>${esc(label)}</div>`).join('')}</div>
${leak ? `<h2>Why: the leak</h2><div class="card leak"><div class="mono">The biggest drop in your funnel</div><div class="big">${esc(fmt(leak.upstream))} ${esc(stageWord(leak.upstream, leak.from))} → ${esc(fmt(leak.downstream))} ${esc(stageWord(leak.downstream, leak.to))}<small>${esc(leak.rate_pct === null ? UNKNOWN : `${leak.rate_pct}%`)} make it through${leak.small_sample ? ' (small sample)' : ''}</small></div>${reward.why ? `<p>${esc(reward.why)}</p>` : ''}</div>` : ''}
<h2>Why it's a big deal</h2><div class="card">${gain ? `<p style="font-size:clamp(20px,2.4vw,26px);font-weight:800;margin:0">${esc(gain.line)}</p>` : '<p style="margin:0">The leak is named with receipts, so the next run can grade the fix on the same numbers.</p>'}${p?.required_net_new_per_week !== undefined && p?.required_net_new_per_week !== UNKNOWN && p?.label === 'measured baseline' ? `<p class="muted" style="margin:10px 0 0">Your pace: ${esc(fmt(p.required_net_new_per_week))} net new per week. Closing the leak is the cheapest way to get there, because the clicks are already coming.</p>` : ''}</div>
<h2>What we did</h2>${shipped.length ? `<ul class="done">${shipped.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>` : '<p class="muted">Nothing was changed this run.</p>'}
${post ? `<h2>Your post</h2>${post}` : ''}
<h2>The value</h2><div class="vals">${value.map(([n, label]) => `<div class="card"><b>${esc(n)}</b>${esc(label)}</div>`).join('')}</div>
${grade?.status === 'graded' ? `<h2>Last fix, graded</h2><div class="card">${esc(grade.line)}</div>` : ''}
<h2>Next step</h2><div class="next"><div class="mono">Do this next</div><p>${esc(reward.next ?? 'Run Go Make Money again after the post goes out, so it can grade this fix on the same numbers.')}</p></div>
<h2>Check-in</h2><div class="card">${checkin?.at ? `${checkin.scheduled ? `<p style="margin:0;font-weight:800;font-size:22px">📅 Claude checks in ${esc(checkin.when ?? checkin.at)}</p><p class="muted" style="margin:6px 0 0">${esc(checkin.how ?? 'scheduled task')}: it reads your numbers again and grades this fix before anything else.</p>` : `<p style="margin:0;font-weight:800;font-size:22px">📅 Your check-in reminder is ready for ${esc(checkin.when ?? checkin.at)}</p><p class="muted" style="margin:6px 0 0">Add it to your calendar. When it goes off, open Claude and paste the prompt inside: it reads your numbers again and grades this fix.</p>`}${run.has_ics ? '<div class="cta" style="margin-top:12px"><a class="btn ghost" href="checkin.ics" download>📅 Add to calendar</a></div>' : ''}` : '<p style="margin:0">No check-in booked yet. Say "check in on me next week" and Claude will book one, then grade this fix on the same numbers.</p>'}</div>
<h2>Share the win</h2><div class="card share"><p id="sh">${esc(share)}</p><button class="btn ghost" id="cp" type="button">Copy</button></div>
<h2>Help the next creator find this</h2><div class="card"><p style="margin:0 0 12px">Go Make Money is free and open source. A star helps other creators find it.</p><div class="cta"><a class="btn star" href="${REPO_URL}" target="_blank" rel="noopener">⭐ Star Threadify Workflows on GitHub</a><button class="btn ghost" id="again" type="button">🎉 Celebrate again</button><a class="btn ghost" href="${esc(THREADIFY_URL)}" target="_blank" rel="noopener">Open Threadify</a></div></div>
${run.has_report ? '<p class="muted" style="margin-top:28px"><a href="report.html" style="color:inherit">See the full diagnosis: funnel, verdicts, judge, short seller and all three decisions →</a></p>' : ''}
<p class="foot">Every number on this page comes from your raw Threadify rows, counted by a script. Clicks and signups are attributed, not caused. Nothing here promises revenue or customers. ${esc(stamp)}</p>
</main><script>
(()=>{const still=matchMedia('(prefers-reduced-motion: reduce)').matches;const c=document.getElementById('c'),x=c.getContext('2d');let W,H,parts=[];
const size=()=>{W=c.width=innerWidth;H=c.height=innerHeight};size();addEventListener('resize',size);
const cols=['#ff0000','#ffffff','#ff5a5a','#9a9a9a','#0a0a0a'];
function burst(n){if(still)return;for(let i=0;i<n;i++)parts.push({x:W/2+(Math.random()-.5)*W*.5,y:H*.28,vx:(Math.random()-.5)*14,vy:-Math.random()*15-4,r:Math.random()*7+4,c:cols[i%cols.length],a:Math.random()*6,s:(Math.random()-.5)*.3,l:160+Math.random()*80});tick()}
let on=false;function tick(){if(on)return;on=true;(function f(){x.clearRect(0,0,W,H);parts=parts.filter(p=>p.l-->0&&p.y<H+20);for(const p of parts){p.vy+=.38;p.vx*=.99;p.x+=p.vx;p.y+=p.vy;p.a+=p.s;x.save();x.translate(p.x,p.y);x.rotate(p.a);x.fillStyle=p.c;x.fillRect(-p.r/2,-p.r/4,p.r,p.r/2);x.restore()}if(parts.length)requestAnimationFrame(f);else{on=false;x.clearRect(0,0,W,H)}})()}
function chime(){try{const a=new (window.AudioContext||window.webkitAudioContext)();[523.25,659.25,783.99,1046.5].forEach((f,i)=>{const o=a.createOscillator(),g=a.createGain();o.frequency.value=f;o.type='triangle';g.gain.setValueAtTime(0,a.currentTime+i*.09);g.gain.linearRampToValueAtTime(.18,a.currentTime+i*.09+.02);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+i*.09+.5);o.connect(g).connect(a.destination);o.start(a.currentTime+i*.09);o.stop(a.currentTime+i*.09+.55)})}catch(e){}}
addEventListener('load',()=>{burst(180);document.querySelectorAll('.bar i').forEach(i=>i.style.width=i.dataset.w+'%')});
document.getElementById('again').onclick=()=>{burst(220);chime()};
document.getElementById('cp').onclick=async(e)=>{try{await navigator.clipboard.writeText(document.getElementById('sh').textContent);e.target.textContent='Copied'}catch(_){e.target.textContent='Select and copy'}};})();
</script></body></html>
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
        leak: funnel.leak, receipts: leakReceipts(funnel), upside: upside(funnel)?.line ?? null, by_destination: funnel.by_destination.slice(0, 6), summary_check: funnel.summary_check, views_coverage: funnel.views_coverage, table: funnelTable(funnel) };
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
      return checkCopy(fs.readFileSync(path.resolve(argValue(args, '--file')), 'utf8').trim(), keep, { channel: argValue(args, '--channel', 'threads') });
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
    case 'money': {
      const offersFile = argValue(args, '--offers');
      const result = moneyActivity({ attribution: unwrap(readJson(path.resolve(argValue(args, '--attribution')))), offers: offersFile ? unwrap(readJson(path.resolve(offersFile))) : null });
      write(dir, 'money.json', result);
      return { status: 'ok', ...result };
    }
    case 'library': {
      const result = buildLibrary({ attribution: unwrap(readJson(path.resolve(argValue(args, '--attribution')))), limit: Number(argValue(args, '--limit', 5)) || 5 });
      write(dir, 'library.json', result);
      return { status: 'ok', ...result };
    }
    case 'checkin': {
      const at = argValue(args, '--at');
      const tz = argValue(args, '--tz', null);
      const prompt = argValue(args, '--prompt', 'Use $threadify-go-make-money. Check-in: read the ledger first and grade my last fix on the same numbers.');
      // One check-in per run: re-running it (a new time, or the host booking it) updates the same calendar event.
      const uid = readJsonIf(path.join(dir, 'checkin.json'))?.uid ?? `gmm-checkin-${randomUUID()}`;
      let ics;
      try { ics = checkinIcs({ at, prompt, tz, uid }); } catch (error) { return { status: 'usage', usage: error.message }; }
      const when = argValue(args, '--when', at.replace('T', ' '));
      // --scheduled only after the host's own scheduler confirmed the task; a calendar file alone is a reminder, not a booking.
      const scheduled = args.includes('--scheduled');
      const record = { at, tz, when, scheduled, how: argValue(args, '--how', scheduled ? 'scheduled task' : 'calendar reminder'), prompt, uid, ics: write(dir, 'checkin.ics', ics) };
      write(dir, 'checkin.json', record);
      return { status: 'ok', ...record };
    }
    case 'celebrate': {
      const reward = readJsonIf(path.join(dir, 'reward-input.json')) ?? {};
      const run = {
        goal: readJsonIf(path.join(dir, 'goal.json')), funnel: readJsonIf(path.join(dir, 'funnel.json')), beliefs: readJsonIf(path.join(dir, 'beliefs.json'))?.tests ?? [],
        judge: readJsonIf(path.join(dir, 'judge.json')), shortSeller: readJsonIf(path.join(dir, 'short-seller.json')), fix: readJsonIf(path.join(dir, 'fix.json')),
        checkin: readJsonIf(path.join(dir, 'checkin.json')), grade: readJsonIf(path.join(dir, 'grade.json')), reward, run_at: new Date().toISOString(),
        has_report: fs.existsSync(path.join(dir, 'report.html')), has_ics: fs.existsSync(path.join(dir, 'checkin.ics')),
      };
      const html = renderReward(run);
      if (EMAIL.test(html)) return { status: 'FAIL', problems: ['the reward page would show an email address; remove it from reward-input.json'] };
      return { status: 'ok', reward: write(dir, 'reward.html', html), upside: upside(run.funnel)?.line ?? null };
    }
    default:
      return { status: 'usage', usage: 'go-make-money.mjs money|goal|funnel|page-text|belief|judge|short-seller|rank-decisions|check-copy|library|ledger|report|checkin|celebrate (see the header of this file)' };
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
