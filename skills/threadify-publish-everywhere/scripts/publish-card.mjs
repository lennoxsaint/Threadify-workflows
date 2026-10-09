#!/usr/bin/env node
// Publish Everywhere: the one approval card, and the gate behind it.
//
// Three checks live here so they are the same on every run:
//   1. connections  - YouTube must be connected, or the run stops.
//   2. card         - builds the one approval card. It refuses (status
//                     "blocked") while anything the owner must decide is
//                     missing: YouTube privacy is never defaulted, every time
//                     needs a timezone offset, and made-for-kids is never set
//                     without asking.
//   3. schedule     - returns the exact schedule_post arguments, and only when
//                     the owner's reply to that exact card is "yes".
//
//   node publish-card.mjs connections < {"brand", "handles": {"threads","x","youtube"}}
//   node publish-card.mjs title       < {"post_text", "supplied_title"?}
//   node publish-card.mjs card        < plan.json
//   node publish-card.mjs schedule    < {"plan": {...}, "card_sha256": "...", "reply": "yes"}
//
// Output is JSON on stdout. Exit 0 when the step may continue, 1 otherwise.
// No dependencies and no network: Node 18+ only.
import crypto from 'node:crypto';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const PLATFORMS = ['youtube', 'threads', 'x'];
export const LABELS = { youtube: 'YouTube', threads: 'Threads', x: 'X' };
export const PRIVACY = ['public', 'unlisted', 'private'];
export const TITLE_MAX = 100;
export const X_METERED_NOTE = 'X is metered: this post counts against your X allowance';
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/;

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
const handle = (value) => (value ? `@${String(value).replace(/^@/, '')}` : null);

/** Read back the brand and each handle. No YouTube means stop, never continue quietly. */
export function checkConnections({ brand, handles = {} } = {}) {
  const readback = Object.fromEntries(PLATFORMS.map((id) => [id, handle(handles[id])]));
  const lines = PLATFORMS.map((id) => `${LABELS[id]}: ${readback[id] ?? 'not connected'}`);
  const base = { brand: brand ?? null, handles: readback, readback: [`Brand: ${brand ?? 'unknown'}`, ...lines].join('\n') };
  if (!brand) return { status: 'stop', ...base, message: 'No brand found on this Threadify connection. Nothing was uploaded or scheduled.' };
  if (!readback.youtube) {
    return {
      status: 'stop',
      ...base,
      message: `YouTube is not connected to ${brand}. Connect it at threadify.app (Brands), then run this again. Nothing was uploaded or scheduled.`,
    };
  }
  return { status: 'ok', ...base, not_connected: PLATFORMS.filter((id) => !readback[id]) };
}

/**
 * The YouTube title is the first line of Threadify's post unless the owner
 * supplied one. Either way it must be 100 characters or fewer; a longer line
 * is a question for the owner, never a silent cut or a rewrite.
 */
export function youtubeTitle({ post_text: postText, supplied_title: supplied } = {}) {
  const fromOwner = typeof supplied === 'string' && supplied.trim() !== '';
  const title = fromOwner
    ? supplied.trim()
    : String(postText ?? '').split(/\r?\n/).map((line) => line.trim()).find((line) => line) ?? '';
  const source = fromOwner ? 'owner' : 'first_line_of_post';
  const length = [...title].length;
  if (!title) return { status: 'ask', source, title: '', length, ask: 'What should the YouTube title be?' };
  if (length > TITLE_MAX) {
    return {
      status: 'ask',
      source,
      title,
      length,
      ask: fromOwner
        ? `That title is ${length} characters and YouTube takes ${TITLE_MAX}. What shorter title do you want?`
        : `The post's first line is ${length} characters and a YouTube title takes ${TITLE_MAX}. What title do you want?`,
    };
  }
  return { status: 'ok', source, title, length };
}

function timeLine(time, timezone) {
  const label = time.label ? `${time.label} · ` : '';
  return `${label}${time.at} (${timezone})`;
}

