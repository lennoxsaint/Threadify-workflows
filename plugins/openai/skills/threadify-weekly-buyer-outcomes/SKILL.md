---
name: threadify-weekly-buyer-outcomes
description: Review the past seven days of buyer actions and commitments with owner-reported, provider-observed and unknown outcomes kept separate. Use for a weekly buyer-results check.
---

# Threadify Weekly Buyer Outcomes

Read `references/threadify-001.md`, `references/workflow-manifest.json` and `references/workflow-readme.md` from this skill directory.

Use the installed exact-release CLI at `node ~/.threadify-workflows/current/cli/bin/threadify-workflows.mjs conversations`; when `THREADIFY_WORKFLOWS_HOME` was set during installation, resolve the same path below that state root. In a source checkout, use `node bin/threadify-workflows.mjs conversations`.

Run `weekly-outcomes` against the private conversation state using the owner's timezone. Show the exact rolling seven-day start and end. Keep `owner_reported` results separate from `provider_observed` evidence, and leave missing provider evidence unknown. Call a provider-observed result verified only when authoritative readback directly supports the claim.

Do not infer leads, calls, offers, payments or sales from likes, follows, views, generic thanks or silence. Keep open commitments and unknown deliveries visible.

Propose a next action only when the recorded evidence supports it. If proposed, use the same one-action review, exact hash, `approve` or `reject` decision, source reinspection and pending-attempt controls as Your Next Moves.

Connect only when a current readback would close a specific evidence gap. If unavailable, retain the local evidence class and state the manual check needed.
