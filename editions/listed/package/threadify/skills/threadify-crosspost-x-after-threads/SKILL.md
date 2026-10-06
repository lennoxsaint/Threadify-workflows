---
name: threadify-crosspost-x-after-threads
description: "Turns a Threads post the person already scheduled or published through Threadify into an X version, and schedules it to their connected X account only after they approve its review. Use when the person asks to cross-post, share or follow up on X after a Threads post."
---

# Threadify Crosspost X After Threads

## Start here

Posting to X through Threadify needs a connected Threadify account with an X account connected to the same brand. Without one, prepare the X version for the person to post themselves. Honor an existing connection choice. Offer the connection only when it would help; explain the benefit and get approval for the exact action.

Follow [Connect Threadify](references/connect.md) before provider calls. Honor an explicit choice already given; on continuation, resume without repeating setup. A connection never grants scheduling or publishing authority.


Use when the person has already scheduled or published a Threads post through
Threadify and wants it on X too.

## Instructions

1. Call `get_connection_defaults` first. Confirm the Threads account, the timezone
   and whether an X account is connected to the same brand and ready to post.
2. Find the Threads post. For a scheduled post, use `list_scheduled_posts` and then
   `get_schedule_status` with its `scheduled_post_id`. For a published post, use
   `read_post_performance` with its `post_id`. Use the exact stored text.
3. Prepare the X version from that text. Keep the person's words; Threadify splits
   long text into an X thread, so show where it splits.
4. Call `validate_post` on the text, then `review_post` with the text,
   `platforms: ["x"]` and the `scheduled_at` the person chose, at least 5 minutes
   ahead. Show the review it returns, including the X version and time. Each X post
   counts toward the account's monthly X post limit; say so before they approve.
5. After a clear yes to that review, call `schedule_post` with the same arguments plus
   the review's `approval`. A change to the words, time or platforms needs a new
   review, and an approval expires after 15 minutes.
6. Report the X schedule only as `scheduled_confirmed` when the `schedule_post`
   result confirms it; otherwise report `schedule_unverified` and check before any retry.
7. If no X account is connected, or X posting is not available on this account, say so
   plainly, give the person the X version to post themselves, and record that no X
   action happened.

Use approved clean context or verified Brain memory only. Do not consume raw
Current Self packets.

Resolve references against this skill directory. This skill does not publish immediately or post to X without an approved review.
