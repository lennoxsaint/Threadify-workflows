import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import test from 'node:test';
import {
  BANNED_OPENERS,
  checkHook,
  checkHooks,
  firstSentence,
  hookOf,
} from '../../plugins/threadify/skills/threadify-run-my-threads/scripts/hook-check.mjs';

const script = 'plugins/threadify/skills/threadify-run-my-threads/scripts/hook-check.mjs';
const codes = (result) => result.reasons;

test('a tight hook passes', () => {
  const result = checkHook({ id: 1, text: 'I lost my first client in week two.\n\nHere is what it taught me.' });
  assert.equal(result.status, 'PASS');
  assert.equal(result.first_sentence_words, 8);
  assert.equal(result.has_number, false);
});

test('the hook is post 1 up to its first blank line, and the first sentence ends at . ! ? : or a line break', () => {
  assert.equal(hookOf('Line one.\nLine two.\n\nBody.'), 'Line one.\nLine two.');
  assert.equal(firstSentence('Stop posting daily. Do this instead.'), 'Stop posting daily.');
  assert.equal(firstSentence('5 mistakes I made:\n1. one'), '5 mistakes I made:');
  assert.equal(checkHook({ text: ['Short hook here, true story.', 'Part two with https://example.com'] }).status, 'PASS');
});

test('banned openers fail, including curly apostrophes', () => {
  assert.deepEqual(codes(checkHook({ text: 'Let’s talk about pricing your first offer.' })), ["FAIL:banned_opener:Let's talk about"]);
  assert.equal(checkHook({ text: 'Unpopular opinion: posting daily is overrated.' }).status, 'FAIL');
  assert.equal(checkHook({ text: 'So, here is what I learned this year.' }).status, 'FAIL');
  assert.equal(checkHook({ text: 'In today\'s market, nobody reads long posts.' }).status, 'FAIL');
});

test('links in post 1, emoji overload, hype emoji, ALL CAPS and slop in the hook fail', () => {
  assert.ok(codes(checkHook({ text: 'Grab my free guide at https://example.com today.' })).includes('FAIL:link_in_post_1'));
  assert.ok(codes(checkHook({ text: 'My best week ever 😀😀😀 here.' })).includes('FAIL:emoji_overload_in_hook'));
  assert.ok(codes(checkHook({ text: 'This changed my whole week 🚀' })).includes('FAIL:hype_emoji_in_hook'));
  assert.ok(codes(checkHook({ text: 'STOP POSTING EVERY SINGLE DAY.' })).includes('FAIL:all_caps_hook'));
  assert.ok(codes(checkHook({ text: 'This one habit will unlock your mornings.' })).includes('FAIL:slop_in_hook:unlock'));
});

test('a buried hook fails; a long or very short first sentence warns', () => {
  const buried = 'When I first started writing online I had no idea what I was doing and nobody read a single thing I wrote.';
  assert.equal(checkHook({ text: buried }).status, 'FAIL');
  assert.deepEqual(codes(checkHook({ text: 'Most creators quit writing online right before it starts to work for them.' })), ['WARN:long_first_sentence:13_words']);
  assert.deepEqual(codes(checkHook({ text: 'Stop. Read this before you post again.' })), ['WARN:short_first_sentence:1_words']);
});

test('a yes/no question hook fails', () => {
  assert.deepEqual(codes(checkHook({ text: 'Are you posting at the right time?' })), ['FAIL:yes_no_question_hook']);
  assert.equal(checkHook({ text: 'Why do most creators quit in month two?' }).status, 'PASS');
});

test('long hooks, slop later in the post and em-dash overload warn', () => {
  assert.ok(codes(checkHook({ text: 'One line.\nTwo lines here.\nThree lines here.\nFour lines here.' })).includes('WARN:hook_over_3_lines'));
  assert.ok(codes(checkHook({ text: 'I write one post a day.\n\nIt is a real game-changer.' })).includes('WARN:slop_in_body:game-changer'));
  assert.ok(codes(checkHook({ text: 'I write one post a day.\n\nShort — sharp — done.' })).includes('WARN:em_dash_overload'));
});

test('a number in the hook is flagged for the owner to confirm it is true', () => {
  assert.equal(checkHook({ text: 'I wrote 300 posts before one worked.' }).has_number, true);
});

test('the banned-opener list matches the playbook exactly', () => {
  const playbook = fs.readFileSync('plugins/threadify/skills/threadify-run-my-threads/references/threads-playbook.md', 'utf8');
  const section = playbook.split('### Banned openers')[1].split('\n\n')[2];
  const listed = section.split('\n').filter((line) => line.startsWith('- ')).map((line) => line.slice(2));
  assert.deepEqual(listed, BANNED_OPENERS);
});

test('overall status is the worst post; CLI exits 1 only on FAIL', () => {
  const input = { posts: [{ id: 1, text: 'I lost my first client in week two.' }, { id: 2, text: 'Stop. Read this before you post again.' }] };
  assert.equal(checkHooks(input).status, 'WARN');
  const warn = spawnSync(process.execPath, [script], { input: JSON.stringify(input), encoding: 'utf8' });
  assert.equal(warn.status, 0, warn.stderr);
  input.posts.push({ id: 3, text: 'Did you know most posts flop?' });
  const failed = spawnSync(process.execPath, [script], { input: JSON.stringify(input), encoding: 'utf8' });
  assert.equal(failed.status, 1);
  assert.equal(JSON.parse(failed.stdout).posts[2].status, 'FAIL');
  const bad = spawnSync(process.execPath, [script], { input: '{"posts":[]}', encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /"status":"failed"/);
  assert.throws(() => checkHook({ text: 42 }), /string/);
});
