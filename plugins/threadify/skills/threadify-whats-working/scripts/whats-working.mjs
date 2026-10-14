#!/usr/bin/env node
// What's Working: which of your posts Threads kills, and which kind it still pushes.
//
//   node whats-working.mjs < {"performance": <read_post_performance result or an array of pages>,
//                             "now"?: "<ISO time>", "from"?: "YYYY-MM-DD", "to"?: "YYYY-MM-DD",
//                             "tags"?: {"<post_id>": {"pattern": "<hook / format / topic label>"}}}
//   node whats-working.mjs --html report.html < same input   (also writes a local report page)
//
// Every number is relative to the account's own median views, so a small
// account and a big one read the same way. Posts younger than MIN_AGE_DAYS are
// "too new" and are left out of the median and the labels, because they have
// not finished collecting views. Missing views stay unknown and are counted,
// never treated as 0. Without "tags" it reports coverage, the median, the
// alive/dead split and the month-by-month median; with "tags" (the agent's
// pattern label per post) it also ranks patterns by their median multiple.
// JSON on stdout. Exit 0 on success, 1 on bad input. Node 18+, no dependencies.
import { realpathSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const MIN_AGE_DAYS = 3;
export const ALIVE_MULTIPLE = 3;
export const MIN_PATTERN_POSTS = 5;
const FIRST_LINE_MAX = 90;
const DAY_MS = 86_400_000;

const asNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const round1 = (value) => Math.round(value * 10) / 10;

export function median(values) {
  const sorted = values.filter((value) => value !== null).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function firstLine(text) {
  if (typeof text !== 'string') return null;
  const line = text.split(/\r?\n/).map((part) => part.trim()).find(Boolean);
  if (!line) return null;
  return line.length > FIRST_LINE_MAX ? `${line.slice(0, FIRST_LINE_MAX - 1)}…` : line;
}

/** Normalise read_post_performance rows (one result or several pages) into one list, deduplicated by id. */
export function collectPosts(performance) {
  const results = Array.isArray(performance) ? performance : [performance];
  const posts = new Map();
  for (const result of results) {
    if (!Array.isArray(result?.posts)) throw new Error('performance must be a read_post_performance result with posts');
    for (const row of result.posts) {
      const id = row.post_id ?? row.threads_post_id ?? null;
      if (!id) continue;
      const metrics = row.metrics ?? row;
      posts.set(String(id), {
        post_id: String(id),
        published_at: row.published_at ?? null,
        permalink: row.permalink ?? row.url ?? null,
        first_line: firstLine(row.text ?? row.text_preview),
        views: asNumber(metrics.views),
        likes: asNumber(metrics.likes),
        replies: asNumber(metrics.replies),
      });
    }
  }
  return [...posts.values()];
}

export function labelFor(multiple) {
  if (multiple === null) return 'unknown';
  if (multiple >= ALIVE_MULTIPLE) return 'alive';
  if (multiple < 1) return 'dead';
  return 'stuck';
}

function monthKey(iso) {
  return typeof iso === 'string' && /^\d{4}-\d{2}/.test(iso) ? iso.slice(0, 7) : null;
}

export function analyse(input) {
  if (!input || typeof input !== 'object') throw new Error('input must be a JSON object');
  const now = Date.parse(input.now ?? new Date().toISOString());
  if (!Number.isFinite(now)) throw new Error('now must be an ISO time');
  const from = input.from ? Date.parse(input.from) : null;
  const to = input.to ? Date.parse(input.to) + DAY_MS : null;

  const all = collectPosts(input.performance).filter((post) => {
    const time = Date.parse(post.published_at ?? '');
    if (!Number.isFinite(time)) return true;
    return (from === null || time >= from) && (to === null || time < to);
  });
  const dated = all.map((post) => post.published_at).filter(Boolean).sort();
  const tooNew = all.filter((post) => Number.isFinite(Date.parse(post.published_at ?? '')) &&
    now - Date.parse(post.published_at) < MIN_AGE_DAYS * DAY_MS);
  const tooNewIds = new Set(tooNew.map((post) => post.post_id));
  const unknownViews = all.filter((post) => post.views === null && !tooNewIds.has(post.post_id));
  const counted = all.filter((post) => post.views !== null && !tooNewIds.has(post.post_id));
  const exactMedian = median(counted.map((post) => post.views));
  const medianViews = exactMedian === null ? null : Math.round(exactMedian);

  const labelled = counted.map((post) => {
    const multiple = medianViews ? round1(post.views / medianViews) : null;
    return { ...post, multiple, label: labelFor(multiple) };
  });
  const share = (label) => (labelled.length ? round1((labelled.filter((post) => post.label === label).length / labelled.length) * 100) : null);
  const byViews = [...labelled].sort((a, b) => b.views - a.views);

  const months = new Map();
  for (const post of labelled) {
    const month = monthKey(post.published_at);
    if (!month) continue;
    if (!months.has(month)) months.set(month, []);
    months.get(month).push(post);
  }
  const monthly = [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, posts]) => ({
    month,
    posts: posts.length,
    median_views: Math.round(median(posts.map((post) => post.views))),
    alive_share: round1((posts.filter((post) => post.label === 'alive').length / posts.length) * 100),
  }));

  const result = {
    status: labelled.length ? 'ok' : 'no_posts',
    coverage: {
      posts_returned: all.length,
      posts_counted: labelled.length,
      too_new: tooNew.length,
      unknown_views: unknownViews.length,
      first_post: dated[0] ?? null,
      last_post: dated.at(-1) ?? null,
    },
    thresholds: {
      dead: 'under 1x your median views',
      stuck: `1x to under ${ALIVE_MULTIPLE}x your median`,
      alive: `${ALIVE_MULTIPLE}x your median or more`,
      too_new: `posted less than ${MIN_AGE_DAYS} days ago (left out)`,
    },
    median_views: medianViews,
    top_multiple: byViews[0]?.multiple ?? null,
    shares_percent: { dead: share('dead'), stuck: share('stuck'), alive: share('alive') },
    never_broke_out_percent: labelled.length ? round1(100 - share('alive')) : null,
    top_posts: byViews.slice(0, 10),
    bottom_posts: byViews.slice(-5).reverse(),
    monthly,
  };

  if (input.tags && typeof input.tags === 'object') {
    const groups = new Map();
    let untagged = 0;
    for (const post of labelled) {
      const pattern = input.tags[post.post_id]?.pattern;
      if (typeof pattern !== 'string' || !pattern.trim()) { untagged += 1; continue; }
      const label = pattern.trim();
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(post);
    }
    const patterns = [...groups.entries()].map(([pattern, posts]) => {
      const sorted = [...posts].sort((a, b) => b.views - a.views);
      return {
        pattern,
        posts: posts.length,
        median_multiple: round1(median(posts.map((post) => post.multiple))),
        alive_share: round1((posts.filter((post) => post.label === 'alive').length / posts.length) * 100),
        small_sample: posts.length < MIN_PATTERN_POSTS,
        examples: sorted.slice(0, 3).map(({ post_id, first_line, views, multiple, published_at, permalink }) =>
          ({ post_id, first_line, views, multiple, published_at, permalink })),
      };
    }).sort((a, b) => b.median_multiple - a.median_multiple || b.posts - a.posts);
    const ranked = patterns.filter((pattern) => !pattern.small_sample);
    result.patterns = patterns;
    result.untagged = untagged;
    result.number_one = ranked[0] ?? null;
    result.most_alive = ranked.slice(0, 3);
    result.most_dead = [...ranked].reverse().filter((pattern) => pattern.median_multiple < 1).slice(0, 3);
  }
  return result;
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const fmt = (value) => (value === null || value === undefined ? 'unknown' : Math.round(Number(value)).toLocaleString('en-US'));

/** A self-contained local report page: one chart of every post against your median, months, patterns. */
export function renderHtml(result, { handle = '', posts = [] } = {}) {
  const dots = posts;
  const width = 1600; const height = 520; const pad = 60;
  const times = dots.map((post) => Date.parse(post.published_at)).filter(Number.isFinite);
  const minT = Math.min(...times); const maxT = Math.max(...times);
  // The domain always includes the median and the alive line, so both guides stay on the chart.
  const guideMedian = result.median_views ?? 1;
  const maxV = Math.max(...dots.map((post) => post.views), guideMedian * ALIVE_MULTIPLE * 1.2, 1);
  const minV = Math.max(1, Math.min(...dots.map((post) => post.views), guideMedian / 2));
  const span = Math.log10(maxV) - Math.log10(minV) || 1;
  const y = (views) => height - pad - ((Math.log10(Math.max(views, minV)) - Math.log10(minV)) / span) * (height - 2 * pad);
  const x = (time) => pad + (maxT > minT ? ((time - minT) / (maxT - minT)) : 0.5) * (width - 2 * pad);
  const colour = { alive: '#4ecdc4', stuck: '#8a8a8a', dead: '#ff6b4a' };
  const circles = dots.filter((post) => Number.isFinite(Date.parse(post.published_at))).map((post) =>
    `<circle cx="${x(Date.parse(post.published_at)).toFixed(1)}" cy="${y(post.views).toFixed(1)}" r="${post.label === 'alive' ? 7 : 4}" fill="${colour[post.label]}" opacity="0.85"><title>${escapeHtml(post.first_line)} · ${fmt(post.views)} views</title></circle>`).join('');
  const line = (views, label, stroke, below = false) => `<line x1="${pad}" x2="${width - pad}" y1="${y(views)}" y2="${y(views)}" stroke="${stroke}" stroke-width="3" stroke-dasharray="10 8"/><text x="${width - pad}" y="${below ? y(views) + 34 : y(views) - 12}" text-anchor="end" fill="${stroke}" font-size="28" font-weight="700" paint-order="stroke" stroke="#1a1a1a" stroke-width="6">${label}</text>`;
  const median = result.median_views ?? 1;
  const top = result.top_posts?.[0];
  const monthsRows = result.monthly.map((month) => `<tr><td>${month.month}</td><td>${fmt(month.posts)}</td><td>${fmt(month.median_views)}</td><td>${month.alive_share}%</td></tr>`).join('');
  const patternCard = (pattern, tone) => `<div class="card ${tone}"><h3>${escapeHtml(pattern.pattern)}</h3><p class="big">${pattern.median_multiple}x <span>median · ${pattern.posts} posts · ${pattern.alive_share}% alive</span></p><ol>${pattern.examples.map((post) => `<li>${escapeHtml(post.first_line)} <b>${fmt(post.views)}</b></li>`).join('')}</ol></div>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>What's Working</title>
<style>
:root{--bg:#0d0d0d;--bg2:#1a1a1a;--text:#fff;--muted:rgba(255,255,255,.7);--dead:#ff6b4a;--alive:#4ecdc4}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:20px/1.4 Inter,system-ui,sans-serif;padding:32px 16px}
main{max-width:1600px;margin:0 auto;display:grid;gap:28px}h1{font-size:44px;margin:0}h2{font-size:30px;margin:0 0 12px}h3{margin:0 0 8px;font-size:24px}
.coverage{color:var(--muted)}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}
.stat{background:var(--bg2);border-radius:12px;padding:20px}.stat b{display:block;font:700 48px/1.1 'Space Mono',monospace}
.dead b{color:var(--dead)}.alive b{color:var(--alive)}svg{width:100%;height:auto;background:var(--bg2);border-radius:12px}
table{border-collapse:collapse;width:100%;background:var(--bg2);border-radius:12px;overflow:hidden}td,th{padding:10px 14px;text-align:left;border-bottom:1px solid #2a2a2a}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}.card{background:var(--bg2);border-radius:12px;padding:20px;border-top:6px solid var(--alive)}
.card.deadc{border-top-color:var(--dead)}.big{font:700 40px 'Space Mono',monospace;margin:0 0 8px}.big span{font:400 18px Inter,sans-serif;color:var(--muted)}
.one{border:3px solid var(--alive)}ol{margin:0;padding-left:22px}li{margin:6px 0}
</style></head><body><main>
<h1>What's working${handle ? ` · ${escapeHtml(handle)}` : ''}</h1>
<p class="coverage">Read ${fmt(result.coverage.posts_returned)} posts, ${escapeHtml(result.coverage.first_post?.slice(0, 10))} to ${escapeHtml(result.coverage.last_post?.slice(0, 10))}. Counted ${fmt(result.coverage.posts_counted)} (${fmt(result.coverage.too_new)} too new, ${fmt(result.coverage.unknown_views)} with unknown views).</p>
<section class="stats">
<div class="stat"><span>your median</span><b>${fmt(result.median_views)}</b></div>
<div class="stat alive"><span>best post</span><b>${fmt(top?.views)}</b>${top ? `${top.multiple}x median` : ''}</div>
<div class="stat dead"><span>never broke out (under ${ALIVE_MULTIPLE}x)</span><b>${result.never_broke_out_percent ?? 'unknown'}%</b></div>
<div class="stat alive"><span>alive (${ALIVE_MULTIPLE}x+)</span><b>${result.shares_percent.alive ?? 'unknown'}%</b></div>
</section>
<section><h2>Every post against your median</h2>
<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="views per post over time">${circles}${line(median, `median ${fmt(median)}`, '#ffffff', true)}${line(median * ALIVE_MULTIPLE, `alive ${ALIVE_MULTIPLE}x`, '#4ecdc4')}</svg></section>
${result.number_one ? `<section><h2>#1: what Threads still pushes</h2><div class="cards">${patternCard(result.number_one, 'one')}</div></section>` : ''}
${result.most_alive?.length ? `<section><h2>Most alive</h2><div class="cards">${result.most_alive.map((p) => patternCard(p, '')).join('')}</div></section>` : ''}
${result.most_dead?.length ? `<section><h2>What Threads killed</h2><div class="cards">${result.most_dead.map((p) => patternCard(p, 'deadc')).join('')}</div></section>` : ''}
<section><h2>Is Threads dead for you? Month by month</h2><table><tr><th>month</th><th>posts</th><th>median views</th><th>alive</th></tr>${monthsRows}</table></section>
</main></body></html>
`;
}

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return JSON.parse(data);
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const htmlIndex = process.argv.indexOf('--html');
  readStdin()
    .then((input) => {
      const result = analyse(input);
      if (htmlIndex > -1) {
        const target = process.argv[htmlIndex + 1];
        if (!target) throw new Error('--html needs a file path');
        writeFileSync(target, renderHtml(result, { handle: input.handle, posts: labelledPosts(input) }));
        result.report = target;
      }
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    })
    .catch((error) => {
      process.stderr.write(`${JSON.stringify({ status: 'failed', error: error.message })}\n`);
      process.exitCode = 1;
    });
}

/** Every counted post with its multiple and label, for the chart. */
export function labelledPosts(input) {
  const now = Date.parse(input.now ?? new Date().toISOString());
  const from = input.from ? Date.parse(input.from) : null;
  const to = input.to ? Date.parse(input.to) + DAY_MS : null;
  const counted = collectPosts(input.performance).filter((post) => {
    const time = Date.parse(post.published_at ?? '');
    if (Number.isFinite(time) && now - time < MIN_AGE_DAYS * DAY_MS) return false;
    if (Number.isFinite(time) && ((from !== null && time < from) || (to !== null && time >= to))) return false;
    return post.views !== null;
  });
  const medianViews = median(counted.map((post) => post.views));
  return counted.map((post) => {
    const multiple = medianViews ? round1(post.views / medianViews) : null;
    return { ...post, multiple, label: labelFor(multiple) };
  });
}
