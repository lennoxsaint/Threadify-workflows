---
name: threadify-follow-through
description: Track explicit promises and due dates from buyer conversations until a truthful outcome is recorded. Use for commitment review, due follow-up and review-only reminders.
---

# Threadify Follow Through

Read `references/threadify-001.md`, `references/workflow-manifest.json` and `references/workflow-readme.md` from this skill directory.

Use the installed exact-release CLI at `node ~/.threadify-workflows/current/cli/bin/threadify-workflows.mjs conversations`; when `THREADIFY_WORKFLOWS_HOME` was set during installation, resolve the same path below that state root. In a source checkout, use `node bin/threadify-workflows.mjs conversations`.

Use only explicit promises supported by a source. Each commitment needs an owner and due date and starts `open`. Vague intent and silence do not qualify.

Use `commit` with the exact state revision. For any proposed follow-up, show one bound action at a time and require `approve` for that display. Reinspect the source and verify private-channel permission before `begin-attempt`. Persist before the host acts, then reconcile the action receipt.

Close a commitment only with `outcome` and one of `fulfilled`, `declined`, `withdrawn` or `uncertain`. Preserve whether the evidence is `owner_reported` or `provider_observed`; call it verified only when authoritative readback supports the claim. Never turn no reply, a like or elapsed time into fulfilment or permission.

Run `reminder` only on request. It returns a host-native opt-in candidate with `created:false` and `automatic:false`. Do not create a reminder silently, and never let a reminder send or approve a follow-up. When the engine or host capability is unavailable, use the private manual list in the workflow README.
