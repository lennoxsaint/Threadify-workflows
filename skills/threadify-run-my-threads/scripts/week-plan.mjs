#!/usr/bin/env node
// Run My Threads weekly planner. Deterministic: the same input always gives the
// same 7-day x 5-slot plan, so a daily run (or a fresh cloud copy) can rebuild
// the week from the four values saved at setup.
//
//   node week-plan.mjs build < {"start_date":"2026-10-06","mode":"balanced","short_day":"sunday","seed":1,"auto_plug":true}
//   node week-plan.mjs check < <plan JSON printed by build>
//
// mode: growth (0 CTAs/week) | balanced (2 a day, 14/week) | conversion (25/week).
// short_day: the weekday with no long-form thread (default sunday).
// seed: any integer; use the week number (1, 2, 3...) so consecutive weeks rotate.
// auto_plug: false when Threadify Auto Plug is not available on the plan; thread
// plugs are then replaced by listicle-plug posts.
// Output is JSON on stdout. Exit 0 when every invariant passes, 1 on any FAIL or
// bad input. No dependencies and no network: Node 18+ only.
import { pathToFileURL } from 'node:url';

export const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
export const LONG_FORM_ROTATION = ['teacher', 'storyteller', 'synthesizer'];
// listicle-plug carries the offer (a plug is a CTA), so it is only used on CTA slots.
export const PLAIN_SHORT_TYPES = ['one-liner', 'listicle', 'random'];
export const STRUCTURES = [
  'listicle',
  'setup-twist-mic-drop',
  'contrarian-reversal',
  'before-after',
  'confession',
  'story-arc',
  'step-by-step',
  'proof-receipt',
  'observation',
];
export const HOOK_ARCHETYPES = [
  'contrarian',
  'confession',
  'curiosity-gap',
  'before-after',
  'list-promise',
  'how-to',
  'mistake',
  'observation',
  'proof-receipt',
  'story-open',
];
export const CTA_TARGETS = { growth: 0, balanced: 14, conversion: 25 };
const POSTS_PER_DAY = 5;
const BALANCED_DAILY_CTAS = 2;

// Which proven structures fit each Threadify type.
const FITS = {
  'one-liner': ['setup-twist-mic-drop', 'contrarian-reversal', 'observation', 'confession', 'before-after'],
  listicle: ['listicle', 'step-by-step', 'before-after', 'proof-receipt', 'contrarian-reversal'],
  'listicle-plug': ['listicle', 'step-by-step', 'proof-receipt', 'before-after'],
  random: STRUCTURES,
  teacher: ['step-by-step', 'listicle', 'contrarian-reversal', 'proof-receipt'],
  storyteller: ['story-arc', 'confession', 'before-after'],
  synthesizer: ['observation', 'contrarian-reversal', 'proof-receipt', 'listicle'],
};

const SHAPES = {
  listicle: 'a promise line, then 5-7 parallel items, each one line',
  'setup-twist-mic-drop': 'setup, twist, mic-drop line',
  'contrarian-reversal': 'state the common belief, reverse it, give one true reason',
  'before-after': 'where it was, what changed, where it is now',
  confession: 'admit a real mistake or belief, then the lesson',
  'story-arc': 'moment, tension, turn, lesson',
  'step-by-step': 'outcome first, then numbered steps in order',
  'proof-receipt': 'the true result, then exactly how it happened',
  observation: 'one sharp thing you noticed, then why it matters',
};

// Thread days put the long-form thread second and the greatest hit fourth; the
// short day puts the greatest hit in the middle. Slots are in posting order.
const THREAD_DAY = ['short', 'long', 'short', 'hit', 'short'];
const SHORT_DAY = ['short', 'short', 'hit', 'short', 'short'];
// Order in which generated short slots receive a CTA (index into the day).
const CTA_ORDER_THREAD_DAY = [2, 4, 0];
const CTA_ORDER_SHORT_DAY = [1, 3, 0, 4];

function fail(message) {
  throw new Error(message);
}

function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('start_date must be YYYY-MM-DD');
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) fail('start_date is not a real date');
  return date;
}

function normalize(input) {
  if (!input || typeof input !== 'object') fail('input must be a JSON object');
  const mode = input.mode ?? 'balanced';
  if (!(mode in CTA_TARGETS)) fail('mode must be growth, balanced or conversion');
  const shortDay = String(input.short_day ?? 'sunday').toLowerCase();
  if (!WEEKDAYS.includes(shortDay)) fail('short_day must be a weekday name');
  const seed = input.seed ?? 1;
  if (!Number.isInteger(seed)) fail('seed must be an integer');
  const autoPlug = input.auto_plug ?? true;
  if (typeof autoPlug !== 'boolean') fail('auto_plug must be true or false');
  return { start: parseDate(input.start_date), start_date: input.start_date, mode, short_day: shortDay, seed, auto_plug: autoPlug };
}

const mod = (value, size) => ((value % size) + size) % size;

