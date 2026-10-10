import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { MIN_GROUP, analyseCorpus, checkThread, compareFeature, FEATURES, generationBriefs, loadCorpus, rulesMarkdown } from '../../lib/watch-any-creator.mjs';
import { writeCorpus } from './fixture.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const cli = path.join(root, 'lib/watch-any-creator.mjs');

// The bracket penalty adds a real avoid rule, so the ranking has the seven
// actionable rules a thread needs.
function analysed(options = {}) {
  const fixture = writeCorpus(options);
  return { ...fixture, analysis: analyseCorpus(loadCorpus(fixture.corpus)) };
}

test('the ranking recovers every planted rule with its evidence numbers', () => {
  const { root: dir, analysis } = analysed();
  try {
    const ids = analysis.rules.map((rule) => rule.rule_id);
    assert.equal(ids[0], 'youtube_short:title_warning', 'the strongest planted effect ranks first');
    for (const expected of ['youtube_long:title_number', 'youtube_long:hook_question', 'youtube_long:length:20-40 min']) {
      assert.ok(ids.includes(expected), `${expected} is ranked`);
    }
    const number = analysis.rules.find((rule) => rule.rule_id === 'youtube_long:title_number');
    assert.equal(number.direction, 'do');
    assert.equal(number.evidence.n_with, 60);
    assert.equal(number.evidence.n_without, 60);
    assert.ok(number.evidence.lift > 2.5 && number.evidence.lift < 3.5, `lift ${number.evidence.lift}`);
    assert.equal(number.example_ids.length, 3);
    assert.ok(number.example_ids.every((id) => id.startsWith('synthL')), 'examples come from the same family');
    assert.match(number.evidence_line, /^\d[\d,]* vs \d[\d,]* median views\/day \(60 vs 60 long-form videos\) = \d/);
    assert.deepEqual(analysis.rules.map((rule) => rule.rank), analysis.rules.map((_, index) => index + 1));
    for (let index = 1; index < analysis.rules.length; index += 1) assert.ok(analysis.rules[index - 1].score >= analysis.rules[index].score);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a topic word that splits the same videos as a stronger rule is redundant, not ranked', () => {
  const { root: dir, analysis } = analysed();
  try {
    assert.ok(analysis.redundant.some((entry) => entry.feature === 'topic:lessons' && entry.same_videos_as === 'title_number'));
    assert.ok(!analysis.rules.some((rule) => rule.feature === 'topic:lessons'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Shorts and long-form are never ranked against each other', () => {
  const { root: dir, analysis } = analysed();
  try {
    assert.equal(analysis.shorts_vs_long.status, 'descriptive_only');
    assert.ok(analysis.rules.every((rule) => [rule.family].includes(rule.rule_id.split(':')[0])));
    assert.ok(!analysis.rules.some((rule) => rule.family === 'youtube_short' && rule.axis === 'hook'), 'hooks are read from long-form transcripts only');
    assert.equal(analysis.families.youtube_long.comparison_status, 'comparative');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a comparison under 20 videos on one side is descriptive only', () => {
  const extras = new Map();
  const items = [];
  for (let index = 0; index < 30; index += 1) {
    const id = `e${index}`;
    items.push({ evidence_id: id, native_id: `vid${index}`, title: index < 19 ? `${index + 1} ways to sell` : 'the way to sell', metrics: { views: 1000 }, published_at: '2026-01-01T00:00:00Z' });
    extras.set(id, { views_per_day: index < 19 ? 900 : 100, duration_seconds: 100 });
  }
  const result = compareFeature(FEATURES.find((feature) => feature.id === 'title_number'), 'youtube_long', items, extras, true);
  assert.equal(MIN_GROUP, 20);
  assert.equal(result.status, 'descriptive_only');
  assert.equal(result.score, 0);
  assert.equal(result.evidence.lift, null);
});

test('the analyse CLI writes rules.json and rules.md in a private folder', () => {
  const { root: dir, corpus } = writeCorpus();
  try {
    const out = path.join(dir, 'work');
    const run = spawnSync(process.execPath, [cli, 'analyse', '--corpus', corpus, '--out', out], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    const summary = JSON.parse(run.stdout);
    assert.equal(summary.status, 'analysed');
    assert.equal(summary.counts.unique_videos, 280);
    assert.ok(summary.top_rules.length >= 5);
    assert.ok(summary.seconds < 30);
    const markdown = fs.readFileSync(path.join(out, 'rules.md'), 'utf8');
    assert.match(markdown, /^# @SyntheticCreator: the rules in 280 videos/);
    assert.match(markdown, /\| 1 \| Lead with a warning or a mistake \(Shorts\) \|/);
    assert.equal(fs.statSync(path.join(out, 'rules.json')).mode & 0o077, 0, 'owner-only file');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the Threadify briefs carry the evidence, never finished copy, and the thread gate checks the shape', () => {
  const { root: dir, analysis } = analysed({ plantBracketPenalty: true });
  try {
    const briefs = generationBriefs(analysis, { account: '@owner', agent: 'Claude' });
    assert.match(briefs.thread_input_text, /ten-post Threads thread in my voice for @owner/);
    assert.match(briefs.thread_input_text, /ends with a line that starts "copy this:"/);
    assert.match(briefs.thread_input_text, /280 @SyntheticCreator videos, so I had Claude watch them/);
    assert.match(briefs.thread_input_text, /Rule 1: Lead with a warning or a mistake \(Shorts\)\. Evidence: /);
    assert.equal(briefs.rule_ids.length, 7);
    assert.ok(rulesMarkdown(analysis).length > 0);
    const good = ['hook', ...Array.from({ length: 7 }, (_, index) => `${index + 1}. rule\n\ncopy this: [x]`), 'do this today', 'comment who is next'];
    assert.equal(checkThread({ posts: good }).status, 'PASS');
    assert.equal(checkThread({ posts: good.map((text) => ({ text })) }).status, 'PASS');
    const bad = checkThread({ posts: [...good.slice(0, 3), 'no template here', ...good.slice(4, 9), 'x'.repeat(501)] });
    assert.equal(bad.status, 'FAIL');
    assert.deepEqual(bad.reasons, ['post 4 has no "copy this:" line', 'post 10 is 501 characters (limit 500)']);
    assert.match(checkThread({ posts: good.slice(0, 9) }).reasons[0], /needs exactly 10 posts, got 9/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('every ranked rule carries a template that matches its direction', () => {
  const { root: dir, analysis } = analysed({ plantBracketPenalty: true });
  try {
    assert.ok(analysis.rules.some((rule) => rule.direction === 'avoid'), 'the planted avoid rule is ranked');
    for (const rule of analysis.rules) {
      assert.ok(rule.copy_this, `${rule.rule_id} has a template`);
      if (rule.direction !== 'avoid') continue;
      const feature = FEATURES.find((entry) => entry.id === rule.feature);
      assert.ok(feature, `${rule.rule_id}: an avoid rule is a fixed feature, never a length bucket or a topic`);
      assert.equal(rule.copy_this, feature.avoid_copy, `${rule.rule_id} uses the avoid template`);
      assert.notEqual(rule.copy_this, feature.copy, `${rule.rule_id} never tells the viewer to copy what it says to skip`);
    }
    for (const feature of FEATURES) assert.ok(feature.avoid_copy, `${feature.id} has an avoid template`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an avoid length rule stays out of the ranking but is still compared', () => {
  const { root: dir, analysis } = analysed();
  try {
    assert.ok(!analysis.rules.some((rule) => rule.axis === 'length' && rule.direction === 'avoid'), 'no avoid length rule is ranked');
    assert.ok(analysis.comparisons.some((entry) => entry.axis === 'length'), 'length buckets are still compared for then-vs-now');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
