# Post This Next

Use Post This Next when your Threadify Chat contains a backlog of saved drafts and generating another post would only postpone the decision.

Ask:

> Read every eligible draft in my verified Threadify account and run Post This Next. Compare what is most useful now, what best fits my owned engagement patterns, and what is closest to ready. Do not edit, schedule or publish anything.

## What it does

1. Verifies the intended Threadify account and the current read-only draft capability.
2. Completes pagination and freezes every unscheduled, unpublished `draft`, `saved`, `review` or `ready` item by immutable ID and content hash.
3. Lets the creator choose `Most useful now`, `Best match to owned engagement patterns`, `Closest to publishable`, or compare all three.
4. Loads only the context required by that goal. Engagement evidence describes pattern fit; it does not predict views, virality, sales or future performance.
5. Shows the exact draft bodies and provider route before sending task-relevant text to Jev. A provider call requires explicit acknowledgement.
6. Normalizes results from the installed custom Jev plugin, `jev-code`, or another compatible typed-decision adapter.
7. Recommends one draft only when the winning minimum confidence is at least `0.80` and its lead is at least `10` points. Otherwise it abstains and shows the top two.
8. Re-reads the selected draft ID and content hash before presenting the result. It never edits, saves, schedules, publishes or deletes.

## Goal language

- **Most useful now:** audience relevance, supplied evidence, specificity, novelty against the recent feed, and current CTA or offer fit.
- **Best match to owned engagement patterns:** alignment with comparable owned post patterns. This is not a traffic prediction.
- **Closest to publishable:** factual support, opening, specificity, voice and CTA readiness.

The `0.80` confidence and `10`-point margin are conservative provisional display rules, not proof of correctness. The workflow remains advisory and the creator makes the final decision.

## Local validation

Prepare the normalized private input, then run:

```sh
node ~/.threadify-workflows/current/cli/bin/threadify-workflows.mjs post-this-next review \
  --input /absolute/private/post-this-next-input.json \
  --output-dir /absolute/private/post-this-next-result
```

From a source checkout, use `node bin/threadify-workflows.mjs` instead. The result and Markdown remain private. The receipt stores hashes, counts, provider metadata and statuses without draft bodies.

## Manual fallback

If Threadify cannot return complete pagination, do not claim the complete backlog was reviewed. If Jev is unavailable, over budget, malformed or declined, apply the selected scorecard locally and return a top-two `manual_shortlist`. Never turn the fallback into a Jev, traffic or publication claim.
