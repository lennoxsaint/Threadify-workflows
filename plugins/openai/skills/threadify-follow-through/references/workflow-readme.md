# Follow Through

Use this workflow for explicit promises made in buyer conversations. A commitment needs source evidence, an owner and a due date. Follow [Threadify-001](../../docs/threadify-001.md) only when a useful follow-up step needs a connection.

Ask:

> Show the buyer commitments I need to follow through on, with the promise and date from each source.

## Run the workflow

1. Import only explicit promise evidence. Do not turn "we should," "maybe" or silence into a commitment.
2. Use `commit` with the current revision to store the exact promise, owner, due date and source reference. New commitments start `open`.
3. Prepare a follow-up action only when the promise and current source support it. Review one exact action and hash at a time.
4. Before an external follow-up, reinspect the source and check recipient interest and channel permission where applicable. Persist `attempt_pending` before delivery and reconcile its result.
5. Use `outcome` to close the commitment as exactly `fulfilled`, `declined`, `withdrawn` or `uncertain`. Record whether the evidence is `owner_reported` or `provider_observed`; call it verified only when authoritative readback supports the claim.

Silence does not grant permission, prove delivery or close the commitment. When the due date passes without evidence, keep it open for review or record `uncertain` with the reason.

```sh
node ~/.threadify-workflows/current/cli/bin/threadify-workflows.mjs conversations reminder --state /absolute/private/directory
```

The reminder result is `host_native_opt_in_required`, `created:false`, `automatic:false`. The owner must explicitly enable any native reminder in the host, and that reminder may prepare review only. It never sends.

When durable state is unavailable, keep a private list of source, promise, owner, date, current state and evidence origin. Do not copy private conversation text into public logs or release artifacts.
