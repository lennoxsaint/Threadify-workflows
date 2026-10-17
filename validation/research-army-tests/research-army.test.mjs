import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  AI_TOOLS,
  CATALOG,
  PICKS,
  buildBrief,
  checkFindings,
  COMPACT_POST_CHARS,
  checkPlugText,
  checkPostText,
  claudeArgs,
  cleanLink,
  codeToolAudit,
  commanderPrompt,
  corpusLabel,
  decideWinner,
  extractJson,
  isEnglish,
  loadAgentFile,
  makeBatches,
  normalizeCorpus,
  opusPrompt,
  parseStream,
  postFacts,
  runTest,
  scoutReplies,
  scoutTracker,
  sourceWordingRule,
  validateKeywords,
} from '../../plugins/threadify/skills/threadify-research-army/scripts/research-army.mjs';
import { checkPost, lowercaseExceptProperNouns } from '../../plugins/threadify/skills/threadify-research-army/scripts/casing-guard.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const skillDir = path.join(root, 'plugins/threadify/skills/threadify-research-army');

// A ScrapeCreators /v1/threads/search reply with the fields the normalizer reads.
const scPost = (pk, text, likes, day, username = 'someone') => ({
  pk, code: `C${pk}`, caption: { text }, like_count: likes,
  taken_at: Math.floor(Date.parse(`${day}T12:00:00Z`) / 1000),
  text_post_app_info: { direct_reply_count: 1, repost_count: 2, quote_count: 0 },
  user: { username },
});

test('corpus normalizer: dedupes, keeps the 30-day window, drops non-English, ranks by likes and labels honestly', () => {
  const pages = [
    { query: 'ai tools', body: { posts: [
      scPost('1', 'I built this with Claude and it is the best thing for your business', 900, '2026-10-10'),
      scPost('2', 'old post that is from way before the window and it is long', 5000, '2026-08-01'),
      scPost('3', 'Ito ay isang halimbawa ng post na hindi Ingles talaga', 700, '2026-10-12'),
      scPost('4', 'you need to try this one thing for the next week', 40, '2026-10-01'),
    ] } },
    { query: 'chatgpt prompts', body: { posts: [
      scPost('1', 'I built this with Claude and it is the best thing for your business', 900, '2026-10-10'),
      scPost('5', '   ', 10, '2026-10-11'),
      scPost('6', 'this is my favourite prompt for the week and it works', 300, '2026-09-20'),
    ] } },
  ];
  const { meta, posts } = normalizeCorpus(pages, { today: '2026-10-17', days: 30, top: 2, niche: 'AI tools' });
  assert.equal(meta.window_start, '2026-09-17');
  assert.deepEqual(meta.stats, { raw: 7, duplicates: 1, empty: 1, out_of_window: 1, non_english: 1 });
  assert.equal(meta.eligible_after_filters, 3);
  assert.deepEqual(posts.map((p) => [p.n, p.id, p.likes]), [[1, '1', 900], [2, '6', 300]]);
  assert.deepEqual(posts[0].queries, ['ai tools', 'chatgpt prompts']);
  assert.equal(posts[0].url, 'https://www.threads.com/@someone/post/C1');
  assert.equal(meta.label, 'the 2 most-liked recent Threads posts from 2 keyword searches on AI tools (last 30 days)');
  assert.doesNotMatch(meta.label, /view|top on threads/i);
  assert.match(meta.metric, /no view counts/);
});

test('english filter and keyword list bounds', () => {
  assert.equal(isEnglish('this is the one thing you need'), true);
  assert.equal(isEnglish('これは英語ではありません'), false);
  assert.equal(isEnglish('Grabe ang ganda nito talaga'), false);
  assert.match(corpusLabel({ kept: 100, searches: 28, window_days: 30 }), /^the 100 most-liked recent Threads posts from 28 keyword searches \(last 30 days\)$/);
  assert.equal(validateKeywords({ keywords: Array.from({ length: 25 }, (_, i) => `k${i}`) }).problems.length, 0);
  assert.equal(validateKeywords({ keywords: ['a', 'a', 'b'] }).problems.length, 1);
  assert.equal(validateKeywords(Array.from({ length: 31 }, (_, i) => `k${i}`)).problems.length, 1);
});

