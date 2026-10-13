#!/usr/bin/env node
// Reverse Engineer My App: the ownership gate, redaction, the plain-English
// feature map, the seven post briefs and the fact check on every post.
//
//   node feature-map.mjs gate        < {"answer": "yes"}
//   node feature-map.mjs redact      < {"text": "..."}            (or any JSON value)
//   node feature-map.mjs map         < feature-map.json
//   node feature-map.mjs briefs      < {"map": {...}, "picks": ["F1", ...], "owner": {"why"?, "user_win"?}}
//   node feature-map.mjs check-post  < {"map": {...}, "brief": {...}, "text": "...", "claims": [{"text", "feature_id"}]}
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

/** Every number written in the map: the only numbers a post may state. */
export function numbersIn(text) {
  return Array.from(String(text ?? '').matchAll(/\d[\d,]*(?:\.\d+)?/g), (match) => match[0].replace(/,/g, '').replace(/\.0+$/, ''));
}

export function buildBriefs({ map, picks, owner = {} } = {}) {
  const problems = [];
  const features = new Map((map?.features ?? []).map((feature) => [feature.id, feature]));
  if (!features.size) problems.push('a feature map that passed the map step');
  if (!Array.isArray(picks) || picks.length !== POSTS) problems.push(`exactly ${POSTS} picks, one per day`);
  for (const id of picks ?? []) if (!features.has(id)) problems.push(`pick ${id} is not in the map`);
  if (Array.isArray(picks) && features.size >= POSTS && new Set(picks).size !== POSTS) problems.push(`${POSTS} different features (the map has ${features.size})`);
  if (Array.isArray(picks) && features.size < POSTS && new Set(picks).size !== features.size) problems.push('use every feature in the map at least once');
  if (problems.length) return { status: 'blocked', problems };
  const angles = anglesFor(owner);
  const { value: safeOwner } = redactValue({ why: owner.why ?? null, user_win: owner.user_win ?? null });
  const briefs = picks.map((id, index) => {
    const feature = features.get(id);
    const angle = angles[index];
    const extra = angle.id === 'why_i_built_it' && safeOwner.why ? ` the owner's reason, in their words: "${safeOwner.why}".`
      : angle.id === 'user_win' ? ` the user win, in the owner's words: "${safeOwner.user_win}".` : '';
    const evidence = feature.evidence?.kind === 'quote' ? ` the app's own words: "${feature.evidence.quote}".` : '';
    const inputText = [
      `write one short build-in-public Threads post in my voice about my app ${map.app.name}.`,
      `angle: ${angle.label}. ${angle.ask}${extra}`,
      `feature: ${feature.name}. what it does: ${feature.what}.${evidence}`,
      'use only these facts. do not mention any other feature, number, customer, result or price.',
      'do not say anything happens on a server or in a database.',
      'no links, no offer, no hashtags. no em dashes. all lowercase except names.',
    ].join('\n');
    const allowed = [...new Set([...numbersIn(mapText(map)), ...numbersIn(safeOwner.why), ...numbersIn(safeOwner.user_win)])];
    return { day: index + 1, feature_id: id, feature_name: feature.name, angle: angle.id, angle_label: angle.label, input_text: inputText, allowed_numbers: allowed };
  });
  return { status: 'ok', briefs };
}

// ---------------------------------------------------------------------------
// Fact check on what Threadify wrote. The agent lists every capability the
// post claims and maps each to a feature id by meaning (or null). Any claim
// outside the map, any number outside the map, a server claim, an em dash, a
// link or anything that redaction would change rejects the post: ask
// Threadify again with the reasons.

export function checkPost({ map, brief, text, claims } = {}) {
  const reasons = [];
  if (typeof text !== 'string' || !text.trim()) return { status: 'FAIL', reasons: ['the post text Threadify returned'] };
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
  if (EM_DASH.test(text)) reasons.push('em_dash');
  if (/https?:\/\/|www\./i.test(text)) reasons.push('link_in_post');
  if (redactText(text).count > 0) reasons.push('sensitive_text');
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
  throw new Error('usage: feature-map.mjs gate|redact|map|briefs|check-post < input.json');
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
