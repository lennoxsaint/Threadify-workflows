#!/usr/bin/env node
// Threadify Unslop gate. Zero hedging. Every hedge FAILs the post; the slop
// markers from the other three families (corporate/LinkedIn voice, AI tells,
// over-formatting) FAIL it too. The rules live in references/slop-markers.md.
//
//   node hedge_gate.mjs "post text"                 one post, plain report
//   node hedge_gate.mjs < post.txt                  one post from stdin, plain report
//   node hedge_gate.mjs --json < {"posts":[{"id","text"}]}   many posts, JSON report
//   --hedges-only                                   check hedging only
//
// The plain report starts with PASS or FAIL and lists every matched phrase,
// quoted exactly as written. Exit 0 on PASS, 1 on FAIL or bad input.
// No dependencies and no network: Node 18+ only.
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const FAMILIES = ['hedging', 'corporate', 'ai_tells', 'over_formatting'];
export const FAMILY_LABELS = {
  hedging: 'hedging',
  corporate: 'corporate/LinkedIn voice',
  ai_tells: 'AI tells',
  over_formatting: 'over-formatting',
};
// Hedging is the owner's top priority, so it carries the most weight in a score.
export const WEIGHTS = { hedging: 3, corporate: 1, ai_tells: 1, over_formatting: 1 };

// ---------------------------------------------------------------- hedging ---
// Lexical hedges: one word or a fixed phrase. Matched case-insensitively on
// whole words, with straight and curly apostrophes treated the same.
const LEXICAL_HEDGES = [
  // modal softeners
  'might', 'may', 'could', 'can be', 'may or may not', 'could potentially',
  // probability words
  'perhaps', 'maybe', 'possibly', 'probably', 'likely', 'unlikely', 'potentially', 'presumably',
  'supposedly', 'seemingly', 'hopefully', 'ideally', 'arguably', 'conceivably',
  // opinion shields
  'i think', 'i believe', 'i feel like', 'i feel that', 'i feel as if', 'i feel as though',
  'in my opinion', 'in my humble opinion', 'imo', 'imho', 'just my opinion', 'just my two cents',
  'my two cents', 'i guess', 'i suppose', 'my guess is', 'if i had to guess', "i'd say", 'i would say',
  "i'd argue", 'i would argue', 'it could be argued', 'one might say', "i'm not sure", 'not sure if',
  "i'm no expert", "i'm not an expert", 'could be wrong', 'i could be wrong', 'i might be wrong',
  'i may be wrong', "i'm probably wrong", "correct me if i'm wrong", "don't quote me",
  'but what do i know', 'who knows', 'pretty sure',
  // degree softeners
  'kind of', 'kinda', 'sort of', 'sorta', 'somewhat', 'a bit', 'a little bit', 'fairly', 'pretty much',
  'relatively', 'more or less', 'to some extent', 'to an extent', 'in some ways', 'in a way',
  'for the most part', 'not necessarily', 'not always',
  // appearance and tendency
  'seems', 'seem to', 'appears to', 'appears that', 'it appears', 'tends to', 'tend to',
  'generally', 'in general', 'typically', 'in most cases', "it's possible that", 'it is possible that',
  // scope dodges
  'for some people', 'for some of you', 'not for everyone', "this isn't for everyone", 'it depends',
  'results may vary', 'your results may vary', 'your mileage may vary', 'ymmv',
  'every account is different', 'everyone is different', 'what works for me', 'do what works for you',
  'whatever works for you',
  // filler shields
  'to be fair', 'just a thought', 'food for thought', "for what it's worth", 'fwiw', 'just saying',
  'grain of salt', 'hard to say', "it's hard to say", 'remains to be seen', 'time will tell',
  // advice softeners
  'consider', 'try', 'you may want to', 'you might want to', 'you could try',
  'might be worth', 'worth considering', 'worth a try', 'give it a try', 'might help', 'could help',
  'may help',
];