/** Everything the owner must decide that is still missing. Empty means the card can be shown. */
export function missingForCard(plan = {}) {
  const missing = [];
  const kept = Array.isArray(plan.platforms) ? plan.platforms : [];
  if (!plan.brand) missing.push({ field: 'brand', ask: 'Which brand is this for?' });
  if (!plan.timezone) missing.push({ field: 'timezone', ask: 'Which timezone are these times in?' });
  if (!kept.length) missing.push({ field: 'platforms', ask: 'No platform is left to schedule to.' });
  for (const id of kept) {
    if (!PLATFORMS.includes(id)) missing.push({ field: `platforms.${id}`, ask: `${id} is not a platform this workflow schedules to.` });
    else if (!plan.handles?.[id]) missing.push({ field: `handles.${id}`, ask: `Which ${LABELS[id]} account is this for?` });
    const at = plan.times?.[id]?.at;
    if (!at) missing.push({ field: `times.${id}`, ask: `When should it go out on ${LABELS[id] ?? id}?` });
    else if (!ISO_WITH_OFFSET.test(at)) missing.push({ field: `times.${id}`, ask: `The ${LABELS[id] ?? id} time needs a timezone offset, for example 2026-10-12T09:00:00+08:00.` });
  }
  if (typeof plan.post?.final !== 'string' || !plan.post.final.trim()) missing.push({ field: 'post', ask: 'Threadify has not written the post yet.' });
  if (plan.post && plan.post.casing !== 'unchanged' && plan.post.casing !== 'PASS') {
    missing.push({ field: 'post.casing', ask: 'The casing guard has not passed. Show Threadify\'s original text unchanged.' });
  }
  if (!plan.video?.url) missing.push({ field: 'video.url', ask: 'The video is not uploaded yet.' });
  if (kept.includes('youtube')) {
    const options = plan.youtube ?? {};
    // Privacy is never defaulted: the owner picks it, every run.
    if (!PRIVACY.includes(options.privacy)) {
      missing.push({ field: 'youtube.privacy', ask: 'Who should see the video on YouTube: public, unlisted or private?' });
    }
    if (!['short', 'long'].includes(options.format)) missing.push({ field: 'youtube.format', ask: 'The YouTube format (short or long) is not decided yet.' });
    const title = youtubeTitle({ post_text: options.title, supplied_title: options.title });
    if (title.status !== 'ok') missing.push({ field: 'youtube.title', ask: title.ask });
    if (options.made_for_kids !== undefined && options.made_for_kids_asked !== true) {
      missing.push({ field: 'youtube.made_for_kids', ask: 'Is this video made for kids? Leave it unset to keep your channel\'s own setting.' });
    }
  }
  return missing;
}

