#!/usr/bin/env node
// Reverse Engineer My App: the ownership gate, redaction, the plain-English
// feature map, the seven post briefs and the fact check on every post.
//
//   node feature-map.mjs gate        < {"answer": "yes"}
//   node feature-map.mjs redact      < {"text": "..."}            (or any JSON value)
//   node feature-map.mjs map         < feature-map.json
//   node feature-map.mjs briefs      < {"map": {...}, "picks": ["F1", ...], "owner": {"why"?, "user_win"?}, "templates"?: [{"source", "skeleton"}, ... seven]}
//   node feature-map.mjs check-post  < {"map": {...}, "brief": {...}, "text": "...", "claims": [{"text", "feature_id"}]}
//   node feature-map.mjs check-plug  < {"text": "...", "destination": "https://...", "proof": [{"number", "quote", "from"}], "offer_names": ["..."], "post_text": "..."}
//
// The map holds what the app shows or what its browser code does, each with
// evidence: a REA location (script, line, column) or an exact quote from the
// owner's page or list. It never holds a claim about the app's server. Every
// string is redacted before it is shown. Output is JSON on stdout. Exit 0 when
// the step may continue, 1 otherwise. No dependencies and no network: Node 18+.
import crypto from 'node:crypto';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const MIN_FEATURES = 5;
export const MAX_FEATURES = 10;
export const POSTS = 7;
// Every post is 100-350 characters; every Auto Plug is 100-250.
export const POST_CHARS = { min: 100, max: 350 };
export const PLUG_CHARS = { min: 100, max: 250 };
// Where an outlier template may come from: Threadify's Viral library, the
// owner's Vault, or the owner's own greatest hits.
export const TEMPLATE_SOURCES = { viral: "Threadify's Viral library", vault: 'your Vault', greatest_hits: 'your greatest hits' };
const MAX_QUOTE_WORDS = 30;
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

// ---------------------------------------------------------------------------
// Ownership gate. REA's rule: software you own or are authorized to examine.

export const OWNERSHIP_QUESTION = 'Do you own this app, or have written permission to analyse it? Reply "yes" or "no".';

/** Only the exact reply "yes" passes. "probably", "it's my client's", silence and "no" stop. */
export function ownershipGate(answer) {
  const passed = typeof answer === 'string' && answer.trim().toLowerCase() === 'yes';
  if (passed) return { status: 'owner_confirmed', rule: 'REA is for software you own or are authorized to examine.' };
  return {
    status: 'stopped',
    message: 'Stopped. Reverse Engineer My App only looks at an app you own or have written permission to analyse. Nothing was scanned.',
    rule: 'REA is for software you own or are authorized to examine.',
  };
}

// ---------------------------------------------------------------------------
// Redaction. Anything that looks like a login string, an API credential, an
// account or record id, or an email address is replaced before display.

