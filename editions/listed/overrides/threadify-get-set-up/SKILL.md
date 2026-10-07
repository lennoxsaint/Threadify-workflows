---
name: threadify-get-set-up
description: "Set from edition.json at build time."
---

# Get set up with Threadify

Take the person from their first message to one scheduled Threads post in a single sitting. Plan on about 12 tool calls and at most six questions, asked one at a time. A yes to the exact summary (step 4) and a yes to the exact review (step 7) are approvals, not extra questions, and you always ask for both.

The person's own instructions come first. If they ask for something different from this guide, do what they ask within the review rules below, and say which step you are leaving out.

Follow [Connect Threadify](references/connect.md) before the first Threadify call.

## Scope

- Use only the Threadify tools named in this skill. Keep no notes in files and run no programs or local pages. Progress lives in Threadify: the Brain, the drafts and the calendar.
- This skill schedules one post on Threads. It does not publish immediately, answer comments, create offers, turn on automatic posting or set up a recurring routine. If the person asks for one of those, finish setup first, then point them to it in plain words.
- If a call answers `not-available`, say so plainly and carry on with what works, such as keeping the post as a draft.

## 1. Check the account

Call `get_connection_defaults`. Say the @handle and time zone it returns, and ask: "Is this the right account and time zone?" (question 1).

- If the time zone is missing or is UTC, ask which time zone they are in. From then on, write every time with an explicit offset, such as 2026-10-07T09:00:00-04:00.
- If no Threads account is connected, or any call answers `account-not-ready`, say only this one sentence: "Finish setting up your Threadify account at threadify.app, then say continue." Add nothing about what the account includes or costs. Stop there. When they say continue, start again at step 1.

## 2. Pick up where they left off

Read back what Threadify already holds instead of asking again:

1. `get_brain_overview`: is there a saved persona that says who they help, what readers should do next and how they sound?
2. `list_drafts`: is there a recent draft from an earlier try?
3. `list_scheduled_posts`: is a post already scheduled?

Continue from the first step that is not done. A post already on the calendar means setup's goal is met: read it back (step 8) and offer to write another. A saved persona skips steps 3 and 4. A recent unscheduled draft can be the first post: offer it, and go to step 5 to show it.

## 3. Learn who they are

Ask three short questions, one at a time:

2. "Who do you help?"
3. "After someone reads your posts, what do you want them to do next?" For example: follow, reply, send a message or visit a page.
4. "How do you sound? Paste two or three posts you like, or describe it in a few words."

If the account already has posts, read them with `greatest_hits` (or `read_post_performance` when it returns nothing) instead of asking for samples. Describe the voice you see in one or two lines, and fold "Does that sound like you?" into the summary in step 4.

## 4. Save what you learned

Show the exact summary you will save: who they help, what readers should do next, and how they sound. In the same message, ask for the first post's topic, or offer three topics drawn from their answers (question 5).

Save nothing until they say yes to the summary. If they change it, show the new summary and ask again. On a yes:

1. Call `update_persona` with a `profile` holding only those three keys, for example audience, next_step and voice.
2. Call `remember` with one `fact` in their own words, such as what they want readers to do next.
3. If they pasted posts or other writing, call `ingest_brain_source` with a short `title` such as "My writing samples" and the pasted text as `content`. Saved writing is learned at the Brain's next sync; do not say it has already been learned.
4. Check with `query_brain`, with a `prompt` such as "who I help and how I sound". Tell them plainly what came back. Do not claim the Brain knows something it did not return.

## 5. Write the first post

Call `generate_content` with the topic as `inputText` and contentType short-form, for one short post. Do not attach an offer or a link the person did not give you.

Call `get_draft` with the `draft_id` it returned and show the exact words. In the same message, suggest a time (step 6) and ask: "Want any changes, and does this time work?" (question 6).

For changes, call `edit_draft` with the `draft_id` and their request as the `instruction`, then show the new words. Stop after two rounds of `edit_draft`. After that, ask them to type the exact words they want and use those words as the post text.

## 6. Pick a time

Call `list_scheduled_posts` to see which days are taken, and `best_time_to_post` for their best slot. A new account has no history, so suggest tomorrow at 9am in their time zone. Otherwise suggest the best open slot in the next two days. Say the day, date and local time.

## 7. Review, then schedule

1. Call `validate_post` with the exact words. If it finds a problem, fix it, show the changed words and get a yes to them first.
2. Call `review_post` with exactly the arguments you will schedule: the `draft_id` (or the exact `text`) and `scheduled_at` with an explicit offset. Post to Threads only: leave out other platforms, plugs and reposts.
3. Show the review as it came back: the exact words, the @handle and the local date and time. Ask: "Schedule this?"
4. Only after a clear yes to this review, call `schedule_post` with the same arguments plus the review's `approval`.

Silence is never a yes, and a yes given before this review does not count. If the words, account or time change, call `review_post` again and show the new review. An approval expires after 15 minutes; if they take longer, review again. If the result of `schedule_post` is unclear, check `list_scheduled_posts` before trying again, and retry only with the same approval, which returns the first result instead of scheduling twice.

## 8. Confirm and finish

Call `get_schedule_status` with the `scheduled_post_id` that `schedule_post` returned. Check that the stored words and time match the review, then say: "Scheduled for <day, date and local time> on @handle."

Tell them how to change it: ask here, for example "move my first post to Friday at 6pm" or "cancel my first post", or change it in the Threadify calendar.

End by naming two next steps in plain words: "plan and write a whole week of posts" and "answer the comments people leave on your posts."
