import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  checkPost,
  checkPosts,
  lowercasePosts,
} from '../../plugins/threadify/skills/threadify-money-posts/scripts/casing-guard.mjs';

const script = 'plugins/threadify/skills/threadify-money-posts/scripts/casing-guard.mjs';

test('lowercasing with proper nouns kept passes and proves lower(original) == lower(final)', () => {
  const original = 'Views are not money. Threadify shows Which posts get Clicks in Perth.';
  const result = lowercasePosts({ posts: [{ id: 'post-1', original, keep: ['Threadify', 'Perth'] }] });
  assert.equal(result.status, 'PASS');
  const [post] = result.posts;
  assert.equal(post.final, 'views are not money. Threadify shows which posts get clicks in Perth.');
  assert.equal(post.lower_equal, true);
  assert.equal(post.final.toLowerCase(), original.toLowerCase());
  assert.match(post.final_sha256, /^[0-9a-f]{64}$/);
});

test('unchanged Threadify copy passes', () => {
  const post = checkPost({ id: 'plug-1', original: 'Get the guide: https://Example.com/Guide', final: 'Get the guide: https://Example.com/Guide' });
  assert.equal(post.status, 'PASS');
  assert.equal(post.unchanged, true);
  assert.equal(post.lower_equal, true);
});

test('any edit beyond lowercasing fails, so the original is shown unchanged', () => {
  const edited = checkPost({ original: 'Stop chasing views.', final: 'stop chasing likes.' });
  assert.equal(edited.status, 'FAIL');
  assert.equal(edited.lower_equal, false);
  assert.deepEqual(edited.reasons, ['wording_changed:views']);
  assert.equal(checkPost({ original: 'Stop chasing views.', final: 'stop chasing views!' }).status, 'FAIL');
  assert.equal(checkPost({ original: 'stop chasing views', final: 'Stop chasing views' }).status, 'FAIL', 'uppercasing is not allowed');
  assert.equal(checkPost({ original: 'I use Threadify.', final: 'i use threadify.', keep: ['I', 'Threadify'] }).status, 'FAIL');
  assert.equal(checkPost({ original: 'See https://Example.com/A', final: 'see https://example.com/a' }).status, 'FAIL');
});

test('threads are checked part by part', () => {
  assert.equal(checkPost({ original: ['One Part.', 'Two Part.'], final: ['one part.', 'two part.'] }).lower_equal, true);
  const merged = checkPost({ original: ['One Part.', 'Two Part.'], final: ['one part. two part.'] });
  assert.equal(merged.status, 'FAIL');
  assert.equal(merged.lower_equal, false);
});

test('a batch fails when any post or plug fails, and the CLI exits 1', () => {
  const batch = checkPosts({ posts: [
    { id: 'post-1', original: 'Hello World', final: 'hello world' },
    { id: 'plug-1', original: 'Hello World', final: 'Hi World' },
  ] });
  assert.equal(batch.status, 'FAIL');
  assert.deepEqual(batch.posts.map((post) => post.status), ['PASS', 'FAIL']);
  const run = (input) => spawnSync(process.execPath, [script, 'check'], { input: JSON.stringify(input), encoding: 'utf8' });
  assert.equal(run({ posts: [{ id: '1', original: 'Hello', final: 'hello' }] }).status, 0);
  assert.equal(run({ posts: [{ id: '1', original: 'Hello', final: 'Hi' }] }).status, 1);
});
