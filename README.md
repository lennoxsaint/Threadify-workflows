# Threadify Workflows

## New here? Get set up

Start with [one guided setup](installation.md). The whole customer prompt is: **“Turn this AI into my Threadify social media operator. Install the latest stable Threadify Workflows and run Get Set Up.”** It guides account and agent connection, your Brain and voice, then your first week and an optional ongoing routine. Login, consent, purchases and consequential approvals remain yours.

**YouTube Synthesizer** turns one YouTube URL into three evidence-backed hooks
and one complete long-form Threads draft in the creator's voice—or abstains when
the transcript cannot support a template. It ships twelve immutable structures,
thirty-six attributed originals, no-key captions, caption-only `yt-dlp`, and
TXT/VTT/SRT fallbacks. Synthesis never downloads media or writes to a provider;
the separate approved-delivery module can schedule or publish the exact reviewed
thread through Threadify with idempotent readback.
[See the workflow](workflows/youtube-synthesizer/README.md).

**Market to Pipeline** turns one versioned offer and one bounded market into a
private qualified pipeline, exact permission-aware actions, exactly seven
de-identified posts, and body-free receipts. It combines normalized Threadify
buyer signals with optional, price-previewed Treg research while keeping provider
calls and sends outside the local engine. [See the workflow](workflows/market-to-pipeline/README.md).

**AI Content Forensics** turns an inspectable creator corpus into evidence-linked
content rules, reusable `copy this:` templates, and one exact ten-post draft.
It works from local exports, optional read-only Threadify evidence, or a bounded
Scrape Creators BYO-key sample while keeping platform metrics separate and every
performance relationship explicitly correlational. [See the workflow](workflows/ai-content-forensics/README.md).

The **30-Day Viral Vault** plans six rights-cleared posts per day while showing only the next post to edit, approve, skip or reject. It creates a 30-day slot blueprint, drafts one day at a time, and keeps scheduling behind exact per-card approval and readback. [See the workflow](workflows/30-day-viral-vault/README.md).

**Threadify Growth Loop** reviews newly mature 72-hour and attributed 7-day evidence, promotes only repeat-tested hypotheses, changes tomorrow's two challenger slots, and saves a six-draft queue while the four proven slots stay stable. It never schedules or publishes automatically. [See the workflow](workflows/growth-loop/README.md).

Day, Week and Month include a private [browser review editor](docs/creator-browser-review.md). Edit exact text, review every prepared post, then Submit approval for the active host to validate and schedule.

Threadify Workflows turns an offer and real buyer conversations into small, reviewable next steps. It can prepare the work locally from conversations you supply, so you can get value before connecting an account. Every external action stays tied to the exact item you approved.

The library is MCP ready and works with agent clients including Codex, Claude Code, Cursor, Gemini CLI, OpenClaw and Hermes. Local drafting and private review state run with Node 18 or newer on macOS and Linux.

## A synthetic example

This example is made up and uses the reserved `example.invalid` domain.

