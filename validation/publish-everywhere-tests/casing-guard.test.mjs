import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  checkPost,
  checkPosts,
  lowercasePosts,
} from '../../plugins/threadify/skills/threadify-publish-everywhere/scripts/casing-guard.mjs';
import { youtubeTitle } from '../../plugins/threadify/skills/threadify-publish-everywhere/scripts/publish-card.mjs';

const script = 'plugins/threadify/skills/threadify-publish-everywhere/scripts/casing-guard.mjs';

test('lowercasing with proper nouns kept passes and proves lower(original) == lower(final)', () => {
  const original = 'I Filmed One Video. Threadify Scheduled It To YouTube, Threads And X.';
  const result = lowercasePosts({ posts: [{ id: 'post', original, keep: ['I', 'Threadify', 'YouTube', 'Threads', 'X'] }] });
  assert.equal(result.status, 'PASS');
  const [post] = result.posts;
  assert.equal(post.final, 'I filmed one video. Threadify scheduled it to YouTube, Threads and X.');
  assert.equal(post.lower_equal, true);
  assert.equal(post.final.toLowerCase(), original.toLowerCase());
  assert.match(post.final_sha256, /^[0-9a-f]{64}$/);
});

test('the lowercased title is still the first line of the lowercased post', () => {
  const original = 'One Video, Three Places.\n\nThreadify Wrote This.';
  const [post] = lowercasePosts({ posts: [{ id: 'post', original, keep: ['Threadify'] }] }).posts;
  const title = youtubeTitle({ post_text: post.final }).title;
  assert.equal(title, 'one video, three places.');
  assert.equal(checkPost({ id: 'title', original: youtubeTitle({ post_text: original }).title, final: title }).status, 'PASS');
});

test('unchanged Threadify copy passes', () => {
  const post = checkPost({ id: 'post', original: 'Watch: https://Example.com/Video', final: 'Watch: https://Example.com/Video' });
  assert.equal(post.status, 'PASS');
  assert.equal(post.unchanged, true);
  assert.equal(post.lower_equal, true);
});

test('any edit beyond lowercasing fails, so the original is shown unchanged', () => {
  const edited = checkPost({ original: 'I filmed one video.', final: 'i filmed one clip.' });
  assert.equal(edited.status, 'FAIL');
  assert.equal(edited.lower_equal, false);
  assert.deepEqual(edited.reasons, ['wording_changed:video']);
  assert.equal(checkPost({ original: 'One video.', final: 'one video!' }).status, 'FAIL', 'punctuation is wording');
  assert.equal(checkPost({ original: 'one video', final: 'One video' }).status, 'FAIL', 'uppercasing is not allowed');
  assert.equal(checkPost({ original: 'One video.', final: 'one video. new line' }).status, 'FAIL', 'adding words is not allowed');
  assert.equal(checkPost({ original: 'I use Threadify.', final: 'i use threadify.', keep: ['I', 'Threadify'] }).status, 'FAIL');
  assert.equal(checkPost({ original: 'See https://Example.com/A', final: 'see https://example.com/a' }).status, 'FAIL');
});

test('a batch fails when the post or the title fails, and the CLI exits 1', () => {
  const batch = checkPosts({ posts: [
    { id: 'post', original: 'Hello World', final: 'hello world' },
    { id: 'title', original: 'Hello World', final: 'Hi World' },
  ] });
  assert.equal(batch.status, 'FAIL');
  assert.deepEqual(batch.posts.map((post) => post.status), ['PASS', 'FAIL']);
  const run = (input) => spawnSync(process.execPath, [script, 'check'], { input: JSON.stringify(input), encoding: 'utf8' });
  assert.equal(run({ posts: [{ id: '1', original: 'Hello', final: 'hello' }] }).status, 0);
  assert.equal(run({ posts: [{ id: '1', original: 'Hello', final: 'Hi' }] }).status, 1);
});
