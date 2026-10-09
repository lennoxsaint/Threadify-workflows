#!/usr/bin/env node
// Private state is the boundary: providers supply evidence, never implicit approval.
import fs from 'node:fs';
import { lowercaseExceptProperNouns, checkText } from './casing-guard.mjs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const models = JSON.parse(fs.readFileSync(new URL('../references/generation-models.json', import.meta.url))).fallback_chain;
export const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
export function revision(state) {
  return hash({ account: state.account, slots: state.slots.map(({ id, time, parts, plug, status }) => ({ id, time, parts, plug, held: status === 'held' })) });
}
export function transition(previous, event) {
  const s = structuredClone(previous);
  if (event.type === 'init') {
    requireThat(!previous, 'state_exists');
    requireThat(event.account && event.expires && event.slots?.length, 'invalid_init');
    const state = { version: 1, account: event.account, expires: event.expires, slots: event.slots.map(x => ({ ...x, status: 'planned', attempts: [] })), history: [], approval: null };
    requireThat(new Set(state.slots.map(x => x.id)).size === state.slots.length, 'duplicate_slot');
    return state;
  }
  requireThat(s, 'missing_state');
  const slot = s.slots.find(x => x.id === event.slot);
  const oldHash = revision(s);
  if (['edit', 'casing', 'hold', 'assign'].includes(event.type)) requireThat(!slot?.schedule, 'schedule_already_started');
  if (event.type === 'assign') {
    requireThat(slot?.status === 'planned' || slot?.status === 'held', 'slot_not_assignable');
    requireThat(!slot.original, 'successful_slot_exists');
    const a = event.assignment;
    requireThat(a?.source?.url && a.source.text && a.source.performance && a.source.observed_at && a.template && a.adaptation, 'missing_source');
    for (const field of ['angle', 'mechanism', 'proof']) {
      requireThat(a[field] && !s.slots.some(x => x.id !== slot.id && x.assignment?.[field] === a[field]), `duplicate_or_missing_${field}`);
    }
    slot.assignment = a; slot.status = 'assigned';
  } else if (event.type === 'hold') {
    requireThat(slot && event.reason, 'invalid_hold'); slot.status = 'held'; slot.reason = event.reason;
  } else if (event.type === 'begin') {
    requireThat(slot?.assignment && ['assigned', 'retry'].includes(slot.status), 'slot_not_generatable');
    const model = models[slot.attempts.length];
    requireThat(slot.attempts.length < 2 && event.marker && !s.slots.some(x => x.attempts.some(a => a.marker === event.marker)), 'invalid_attempt');
    slot.attempts.push({ marker: event.marker, requested_model: model, started_at: event.at, status: 'pending' }); slot.status = 'generating';
  } else if (event.type === 'result') {
    requireThat(slot?.status === 'generating', 'no_pending_attempt');
    requireThat(event.draft_id && event.parts?.length && event.parts.every(x => typeof x === 'string'), 'invalid_result');
    Object.assign(slot.attempts.at(-1), { status: 'saved', draft_id: event.draft_id, reported_model: event.model ?? 'not reported' });
    slot.original = [...event.parts]; slot.parts = [...event.parts]; slot.draft_id = event.draft_id; slot.plug = event.plug ?? null; slot.status = 'ready';
  } else if (event.type === 'failure') {
    requireThat(slot?.status === 'generating', 'no_pending_attempt');
    Object.assign(slot.attempts.at(-1), { status: 'failed', error: event.error, category: event.category });
    slot.status = event.category === 'timeout' ? 'reconcile' : ['provider', 'model_unavailable'].includes(event.category) && slot.attempts.length === 1 ? 'retry' : 'held';
  } else if (event.type === 'recover') {
    requireThat(slot?.status === 'reconcile', 'not_reconciling');
    const attempt = slot.attempts.at(-1);
    // Adapter must full-read each candidate. Exact persisted marker plus account, never fuzzy title.
    const matches = (event.drafts ?? []).filter(d => d.account === s.account && d.marker === attempt.marker && Date.parse(d.created_at) >= Date.parse(attempt.started_at));
    if (event.complete && matches.length === 1) {
      slot.status = 'generating';
      return transition(s, { ...matches[0], type: 'result', slot: slot.id });
    }
    slot.status = event.complete && matches.length === 0 && slot.attempts.length === 1 ? 'retry' : 'held';
    attempt.recovery = { complete: event.complete === true, matches: matches.length };
  } else if (event.type === 'edit') {
    requireThat(slot?.status === 'ready' && !slot.verbatim && event.instruction && event.edits?.length, 'invalid_edit');
    const before = structuredClone(slot);
    // Offsets refer to the current revision. Reject stale, overlapping or out-of-scope selections.
    const edits = [...event.edits].sort((a,b) => b.part-a.part || b.start-a.start);
    let last;
    for (const edit of edits) {
      const text = slot.parts[edit.part];
      requireThat(typeof text === 'string' && Number.isInteger(edit.start) && Number.isInteger(edit.end) && edit.start >= 0 && edit.end >= edit.start && edit.end <= text.length && text.slice(edit.start, edit.end) === edit.expected && typeof edit.replacement === 'string', 'stale_selection');
      requireThat(!last || last.part !== edit.part || edit.end <= last.start, 'overlapping_selection');
      requireThat(event.scope !== 'hooks' || (edit.part === 0 && edit.end <= event.hook_end), 'outside_hook');
      slot.parts[edit.part] = text.slice(0, edit.start) + edit.replacement + text.slice(edit.end); last = edit;
    }
    s.history.push({ instruction: event.instruction, before, after: structuredClone(slot), prior_hash: oldHash });
  } else if (event.type === 'casing') {
    requireThat(slot?.status === 'ready', 'not_ready');
    requireThat(event.choice === 'lowercase' || event.choice === 'original', 'invalid_casing_choice');
    const before = [...slot.parts];
    const after = slot.verbatim || event.choice === 'original' ? before : before.map(x => lowercaseExceptProperNouns(x, event.keep ?? []));
    const checks = before.map((x,i) => checkText(x, after[i], event.keep ?? []));
    requireThat(checks.every(x => x.status === 'PASS'), 'casing_failed');
    const plugBefore = slot.plug;
    const plugAfter = typeof plugBefore === 'string' && !slot.verbatim && event.choice === 'lowercase' ? lowercaseExceptProperNouns(plugBefore, event.keep ?? []) : plugBefore;
    if (typeof plugBefore === 'string') requireThat(checkText(plugBefore, plugAfter, event.keep ?? []).status === 'PASS', 'plug_casing_failed');
    slot.parts = after; slot.plug = plugAfter; s.history.push({ type: 'casing', slot: slot.id, before, after, checks, plugBefore, plugAfter });
  } else if (event.type === 'repost') {
    requireThat(slot?.status === 'planned' && event.parts?.length && event.source_id && event.eligible === true, 'invalid_repost');
    slot.parts = [...event.parts]; slot.original = [...event.parts]; slot.verbatim = true; slot.source_id = event.source_id; slot.status = 'ready';
  } else if (event.type === 'approve') {
    requireThat(event.hash === revision(s) && Date.parse(event.at) < Date.parse(s.expires), 'stale_approval');
    requireThat(s.slots.every(x => ['ready', 'held'].includes(x.status)), 'unfinished_batch');
    s.approval = { hash: event.hash, at: event.at }; return s;
  } else if (event.type === 'schedule') {
    requireThat(slot?.status === 'ready' && s.approval?.hash === revision(s) && Date.parse(event.at) < Date.parse(s.expires), 'not_approved');
    requireThat(event.account === s.account && event.calendar_complete === true, 'identity_or_calendar');
    const time = Date.parse(slot.time);
    requireThat(time - Date.parse(event.at) >= 15 * 60000 && !(event.occupied ?? []).some(t => Math.abs(Date.parse(t)-time) < 90*60000), 'occupied_or_past');
    requireThat(!slot.schedule || slot.schedule.status === 'pending', 'schedule_already_resolved');
    slot.schedule = { status: 'pending', key: hash({ approval: s.approval.hash, slot: slot.id }), parts: [...slot.parts], plug: slot.plug, time: slot.time };
  } else if (event.type === 'readback') {
    requireThat(slot?.schedule?.status === 'pending', 'no_pending_schedule');
    const match = event.account === s.account && event.time === slot.time && hash(event.parts) === hash(slot.parts) && hash(event.plug ?? null) === hash(slot.plug ?? null) && event.id && event.list_verified === true;
    slot.schedule.status = match ? 'verified' : 'mismatch'; slot.schedule.receipt = event;
  } else throw new Error('unknown_event');
  if (revision(s) !== oldHash) s.approval = null;
  return s;
}
export function persist(file, event) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const lock = `${file}.lock`; const fd = fs.openSync(lock, 'wx', 0o600);
  try {
    const previous = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
    if (event.expected_hash) requireThat(event.expected_hash === revision(previous), 'concurrent_revision');
    const state = transition(previous, event); const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(state, null, 2)+'\n', { mode: 0o600 }); fs.renameSync(temp, file); return state;
  } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const state = persist(process.argv[2], JSON.parse(fs.readFileSync(0, 'utf8'))); console.log(JSON.stringify({ hash: revision(state), state })); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
