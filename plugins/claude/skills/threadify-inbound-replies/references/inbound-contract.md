# Local packet interface v1

Run from the repository root:

```sh
node tools/inbound/cli.mjs configure --packet /path/to/config.json
node tools/inbound/cli.mjs window --account @example
node tools/inbound/cli.mjs import --packet /path/to/snapshot.json
node tools/inbound/cli.mjs drafts --packet /path/to/drafts.json
node tools/inbound/cli.mjs serve --account @example
node tools/inbound/cli.mjs status --account @example
```

All mutations take `--packet FILE`; packets contain `version: 1` and `account`. All commands support `--root DIRECTORY` for isolated state. Default state is in the user's `.local/share/threadify-workflows/inbound` directory, outside the checkout. Output is JSON, errors exit nonzero. Status includes private bodies; do not redirect it into public logs. Root directory is private (0700), files are 0600. Atomic rename/fsync and exclusive locks protect transactions; errors leave the previous file intact. An interrupted lock fails closed. Inspect its PID, confirm the process is dead, then remove only that account's stale lock before retrying. Never delete a live writer's lock.

## Configure and discovery

`configure`: `{version:1, account:"@example", preference:"five"|"all", timezone:"Europe/London"}`. Ask for the review preference before configuring. `window` supports `--period 24h|7d`, `--start ISO`, `--end ISO`; default is since checkpoint, first use 24h. Resume an open batch first.

`import` takes:

```json
{
  "version": 1,
  "account": "@example",
  "start": "2026-01-01T00:00:00Z",
  "end": "2026-01-02T00:00:00Z",
  "coverage": {"complete": true, "gaps": []},
  "exclude_ids": [],
  "items": [{
    "source_id": "synthetic-comment-1",
    "lane": "comment",
    "author": "@reader",
    "text": "Full verbatim comment",
    "url": "https://www.threads.com/example-comment",
    "occurred_at": "2026-01-01T09:00:00Z",
    "pending": true,
    "available": true,
    "safety": "safe",
    "context_complete": true,
    "ancestry": [],
    "post": {
      "id": "synthetic-post-1",
      "verified": true,
      "text": "Complete post or ordered thread",
      "url": "https://www.threads.com/example-post",
      "metrics": {"views": 12, "likes": 2},
      "metrics_checked_at": "2026-01-02T00:00:00Z",
      "metrics_as_of": null
    }
  }]
}
```

Examples are synthetic. `source_id` must be native in real runs. Ancestry is an array of `{author,text}`. Unknown URLs/metrics are null or omitted. Unsafe sources need identity/timestamp/eligibility only; omit their bodies. Context completeness includes relevant media. The output gives stable item `id` and `revision`; use those values unchanged. Frozen batch reimports are idempotent and do not refresh the cohort.

## Enrich or refresh a captured item

`context`: `{id,revision,evidence_ref,source:{source_id,author,safe,pending,available,text,post,ancestry,context_complete,url}}`. This updates the same native target after live or browser context enrichment; it does not reopen or expand the frozen cohort. An established parent ID and author cannot change; a previously unknown parent may be bound by verified enrichment. Refreshing revokes approval. Ineligible sources become unavailable. In-flight sends must be reconciled instead of refreshed.

## Draft and edit

`drafts`: add `drafts:[{id,revision,source_id,text,mode:"native"|"agent",context_verified:true,gates_passed:true}]`. This retains the immutable first draft plus draft/edit history and the latest baseline. Regeneration requires current revisions; never overwrite unsaved user edits.

`edit`: add `{id,revision,text}`. Text is stored without trimming or normalization. Changed text increments revision and revokes approval. `decide`: add `{id,revision,action:"approve"|"defer"|"skip"|"undo"|"regenerate"}`. Empty approvals are rejected. A decision increments revision. UI actions and agent commands use the same store.

`surface`: add `capabilities:{create:true,stableIdentity:true,readback:true}` only when verified. All three true selects native; otherwise local. `serve` starts a loopback-only server and returns a private session URL. It has no send endpoint. A stale edit gets a conflict rather than overwriting the newer revision. Copy unsaved text before refreshing after a conflict.

## Prepare/send/readback

`prepare-send`: add `authorization:{explicit:true,reference:"user-message-reference"}` and `items:[{id,revision,source_id,author,final_hash,pending:true,safe:true,available:true,gates_passed:true,evidence_ref,checked_at}]`. Compute `final_hash` with SHA-256 of exact UTF-8 text (exported `hash` helper). `quote_target_kind` may be `comment` or `mention` only when the provider verifies that mapping. Proof fields describe actual reads, not invented assertions. This command must follow the user's chat send instruction; local approval alone is insufficient.

Output contains the durable `attempt.key` and exact prepared reply payload. The agent must refresh `list_dispatcher_tools` and use only a compatible currently advertised delivery action through `call_agent_action`; no historical tool name grants capability. `record-send`: `{key,receipt,eta}`. Receipts are stable provider evidence references, not local success labels.

`reconcile`: `{key,results:[{id,source_id,author,status,evidence_ref,checked_at,...}]}`. Status is:

- `published`: additionally requires exact `text`, `reply_id`, `url`, `pending_before:true`, `replied_after:true` and a recorded send receipt.
- `failed`: requires `definitely_not_sent:true` and `failure_receipt`; returns the item to unapproved drafted state for a fresh check and approval.
- `uncertain`: blocks another send and retains the item for further readback.

`feedback`: `{key,receipt}` records a successful provider feedback call. Pending feedback payloads are in status and remain retryable independently of publication. `close`: optional `batch_id`; reports coverage/checkpoint and feedback backlog. `status --batch ID` reads a historical batch's current item states.

The helper trusts the authorized agent to gather actual MCP evidence. It checks identity, revisions, hashes, timestamps and required proof fields; it cannot independently authenticate provider receipts or grant sending authority.

`receipt --account @example` emits a body-free review/send receipt: hashes, revisions, proof references, coverage and remaining feedback. The operator adds actual editor surface evidence; the helper explicitly reports that field as requiring readback. Provider references and account handles remain private operational metadata unless redacted for a public example.
