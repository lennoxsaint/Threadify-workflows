#!/usr/bin/env node
// First Followers: local checks, no network, no dependencies (Node 18+).
//
//   node first-followers.mjs check-drafts [--ledger <ledger.jsonl>] < batch.json
//     Checks every drafted comment in the batch against the hard rules before
//     anything is staged. Exit 0 on PASS, 1 on FAIL or bad input.
//
//   node first-followers.mjs diff < pairs.json
//     Compares each staged comment with what the owner actually published and
//     returns edit stats for the end-of-run learning summary.
//
//   node first-followers.mjs record [--ledger <ledger.jsonl>] < run.json
//     Appends this run to the private local ledger: hashed handles, counts and the
//     owner's own staged/published comment text. Never other people's details.
//
//   node first-followers.mjs followed-back [--ledger <ledger.jsonl>] < followers.json
//     Counts how many people engaged on a run date now follow the account, by hashing
//     the account's current follower handles in memory and matching the ledger.
//
//   node first-followers.mjs scoreboard [--html first-followers.html] < scoreboard.json
//     Builds the counts-only scoreboard and (optionally) a local HTML card.
//
// batch.json:
//   {"date": "YYYY-MM-DD" (owner's local date),
//    "max_people": 10, "people_engaged_today": 0, "comments_published_today": 0,
//    "people": [{"id", "handle", "plan": "newcomer" | "creator", "post_count",
//                "new_to_threads": true | false,
//                "comments": [{"source": "<their post (and bio)>", "comment"}]}]}
//   newcomer: 1-2 posts, exactly 1 comment ending "welcome to threads! just followed you".
//   creator: 3+ posts, exactly 3 comments (newest, 2nd newest, 3rd); only the third ends
//     "welcome to threads! just followed you" when new_to_threads is true, otherwise "just followed you!".
// pairs.json:
//   {"pairs": [{"id", "staged": "<text typed into the composer>", "published": "<text read back>" | null}]}
// run.json:
//   {"date", "account": "@handle", "people": [{"handle", "plan", "followed": true | false,
//    "comments": [{"staged", "published": "<text>" | null}]}]}
// followers.json:
//   {"date": "<run date YYYY-MM-DD>", "followers": ["@handle", ...]}  (read from the account's own Followers list)
// scoreboard.json (counts only; anything else is ignored):
//   {"handle", "timezone", "started_at", "start": {"followers", "posts"},
//    "actions": {"people", "comments_published", "comments_edited", "comments_skipped", "follows", "posts_scheduled"},
//    "recheck": {"at", "followers", "posts", "followed_back"}}
import { createHash } from 'node:crypto';
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEFAULT_PEOPLE_PER_RUN = 10;
export const MAX_PEOPLE_PER_DAY = 20;
export const MAX_COMMENTS_PER_DAY = 40;
export const RECENT_DAYS = 30;
export const NEWCOMER_ENDING = 'welcome to threads! just followed you';
export const CREATOR_ENDING = 'just followed you!';
export const DEFAULT_LEDGER = join(homedir(), '.threadify', 'first-followers', 'ledger.jsonl');
const PLAN_COMMENTS = { newcomer: 1, creator: 3 };

const LINK = /https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|app|co|ai|me|ly|link|gg|xyz|au|uk)\b/i;
const DM = /\b(dm|dms|direct message|inbox me|message me|check your (dms|inbox)|sent you a (dm|message))\b/i;
const EMOJI = /\p{Extended_Pictographic}/gu;
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
const endsWith = (text, ending) => new RegExp(`(^|\\s)${escapeRegex(ending)}[.!]?$`, 'i').test(String(text ?? '').trim());
const withoutEnding = (text, ending) => String(text ?? '').trim()
  .replace(new RegExp(`${escapeRegex(ending)}[.!]?$`, 'i'), '').trim();

/** Stable private id for a Threads handle. The ledger stores this, never the handle. */
export function hashHandle(handle) {
  const clean = String(handle ?? '').trim().replace(/^@/, '').toLowerCase();
  if (!clean) throw new Error('handle is required');
  return createHash('sha256').update(`threadify-first-followers:${clean}`).digest('hex');
}

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
  if (/[\r\n]/.test(text)) problems.push('contains a line break (typing it could send the comment)');
  if (LINK.test(text)) problems.push('contains a link');
  if (DM.test(text)) problems.push('mentions DMs');
  const lower = normalise(text);
  const hit = FLATTERY.find((phrase) => new RegExp(`(^| )${escapeRegex(normalise(phrase))}( |$)`).test(lower));
  if (hit) problems.push(`flattery template "${hit}"`);
  return problems;
}

