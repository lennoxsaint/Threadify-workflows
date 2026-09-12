# Threadify Workflows

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
npx --yes github:lennoxsaint/Threadify-workflows doctor --json
```

The five buyer workflows are:

- [Your Next Moves](workflows/your-next-moves/README.md)
- [Agree the Next Step](workflows/agree-next-step/README.md)
- [Follow Through](workflows/follow-through/README.md)
- [Buyer Questions to Content](workflows/buyer-questions-to-content/README.md)
- [Weekly Buyer Outcomes](workflows/weekly-buyer-outcomes/README.md)

The full catalog also includes creator planning, source, offer and approved-delivery workflows. See the [getting started guide](docs/getting-started.md), [generated workflow catalog](docs/workflow-catalog.md) and [Proof Loops catalog](docs/proof-loops-workflows.md).

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

No workflow may ask a provider to import, save, schedule, publish, reply or send until the user approves the exact displayed action. Importing user-supplied evidence into private local state is part of the authorized first run. Qualified Buyer Research still stops with a staged reply before Send. If a required tool is unavailable, keep the useful work local and give the manual next step.

## Development

```sh
npm ci
npm test
npm run release:build
```

The MIT-licensed repository contains public workflow methods, local state controls, manifests and adapters. It excludes private generation logic, private sources, credentials, member data and production account identifiers. The [publication checklist](PUBLICATION_CHECKLIST.md) remains the release gate.
