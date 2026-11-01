import { createHash } from 'node:crypto';

const iso = (value) => typeof value === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const assert = (condition, message) => { if (!condition) throw new Error(message); };

// This module prepares local evidence only. It has no provider writes or approval UI.
export function rowFingerprint(row) {
  return hash(canonical({ account: row.account, source: row.source, revision: row.revision,
    at: row.at, kind: row.kind, chain: row.chain, changedClaims: row.changedClaims }));
}

export function buildRunwayReview(input) {
  const { account, timezone, snapshotAt, window, slots, sources, calendar, policy = {} } = input;
  assert(typeof account === 'string' && account.trim(), 'account required');
  assert(typeof timezone === 'string' && timezone.trim(), 'timezone required');
  new Intl.DateTimeFormat('en', { timeZone: timezone }).format();
  assert(iso(snapshotAt) && iso(window?.start) && iso(window?.end) && Date.parse(window.start) < Date.parse(window.end), 'dated snapshot and window required');
  assert(Array.isArray(slots) && Array.isArray(sources) && Array.isArray(calendar?.rows), 'slots, sources and calendar rows required');
  const { minOpeningLikes = 0, cooldownDays = 0, minSpacingMinutes = 120, liveBufferMinutes = 30 } = policy;
  for (const value of [minOpeningLikes, cooldownDays, minSpacingMinutes, liveBufferMinutes]) {
    assert(Number.isFinite(value) && value >= 0, 'policy values must be non-negative numbers');
  }
  const start = Date.parse(window.start), end = Date.parse(window.end);
  const covered = calendar.complete === true && calendar.account === account && iso(calendar.snapshotAt)
    && Date.parse(calendar.snapshotAt) <= Date.parse(snapshotAt) && iso(calendar.start) && iso(calendar.end)
    && Date.parse(calendar.start) <= start - liveBufferMinutes * 60000
    && Date.parse(calendar.end) >= end + liveBufferMinutes * 60000;
  const sourceMap = new Map();
  for (const source of sources) {
    assert(typeof source.id === 'string' && source.id && !sourceMap.has(source.id), 'unique source ids required');
    sourceMap.set(source.id, source);
  }
  const queued = calendar.rows.map((row) => {
    assert(typeof row.id === 'string' && row.id && row.account === account && iso(row.at), 'invalid calendar row');
    return { ...row, state: 'existing_queued' };
  });
  assert(new Set(queued.map((row) => row.id)).size === queued.length, 'unique calendar ids required');
  const ordered = [...slots].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  assert(new Set(ordered.map((slot) => slot.id)).size === ordered.length, 'unique slot ids required');
  const seenSources = new Set(queued.map((row) => row.source).filter(Boolean));
  const seenFamilies = new Set(queued.map((row) => row.family).filter(Boolean));
  const proposed = [], rowsExisting = new Set();
  const rows = ordered.map((slot) => {
    assert(typeof slot.id === 'string' && slot.id && iso(slot.at) && Date.parse(slot.at) >= start && Date.parse(slot.at) < end, 'slot outside window or missing offset');
    assert(['short', 'thread'].includes(slot.kind), 'slot kind must be short or thread');
    const at = Date.parse(slot.at);
    if (slot.existingId) {
      const existing = queued.find((row) => row.id === slot.existingId && Date.parse(row.at) === at);
      assert(existing && !rowsExisting.has(existing.id), 'existing slot must match a unique live calendar item');
      rowsExisting.add(existing.id);
      return { ...slot, account, chain: existing.chain ?? [], state: 'existing_queued', existingId: existing.id, blockers: [] };
    }
    const source = sourceMap.get(slot.source);
    const blockers = [];
    if (!covered) blockers.push('calendar_coverage_unverified');
    if (!source) blockers.push('source_unavailable');
    else {
      if (source.hydrated !== true || !Array.isArray(source.chain) || !source.chain.length
        || source.chain.some((part) => !part || typeof part !== 'object' || typeof part.text !== 'string' || !part.text.trim() || !Array.isArray(part.media)
          || part.media.some((media) => typeof media !== 'string' || !media.trim()))
        || (slot.kind === 'thread' && source.chain.length < 2)) blockers.push('full_chain_or_media_unverified');
      if (!iso(source.performanceAt) || Date.parse(source.performanceAt) > Date.parse(snapshotAt) || !Number.isFinite(source.openingLikes) || source.openingLikes < minOpeningLikes) blockers.push('performance_unverified_or_below_threshold');
      if (source.freshness !== 'confirmed') blockers.push('claims_or_offer_need_review');
      if (typeof source.family !== 'string' || !source.family || source.historyComplete !== true) blockers.push('family_history_unverified');
      if (!Object.hasOwn(source, 'lastUsedAt') || !Array.isArray(source.changedClaims)) blockers.push('source_evidence_incomplete');
      if (source.lastUsedAt != null && (!iso(source.lastUsedAt) || at - Date.parse(source.lastUsedAt) < cooldownDays * 86400000)) blockers.push('family_cooldown');
      if (seenSources.has(source.id) || seenFamilies.has(source.family)) blockers.push('duplicate_source_or_family');
      if (source.kind !== slot.kind) blockers.push('wrong_content_kind');
    }
    if (queued.some((row) => Math.abs(at - Date.parse(row.at)) < liveBufferMinutes * 60000 || at === Date.parse(row.at))) blockers.push('live_calendar_conflict');
    if (proposed.some((row) => Math.abs(at - Date.parse(row.at)) < minSpacingMinutes * 60000 || at === Date.parse(row.at))) blockers.push('proposal_spacing_conflict');
    const row = { id: slot.id, account, at: slot.at, kind: slot.kind, source: slot.source ?? null,
      revision: source?.revision ?? null, chain: Array.isArray(source?.chain) ? source.chain : [], changedClaims: Array.isArray(source?.changedClaims) ? source.changedClaims : [],
      state: blockers.length ? 'gap' : 'proposed', blockers };
    if (!blockers.length) {
      assert(typeof row.revision === 'string' && row.revision, 'source revision required');
      row.fingerprint = rowFingerprint(row);
      row.idempotencyKey = `runway-${row.fingerprint}`;
      seenSources.add(source.id); seenFamilies.add(source.family); proposed.push(row);
    }
    return row;
  });
  const packet = { format: 'greatest-hits-review.v1', account, timezone, snapshotAt, window, policy: { minOpeningLikes, cooldownDays, minSpacingMinutes, liveBufferMinutes },
    calendarVerified: covered, calendarSnapshotAt: calendar.snapshotAt ?? null, rows, existingQueue: queued,
    counts: { positions: rows.length, proposed: rows.filter((row) => row.state === 'proposed').length,
      existing: rows.filter((row) => row.state === 'existing_queued').length, gaps: rows.filter((row) => row.state === 'gap').length },
    approval: 'required_in_owner_chat', providerOperations: 'not_attempted' };
  packet.revision = hash(canonical(packet));
  return packet;
}