/** Read the private ledger. A missing file is an empty ledger. */
export function readLedger(file) {
  if (!file || !existsSync(file)) return [];
  return readFileSync(file, 'utf8').split(/\r?\n/).filter((line) => line.trim()).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch {
      throw new Error(`ledger line ${index + 1} is not valid JSON`);
    }
  });
}

const dayNumber = (date) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date ?? ''));
  return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000 : null;
};

/** What the ledger says about today and the last 30 days, relative to the owner's local date. */
export function ledgerSummary(entries, date) {
  const today = dayNumber(date);
  const summary = { people_today: 0, comments_today: 0, recent: new Set(), texts: new Set() };
  for (const entry of entries) {
    for (const comment of entry.comments ?? []) {
      for (const text of [comment.staged, comment.published]) if (text) summary.texts.add(normalise(text));
    }
    const day = dayNumber(entry.date);
    if (today === null || day === null) continue;
    if (day === today) {
      summary.people_today += 1;
      summary.comments_today += (entry.comments ?? []).filter((comment) => comment.status !== 'skipped').length;
    }
    if (day <= today && today - day < RECENT_DAYS && entry.person_sha256) summary.recent.add(entry.person_sha256);
  }
  return summary;
}

/** Check every drafted comment in the batch against the hard rules. Never stages or sends anything. */
export function checkDrafts(input, ledger = []) {
  if (!input || typeof input !== 'object') throw new Error('input must be a JSON object');
  const people = input.people ?? [];
  if (!Array.isArray(people)) throw new Error('people must be an array');
  const whole = (name, fallback) => {
    const value = Number(input[name] ?? fallback);
    if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a whole number`);
    return value;
  };
  if (ledger.length && dayNumber(input.date) === null) throw new Error('date (YYYY-MM-DD) is required with a ledger');
  const maxPeople = whole('max_people', DEFAULT_PEOPLE_PER_RUN);
  const fromLedger = ledger.length ? ledgerSummary(ledger, input.date) : null;
  const peopleToday = Math.max(whole('people_engaged_today', 0), fromLedger?.people_today ?? 0);
  const commentsToday = Math.max(whole('comments_published_today', 0), fromLedger?.comments_today ?? 0);

  const failures = [];
  const seen = new Map();
  const seenPeople = new Set();
  const fail = (id, rule) => failures.push({ id, rule });
  let commentCount = 0;

  if (maxPeople > MAX_PEOPLE_PER_DAY) fail('batch', `max_people cannot pass ${MAX_PEOPLE_PER_DAY}`);
  if (people.length > Math.min(maxPeople, MAX_PEOPLE_PER_DAY)) fail('batch', `more than ${Math.min(maxPeople, MAX_PEOPLE_PER_DAY)} people in one run`);

  for (const person of people) {
    const id = person.id ?? 'person';
    const comments = person.comments ?? [];
    const plan = person.plan;
    if (!Array.isArray(comments)) throw new Error(`${id}: comments must be an array`);
    commentCount += comments.length;
    if (!Object.hasOwn(PLAN_COMMENTS, plan)) {
      fail(id, 'plan must be "newcomer" or "creator"');
      continue;
    }
    if (person.handle) {
      const personId = hashHandle(person.handle);
      if (seenPeople.has(personId)) fail(id, 'same person twice in one batch');
      seenPeople.add(personId);
      if (fromLedger?.recent.has(personId)) fail(id, `engaged in the last ${RECENT_DAYS} days`);
    } else if (fromLedger) fail(id, 'missing handle, needed to check the ledger');

    const postCount = person.post_count;
    const newcomer = plan === 'newcomer';
    const isNew = newcomer || person.new_to_threads === true;
    if (Number.isInteger(postCount)) {
      if (newcomer && (postCount < 1 || postCount > 2)) fail(id, 'the 1-comment newcomer plan is only for people with 1-2 posts');
      if (!newcomer && postCount < 3) fail(id, 'the 3-comment plan needs 3 or more recent posts');
    } else fail(id, 'post_count must be a whole number read from their profile');
    const expected = PLAN_COMMENTS[plan];
    if (comments.length !== expected) {
      fail(id, newcomer ? 'newcomer plan needs exactly 1 comment' : 'creator plan needs exactly 3 comments, one per recent post');
    }
    const ending = isNew ? NEWCOMER_ENDING : CREATOR_ENDING;

    comments.forEach((entry, index) => {
      const commentId = expected === 1 ? id : `${id}#${index + 1}`;
      const text = String(entry.comment ?? '');
      for (const problem of commonProblems(text)) fail(commentId, problem);
      const normalised = normalise(text);
      if (normalised && seen.has(normalised)) fail(commentId, `duplicate of ${seen.get(normalised)}`);
      else if (normalised && fromLedger?.texts.has(normalised)) fail(commentId, 'repeats a comment from an earlier run');
      else if (normalised) seen.set(normalised, commentId);

      const last = index === comments.length - 1 && comments.length === expected;
      const claimsNew = /welcome to threads/i.test(text);
      const followed = /just followed you/i.test(text);
      if (claimsNew && !isNew) fail(commentId, 'says "welcome to threads" but their posts do not show they are new');
      if (last) {
        if (!endsWith(text, ending)) fail(commentId, `final comment must end "${ending}"`);
      } else if (followed || claimsNew) {
        fail(commentId, 'only the final comment welcomes or says "just followed you"');
      }
      const personal = last ? withoutEnding(text, ending) : text;
      if (!personal) fail(commentId, 'needs one specific line before the ending');
      else if (!referencesSource(personal, entry.source)) fail(commentId, 'does not reference something specific in their post or bio');
    });
  }

  const totalPeople = peopleToday + people.length;
  const totalComments = commentsToday + commentCount;
  if (totalPeople > MAX_PEOPLE_PER_DAY) fail('batch', `would pass ${MAX_PEOPLE_PER_DAY} people today (${peopleToday} already engaged)`);
  if (totalComments > MAX_COMMENTS_PER_DAY) fail('batch', `would pass ${MAX_COMMENTS_PER_DAY} comments today (${commentsToday} already published)`);

  return {
    status: failures.length ? 'FAIL' : 'PASS',
    counts: {
      people: people.length,
      newcomers: people.filter((person) => person.plan === 'newcomer').length,
      creators: people.filter((person) => person.plan === 'creator').length,
      comments: commentCount,
      follows_planned: people.length,
      people_today_after_run: totalPeople,
      comments_today_after_run: totalComments,
    },
    failures,
  };
}

