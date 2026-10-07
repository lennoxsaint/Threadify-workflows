#!/usr/bin/env node
// Run My Threads hook check: a deterministic read of line 1 of every post
// Threadify generated. It reports; it never edits. On FAIL the agent asks
// Threadify once for a rewrite with the reasons in `inputText`.
//
//   node hook-check.mjs < {"posts":[{"id":1,"text":"..."},{"id":2,"text":["part 1","part 2"]}]}
//
// `text` is a string or an array of thread parts; the hook is post 1 up to its
// first blank line. Output is JSON on stdout with PASS, WARN or FAIL per post and
// the reasons. Exit 0 when no post FAILs, 1 on any FAIL or bad input.
// No dependencies and no network: Node 18+ only.
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Same list, same order, as "Banned openers" in references/threads-playbook.md.
export const BANNED_OPENERS = [
  "In today's",
  'I want to talk about',
  "Let's talk about",
  "Here's the thing",
  'Did you know',
  'Have you ever wondered',
  'Ever wonder',
  'Unpopular opinion:',
  'Hot take:',
  'Thread 🧵',
  '🧵',
  'Buckle up',
  'So,',
  "I've been thinking",
  'Let me tell you',
  'Today I want to',
  'In this thread',
  'A thread on',
  "Let's dive in",
  "I don't know who needs to hear this",
  'Are you struggling',
  'Do you want to',
  'Hey everyone',
  'Fun fact:',
  'What if I told you',
  'Picture this',
  'Imagine this',
  'Hey guys',
  'Hi everyone',
  'Just wanted to',
  'Friendly reminder',
  'In this post',
];

export const SLOP = [
  'delve', 'game-changer', 'game changer', 'unlock', 'leverage', 'utilize', 'synergy', 'paradigm', 'robust',
  'ecosystem', 'holistic', 'seamless', 'cutting-edge', 'transformative', 'revolutionary', 'disruptive',
  'innovative', 'best-in-class', 'empower', 'streamline', 'supercharge', 'elevate', 'realm', 'tapestry',
  'foster', 'nuanced', 'myriad', 'plethora', 'showcase', 'vibrant', 'furthermore', 'moreover',
  "in today's fast-paced world", "in today's world", 'navigate the landscape', 'at the end of the day',
  "it's important to note", 'in conclusion', 'in summary', 'when it comes to', "let's dive in",
];

const FIRST_SENTENCE_MIN = 4;
const FIRST_SENTENCE_MAX = 8;
const BURIED_HOOK_WORDS = 15;
const HOOK_MAX_LINES = 3;
const HOOK_MAX_CHARS = 200;
const HOOK_MAX_EMOJI = 2;

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
const EMOJI = /\p{Extended_Pictographic}/gu;
const LINK = /https?:\/\/\S+|www\.\S+|\b[\w-]+\.(?:com|co|io|ai|app|net|org|me|ly|link)\b(?:\/\S*)?/iu;
const YES_NO_START = /^(are|is|do|does|did|can|could|have|has|will|would|should)\b/i;

const plain = (text) => text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').trim();
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function containsTerm(text, term) {
  return new RegExp(`(^|[^\\p{L}])${escape(term)}($|[^\\p{L}])`, 'iu').test(text);
}

/** Post 1 up to its first blank line. */
export function hookOf(post1) {
  return post1.replace(/\r\n/g, '\n').trim().split(/\n\s*\n/)[0];
}

/** The first sentence: up to the first . ! ? : or line break. */
export function firstSentence(hook) {
  const match = hook.match(/^[\s\S]*?(?:[.!?:](?=\s|$)|\n|$)/);
  return (match ? match[0] : hook).trim();
}

