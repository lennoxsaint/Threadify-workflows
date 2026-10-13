#!/usr/bin/env node
// Reverse Engineer My App: the one approval card for seven posts, the gate
// behind it, the readback check and the body-free receipt.
//
//   node app-card.mjs card      < plan.json
//   node app-card.mjs schedule  < {"plan": {...}, "card_sha256": "...", "reply": "yes"}
//   node app-card.mjs readback  < {"plan": {...}, "statuses": [<get_schedule_status result>, ... seven]}
//   node app-card.mjs receipt   < {"plan": {...}, "card_sha256", "reply", "scheduled_post_ids", "readback"}
//
// The card refuses (status "blocked") while anything is unproven: the owner's
// "yes" to the ownership question, seven posts each with a passing fact check,
// the casing guard on lowercased copy, validate_post on every post and plug,
// and seven future times on seven different days with a timezone offset.
// `schedule` returns the schedule_post arguments only for the exact reply
// "yes" to that exact card. Output is JSON on stdout. Exit 0 when the step may
// continue, 1 otherwise. No dependencies and no network: Node 18+ only.
import crypto from 'node:crypto';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { checkText } from './casing-guard.mjs';
import { TEMPLATE_SOURCES, redactText } from './feature-map.mjs';

export const POSTS = 7;
// Same Auto Plug mechanism as Monetize My Week: a time trigger 50 minutes after each post.
export const PLUG_DELAY_MINUTES = 50;
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const SOURCES = { rea: 'REA, logged out', page: 'your product page', list: 'your feature list' };
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
const handle = (value) => (value ? `@${String(value).trim().replace(/^@/, '')}` : null);

/** unchanged, or lowercased with the guard proof; anything else fails. */
function casing(copy, label) {
  if (!copy || typeof copy.original !== 'string' || typeof copy.final !== 'string' || !copy.final.trim()) {
    return { problem: `${label}: Threadify's original and final text are both required` };
  }
  if (copy.original === copy.final) return { line: 'unchanged' };
  const guard = checkText(copy.original, copy.final, copy.keep);
  if (guard.status !== 'PASS') return { problem: `${label}: the casing guard failed (${guard.reasons.join(', ')}); show the original unchanged` };
  return { line: 'lowercased, casing guard PASS' };
}

/** Only the exact reply "yes" approves. "ok", "sure", "yes please" and silence do not. */
export function isApproved(reply) {
  return typeof reply === 'string' && reply.trim().toLowerCase() === 'yes';
}

function plugFor(plan, post) {
  if (plan.auto_plug_unavailable) return null;
  return post.auto_plug ?? null;
}

