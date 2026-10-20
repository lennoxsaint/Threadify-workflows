import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  NEEDS_BASELINE,
  UNKNOWN,
  buildFunnel,
  checkCopy,
  checkShortSeller,
  cleanJudgeOutput,
  codexModel,
  decodeEntities,
  extractVerdict,
  htmlToText,
  gradeLast,
  judgeCommand,
  judgePrompt,
  keyTerms,
  leakReceipts,
  loadVideos,
  pace,
  parseDeadline,
  parseGoal,
  pickLeak,
  plural,
  rankDecisions,
  reachAt,
  readLedger,
  renderReport,
  saveEntry,
  testCtaReach,
  testPageMismatch,
  validateEntry,
} from '../../plugins/threadify/skills/threadify-go-make-money/scripts/go-make-money.mjs';
import { checkPost, lowercaseExceptProperNouns } from '../../plugins/threadify/skills/threadify-go-make-money/scripts/casing-guard.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const script = path.join(root, 'plugins/threadify/skills/threadify-go-make-money/scripts/go-make-money.mjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gmm-'));

// A read_link_attribution result with the fields the funnel reads.
const link = (id, post, dest, unique, conversions = 0, sales = 0, text = `post ${post}`) => ({
  tracked_url: `https://www.threadify.app/go/${id}`, destination_url: dest, original_url: dest,
  root_threads_post_id: post, final_threads_post_id: `${post}-plug`, root_post_text: text,
  clicks: unique + 1, unique_clicks: unique, conversions, sales, source_kind: 'auto_plug',
});
const attribution = {
  summary: { unique_clicks: 250, conversions: 1, sales: 0 },
  conversion_tracking: { state: 'measuring', measurable: true },
  links: [
    link('a', 'p1', 'https://www.threadify.app/home', 120, 1, 0, 'i tested the viral github repo on my own app'),
    link('b', 'p2', 'https://www.threadify.app/home', 80),
    link('c', 'p3', 'https://www.threadify.app/plans', 46),
    link('d', 'p4', 'https://youtu.be/xyz', 30),
  ],
};
const performance = { posts: [
  { post_id: 'p1', text: 'i tested the viral github repo', metrics: { views: 20000 } },
  { post_id: 'p2', text: 'second', metrics: { views: 9000 } },
  { post_id: 'p3', text: 'third', metrics: { views: 3000 } },
] };

test('goal parse: number, metric and deadline from the default prompt shape', () => {
  assert.deepEqual(parseGoal('go make money: get me to 1,000 paying members by Dec 31', '2026-10-20'),
    { status: 'ok', goal: 1000, metric: 'paying members', deadline: '2026-12-31', problems: [] });
  assert.equal(parseGoal('get me to 2k paying customers by 31 March 2027', '2026-10-20').goal, 2000);
  assert.equal(parseGoal('get me to 2k paying customers by 31 March 2027', '2026-10-20').deadline, '2027-03-31');
  assert.equal(parseGoal('get me to 50 paid subscribers by end of year.', '2026-10-20').deadline, '2026-12-31');
  assert.equal(parseGoal('make me rich', '2026-10-20').status, 'unparsed');
  // A month already past rolls to next year when no year is given.
  assert.equal(parseDeadline('Feb 1', '2026-10-20'), '2027-02-01');
  assert.equal(parseDeadline('2026-12-31', '2026-10-20'), '2026-12-31');
  assert.equal(parseDeadline('Feb 30', '2026-10-20'), null);
});

test('pace math: ceil((goal - current) / weeks_left), unknown baseline stays UNKNOWN', () => {
  const p = pace({ goal: 1000, current: 38, deadline: '2026-12-31', today: '2026-10-20' });
  assert.equal(p.days_left, 72);
  assert.equal(p.weeks_left, 10.29);
  assert.equal(p.remaining, 962);
  assert.equal(p.required_net_new_per_week, Math.ceil(962 / (72 / 7)));
  assert.equal(p.required_net_new_per_week, 94);
  const unknown = pace({ goal: 1000, current: null, deadline: '2026-12-31', today: '2026-10-20' });
  assert.equal(unknown.current, UNKNOWN);
  assert.equal(unknown.required_net_new_per_week, UNKNOWN);
  assert.equal(unknown.label, NEEDS_BASELINE);
  assert.match(unknown.line, /needs real baseline/);
  assert.equal(pace({ goal: 10, current: 12, deadline: '2026-12-31', today: '2026-10-20' }).required_net_new_per_week, 0);
  assert.equal(pace({ goal: 10, current: 2, deadline: '2026-10-01', today: '2026-10-20' }).label, 'deadline passed');
});

