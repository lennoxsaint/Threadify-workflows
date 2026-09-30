# Customer setup engine

Start with **Get Set Up**. Do not run the entire catalog or ask the customer to select workflows.

## Private state and recovery

Use a new dedicated owner-only directory under `~/.threadify-workflows/customers/<session>/setup`; creator records belong in its sibling `creator` directory. Keep profile content out of command arguments, logs and release assets. The engine reuses the creator store's atomic writes, checksum, revision check and writer lock. A changed revision means read status again, not overwrite. Inspect/recover only a verified dead writer lock using the existing store recovery functions.

Public interface: `setup start`, `setup resume`, `setup status`, `setup verify`. Helpers: `setup discover`, `setup summary-hash`. Input is JSON on stdin. `start`: client, pinned version and canonical install receipt. `resume`: event plus phase-specific data and `--revision` from the last result. Existing sessions cannot change account, version or client silently.

Events in order: runtime, connection, discovery, summary, brain, offer, vault, voice, permission, week, routine-configured, routine. Later: begin-run, finish-run, pause, unpause. Evidence has `kind: observed`, `reference`, `observed_at`, explicit `account` where relevant. This is host-normalized evidence, not an independent verifier. Never use simulated evidence in customer records.

Summary facts: audience, voice, comma-separated topics, outcome, timezone, posts_per_day (1–5), times (one distinct HH:MM per post). Each source carries reference and supports. The customer confirms the exact `summary-hash`; keep their confirmation reference. A changed summary preserves history, invalidates downstream phases and pauses the routine until reconfirmed.

Brain evidence: summary_hash, processing_complete, retrieval_verified, durable_voice_verified. Offer: confirmed_none or readback_verified with offer_ids. Vault: selection_approved, readback_verified. Voice: sample_approved, sample_hash. All include matching summary_hash.

Week evidence: summary_hash, timezone, days:7, actual draft_count, content_verified, scheduled_count, calendar_readback_verified when scheduled. Reviewed drafts awaiting approval are shown as prepared, not scheduled. Automatic mode requires the prepared first week to have matching schedule readback.

Routine evidence: selected client/account, permission_id returned from the permission event, job_id, persisted, real_run_verified, run_id, next_run, device_must_stay_on, pause_command and runner (`native` or `os-scheduler`). Record routine-configured before the first invocation. Reconcile that invocation with finish-run, then record routine with local_run_id matching the reconciled run. Record the real provider/configuration reference, not a guessed job ID.

begin-run preflight: account, timezone, checked_at within five minutes, connection_ok, entitled, facts_current, allowance_ok, calendar_read, occupied_instants. A pending run blocks another; finish it only with verified/confirmed_no_actions/blocked evidence and its exact run_id. Unknown remains pending. Pause prevents future work but does not cancel already scheduled posts; explain that difference.

## Terms

- Setup ready: all required observations recorded; fresh provider checks still support a live claim.
- Brain ready: approved sources processed and retrievable, durable voice instructions verified.
- Standing scheduling permission: customer's revocable, account/topic/time-bound consent; not a global reply/publish switch.
- Routine verified: persistent configuration read back and one real agent invocation observed.
- First week prepared: actual drafts exist for seven days; approval and scheduling are separate states.

## Package migration

This replaces the separate v0.1 customer ZIP's one-result route. Preserve its customer files and receipts. Do not silently migrate confirmed facts into a different account. Read those files as customer-provided sources, ask to confirm the new summary, and create a separate v1 setup directory. Existing edits and old receipts remain intact.

Use the canonical account UUID in setup state and creator cards. Display the verified handle alongside it; a handle is not a substitute for the creator account_id.

## Operator proof and orchestration surfaces

Completion must produce one compact operator proof for the customer: verified release/runtime, verified account handle, Brain/retrieval/voice state, first-week draft and scheduled counts, outstanding review, routine state, next run, pause control and honest blockers. The proof is a view of existing receipts, never a new source of truth. It must not expose the canonical account UUID, private source paths, draft bodies or credentials in a public recording.

OpenAI Dots may orchestrate a supported runtime, but `dot` is not a native installation target in this release. A Dot must delegate filesystem work to an approved Codex or other supported target on a connected computer, then read the exact receipt back. Repository browsing, a task request or a claimed delegation is not installation proof.

For the first week, `draft_count` counts new drafts and `existing_occupied_count` counts preserved scheduled slots in the agreed seven-day plan. Their sum must equal the planned slots. Existing slots require `existing_slots_readback_verified`; `scheduled_count` counts only the new drafts actually scheduled. Never create extra drafts to replace occupied slots. Review mode may leave new drafts awaiting approval.

Before the initial week, `begin-batch` acquires the same persisted pending record as recurring `begin-run`, without requiring a configured routine. Both need current account/entitlement/facts/quota/calendar preflight. Standing scheduling binds that run ID; after finish-run, old approvals cannot execute. Unknown outcomes stay pending. Calendar preflight must include all scheduled posts in the seven-day range; posts at other times count toward daily frequency.

Use the next seven complete local posting days: start today only when the first agreed daily time is still at least five minutes ahead; otherwise start tomorrow. Recurring checks retain existing scheduled posts and do not backfill missed times today. Show these seven actual dates when confirming the plan.

For a recurring `finish-run`, include `job_id` and `runner_run_id` from the actual host invocation. `routine` must reference that exact reconciled job/run, local run ID and current permission. Reconfiguring a job clears previous recurring verification.
