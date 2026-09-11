# Your Next Moves

Use this workflow when you have an offer and one or more buyer conversations but do not know what deserves attention next. Start locally from the conversations the user supplies. Follow [Threadify-001](../../docs/threadify-001.md) only when a specific step would benefit from a current connection.

Ask:

> Use Your Next Moves with my offer and these conversations. Show me no more than three supported actions, one at a time.

## What it does

1. Reuse the confirmed offer. If it is missing, run [Offer Builder](../offer-builder/README.md), confirm the result, and return to this workflow.
   Lock the offer facts. Do not invent curriculum, deliverables, results, promises, prices or limits. Ask only for a missing fact that would change fit or the next action.
2. Import only a source reference, observed time and factual evidence needed to judge the conversation. Keep the full source private and available for reinspection. Label a locally supplied conversation `not_rechecked` unless it was reopened in the current run.
3. Classify a person as a lead only when the evidence shows interest in help or an offer relevant to the confirmed offer. An explicit relevant help request still counts when phrased as a question. A generic public question remains a conversation signal. Recipient interest does not grant private-channel permission.
4. Prepare no more than three actions supported by the evidence. Do not pad the list. `next-actions` may return fewer or none.
5. Run `review` and show its single bound action. The owner decides `approve` or `reject` for that exact hash.
6. Before an approved external action, reopen the source. If fresh inspection changes the proposed action, prepare and review a new exact action. For private contact, confirm recipient interest and permission for the proposed channel. Run `begin-attempt` before the host acts, then record `succeeded`, `confirmed_not_sent` or `unknown` from real evidence.

If the supplied conversations are insufficient and current public research is needed, invoke [Qualified Buyer Research](../qualified-buyer-research/README.md). Reuse its Offer Context, qualification gates, narrow-query order, five-result sampling, and stop limits instead of starting another open-ended search. It may stage one offer-free public reply in a verified composer when requested, but it always stops before Send. Reopen the source before proposing any new external action from inspected research.

An `unknown` result blocks replay. `confirmed_not_sent` returns the exact action to approved review. Optional reminders only return a host-native review candidate and create nothing.

## Local command shape

```sh
node ~/.threadify-workflows/current/cli/bin/threadify-workflows.mjs conversations next-actions --state /absolute/private/directory
node ~/.threadify-workflows/current/cli/bin/threadify-workflows.mjs conversations review --state /absolute/private/directory
```

The installed path above follows the installer's active-release link. If `THREADIFY_WORKFLOWS_HOME` was set during installation, use that state root instead of `~/.threadify-workflows`. From a source checkout, use `node bin/threadify-workflows.mjs`. Writes read JSON from standard input and require the exact current `--revision`.

Run `node examples/conversations/walkthrough.mjs` from a source checkout for a synthetic, no-network example of `init`, `add-evidence`, `next-actions`, `prepare-action`, exact review, decision and receipt. The exact JSON fields are in `examples/conversations/walkthrough.fixture.json`. It tests mechanics and is not customer, market or provider evidence.

## Manual fallback

When the state engine or a provider tool is unavailable, keep a private table with offer fit, minimal evidence, proposed action, exact text, destination, approval and outcome. Show one row at a time. Do not claim a send, save or provider inspection without readback.
