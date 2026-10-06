import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  CTA_TARGETS,
  HOOK_ARCHETYPES,
  LONG_FORM_ROTATION,
  STRUCTURES,
  buildPlan,
  checkPlan,
} from '../../plugins/threadify/skills/threadify-run-my-threads/scripts/week-plan.mjs';

const script = 'plugins/threadify/skills/threadify-run-my-threads/scripts/week-plan.mjs';
const base = { start_date: '2026-10-06', mode: 'balanced', short_day: 'sunday', seed: 1 };
const slotsOf = (plan) => plan.days.flatMap((day) => day.slots);
const ctas = (slots) => slots.filter((slot) => slot.cta !== 'none').length;

test('every mode, seed and short day passes every invariant', () => {
  for (const mode of Object.keys(CTA_TARGETS)) {
    for (const auto_plug of [true, false]) {
      for (const seed of [0, 1, 2, 3, 4, 5, 6, 7, 52, -1]) {
        for (const short_day of ['sunday', 'monday', 'wednesday', 'saturday']) {
          const plan = buildPlan({ ...base, mode, seed, short_day, auto_plug });
          const failed = plan.checks.filter((check) => check.status !== 'PASS');
          assert.deepEqual(failed, [], `${mode} ${auto_plug} ${seed} ${short_day}`);
        }
      }
    }
  }
});

test('a week is 35 posts: 6 threads, 29 short-form and one greatest hit a day', () => {
  const plan = buildPlan(base);
  assert.equal(plan.status, 'PASS');
  assert.deepEqual(
    { posts: plan.totals.posts, threads: plan.totals.threads, short_form: plan.totals.short_form, greatest_hits: plan.totals.greatest_hits },
    { posts: 35, threads: 6, short_form: 29, greatest_hits: 7 },
  );
  const sunday = plan.days.find((day) => day.weekday === 'sunday');
  assert.equal(sunday.has_thread, false);
  assert.ok(sunday.slots.every((slot) => slot.content_type === 'short-form'));
  for (const day of plan.days) {
    assert.equal(day.slots.length, 5);
    const hits = day.slots.filter((slot) => slot.role === 'greatest_hit_repost');
    assert.equal(hits.length, 1);
    assert.equal(hits[0].content_type, 'short-form');
    assert.equal(hits[0].cta, 'none');
  }
});

test('long-form rotates teacher, storyteller, synthesizer', () => {
  const longTypes = slotsOf(buildPlan(base)).filter((slot) => slot.content_type === 'long-form').map((slot) => slot.long_form_type);
  assert.deepEqual(longTypes, [...LONG_FORM_ROTATION, ...LONG_FORM_ROTATION]);
});

test('CTA counts follow the mode', () => {
  const growth = buildPlan({ ...base, mode: 'growth' });
  assert.equal(growth.totals.ctas, 0);
  assert.ok(slotsOf(growth).every((slot) => slot.short_form_type !== 'listicle-plug'));

  const balanced = buildPlan(base);
  assert.equal(balanced.totals.ctas, 14);
  for (const day of balanced.days) assert.equal(ctas(day.slots), 2);
  for (const day of balanced.days.filter((d) => d.has_thread)) {
    assert.equal(day.slots.find((slot) => slot.content_type === 'long-form').cta, 'plug');
  }

  const conversion = buildPlan({ ...base, mode: 'conversion' });
  assert.equal(conversion.totals.ctas, 25);
  for (const day of conversion.days) assert.ok([3, 4].includes(ctas(day.slots)));
});

test('without Auto Plug, thread plugs move to listicle-plug posts and conversion caps at 22', () => {
  const balanced = buildPlan({ ...base, auto_plug: false });
  assert.equal(balanced.totals.ctas, 14);
  assert.ok(slotsOf(balanced).every((slot) => slot.cta !== 'plug'));
  const conversion = buildPlan({ ...base, mode: 'conversion', auto_plug: false });
  assert.equal(conversion.status, 'PASS');
  assert.equal(conversion.totals.ctas, 22);
  assert.match(conversion.checks.find((check) => check.name === 'cta_total_matches_mode').detail, /capped at 22 without Auto Plug/);
});

test('structures and hook archetypes never repeat within a day and come from the playbook', () => {
  const plan = buildPlan({ ...base, mode: 'conversion' });
  for (const day of plan.days) {
    const generated = day.slots.filter((slot) => slot.role === 'generated');
    assert.equal(new Set(generated.map((slot) => slot.structure)).size, generated.length);
    assert.equal(new Set(generated.map((slot) => slot.hook_archetype)).size, generated.length);
    for (const slot of generated) {
      assert.ok(STRUCTURES.includes(slot.structure));
      assert.ok(HOOK_ARCHETYPES.includes(slot.hook_archetype));
      assert.match(slot.brief, new RegExp(`Structure: ${slot.structure}`));
    }
  }
});

test('the same input rebuilds the same plan; a new seed rotates it', () => {
  assert.deepEqual(buildPlan(base), buildPlan(base));
  assert.notDeepEqual(buildPlan(base).days, buildPlan({ ...base, seed: 2 }).days);
});

test('a tampered plan fails its check', () => {
  const plan = buildPlan(base);
  plan.days[0].slots[0].cta = 'listicle_plug';
  assert.equal(checkPlan(plan).status, 'FAIL');
  const noHit = buildPlan(base);
  noHit.days[2].slots[3].role = 'generated';
  assert.equal(checkPlan(noHit).status, 'FAIL');
});

test('bad input is rejected', () => {
  assert.throws(() => buildPlan({ ...base, start_date: '2026-02-30' }), /real date/);
  assert.throws(() => buildPlan({ ...base, mode: 'viral' }), /mode/);
  assert.throws(() => buildPlan({ ...base, short_day: 'someday' }), /short_day/);
  assert.throws(() => buildPlan({ ...base, seed: 1.5 }), /seed/);
});

test('CLI: build exits 0 with JSON, check re-verifies, bad input exits 1', () => {
  const built = spawnSync(process.execPath, [script, 'build'], { input: JSON.stringify(base), encoding: 'utf8' });
  assert.equal(built.status, 0, built.stderr);
  const plan = JSON.parse(built.stdout);
  assert.equal(plan.record_type, 'RunMyThreadsWeekPlanV1');
  const checked = spawnSync(process.execPath, [script, 'check'], { input: built.stdout, encoding: 'utf8' });
  assert.equal(checked.status, 0, checked.stderr);
  assert.equal(JSON.parse(checked.stdout).status, 'PASS');
  plan.days[0].slots.pop();
  const broken = spawnSync(process.execPath, [script, 'check'], { input: JSON.stringify(plan), encoding: 'utf8' });
  assert.equal(broken.status, 1);
  const bad = spawnSync(process.execPath, [script, 'build'], { input: '{"start_date":"nope"}', encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /"status":"failed"/);
});
