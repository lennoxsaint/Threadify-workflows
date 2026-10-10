#!/usr/bin/env node
// Watch Any Creator: the one approval card, the gate behind it, the
// readback check and the body-free receipt.
//
//   node watch-card.mjs card      < plan.json
//   node watch-card.mjs schedule  < {"plan": {...}, "card_sha256": "...", "reply": "yes"}
//   node watch-card.mjs readback  < {"plan": {...}, "status": <get_schedule_status result>}
//   node watch-card.mjs receipt   < {"plan": {...}, "card_sha256", "reply", "scheduled_post_id", "readback"}
//
// The card refuses (status "blocked") while anything is unproven: the thread
// draft read back, the post validated, the casing guard on any lowercased
// copy, and a time with a timezone offset. `schedule` returns the
// schedule_post arguments only for the exact reply "yes" to that exact card.
// Output is JSON on stdout. Exit 0 when the step may continue, 1 otherwise.
// No dependencies and no network: Node 18+ only.
import crypto from 'node:crypto';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { checkText } from './casing-guard.mjs';

const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const PLUG_DELAY_MINUTES = 15;
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
const handle = (value) => (value ? `@${String(value).trim().replace(/^@/, '')}` : null);
const count = (value) => (Number.isInteger(value) ? value.toLocaleString('en-US') : 'unknown');

/** unchanged, or lowercased with the guard proof; anything else fails. */
function casing(copy, label) {
  if (!copy || typeof copy.original !== 'string' || typeof copy.final !== 'string' || !copy.final.trim()) {
    return { problem: `${label}: Threadify's original and final text are both required` };
  }
  if (copy.original === copy.final) return { line: 'unchanged' };
  const guard = checkText(copy.original, copy.final, copy.keep);
  if (guard.status !== 'PASS') return { problem: `${label}: the casing guard failed (${guard.reasons.join(', ')}); show the original unchanged` };
  return { line: 'lowercased, casing guard PASS: lower(original) == lower(final)' };
}

/** Build the one approval card, or say exactly what blocks it. */
export function buildCard(plan = {}) {
  const problems = [];
  const account = handle(plan.account);
  if (!account) problems.push('the Threads account handle from get_connection_defaults');
  if (!plan.timezone) problems.push('the account timezone');
  const watched = plan.watched ?? {};
  if (!handle(watched.creator) || !Number.isInteger(watched.videos)) problems.push('the creator and the verified video count from the analysis');
  const thread = plan.thread ?? {};
  if (!thread.draft_id) problems.push('the thread draft_id from generate_content');
  if (thread.readback !== 'match') problems.push('the thread draft read back with get_draft and matching');
  if (thread.structure !== 'PASS') problems.push('the thread structure check (check-thread PASS)');
  const post = casing(plan.post, 'post');
  if (post.problem) problems.push(post.problem);
  if (plan.post && plan.post.validated !== true) problems.push('validate_post passing on the exact post');
  let plugLines;
  if (plan.auto_plug && plan.auto_plug.unavailable) {
    plugLines = [`Auto Plug: none (${plan.auto_plug.unavailable})`];
  } else if (plan.auto_plug) {
    const plug = casing(plan.auto_plug, 'Auto Plug');
    if (plug.problem) problems.push(plug.problem);
    if (!plan.auto_plug.destination) problems.push('the offer destination for the Auto Plug');
    if (plan.auto_plug.validated !== true) problems.push('validate_post passing on the exact Auto Plug');
    plugLines = [
      `Auto Plug, ${PLUG_DELAY_MINUTES} min after (${plug.line ?? 'unproven'}):`,
      plan.auto_plug.final ?? '',
      `Plug link: ${plan.auto_plug.destination ?? 'unknown'} (Threadify tracks it)`,
    ];
  } else {
    problems.push('the Auto Plug decision: an approved plug, or { "unavailable": "<reason>" }');
  }
  const slot = plan.slot ?? {};
  if (!ISO_WITH_OFFSET.test(slot.iso ?? '')) problems.push('the time as ISO with the timezone offset, for example 2026-10-11T18:30:00+08:00');
  else if (Date.parse(slot.iso) <= Date.parse(plan.now ?? new Date().toISOString())) problems.push('a time in the future');
  if (!slot.local) problems.push('the local time in words, for example "Sun 11 Oct, 6:30 pm"');
  if (problems.length) return { status: 'blocked', missing: problems };
  const card = [
    `Watch Any Creator · ${account} · ${plan.timezone}`,
    `Watched: ${handle(watched.creator)} · ${count(watched.videos)} videos (${count(watched.long)} long-form, ${count(watched.shorts)} Shorts) · ${count(watched.transcripts)} transcripts · observed ${String(watched.observed_at ?? 'unknown').slice(0, 10)}`,
    `Thread: ${count(thread.post_count)} posts saved as a Threadify draft, read back, not scheduled`,
    `Post, written by Threadify (${post.line}):`,
    plan.post.final,
    ...plugLines,
    `When: ${slot.local} · ${slot.iso} (${plan.timezone}) · ${slot.source ?? 'next open best-time window'}`,
    'Action: schedule this one post exactly as shown. Nothing publishes now. The thread stays a draft.',
    'Reply "yes" to schedule it, or "no" to schedule nothing.',
  ].join('\n');
  return { status: 'ready', card, card_sha256: sha256(card) };
}

