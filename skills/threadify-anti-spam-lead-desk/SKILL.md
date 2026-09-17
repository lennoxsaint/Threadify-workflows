---
name: threadify-anti-spam-lead-desk
description: Turn current public Threads comments or a bounded cold-research fallback into a five-card anti-spam Lead Desk and one unsent public-reply draft. Use when the owner wants to find warm signals without automated outreach.
---

# Threadify Anti-Spam Lead Desk

Read `references/threadify-001.md`, `references/workflow-manifest.json`, `references/workflow-readme.md`, and `references/chatgpt-template.md` from this skill directory.

Begin by confirming a real offer and the correct connected Threads account. Discover the host's current comment/reply-read capability before saying the warm-inbound route is available; never hard-code a tool name or simulate a read.

For warm inbound, ask the owner to select one to three owned posts. If the owner explicitly requests an account-wide period, use the discovered read capability to scan that bounded period instead and report coverage limits; a `days` filter may select posts by publication date, not all comments written in the period. Retain only explicit, offer-relevant help or problem signals. Reject generic praise, vague interest, seller funnels, advice posts, stale evidence, duplicates, already-replied comments, and anything whose public context cannot be re-inspected. Open each retained profile in the authenticated Threads browser and record current URL and inspection timestamp. Do not scrape or automate browser navigation. If there are no unreplied comments and the owner asks for examples, label historical comments as filter examples, not pending leads or send targets.

If no warm candidate is Ready, invoke `threadify-qualified-buyer-research` once. Reuse its confirmed Offer Context, narrow-query order, browser inspection, and five-result stopping rule. Do not convert cold evidence into a claim that someone commented or asked for help.

Create no more than five cards: Ready, Research, or Reject. Every card must include route, source URL and timestamp, profile URL and timestamp, reinspection state, and the limitation `current_public_context_only`. Draft at most one useful public reply, with exact text and destination, marked `draft` and `send_performed: false`. Desk creation does not DM, schedule, or send, and it does not claim lead, booking, sale, or revenue outcomes.

Use the installed exact-release CLI at `node ~/.threadify-workflows/current/cli/bin/threadify-workflows.mjs lead-desk < input.json`; when `THREADIFY_WORKFLOWS_HOME` was set during installation, resolve `current/cli/bin/threadify-workflows.mjs` below that state root instead. In a source checkout, use `node bin/threadify-workflows.mjs lead-desk < input.json`. It produces JSON with Markdown and a three-lane HTML preview. For an editable review page, run `lead-desk serve --input /absolute/input.json --state /absolute/private/review.json`, open its printed loopback URL, and keep the server running. The page saves the exact edited reply to private local state; clicking **Mark Final for Review** saves its final text, SHA-256 hash, and revision. After the owner says to send, read `lead-desk status --state /absolute/private/review.json` and require `status: final_for_review`. Recheck the account, exact target, pending reply state, safety, and anti-slop gate before any separately authorized live send; re-read the same final revision immediately before sending. If the text changes, final status is revoked. Never infer final approval from an exported HTML file, browser local storage, or a stale screenshot. A missing capability or no viable candidate is a valid, explicit outcome.

The review page and CLI do not send. A final mark alone is not send authority; the owner must separately request sending, then the host must use a verified live delivery route and provider readback. Do not DM from this skill. If the owner wants to turn a Ready card into a private next step, hand off to `threadify-agree-next-step`; that workflow separately enforces recipient interest and channel permission.