/** Least used this week, not used today, ties broken by a seeded order. */
function pick(options, usedWeek, usedToday, seed) {
  const order = options.map((option, index) => ({ option, rank: mod(index + seed, options.length) }));
  const fresh = order.filter(({ option }) => !usedToday.has(option));
  const pool = fresh.length ? fresh : order;
  pool.sort((a, b) => (usedWeek.get(a.option) ?? 0) - (usedWeek.get(b.option) ?? 0) || a.rank - b.rank);
  const chosen = pool[0].option;
  usedWeek.set(chosen, (usedWeek.get(chosen) ?? 0) + 1);
  usedToday.add(chosen);
  return chosen;
}

/** CTA count for each day, in week order. */
function ctaPerDay(days, mode, autoPlug) {
  if (mode === 'growth') return days.map(() => 0);
  if (mode === 'balanced') return days.map(() => BALANCED_DAILY_CTAS);
  // conversion: 25 a week, 3 or 4 a day. The short day and every other thread day carry 4.
  let threadIndex = 0;
  return days.map(({ hasThread }) => {
    const capacity = (hasThread ? 3 : 4) + (hasThread && autoPlug ? 1 : 0);
    const wanted = hasThread ? (threadIndex++ % 2 === 0 ? 4 : 3) : 4;
    return Math.min(wanted, capacity);
  });
}

export function buildPlan(rawInput) {
  const input = normalize(rawInput);
  const days = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(input.start.getTime() + offset * 86400000);
    const weekday = WEEKDAYS[date.getUTCDay()];
    return { date: date.toISOString().slice(0, 10), weekday, hasThread: weekday !== input.short_day };
  });
  const ctas = ctaPerDay(days, input.mode, input.auto_plug);
  const structureUse = new Map();
  const hookUse = new Map();
  let shortCursor = mod(input.seed, PLAIN_SHORT_TYPES.length);
  let longCursor = 0;

  const plannedDays = days.map((day, dayIndex) => {
    const layout = day.hasThread ? THREAD_DAY : SHORT_DAY;
    const ctaOrder = day.hasThread ? CTA_ORDER_THREAD_DAY : CTA_ORDER_SHORT_DAY;
    let remaining = ctas[dayIndex];
    const ctaSlots = new Set();
    const threadPlug = day.hasThread && input.auto_plug && remaining > 0;
    if (threadPlug) remaining -= 1;
    for (const index of ctaOrder) if (remaining > 0) { ctaSlots.add(index); remaining -= 1; }

    const hooksToday = new Set();
    const slots = layout.map((kind, index) => {
      const slot = { slot: index + 1 };
      if (kind === 'hit') {
        return {
          ...slot,
          role: 'greatest_hit_repost',
          content_type: 'short-form',
          short_form_type: null,
          long_form_type: null,
          structure: 'as-published',
          hook_archetype: 'as-published',
          cta: 'none',
        };
      }
      let typeFields;
      let cta = 'none';
      if (kind === 'long') {
        const longType = LONG_FORM_ROTATION[longCursor++ % LONG_FORM_ROTATION.length];
        typeFields = { content_type: 'long-form', short_form_type: null, long_form_type: longType };
        if (threadPlug) cta = 'plug';
      } else if (ctaSlots.has(index)) {
        typeFields = { content_type: 'short-form', short_form_type: 'listicle-plug', long_form_type: null };
        cta = 'listicle_plug';
      } else {
        typeFields = { content_type: 'short-form', short_form_type: PLAIN_SHORT_TYPES[shortCursor++ % PLAIN_SHORT_TYPES.length], long_form_type: null };
      }
      const hook = pick(HOOK_ARCHETYPES, hookUse, hooksToday, input.seed + dayIndex * 3 + index);
      return { ...slot, role: 'generated', ...typeFields, structure: null, hook_archetype: hook, cta };
    });
    // Structures: most constrained slot first, so a day never runs out of fitting ones.
    const structuresToday = new Set();
    slots
      .filter((slot) => slot.role === 'generated')
      .map((slot) => ({ slot, fits: FITS[slot.long_form_type ?? slot.short_form_type] }))
      .sort((a, b) => a.fits.length - b.fits.length || a.slot.slot - b.slot.slot)
      .forEach(({ slot, fits }) => {
        slot.structure = pick(fits, structureUse, structuresToday, input.seed + dayIndex);
        slot.brief = `Structure: ${slot.structure} (${SHAPES[slot.structure]}). Hook archetype: ${slot.hook_archetype}.`;
      });
    return { date: day.date, weekday: day.weekday, has_thread: day.hasThread, slots };
  });

  const plan = {
    record_type: 'RunMyThreadsWeekPlanV1',
    input: { start_date: input.start_date, mode: input.mode, short_day: input.short_day, seed: input.seed, auto_plug: input.auto_plug },
    days: plannedDays,
  };
  return { ...plan, ...checkPlan(plan) };
}

const count = (items, predicate) => items.filter(predicate).length;

