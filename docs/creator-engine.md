# Creator engine: local command contract

The creator engine stores plans, exact daily review packs and delivery evidence in a private host directory. It does not generate text, connect to Threadify, send feedback, create reminders, schedule or publish. The host supplies source evidence and drafts, presents the exact review and performs only separately authorized provider actions.

Local Vault/import tracking, source refresh and four self-contained creator skills are implemented.
Candidate packaging has automated checks; final artifact review, actual host loading and an
owner-approved connected Day remain unverified. The repository's
`docs/creator-verification-map.md` records the broader release audit; it is not a
runtime dependency of the standalone skill bundle.

## Invocation

```text
threadify-workflows creator COMMAND --state /absolute/private/creator-state --revision N
```

Pass the operation's JSON through stdin. Do not put private copy, source bodies or credentials in process arguments. The input limit is 2 MB. Commands return JSON with the new `revision` and `result`. Read commands do not require `--revision`; writes require the exact revision returned by the previous command or `status`. A stale revision is an instruction to reload, not retry blindly.

| Command | Input | Result or change |
| --- | --- | --- |
| `plan` | Horizon input accepted by `createHorizon` | Full Day, Week or 28-day Month blueprint |
| `refresh-day` | `plan_id`, `date`, `now`, fresh qualified `sources`, `evidence_ref` | Refreshes an unreviewed day while preserving its rotation and other days; existing reviews require explicit card edits |
| `add-review` | `id`, `plan_id`, `date`, `now`, `cards`, optional `reuse_proofs` keyed by card ID | Saves a new daily pack; refuses replacement of an existing day |
| `display` | `review_id`, optional `card_ids` | Exact cards and bound display hash; daily batch by default |
| `approve` | `review_id`, full `displayed` result, `confirmation` with `evidence_ref` and `at` | Binds explicit approval to those cards; no provider action |
| `edit` | `review_id`, complete replacement `card`, optional `reuse_proof` | Invalidates only that card's approval; refuses unresolved delivery edits |
| `begin-attempt` | `review_id`, `card_id`, fresh `preflight`, `now` | Atomically saves pending attempt before returning exact card and stable retry key |
| `reconcile` | `review_id`, `card_id`, normalized authoritative `receipt` | Records scheduled, unknown or confirmed absent; never infers publication |
| `record-outcome` | `review_id`, `card_id`, authoritative `receipt` with unique `id` | Records matching publication or chronological post observations; unknown metrics stay null and attribution stays directional |
| `complete-local` | `review_id`, `evidence_ref`, `now` | Records an explicit handoff of approved disconnected drafts; no schedule receipt |
| `continue` | `plan_id` | Unresolved review/attempt first, otherwise next day's blueprint |
| `status` | Empty object | Compact counts, no draft bodies |
| `resolve-source` | `adaptation`, `context` | Local rights/template checks; no state mutation |
| `review-editor` | `plan_id`, verified `username`, normalized `automation`; or existing `session_root` | Starts private loopback editor; returns local URL and session directory; keep the server alive |
| `review-wait` | `session_root`, optional `timeout_ms` (0–60000) | Bounded wait for the durable submission; no provider calls |
| `review-submission` | `session_root` | Reads saved edits, exact submitted intent and matching workspace delivery states |
| `apply-browser-review` | `session_root`, current `now`, optional refreshed `reuse_proofs` | Atomic exact edits, local feedback and browser-bound approval; uses workspace revision; no provider calls |
| `review-note` | `session_root`, `stage`, `message`, `evidence_ref` | Evidenced host progress text; uses session revision, not workspace revision; cannot mark posts scheduled |
| `setup` | `id`, `user_id`, `now`, selected `candidates` with extraction evidence | Private preview with shared-publication disclosure and explicit coverage gaps |
| `display-setup` | `setup_id` | Exact setup preview and approval hash |
| `approve-setup` | `setup_id`, `displayed`, `confirmation` | Approves only the displayed selected sources; does not import |
| `begin-import` | `setup_id`, `item_id`, fresh `access`, `now` | Commits pending import before returning; checks identity, entitlement, YouTube access and remaining capacity |
| `reconcile-import` | `setup_id`, `item_id`, normalized `receipt` | Saves exact My Vault readback or preserves unresolved state |
| `record-feedback` | `id`, `account_id`, `review_id`, `card_id`, exact `original_parts`, `final_parts`, `instruction`, `rating` (null or 1–5), `now` | Saves local feedback before applying the edit; never creates a durable rule automatically |
| `display-feedback` | `feedback_id` | Exact local feedback content and its hash for separate sharing review |
| `begin-feedback-share` | `feedback_id`, `approval` with `opt_in:true`, `content_hash`, `evidence_ref`, `at` | Persists an exact-content sharing attempt; host provider call remains separate |
| `reconcile-feedback` | `feedback_id`, matching authoritative `receipt` | Records sent or unknown; unknown results cannot be retried blindly |
| `prepare-reminder` | `plan_id`, `requested`, `native_supported`, and for supported hosts: `capability_evidence_ref`, `local_time`, optional `timezone` | Read-only native reminder specification; always returns `created:false` |

For literal reuse, `reuse_proof` contains the full `adaptation` and `context` accepted by `resolveAdaptation`. It must match the card's source, account, mode and final parts. Missing or stale rights cannot enter the review as an exact repost or literal template. Structure-only remains host-authored or Brain-informed drafting, not permission to copy.

