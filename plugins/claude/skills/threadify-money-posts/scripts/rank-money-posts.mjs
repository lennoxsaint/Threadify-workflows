#!/usr/bin/env node
// Money Posts ranking: which posts get clicks, not just views.
//
//   node rank-money-posts.mjs < {"attribution": <read_link_attribution result>,
//                                "performance": <read_post_performance result or an array of results>,
//                                "asks"?: {"<post_id>": <replies asking how/link/where>},
//                                "threads"?: {"<linked id with no views>": <get_post_thread result>}}
//
// Joins every tracked link row to its post by root_threads_post_id (fallback
// final_threads_post_id), sums clicks per post, and ranks linked posts by
// unique clicks per 1,000 views. Threadify can file an Auto Plug's clicks under
// the plug reply instead of its post; pass get_post_thread results for those
// ids as "threads" and the clicks move to the post whose first line opens the
// thread (latest post published at or before the thread's timestamp). Below the cold-start thresholds it also ranks
// every post on proxy signals, labelled "proxy, not clicks". Missing numbers
// stay null (unknown); nothing is estimated. JSON on stdout. Exit 0 on success,
// 1 on bad input. No dependencies and no network: Node 18+ only.
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const MIN_LINKED_POSTS = 5;
export const MIN_CLICKS = 30;
export const PROXY_LABEL = 'proxy, not clicks';
const FEW_CLICKS = 5;
const BIG_POSTS_SHOWN = 5;
const FIRST_LINE_MAX = 90;

const asNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
// Add a number that may be unknown: any unknown part makes the total unknown.
const addKnown = (total, value) => (total === null || value === null ? null : total + value);
const per1000 = (count, views) => (count === null || !views ? null : Math.round((count / views) * 10000) / 10);

function firstLine(text) {
  if (typeof text !== 'string') return null;
  const line = text.split(/\r?\n/).map((part) => part.trim()).find(Boolean);
  if (!line) return null;
  return line.length > FIRST_LINE_MAX ? `${line.slice(0, FIRST_LINE_MAX - 1)}…` : line;
}

/** Normalise read_post_performance rows (one result or several pages) into one map by post id. */
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
        first_line: firstLine(row.text ?? row.text_preview),
        full_first_line: (row.text ?? row.text_preview ?? '').split(/\r?\n/).map((part) => part.trim()).find(Boolean) ?? null,
        views: asNumber(metrics.views),
        replies: asNumber(metrics.replies),
      });
    }
  }
  return posts;
}

/** Sum tracked link rows per post. Rows with neither post id are returned as unmatched. */
export function joinLinks(links) {
  if (!Array.isArray(links)) throw new Error('attribution must be a read_link_attribution result with links');
  const byPost = new Map();
  let unmatched = 0;
  for (const link of links) {
    const id = link.root_threads_post_id ?? link.final_threads_post_id ?? null;
    if (!id) {
      unmatched += 1;
      continue;
    }
    const field = String(id);
    const entry = byPost.get(field) ?? {
      post_id: field,
      link_rows: 0,
      clicks: 0,
      unique_clicks: 0,
      conversions: 0,
      revenue: 0,
      permalink: null,
      link_first_line: null,
      source_kinds: [],
    };
    entry.link_rows += 1;
    entry.clicks = addKnown(entry.clicks, asNumber(link.clicks));
    entry.unique_clicks = addKnown(entry.unique_clicks, asNumber(link.unique_clicks));
    entry.conversions = addKnown(entry.conversions, asNumber(link.conversions));
    entry.revenue = addKnown(entry.revenue, asNumber(link.revenue));
    entry.permalink ??= link.root_permalink ?? link.post_permalink ?? null;
    entry.link_first_line ??= firstLine(link.root_post_text);
    if (link.source_kind && !entry.source_kinds.includes(link.source_kind)) entry.source_kinds.push(link.source_kind);
    byPost.set(field, entry);
  }
  return { byPost, unmatched };
}

