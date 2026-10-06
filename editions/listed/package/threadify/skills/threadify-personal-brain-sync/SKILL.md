---
name: threadify-personal-brain-sync
description: "Splits a personal context packet the person approves into small, classified memories, saves each one to their Threadify Brain only after they approve its exact text, and reads it back. Use when the person asks to sync, update or teach their Threadify Brain who they are now from notes or a profile they provide."
---

# Threadify Personal Brain Sync

## Start here

Saving memories needs a connected Threadify account. Without one, prepare the proposed memory ledger the person can review. Honor an existing connection choice. Offer the connection only when it would help; explain the benefit and get approval for the exact action.

Follow [Connect Threadify](references/connect.md) before provider calls. Honor an explicit choice already given; on continuation, resume without repeating setup. A connection never grants authority to change memories.


Use when the user has an approved Current Self or personal context source packet
and wants Threadify Brain updated safely.

## Instructions

1. Call `get_connection_defaults` first and confirm the account whose Brain will change.
2. Treat the packet as a source artifact only.
3. Propose small atomic memories.
4. Classify each memory:
   - `evergreen_identity`
   - `live_metric`
   - `voice_litmus`
   - `channel_voice`
   - `workflow_lesson`
   - `relationship_context_note`
   - `temporary_current_state_note`
5. Show exact memory text, class, source note, and expiry/review date where relevant.
6. Stop for explicit approval before each write: `remember` with the approved `fact`,
   `correct_memory` with its `before` and `after`, or `tombstone_memory` with the
   `fragment_id` found through `get_brain_full` (`section: "fragments"`).
7. Read back each approved write with `query_brain`, using a `prompt` that names it.
8. Return a per-item memory update ledger.

Live metrics must be timestamped and source-backed. Do not upload one large
packet blob into Brain.

Resolve references against this skill directory. If tools are unavailable, return the proposed ledger with every write and readback marked not done, and do not claim the Brain changed.
