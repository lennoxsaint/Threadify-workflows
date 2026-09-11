---
name: threadify-your-next-moves
description: Review supplied buyer conversations against a confirmed offer and prepare up to three evidence-backed next actions, one at a time. Use when the owner asks what to do next with current conversations.
---

# Threadify Your Next Moves

Read `references/threadify-001.md`, `references/workflow-manifest.json` and `references/workflow-readme.md` from this skill directory.

Start locally with the user's offer and supplied conversations. Do not ask for a provider choice first. If no confirmed offer exists, invoke `threadify-offer-builder`, confirm its local handoff, then resume this workflow.

Lock the confirmed offer facts before interpreting a conversation. Never add a curriculum, deliverable, result, promise, price or limit that the offer record does not contain. Ask only for a missing fact that would materially change fit or the next action.

Use the installed exact-release CLI at `node ~/.threadify-workflows/current/cli/bin/threadify-workflows.mjs conversations`; when `THREADIFY_WORKFLOWS_HOME` was set during installation, resolve `current/cli/bin/threadify-workflows.mjs` below that state root instead. In a source checkout, use `node bin/threadify-workflows.mjs conversations`. Choose an absolute private state directory on macOS or Linux. Keep the full conversation source outside the workflow state. Import only the stable source reference, observation time and factual evidence needed for the decision.

A lead requires evidence of interest in help or an offer relevant to the confirmed offer. An explicit relevant help request counts as recipient interest even when it is phrased as a question, such as "I want help with this. Does your offer cover it?" A generic public question does not qualify. Recipient interest remains separate from permission to use a private channel. Prepare up to three actions only when each has direct support; returning none is valid. Run `review` and present exactly one bound action and its hash.

For conversations supplied locally, label the source `not_rechecked` unless it was reopened in the current run, and require reinspection before action. When additional public research is needed, invoke `threadify-qualified-buyer-research` and reuse its Offer Context, qualification gates, narrow-query order, five-result sampling, and stop limits. Do not create a second open-ended search loop here. Qualified Buyer Research may stage one offer-free public reply in a verified composer when requested, but it always stops before Send. Reopen the source before proposing any new external action from inspected research.

Treat the bundled synthetic fixture only as a mechanics test. Label it synthetic and never cite it as customer, market or provider evidence.

Use `decide` with `approve` or `reject` only after the owner responds to that exact display. Approval is not delivery. Before an external action, re-open the source and provide fresh inspection evidence; if the action changed after inspection, prepare and review a new bound action. For private contact, require both recipient interest and permission for the proposed channel. Persist with `begin-attempt` before the host acts, then reconcile with `receipt`. Never replay `attempt_pending`, `unknown` or `succeeded` actions.

If a host tool is unsupported, provide the manual artifact in the workflow README. Optional reminders are review-only candidates, require explicit host-native opt-in and send nothing.
