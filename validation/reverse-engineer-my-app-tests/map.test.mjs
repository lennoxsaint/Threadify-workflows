import assert from 'node:assert/strict';
import test from 'node:test';
import { anglesFor, buildBriefs, buildMap, checkPost } from '../../plugins/threadify/skills/threadify-reverse-engineer-my-app/scripts/feature-map.mjs';
import { PICKS, reaMap } from './fixture.mjs';

test('a REA map needs 5-10 features, each with a location or an exact quote', () => {
  const built = buildMap(reaMap());
  assert.equal(built.status, 'ok');
  assert.match(built.table, /\| F1 \| one-tap export \| turns any board into a PDF from the share menu \| REA: https:\/\/app\.example\.com\/assets\/index-abc123\.js line 1, column 20451 · route candidate \/export \|/);
  assert.match(built.table, /\| F5 \| templates \| .* \| "start from 8 ready-made templates" \(https:\/\/app\.example\.com\/\) \|/);
  assert.match(built.table, /Unknowns: whether exports are kept after download/);
  assert.match(built.table, /It says nothing about the server\./);
  assert.match(built.map.map_sha256, /^[0-9a-f]{64}$/);
  const few = reaMap();
  few.features = few.features.slice(0, 4);
  assert.match(buildMap(few).problems.join(' '), /5-10 features \(got 4\)/);
  const noLocation = reaMap();
  delete noLocation.features[1].evidence.line;
  assert.match(buildMap(noLocation).problems.join(' '), /F2: REA evidence needs a line/);
  assert.match(buildMap(reaMap({ limitations: [] })).problems.join(' '), /REA's limitations/);
});

test('the map refuses any claim about the server', () => {
  for (const what of ['saves every board to our server', 'stores your boards in a database', 'runs a backend job each night', 'encrypts files at rest']) {
    const map = reaMap();
    map.features[0].what = what;
    const result = buildMap(map);
    assert.equal(result.status, 'blocked', what);
    assert.match(result.problems.join(' '), /F1: says what happens on the server/);
  }
});

test('a pasted list or product page works without REA', () => {
  const list = reaMap({ source: 'list', limitations: [] });
  list.features = list.features.slice(0, 5).map((feature) => ({ ...feature, evidence: { kind: 'quote', quote: feature.what, from: 'your list' } }));
  assert.equal(buildMap(list).status, 'ok');
});

test('seven briefs, one per day, each a different angle, and the user win only when supplied', () => {
  const { map } = buildMap(reaMap());
  const result = buildBriefs({ map, picks: PICKS });
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.briefs.map((brief) => brief.angle), ['what_it_does', 'why_i_built_it', 'problem_it_kills', 'behind_the_scenes', 'fact_from_map', 'distribution_take', 'ask_the_audience']);
  assert.deepEqual(result.briefs.map((brief) => brief.day), [1, 2, 3, 4, 5, 6, 7]);
  assert.match(result.briefs[5].input_text, /building is cheap, distribution is expensive/);
  assert.match(result.briefs[0].input_text, /use only these facts\. do not mention any other feature, number, customer, result or price\./);
  assert.ok(result.briefs.every((brief) => !brief.input_text.includes('—')), 'no em dashes in briefs');
  const withWin = buildBriefs({ map, picks: PICKS, owner: { user_win: 'a teacher exported 30 boards before class' } });
  assert.equal(withWin.briefs[6].angle, 'user_win');
  assert.match(withWin.briefs[6].input_text, /a teacher exported 30 boards before class/);
  assert.ok(withWin.briefs[6].allowed_numbers.includes('30'));
  assert.equal(anglesFor({ user_win: '   ' })[6].id, 'ask_the_audience');
  assert.match(buildBriefs({ map, picks: PICKS.slice(0, 6) }).problems.join(' '), /exactly 7 picks/);
  assert.match(buildBriefs({ map, picks: ['F1', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6'] }).problems.join(' '), /7 different features/);
  assert.match(buildBriefs({ map, picks: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F99'] }).problems.join(' '), /pick F99 is not in the map/);
});

test('the fact check rejects a feature or a number that is not in the map', () => {
  const { map } = buildMap(reaMap());
  const brief = buildBriefs({ map, picks: PICKS }).briefs[2];
  const good = checkPost({ map, brief, text: 'jumping between boards used to take forever. now 12 shortcuts do it.', claims: [{ text: '12 shortcuts', feature_id: 'F3' }] });
  assert.deepEqual(good.reasons, []);
  assert.equal(good.status, 'PASS');
  const newNumber = checkPost({ map, brief, text: '40 shortcuts and 3,000 happy users.', claims: [{ text: 'shortcuts', feature_id: 'F3' }] });
  assert.deepEqual(newNumber.reasons, ['number_not_in_map:40', 'number_not_in_map:3000']);
  const newFeature = checkPost({ map, brief, text: '12 shortcuts and an ai assistant.', claims: [{ text: '12 shortcuts', feature_id: 'F3' }, { text: 'ai assistant', feature_id: null }] });
  assert.deepEqual(newFeature.reasons, ['feature_not_in_map:ai assistant']);
  const offTopic = checkPost({ map, brief, text: 'dark mode is here.', claims: [{ text: 'dark mode', feature_id: 'F2' }] });
  assert.deepEqual(offTopic.reasons, ['missing_brief_feature:F3']);
  const style = checkPost({ map, brief, text: 'shortcuts — synced on our server. see https://app.example.com', claims: [{ text: 'shortcuts', feature_id: 'F3' }] });
  assert.deepEqual(style.reasons, ['server_claim', 'em_dash', 'link_in_post']);
  assert.equal(checkPost({ map, brief, text: 'shortcuts.', claims: [] }).status, 'FAIL', 'claims are required');
});
