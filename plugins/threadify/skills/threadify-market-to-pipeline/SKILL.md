---
name: threadify-market-to-pipeline
description: Turn one offer and one bounded market into a private qualified pipeline, exact permission-aware actions, seven de-identified posts, and body-free receipts using Threadify signals and optional Treg research.
metadata:
  version: "0.1.0"
---

# Market to Pipeline

Read `references/workflow-readme.md`, `references/market-to-pipeline.v1.json`,
`references/treg-attribution.md`, and `references/threadify-001.md`. Use the
bundled Node 18+ scripts. The local engine makes no network call and sends nothing.

## Freeze the run

Confirm one offer version and one bounded market. Default to a seven-day window,
at most 50 normalized signals, at most 10 selected prospects, and a spend cap no
greater than US$3.00. Narrow the offer by observable situation, current problem,
desired outcome, ideal customer, and exclusions. Record jurisdictions before
contact research.

Verify the intended Threadify account before current owned-account reads. Discover
capabilities at runtime and record actual provider, endpoint or tool, observation
time, requested and returned coverage, completeness, rights basis, and limitations.
Source inspection is not deployment, consent, delivery, response, or performance
proof.

## Combine Threadify with Treg

Use Threadify for current owner-controlled buyer signals and content context when
available. Use Treg only through a current host-supplied official CLI or MCP. Search
the catalog by the job, inspect the current record and displayed price, and obtain
confirmation before a metered call. Never select a paid endpoint silently.

Spend in this order: discovery, company fit, person, contact. Stop before person
or contact enrichment unless the company already passed the offer-fit gate. Keep
the cumulative quoted and charged total within the confirmed run cap. Record an
opaque call identity and balance/call readback, but never a Treg token, provider
credential, or raw private payload in a public artifact.

If Treg is unavailable, use approved local/public evidence and label the coverage
gap. Do not weaken qualification or permission gates to make the demo succeed.

## Qualify without manufacturing consent

Deduplicate stable company plus destination identities. Route no more than ten
candidates to `ready_for_approval`, `research`, or `rejected`.

- Warm: require explicit current offer-relevant interest. A private channel also
  requires explicit permission for that exact channel.
- Cold B2B: require offer fit, current relevant role, recently verified work
  contact, documented jurisdiction-appropriate lawful basis, sender identity and
  contact, unsubscribe, and suppression checks.
- Treat `verified email` as contact evidence only. It is never consent.
- Scores rank eligible records. They never override a hard gate, exclusion, or
  suppression entry.

Apply current law, platform terms, and user policy. The workflow is not legal
advice. When uncertain, stop at `research` and name the missing evidence.

## Build the private package

Normalize only the bounded read results into the schema, then run:

```sh
node scripts/market-to-pipeline-cli.mjs build --input INPUT.json --output-dir ABSOLUTE_PRIVATE_DIRECTORY
```

If the installed script is imported rather than executable, invoke the repository
CLI form from `references/workflow-readme.md`. Keep private JSON, CSV, and HTML
outside public repositories and release artifacts.

Create exactly seven posts from de-identified aggregate themes. Every post needs
theme evidence and a limitation. Reject campaign text containing a prospect name,
company, contact destination, private source body, unsupported result, or implied
performance guarantee.

## Review and act

Show one action at a time with verified account, destination, lane, evidence,
every gate, exact copy, action hash, idempotency key, sender identity, unsubscribe
path, suppression result, and consequence. Any text or destination change revokes
approval.

Immediately before an authorized provider action, read the same state again and
persist `attempt_pending`. Then call the provider once. Reconcile through an
authoritative readback as `succeeded`, `confirmed_not_sent`, or `unknown`. Unknown
blocks retry. Never infer success from a timeout, UI disappearance, or source code.

Return a body-free receipt even when no candidate is ready, Treg is unavailable,
or every action remains draft-only. Say `prepared privately`, not generated leads,
sent, replied, booked, or sold.