/** Only the exact reply "yes" approves. "ok", "sure", "yes please" and silence do not. */
export function isApproved(reply) {
  return typeof reply === 'string' && reply.trim().toLowerCase() === 'yes';
}

/** The exact schedule_post arguments, only for "yes" to the unchanged card. */
export function scheduleArgs({ plan, card_sha256: cardHash, reply } = {}) {
  const built = buildCard(plan);
  if (built.status !== 'ready') return { status: 'blocked', missing: built.missing };
  if (built.card_sha256 !== cardHash) {
    return { status: 'card_changed', message: 'The plan changed after the card was shown. Show the new card and ask for a new "yes".' };
  }
  if (!isApproved(reply)) return { status: 'not_approved', message: 'Nothing was scheduled. Only the exact reply "yes" schedules the card. The post and the thread stay Threadify drafts.' };
  const unchanged = plan.post.original === plan.post.final;
  const plug = plan.auto_plug && !plan.auto_plug.unavailable ? plan.auto_plug.final : null;
  const args = {
    // Threadify schedules a draft's stored text when given a draft_id, so
    // lowercased copy goes as exact text without the draft_id.
    ...(unchanged && plan.post.draft_id ? { draft_id: plan.post.draft_id, content_type: 'short-form' } : { text: plan.post.final }),
    scheduled_at: plan.slot.iso,
    idempotency_key: `watch-any-creator-${sha256(JSON.stringify([handle(plan.account), plan.slot.iso, plan.post.final, plug])).slice(0, 32)}`,
    ...(plug ? { auto_plug: { content: plug, trigger: 'time', delay_minutes: PLUG_DELAY_MINUTES } } : {}),
  };
  return { status: 'approved', schedule_post: args };
}

/** Compare the get_schedule_status readback with the approved card. */
export function checkReadback({ plan, status } = {}) {
  const differences = [];
  const stored = status?.text ?? status?.post?.text ?? status?.posts?.[0]?.text ?? null;
  if (stored !== plan?.post?.final) differences.push('text');
  const time = status?.scheduled_at ?? status?.scheduled_for ?? status?.scheduled_time ?? null;
  if (!time || Date.parse(time) !== Date.parse(plan?.slot?.iso)) differences.push('time');
  const plug = plan?.auto_plug && !plan.auto_plug.unavailable ? plan.auto_plug.final : null;
  const echoed = status?.auto_plug?.content ?? null;
  if (plug && echoed !== plug) differences.push(echoed === null ? 'auto_plug_missing' : 'auto_plug_text');
  const state = status?.status ?? status?.state ?? null;
  return { status: differences.length ? 'MISMATCH' : 'MATCH', differences, provider_status: state };
}

/** Body-free receipt: hashes, ids and counts, never post text or transcripts. */
export function buildReceipt({ plan, card_sha256: cardHash, reply, scheduled_post_id: scheduledId = null, readback = null, rule_ids: ruleIds = [] } = {}) {
  const plug = plan?.auto_plug && !plan.auto_plug.unavailable ? plan.auto_plug.final : null;
  return {
    workflow_id: 'watch-any-creator',
    account_handle: handle(plan?.account),
    timezone: plan?.timezone ?? null,
    creator: handle(plan?.watched?.creator),
    watched: {
      videos: plan?.watched?.videos ?? null,
      long: plan?.watched?.long ?? null,
      shorts: plan?.watched?.shorts ?? null,
      transcripts: plan?.watched?.transcripts ?? null,
      observed_at: plan?.watched?.observed_at ?? null,
      provider: plan?.watched?.provider ?? null,
    },
    rule_ids: ruleIds,
    thread: { draft_id: plan?.thread?.draft_id ?? null, post_count: plan?.thread?.post_count ?? null, thread_sha256: plan?.thread?.thread_sha256 ?? null, scheduled: false },
    post: {
      draft_id: plan?.post?.draft_id ?? null,
      final_sha256: plan?.post?.final ? sha256(plan.post.final) : null,
      casing: plan?.post ? (plan.post.original === plan.post.final ? 'unchanged' : 'lowercased_guard_pass') : null,
    },
    auto_plug: plug ? { final_sha256: sha256(plug), delay_minutes: PLUG_DELAY_MINUTES } : { none: plan?.auto_plug?.unavailable ?? 'not decided' },
    card_sha256: cardHash ?? null,
    approval: isApproved(reply) ? 'yes' : 'not approved',
    action: isApproved(reply) ? 'schedule_one_post' : 'none',
    scheduled_post_id: scheduledId,
    scheduled_at: isApproved(reply) ? plan?.slot?.iso ?? null : null,
    readback: readback?.status ?? 'not read',
    readback_differences: readback?.differences ?? [],
    tool_path: 'threadify_mcp',
    fallback_state: 'not_used',
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
  throw new Error('usage: watch-card.mjs card|schedule|readback|receipt < input.json');
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
