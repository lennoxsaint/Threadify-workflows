# Threadify for ChatGPT and Codex

This folder is the plugin package submitted to OpenAI's plugin directory. It carries the same skills as the Claude plugin in `plugins/claude`, packaged the way OpenAI's directory expects: `plugin.json`, `mcp.json`, `skills/` and `assets/` at the package root.

## What the plugin contains

- **Skills**: `skills/<name>/SKILL.md` plus the references and scripts each skill needs, copied from the Claude plugin. The scripts run with Node 18 or newer where the app can run them, and keep their state in a private directory the owner chooses.
- **One MCP server**: `threadify`, declared in `mcp.json` as a streamable HTTP endpoint at `https://www.threadify.app/api/mcp/openai`. That is Threadify's address for OpenAI's directory: it has no autopilot mode and no upgrade prompts. It uses OAuth; the app asks the owner to sign in on first use, and nothing is sent to it until a skill reaches a step that needs the connected account and the owner approves that step.
- **No other network destinations**, except that the YouTube Synthesizer skill fetches public video metadata and captions from YouTube when the owner supplies a video link.

## How it differs from the Claude plugin

Only where the platform needs it, applied by `scripts/build-openai-plugin.mjs`:

- Every mention of Threadify's standard connection address points at the OpenAI address instead.
- No plan, trial or upgrade promotion, as OpenAI's commerce rules require: the shared setup guide has no plans-page link, the setup question offers connecting an existing account or working locally, Get Set Up starts from an existing Threadify account, Monetize My Week explains a plan limit without pointing anywhere to change plans, and Monetize My Week and Offer Builder use the user's saved offer destination even when Threadify is the offer.
- YouTube Synthesizer's example library quotes two creator threads whose last post advertised a Threadify plan. In this package those two posts are replaced by a marked omission, and the library's integrity lock is recomputed with the skill's own checks, so the skill still verifies itself.

## Building and packaging

Do not edit files in `skills/` or `mcp.json` here: edit the skills at the repository root and run `npm run bundle:build`. `plugin.json`, this README and `assets/` are source files. To make the ZIP for the submission portal, zip the contents of this folder so `plugin.json` sits at the ZIP root:

```sh
mkdir -p dist && (cd plugins/openai && zip -qr -X ../../dist/threadify-openai-plugin.zip . -x '.DS_Store')
```

## Privacy and data

Local preparation happens on the owner's machine. Conversation state, drafts and receipts stay in the private directory the owner selects. The plugin never asks for passwords, cookies or pasted credentials. See the [privacy policy](https://www.threadify.app/privacy) and [support](https://www.threadify.app/contact).
