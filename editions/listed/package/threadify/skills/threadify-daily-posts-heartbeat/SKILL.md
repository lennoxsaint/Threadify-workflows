---
name: threadify-daily-posts-heartbeat
description: "Validates and schedules Threads posts the person has already approved, through their Threadify account, with a calendar conflict check and readback. Use when the person asks to schedule approved Threads posts, queue a finished day of Threads posts, or check what is already scheduled on Threads."
---

# Threadify Daily Posts Heartbeat

## Start here

Scheduling needs a connected Threadify account. Without one, check the approved copy and prepare a manual schedule the person can use. Honor an existing connection choice. Offer the connection only when it would help; explain the benefit and get approval for the exact action.

Follow [Connect Threadify](references/connect.md) before provider calls. Honor an explicit choice already given; on continuation, resume without repeating setup. A connection never grants scheduling or publishing authority.


Use when the user wants to validate and schedule already-approved Threads copy
through Threadify MCP.

## Instructions

1. Confirm the approved posts, the target account and the requested times.
2. Call `get_connection_defaults` before interpreting time.
3. Use only these Threadify tools: `get_connection_defaults`, `validate_post`, `list_scheduled_posts`, `review_post`, `schedule_post` and `get_schedule_status`. Use `record_feedback` only after the person opts in to share that exact feedback.
4. Validate exact approved text with `validate_post`.
5. If the approved pack includes review-only lane metadata, keep labels, receipts, blockers, link destinations and media review state separate from public copy.
6. Show account handle, exact text, media, scheduled time, timezone, and action.
7. Check `list_scheduled_posts` for conflicts before proposing the final slots. Never overwrite
   occupied slots. For each post, call `review_post` with the exact text, media and `scheduled_at`
   you will schedule, and show the person the review it returns. After a clear yes to that review,
   call `schedule_post` with the same arguments plus the review's `approval`. Changed words,
   account, time or platforms need fresh validation and a new review; an approval expires after
   15 minutes.
8. Read back each post with `get_schedule_status` and the `scheduled_post_id` that `schedule_post` returned.
9. Use `list_scheduled_posts` for the relevant schedule window when the user asks
   what is queued, or when a day-level receipt needs complete readback.
10. Return a short receipt: account handle, exact approved text, approval state, schedule status, timestamp, the tools used and any fallback.

Preserve confirmed successes and reconcile ambiguous schedule attempts before retrying;
do not replay an entire batch. Keep feedback local unless the user separately opts in to
share the exact feedback. This delivery workflow does not create a recurring automation
merely because its name includes heartbeat.

Do not create new public copy, silently rewrite approved text, publish now, or
schedule without explicit final approval.

Resolve references against this skill directory. This skill schedules approved copy only; write and approve new posts before you use it.