test('funnel math from raw rows: counts, per-step rates, destination filter and the biggest drop', () => {
  const funnel = buildFunnel({ attribution, performance, dest: 'threadify.app' });
  assert.equal(funnel.links, 3);
  assert.deepEqual(funnel.stages.map((s) => s.count), [32000, 246, 1, 0]);
  const [views, signups, paid] = funnel.steps;
  assert.equal(views.rate_pct, 0.77);
  assert.equal(signups.upstream, 246);
  assert.equal(signups.rate_pct, 0.41);
  assert.equal(paid.small_sample, true);
  // signups -> paid is 0% but a small sample (1 in), so the leak is clicks -> signups.
  assert.equal(funnel.leak.step, 'clicks->signups');
  assert.match(funnel.leak.line, /1 of 246 \(0\.41%\)/);
  assert.equal(funnel.by_destination[0].destination, 'www.threadify.app/home');
  assert.equal(funnel.by_destination[0].clicks, 200);
  const receipts = leakReceipts(funnel);
  assert.equal(receipts[0].clicks, 120);
  assert.ok(!JSON.stringify(receipts).includes('@'));
  // Without the filter the YouTube link counts too.
  assert.equal(buildFunnel({ attribution, performance }).stages[1].count, 276);
});

test('funnel: unknown stays unknown (no post rows, conversion tracking not measurable)', () => {
  const noViews = buildFunnel({ attribution });
  assert.equal(noViews.stages[0].count, null);
  assert.equal(noViews.steps[0].rate_pct, null);
  const blind = buildFunnel({ attribution: { ...attribution, conversion_tracking: { measurable: false } }, performance });
  assert.equal(blind.stages[2].count, null);
  assert.equal(blind.stages[3].count, null);
  assert.equal(blind.leak.step, 'views->clicks');
  assert.equal(pickLeak([{ id: 'x', vs_yardstick: null }]).step, null);
  assert.throws(() => buildFunnel({ attribution: {} }), /links array/);
});

test('leak rule: furthest below its yardstick, small samples only when nothing bigger exists, ties to the later step', () => {
  const step = (id, upstream, downstream, yardstick) => ({ id, from: id.split('->')[0], to: id.split('->')[1], upstream, downstream,
    rate_pct: (downstream / upstream) * 100, yardstick, vs_yardstick: downstream / upstream / yardstick, small_sample: upstream < 20, lost: upstream - downstream });
  assert.equal(pickLeak([step('views->clicks', 10000, 50, 0.01), step('clicks->signups', 50, 5, 0.05)]).step, 'views->clicks');
  assert.equal(pickLeak([step('views->clicks', 10000, 100, 0.01), step('clicks->signups', 100, 5, 0.05)]).step, 'clicks->signups');
  assert.equal(pickLeak([step('clicks->signups', 5, 0, 0.05)]).small_sample, true);
});

test('belief test: page does not match the promise (supported / not supported / unknown)', () => {
  const promise = 'I tested the viral GitHub repo that reverse engineers any app, free workflow inside';
  const homepage = 'Threadify. Grow on Threads with AI. Schedule posts, auto replies, analytics. Start free trial.';
  const mismatch = testPageMismatch(promise, homepage);
  assert.equal(mismatch.verdict, 'supported');
  assert.ok(mismatch.missing.includes('github'));
  assert.ok(mismatch.score < 0.4);
  const matching = testPageMismatch(promise, 'Reverse engineer any app: the viral GitHub repo, tested. Get the free workflow.');
  assert.equal(matching.verdict, 'not supported');
  assert.equal(testPageMismatch(promise, '').verdict, 'unknown');
  assert.equal(testPageMismatch('hi there', homepage).verdict, 'unknown');
  assert.deepEqual(keyTerms('Posts posting the posts'), ['post', 'posting']);
});

