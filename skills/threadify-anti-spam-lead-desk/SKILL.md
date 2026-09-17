---
name: threadify-anti-spam-lead-desk
description: Turn current public Threads comments or a bounded cold-research fallback into a five-card anti-spam Lead Desk and one unsent public-reply draft. Use when the owner wants to find warm signals without automated outreach.
---

# Threadify Anti-Spam Lead Desk

Read `references/threadify-001.md`, `references/workflow-manifest.json`, `references/workflow-readme.md`, and `references/chatgpt-template.md` from this skill directory.

Begin by confirming a real offer and the correct connected Threads account. Discover the host's current comment/reply-read capability before saying the warm-inbound route is available; never hard-code a tool name or simulate a read.

For warm inbound, ask the owner to select one to three owned posts. Read their current comments through the discovered capability, then retain only explicit, offer-relevant help or problem signals. Reject generic praise, vague interest, seller funnels, advice posts, stale evidence, duplicates, and anything whose public context cannot be re-inspected. Open each retained profile in the authenticated Threads browser and record current URL and inspection timestamp. Do not scrape or automate browser navigation.

If no warm candidate is Ready, invoke `threadify-qualified-buyer-research` once. Reuse its confirmed Offer Context, narrow-query order, browser inspection, and five-result stopping rule. Do not convert cold evidence into a claim that someone commented or asked for help.

Create no more than five cards: Ready, Research, or Reject. Every card must include route, source URL and timestamp, profile URL and timestamp, reinspection state, and the limitation `current_public_context_only`. Draft at most one useful public reply, with exact text and destination, marked `draft` and `send_performed: false`. Do not DM, schedule, send, or claim lead, booking, sale, or revenue outcomes.

Use the installed exact-release CLI at `node ~/.threadify-workflows/current/cli/bin/threadify-workflows.mjs lead-desk < input.json`; when `THREADIFY_WORKFLOWS_HOME` was set during installation, resolve `current/cli/bin/threadify-workflows.mjs` below that state root instead. In a source checkout, use `node bin/threadify-workflows.mjs lead-desk < input.json`. It produces the JSON artifact plus embedded Markdown and HTML views. A missing capability or no viable candidate is a valid, explicit outcome.

Do not execute an external action from this skill. If the owner wants to turn a Ready card into an approved next step, hand off to `threadify-agree-next-step`; that workflow separately enforces recipient interest and channel permission.
