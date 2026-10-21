import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  DISCLOSURE,
  MAX_POINTS,
  NO_CONNECTOR,
  RULES_PATH,
  anonymiseRun,
  anonymiseText,
  blindTerms,
  buildScorecard,
  findLeaks,
  judgePrompt,
  leaderAfter,
  loadAnon,
  lockRules,
  lowercaseGuard,
  main,
  parseGrades,
  parseRules,
  recordReply,
  renderReport,
  renderScorecardHtml,
  renderScorecardMd,
  seededShuffle,
  verdictLine,
  verifyKey,
} from '../../plugins/threadify/skills/threadify-scheduler-showdown/scripts/scheduler-showdown.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const script = path.join(root, 'plugins/threadify/skills/threadify-scheduler-showdown/scripts/scheduler-showdown.mjs');
const rulesMd = fs.readFileSync(RULES_PATH, 'utf8');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'showdown-'));
const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const NOW = '2026-10-21T09:00:00.000Z';

// The five prompts, copied from the THREADIFY-052 spec. rules.md must hold them word for word.
const PROMPTS = {
  T1: 'Find my best post from the last 30 days and tell me why it worked.',
  T2: "Write tomorrow's post from that, in my voice.",
  T3: 'Schedule it at my best time.',
  T4: 'Add a tracked link to my offer.',
  T5: "How many clicks did last week's links get?",
};

// A run with Buffer, Eden and Threadify replies that name themselves, their handles and their links.
function fixtureRun({ seed = 52 } = {}) {
  const dir = tmp();
  assert.equal(lockRules({ markdown: rulesMd, out: dir, now: NOW }).status, 'ok');
  const replies = {
    Buffer: 'Buffer found your best post: "my morning routine" (1,204 views). See https://buffer.com/app/post/123 or ask @buffer. Buffer_id: 9. Contact help@buffer.com.',
    Eden: { tool: 'Eden', text: 'Eden analytics: top post at eden.so/p/42 by @lennox.saint, 880 likes. Powered by Eden.' },
    Threadify: 'Threadify: your best post got 12,400 views on threads (www.threadify.app/go/abc). It worked because the hook named a number. Threadify Brain says your voice is direct.',
  };
  for (const [tool, reply] of Object.entries(replies)) {
    for (const id of ['T1', 'T2', 'T3', 'T4', 'T5']) {
      if (tool === 'Eden' && id === 'T4') {
        assert.equal(recordReply({ dir, tool, test: id, status: 'no-capability', reason: 'Eden MCP tools: list_posts, get_analytics (no link tracking tool)', now: NOW }).status, 'ok');
        continue;
      }
      assert.equal(recordReply({ dir, tool, test: id, reply, sent: PROMPTS[id], now: NOW }).status, 'ok');
    }
  }
  return { dir, run: anonymiseRun({ dir, seed, now: NOW }) };
}

function gradeAll(dir, pick = () => 'pass') {
  const cells = loadAnon(dir);
  const reply = { grades: {} };
  for (const c of cells) {
    reply.grades[c.tool] ??= {};
    reply.grades[c.tool][c.test] = { grade: pick(c), evidence: `named a post in ${c.test}` };
  }
  return { cells, reply: `Here you go:\n${JSON.stringify(reply)}` };
}

