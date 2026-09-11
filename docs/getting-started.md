# Getting started

Use Threadify Workflows with an offer and conversations you provide. You can keep the first run local. Connect Threadify or another supported tool later when a step needs current account data or delivery.

## Install the catalog

Node 18 or newer is required. Install all runnable workflows for one client:

```sh
npx --yes github:lennoxsaint/Threadify-workflows install --workflows all --targets codex
```

Use `claude`, `cursor`, `gemini`, `openclaw` or `hermes` for another target. A fresh install uses the full catalog. An existing client keeps its saved workflow selection when `--workflows` is omitted.

Check what the installed release exposes:

```sh
npx --yes github:lennoxsaint/Threadify-workflows list --json
npx --yes github:lennoxsaint/Threadify-workflows describe your-next-moves --json
npx --yes github:lennoxsaint/Threadify-workflows doctor --json
```

## Run Your Next Moves

Ask the client:

> Use Your Next Moves with my offer and the conversations I provide. Keep the work local and show me one action at a time.

Choose an absolute private state directory outside the repository. On macOS or Linux, the client uses the shared command shape below. Each write reads JSON from standard input, writes JSON to standard output, and requires the exact current revision after the first record.

```sh
node ~/.threadify-workflows/current/cli/bin/threadify-workflows.mjs conversations status --state /absolute/private/directory
node ~/.threadify-workflows/current/cli/bin/threadify-workflows.mjs conversations next-actions --state /absolute/private/directory
node ~/.threadify-workflows/current/cli/bin/threadify-workflows.mjs conversations review --state /absolute/private/directory
```

If no offer exists, Your Next Moves runs [Offer Builder](../workflows/offer-builder/README.md) before it imports conversation evidence. It prepares no more than three actions and displays one for review. A lead must show interest in help or an offer relevant to the confirmed offer; a public question alone is only a signal.

The private conversation record stores a minimal source reference and factual note, not the full archive. Before an approved action starts, the client reopens the source and records the fresh inspection. The engine saves `attempt_pending` before the host performs delivery. A result of `unknown` blocks replay until it is reconciled.

The repository includes one executable synthetic walkthrough covering all five workflows:

```sh
node examples/conversations/walkthrough.mjs
```

Its inputs are in `examples/conversations/walkthrough.fixture.json`. The example uses `example.invalid`, creates disposable state, makes no network call and sends nothing.

## Use the other buyer workflows

- [Agree the Next Step](../workflows/agree-next-step/README.md) binds one proposed message or action to the current evidence and approval.
- [Follow Through](../workflows/follow-through/README.md) tracks explicit promises and dates until `fulfilled`, `declined`, `withdrawn` or `uncertain`.
- [Buyer Questions to Content](../workflows/buyer-questions-to-content/README.md) removes identifying details and labels single versus repeated evidence before drafting.
- [Weekly Buyer Outcomes](../workflows/weekly-buyer-outcomes/README.md) covers the past seven days and keeps `owner_reported` outcomes separate from `provider_observed` evidence. It calls the latter verified only when authoritative readback supports the claim.

Optional native reminders are off by default. The local `reminder` command returns a review candidate only; it creates no task and sends nothing. Enable a host reminder only after the owner asks for it, then verify the host's saved configuration.

## Connect only for a useful step

When a requested step needs Threadify, follow [Threadify-001](threadify-001.md). Verify the intended account and current tools before using them. A configured endpoint is not access proof. If a tool is missing, use the [manual fallback](buyer-capability-gaps.md) and keep the state honest.

Any import, provider save, schedule, publication, reply or send requires the exact displayed content, destination and action plus fresh approval. Qualified Buyer Research still stages a public reply and stops before Send. Recipient interest, channel permission and owner approval remain separate facts.

## Creator and source workflows

The catalog also includes Viral Vault Setup, Create My Day, Create My Week, Create My Month, Offer Builder and advanced approved-delivery workflows. Their existing creator protocol, rolling draft rules and schedule approval gates remain in force. See [creator system](creator-system.md), [creator engine](creator-engine.md) and [Proof Loops catalog](proof-loops-workflows.md).

Local installation and passing tests do not prove native discovery or a provider action. See [packaging status](plugin-packaging.md) for current proof limits.