**Source:** a [fictional Threads conversation](https://example.invalid/threads/conversation-one).

**Buyer evidence:** "Yes, I would like help setting that up." The synthetic record also includes permission to use a Threads DM.

**Fit rationale:** the person showed explicit interest in help relevant to the confirmed offer. A generic public question would not qualify as a lead.

**Suggested reply:**

> I can send the short setup outline here today. If it fits, we can choose the next step after you read it.

**State:** `draft` - nothing was sent.

Your Next Moves may present up to three supported actions, but you review the first action by itself.

## Start here

Start with **Your Next Moves**:

> Use Your Next Moves with my offer and the conversations I provide. Keep the work local and show me one action at a time.

If the offer is missing, the workflow runs [Offer Builder](workflows/offer-builder/README.md) first. It then returns to the same conversation review.

## Install for your client

Install the full current catalog for one client:

```sh
npx --yes github:lennoxsaint/Threadify-workflows install --workflows all --targets codex
```

Change `codex` to `claude`, `cursor`, `gemini`, `openclaw` or `hermes`. Omit `--targets` to use detected clients. A fresh install selects the full runnable catalog. An upgrade with no workflow selection preserves that client's existing selection.

### Claude Code plugin

Install the full catalog as a Claude Code plugin, with the Threadify MCP server included:

```sh
/plugin install threadify-workflows --marketplace lennoxsaint/Threadify-workflows
```

On Claude Code before 2.1.275, add the marketplace first, then install:

```sh
claude plugin marketplace add lennoxsaint/Threadify-workflows
claude plugin install threadify-workflows@threadify
```

Skills appear as `/threadify-workflows:<skill>`, for example `/threadify-workflows:threadify-get-set-up`. Update with `claude plugin update threadify-workflows@threadify`. The plugin route installs the same skills as the installer below but does not run the installer's release-manifest and checksum checks; use the installer when you need a pinned, checksum-verified release.

From a source checkout, use the local executable:

```sh
node bin/threadify-workflows.mjs install --workflows all --targets codex
```

Windows installation may work through a supported client, but it is not proof that the private conversation state engine ran there. Use the manual conversation fallback when durable local state is unavailable.

## Find the supporting workflow

List the catalog or inspect one workflow before running it:

```sh
npx --yes github:lennoxsaint/Threadify-workflows list --json
npx --yes github:lennoxsaint/Threadify-workflows describe your-next-moves --json
npx --yes github:lennoxsaint/Threadify-workflows describe 30-day-viral-vault --json
npx --yes github:lennoxsaint/Threadify-workflows describe growth-loop --json
npx --yes github:lennoxsaint/Threadify-workflows describe ai-content-forensics --json
npx --yes github:lennoxsaint/Threadify-workflows describe market-to-pipeline --json
npx --yes github:lennoxsaint/Threadify-workflows describe youtube-synthesizer --json
npx --yes github:lennoxsaint/Threadify-workflows doctor --json
```

The five buyer workflows are:

- [Your Next Moves](workflows/your-next-moves/README.md)
- [Agree the Next Step](workflows/agree-next-step/README.md)
- [Follow Through](workflows/follow-through/README.md)
- [Buyer Questions to Content](workflows/buyer-questions-to-content/README.md)
- [Weekly Buyer Outcomes](workflows/weekly-buyer-outcomes/README.md)

The full catalog also includes creator planning, source, offer and approved-delivery workflows. [YouTube Synthesizer](workflows/youtube-synthesizer/README.md) converts one source video into evidence-linked hooks and a private long-form draft without downloading media or forcing an unsupported structure, then can separately deliver the exact approved thread through a hash-bound Threadify transaction. [Market to Pipeline](workflows/market-to-pipeline/README.md) turns one bounded offer and market into a private permission-aware pipeline and seven-post campaign without treating verified contact data as consent. [AI Content Forensics](workflows/ai-content-forensics/README.md) analyzes a bounded creator corpus without turning correlation into a forecast. [30-Day Viral Vault](workflows/30-day-viral-vault/README.md) prepares a six-card daily queue with one-card-at-a-time review. [Threadify Growth Loop](workflows/growth-loop/README.md) uses mature evidence to update only two challenger slots and save six drafts without automatic scheduling. [Post This Next](workflows/post-this-next/README.md) compares every eligible draft in one verified Threadify account without editing or publishing it. [Find Your Niche](workflows/find-your-niche/README.md) can establish a positioning direction, [Refresh Your Threads Profile](workflows/refresh-your-threads-profile/README.md) turns it into three reviewed bio-and-picture systems, and [Choose Your First Offer](workflows/choose-your-first-offer/README.md) compares an intensive, guided lab, and self-serve kit with one fixed scorecard. See the [getting started guide](docs/getting-started.md), [generated workflow catalog](docs/workflow-catalog.md) and [Proof Loops catalog](docs/proof-loops-workflows.md).

From a source checkout, run the synthetic five-workflow example:

```sh
node examples/conversations/walkthrough.mjs
```

It creates disposable private state, makes no network call and sends nothing.

## Connect Threadify when it helps

A connection is optional. Use it when a workflow needs a current account capability, then verify the available tools and intended account before relying on them. The current MCP does not supply every conversation or delivery surface; the [capability gaps](docs/buyer-capability-gaps.md) name the manual paths.

For Threadify setup and the current offer, use the fully attributed [Threadify plans page](https://www.threadify.app/plans?utm_source=threadify-workflows&utm_medium=github&utm_campaign=buyer-workflows&utm_content=onboarding__buyer_workflows__default&video_slug=threadify-001&cta_slot=onboarding&entry_angle=buyer_next_moves&lp_variant=plans). Check the live page rather than copying old terms into a workflow.

For installation or workflow trouble, run `npx --yes github:lennoxsaint/Threadify-workflows doctor --json`, read [Threadify-001](docs/threadify-001.md), then open a [GitHub issue](https://github.com/lennoxsaint/Threadify-workflows/issues) without private conversations, account IDs or credentials.

## Safety and proof

Conversation archives stay private. The local engine validates and persists the minimal evidence supplied by the host outside release archives. The host reinspects the source before an action. The engine then records a pending attempt before delivery and blocks replay when an outcome is unknown. An optional native reminder only prepares a review candidate after the owner enables it; it never sends.

Tests, an installed file and a client discovery screen prove different things. Codex and Claude Code passed synthetic native first-run walkthroughs on macOS. See the [0.8.0 acceptance record](docs/buyer-experience-acceptance.md). Other adapters are structural guidance until their own native walkthroughs pass. See [packaging status](docs/plugin-packaging.md) for dated release evidence and remaining checks.

No workflow may ask a provider to import, save, schedule, publish, reply or send without owner approval. Growth Loop may use a specific revocable standing approval to save six daily drafts; it still cannot schedule or publish. All other provider actions require the exact displayed action at the final gate. Importing user-supplied evidence into private local state is part of the authorized first run. Qualified Buyer Research still stops with a staged reply before Send. If a required tool is unavailable, keep the useful work local and give the manual next step.

## Development

```sh
npm ci
npm test
npm run release:build
```

The MIT-licensed repository contains public workflow methods, local state controls, manifests and adapters. It excludes private generation logic, private sources, credentials, member data and production account identifiers. The [publication checklist](PUBLICATION_CHECKLIST.md) remains the release gate.

Run My Threads now uses actual source posts, scoped owner edits and revision-bound approval. See [the workflow](workflows/run-my-threads/README.md) and [private state and local previews](docs/run-my-threads-state.md).

Threadify Unslop scores your posts for slop, puts raw against polished on your own numbers and has Threadify write three raw posts that pass a zero-hedge gate. See [the workflow](workflows/unslop/README.md).