test('rules: the five prompts are in rules.md word for word and the hash is stable', () => {
  for (const prompt of Object.values(PROMPTS)) assert.ok(rulesMd.includes(`"${prompt}"`), `rules.md holds "${prompt}"`);
  const tests = parseRules(rulesMd);
  assert.deepEqual(tests.map((t) => t.id), ['T1', 'T2', 'T3', 'T4', 'T5']);
  for (const t of tests) assert.equal(t.prompt, PROMPTS[t.id]);
  assert.match(tests[0].pass, /real metric from the tool's own data/);
  assert.match(tests[1].fail, /Claude would have to write it/);
  assert.ok(rulesMd.includes(DISCLOSURE));
  assert.match(rulesMd, /60 days out/);

  const a = tmp();
  const b = tmp();
  const first = lockRules({ markdown: rulesMd, out: a, now: NOW });
  const second = lockRules({ markdown: rulesMd, out: b, now: '2026-11-01T00:00:00.000Z' });
  assert.equal(first.sha256, sha(rulesMd));
  assert.equal(first.sha256, second.sha256, 'same rules, same hash, whatever the time');
  assert.match(first.line, new RegExp(`sha256 ${first.sha256}`));
  const saved = JSON.parse(fs.readFileSync(path.join(a, 'rules.json'), 'utf8'));
  assert.equal(saved.sha256, first.sha256);
  assert.equal(saved.locked_at, NOW);
  assert.equal(saved.rules_md, rulesMd);
  // Re-locking the same rules keeps the first lock; different rules are refused.
  assert.equal(lockRules({ markdown: rulesMd, out: a, now: '2026-12-01T00:00:00.000Z' }).locked_at, NOW);
  assert.equal(lockRules({ markdown: `${rulesMd}\nchanged`, out: a, now: NOW }).status, 'FAIL');
});

test('record: rules first, prompts word for word, attempts appended with timestamps', () => {
  const dir = tmp();
  assert.equal(recordReply({ dir, tool: 'Buffer', test: 'T1', reply: 'x' }).status, 'FAIL', 'no rules locked yet');
  lockRules({ markdown: rulesMd, out: dir, now: NOW });
  const reworded = recordReply({ dir, tool: 'Buffer', test: 'T1', reply: 'x', sent: 'What was my best post this month?' });
  assert.equal(reworded.status, 'FAIL');
  assert.match(reworded.problems[0], /word for word/);
  assert.equal(recordReply({ dir, tool: 'Buffer', test: 'T1', status: 'error', reply: 'timeout', now: NOW }).status, 'ok');
  const ok = recordReply({ dir, tool: 'Buffer', test: 'T1', reply: { posts: [] }, sent: PROMPTS.T1, now: '2026-10-21T09:01:00.000Z' });
  assert.equal(ok.saved[0].attempt, 2);
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'raw/buffer/T1.json'), 'utf8'));
  assert.equal(saved.prompt, PROMPTS.T1);
  assert.deepEqual(saved.entries.map((e) => [e.at, e.status]), [[NOW, 'error'], ['2026-10-21T09:01:00.000Z', 'replied']]);
  assert.equal(recordReply({ dir, tool: 'Buffer', test: 'T2', status: 'no-capability' }).status, 'FAIL', 'a missing capability needs its quoted reason');
  const none = recordReply({ dir, tool: 'Typefully', test: 'all', status: 'no-connector', now: NOW });
  assert.equal(none.saved.length, 5);
  assert.match(none.line, /no AI connection connected/);
  assert.match(none.line, /https:\/\/mcp\.typefully\.com\/mcp/);
});

test('anonymise: no tool name, handle or link survives (Buffer, Eden and Threadify fixture)', () => {
  const { dir, run } = fixtureRun();
  assert.equal(run.status, 'ok');
  assert.deepEqual(run.tools, ['Tool A', 'Tool B', 'Tool C']);
  const cells = loadAnon(dir);
  assert.equal(cells.length, 15);
  const text = cells.map((c) => `${c.reply ?? ''}\n${c.reason ?? ''}`).join('\n');
  for (const word of ['Buffer', 'buffer', 'Eden', 'eden', 'Threadify', 'threadify', '@lennox', 'https://', 'www.', '.com', '.so', '.app', 'help@']) {
    assert.ok(!text.includes(word), `anonymised replies must not contain ${word}`);
  }
  assert.match(text, /\[tool\]/);
  assert.match(text, /\[link\]/);
  assert.match(text, /\[handle\]/);
  assert.match(text, /12,400 views/, 'the evidence itself stays');
  assert.deepEqual(findLeaks(text, blindTerms(['Buffer', 'Eden', 'Threadify'])), []);
  assert.equal(anonymiseText('Try Black Twist or BlackTwist at blacktwist.app', blindTerms([])), 'Try [tool] or [tool] at [link]');
  // The no-capability reason is anonymised too, and nothing can be recorded after sealing.
  assert.ok(cells.some((c) => c.status === 'no-capability' && /no link tracking tool/.test(c.reason)));
  assert.equal(recordReply({ dir, tool: 'Buffer', test: 'T1', reply: 'late' }).status, 'FAIL');
  assert.equal(anonymiseRun({ dir, seed: 1 }).status, 'FAIL', 'the key never changes after sealing');
});

test('anonymise: the seeded shuffle is repeatable and the key sha256 is printed', () => {
  assert.deepEqual(seededShuffle(['Eden', 'Buffer', 'Threadify'], 52), seededShuffle(['Threadify', 'Eden', 'Buffer'], 52));
  const one = fixtureRun({ seed: 7 });
  const two = fixtureRun({ seed: 7 });
  const keyOne = JSON.parse(fs.readFileSync(path.join(one.dir, 'key.json'), 'utf8'));
  const keyTwo = JSON.parse(fs.readFileSync(path.join(two.dir, 'key.json'), 'utf8'));
  assert.deepEqual(keyOne.letters, keyTwo.letters);
  assert.equal(one.run.key_sha256, sha(fs.readFileSync(path.join(one.dir, 'key.json'), 'utf8')));
  assert.match(one.run.line, new RegExp(`Key sha256 ${one.run.key_sha256}`));
  assert.ok(!JSON.stringify(loadAnon(one.dir)).includes(keyOne.letters['Tool A']), 'anon files never name the tool');
});