test('belief test: people do not reach the CTA (retention curve strong, average weak, no data unknown)', () => {
  const curve = [[0, 1], [0.1, 0.6], [0.5, 0.3], [1, 0.1]];
  assert.equal(reachAt(curve, 0.3), 0.45);
  assert.equal(reachAt(curve, 1.2), null);
  const videos = loadVideos({ videos: [
    { video_id: 'a', duration_s: 400, cta_seconds: 200, retention: curve },
    { video_id: 'b', duration_s: 600, average_view_duration: 150, cta_seconds: 420 },
    { video_id: 'c', duration_s: 300 },
  ] });
  const result = testCtaReach(videos);
  assert.equal(result.verdict, 'supported');
  assert.equal(result.videos[0].strength, 'retention curve');
  assert.equal(result.videos[0].reach_at_cta_pct, 30);
  assert.equal(result.videos[1].strength, 'average only (weak)');
  assert.equal(result.videos[2].verdict, 'unknown');
  assert.equal(testCtaReach(loadVideos({ videos: [{ video_id: 'x', duration_s: 400, cta_seconds: 20, retention: curve }] })).verdict, 'not supported');
  assert.equal(testCtaReach(loadVideos([{ video_id: 'y' }])).verdict, 'unknown');
  // The THREADIFY YouTube reader format is accepted as is.
  const reader = loadVideos({ video_id: 'r', duration_s: 641, analytics: { averageViewPercentage: 24.58, averageViewDuration: 157 }, retention_30s: { ratio_point: 0.05, audience_watch_ratio: 0.5962 } });
  assert.equal(reader[0].avg_duration_s, 157);
  assert.deepEqual(reader[0].curve, [[0.05, 0.5962]]);
});

test('outside judge: sees only the diagnosis and the raw table; codex read-only first; verdict parsing', () => {
  const funnel = buildFunnel({ attribution, performance, dest: 'threadify.app' });
  const prompt = judgePrompt({ goal: { pace: { line: 'goal line' } }, funnel, beliefs: [{ kind: 'page-mismatch', verdict: 'supported', reason: 'r' }], diagnosis: 'clicks do not become signups' });
  assert.match(prompt, /You have not seen the conversation/);
  assert.match(prompt, /\| clicks -> signups \| 246 \| 1 \| 0\.41% \|/);
  assert.match(prompt, /Reply with JSON only/);
  const codex = judgeCommand('codex', 'P');
  assert.deepEqual(codex.args.slice(0, 3), ['exec', '-s', 'read-only']);
  assert.equal(codex.bin, 'codex');
  assert.equal(judgeCommand('claude', 'P').bin, 'claude');
  assert.match(judgeCommand('claude', 'P').label, /fresh Claude instance with no prior context/);
  assert.deepEqual(extractVerdict('thinking...\n{"verdict":"dispute","reasons":["only 1 signup"],"biggest_risk":"small"}'),
    { verdict: 'dispute', reasons: ['only 1 signup'], biggest_risk: 'small' });
  assert.equal(extractVerdict('no json here'), null);
  assert.equal(extractVerdict('{"verdict":"maybe"}'), null);
});

