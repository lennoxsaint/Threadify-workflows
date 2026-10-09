# Threadify Workflows

Threadify Workflows is the Claude Code plugin for [Threadify](https://www.threadify.app), the lead generation agent for Threads. It installs 37 skills that take an owner from setup to a daily posting routine: connect the Threadify account, build the Brain and voice profile, choose an offer, research qualified buyers, prepare and review posts, run the growth loop, and reply to inbound conversations. Every connected action shows one exact step for approval first and records a receipt.

## What the plugin contains

- **Skills**: `skills/<name>/SKILL.md` plus the references and scripts each skill needs. The scripts run locally with Node 18 or newer and keep their state in a private directory the owner chooses.
- **One MCP server**: `threadify`, declared in `.mcp.json` as a streamable HTTP endpoint at `https://www.threadify.app/api/mcp/threadify`. It uses OAuth; Claude Code asks for sign-in on first use. Nothing is sent to the server until a skill reaches a step that needs the connected account, and only after the owner approves that step.
- **No other network destinations.** The YouTube Synthesizer skill fetches public video metadata and captions from YouTube when the owner supplies a video link. No skill downloads or runs code from the network.

## How to install

From Claude Code:

```
/plugin marketplace add lennoxsaint/Threadify-workflows
/plugin install threadify-workflows@threadify
```

Skills appear as `/threadify-workflows:<skill>`, for example `/threadify-workflows:threadify-get-set-up`. Start with Get Set Up, then Your Next Moves.

## Privacy and data

Local preparation happens on the owner's machine. Conversation state, drafts and receipts stay in the private directory the owner selects. The plugin never asks for passwords, cookies or pasted credentials. See the [privacy policy](https://www.threadify.app/privacy).

## Source and support

This folder is generated from the [Threadify Workflows repository](https://github.com/lennoxsaint/Threadify-workflows), which also ships the same catalog for Codex, Cursor, Gemini and other clients through its installer. Report problems in that repository's issues.