export function reconcileRunwayIntent(intent, readback) {
  assert(intent?.fingerprint === rowFingerprint(intent), 'intent payload changed');
  const matches = (readback?.rows ?? []).filter((row) => row.status === 'scheduled' && row.account === intent.account
    && row.at === intent.at && JSON.stringify(canonical(row.chain)) === JSON.stringify(canonical(intent.chain))
    && typeof row.id === 'string' && row.id && (!intent.scheduledPostId || row.id === intent.scheduledPostId));
  // A missing readback is never evidence that a write did not happen.
  return { state: readback?.complete === true && matches.length === 1 ? 'scheduled_confirmed' : 'schedule_unverified',
    scheduledPostId: readback?.complete === true && matches.length === 1 ? matches[0].id : null,
    retryAllowed: false };
}

const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export function renderRunwayReview(packet) {
  const cards = packet.rows.map((row) => `<article><header><strong>${escape(row.kind)} · ${escape(row.state)}</strong><h2>${escape(new Intl.DateTimeFormat('en', { timeZone: packet.timezone, dateStyle: 'full', timeStyle: 'short' }).format(new Date(row.at)))}</h2></header>
    <p>Exact time: <code>${escape(row.at)}</code><br>Slot ${escape(row.id)} · Source ${escape(row.source ?? row.existingId ?? 'unavailable')}</p>
    ${(row.chain ?? []).map((part, index) => `<section><h3>Part ${index + 1}</h3><pre>${escape(part?.text)}</pre><p>Media: ${Array.isArray(part?.media) && part.media.length ? part.media.map(escape).join('<br>') : 'none or unverified; see blockers'}</p></section>`).join('')}
    ${row.state === 'existing_queued' && !row.chain?.length ? '<p>Existing copy/media unavailable in this export; inspect the live item.</p>' : ''}
    ${row.changedClaims?.length ? `<h3>Changed claims</h3><pre>${escape(JSON.stringify(row.changedClaims, null, 2))}</pre>` : ''}
    ${row.blockers.length ? `<p class="gap">${row.blockers.map(escape).join(' · ')}</p>` : ''}
    <p>Receipt: ${row.state === 'existing_queued' ? 'existing calendar item; verify with provider before action' : 'unavailable — no provider operation attempted'}</p>
    ${row.fingerprint ? `<details><summary>Approval reference</summary><code>${escape(row.fingerprint)}</code></details>` : ''}</article>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Greatest Hits Review</title>
  <style>body{margin:0;background:#f4f2ec;color:#182e29;font:17px/1.6 system-ui,sans-serif}main{max-width:920px;margin:auto;padding:clamp(16px,4vw,48px)}h1{font-size:clamp(32px,6vw,56px);line-height:1.1}h2{font-size:23px}article{background:white;border:1px solid #c8d2c9;border-radius:18px;padding:24px;margin:24px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}code{overflow-wrap:anywhere}p{overflow-wrap:anywhere}strong{color:#366b50}.gap{color:#8b321d}section{border-top:1px solid #ddd}header p{max-width:65ch}details{font-size:14px}@media(max-width:480px){article{padding:16px}}</style></head><body><main><header><p>PRIVATE LOCAL REVIEW · ${escape(packet.timezone)}</p><h1>Your greatest hits runway</h1><p>${packet.counts.proposed} proposed · ${packet.counts.existing} existing · ${packet.counts.gaps} gaps across ${packet.counts.positions} positions.</p><p>Account: ${escape(packet.account)}<br>Snapshot: ${escape(packet.snapshotAt)}<br>Revision: <code>${escape(packet.revision)}</code></p><p>This portable copy is read-only and cannot approve or schedule posts. Request edits in the owner chat, regenerate this page, then approve the exact revision and rows there. Any account, text, media, source, revision or time edit invalidates that row's approval and validation. Calendar coverage: ${packet.calendarVerified ? 'verified at snapshot; recheck before scheduling' : 'unverified; slots remain tentative'}.</p></header>${cards}</main></body></html>\n`;
}