/** Build the one approval card, or say exactly what blocks it. */
export function buildCard(plan = {}) {
  const problems = [];
  const account = handle(plan.account);
  if (!account) problems.push('the Threads account handle from get_connection_defaults');
  if (!plan.timezone) problems.push('the account timezone');
  if (!isApproved(plan.ownership)) problems.push('the owner\'s "yes" to the ownership question');
  const app = plan.app ?? {};
  if (!app.name || !SOURCES[app.source] || !Number.isInteger(app.features)) problems.push('the app name, its source and the feature count from the map');
  const posts = Array.isArray(plan.posts) ? plan.posts : [];
  if (posts.length !== POSTS) problems.push(`exactly ${POSTS} posts (got ${posts.length})`);
  const byAgent = posts.some((post) => post?.author === 'agent' || (!plan.auto_plug_unavailable && post?.auto_plug?.author === 'agent'));
  const said = typeof plan.author_override?.said === 'string' && plan.author_override.said.trim() ? redactText(plan.author_override.said.trim()).text : null;
  if (byAgent && !said) problems.push('the owner\'s own words asking the agent to write instead of Threadify (author_override.said); without them Threadify writes every post');
  const now = Date.parse(plan.now ?? new Date().toISOString());
  const days = new Set();
  const rows = [];
  posts.forEach((post, index) => {
    const label = `post ${index + 1}`;
    const copy = casing(post, label);
    if (copy.problem) problems.push(copy.problem);
    if (post.fact_check !== 'PASS') problems.push(`${label}: the fact check (check-post PASS)`);
    if (post.validated !== true) problems.push(`${label}: validate_post passing on the exact post`);
    if (!post.feature_id || !post.angle_label) problems.push(`${label}: its feature and angle from the brief`);
    if (post.author === 'agent' && !post.draft_id) problems.push(`${label}: the draft_id from save_draft holding this exact text`);
    const template = post.template ?? {};
    const templateOk = Boolean(TEMPLATE_SOURCES[template.source]) && typeof template.skeleton === 'string' && /\{[^{}]+\}/.test(template.skeleton);
    if (!templateOk && !plan.template_unavailable) problems.push(`${label}: its outlier template (source and skeleton with {slots}), or "template_unavailable" with the reason`);
    const slot = post.slot ?? {};
    if (!ISO_WITH_OFFSET.test(slot.iso ?? '')) problems.push(`${label}: the time as ISO with the timezone offset, for example 2026-10-14T18:30:00+08:00`);
    else {
      if (Date.parse(slot.iso) <= now) problems.push(`${label}: a time in the future`);
      days.add(slot.iso.slice(0, 10));
    }
    if (!slot.local) problems.push(`${label}: the local time in words, for example "Wed 14 Oct, 6:30 pm"`);
    const plug = plugFor(plan, post);
    let plugLines = [`Auto Plug: none (${plan.auto_plug_unavailable})`];
    if (!plan.auto_plug_unavailable) {
      if (!plug) problems.push(`${label}: its Auto Plug, or "auto_plug_unavailable" with the reason`);
      else {
        const plugCopy = casing(plug, `${label} Auto Plug`);
        if (plugCopy.problem) problems.push(plugCopy.problem);
        if (!plug.destination) problems.push(`${label}: the offer destination for the Auto Plug`);
        if (plug.validated !== true) problems.push(`${label}: validate_post passing on the exact Auto Plug`);
        if (plug.plug_check !== 'PASS') problems.push(`${label}: the Auto Plug check (check-plug PASS)`);
        plugLines = [
          `Auto Plug, ${PLUG_DELAY_MINUTES} min after (${plug.author === 'agent' ? 'written by your agent at your request (not Threadify)' : plugCopy.line ?? 'unproven'}, plug check PASS): ${plug.final ?? ''}`,
          `Plug link: ${plug.destination ?? 'unknown'} (Threadify tracks it)`,
        ];
      }
    }
    rows.push([
      `${index + 1}) ${slot.local ?? 'unknown'} · ${slot.iso ?? 'unknown'} · ${post.angle_label ?? 'unknown'} · ${post.feature_id ?? '?'}: ${post.feature_name ?? 'unknown'}`,
      post.author === 'agent'
        ? `written by your agent at your request (not Threadify) · facts PASS · ${copy.line ?? 'unproven'}`
        : `written by Threadify (model ${post.model ?? 'not reported'}) · facts PASS · ${copy.line ?? 'unproven'}`,
      templateOk ? `template from ${TEMPLATE_SOURCES[template.source]}: ${template.skeleton}` : `template: none (${plan.template_unavailable})`,
      post.final ?? '',
      ...plugLines,
    ].join('\n'));
  });
  if (posts.length === POSTS && days.size !== POSTS) problems.push(`${POSTS} different days, one post per day`);
  if (problems.length) return { status: 'blocked', missing: problems };
  const card = [
    `Reverse Engineer My App · ${account} · ${plan.timezone}`,
    `App: ${app.name} · mapped from ${SOURCES[app.source]} · ${app.features} features with evidence · observed ${String(app.observed_at ?? 'unknown').slice(0, 10)}`,
    'Ownership: you said yes, you own this app or have written permission to analyse it',
    ...(byAgent ? [`Writer: you asked your agent to write these posts, not Threadify ("${said}")`] : []),
    '',
    rows.join('\n\n'),
    '',
    `Action: schedule these ${POSTS} posts with their Auto Plugs exactly as shown, one a day. Nothing publishes now.`,
    `Reply "yes" to schedule all ${POSTS}, or "no" to schedule nothing.`,
  ].join('\n');
  return { status: 'ready', card, card_sha256: sha256(card) };
}

/** The exact schedule_post arguments, only for "yes" to the unchanged card. */
export function scheduleArgs({ plan, card_sha256: cardHash, reply } = {}) {
  const built = buildCard(plan);
  if (built.status !== 'ready') return { status: 'blocked', missing: built.missing };
  if (built.card_sha256 !== cardHash) {
    return { status: 'card_changed', message: 'The plan changed after the card was shown. Show the new card and ask for a new "yes".' };
  }
  if (!isApproved(reply)) {
    return { status: 'not_approved', message: `Nothing was scheduled. Only the exact reply "yes" schedules the card. All ${POSTS} posts stay Threadify drafts.` };
  }
  const calls = plan.posts.map((post) => {
    const plug = plugFor(plan, post);
    const unchanged = post.original === post.final;
    return {
      // Threadify schedules a draft's stored text when given a draft_id, so
      // lowercased copy goes as exact text without the draft_id.
      // Agent-written copy was saved with save_draft holding the exact final text, so it always goes by draft_id.
      ...((unchanged || post.author === 'agent') && post.draft_id ? { draft_id: post.draft_id, content_type: 'short-form' } : { text: post.final }),
      scheduled_at: post.slot.iso,
      idempotency_key: `reverse-engineer-my-app-${sha256(JSON.stringify([handle(plan.account), post.slot.iso, post.final, plug?.final ?? null])).slice(0, 32)}`,
      ...(plug ? { auto_plug: { content: plug.final, trigger: 'time', delay_minutes: PLUG_DELAY_MINUTES } } : {}),
    };
  });
  return { status: 'approved', schedule_post: calls };
}

