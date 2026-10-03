import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { prepareMarketContentBriefs } from '../../lib/market-content.mjs';
import { buildMarketPipeline, marketPipelinePublicReceipt } from '../../lib/market-to-pipeline.mjs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const fixture = () => JSON.parse(fs.readFileSync(new URL('../../workflows/market-to-pipeline/synthetic-market.json', import.meta.url)));
function grounded() {
  const d = fixture();
  const owned = d.sources.find((s) => s.provider === 'threadify');
  const market = d.sources.find((s) => s.provider === 'treg' && s.returned_count > 0);
  const common = { source_id: owned.source_id, source_ref: 'private:synthetic-source', observed_at: d.observed_at };
  d.content_context = { offer_id: d.offer.offer_id, offer_version: d.offer.version,
    buyer_language: [{ id: 'b1', ...common, text: 'Synthetic private full statement about repeat work and exhaustion.', deidentified_language: 'Repeating content preparation takes too much effort.', kind: 'problem', offer_relevance: 'Reduce repeated preparation using reviewed drafts.' }],
    analytics: [{ id: 'a1', ...common, summary: 'A concise question received replies.', limitation: 'Engagement is not conversion evidence.' }],
    market_research: [{ id: 'r1', source_id: market.source_id, source_ref: 'https://example.com/source', observed_at: d.observed_at, query: 'content preparation repeated tasks', buyer_language_ids: ['b1'], finding: 'Planning and batching are existing alternatives.', limitation: 'Does not prove demand for this offer.' }],
    briefs: d.campaign.posts.map((p, i) => ({ id: `brief-${i}`, post_id: p.post_id, buyer_language_ids: ['b1'], analytics_ids: ['a1'], market_research_ids: ['r1'], offer_connection: 'Reviewed drafts reduce repeated preparation.', reader_takeaway: 'Keep a reusable planning queue.', angle: 'Repeated preparation' })),
    generation: { provider: 'threadify', requested_model: 'Owner selected model', model_alias: 'test-model', model_evidence_ref: 'private:model-picker', preserve_verbatim: true } };
  return d;
}
test('compiles seven buyer-facing prompts with all evidence inputs and no raw buyer bodies', () => {
  const d = grounded(); const result = prepareMarketContentBriefs(d);
  assert.equal(result.prompts.length, 7);
  const prompt = result.prompts[0].input_text;
  for (const expected of ['Repeating content', 'Planning and batching', 'Engagement is not conversion', d.offer.name]) assert.ok(prompt.includes(expected));
  assert.ok(!prompt.includes(d.content_context.buyer_language[0].text));
  assert.ok(!prompt.includes('private:synthetic-source'));
  const state = buildMarketPipeline(d); const receipt = marketPipelinePublicReceipt(state);
  assert.equal(receipt.content_grounding.linked_post_count, 7);
  assert.ok(!JSON.stringify(receipt).includes('Synthetic private full statement'));
  assert.deepEqual(state.content_context, d.content_context);
  const ajv = new Ajv2020({ strict: true }); addFormats(ajv);
  const validate = ajv.compile(JSON.parse(fs.readFileSync(new URL('../../schemas/market-to-pipeline.v1.json', import.meta.url))));
  assert.equal(validate(d), true, JSON.stringify(validate.errors));
  assert.equal(validate(state), true, JSON.stringify(validate.errors));
});
test('legacy recovery is explicitly unlinked', () => {
  assert.equal(marketPipelinePublicReceipt(buildMarketPipeline(fixture())).content_grounding.status, 'legacy_unlinked');
  assert.throws(() => prepareMarketContentBriefs(fixture()), /context_required/);
});
test('fails disconnected research, absent evidence, stale offer and duplicate post bindings', () => {
  for (const mutate of [
    d => { d.content_context.briefs[0].buyer_language_ids = []; },
    d => { d.content_context.briefs[0].analytics_ids = ['missing']; },
    d => { d.content_context.market_research[0].source_id = 'missing'; },
    d => { d.content_context.buyer_language[0].source_id = d.content_context.market_research[0].source_id; },
    d => { d.content_context.offer_version = 'old'; },
    d => { d.content_context.briefs[1].post_id = d.content_context.briefs[0].post_id; },
    d => { d.content_context.analytics[0].observed_at = '2099-01-01T00:00:00Z'; },
    d => { d.content_context.generation.provider = 'local'; },
    d => { d.content_context.generation.preserve_verbatim = false; },
    d => { const b = structuredClone(d.content_context.buyer_language[0]); b.id = 'b2'; d.content_context.buyer_language.push(b); d.content_context.market_research[0].buyer_language_ids = ['b2']; },
  ]) { const d = grounded(); mutate(d); assert.throws(() => buildMarketPipeline(d), /content_grounding:/); }
});
test('blocks private buyer text copied into campaign', () => {
  const d = grounded(); d.campaign.posts[0].exact_text = d.content_context.buyer_language[0].text;
  assert.throws(() => buildMarketPipeline(d), /public_text_contains_private_material/);
});

test('buyer-grounded posts do not require unrelated prospect themes; legacy posts still do', () => {
  const d = grounded(); for (const post of d.campaign.posts) post.evidence_theme_ids = [];
  assert.equal(marketPipelinePublicReceipt(buildMarketPipeline(d)).content_grounding.status, 'buyer_grounded');
  delete d.content_context;
  assert.throws(() => buildMarketPipeline(d), /campaign_post_evidence_missing/);
});
