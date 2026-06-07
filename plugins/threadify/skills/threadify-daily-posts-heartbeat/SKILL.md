# Threadify Daily Posts Heartbeat

Use when the user wants to validate and schedule already-approved Threads copy
through Threadify MCP.

## Instructions

1. Read `workflows/daily-posts-heartbeat/manifest.json` from the workflow repo.
2. Call `get_connection_defaults` before interpreting time.
3. Use only MCP tools listed in the manifest.
4. Validate exact approved text with `validate_post`.
5. If the approved pack includes review-only lane metadata, keep labels, receipts, blockers, CTA destinations, UTM sources, and media review state separate from public copy.
6. Show account handle, exact text, media, scheduled time, timezone, and action.
7. Stop for explicit final approval before `schedule_post`.
8. Read back status with `get_schedule_status`.
9. Use `get_schedule_report` for the relevant schedule window when the user asks
   what is queued, or when a day-level receipt needs complete readback.
10. Return a receipt matching the manifest.

Do not create new public copy, silently rewrite approved text, publish now, or
schedule without explicit final approval.
