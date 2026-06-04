# Personal Brain Sync / Current Self Packet

Use this workflow when a user has an approved personal context packet and wants
Threadify Brain updated safely.

The packet is source material. It is not the upload payload.

## Operating Loop

1. Load the approved source artifact.
2. Propose candidate memory changes.
3. Split candidates into small atomic records.
4. Classify each record:
   - `evergreen_identity`
   - `live_metric`
   - `voice_litmus`
   - `channel_voice`
   - `workflow_lesson`
   - `relationship_context_note`
   - `temporary_current_state_note`
5. Show exact memory text, class, source note, and expiry/review date where
   relevant.
6. Stop for explicit approval.
7. Write only approved memories.
8. Query/read back Threadify Brain to verify retention and usefulness.
9. Correct, tombstone, or retry memories that fail readback or become stale.
10. Emit a per-item memory update ledger.

## Metric Rule

Live metrics are not identity facts.

Follower counts, member counts, user counts, pricing numbers, revenue numbers,
cohort sizes, launch status, and date-relative counters must be timestamped and
source-backed. They should be stored as `live_metric` or
`temporary_current_state_note`, never as timeless identity.

## Workflow Lesson

If a bulk packet upload performs poorly, capture that as a `workflow_lesson`:
large personal packets should be atomized into small, approved memories with
readback proof.

## Daily Posts Boundary

Daily Posts should consume only an approved clean Threadify-safe pack or verified
Brain memories.

Daily Posts must not consume raw personal packets, private metrics, private
proof paths, unapproved memory candidates, account data, or member/course
material.

## Fallback

If MCP tools are unavailable, return a proposed memory update ledger and mark all
write/readback fields as not executed. Do not claim Threadify Brain changed.

