# Local review contract

The optional repository CLI prepares a private, portable review without connecting to a provider:

```sh
node bin/threadify-workflows.mjs greatest-hits review --input /private/input.json --output-dir /private/new-review
```

Use a new directory outside public source control. The output files are `review.private.json` and `review.private.html`; the directory is private to its owner on systems supporting POSIX permissions. The tool refuses an existing directory. Open the HTML locally; it needs no server, scripts or external requests. Media references are displayed as text, never fetched automatically. Review the actual assets privately before approving. Neither the page nor a fingerprint grants approval, verifies ownership, validates a provider payload or schedules anything.

## Input

Supply `account`, an IANA `timezone`, `snapshotAt`, an inclusive-start/exclusive-end `window`, `slots`, `sources` and `calendar`. All timestamps need an explicit UTC offset. Use the intended account's live calendar, with complete pagination, including neighboring posts inside the desired conflict buffer. `calendar.start` and `calendar.end` describe the interval actually checked, not just the requested interval. Refresh immediately before scheduling; snapshot verification is not a freshness guarantee.

Each slot has `id`, `at`, `kind` (`short` or `thread`) and either `source` or `existingId`. An existing slot must match a unique calendar ID and exact instant. Existing posts stay unchanged even if they clash with one another; explain and resolve such conflicts separately with approval. Unmapped queued posts remain in `existingQueue` and still block nearby proposals. A planner that skips an occupied day must not erase that day's remaining slots.

Each source has `id`, `revision`, `kind`, `family`, `historyComplete`, `lastUsedAt` (null only when complete history confirms no previous use), `hydrated`, ordered `chain` parts containing full `text` and `media` reference arrays, dated `performanceAt`, `openingLikes`, `freshness` (`confirmed` only after claims/offer review) and a `changedClaims` array explaining edits. `hydrated: true` attests that the full chain and media have been retrieved; the helper cannot discover omitted replies. Never mark hydration or history complete merely because a field exists. The hosted source remains authoritative.

`calendar` contains `account`, `snapshotAt`, `start`, `end`, `complete` and `rows`. Each row requires `id`, `account` and `at`; include source/family where known to exclude queued duplicates. A source's `historyComplete` must cover queued families too. Draft status labels are not calendar evidence. Incomplete coverage blocks all proposals.

Optional `policy` fields are non-negative numbers: `minOpeningLikes` (default 0, but performance must still be known), `cooldownDays` (default 0), `minSpacingMinutes` (default 120 between proposals), `liveBufferMinutes` (default 30 around existing posts). Set thresholds and format mix from the owner's plan; a personal 12-week strategy is not bundled. Supply one slot per desired format, rather than replacing missing threads with shorts. Duplicate families are excluded within the entire batch. Selection is chronological first eligible supplied source, not a reproduction of hosted ranking or posting-time analytics.

## Synthetic example

These invented account/source labels and copy demonstrate the shape only. Save as private input when trying the CLI:

```json
{
  "account": "synthetic-account",
  "timezone": "UTC",
  "snapshotAt": "2030-01-02T00:00:00Z",
  "window": { "start": "2030-01-03T00:00:00Z", "end": "2030-01-04T00:00:00Z" },
  "policy": { "minOpeningLikes": 50, "cooldownDays": 90 },
  "calendar": {
    "account": "synthetic-account", "snapshotAt": "2030-01-02T00:00:00Z",
    "start": "2030-01-02T23:30:00Z", "end": "2030-01-04T00:30:00Z",
    "complete": true, "rows": []
  },
  "sources": [{
    "id": "synthetic-source", "revision": "r1", "kind": "short",
    "family": "synthetic-family", "historyComplete": true, "lastUsedAt": null,
    "hydrated": true, "chain": [{ "text": "An invented example for a local review.", "media": [] }],
    "performanceAt": "2030-01-01T00:00:00Z", "openingLikes": 50,
    "freshness": "confirmed", "changedClaims": []
  }],
  "slots": [{ "id": "slot-1", "at": "2030-01-03T08:00:00Z", "kind": "short", "source": "synthetic-source" }]
}
```

## Approval and uncertain operations

The packet has a deterministic revision and per-proposal fingerprint over account, source/revision, full ordered copy/media, changes, format and time. The owner approves that exact packet in chat. Edits invalidate the affected row's validation and approval. The idempotency key is a local intent key, usable as a provider field only when the current schema supports it.

`reconcileRunwayIntent` is a pure helper for an adapter that supplies normalized live readback: `{ complete, rows: [{ id, status, account, at, chain }] }`. Supply the entire ordered chain and media and the same offset timestamp representation; a representation difference stays unverified rather than guessing equivalence. Only an explicit normalized `status: "scheduled"` with one complete exact match confirms scheduling. Cancelled, failed, published or missing status stays unverified for scheduling. A missing, partial, mismatched or duplicate result is unverified and never authorizes retry. Persist the returned provider ID as `scheduledPostId` on the original intent when available. This helper never issues or retries a request. Reconciliation does not prove publication.

Keep the original packet, validation, owner approval and provider receipts in private storage. Do not commit personal corpora, queue snapshots or this run's exports. An unavailable receipt must remain labelled unavailable; do not generate a link to a missing hosted hub.