const SCHEDULED_STATES = new Set(['scheduled', 'pending', 'queued']);

/** Compare each get_schedule_status readback with its approved row. */
export function checkReadback({ plan, statuses } = {}) {
  const rows = (plan?.posts ?? []).map((post, index) => {
    const status = statuses?.[index] ?? null;
    const differences = [];
    const stored = status?.text ?? status?.post?.text ?? status?.posts?.[0]?.text ?? null;
    if (stored !== post.final) differences.push('text');
    const time = status?.scheduled_at ?? status?.scheduled_for ?? status?.scheduled_time ?? null;
    if (!time || Date.parse(time) !== Date.parse(post.slot?.iso)) differences.push('time');
    const plug = plugFor(plan, post);
    const echoed = status?.auto_plug?.content ?? null;
    if (plug && echoed !== plug.final) differences.push(echoed === null ? 'auto_plug_missing' : 'auto_plug_text');
    if (plug && status?.auto_plug && Number(status.auto_plug.delay_minutes) !== PLUG_DELAY_MINUTES) differences.push('auto_plug_delay');
    const providerStatus = status?.status ?? status?.state ?? null;
    // A failed or cancelled record can still echo the approved text and time; only a live schedule counts.
    if (!SCHEDULED_STATES.has(String(providerStatus ?? '').toLowerCase())) differences.push(`provider_status:${providerStatus ?? 'missing'}`);
    return { day: index + 1, status: differences.length ? 'MISMATCH' : 'MATCH', differences, provider_status: providerStatus };
  });
  const allMatch = rows.length === POSTS && rows.every((row) => row.status === 'MATCH');
  return { status: allMatch ? 'MATCH' : 'MISMATCH', rows };
}

/** Body-free receipt: hashes, ids and counts, never post text or the map. */
export function buildReceipt({ plan, card_sha256: cardHash, reply, scheduled_post_ids: scheduledIds = [], readback = null } = {}) {
  const approved = isApproved(reply);
  return {
    workflow_id: 'reverse-engineer-my-app',
    account_handle: handle(plan?.account),
    timezone: plan?.timezone ?? null,
    ownership: isApproved(plan?.ownership) ? 'owner_confirmed' : 'not_confirmed',
    app: { source: plan?.app?.source ?? null, features: plan?.app?.features ?? null, map_sha256: plan?.app?.map_sha256 ?? null, observed_at: plan?.app?.observed_at ?? null },
    posts: (plan?.posts ?? []).map((post, index) => {
      const plug = plugFor(plan, post);
      return {
        day: index + 1,
        feature_id: post.feature_id ?? null,
        angle: post.angle ?? null,
        model: post.model ?? 'not reported',
        draft_id: post.draft_id ?? null,
        author: post.author === 'agent' ? 'agent_at_owner_request' : 'threadify',
        template_source: post.template?.source ?? null,
        final_sha256: post.final ? sha256(post.final) : null,
        casing: post.original === post.final ? 'unchanged' : 'lowercased_guard_pass',
        fact_check: post.fact_check ?? null,
        auto_plug: plug?.final ? { final_sha256: sha256(plug.final), delay_minutes: PLUG_DELAY_MINUTES } : { none: plan?.auto_plug_unavailable ?? 'not decided' },
        scheduled_at: approved ? post.slot?.iso ?? null : null,
        scheduled_post_id: approved ? scheduledIds[index] ?? null : null,
        readback: readback?.rows?.[index]?.status ?? 'not read',
      };
    }),
    author_override: plan?.author_override?.said ? 'owner_requested' : 'none',
    card_sha256: cardHash ?? null,
    approval: approved ? 'yes' : 'not approved',
    action: approved ? 'schedule_seven_posts' : 'none',
    readback: readback?.status ?? 'not read',
    tool_path: 'threadify_mcp',
    fallback_state: plan?.auto_plug_unavailable ? 'auto_plug_unavailable' : 'not_used',
    raw_bodies_retained_in_receipt: false,
  };
}

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return JSON.parse(data);
}

async function main(argv) {
  const [command] = argv;
  const input = await readStdin();
  if (command === 'card') return buildCard(input);
  if (command === 'schedule') return scheduleArgs(input);
  if (command === 'readback') return checkReadback(input);
  if (command === 'receipt') return buildReceipt(input);
  throw new Error('usage: app-card.mjs card|schedule|readback|receipt < input.json');
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main(process.argv.slice(2)).then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!['ready', 'approved', 'MATCH'].includes(result.status) && result.workflow_id === undefined) process.exitCode = 1;
  }).catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: 'failed', error: error.message })}\n`);
    process.exitCode = 1;
  });
}
