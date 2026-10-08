#!/usr/bin/env node
// Threadify Unslop score: every post scored on the four slop families, hedging
// weighted highest, then raw vs polished median views on the owner's account.
//
//   node unslop-score.mjs < {"handle"?: "@handle", "window_days"?: 90,
//                            "performance": <read_post_performance result or an array of pages>}
//   node unslop-score.mjs < {"posts": [{"id"?, "text", "views"?, "published_at"?}]}
//
// A post is RAW with zero hedges and at most one other marker. Any hedge, or
// two or more other markers, makes it POLISHED. With view data the verdict
// compares median views per class, labelled "on your account". Pasted posts
// (no views) get flags and offenders only, labelled as having no view
// comparison. Missing views stay unknown, never 0. JSON on stdout with
// ready-to-show tables. Exit 0 on success, 1 on bad input. Node 18+ only.
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { scoreText, WEIGHTS } from './hedge_gate.mjs';

export const RAW_MAX_MARKERS = 1;
export const OFFENDERS_SHOWN = 5;
export const TOP_RAW_SHOWN = 5;
export const SMALL_SAMPLE = 5;
export const ACCOUNT_LABEL = 'on your account';
export const NO_VIEWS_LABEL = 'pasted posts: no view data, no view comparison';
const FIRST_LINE_MAX = 70;
const PHRASES_SHOWN = 4;

const asNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

function firstLine(text) {
  const line = text.split(/\r?\n/).map((part) => part.trim()).find(Boolean) ?? '';
  return line.length > FIRST_LINE_MAX ? `${line.slice(0, FIRST_LINE_MAX - 1)}…` : line;
}

export function median(values) {
  const known = values.filter((value) => value !== null).sort((a, b) => a - b);
  if (!known.length) return null;
  const middle = Math.floor(known.length / 2);
  return known.length % 2 ? known[middle] : (known[middle - 1] + known[middle]) / 2;
}

/** Normalise read_post_performance pages or pasted posts into {id, text, views, published_at}. */
export function collectPosts(input) {
  if (Array.isArray(input?.posts) && input.performance === undefined) {
    return {
      mode: 'pasted',
      posts: input.posts.map((post, index) => ({
        id: String(post.id ?? index + 1),
        text: typeof post === 'string' ? post : post.text,
        views: asNumber(post.views),
        published_at: post.published_at ?? null,
      })),
    };
  }
  const pages = Array.isArray(input?.performance) ? input.performance : [input?.performance];
  const posts = [];
  const seen = new Set();
  for (const page of pages) {
    if (!Array.isArray(page?.posts)) throw new Error('performance must be a read_post_performance result with posts, or pass posts');
    for (const row of page.posts) {
      const id = String(row.post_id ?? row.threads_post_id ?? posts.length + 1);
      if (seen.has(id)) continue;
      seen.add(id);
      const metrics = row.metrics ?? row;
      posts.push({ id, text: row.text ?? row.text_preview, views: asNumber(metrics.views), published_at: row.published_at ?? null });
    }
  }
  return { mode: 'account', posts };
}

