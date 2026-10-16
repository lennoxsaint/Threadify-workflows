import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCutPlan,
  captionsAss,
  creditFor,
  diffWords,
  findRetakes,
  groupCaptions,
  hotEdges,
  licenceAllowed,
  orderSegments,
  parseSilences,
  parseWhisperJson,
  pickModel,
  placeCue,
  sfxGainDb,
  speechIslands,
  videoBitrate,
  wordsThroughSegments,
  KEEP_GAP,
  MAX_FINAL_MB,
} from '../../plugins/threadify/skills/threadify-director-mode/scripts/director-mode.mjs';

// Speak `text` starting at `start`, one word every 0.3 s.
const say = (text, start) => text.split(' ').map((w, k) => ({ w, start: start + k * 0.3, end: start + k * 0.3 + 0.25 }));
const span = (ws) => [ws[0].start, ws[ws.length - 1].end];

test('whisper JSON: one word per segment, sound notes dropped, stray punctuation joined', () => {
  const seg = (text, from, to) => ({ text, offsets: { from, to } });
  const words = parseWhisperJson({ transcription: [
    seg(' (keyboard', 0, 200), seg(' clicking)', 200, 400), seg(' I', 500, 600), seg(' posted', 600, 900), seg('.', 900, 910), seg(' [BLANK_AUDIO]', 1000, 1200),
  ] });
  assert.deepEqual(words.map((x) => x.w), ['I', 'posted.']);
  assert.equal(words[0].start, 0.5);
});

test('silencedetect output parses, including a silence that runs to the end', () => {
  const log = '[silencedetect] silence_start: 1.5\n[silencedetect] silence_end: 2.25 | silence_duration: 0.75\n[silencedetect] silence_start: 9.1\n';
  assert.deepEqual(parseSilences(log, 10), [[1.5, 2.25], [9.1, 10]]);
  assert.deepEqual(speechIslands([[0, 1], [3, 3.5]], 6), [{ start: 1, end: 3 }, { start: 3.5, end: 6 }]);
});

test('cut plan: dead air over 0.3 s shrinks to about 0.1 s and no word is clipped', () => {
  const a = say('my first line here', 1);
  const b = say('then a second line', 4);
  const words = [...a, ...b];
  const silences = [[0, 1], [span(a)[1], 4], [span(b)[1], 7]];
  const plan = buildCutPlan({ words, silences, duration: 7, fps: 1000 });
  assert.equal(plan.lines.length, 2);
  for (const line of plan.lines) {
    const [segStart, segEnd] = [line.segments[0][0], line.segments[line.segments.length - 1][1]];
    assert.ok(segStart <= line.words[0].start - 0.04, 'pad before first word');
    assert.ok(segEnd >= line.words[line.words.length - 1].end + 0.04, 'pad after last word');
  }
  const gap = (plan.lines[0].segments[0][1] - span(a)[1]) + (span(b)[0] - plan.lines[1].segments[0][0]);
  assert.ok(gap >= KEEP_GAP - 0.01 && gap <= 0.16, `kept gap ${gap}`);
  assert.ok(plan.stats.planned_seconds < 7 - 2.5);
});

test('cut plan: a short pause under 0.3 s is kept whole', () => {
  const a = say('one two', 0);
  const b = say('three four', 0.8);
  const plan = buildCutPlan({ words: [...a, ...b], silences: [[span(a)[1], 0.8]], duration: 1.4, fps: 1000 });
  const segs = orderSegments(plan, null);
  assert.equal(segs.length, 1, 'touching segments merge');
  assert.ok(Math.abs(segs[0][1] - segs[0][0] - 1.4) < 0.01);
});

test('retakes: a restarted line keeps only the last clean take', () => {
  const take1 = say('when I say it is just one', 0);
  const take2 = say('when I say it is just one prompt I mean it', 3);
  const other = say('why you should listen', 8);
  const words = [...take1, ...take2, ...other];
  const silences = [[span(take1)[1], 3], [span(take2)[1], 8]];
  const plan = buildCutPlan({ words, silences, duration: 10, fps: 1000 });
  assert.equal(plan.retakes.length, 1);
  assert.match(plan.retakes[0].text, /^when I say it is just one$/);
  assert.deepEqual(plan.lines.map((l) => l.text), ['when I say it is just one prompt I mean it', 'why you should listen']);
  const vetoed = buildCutPlan({ words, silences, duration: 10, fps: 1000, keepRetakes: ['r1'] });
  assert.equal(vetoed.lines.length, 3, 'the agent can keep a false positive');
});

test('retakes: different lines that share a common phrase are not cut', () => {
  const lines = [
    { start: 0, end: 2, words: say('i want to show you the dashboard today', 0) },
    { start: 3, end: 5, words: say('then i want coffee', 3) },
  ];
  assert.deepEqual(findRetakes(lines), []);
});

test('retakes: a restart inside one breath is cut between words', () => {
  const words = say('so when I say it when I say it is one prompt', 0);
  const plan = buildCutPlan({ words, silences: [], duration: 3.6, fps: 1000 });
  assert.equal(plan.retakes.length, 1);
  assert.equal(plan.retakes[0].inline, true);
  assert.equal(plan.lines[0].text, 'so when I say it is one prompt');
  assert.equal(plan.lines[0].segments.length, 2);
});

