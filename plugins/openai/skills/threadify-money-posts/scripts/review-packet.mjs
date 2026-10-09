#!/usr/bin/env node
// Local proof of review custody, not an automatic judge of factual truth.
import crypto from 'node:crypto';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { checkPost } from './casing-guard.mjs';

const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const urls = text => text.match(/https?:\/\/[^\s<>]+/g) ?? [];

export function reviewPacket(input) {
  const { packet, approval, validations, readbacks, previous, changes } = input ?? {};
  const now = Date.parse(input?.now ?? new Date().toISOString());
  if (!Number.isFinite(now)) throw new Error('valid review time required');
  if (!packet || !nonempty(packet.account) || !nonempty(packet.timezone) || !Array.isArray(packet.posts) || packet.posts.length !== 3) {
    throw new Error('packet needs account, timezone and exactly three posts');
  }
  const errors = [], hashes = [], actions = [];
  const ids = new Set();
  for (const post of packet.posts) {
    if (!nonempty(post.id) || ids.has(post.id)) errors.push('unique post id required');
    ids.add(post.id);
    if (!nonempty(post.scheduled_at) || !/(Z|[+-]\d\d:\d\d)$/.test(post.scheduled_at) || !Number.isFinite(Date.parse(post.scheduled_at))) errors.push(`${post.id}: explicit timestamp required`);
    for (const [kind, copy] of [['post', post.copy], ['plug', post.plug]]) {
      const label = `${post.id}:${kind}`;
      if (!copy || !nonempty(copy.original) || !nonempty(copy.final)) { errors.push(`${label}: original and final required`); continue; }
      if (copy.mode === 'unchanged') {
        if (copy.original !== copy.final) errors.push(`${label}: unauthorized edit`);
      } else if (copy.mode === 'lowercase') {
        if (!nonempty(copy.owner_request) || checkPost(copy).status !== 'PASS') errors.push(`${label}: casing guard failed or request missing`);
      } else if (copy.mode === 'owner-requested edit') {
        if (!nonempty(copy.owner_request)) errors.push(`${label}: owner request required`);
      } else errors.push(`${label}: invalid editing mode`);
      if (copy.final.length > 500) errors.push(`${label}: exceeds single-post limit`);
    }
    if (!post.copy || !post.plug) continue;
    if (!nonempty(post.destination) || !/^https:\/\//.test(post.destination)) errors.push(`${post.id}: destination required`);
    if (urls(post.copy.final ?? '').length) errors.push(`${post.id}: main post must not contain links`);
    if (JSON.stringify(urls(post.plug.final ?? '')) !== JSON.stringify([post.destination])) errors.push(`${post.id}: plug destination mismatch`);
    for (const field of ['facts', 'destination']) {
      const finding = post.review?.[field];
      if (finding?.status !== 'verified' || !nonempty(finding?.evidence)) errors.push(`${post.id}: ${field} review missing or unresolved`);
    }
    const hook = post.hook;
    if (!nonempty(hook?.adapted_opening) || !(post.copy.final ?? '').startsWith(hook.adapted_opening)) errors.push(`${post.id}: hook opening mismatch`);
    if (hook?.status === 'source-backed') {
      if (!nonempty(hook.source) || !nonempty(hook.original_opening) || !nonempty(hook.metric?.name) || !Number.isFinite(hook.metric?.value) || hook.metric.value < 0 || !nonempty(hook.limitations)) errors.push(`${post.id}: incomplete hook evidence`);
    } else if (hook?.status !== 'unproven' || !nonempty(hook.reason)) errors.push(`${post.id}: hook evidence or unproven reason required`);
    const textHash = hash(post.copy.final), plugHash = hash(post.plug.final);
    hashes.push({ id: post.id, post_sha256: textHash, plug_sha256: plugHash });
    // Always send reviewed text. Never resolve an earlier draft over edited copy.
    actions.push({ account: packet.account, content_type: 'short-form', text: post.copy.final,
      scheduled_at: post.scheduled_at, auto_plug: { content: post.plug.final, trigger: 'time', delay_minutes: 15 },
      idempotency_key: hash([packet.account, post.scheduled_at, textHash, plugHash]) });
  }
  // Optional exact scope check for a correction to a previous packet. Only
  // declared string replacements may differ; other bytes and fields stay locked.
  if (previous) {
    const expected = structuredClone(previous);
    if (!Array.isArray(changes) || !changes.length) errors.push('revision changes required');
    for (const change of changes ?? []) {
      const fields = change.path?.split('.') ?? [];
      let target = expected;
      for (const field of fields.slice(0, -1)) target = target?.[field];
      const field = fields.at(-1), value = target?.[field];
      if (typeof value !== 'string' || !nonempty(change.before) || typeof change.after !== 'string' || value.split(change.before).length !== 2) {
        errors.push('revision must identify one exact text span'); continue;
      }
      target[field] = value.replace(change.before, change.after);
    }
    if (JSON.stringify(expected) !== JSON.stringify(packet)) errors.push('revision changed undeclared fields');
  }
  const packetHash = hash(packet);
  if (approval && (approval.reply !== 'yes' || approval.packet_sha256 !== packetHash)) errors.push('approval does not match current packet');
  if (approval) {
    for (const item of hashes) for (const kind of ['post', 'plug']) {
      if (!validations?.some(v => v.id === item.id && v.kind === kind && v.account === packet.account && v.sha256 === item[`${kind}_sha256`] && v.valid === true && Number.isFinite(Date.parse(v.validated_at)) && now - Date.parse(v.validated_at) >= 0 && now - Date.parse(v.validated_at) < 300000)) errors.push(`${item.id}:${kind}: exact provider validation required`);
    }
  }
  if (readbacks) {
    if (!approval) errors.push('readback requires approved packet');
    if (!Array.isArray(readbacks) || readbacks.length !== 3) errors.push('three readbacks required');
    for (const [index, action] of actions.entries()) {
      const saved = Array.isArray(readbacks) ? readbacks.find(r => r.id === packet.posts[index].id) : null;
      if (!saved || saved.status !== 'scheduled' || saved.account !== action.account || saved.text !== action.text || Date.parse(saved.scheduled_at) !== Date.parse(action.scheduled_at) || saved.auto_plug?.content !== action.auto_plug.content || saved.auto_plug?.trigger !== 'time' || saved.auto_plug?.delay_minutes !== 15) errors.push(`${packet.posts[index].id}: readback mismatch`);
    }
  }
  return { status: errors.length ? 'FAIL' : 'PASS', errors, packet_sha256: packetHash, hashes,
    schedule_args: !errors.length && approval ? actions : [],
    proof_state: errors.length ? 'blocked' : readbacks ? 'scheduled_verified' : approval ? 'approved' : 'review_ready' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    let data = ''; for await (const chunk of process.stdin) data += chunk;
    const result = reviewPacket(JSON.parse(data));
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    if (result.status !== 'PASS') process.exitCode = 1;
  } catch (error) { process.stderr.write(JSON.stringify({ status: 'FAIL', error: error.message }) + '\n'); process.exitCode = 1; }
}
