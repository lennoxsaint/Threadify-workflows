# Buyer experience acceptance - 0.8.0

Checked 2026-09-11. This release adds five buyer workflows to a catalog of 21 workflows: 20 runnable skills and one documentation recipe.

## Automated behavior

`npm test` passed 177 tests: 35 installer, 110 creator, 10 Offer Builder, three registry and 19 conversation tests. Schema validation and every generated bundle/catalog parity check also passed. The synthetic five-workflow example exercises private state, exact review, pending attempts, receipt reconciliation, commitments, question grouping, seven-day reporting and opt-in reminder preparation without a network call.

The checks cover full fresh installs, preserving legacy selections, explicit migration, rollback and private-state preservation. Conversation checks cover missing/inactive offers, empty results, exact approval edits, recipient/channel permission, rejection recovery, interrupted writers, duplicate receipts, uncertain delivery, source unavailability and missing report coverage. Extra transcript fields are rejected by the runtime.

## Native walkthroughs

Both clients used files extracted by the installer from a candidate release bundle, with a fictional offer and a conversation at `example.invalid`. Each discovered the installed Your Next Moves skill, created a private workspace, saved one public reply at revision 3, and returned a bound review. Neither recorded approval, an attempt, a send, a reminder or a real buyer outcome.

| Client | Observed result |
| --- | --- |
| Codex CLI 0.153.4 on macOS | Native plugin discovery; explicit relevant help request recorded separately from channel permission; exact public draft and review hash returned |
| Claude Code 2.1.183 on macOS | Native Skill invocation; explicit relevant help request recorded separately from channel permission; exact public draft and review hash returned |

The tested candidate content-manifest SHA-256 was `30d4a88d5e2d0466b59642d1d804fe4aa30f5ff90d7dad924b789080d4b3a06d`. Codex review hash: `51e91c8d85d1681caf4dbfa965b1f86b7bf64e7660620026a8401463fec1096b`. Claude review hash: `52d3fff0c2a426d2ad07fd0aa36b298cf2ea45119d4ea7780a0897cc3b442a9d`.

The first Claude walkthrough invented offer details and under-classified an explicit help request. The skill was corrected and a fresh walkthrough passed with copy limited to the supplied facts. A later runtime assertion also rejects preparing actions against missing or inactive offers; its focused regression test passed. The final package retains the tested skill content. Candidate proof and the published release manifest are separate records.

Codex emitted unauthenticated optional-MCP startup messages, but local preparation completed without connecting Threadify. This does not establish hosted access. Another existing host skill had a frontmatter warning unrelated to this package.

## Limits

These are synthetic mechanics and native-discovery checks, not customer adoption, lead generation, sales or conversion evidence. Only Codex and Claude Code received native first-run checks. Other adapters retain structural guidance; Windows installer checks do not establish support for the private POSIX state engine. No live delivery or native reminder was requested in the walkthroughs.

The stable release manifest and checksums identify the published artifacts. Source presence, native walkthroughs, installed selection and publication remain separately inspectable through the release records and the CLI.
