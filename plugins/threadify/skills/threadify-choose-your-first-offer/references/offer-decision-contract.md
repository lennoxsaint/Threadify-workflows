# Offer decision contract

## Models

- `intensive`: one-to-one diagnosis and decision session; fastest learning and lowest build cost.
- `lab`: small cohort or community-guided delivery; tests repeated demand and group delivery.
- `kit`: self-serve workflow and templates; highest build burden before learning.

## Scorecard

Score every model from 1 to 5 and attach one short evidence note to every score.

| Criterion | Weight | Question |
|---|---:|---|
| audience evidence fit | 30 | Does available evidence support this delivery model for this audience and problem? |
| speed to valid signal | 25 | How quickly can a real person accept, reject, or meaningfully engage with the offer? |
| credible deliverability now | 20 | Can the creator deliver the promised result truthfully with current skills and assets? |
| fulfillment simplicity | 15 | Can the creator fulfill without building a large system first? |
| scalability | 10 | Can the model serve more people after the result is validated? |

Weights are fixed. Ties go to speed to valid signal, then fulfillment simplicity.

## Evidence states

- `evidence_informed_hypothesis`: the supplied evidence window and relevant lanes are complete.
- `constraint_led_hypothesis`: evidence is partial or owner-supplied; constraints can still select the cheapest useful test, but the result must not be presented as data-proven.

## Claim ceiling

The output chooses what to validate first. It does not prove demand, willingness to pay, sales, conversion, product-market fit, or virality. An inactive page is a proof object, not a live market test.
