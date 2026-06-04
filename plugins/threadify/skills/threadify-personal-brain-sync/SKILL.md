# Threadify Personal Brain Sync

Use when the user has an approved Current Self or personal context source packet
and wants Threadify Brain updated safely.

## Instructions

1. Read `workflows/personal-brain-sync-current-self/manifest.json`.
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
6. Stop for explicit approval before `remember`, `correct_memory`, or
   `tombstone_memory`.
7. Read back/query Brain after approved writes.
8. Return a per-item memory update ledger.

Live metrics must be timestamped and source-backed. Do not upload one large
packet blob into Brain.