// Structural hedges: shapes, not single words.
const STRUCTURAL_HEDGES = [
  {
    marker: 'both-sides balancing',
    phrases: [
      'on the other hand', 'that said', 'that being said', 'having said that', 'with that being said',
      'both are valid', 'both have their place', 'both work', "there's no right answer",
      'there is no right answer', 'no one-size-fits-all', 'no one size fits all', 'pros and cons',
      'somewhere in the middle', "it's not black and white",
    ],
  },
  {
    marker: 'disclaimer',
    phrases: [
      'not financial advice', 'nfa', 'no guarantees', 'not a guarantee', 'disclaimer',
      'take this with a grain of salt', 'based on available information', 'while specific details are limited',
      'not widely documented', 'should be treated as', 'does not by itself establish', 'as of my last',
      "i can't be certain", 'i cannot be certain',
    ],
  },
  {
    marker: 'softened CTA',
    phrases: [
      'if you want', "if you'd like", 'if you would like', "if you're interested", 'if you are interested',
      'feel free to', 'no pressure', 'no obligation', 'if it resonates', 'if this resonates',
      'if that resonates', 'hope this helps', 'hope it helps', 'check it out if',
    ],
  },
  {
    marker: '"and that\'s okay"',
    phrases: [
      "and that's okay", "and that's ok", "and that's fine", "and that's totally fine", "and that's alright",
      "and that's totally okay", "that's okay too", "that's ok too", 'nothing wrong with', 'no shame in',
    ],
  },
];

// A soft add-on at the end of a sentence: ", at least for me."
const TRAILING_QUALIFIER = /,\s*(at least for me|for me at least|at least for now|for now|at least|or something like that|or something|or whatever|i think|probably|maybe|i guess|in my experience|imo|if that makes sense|but who knows|anyway)\s*(?=[.!?…]|\n|$)/giu;

// A closing question that asks the reader to pick the side instead of taking it.
const DODGE_QUESTIONS = [
  /^\s*(thoughts|agree|disagree|agree or disagree|right|yes or no|am i wrong|am i crazy|or not|who else|anyone else|your thoughts)\s*\?+\s*$/iu,
  /\b(what do you think|what would you do|what about you|how about you|what's your take|your take|your thoughts|am i wrong|am i crazy|is it just me|who else|anyone else|which (one|side) are you|curious what you think|do you agree|agree or disagree|what's your experience|how do you see it)\b[^?]*\?+\s*$/iu,
  /,\s*(right|or not|no)\s*\?+\s*$/iu,
  /\blet me know (in the comments|what you think|your thoughts)\b[^\n]*$/iu,
];

// ---------------------------------------------------------- other families ---
const CORPORATE = [
  'excited to announce', 'excited to share', 'thrilled to announce', 'thrilled to share', 'proud to announce',
  'pleased to announce', 'pleased to share', 'happy to share', 'delighted to', 'humbled', 'honored to',
  'grateful for the opportunity', 'leverage', 'leveraging', 'synergy', 'synergies', 'stakeholders',
  'deliverables', 'circle back', 'touch base', 'move the needle', 'low-hanging fruit', 'thought leader',
  'thought leadership', 'best-in-class', 'best practices', 'value-add', 'value-added', 'win-win',
  'game changer', 'game-changer', 'game-changing', 'next level', 'unlock your potential', 'empower',
  'empowering', 'seamless', 'seamlessly', 'robust', 'scalable', 'cutting-edge', 'innovative',
  'revolutionize', 'revolutionary', 'transformative', 'streamline', 'utilize', 'ecosystem', 'paradigm',
  'holistic', 'bandwidth', 'actionable insights', 'key takeaways', 'lessons learned', "here's what i learned",
  'let that sink in', 'read that again', 'this is your sign', 'repost if', 'follow me for more',
  'my journey', 'on this journey', 'drill down', 'mission is to',
];

