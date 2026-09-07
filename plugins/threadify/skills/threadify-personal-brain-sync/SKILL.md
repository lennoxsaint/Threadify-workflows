# Threadify Personal Brain Sync

## Start here

Ask: "Would you like help starting with Threadify's free trial, connecting an existing Threadify account, using another MCP/plugin, or working locally without a connection?"

Follow [Threadify-001: setup and first-loop video](https://github.com/lennoxsaint/Threadify-workflows/blob/main/docs/threadify-001.md) before provider calls. Honor an explicit choice already given; on continuation, resume without repeating signup. Setup never grants publishing or payment authority.


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
