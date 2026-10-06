#!/usr/bin/env node
// Run My Threads copy rule: the agent may not change the wording Threadify
// generated. The only permitted change is lowercasing, keeping proper nouns.
// This guard proves that rule for every post before it is shown for approval.
//
//   node casing-guard.mjs check      < {"posts":[{"id","original","final","keep"?}]}
//   node casing-guard.mjs lowercase  < {"posts":[{"id","original","keep"}]}
//
// `original` and `final` are a string or an array of thread parts. Output is
// JSON on stdout. Exit 0 when every post passes, 1 on any FAIL or bad input.
// No dependencies and no network: Node 18+ only.
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const WORD = /[\p{L}\p{M}\p{N}]+/gu;
// Links, handles and hashtags stay exactly as Threadify wrote them: a
// lowercased URL path can break the link.
const PROTECTED = /https?:\/\/\S+|www\.\S+|[@#][\p{L}\p{N}_.]+/giu;

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
const parts = (value) => (Array.isArray(value) ? value : [value]);

function keepSet(keep = []) {
  if (!Array.isArray(keep)) throw new Error('keep must be an array of proper nouns');
  // "New York" keeps both words; "I" keeps the I in "I'm" and "I've".
  return new Set(keep.flatMap((entry) => String(entry).match(WORD) ?? []));
}

/** Lowercase one text, leaving keep-listed words, links, handles and hashtags unchanged. */
export function lowercaseExceptProperNouns(text, keep = []) {
  if (typeof text !== 'string') throw new Error('text must be a string');
  const kept = keepSet(keep);
  let out = '';
  let last = 0;
  for (const match of text.matchAll(PROTECTED)) {
    out += lowerSegment(text.slice(last, match.index), kept) + match[0];
    last = match.index + match[0].length;
  }
  return out + lowerSegment(text.slice(last), kept);
}

function lowerSegment(segment, kept) {
  return segment.replace(WORD, (word) => (kept.has(word) ? word : word.toLowerCase()));
}

/**
 * PASS only when `final` is `original` with zero or more characters lowercased:
 * same character count, same text ignoring case, and no character uppercased.
 * Any added, removed or reworded word, and any punctuation, spacing, emoji or
 * line-break change, fails. When `keep` is given, a lowercased proper noun fails.
 */
export function checkText(original, final, keep) {
  if (typeof original !== 'string' || typeof final !== 'string') {
    throw new Error('original and final must be strings');
  }
  const reasons = [];
  const before = Array.from(original);
  const after = Array.from(final);
  if (before.length !== after.length) reasons.push('length_changed');
  if (original.toLowerCase() !== final.toLowerCase()) reasons.push('wording_changed');
  if (!reasons.length) {
    const raised = after.some((char, index) => char !== before[index] && char !== before[index].toLowerCase());
    if (raised) reasons.push('casing_raised');
  }
  if (!reasons.length && keep !== undefined) {
    const kept = keepSet(keep);
    for (const match of original.matchAll(WORD)) {
      if (kept.has(match[0]) && final.slice(match.index, match.index + match[0].length) !== match[0]) {
        reasons.push(`proper_noun_lowercased:${match[0]}`);
      }
    }
  }
  return { status: reasons.length ? 'FAIL' : 'PASS', unchanged: original === final, reasons };
}

/** Check one post (single text or thread parts). */
export function checkPost({ id = null, original, final, keep }) {
  const before = parts(original);
  const after = parts(final);
  if (before.length !== after.length) {
    return { id, status: 'FAIL', unchanged: false, reasons: ['thread_parts_changed'], final_sha256: sha256(JSON.stringify(after)) };
  }
  const results = before.map((text, index) => checkText(text, after[index], keep));
  const reasons = results.flatMap((result, index) => result.reasons.map((reason) => (before.length > 1 ? `part_${index + 1}:${reason}` : reason)));
  return {
    id,
    status: reasons.length ? 'FAIL' : 'PASS',
    unchanged: results.every((result) => result.unchanged),
    reasons,
    final_sha256: sha256(JSON.stringify(after)),
  };
}

export function checkPosts(input) {
  if (!Array.isArray(input?.posts) || input.posts.length === 0) throw new Error('posts must be a non-empty array');
  const posts = input.posts.map(checkPost);
  return { status: posts.every((post) => post.status === 'PASS') ? 'PASS' : 'FAIL', posts };
}

export function lowercasePosts(input) {
  if (!Array.isArray(input?.posts) || input.posts.length === 0) throw new Error('posts must be a non-empty array');
  const posts = input.posts.map(({ id = null, original, keep = [] }) => {
    const final = Array.isArray(original)
      ? original.map((text) => lowercaseExceptProperNouns(text, keep))
      : lowercaseExceptProperNouns(original, keep);
    return { ...checkPost({ id, original, final, keep }), final };
  });
  return { status: posts.every((post) => post.status === 'PASS') ? 'PASS' : 'FAIL', posts };
}

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return JSON.parse(data);
}

async function main(argv) {
  const [command] = argv;
  if (!['check', 'lowercase'].includes(command)) throw new Error('usage: casing-guard.mjs check|lowercase < input.json');
  const input = await readStdin();
  const result = command === 'check' ? checkPosts(input) : lowercasePosts(input);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status !== 'PASS') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: 'failed', error: error.message })}\n`);
    process.exitCode = 1;
  });
}
