import assert from 'node:assert/strict';
import test from 'node:test';
import { analyse, labelFor, median, renderHtml, labelledPosts } from '../../plugins/threadify/skills/threadify-whats-working/scripts/whats-working.mjs';

const post = (id, day, views, text = `post ${id}`) => ({ post_id: id, published_at: `2026-${day}T10:00:00Z`, text, metrics: views === undefined ? {} : { views } });
const input = (posts, extra = {}) => ({ now: '2026-10-14T00:00:00Z', from: '2026-01-01', performance: { posts }, ...extra });

test('labels are relative to the account median: dead under 1x, stuck to 3x, alive at 3x+', () => {
  assert.equal(labelFor(0.4), 'dead');
  assert.equal(labelFor(1), 'stuck');
  assert.equal(labelFor(2.9), 'stuck');
  assert.equal(labelFor(3), 'alive');
  assert.equal(labelFor(null), 'unknown');
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
});

test('coverage leaves out posts outside the window, too-new posts and unknown views - never as 0', () => {
  const result = analyse(input([
    post('a', '01-05', 70000), post('b', '02-05', 600), post('c', '03-05', 500), post('d', '04-05', 700),
    post('e', '05-05'), post('f', '10-13', 5), { ...post('g', '01-01', 10), published_at: '2025-12-30T10:00:00Z' },
  ]));
  assert.equal(result.coverage.posts_returned, 6);
  assert.equal(result.coverage.too_new, 1);
  assert.equal(result.coverage.unknown_views, 1);
  assert.equal(result.coverage.posts_counted, 4);
  assert.equal(result.coverage.first_post, '2026-01-05T10:00:00Z');
  assert.equal(result.median_views, 650);
  assert.ok(Number.isInteger(result.median_views));
  assert.equal(result.top_multiple, 107.7);
  assert.deepEqual(result.shares_percent, { dead: 50, stuck: 25, alive: 25 });
  assert.equal(result.never_broke_out_percent, 75);
  assert.equal(result.monthly.length, 4);
});

test('patterns rank by median multiple and small samples are flagged, not ranked', () => {
  const posts = [];
  const tags = {};
  for (let i = 0; i < 6; i += 1) { posts.push(post(`s${i}`, `0${1 + i}-10`, 5000 + i)); tags[`s${i}`] = { pattern: 'stunt' }; }
  for (let i = 0; i < 6; i += 1) { posts.push(post(`t${i}`, `0${1 + i}-12`, 300 + i)); tags[`t${i}`] = { pattern: 'tips' }; }
  posts.push(post('x', '07-01', 900000)); tags.x = { pattern: 'one-off' };
  const result = analyse(input(posts, { tags }));
  assert.equal(result.number_one.pattern, 'stunt');
  assert.equal(result.number_one.examples.length, 3);
  assert.equal(result.patterns.find((p) => p.pattern === 'one-off').small_sample, true);
  assert.ok(result.most_dead.every((p) => p.median_multiple < 1));
  assert.equal(result.most_dead[0].pattern, 'tips');
});

test('the report page is self-contained and escapes post text', () => {
  const data = input([post('a', '01-05', 70000, '<script>alert(1)</script>'), post('b', '02-05', 600)]);
  const html = renderHtml(analyse(data), { handle: '@demo', posts: labelledPosts(data) });
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /src="http|href="http/);
  assert.match(html, /Every post against your median/);
});

test('bad input fails loudly', () => {
  assert.throws(() => analyse(null));
  assert.throws(() => analyse({ performance: { nope: true } }));
});

test('the median and alive guides stay inside the chart when nothing breaks out', () => {
  const data = input([post('a', '01-05', 100), post('b', '02-05', 200), post('c', '03-05', 300)]);
  const html = renderHtml(analyse(data), { posts: labelledPosts(data) });
  const ys = [...html.matchAll(/<line [^>]*y1="([-\d.]+)"/g)].map((match) => Number(match[1]));
  assert.equal(ys.length, 2);
  for (const y of ys) assert.ok(y >= 0 && y <= 520, `guide at y=${y} is off the chart`);
});
