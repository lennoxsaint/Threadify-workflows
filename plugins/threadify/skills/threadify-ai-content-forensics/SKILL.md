---
name: threadify-ai-content-forensics
description: Reverse-engineer a bounded creator corpus into evidence-linked content rules, copyable templates, and one validated ten-post thread. Use for AI Content Forensics or creator-content pattern analysis.
---

# AI Content Forensics

Read `references/workflow-readme.md`, `references/ai-content-forensics.v1.json`,
and `references/upstream-attribution.md`. Use the bundled Node 18+ scripts. This
workflow is read-only and draft-only: it never saves, schedules, publishes, or
claims that a pattern caused performance.

## Start or resume

Confirm the target creator, destination platform, the creator's permission or
public-source basis, and the exact bounded sources. Prefer an owner-approved local
export. For a connected Threadify account, verify the account before current
read-only calls. Never infer availability from source code or a historical tool
name.

If the user chooses Scrape Creators, use only a current host-supplied MCP, skill,
or official CLI whose key is already configured outside this package. The bundled
local engine performs no network calls. Do not echo the key, pass it in arguments,
collect private/login-only material, or silently broaden the sample. Normalize
only the bounded read result and record vendor, endpoint, query, requested limit,
observation time, cache/freshness information, and gaps. An unavailable connector
routes to local export; it does not weaken the evidence gate.

When the key is stored in 1Password, let the host resolve an `op://` secret
reference only for the connector process at execution time. Never copy the secret
value into chat, shell history, an environment file, the normalized packet, logs,
receipts, or release artifacts. Record only that the auth mode was `byo_key` and
whether the bounded provider read succeeded.

## Build the case file

Normalize local JSON, JSONL, or CSV exports with
`scripts/ai-content-forensics-import.mjs`, then combine the returned source and
items with any already-normalized host read results in one input packet for
`scripts/ai-content-forensics-cli.mjs`. Keep each platform's metrics in its own
namespace. Deduplicate platform/native IDs first, then same-creator normalized
bodies. Preserve zero and missing metrics but exclude unavailable values from
comparisons. Inspect the import limitations and stop on a wrong creator,
platform, rights basis, or unexpectedly empty/partial export.

Comparative findings require at least 20 unique metric-valid items inside one
platform and format family. Smaller or incomplete groups may support descriptive
patterns only. Never create a universal engagement rate, compare unlike raw
metrics, label correlation as causation, or predict reach, virality, followers,
leads, or sales.

Research the corpus across five portable axes:

1. opener or title;
2. proof and specificity;
3. structure and pacing;
4. media or format use;
5. CTA or next action.

Create at least ten finding candidates. Each candidate needs one distinct claim,
plain-language explanation, portable `copy_this` template, category, evidence
IDs, and a limitation. Choose exactly seven that cover all five axes; keep
runner-ups in the audit. A copied phrase is not a portable template. Preserve ideas and
structures while excluding source-specific names, stories, claims, and wording.

## Produce the exact package

The engine outputs exactly ten posts:

1. evidence-led hook;
2–8. seven numbered findings, each ending with `copy this:`;
9. one bounded action plan;
10. one natural CTA.

Every post must fit the destination platform limit. The engine also returns five
constitutions, the insight audit, coverage/limitations, and a body-free receipt.
With `--visuals`, it writes ten evidence-bound SVG and HTML cards to the chosen
private output directory. Visual rendering is optional; a missing renderer must
not invalidate a verified thread.

Show the complete case file and exact thread for owner review. Say “prepared
locally,” not saved or published. Any later provider draft, schedule, publication,
or feedback share requires its own current capability, exact approval, and
authoritative readback outside this workflow.