test('judge CLI: a silent judge is stopped at the hard limit and reported, not hidden', () => {
  const dir = tmp();
  const bin = tmp();
  fs.writeFileSync(path.join(dir, 'funnel.json'), JSON.stringify(buildFunnel({ attribution, performance })));
  fs.writeFileSync(path.join(bin, 'claude'), '#!/bin/sh\nsleep 30\n', { mode: 0o755 });
  const run = spawnSync(process.execPath, [script, 'judge', '--dir', dir, '--judge', 'claude', '--timeout-sec', '2'], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
  const result = JSON.parse(run.stdout);
  assert.equal(result.status, 'silent');
  assert.match(result.note, /stopped/);
  assert.ok(fs.existsSync(path.join(dir, 'judge-prompt.txt')));
});

test('short seller: exactly 3 claims, each quoted from the page word for word', () => {
  const page = 'Grow 10x faster on Threads. Trusted by thousands of creators. Cancel anytime.';
  const good = { claims: [
    { quote: 'Grow 10x faster on Threads.', doubt: 'no proof of 10x', evidence: '0 paid in 30 days' },
    { quote: 'trusted by thousands of creators', doubt: 'no names or count', evidence: 'no testimonials on the page' },
    { quote: 'Cancel anytime.', doubt: 'fine', evidence: 'no refund policy linked' },
  ] };
  assert.equal(checkShortSeller(good, page).status, 'PASS');
  const invented = { claims: [...good.claims.slice(0, 2), { quote: 'Money back guarantee', doubt: 'x', evidence: 'y' }] };
  assert.match(checkShortSeller(invented, page).problems.join(' '), /not on the page/);
  assert.match(checkShortSeller({ claims: good.claims.slice(0, 2) }, page).problems.join(' '), /exactly 3/);
});

test('three decisions ranked by impact x speed x reversibility', () => {
  const d = (title, impact, speed, reversibility, fix_kind = 'offer') => ({ title, fix_kind, for: ['f'], against: ['a'], impact, speed, reversibility });
  const ranked = rankDecisions({ decisions: [d('slow big', 3, 1, 2, 'landing-page-pr'), d('fast offer', 3, 3, 3), d('post', 2, 3, 3, 'post')] });
  assert.equal(ranked.status, 'PASS');
  assert.deepEqual(ranked.decisions.map((x) => [x.rank, x.title, x.score]), [[1, 'fast offer', 27], [2, 'post', 18], [3, 'slow big', 6]]);
  assert.equal(rankDecisions({ decisions: [d('a', 4, 1, 1)] }).status, 'FAIL');
  assert.match(rankDecisions({ decisions: [d('a', 1, 1, 1), d('b', 1, 1, 1), { ...d('c', 1, 1, 1), against: [] }] }).problems.join(' '), /against/);
});

test('casing-only guard: lower(original) == lower(final), proper nouns kept', () => {
  const original = 'My Last Six Videos Got 29 Clicks And Zero Signups. Claude Found Why.';
  const final = lowercaseExceptProperNouns(original, ['Claude']);
  assert.equal(final, 'my last six videos got 29 clicks and zero signups. Claude found why.');
  assert.equal(final.toLowerCase(), original.toLowerCase());
  assert.equal(checkPost({ id: 'p', original, final, keep: ['Claude'] }).status, 'PASS');
  assert.equal(checkPost({ id: 'p', original, final: 'my last six videos got 30 clicks and zero signups. Claude found why.', keep: ['Claude'] }).status, 'FAIL');
});

test('public copy guard: em dashes, casing, guarantees, emails and one CTA', () => {
  assert.equal(checkCopy('the leak was the page, not the post. Claude found it https://threadify.app/go/x', ['Claude']).status, 'PASS');
  const bad = checkCopy('Guaranteed — you will make $500 a week. email me@x.com https://a.com https://b.com');
  assert.equal(bad.status, 'FAIL');
  const text = bad.problems.join(' | ');
  for (const re of [/em dash/, /not lowercase/, /guarantee/, /email/, /one CTA/]) assert.match(text, re);
});

test('ledger: save, read, refuse emails, and grade the last fix on the same numbers', () => {
  const file = path.join(tmp(), 'nested', 'ledger.json');
  assert.equal(readLedger(file).entries.length, 0);
  const before = buildFunnel({ attribution, performance, dest: 'threadify.app' });
  const entry = { goal: { number: 1000, metric: 'paying members', deadline: '2026-12-31' }, baseline: UNKNOWN, pace: UNKNOWN,
    leak: { step: before.leak.step, upstream: before.leak.upstream, downstream: before.leak.downstream, rate_pct: before.leak.rate_pct },
    decision: 'make the offer page match the promise', fix: { kind: 'offer', ids: { offer: 'o1' } }, date: '2026-10-20' };
  assert.deepEqual(validateEntry(entry), []);
  assert.equal(saveEntry({ ...entry, note: 'from jane@example.com' }, file).status, 'FAIL');
  assert.equal(saveEntry(entry, file).status, 'saved');
  assert.equal((fs.statSync(file).mode & 0o777), 0o600);
  assert.equal(readLedger(file).entries.length, 1);
  const better = buildFunnel({ attribution: { ...attribution, links: attribution.links.map((l) => (l.tracked_url.endsWith('/b') ? { ...l, conversions: 4 } : l)) }, performance, dest: 'threadify.app' });
  const grade = gradeLast(readLedger(file), better);
  assert.equal(grade.verdict, 'improved');
  assert.match(grade.line, /0\.41% before the fix, 2\.03% now: improved\. Attributed, not caused\./);
  assert.equal(gradeLast(readLedger(file), before).verdict, 'no change yet');
  assert.equal(gradeLast({ entries: [] }, before).status, 'no_ledger');
  assert.equal(gradeLast(readLedger(file), buildFunnel({ attribution: { ...attribution, conversion_tracking: { measurable: false } } })).verdict, 'unknown');
});

test('report: big leak card, funnel table, verdicts, phone width, dark default, no emails', () => {
  const funnel = buildFunnel({ attribution, performance, dest: 'threadify.app' });
  const html = renderReport({ goal: { pace: pace({ goal: 1000, current: null, deadline: '2026-12-31', today: '2026-10-20' }) }, funnel,
    beliefs: [testPageMismatch('viral github repo reverse engineers apps', 'Threadify grow on threads')], judge: { judge_label: 'Codex', model: 'gpt', verdict: 'dispute', reasons: ['too few signups'] } });
  assert.match(html, /<meta name="viewport" content="width=device-width,initial-scale=1">/);
  assert.match(html, /class="leak"/);
  assert.match(html, /246 clicks → 1 signup</);
  assert.match(html, /needs real baseline/);
  assert.match(html, /your belief: supported/);
  assert.match(html, /dispute/);
  assert.match(html, /--bg:#0d0d0d/);
  assert.match(html, /overflow-x:hidden/);
  assert.match(html, /Not run yet/);
  assert.doesNotMatch(html, /[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
});

test('CLI end to end on saved rows: goal, funnel, belief, decisions, report', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify({ structuredContent: attribution }));
  fs.writeFileSync(path.join(dir, 'p.json'), JSON.stringify(performance));
  fs.writeFileSync(path.join(dir, 'promise.txt'), 'the viral github repo that reverse engineers apps, free workflow');
  fs.writeFileSync(path.join(dir, 'page.txt'), 'Threadify. Grow on Threads with AI.');
  const run = (...args) => JSON.parse(spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' }).stdout);
  assert.equal(run('goal', '--dir', dir, '--text', 'go make money: get me to 1,000 paying members by Dec 31', '--current', 'unknown', '--today', '2026-10-20').pace.label, NEEDS_BASELINE);
  const funnel = run('funnel', '--dir', dir, '--attribution', path.join(dir, 'a.json'), '--performance', path.join(dir, 'p.json'), '--dest', 'threadify.app', '--days', '30');
  assert.equal(funnel.leak.step, 'clicks->signups');
  assert.equal(run('belief', '--dir', dir, '--kind', 'page-mismatch', '--promise', path.join(dir, 'promise.txt'), '--page', path.join(dir, 'page.txt')).verdict, 'supported');
  assert.equal(run('belief', '--dir', dir, '--kind', 'cta-reach').verdict, 'unknown');
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'beliefs.json'), 'utf8')).tests.length, 2);
  assert.equal(run('report', '--dir', dir).status, 'ok');
  assert.match(fs.readFileSync(path.join(dir, 'report.html'), 'utf8'), /The leak/);
});