/** Check one post. Returns { id, status, hook, first_sentence, first_sentence_words, has_number, reasons }. */
export function checkHook({ id = null, text }) {
  const parts = Array.isArray(text) ? text : [text];
  if (!parts.length || parts.some((part) => typeof part !== 'string')) throw new Error('text must be a string or an array of strings');
  const post1 = parts[0];
  const hook = hookOf(post1);
  const sentence = firstSentence(hook);
  const words = sentence.match(WORD) ?? [];
  const reasons = [];
  const failIf = (condition, code) => condition && reasons.push({ level: 'FAIL', code });
  const warnIf = (condition, code) => condition && reasons.push({ level: 'WARN', code });
  const opener = plain(hook).toLowerCase();

  failIf(!hook.trim(), 'empty_hook');
  const banned = BANNED_OPENERS.find((entry) => opener.startsWith(plain(entry).toLowerCase()));
  failIf(Boolean(banned), `banned_opener:${banned}`);
  failIf(LINK.test(post1), 'link_in_post_1');
  failIf(words.length > BURIED_HOOK_WORDS, `buried_hook:${words.length}_words`);
  warnIf(words.length > FIRST_SENTENCE_MAX && words.length <= BURIED_HOOK_WORDS, `long_first_sentence:${words.length}_words`);
  warnIf(words.length > 0 && words.length < FIRST_SENTENCE_MIN, `short_first_sentence:${words.length}_words`);
  const lines = hook.split('\n').filter((line) => line.trim());
  warnIf(lines.length > HOOK_MAX_LINES, `hook_over_${HOOK_MAX_LINES}_lines`);
  warnIf(hook.length > HOOK_MAX_CHARS, `hook_over_${HOOK_MAX_CHARS}_chars`);
  const emoji = hook.match(EMOJI) ?? [];
  failIf(emoji.length > HOOK_MAX_EMOJI, 'emoji_overload_in_hook');
  failIf(/[🔥🚀]/u.test(hook), 'hype_emoji_in_hook');
  const letterWords = (sentence.match(/\p{L}+/gu) ?? []).filter((word) => word.length > 1);
  failIf(letterWords.length >= 2 && letterWords.every((word) => word === word.toUpperCase() && word !== word.toLowerCase()), 'all_caps_hook');
  const shouted = (hook.match(/\b\p{Lu}{3,}\b/gu) ?? []).length;
  warnIf(shouted >= 3, 'caps_shouting_in_hook');
  const slopInHook = SLOP.filter((term) => containsTerm(plain(hook), term));
  failIf(slopInHook.length > 0, `slop_in_hook:${slopInHook.join(',')}`);
  const body = plain(parts.join('\n\n')).slice(hook.length);
  const slopInBody = SLOP.filter((term) => !slopInHook.includes(term) && containsTerm(body, term));
  warnIf(slopInBody.length > 0, `slop_in_body:${slopInBody.join(',')}`);
  // The playbook bans a yes/no question the reader can answer "no" to.
  failIf(sentence.endsWith('?') && YES_NO_START.test(plain(sentence)), 'yes_no_question_hook');
  for (const [index, part] of parts.entries()) {
    warnIf((part.match(/—/g) ?? []).length > 1, `em_dash_overload${parts.length > 1 ? `:part_${index + 1}` : ''}`);
  }

  const levels = reasons.map((reason) => reason.level);
  return {
    id,
    status: levels.includes('FAIL') ? 'FAIL' : levels.includes('WARN') ? 'WARN' : 'PASS',
    hook,
    first_sentence: sentence,
    first_sentence_words: words.length,
    // A number in the hook is allowed only when it really happened: the card asks the owner to confirm it.
    has_number: /\p{N}/u.test(hook),
    reasons: reasons.map(({ level, code }) => `${level}:${code}`),
  };
}

export function checkHooks(input) {
  if (!Array.isArray(input?.posts) || input.posts.length === 0) throw new Error('posts must be a non-empty array');
  const posts = input.posts.map(checkHook);
  const statuses = posts.map((post) => post.status);
  return { status: statuses.includes('FAIL') ? 'FAIL' : statuses.includes('WARN') ? 'WARN' : 'PASS', posts };
}

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return JSON.parse(data);
}

async function main() {
  const result = checkHooks(await readStdin());
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status === 'FAIL') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: 'failed', error: error.message })}\n`);
    process.exitCode = 1;
  });
}
