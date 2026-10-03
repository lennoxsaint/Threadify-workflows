# Choose Your First Offer

Choose which delivery model to validate first after a creator has clarified their niche or audience.

## Invoke now

Tell your agent: “Use Choose Your First Offer to compare an intensive, lab, and kit with the same evidence-bound scorecard.”

The workflow uses fixed weights: audience-evidence fit 30%, speed to a valid signal 25%, credible deliverability now 20%, fulfillment simplicity 15%, and scalability 10%. It creates a decision report, Proof Loop Map, inactive validation page, and body-free receipt. The generator does not publish, create an offer record, contact buyers, or claim demand.

Relevant reviewed past-lesson evidence comes first. If missing, stale or insufficient, the skill attempts connected Threads reads by default, helps the user connect when needed, and verifies the intended account. It uses available posts, audience comments and creator replies, preserving partial coverage. Unavailable or declined access falls back to an approved export or a labeled constraint-led hypothesis.

At the end, the skill asks whether to create a ChatGPT Sites landing page to test the offer and help deploy and prepare it for Threads. On opt-in it uses the installed Sites skills and a truthful adaptation of Alex Hormozi's $100M Offers value equation: clear outcome, credible proof, shorter time to a useful result and less buyer effort. No invented proof, guarantees, pricing or scarcity. Draft creation, public deployment and Threads posting remain separate scopes. A working form and verified public access are required before calling the page ready to distribute.

## Local use

Prepare an input matching `schemas/offer-decision.v1.json`, then run:

```sh
node skills/threadify-choose-your-first-offer/scripts/choose-offer.mjs INPUT OUTPUT_DIR
```

Complete evidence produces an `evidence_informed_hypothesis`. Partial evidence produces a `constraint_led_hypothesis`; it never silently fills missing counts. Both states require a real market test.

## Verification boundary

`npm test` checks fixed models and weights, scoring, tie-breaking, escaping, incomplete-evidence labeling, inactive CTA output, and bundle parity. It does not prove demand, willingness to pay, live Threadify access, or business performance.
