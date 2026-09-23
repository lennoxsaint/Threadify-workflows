// A local blueprint, never a scheduler or claim that drafts already exist.
import { canonicalSourceUrl } from './urls.mjs';
const DAYS = { day: 1, week: 7, month: 28 };
const MIX = ['greatest_hit', 'viral', 'my_vault', 'experiment', 'viral'];
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;

function preferences(input, now) {
  const p = {
    posts_per_day: 5, commercial_mode: 'growth', long_form_days: [2, 4, 6],
    ...input, schema_version: 'creator-preferences.v1',
  };
  assert(nonempty(p.account_id) && nonempty(p.timezone), 'Creator account and timezone required.');
  new Intl.DateTimeFormat('en', { timeZone: p.timezone }).format();
  assert(Number.isInteger(p.posts_per_day) && p.posts_per_day >= 1 && p.posts_per_day <= 5, 'Daily volume must be one through five.');
  assert(Array.isArray(p.times) && p.times.length >= p.posts_per_day
    && p.times.every((t) => typeof t === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t))
    && new Set(p.times).size === p.times.length, 'Choose distinct valid local times during setup.');
  assert(Array.isArray(p.long_form_days) && p.long_form_days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    && new Set(p.long_form_days).size === p.long_form_days.length, 'Long-form days must be unique weekdays, Sunday=0.');
  assert(['growth', 'conversion'].includes(p.commercial_mode), 'Unsupported commercial mode.');
  if (p.commercial_mode === 'conversion') {
    const offer = p.offer;
    assert(nonempty(offer?.id) && offer.verified === true && nonempty(offer.evidence_ref)
      && Date.parse(offer.valid_until) > now, 'Conversion requires a current verified selected offer.');
  }
  return structuredClone(p);
}

function validSource(s, now) {
  if (!s || !nonempty(s.id) || !nonempty(s.topic) || !MIX.includes(s.lane)
    || s.qualified !== true || !nonempty(s.evidence_ref)
    || !Number.isFinite(s.relevance) || s.relevance < 0 || s.relevance > 1
    || !(Date.parse(s.available_until) > now)) return false;
  try { const url = new URL(s.url); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}

export function createHorizon(input) {
  assert(nonempty(input.id), 'Plan ID required.');
  const now = Date.parse(input.now);
  assert(Number.isFinite(now), 'Explicit current time required.');
  assert(Object.hasOwn(DAYS, input.horizon), 'Unsupported horizon.');
  const mode = input.mode ?? 'rolling';
  const laneOffset = input.lane_offset ?? 0;
  assert(Number.isSafeInteger(laneOffset) && laneOffset >= 0, 'Nonnegative lane offset required.');
  assert(['rolling', 'upfront'].includes(mode), 'Unsupported horizon mode.');
  assert(typeof input.start_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.start_date), 'ISO local start date required.');
  const start = new Date(`${input.start_date}T00:00:00Z`);
  assert(Number.isFinite(start.getTime()) && start.toISOString().slice(0, 10) === input.start_date, 'Invalid start date.');
  const p = preferences(input.preferences, now);
  assert(Array.isArray(input.sources), 'Source candidates required; an empty array is allowed.');
  const sources = input.sources.filter((s) => validSource(s, now))
    .sort((a, b) => b.relevance - a.relevance || a.id.localeCompare(b.id));
  const usedIds = new Set(input.used_source_ids ?? []);
  const usedUrls = new Set((input.used_source_urls ?? []).map(canonicalSourceUrl));
  const times = [...p.times].sort().slice(0, p.posts_per_day);
  const days = [];
  for (let day = 0; day < DAYS[input.horizon]; day++) {
    const date = new Date(start.getTime() + day * 86_400_000);
    const localDate = date.toISOString().slice(0, 10);
    const slots = [];
    for (let slot = 0; slot < p.posts_per_day; slot++) {
      const lane = MIX[(laneOffset + day * p.posts_per_day + slot) % MIX.length];
      const available = sources.filter((s) => !usedIds.has(s.id) && !usedUrls.has(canonicalSourceUrl(s.url)));
      const source = available.find((s) => s.lane === lane) ?? available[0];
      if (source) { usedIds.add(source.id); usedUrls.add(canonicalSourceUrl(source.url)); }
      slots.push({
        id: `${input.id}:${localDate}:${slot + 1}`, requested_lane: lane,
        selected_lane: source?.lane ?? null, source_id: source?.id ?? null,
        source_url: source?.url ?? null, topic: source?.topic ?? null,
        substitution_reason: source && source.lane !== lane
          ? `No unused qualified ${lane} source; selected a qualified ${source.lane} source.` : null,
        gaps: source ? [] : [`No unused qualified source for ${lane}; provide or approve more evidence.`],
        format: slot === 0 && p.long_form_days.includes(date.getUTCDay()) ? 'long_form' : 'short_form',
        cta: p.commercial_mode === 'conversion' && slot === 0 ? 'earned_optional' : 'none',
        offer_id: p.commercial_mode === 'conversion' && slot === 0 ? p.offer.id : null,
        local_date: localDate, local_time: times[slot], timezone: p.timezone,
        state: 'blueprint', parts: null,
        // These must be refreshed when materializing and again before scheduling.
        refresh_required: ['facts', 'offers', 'source_availability', 'validation', 'calendar', 'timezone_offset'],
      });
    }
    days.push({ date: localDate, drafting: day === 0 || mode === 'upfront' ? 'due' : 'just_in_time', slots });
  }
  return {
    schema_version: 'creator-horizon.v1', id: input.id, created_at: input.now,
    horizon: input.horizon, mode, preferences: p,
    label: input.horizon === 'month' ? '28 days (4 weeks)' : `${DAYS[input.horizon]} day${input.horizon === 'day' ? '' : 's'}`,
    days,
  };
}
