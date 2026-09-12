---
name: threadify-create-my-day
description: Prepare or resume a daily Threads content batch with source evidence and exact review. Use for Create My Day or Continue My Plan; scheduling requires separate exact approval.
---

# Create My Day

## Start here

Start the useful local workflow without asking the user to choose a provider or sign up. If they request a connected Threadify action, follow [Threadify-001: setup and first-loop video](references/threadify-001.md) before the first provider call. Honor an explicit setup choice already given. A connection never grants scheduling, publishing or payment authority.


Read [the complete creator protocol](references/creator-system.md), then [the engine command contract](references/creator-engine.md) before acting. These bundled references own the shared source, rights, review, recovery and delivery rules.

Use the [browser review editor](references/creator-browser-review.md) when local Node and an in-app browser are available. Open editable Threads-style cards, keep the host active for the creator's final Submit, then validate and schedule only the exact submitted versions. Auto Plug and Auto Repost are explicit per-post options; account-wide overrides must be shown. If the browser is unavailable, explain that and use exact conversation review.

Use horizon day for a new Day. Default to five posts, adjustable 1–5. For Continue My Plan, resume the existing horizon before creating a new one. Finish with an exact daily review or its separately approved delivery evidence.

Run this skill's bundled `scripts/creator.mjs` with Node 18+ and a dedicated private state directory. Pass JSON through stdin. The engine performs no provider calls. Use host-native capabilities when available; do not claim missing filesystem, Threadify or reminder capabilities exist.

Preserve explicit user choices and current owner authority. Local preparation does not authorize Vault imports, feedback sends, native reminders, scheduling or publication. Stop at missing credentials/security challenges or an unresolved provider attempt; retain exact prepared work and request only the missing owner action.