const AI_TELLS = [
  'delve', 'delving', 'tapestry', 'testament', 'pivotal', 'realm', 'beacon', 'multifaceted', 'meticulous',
  'meticulously', 'intricate', 'paramount', 'elevate', 'embark', 'supercharge', 'harness', 'ever-evolving',
  'evolving landscape', 'digital landscape', 'fast-paced world', "in today's world", 'in the age of',
  "it's important to note", 'it is important to note', "it's worth noting", 'worth noting', "let's dive in",
  'dive into', 'deep dive', "here's the thing", "here's the kicker", 'the truth is', 'the reality is',
  'at the end of the day', 'at its core', 'when it comes to', 'in conclusion', 'in summary', 'to summarize',
  'stands as', 'serves as', 'underscore', 'underscores', 'showcase', 'showcasing', 'foster', 'fostering',
  'crucial', 'vibrant', 'navigate the', 'navigating the', 'unleash', 'great question', 'i hope this helps',
  "here's a breakdown", "here's what you need to know", 'without further ado', 'buckle up',
  'what most people get wrong', "here's what nobody tells you", 'nobody talks about', 'the part everyone misses',
  'plot twist', 'what if i told you', 'think about it:', 'the uncomfortable truth', 'let me be clear',
  "i'll be honest", 'furthermore', 'moreover', 'additionally',
];

const AI_TELL_SHAPES = [
  { marker: '"not only ... but also"', pattern: /\bnot only\b[^.!?\n]{1,80}\bbut also\b/giu },
  { marker: '"it\'s not about X, it\'s about Y"', pattern: /\bit'?s not (just )?about\b[^.!?\n]{1,80}\bit'?s about\b/giu },
  { marker: '"not just X, but Y"', pattern: /\bnot just\b[^.!?\n]{1,60},?\s*but\b/giu },
  { marker: 'plays a role', pattern: /\bplays? an? (vital|crucial|key|pivotal|significant|important) role\b/giu },
];

