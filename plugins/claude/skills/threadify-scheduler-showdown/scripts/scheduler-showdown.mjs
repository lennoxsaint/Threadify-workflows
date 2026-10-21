#!/usr/bin/env node
// Scheduler Showdown: the deterministic parts of a blind, fair test of which
// scheduler your AI agent actually knows you through. The agent calls each
// tool's own MCP; this script locks the rules, keeps every raw reply, hides the
// tool names from the judge, scores the grid and unblinds only against the
// sealed key.
//
//   node scheduler-showdown.mjs rules     --out showdown/<date> [--rules references/rules.md]
//   node scheduler-showdown.mjs record    --dir run --tool Buffer --test T1 (--file reply.json | --text "...") [--status replied|error|no-capability|no-connector] [--reason "..."] [--sent "<prompt as sent>"]
//   node scheduler-showdown.mjs anonymise --dir run [--seed 52]
//   node scheduler-showdown.mjs judge-prompt --dir run      (writes judge/prompt.txt for the outside judge)
//   node scheduler-showdown.mjs judge-prompt --dir run --reply judge/reply.txt --judge codex|claude --model <model it used>
//   node scheduler-showdown.mjs scorecard --dir run         (scorecard.md + scorecard.html, still anonymous)
//   node scheduler-showdown.mjs unblind   --dir run [--expect <key sha256>]
//   node scheduler-showdown.mjs lowercase-guard --original original.txt --final final.txt [--dir run]
//   node scheduler-showdown.mjs report    --dir run         (report.html)
//
// Optional inputs the agent writes into the run folder: tools.json (aliases and
// live pricing for each tool) and cleanup.json (test posts removed, read back).
// Pure Node 18+, no dependencies and no network. JSON on stdout. Exit 0 on
// success, 1 on usage, FAIL or bad input. Deterministic with --seed (and --now).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { realpathSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const DISCLOSURE = "Threadify Workflows are made by Threadify's founder, so this test is built to be checked, not trusted.";
export const RULES_PATH = fileURLToPath(new URL('../references/rules.md', import.meta.url));
export const REPO_URL = 'https://github.com/lennoxsaint/Threadify-workflows';
export const RULES_URL = `${REPO_URL}/blob/main/skills/threadify-scheduler-showdown/references/rules.md`;
export const WORKFLOW_URL = `${REPO_URL}/blob/main/workflows/scheduler-showdown/README.md`;
export const THREADIFY_URL = 'https://www.threadify.app/home?utm_source=threadify-workflows&utm_medium=report-page&utm_campaign=scheduler-showdown&utm_content=report__scheduler_showdown__open_threadify';
export const TESTS = ['T1', 'T2', 'T3', 'T4', 'T5'];
export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
export const POINTS = { pass: 2, partial: 1, fail: 0 };
export const MAX_POINTS = TESTS.length * POINTS.pass;
export const NO_CONNECTOR = 'no AI connection connected';
export const STATUSES = ['replied', 'error', 'no-capability', 'no-connector'];
export const UNKNOWN = 'UNKNOWN';
// The schedulers the check-in looks for. A connector URL is only listed where the
// tool publishes one; otherwise the agent points to the tool's own docs.
export const KNOWN_SCHEDULERS = [
  { name: 'Threadify', connector: 'https://www.threadify.app/api/mcp/threadify', aliases: ['threadify.app'] },
  { name: 'Buffer', connector: 'https://mcp.buffer.com/mcp', aliases: ['buffer.com'] },
  { name: 'Metricool', connector: null, aliases: ['metricool.com'] },
  { name: 'Typefully', connector: 'https://mcp.typefully.com/mcp', aliases: ['typefully.com'] },
  { name: 'Eden', connector: 'https://mcp.eden.so/mcp', aliases: ['eden.so'] },
  { name: 'BlackTwist', connector: 'https://blacktwist.app/api/mcp', aliases: ['blacktwist.app', 'Black Twist'] },
  { name: 'Hootsuite', connector: null, aliases: ['hootsuite.com'] },
  { name: 'Publer', connector: null, aliases: ['publer.com', 'publer.io'] },
];

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
export const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
const slug = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const trim = (text, max) => { const s = String(text ?? ''); return s.length > max ? `${s.slice(0, max)} [trimmed]` : s; };
const oneLine = (text, max = 300) => String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const replyText = (reply) => (typeof reply === 'string' ? reply : JSON.stringify(reply ?? null, null, 2));
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const readJsonIf = (file) => (fs.existsSync(file) ? readJson(file) : null);
const write = (dir, name, value) => {
  const file = path.join(dir, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
  return file;
};

// ---------------------------------------------------------------------------
// 1. Rules locked: copy rules.md into the run with its sha256, before any tool call.
// ---------------------------------------------------------------------------
/** The five tests from the rules table: id, the exact prompt (without its quotes), pass, partial, fail. */
export function parseRules(markdown) {
  const tests = [];
  for (const line of String(markdown).split(/\r?\n/)) {
    const match = line.match(/^\|\s*(T\d)\s*\|(.+)\|\s*$/);
    if (!match) continue;
    const cells = match[2].split('|').map((cell) => cell.trim());
    if (cells.length !== 4) throw new Error(`rules.md: ${match[1]} needs a prompt, pass, partial and fail cell`);
    const [quoted, pass, partial, fail] = cells;
    tests.push({ id: match[1], prompt: quoted.replace(/^"(.*)"$/, '$1'), pass, partial, fail });
  }
  if (tests.map((t) => t.id).join(',') !== TESTS.join(',')) throw new Error(`rules.md must hold exactly ${TESTS.join(', ')} in order`);
  return tests;
}

export function lockRules({ markdown, out, now = new Date().toISOString() }) {
  const hash = sha256(markdown);
  const file = path.join(out, 'rules.json');
  const existing = readJsonIf(file);
  if (existing) {
    if (existing.sha256 !== hash) return { status: 'FAIL', problems: [`rules are already locked in ${file} with sha256 ${existing.sha256}; start a new run folder instead of changing them`] };
    return { status: 'ok', already_locked: true, sha256: hash, locked_at: existing.locked_at, rules: file, line: `Rules locked: sha256 ${hash} at ${existing.locked_at}.` };
  }
  if (fs.existsSync(path.join(out, 'raw'))) return { status: 'FAIL', problems: ['raw replies already exist in this run; rules must be locked before the first tool call'] };
  const tests = parseRules(markdown);
  write(out, 'rules.json', { record_type: 'SchedulerShowdownRulesV1', source: 'references/rules.md', sha256: hash, locked_at: now, tests, rules_md: markdown });
  return { status: 'ok', sha256: hash, locked_at: now, rules: file, tests: tests.map(({ id, prompt }) => ({ id, prompt })), line: `Rules locked: sha256 ${hash} at ${now}.` };
}

// ---------------------------------------------------------------------------
// 2. Record: every raw reply, appended with a timestamp, never reworded.
// ---------------------------------------------------------------------------
export function knownScheduler(name) {
  const wanted = slug(name);
  return KNOWN_SCHEDULERS.find((s) => slug(s.name) === wanted) ?? null;
}

export function recordReply({ dir, tool, test, reply = null, status = 'replied', reason = null, sent = null, now = new Date().toISOString() }) {
  const rules = readJsonIf(path.join(dir, 'rules.json'));
  if (!rules) return { status: 'FAIL', problems: ['lock the rules first: scheduler-showdown.mjs rules --out <run>'] };
  if (readJsonIf(path.join(dir, 'seal.json'))) return { status: 'FAIL', problems: ['the replies are already anonymised and sealed; nothing can be added after sealing'] };
  if (!tool || !String(tool).trim()) return { status: 'usage', usage: 'record needs --tool <name>' };
  if (!STATUSES.includes(status)) return { status: 'usage', usage: `--status must be one of ${STATUSES.join(', ')}` };
  const tests = test === 'all' && status === 'no-connector' ? TESTS : [test];
  if (!tests.every((id) => TESTS.includes(id))) return { status: 'usage', usage: `--test must be one of ${TESTS.join(', ')} (or all, with --status no-connector)` };
  if (status === 'no-capability' && !reason) return { status: 'FAIL', problems: ['no-capability needs --reason quoted from the tool\'s own tool list'] };
  if (status === 'replied' && (reply === null || reply === '')) return { status: 'FAIL', problems: ['a reply needs --file or --text with the raw tool output'] };
  const known = knownScheduler(tool);
  const saved = [];
  for (const id of tests) {
    const prompt = rules.tests.find((t) => t.id === id).prompt;
    if (sent !== null && String(sent).trim() !== prompt) return { status: 'FAIL', problems: [`${id} was reworded. Send it word for word: "${prompt}"`] };
    const file = path.join(dir, 'raw', slug(tool), `${id}.json`);
    const record = readJsonIf(file) ?? { tool: String(tool).trim(), test: id, prompt, rules_sha256: rules.sha256, entries: [] };
    const why = status === 'no-connector' ? `${NO_CONNECTOR}${known?.connector ? `; add the connector ${known.connector}` : ''}` : reason;
    record.entries.push({ at: now, status, reason: why ?? null, reply: status === 'replied' || status === 'error' ? reply : null });
    write(path.dirname(file), path.basename(file), record);
    saved.push({ test: id, file, attempt: record.entries.length });
  }
  return {
    status: 'ok', tool: String(tool).trim(), recorded: status, saved,
    reply_preview: status === 'replied' || status === 'error' ? trim(replyText(reply), 600) : null,
    ...(status === 'no-connector' ? { line: `${tool}: ${NO_CONNECTOR}.${known?.connector ? ` Add ${known.connector} to test it.` : ''}` } : {}),
  };
}

/** The entry that gets judged: the first real reply. A retry is only allowed after an error. */
export function judgedEntry(record) {
  return record.entries.find((e) => e.status !== 'error') ?? record.entries.at(-1);
}

// ---------------------------------------------------------------------------
// 3. Anonymise: Tool A to Tool F by a seeded shuffle; names, handles and links removed.
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Same seed, same order: a Fisher-Yates shuffle of the sorted names. */
export function seededShuffle(items, seed) {
  const numeric = Number.isInteger(Number(seed)) ? Number(seed) : parseInt(sha256(String(seed)).slice(0, 8), 16);
  const random = mulberry32(numeric);
  const out = [...items].sort();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const URL_RE = /\bhttps?:\/\/[^\s"'<>)\]}]+|\bwww\.[^\s"'<>)\]}]+/gi;
const DOMAIN_RE = /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|app|so|io|co|net|org|ai|me|xyz|social|link|ly)\b(?:\/[^\s"'<>)\]}]*)?/gi;
const HANDLE_RE = /(^|[^\w])@[A-Za-z0-9_](?:[A-Za-z0-9_.]*[A-Za-z0-9_])?/g;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const termRe = (term) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(term).replace(/\s+/g, '\\s*')}(?![\\p{L}\\p{N}])`, 'giu');

/** Every name a reply could leak: the tools in this run, every known scheduler, and the aliases in tools.json. */
export function blindTerms(toolNames, toolsFile = null) {
  const terms = new Set();
  for (const name of toolNames) terms.add(name);
  for (const s of KNOWN_SCHEDULERS) { terms.add(s.name); s.aliases.forEach((a) => terms.add(a)); }
  for (const t of toolsFile?.tools ?? []) { if (t.name) terms.add(t.name); (t.aliases ?? []).forEach((a) => terms.add(a)); }
  return [...terms].filter((t) => String(t).trim().length > 1).sort((a, b) => b.length - a.length);
}

/** Replace emails, links, handles and every tool name. Order matters: links before names. */
export function anonymiseText(text, terms) {
  let out = String(text ?? '');
  out = out.replace(EMAIL_RE, '[email]').replace(URL_RE, '[link]').replace(HANDLE_RE, '$1[handle]').replace(DOMAIN_RE, '[link]');
  for (const term of terms) out = out.replace(termRe(term), '[tool]');
  return out;
}

/** What is still identifying after anonymising: any term, link, handle or email. Empty means clean. */
export function findLeaks(text, terms) {
  const leaks = [];
  const source = String(text ?? '');
  for (const term of terms) if (termRe(term).test(source)) leaks.push(term);
  for (const re of [URL_RE, DOMAIN_RE, EMAIL_RE]) leaks.push(...(source.match(re) ?? []));
  for (const m of source.matchAll(HANDLE_RE)) leaks.push(m[0].trim());
  return [...new Set(leaks)];
}

export function loadRaw(dir) {
  const root = path.join(dir, 'raw');
  if (!fs.existsSync(root)) return [];
  const records = [];
  for (const folder of fs.readdirSync(root).sort()) {
    const full = path.join(root, folder);
    if (!fs.statSync(full).isDirectory()) continue;
    for (const file of fs.readdirSync(full).filter((f) => /^T\d\.json$/.test(f)).sort()) records.push(readJson(path.join(full, file)));
  }
  return records;
}

export function anonymiseRun({ dir, seed = null, now = new Date().toISOString() }) {
  if (!readJsonIf(path.join(dir, 'rules.json'))) return { status: 'FAIL', problems: ['no rules.json: lock the rules first'] };
  if (fs.existsSync(path.join(dir, 'seal.json'))) return { status: 'FAIL', problems: ['already sealed: the key cannot change after sealing. Start a new run folder to run again.'] };
  const records = loadRaw(dir);
  const names = [...new Set(records.map((r) => r.tool))];
  if (!names.length) return { status: 'FAIL', problems: ['no raw replies recorded yet'] };
  if (names.length > LETTERS.length) return { status: 'FAIL', problems: [`at most ${LETTERS.length} tools per showdown (Tool A to Tool F); got ${names.length}`] };
  const usedSeed = seed === null || seed === undefined ? crypto.randomInt(1, 2 ** 31) : Number.isInteger(Number(seed)) ? Number(seed) : String(seed);
  const order = seededShuffle(names, usedSeed);
  const letters = Object.fromEntries(order.map((name, i) => [`Tool ${LETTERS[i]}`, name]));
  const letterOf = Object.fromEntries(Object.entries(letters).map(([letter, name]) => [name, letter]));
  const terms = blindTerms(names, readJsonIf(path.join(dir, 'tools.json')));
  const leaks = [];
  const cells = [];
  for (const record of records) {
    const letter = letterOf[record.tool];
    const entry = judgedEntry(record);
    const anon = {
      tool: letter, test: record.test, prompt: record.prompt, status: entry.status,
      reason: entry.reason ? anonymiseText(entry.reason, terms) : null,
      reply: entry.reply === null ? null : anonymiseText(replyText(entry.reply), terms),
      attempts: record.entries.length,
    };
    const found = findLeaks(`${anon.reason ?? ''}\n${anon.reply ?? ''}`, terms);
    if (found.length) leaks.push({ cell: `${letter}/${record.test}`, found });
    write(path.join(dir, 'anon', letter.replace(' ', '-')), `${record.test}.json`, anon);
    cells.push(`${letter}/${record.test}`);
  }
  if (leaks.length) return { status: 'FAIL', problems: ['anonymised replies still name a tool, link or handle'], leaks };
  const keyText = `${JSON.stringify({ record_type: 'SchedulerShowdownKeyV1', seed: usedSeed, sealed_at: now, letters }, null, 2)}\n`;
  write(dir, 'key.json', keyText);
  const keyHash = sha256(keyText);
  write(dir, 'seal.json', { key_sha256: keyHash, sealed_at: now, tools: Object.keys(letters), cells: cells.length });
  return { status: 'ok', tools: Object.keys(letters), cells: cells.length, seed: usedSeed, key_sha256: keyHash, sealed_at: now,
    line: `Sealed: ${Object.keys(letters).length} tools as ${Object.keys(letters).join(', ')}. Key sha256 ${keyHash}.` };
}

// ---------------------------------------------------------------------------
// 4. Judge: the exact prompt for the outside model, then its grades parsed.
// ---------------------------------------------------------------------------
export function loadAnon(dir) {
  const root = path.join(dir, 'anon');
  if (!fs.existsSync(root)) return [];
  const cells = [];
  for (const folder of fs.readdirSync(root).sort()) {
    for (const file of fs.readdirSync(path.join(root, folder)).filter((f) => /^T\d\.json$/.test(f)).sort()) cells.push(readJson(path.join(root, folder, file)));
  }
  return cells;
}

/** Cells the rules score without a judge: no connector, or a capability the tool's own tool list lacks. */
export function ruleGrade(cell) {
  if (cell.status === 'no-connector') return { grade: 'fail', evidence: NO_CONNECTOR, by: 'rules', no_connector: true };
  if (cell.status === 'no-capability') return { grade: 'fail', evidence: `no capability: "${oneLine(cell.reason)}"`, by: 'rules' };
  return null;
}

export function judgePrompt({ rules, cells, maxReply = 4000 }) {
  const judged = cells.filter((c) => !ruleGrade(c));
  return [
    'You are the blind judge in a fair test of social media schedulers. You have not seen the conversation.',
    'Use only the text below. Do not open files, run commands or browse.',
    'The tool names are hidden as Tool A to Tool F. Do not guess them. Grade each cell against the rules only, not on style or length.',
    '',
    `Rules (locked before the run, sha256 ${rules.sha256}):`,
    ...rules.tests.flatMap((t) => [`${t.id} prompt: "${t.prompt}"`, `  pass: ${t.pass}`, `  partial: ${t.partial}`, `  fail: ${t.fail}`]),
    'If Claude would have had to write, compute or track something itself, the tool did not do it.',
    'An error reply that never got a real answer is a fail.',
    '',
    'Replies (raw tool output, anonymised: [tool], [link], [handle] and [email] replace what would identify a tool):',
    ...judged.flatMap((c) => ['', `### ${c.tool} · ${c.test}`, `status: ${c.status}`, trim(c.reply ?? c.reason ?? '(empty)', maxReply)]),
    '',
    `Grade exactly these cells: ${judged.map((c) => `${c.tool} ${c.test}`).join(', ')}.`,
    'Reply with JSON only, no other text: {"grades": {"Tool A": {"T1": {"grade": "pass" or "partial" or "fail", "evidence": "one line that points at the reply"}}}}',
  ].join('\n');
}

function jsonObjects(text) {
  const source = String(text ?? '');
  const found = [];
  for (let i = source.indexOf('{'); i !== -1; i = source.indexOf('{', i + 1)) {
    let depth = 0;
    let inString = false;
    for (let j = i; j < source.length; j += 1) {
      const ch = source[j];
      if (inString) { if (ch === '\\') j += 1; else if (ch === '"') inString = false; } else if (ch === '"') inString = true;
      else if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) { try { found.push(JSON.parse(source.slice(i, j + 1))); } catch { /* not JSON */ } break; }
      }
    }
  }
  return found;
}

