# Review and owner-requested editing

Threadify generates originals. Preserve their bytes and model metadata. Default mode is `unchanged`; use `lowercase` only on request, preserving proper nouns with the existing casing guard. A request to improve the draft authorizes `owner-requested edit` within that request, not a new offer, new facts or scheduling. Do not call that casing PASS. A concrete factual problem requires source review even if wording is locked. Style dissatisfaction alone is not permission to rewrite or request replacement drafts.

Before showing a revised packet, compare it to the prior one. For a one-sentence correction, preserve every other byte of public copy, plugs and times. Update only necessary review metadata separately and show the exact final packet. Never reuse approval across revisions. Unsupported facts remain blocked; removing an irrelevant zero-conversion sentence does not authorize implied revenue. Keep the complete analytical evidence locally.

## Local JSON receipt and checker

Run `node scripts/review-packet.mjs < review.json`. Nothing is sent or stored by this pure checker. Save input and output locally; do not commit account analytics or copy to the public repository.

`review.json` contains `packet` with `account`, `timezone`, and exactly three `posts`. Each post has:

- `id`, `scheduled_at` (ISO timestamp with timezone), `destination` (exact saved offer URL).
- `copy` and `plug`: `{original, final, mode, owner_request?, keep?}`. Modes: `unchanged`, `lowercase`, `owner-requested edit`. Keep the original generation model/draft ID in the surrounding local receipt, not schedule arguments for edited text.
- `review.facts` and `review.destination`: `{status: "verified", evidence: "source reference and finding"}`. These are recorded review attestations, not automated semantic proof. Unsupported/unresolved claims or a destination mismatch must not be marked verified. Retain source evidence; never manufacture a receipt to pass the checker.
- `hook`: either `{status: "source-backed", source, metric: {name, value}, original_opening, adapted_opening, limitations}` or `{status: "unproven", adapted_opening, reason}`. The adapted opening must start the final post. Likes alone do not establish a relative outlier; a source's success does not establish hook causality.

The output supplies `packet_sha256` and separate final post/plug hashes. Without approval it returns no scheduling arguments. After showing the exact packet and receiving yes, add `approval: {reply: "yes", packet_sha256}` and `validations: [{id, kind: "post"|"plug", account, sha256, valid: true, validated_at}]` (validated_at is an ISO timestamp less than five minutes old) from fresh successful provider validations of the exact text. Rerun. Its `schedule_args` use exact final text, never an old draft ID, and bind the idempotency key to both post and plug. Recheck calendar and minimum lead time independently before sending. Hash equality is not evidence of user approval: retain the actual reply and packet presented.

For a bounded revision, pass the previous packet as `previous` and exact replacements as `changes: [{path: "posts.0.copy.final", before: "old sentence", after: "new sentence"}]`; each before span must occur once. Include declared review-metadata changes if needed. Undeclared changes fail. This structural check cannot decide whether the change matches the owner's semantic intent; review that explicitly.

After `get_schedule_status`, normalize each authoritative response to `readbacks: [{id, account, status, text, scheduled_at, auto_plug: {content, trigger: "time", delay_minutes: 15}}]`. Resolve history/historyIndex and enabled flags from actual provider fields; a disabled plug cannot be represented as enabled. Retain raw provider receipts separately. Rerun with approval and validations: only exact matches produce `scheduled_verified`. A failed or unclear outcome is read back before retrying; retry only that item with its original key. Never generate new keys to bypass uncertain outcomes.

## Offer and voice review

Use the selected offer and destination evidence to identify what the reader can actually get. No workflow, download or free claim unless supported there. Missing evidence is a question, not permission to infer. Do not change saved offers without a separate owner instruction.

Strong endings should state why the preceding evidence matters in the owner's voice. Bluntness, emotion or polarization must fit that voice; profanity is optional, never a template requirement. Keep public copy clear and concise while retaining limitations in the analytical report. Do not add private brand rules to public bundles.