test('order: lines move, unknown or repeated lines are refused, words can be trimmed', () => {
  const a = say('the setup line', 0);
  const b = say('posted every day for 1100 days', 2);
  const plan = buildCutPlan({ words: [...a, ...b], silences: [[span(a)[1], 2]], duration: 4, fps: 1000 });
  const segs = orderSegments(plan, ['L2', 'L1']);
  assert.ok(segs[0][0] > segs[1][0], 'proof line now plays first');
  assert.throws(() => orderSegments(plan, ['L2', 'L2']), /used twice/);
  assert.throws(() => orderSegments(plan, ['L9']), /unknown line/);
  const trimmed = orderSegments(plan, [{ id: 'L2', start_word: 1 }]);
  assert.ok(trimmed[0][0] > b[0].end - 0.001 && trimmed[0][0] < b[1].start);
  const words = wordsThroughSegments(plan.lines, segs);
  assert.equal(words[0].w, 'posted');
  assert.ok(words[0].start < 0.2);
});

test('captions: lowercase, at most 3 words, break at sentence ends; highlight the spoken word', () => {
  const words = say('I posted DAILY. For 1,100 days now', 0);
  const groups = groupCaptions(words);
  assert.ok(groups.every((g) => g.length <= 3));
  assert.deepEqual(groups.map((g) => g.map((x) => x.w).join(' ')), ['i posted daily', 'for 1100 days', 'now']);
  const { ass, max_words } = captionsAss(words);
  assert.equal(max_words, 3);
  assert.match(ass, /PlayResX: 1920/);
  assert.match(ass, /\{\\c&H004A6BFF\}posted\{\\c&H00FFFFFF&\}/);
  assert.equal((ass.match(/^Dialogue:/gm) ?? []).length, words.length);
});

test('Openverse licence filter: CC0 and public domain only, CC BY on opt-in, never NC/ND/SA', () => {
  assert.equal(licenceAllowed({ license: 'cc0' }), true);
  assert.equal(licenceAllowed({ license: 'pdm' }), true);
  assert.equal(licenceAllowed({ license: 'by' }), false);
  assert.equal(licenceAllowed({ license: 'by' }, { allowBy: true }), true);
  for (const license of ['by-nc', 'by-sa', 'by-nd', 'by-nc-sa', 'by-nc-nd', 'sampling+', '']) {
    assert.equal(licenceAllowed({ license }, { allowBy: true }), false, license);
  }
  const credit = creditFor({ id: 'x', title: 'Whoosh', creator: 'Ann', license: 'by', license_version: '4.0', foreign_landing_url: 'https://freesound.org/s/1/' });
  assert.equal(credit.needs_credit, true);
  assert.equal(credit.credit_line, '"Whoosh" by Ann (CC BY 4.0) https://freesound.org/s/1/');
  assert.equal(creditFor({ id: 'y', license: 'cc0' }).needs_credit, false);
});

test('loudness: sound effects sit 15 LU under the voice', () => {
  assert.equal(sfxGainDb(-16, -20), -11);
  assert.equal(sfxGainDb(-19.5, -20), -14.5);
  assert.equal(sfxGainDb(-23, -14, 12), -21);
  assert.throws(() => sfxGainDb(Number.NaN, -20));
});

test('cue placement: the loud start of a sound never covers a word onset', () => {
  const onsets = [1.0, 1.3, 1.6, 3.0];
  assert.equal(placeCue(2.2, onsets), 2.2);
  const moved = placeCue(1.25, onsets);
  assert.ok(onsets.every((o) => !(o > moved - 0.03 && o < moved + 0.15 + 0.03)), `moved to ${moved}`);
  assert.equal(placeCue(0.5, [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1], { search: 0.1 }), null);
});

test('word diff finds a word lost at a join, and ignores "any time" vs "anytime"', () => {
  const ref = say('you can pause it any time today', 0);
  const got = say('you can pause it anytime today', 0);
  assert.deepEqual(diffWords(ref, got).missing, []);
  const clipped = diffWords(say('and then we posted', 0), say('then we posted', 0));
  assert.deepEqual(clipped.missing.map((x) => x.w), ['and']);
});

test('size cap and model choice', () => {
  const bps = videoBitrate(90);
  assert.ok(((bps + 192000) * 90) / 8 / 1e6 < MAX_FINAL_MB);
  assert.equal(pickModel(['/m/ggml-base.en.bin', '/m/ggml-small.en.bin', '/m/for-tests-ggml-tiny.bin']), '/m/ggml-small.en.bin');
  assert.equal(pickModel(['/m/for-tests-ggml-tiny.bin']), null);
});

test('retakes: a restart at the very start of a line leaves no sliver of the first take', () => {
  const words = say('when I say it when I say it is one prompt', 1);
  const plan = buildCutPlan({ words, silences: [[0, 1], [words[words.length - 1].end, 5]], duration: 5, fps: 1000 });
  assert.equal(plan.lines[0].text, 'when I say it is one prompt');
  assert.equal(plan.lines[0].segments.length, 1);
  assert.ok(plan.lines[0].segments[0][0] > words[3].end, 'starts after the abandoned take');
  assert.equal(plan.retakes[0].removed[0], words[0].start);
});

test('clip check: a cut edge inside loud sound is flagged, quiet edges pass', () => {
  const levels = Array.from({ length: 300 }, (_, k) => [k * 0.01, k >= 100 && k < 200 ? -20 : -70]);
  assert.deepEqual(hotEdges(levels, [[0, 0.95], [2.05, 3]], -40), []);
  const hot = hotEdges(levels, [[0, 1.5], [2.05, 3]], -40);
  assert.equal(hot.length, 1);
  assert.equal(hot[0].edge, 'end');
});