const splitWords = (text) => String(text ?? '').match(/\S+/gu) ?? [];
const bare = (piece) => piece.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
const bareWords = (text) => splitWords(text).map(bare).filter(Boolean);

/** Word-level longest-common-subsequence diff: the runs of words removed and added. */
function wordDiff(before, after) {
  const a = bareWords(before);
  const b = bareWords(after);
  const table = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const removed = [];
  const added = [];
  let run = { removed: [], added: [] };
  const flush = () => {
    if (run.removed.length) removed.push(run.removed.join(' '));
    if (run.added.length) added.push(run.added.join(' '));
    run = { removed: [], added: [] };
  };
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      flush();
      i += 1;
      j += 1;
    } else if (j >= b.length || (i < a.length && table[i + 1][j] >= table[i][j + 1])) {
      run.removed.push(a[i]);
      i += 1;
    } else {
      run.added.push(b[j]);
      j += 1;
    }
  }
  flush();
  return { removed, added };
}

function casingChange(before, after) {
  const upper = (text) => /\p{Lu}/u.test(text);
  if (upper(before) && !upper(after)) return 'lowercased';
  if (!upper(before) && upper(after)) return 'capitalised';
  return 'same';
}

/** Edit stats for one staged/published pair. A null or empty published text means skipped. */
export function diffPair(pair) {
  const staged = String(pair.staged ?? '').trim();
  const published = pair.published === null || pair.published === undefined || !String(pair.published).trim()
    ? null : String(pair.published).trim();
  if (published === null) return { id: pair.id ?? null, status: 'skipped' };
  const emoji = (text) => text.match(EMOJI) ?? [];
  const before = emoji(staged);
  const after = emoji(published);
  const { removed, added } = wordDiff(staged, published);
  return {
    id: pair.id ?? null,
    status: staged === published ? 'unchanged' : 'edited',
    length_before: staged.length,
    length_after: published.length,
    length_change: published.length - staged.length,
    emoji_removed: Math.max(0, before.length - after.length),
    emoji_added: Math.max(0, after.length - before.length),
    casing: casingChange(staged, published),
    phrases_removed: removed,
    phrases_added: added,
  };
}

