import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  checkPost,
  checkPosts,
  checkText,
  lowercaseExceptProperNouns,
  lowercasePosts,
} from '../../plugins/threadify/skills/threadify-run-my-threads/scripts/casing-guard.mjs';

const script = 'plugins/threadify/skills/threadify-run-my-threads/scripts/casing-guard.mjs';
const original = 'I built Threadify in Perth.\n\nMost agents burn tokens. Mine runs Once a day.';

test('pure lowercasing passes, and unchanged text passes', () => {
  assert.equal(checkText(original, original.toLowerCase()).status, 'PASS');
  const same = checkText(original, original);
  assert.equal(same.status, 'PASS');
  assert.equal(same.unchanged, true);
});

test('any word change, addition or removal fails', () => {
  assert.deepEqual(checkText('Ship it today.', 'ship it tomorrow.').reasons, ['wording_changed:today']);
  assert.equal(checkText('Ship it today.', 'ship it now.').status, 'FAIL');
  assert.equal(checkText('Ship it today.', 'ship it today. really.').status, 'FAIL');
  assert.equal(checkText('Ship it today.', 'ship today.').status, 'FAIL');
  assert.equal(checkText('Ship it today.', 'ship ti today.').status, 'FAIL');
});

test('punctuation, spacing, line-break and emoji changes fail', () => {
  assert.equal(checkText('Ship it today.', 'ship it today!').status, 'FAIL');
  assert.equal(checkText('Ship it, today.', 'ship it today.').status, 'FAIL');
  assert.equal(checkText('Ship it today.', 'ship it  today.').status, 'FAIL');
  assert.equal(checkText('Ship it\ntoday.', 'ship it today.').status, 'FAIL');
  assert.equal(checkText('Ship it 🚀', 'ship it 🔥').status, 'FAIL');
  assert.equal(checkText('Don’t wait', "don't wait").status, 'FAIL');
});

test('uppercasing is not a permitted change', () => {
  assert.deepEqual(checkText('ship it today', 'Ship it today').reasons, ['casing_not_lowercase:ship']);
});

test('lowercasing keeps listed proper nouns, links, handles and hashtags', () => {
  const keep = ['I', 'Threadify', 'Perth', 'New York'];
  const text = "I'm in New York with Threadify. See https://Example.com/AbC and @Lennox_Saint #BuildInPublic";
  const lowered = lowercaseExceptProperNouns(text, keep);
  assert.equal(lowered, "I'm in New York with Threadify. see https://Example.com/AbC and @Lennox_Saint #BuildInPublic");
  assert.equal(checkText(text, lowered, keep).status, 'PASS');
});

test('changing the case of a link, handle or hashtag fails even in check mode', () => {
  assert.deepEqual(checkText('See https://EXAMPLE.com/A now', 'see https://example.com/a now').reasons, ['protected_span_changed']);
  assert.deepEqual(checkText('Hi @Lennox_Saint', 'hi @lennox_saint').reasons, ['protected_span_changed']);
  assert.deepEqual(checkText('Go #BuildInPublic', 'go #buildinpublic').reasons, ['protected_span_changed']);
});

test('context-sensitive Unicode lowercasing passes', () => {
  for (const text of ['ΟΣ ΚΑΙ ΟΣΟΙ', 'İSTANBUL Güzel']) {
    const lowered = lowercaseExceptProperNouns(text);
    assert.equal(checkText(text, lowered).status, 'PASS', text);
  }
});

test('a word may only be unchanged or fully lowercased', () => {
  assert.deepEqual(checkText('HeLLo world', 'heLLo world').reasons, ['casing_not_lowercase:HeLLo']);
});

test('lowercasing a listed proper noun fails when a keep list is given', () => {
  const result = checkText('I use Threadify daily.', 'i use threadify daily.', ['I', 'Threadify']);
  assert.equal(result.status, 'FAIL');
  assert.deepEqual(result.reasons, ['proper_noun_lowercased:I', 'proper_noun_lowercased:Threadify']);
});

test('threads are checked part by part and a changed part count fails', () => {
  const parts = ['First Part.', 'Second Part.'];
  assert.equal(checkPost({ original: parts, final: ['first part.', 'second part.'] }).status, 'PASS');
  assert.deepEqual(checkPost({ original: parts, final: ['first part.', 'second pert.'] }).reasons, ['part_2:wording_changed:Part']);
  assert.deepEqual(checkPost({ original: parts, final: ['first part. second part.'] }).reasons, ['thread_parts_changed']);
});

test('batch results bind each final text to a hash and fail if any post fails', () => {
  const batch = lowercasePosts({ posts: [{ id: '1', original: 'Hello World', keep: ['World'] }] });
  assert.equal(batch.status, 'PASS');
  assert.equal(batch.posts[0].final, 'hello World');
  assert.match(batch.posts[0].final_sha256, /^[0-9a-f]{64}$/);
  const mixed = checkPosts({ posts: [
    { id: '1', original: 'Hello', final: 'hello' },
    { id: '2', original: 'Hello', final: 'Hi' },
  ] });
  assert.equal(mixed.status, 'FAIL');
  assert.deepEqual(mixed.posts.map((post) => post.status), ['PASS', 'FAIL']);
  assert.throws(() => checkPosts({ posts: [] }), /non-empty/);
});

test('CLI exits 0 on PASS and 1 on FAIL', () => {
  const run = (command, input) => spawnSync(process.execPath, [script, command], { input: JSON.stringify(input), encoding: 'utf8' });
  const pass = run('check', { posts: [{ id: '1', original: 'Hello World', final: 'hello world' }] });
  assert.equal(pass.status, 0, pass.stderr);
  assert.equal(JSON.parse(pass.stdout).status, 'PASS');
  const fail = run('check', { posts: [{ id: '1', original: 'Hello World', final: 'Hello there' }] });
  assert.equal(fail.status, 1);
  assert.equal(JSON.parse(fail.stdout).status, 'FAIL');
  const bad = run('rewrite', { posts: [] });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /usage/);
});
