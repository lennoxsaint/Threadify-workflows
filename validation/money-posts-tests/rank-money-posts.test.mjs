import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  MIN_CLICKS,
  MIN_LINKED_POSTS,
  PROXY_LABEL,
  joinLinks,
  rankMoneyPosts,
} from '../../plugins/threadify/skills/threadify-money-posts/scripts/rank-money-posts.mjs';

const script = 'plugins/threadify/skills/threadify-money-posts/scripts/rank-money-posts.mjs';

// Synthetic public fixture: no real post bodies or account ids.
const post = (id, views, replies, text, publishedAt = '2026-09-01T01:00:00Z') => ({
  post_id: id,
  published_at: publishedAt,
  text_preview: text,
  metrics: { views, likes: 0, replies, reposts: 0, quotes: 0, shares: 0 },
});
const link = (root, uniqueClicks, extra = {}) => ({
  source_kind: 'auto_plug',
  root_threads_post_id: root,
  final_threads_post_id: root ? `${root}9` : null,
  post_permalink: root ? `https://www.threads.com/@creator/post/${root}` : null,
  root_post_text: 'Linked post',
  clicks: uniqueClicks + 2,
  unique_clicks: uniqueClicks,
  conversions: 0,
  revenue: 0,
  ...extra,
});

const performance = {
  window_days: 90,
  total_returned: 8,
  posts: [
    post('1001', 100000, 400, 'The viral one\nwith a second line'),
    post('1002', 800, 30, 'Small post, big ask'),
    post('1003', 5000, 50, 'Medium post'),
    post('1004', 2000, 10, 'Another linked post'),
    post('1005', 1500, 5, 'Fifth linked post'),
    post('1006', 90000, 900, 'Big post, no link'),
    post('1007', 60000, 100, 'Second big post, no link'),
    post('1008', 0, 0, 'Zero views'),
  ],
};
const warmAttribution = {
  conversion_tracking: { state: 'measuring', measurable: true },
  links: [
    link('1001', 20),
    link('1002', 30, { conversions: 6 }),
    link('1002', 20, { source_kind: 'post_body', conversions: 4, revenue: 0 }),
    link('1003', 10, { conversions: 1, revenue: 49 }),
    link('1004', 5),
    link('1005', 3),
    link(null, 7, { final_threads_post_id: '1005' }),
    link(null, 9, { final_threads_post_id: null }),
  ],
};

test('link rows join by root_threads_post_id, fall back to final_threads_post_id, and sum per post', () => {
  const { byPost, unmatched } = joinLinks(warmAttribution.links);
  assert.equal(unmatched, 1);
  assert.equal(byPost.get('1002').unique_clicks, 50);
  assert.equal(byPost.get('1002').link_rows, 2);
  assert.equal(byPost.get('1002').conversions, 10);
  assert.deepEqual(byPost.get('1002').source_kinds, ['auto_plug', 'post_body']);
  assert.equal(byPost.get('1005').unique_clicks, 10, 'fallback row joined to its post');
});

test('ranking is unique clicks per 1,000 views, not views', () => {
  const result = rankMoneyPosts({ attribution: warmAttribution, performance });
  assert.equal(result.mode, 'clicks');
  assert.equal(result.metric, 'unique clicks per 1,000 views');
  assert.deepEqual(result.ranking.map((row) => row.post_id), ['1002', '1005', '1004', '1003', '1001']);
  const [top] = result.ranking;
  assert.equal(top.rank, 1);
  assert.equal(top.clicks_per_1000_views, 62.5);
  assert.equal(top.first_line, 'Small post, big ask');
  const viral = result.ranking.find((row) => row.post_id === '1001');
  assert.equal(viral.clicks_per_1000_views, 0.2);
  assert.equal(viral.first_line, 'The viral one');
  assert.equal(result.totals.linked_posts, 5);
  assert.equal(result.totals.unique_clicks, 95);
  assert.equal(result.totals.unmatched_link_rows, 1);
  assert.deepEqual(result.proxy_ranking, []);
});

test('conversions keep the tool label, and sales are allowed only with revenue above 0', () => {
  const result = rankMoneyPosts({ attribution: warmAttribution, performance });
  const byId = Object.fromEntries(result.ranking.map((row) => [row.post_id, row]));
  assert.equal(byId['1002'].conversions_label, 'conversions');
  assert.equal(byId['1002'].conversions, 10);
  assert.equal(byId['1002'].may_say_sales, false);
  assert.equal(byId['1003'].may_say_sales, true);
  const untracked = rankMoneyPosts({
    attribution: { ...warmAttribution, conversion_tracking: { state: 'no_receiver', measurable: false } },
    performance,
  });
  assert.equal(untracked.ranking[0].conversions, null, 'an unmeasured zero stays unknown');
  assert.equal(untracked.ranking[0].conversions_label, 'conversions (not tracked)');
  assert.equal(untracked.ranking[0].may_say_sales, false);
});

