# Choose Your First Offer

Choose which delivery model to validate first after a creator has clarified their niche or audience.

## Invoke now

Tell your agent: “Use Choose Your First Offer to compare an intensive, lab, and kit with the same evidence-bound scorecard.”

The workflow uses fixed weights: audience-evidence fit 30%, speed to a valid signal 25%, credible deliverability now 20%, fulfillment simplicity 15%, and scalability 10%. It creates a decision report, Proof Loop Map, inactive validation page, and body-free receipt. It does not publish, create an offer record, contact buyers, or claim demand.

## Local use

Prepare an input matching `schemas/offer-decision.v1.json`, then run:

```sh
node skills/threadify-choose-your-first-offer/scripts/choose-offer.mjs INPUT OUTPUT_DIR
```

Complete evidence produces an `evidence_informed_hypothesis`. Partial evidence produces a `constraint_led_hypothesis`; it never silently fills missing counts. Both states require a real market test.

## Verification boundary

`npm test` checks fixed models and weights, scoring, tie-breaking, escaping, incomplete-evidence labeling, inactive CTA output, and bundle parity. It does not prove demand, willingness to pay, live Threadify access, or business performance.
