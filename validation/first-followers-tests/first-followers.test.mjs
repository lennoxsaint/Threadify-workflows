import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  checkDrafts,
  diffPairs,
  followedBack,
  hashHandle,
  ledgerEntries,
  readLedger,
  recordRun,
  referencesSource,
  renderHtml,
  scoreboard,
  MAX_COMMENTS_PER_DAY,
  MAX_PEOPLE_PER_DAY,
} from '../../plugins/threadify/skills/threadify-first-followers/scripts/first-followers.mjs';

const script = fileURLToPath(new URL('../../plugins/threadify/skills/threadify-first-followers/scripts/first-followers.mjs', import.meta.url));
const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'first-followers-'));

const newcomer = (id, handle, source, line, postCount = 1) => ({
  id, handle, plan: 'newcomer', post_count: postCount,
  comments: [{ source, comment: `${line} welcome to threads! just followed you` }],
});
const creator = (id, handle, newToThreads = false) => ({
  id, handle, plan: 'creator', post_count: 12, new_to_threads: newToThreads,
  comments: [
    { source: 'I batch my sourdough on Sundays so weekday bread takes ten minutes.', comment: `batching sourdough on sundays is smart, how long does the dough keep? (${id})` },
    { source: 'My starter died twice before I switched to rye flour.', comment: `rye flour saved my starter too, the whole wheat one kept going flat (${id})` },
    { source: 'Hot take: bread machines are underrated for busy parents.', comment: `the busy parents angle is real, mine runs overnight (${id}). ${newToThreads ? 'welcome to threads! just followed you' : 'just followed you!'}` },
  ],
});
const good = () => ({
  date: '2026-10-15',
  people: [
    newcomer('p1', '@maya.pots', 'Nurse turned pottery teacher in Leeds. First thread!', 'nurse to pottery teacher is a big jump, what made you switch?'),
    newcomer('p2', '@tom52codes', 'Learning to code at 52. Hello threads, first thread here.', 'starting to code at 52 is brave, which language first?', 2),
    creator('p3', '@breadmum'),
    creator('p4', '@newbaker', true),
  ],
});
const rulesOf = (result) => result.failures.map((f) => `${f.id}: ${f.rule}`);

test('a mixed batch of newcomers and creators passes, with counts only', () => {
  const result = checkDrafts(good());
  assert.equal(result.status, 'PASS', JSON.stringify(result.failures));
  assert.deepEqual(result.counts, {
    people: 4, newcomers: 2, creators: 2, comments: 8, follows_planned: 4,
    people_today_after_run: 4, comments_today_after_run: 8,
  });
});

test('newcomers get one comment ending "welcome to threads! just followed you" and need 1-2 posts', () => {
  const input = good();
  input.people[0].comments[0].comment = 'nurse to pottery teacher is a big jump, welcome!';
  input.people[1].post_count = 5;
  input.people.push({ ...newcomer('p5', '@jo', 'Baker in Perth, first thread', 'perth bakers unite'), comments: [
    { source: 'Baker in Perth', comment: 'perth bakers unite. welcome to threads! just followed you' },
    { source: 'Baker in Perth', comment: 'perth again. welcome to threads! just followed you' },
  ] });
  input.people.push(newcomer('p6', '@sam', 'Dog trainer. First thread!', 'so glad you are here'));
  const rules = rulesOf(checkDrafts(input));
  assert.ok(rules.includes('p1: final comment must end "welcome to threads! just followed you"'));
  assert.ok(rules.includes('p2: the 1-comment newcomer plan is only for people with 1-2 posts'));
  assert.ok(rules.includes('p5: newcomer plan needs exactly 1 comment'));
  assert.ok(rules.includes('p6: does not reference something specific in their post or bio'));
});

