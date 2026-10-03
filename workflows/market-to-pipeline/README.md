# Market to Pipeline

Give the workflow one versioned offer and one bounded market. It returns a private, inspectable pipeline, one exact next action per selected prospect, exactly seven de-identified campaign posts, and a public receipt that contains no source bodies or contact destinations.

The local engine performs no network call. A host agent may read current Threadify-owned buyer signals and use the current Treg CLI or MCP for public company, person, or work-contact research. The host normalizes those results into the packet. Threadify and Treg are evidence sources; neither is treated as proof that a person consented or that an action was sent.

## Output

Each run produces:

- `pipeline.private.json`: the resumable private state, evidence, exact actions, approvals, attempts, and reconciliations;
- `pipeline.private.csv`: the reviewable prospect table;
- `review.private.html`: a local private review board with the exact action copy;
- `receipt.public.json`: counts, hashes, coverage, cost, limitations, and write state without bodies or contact destinations;
- exactly seven campaign posts whose claims point to de-identified evidence themes.

The workflow does not promise a number of leads, replies, calls, customers, or revenue.

## Bounded sequence

1. Freeze one offer version: observable situation, problem, desired outcome, exclusions, and ideal customer.
2. Freeze one market: geography, jurisdiction, seven-day window by default, no more than 50 normalized signals, no more than 10 selected prospects, and a run budget no greater than US$3.00.
3. Verify the intended Threadify account before any current owned-account read. Record actual capability names, coverage, observation time, and gaps.
4. Search Treg by the job to be done. Inspect the current catalog record and price before every potentially metered call. Do not guess a vendor or endpoint from this README.
5. Spend in order: public discovery, company fit, person, then contact. Person or contact enrichment fails validation unless that prospect already passed an earlier company-fit gate.
6. Normalize evidence locally, deduplicate stable company plus destination identities, rank eligible candidates, and select at most 10.
7. Route every candidate to `ready_for_approval`, `research`, or `rejected`. A score orders candidates; it cannot override a missing hard gate.
8. Aggregate recurring evidence into de-identified themes and prepare exactly seven posts. No prospect name, company name, contact destination, or private source body may appear in a campaign post.
9. Show the exact action and hash. Approval binds only that account, destination, current role and compliance state, evidence set, channel, and text.
10. Re-read the exact account, persist `attempt_pending` before a provider call, and reconcile to `succeeded`, `confirmed_not_sent`, or `unknown`. An unknown result blocks retry but can be resolved later by an authoritative readback of that same attempt.

## Warm and cold B2B lanes

A warm candidate needs explicit, current, offer-relevant recipient interest. A private DM, email, call, or other private action additionally needs explicit permission for that exact channel. A public reply may be drafted from explicit public interest, but it still remains unsent until exact approval.

A cold B2B candidate needs all of the following: offer fit, a relevant current business role, a recently verified work contact, a documented jurisdiction-appropriate lawful basis, sender identity and contact details, an unsubscribe path, and a current suppression check. A verified email proves only that an address may work. It is not consent and cannot satisfy the lawful-basis gate.

When local law, platform policy, or the user's policy is stricter, the stricter rule wins. This workflow is an operational control, not legal advice.

## Run the synthetic proof

From a source checkout:

```sh
node bin/threadify-workflows.mjs market-to-pipeline build \
  --input workflows/market-to-pipeline/synthetic-market.json \
  --output-dir /absolute/private/market-to-pipeline
```

Inspect the private state:

```sh
node bin/threadify-workflows.mjs market-to-pipeline status \
  --state /absolute/private/market-to-pipeline/pipeline.private.json
```

The fixture contains made-up identities and `example.invalid` destinations. It proves the deterministic gates and artifacts, not a live provider read or send.

## Approve and deliver one action

After reviewing the account, destination, evidence, compliance record, exact text, and action hash:

```sh
node bin/threadify-workflows.mjs market-to-pipeline approve \
  --state /absolute/private/market-to-pipeline/pipeline.private.json \
  --action ACTION_ID --hash EXACT_SHA256 --at ISO_TIME
```

Immediately before the host calls a provider, persist the attempt:

```sh
node bin/threadify-workflows.mjs market-to-pipeline begin-attempt \
  --state /absolute/private/market-to-pipeline/pipeline.private.json \
  --action ACTION_ID --hash EXACT_SHA256 --attempt UNIQUE_ID --at ISO_TIME \
  --account-ref EXACT_ACCOUNT_REF --account-verified-at FRESH_ISO_TIME
```

Then reconcile from authoritative provider evidence. Never repeat an ambiguous action. If the first readback is `unknown`, run `reconcile` again for the same attempt only after a later authoritative readback resolves it:

```sh
node bin/threadify-workflows.mjs market-to-pipeline reconcile \
  --state /absolute/private/market-to-pipeline/pipeline.private.json \
  --action ACTION_ID --attempt UNIQUE_ID --status succeeded --at ISO_TIME \
  --provider-ref PROVIDER_REF --evidence-ref PRIVATE_READBACK_REF
```

The CLI never sends. It makes the safe state transition around a separately available provider capability.

## Treg boundary

Use the current official Treg interface supplied by the host. The intended flow is catalog search, catalog record and price inspection, explicit spend confirmation, one capped call, then call/balance readback. Record endpoint, provider, requested/returned counts, quote, charge, opaque call identity, observation time, and limitations. Store credentials only in Treg's supported configuration; never put a token in arguments, packets, receipts, examples, or this repository.

Treg is independently licensed and is not embedded, copied, or redistributed here. See [the attribution and compatibility note](../../docs/market-to-pipeline-treg-attribution.md).

## Buyer-grounded content

New runs include `content_context`: current offer, source-linked buyer language, analytics, targeted Treg findings, seven post briefs and the selected Threadify model. Use `market-to-pipeline briefs --input input.json` before generation. Each brief must bind a buyer question to research commissioned for that question and a concrete offer-relevant reader takeaway. Audience evidence is separate from outreach qualification. The content module checks links; the host reviews meaning and source limitations.

Generate through Threadify using the owner-selected model and retain the original text and draft receipts. Legacy v1 packets remain readable and explicitly report `legacy_unlinked`; they are not evidence of the new content path. Public receipts retain only grounding counts and a context hash. Private buyer bodies stay in private state, never public fixtures. See [design and working map](../../docs/market-content-grounding-design.md).