// ------------------------------------------------------------- matching ---
const APOSTROPHES = /[‘’ʼ]/g;
const normalise = (text) => text.replace(APOSTROPHES, "'");
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function phrasePattern(phrase) {
  const body = escapeRegExp(phrase).replace(/\\?'/g, "'").replace(/ /g, '\\s+');
  const start = /^[\p{L}\p{N}]/u.test(phrase) ? '(?<![\\p{L}\\p{N}\'])' : '';
  const end = /[\p{L}\p{N}]$/u.test(phrase) ? '(?![\\p{L}\\p{N}]|\'[\\p{L}])' : '';
  return new RegExp(`${start}${body}${end}`, 'giu');
}

const compile = (phrases) => phrases.map((phrase) => ({ phrase, pattern: phrasePattern(phrase) }));
const LEXICAL = compile(LEXICAL_HEDGES);
const STRUCTURAL = STRUCTURAL_HEDGES.map(({ marker, phrases }) => ({ marker, compiled: compile(phrases) }));
const CORPORATE_C = compile(CORPORATE);
const AI_TELLS_C = compile(AI_TELLS);

/** Spans the gate never reads: quoted text, links, @handles and #hashtags. */
function maskedSpans(text) {
  const spans = [];
  for (const match of text.matchAll(/"[^"\n]{1,200}"|“[^”\n]{1,200}”|https?:\/\/\S+|www\.\S+|[@#][\p{L}\p{N}_.]+/gu)) {
    spans.push([match.index, match.index + match[0].length]);
  }
  return spans;
}
const insideSpan = (spans, start, end) => spans.some(([from, to]) => start >= from && end <= to);

/** The words just before a match, lowercased. */
function wordsBefore(text, index, count = 1) {
  const words = text.slice(0, index).toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
  return words.slice(-count);
}

function atSentenceStart(text, index) {
  const before = text.slice(0, index).replace(/[\s"'(“]+$/u, '');
  return before === '' || /[.!?…:\n]$/u.test(before);
}

/** A line written in Title Case keeps no proper-noun exception. */
function lineIsTitleCase(text, index) {
  const lineStart = text.lastIndexOf('\n', index - 1) + 1;
  const lineEnd = text.indexOf('\n', index);
  const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
  const words = line.match(/\p{L}[\p{L}']*/gu) ?? [];
  if (words.length < 3) return false;
  return words.filter((word) => /^\p{Lu}/u.test(word)).length / words.length >= 0.6;
}

const MONTH_BEFORE = new Set(['in', 'since', 'until', 'till', 'during', 'early', 'mid', 'late', 'last', 'next', 'of', 'from', 'through', 'by', 'before', 'after']);
const MONTH_BEFORE_CAPITAL = new Set(['this', 'every', 'each', 'on']);
const MONTH_NAMES = /^(january|february|march|april|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/i;

/** "May" the month, not the hedge. */
function isMonthMay(text, index, word) {
  const after = text.slice(index + word.length);
  // A hedging "may" needs a subject before it, so a sentence never opens with one.
  if (atSentenceStart(text, index) && !/^\s+be\b/iu.test(after)) return true;
  if (/^\s*(\d{1,2}(st|nd|rd|th)?\b|\d{4}\b|'\d{2}\b)/iu.test(after)) return true;
  if (/^\s*(-|–|to|through|and|or)\s*/iu.test(after) && MONTH_NAMES.test(after.replace(/^\s*(-|–|to|through|and|or)\s*/iu, ''))) return true;
  const [previous] = wordsBefore(text, index);
  if (previous && /^\d{1,2}(st|nd|rd|th)?$/.test(previous)) return true;
  if (previous && MONTH_BEFORE.has(previous)) return true;
  return Boolean(previous && MONTH_BEFORE_CAPITAL.has(previous) && word === 'May');
}

const DETERMINERS = new Set(['this', 'that', 'what', 'which', 'the', 'a', 'an', 'any', 'every', 'some', 'same', 'my', 'your', 'his', 'her', 'our', 'their', 'these', 'those', 'no', 'one', 'each', 'other', 'different', 'new', 'whatever', 'its', 'only', 'right', 'wrong', 'first', 'worst', 'best']);
const SUBJECTS = new Set(['i', 'we', 'they', 'he', 'she', "i'll", "we'll", "they'll", "don't", "didn't", 'never', "won't", 'stop', 'to', "i'd", "we'd"]);
const TRY_NOUN = new Set(['a', 'the', 'my', 'first', 'second', 'third', 'another', 'every', 'each', 'one', 'last', 'next']);

/** Words that look like a hedge but, in context, are not one. */
function falsePositive(text, match, phrase) {
  const word = match[0];
  const lower = phrase.toLowerCase();
  if (lower === 'may' && isMonthMay(text, match.index, word)) return true;
  if ((lower === 'kind of' || lower === 'sort of') && DETERMINERS.has(wordsBefore(text, match.index)[0])) return true;
  if (lower === 'try') {
    const [previous] = wordsBefore(text, match.index);
    if (SUBJECTS.has(previous) || TRY_NOUN.has(previous)) return true;
  }
  // "I consider this a win" is a claim. "Consider posting daily" is soft advice.
  if (lower === 'consider' && ['i', 'we', 'they', 'he', 'she', 'not'].includes(wordsBefore(text, match.index)[0])) return true;
  // "write it in a way people get" is not a hedge. "In a way, it worked" is.
  if (lower === 'in a way' && !/^\s*([,.!?…]|$)/u.test(text.slice(match.index + word.length))) return true;
  // A capitalised word mid-sentence is a proper noun or a title, unless the whole line is Title Case.
  if (!lower.includes(' ') && /^\p{Lu}/u.test(word) && !atSentenceStart(text, match.index) && !lineIsTitleCase(text, match.index)) return true;
  return false;
}

function collect(text, compiled, family, marker, spans, hits, { checkFalsePositive = false } = {}) {
  for (const { phrase, pattern } of compiled) {
    for (const match of text.matchAll(pattern)) {
      const start = match.index;
      const end = start + match[0].length;
      if (insideSpan(spans, start, end)) continue;
      if (checkFalsePositive && falsePositive(text, match, phrase)) continue;
      hits.push({ family, marker: marker ?? phrase, start, end });
    }
  }
}

function collectShapes(text, shapes, family, spans, hits) {
  for (const { marker, pattern } of shapes) {
    for (const match of text.matchAll(pattern)) {
      if (insideSpan(spans, match.index, match.index + match[0].length)) continue;
      hits.push({ family, marker, start: match.index, end: match.index + match[0].length });
    }
  }
}

function lastSentence(text) {
  const trimmed = text.replace(/\s+$/u, '');
  const lines = trimmed.split('\n');
  const lastLine = lines[lines.length - 1];
  const lineStart = trimmed.length - lastLine.length;
  const breaks = [...lastLine.matchAll(/[.!?…]\s+/gu)];
  const offset = breaks.length ? breaks[breaks.length - 1].index + breaks[breaks.length - 1][0].length : 0;
  return { sentence: lastLine.slice(offset), start: lineStart + offset };
}

// ------------------------------------------------------- over-formatting ---
const EMOJI = /\p{Extended_Pictographic}/gu;

function formattingHits(text) {
  const hits = [];
  const add = (marker, start, end) => hits.push({ family: 'over_formatting', marker, start, end });
  for (const match of text.matchAll(/—/gu)) add('em dash', match.index, match.index + 1);
  for (const match of text.matchAll(/\*\*[^*\n]+\*\*|__[^_\n]+__/gu)) add('markdown bold', match.index, match.index + match[0].length);
  for (const match of text.matchAll(/^#{1,6}\s+\S[^\n]*/gmu)) add('markdown heading', match.index, match.index + match[0].length);
  const lines = [...text.matchAll(/^[^\n]*$/gmu)].map((match) => ({ line: match[0], start: match.index }));
  const emojiBullets = lines.filter(({ line }) => /^\s*\p{Extended_Pictographic}️?\s/u.test(line));
  if (emojiBullets.length >= 2) for (const { line, start } of emojiBullets) add('emoji bullet', start, start + line.length);
  const arrowBullets = lines.filter(({ line }) => /^\s*(→|->|👉|➡️?|▶️?)\s/u.test(line));
  if (arrowBullets.length >= 2) for (const { line, start } of arrowBullets) add('arrow bullet', start, start + line.length);
  const labelLines = lines.filter(({ line }) => /^\s*(?:[-•*]\s*)?\p{Lu}[\p{L} ]{1,30}:\s+\S/u.test(line));
  if (labelLines.length >= 2) for (const { line, start } of labelLines) add('inline-header list', start, start + line.length);
  const emoji = [...text.matchAll(EMOJI)];
  if (emoji.length >= 3) add(`${emoji.length} emoji`, emoji[0].index, emoji[0].index + emoji[0][0].length);
  const tags = [...text.matchAll(/(^|\s)#[\p{L}\p{N}_]+/gu)];
  if (tags.length >= 2) add(`${tags.length} hashtags`, tags[0].index, tags[0].index + tags[0][0].length);
  const filled = lines.filter(({ line }) => line.trim());
  const shortLines = filled.filter(({ line }) => (line.trim().match(/\S+/g) ?? []).length <= 4);
  if (filled.length >= 8 && shortLines.length / filled.length >= 0.8) add('one-line-per-thought broetry', filled[0].start, filled[0].start + filled[0].line.length);
  return hits;
}

/** Drop a hit that sits inside an earlier, longer hit of the same family. */
function dedupe(hits) {
  const sorted = [...hits].sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const kept = [];
  for (const hit of sorted) {
    if (kept.some((other) => other.family === hit.family && hit.start >= other.start && hit.end <= other.end)) continue;
    if (kept.some((other) => other.family === hit.family && hit.start < other.end && hit.end > other.start)) continue;
    kept.push(hit);
  }
  return kept;
}

/** Every hedge in a text, quoted exactly as written. */
export function findHedges(text) {
  if (typeof text !== 'string') throw new Error('text must be a string');
  const source = normalise(text);
  const spans = maskedSpans(source);
  const hits = [];
  collect(source, LEXICAL, 'hedging', null, spans, hits, { checkFalsePositive: true });
  for (const { marker, compiled } of STRUCTURAL) collect(source, compiled, 'hedging', marker, spans, hits);
  for (const match of source.matchAll(TRAILING_QUALIFIER)) {
    if (!insideSpan(spans, match.index, match.index + match[0].length)) hits.push({ family: 'hedging', marker: 'trailing qualifier', start: match.index, end: match.index + match[0].length });
  }
  const { sentence, start } = lastSentence(source);
  const dodge = DODGE_QUESTIONS.map((pattern) => sentence.match(pattern)).find(Boolean);
  if (dodge) {
    const from = start + dodge.index + (dodge[0].match(/^[\s,]*/u)[0].length);
    hits.push({ family: 'hedging', marker: 'closing question that dodges a stance', start: from, end: start + dodge.index + dodge[0].length });
  }
  return finish(text, hits);
}

/** Corporate voice, AI tells and over-formatting markers. */
export function findMarkers(text) {
  if (typeof text !== 'string') throw new Error('text must be a string');
  const source = normalise(text);
  const spans = maskedSpans(source);
  const hits = [];
  collect(source, CORPORATE_C, 'corporate', null, spans, hits);
  collect(source, AI_TELLS_C, 'ai_tells', null, spans, hits);
  collectShapes(source, AI_TELL_SHAPES, 'ai_tells', spans, hits);
  hits.push(...formattingHits(source));
  return finish(text, hits);
}

function finish(original, hits) {
  return dedupe(hits).map(({ family, marker, start, end }) => ({
    family,
    marker,
    phrase: original.slice(start, end).trim(),
    index: start,
  }));
}

/** Score one text on all four families. Hedges weigh 3, every other marker 1. */
export function scoreText(text) {
  const hits = [...findHedges(text), ...findMarkers(text)];
  const families = Object.fromEntries(FAMILIES.map((family) => [family, hits.filter((hit) => hit.family === family).map((hit) => hit.phrase)]));
  const score = FAMILIES.reduce((total, family) => total + families[family].length * WEIGHTS[family], 0);
  return { score, hedges: families.hedging.length, families, hits };
}

/** The gate: PASS only with zero hedges and, unless hedgesOnly, zero markers. */
export function gate(text, { hedgesOnly = false } = {}) {
  const hedges = findHedges(text);
  const markers = hedgesOnly ? [] : findMarkers(text);
  const reasons = [...hedges, ...markers].map((hit) => `${FAMILY_LABELS[hit.family]} · ${hit.marker} · "${hit.phrase}"`);
  return {
    status: hedges.length || markers.length ? 'FAIL' : 'PASS',
    hedges: hedges.map(({ marker, phrase }) => ({ marker, phrase })),
    markers: markers.map(({ family, marker, phrase }) => ({ family, marker, phrase })),
    reasons,
  };
}

export function gatePosts(input, options) {
  if (!Array.isArray(input?.posts) || input.posts.length === 0) throw new Error('posts must be a non-empty array');
  const posts = input.posts.map(({ id = null, text }) => {
    const parts = Array.isArray(text) ? text : [text];
    const results = parts.map((part) => gate(part, options));
    return {
      id,
      status: results.every((result) => result.status === 'PASS') ? 'PASS' : 'FAIL',
      hedges: results.flatMap((result) => result.hedges),
      markers: results.flatMap((result) => result.markers),
      reasons: results.flatMap((result, index) => result.reasons.map((reason) => (parts.length > 1 ? `part ${index + 1}: ${reason}` : reason))),
    };
  });
  return { status: posts.every((post) => post.status === 'PASS') ? 'PASS' : 'FAIL', posts };
}

export function formatReport(result) {
  const head = `${result.status}  hedges: ${result.hedges.length} · markers: ${result.markers.length}`;
  return [head, ...result.reasons.map((reason) => `  ${reason}`)].join('\n');
}

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

async function main(argv) {
  const json = argv.includes('--json');
  const hedgesOnly = argv.includes('--hedges-only');
  const textArgs = argv.filter((arg) => !arg.startsWith('--'));
  if (json) {
    const result = gatePosts(JSON.parse(await readStdin()), { hedgesOnly });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status !== 'PASS') process.exitCode = 1;
    return;
  }
  const text = textArgs.length ? textArgs.join(' ') : await readStdin();
  if (!text.trim()) throw new Error('usage: hedge_gate.mjs "post text" | hedge_gate.mjs < post.txt | hedge_gate.mjs --json < posts.json');
  const result = gate(text, { hedgesOnly });
  process.stdout.write(`${formatReport(result)}\n`);
  if (result.status !== 'PASS') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: 'failed', error: error.message })}\n`);
    process.exitCode = 1;
  });
}
