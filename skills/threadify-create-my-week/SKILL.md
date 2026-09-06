---
name: threadify-create-my-week
description: Prepare a seven-day Threads content blueprint and resumable daily drafts. Use for a week plan, with rolling Day 1 drafting by default or upfront drafts by choice.
---

# Create My Week

Read [the complete creator protocol](references/creator-system.md), then [the engine command contract](references/creator-engine.md) before acting. These bundled references own the shared source, rights, review, recovery and delivery rules.

Use horizon week: exactly seven days. Default mode rolling; prepare the full blueprint and exact Day 1 review. Offer upfront only as a drafting choice, not scheduling approval. Continue via the same stored plan.

Run this skill's bundled `scripts/creator.mjs` with Node 18+ and a dedicated private state directory. Pass JSON through stdin. The engine performs no provider calls. Use host-native capabilities when available; do not claim missing filesystem, Threadify or reminder capabilities exist.

Preserve explicit user choices and current owner authority. Local preparation does not authorize Vault imports, feedback sends, native reminders, scheduling or publication. Stop at missing credentials/security challenges or an unresolved provider attempt; retain exact prepared work and request only the missing owner action.
