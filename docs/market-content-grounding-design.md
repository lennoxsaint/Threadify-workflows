# Buyer-grounded market content

The old campaign validator links posts to themes, but themes can refer only to company discovery. A run can therefore generate seven posts about research mechanics without addressing audience questions.

## Working map

`bin/threadify-workflows.mjs` routes to `lib/market-to-pipeline-cli.mjs`; `buildMarketPipeline` in `lib/market-to-pipeline.mjs` validates packets and writes private state and body-free receipts. `schemas/market-to-pipeline.v1.json` describes the packets. Canonical skill instructions live in `plugins/threadify/skills/threadify-market-to-pipeline`; `scripts/build-advanced-bundles.mjs` copies the registered references into installable skills. `validation/market-pipeline-tests/engine.test.mjs` owns public-interface regression tests.

## Design

Keep audience evidence independent of outreach prospects. A comment can inform content without being a qualified lead, and its author need not be in the prospect geography. Add an optional, strictly validated `content_context` to v1 for backward compatibility. New skill runs require it. Legacy packets remain readable but report `legacy_unlinked` rather than buyer-grounded content.

A small content module validates an offer snapshot, source-referenced buyer language, analytics observations, targeted market findings and one brief per post. Each research query binds to the buyer question that motivated it. Every post must join that buyer evidence, a matching research finding, an analytics choice and the frozen offer. The module compiles deidentified generation prompts; source bodies and private identities never enter those prompts. Analytics guide a format hypothesis, not a sales claim. For grounded posts, `evidence_theme_ids` may be empty because the per-post content brief owns its evidence joins; legacy packets still require prospect themes. Structural links do not prove semantic relevance: the host must review the actual claim and limitation.

An instruction-only change was rejected because it would leave the original silent failure possible. Requiring a new top-level schema version was rejected because existing action receipts must remain readable. A separate module keeps the existing outreach approval and reconciliation implementation unchanged.

Generate through the owner's selected model inside Threadify. Preserve returned text and review factual concerns separately. Model routing, draft generation and public delivery are separate proof states. No new publishing authority is created.
