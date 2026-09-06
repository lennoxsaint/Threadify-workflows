---
name: threadify-create-my-day
description: Prepare or resume a daily Threads content batch with source evidence and exact review. Use for Create My Day or Continue My Plan; scheduling requires separate exact approval.
---

# Create My Day

Read [the complete creator protocol](references/creator-system.md), then [the engine command contract](references/creator-engine.md) before acting. These bundled references own the shared source, rights, review, recovery and delivery rules.

Use horizon day for a new Day. Default to five posts, adjustable 1–5. For Continue My Plan, resume the existing horizon before creating a new one. Finish with an exact daily review or its separately approved delivery evidence.

Run this skill's bundled `scripts/creator.mjs` with Node 18+ and a dedicated private state directory. Pass JSON through stdin. The engine performs no provider calls. Use host-native capabilities when available; do not claim missing filesystem, Threadify or reminder capabilities exist.

Preserve explicit user choices and current owner authority. Local preparation does not authorize Vault imports, feedback sends, native reminders, scheduling or publication. Stop at missing credentials/security challenges or an unresolved provider attempt; retain exact prepared work and request only the missing owner action.
