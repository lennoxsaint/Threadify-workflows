#!/usr/bin/env node
// First Followers: two local checks, no network, no dependencies (Node 18+).
//
//   node first-followers.mjs check-drafts < cards.json
//     Checks every drafted welcome, creator comment and reply against the hard rules
//     before the owner sees the cards. Exit 0 on PASS, 1 on FAIL or bad input.
//
//   node first-followers.mjs scoreboard [--html day-one.html] < scoreboard.json
//     Builds the counts-only day-one scoreboard and (optionally) a local HTML card.
//
// cards.json:
//   {"welcomes_sent_today": 0,
//    "welcomes": [{"id", "first_name", "source": "<their bio + first post>", "comment"}],
//    "creators": [{"id", "comments": [{"source": "<their post>", "comment"}, x3]}],
//    "replies":  [{"id", "source": "<the big post>", "comment"}]}
// scoreboard.json (counts only; anything else is ignored):
//   {"handle", "timezone", "started_at", "start": {"followers", "posts"},
//    "actions": {"welcomes", "creator_comments", "follows", "replies", "posts_scheduled"},
//    "recheck": {"at", "followers", "posts"}}
import { realpathSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const MAX_WELCOMES_PER_DAY = 20;
export const MAX_WELCOME_CARDS = 10;
export const CREATORS = 3;
export const COMMENTS_PER_CREATOR = 3;
export const MAX_REPLIES = 5;

const LINK = /https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|app|co|ai|me|ly|link|gg|xyz|au|uk)\b/i;
const DM = /\b(dm|dms|direct message|inbox me|message me|check your (dms|inbox)|sent you a (dm|message))\b/i;
// Generic praise that fits any post. A comment built on one of these is a template, not a reply.
const FLATTERY = [
  'great post', 'love this', 'so true', 'amazing content', 'this is gold', 'well said', 'couldn\'t agree more',
  'great insight', 'great content', 'nice post', 'awesome post', 'this is fire', 'so inspiring',
  'keep it up', 'great job', 'love your content', 'this resonates', 'needed to hear this', 'great point',
];
const STOP = new Set(('about after again also because been before being could does doing done even every from have here '
  + 'into just like made make more most much never only other over really same should some such than that their them '
  + 'then there these they this those through very want were what when where which while will with would your yours '
  + 'welcome threads followed thread first today just people thing things know think going good great').split(' '));

const words = (text) => (String(text ?? '').toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [])
  .map((word) => word.replace(/'s$/, '').replace(/'/g, ''))
  .filter((word) => word.length >= 4 && !STOP.has(word));