test('judge: the prompt holds the rules and the blind replies only; grades parse with evidence', () => {
  const { dir } = fixtureRun();
  const rules = JSON.parse(fs.readFileSync(path.join(dir, 'rules.json'), 'utf8'));
  const cells = loadAnon(dir);
  const prompt = judgePrompt({ rules, cells });
  for (const word of ['Buffer', 'Eden', 'Threadify', 'buffer.com']) assert.ok(!prompt.includes(word), `judge prompt must not contain ${word}`);
  for (const p of Object.values(PROMPTS)) assert.ok(prompt.includes(p));
  assert.ok(prompt.includes(rules.sha256));
  assert.match(prompt, /Do not open files/);
  const capability = cells.find((c) => c.status === 'no-capability');
  assert.ok(!prompt.includes(`### ${capability.tool} · T4`), 'rule-scored cells are not sent to the judge');

  const { reply } = gradeAll(dir);
  const parsed = parseGrades(reply, cells);
  assert.equal(parsed.status, 'ok');
  assert.equal(parsed.grades[capability.tool].T4.grade, 'fail');
  assert.equal(parsed.grades[capability.tool].T4.by, 'rules');
  assert.match(parsed.grades[capability.tool].T4.evidence, /no capability/);
  const missing = parseGrades('{"grades": {"Tool A": {"T1": {"grade": "great"}}}}', cells);
  assert.equal(missing.status, 'FAIL');
  assert.ok(missing.problems.some((p) => /Tool A T1/.test(p)));
  assert.equal(parseGrades('no json here', cells).status, 'FAIL');
});

test('unblind: refuses when the key changed or the printed hash differs; verifies otherwise', async () => {
  const { dir, run } = fixtureRun();
  const { reply } = gradeAll(dir);
  fs.writeFileSync(path.join(dir, 'judge-reply.txt'), reply);
  const graded = await main(['judge-prompt', '--dir', dir, '--reply', path.join(dir, 'judge-reply.txt'), '--judge', 'codex', '--model', 'gpt-test', '--now', NOW]);
  assert.equal(graded.status, 'ok');
  assert.match(graded.line, /After T2 the leader is/);
  assert.equal(verifyKey(dir, run.key_sha256).ok, true);
  assert.equal((await main(['unblind', '--dir', dir, '--expect', '0'.repeat(64)])).status, 'FAIL');
  const keyFile = path.join(dir, 'key.json');
  const original = fs.readFileSync(keyFile, 'utf8');
  fs.writeFileSync(keyFile, original.replace('"Tool A"', '"Tool A" ').replace('Buffer', 'Threadify'));
  const refused = await main(['unblind', '--dir', dir, '--expect', run.key_sha256]);
  assert.equal(refused.status, 'FAIL');
  assert.match(refused.problems[0], /Refusing to unblind/);
  fs.writeFileSync(keyFile, original);
  const ok = await main(['unblind', '--dir', dir, '--expect', run.key_sha256, '--now', NOW]);
  assert.equal(ok.status, 'ok');
  assert.equal(ok.verified, true);
  const named = fs.readFileSync(path.join(dir, 'scorecard.md'), 'utf8');
  for (const name of ['Buffer', 'Eden', 'Threadify']) assert.ok(named.includes(name));
});