/** Check every invariant of a plan. Returns { status, totals, checks }. */
export function checkPlan(plan) {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, status: ok ? 'PASS' : 'FAIL', ...(detail ? { detail } : {}) });
  const input = normalize(plan?.input);
  const days = Array.isArray(plan?.days) ? plan.days : [];
  const slots = days.flatMap((day) => day.slots ?? []);
  const threads = slots.filter((slot) => slot.content_type === 'long-form');
  const ctaTotal = count(slots, (slot) => slot.cta !== 'none');
  const target = CTA_TARGETS[input.mode];
  const conversionCap = 6 * 3 + 4;
  const expectedCtas = input.mode === 'conversion' && !input.auto_plug ? Math.min(target, conversionCap) : target;

  add('seven_days', days.length === 7);
  add('five_posts_per_day', days.every((day) => day.slots?.length === POSTS_PER_DAY));
  add('thirty_five_posts', slots.length === 35, `${slots.length}`);
  add('six_threads', threads.length === 6, `${threads.length}`);
  add('no_thread_on_short_day', days.every((day) => count(day.slots ?? [], (s) => s.content_type === 'long-form') === (day.weekday === input.short_day ? 0 : 1)));
  add('one_greatest_hit_per_day', days.every((day) => count(day.slots ?? [], (s) => s.role === 'greatest_hit_repost') === 1));
  add('greatest_hits_are_short_form_without_cta', slots.filter((s) => s.role === 'greatest_hit_repost').every((s) => s.content_type === 'short-form' && s.cta === 'none'));
  add('twenty_nine_short_form', count(slots, (s) => s.content_type === 'short-form') === 29);
  add('cta_total_matches_mode', ctaTotal === expectedCtas, `${ctaTotal} of ${target}${expectedCtas !== target ? ` (capped at ${expectedCtas} without Auto Plug)` : ''}`);
  if (input.mode === 'balanced') {
    add('balanced_two_ctas_per_day', days.every((day) => count(day.slots ?? [], (s) => s.cta !== 'none') === BALANCED_DAILY_CTAS));
  }
  if (input.mode === 'conversion') {
    add('conversion_three_or_four_per_day', !input.auto_plug || days.every((day) => [3, 4].includes(count(day.slots ?? [], (s) => s.cta !== 'none'))));
  }
  add('plug_only_on_threads', slots.filter((s) => s.cta === 'plug').every((s) => s.content_type === 'long-form'));
  add('no_plug_without_auto_plug', input.auto_plug || count(slots, (s) => s.cta === 'plug') === 0);
  add('listicle_plug_only_on_cta_slots', slots.every((s) => (s.short_form_type === 'listicle-plug') === (s.cta === 'listicle_plug')));
  const longTypes = threads.map((s) => s.long_form_type);
  add('long_form_rotation', longTypes.every((type, index) => type === LONG_FORM_ROTATION[index % 3]), longTypes.join(','));
  const plain = slots.filter((s) => s.role === 'generated' && PLAIN_SHORT_TYPES.includes(s.short_form_type));
  const plainCounts = PLAIN_SHORT_TYPES.map((type) => count(plain, (s) => s.short_form_type === type));
  add('short_types_balanced', !plain.length || Math.max(...plainCounts) - Math.min(...plainCounts) <= 1, plainCounts.join(','));
  add('short_types_not_repeated_in_day', days.every((day) => {
    const types = (day.slots ?? []).filter((s) => PLAIN_SHORT_TYPES.includes(s.short_form_type)).map((s) => s.short_form_type);
    // Repeats are allowed only when a day has more plain short posts than types.
    return types.length > PLAIN_SHORT_TYPES.length || new Set(types).size === types.length;
  }));
  const generatedEveryDay = days.map((day) => (day.slots ?? []).filter((s) => s.role === 'generated'));
  add('structure_not_repeated_in_day', generatedEveryDay.every((day) => new Set(day.map((s) => s.structure)).size === day.length));
  add('hook_not_repeated_in_day', generatedEveryDay.every((day) => new Set(day.map((s) => s.hook_archetype)).size === day.length));
  add('known_structures_and_hooks', slots.every((s) => s.role !== 'generated' || (STRUCTURES.includes(s.structure) && HOOK_ARCHETYPES.includes(s.hook_archetype))));
  const hookCounts = HOOK_ARCHETYPES.map((hook) => count(slots, (s) => s.hook_archetype === hook));
  add('hook_archetypes_balanced', Math.max(...hookCounts) - Math.min(...hookCounts) <= 1, hookCounts.join(','));

  return {
    status: checks.every((check) => check.status === 'PASS') ? 'PASS' : 'FAIL',
    totals: {
      posts: slots.length,
      threads: threads.length,
      short_form: count(slots, (s) => s.content_type === 'short-form'),
      greatest_hits: count(slots, (s) => s.role === 'greatest_hit_repost'),
      ctas: ctaTotal,
      cta_target: target,
    },
    checks,
  };
}

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return JSON.parse(data);
}

async function main(argv) {
  const [command] = argv;
  if (!['build', 'check'].includes(command)) throw new Error('usage: week-plan.mjs build|check < input.json');
  const input = await readStdin();
  const result = command === 'build' ? buildPlan(input) : { ...checkPlan(input) };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status !== 'PASS') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: 'failed', error: error.message })}\n`);
    process.exitCode = 1;
  });
}