const normalise = (text) => String(text ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** True when the comment shares at least one specific word with what it replies to. */
export function referencesSource(comment, source, ignore = []) {
  const skip = new Set(ignore.flatMap(words));
  const sourceWords = new Set(words(source));
  return words(comment).some((word) => !skip.has(word) && sourceWords.has(word));
}

function commonProblems(comment) {
  const problems = [];
  const text = String(comment ?? '');
  if (!text.trim()) problems.push('empty comment');
  if (LINK.test(text)) problems.push('contains a link');
  if (DM.test(text)) problems.push('mentions DMs');
  const lower = normalise(text);
  const hit = FLATTERY.find((phrase) => new RegExp(`(^| )${escapeRegex(normalise(phrase))}( |$)`).test(lower));
  if (hit) problems.push(`flattery template "${hit}"`);
  return problems;
}

/** Check every drafted card against the hard rules. Never sends anything. */
export function checkDrafts(input) {
  if (!input || typeof input !== 'object') throw new Error('input must be a JSON object');
  const welcomes = input.welcomes ?? [];
  const creators = input.creators ?? [];
  const replies = input.replies ?? [];
  for (const [name, list] of Object.entries({ welcomes, creators, replies })) {
    if (!Array.isArray(list)) throw new Error(`${name} must be an array`);
  }
  const sentToday = Number(input.welcomes_sent_today ?? 0);
  if (!Number.isInteger(sentToday) || sentToday < 0) throw new Error('welcomes_sent_today must be a whole number');
  const failures = [];
  const seen = new Map();
  const fail = (id, rule) => failures.push({ id, rule });
  const common = (id, comment) => {
    for (const problem of commonProblems(comment)) fail(id, problem);
    const text = normalise(comment);
    if (text && seen.has(text)) fail(id, `duplicate of ${seen.get(text)}`);
    else if (text) seen.set(text, id);
  };

  if (welcomes.length > MAX_WELCOME_CARDS) fail('welcomes', `more than ${MAX_WELCOME_CARDS} welcome cards in one run`);
  if (sentToday + welcomes.length > MAX_WELCOMES_PER_DAY) {
    fail('welcomes', `would pass ${MAX_WELCOMES_PER_DAY} welcomes today (${sentToday} already sent)`);
  }
  for (const card of welcomes) {
    const id = card.id ?? 'welcome';
    const name = String(card.first_name ?? '').trim();
    common(id, card.comment);
    if (!name) fail(id, 'missing first name');
    const opener = new RegExp(`^welcome to threads, ${escapeRegex(name.toLowerCase())}! just followed you\\. \\S`);
    if (name && !opener.test(String(card.comment ?? '').toLowerCase())) {
      fail(id, 'must start "welcome to threads, <first name>! just followed you." then one personal line');
    }
    const personal = String(card.comment ?? '').replace(/^.*?just followed you\.\s*/i, '');
    if (!referencesSource(personal, card.source, [name])) fail(id, 'personal line does not reference their bio or post');
  }

  if (creators.length > CREATORS) fail('creators', `more than ${CREATORS} creators`);
  for (const creator of creators) {
    const id = creator.id ?? 'creator';
    const comments = creator.comments ?? [];
    if (comments.length !== COMMENTS_PER_CREATOR) fail(id, `needs exactly ${COMMENTS_PER_CREATOR} comments, one per recent post`);
    comments.forEach((entry, index) => {
      const commentId = `${id}#${index + 1}`;
      common(commentId, entry.comment);
      if (!referencesSource(entry.comment, entry.source, ['followed'])) fail(commentId, 'does not reference something specific in the post');
      const endsFollowed = /followed!\s*$/i.test(String(entry.comment ?? ''));
      if (index === COMMENTS_PER_CREATOR - 1 && !endsFollowed) fail(commentId, 'third comment must end with "followed!"');
      if (index < COMMENTS_PER_CREATOR - 1 && endsFollowed) fail(commentId, 'only the third comment ends with "followed!"');
    });
  }

  if (replies.length > MAX_REPLIES) fail('replies', `more than ${MAX_REPLIES} reply-up cards`);
  for (const card of replies) {
    const id = card.id ?? 'reply';
    common(id, card.comment);
    if (!referencesSource(card.comment, card.source)) fail(id, 'does not reference something specific in the post');
  }

  return {
    status: failures.length ? 'FAIL' : 'PASS',
    counts: {
      welcomes: welcomes.length,
      welcomes_today_after_sending: sentToday + welcomes.length,
      creators: creators.length,
      creator_comments: creators.reduce((sum, creator) => sum + (creator.comments?.length ?? 0), 0),
      replies: replies.length,
    },
    failures,
  };
}

const count = (value) => (Number.isInteger(value) && value >= 0 ? value : null);

/** Counts-only day-one scoreboard. Unknown numbers stay null ("unknown"), never 0. */
export function scoreboard(input) {
  if (!input || typeof input !== 'object') throw new Error('input must be a JSON object');
  const start = { followers: count(input.start?.followers), posts: count(input.start?.posts) };
  const actionNames = ['welcomes', 'creator_comments', 'follows', 'replies', 'posts_scheduled'];
  const actions = Object.fromEntries(actionNames.map((name) => [name, count(input.actions?.[name])]));
  const recheck = input.recheck
    ? { at: String(input.recheck.at ?? ''), followers: count(input.recheck.followers), posts: count(input.recheck.posts) }
    : null;
  const change = recheck && start.followers !== null && recheck.followers !== null ? recheck.followers - start.followers : null;
  return {
    handle: String(input.handle ?? ''),
    timezone: String(input.timezone ?? ''),
    started_at: String(input.started_at ?? ''),
    start,
    actions,
    recheck,
    followers_since_start: change,
    line: change === null
      ? 'Re-check later today: read your follower count again and compare it with your start.'
      : `${change >= 0 ? '+' : ''}${change} followers since you started.`,
  };
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const show = (value) => (value === null || value === undefined ? 'unknown' : Number(value).toLocaleString('en-US'));

/** A self-contained, phone-readable local card. Counts only: no names, handles or comment text of other people. */
export function renderHtml(board) {
  const rows = [
    ['welcomes sent', board.actions.welcomes],
    ['creator comments', board.actions.creator_comments],
    ['follows', board.actions.follows],
    ['replies up', board.actions.replies],
    ['posts scheduled', board.actions.posts_scheduled],
  ].map(([label, value]) => `<li><span>${label}</span><b>${show(value)}</b></li>`).join('');
  const change = board.followers_since_start;
  const now = board.recheck?.followers ?? null;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>First Followers</title>
<style>
:root{--bg:#0d0d0d;--bg2:#1a1a1a;--text:#fff;--muted:rgba(255,255,255,.7);--accent:#ff6b4a;--up:#4ecdc4}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:20px/1.4 Inter,system-ui,sans-serif;padding:32px 16px}
main{max-width:720px;margin:0 auto;display:grid;gap:20px}h1{font-size:40px;margin:0}.muted{color:var(--muted);margin:0}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px}.stat{background:var(--bg2);border-radius:12px;padding:20px}
.stat b{display:block;font:700 56px/1.1 'Space Mono',ui-monospace,monospace}.up b{color:var(--up)}
ul{list-style:none;margin:0;padding:0;background:var(--bg2);border-radius:12px}li{display:flex;justify-content:space-between;gap:12px;padding:14px 20px;border-bottom:1px solid #2a2a2a}
li:last-child{border-bottom:0}li b{font-family:'Space Mono',ui-monospace,monospace}.next{border-left:6px solid var(--accent);background:var(--bg2);border-radius:12px;padding:16px 20px}
</style></head><body><main>
<h1>Day one${board.handle ? ` · ${escapeHtml(board.handle)}` : ''}</h1>
<p class="muted">Started ${escapeHtml(board.started_at)}${board.timezone ? ` · ${escapeHtml(board.timezone)}` : ''}</p>
<section class="stats">
<div class="stat"><span>followers at start</span><b>${show(board.start.followers)}</b></div>
<div class="stat"><span>followers now</span><b>${show(now)}</b></div>
<div class="stat up"><span>since you started</span><b>${change === null ? 'unknown' : `${change >= 0 ? '+' : ''}${change}`}</b></div>
</section>
<ul>${rows}</ul>
<p class="next">${escapeHtml(board.line)}${board.recheck?.at ? ` Checked ${escapeHtml(board.recheck.at)}.` : ''}</p>
</main></body></html>
`;
}

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return JSON.parse(data);
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const [command] = process.argv.slice(2);
  const htmlIndex = process.argv.indexOf('--html');
  readStdin()
    .then((input) => {
      if (command === 'check-drafts') {
        const result = checkDrafts(input);
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        if (result.status !== 'PASS') process.exitCode = 1;
        return;
      }
      if (command === 'scoreboard') {
        const board = scoreboard(input);
        if (htmlIndex > -1) {
          const target = process.argv[htmlIndex + 1];
          if (!target) throw new Error('--html needs a file path');
          writeFileSync(target, renderHtml(board));
          board.report = target;
        }
        process.stdout.write(`${JSON.stringify(board, null, 2)}\n`);
        return;
      }
      throw new Error('command must be check-drafts or scoreboard');
    })
    .catch((error) => {
      process.stderr.write(`${JSON.stringify({ status: 'failed', error: error.message })}\n`);
      process.exitCode = 1;
    });
}