test('scorecard: price, free plan and networks rows are always there, with or without pricing', async () => {
  const grades = { 'Tool A': { T1: { grade: 'pass' }, T2: { grade: 'pass' }, T3: { grade: 'partial' }, T4: { grade: 'fail' }, T5: { grade: 'pass' } },
    'Tool B': { T1: { grade: 'fail', no_connector: true, evidence: NO_CONNECTOR }, T2: { grade: 'fail', no_connector: true }, T3: { grade: 'fail', no_connector: true }, T4: { grade: 'fail', no_connector: true }, T5: { grade: 'fail', no_connector: true } } };
  for (const toolsFile of [null, { tools: [{ name: 'Buffer', pricing: { url: 'https://buffer.com/pricing', read_at: '2026-10-21', price: '$6 per channel per month', free_plan: 'yes, 3 channels', networks: '11' } }] }]) {
    const card = buildScorecard({ grades, letters: { 'Tool A': 'Threadify', 'Tool B': 'Buffer' }, toolsFile, terms: blindTerms(['Threadify', 'Buffer']) });
    const md = renderScorecardMd(card);
    const html = renderScorecardHtml(card);
    for (const row of ['Price', 'Free plan', 'Networks']) {
      assert.ok(card.rows.some((r) => r.label === row && r.loss_row), `${row} row`);
      assert.match(md, new RegExp(`\\| ${row} \\|`));
      assert.ok(html.includes(`<th>${row}</th>`));
    }
    assert.ok(!md.includes('Buffer') && !md.includes('buffer.com'), 'the blind scorecard names no tool');
    assert.match(md, /no AI connection connected/);
    assert.match(md, /7 of 10/);
  }
  const named = buildScorecard({ grades, letters: { 'Tool A': 'Threadify', 'Tool B': 'Buffer' }, toolsFile: { tools: [{ name: 'Buffer', pricing: { url: 'https://buffer.com/pricing', read_at: '2026-10-21', price: '$6', free_plan: 'yes', networks: '11' } }] }, named: true });
  const md = renderScorecardMd(named);
  assert.match(md, /\| Price \| UNKNOWN \(pricing page not read\) \| \$6 \|/);
  assert.match(md, /https:\/\/buffer\.com\/pricing \(read 2026-10-21\)/);
  assert.equal(named.verdict, `Winner: Threadify, 7 of ${MAX_POINTS} points. Next: Buffer, 0 of ${MAX_POINTS}.`);
});

test('verdict is honest about ties and the leader is named by letter after each test', () => {
  assert.equal(verdictLine({ Threadify: 8, Buffer: 8, Eden: 3 }), 'Tie: Threadify and Buffer, 8 of 10 points each. No single winner.');
  assert.equal(verdictLine({ Threadify: 9, Buffer: 8 }), 'Winner: Threadify, 9 of 10 points. Next: Buffer, 8 of 10.');
  const leaders = leaderAfter({ 'Tool A': { T1: { grade: 'pass' }, T2: { grade: 'fail' } }, 'Tool B': { T1: { grade: 'partial' }, T2: { grade: 'pass' } } });
  assert.deepEqual(leaders.T1, { leaders: ['Tool A'], points: 2 });
  assert.deepEqual(leaders.T2, { leaders: ['Tool B'], points: 3 });
});

test('lowercase guard: passes a case-only change, fails any word change', () => {
  const original = 'I tested 6 schedulers with Claude. Only Threadify knew my numbers.';
  const pass = lowercaseGuard(original, 'i tested 6 schedulers with Claude. only Threadify knew my numbers.');
  assert.equal(pass.status, 'PASS');
  assert.equal(pass.line, 'guard: lower(original) == lower(final) PASS');
  const fail = lowercaseGuard(original, 'i tested 6 schedulers with Claude. only Threadify knew my stats.');
  assert.equal(fail.status, 'FAIL');
  assert.deepEqual(fail.word_changes, [{ at: 10, original: 'numbers', final: 'stats' }]);
  assert.equal(lowercaseGuard(original, `${original} wow`).status, 'FAIL', 'an added word fails');
  assert.equal(lowercaseGuard(original, original.replace('.', '!')).status, 'FAIL', 'punctuation changes fail too');
});

test('report: renders the disclosure and the rules hash, blind before unblinding and named after', async () => {
  const { dir, run } = fixtureRun();
  const { reply } = gradeAll(dir, (c) => (c.test === 'T5' ? 'partial' : 'pass'));
  fs.writeFileSync(path.join(dir, 'judge-reply.txt'), reply);
  await main(['judge-prompt', '--dir', dir, '--reply', path.join(dir, 'judge-reply.txt'), '--judge', 'codex', '--model', 'gpt-test']);
  const rules = JSON.parse(fs.readFileSync(path.join(dir, 'rules.json'), 'utf8'));
  const blind = await main(['report', '--dir', dir, '--now', NOW]);
  assert.equal(blind.status, 'ok');
  assert.equal(blind.named, false);
  let html = fs.readFileSync(blind.report, 'utf8');
  assert.ok(html.includes(DISCLOSURE.replace("'", '&#39;')), 'disclosure line');
  assert.ok(html.includes(rules.sha256), 'rules hash');
  assert.ok(html.includes(run.key_sha256), 'key hash');
  assert.ok(!html.includes('>Buffer<') && !html.includes('<b>Eden</b>'), 'still blind');
  assert.match(html, /Run it on your tools/);
  assert.match(html, /Star Threadify Workflows on GitHub/);
  assert.match(html, /gpt-test/);
  assert.match(html, /width=device-width/);
  await main(['unblind', '--dir', dir, '--expect', run.key_sha256]);
  fs.writeFileSync(path.join(dir, 'cleanup.json'), JSON.stringify({ items: [{ tool: 'Buffer', what: 'T3 test post deleted', readback: 'not found' }] }));
  const named = await main(['report', '--dir', dir]);
  assert.equal(named.named, true);
  html = fs.readFileSync(named.report, 'utf8');
  assert.match(html, /<b>Buffer<\/b>/);
  assert.match(html, /T3 test post deleted/);
  assert.match(html, /Key verified against that hash/);
  assert.equal(renderReport({ rules, grades: {} }).includes(rules.sha256), true);
  fs.writeFileSync(path.join(dir, 'cleanup.json'), JSON.stringify({ items: [{ tool: 'Buffer', what: 'mail me at a@b.co', readback: 'x' }] }));
  assert.equal((await main(['report', '--dir', dir])).status, 'FAIL', 'an email never reaches the report');
});

