import assert from 'node:assert/strict';
import test from 'node:test';
import { POST_CHARS, PLUG_CHARS, buildBriefs, buildMap, checkPlug, checkPost } from '../../plugins/threadify/skills/threadify-reverse-engineer-my-app/scripts/feature-map.mjs';
import { buildCard, buildReceipt, scheduleArgs } from '../../plugins/threadify/skills/threadify-reverse-engineer-my-app/scripts/app-card.mjs';
import { PICKS, reaMap } from './fixture.mjs';

const TEMPLATES = PICKS.map((_, index) => ({
  source: ['viral', 'vault', 'greatest_hits'][index % 3],
  skeleton: '{group} are like "{cliche}!" no it\'s not. look at {proof}. you know who {claimed behaviour}? {weak example}',
}));

const DESTINATION = 'https://app.example.com/start';
const PROOF = [
  { number: '2,013', quote: 'Join 2,013+ creators', from: 'https://app.example.com/' },
  { number: '7', quote: 'Start with a 7-day free trial', from: 'https://app.example.com/' },
  { number: '12', quote: 'lets you jump between boards with 12 shortcuts', from: 'the feature map' },
];
const GOOD_PLUG = `stuck jumping between boards? BoardKit puts 12 shortcuts under your fingers. join 2,013+ creators - 7-day free trial: ${DESTINATION}`;

test('each brief carries its outlier template and the hook, story loop, length and "so what" rules', () => {
  const { map } = buildMap(reaMap());
  const result = buildBriefs({ map, picks: PICKS, templates: TEMPLATES });
  assert.equal(result.status, 'ok');
  for (const [index, brief] of result.briefs.entries()) {
    assert.deepEqual(brief.template, TEMPLATES[index]);
    assert.ok(brief.input_text.includes(TEMPLATES[index].skeleton));
    assert.match(brief.input_text, /fill every \{slot\} with the facts above/);
    assert.match(brief.input_text, /the first sentence opens a story loop/);
    assert.match(brief.input_text, /the first 3-5 words grab the reader/);
    assert.match(brief.input_text, /100-350 characters/);
    assert.match(brief.input_text, /end on one bold, clear, polarizing "so what" line/);
  }
  assert.match(buildBriefs({ map, picks: PICKS, templates: TEMPLATES.slice(0, 6) }).problems.join(' '), /exactly 7 templates/);
  const noSlot = TEMPLATES.map((template) => ({ ...template }));
  noSlot[3].skeleton = 'a copied post with no placeholders';
  assert.match(buildBriefs({ map, picks: PICKS, templates: noSlot }).problems.join(' '), /template 4: a skeleton with at least one \{slot\}/);
  const badSource = TEMPLATES.map((template) => ({ ...template }));
  badSource[0].source = 'my head';
  assert.match(buildBriefs({ map, picks: PICKS, templates: badSource }).problems.join(' '), /template 1: its source/);
});

test('a post outside 100-350 characters fails the check', () => {
  const { map } = buildMap(reaMap());
  const brief = buildBriefs({ map, picks: PICKS, templates: TEMPLATES }).briefs[2];
  const claims = [{ text: '12 shortcuts', feature_id: 'F3' }];
  assert.deepEqual(POST_CHARS, { min: 100, max: 350 });
  assert.deepEqual(checkPost({ map, brief, text: '12 shortcuts.', claims }).reasons, ['length_out_of_range:13']);
  const long = `12 shortcuts. ${'jump between boards without the mouse. '.repeat(9)}`.trim();
  assert.deepEqual(checkPost({ map, brief, text: long, claims }).reasons, [`length_out_of_range:${long.length}`]);
});

test('an Auto Plug is 100-250 characters, links only the offer and every number has a quoted source', () => {
  assert.deepEqual(PLUG_CHARS, { min: 100, max: 250 });
  const good = checkPlug({ text: GOOD_PLUG, destination: DESTINATION, proof: PROOF });
  assert.deepEqual(good.reasons, []);
  assert.equal(good.status, 'PASS');
  assert.deepEqual(checkPlug({ text: 'try BoardKit free', destination: DESTINATION, proof: PROOF }).reasons, ['length_out_of_range:17', 'missing_offer_link', 'no_specific_number']);
  const vague = `jumping between boards all day? BoardKit makes it quick, simple and painless for your whole team. try it free today: ${DESTINATION}`;
  assert.deepEqual(checkPlug({ text: vague, destination: DESTINATION, proof: PROOF }).reasons, ['no_specific_number']);
  const invented = GOOD_PLUG.replace('2,013+', '5,000+');
  assert.deepEqual(checkPlug({ text: invented, destination: DESTINATION, proof: PROOF }).reasons, ['number_without_proof:5000']);
  const quoteMismatch = [{ number: '2,013', quote: 'lots of creators', from: 'https://app.example.com/' }, PROOF[1], PROOF[2]];
  assert.deepEqual(checkPlug({ text: GOOD_PLUG, destination: DESTINATION, proof: quoteMismatch }).reasons, ['number_without_proof:2013']);
  const otherLink = GOOD_PLUG.replace(DESTINATION, 'https://elsewhere.example.com');
  assert.deepEqual(checkPlug({ text: otherLink, destination: DESTINATION, proof: PROOF }).reasons, ['link_not_offer_destination']);
  assert.deepEqual(checkPlug({ text: GOOD_PLUG.replace(' - ', ' — '), destination: DESTINATION, proof: PROOF }).reasons, ['em_dash']);
});

