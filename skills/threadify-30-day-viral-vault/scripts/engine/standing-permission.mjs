import { reviewHash } from './review.mjs';
import { localClock } from './time.mjs';

export function assertStandingPermission(s, root, card, now, expectedId) {
  const fail = (message) => { throw new Error(message); };
  if (!Number.isFinite(Date.parse(now))) fail('A valid current time is required.');
  if (s?.kind !== 'threadify-setup.v1' || s.paused || s.permission?.mode !== 'automatic') fail('Active automatic setup permission required.');
  if (!s.pending?.id || s.pending.permission_id !== s.permission.id) fail('Acquire the setup batch or recurring-run lock first.');
  if (expectedId && s.permission.id !== expectedId) fail('Standing permission changed; authorize again.');
  if (s.permission.summary_hash !== reviewHash(s.summary.facts) || !s.completed.voice) fail('Current confirmed voice and summary required.');
  const c = card.content; const p = s.summary.facts;
  if (c.account_id !== s.account || c.timezone !== p.timezone) fail('Card is outside the approved account or timezone.');
  const clock = localClock(c.scheduled_at, c.timezone);
  const today = localClock(now, c.timezone).date;
  const days = (Date.parse(clock.date) - Date.parse(today)) / 86400000;
  if (days < 0 || days > 6 || !p.times.includes(clock.time)) fail('Card is outside the agreed seven-day posting slots.');
  const topics = p.topics.split(/[,\n]/).map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (typeof c.topic !== 'string' || !topics.includes(c.topic.toLowerCase())) fail('Card topic is outside the agreed plan.');
  if (c.gaps.length || c.auto_plug || c.auto_repost || (c.cta !== 'none' && !s.observations.offer?.offer_ids?.includes(c.offer_id))) fail('Unresolved gaps and promotional automations need exact review.');
  if (card.validation?.kind !== 'threadify' || card.validation.status !== 'passed' || card.validation.card_hash !== reviewHash(c) || !Number.isFinite(Date.parse(card.validation.valid_until)) || Date.parse(card.validation.valid_until) <= Date.parse(now)) fail('Fresh matching provider validation required.');
  return { permission_id: s.permission.id, run_id: s.pending.id, setup_root: root, evidence_ref: s.permission.confirmation, at: now };
}

export function assertCalendarCapacity(s, card, preflight, otherCards = []) {
  if (!Array.isArray(preflight?.occupied_instants)) throw new Error('Full calendar occupancy required.');
  const timezone = s.summary.facts.timezone;
  const day = localClock(card.content.scheduled_at, timezone).date;
  const instants = new Set([...preflight.occupied_instants, ...otherCards
    .filter(c => c.content.account_id === s.account && ['attempt_pending', 'unknown', 'scheduled', 'published', 'observed'].includes(c.state))
    .map(c => c.content.scheduled_at)].map(t => new Date(t).toISOString()));
  if ([...instants].filter(t => localClock(t, timezone).date === day).length >= s.summary.facts.posts_per_day)
    throw new Error('The agreed daily frequency is already filled; preserve existing posts.');
}
