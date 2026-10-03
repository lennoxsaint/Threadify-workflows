# Exact edits and durable scheduling

Use the bundled `references/lib/grill-to-post.mjs` with Node 18 or later. It makes no provider calls. Provider evidence and creator approval must come from the actual session; this helper checks their binding, not their authenticity.

Keep one dedicated `grill-to-post/delivery/` directory under the creator's private folder across runs. The existing private state store provides owner-only permissions, atomic writes, checksums, revisions and writer locks. Do not replace its state, invent another directory, or delete a lock to get past an unresolved action. If storage is unavailable (including unsupported private state on Windows), keep the packet local and report the block without scheduling.

## Exact first line

Run `node <skill>/references/lib/grill-to-post.mjs first-line` with this JSON on stdin:

```json
{
  "draft": { "account_id": "verified-account", "draft_id": "existing-draft", "parts": ["Original first line\n\nUnchanged body", "Unchanged second part"], "media": [] },
  "selected": "The creator's exact chosen line"
}
```

These values are illustrative, not account evidence. Save the original, selected line and returned expected draft in the private folder before editing. The helper preserves line endings and all remaining characters without trimming or normalization. Only an authenticated deterministic editor or a verified exact-replacement tool may save the expected text to that existing draft. The AI-instruction tool `edit_draft` is not that surface.

After provider readback, run `verify-draft` with `{ "expected": <saved expected draft>, "actual": <fresh readback> }` on stdin. It checks every part and media, not just the opening words. A mismatch or missing deterministic editor leaves the choice local, the provider draft unverified and scheduling blocked for that draft. For other exact wording requests, save the complete expected draft with only the creator-authorized replacement and use the same deterministic save and full readback check.

## Scheduling protocol

1. Before presenting approval, normalize each exact provider draft into a row with `action: "schedule_post"`, `account_id`, `draft_id`, `parts` (one string per part, in order), `media`, `scheduled_at` (ISO instant with offset), `timezone` (IANA name) and `auto_repost` (the verified effective setting, including its trigger parameters when enabled). Use explicit empty media and disabled auto-repost values, never unknown-as-off. Check support for stable idempotency keys, draft identity and authoritative readback in the current schemas; if missing, stop at the local packet.
2. Run `node <skill>/references/lib/grill-to-post.mjs hash` with each row on stdin. Save the packet, returned row hashes and the real creator's approval evidence and timestamp as private JSON before delivery. Never derive approval from a provider setting. Any changed field needs fresh display and approval.
3. Re-read the existing journal with `node <skill>/references/lib/grill-to-post.mjs read <private-delivery-directory>`. Reconcile any unresolved attempt first. Never create a second packet to bypass a pending row, even with a different account, draft ID or slot.
4. Refresh the account, exact draft, validation, calendar, timezone, minimum lead time and auto-repost settings against the approved row. Then run `begin <private-delivery-directory>` with `{ "row": <approved row>, "approval": { "row_hash": <saved hash>, "evidence_ref": <actual approval reference>, "at": <approval timestamp> }, "now": <current ISO time> }` on stdin. No provider action may run until this command exits successfully. A crash or uncertain local write must be followed by journal readback, never blind dispatch.
5. `next_action: "dispatch"` means the pending attempt has been committed. Call `schedule_post` once, mapping the saved row to the current tool schema and using `attempt.idempotency_key` unchanged. `reconcile` means read provider status for that saved key/draft; do not dispatch. `done` means the row already has a confirmed receipt; do not dispatch. The helper does not grant permission or perform these calls itself.
6. Run `reconcile <private-delivery-directory>` with a receipt on stdin. Every receipt includes `account_id`, `draft_id`, the saved `idempotency_key`, `evidence_ref` and `checked_at`. Normalize actual provider reads into the same row shape; never fill missing provider fields by copying approval data. A confirmed schedule additionally needs `status: "scheduled"`, `authoritative: true`, `provider_ref` and the exact matching `row`. If the provider reports an equivalent UTC instant, normalize it to the approved representation only after verifying instant equality.
7. A timeout, lost response, incomplete readback or ambiguous result uses `status: "unknown"`; it remains `schedule_unverified` and cannot dispatch on resume. An empty calendar alone is also unknown. Only authoritative terminal proof that this key was not accepted may use `status: "not_accepted"`, `authoritative: true`, `definitive: true`. That records `failed` and permits a fresh preflight then `begin` with the same key for the unchanged row. A changed row still requires new approval. Do not treat pending provider processing as failure.

If the provider accepted a row but the response was lost, a restarted host loads the durable attempt, receives `reconcile` from `begin`, finds the authoritative scheduled record and saves `scheduled_confirmed` without a second scheduling call. If readback remains unavailable, stop with `schedule_unverified`. Leave confirmed sibling rows intact. Scheduling is not publication.