const isLowercase = (text) => {
  const letters = text.replace(/https?:\/\/\S+|[@#][\p{L}\p{N}_.]+/gu, '').match(/\p{L}/gu) ?? [];
  return letters.length > 0 && letters.every((letter) => letter === letter.toLowerCase());
};

const fmt = (value) => (value === null ? 'unknown' : Math.round(value).toLocaleString('en-US'));

export function scorePosts(input) {
  const { mode, posts } = collectPosts(input);
  const usable = posts.filter((post) => typeof post.text === 'string' && post.text.trim());
  if (!usable.length) throw new Error('no posts with text to score');
  if (mode === 'pasted' && (usable.length < 5 || usable.length > 20)) throw new Error('paste 5-20 posts or drafts');
  const scored = usable.map((post) => {
    const { score, hedges, families } = scoreText(post.text);
    const markers = families.corporate.length + families.ai_tells.length + families.over_formatting.length;
    const polished = hedges > 0 || markers > RAW_MAX_MARKERS;
    return {
      id: post.id,
      first_line: firstLine(post.text),
      published_at: post.published_at,
      views: post.views,
      class: polished ? 'polished' : 'raw',
      score,
      hedges,
      markers,
      lowercase: isLowercase(post.text),
      families,
    };
  });
  const raw = scored.filter((post) => post.class === 'raw');
  const polished = scored.filter((post) => post.class === 'polished');
  const hasViews = mode === 'account' && scored.some((post) => post.views !== null);
  const verdict = hasViews ? buildVerdict(raw, polished) : null;
  const offenders = [...polished]
    .sort((a, b) => b.score - a.score || b.hedges - a.hedges || (b.views ?? -1) - (a.views ?? -1))
    .slice(0, OFFENDERS_SHOWN);
  const topRaw = [...raw].sort((a, b) => (b.views ?? -1) - (a.views ?? -1)).slice(0, TOP_RAW_SHOWN);
  return {
    mode,
    handle: input.handle ?? null,
    window_days: mode === 'account' ? (input.window_days ?? 90) : null,
    label: hasViews ? ACCOUNT_LABEL : NO_VIEWS_LABEL,
    rules: {
      weights: WEIGHTS,
      raw: `zero hedges and at most ${RAW_MAX_MARKERS} other marker`,
      polished: `any hedge, or ${RAW_MAX_MARKERS + 1}+ other markers`,
    },
    counts: { posts: scored.length, raw: raw.length, polished: polished.length, unknown_views: scored.filter((post) => post.views === null).length },
    verdict,
    offenders,
    top_raw: topRaw,
    raw_lowercase_share: raw.length ? Math.round((raw.filter((post) => post.lowercase).length / raw.length) * 100) / 100 : null,
    verdict_table: hasViews ? verdictTable(input.handle, input.window_days ?? 90, verdict) : null,
    offenders_table: offendersTable(offenders, hasViews),
    posts: scored,
  };
}

function buildVerdict(raw, polished) {
  const rawMedian = median(raw.map((post) => post.views));
  const polishedMedian = median(polished.map((post) => post.views));
  let winner = 'unknown';
  let multiple = null;
  if (rawMedian !== null && polishedMedian !== null) {
    if (rawMedian > polishedMedian) winner = 'raw';
    else if (polishedMedian > rawMedian) winner = 'polished';
    else winner = 'tie';
    const [high, low] = winner === 'polished' ? [polishedMedian, rawMedian] : [rawMedian, polishedMedian];
    multiple = low > 0 ? Math.round((high / low) * 10) / 10 : null;
  }
  const knownRaw = raw.filter((post) => post.views !== null).length;
  const knownPolished = polished.filter((post) => post.views !== null).length;
  return {
    label: ACCOUNT_LABEL,
    raw: { posts: raw.length, posts_with_views: knownRaw, median_views: rawMedian },
    polished: { posts: polished.length, posts_with_views: knownPolished, median_views: polishedMedian },
    winner,
    multiple,
    small_sample: knownRaw < SMALL_SAMPLE || knownPolished < SMALL_SAMPLE,
    headline: headline(winner, multiple),
  };
}

function headline(winner, multiple) {
  const times = multiple === null ? '' : ` ${multiple}x`;
  if (winner === 'raw') return `Raw beat polished${times} ${ACCOUNT_LABEL}.`;
  if (winner === 'polished') return `Polished beat raw${times} ${ACCOUNT_LABEL}. Unslop reports that straight.`;
  if (winner === 'tie') return `Raw and polished tied ${ACCOUNT_LABEL}.`;
  return `No median to compare ${ACCOUNT_LABEL}: views are unknown for one class.`;
}

function verdictTable(handle, days, verdict) {
  return [
    `Unslop verdict · ${handle ?? '@handle'} · last ${days} days · ${ACCOUNT_LABEL}`,
    '',
    '| | Posts | Median views |',
    '|---|---|---|',
    `| Raw | ${verdict.raw.posts} | ${fmt(verdict.raw.median_views)} |`,
    `| Polished | ${verdict.polished.posts} | ${fmt(verdict.polished.median_views)} |`,
    '',
    verdict.headline + (verdict.small_sample ? ` Small sample: fewer than ${SMALL_SAMPLE} posts with views in one class.` : ''),
  ].join('\n');
}

function offendersTable(offenders, hasViews) {
  if (!offenders.length) return 'Zero polished posts. Nothing to flag.';
  const head = hasViews ? '| # | Post | Views | Slop | Flagged |\n|---|---|---|---|---|' : '| # | Post | Slop | Flagged |\n|---|---|---|---|';
  const rows = offenders.map((post, index) => {
    const phrases = [...post.families.hedging, ...post.families.corporate, ...post.families.ai_tells, ...post.families.over_formatting];
    const shown = phrases.slice(0, PHRASES_SHOWN).map((phrase) => `"${phrase.replace(/\|/g, '/').replace(/\s+/g, ' ')}"`).join(', ');
    const more = phrases.length > PHRASES_SHOWN ? ` +${phrases.length - PHRASES_SHOWN}` : '';
    const line = post.first_line.replace(/\|/g, '/');
    return hasViews
      ? `| ${index + 1} | ${line} | ${fmt(post.views)} | ${post.score} | ${shown}${more} |`
      : `| ${index + 1} | ${line} | ${post.score} | ${shown}${more} |`;
  });
  return [head, ...rows].join('\n');
}

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return JSON.parse(data);
}

async function main() {
  const result = scorePosts(await readStdin());
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: 'failed', error: error.message })}\n`);
    process.exitCode = 1;
  });
}
