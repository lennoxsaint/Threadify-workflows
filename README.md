# Threadify Workflows

Threadify Workflows is a public, MCP ready workflow library for running creator workflows through Threadify from agent clients such as Hermes, Gemini, Codex, Claude, OpenClaw, Cursor, and any generic MCP client.

The generalized methods and local Node engine are free and open source under the MIT License. Local drafting works from user-supplied sources and confirmed facts without a Threadify account. Hosted Brain, shared corpus, generation, saved drafts, scheduling and analytics require the connected account's current access.

This repo includes local planning, review and recovery controls plus approval-gated service orchestration. It does not publish Threadify's private generation logic, private source material, member data, account IDs, credentials or proprietary ranking systems.

## Primary creator workflows

- [Viral Vault Setup](workflows/vault-setup/README.md)
- [Create My Day](workflows/create-my-day/README.md)
- [Create My Week](workflows/create-my-week/README.md)
- [Create My Month](workflows/create-my-month/README.md)

Week means seven days; Month means 28 days, visibly four weeks. Rolling drafts
are the default. All drafts upfront is optional; neither mode bypasses daily
review or fresh delivery checks. See [getting started](docs/getting-started.md)
and the [skill disposition audit](docs/skill-disposition-audit.md).

## Preserved capabilities

- Strict workflow manifests for agent-native Threadify execution.
- Adapter packs for generic MCP, Hermes, Gemini, Codex, Claude, OpenClaw, and Cursor.
- Approval gates for public actions.
- Manual/web fallback paths when MCP is unavailable.
- Receipt templates for recording actual tool calls and verified readbacks; templates alone are not proof.
- Redacted examples based on real operating patterns, with private details removed.
- Personal Brain Sync pattern for granular, verified memory updates from approved source artifacts.
- Daily Greatest Hits workflow for turning approved top-post source material into a daily candidate, approval, schedule, and receipt loop.
- Draft-only X Article repurposing workflow for turning an approved daily post into an article brief, draft, thumbnail brief, prompt, scorecard, and review receipt.
- Qualified Buyer Research workflow for finding current problem-language posts, rejecting seller/advice false positives, staging one useful reply, and learning only from completed qualified-progression outcomes.
- YouTube Edit workflow that drives the Eddy engine (the `engines/eddy` submodule) to turn raw footage into a finished edit, then optionally prepares and schedules Threadify promotional posts about the video after approval.
- A dependency-free validator for manifests, fixtures, redaction, and launch claims.
- A dependency-free Node 18+ installer and stable updater for Codex, Claude Code, Cursor, Gemini CLI, OpenClaw, Hermes, and universal Agent Skills.

## YouTube support via the Eddy engine

The YouTube Edit workflow uses a separately verified [Eddy](https://github.com/lennoxsaint/eddy) installation or a finished launch kit. Source checkouts reference Eddy through the `engines/eddy` submodule; the plugin archive does not include it. Inspect the installed engine's current documentation and processing configuration before starting. Do not permit unapproved source-media transfers or publishing, and claim only output assets that actually exist and have been inspected.

For a source checkout only, initialize the engine with:

```sh
git clone --recurse-submodules https://github.com/lennoxsaint/Threadify-workflows.git
# or, in an existing clone:
git submodule update --init engines/eddy
```

Do not run these setup commands inside an installed skill directory. Threadify
is optional for edit-only use; promotional media uploads, scheduling and feedback
sharing each require approval for that action.

## What Stays In Threadify

Threadify keeps the paid execution layer:

- native post generation and draft editing
- reply generation
- advanced analytics and winner strategy
- additional accounts and platforms
- any future supported X Article execution (not claimed by this package)
- premium workflow packs
- hosted calendar and deeper readback surfaces
- private quality and voice systems

Public workflows may describe required capabilities and upgrade points. They must not include the internal logic behind those paid systems.

## Current Self / Brain Sync Rule

Large personal context packets are source artifacts, not direct Brain upload payloads. Public workflows must atomize approved packet updates into small memory records, classify them, stop for approval, verify readback, and return a per-item ledger.

Daily Posts workflows may consume only approved clean Threadify-safe packs or verified Brain memories. They must not consume raw Current Self packets, private metrics, private proof paths, account data, or unapproved memory candidates.

## Quick Start

Install the latest validated stable release:

```sh
npx --yes github:lennoxsaint/Threadify-workflows install
```

The installer asks before enabling daily and on-use automatic updates. It installs only GitHub stable releases, verifies hashes and bundle parity, preserves the previous two releases, and never runs a global agent-skill update. See `docs/automatic-updates.md`.

The existing standalone installer targets Qualified Buyer Research. The new
creator package still needs complete host-loading and release verification;
running the stable installer does not prove these creator changes are
released or installed. See [packaging status](docs/plugin-packaging.md).

1. Connect Threadify MCP in your agent client.
2. Pick a workflow under `workflows/`.
3. Open the matching adapter under `adapters/`.
4. Let the agent inspect the workflow manifest.
5. Approve the final action only after the agent shows exact text, account, time, media, and action.
6. Save the receipt.

Install development dependencies and validate before publishing or editing:

```sh
npm ci
npm test
```

Build the exact stable release assets:

```sh
npm run release:build
```

## Local Codex Plugin Wrapper

This repo includes a local dogfood plugin wrapper. The plugin source is the repo
root so Codex can access both the plugin skills and the workflow manifests. It
is separate from OpenAI public directory submission.

Install from this repo root:

```sh
codex plugin marketplace add .
codex plugin add threadify-workflows@threadify-workflows
```

Marketplace registration alone does not install the plugin. Start a new task
after installation to check skill discovery. Local drafting does not require
a Threadify connection. For connected services, connect Threadify MCP with OAuth at:

```text
https://www.threadify.app/api/mcp/threadify
```

Do not commit bearer tokens, OAuth tokens, local proxy config, account IDs, or
reviewer credentials into this repo.

## Publication Status

This working creator package is not yet release-verified. Before any public
sync or release announcement, run the checklist in `PUBLICATION_CHECKLIST.md`
and confirm the owner gates listed there.

## Safety Rule

No workflow may schedule, cancel, reschedule, or otherwise mutate Threadify state until the user gives explicit final approval. If MCP is unavailable, the workflow must produce a Threadify-ready artifact and manual fallback steps instead of pretending the action happened.