const normaliseLine = (text) => firstLine(text)?.replace(/…$/, '').replace(/\s+/g, ' ').toLowerCase() ?? null;
const timeOf = (value) => {
  const ms = Date.parse(value ?? '');
  return Number.isFinite(ms) ? ms : null;
};

/** Find the post a plug reply belongs to from its get_post_thread result. */
export function parentPostFor(thread, posts) {
  const line = normaliseLine(thread?.full_text ?? thread?.parts?.[0]?.text);
  if (!line) return null;
  const replyTime = timeOf(thread?.timestamp);
  const candidates = [...posts.values()].filter((post) => normaliseLine(post.full_first_line ?? post.first_line) === line);
  const eligible = replyTime === null ? candidates : candidates.filter((post) => (timeOf(post.published_at) ?? Infinity) <= replyTime);
  if (eligible.length === 0) return null;
  if (eligible.length === 1 || replyTime !== null) {
    return eligible.sort((a, b) => (timeOf(b.published_at) ?? 0) - (timeOf(a.published_at) ?? 0))[0].post_id;
  }
  return null; // several same-line posts and no timestamp: stay unmatched rather than guess
}

/** Move link rows filed under a plug reply onto the parent post. */
export function attachPlugsToParents(byPost, posts, threads = {}) {
  const moved = [];
  for (const [id, entry] of [...byPost.entries()]) {
    if (posts.has(id) || !threads[id]) continue;
    const parentId = parentPostFor(threads[id], posts);
    if (!parentId) continue;
    const target = byPost.get(parentId);
    if (target) {
      target.link_rows += entry.link_rows;
      target.clicks = addKnown(target.clicks, entry.clicks);
      target.unique_clicks = addKnown(target.unique_clicks, entry.unique_clicks);
      target.conversions = addKnown(target.conversions, entry.conversions);
      target.revenue = addKnown(target.revenue, entry.revenue);
      for (const kind of entry.source_kinds) if (!target.source_kinds.includes(kind)) target.source_kinds.push(kind);
    } else {
      byPost.set(parentId, { ...entry, post_id: parentId, link_first_line: null });
    }
    byPost.delete(id);
    moved.push({ from: id, to: parentId });
  }
  return moved;
}

const byRateThenClicks = (a, b) =>
  (b.clicks_per_1000_views ?? -1) - (a.clicks_per_1000_views ?? -1) ||
  (b.unique_clicks ?? -1) - (a.unique_clicks ?? -1) ||
  (b.views ?? -1) - (a.views ?? -1) ||
  a.post_id.localeCompare(b.post_id);