function plan(overrides = {}) {
  const text = (index) => `post ${index + 1}: jumping between boards used to take forever, so BoardKit gives you 12 shortcuts. if you still use the mouse, you are choosing slow.`;
  return {
    account: '@owner',
    timezone: 'Australia/Perth',
    now: '2026-10-13T00:00:00Z',
    ownership: 'yes',
    app: { name: 'BoardKit', source: 'rea', features: 8, observed_at: '2026-10-13T02:00:00Z' },
    posts: PICKS.map((id, index) => ({
      original: text(index),
      final: text(index),
      draft_id: `draft-${index + 1}`,
      model: 'claude-opus-5-5',
      feature_id: id,
      feature_name: `feature ${index + 1}`,
      angle_label: `angle ${index + 1}`,
      fact_check: 'PASS',
      validated: true,
      template: TEMPLATES[index],
      slot: { iso: `2026-10-${String(14 + index).padStart(2, '0')}T18:30:00+08:00`, local: `day ${index + 1}, 6:30 pm` },
      auto_plug: { original: GOOD_PLUG, final: GOOD_PLUG, destination: DESTINATION, validated: true, plug_check: 'PASS' },
    })),
    ...overrides,
  };
}

test('the card needs a template and a passing plug check on every row, and names the template source', () => {
  const ready = buildCard(plan());
  assert.equal(ready.status, 'ready');
  assert.equal(ready.card.match(/template from Threadify's Viral library/g).length, 3);
  assert.equal(ready.card.match(/template from your Vault/g).length, 2);
  assert.equal(ready.card.match(/template from your greatest hits/g).length, 2);
  assert.equal(ready.card.match(/plug check PASS/g).length, 7);
  const noTemplate = plan();
  delete noTemplate.posts[1].template;
  assert.match(buildCard(noTemplate).missing.join(' '), /post 2: its outlier template/);
  const unchecked = plan();
  unchecked.posts[5].auto_plug.plug_check = 'FAIL';
  assert.match(buildCard(unchecked).missing.join(' '), /post 6: the Auto Plug check \(check-plug PASS\)/);
});

test('agent-written copy needs the owner\'s own words asking for it, and the card says who wrote it', () => {
  const agent = plan();
  for (const post of agent.posts) post.author = 'agent';
  assert.match(buildCard(agent).missing.join(' '), /the owner's own words asking the agent to write/);
  agent.author_override = { said: 'you make these changes yourself, not threadify' };
  const ready = buildCard(agent);
  assert.equal(ready.status, 'ready');
  assert.match(ready.card, /Writer: you asked your agent to write these posts, not Threadify \("you make these changes yourself, not threadify"\)/);
  assert.equal(ready.card.match(/written by your agent at your request \(not Threadify\) · facts PASS/g).length, 7);
  assert.ok(!ready.card.includes('written by Threadify'));
  const approved = scheduleArgs({ plan: agent, card_sha256: ready.card_sha256, reply: 'yes' });
  assert.equal(approved.status, 'approved');
  assert.equal(approved.schedule_post[0].draft_id, 'draft-1', 'agent copy is saved as a draft first and scheduled by draft_id');
  const receipt = buildReceipt({ plan: agent, card_sha256: ready.card_sha256, reply: 'yes' });
  assert.equal(receipt.posts[0].author, 'agent_at_owner_request');
  assert.equal(receipt.posts[0].template_source, 'viral');
  assert.equal(receipt.author_override, 'owner_requested');
  assert.ok(!JSON.stringify(receipt).includes('you make these changes yourself'), 'body-free');
});

test('review fixes: a stated template gap, agent-written plugs and a required offer link', () => {
  const gap = plan({ template_unavailable: "Threadify's template tools are not available on this connection" });
  for (const post of gap.posts) delete post.template;
  const ready = buildCard(gap);
  assert.equal(ready.status, 'ready', 'the template-free fallback can still reach approval with its reason');
  assert.equal(ready.card.match(/template: none \(Threadify's template tools are not available on this connection\)/g).length, 7);
  const plugOnly = plan();
  plugOnly.posts[0].auto_plug.author = 'agent';
  assert.match(buildCard(plugOnly).missing.join(' '), /the owner's own words asking the agent to write/);
  plugOnly.author_override = { said: 'write the plugs yourself' };
  const plugCard = buildCard(plugOnly);
  assert.equal(plugCard.status, 'ready');
  assert.match(plugCard.card, /Auto Plug, 50 min after \(written by your agent at your request \(not Threadify\), plug check PASS\)/);
  const noLink = GOOD_PLUG.replace(`: ${DESTINATION}`, ' today.');
  assert.deepEqual(checkPlug({ text: noLink, destination: DESTINATION, proof: PROOF }).reasons, ['missing_offer_link']);
  assert.deepEqual(checkPlug({ text: `${GOOD_PLUG} ${DESTINATION}`, destination: DESTINATION, proof: PROOF }).reasons, ['missing_offer_link']);
});
