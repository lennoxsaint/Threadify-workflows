import { randomUUID } from 'node:crypto';
import { readState, updateState } from '../creator/store.mjs';
import { reviewHash } from '../creator/review.mjs';

export const CLIENTS = ['codex', 'claude', 'cursor', 'gemini', 'openclaw', 'hermes'];
export const PHASES = ['runtime', 'connection', 'discovery', 'summary', 'brain', 'offer', 'vault', 'voice', 'week', 'routine'];
const requiredFacts = ['audience', 'voice', 'topics', 'outcome'];
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const date = (value) => text(value) && Number.isFinite(Date.parse(value));
const nowISO = () => new Date().toISOString();

function session(payload) {
  assert(payload?.kind === 'threadify-setup.v1', 'This directory is not a Threadify setup session.');
  return payload;
}
function evidence(input, account, now) {
  assert(input?.kind === 'observed' && text(input.reference) && date(input.observed_at), 'Observed evidence reference and time required; fixtures are not live proof.');
  assert(Date.parse(input.observed_at) <= Date.parse(now) + 60_000, 'Evidence cannot be from the future.');
  if (account) assert(input.account === account, 'Evidence belongs to a different account.');
  return structuredClone(input);
}
function currentSummary(s) {
  assert(s.summary?.confirmed_hash === reviewHash(s.summary.facts), 'Confirm the current setup summary first.');
}
function checkPreflight(s, p, now) {
  currentSummary(s);
  assert(p?.account === s.account && p.timezone === s.summary.facts.timezone, 'Account or timezone changed.');
  assert(date(p.checked_at) && Date.parse(now) - Date.parse(p.checked_at) >= 0 && Date.parse(now) - Date.parse(p.checked_at) <= 300_000, 'Fresh preflight required.');
  assert(p.connection_ok === true && p.entitled === true && p.facts_current === true && p.allowance_ok === true, 'Connection, entitlement, facts and allowance must all pass.');
  assert(p.calendar_read === true && Array.isArray(p.occupied_instants), 'Read the calendar before planning missing slots.');
}
export function setupStatus(s, now = nowISO()) {
  session(s);
  const completed = PHASES.filter((p) => s.completed[p]);
  const needs = PHASES.filter((p) => !s.completed[p]);
  return { session_id: s.id, client: s.client, version: s.version, account: s.account,
    completed, next: needs[0] ?? null, missing: needs, paused: s.paused,
    connected: Boolean(s.completed.connection), brain_ready: Boolean(s.completed.brain),
    first_week_prepared: Boolean(s.completed.week), posts_scheduled: s.week?.scheduled_count ?? 0,
    recurring_routine_verified: Boolean(s.completed.routine),
    ready: needs.length === 0 && !s.paused && !s.pending,
    mode: s.permission?.mode ?? 'unselected', next_run: s.routine?.next_run ?? null,
    device_must_stay_on: s.routine?.device_must_stay_on ?? null,
    pending: s.pending, observed_at: now,
    evidence_limit: 'Recorded host observations; verify against the provider before making a fresh live claim.' };
}
export async function startSetup(root, input, now = nowISO()) {
  assert(CLIENTS.includes(input.client), 'Choose a supported client.');
  assert(/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/.test(input.version ?? ''), 'Pin the verified workflow version.');
  assert(text(input.install_receipt), 'Canonical installer receipt required.');
  const existing = await readState(root);
  if (existing.payload) {
    const s = session(existing.payload);
    assert(s.client === input.client && s.version === input.version, 'Existing session is pinned to another client/version; resume it.');
    return { revision: existing.revision, ...setupStatus(s, now) };
  }
  const result = await updateState(root, 0, () => ({ kind: 'threadify-setup.v1', id: randomUUID(),
    client: input.client, version: input.version, install_receipt: input.install_receipt,
    account: null, created_at: now, completed: {}, observations: {}, history: [], paused: false, pending: null }));
  return { revision: result.revision, ...setupStatus(result.payload, now) };
}

