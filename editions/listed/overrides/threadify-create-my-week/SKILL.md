---
name: threadify-create-my-week
description: "Set from edition.json at build time."
---

# Create My Week

Plan seven Threads posts for the coming week, write them as Threadify drafts in the person's voice, and schedule each one only after the person approves its exact review.

The person's own instructions come first. If they ask for something different from this guide, such as five posts or two a day, do what they ask within the review rules below, and say what changed.

Follow [Connect Threadify](references/connect.md) before the first Threadify call.

## Scope

- Use only the Threadify tools named in this skill. Keep no notes in files and run no programs or local pages. The plan lives in Threadify: written posts are drafts, and scheduled posts are on the calendar.
- This skill does not publish immediately, answer comments, add offers or plugs, or turn on automatic posting.
- If a call answers `account-not-ready`, say only: "Finish setting up your Threadify account at threadify.app, then say continue." Then stop. If a call answers `not-available`, say so plainly and offer what still works, such as keeping the posts as drafts.

## 1. Read the account

1. `get_connection_defaults`: say the @handle and time zone. If the time zone is missing or is UTC, ask which time zone they are in, and from then on write every time with an explicit offset, such as 2026-10-07T09:00:00-04:00.
2. `get_brain_overview`: who they help, how they sound, and topics they cover.
3. `list_scheduled_posts` with `days` set to 8: which of the next seven days are already taken.
4. `best_time_to_post`: their best time slots.
5. `list_drafts`: drafts from an earlier run of this plan. Reuse them; do not write the same topic twice.

## 2. Find the open days

Use the next seven local days, starting tomorrow unless the person names a start. A day that already has a scheduled post is taken, unless the person asks for more than one post a day.

## 3. Propose the week

Show one row per open day: the day and date, the local time, the topic and the format. Formats are short posts (a one-liner or a list post) and threads (teaching, a story, or an opinion). Mix them across the week.

- Times: the best slot for that day from `best_time_to_post`. A new account has no history, so suggest 9am in their time zone and ask.
- Topics: from what the Brain says they cover and what they have told you. Add no offers or links unless they ask.

Ask the person to approve the plan or change any row. This approval is for writing the drafts, not for scheduling.

## 4. Write the drafts

For each approved row, call `generate_content` with the topic and the angle as `inputText`, contentType short-form or long-form to match the format, and the matching style. Each call saves a Threadify draft and returns its `draft_id`. Read the full words with `get_draft` and that `draft_id`.

If writing stops partway, the finished drafts are already in Threadify. Read them back with `list_drafts` and continue with the rows that are left.

## 5. Show the week

Show all seven together: the day, the local time and the exact words of each post. For changes, call `edit_draft` with the `draft_id` and the person's request as the `instruction`, then show that post again.

## 6. Review, then schedule

Check `list_scheduled_posts` again first. A day that has been taken since the plan needs a new time.

For each post:

1. Call `validate_post` with its exact words. If it finds a problem, fix it and show the changed words.
2. Call `review_post` with exactly the arguments you will schedule: the `draft_id` and `scheduled_at` with an explicit offset. Post to Threads only: leave out other platforms, plugs and reposts.

Show the reviews as they came back: all seven together, or one at a time if the person prefers. Each review shows the exact words, the @handle and the local date and time. Ask which ones to schedule.

Only after a clear yes to a post's review, call `schedule_post` with the same arguments plus that review's `approval`. Posts without a yes stay as drafts.

- Silence is never a yes, and a yes given before the review does not count.
- A change to a post's words, account or time needs a new review for that post. An approval expires after 15 minutes; if they take longer, review again.
- If the result of `schedule_post` is unclear, check `list_scheduled_posts` before trying again, and retry only with the same approval, which returns the first result instead of scheduling twice.

## 7. Read the calendar back

Call `get_schedule_status` with each `scheduled_post_id` that `schedule_post` returned, and check the stored words and time against the review. Then call `list_scheduled_posts` for the week.

Report the week as it now stands: each scheduled post with its local day and time, the posts still waiting as drafts, and anything that failed with the reason. Scheduled is not published; each post goes out at its time.