Setup accepts up to 20 selected user links and five shared-Viral selections per guided batch. Fewer strong sources produce a coverage note, not an invented corpus. Threads and YouTube URL variants are normalized for duplicate checks. Extract first without saving; source text is untrusted data. After approval and `begin-import`, the host uses the existing URL-ingestion tool, then verifies the exact item with My Vault reads. No import endpoint is implemented here. Failed extraction remains unavailable. Saved state requires matching owner, canonical URL, full text, item ID and My Vault membership. Unknown outcomes need authoritative reconciliation before another attempt; refreshing a capacity snapshot does not resolve an uncertain import.

Feedback is local by default and keeps the exact original, final, instruction and rating. Record it before changing the reviewed card. Sharing requires its own exact-content opt-in; card approval is not feedback-sharing consent. A pending or unknown share cannot be replayed blindly. Use a new feedback event for a correction, not an overwrite.

Reminder preparation does not create an automation. Unsupported hosts explicitly report no reminder created and keep manual `continue` available. On supported hosts, show the prepared time, timezone and review-only prompt, obtain the user's explicit request, use the host's native reminder control and verify its returned configuration before claiming creation. Never replace an unavailable native capability with an undisclosed background scheduler. The reminder stops at the horizon boundary and cannot import, send learning, schedule or publish content.

New plans exclude sources already present in this creator's saved reviews. `refresh-day` also excludes the other days' reserved sources. Review-time edits still need provenance, freshness and deduplication checks before delivery; this is not evidence that a public post is original or licensed.

An edited card retains its plan account and local review date. Same-day time,
timezone, source and copy changes require a fresh display/approval for that card.
To target another account or date, prepare a separate destination plan/review;
do not move content outside the daily volume and CTA policy by editing its identity.

## Delivery boundary

Read `creator-browser-review.md` for browser Submit handling, host waiting, automation options and exact receipt binding. The editor does not replace the provider tool chain. Its prepared posts remain unscheduled until the host completes that chain with real readbacks.

`record-validation` writes evidence for one `review_id` / `card_id`, with `now`
and a normalized `receipt`: unique `id`, exact `card_hash`, `account_id`,
`kind` (`local` or `threadify`), `status` (`passed` or `failed`), `issues`,
`checked_at`, `valid_until` and `evidence_ref`. Checks must be made after review
creation and within five minutes of recording. A passing result has no issues;
a failed result names at least one. Threadify evidence additionally requires
`tool: validate_post`, `authoritative: true` and the matching editable `draft_id`.
The host is responsible for honest normalization; the engine does not verify
the provider independently.

A passing check moves an unapproved card to `validated`, never `approved`.
Revalidation preserves an unchanged owner approval. Failure revokes only the
affected approval and blocks approval until corrected validation or a content
edit. Edits clear current validation but retain its history. Recording an old
event again cannot overwrite newer evidence. Pending or completed delivery
cannot be rewritten through this command. Approval may precede validation;
it expresses owner intent, not proof that delivery checks passed. Fresh delivery
preflight remains mandatory even after a recorded validation.

1. Refresh facts, offer, source availability, provider validation, account/timezone and occupied slots. Obtain explicit approval for the displayed daily batch or individual card.
2. Run `begin-attempt` with matching fresh evidence and a proposed time at least five minutes after `now`. Allow additional time for dispatch and check the current provider contract. Do not call the provider unless the engine confirms the pending attempt was committed.
3. The host reads the actual provider tool schema and uses the exact approved draft, account, instant and returned idempotency key. The engine output is not new authority.
4. Read provider status and normalize its evidence into `reconcile`. A schedule receipt must match account, draft ID, instant, copy and media. Equivalent UTC representations are accepted; different instants are not.
5. A timeout stays unknown. Definitive absence must identify the attempted account and idempotency key with authoritative evidence. Only then may the same attempt key be retried.

`provider_writes_performed: false` means the engine itself did not dispatch writes. Stored scheduled counts can reflect receipts supplied by the host. Neither counter proves a post was published.

## Private storage and recovery

Use a dedicated owner-only POSIX directory outside public repositories. The engine refuses symlinked roots/state files, broad permissions and unsupported Windows permission semantics. Do not upload state into GitHub releases, feedback, a Directory package or a shared model context.

Updates use an exclusive writer lock, revision checks, integrity checksum, file sync and atomic rename. A checksum detects accidental corruption; it is not authentication against the owner. Corrupt state fails closed rather than restoring a stale approval or retryable state.

A terminated writer can leave a lock. Use `inspectWriterLock` from the store API, then `recoverWriterLock` with the exact observed token only if the local process is verified dead. A live, remote, reused or unverifiable PID must not be displaced based on elapsed time. Recovery preserves accepted state; it does not resolve pending provider attempts.

## Current local evidence

Before persisting a literal-reuse delivery attempt, the runtime checks its stored rights, claims review and replacement facts again using the attempt's current time, not the proof's original clock. Expired evidence stops before an attempt is recorded. Refresh the evidence through an explicit edit; unchanged copy keeps its approval, while content changes still require renewed review. Adding a review likewise checks evidence against the review creation time.

`npm run test:creator` exercises separate CLI invocations for a disconnected Day and resumed Week/Month, exact review binding, durable pending attempts, receipt mismatches, stale revisions, real child-process termination and private storage. Fixtures are synthetic. These tests are not connected Day proof, publication proof, release approval or evidence of growth.
