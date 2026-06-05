# Threadify Workflows

Threadify Workflows is a public, MCP ready workflow library for running creator workflows through Threadify from agent clients such as Hermes, Gemini, Codex, Claude, OpenClaw, Cursor, and any generic MCP client.

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
- A dependency-free validator for manifests, fixtures, redaction, and launch claims.

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
