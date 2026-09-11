# Weekly Buyer Outcomes

Use this workflow to review what happened in the past seven days. It reads local actions, commitments and outcomes and keeps the source of each claim visible. Follow [Threadify-001](../../docs/threadify-001.md) only when a current connected readback would close a useful evidence gap.

Ask:

> Review my buyer outcomes for the past seven days. Separate what I reported from what a provider observed, and keep missing results unknown.

## Run the workflow

1. Run `weekly-outcomes` with the private state and the owner's timezone. Use one exact rolling seven-day window and show its start and end.
2. Separate `owner_reported` outcomes from `provider_observed` evidence. Call a result verified only when authoritative readback directly supports that claim. Do not upgrade an owner report because it sounds specific.
3. Keep open commitments, unknown deliveries and missing readback visible. Missing data is not zero activity.
4. Do not infer a lead, call, offer, payment or sale from likes, follows, views, generic thanks or unanswered messages.
5. Propose one reviewable next action only when the week's evidence supports it. Use the normal single-action hash, approval and pending-attempt flow.

```sh
node ~/.threadify-workflows/current/cli/bin/threadify-workflows.mjs conversations weekly-outcomes --state /absolute/private/directory
```

From a source checkout, use `node bin/threadify-workflows.mjs conversations ...`. When provider readback is unavailable, use the local receipt and owner report as their stated evidence classes. Do not manufacture a verification source or sales number.
