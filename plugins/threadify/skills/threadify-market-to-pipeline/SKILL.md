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

## Connect buyer language, offer, analytics and research

For every new content run, supply `content_context`. Read the current account,
offer, relevant post analytics and comments before choosing research queries.
Select posts for offer relevance as well as engagement; unrelated viral posts do
not establish buyer demand. Paginate the selected comment threads, state actual
coverage and use a declared lookback (expand beyond seven days when the current
sample has no useful buyer questions). Separate audience language from qualified
prospects; a question is not consent or a lead.

Store exact source language privately and a deidentified paraphrase for generation.
Classify questions, problems, objections and desired outcomes; exclude generic
praise. Map each to the frozen offer's supported help, exclusions and claims.
Analytics guide a format or angle hypothesis, never a causal conversion claim.

Before Treg calls, record the buyer question, the research query and what answer
would change the post. Prefer relevant market context, alternatives and factual
answers over an unrelated company list. Discover the endpoint and current price;
free calls need no new purchase approval, metered calls do. Source snippets are
leads for verification, not established facts. Record contradictory findings and
limits. Do not force every search result into a post.

Every brief joins buyer-language IDs, matching Treg research IDs, analytics IDs,
the offer version, an offer connection and a concrete reader takeaway. Research
must address at least one of that brief's buyer questions. Run:

```sh
node scripts/market-to-pipeline-cli.mjs briefs --input INPUT.json
```

Use the resulting deidentified prompt through Threadify `generate_content`.
Verify the owner's requested model in the current Threadify model picker/config
and use its supported alias. If Claude Opus 5.5 is requested, select that model
inside Threadify, retain the visible version evidence and returned alias, and do
not substitute a local model or silently fall back. Record draft IDs and original
text hashes privately. Preserve generated words when the owner requests verbatim
output; flag unsupported claims separately, never quietly edit them. A raw draft
with factual problems is for review, not publication-ready copy.

Review semantic relevance: the post must address the buyer's problem, use the
research to make its answer more useful and fit the actual offer. It must not
become a report about search costs, lead counts or how the agent worked unless
the owner explicitly requests behind-the-scenes content. Structural validation
cannot establish this semantic judgment.

Legacy inputs without `content_context` remain usable for recovery but their
receipt says `legacy_unlinked`. Never describe them as the new grounded run.
If a source is missing, report the gap and prepare what is possible; do not
manufacture a complete linkage. Draft-generation writes and outreach delivery
are separate receipts; the pipeline action count does not count saved drafts.

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

Show one action at a time with verified account, destination, lane, current role,
evidence, every gate, exact copy, action hash, idempotency key, sender identity,
unsubscribe path, suppression result, and consequence. The binding includes the
account, target, evidence hashes, permission/compliance state, channel, and copy;
changing any of them requires a new build or approval.

Immediately before an authorized provider action, re-read the exact account and
pass that fresh identity proof while persisting `attempt_pending`. Then call the
provider once. Reconcile through an authoritative readback as `succeeded`,
`confirmed_not_sent`, or `unknown`. Unknown blocks retry but the same attempt can
later be resolved by decisive readback. Never infer success from a timeout, UI
disappearance, or source code. Refresh the body-free receipt after every state
transition so it reports `false`, `null` for pending/unknown, or `true` only from
authoritative reconciliation.

Return a body-free receipt even when no candidate is ready, Treg is unavailable,
or every action remains draft-only. Say `prepared privately`, not generated leads,
sent, replied, booked, or sold.