test('creators get three comments; only the third follows, and only real newcomers are welcomed', () => {
  const input = good();
  input.people[2].comments[2].comment = 'the busy parents angle is real, mine runs overnight. welcome to threads! just followed you';
  input.people[3].comments[0].comment = 'batching sourdough on sundays is smart. just followed you!';
  input.people[3].comments[2].comment = 'the busy parents angle is real (p4). just followed you!';
  input.people.push({ ...creator('p5', '@two'), post_count: 2 });
  input.people.push({ ...creator('p6', '@short'), comments: creator('p6', '@short').comments.slice(0, 2) });
  const rules = rulesOf(checkDrafts(input));
  assert.ok(rules.includes('p3#3: says "welcome to threads" but their posts do not show they are new'));
  assert.ok(rules.includes('p3#3: final comment must end "just followed you!"'));
  assert.ok(rules.includes('p4#1: only the final comment welcomes or says "just followed you"'));
  assert.ok(rules.includes('p4#3: final comment must end "welcome to threads! just followed you"'));
  assert.ok(rules.includes('p5: the 3-comment plan needs 3 or more recent posts'));
  assert.ok(rules.includes('p6: creator plan needs exactly 3 comments, one per recent post'));
});

test('links, DMs, flattery, line breaks, duplicates and missing post counts fail', () => {
  const input = good();
  input.people[0].comments[0].comment = 'great post! pottery in leeds, see threadify.app welcome to threads! just followed you';
  input.people[1].comments[0].comment = 'coding at 52, dm me if stuck\nwelcome to threads! just followed you';
  input.people[3].comments[1].comment = input.people[2].comments[1].comment;
  delete input.people[3].post_count;
  input.people.push({ ...creator('p5', '@x'), plan: 'friend' });
  const rules = rulesOf(checkDrafts(input));
  assert.ok(rules.includes('p1: contains a link'));
  assert.ok(rules.some((rule) => rule.startsWith('p1: flattery template')));
  assert.ok(rules.includes('p2: mentions DMs'));
  assert.ok(rules.includes('p2: contains a line break (typing it could send the comment)'));
  assert.ok(rules.includes('p4#2: duplicate of p3#2'));
  assert.ok(rules.includes('p4: post_count must be a whole number read from their profile'));
  assert.ok(rules.includes('p5: plan must be "newcomer" or "creator"'));
});

test('caps: 10 people a run by default, 20 people and 40 comments a day', () => {
  const many = { people: Array.from({ length: 11 }, (_, i) => newcomer(`p${i}`, `@n${i}`, `teacher number${i} first thread`, `teacher number${i} is new here`)) };
  assert.ok(checkDrafts(many).failures.some((f) => f.rule === 'more than 10 people in one run'));
  assert.ok(checkDrafts({ ...many, max_people: 21 }).failures.some((f) => /max_people cannot pass 20/.test(f.rule)));
  assert.equal(checkDrafts({ ...many, max_people: 11 }).status, 'PASS');
  const people = checkDrafts({ ...good(), people_engaged_today: MAX_PEOPLE_PER_DAY - 3 });
  assert.ok(people.failures.some((f) => f.id === 'batch' && /would pass 20 people today/.test(f.rule)));
  const comments = checkDrafts({ ...good(), comments_published_today: MAX_COMMENTS_PER_DAY - 7 });
  assert.ok(comments.failures.some((f) => f.id === 'batch' && /would pass 40 comments today/.test(f.rule)));
});