// v0.40.1 fixes.
test('counts read right: 1 signup, 2 signups, everywhere a count is printed', () => {
  assert.equal(plural(1, 'signup'), 'signup');
  assert.equal(plural(0, 'signup'), 'signups');
  assert.equal(plural(UNKNOWN, 'click'), 'clicks');
  const funnel = buildFunnel({ attribution, performance, dest: 'threadify.app' });
  const html = renderReport({ funnel });
  assert.match(html, /246 clicks → 1 signup</);
  assert.match(html, /: 120 clicks, 1 signup</);
  assert.match(html, /: 80 clicks, 0 signups</);
  assert.doesNotMatch(html, /\b1 (signups|clicks|views|posts|videos)\b/);
  const one = buildFunnel({ attribution: { links: [link('z', 'p1', 'https://www.threadify.app/home', 1, 1)] }, performance });
  assert.match(renderReport({ funnel: one }), /: 1 click, 1 signup</);
  assert.match(pace({ goal: 10, current: 5, deadline: '2026-10-27', today: '2026-10-20' }).line, /in 1 week =/);
  assert.match(testPageMismatch('alpha beta gamma', 'alpha').reason, /3 key words/);
  assert.match(testCtaReach(loadVideos([{ video_id: 'v', duration_s: 100, cta_seconds: 50, average_view_duration: 20 }])).reason, /^1 of 1 video with data loses most viewers/);
});