test('checker catalog: every test is machine-checkable and behaves as defined', () => {
  assert.ok(CATALOG.length >= 15);
  assert.equal(new Set(CATALOG.map((t) => t.id)).size, CATALOG.length);
  for (const entry of CATALOG) assert.ok(entry.rule && entry.phrase, entry.id);
  const cases = [
    ['opens_with_number', '7 tools I use daily', true], ['opens_with_number', '$500 a month from this', true], ['opens_with_number', 'I made 500', false],
    ['has_question', 'would you try it?', true], ['ends_with_question', 'what do you think?  ', true], ['ends_with_question', 'why? because.', false],
    ['length_short', 'x'.repeat(99), true], ['length_medium', 'x'.repeat(100), true], ['length_medium', 'x'.repeat(280), true], ['length_long', 'x'.repeat(281), true],
    ['first_person_i', "I'm done", true], ['first_person_i', 'i think so', true], ['first_person_i', 'in it', false],
    ['opens_with_i', "I've been there", true], ['opens_with_i', 'it is', false],
    ['says_you', 'Your turn', true], ['says_you', 'yourself', false],
    ['has_list', '- one\n- two', true], ['has_list', '1. one\n2) two', true], ['has_list', '- only one', false],
    ['has_line_breaks', 'a\nb', true], ['has_line_breaks', 'one line\n', false],
    ['mentions_ai_tool', 'Ask ChatGPT this', true], ['mentions_ai_tool', 'claude code is wild', true], ['mentions_ai_tool', 'a gptx thing', false],
    ['has_link', 'go to threadify.app/home', true], ['has_link', 'https://x.co', true], ['has_link', 'no link here.', false],
    ['has_money', 'made $1,400 last week', true], ['has_money', '£20', true], ['has_money', '1400 dollars', false],
    ['has_number', 'top 5', true], ['has_emoji', 'fire 🔥', true], ['has_emoji', 'plain', false],
    ['all_lowercase', 'just lowercase here', true], ['all_lowercase', 'Not lowercase', false], ['all_lowercase', '123', false],
    ['has_exclamation', 'wow!', true], ['has_hashtag', 'see #ai', true], ['has_hashtag', 'number #1', false],
  ];
  for (const [id, text, expected] of cases) assert.equal(runTest(id, text), expected, `${id}: ${JSON.stringify(text)}`);
  assert.throws(() => runTest('regex', 'x'), /unknown test/);
  assert.ok(AI_TOOLS.includes('claude') && AI_TOOLS.includes('chatgpt'));
});

const corpus = { posts: [
  { n: 1, text: '5 AI tools I use every day:\n- Claude\n- ChatGPT', likes: 900 },
  { n: 2, text: 'what would you build with $100?', likes: 500 },
  { n: 3, text: 'I quit my job. Here is why.', likes: 300 },
  { n: 4, text: 'stop scrolling and go build', likes: 100 },
] };

test('checker: recounts every claim, exact and within 1, checks example quotes, rejects off-catalog tests', () => {
  const report = checkFindings(corpus, { claims: [
    { test: 'first_person_i', count: 2, denominator: 4, examples: [{ n: 1, quote: 'AI tools I use every day' }, { n: 3, quote: 'I quit my job.' }] },
    { test: 'has_question', count: 2, denominator: 4, examples: [{ n: 2, quote: 'what would you build' }, { n: 4, quote: 'not in the post' }] },
    { test: 'all_lowercase', count: 4, denominator: 4 },
    { test: 'regex', count: 1, denominator: 4 },
    { test: 'first_person_i', count: 2, denominator: 4 },
    { test: 'has_money', count: 1, denominator: 99 },
  ] });
  const byTest = Object.fromEntries(report.rows.map((r) => [r.test, r]));
  assert.equal(report.claims, 5, 'a repeated test counts once');
  assert.equal(byTest.first_person_i.backed, true);
  assert.equal(byTest.first_person_i.examples_verified, 2);
  assert.equal(byTest.has_question.recount, 1);
  assert.equal(byTest.has_question.backed, false);
  assert.equal(byTest.has_question.backed_within_1, true);
  assert.equal(byTest.has_question.examples_verified, 1);
  assert.equal(byTest.all_lowercase.recount, 2);
  assert.equal(byTest.all_lowercase.backed_within_1, false);
  assert.equal(byTest.regex.backed, false);
  assert.match(byTest.regex.reason, /not in the catalog/);
  assert.equal(byTest.has_money.backed, false);
  assert.match(byTest.has_money.reason, /denominator/);
  assert.equal(report.backed, 1);
  assert.equal(report.backed_within_1, 2);
  const many = checkFindings(corpus, { claims: CATALOG.slice(0, 12).map((t) => ({ test: t.id, count: 0 })) });
  assert.equal(many.claims, PICKS, 'only the first 8 claims are scored');
});

