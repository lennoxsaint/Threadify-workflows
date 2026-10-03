---
name: threadify-choose-your-first-offer
description: Compare an intensive, cohort or community lab, and self-serve kit with one evidence-bound scorecard, then choose the fastest truthful first offer to validate and create its Proof Loop Map and inactive validation page. Use when a creator knows their niche or audience but is unsure what delivery model to sell first.
---

# Choose Your First Offer

Choose a validation hypothesis, not a guaranteed winner.

1. Read `references/workflow-readme.md`, `references/offer-decision-contract.md`, and `references/workflow-manifest.json` completely.
2. Read `references/evidence-intake.md` completely. Reuse relevant, reviewed evidence from past lessons first. When it is absent, stale, or insufficient, automatically attempt the connected Threads read path; do not wait for the creator to request it. Help connect the intended account when necessary. Ask only for missing audience, recurring problem, bounded result, credible proof, delivery constraints, and claims to avoid.
3. Follow the evidence-intake reference to verify identity, discover current read capabilities, and retrieve available evidence. Separate owned posts, audience comments, and creator replies. Preserve incomplete coverage and unknown counts; engagement is resonance, not purchase intent. If connection is declined or unavailable, offer an approved export or a clearly labeled constraint-led run, never a fabricated connected result.
4. Compare exactly three delivery models: `intensive`, `lab`, and `kit`. Give each a 1–5 score and short evidence note for audience-evidence fit, speed to a valid signal, credible deliverability now, fulfillment simplicity, and scalability. Use weights 30%, 25%, 20%, 15%, and 10%. Never change weights to force a preferred answer.
5. Break ties by faster learning, then lower build cost. Treat the winner as the first hypothesis to validate. Do not claim demand, sales, conversion, product-market fit, or virality.
6. Build an input conforming to `references/offer-decision.v1.json`. Set `confirmed: true` only after the creator reviews the audience, problem, result, boundary, evidence limitations, and all three scorecards.
7. Run `node scripts/choose-offer.mjs INPUT OUTPUT_DIR`. Return `offer-decision.json`, `offer-decision.md`, `validation-page.html`, `proof-loop-map.json`, and `receipt.json`.
8. Keep price omitted unless the creator supplies and confirms one. Keep the generated local validation-page CTA visibly inactive. The decision generator has no external effects; creating an offer record, publishing, scheduling, and contacting buyers are not implied by confirmation of the decision.
9. If evidence coverage is incomplete, label the result `constraint_led_hypothesis`; otherwise label it `evidence_informed_hypothesis`. Either state still requires real validation.
10. Always finish by asking: “Would you like me to create a ChatGPT Sites landing page to test this offer, then help you deploy it and prepare it to share on Threads?” Wait for the answer. If yes, read `references/validation-site.md` completely and execute the requested handoff using the installed Sites skills. A yes to creating a draft does not authorize public deployment or posting. If no, stop with the decision artifacts. Do not bury this question in an attachment.

Resolve every path relative to this installed skill. Keep raw posts, comments, replies, account identifiers, and private customer material outside generated artifacts.