test('views -> clicks names its click basis when some linked posts have no views', () => {
  const partial = { posts: performance.posts.slice(0, 2) }; // p3 (46 clicks) has no views row
  const funnel = buildFunnel({ attribution, performance: partial, dest: 'threadify.app' });
  const [views, clicks] = funnel.steps;
  assert.equal(views.downstream, 200);
  assert.equal(clicks.upstream, 246);
  assert.equal(views.note, '200 of 246 clicks are on the 2 of 3 linked posts with views');
  assert.equal(clicks.note, null);
  assert.match(judgePrompt({ funnel, diagnosis: 'd' }), /Note on views -> clicks: 200 of 246 clicks are on the 2 of 3 linked posts with views\./);
  assert.match(renderReport({ funnel }), /Note on views → clicks: 200 of 246 clicks are on the 2 of 3 linked posts with views\./);
  // Every click is on a viewed post: no note, nothing to explain.
  assert.equal(buildFunnel({ attribution, performance, dest: 'threadify.app' }).steps[0].note, null);
  // The CLI step line and table carry it too.
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify(attribution));
  fs.writeFileSync(path.join(dir, 'p.json'), JSON.stringify(partial));
  const out = JSON.parse(spawnSync(process.execPath, [script, 'funnel', '--dir', dir, '--attribution', path.join(dir, 'a.json'), '--performance', path.join(dir, 'p.json'), '--dest', 'threadify.app'], { encoding: 'utf8' }).stdout);
  assert.equal(out.steps[0].note, '200 of 246 clicks are on the 2 of 3 linked posts with views');
  assert.match(out.table, /Note on views -> clicks: 200 of 246 clicks/);
});

