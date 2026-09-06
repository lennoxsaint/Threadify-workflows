---
name: threadify-daily-posts-heartbeat
description: "Advanced workflow. Use when the user wants to validate and schedule already-approved Threads copy through Threadify MCP."
---

# Threadify Daily Posts Heartbeat

Use when the user wants to validate and schedule already-approved Threads copy
through Threadify MCP.

## Instructions

1. Read `references/workflow-manifest.json` from the workflow repo.
2. Call `get_connection_defaults` before interpreting time.
3. Use only MCP tools listed in the manifest.
4. Validate exact approved text with `validate_post`.
5. If the approved pack includes review-only lane metadata, keep labels, receipts, blockers, CTA destinations, UTM sources, and media review state separate from public copy.
6. Show account handle, exact text, media, scheduled time, timezone, and action.
7. Check `list_scheduled_posts` for conflicts before proposing the final slots. Never overwrite
   occupied slots. Stop for explicit final approval before `schedule_post`; approval binds the
   exact copy, media, account and times shown. Changed items need fresh validation and approval.
8. Read back status with `get_schedule_status`.
9. Use `list_scheduled_posts` for the relevant schedule window when the user asks
   what is queued, or when a day-level receipt needs complete readback.
10. Return a receipt matching the manifest.

Preserve confirmed successes and reconcile ambiguous schedule attempts before retrying;
do not replay an entire batch. Keep feedback local unless the user separately opts in to
share the exact feedback. This delivery workflow does not create a recurring automation
merely because its name includes heartbeat.

Do not create new public copy, silently rewrite approved text, publish now, or
schedule without explicit final approval.

Resolve references against this skill directory. For a new creator Day, Week or Month, use the primary creator skills instead.