/** Build the one approval card. Blocked while anything is missing. */
export function buildCard(plan = {}) {
  const missing = missingForCard(plan);
  if (missing.length) return { status: 'blocked', missing, ask: missing.map((entry) => entry.ask) };
  const lines = [`Publish Everywhere · ${plan.brand} · ${plan.timezone}`];
  const { video } = plan;
  const facts = [video.name, video.duration, video.dimensions, video.size_mb === undefined ? null : `${video.size_mb} MB`, video.container]
    .filter(Boolean)
    .join(' · ');
  if (facts) lines.push(`Video: ${facts}`);
  lines.push(`Post, written by Threadify (${plan.post.casing === 'PASS' ? 'lowercased, casing guard PASS: lower(original) == lower(final)' : 'unchanged'}):`);
  lines.push(plan.post.final);
  if (plan.platforms.includes('youtube')) {
    const options = plan.youtube;
    const from = options.title_source === 'owner' ? 'you supplied it' : "the post's first line";
    lines.push(`YouTube title (${from}): ${options.title}`);
    lines.push(`YouTube format: ${options.format}${options.format_reason ? ` (${options.format_reason})` : ''}`);
    lines.push(`YouTube privacy: ${options.privacy} (you chose it)`);
    if (options.tags?.length) lines.push(`YouTube tags: ${options.tags.join(', ')}`);
    lines.push(`Made for kids: ${options.made_for_kids === undefined ? "not set, your channel's own setting applies" : options.made_for_kids ? 'yes (you chose it)' : 'no (you chose it)'}`);
  }
  lines.push('Going to:');
  for (const id of PLATFORMS.filter((entry) => plan.platforms.includes(entry))) {
    const metered = id === 'x' ? ` · ${X_METERED_NOTE}` : '';
    lines.push(`- ${LABELS[id]} ${handle(plan.handles[id])} · ${timeLine(plan.times[id], plan.timezone)}${metered}`);
  }
  const dropped = plan.dropped ?? [];
  lines.push(dropped.length
    ? `Dropped: ${dropped.map((entry) => `${LABELS[entry.platform] ?? entry.platform}, because ${entry.reason}`).join('; ')}`
    : 'Dropped: nothing');
  if (plan.global_auto_repost === true) {
    lines.push('Note: global auto-repost is on, so Threadify will also re-share this post later under your saved setting.');
  } else if (plan.global_auto_repost !== false) {
    lines.push('Note: global auto-repost is unknown; check it in Threadify if a later re-share would matter.');
  }
  lines.push('Action: schedule this video exactly as shown. Nothing publishes now.');
  lines.push('Reply "yes" to schedule it, or "no" to schedule nothing.');
  const card = lines.join('\n');
  return { status: 'ready', card, card_sha256: sha256(card) };
}

/** Only the exact reply "yes" approves. "ok", "sure", "yes please" and silence do not. */
export function isApproved(reply) {
  return typeof reply === 'string' && reply.trim().toLowerCase() === 'yes';
}

/**
 * The exact schedule_post arguments, returned only for a "yes" to the card
 * built from this same plan. Any change to the plan changes the card hash, so
 * it needs a new card and a new "yes".
 */
export function scheduleArgs({ plan, card_sha256: approvedHash, reply } = {}) {
  const built = buildCard(plan);
  if (built.status !== 'ready') return { status: 'blocked', missing: built.missing, ask: built.ask };
  if (!isApproved(reply)) return { status: 'not_approved', message: 'Nothing was scheduled. Only the exact reply "yes" schedules the card.' };
  if (built.card_sha256 !== approvedHash) {
    return { status: 'card_changed', message: 'The plan changed after the card was shown. Show the new card and ask for a new "yes".' };
  }
  const kept = PLATFORMS.filter((id) => plan.platforms.includes(id));
  const times = Object.fromEntries(kept.map((id) => [id, plan.times[id].at]));
  const first = times[kept[0]];
  const args = {
    text: plan.post.final,
    video: plan.video.url,
    platforms: kept,
    scheduled_at: first,
    idempotency_key: `publish-everywhere-${sha256(JSON.stringify([plan.brand, kept.map((id) => handle(plan.handles[id])), plan.video.url, plan.post.final, plan.youtube ?? null, times])).slice(0, 32)}`,
  };
  if (kept.some((id) => times[id] !== first)) args.platform_times = times;
  if (kept.includes('youtube')) {
    const { format, privacy, title, tags, made_for_kids: madeForKids } = plan.youtube;
    args.youtube_options = { format, privacy, title };
    if (tags?.length) args.youtube_options.tags = tags;
    if (madeForKids !== undefined) args.youtube_options.made_for_kids = madeForKids;
  }
  return { status: 'approved', tool: 'schedule_post', arguments: args };
}

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return JSON.parse(data);
}

const COMMANDS = {
  connections: [checkConnections, 'ok'],
  title: [youtubeTitle, 'ok'],
  card: [buildCard, 'ready'],
  schedule: [scheduleArgs, 'approved'],
};

async function main(argv) {
  const [command] = argv;
  if (!COMMANDS[command]) throw new Error('usage: publish-card.mjs connections|title|card|schedule < input.json');
  const [run, pass] = COMMANDS[command];
  const result = run(await readStdin());
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status !== pass) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: 'failed', error: error.message })}\n`);
    process.exitCode = 1;
  });
}
