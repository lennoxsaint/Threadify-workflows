import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkDrafts, referencesSource, renderHtml, scoreboard, MAX_WELCOMES_PER_DAY } from '../../plugins/threadify/skills/threadify-first-followers/scripts/first-followers.mjs';

const script = fileURLToPath(new URL('../../plugins/threadify/skills/threadify-first-followers/scripts/first-followers.mjs', import.meta.url));
const welcome = (id, name, source, line) => ({ id, first_name: name, source, comment: `welcome to threads, ${name}! just followed you. ${line}` });
const goodCreator = {
  id: 'c1',
  comments: [
    { source: 'I batch my sourdough on Sundays so weekday bread takes ten minutes.', comment: 'batching sourdough on sundays is smart, how long does the dough keep?' },
    { source: 'My starter died twice before I switched to rye flour.', comment: 'rye flour saved my starter too, the whole wheat one kept going flat' },
    { source: 'Hot take: bread machines are underrated for busy parents.', comment: 'the busy parents angle is real, mine runs overnight. followed!' },
  ],
};
const good = () => ({
  welcomes_sent_today: 0,
  welcomes: [
    welcome('w1', 'maya', 'Nurse turned pottery teacher in Leeds. First thread!', 'nurse to pottery teacher is a big jump, what made you switch?'),
    welcome('w2', 'tom', 'Learning to code at 52. Hello threads, first thread here.', 'starting to code at 52 is brave, which language are you learning first?'),
  ],
  creators: [goodCreator],
  replies: [{ id: 'r1', source: 'Most new creators quit in week two because nobody replies.', comment: 'week two is where i nearly quit too, replying to five newcomers a day kept me going' }],
});

test('good cards pass, with counts only', () => {
  const result = checkDrafts(good());
  assert.equal(result.status, 'PASS', JSON.stringify(result.failures));
  assert.deepEqual(result.counts, { welcomes: 2, welcomes_today_after_sending: 2, creators: 1, creator_comments: 3, replies: 1 });
});

test('links, DMs, flattery and duplicates fail', () => {
  const input = good();
  input.replies.push({ id: 'r2', source: 'Most new creators quit in week two.', comment: 'great post! creators quit in week two, see threadify.app' });
  input.replies.push({ id: 'r3', source: 'Week two is hard for creators.', comment: 'week two for creators is rough, dm me and I will help' });
  input.replies.push({ id: 'r4', source: 'Most new creators quit in week two because nobody replies.', comment: input.replies[0].comment });
  const rules = checkDrafts(input).failures.map((f) => `${f.id}: ${f.rule}`);
  assert.ok(rules.includes('r2: contains a link'));
  assert.ok(rules.some((rule) => rule.startsWith('r2: flattery template')));
  assert.ok(rules.includes('r3: mentions DMs'));
  assert.ok(rules.includes('r4: duplicate of r1'));
});

test('welcomes need the exact opener, a specific line and the daily cap', () => {
  const input = good();
  input.welcomes.push({ id: 'w3', first_name: 'sam', source: 'Dog trainer. First thread!', comment: 'hey sam welcome! love this' });
  input.welcomes.push(welcome('w4', 'jo', 'Baker in Perth, first thread', 'so glad you are here, enjoy the ride'));
  const rules = checkDrafts(input).failures.map((f) => `${f.id}: ${f.rule}`);
  assert.ok(rules.some((rule) => rule.startsWith('w3: must start "welcome to threads')));
  assert.ok(rules.includes('w4: personal line does not reference their bio or post'));
  const capped = good();
  capped.welcomes_sent_today = MAX_WELCOMES_PER_DAY - 1;
  assert.ok(checkDrafts(capped).failures.some((f) => f.id === 'welcomes' && /would pass 20 welcomes today/.test(f.rule)));
  const many = good();
  many.welcomes = Array.from({ length: 11 }, (_, i) => welcome(`w${i}`, `name${i}`, `teacher number ${i} first thread`, `teacher number ${i} is great to see`));
  assert.ok(checkDrafts(many).failures.some((f) => /more than 10 welcome cards/.test(f.rule)));
});

test('creators get exactly three comments and only the third ends "followed!"', () => {
  const input = good();
  input.creators[0] = { id: 'c1', comments: goodCreator.comments.slice(0, 2).concat({ ...goodCreator.comments[2], comment: 'the busy parents angle is real, mine runs overnight' }) };
  input.creators.push({ id: 'c2', comments: [{ source: 'Rye bread every day.', comment: 'rye bread every day sounds great. followed!' }] });
  const rules = checkDrafts(input).failures.map((f) => `${f.id}: ${f.rule}`);
  assert.ok(rules.includes('c1#3: third comment must end with "followed!"'));
  assert.ok(rules.includes('c2: needs exactly 3 comments, one per recent post'));
  assert.ok(rules.includes('c2#1: only the third comment ends with "followed!"'));
});

test('a specific reference means a shared real word, not filler', () => {
  assert.equal(referencesSource('your pottery classes look fun', 'pottery teacher in Leeds'), true);
  assert.equal(referencesSource('welcome, great to have you here', 'pottery teacher in Leeds'), false);
});

test('scoreboard keeps counts only, unknown stays unknown and the change is "since you started"', () => {
  const base = { handle: '@new', timezone: 'Australia/Perth', started_at: '2026-10-15 14:00', start: { followers: 0, posts: 0 }, actions: { welcomes: 10, creator_comments: 9, follows: 13, replies: 5, posts_scheduled: 3 }, names: ['someone'] };
  const before = scoreboard(base);
  assert.equal(before.followers_since_start, null);
  assert.match(before.line, /Re-check later today/);
  assert.equal(before.names, undefined);
  const after = scoreboard({ ...base, recheck: { at: '2026-10-15 21:00', followers: 7, posts: 2 } });
  assert.equal(after.followers_since_start, 7);
  assert.equal(after.line, '+7 followers since you started.');
  const unknown = scoreboard({ ...base, start: { followers: 'lots' }, recheck: { followers: 7 } });
  assert.equal(unknown.start.followers, null);
  assert.equal(unknown.followers_since_start, null);
  const html = renderHtml(after);
  assert.match(html, /\+7/);
  assert.match(html, /since you started/);
  assert.doesNotMatch(html, /someone/);
  assert.match(renderHtml(unknown), /unknown/);
});

test('CLI exits 1 on FAIL and writes the scoreboard page', () => {
  const bad = spawnSync(process.execPath, [script, 'check-drafts'], { input: JSON.stringify({ replies: [{ id: 'r', source: 'x', comment: 'love this' }] }) });
  assert.equal(bad.status, 1);
  assert.equal(JSON.parse(bad.stdout).status, 'FAIL');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'first-followers-'));
  const target = path.join(dir, 'first-followers.html');
  const ok = spawnSync(process.execPath, [script, 'scoreboard', '--html', target], { input: JSON.stringify({ start: { followers: 3, posts: 0 }, actions: { welcomes: 4 } }) });
  assert.equal(ok.status, 0, String(ok.stderr));
  assert.ok(fs.readFileSync(target, 'utf8').includes('<title>First Followers</title>'));
  fs.rmSync(dir, { recursive: true, force: true });
});