test('the ledger blocks people engaged in the last 30 days, repeated text and today\'s caps', () => {
  const dir = tempDir();
  const ledger = path.join(dir, 'nested', 'ledger.jsonl');
  const run = {
    date: '2026-10-01',
    account: '@me',
    people: [
      { handle: '@maya.pots', plan: 'newcomer', followed: true, comments: [{ staged: 'old line. welcome to threads! just followed you', published: 'old line. welcome to threads! just followed you' }] },
      { handle: '@long.ago', plan: 'newcomer', followed: true, comments: [{ staged: 'a', published: null }] },
    ],
  };
  const recorded = recordRun(run, ledger);
  assert.deepEqual(recorded.counts, { people: 2, follows: 2, comments_published: 1, comments_edited: 0, comments_skipped: 1 });
  recordRun({ date: '2026-10-15', people: Array.from({ length: 18 }, (_, i) => ({ handle: `@t${i}`, plan: 'creator', followed: true, comments: [{ staged: `x${i}`, published: `x${i}` }] })) }, ledger);
  assert.equal((fs.statSync(ledger).mode & 0o777).toString(8), '600');
  const text = fs.readFileSync(ledger, 'utf8');
  assert.doesNotMatch(text, /maya|long\.ago|@me/);
  assert.match(text, new RegExp(hashHandle('maya.pots')));

  const entries = readLedger(ledger);
  const input = good();
  input.people.push(newcomer('p5', '@new.person', 'Quilting in Cork. First thread!', 'old line.'));
  const result = checkDrafts(input, entries);
  const rules = rulesOf(result);
  assert.ok(rules.includes('p1: engaged in the last 30 days'));
  assert.ok(rules.includes('p5: repeats a comment from an earlier run'));
  assert.ok(rules.some((rule) => /would pass 20 people today \(18 already engaged\)/.test(rule)));
  assert.equal(result.counts.comments_today_after_run, 18 + 9);
  assert.equal(checkDrafts({ ...good(), date: '2026-11-20' }, entries).status, 'PASS');
  assert.throws(() => checkDrafts({ people: [] }, entries), /date \(YYYY-MM-DD\) is required/);
  assert.equal(hashHandle('@Maya.Pots'), hashHandle('maya.pots'));
  assert.throws(() => ledgerEntries({ date: 'today', people: [] }), /date must be YYYY-MM-DD/);
  assert.deepEqual(followedBack(entries, { date: '2026-10-01', followers: ['@Maya.Pots', '@stranger', '@t1'] }), { date: '2026-10-01', engaged: 2, followed_back: 1 });
  assert.deepEqual(followedBack(entries, { date: '2026-10-15', followers: ['t1', '@t2', '@maya.pots'] }), { date: '2026-10-15', engaged: 18, followed_back: 2 });
  assert.throws(() => followedBack(entries, { date: '2026-10-15' }), /followers must be an array/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('diff reports edits: length, emoji, casing, phrases and a plain-English headline', () => {
  const result = diffPairs({ pairs: [
    { id: 'a', staged: 'Rye flour saved my starter too 🔥 honestly the whole wheat one kept going flat', published: 'rye flour saved my starter too, whole wheat kept going flat' },
    { id: 'b', staged: 'Batching on Sundays is smart 🙌 honestly how long does the dough keep?', published: 'batching on sundays is smart, how long does the dough keep?' },
    { id: 'c', staged: 'the busy parents angle is real. just followed you!', published: 'the busy parents angle is real. just followed you!' },
    { id: 'd', staged: 'pottery in leeds sounds lovely', published: 'pottery in leeds sounds lovely, which kiln do you use? 😊' },
    { id: 'e', staged: 'skipped one', published: null },
  ] });
  const [a, b, c, d, e] = result.pairs;
  assert.equal(a.status, 'edited');
  assert.ok(a.length_change < 0);
  assert.equal(a.emoji_removed, 1);
  assert.equal(a.casing, 'lowercased');
  assert.ok(a.phrases_removed.includes('honestly the'));
  assert.equal(b.casing, 'lowercased');
  assert.equal(c.status, 'unchanged');
  assert.equal(c.length_change, 0);
  assert.equal(d.emoji_added, 1);
  assert.deepEqual(d.phrases_added, ['which kiln do you use']);
  assert.equal(e.status, 'skipped');
  const { summary } = result;
  assert.equal(summary.staged, 5);
  assert.equal(summary.published, 4);
  assert.equal(summary.skipped, 1);
  assert.equal(summary.edited, 3);
  assert.equal(summary.shortened, 2);
  assert.equal(summary.lengthened, 1);
  assert.equal(summary.emoji_cut_in, 2);
  assert.equal(summary.lowercased, 2);
  assert.deepEqual(summary.never_kept, []);
  assert.equal(summary.headline, 'You edited 3 of 4, shortened 2 of 4, lengthened 1 of 4, cut emojis in 2, added emojis in 1, lowercased 2, skipped 1.');
});

test('diff names a phrase the owner removed every time it was staged', () => {
  const { summary } = diffPairs({ pairs: [
    { staged: 'such a cool way to batch bread', published: 'smart way to batch bread' },
    { staged: 'such a cool rye starter story', published: 'good rye starter story' },
    { staged: 'kiln question for you', published: 'kiln question for you' },
  ] });
  assert.deepEqual(summary.phrases_removed_often, [{ phrase: 'such a cool', count: 2 }]);
  assert.deepEqual(summary.never_kept, ['such a cool']);
  assert.match(summary.headline, /never kept "such a cool"/);
  assert.equal(diffPairs({ pairs: [] }).summary.headline, 'Nothing published yet.');
  assert.throws(() => diffPairs({}), /pairs must be an array/);
});

test('a specific reference means a shared real word, not filler', () => {
  assert.equal(referencesSource('your pottery classes look fun', 'pottery teacher in Leeds'), true);
  assert.equal(referencesSource('welcome, great to have you here', 'pottery teacher in Leeds'), false);
});

test('scoreboard keeps counts only, unknown stays unknown and the change is "since you started"', () => {
  const base = {
    handle: '@new', timezone: 'Australia/Perth', started_at: '2026-10-15 14:00', start: { followers: 0, posts: 0 },
    actions: { people: 10, comments_published: 18, comments_edited: 6, comments_skipped: 2, follows: 10, posts_scheduled: 0 },
    names: ['someone'],
  };
  const before = scoreboard(base);
  assert.equal(before.followers_since_start, null);
  assert.match(before.line, /Re-check tomorrow/);
  assert.equal(before.names, undefined);
  const after = scoreboard({ ...base, recheck: { at: '2026-10-16 09:00', followers: 7, posts: 0, followed_back: 4 } });
  assert.equal(after.followers_since_start, 7);
  assert.equal(after.recheck.followed_back, 4);
  assert.equal(after.line, '+7 followers since you started.');
  const unknown = scoreboard({ ...base, start: { followers: 'lots' }, recheck: { followers: 7 } });
  assert.equal(unknown.start.followers, null);
  assert.equal(unknown.followers_since_start, null);
  const html = renderHtml(after);
  assert.match(html, /\+7/);
  assert.match(html, /since you started/);
  assert.match(html, /followed you back/);
  assert.doesNotMatch(html, /someone/);
  assert.match(renderHtml(unknown), /unknown/);
});

test('CLI: check-drafts exits 1 on FAIL, diff and record print JSON, scoreboard writes the page', () => {
  const bad = spawnSync(process.execPath, [script, 'check-drafts'], { input: JSON.stringify({ people: [{ id: 'x', plan: 'newcomer', post_count: 1, comments: [{ source: 'x', comment: 'love this' }] }] }) });
  assert.equal(bad.status, 1);
  assert.equal(JSON.parse(bad.stdout).status, 'FAIL');
  const dir = tempDir();
  const ledger = path.join(dir, 'ledger.jsonl');
  const ok = spawnSync(process.execPath, [script, 'check-drafts', '--ledger', ledger], { input: JSON.stringify(good()) });
  assert.equal(ok.status, 0, String(ok.stdout) + String(ok.stderr));
  const diff = spawnSync(process.execPath, [script, 'diff'], { input: JSON.stringify({ pairs: [{ staged: 'Hi 🔥', published: 'hi' }] }) });
  assert.equal(diff.status, 0, String(diff.stderr));
  assert.equal(JSON.parse(diff.stdout).summary.emoji_cut_in, 1);
  const record = spawnSync(process.execPath, [script, 'record', '--ledger', ledger], { input: JSON.stringify({ date: '2026-10-15', people: [{ handle: '@a', plan: 'newcomer', followed: true, comments: [{ staged: 's', published: 's' }] }] }) });
  assert.equal(record.status, 0, String(record.stderr));
  assert.equal(JSON.parse(record.stdout).counts.people, 1);
  const back = spawnSync(process.execPath, [script, 'followed-back', '--ledger', ledger], { input: JSON.stringify({ date: '2026-10-15', followers: ['@a', '@b'] }) });
  assert.equal(back.status, 0, String(back.stderr));
  assert.deepEqual(JSON.parse(back.stdout), { date: '2026-10-15', engaged: 1, followed_back: 1 });
  const target = path.join(dir, 'first-followers.html');
  const board = spawnSync(process.execPath, [script, 'scoreboard', '--html', target], { input: JSON.stringify({ start: { followers: 3, posts: 0 }, actions: { people: 4 } }) });
  assert.equal(board.status, 0, String(board.stderr));
  assert.ok(fs.readFileSync(target, 'utf8').includes('<title>First Followers</title>'));
  const unknownCommand = spawnSync(process.execPath, [script, 'send'], { input: '{}' });
  assert.equal(unknownCommand.status, 1);
  fs.rmSync(dir, { recursive: true, force: true });
});