test('winner rule: most backed claims, then lower cost, then faster; a failed side loses', () => {
  const side = (backed, cost, ms, ok = true) => ({ backed, cost_usd: cost, duration_ms: ms, ok });
  assert.equal(decideWinner(side(6, 0.1, 90000), side(7, 1.2, 180000)).winner, 'opus');
  assert.equal(decideWinner(side(8, 0.1, 90000), side(7, 1.2, 180000)).winner, 'army');
  const tieCost = decideWinner(side(7, 0.1, 90000), side(7, 1.2, 60000));
  assert.equal(tieCost.winner, 'army');
  assert.match(tieCost.reason, /lower cost/);
  assert.equal(decideWinner(side(7, 0.5, 90000), side(7, 0.5, 60000)).winner, 'opus');
  assert.equal(decideWinner(side(7, 0.5, 60000), side(7, 0.5, 60000)).winner, 'tie');
  assert.equal(decideWinner(side(0, 0.1, 1, false), side(3, 1, 1)).winner, 'opus');
  assert.equal(decideWinner(side(0, 0.1, 1, false), side(0, 1, 1, false)).winner, null);
});

test('casing guard: only casing may change, proven by lower(original) == lower(final)', () => {
  const original = 'I read the 100 most-liked Threads posts about AI. 61 open with a number.';
  const lowered = lowercaseExceptProperNouns(original, ['Threads', 'AI']);
  assert.equal(lowered, 'i read the 100 most-liked Threads posts about AI. 61 open with a number.');
  assert.equal(lowered.toLowerCase(), original.toLowerCase());
  assert.equal(checkPost({ original, final: lowered }).status, 'PASS');
  assert.equal(checkPost({ original, final: lowered.replace('61', '62') }).status, 'FAIL');
  assert.equal(checkPost({ original, final: `${lowered} so true` }).status, 'FAIL');
});

// A recorded-shape stream: what `claude -p --output-format stream-json --verbose` prints.
const lockedStream = (tools, toolUses) => [
  { type: 'system', subtype: 'init', tools, permissionMode: 'dontAsk' },
  { type: 'assistant', message: { content: toolUses.map((name, i) => ({ type: 'tool_use', id: `t${i}`, name, input: {} })) } },
  { type: 'result', subtype: 'success', total_cost_usd: 0.01, duration_ms: 1000, permission_denials: [], modelUsage: { 'claude-haiku-5-5': { costUSD: 0.01 } } },
];

test('Bash blocked: the audit passes only when no code tool is offered or used, subagents included', () => {
  const clean = codeToolAudit(lockedStream(['Task', 'Read'], ['Agent', 'Read']));
  assert.equal(clean.ok, true);
  assert.equal(clean.bash_offered, false);
  assert.equal(clean.bash_uses, 0);
  const offered = codeToolAudit(lockedStream(['Bash', 'Read'], ['Read']));
  assert.equal(offered.ok, false);
  assert.equal(offered.bash_offered, true);
  const subagentBash = lockedStream(['Task', 'Read'], ['Agent']);
  subagentBash.splice(2, 0, { type: 'assistant', parent_tool_use_id: 't0', message: { content: [{ type: 'tool_use', id: 's1', name: 'Bash', input: { command: 'grep -c' } }] } });
  const used = codeToolAudit(subagentBash);
  assert.equal(used.ok, false);
  assert.equal(used.bash_uses, 1);
  assert.equal(codeToolAudit([]).ok, false, 'no init event is not proof');
});

test('locked command lines: Read-only tools, Bash denied, no MCP, same brief for both sides', () => {
  for (const side of ['army', 'opus']) {
    const args = claudeArgs({ side, prompt: 'x', restricted: true });
    const value = (flag) => args[args.indexOf(flag) + 1];
    assert.ok(args.includes('--restricted'));
    assert.match(value('--disallowedTools'), /(^|,)Bash(,|$)/);
    assert.equal(value('--permission-mode'), 'dontAsk');
    assert.ok(args.includes('--strict-mcp-config'));
    assert.equal(value('--output-format'), 'stream-json');
    assert.doesNotMatch(value('--tools'), /Bash|Write|Edit/);
  }
  assert.equal(claudeArgs({ side: 'army', prompt: 'x' })[claudeArgs({ side: 'army', prompt: 'x' }).indexOf('--tools') + 1], 'Read,Agent');
  assert.equal(claudeArgs({ side: 'opus', prompt: 'x' })[claudeArgs({ side: 'opus', prompt: 'x' }).indexOf('--model') + 1], 'opus');
  assert.ok(!claudeArgs({ side: 'opus', prompt: 'x', restricted: false }).includes('--restricted'));
  const brief = buildBrief({ label: 'the 4 most-liked recent Threads posts from 2 keyword searches (last 30 days)', total: 4 });
  for (const entry of CATALOG) assert.ok(brief.includes(`\`${entry.id}\``), entry.id);
  assert.match(brief, /exactly 8/);
  assert.match(brief, /no code tools/);
  assert.match(opusPrompt(), /race\/brief\.md/);
  const commander = commanderPrompt(['race/batches/batch-01.md', 'race/batches/batch-02.md']);
  assert.match(commander, /race\/brief\.md/);
  assert.match(commander, /Round 1/);
  assert.match(commander, /Round 2/);
  assert.match(commander, /Every batch counts/);
  const scout = loadAgentFile(path.join(skillDir, 'references/agents/research-army-scout.md'));
  assert.equal(scout.name, 'research-army-scout');
  assert.equal(scout.definition.model, 'haiku');
  assert.deepEqual(scout.definition.tools, ['Read']);
});

