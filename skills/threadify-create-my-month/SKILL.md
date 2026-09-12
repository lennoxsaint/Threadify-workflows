---
name: threadify-create-my-month
description: Prepare a 28-day, four-week Threads content blueprint with daily reviews. Use for a month of content; clarify that this is four weeks, not a variable calendar month.
---

# Create My Month

## Start here

Start the useful local workflow without asking the user to choose a provider or sign up. If they request a connected Threadify action, follow [Threadify-001: setup and first-loop video](references/threadify-001.md) before the first provider call. Honor an explicit setup choice already given. A connection never grants scheduling, publishing or payment authority.


Read [the complete creator protocol](references/creator-system.md), then [the engine command contract](references/creator-engine.md) before acting. These bundled references own the shared source, rights, review, recovery and delivery rules.

Use the [browser review editor](references/creator-browser-review.md) when local Node and an in-app browser are available. Open editable Threads-style cards, keep the host active for the creator's final Submit, then validate and schedule only the exact submitted versions. Auto Plug and Auto Repost are explicit per-post options; account-wide overrides must be shown. If the browser is unavailable, explain that and use exact conversation review.

Use horizon month: exactly 28 days, visibly labeled four weeks. Default mode rolling; prepare the complete blueprint and exact Day 1 review. Offer upfront drafting without implying later scheduling approval.

Run this skill's bundled `scripts/creator.mjs` with Node 18+ and a dedicated private state directory. Pass JSON through stdin. The engine performs no provider calls. Use host-native capabilities when available; do not claim missing filesystem, Threadify or reminder capabilities exist.

Preserve explicit user choices and current owner authority. Local preparation does not authorize Vault imports, feedback sends, native reminders, scheduling or publication. Stop at missing credentials/security challenges or an unresolved provider attempt; retain exact prepared work and request only the missing owner action.