export function rankMoneyPosts(input) {
  const attribution = input?.attribution;
  if (!attribution || typeof attribution !== 'object') throw new Error('attribution is required');
  const posts = collectPosts(input.performance);
  const { byPost, unmatched } = joinLinks(attribution.links);
  const plugsMoved = attachPlugsToParents(byPost, posts, input.threads ?? {});
  // A zero is only a measured zero when Threadify says it could have recorded a conversion.
  // No tracking metadata at all means unknown, not tracked.
  const measurable = attribution.conversion_tracking?.measurable;
  const conversionsTracked = measurable === true ? true : measurable === false ? false : null;
  const conversionsLabel =
    conversionsTracked === true ? 'conversions' : conversionsTracked === false ? 'conversions (not tracked)' : 'conversions (unknown)';

  const ranking = [...byPost.values()].map((link) => {
    const post = posts.get(link.post_id);
    const views = post?.views ?? null;
    return {
      post_id: link.post_id,
      first_line: post?.first_line ?? link.link_first_line,
      published_at: post?.published_at ?? null,
      permalink: link.permalink,
      views,
      clicks: link.clicks,
      unique_clicks: link.unique_clicks,
      clicks_per_1000_views: per1000(link.unique_clicks, views),
      conversions: conversionsTracked === true ? link.conversions : null,
      conversions_label: conversionsLabel,
      revenue: conversionsTracked === true ? link.revenue : null,
      may_say_sales: conversionsTracked === true && link.revenue !== null && link.revenue > 0,
      few_clicks: link.unique_clicks === null ? null : link.unique_clicks < FEW_CLICKS,
      source_kinds: link.source_kinds,
      views_known: views !== null,
    };
  }).sort(byRateThenClicks).map((row, index) => ({ rank: index + 1, ...row }));

  const bigPostsNoLink = [...posts.values()]
    .filter((post) => !byPost.has(post.post_id) && post.views !== null)
    .sort((a, b) => b.views - a.views || a.post_id.localeCompare(b.post_id))
    .slice(0, BIG_POSTS_SHOWN)
    .map(({ post_id, first_line, published_at, views }) => ({ post_id, first_line, published_at, views }));

  const linkedPosts = ranking.length;
  const clicksUnknownPosts = ranking.filter((row) => row.unique_clicks === null).map((row) => row.post_id);
  const uniqueClicks = ranking.reduce((sum, row) => sum + (row.unique_clicks ?? 0), 0);
  const reasons = [];
  if (linkedPosts < MIN_LINKED_POSTS) reasons.push(`fewer than ${MIN_LINKED_POSTS} linked posts (${linkedPosts})`);
  // Unknown clicks are not zero clicks: only measured totals can trigger the click threshold.
  if (uniqueClicks < MIN_CLICKS && clicksUnknownPosts.length === 0) reasons.push(`fewer than ${MIN_CLICKS} clicks (${uniqueClicks})`);
  const coldStart = reasons.length > 0;

  const asks = input.asks ?? {};
  const proxyRanking = coldStart
    ? [...posts.values()]
        .filter((post) => post.views)
        .map((post) => {
          const askReplies = asNumber(asks[post.post_id]);
          return {
            post_id: post.post_id,
            first_line: post.first_line,
            published_at: post.published_at,
            views: post.views,
            replies: post.replies,
            replies_per_1000_views: per1000(post.replies, post.views),
            ask_replies: askReplies,
            label: PROXY_LABEL,
          };
        })
        .sort((a, b) =>
          (b.replies_per_1000_views ?? -1) - (a.replies_per_1000_views ?? -1) ||
          (b.ask_replies ?? -1) - (a.ask_replies ?? -1) ||
          b.views - a.views ||
          a.post_id.localeCompare(b.post_id))
        .map((row, index) => ({ rank: index + 1, ...row }))
    : [];

  return {
    mode: coldStart ? 'proxy' : 'clicks',
    metric: 'unique clicks per 1,000 views',
    cold_start: { is_cold: coldStart, reasons, min_linked_posts: MIN_LINKED_POSTS, min_clicks: MIN_CLICKS },
    totals: {
      posts_read: posts.size,
      linked_posts: linkedPosts,
      unique_clicks: clicksUnknownPosts.length ? null : uniqueClicks,
      unique_clicks_known: uniqueClicks,
      clicks_unknown_posts: clicksUnknownPosts,
      clicks: ranking.some((row) => row.clicks === null) ? null : ranking.reduce((sum, row) => sum + row.clicks, 0),
      unmatched_link_rows: unmatched,
      linked_posts_missing_views: ranking.filter((row) => !row.views_known).map((row) => row.post_id),
      plug_rows_moved_to_post: plugsMoved,
      conversions_tracked: conversionsTracked,
    },
    ranking,
    big_posts_no_link: bigPostsNoLink,
    // While any linked post still has no views, a "no link" post may own one of those links.
    big_posts_no_link_caveat: ranking.some((row) => !row.views_known)
      ? 'some links could not be matched to a post, so a post listed here may still have a link'
      : null,
    proxy_ranking: proxyRanking,
  };
}

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return JSON.parse(data);
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  readStdin()
    .then((input) => process.stdout.write(`${JSON.stringify(rankMoneyPosts(input), null, 2)}\n`))
    .catch((error) => {
      process.stderr.write(`${JSON.stringify({ status: 'failed', error: error.message })}\n`);
      process.exitCode = 1;
    });
}