test('big posts with no link are listed by views; zero or missing views stay unknown', () => {
  const result = rankMoneyPosts({ attribution: warmAttribution, performance });
  assert.deepEqual(result.big_posts_no_link.map((row) => row.post_id), ['1006', '1007', '1008']);
  const missing = rankMoneyPosts({
    attribution: { links: [...warmAttribution.links, link('2001', 12)] },
    performance,
  });
  const row = missing.ranking.find((entry) => entry.post_id === '2001');
  assert.equal(row.views, null);
  assert.equal(row.clicks_per_1000_views, null);
  assert.equal(missing.ranking.at(-1).post_id, '2001', 'unknown rates sort last');
  assert.deepEqual(missing.totals.linked_posts_missing_views, ['2001']);
});

test('several performance pages merge, so a looked-up post fills its views', () => {
  const lookup = { posts: [post('2001', 400, 4, 'Looked up by post_id')] };
  const result = rankMoneyPosts({
    attribution: { links: [link('2001', 12)] },
    performance: [performance, lookup],
  });
  assert.equal(result.ranking[0].clicks_per_1000_views, 30);
});

test(`cold start below ${MIN_LINKED_POSTS} linked posts or ${MIN_CLICKS} clicks ranks on labelled proxy signals`, () => {
  assert.equal(MIN_LINKED_POSTS, 5);
  assert.equal(MIN_CLICKS, 30);
  assert.equal(PROXY_LABEL, 'proxy, not clicks');
  const fewPosts = rankMoneyPosts({ attribution: { links: [link('1001', 40), link('1002', 40)] }, performance });
  assert.equal(fewPosts.mode, 'proxy');
  assert.deepEqual(fewPosts.cold_start.reasons, ['fewer than 5 linked posts (2)']);
  const fewClicks = rankMoneyPosts({
    attribution: { links: ['1001', '1002', '1003', '1004', '1005'].map((id) => link(id, 5)) },
    performance,
  });
  assert.equal(fewClicks.mode, 'proxy');
  assert.deepEqual(fewClicks.cold_start.reasons, ['fewer than 30 clicks (25)']);
  const exactly = rankMoneyPosts({
    attribution: { links: ['1001', '1002', '1003', '1004', '1005'].map((id) => link(id, 6)) },
    performance,
  });
  assert.equal(exactly.mode, 'clicks', '5 posts and 30 clicks is enough');

  const cold = rankMoneyPosts({ attribution: { links: [] }, performance, asks: { 1002: 3 } });
  assert.equal(cold.mode, 'proxy');
  assert.equal(cold.ranking.length, 0);
  assert.ok(cold.proxy_ranking.every((row) => row.label === 'proxy, not clicks'));
  assert.deepEqual(cold.proxy_ranking.slice(0, 2).map((row) => row.post_id), ['1002', '1006'], 'ties break on views');
  assert.equal(cold.proxy_ranking[0].replies_per_1000_views, 37.5);
  assert.equal(cold.proxy_ranking[0].ask_replies, 3);
  assert.equal(cold.proxy_ranking[1].ask_replies, null, 'unread asks stay unknown');
  assert.ok(!cold.proxy_ranking.some((row) => row.post_id === '1008'), 'zero-view posts are not ranked');
});

test('CLI prints the ranking and exits 1 on bad input', () => {
  const run = (input) => spawnSync(process.execPath, [script], { input, encoding: 'utf8' });
  const ok = run(JSON.stringify({ attribution: warmAttribution, performance }));
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(JSON.parse(ok.stdout).ranking[0].post_id, '1002');
  const bad = run(JSON.stringify({ performance }));
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /attribution is required/);
});

test('missing click counts stay unknown and never trigger the click threshold', () => {
  const links = ['1001', '1002', '1003', '1004', '1005'].map((id) => link(id, 2));
  links.push({ ...link('1006', 0), clicks: undefined, unique_clicks: undefined });
  const result = rankMoneyPosts({ attribution: { conversion_tracking: { measurable: true }, links }, performance });
  const row = result.ranking.find((entry) => entry.post_id === '1006');
  assert.equal(row.unique_clicks, null);
  assert.equal(row.clicks, null);
  assert.equal(row.clicks_per_1000_views, null, 'not a measured zero rate');
  assert.equal(row.few_clicks, null);
  assert.equal(result.ranking.at(-1).post_id, '1006', 'unknown rates sort last');
  assert.equal(result.totals.unique_clicks, null);
  assert.equal(result.totals.unique_clicks_known, 10);
  assert.deepEqual(result.totals.clicks_unknown_posts, ['1006']);
  assert.equal(result.mode, 'clicks', 'unknown clicks are not zero clicks');
});

test('absent conversion metadata is unknown, not a tracked zero', () => {
  const result = rankMoneyPosts({ attribution: { links: warmAttribution.links }, performance });
  assert.equal(result.totals.conversions_tracked, null);
  assert.ok(result.ranking.every((row) => row.conversions === null && row.revenue === null));
  assert.ok(result.ranking.every((row) => row.conversions_label === 'conversions (unknown)'));
  assert.ok(result.ranking.every((row) => row.may_say_sales === false));
});
