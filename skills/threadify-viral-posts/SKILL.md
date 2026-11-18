---
name: threadify-viral-posts
description: "Advanced workflow. Start locally from confirmed facts and supplied posts without a Threadify account. Finds the post shapes that went viral for the creator more than once, writes a small batch of new Threads posts on those exact skeletons from the creator's own facts, checks every post and proposes a schedule. Schedules only after an explicit yes on the exact batch, and never publishes now."
---

# Threadify Viral Posts

Start locally from confirmed facts and supplied posts without a Threadify account. Honor an existing connection choice. Offer a connection only when an available hosted capability would help; explain the benefit and obtain approval for the exact provider action.

Follow [Threadify-001: setup and first-loop video](references/threadify-001.md) before provider calls. Honor an explicit choice already given; setup never grants scheduling or publishing authority.

Use this when the creator says "viral posts", "make me viral posts" or "write posts from my viral templates". It makes posts only, for Threads only. It uses only the Threadify tools named below: no browser, no other scheduler and no other network.

## The five rules creators gave us

These come from real creators turning down drafts. Follow every one for every post.

1. **Copy the proven skeleton line for line.** A draft that is "not an exact template of posts that went viral" gets rejected. Keep the template's line count, line breaks, list shape, length and ending. Change only the filled-in words.
2. **Short hooks.** The hook (first line) is 80 characters or less, unless the template's own proven hook is longer. Then match its length, never go past it.
3. **The creator's energy, not a robot's.** Write in the voice and energy of the creator's own top posts. If a draft reads flat next to its evidence posts, it fails.
4. **Deliver what the hook promises.** Run a fresh-reader check: pretend you see only this post, nothing else. Did it give you what the hook promised? If not, it fails.
5. **Show every part of a thread.** At the approval gate, show the full text of every part, in order. Never show only the first post of a thread.

Never invent a number, quote, name or story. Every fact in a draft must come from the creator's Brain, their own posts or what they told you in this chat.

## Steps

1. **Connect check.** Call `get_connection_defaults` first. Read the account handle, timezone, scopes and generation quota from it. Use that timezone for every time you show. If there is no working connection, go to the local fallback below.
2. **Find what went viral more than once.**
   - Call `greatest_hits` with `metric: "views"` and a `limit` of at least 20, all-time. Call `read_post_performance` with `all_time: true`, `sort_by: "views"` and a `limit` big enough to see the whole account (for example 200) so you know the account's top 10% view line. Use `search_posts` to find more posts that share a hook or shape you spotted.
   - For any thread, call `get_post_thread` to read every part. The analytics tools return only the first part.
   - Call `list_viral_items` and `get_viral_item` to look at viral posts in the shared Viral library that match the creator's topics. A library post counts only when it shows clear engagement (its recorded likes). Being public does not give copy rights: borrow the shape only, never the words.
   - A **template** is a hook skeleton or post shape that reached the creator's top 10% by views at least twice, or a library post with clear engagement. Write the skeleton with placeholders, for example `i [did X] for [time]. here's what [result]:`.
   - For each template show its evidence: each post's first line, date and view count, plus the top 10% line it beat. A shape that hit the top 10% only once is "unproven". Label it that way and never use it in this batch.
   - Check each template is not **tired**: use `search_posts` on its hook to see its three most recent uses by date. If all three fell under the top 10% line, the audience has had enough of it for now. Label it "tired", show those three view counts, and pick another template.
3. **Write.** Pick up to three templates, each one different. For each, call `query_brain` for the real facts that fill its placeholders. Then call `generate_content` with the skeleton written out line for line, the facts, and the rule "keep this skeleton exactly; change only the placeholder words". Use `contentType: "long-form"` for a thread template and `"short-form"` for a single post. Make two versions per template (two calls, for example with a different style preset), then pick the best one per template and say why in one line. Check the quota first; do not spend more generations than the batch needs. If a version comes back off the skeleton, it counts as a failed version, not a draft to fix by hand.
4. **Check every final post.** A post must pass all of these before it can be shown for approval:
   - `validate_post` returns valid for the exact parts, in order.
   - The skeleton matches the template line for line (same line count and shape).
   - The hook is 80 characters or less, or no longer than the template's proven hook.
   - The fresh-reader check passes: the body gives what the hook promised.
   - A thread has every part present and in order.
   - Every number, quote and story traces to the Brain, the creator's posts or this chat.
   - No two posts in the batch share a hook or a template.
   If a post fails, fix it (or write it again) and check again. Say which check failed and what changed.
5. **Plan the times.** Call `best_time_to_post` for the best slots. Call `list_scheduled_posts` for the window. The number of posts it returns must equal its `total_in_window`. If it does not, raise the `limit` and call it again. Never treat a short list as a free calendar. Every proposed slot must fall inside the window you listed; to plan further out, list a longer window first. Give each post its own slot that is at least 2 hours clear of anything already queued and of the other new posts, and make sure no new post repeats text already queued. If a queued post already uses the same template, say so at the gate and keep the new one on a different day.
6. **Approval gate.** Show, in chat, in plain text:
   - the account handle and timezone;
   - each template with its evidence posts and view counts;
   - the exact full text of every part of every post;
   - the check results for each post;
   - the exact date and time for each post, in the creator's timezone;
   - the action: schedule, never publish now.
   Ask for one yes on this exact batch. Nothing is scheduled without it. Any change to text or time needs a new yes for that post. If the host holds the call for approval, say where to approve it in one line and wait. Never route around it.
7. **Schedule after the yes.** For each approved post, call `validate_post` again on the exact parts, then `schedule_post` with the exact parts, the exact time and a stable idempotency key built from the account, the template and the post text (for example `viral-posts:<account>:<template-id>:<first 8 characters of the text's sha256>`). Reuse the same key if you must retry; never make a new key to force a second write. Then call `get_schedule_status` for each returned id and compare the stored text and time with what was approved. Report each one as "scheduled", never "published". If the readback is missing or different, report "schedule unverified" and do not retry blindly.

This workflow never publishes now, never deletes and never edits other queued posts.

## Local fallback

Without a working connection, ask the creator to paste their best posts with view counts (the more the better, so you can see the top 10% line), their 10 most recent posts with view counts, and the facts each new post may use. A paste of only best posts hides a tired template, so if the recent posts are missing, label the template "tired check incomplete". Find the templates, fill them yourself from those facts only, run the same checks (skip `validate_post` and say so; check the 500 characters per part rule by hand) and propose times as "tentative, not checked against your live calendar". Label every draft "written locally, not by Threadify". Never claim Threadify generated, validated or scheduled anything.

## Receipt

Save a receipt in the creator's private workspace that follows `workflow-receipt.v1` (`workflow_id`, `adapter`, `account_handle`, `action`, `approved_text`, `approved_text_sha256`, `status`, `timestamp`, `timezone`, `tool_path`, `fallback_used`). Add the templates with their evidence posts and view counts, the check results per post, the schedule proposal with the live calendar total, the readback state and the idempotency key per post. Before the yes, `status` is `awaiting_approval` and `approved_text` is empty. In the fallback, `fallback_used` is true and `action` is `local_packet`. Keep the creator's posts, numbers and receipts out of any public place.

## Demo feedback rules

Before the first step, read [demo feedback rules](references/demo-feedback-rules.md) and follow them for the whole run. If `~/.threadify/owner-overlay.md` exists, follow it too; it is private, so never quote, publish or upload it.