/** Compare every staged comment with what was actually published and summarise the owner's edits. */
export function diffPairs(input) {
  const pairs = input?.pairs;
  if (!Array.isArray(pairs)) throw new Error('pairs must be an array');
  const results = pairs.map(diffPair);
  const published = results.filter((result) => result.status !== 'skipped');
  const edited = published.filter((result) => result.status === 'edited');
  const shortened = published.filter((result) => result.length_change < 0).length;
  const lengthened = published.filter((result) => result.length_change > 0).length;
  const emojiCut = published.filter((result) => result.emoji_removed > 0).length;
  const emojiAdded = published.filter((result) => result.emoji_added > 0).length;
  const lowercased = published.filter((result) => result.casing === 'lowercased').length;
  const capitalised = published.filter((result) => result.casing === 'capitalised').length;

  const tally = (list) => {
    const counts = new Map();
    for (const result of published) for (const phrase of new Set(result[list])) counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
    return [...counts].filter(([, total]) => total >= 2).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
      .map(([phrase, total]) => ({ phrase, count: total }));
  };
  const removedOften = tally('phrases_removed');
  const addedOften = tally('phrases_added');
  // A phrase is "never kept" when it was staged at least twice and removed every time.
  const stagedWith = (phrase) => pairs.filter((pair, index) => results[index].status !== 'skipped'
    && ` ${bareWords(pair.staged).join(' ')} `.includes(` ${phrase} `)).length;
  const neverKept = removedOften.filter(({ phrase, count: total }) => stagedWith(phrase) === total).map(({ phrase }) => phrase);
  const totalChange = published.reduce((sum, result) => sum + result.length_change, 0);

  const of = `of ${published.length}`;
  const lines = [];
  if (published.length) lines.push(edited.length ? `You edited ${edited.length} ${of}` : `You published all ${published.length} unchanged`);
  if (shortened) lines.push(`shortened ${shortened} ${of}`);
  if (lengthened) lines.push(`lengthened ${lengthened} ${of}`);
  if (emojiCut) lines.push(`cut emojis in ${emojiCut}`);
  if (emojiAdded) lines.push(`added emojis in ${emojiAdded}`);
  if (lowercased) lines.push(`lowercased ${lowercased}`);
  if (capitalised) lines.push(`added capitals in ${capitalised}`);
  for (const phrase of neverKept.slice(0, 3)) lines.push(`never kept "${phrase}"`);
  const skipped = results.length - published.length;
  if (skipped) lines.push(`skipped ${skipped}`);

  return {
    pairs: results,
    summary: {
      staged: results.length,
      published: published.length,
      skipped,
      unchanged: published.length - edited.length,
      edited: edited.length,
      shortened,
      lengthened,
      average_length_change: published.length ? Math.round(totalChange / published.length) : null,
      emoji_cut_in: emojiCut,
      emoji_added_in: emojiAdded,
      lowercased,
      capitalised,
      phrases_removed_often: removedOften,
      phrases_added_often: addedOften,
      never_kept: neverKept,
      headline: lines.length ? `${lines.join(', ')}.` : 'Nothing published yet.',
    },
  };
}

/** Turn one run into ledger lines: hashed handles, counts and the owner's own comment text only. */
export function ledgerEntries(input) {
  if (!input || typeof input !== 'object') throw new Error('input must be a JSON object');
  if (dayNumber(input.date) === null) throw new Error('date must be YYYY-MM-DD (owner\'s local date)');
  const people = input.people ?? [];
  if (!Array.isArray(people)) throw new Error('people must be an array');
  const account = input.account ? hashHandle(input.account) : null;
  return people.map((person) => ({
    date: input.date,
    account_sha256: account,
    person_sha256: hashHandle(person.handle),
    plan: person.plan === 'newcomer' ? 'newcomer' : 'creator',
    followed: person.followed === true,
    comments: (person.comments ?? []).map((comment) => {
      const staged = String(comment.staged ?? '').trim();
      const published = comment.published && String(comment.published).trim() ? String(comment.published).trim() : null;
      return { staged, published, status: published === null ? 'skipped' : published === staged ? 'unchanged' : 'edited' };
    }),
  }));
}

