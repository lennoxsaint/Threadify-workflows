---
name: threadify-choose-your-first-offer
description: Compare an intensive, cohort or community lab, and self-serve kit with one evidence-bound scorecard, then choose the fastest truthful first offer to validate and create its Proof Loop Map and inactive validation page. Use when a creator knows their niche or audience but is unsure what delivery model to sell first.
---

# Choose Your First Offer

Choose a validation hypothesis, not a guaranteed winner.

1. Read `references/workflow-readme.md`, `references/offer-decision-contract.md`, and `references/workflow-manifest.json` completely.
2. Ask for the creator's audience, recurring problem, bounded result, credible proof, delivery constraints, and claims to avoid. Reuse a reviewed niche or profile report when available. Do not require a Threadify connection.
3. If the creator requests connected evidence, discover current read capabilities and verify the selected account and timezone. Separate owned posts, audience comments, and creator replies. Preserve incomplete coverage and unknown counts; engagement is resonance, not purchase intent.
4. Compare exactly three delivery models: `intensive`, `lab`, and `kit`. Give each a 1–5 score and short evidence note for audience-evidence fit, speed to a valid signal, credible deliverability now, fulfillment simplicity, and scalability. Use weights 30%, 25%, 20%, 15%, and 10%. Never change weights to force a preferred answer.
5. Break ties by faster learning, then lower build cost. Treat the winner as the first hypothesis to validate. Do not claim demand, sales, conversion, product-market fit, or virality.
6. Build an input conforming to `references/offer-decision.v1.json`. Set `confirmed: true` only after the creator reviews the audience, problem, result, boundary, evidence limitations, and all three scorecards.
7. Run `node scripts/choose-offer.mjs INPUT OUTPUT_DIR`. Return `offer-decision.json`, `offer-decision.md`, `validation-page.html`, `proof-loop-map.json`, and `receipt.json`.
8. Keep price omitted unless the creator supplies and confirms one. Keep the validation-page CTA visibly inactive. This skill never creates an offer record, publishes a page, schedules content, or contacts a buyer.
9. If evidence coverage is incomplete, label the result `constraint_led_hypothesis`; otherwise label it `evidence_informed_hypothesis`. Either state still requires real validation.

Resolve every path relative to this installed skill. Keep raw posts, comments, replies, account identifiers, and private customer material outside generated artifacts.