/** The judge's reply -> one grade per cell. Rule-scored cells are filled in by the rules, not the judge. */
export function parseGrades(text, cells) {
  const reply = jsonObjects(text).find((value) => value && typeof value.grades === 'object' && value.grades !== null);
  const grades = {};
  const problems = [];
  for (const cell of cells) {
    grades[cell.tool] ??= {};
    const byRule = ruleGrade(cell);
    if (byRule) { grades[cell.tool][cell.test] = byRule; continue; }
    const given = reply?.grades?.[cell.tool]?.[cell.test];
    const grade = String(given?.grade ?? '').toLowerCase();
    if (!Object.hasOwn(POINTS, grade)) { problems.push(`${cell.tool} ${cell.test}: no pass, partial or fail grade`); continue; }
    grades[cell.tool][cell.test] = { grade, evidence: oneLine(given.evidence) || '(no evidence line)', by: 'judge' };
  }
  if (!reply) problems.unshift('the judge reply has no {"grades": ...} JSON');
  return { status: problems.length ? 'FAIL' : 'ok', grades, problems };
}

export function judgeLabel(kind) {
  return kind === 'codex' ? 'Codex (codex exec, read-only sandbox), a different model' : 'a fresh Claude instance with no prior context (Codex was not available)';
}

// ---------------------------------------------------------------------------
// 5. Scorecard: tools x tests, then price, free plan and networks. Always.
// ---------------------------------------------------------------------------
const SYMBOL = { pass: '✓ pass', partial: '◐ partial', fail: '✗ fail' };
export const cellText = (g) => (!g ? UNKNOWN : g.no_connector ? `✗ ${NO_CONNECTOR}` : SYMBOL[g.grade]);