test('judge CLI: the codex model is named and raw_reply is only the final message, no log noise', () => {
  const dir = tmp();
  const bin = tmp();
  fs.writeFileSync(path.join(dir, 'funnel.json'), JSON.stringify(buildFunnel({ attribution, performance })));
  const reply = '{"verdict":"agree","reasons":["1 of 246 clicks became a signup"],"biggest_risk":"small sample"}';
  fs.writeFileSync(path.join(bin, 'codex'), `#!/bin/sh
out=""
while [ $# -gt 0 ]; do if [ "$1" = "-o" ]; then out="$2"; shift; fi; shift; done
printf 'OpenAI Codex v0.162.1\\r\\n\\033[1mmodel:\\033[0m gpt-test-judge\\r\\n'
echo '2026-10-20T03:41:41.023892Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed' >&2
echo '2026-10-20T03:41:41.023892Z ERROR rmcp::transport::worker: worker quit with fatal'
echo 'hook: SessionStart'
echo '${reply}'
echo 'hook: Stop Completed'
printf '%s' '${reply}' > "$out"
`, { mode: 0o755 });
  const run = spawnSync(process.execPath, [script, 'judge', '--dir', dir, '--judge', 'codex', '--timeout-sec', '20'], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
  const result = JSON.parse(run.stdout);
  assert.equal(result.status, 'ok');
  assert.equal(result.model, 'gpt-test-judge');
  assert.equal(result.verdict, 'agree');
  assert.equal(result.raw_reply, reply);
  assert.doesNotMatch(JSON.stringify(result), /ERROR|rmcp|hook:/);
  const html = renderReport({ judge: result });
  assert.doesNotMatch(html, /ERROR|rmcp/);
  assert.match(html, /gpt-test-judge/);
});

test('judge helpers: model from a coloured header on either stream; logs stripped when no last-message file', () => {
  assert.equal(codexModel('', 'OpenAI Codex\r\n\x1b[1mmodel:\x1b[0m gpt-6-astra\r\nprovider: openai'), 'gpt-6-astra');
  assert.equal(codexModel('model: o4-mini\n', ''), 'o4-mini');
  assert.equal(codexModel('no header', ''), null);
  const noisy = '2026-10-20T03:41:41.0Z ERROR rmcp::transport::worker: worker quit\r\nhook: SessionStart\r\n\x1b[1mcodex\x1b[0m\r\n{"verdict":"dispute","reasons":["r"],"biggest_risk":"b"}\r\nhook: Stop Failed\r\n';
  const clean = cleanJudgeOutput(noisy);
  assert.doesNotMatch(clean, /ERROR|hook:|\x1b|\r/);
  assert.equal(extractVerdict(clean).verdict, 'dispute');
  assert.equal(judgeCommand('codex', 'P', { lastMessageFile: '/tmp/x' }).args.join(' '), 'exec -s read-only --skip-git-repo-check -o /tmp/x P');
});

test('judge CLI: the fresh-claude fallback records the claude model when it is reported', () => {
  const dir = tmp();
  const bin = tmp();
  fs.writeFileSync(path.join(dir, 'funnel.json'), JSON.stringify(buildFunnel({ attribution, performance })));
  const body = JSON.stringify({ result: '{"verdict":"agree","reasons":["r"],"biggest_risk":"b"}', modelUsage: { 'claude-test-model': { inputTokens: 1 } } });
  fs.writeFileSync(path.join(bin, 'claude'), `#!/bin/sh\necho '${body}'\n`, { mode: 0o755 });
  const result = JSON.parse(spawnSync(process.execPath, [script, 'judge', '--dir', dir, '--judge', 'claude', '--timeout-sec', '20'], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } }).stdout);
  assert.equal(result.model, 'claude-test-model');
  assert.equal(result.verdict, 'agree');
});

test('page text decodes numeric and named entities; the short seller still matches exact quotes', () => {
  assert.equal(decodeEntities('Can&#x27;t &#39;x&#39; &#X27; &amp; &lt;b&gt; &quot;q&quot; &apos; a&nbsp;b &#8217; &amp;lt;'), 'Can\'t \'x\' \' & <b> "q" \' a b ’ &lt;');
  const html = '<html><body><p>Can&#x27;t freaking wait to tell the Threads community about it!</p><p>See what&#39;s working. Repeat it.</p><p>Tom &amp; Jerry &lt;3 &quot;fast&quot; &#169;</p></body></html>';
  const text = htmlToText(html);
  assert.doesNotMatch(text, /&#x?[0-9a-f]+;|&(amp|lt|gt|quot|apos|nbsp);/i);
  assert.match(text, /Can't freaking wait/);
  assert.match(text, /Tom & Jerry <3 "fast" ©/);
  const claims = { claims: [
    { quote: "Can't freaking wait to tell the Threads community about it!", doubt: 'd', evidence: 'e' },
    { quote: "See what's working. Repeat it.", doubt: 'd', evidence: 'e' },
    { quote: 'Tom & Jerry', doubt: 'd', evidence: 'e' },
  ] };
  assert.equal(checkShortSeller(claims, text).status, 'PASS');
  // An older page.txt saved with entities still matches the decoded quote.
  assert.equal(checkShortSeller(claims, 'Can&#x27;t freaking wait to tell the Threads community about it! See what&#39;s working. Repeat it. Tom &amp; Jerry').status, 'PASS');
});
