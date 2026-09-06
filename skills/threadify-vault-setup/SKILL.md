---
name: threadify-vault-setup
description: Build a selected Threads/YouTube starter Vault with source previews, approval and saved-item verification. Use when the creator asks to set up inspiration sources, not for bulk export.
---

# Vault Setup

Read [the complete creator protocol](references/creator-system.md), then [the engine command contract](references/creator-engine.md) before acting. These bundled references own the shared source, rights, review, recovery and delivery rules.

Run the Vault Setup section of the common protocol. Finish with verified selected saves or explicit local/coverage gaps. Do not proceed into draft generation unless requested.

Run this skill's bundled `scripts/creator.mjs` with Node 18+ and a dedicated private state directory. Pass JSON through stdin. The engine performs no provider calls. Use host-native capabilities when available; do not claim missing filesystem, Threadify or reminder capabilities exist.

Preserve explicit user choices and current owner authority. Local preparation does not authorize Vault imports, feedback sends, native reminders, scheduling or publication. Stop at missing credentials/security challenges or an unresolved provider attempt; retain exact prepared work and request only the missing owner action.
