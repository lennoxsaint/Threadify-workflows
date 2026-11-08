# Threadify Workflows

Threadify Workflows is the Claude Code plugin for [Threadify](https://www.threadify.app), the lead generation agent for Threads. Its skills take an owner from setup to a daily posting routine: connect the Threadify account, build the Brain and voice profile, choose an offer, research qualified buyers, prepare and review posts, run the growth loop, and reply to inbound conversations. Every connected action shows one exact step for approval first and records a receipt.

## What the plugin contains

- **Skills**: `skills/<name>/SKILL.md` plus the references and scripts each skill needs. The scripts run locally with Node 18 or newer and keep their state in a private directory the owner chooses. Nothing in the plugin downloads code and runs it.
- **One MCP server**: `threadify`, declared in `.mcp.json` as a streamable HTTP endpoint at `https://www.threadify.app/api/mcp/threadify`. It uses OAuth; Claude Code asks for sign-in on first use. Nothing is sent to the server until a skill reaches a step that needs the connected account, and only after the owner approves that step.

## What runs and where data goes

Besides the Threadify server, a few skills contact these destinations, each only when the owner runs that skill:

- **YouTube Synthesizer** reads public video metadata and captions from YouTube for a link the owner supplies. If `yt-dlp` is installed, it can run it locally to save the captions.
- **Director Mode** edits the owner's own video on their machine with `ffmpeg`, `ffprobe` and `whisper-cli`, which the owner installs. It searches and downloads CC0 or public-domain sound effects from Openverse (`api.openverse.org`), and its `model get` command downloads the free whisper.cpp speech model from Hugging Face once. The original video is never changed.
- **Go Make Money** reads the owner's own public landing page, without cookies or sign-in. For a second opinion it runs the owner's own `codex` or `claude` command line with no tools and no prior context. Its celebration page loads fonts from Google Fonts.
- **Publish Everywhere** uploads the owner's video to the upload address Threadify returns, and checks the file locally with `ffmpeg`.
- **Scheduler Showdown** compares schedulers only through the MCP connections the owner has already added (for example Buffer or Typefully).

The plugin takes no API keys, tokens or other credentials from the owner's machine. Skills that need the owner's own key for another service are not part of this plugin.

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

This folder is generated from the [Threadify Workflows repository](https://github.com/lennoxsaint/Threadify-workflows), which also ships the catalog for Codex, Cursor, Gemini and other clients through its installer. Report problems in that repository's issues.