test('CLI end to end: rules, record, anonymise, judge prompt, scorecard, unblind and report', () => {
  const dir = tmp();
  const run = (...args) => {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
    return { code: result.status, json: JSON.parse(result.stdout) };
  };
  const rules = run('rules', '--out', dir);
  assert.equal(rules.code, 0);
  assert.equal(rules.json.sha256, sha(rulesMd));
  const replyFile = path.join(dir, 'reply.json');
  fs.writeFileSync(replyFile, JSON.stringify({ post: 'my best post', views: 1200, by: '@threadify.app' }));
  for (const tool of ['Threadify', 'Buffer']) for (const t of Object.keys(PROMPTS)) assert.equal(run('record', '--dir', dir, '--tool', tool, '--test', t, '--file', replyFile, '--sent', PROMPTS[t]).code, 0);
  assert.equal(run('record', '--dir', dir, '--tool', 'Eden', '--test', 'all', '--status', 'no-connector').code, 0);
  assert.equal(run('record', '--dir', dir, '--tool', 'Buffer', '--test', 'T1', '--text', 'x', '--sent', 'reworded').code, 1);
  assert.equal(run('judge-prompt', '--dir', dir).code, 1, 'no judging before sealing');
  const sealed = run('anonymise', '--dir', dir, '--seed', '52');
  assert.equal(sealed.code, 0);
  const prompt = run('judge-prompt', '--dir', dir);
  assert.equal(prompt.code, 0);
  assert.equal(prompt.json.key_sha256, sealed.json.key_sha256);
  assert.match(prompt.json.run, /codex exec -s read-only/);
  const text = fs.readFileSync(prompt.json.prompt, 'utf8');
  assert.ok(!/Threadify|Buffer|Eden/.test(text));
  const grades = { grades: {} };
  for (const c of loadAnon(dir)) { grades.grades[c.tool] ??= {}; grades.grades[c.tool][c.test] = { grade: 'pass', evidence: 'ok' }; }
  fs.writeFileSync(path.join(dir, 'judge', 'reply.txt'), JSON.stringify(grades));
  assert.equal(run('judge-prompt', '--dir', dir, '--reply', path.join(dir, 'judge', 'reply.txt'), '--judge', 'codex', '--model', 'gpt-x').code, 0);
  const card = run('scorecard', '--dir', dir);
  assert.equal(card.code, 0);
  assert.deepEqual(card.json.rows, ['T1', 'T2', 'T3', 'T4', 'T5', 'Points', 'Price', 'Free plan', 'Networks']);
  const unblind = run('unblind', '--dir', dir, '--expect', sealed.json.key_sha256);
  assert.equal(unblind.code, 0);
  assert.match(unblind.json.line, /^Tie: .+ 10 of 10 points each\. No single winner\.$/);
  const report = run('report', '--dir', dir);
  assert.equal(report.code, 0);
  assert.equal(report.json.named, true);
  const original = path.join(dir, 'original.txt');
  const final = path.join(dir, 'final.txt');
  fs.writeFileSync(original, 'Only Threadify Knew Me.');
  fs.writeFileSync(final, 'only Threadify knew me.');
  assert.equal(run('lowercase-guard', '--original', original, '--final', final).json.status, 'PASS');
  fs.writeFileSync(final, 'only Threadify knew you.');
  assert.equal(run('lowercase-guard', '--original', original, '--final', final).code, 1);
});
