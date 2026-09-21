---
name: threadify-post-this-next
description: Review every eligible draft in a verified Threadify account and advise what to finish next for usefulness, owned engagement-pattern fit, or readiness. Jev is advisory; this workflow never edits or publishes.
---

# Threadify Post This Next

Read `references/workflow-readme.md`, `references/workflow-manifest.json`, `references/post-this-next.v1.json` and `references/threadify-001.md` completely before starting.

## Freeze the complete backlog

1. Ask which goal to use: `most_useful_now`, `engagement_pattern_fit`, `closest_to_ready`, or all three. Default to `most_useful_now` only when the user does not choose.
2. Call `get_connection_defaults`, verify the intended owned account, timezone and read capability, and inspect current tool schemas.
3. Use `list_drafts` when exposed. Complete pagination. If the connected MCP exposes draft reads only through a dispatcher, use the current documented read route and record it. Never substitute calendar or published-post rows for draft evidence.
4. Include only unscheduled and unpublished items whose current status is `draft`, `saved`, `review` or `ready`. Preserve every draft ID. Freeze the complete candidate set with exact text, update time and SHA-256. If pagination is incomplete, stop the complete-backlog claim and offer the manual sampled fallback.

## Load only goal-relevant context

- `most_useful_now`: use the confirmed current audience problem, supplied proof, Brain context and selected offer or CTA when available.
- `engagement_pattern_fit`: use comparable owned `read_post_performance` evidence for a stated window. Missing or incomparable metrics stay unknown. Say **pattern fit**, never likely traffic, winner, viral or forecast.
- `closest_to_ready`: use current validation facts, source support, opening, specificity, voice and CTA state. Deterministic factual, rights or account blocks remain code-owned and cannot be overruled by Jev.

## Use the portable Jev adapter

Before a provider call, show the verified account, eligible count, selected goal, exact draft bodies leaving Threadify, provider route and no-write boundary. Continue only after explicit acknowledgement. Never send credentials, private customer material, unrelated chats or hidden account data.

Prefer `assess_jev_fit` plus `evaluate_with_jev` when the installed custom plugin exposes them. Otherwise use compatible typed `jev_score` or `jev_ask` tools. Use fixed criteria from the workflow README. Process every eligible draft; split large sets into deterministic batches of at most 20 drafts and at most 24,000 serialized characters while keeping the rubric identical. Preserve all candidate IDs across batches.

Normalize each criterion to an integer score from 0 through 4 and a confidence from 0 through 1. Bind every evaluation to the exact draft content hash. For a manual fallback, set confidence to `null`, record adapter `manual` and privacy route `local_only`.

Build the private normalized input, then run:

```sh
node scripts/post-this-next-cli.mjs review --input INPUT --output-dir OUTPUT
```

The installed bundle keeps the decision engine beside that script. Present one recommendation only when the validator returns `recommended` or `only_candidate`. For `abstained` or `manual_shortlist`, show the top two and ask the creator to choose. Re-read the displayed draft ID and content hash before the final handoff.

Stop after the advisory result. Do not edit, save, schedule, publish, reply, delete or claim future performance.