test('race plumbing: batches cover every post, stream parsing, scout ticks for background agents, JSON extraction, facts', () => {
  const posts = Array.from({ length: 100 }, (_, i) => ({ n: i + 1, text: `post ${i + 1}`, likes: 100 - i }));
  const batches = makeBatches(posts, 20);
  assert.equal(batches.length, 20);
  assert.deepEqual(batches.flat().map((p) => p.n), posts.map((p) => p.n));
  const events = parseStream(`${JSON.stringify({ type: 'system', subtype: 'init', tools: ['Read'] })}\n\u001b[?25h${JSON.stringify({ type: 'result' })}\n`);
  assert.equal(events.length, 2);
  const tick = scoutTracker(2);
  const stream = [
    { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'a', name: 'Agent', input: { description: 'round 1 scout 01' } }] } },
    { type: 'system', subtype: 'task_started', tool_use_id: 'a', is_backgrounded: true },
    { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'a', content: 'started in background' }] } },
    { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'b', name: 'Agent', input: { description: 'round 1 scout 02' } }] } },
    { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'b', content: '{"batch":"b2","nominations":["has_question"]}' }] } },
    { type: 'system', subtype: 'task_notification', tool_use_id: 'a', status: 'completed', summary: '{"batch":"b1","nominations":["has_emoji"]}' },
  ];
  const notes = stream.map(tick).filter(Boolean).map((c) => c.note);
  assert.deepEqual(notes, ['round 1 scout 1 started', 'round 1 scout 2 started', 'round 1 scout done (1/2)', 'round 1 scout done (2/2)']);
  assert.equal(scoutReplies(stream).length, 2);
  assert.deepEqual(extractJson('Done. {"claims":[{"test":"has_question","count":1}]}\n```yaml\na: {b}\n```'), { claims: [{ test: 'has_question', count: 1 }] });
  assert.equal(extractJson('no json here'), null);
  const board = {
    label: 'the 4 most-liked recent Threads posts from 2 keyword searches (last 30 days)', total_posts: 4,
    winner: { winner: 'opus' },
    opus: { check: checkFindings(corpus, { claims: [{ test: 'first_person_i', count: 2 }, { test: 'has_question', count: 3 }] }) },
    army: { check: { rows: [] } },
  };
  const facts = postFacts(board);
  assert.equal(facts.from, 'opus');
  assert.deepEqual(facts.facts, ['2 of 4 use first person "I"']);
  assert.match(facts.input_text, /use only these numbers/);
  assert.doesNotMatch(facts.input_text, /ask a question/, 'unbacked claims never reach the post');
});

test('Research Army ships its agent file, editor and copied setup scripts', () => {
  for (const file of ['scripts/research-army.mjs', 'scripts/casing-guard.mjs', 'scripts/scrapecreators-key.mjs', 'scripts/post-editor.mjs', 'references/post.md', 'references/generation-models.json', 'references/agents/research-army-scout.md']) {
    assert.ok(fs.existsSync(path.join(skillDir, file)), file);
  }
});

const factsFor = { numbers: [66, 23, 4, 5, 3], total_posts: 100, searches: 28, window_days: 30 };

test('facts carry the honest wording rule with N and K', () => {
  const board = {
    label: 'the 4 most-liked recent Threads posts from 2 keyword searches (last 30 days)', total_posts: 4, searches: 2, window_days: 30,
    winner: { winner: 'army' }, army: { check: checkFindings(corpus, { claims: [{ test: 'first_person_i', count: 2 }] }) }, opus: { check: { rows: [] } },
  };
  const facts = postFacts(board);
  assert.equal(facts.searches, 2);
  assert.deepEqual(facts.numbers, [2]);
  assert.match(facts.input_text, /Wording rule: Name the source exactly as "the 4 most-liked posts from 2 keyword searches"/);
  assert.match(facts.input_text, /Never write "top posts", "top on Threads", "most viewed"/);
  assert.match(sourceWordingRule({ total: 100, searches: 28 }), /100 most-liked posts I pulled from 28 searches/);
});