export function totals(grades) {
  return Object.fromEntries(Object.entries(grades).map(([tool, row]) => [tool, TESTS.reduce((sum, t) => sum + (POINTS[row[t]?.grade] ?? 0), 0)]));
}

/** Who leads after each test, by letter. Equal points are listed together. */
export function leaderAfter(grades) {
  const out = {};
  const running = Object.fromEntries(Object.keys(grades).map((tool) => [tool, 0]));
  for (const t of TESTS) {
    for (const tool of Object.keys(running)) running[tool] += POINTS[grades[tool]?.[t]?.grade] ?? 0;
    const best = Math.max(...Object.values(running));
    out[t] = { leaders: Object.keys(running).filter((tool) => running[tool] === best), points: best };
  }
  return out;
}

const joinNames = (names) => (names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

/** One line, honest about ties. */
export function verdictLine(points) {
  const ranked = Object.entries(points).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return 'No tools were scored.';
  if (ranked.length === 1) return `Only one tool was tested: ${ranked[0][0]}, ${ranked[0][1]} of ${MAX_POINTS} points.`;
  const best = ranked[0][1];
  const top = ranked.filter(([, p]) => p === best).map(([name]) => name);
  if (top.length > 1) return `Tie: ${joinNames(top)}, ${best} of ${MAX_POINTS} points each. No single winner.`;
  return `Winner: ${top[0]}, ${best} of ${MAX_POINTS} points. Next: ${ranked[1][0]}, ${ranked[1][1]} of ${MAX_POINTS}.`;
}

/**
 * The scorecard model: T1 to T5, points, then price, free plan and networks (always present).
 * `letters` is the key (letter -> name), used to look up each tool's pricing in tools.json.
 * Names are shown only when `named` (after unblinding); blind pricing text is anonymised.
 */
export function buildScorecard({ grades, letters = null, toolsFile = null, named = false, terms = [] }) {
  const columns = Object.keys(grades).sort();
  const realName = (letter) => letters?.[letter] ?? null;
  const label = (letter) => (named && realName(letter) ? realName(letter) : letter);
  const pricing = (letter) => (toolsFile?.tools ?? []).find((t) => slug(t.name) === slug(realName(letter) ?? ''))?.pricing ?? {};
  const priceCell = (letter, field) => {
    const value = pricing(letter)[field];
    if (value === undefined || value === null || value === '') return `${UNKNOWN} (pricing page not read)`;
    return named ? String(value) : anonymiseText(String(value), terms);
  };
  const points = totals(grades);
  return {
    named,
    columns: columns.map(label),
    rows: [
      ...TESTS.map((t) => ({ label: t, cells: columns.map((c) => cellText(grades[c][t])) })),
      { label: 'Points', cells: columns.map((c) => `${points[c]} of ${MAX_POINTS}`) },
      { label: 'Price', cells: columns.map((c) => priceCell(c, 'price')), loss_row: true },
      { label: 'Free plan', cells: columns.map((c) => priceCell(c, 'free_plan')), loss_row: true },
      { label: 'Networks', cells: columns.map((c) => priceCell(c, 'networks')), loss_row: true },
    ],
    sources: columns.map((c) => ({ tool: label(c), url: named ? pricing(c).url ?? null : null, read_at: pricing(c).read_at ?? null })),
    points: Object.fromEntries(columns.map((c) => [label(c), points[c]])),
    leader_after: Object.fromEntries(Object.entries(leaderAfter(grades)).map(([t, v]) => [t, { leaders: v.leaders.map(label), points: v.points }])),
    verdict: verdictLine(Object.fromEntries(columns.map((c) => [label(c), points[c]]))),
  };
}

const mdCell = (text) => String(text).replace(/\|/g, '/').replace(/\s+/g, ' ');

export function renderScorecardMd(card, { rulesHash = null, keyHash = null, judge = null } = {}) {
  const lines = [
    `# Scheduler Showdown scorecard${card.named ? '' : ' (blind)'}`,
    '',
    DISCLOSURE,
    '',
    `| | ${card.columns.map(mdCell).join(' | ')} |`,
    `|---|${card.columns.map(() => '---').join('|')}|`,
    ...card.rows.map((r) => `| ${r.label} | ${r.cells.map(mdCell).join(' | ')} |`),
    '',
    'Pricing read live from each public pricing page:',
    ...card.sources.map((s) => `- ${s.tool}: ${s.url ?? (card.named ? 'URL not recorded' : 'URL hidden until unblinding')}${s.read_at ? ` (read ${s.read_at})` : ''}`),
    '',
    card.named ? `Verdict: ${card.verdict}` : `Leader so far, by letter: ${card.verdict}`,
  ];
  if (rulesHash) lines.push('', `Rules sha256: ${rulesHash}`);
  if (keyHash) lines.push(`Key sha256 (sealed before judging): ${keyHash}`);
  if (judge) lines.push(`Judge: ${judge.judge_label} · model ${judge.model}`);
  return `${lines.join('\n')}\n`;
}

const esc = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const gradeClass = (text) => (text.startsWith('✓') ? 'ok' : text.startsWith('◐') ? 'mid' : text.startsWith('✗') ? 'no' : '');

const STYLE = `:root{--bg:#0a0a0a;--panel:#151515;--line:#2a2a2a;--text:#fff;--muted:rgba(255,255,255,.66);--red:#ff0000;--soft:rgba(255,0,0,.12);--ok:#4ecdc4;--mid:#ffb84a}
@media (prefers-color-scheme:light){:root:not([data-theme="dark"]){--bg:#fafafa;--panel:#fff;--line:#e6e6e6;--text:#0a0a0a;--muted:#5a5a5a;--soft:rgba(255,0,0,.08);--ok:#13877e;--mid:#a86400}}
*{box-sizing:border-box}html,body{max-width:100%;overflow-x:hidden}body{margin:0;background:var(--bg);color:var(--text);font:18px/1.5 Inter,system-ui,-apple-system,sans-serif;overflow-wrap:anywhere}
main{max-width:960px;margin:auto;padding:28px 16px 64px}
.mono{font-family:'Space Mono',ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase;font-size:13px;color:var(--red)}
h1{font-size:clamp(32px,6vw,62px);line-height:1.04;margin:8px 0 10px;font-weight:900;letter-spacing:-.02em}h1 em{font-style:normal;color:var(--red)}
h2{font-size:clamp(20px,2.6vw,28px);margin:38px 0 12px;font-weight:800}.muted{color:var(--muted)}
.card{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:18px}
.disclose{border:2px solid var(--red);box-shadow:0 0 0 3px var(--soft);font-weight:700}
.verdict{background:var(--red);color:#fff;border-radius:18px;padding:20px}.verdict .mono{color:#fff;opacity:.85}.verdict p{margin:6px 0 0;font-size:clamp(20px,2.8vw,30px);font-weight:900}
.scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}table{width:100%;border-collapse:collapse;font-size:clamp(14px,1.6vw,18px)}
td,th{padding:10px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{font-weight:800}
td.ok{color:var(--ok);font-weight:800}td.mid{color:var(--mid);font-weight:800}td.no{color:var(--red);font-weight:800}tr.loss td,tr.loss th{background:var(--soft)}
code{font-family:'Space Mono',ui-monospace,monospace;font-size:.82em;word-break:break-all}
ul.did{list-style:none;padding:0;margin:0;display:grid;gap:8px}ul.did li{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:12px 14px}
.cta{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.btn{display:inline-flex;gap:8px;align-items:center;padding:16px 22px;border-radius:999px;font-weight:800;text-decoration:none;border:0;font-size:18px}
.btn.star{background:var(--text);color:var(--bg)}.btn.ghost{background:transparent;color:var(--text);border:2px solid var(--line)}
.foot{color:var(--muted);font-size:14px;margin-top:34px}`;
const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&family=Space+Mono:wght@700&display=swap" rel="stylesheet">';

export function scorecardTable(card) {
  return `<div class="scroll"><table><thead><tr><th></th>${card.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${card.rows.map((r) => `<tr class="${r.loss_row ? 'loss' : ''}"><th>${esc(r.label)}</th>${r.cells.map((cell) => `<td class="${gradeClass(cell)}">${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

export function renderScorecardHtml(card, { rulesHash = null, keyHash = null } = {}) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Showdown scorecard</title>${FONTS}<style>${STYLE}</style></head><body><main>
<div class="mono">Threadify · Scheduler Showdown · ${card.named ? 'unblinded' : 'blind'}</div>
<h1>The scorecard</h1>
<p class="card disclose">${esc(DISCLOSURE)}</p>
${scorecardTable(card)}
<p class="muted">${card.sources.map((s) => `${esc(s.tool)}: ${s.url ? esc(s.url) : card.named ? 'URL not recorded' : 'URL hidden until unblinding'}${s.read_at ? ` (read ${esc(s.read_at)})` : ''}`).join('<br>')}</p>
<div class="verdict"><div class="mono">${card.named ? 'Verdict' : 'Leader so far, by letter'}</div><p>${esc(card.verdict)}</p></div>
${rulesHash ? `<p class="foot">Rules sha256 <code>${esc(rulesHash)}</code>${keyHash ? `<br>Key sha256 <code>${esc(keyHash)}</code>` : ''}</p>` : ''}
</main></body></html>
`;
}

// ---------------------------------------------------------------------------
// 6. Unblind: only when the key still matches the hash printed before judging.
// ---------------------------------------------------------------------------
export function verifyKey(dir, expect = null) {
  const seal = readJsonIf(path.join(dir, 'seal.json'));
  const keyFile = path.join(dir, 'key.json');
  if (!seal || !fs.existsSync(keyFile)) return { ok: false, problem: 'no sealed key: run anonymise first' };
  const actual = sha256(fs.readFileSync(keyFile, 'utf8'));
  if (actual !== seal.key_sha256) return { ok: false, problem: `key.json changed after sealing: sha256 ${actual}, sealed ${seal.key_sha256}. Refusing to unblind.` };
  if (expect && expect !== actual) return { ok: false, problem: `key sha256 ${actual} is not the printed hash ${expect}. Refusing to unblind.` };
  return { ok: true, key_sha256: actual, sealedKey: readJson(keyFile) };
}

// ---------------------------------------------------------------------------
// 7. Lowercase guard: the only change allowed to Threadify's text is casing.
// ---------------------------------------------------------------------------
const WORDS = /[\p{L}\p{M}\p{N}]+/gu;

export function lowercaseGuard(original, final) {
  const a = String(original ?? '');
  const b = String(final ?? '');
  const lowerEqual = a.toLowerCase() === b.toLowerCase();
  const wa = a.match(WORDS) ?? [];
  const wb = b.match(WORDS) ?? [];
  const changes = [];
  for (let i = 0; i < Math.max(wa.length, wb.length); i += 1) {
    if ((wa[i] ?? '').toLowerCase() !== (wb[i] ?? '').toLowerCase()) changes.push({ at: i, original: wa[i] ?? null, final: wb[i] ?? null });
  }
  const status = lowerEqual ? 'PASS' : 'FAIL';
  return {
    status, lower_equal: lowerEqual, original_sha256: sha256(a), final_sha256: sha256(b), word_changes: changes.slice(0, 20),
    line: `guard: lower(original) == lower(final) ${status}`,
  };
}

// ---------------------------------------------------------------------------
// 8. The report page: Threadify-branded, in the style of the 0.41.0 reward page.
// ---------------------------------------------------------------------------
export function renderReport(run) {
  const { rules, seal, judge, card, grades, letters = null, cells = [], cleanup = null } = run;
  const name = (letter) => (letters ? letters[letter] : letter);
  const did = Object.keys(grades ?? {}).sort().map((letter) => {
    const row = grades[letter];
    const attempts = cells.filter((c) => c.tool === letter && c.attempts > 1).map((c) => `${c.test}: ${c.attempts} attempts, the first real reply was judged`);
    return `<li><b>${esc(name(letter))}</b>${letters ? ` <span class="muted">(${esc(letter)})</span>` : ''}${TESTS.map((t) => `<br>${esc(t)} ${esc(cellText(row[t]))}${row[t]?.evidence && !row[t]?.no_connector ? `: <span class="muted">${esc(row[t].evidence)}</span>` : ''}`).join('')}${attempts.length ? `<br><span class="muted">${esc(attempts.join('; '))}</span>` : ''}</li>`;
  }).join('');
  const stamp = run.run_at ?? '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Scheduler Showdown</title>${FONTS}<style>${STYLE}</style></head><body><main>
<div class="mono">Threadify · Scheduler Showdown</div>
<h1>Every scheduler has an AI connection now. <em>Which one knows you?</em></h1>
<p class="card disclose">${esc(DISCLOSURE)}</p>
${card ? `<div class="verdict"><div class="mono">${card.named ? 'Verdict' : 'Still blind: leader by letter'}</div><p>${esc(card.verdict)}</p></div>` : '<p class="muted">Not scored yet.</p>'}
<h2>The scorecard</h2>${card ? scorecardTable(card) : '<p class="muted">Not scored yet.</p>'}
<p class="muted">Price, free plan and networks are read live from each tool's public pricing page. No row is hidden because Threadify loses it.${card ? `<br>${card.sources.map((s) => `${esc(s.tool)}: ${s.url ? esc(s.url) : 'URL hidden until unblinding'}${s.read_at ? ` (read ${esc(s.read_at)})` : ''}`).join('<br>')}` : ''}</p>
<h2>The rules, locked before the run</h2><div class="card"><p style="margin:0">Five fixed prompts, the same words for every tool, through each tool's own AI connection. <a href="${RULES_URL}" style="color:inherit">Read the public rules</a>.</p><p class="muted" style="margin:10px 0 0">Rules sha256 <code>${esc(rules?.sha256 ?? UNKNOWN)}</code><br>Locked ${esc(rules?.locked_at ?? UNKNOWN)}</p><ol style="margin:12px 0 0;padding-left:22px">${(rules?.tests ?? []).map((t) => `<li>${esc(`"${t.prompt}"`)}</li>`).join('')}</ol></div>
<h2>The blind judge</h2><div class="card"><p style="margin:0;font-weight:800">${esc(judge?.judge_label ?? 'Not judged yet')}</p><p class="muted" style="margin:6px 0 0">Model: ${esc(judge?.model ?? UNKNOWN)}. The judge saw only the rules and the anonymised replies (Tool A to Tool F).<br>Key sha256, sealed before judging: <code>${esc(seal?.key_sha256 ?? UNKNOWN)}</code>${letters ? '<br>Key verified against that hash before unblinding.' : ''}</p></div>
<h2>What each tool did</h2>${did ? `<ul class="did">${did}</ul>` : '<p class="muted">Not graded yet.</p>'}
${cleanup?.items?.length ? `<h2>Cleanup, read back</h2><ul class="did">${cleanup.items.map((i) => `<li><b>${esc(i.tool)}</b>: ${esc(i.what)}<br><span class="muted">${esc(i.readback)}</span></li>`).join('')}</ul>` : ''}
<h2>Run it on your tools</h2><div class="card"><p style="margin:0 0 10px">Don't trust this page. Run the same test on the schedulers you pay for:</p><ol style="margin:0;padding-left:22px"><li>Install Threadify Workflows with the line in <a href="${WORKFLOW_URL}" style="color:inherit">the workflow README</a>.</li><li>Connect each scheduler's AI connector in your agent.</li><li>Say <code>/threadify-scheduler-showdown</code>. Your run locks the same public rules and prints the same hash.</li></ol></div>
<h2>Help the next creator find this</h2><div class="card"><p style="margin:0 0 12px">Scheduler Showdown is free and open source. A star helps other creators find it.</p><div class="cta"><a class="btn star" href="${REPO_URL}" target="_blank" rel="noopener">⭐ Star Threadify Workflows on GitHub</a><a class="btn ghost" href="${esc(THREADIFY_URL)}" target="_blank" rel="noopener">Open Threadify</a></div></div>
<p class="foot">Every grade comes from the outside judge or the public rules, and every raw reply is kept in the run folder. ${esc(stamp)}</p>
</main></body></html>
`;
}

// ---------------------------------------------------------------------------
// CLI.
// ---------------------------------------------------------------------------
function argValue(args, name, fallback = undefined) {
  const at = args.indexOf(name);
  return at >= 0 && at + 1 < args.length ? args[at + 1] : fallback;
}

function loadRun(dir) {
  const rules = readJsonIf(path.join(dir, 'rules.json'));
  const seal = readJsonIf(path.join(dir, 'seal.json'));
  const gradesFile = readJsonIf(path.join(dir, 'grades.json'));
  return { rules, seal, gradesFile, toolsFile: readJsonIf(path.join(dir, 'tools.json')), cells: loadAnon(dir) };
}

export async function main(argv) {
  const [command, ...args] = argv;
  const dir = path.resolve(argValue(args, '--dir', argValue(args, '--out', '.')));
  const now = argValue(args, '--now', new Date().toISOString());
  switch (command) {
    case 'rules': {
      const markdown = fs.readFileSync(path.resolve(argValue(args, '--rules', RULES_PATH)), 'utf8');
      return lockRules({ markdown, out: dir, now });
    }
    case 'record': {
      const file = argValue(args, '--file');
      let reply = argValue(args, '--text', null);
      if (file) { const raw = fs.readFileSync(path.resolve(file), 'utf8'); try { reply = JSON.parse(raw); } catch { reply = raw; } }
      return recordReply({ dir, tool: argValue(args, '--tool'), test: argValue(args, '--test'), reply, status: argValue(args, '--status', 'replied'), reason: argValue(args, '--reason', null), sent: argValue(args, '--sent', null), now });
    }
    case 'anonymise':
    case 'anonymize':
      return anonymiseRun({ dir, seed: argValue(args, '--seed', null), now });
    case 'judge-prompt': {
      const { rules, seal, cells } = loadRun(dir);
      if (!seal || !cells.length) return { status: 'FAIL', problems: ['anonymise first: the judge only ever sees sealed, anonymised replies'] };
      const replyFile = argValue(args, '--reply');
      if (!replyFile) {
        // The judge runs in judge/, a folder holding only this prompt, so it never sits next to key.json.
        const prompt = judgePrompt({ rules, cells });
        const judgeDir = path.join(dir, 'judge');
        const file = write(judgeDir, 'prompt.txt', prompt);
        return { status: 'ok', prompt: file, characters: prompt.length, key_sha256: seal.key_sha256,
          run: `codex exec -s read-only --skip-git-repo-check -C "${judgeDir}" -o "${path.join(judgeDir, 'reply.txt')}" "$(cat "${file}")"`,
          fallback: `cd "${judgeDir}" && claude -p "$(cat "${file}")" --tools "" --strict-mcp-config --no-session-persistence --output-format json > reply.json`,
          line: `Judge prompt written. Key sha256 ${seal.key_sha256} was sealed before judging.` };
      }
      const kind = argValue(args, '--judge', 'codex');
      let text = fs.readFileSync(path.resolve(replyFile), 'utf8');
      let model = argValue(args, '--model', null);
      if (kind === 'claude') { try { const parsed = JSON.parse(text); text = String(parsed.result ?? text); model ??= parsed.model ?? Object.keys(parsed.modelUsage ?? {})[0] ?? null; } catch { /* plain text */ } }
      const parsed = parseGrades(text, cells);
      if (parsed.status !== 'ok') return parsed;
      const record = { judge: kind, judge_label: judgeLabel(kind), model: model ?? UNKNOWN, graded_at: now, key_sha256: seal.key_sha256, reply_sha256: sha256(text), grades: parsed.grades };
      write(dir, 'grades.json', record);
      const leaders = leaderAfter(parsed.grades);
      return { status: 'ok', grades: path.join(dir, 'grades.json'), judge_label: record.judge_label, model: record.model, leader_after: leaders,
        line: `After T2 the leader is ${joinNames(leaders.T2.leaders)} with ${leaders.T2.points} points.` };
    }
    case 'scorecard': {
      const { rules, seal, gradesFile, toolsFile } = loadRun(dir);
      if (!gradesFile) return { status: 'FAIL', problems: ['no grades.json: run the judge first'] };
      // The key finds each letter's pricing in tools.json; the names stay hidden until unblind.
      const letters = readJsonIf(path.join(dir, 'key.json'))?.letters ?? null;
      const terms = blindTerms(Object.values(letters ?? {}), toolsFile);
      const blind = buildScorecard({ grades: gradesFile.grades, letters, toolsFile, named: false, terms });
      const extra = { rulesHash: rules?.sha256, keyHash: seal?.key_sha256, judge: gradesFile };
      write(dir, 'scorecard.md', renderScorecardMd(blind, extra));
      write(dir, 'scorecard.html', renderScorecardHtml(blind, extra));
      write(dir, 'scorecard-blind.md', renderScorecardMd(blind, extra));
      return { status: 'ok', scorecard: path.join(dir, 'scorecard.md'), html: path.join(dir, 'scorecard.html'), columns: blind.columns, rows: blind.rows.map((r) => r.label), points: blind.points, leader_after: blind.leader_after, line: blind.verdict };
    }
    case 'unblind': {
      const check = verifyKey(dir, argValue(args, '--expect', null));
      if (!check.ok) return { status: 'FAIL', problems: [check.problem] };
      const { rules, gradesFile, toolsFile } = loadRun(dir);
      if (!gradesFile) return { status: 'FAIL', problems: ['no grades.json: judge before unblinding'] };
      const card = buildScorecard({ grades: gradesFile.grades, letters: check.sealedKey.letters, toolsFile, named: true });
      const extra = { rulesHash: rules?.sha256, keyHash: check.key_sha256, judge: gradesFile };
      write(dir, 'scorecard.md', renderScorecardMd(card, extra));
      write(dir, 'scorecard.html', renderScorecardHtml(card, extra));
      write(dir, 'unblind.json', { key_sha256: check.key_sha256, verified: true, unblinded_at: now, letters: check.sealedKey.letters, points: card.points, verdict: card.verdict });
      return { status: 'ok', key_sha256: check.key_sha256, verified: true, letters: check.sealedKey.letters, points: card.points, line: card.verdict };
    }
    case 'lowercase-guard': {
      const original = argValue(args, '--original');
      const final = argValue(args, '--final');
      if (!original || !final) return { status: 'usage', usage: 'lowercase-guard --original original.txt --final final.txt' };
      const result = lowercaseGuard(fs.readFileSync(path.resolve(original), 'utf8').trim(), fs.readFileSync(path.resolve(final), 'utf8').trim());
      if (argValue(args, '--dir')) write(dir, 'lowercase-guard.json', result);
      return result;
    }
    case 'report': {
      const { rules, seal, gradesFile, toolsFile, cells } = loadRun(dir);
      if (!rules) return { status: 'FAIL', problems: ['no rules.json in this run folder'] };
      // Names appear only after a verified unblind; before that the report stays blind.
      const named = Boolean(readJsonIf(path.join(dir, 'unblind.json')));
      let letters = readJsonIf(path.join(dir, 'key.json'))?.letters ?? null;
      if (named) {
        const check = verifyKey(dir);
        if (!check.ok) return { status: 'FAIL', problems: [check.problem] };
        letters = check.sealedKey.letters;
      }
      const terms = blindTerms(Object.values(letters ?? {}), toolsFile);
      const card = gradesFile ? buildScorecard({ grades: gradesFile.grades, letters, toolsFile, named, terms }) : null;
      const html = renderReport({ rules, seal, judge: gradesFile, card, grades: gradesFile?.grades ?? {}, letters: named ? letters : null, cells, cleanup: readJsonIf(path.join(dir, 'cleanup.json')), run_at: now });
      if (EMAIL.test(html)) return { status: 'FAIL', problems: ['the report would show an email address; remove it from the run files'] };
      return { status: 'ok', report: write(dir, 'report.html', html), named, rules_sha256: rules.sha256 };
    }
    default:
      return { status: 'usage', usage: 'scheduler-showdown.mjs rules|record|anonymise|judge-prompt|scorecard|unblind|lowercase-guard|report (see the header of this file)' };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    const result = await main(process.argv.slice(2));
    if (result) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result && ['usage', 'FAIL'].includes(result.status) ? 1 : 0;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: 'failed', error: error.message }, null, 2)}\n`);
    process.exitCode = 1;
  }
}
