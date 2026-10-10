import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { analyseCorpus, compareRules, loadCorpus, parsePriorRules } from '../../lib/watch-any-creator.mjs';
import { writeCorpus } from './fixture.mjs';

const PRIOR_MARKDOWN = `# Rules from last time

1. Put numbers in your titles
2. Never open with a question
- Talk about pricing more
* Post at 6am every day
`;

test('older rules parse from a Markdown list or JSON', () => {
  const markdown = parsePriorRules(PRIOR_MARKDOWN, 'march.md');
  assert.deepEqual(markdown.map((rule) => rule.text), ['Put numbers in your titles', 'Never open with a question', 'Talk about pricing more', 'Post at 6am every day']);
  const json = parsePriorRules(JSON.stringify({ rules: [{ rule: 'Use a number', feature: 'title_number', direction: 'do' }, 'Plain string rule'] }), 'march.json');
  assert.equal(json[0].feature, 'title_number');
  assert.equal(json[1].text, 'Plain string rule');
  assert.throws(() => parsePriorRules('no list here', 'x.md'), /prior_rules_file_has_no_list_items/);
});

test('then vs now says held, broke, new or untestable with the current evidence', () => {
  const { root, corpus } = writeCorpus();
  try {
    const analysis = analyseCorpus(loadCorpus(corpus));
    const result = compareRules(parsePriorRules(PRIOR_MARKDOWN, 'march.md'), analysis);
    const byPrior = (text) => result.rows.filter((row) => row.prior === text);
    const numbers = byPrior('Put numbers in your titles');
    assert.ok(numbers.some((row) => row.verdict === 'held' && row.evidence.family === 'youtube_long' && row.evidence.lift > 2.5));
    const question = byPrior('Never open with a question');
    assert.equal(question.length, 1);
    assert.equal(question[0].feature, 'hook_question');
    assert.equal(question[0].verdict, 'broke', 'the data says questions win now');
    assert.match(question[0].reason, /^Flipped in long-form/);
    const pricing = byPrior('Talk about pricing more');
    assert.ok(pricing.length >= 1 && pricing.every((row) => row.verdict === 'broke' && /No clear difference/.test(row.reason)));
    const timing = byPrior('Post at 6am every day');
    assert.deepEqual(timing.map((row) => row.verdict), ['untestable'], 'no measure for posting time, so never "held"');
    assert.ok(result.new_rules.length >= 1);
    assert.ok(result.new_rules.every((rule) => rule.verdict === 'new' && rule.evidence_line && rule.example_ids.length));
    assert.ok(!result.new_rules.some((rule) => /number in the title/.test(rule.rule)), 'a matched rule is not new');
    assert.equal(result.summary.untestable, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