test('check-post: fails dishonest source wording and numbers outside the facts; passes honest copy', () => {
  const honest = 'only 3 of the 100 most-liked posts from 28 keyword searches open with a number.\n\n66 use line breaks. 23 ask a question. only four end on one.\n\nlast 30 days. break your lines.';
  assert.equal(checkPostText(honest, factsFor).status, 'PASS');
  const rehearsal = 'i pulled the 100 most-liked Threads posts on growth and AI agents from the last 30 days.\n66 use line breaks.';
  assert.match(checkPostText(rehearsal, factsFor).problems.join(), /without naming the keyword searches/);
  for (const bad of ['100 top posts in my niche', 'the top 100 posts on threads', 'what the top posts do', 'top on Threads right now', 'the most viewed posts', 'the most-viewed posts']) {
    assert.equal(checkPostText(`${bad} from 28 searches`, factsFor).status, 'FAIL', bad);
  }
  const strayDigit = checkPostText('66 of the 100 most-liked posts from 28 searches use line breaks; 12 use emoji.', factsFor);
  assert.deepEqual(strayDigit.problems, ['number not in the checked facts: 12']);
  assert.equal(checkPostText('seven of the 100 most-liked posts from 28 searches', factsFor).status, 'FAIL');
  assert.equal(checkPostText('one in 100 most-liked posts from 28 searches', factsFor).status, 'FAIL');
  assert.equal(checkPostText('the one thing: 66 of the 100 most-liked posts from 28 searches', factsFor).status, 'PASS', '"one" as a pronoun is not a number');
  assert.equal(checkPostText('66 of 100. see https://x.co/a?n=12345', factsFor).status, 'PASS', 'numbers inside links are ignored');
});

test('plug check: the Auto Plug carries the offer link without tracking tags (Threadify tracks links)', () => {
  const link = 'https://www.threadify.app/home?utm_source=threads&video_slug=research-army';
  assert.equal(checkPlugText('want the post written for your niche? 7-day free trial, $0 today: https://www.threadify.app/home', link).status, 'PASS');
  assert.match(checkPlugText(`want it for your niche? ${link}`, link).problems.join(), /tracking tags/);
  assert.equal(checkPlugText('try it: https://example.com/other', link).status, 'FAIL');
  assert.equal(checkPlugText('the top posts say so: https://www.threadify.app/home', link).status, 'FAIL');
  assert.equal(checkPlugText(`no link given ${link}`, '').status, 'FAIL');
});

test('clean-link: removes utm and attribution tags, keeps other query parameters', () => {
  assert.equal(cleanLink('https://www.threadify.app/home?utm_source=threads&utm_medium=social&cta_slot=post&entry_angle=haiku_army'), 'https://www.threadify.app/home');
  assert.equal(cleanLink('https://shop.example.com/offer?ref=abc&utm_campaign=x&fbclid=1'), 'https://shop.example.com/offer?ref=abc');
  assert.equal(cleanLink('https://www.threadify.app/home'), 'https://www.threadify.app/home');
  assert.equal(cleanLink('not a url'), 'not a url');
});

test('check-post: a long post passes with a compact warning', () => {
  const long = `66 of the 100 most-liked posts from 28 keyword searches use line breaks. ${'keep it short. '.repeat(20)}`;
  const result = checkPostText(long, factsFor);
  assert.equal(result.status, 'PASS');
  assert.equal(result.warnings.length, 1);
  assert.ok(result.characters > COMPACT_POST_CHARS);
  assert.deepEqual(checkPostText('66 of the 100 most-liked posts from 28 searches use line breaks. go tell yours.', factsFor).warnings, []);
});

test('post step: viral templates ship with the skill and the post step uses them', () => {

  const templates = fs.readFileSync(path.join(skillDir, 'references/viral-templates.md'), 'utf8');
  assert.equal((templates.match(/^\d+\. \*\*/gm) ?? []).length, 10, 'ten templates');
  assert.doesNotMatch(templates, /@\w/, 'no handles');
  const post = fs.readFileSync(path.join(skillDir, 'references/post.md'), 'utf8');
  assert.match(post, /viral-templates\.md/);
  assert.match(post, /encouraging so-what/);
  assert.match(post, /clean-link/);
});