export async function resumeSetup(root, revision, input, now = nowISO()) {
  const result = await updateState(root, revision, (payload) => {
    const s = session(payload);
    const event = input.event;
    assert(text(event), 'A named resume event is required.');
    if (event === 'runtime') {
      const e = evidence(input.evidence, null, now);
      assert(e.client === s.client && e.workflow_discovered === true && e.tools_callable === true, 'Verify discovery and callable tools in the actual client.');
      s.completed.runtime = true; s.observations.runtime = e;
    } else if (event === 'connection') {
      assert(s.completed.runtime, 'Verify runtime first.');
      assert(text(input.account), 'Explicit account required.');
      assert(!s.account || s.account === input.account, 'Account cannot change inside a customer session. Start a separate session.');
      const e = evidence(input.evidence, input.account, now);
      assert(e.authenticated === true && e.entitled === true && e.threads_connected === true && e.agent_connected === true, 'Signup, entitlement, Threads and agent connections must be verified.');
      s.account = input.account; s.completed.connection = true; s.observations.connection = e;
    } else if (event === 'discovery') {
      assert(s.completed.connection, 'Verify account before customer discovery.');
      assert(input.consent === true && Array.isArray(input.roots) && input.roots.length > 0 && input.roots.every(text), 'Approved search roots required.');
      assert(Array.isArray(input.exclude) && input.exclude.every(text), 'Explicit exclusion list required.');
      s.discovery = { roots: input.roots, exclude: input.exclude, confirmed_at: now };
      s.completed.discovery = true;
    } else if (event === 'summary') {
      assert(s.completed.discovery, 'Approve discovery scope first.');
      const f = input.facts;
      assert(f && requiredFacts.every((k) => text(f[k])), 'Audience, voice, topics and outcome required.');
      assert(text(f.timezone), 'Timezone required.');
      new Intl.DateTimeFormat('en', { timeZone: f.timezone });
      assert(Number.isInteger(f.posts_per_day) && f.posts_per_day >= 1 && f.posts_per_day <= 5, 'Choose 1–5 posts per day.');
      assert(Array.isArray(f.times) && f.times.length === f.posts_per_day && new Set(f.times).size === f.times.length && f.times.every((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)), 'One distinct HH:MM time per daily post required.');
      assert(Array.isArray(input.sources) && input.sources.length > 0 && input.sources.every((x) => text(x.reference) && text(x.supports)), 'Source references required (customer answers are valid sources).');
      const hash = reviewHash(f);
      assert(input.confirmed_hash === hash && text(input.confirmation), 'Customer must confirm the exact displayed summary hash.');
      if (s.summary && s.summary.confirmed_hash !== hash) {
        assert(!s.pending, 'Reconcile pending work before changing the summary.');
        s.history.push({ summary: s.summary, replaced_at: now });
        for (const p of PHASES.slice(4)) delete s.completed[p];
        s.permission = null; s.routine = null; s.week = null; s.paused = true;
      }
      s.summary = { facts: f, sources: input.sources, confirmed_hash: hash, confirmed_at: now };
      s.completed.summary = true;
    } else if (['brain', 'offer', 'vault', 'voice'].includes(event)) {
      currentSummary(s);
      const index = PHASES.indexOf(event);
      assert(s.completed[PHASES[index - 1]], 'Finish the previous setup phase first.');
      const e = evidence(input.evidence, s.account, now);
      assert(e.summary_hash === s.summary.confirmed_hash, 'Evidence must match the confirmed summary.');
      if (event === 'brain') assert(e.processing_complete === true && e.retrieval_verified === true && e.durable_voice_verified === true, 'Verify processing, retrieval and durable voice instructions.');
      if (event === 'offer') assert(e.confirmed_none === true || (e.readback_verified === true && Array.isArray(e.offer_ids) && e.offer_ids.length > 0), 'Confirm no offer, or read back the saved offers.');
      if (event === 'vault') assert(e.selection_approved === true && e.readback_verified === true, 'Approved selection and Vault readback required.');
      if (event === 'voice') assert(e.sample_approved === true && text(e.sample_hash), 'Approve the exact voice sample.');
      s.completed[event] = true; s.observations[event] = e;
    } else if (event === 'permission') {
      assert(s.completed.voice, 'Approve the voice sample before choosing ongoing permissions.');
      assert(['reviewed', 'automatic'].includes(input.mode) && input.confirmed === true, 'Customer must choose the ongoing mode.');
      assert(!s.pending, 'Reconcile pending work before changing permission.');
      s.permission = { id: randomUUID(), mode: input.mode, account: s.account,
        summary_hash: s.summary.confirmed_hash, action: 'schedule', window_days: 7,
        confirmed_at: now, until: 'paused_or_changed', confirmation: input.confirmation };
      assert(text(input.confirmation), 'Record the customer permission reference.');
      delete s.completed.routine; s.routine = null; s.paused = false;
    } else if (event === 'week') {
      assert(s.completed.voice && s.permission, 'Approve voice and choose a mode first.');
      const e = evidence(input.evidence, s.account, now);
      assert(e.summary_hash === s.summary.confirmed_hash && e.timezone === s.summary.facts.timezone, 'Week must match the confirmed setup.');
      const occupied = e.existing_occupied_count ?? 0;
      assert(Number.isInteger(occupied) && occupied >= 0 && occupied <= 7 * s.summary.facts.posts_per_day, 'Invalid existing occupied count.');
      assert(occupied === 0 || e.existing_slots_readback_verified === true, 'Read back preserved existing slots.');
      assert(e.days === 7 && Number.isInteger(e.draft_count) && e.draft_count >= 0 && e.draft_count + occupied === 7 * s.summary.facts.posts_per_day && e.content_verified === true, 'Seven days of actual verified drafts or preserved existing slots required.');
      assert(Number.isInteger(e.scheduled_count) && e.scheduled_count >= 0 && e.scheduled_count <= e.draft_count, 'Invalid scheduled count.');
      assert(e.scheduled_count === 0 || e.calendar_readback_verified === true, 'Scheduled posts need matching calendar readback.');
      assert(s.permission.mode !== 'automatic' || e.scheduled_count === e.draft_count, 'Automatic first week must have schedule readback for every prepared post.');
      s.week = e; s.completed.week = true;
    } else if (event === 'routine' || event === 'routine-configured') {
      assert(s.completed.week && s.permission && !s.paused, 'Complete the week and choose permissions first.');
      const e = evidence(input.evidence, s.account, now);
      assert(e.permission_id === s.permission.id && e.client === s.client, 'Routine must bind the selected client and permission.');
      assert(text(e.job_id) && e.persisted === true, 'Read back a persistent job.');
      if (event === 'routine') {
        assert(e.real_run_verified === true && text(e.run_id), 'Read back one real invocation.');
        assert(s.history.some((entry) => entry.run?.id === e.local_run_id && ['verified', 'confirmed_no_actions'].includes(entry.evidence?.outcome)), 'Reconcile the first local routine run before marking verified.');
      }
      assert(date(e.next_run) && Date.parse(e.next_run) > Date.parse(now) && typeof e.device_must_stay_on === 'boolean' && text(e.pause_command), 'Next run, uptime requirement and pause control required.');
      assert(['native', 'os-scheduler'].includes(e.runner), 'Session-only loops cannot establish durable autopilot.');
      s.routine = e; if (event === 'routine') s.completed.routine = true;
    } else if (event === 'begin-run' || event === 'begin-batch') {
      assert(s.permission && s.completed.voice && !s.paused && !s.pending, 'Routine paused, unverified, or another run needs reconciliation.');
      if (event === 'begin-run') {
        assert(s.routine?.persisted === true, 'Routine is unverified.');
        assert(s.routine.permission_id === s.permission.id, 'Reconfigure the routine for the current permission.');
      }
      checkPreflight(s, input.preflight, now);
      s.pending = { id: randomUUID(), started_at: now, permission_id: s.permission.id, phase: event === 'begin-run' ? 'running' : 'first_week' };
    } else if (event === 'finish-run') {
      assert(s.pending?.id === input.run_id, 'Reconcile the exact pending run.');
      const e = evidence(input.evidence, s.account, now);
      assert(['verified', 'confirmed_no_actions', 'blocked'].includes(e.outcome), 'Unknown results remain pending until reconciled.');
      s.history.push({ run: s.pending, evidence: e }); s.pending = null;
      if (e.outcome === 'blocked') { s.paused = true; s.blocker = e.reason; }
    } else if (event === 'pause') {
      s.paused = true;
    } else if (event === 'unpause') {
      assert(s.completed.routine && !s.pending, 'Reconcile and verify the routine before resuming.');
      checkPreflight(s, input.preflight, now); s.paused = false;
    } else throw new Error(`Unknown setup event: ${event}`);
    s.updated_at = now;
    return s;
  });
  return { revision: result.revision, ...setupStatus(result.payload, now),
    permission: result.payload.permission ?? null };
}
export async function inspectSetup(root) {
  const state = await readState(root);
  return { revision: state.revision, ...setupStatus(session(state.payload)) };
}
export async function verifySetup(root) {
  const state = await readState(root);
  const report = setupStatus(session(state.payload));
  return { revision: state.revision, ...report, result: report.ready ? 'recorded_checks_complete' : 'incomplete' };
}