const REDACTIONS = [
  // name = value pairs: keep the name, hide the value.
  { label: 'value', pattern: /\b(Bearer\s+)([A-Za-z0-9._~+/-]{12,}=*)/g, keepGroup: 1 },
  { label: 'value', pattern: /([?&](?:key|api_key|apikey|token|sig|signature|secret|auth|code|session)=)(?!\[redacted)([^&#\s]+)/gi, keepGroup: 1 },
  { label: 'value', pattern: /\b((?:api[_-]?key|apikey|secret|client[_-]?secret|auth|authorization|password|passwd|pwd|session[_-]?id|sid|token)["']?\s*[:=]\s*["']?)(?!Bearer\b|\[redacted)([^\s"',;&]{6,})/gi, keepGroup: 1 },
  { label: 'token', pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g },
  { label: 'key', pattern: /\b(?:sk|pk|rk)[-_](?:live|test|proj)?[-_]?[A-Za-z0-9]{12,}\b/g },
  { label: 'key', pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b/g },
  { label: 'key', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g },
  { label: 'key', pattern: /\bAKIA[0-9A-Z]{16}\b|\bAIza[0-9A-Za-z_-]{30,}\b|\bwhsec_[A-Za-z0-9]{16,}\b/g },
  { label: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { label: 'id', pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi },
  { label: 'id', pattern: /\b[0-9a-f]{24,}\b/gi },
  { label: 'id', pattern: /\b\d{10,}\b/g },
  // Long mixed strings of letters and digits: the shape of generated keys.
  { label: 'token', pattern: /\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{32,}\b/g },
];

/** Redact one string. Returns the safe text and how many replacements were made. */
export function redactText(text) {
  if (typeof text !== 'string') return { text, count: 0 };
  let out = text;
  let count = 0;
  for (const { label, pattern, keepGroup } of REDACTIONS) {
    out = out.replace(pattern, (...match) => {
      count += 1;
      return keepGroup ? `${match[keepGroup]}[redacted ${label}]` : `[redacted ${label}]`;
    });
  }
  return { text: out, count };
}

/** Redact every string inside any JSON value. */
export function redactValue(value) {
  let count = 0;
  const walk = (item) => {
    if (typeof item === 'string') {
      const result = redactText(item);
      count += result.count;
      return result.text;
    }
    if (Array.isArray(item)) return item.map(walk);
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).map(([name, inner]) => [name, walk(inner)]));
    return item;
  };
  return { value: walk(value), count };
}

// ---------------------------------------------------------------------------
// Feature map.

// The map describes what the app shows and what its browser code does. REA
// sees the code shipped to the browser, never the server, so no feature may
// say what happens there.
const SERVER_CLAIM = /\b(?:servers?|server[- ]side|backend|back-end|databases?|db|stored (?:in|on)|in the cloud|cloud storage|encrypt\w*|at rest|cron jobs?|webhooks?)\b/i;
const EM_DASH = /\u2014/;

function words(text) {
  return String(text ?? '').trim().split(/\s+/).filter(Boolean);
}

function checkEvidence(feature, label) {
  const evidence = feature.evidence ?? {};
  const problems = [];
  if (evidence.kind === 'rea') {
    if (!evidence.script) problems.push(`${label}: REA evidence needs the script it was found in`);
    if (!Number.isInteger(evidence.line) || evidence.line < 1) problems.push(`${label}: REA evidence needs a line (1 or more)`);
    if (!Number.isInteger(evidence.column) || evidence.column < 0) problems.push(`${label}: REA evidence needs a column (0 or more)`);
  } else if (evidence.kind === 'quote') {
    if (!evidence.quote || !String(evidence.quote).trim()) problems.push(`${label}: quote evidence needs the exact words`);
    else if (words(evidence.quote).length > MAX_QUOTE_WORDS) problems.push(`${label}: keep the quote to ${MAX_QUOTE_WORDS} words or fewer`);
    if (!evidence.from) problems.push(`${label}: quote evidence needs where it came from (the page address or "your list")`);
  } else {
    problems.push(`${label}: evidence kind must be "rea" (script, line, column) or "quote" (exact words and where from)`);
  }
  return problems;
}

/** One plain line of evidence for the map table. */
export function evidenceLine(evidence = {}) {
  if (evidence.kind === 'rea') {
    const detail = evidence.detail ? ` · ${evidence.detail}` : '';
    return `REA: ${evidence.script} line ${evidence.line}, column ${evidence.column}${detail}`;
  }
  if (evidence.kind === 'quote') return `"${evidence.quote}" (${evidence.from})`;
  return 'none';
}

/** Validate the feature map and return it redacted, with a table for the owner. */
export function buildMap(input = {}) {
  const problems = [];
  const source = input.source;
  if (!['rea', 'page', 'list'].includes(source)) problems.push('source must be "rea", "page" or "list"');
  if (!input.app?.name) problems.push('the app name');
  const features = Array.isArray(input.features) ? input.features : [];
  if (features.length < MIN_FEATURES || features.length > MAX_FEATURES) {
    problems.push(`${MIN_FEATURES}-${MAX_FEATURES} features (got ${features.length})`);
  }
  const ids = new Set();
  features.forEach((feature, index) => {
    const label = feature.id ?? `feature ${index + 1}`;
    if (!/^F\d+$/.test(feature.id ?? '')) problems.push(`${label}: id must look like F1, F2, ...`);
    if (ids.has(feature.id)) problems.push(`${label}: duplicate id`);
    ids.add(feature.id);
    if (!feature.name?.trim()) problems.push(`${label}: a plain-English name`);
    if (!feature.what?.trim()) problems.push(`${label}: one plain sentence saying what it does`);
    if (SERVER_CLAIM.test(`${feature.name ?? ''} ${feature.what ?? ''}`)) {
      problems.push(`${label}: says what happens on the server; describe only what the app shows or what its browser code does`);
    }
    if (EM_DASH.test(`${feature.name ?? ''} ${feature.what ?? ''}`)) problems.push(`${label}: no em dashes`);
    problems.push(...checkEvidence(feature, label));
    if (source === 'rea' && feature.evidence?.kind === 'quote' && !/^https?:\/\//.test(feature.evidence.from ?? '')) {
      problems.push(`${label}: a quote in a REA map must come from the app's own page address`);
    }
  });
  const unknowns = Array.isArray(input.unknowns) ? input.unknowns : [];
  const limitations = Array.isArray(input.limitations) ? input.limitations : [];
  if (source === 'rea' && limitations.length === 0) problems.push("REA's limitations, copied from its result (at least one line)");
  const { value: safe, count } = redactValue({
    app: { name: input.app?.name ?? null, url: input.app?.url ?? null },
    source,
    observed_at: input.observed_at ?? null,
    features: features.map(({ id, name, what, evidence }) => ({ id, name, what, evidence })),
    unknowns,
    limitations,
  });
  if (problems.length) return { status: 'blocked', problems, redactions: count };
  const table = [
    '| # | Feature | What it does | Evidence |',
    '|---|---|---|---|',
    ...safe.features.map((feature) => `| ${feature.id} | ${cell(feature.name)} | ${cell(feature.what)} | ${cell(evidenceLine(feature.evidence))} |`),
  ];
  const notes = [
    `Unknowns: ${safe.unknowns.length ? safe.unknowns.join('; ') : 'none listed'}`,
    `Limitations: ${safe.limitations.length ? safe.limitations.join('; ') : 'none listed'}`,
    'This map shows what the app shows and what its browser code does. It says nothing about the server.',
  ];
  return { status: 'ok', map: { ...safe, map_sha256: sha256(JSON.stringify(safe)) }, table: [...table, '', ...notes].join('\n'), redactions: count };
}

function cell(text) {
  return String(text ?? '').replaceAll('|', '\\|').replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------------
// Seven briefs, one per day, each a different angle.

export const ANGLES = [
  { id: 'what_it_does', label: 'what it does', ask: 'say what this feature does in plain words and who it helps.' },
  { id: 'why_i_built_it', label: 'why i built it', ask: 'say why this feature exists. use only the reason given here; if none is given, frame it as the problem this feature answers and do not invent a backstory.' },
  { id: 'problem_it_kills', label: 'the problem it kills', ask: 'name the annoying problem this feature removes, then the feature.' },
  { id: 'behind_the_scenes', label: 'behind the scenes', ask: 'show what the feature map found about how this works in the browser, in plain words. no code, no file names.' },
  { id: 'fact_from_map', label: 'a fact from the map', ask: 'state one fact from the feature map exactly as written, then why it matters.' },
  { id: 'distribution_take', label: 'building is cheap, distribution is expensive', ask: 'the take: anyone can x-ray an app now. building is cheap, distribution is expensive. tie it to this feature and to building in public.' },
  { id: 'user_win', label: 'a user win', ask: 'share this user win exactly as given, then the feature behind it.' },
];
const ASK_AUDIENCE = { id: 'ask_the_audience', label: 'a question for you', ask: 'ask followers one honest question about this feature. no engagement bait.' };

/** The seven angles in order. The user-win day needs a win the owner supplied. */
export function anglesFor(owner = {}) {
  return ANGLES.map((angle) => (angle.id === 'user_win' && !owner.user_win?.trim() ? ASK_AUDIENCE : angle));
}

function mapText(map) {
  return JSON.stringify([
    map.app?.name,
    ...(map.features ?? []).flatMap((feature) => [feature.name, feature.what, feature.evidence?.quote, feature.evidence?.detail]),
  ]);
}

// Spelled-out numbers count as numbers too ("three tabs" is a claim). "one" is
// left out: it is ordinary English ("one tab", "one yes") far more often than a count.
// A run of number words is one quantity: "twenty five" is 25, "two hundred" is 200.
const SMALL = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, dozen: 12,
};
const SCALE = { hundred: 100, thousand: 1000, million: 1000000, billion: 1000000000 };
const WORD = Object.keys({ ...SMALL, ...SCALE }).join('|');
const NUMBER_RUN = new RegExp(`\\b(?:${WORD})s?(?:(?:[\\s-]+|\\s+and\\s+)(?:${WORD})s?)*\\b`, 'gi');

function wordsToNumber(run) {
  let total = 0;
  let current = 0;
  for (const raw of run.toLowerCase().split(/[\s-]+/)) {
    const word = raw.replace(/s$/, '') in SCALE || raw.replace(/s$/, '') in SMALL ? raw.replace(/s$/, '') : raw;
    if (word === 'and') continue;
    if (word in SMALL) current += SMALL[word];
    else if (word === 'hundred') current = (current || 1) * 100;
    else if (word in SCALE) { total += (current || 1) * SCALE[word]; current = 0; }
  }
  return total + current;
}

/** Every number written in the map: the only numbers a post may state. */
export function numbersIn(text) {
  const value = String(text ?? '');
  const digits = Array.from(value.matchAll(/\d[\d,]*(?:\.\d+)?/g), (match) => match[0].replace(/,/g, '').replace(/\.0+$/, ''));
  const words = Array.from(value.matchAll(NUMBER_RUN), (match) => String(wordsToNumber(match[0])));
  return [...digits, ...words];
}

// The map has no dates, so a post can't call a feature new or recent. "new" that
// names an audience ("new users") is not a date claim, and wording the map itself
// uses is allowed.
const RECENCY_CLAIM = new RegExp([
  String.raw`\bbrand[- ]new\b`,
  String.raw`\bnew(?!\s+(?:users?|accounts?|members?|visitors?|people|customers?|followers?|creators?|signups?)\b)\b`,
  String.raw`\bnewly\b`,
  String.raw`\brecent(?:ly)?\b`,
  String.raw`\blatest\b`,
  String.raw`\bjust (?:shipped|launched|added|released|dropped|built|rolled out)\b`,
  String.raw`\b(?:shipped|launched|released|added|dropped|rolled out) (?:today|yesterday|this week|last week)\b`,
  String.raw`\bnow\s*[.!?,:;]`,
  String.raw`\b(?:has|have|lets|supports|includes|comes with|got|gets) [^.!?\n]{0,40}\bnow\b`,
].join('|'), 'gi');

function recencyClaims(text, map) {
  const allowed = mapText(map ?? {}).toLowerCase();
  return Array.from(String(text).matchAll(RECENCY_CLAIM), (match) => match[0].trim())
    .filter((phrase) => !(phrase.includes(' ') && allowed.includes(phrase.toLowerCase())));
}

export function buildBriefs({ map, picks, owner = {}, templates } = {}) {
  const problems = [];
  const features = new Map((map?.features ?? []).map((feature) => [feature.id, feature]));
  if (!features.size) problems.push('a feature map that passed the map step');
  if (!Array.isArray(picks) || picks.length !== POSTS) problems.push(`exactly ${POSTS} picks, one per day`);
  for (const id of picks ?? []) if (!features.has(id)) problems.push(`pick ${id} is not in the map`);
  if (Array.isArray(picks) && features.size >= POSTS && new Set(picks).size !== POSTS) problems.push(`${POSTS} different features (the map has ${features.size})`);
  if (Array.isArray(picks) && features.size < POSTS && new Set(picks).size !== features.size) problems.push('use every feature in the map at least once');
  if (templates !== undefined) {
    if (!Array.isArray(templates) || templates.length !== POSTS) problems.push(`exactly ${POSTS} templates, one per day, from Threadify's Viral library, your Vault or your greatest hits`);
    else templates.forEach((template, index) => {
      if (!TEMPLATE_SOURCES[template?.source]) problems.push(`template ${index + 1}: its source (viral, vault or greatest_hits)`);
      if (typeof template?.skeleton !== 'string' || !/\{[^{}]+\}/.test(template.skeleton)) problems.push(`template ${index + 1}: a skeleton with at least one {slot}, never the outlier's own words`);
      else if (fixedWords(template.skeleton).length < MIN_TEMPLATE_FIXED_WORDS) problems.push(`template ${index + 1}: at least ${MIN_TEMPLATE_FIXED_WORDS} fixed words outside the {slots}, so the outlier's shape survives`);
    });
  }
  if (problems.length) return { status: 'blocked', problems };
  const angles = anglesFor(owner);
  const { value: safeOwner } = redactValue({ why: owner.why ?? null, user_win: owner.user_win ?? null });
  const briefs = picks.map((id, index) => {
    const feature = features.get(id);
    const angle = angles[index];
    const extra = angle.id === 'why_i_built_it' && safeOwner.why ? ` the owner's reason, in their words: "${safeOwner.why}".`
      : angle.id === 'user_win' ? ` the user win, in the owner's words: "${safeOwner.user_win}".` : '';
    const evidence = feature.evidence?.kind === 'quote' ? ` the app's own words: "${feature.evidence.quote}".` : '';
    const template = templates?.[index] ? { source: templates[index].source, skeleton: redactText(templates[index].skeleton).text } : null;
    const inputText = [
      `write one short build-in-public Threads post in my voice about my app ${map.app.name}.`,
      `angle: ${angle.label}. ${angle.ask}${extra}`,
      `feature: ${feature.name}. what it does: ${feature.what}.${evidence}`,
      ...(template ? [`template, from a proven outlier post: ${template.skeleton}`, 'keep its shape and fill every {slot} with the facts above. never copy the outlier\'s own words.'] : []),
      'the first sentence opens a story loop, and the first 3-5 words grab the reader by the throat.',
      `${POST_CHARS.min}-${POST_CHARS.max} characters. end on one bold, clear, polarizing "so what" line.`,
      'use only these facts. do not mention any other feature, number, customer, result or price.',
      'do not say anything happens on a server or in a database.',
      'do not call any feature new, recent or "now" available: the map has no dates. write no numbers, in digits or words, that are not given above.',
      'no links, no offer, no hashtags. no em dashes. all lowercase except names.',
    ].join('\n');
    const allowed = [...new Set([...numbersIn(mapText(map)), ...numbersIn(safeOwner.why), ...numbersIn(safeOwner.user_win)])];
    return { day: index + 1, feature_id: id, feature_name: feature.name, angle: angle.id, angle_label: angle.label, input_text: inputText, allowed_numbers: allowed, ...(template ? { template } : {}) };
  });
  return { status: 'ok', briefs };
}

// ---------------------------------------------------------------------------
// Fact check on what Threadify wrote. The agent lists every capability the
// post claims and maps each to a feature id by meaning (or null). Any claim
// outside the map, any number outside the map, a server claim, an em dash, a
// link or anything that redaction would change rejects the post: ask
// Threadify again with the reasons.

// A post follows its template when it keeps most of the skeleton's fixed words
// (everything outside the {slots}), in any casing. A skeleton needs at least
// three fixed words, or it carries no outlier shape to follow.
const TEMPLATE_KEEP_SHARE = 0.6;
export const MIN_TEMPLATE_FIXED_WORDS = 3;
const templateWords = (value) => String(value).toLowerCase().replace(/[\u2018\u2019]/g, "'").match(/[a-z][a-z']*/g) ?? [];
export function fixedWords(skeleton) {
  return templateWords(String(skeleton).replace(/\{[^{}]*\}/g, ' '));
}
export function followsTemplate(text, skeleton) {
  const fixed = fixedWords(skeleton);
  if (fixed.length < MIN_TEMPLATE_FIXED_WORDS) return false;
  // Match the fixed words in order, each post word used once, so a repeated
  // structure ("if you ... if you ... if you") needs every repeat.
  const postWords = templateWords(text);
  let at = 0;
  let kept = 0;
  for (const word of fixed) {
    const found = postWords.indexOf(word, at);
    if (found !== -1) { kept += 1; at = found + 1; }
  }
  return kept / fixed.length >= TEMPLATE_KEEP_SHARE;
}

export function checkPost({ map, brief, text, claims } = {}) {
  const reasons = [];
  if (typeof text !== 'string' || !text.trim()) return { status: 'FAIL', reasons: ['the post text Threadify returned'] };
  const length = text.trim().length;
  if (length < POST_CHARS.min || length > POST_CHARS.max) reasons.push(`length_out_of_range:${length}`);
  if (typeof brief?.template?.skeleton === 'string' && !followsTemplate(text, brief.template.skeleton)) reasons.push('template_not_followed');
  const ids = new Set((map?.features ?? []).map((feature) => feature.id));
  const allowed = new Set(brief?.allowed_numbers ?? numbersIn(mapText(map ?? {})));
  for (const number of numbersIn(text)) if (!allowed.has(number)) reasons.push(`number_not_in_map:${number}`);
  if (!Array.isArray(claims) || claims.length === 0) {
    reasons.push('claims: list every capability the post says the app has, each mapped to a feature id or null');
  } else {
    for (const claim of claims) {
      if (!claim?.feature_id || !ids.has(claim.feature_id)) reasons.push(`feature_not_in_map:${claim?.text ?? 'unnamed claim'}`);
    }
    if (brief?.feature_id && !claims.some((claim) => claim?.feature_id === brief.feature_id)) reasons.push(`missing_brief_feature:${brief.feature_id}`);
  }
  if (SERVER_CLAIM.test(text)) reasons.push('server_claim');
  for (const phrase of recencyClaims(text, map)) reasons.push(`recency_not_in_map:${phrase}`);
  if (EM_DASH.test(text)) reasons.push('em_dash');
  if (/https?:\/\/|www\./i.test(text)) reasons.push('link_in_post');
  if (redactText(text).count > 0) reasons.push('sensitive_text');
  return { status: reasons.length ? 'FAIL' : 'PASS', reasons, text_sha256: sha256(text) };
}

// ---------------------------------------------------------------------------
// The Auto Plug check. A plug passes the RSS test (relevant, specific,
// seamless) only when it is 100-250 characters, carries the offer's
// destination as its one link and names at least one specific number - and every number it
// states appears in a quote from a real source (the offer's saved facts or the
// offer page), so "join 2,013+ creators" is proven, never invented. It must
// name the offer (offer_names) and share at least one real word with the post it
// follows (post_text); both are required.

const STOP_WORDS = new Set(['about', 'after', 'again', 'their', 'there', 'these', 'those', 'which', 'while', 'would', 'could', 'should', 'every', 'where', 'other', 'still', 'never', 'always', 'today', 'right', 'really', 'thing', 'things', 'trial', 'start', 'creators', 'people']);
const contentWords = (text, skip) => new Set((String(text ?? '').toLowerCase().match(/[a-z][a-z'-]{4,}/g) ?? []).filter((word) => !STOP_WORDS.has(word) && !skip.has(word)));

export function checkPlug({ text, destination, proof, offer_names: offerNames, post_text: postText } = {}) {
  const reasons = [];
  if (typeof text !== 'string' || !text.trim()) return { status: 'FAIL', reasons: ['the Auto Plug text'] };
  const length = text.trim().length;
  if (length < PLUG_CHARS.min || length > PLUG_CHARS.max) reasons.push(`length_out_of_range:${length}`);
  // Every form Threads can make clickable: full URLs, www., any scheme such as
  // mailto: or tel:, and bare domains such as example.com.
  const urls = text.match(/https?:\/\/\S+|www\.\S+|\b(?:mailto|tel|sms|ftp|javascript|data):\S+/gi) ?? [];
  const rest = urls.reduce((remaining, link) => remaining.replace(link, ' '), text);
  const bare = rest.match(/\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}(?:\/\S*)?/gi) ?? [];
  const links = [...urls, ...bare];
  const clean = (link) => link.replace(/[).,!?]+$/, '');
  if (links.some((link) => clean(link) !== destination)) reasons.push('link_not_offer_destination');
  else if (links.length !== 1) reasons.push('missing_offer_link');
  const withoutLinks = links.reduce((rest, link) => rest.replace(link, ' '), text);
  // A plug is a claim, so "one" counts as a number here ("save one hour"),
  // unlike in posts where it is usually ordinary English.
  const plugNumbers = (value) => [...numbersIn(value), ...Array.from(String(value).matchAll(/\bone\b/gi), () => '1')];
  const numbers = plugNumbers(withoutLinks);
  if (numbers.length === 0) reasons.push('no_specific_number');
  const proven = new Set((Array.isArray(proof) ? proof : [])
    .filter((item) => typeof item?.quote === 'string' && typeof item?.from === 'string' && item.from.trim())
    .flatMap((item) => plugNumbers(item.quote)));
  for (const number of numbers) if (!proven.has(number)) reasons.push(`number_without_proof:${number}`);
  const names = (Array.isArray(offerNames) ? offerNames : []).filter((name) => typeof name === 'string' && name.trim());
  if (!names.length) reasons.push('missing_offer_names');
  else if (!names.some((name) => {
    const escaped = name.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u').test(withoutLinks.toLowerCase());
  })) reasons.push('offer_not_named');
  if (typeof postText !== 'string' || !postText.trim()) reasons.push('missing_post_text');
  else {
    const skip = new Set(names.flatMap((name) => name.toLowerCase().match(/[a-z][a-z'-]{4,}/g) ?? []));
    const postWords = contentWords(postText, skip);
    if (![...contentWords(withoutLinks, skip)].some((word) => postWords.has(word))) reasons.push('not_relevant_to_post');
  }
  if (EM_DASH.test(text)) reasons.push('em_dash');
  if (redactText(withoutLinks).count > 0) reasons.push('sensitive_text');
  return { status: reasons.length ? 'FAIL' : 'PASS', reasons, text_sha256: sha256(text) };
}

// ---------------------------------------------------------------------------

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return JSON.parse(data);
}

async function main(argv) {
  const [command] = argv;
  const input = await readStdin();
  if (command === 'gate') return ownershipGate(input.answer);
  if (command === 'redact') {
    if (typeof input?.text === 'string') {
      const result = redactText(input.text);
      return { status: 'ok', text: result.text, redactions: result.count };
    }
    const result = redactValue(input);
    return { status: 'ok', value: result.value, redactions: result.count };
  }
  if (command === 'map') return buildMap(input);
  if (command === 'briefs') return buildBriefs(input);
  if (command === 'check-post') return checkPost(input);
  if (command === 'check-plug') return checkPlug(input);
  throw new Error('usage: feature-map.mjs gate|redact|map|briefs|check-post|check-plug < input.json');
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main(process.argv.slice(2)).then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!['ok', 'owner_confirmed', 'PASS'].includes(result.status)) process.exitCode = 1;
  }).catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: 'failed', error: error.message })}\n`);
    process.exitCode = 1;
  });
}