/** Append a run to the private ledger, creating the folder for this user only. */
export function recordRun(input, file = DEFAULT_LEDGER) {
  const entries = ledgerEntries(input);
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  if (entries.length) appendFileSync(file, `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`, { mode: 0o600 });
  if (existsSync(file)) chmodSync(file, 0o600);
  const comments = entries.flatMap((entry) => entry.comments);
  return {
    status: 'recorded',
    ledger: file,
    counts: {
      people: entries.length,
      follows: entries.filter((entry) => entry.followed).length,
      comments_published: comments.filter((comment) => comment.status !== 'skipped').length,
      comments_edited: comments.filter((comment) => comment.status === 'edited').length,
      comments_skipped: comments.filter((comment) => comment.status === 'skipped').length,
    },
  };
}

/** Of the people engaged on a run date, how many appear among the account's followers. Counts only. */
export function followedBack(entries, input) {
  if (!input || typeof input !== 'object') throw new Error('input must be a JSON object');
  if (dayNumber(input.date) === null) throw new Error('date must be YYYY-MM-DD (the run date)');
  if (!Array.isArray(input.followers)) throw new Error('followers must be an array of handles');
  const engaged = new Set(entries.filter((entry) => entry.date === input.date && entry.person_sha256).map((entry) => entry.person_sha256));
  const followers = new Set(input.followers.filter((handle) => String(handle ?? '').trim()).map(hashHandle));
  return { date: input.date, engaged: engaged.size, followed_back: [...engaged].filter((personId) => followers.has(personId)).length };
}

const count = (value) => (Number.isInteger(value) && value >= 0 ? value : null);
const ACTIONS = [
  ['people', 'people engaged'],
  ['comments_published', 'comments published'],
  ['comments_edited', 'comments you edited'],
  ['comments_skipped', 'comments skipped'],
  ['follows', 'follows'],
  ['posts_scheduled', 'posts scheduled'],
];

/** Counts-only scoreboard. Unknown numbers stay null ("unknown"), never 0. */
export function scoreboard(input) {
  if (!input || typeof input !== 'object') throw new Error('input must be a JSON object');
  const start = { followers: count(input.start?.followers), posts: count(input.start?.posts) };
  const actions = Object.fromEntries(ACTIONS.map(([name]) => [name, count(input.actions?.[name])]));
  const recheck = input.recheck
    ? {
      at: String(input.recheck.at ?? ''),
      followers: count(input.recheck.followers),
      posts: count(input.recheck.posts),
      followed_back: count(input.recheck.followed_back),
    }
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
      ? 'Re-check tomorrow: I\'ll read your follower count again and see who followed back.'
      : `${change >= 0 ? '+' : ''}${change} followers since you started.`,
  };
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const show = (value) => (value === null || value === undefined ? 'unknown' : Number(value).toLocaleString('en-US'));

/** A self-contained, phone-readable local card. Counts only: no names, handles or comment text of other people. */
export function renderHtml(board) {
  const rows = ACTIONS.map(([name, label]) => [label, board.actions[name]])
    .concat(board.recheck ? [['followed you back', board.recheck.followed_back]] : [])
    .map(([label, value]) => `<li><span>${label}</span><b>${show(value)}</b></li>`).join('');
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
<h1>First Followers${board.handle ? ` · ${escapeHtml(board.handle)}` : ''}</h1>
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

const option = (name) => {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} needs a file path`);
  return value;
};

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const [command] = process.argv.slice(2);
  readStdin()
    .then((input) => {
      if (command === 'check-drafts') {
        const ledgerFile = option('--ledger');
        const result = checkDrafts(input, ledgerFile ? readLedger(ledgerFile) : []);
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        if (result.status !== 'PASS') process.exitCode = 1;
        return;
      }
      if (command === 'diff') {
        process.stdout.write(`${JSON.stringify(diffPairs(input), null, 2)}\n`);
        return;
      }
      if (command === 'record') {
        process.stdout.write(`${JSON.stringify(recordRun(input, option('--ledger') ?? DEFAULT_LEDGER), null, 2)}\n`);
        return;
      }
      if (command === 'followed-back') {
        const result = followedBack(readLedger(option('--ledger') ?? DEFAULT_LEDGER), input);
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        return;
      }
      if (command === 'scoreboard') {
        const board = scoreboard(input);
        const target = option('--html');
        if (target) {
          writeFileSync(target, renderHtml(board));
          board.report = target;
        }
        process.stdout.write(`${JSON.stringify(board, null, 2)}\n`);
        return;
      }
      throw new Error('command must be check-drafts, diff, record, followed-back or scoreboard');
    })
    .catch((error) => {
      process.stderr.write(`${JSON.stringify({ status: 'failed', error: error.message })}\n`);
      process.exitCode = 1;
    });
}
