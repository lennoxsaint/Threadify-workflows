# Threadify Workflows

Threadify Workflows is a public, MCP ready workflow library for running creator workflows through Threadify from agent clients such as Hermes, Gemini, Codex, Claude, OpenClaw, Cursor, and any generic MCP client.

These recipes are free and open source under the MIT License. The tie to Threadify is a runtime dependency, not a license restriction: the workflows are free to read, fork, and run, while Threadify's hosted generation, scheduling, and analytics remain the paid service they call into.

This repo is orchestration-only. It teaches agents which Threadify MCP tools to use, when to stop for human approval, how to fall back when a tool is unavailable, and how to produce receipts. It does not publish Threadify's private generation logic, private course material, member data, account IDs, credentials, or proprietary quality systems.

## What V0 Includes

- Strict workflow manifests for agent-native Threadify execution.
- Adapter packs for generic MCP, Hermes, Gemini, Codex, Claude, OpenClaw, and Cursor.
- Approval gates for public actions.
- Manual/web fallback paths when MCP is unavailable.
- Receipt templates that prove what happened.
- Redacted examples based on real operating patterns, with private details removed.
- Personal Brain Sync pattern for granular, verified memory updates from approved source artifacts.
- Daily Greatest Hits workflow for turning approved top-post source material into a daily candidate, approval, schedule, and receipt loop.
- Draft-only X Article repurposing workflow for turning an approved daily post into an article brief, draft, thumbnail brief, prompt, scorecard, and review receipt.
- YouTube Edit workflow that drives the Eddy engine (the `engines/eddy` submodule) to turn raw footage into a finished edit, then optionally prepares and schedules Threadify promotional posts about the video after approval.
- A dependency-free validator for manifests, fixtures, redaction, and launch claims.
- A dependency-free workflow simulator that walks every manifest end-to-end against a mock
  Threadify MCP client, proving (not just documenting) that no mutating tool ever runs without
  explicit approval and that every workflow falls back cleanly when a tool is unavailable.

## YouTube support via the Eddy engine

The YouTube Edit workflow uses [Eddy](https://github.com/lennoxsaint/eddy), a separate MIT-licensed, local-first video editor, vendored here as the `engines/eddy` submodule. Eddy turns raw footage into a launch kit (long video, Shorts, titles, thumbnails, description) and never publishes by itself; this repo orchestrates Eddy and then hands off to Threadify for the promotion step. Initialize the engine with:

```sh
git clone --recurse-submodules https://github.com/lennoxsaint/Threadify-workflows.git
# or, in an existing clone:
git submodule update --init engines/eddy
```

## What Stays In Threadify

Threadify keeps the paid execution layer:

- native post generation and draft editing
- reply generation
- advanced analytics and winner strategy
- additional accounts and platforms
- live X Article publishing or scheduling
- premium workflow packs
- hosted calendar and deeper readback surfaces
- private quality and voice systems

Public workflows may describe required capabilities and upgrade points. They must not include the internal logic behind those paid systems.

## Current Self / Brain Sync Rule

Large personal context packets are source artifacts, not direct Brain upload payloads. Public workflows must atomize approved packet updates into small memory records, classify them, stop for approval, verify readback, and return a per-item ledger.

Daily Posts workflows may consume only approved clean Threadify-safe packs or verified Brain memories. They must not consume raw Current Self packets, private metrics, private proof paths, account data, or unapproved memory candidates.

## Quick Start

1. Connect Threadify MCP in your agent client.
2. Pick a workflow under `workflows/`.
3. Open the matching adapter under `adapters/`.
4. Let the agent inspect the workflow manifest.
5. Approve the final action only after the agent shows exact text, account, time, media, and action.
6. Save the receipt.

Validate the repo before publishing or editing:

```sh
npm test
```

`npm test` runs two checks: `validation/schema-checks/validate.mjs` (static manifest/fixture/
redaction shape) and `validation/workflow-simulator/run.mjs` (a dynamic simulator that drives each
workflow against a mock Threadify MCP client through approved, approval-denied, and
tool-unavailable scenarios, then validates every produced receipt/ready-output/ledger against
`schemas/*.json`). Run the simulator alone with `npm run simulate`. See
`validation/workflow-simulator/README.md` for how it works and how to extend it for a new
workflow.

## Local Codex Plugin Wrapper

This repo includes a local dogfood plugin wrapper. The plugin source is the repo
root so Codex can access both the plugin skills and the workflow manifests. It
is separate from OpenAI public directory submission.

Install from this repo root:

```sh
codex plugin marketplace add .
```

Then connect Threadify MCP with OAuth at:

```text
https://www.threadify.app/api/mcp/threadify
```

Do not commit bearer tokens, OAuth tokens, local proxy config, account IDs, or
reviewer credentials into this repo.

## Publication Status

This repo is structured as a public-ready workflow library. Before any public
sync or release announcement, run the checklist in `PUBLICATION_CHECKLIST.md`
and confirm the owner gates listed there.

## Safety Rule

No workflow may schedule, cancel, reschedule, or otherwise mutate Threadify state until the user gives explicit final approval. If MCP is unavailable, the workflow must produce a Threadify-ready artifact and manual fallback steps instead of pretending the action happened.
