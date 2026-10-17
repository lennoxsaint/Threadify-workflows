#!/usr/bin/env node
// Research Army: an army of Haiku agents and one Opus race to research the
// most-liked recent Threads posts in a niche, and a script (this one) checks
// every claim. Node 18+, no npm packages. Every command prints JSON unless it
// is the live race view.
//
//   node research-army.mjs catalog                                    the checker's fixed test catalog
//   node research-army.mjs estimate --keywords keywords.json          credits the corpus pull will spend
//   node research-army.mjs balance                                    ScrapeCreators credits left (free call)
//   node research-army.mjs corpus --keywords keywords.json --dir <run> [--days 30] [--top 100] [--max-credits 40]
//   node research-army.mjs normalize --dir <run> [--days 30] [--top 100] [--today YYYY-MM-DD]
//   node research-army.mjs race --dir <run> [--army 20] [--niche "..."] [--timeout-min 12]
//   node research-army.mjs watch --dir <run> [--once]                 two-lane live view from race/status.json
//   node research-army.mjs check --dir <run>                          re-check findings, rebuild check.json + scoreboard.html
//   node research-army.mjs facts --dir <run>                          the winner's backed findings as post facts
//   node research-army.mjs check-post --dir <run> --file post.txt [--plug plug.txt --link <offer url>]
//
// ScrapeCreators calls go through curl with the header file saved by
// scrapecreators-key.mjs; nothing secret is printed, logged or copied.
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { realpathSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SC_BASE = 'https://api.scrapecreators.com';
export const DEFAULT_ARMY = 20;
export const PICKS = 8;
export const MIN_SEARCHES = 20;
export const MAX_SEARCHES = 30;
export const SILENCE_LIMIT_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// The checker's fixed catalog. Both sides pick from this list; the checker
// owns every definition, so nobody grades their own homework.
// ---------------------------------------------------------------------------
export const AI_TOOLS = [
  'chatgpt', 'gpt', 'openai', 'claude', 'anthropic', 'gemini', 'grok', 'perplexity', 'copilot', 'midjourney',
  'cursor', 'deepseek', 'llama', 'meta ai', 'sora', 'veo', 'runway', 'elevenlabs', 'heygen', 'notebooklm',
  'lovable', 'bolt', 'replit', 'n8n', 'zapier', 'make.com', 'manus', 'kling', 'suno', 'canva ai', 'nano banana',
];
const EMOJI_RE = /\p{Extended_Pictographic}/u;
const MONEY_RE = /[$€£]\s?\d/;
const LINK_RE = /https?:\/\/\S+|www\.\S+|\b[a-z0-9-]+\.(?:com|ai|io|app|co|net|org|me|link|ly|gg|dev)\b(?:\/\S*)?/i;
const LIST_LINE_RE = /^\s*(?:[-*•▪→✅✔️👉]|\d{1,2}[.)])\s*\S/gmu;
const toolPattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${AI_TOOLS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')).join('|')})(?![\\p{L}\\p{N}])`, 'iu');

export const CATALOG = [
  { id: 'opens_with_number', phrase: 'open with a number', rule: 'the first character after any spaces is a digit, or $ followed by a digit', test: (t) => /^[$]?\d/.test(t.trimStart()) },
  { id: 'has_question', phrase: 'ask a question', rule: 'contains a question mark "?"', test: (t) => t.includes('?') },
  { id: 'ends_with_question', phrase: 'end on a question', rule: 'the last non-space character is "?"', test: (t) => t.trimEnd().endsWith('?') },
  { id: 'length_short', phrase: 'are under 100 characters', rule: 'fewer than 100 characters in total', test: (t) => [...t].length < 100 },
  { id: 'length_medium', phrase: 'are 100 to 280 characters', rule: '100 to 280 characters in total', test: (t) => [...t].length >= 100 && [...t].length <= 280 },
  { id: 'length_long', phrase: 'are over 280 characters', rule: 'more than 280 characters in total', test: (t) => [...t].length > 280 },
  { id: 'first_person_i', phrase: 'use first person "I"', rule: 'contains the word "I" on its own (I, I\'m, I\'ve, I\'d, I\'ll count; any case)', test: (t) => /(?<![\p{L}\p{N}])i(?![\p{L}\p{N}])/iu.test(t) },
  { id: 'opens_with_i', phrase: 'start with "I"', rule: 'the first word is "I" (or I\'m, I\'ve, I\'d, I\'ll; any case)', test: (t) => /^i(?:['’](?:m|ve|d|ll))?(?![\p{L}\p{N}])/iu.test(t.trimStart()) },
  { id: 'says_you', phrase: 'talk to the reader as "you"', rule: 'contains the word "you" or "your" (any case)', test: (t) => /(?<![\p{L}\p{N}])(?:you|your|you're|youre)(?![\p{L}\p{N}])/iu.test(t) },
  { id: 'has_list', phrase: 'use a list', rule: 'at least 2 lines that start with -, *, •, →, ✅, 👉 or 1. / 1)', test: (t) => (t.match(LIST_LINE_RE) || []).length >= 2 },
  { id: 'has_line_breaks', phrase: 'use line breaks', rule: 'contains at least one line break', test: (t) => /\n/.test(t.trim()) },
  { id: 'mentions_ai_tool', phrase: 'name an AI tool', rule: `names one of these AI tools (any case): ${AI_TOOLS.join(', ')}`, test: (t) => toolPattern.test(t) },
  { id: 'has_link', phrase: 'contain a link', rule: 'contains a web link (http, www. or a domain like example.com)', test: (t) => LINK_RE.test(t) },
  { id: 'has_money', phrase: 'mention a $ amount', rule: 'contains a money amount: $, € or £ followed by a digit', test: (t) => MONEY_RE.test(t) },
  { id: 'has_number', phrase: 'contain a number', rule: 'contains at least one digit 0-9', test: (t) => /\d/.test(t) },
  { id: 'has_emoji', phrase: 'use an emoji', rule: 'contains at least one emoji', test: (t) => EMOJI_RE.test(t) },
  { id: 'all_lowercase', phrase: 'are written all in lowercase', rule: 'has letters and not one uppercase letter', test: (t) => /\p{L}/u.test(t) && !/\p{Lu}/u.test(t) },
  { id: 'has_exclamation', phrase: 'use an exclamation mark', rule: 'contains "!"', test: (t) => t.includes('!') },
  { id: 'has_hashtag', phrase: 'use a hashtag', rule: 'contains a # followed by a letter', test: (t) => /#\p{L}/u.test(t) },
];
const CATALOG_BY_ID = new Map(CATALOG.map((entry) => [entry.id, entry]));

export function runTest(id, text) {
  const entry = CATALOG_BY_ID.get(id);
  if (!entry) throw new Error(`unknown test: ${id}`);
  return entry.test(String(text ?? ''));
}

export function catalogMarkdown() {
  return CATALOG.map((entry) => `- \`${entry.id}\`: ${entry.rule}`).join('\n');
}

// ---------------------------------------------------------------------------
// Corpus: ScrapeCreators keyword searches -> deduped, in-window, English, top N by likes.
// ---------------------------------------------------------------------------
const COMMON_WORDS = /\b(the|you|and|to|a|is|it|of|for|your|i|this|that|with|on|in|my|me|be|are|was|do|not|but|what|if|so|just)\b/g;

/** A simple English filter: mostly Latin letters and at least two common English words. */
export function isEnglish(text) {
  const compact = String(text).replace(/\s/g, '');
  if (!compact) return false;
  const latin = (compact.match(/[A-Za-z]/g) || []).length;
  const common = (String(text).toLowerCase().match(COMMON_WORDS) || []).length;
  return latin >= 0.6 * compact.length && common >= 2;
}

export function windowStart(today, days = 30) {
  const base = today ? new Date(`${today}T00:00:00Z`) : new Date();
  const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - days);
  return start;
}

const isoDay = (date) => date.toISOString().slice(0, 10);

/**
 * pages: [{query, body}] where body is a ScrapeCreators /v1/threads/search reply.
 * Returns {meta, posts}; posts are numbered n = 1..top by likes (ties by id).
 */
export function normalizeCorpus(pages, { today, days = 30, top = 100, niche = null } = {}) {
  const start = windowStart(today, days);
  const seen = new Map();
  const stats = { raw: 0, duplicates: 0, empty: 0, out_of_window: 0, non_english: 0 };
  for (const { query, body } of pages) {
    for (const post of body?.posts ?? []) {
      stats.raw += 1;
      const id = String(post.pk ?? post.id ?? '');
      if (!id) { stats.empty += 1; continue; }
      if (seen.has(id)) { stats.duplicates += 1; seen.get(id).queries.push(query); continue; }
      const text = String(post.caption?.text ?? '').trim();
      if (!text) { stats.empty += 1; continue; }
      const when = Number.isFinite(post.taken_at) ? new Date(post.taken_at * 1000) : null;
      if (!when || when < start) { stats.out_of_window += 1; continue; }
      if (!isEnglish(text)) { stats.non_english += 1; continue; }
      const info = post.text_post_app_info ?? {};
      const handle = post.user?.username ?? null;
      seen.set(id, {
        id, handle, text, date: isoDay(when), taken_at: post.taken_at,
        likes: Number(post.like_count) || 0,
        replies: Number(info.direct_reply_count) || 0,
        reposts: Number(info.repost_count) || 0,
        quotes: Number(info.quote_count) || 0,
        url: post.url ?? (handle && post.code ? `https://www.threads.com/@${handle}/post/${post.code}` : null),
        queries: [query],
      });
    }
  }
  const eligible = [...seen.values()].sort((a, b) => b.likes - a.likes || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const posts = eligible.slice(0, top).map((row, index) => ({ n: index + 1, ...row }));
  const queries = [...new Set(pages.map((page) => page.query))];
  const meta = {
    source: 'ScrapeCreators GET /v1/threads/search (keyword search; a relevance sample, not a global ranking)',
    niche,
    window_start: isoDay(start),
    window_days: days,
    metric: 'likes (like_count); ScrapeCreators returns no view counts',
    searches: queries.length,
    queries,
    stats,
    eligible_after_filters: eligible.length,
    kept: posts.length,
    likes: posts.length ? { max: posts[0].likes, median: posts[Math.floor(posts.length / 2)].likes, min: posts[posts.length - 1].likes } : null,
    dates: posts.length ? { first: posts.reduce((m, p) => (p.date < m ? p.date : m), posts[0].date), last: posts.reduce((m, p) => (p.date > m ? p.date : m), posts[0].date) } : null,
  };
  meta.label = corpusLabel(meta);
  return { meta, posts };
}

/** The only honest way to describe the corpus. Never "most viewed", never "top on Threads". */
export function corpusLabel({ kept, searches, window_days: days = 30, niche }) {
  const topic = niche ? ` on ${niche}` : '';
  return `the ${kept} most-liked recent Threads posts from ${searches} keyword searches${topic} (last ${days} days)`;
}

export function validateKeywords(list) {
  const keywords = [...new Set((Array.isArray(list) ? list : list?.keywords ?? []).map((k) => String(k).trim()).filter(Boolean))];
  const problems = [];
  if (keywords.length < MIN_SEARCHES || keywords.length > MAX_SEARCHES) problems.push(`use ${MIN_SEARCHES}-${MAX_SEARCHES} distinct keyword variants (got ${keywords.length})`);
  return { keywords, problems };
}

// ---------------------------------------------------------------------------
// ScrapeCreators access. curl sends the owner-only header file saved by
// scrapecreators-key.mjs (-H @file); this script never opens that file and
// never sees or prints its contents.
// ---------------------------------------------------------------------------
const stateRoot = () => process.env.THREADIFY_WORKFLOWS_HOME || path.join(os.homedir(), '.threadify-workflows');
const headerPath = () => path.join(stateRoot(), 'secrets', 'scrapecreators.header');

function scGet(pathname, params = {}) {
  if (!fs.existsSync(headerPath())) throw new Error('scrapecreators_not_set_up: run scrapecreators-key.mjs status and follow the setup message');
  const url = new URL(pathname, SC_BASE);
  for (const [name, value] of Object.entries(params)) if (value !== undefined && value !== null) url.searchParams.set(name, value);
  const reply = spawnSync('curl', ['-s', '--max-time', '120', '-w', '\n%{http_code}', '-H', `@${headerPath()}`, url.href], { encoding: 'utf8' });
  if (reply.status !== 0) throw new Error(`scrapecreators_unreachable: curl exit ${reply.status}`);
  const lines = reply.stdout.trimEnd().split('\n');
  const code = Number(lines.pop());
  let body = {};
  try { body = JSON.parse(lines.join('\n') || '{}'); } catch { body = { message: lines.join('\n').slice(0, 200) }; }
  if (code === 401 || code === 403) throw new Error('scrapecreators_rejected: ScrapeCreators did not accept the saved header');
  if (code !== 200) throw new Error(`scrapecreators_http_${code}: ${body.message ?? 'unexpected reply'}`);
  return body;
}

export function balance() {
  const body = scGet('/v1/account/credit-balance');
  const credits = Number.isFinite(body.creditCount) ? body.creditCount : Number.isFinite(body.credits_remaining) ? body.credits_remaining : null;
  return { status: credits === null ? 'unknown' : 'ok', credits_remaining: credits };
}

const slug = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'query';

async function pullCorpus({ keywords, dir, days, top, maxCredits, niche, today }) {
  const raw = path.join(dir, 'raw');
  fs.mkdirSync(raw, { recursive: true });
  const before = balance();
  if (keywords.length > maxCredits) throw new Error(`over_budget: ${keywords.length} searches > --max-credits ${maxCredits}`);
  const start = isoDay(windowStart(today, days));
  const pages = [];
  let charged = 0;
  const failures = [];
  for (const query of keywords) {
    const file = path.join(raw, `search-${slug(query)}.json`);
    let body;
    if (fs.existsSync(file)) {
      body = JSON.parse(fs.readFileSync(file, 'utf8'));
    } else {
      if (charged + 1 > maxCredits) { failures.push({ query, error: 'skipped: credit cap reached' }); continue; }
      try {
        body = scGet('/v1/threads/search', { query, start_date: start });
        charged += Number(body.credits_charged ?? 1) || 1;
        fs.writeFileSync(file, JSON.stringify({ query, start_date: start, ...body }, null, 1));
      } catch (error) {
        failures.push({ query, error: error.message });
        if (/rejected|not_set_up|http_402/.test(error.message)) break;
        continue;
      }
    }
    pages.push({ query, body });
    process.stderr.write(`searched "${query}": ${body?.posts?.length ?? 0} posts\n`);
  }
  let after;
  try { after = balance(); } catch { after = { status: 'unknown', credits_remaining: null }; }
  const corpus = normalizeCorpus(pages, { today, days, top, niche });
  corpus.meta.pulled_at = new Date().toISOString();
  corpus.meta.credits = { before: before.credits_remaining, after: after.credits_remaining, charged_reported: charged };
  corpus.meta.failures = failures;
  fs.writeFileSync(path.join(dir, 'corpus.json'), JSON.stringify(corpus, null, 1));
  return corpus;
}

function loadRawPages(dir) {
  const raw = path.join(dir, 'raw');
  return fs.readdirSync(raw).filter((f) => f.startsWith('search-') && f.endsWith('.json')).sort().map((f) => {
    const body = JSON.parse(fs.readFileSync(path.join(raw, f), 'utf8'));
    return { query: body.query ?? f.slice(7, -5).replace(/_/g, ' '), body };
  });
}

// ---------------------------------------------------------------------------
// The race: same brief for both sides, Read-only tools, no Bash for anyone.
// ---------------------------------------------------------------------------
export function postsMarkdown(posts) {
  return posts.map((p) => `## Post ${p.n} (likes ${p.likes})\n${p.text}\n`).join('\n');
}

export function makeBatches(posts, count) {
  const size = Math.ceil(posts.length / count);
  const batches = [];
  for (let i = 0; i < count; i += 1) {
    const slice = posts.slice(i * size, (i + 1) * size);
    if (slice.length) batches.push(slice);
  }
  return batches;
}

/** The research brief. Byte-identical for the army and Opus. */
export function buildBrief({ label, total }) {
  return `# Research brief (identical for every researcher)

Corpus: ${label}. ${total} posts in total, numbered 1-${total}.

Goal: find which patterns matter most in what these posts do, so a creator can write a research post about them.

From the catalog below, pick exactly ${PICKS} different test ids you believe matter most. For each one:
- count exactly how many of the ${total} posts pass the test (a script recounts every number with exactly these definitions, so counts must be exact, not estimates);
- give 2 example posts that pass it: the post number and an exact quote of up to 12 words copied from that post;
- say in one line why it matters.

Research by reading only. You have no code tools; do not try to run code.

## Catalog (the checker's definitions)

${catalogMarkdown()}

## Output

Reply with only this JSON, nothing before or after it:
{"claims":[{"test":"<catalog id>","count":<integer>,"denominator":${total},"why":"<one line>","examples":[{"n":<post number>,"quote":"<exact words>"},{"n":<post number>,"quote":"<exact words>"}]}]}
`;
}

export function opusPrompt() {
  return 'Read race/brief.md and follow it exactly. You are one researcher working alone: read every post in race/posts.md yourself. Reply with only the JSON the brief asks for.';
}

export function commanderPrompt(batchFiles, scoutName = 'research-army-scout') {
  const n = batchFiles.length;
  const list = batchFiles.map((file, i) => `${String(i + 1).padStart(2, '0')}: ${file}`).join('\n');
  return `Read race/brief.md. You are the commander of a research army of ${n} scouts (subagent type "${scoutName}"). The posts are split into ${n} batch files. Do not read the batch files yourself; your scouts read them.

Batch files:
${list}

Round 1 (nominate): in ONE message, start all ${n} scouts in parallel with the Agent tool, one per batch file, description "round 1 scout NN". Tell each scout: "Read race/brief.md, then read only <batch file>. From the brief's catalog, nominate the ${PICKS} test ids that matter most in your batch. Reply with only JSON: {\\"batch\\":\\"<file>\\",\\"nominations\\":[\\"<id>\\", ...]}".

Pick the ${PICKS} test ids your scouts nominated most often (use your judgement only to break ties).

Round 2 (count): in ONE message, start all ${n} scouts again in parallel, description "round 2 scout NN", one per batch file. Give each scout the same ${PICKS} ids and tell it: "Read race/brief.md, then read only <batch file>. For each of these ${PICKS} test ids, count exactly how many posts in your batch pass it, using the brief's catalog definitions, and give up to 2 examples (post number and an exact quote of up to 12 words). Reply with only JSON: {\\"batch\\":\\"<file>\\",\\"posts\\":<posts in batch>,\\"counts\\":{\\"<id>\\":<integer>},\\"examples\\":{\\"<id>\\":[{\\"n\\":<int>,\\"quote\\":\\"...\\"}]}}".

Every batch counts: if a scout's reply is missing a count, start that scout again for its batch. Add up the ${n} counts for each id (a batch that found none counts 0). The denominator is the total number of posts. Pick 2 examples per id from your scouts' replies.

Reply with only the JSON the brief asks for, with the summed counts.`;
}

/** Read the shipped agent file (frontmatter + prompt) into a --agents definition. */
export function loadAgentFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`agent file has no frontmatter: ${file}`);
  const meta = Object.fromEntries(match[1].split('\n').filter((l) => l.includes(':')).map((l) => {
    const at = l.indexOf(':');
    return [l.slice(0, at).trim(), l.slice(at + 1).trim()];
  }));
  return {
    name: meta.name,
    definition: {
      description: meta.description,
      prompt: match[2].trim(),
      model: meta.model,
      tools: (meta.tools ?? '').split(',').map((t) => t.trim()).filter(Boolean),
    },
  };
}

let restrictedSupport;
let claudeCommand = 'claude';
function supportsRestricted(claudeBin) {
  if (restrictedSupport === undefined) {
    const help = spawnSync(claudeBin, ['--help'], { encoding: 'utf8' });
    restrictedSupport = /--restricted\b/.test(`${help.stdout}${help.stderr}`);
  }
  return restrictedSupport;
}

/** The locked command line for one side. Read-only tools; Bash is not offered and is also denied. */
export function claudeArgs({ side, prompt, agents, restricted = true }) {
  const tools = side === 'army' ? 'Read,Agent' : 'Read';
  const args = ['-p', prompt,
    '--model', side === 'army' ? 'haiku' : 'opus',
    '--tools', tools,
    '--disallowedTools', 'Bash,PowerShell,Write,Edit,NotebookEdit,WebFetch,WebSearch',
    '--permission-mode', 'dontAsk',
    '--strict-mcp-config',
    '--disable-slash-commands',
    '--no-session-persistence',
    '--output-format', 'stream-json', '--verbose'];
  if (restricted) args.splice(2, 0, '--restricted');
  if (agents) args.push('--agents', JSON.stringify(agents));
  return args;
}

const stripAnsi = (text) => String(text).replace(/\x1b\[[?0-9;]*[a-zA-Z]/g, '');

export function parseStream(text) {
  return stripAnsi(text).split('\n').map((line) => line.trim()).filter(Boolean).flatMap((line) => {
    try {
      const value = JSON.parse(line);
      return Array.isArray(value) ? value : [value];
    } catch { return []; }
  });
}

const contentOf = (event) => (Array.isArray(event?.message?.content) ? event.message.content : []);

/**
 * Proof that nobody ran code: Bash (or any code tool) must be absent from the
 * offered tools and absent from every tool call, including subagents' calls.
 */
export const CODE_TOOLS = ['Bash', 'PowerShell', 'REPL', 'NotebookEdit', 'Write', 'Edit', 'WebFetch', 'WebSearch'];
export function codeToolAudit(events) {
  const init = events.find((e) => e.type === 'system' && e.subtype === 'init') ?? {};
  const offered = init.tools ?? null;
  const uses = {};
  for (const event of events) {
    for (const block of contentOf(event)) {
      if (block?.type === 'tool_use') uses[block.name] = (uses[block.name] ?? 0) + 1;
    }
  }
  const result = events.filter((e) => e.type === 'result').at(-1) ?? {};
  const offeredCode = (offered ?? []).filter((t) => CODE_TOOLS.includes(t));
  const usedCode = Object.keys(uses).filter((t) => CODE_TOOLS.includes(t));
  return {
    ok: offered !== null && offeredCode.length === 0 && usedCode.length === 0,
    tools_offered: offered,
    permission_mode: init.permissionMode ?? null,
    tool_uses: uses,
    bash_offered: (offered ?? []).includes('Bash'),
    bash_uses: uses.Bash ?? 0,
    code_tools_offered: offeredCode,
    code_tools_used: usedCode,
    permission_denials: (result.permission_denials ?? []).length,
  };
}

export function runSummary(events) {
  const result = events.filter((e) => e.type === 'result').at(-1);
  if (!result) return { ok: false, error: 'no result event' };
  return {
    ok: !result.is_error,
    cost_usd: result.total_cost_usd ?? null,
    duration_ms: result.duration_ms ?? null,
    num_turns: result.num_turns ?? null,
    models: Object.keys(result.modelUsage ?? {}),
    model_cost_usd: Object.fromEntries(Object.entries(result.modelUsage ?? {}).map(([m, u]) => [m, u.costUSD ?? null])),
    subagents: result.subagent_stats ? { spawned: result.subagent_stats.spawned, completed: result.subagent_stats.completed, failed: result.subagent_stats.failed } : null,
    result_text: result.result ?? '',
  };
}

/** The last JSON object in a reply that has the wanted field. */
export function extractJson(text, field = 'claims') {
  const source = String(text ?? '');
  const candidates = [];
  for (let i = source.indexOf('{'); i !== -1; i = source.indexOf('{', i + 1)) {
    let depth = 0;
    let inString = false;
    for (let j = i; j < source.length; j += 1) {
      const ch = source[j];
      if (inString) {
        if (ch === '\\') j += 1;
        else if (ch === '"') inString = false;
      } else if (ch === '"') inString = true;
      else if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          try {
            const value = JSON.parse(source.slice(i, j + 1));
            if (value && typeof value === 'object' && field in value) candidates.push(value);
          } catch { /* not JSON */ }
          break;
        }
      }
    }
  }
  return candidates.at(-1) ?? null;
}

/** Scouts' raw replies, from the Agent tool results in the army's stream. */
export function scoutReplies(events) {
  const starts = new Map();
  for (const event of events) {
    if (event.parent_tool_use_id) continue;
    for (const block of contentOf(event)) {
      if (block?.type === 'tool_use' && block.name === 'Agent') starts.set(block.id, block.input?.description ?? '');
    }
  }
  const replies = [];
  for (const event of events) {
    if (event.type === 'system' && event.subtype === 'task_notification' && starts.has(event.tool_use_id)) {
      const text = String(event.summary ?? '');
      replies.push({ description: starts.get(event.tool_use_id), json: extractJson(text, 'counts') ?? extractJson(text, 'nominations') });
      continue;
    }
    if (event.parent_tool_use_id) continue;
    for (const block of contentOf(event)) {
      if (block?.type !== 'tool_result' || !starts.has(block.tool_use_id)) continue;
      const text = Array.isArray(block.content) ? block.content.map((c) => c.text ?? '').join('\n') : String(block.content ?? '');
      const json = extractJson(text, 'counts') ?? extractJson(text, 'nominations');
      if (json) replies.push({ description: starts.get(block.tool_use_id), json });
    }
  }
  return replies;
}

// ---------------------------------------------------------------------------
// The checker.
// ---------------------------------------------------------------------------
const squash = (text) => String(text ?? '').toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();

export function checkFindings(corpus, findings) {
  const posts = corpus.posts ?? corpus;
  const byN = new Map(posts.map((p) => [p.n, p]));
  const total = posts.length;
  const claims = Array.isArray(findings?.claims) ? findings.claims : [];
  const used = new Set();
  const rows = [];
  for (const claim of claims) {
    if (rows.length >= PICKS) break;
    const id = String(claim?.test ?? '');
    const row = { test: id, claimed: claim?.count ?? null, claimed_denominator: claim?.denominator ?? null, why: claim?.why ?? '' };
    if (used.has(id)) continue;
    used.add(id);
    const entry = CATALOG_BY_ID.get(id);
    if (!entry) {
      rows.push({ ...row, phrase: id, recount: null, backed: false, backed_within_1: false, examples_verified: 0, reason: 'not in the catalog' });
      continue;
    }
    const matched = posts.filter((p) => entry.test(p.text)).map((p) => p.n);
    const recount = matched.length;
    const countOk = Number.isInteger(claim.count);
    const denominatorOk = claim.denominator === undefined || claim.denominator === null || claim.denominator === total;
    const examples = (Array.isArray(claim.examples) ? claim.examples : []).slice(0, 2).map((ex) => {
      const post = byN.get(Number(ex?.n));
      const passes = Boolean(post && entry.test(post.text));
      const quoted = Boolean(post && ex?.quote && squash(post.text).includes(squash(ex.quote)));
      return { n: ex?.n ?? null, quote: ex?.quote ?? '', passes_test: passes, quote_found: quoted };
    });
    const diff = countOk ? Math.abs(claim.count - recount) : null;
    rows.push({
      ...row, phrase: entry.phrase, recount, matched_posts: matched,
      backed: countOk && denominatorOk && diff === 0,
      backed_within_1: countOk && denominatorOk && diff <= 1,
      examples, examples_verified: examples.filter((ex) => ex.passes_test && ex.quote_found).length,
      reason: !countOk ? 'no integer count' : !denominatorOk ? `denominator ${claim.denominator} is not ${total}` : diff === 0 ? '' : `claimed ${claim.count}, recount ${recount}`,
    });
  }
  return {
    total_posts: total,
    picks_expected: PICKS,
    claims: rows.length,
    backed: rows.filter((r) => r.backed).length,
    backed_within_1: rows.filter((r) => r.backed_within_1).length,
    examples_verified: rows.reduce((sum, r) => sum + r.examples_verified, 0),
    rows,
  };
}

/** Winner: most backed claims (exact), then lower cost, then faster. */
export function decideWinner(army, opus) {
  const sides = [{ side: 'army', ...army }, { side: 'opus', ...opus }];
  const valid = (s) => s.ok !== false;
  if (!valid(sides[0]) && !valid(sides[1])) return { winner: null, reason: 'both sides failed' };
  if (!valid(sides[0])) return { winner: 'opus', reason: 'the army did not finish' };
  if (!valid(sides[1])) return { winner: 'army', reason: 'Opus did not finish' };
  const [a, o] = sides;
  if (a.backed !== o.backed) return { winner: a.backed > o.backed ? 'army' : 'opus', reason: `more backed claims (${Math.max(a.backed, o.backed)} vs ${Math.min(a.backed, o.backed)})` };
  if (a.cost_usd !== o.cost_usd && a.cost_usd != null && o.cost_usd != null) return { winner: a.cost_usd < o.cost_usd ? 'army' : 'opus', reason: `same backed claims (${a.backed}); lower cost` };
  if (a.duration_ms !== o.duration_ms && a.duration_ms != null && o.duration_ms != null) return { winner: a.duration_ms < o.duration_ms ? 'army' : 'opus', reason: `same backed claims and cost; faster` };
  return { winner: 'tie', reason: 'same backed claims, cost and time' };
}

/**
 * Per-scout ticks from the army's stream. Scouts may run in the foreground
 * (done = the Agent tool result) or in the background (done = the
 * task_notification for that tool call); both are handled.
 */
export function scoutTracker(size) {
  const calls = new Map();
  const background = new Set();
  const finished = new Set();
  const rounds = { 1: { started: 0, done: 0 }, 2: { started: 0, done: 0 } };
  const snapshot = (note, state) => ({ rounds: structuredClone(rounds), note, state });
  return (event) => {
    if (event.type === 'system' && event.subtype === 'task_started' && event.tool_use_id && event.is_backgrounded) background.add(event.tool_use_id);
    const finish = (id) => {
      if (!calls.has(id) || finished.has(id)) return null;
      finished.add(id);
      const round = calls.get(id);
      rounds[round].done += 1;
      const state = rounds[round].done >= size ? (round === 1 ? 'commander picking 8 patterns' : 'commander adding up the counts') : (round === 1 ? 'round 1: scouts nominating patterns' : 'round 2: scouts counting the 8 picks');
      return snapshot(`round ${round} scout done (${rounds[round].done}/${size})`, state);
    };
    if (event.type === 'system' && event.subtype === 'task_notification' && event.tool_use_id) return finish(event.tool_use_id);
    if (event.parent_tool_use_id) return null;
    let change = null;
    for (const block of contentOf(event)) {
      if (block?.type === 'tool_use' && block.name === 'Agent') {
        const desc = String(block.input?.description ?? '');
        const round = /round\s*2/i.test(desc) ? 2 : /round\s*1/i.test(desc) ? 1 : (rounds[1].started < size ? 1 : 2);
        calls.set(block.id, round);
        rounds[round].started += 1;
        change = snapshot(`round ${round} scout ${rounds[round].started} started`, round === 1 ? 'round 1: scouts nominating patterns' : 'round 2: scouts counting the 8 picks');
      }
      if (block?.type === 'tool_result' && calls.has(block.tool_use_id) && !background.has(block.tool_use_id)) change = finish(block.tool_use_id) ?? change;
    }
    return change;
  };
}

// ---------------------------------------------------------------------------
// Live view.
// ---------------------------------------------------------------------------
const clock = (ms) => {
  const s = Math.max(0, Math.round((ms ?? 0) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export function renderLanes(status, now = Date.now()) {
  const lines = [];
  lines.push(`RESEARCH ARMY · ${status.label}`);
  lines.push(`same brief for both sides · sha256 ${String(status.brief_sha256).slice(0, 12)} · Read-only tools, no Bash`);
  const army = status.army;
  const armyTime = clock((army.ended_at ?? now) - status.started_at);
  const ticks = (round) => {
    const done = army.rounds[round]?.done ?? 0;
    const started = army.rounds[round]?.started ?? 0;
    return Array.from({ length: army.size }, (_, i) => (i < done ? '█' : i < started ? '▒' : '·')).join('');
  };
  lines.push(`ARMY ${army.size} Haiku 5.5 scouts + Haiku commander  ${armyTime}  ${army.state}`);
  lines.push(`  round 1 ${ticks(1)} ${army.rounds[1]?.done ?? 0}/${army.size}`);
  lines.push(`  round 2 ${ticks(2)} ${army.rounds[2]?.done ?? 0}/${army.size}`);
  const opus = status.opus;
  lines.push(`OPUS 1 Opus 5.5, alone  ${clock((opus.ended_at ?? now) - status.started_at)}  ${opus.state}${opus.reads ? ` · ${opus.reads} reads` : ''}`);
  return lines;
}

export function scoreboardLines(board) {
  const row = (name, s) => `${name.padEnd(5)} backed ${s.backed}/${PICKS} (±1: ${s.backed_within_1}/${PICKS}) · $${(s.cost_usd ?? 0).toFixed(3)} · ${((s.duration_ms ?? 0) / 1000).toFixed(1)}s · ${s.models.join(', ') || 'unknown'} · Bash ${s.audit.bash_offered ? 'OFFERED' : 'blocked'} (${s.audit.bash_uses} uses)`;
  return [
    'SCOREBOARD',
    row('ARMY', board.army),
    row('OPUS', board.opus),
    `WINNER: ${board.winner.winner ? board.winner.winner.toUpperCase() : 'none'} · ${board.winner.reason}`,
  ];
}

// ---------------------------------------------------------------------------
// HTML scoreboard (local only).
// ---------------------------------------------------------------------------
const esc = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function renderScoreboardHtml(board) {
  const card = (lane, name, sub) => {
    const s = board[lane];
    const won = board.winner.winner === lane;
    return `<section class="card${won ? ' won' : ''}"><h2>${esc(name)}${won ? ' <span class="badge">winner</span>' : ''}</h2><p class="sub">${esc(sub)}</p>
<div class="big">${s.backed}<small>/${PICKS} backed</small></div>
<dl><dt>within ±1</dt><dd>${s.backed_within_1}/${PICKS}</dd><dt>cost</dt><dd>$${(s.cost_usd ?? 0).toFixed(3)}</dd><dt>wall time</dt><dd>${((s.duration_ms ?? 0) / 1000).toFixed(1)} s</dd><dt>models</dt><dd>${esc(s.models.join(', ') || 'unknown')}</dd><dt>Bash</dt><dd>${s.audit.bash_offered ? 'offered' : 'not offered'} · ${s.audit.bash_uses} uses</dd></dl></section>`;
  };
  const table = (lane, name) => `<h3>${esc(name)}: every claim</h3><table><thead><tr><th>pattern</th><th>claim</th><th>recount</th><th>verdict</th></tr></thead><tbody>${board[lane].check.rows.map((r) => `<tr class="${r.backed ? 'ok' : 'no'}"><td>${esc(r.phrase)}<br><code>${esc(r.test)}</code></td><td>${esc(r.claimed)}</td><td>${esc(r.recount ?? '-')}</td><td>${r.backed ? 'backed' : r.backed_within_1 ? 'off by 1' : 'unbacked'}</td></tr>`).join('')}</tbody></table>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Research Army scoreboard</title><style>
:root{--bg:#0d0d0d;--panel:#1a1a1a;--line:#333;--text:#fff;--muted:rgba(255,255,255,.7);--accent:#ff6b4a;--ok:#4ecdc4;--no:#ff6b4a}
:root[data-theme="light"]{--bg:#fafafa;--panel:#fff;--line:#ddd;--text:#111;--muted:#555}
*{box-sizing:border-box}html,body{max-width:100%;overflow-x:hidden}body{margin:0;background:var(--bg);color:var(--text);font:17px/1.45 system-ui,-apple-system,sans-serif;overflow-wrap:anywhere}
main{max-width:900px;margin:auto;padding:24px 16px 48px}h1{font-size:28px;margin:0 0 4px}.label{color:var(--muted);margin:0 0 18px}
.winner{background:var(--panel);border:2px solid var(--accent);border-radius:12px;padding:14px 16px;font-size:22px;font-weight:700;margin-bottom:16px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:620px){.grid{grid-template-columns:1fr}}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px}.card.won{border-color:var(--ok)}
.card h2{margin:0;font-size:22px}.sub{color:var(--muted);margin:2px 0 8px;font-size:15px}.badge{background:var(--ok);color:#000;border-radius:999px;padding:2px 10px;font-size:13px;vertical-align:middle}
.big{font-size:56px;font-weight:800;line-height:1}.big small{font-size:18px;font-weight:600;color:var(--muted)}
dl{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin:12px 0 0;font-size:15px}dt{color:var(--muted)}dd{margin:0}
h3{margin:26px 0 8px}table{width:100%;border-collapse:collapse;font-size:15px;table-layout:fixed}th:nth-child(2),th:nth-child(3),td:nth-child(2),td:nth-child(3){width:4.2em}th:nth-child(4),td:nth-child(4){width:5.6em}td,th{padding:8px 6px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
tr.ok td:last-child{color:var(--ok);font-weight:700}tr.no td:last-child{color:var(--no);font-weight:700}code{color:var(--muted);font-size:12px}
.foot{color:var(--muted);font-size:14px;margin-top:22px}
</style></head><body><main>
<h1>Research Army scoreboard</h1><p class="label">${esc(board.label)}</p>
<div class="winner">Winner: ${esc(board.winner.winner ? board.winner.winner.toUpperCase() : 'none')} <span style="font-weight:500;color:var(--muted)">· ${esc(board.winner.reason)}</span></div>
<div class="grid">${card('army', 'Army', `${board.army_size} Haiku 5.5 scouts + a Haiku commander`)}${card('opus', 'Opus', '1 Opus 5.5, alone')}</div>
${table('army', 'Army')}${table('opus', 'Opus')}
<p class="foot">A claim is backed when the checker's recount over all ${board.total_posts} posts equals the claimed count. Same brief for both sides (sha256 ${esc(String(board.brief_sha256).slice(0, 12))}); both had Read only, no Bash. Winner rule: most backed claims, then lower cost, then faster. ${esc(board.run_at)}</p>
</main></body></html>
`;
}

// ---------------------------------------------------------------------------
// Post facts: only the winner's backed findings, numbers from the recount.
// ---------------------------------------------------------------------------
const labelNumbers = (board) => {
  const searches = board.searches ?? Number((String(board.label).match(/from (\d+) keyword searches/) || [])[1]) ?? null;
  const days = board.window_days ?? Number((String(board.label).match(/last (\d+) days/) || [])[1]) ?? 30;
  return { total: board.total_posts, searches: Number.isFinite(searches) ? searches : null, days: Number.isFinite(days) ? days : 30 };
};

/** How the post may name its source. Threadify copy dropped "from K keyword searches" twice in rehearsal. */
export function sourceWordingRule({ total, searches }) {
  return `Name the source exactly as "the ${total} most-liked posts from ${searches} keyword searches" (or "${total} most-liked posts I pulled from ${searches} searches"). Never write "top posts", "top on Threads", "most viewed", or "the most-liked Threads posts" without the keyword searches.`;
}

export function postFacts(board) {
  const side = board.winner.winner === 'opus' ? 'opus' : 'army';
  const rows = board[side].check.rows.filter((r) => r.backed);
  const nums = labelNumbers(board);
  return {
    from: side,
    label: board.label,
    total_posts: nums.total,
    searches: nums.searches,
    window_days: nums.days,
    facts: rows.map((r) => `${r.recount} of ${board.total_posts} ${r.phrase}`),
    numbers: [...new Set(rows.map((r) => r.recount))],
    input_text: [`Research post. Source: ${board.label}.`, 'Checked findings (every number was recounted by a script; use only these numbers):',
      ...rows.map((r) => `- ${r.recount} of ${board.total_posts} posts ${r.phrase}.`),
      `Wording rule: ${sourceWordingRule(nums)}`].join('\n'),
  };
}

// Phrases that misdescribe a keyword-search sample.
export const BANNED_SOURCE_PHRASES = [
  { re: /\btop\s+(?:\d+\s+|[a-z]+\s+){0,3}posts?\b/i, why: '"top posts" (it is a keyword-search sample, not a ranking)' },
  { re: /\b\d+\s+top\b/i, why: '"N top ..." (not a ranking)' },
  { re: /\btop\s+(?:posts?\s+)?on\s+threads\b/i, why: '"top on Threads"' },
  { re: /\bmost[\s-]+viewed\b/i, why: '"most viewed" (there are no view counts)' },
  { re: /\bviral(?:est)?\s+(?:\d+\s+)?(?:threads\s+)?posts\b/i, why: '"viral posts" (likes only)' },
];
const SPELLED = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };

/**
 * Deterministic copy check for the generated post: banned source wording,
 * "most-liked" without the keyword searches, and any number that is not a
 * checker fact. N (posts), K (searches) and the window length are allowed.
 * "one" counts only as "one in/of/out of" (otherwise it is usually a pronoun).
 */
export function checkPostText(text, facts) {
  const body = String(text ?? '').replace(/https?:\/\/\S+|www\.\S+/gi, ' ');
  const problems = [];
  for (const { re, why } of BANNED_SOURCE_PHRASES) if (re.test(body)) problems.push(`banned source wording: ${why}`);
  if (/most[\s-]+liked/i.test(body) && !/\bsearch(?:es)?\b/i.test(body)) problems.push('says "most-liked" without naming the keyword searches');
  const allowed = new Set([...(facts.numbers ?? []), facts.total_posts, facts.searches, facts.window_days].filter((n) => n !== null && n !== undefined).map(Number));
  const found = [];
  for (const m of body.matchAll(/(?<![\d.,])\d[\d,]*(?:\.\d+)?/g)) found.push({ value: Number(m[0].replace(/,/g, '')), as: m[0] });
  for (const m of body.matchAll(/\b(two|three|four|five|six|seven|eight|nine)\b/gi)) found.push({ value: SPELLED[m[1].toLowerCase()], as: m[1] });
  for (const m of body.matchAll(/\bone\s+(?:in|of|out\s+of)\b/gi)) found.push({ value: 1, as: m[0] });
  const stray = found.filter((f) => !allowed.has(f.value));
  for (const f of stray) problems.push(`number not in the checked facts: ${f.as}`);
  return { status: problems.length ? 'FAIL' : 'PASS', problems, numbers_found: found.map((f) => f.as), allowed: [...allowed].sort((a, b) => a - b) };
}

/** The Auto Plug must carry the offer's exact link and no banned source wording. */
export function checkPlugText(text, link) {
  const problems = [];
  if (!link) problems.push('no offer link given');
  else if (!String(text ?? '').includes(link)) problems.push('the plug does not contain the offer\'s exact link');
  const body = String(text ?? '').replace(/https?:\/\/\S+|www\.\S+/gi, ' ');
  for (const { re, why } of BANNED_SOURCE_PHRASES) if (re.test(body)) problems.push(`banned source wording: ${why}`);
  return { status: problems.length ? 'FAIL' : 'PASS', problems };
}

// ---------------------------------------------------------------------------
// CLI.
// ---------------------------------------------------------------------------
function argValue(args, name, fallback = undefined) {
  const at = args.indexOf(name);
  return at >= 0 && at + 1 < args.length ? args[at + 1] : fallback;
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

function writeStatus(file, status) {
  fs.writeFileSync(`${file}.next`, JSON.stringify(status));
  fs.renameSync(`${file}.next`, file);
}

function runSide({ side, args, cwd, logFile, onEvent, silenceMs = SILENCE_LIMIT_MS, totalMs }) {
  return new Promise((resolve) => {
    const child = spawn(claudeCommand, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    const out = fs.createWriteStream(logFile);
    let buffer = '';
    let stderr = '';
    let last = Date.now();
    let killed = null;
    const events = [];
    const startedAt = Date.now();
    const watchdog = setInterval(() => {
      if (Date.now() - last > silenceMs) { killed = `silent for over ${Math.round(silenceMs / 60000)} min`; child.kill('SIGTERM'); }
    }, 5000);
    const cap = setTimeout(() => { killed = `over the ${Math.round(totalMs / 60000)} min limit`; child.kill('SIGTERM'); }, totalMs);
    child.stdout.on('data', (chunk) => {
      last = Date.now();
      out.write(chunk);
      buffer += chunk.toString();
      let at;
      while ((at = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, at);
        buffer = buffer.slice(at + 1);
        for (const event of parseStream(line)) { events.push(event); onEvent(event); }
      }
    });
    child.stderr.on('data', (chunk) => { last = Date.now(); stderr += chunk.toString(); });
    child.on('close', (code) => {
      clearInterval(watchdog);
      clearTimeout(cap);
      for (const event of parseStream(buffer)) { events.push(event); onEvent(event); }
      out.end();
      resolve({ side, code, killed, events, stderr: stderr.slice(-2000), wall_ms: Date.now() - startedAt });
    });
  });
}

async function race(args) {
  const dir = path.resolve(argValue(args, '--dir', '.'));
  const armySize = Number(argValue(args, '--army', DEFAULT_ARMY));
  const totalMs = Number(argValue(args, '--timeout-min', 12)) * 60_000;
  if (!Number.isInteger(armySize) || armySize < 2 || armySize > 30) throw new Error('--army must be 2-30');
  const corpus = readJson(path.join(dir, 'corpus.json'));
  const raceDir = path.join(dir, 'race');
  fs.mkdirSync(path.join(raceDir, 'batches'), { recursive: true });
  const brief = buildBrief({ label: corpus.meta.label, total: corpus.posts.length });
  fs.writeFileSync(path.join(raceDir, 'brief.md'), brief);
  fs.writeFileSync(path.join(raceDir, 'posts.md'), postsMarkdown(corpus.posts));
  const batches = makeBatches(corpus.posts, armySize);
  const batchFiles = batches.map((batch, i) => {
    const rel = `race/batches/batch-${String(i + 1).padStart(2, '0')}.md`;
    fs.writeFileSync(path.join(dir, rel), postsMarkdown(batch));
    return rel;
  });
  const agentFile = argValue(args, '--agent-file', path.join(HERE, '..', 'references', 'agents', 'research-army-scout.md'));
  const scout = loadAgentFile(agentFile);
  if (scout.definition.model !== 'haiku' || scout.definition.tools.join(',') !== 'Read') throw new Error('scout agent file must say model: haiku and tools: Read');
  const claudeBin = claudeCommand;
  const restricted = supportsRestricted(claudeBin);
  const briefSha = crypto.createHash('sha256').update(brief).digest('hex');
  const status = {
    label: corpus.meta.label, brief_sha256: briefSha, started_at: Date.now(), done: false,
    army: { size: batches.length, state: 'starting', rounds: { 1: { started: 0, done: 0 }, 2: { started: 0, done: 0 } }, ended_at: null },
    opus: { state: 'starting', reads: 0, ended_at: null },
  };
  const statusFile = path.join(raceDir, 'status.json');
  writeStatus(statusFile, status);
  const tty = process.stdout.isTTY;
  let drawn = 0;
  const draw = () => {
    if (!tty) return;
    const lines = renderLanes(status);
    if (drawn) process.stdout.write(`\x1b[${drawn}A`);
    process.stdout.write(lines.map((l) => `\x1b[2K${l}`).join('\n') + '\n');
    drawn = lines.length;
  };
  const note = (text) => {
    writeStatus(statusFile, status);
    if (!tty) process.stdout.write(`${clock(Date.now() - status.started_at)} ${text}\n`);
  };
  const timer = tty ? setInterval(draw, 250) : null;
  const tracker = scoutTracker(status.army.size);
  let armyStarted = false;
  let opusStarted = false;
  const onArmy = (event) => {
    if (event.type === 'system' && event.subtype === 'init' && !armyStarted) { armyStarted = true; status.army.state = 'commander reading the brief'; note('ARMY commander started'); }
    const change = tracker(event);
    if (!change) return;
    status.army.rounds = change.rounds;
    status.army.state = change.state;
    note(`ARMY ${change.note}`);
  };
  const onOpus = (event) => {
    if (event.type === 'system' && event.subtype === 'init' && !opusStarted) { opusStarted = true; status.opus.state = 'reading all posts'; note('OPUS started'); }
    for (const block of contentOf(event)) if (block?.type === 'tool_use' && block.name === 'Read') { status.opus.reads += 1; }
    if (event.type === 'result' && extractJson(event.result, 'claims')) { status.opus.state = 'answered'; note('OPUS answered'); }
  };
  const agents = { [scout.name]: scout.definition };
  const [armyRun, opusRun] = await Promise.all([
    runSide({ side: 'army', args: claudeArgs({ side: 'army', prompt: commanderPrompt(batchFiles, scout.name), agents, restricted }), cwd: dir, logFile: path.join(raceDir, 'army-run.jsonl'), onEvent: onArmy, totalMs }),
    runSide({ side: 'opus', args: claudeArgs({ side: 'opus', prompt: opusPrompt(), restricted }), cwd: dir, logFile: path.join(raceDir, 'opus-run.jsonl'), onEvent: onOpus, totalMs }),
  ]);
  if (timer) { clearInterval(timer); draw(); }
  for (const [run, lane] of [[armyRun, "army"], [opusRun, "opus"]]) {
    status[lane].ended_at = status.started_at + run.wall_ms;
    status[lane].state = run.killed ? `stopped: ${run.killed}` : run.code === 0 ? 'finished' : `exited with code ${run.code}`;
  }
  const sideReport = (run) => {
    const summary = { ...runSummary(run.events), duration_ms: run.wall_ms };
    const findings = extractJson(summary.result_text, 'claims') ?? { claims: [] };
    return { summary, findings, audit: codeToolAudit(run.events), killed: run.killed, exit_code: run.code, stderr: run.stderr };
  };
  const army = sideReport(armyRun);
  const opus = sideReport(opusRun);
  fs.writeFileSync(path.join(dir, 'findings-army.json'), JSON.stringify({ ...army.findings, scouts: scoutReplies(armyRun.events) }, null, 1));
  fs.writeFileSync(path.join(dir, 'findings-opus.json'), JSON.stringify(opus.findings, null, 1));
  const raceRecord = {
    run_at: new Date().toISOString(), army_size: batches.length, brief_sha256: briefSha, restricted_flag: restricted,
    command_lines: { army: claudeArgs({ side: 'army', prompt: '<commander prompt>', agents: { [scout.name]: '<agent file>' }, restricted }), opus: claudeArgs({ side: 'opus', prompt: '<opus prompt>', restricted }) },
    army: { ...army.summary, result_text: undefined, audit: army.audit, killed: army.killed, exit_code: army.exit_code },
    opus: { ...opus.summary, result_text: undefined, audit: opus.audit, killed: opus.killed, exit_code: opus.exit_code },
  };
  fs.writeFileSync(path.join(raceDir, 'race.json'), JSON.stringify(raceRecord, null, 1));
  status.done = true;
  writeStatus(statusFile, status);
  const board = buildBoard(dir);
  if (!tty) process.stdout.write('\n');
  process.stdout.write(`${scoreboardLines(board).join('\n')}\n`);
  return { status: 'raced', scoreboard: path.join(dir, 'scoreboard.html'), check: path.join(dir, 'check.json'), winner: board.winner, army: brief4(board.army), opus: brief4(board.opus), bash_blocked: !board.army.audit.bash_offered && !board.opus.audit.bash_offered && board.army.audit.bash_uses === 0 && board.opus.audit.bash_uses === 0 };
}

const brief4 = (s) => ({ backed: s.backed, backed_within_1: s.backed_within_1, cost_usd: s.cost_usd, seconds: s.duration_ms == null ? null : Math.round(s.duration_ms / 100) / 10, models: s.models });

export function buildBoard(dir) {
  const corpus = readJson(path.join(dir, 'corpus.json'));
  const record = readJson(path.join(dir, 'race', 'race.json'));
  const side = (lane) => {
    const findings = readJson(path.join(dir, `findings-${lane}.json`));
    const check = checkFindings(corpus, findings);
    const run = record[lane];
    return { ok: run.ok !== false && !run.killed && check.claims > 0, backed: check.backed, backed_within_1: check.backed_within_1, cost_usd: run.cost_usd, duration_ms: run.duration_ms, models: run.models ?? [], audit: run.audit, check };
  };
  const army = side('army');
  const opus = side('opus');
  const board = { label: corpus.meta.label, total_posts: corpus.posts.length, searches: corpus.meta.searches ?? null, window_days: corpus.meta.window_days ?? 30, army_size: record.army_size, brief_sha256: record.brief_sha256, run_at: record.run_at, army, opus, winner: decideWinner(army, opus) };
  fs.writeFileSync(path.join(dir, 'check.json'), JSON.stringify({ label: board.label, total_posts: board.total_posts, winner: board.winner, army: army.check, opus: opus.check }, null, 1));
  fs.writeFileSync(path.join(dir, 'scoreboard.html'), renderScoreboardHtml(board));
  return board;
}

async function watch(args) {
  const dir = path.resolve(argValue(args, '--dir', '.'));
  const file = path.join(dir, 'race', 'status.json');
  const once = args.includes('--once');
  let drawn = 0;
  for (;;) {
    const status = fs.existsSync(file) ? readJson(file) : null;
    const lines = status ? renderLanes(status) : ['waiting for the race to start...'];
    if (once) return { status: status?.done ? 'done' : 'running', lanes: lines };
    if (drawn) process.stdout.write(`\x1b[${drawn}A`);
    process.stdout.write(lines.map((l) => `\x1b[2K${l}`).join('\n') + '\n');
    drawn = lines.length;
    if (status?.done) return null;
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function main(argv) {
  const [command, ...args] = argv;
  const dir = path.resolve(argValue(args, '--dir', '.'));
  const days = Number(argValue(args, '--days', 30));
  const top = Number(argValue(args, '--top', 100));
  switch (command) {
    case 'catalog':
      return { tests: CATALOG.map(({ id, phrase, rule }) => ({ id, phrase, rule })), picks: PICKS };
    case 'estimate': {
      const { keywords, problems } = validateKeywords(readJson(argValue(args, '--keywords')));
      return { status: problems.length ? 'fix' : 'ok', searches: keywords.length, credits: keywords.length, problems, note: 'each ScrapeCreators Threads search costs 1 credit; the balance check is free' };
    }
    case 'balance':
      return balance();
    case 'corpus': {
      const { keywords, problems } = validateKeywords(readJson(argValue(args, '--keywords')));
      if (problems.length) return { status: 'fix', problems };
      fs.mkdirSync(dir, { recursive: true });
      const corpus = await pullCorpus({ keywords, dir, days, top, maxCredits: Number(argValue(args, '--max-credits', 40)), niche: argValue(args, '--niche', null), today: argValue(args, '--today') });
      return { status: corpus.posts.length ? 'ok' : 'empty', corpus: path.join(dir, 'corpus.json'), label: corpus.meta.label, kept: corpus.meta.kept, stats: corpus.meta.stats, eligible: corpus.meta.eligible_after_filters, likes: corpus.meta.likes, dates: corpus.meta.dates, credits: corpus.meta.credits, failures: corpus.meta.failures };
    }
    case 'normalize': {
      const corpus = normalizeCorpus(loadRawPages(dir), { today: argValue(args, '--today'), days, top, niche: argValue(args, '--niche', null) });
      fs.writeFileSync(path.join(dir, 'corpus.json'), JSON.stringify(corpus, null, 1));
      return { status: 'ok', label: corpus.meta.label, kept: corpus.meta.kept, stats: corpus.meta.stats };
    }
    case 'race':
      claudeCommand = argValue(args, '--claude', 'claude');
      return race(args);
    case 'watch':
      return watch(args);
    case 'check': {
      const board = buildBoard(dir);
      return { status: 'checked', winner: board.winner, army: brief4(board.army), opus: brief4(board.opus), scoreboard: path.join(dir, 'scoreboard.html') };
    }
    case 'facts':
      return postFacts(buildBoard(dir));
    case 'check-post': {
      const facts = postFacts(buildBoard(dir));
      const post = checkPostText(fs.readFileSync(path.resolve(argValue(args, '--file')), 'utf8').trim(), facts);
      const plugFile = argValue(args, '--plug');
      const plug = plugFile ? checkPlugText(fs.readFileSync(path.resolve(plugFile), 'utf8').trim(), argValue(args, '--link')) : null;
      const ok = post.status === 'PASS' && (!plug || plug.status === 'PASS');
      return { status: ok ? 'PASS' : 'FAIL', post, plug };
    }
    default:
      return { status: 'usage', usage: 'research-army.mjs catalog|estimate|balance|corpus|normalize|race|watch|check|facts|check-post (see the header of this file)' };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    const result = await main(process.argv.slice(2));
    if (result) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result && ['usage', 'fix', 'FAIL'].includes(result.status) ? 1 : 0;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: 'failed', error: error.message }, null, 2)}\n`);
    process.exitCode = 1;
  }
}
