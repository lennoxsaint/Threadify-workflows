import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomBytes } from 'node:crypto';

export const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const requireThat = (ok, message) => { if (!ok) throw new Error(message); };
const text = value => typeof value === 'string';
const time = value => { const n = Date.parse(value); requireThat(Number.isFinite(n), 'invalid_timestamp'); return n; };
const inFlight = item => ['uncertain', 'queued'].includes(item.state);
const terminal = item => ['published', 'skipped', 'unavailable'].includes(item.state);
export const defaultRoot = () => path.join(os.homedir(), '.local', 'share', 'threadify-workflows', 'inbound');
export const normalizeAccount = account => {
  requireThat(text(account) && /^@?[a-zA-Z0-9._]+$/.test(account), 'invalid_account');
  return '@' + account.replace(/^@/, '').toLowerCase();
};
// A Threads native source may surface in more than one lane; never queue it twice.
export const itemKey = (account, lane, sourceId) => hash([normalizeAccount(account), sourceId]);
export function editorSurface(capabilities = {}) {
  return capabilities.create === true && capabilities.stableIdentity === true && capabilities.readback === true ? 'native' : 'local';
}
function groupedIds(ids, items) {
  const ordered = [...ids].sort((a,b) => time(items[a].occurred_at) - time(items[b].occurred_at) || a.localeCompare(b));
  const groups = new Map();
  for (const id of ordered) { const group=items[id].group; if (!groups.has(group)) groups.set(group,[]); groups.get(group).push(id); }
  return [...groups.values()].flat();
}
export class Store {
  constructor(root = defaultRoot(), clock = () => new Date()) { this.root = path.resolve(root); this.clock = clock; }
  now() { return this.clock().toISOString(); }
  file(account) { return path.join(this.root, hash(normalizeAccount(account)) + '.json'); }
  read(account) {
    const file = this.file(account);
    if (!fs.existsSync(file)) return { version: 1, account: normalizeAccount(account), preference: null, timezone: null, checkpoint: null, coverage_gaps: [], items: {}, batches: {}, attempts: {}, feedback: {} };
    const state = JSON.parse(fs.readFileSync(file, 'utf8'));
    requireThat(state.version === 1 && state.account === normalizeAccount(account), 'state_version_or_account_mismatch');
    state.coverage_gaps ??= [];
    return state;
  }
  transaction(account, fn) {
    fs.mkdirSync(this.root, { recursive: true, mode: 0o700 });
    const file = this.file(account), lock = file + '.lock';
    let fd;
    try { fd = fs.openSync(lock, 'wx', 0o600); } catch (e) { if (e.code === 'EEXIST') throw new Error('state_locked: another writer or interrupted transaction; inspect lock before recovery'); throw e; }
    let temp;
    try {
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, started: this.now() }));
      const state = this.read(account), result = fn(state);
      temp = file + '.' + randomBytes(8).toString('hex') + '.tmp';
      const out = fs.openSync(temp, 'wx', 0o600);
      try { fs.writeFileSync(out, JSON.stringify(state, null, 2)); fs.fsyncSync(out); } finally { fs.closeSync(out); }
      fs.renameSync(temp, file);
      return result;
    } finally { if (temp && fs.existsSync(temp)) fs.unlinkSync(temp); fs.closeSync(fd); fs.unlinkSync(lock); }
  }
  configure(packet) {
    this.packet(packet);
    requireThat(['five', 'all'].includes(packet.preference), 'choose_five_or_all');
    requireThat(text(packet.timezone) && packet.timezone.trim(), 'timezone_required');
    new Intl.DateTimeFormat('en', { timeZone: packet.timezone }).format();
    return this.transaction(packet.account, s => { s.preference = packet.preference; s.timezone = packet.timezone; return { preference: s.preference, timezone: s.timezone }; });
  }
  packet(p) { requireThat(p?.version === 1, 'packet_version_required'); normalizeAccount(p.account); }
  window(account, options = {}) {
    const s = this.read(account), end = options.end || this.now();
    requireThat(!options.period || ['24h','7d'].includes(options.period), 'unsupported_period');
    const gapStart = s.coverage_gaps.map(g => g.start).sort((a,b) => time(a)-time(b))[0];
    const defaultStart = gapStart && (!s.checkpoint || time(gapStart) < time(s.checkpoint)) ? gapStart : s.checkpoint;
    const start = options.start || (options.period === '7d' ? new Date(time(end) - 7 * 864e5).toISOString() : options.period === '24h' ? new Date(time(end) - 864e5).toISOString() : defaultStart || new Date(time(end) - 864e5).toISOString());
    requireThat(time(start) < time(end), 'invalid_window');
    return { version: 1, account: s.account, start, end, preference: s.preference, preference_required: !s.preference, carry_ids: Object.values(s.items).filter(i => !terminal(i)).map(i => i.id) };
  }
  import(packet) {
    this.packet(packet);
    requireThat(time(packet.start) < time(packet.end), 'invalid_window');
    requireThat(Array.isArray(packet.items) && packet.coverage && Array.isArray(packet.coverage.gaps), 'items_and_coverage_required');
    return this.transaction(packet.account, s => {
      requireThat(s.preference && s.timezone, 'configure_first');
      const id = hash([s.account, packet.start, packet.end]);
      if (s.active && s.active !== id && !s.batches[s.active].closed) throw new Error('open_batch_exists: resume or close it first');
      if (s.batches[id]) return this.view(s, id);
      const excluded = new Set(packet.exclude_ids || []);
      const ids = new Set(Object.values(s.items).filter(i => !terminal(i) && !excluded.has(i.source_id)).map(i => i.id));
      for (const key of ids) if (s.items[key].state === 'deferred') s.items[key].state = s.items[key].final_text ? 'drafted' : 'captured';
      for (const source of packet.items) {
        requireThat(['comment', 'mention', 'quote'].includes(source.lane) && text(source.source_id) && source.source_id.length > 0, 'native_identity_required');
        if (excluded.has(source.source_id)) continue;
        const key = itemKey(s.account, source.lane, source.source_id), existing = s.items[key];
        if (terminal(existing || {})) continue;
        if (existing && existing.lane !== source.lane) { ids.add(key); continue; }
        const occurred = time(source.occurred_at);
        if (!(occurred >= time(packet.start) && occurred < time(packet.end)) && !ids.has(key)) continue;
        if (source.safety !== 'safe' || source.pending !== true || source.available !== true) {
          if (existing && !inFlight(existing)) { existing.state = 'unavailable'; existing.reason = 'source_not_eligible'; }
          if (!existing || !inFlight(existing)) ids.delete(key); continue;
        }
        requireThat(text(source.author) && text(source.text) && text(source.post?.text), 'full_text_and_author_required');
        const group = source.post?.id && source.post?.verified === true ? 'post:' + source.post.id : 'source:' + key;
        const context = { source_id: source.source_id, lane: source.lane, author: source.author, text: source.text, url: source.url || null, occurred_at: source.occurred_at, post: source.post, ancestry: source.ancestry || [], context_complete: source.context_complete === true, group };
        if (existing) {
          requireThat(existing.author === context.author, 'source_author_changed');
          Object.assign(existing, context);
          if (existing.state === 'deferred') existing.state = existing.final_text ? 'drafted' : 'captured';
        } else s.items[key] = { ...context, id: key, state: 'captured', revision: 0, original_text: null, draft_text: '', final_text: '', history: [] };
        ids.add(key);
      }
      const ordered = groupedIds([...ids].filter(key => !terminal(s.items[key])), s.items);
      const sources = ordered.map(key => { const i=s.items[key]; return JSON.parse(JSON.stringify({id:i.id, source_id:i.source_id, lane:i.lane, author:i.author, text:i.text, url:i.url, occurred_at:i.occurred_at, post:i.post, ancestry:i.ancestry})); });
      s.batches[id] = { id, sources, snapshot_hash:hash(sources), start: packet.start, end: packet.end, coverage: packet.coverage, ids: ordered, created: this.now(), closed: false };
      s.active = id;
      return this.view(s, id);
    });
  }
  item(s, p) {
    const item = s.items[p.id];
    requireThat(item, 'unknown_item');
    requireThat(Number.isInteger(p.revision) && p.revision === item.revision, 'revision_conflict');
    return item;
  }
  editable(item) { requireThat(!inFlight(item) && item.state !== 'published', 'send_in_flight_or_published'); }
  context(packet) {
    this.packet(packet);
    return this.transaction(packet.account, s => {
      const item = this.item(s, packet); this.editable(item);
      requireThat(item.state !== 'skipped', 'undo_required');
      const source = packet.source;
      requireThat(source && source.source_id === item.source_id && source.author === item.author, 'context_identity_mismatch');
      requireThat(text(packet.evidence_ref) && packet.evidence_ref.trim(), 'context_evidence_required');
      if (source.safe !== true || source.pending !== true || source.available !== true) {
        item.state = 'unavailable'; item.revision++; delete item.approved_revision; return item;
      }
      requireThat(text(source.text) && text(source.post?.text) && Array.isArray(source.ancestry), 'full_context_required');
      requireThat(!item.post?.id || source.post?.id === item.post.id, 'parent_identity_changed');
      item.text = source.text; item.post = source.post; item.ancestry = source.ancestry;
      item.group = source.post.id && source.post.verified === true ? 'post:' + source.post.id : 'source:' + item.id;
      if (s.batches[s.active]) s.batches[s.active].ids = groupedIds(s.batches[s.active].ids,s.items);
      item.url = source.url || item.url; item.context_complete = source.context_complete === true;
      item.state = item.final_text ? 'drafted' : 'captured'; item.revision++; delete item.approved_revision;
      item.history.push({type:'context_refreshed', evidence_ref:packet.evidence_ref, at:this.now()});
      return item;
    });
  }
  drafts(packet) {
    this.packet(packet);
    requireThat(Array.isArray(packet.drafts), 'drafts_required');
    return this.transaction(packet.account, s => {
      for (const draft of packet.drafts) {
        const item = this.item(s, draft); this.editable(item);
        requireThat(!['skipped', 'unavailable'].includes(item.state), 'item_not_draftable');
        requireThat(item.source_id === draft.source_id && item.context_complete && draft.context_verified === true, 'context_or_native_binding_missing');
        requireThat(['native', 'agent'].includes(draft.mode) && text(draft.text) && draft.text.trim(), 'draft_required');
        requireThat(draft.gates_passed === true, 'draft_gates_required');
        item.original_text ??= draft.text;
        item.draft_text = draft.text; item.final_text = draft.text; item.mode = draft.mode;
        item.history.push({ type: 'draft', text: draft.text, mode: draft.mode, at: this.now() });
        item.state = 'drafted'; item.revision++; delete item.approved_revision;
      }
      return this.view(s);
    });
  }
  edit(packet) {
    this.packet(packet); requireThat(text(packet.text), 'exact_text_required');
    return this.transaction(packet.account, s => {
      const item = this.item(s, packet); this.editable(item);
      requireThat(!['skipped', 'unavailable'].includes(item.state), 'undo_before_edit');
      if (item.final_text !== packet.text) {
        item.final_text = packet.text; item.state = 'drafted'; item.revision++; delete item.approved_revision;
        item.history.push({ type: 'edit', text: packet.text, at: this.now() });
      }
      return item;
    });
  }
  decide(packet) {
    this.packet(packet);
    return this.transaction(packet.account, s => {
      const item = this.item(s, packet); this.editable(item);
      const actions = { approve: 'approved', defer: 'deferred', skip: 'skipped', undo: 'drafted', regenerate: 'regenerate' };
      requireThat(Object.hasOwn(actions, packet.action), 'invalid_action');
      if (['skipped', 'unavailable'].includes(item.state)) requireThat(packet.action === 'undo', 'undo_required');
      if (packet.action === 'approve') requireThat(item.final_text.trim() && item.context_complete, 'nonblank_complete_reply_required');
      item.state = actions[packet.action]; item.revision++;
      if (packet.action === 'approve') item.approved_revision = item.revision; else delete item.approved_revision;
      item.history.push({ type: packet.action, at: this.now() });
      return item;
    });
  }
  prepare(packet) {
    this.packet(packet);
    requireThat(packet.authorization?.explicit === true && text(packet.authorization?.reference) && packet.authorization.reference.trim(), 'explicit_chat_send_authorization_required');
    requireThat(Array.isArray(packet.items) && packet.items.length > 0, 'approved_items_required');
    return this.transaction(packet.account, s => {
      const batch = s.batches[s.active]; requireThat(batch && !batch.closed, 'open_batch_required');
      const selected = packet.items.map(proof => {
        const item = this.item(s, proof);
        requireThat(batch.ids.includes(item.id) && item.state === 'approved' && item.approved_revision === item.revision, 'exact_approved_revision_required');
        requireThat(proof.source_id === item.source_id && proof.author === item.author && proof.final_hash === hash(item.final_text), 'send_binding_mismatch');
        requireThat(proof.pending === true && proof.safe === true && proof.available === true && proof.gates_passed === true, 'fresh_send_gates_required');
        requireThat(text(proof.evidence_ref) && proof.evidence_ref.trim(), 'live_evidence_required');
        requireThat(time(proof.checked_at) <= time(this.now()) && time(this.now()) - time(proof.checked_at) < 300000, 'send_check_expired');
        requireThat(item.lane !== 'quote' || ['comment', 'mention'].includes(proof.quote_target_kind), 'quote_target_unsupported');
        return { id: item.id, revision: item.revision, source_id: item.source_id, kind: item.lane === 'quote' ? proof.quote_target_kind : item.lane, text: item.final_text, final_hash: hash(item.final_text), author: item.author };
      });
      requireThat(new Set(selected.map(i => i.id)).size === selected.length, 'duplicate_target');
      const key = hash([s.account, batch.id, selected.map(i => [i.id, i.revision, i.final_hash]).sort()]);
      requireThat(!s.attempts[key], 'attempt_already_exists');
      const attempt = { key, batch_id: batch.id, created: this.now(), authorization: packet.authorization, items: selected, state: 'uncertain', results: {} };
      s.attempts[key] = attempt;
      for (const row of selected) { s.items[row.id].state = 'uncertain'; s.items[row.id].attempt = key; }
      return { attempt, mcp: { account: s.account, idempotency_key: key, drafts: selected.map(i => ({ [i.kind === 'mention' ? 'mention_id' : 'comment_id']: i.source_id, text: i.text })) } };
    });
  }
  recordSend(packet) {
    this.packet(packet);
    return this.transaction(packet.account, s => {
      const attempt = s.attempts[packet.key]; requireThat(attempt, 'unknown_attempt');
      requireThat(packet.receipt && text(packet.receipt), 'send_receipt_required');
      attempt.receipt = packet.receipt; attempt.eta = packet.eta || null;
      for (const row of attempt.items) if (s.items[row.id].state === 'uncertain') s.items[row.id].state = 'queued';
      attempt.state = 'queued'; return attempt;
    });
  }
  reconcile(packet) {
    this.packet(packet); requireThat(Array.isArray(packet.results), 'results_required');
    return this.transaction(packet.account, s => {
      const attempt = s.attempts[packet.key]; requireThat(attempt, 'unknown_attempt');
      for (const proof of packet.results) {
        const row = attempt.items.find(i => i.id === proof.id); requireThat(row, 'attempt_target_mismatch');
        const item = s.items[row.id];
        if (item.state === 'published') { requireThat(proof.text === item.published_text, 'published_text_mismatch'); continue; }
        requireThat(item.attempt === packet.key && inFlight(item), 'attempt_not_active');
        requireThat(proof.source_id === item.source_id && proof.author === item.author, 'readback_binding_mismatch');
        requireThat(text(proof.evidence_ref) && proof.evidence_ref.trim(), 'independent_readback_required');
        requireThat(time(proof.checked_at) >= time(attempt.created) && time(proof.checked_at) <= time(this.now()), 'readback_timestamp_invalid');
        if (proof.status === 'failed') {
          requireThat(proof.definitely_not_sent === true && text(proof.failure_receipt) && proof.failure_receipt.trim(), 'failure_not_proven');
          item.state = 'drafted'; item.revision++; delete item.approved_revision;
        } else if (proof.status === 'published') {
          requireThat(attempt.receipt && text(proof.reply_id) && proof.reply_id && text(proof.url) && /^https:\/\//.test(proof.url), 'publication_receipt_and_reply_required');
          requireThat(proof.text === row.text && hash(proof.text) === row.final_hash, 'published_text_mismatch');
          requireThat(proof.pending_before === true && proof.replied_after === true, 'publication_transition_required');
          item.published_text = proof.text; item.published_url = proof.url; item.published_at = proof.checked_at; item.state = 'published';
          const feedbackKey = hash(['feedback', s.account, item.id, row.final_hash]);
          s.feedback[feedbackKey] ??= { key: feedbackKey, item_id: item.id, state: 'pending', mode: item.mode || 'agent', original_text: item.original_text ?? item.draft_text, baseline_text: item.draft_text, final_text: proof.text, created: this.now() };
          item.feedback_key = feedbackKey;
        } else { requireThat(proof.status === 'uncertain', 'invalid_readback_status'); item.state = 'uncertain'; }
        attempt.results[row.id] = proof;
      }
      attempt.state = attempt.items.every(i => ['published', 'drafted'].includes(s.items[i.id].state)) ? 'reconciled' : 'uncertain';
      return this.view(s, attempt.batch_id);
    });
  }
  feedback(packet) {
    this.packet(packet);
    return this.transaction(packet.account, s => {
      const entry = s.feedback[packet.key]; requireThat(entry, 'unknown_feedback');
      requireThat(text(packet.receipt) && packet.receipt.trim(), 'feedback_receipt_required');
      if (entry.state !== 'recorded') { entry.state = 'recorded'; entry.receipt = packet.receipt; entry.recorded_at = this.now(); }
      return entry;
    });
  }
  close(packet) {
    this.packet(packet);
    return this.transaction(packet.account, s => {
      const batch = s.batches[packet.batch_id || s.active]; requireThat(batch, 'unknown_batch');
      requireThat(batch.ids.every(id => terminal(s.items[id]) || s.items[id].state === 'deferred'), 'review_or_send_unresolved');
      batch.closed = true;
      if (batch.coverage.complete === true && batch.coverage.gaps.length === 0) {
        s.coverage_gaps = s.coverage_gaps.filter(g => !(time(batch.start) <= time(g.start) && time(batch.end) >= time(g.end)));
        const candidate = !s.checkpoint || time(batch.end) > time(s.checkpoint) ? batch.end : s.checkpoint;
        const floor = s.coverage_gaps.map(g => g.start).sort((a,b) => time(a)-time(b))[0];
        s.checkpoint = floor && time(floor) < time(candidate) ? floor : candidate;
      } else if (!s.coverage_gaps.some(g => g.start === batch.start && g.end === batch.end)) {
        s.coverage_gaps.push({start:batch.start,end:batch.end});
        if (s.checkpoint && time(batch.start) < time(s.checkpoint)) s.checkpoint = batch.start;
      }
      return { closed: true, checkpoint: s.checkpoint, coverage_gaps: s.coverage_gaps, feedback_pending: Object.values(s.feedback).filter(f => f.state === 'pending').length, coverage: batch.coverage };
    });
  }
  view(s, batchId = s.active) {
    const batch = s.batches[batchId];
    const items = batch ? batch.ids.map(id => s.items[id]) : [];
    return { version: 1, account: s.account, preference: s.preference, timezone: s.timezone, checkpoint: s.checkpoint, coverage_gaps: s.coverage_gaps, batch: batch || null, items, feedback_pending: Object.values(s.feedback).filter(f => f.state === 'pending'), attempts: Object.values(s.attempts).filter(a => a.batch_id === batchId), learning: learning(Object.values(s.feedback).filter(f => f.state === 'recorded')) };
  }
  receipt(account, batchId) {
    const saved = this.read(account);
    const status = this.view(saved, batchId);
    return {
      workflow_id: 'inbound-replies', version: 1, account: status.account,
      batch_id: status.batch?.id || null, timestamp: this.now(), timezone: status.timezone,
      coverage: status.batch?.coverage || {complete:false,gaps:['no_batch']},
      closed: status.batch?.closed || false, feedback_pending: status.feedback_pending.length,
      fallback_state: {agent_drafts: status.items.filter(i => i.mode === 'agent').length, editor: 'operator_readback_required'},
      items: status.items.map(i => ({id:i.id, source_hash:hash(i.source_id), state:i.state, revision:i.revision,
        approved_text_hash: i.approved_revision ? hash(i.final_text) : null,
        published_text_hash: i.state === 'published' ? hash(i.published_text) : null,
        mode:i.mode || null, feedback_recorded: i.state === 'published' && !status.feedback_pending.some(f => f.item_id === i.id),
        feedback_receipt:saved.feedback[i.feedback_key]?.receipt || null,
        attempt_key:i.attempt || null})),
      attempts: status.attempts.map(a => ({key:a.key,state:a.state,receipt:a.receipt || null,
        targets:Object.entries(a.results).map(([id,r])=>({id,status:r.status,evidence_ref:r.evidence_ref,reply_id_hash:r.reply_id ? hash(r.reply_id) : null}))}))
    };
  }
  status(account, batchId) { return this.view(this.read(account), batchId); }
}
export function editDistance(a, b) {
  const x = Array.from(a), y = Array.from(b);
  let row = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) { const next = [i]; for (let j = 1; j <= y.length; j++) next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1)); row = next; }
  return row[y.length] / Math.max(x.length, y.length, 1);
}
export function learning(entries) {
  const summarize = rows => ({ count: rows.length, unchanged_rate: rows.length ? rows.filter(r => r.baseline_text === r.final_text).length / rows.length : null, mean_edit_distance: rows.length ? rows.reduce((n, r) => n + editDistance(r.baseline_text, r.final_text), 0) / rows.length : null });
  return Object.fromEntries(['native', 'agent'].map(mode => {
    const rows = entries.filter(r => r.mode === mode).sort((a, b) => a.created.localeCompare(b.created));
    const recent = summarize(rows.slice(-20)), previous = summarize(rows.slice(-40, -20));
    const corrections = new Map();
    for (const r of rows) {
      if (r.baseline_text === r.final_text) continue;
      const kind = r.final_text.length < r.baseline_text.length ? 'shortened' : r.final_text.length > r.baseline_text.length ? 'expanded' : 'reworded';
      corrections.set(kind, (corrections.get(kind) || 0) + 1);
    }
    return [mode, { recent, previous, comparison: recent.count >= 20 && previous.count >= 20 ? 'comparable_samples_not_causal' : 'insufficient_data', recurring_corrections: Object.fromEntries([...corrections].filter(([, n]) => n >= 3)) }];
  }));
}
