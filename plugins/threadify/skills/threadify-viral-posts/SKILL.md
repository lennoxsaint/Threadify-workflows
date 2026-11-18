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
2. **Short hooks.** The hook (first line) is 80 characters or less, unless the template's own proven hook (the first line of its most-viewed evidence post) is longer. Then match its length, never go past it.
3. **The creator's energy, not a robot's.** Write in the voice and energy of the creator's own top posts. If a draft reads flat next to its evidence posts, it fails.
4. **Deliver what the hook promises.** Run a fresh-reader check: where your host can start a fresh agent or session, give it only the post text; otherwise read the post as if you see only it, nothing else. The writer's own yes is not enough when a fresh reader is available. Did it give you what the hook promised? Only a clear yes passes. "Borderline", or a line that only works if you already know the creator, fails.
5. **Show every part of a thread.** At the approval gate, show the full text of every part, in order. Never show only the first post of a thread.

Never invent a number, quote, name or story. Every fact in a draft must come from the creator's Brain, their own posts or what they told you in this chat.

Copy shape only from posts you have read in full: every part of a thread, no cut-off text. Text that ends in "…" is cut off. Shape you have not seen is unverified, never an exact template.

## What the run saves before any schedule

Some calls save things in the creator's Threadify account before the approval gate. Say so before step 2 and ask for a yes to drafting on its own. That yes covers only these saves; it never covers scheduling.

- Opening a viral library post with `get_viral_item` uses one viral allowance. Browsing and opening library posts also stores a private audit record.
- Each `generate_content` call saves one draft and one chat in the account and uses one generation. The batch makes at most 2 versions per template, 6 calls in all. Name that number and the quota left.
- Versions that are not picked stay saved as drafts. List their draft ids at the gate and in the receipt, and leave them for the creator to keep or delete.

## Steps

1. **Connect check.** Call `get_connection_defaults` first. Read the account handle, timezone, scopes and generation quota from it. Use that timezone for every time you show. If there is no working connection, go to the local fallback below. Then ask for the drafting yes (above). Without it, skip `get_viral_item` and stop after step 2 with the template evidence only.
2. **Find what went viral more than once.**
   - Call `greatest_hits` with `metric: "views"` and a `limit` of at least 20, all-time. Call `read_post_performance` with `all_time: true`, `sort_by: "views"` and a `limit` big enough to see the whole account (for example 200) so you know the account's top 10% view line. Use `search_posts` to find more posts that share a hook or shape you spotted.
   - For every evidence post, call `get_post_thread` to read every part in full and note its `media_type`. The analytics tools return only the first part, and their text can be cut off.
   - Call `list_viral_items` and `get_viral_item` to look at viral posts in the shared Viral library that match the creator's topics. A library post counts only when it shows clear engagement (its recorded likes). Being public does not give copy rights: borrow the shape only, never the words. Open one with `get_viral_item` only after the drafting yes.
   - A **template** is a hook skeleton or post shape that reached the creator's top 10% by views at least twice, or a library post with clear engagement. Write the skeleton with placeholders, for example `i [did X] for [time]. here's what [result]:`.
   - For each template show its evidence: each post's first line, date and view count, plus the top 10% line it beat. A shape that hit the top 10% only once is "unproven". Label it that way and never use it in this batch.
   - This workflow writes text posts. If a template's evidence posts are image, carousel or video posts (`media_type` other than `TEXT_POST`), the picture was part of what went viral. Label the template "needs media" and leave it out of this batch.
   - Check each template is not **tired**: call `search_posts` on its hook with `sort_by: "recent"` and a `limit` of at least its `total_matched`, so you see its three most recent uses by date. If fewer posts come back than `total_matched`, raise the limit and call again. If all three fell under the top 10% line, the audience has had enough of it for now. Label it "tired", show those three view counts, and pick another template. If you cannot see every match, label it "tired check incomplete" and say so at the gate.
3. **Write.** Pick up to three templates, each one different, none tired or needing media. For each, call `query_brain` for the real facts that fill its placeholders. Then call `generate_content` with the skeleton written out line for line, the facts, and the rule "keep this skeleton exactly; change only the placeholder words". Use `contentType: "long-form"` for a thread template and `"short-form"` for a single post. Make two versions per template (two calls, for example with a different style preset) and keep the draft id each call returns. Pick the best one per template and say why in one line. Never make more calls than the creator said yes to. If a version comes back off the skeleton, it counts as a failed version, not a draft to fix by hand.
4. **Check every final post.** A post must pass all of these before it can be shown for approval:
   - `validate_post` returns valid for the exact parts, in order.
   - The skeleton matches the template line for line (same line count and shape).
   - The hook is 80 characters or less, or no longer than the template's proven hook.
   - The fresh-reader check is a clear yes: the body gives what the hook promised, with nothing that needs outside context.
   - The post is text only, and its template needs no media.
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
   - the media for each post: none, as this workflow schedules text posts only;
   - the drafts saved so far, by id;
   - the exact date and time for each post, in the creator's timezone;
   - the action: schedule, never publish now.
   Ask for one yes on this exact batch. Nothing is scheduled without it. Any change to text or time needs a new yes for that post. If the host holds the call for approval, say where to approve it in one line and wait. Never route around it.
7. **Schedule after the yes.** For each approved post, in order:
   1. **Recheck.** Call `get_connection_defaults` and confirm the same account and timezone. Call `list_scheduled_posts` again for the window, with the list length equal to `total_in_window`, and recheck the 2-hour clearance, duplicate text and same-template days. A post that now conflicts is **blocked**: say why, propose a new time and wait for a new yes for that post. Never move an approved time yourself.
   2. Call `validate_post` again on the exact parts.
   3. **Save the intent first.** Build a fingerprint: the sha256 of the account, every part's exact text in order, the media (none) and the approved time as an ISO instant with its offset. Save it in the receipt as pending, with the stable idempotency key `viral-posts:<account>:<template-id>:<first 12 characters of the fingerprint>`. A changed time or text makes a new fingerprint and needs a new yes.
   4. Call `schedule_post` with the exact parts, the exact time and that key as `idempotency_key`. Save the returned scheduled post id in the receipt.
   5. If the call errors or times out, the result is unknown. Look for the post with `list_scheduled_posts` before any retry, and retry only with the same key; never make a new key to force a second write. A clear failure on one post does not stop the others; an unknown one stays on hold until you find it or rule it out.
   6. **Read back.** Call `get_schedule_status` for the returned id. Report "scheduled", never "published", only when its status shows the post queued and its account, every part's text and its time match what was approved. Otherwise report "schedule unverified" and do not retry blindly.

Each post ends in one state: proposed, excluded (unproven, tired or needs media), blocked, approved, scheduled or schedule unverified.

This workflow never publishes now, never deletes and never edits other queued posts.

## Local fallback

Without a working connection, ask the creator to paste their best posts with view counts and dates (the more the better, so you can see the top 10% line), the full text of every part of each post you will copy a shape from, their 10 most recent posts with view counts, and the facts each new post may use. A post that ends in "…" or is missing thread parts is cut off: ask for the full text. Until you have it, label that template "shape unverified" and leave it out of the batch. Ask how many posts they have published in all: the top 10% line is the view count of the pasted post ranked at a tenth of that total (rank 370 of 3,700). If the paste stops before that rank, use its lowest view count and call the line estimated. Ask whether each template post had a picture; a template whose posts did is "needs media", and one with no answer yet is "media unknown" at the gate. The tired check uses every dated use of the template in any paste; recent posts with no text cannot show a use. A paste of only best posts hides a tired template, so if the recent posts are missing, label the template "tired check incomplete". Find the templates, fill them yourself from those facts only, run the same checks (skip `validate_post` and say so; check the 500 characters per part rule by hand) and propose times from the posting times the creator gives, marked "tentative, not checked against your live calendar". Label every draft "written locally, not by Threadify". Never claim Threadify generated, validated or scheduled anything.

## Receipt

Save a receipt in the creator's private workspace that follows `workflow-receipt.v1` (`workflow_id`, `adapter`, `account_handle`, `action`, `approved_text`, `approved_text_sha256`, `status`, `timestamp`, `timezone`, `tool_path`, `fallback_used`). `tool_path` is a list of the tool names called, empty in the fallback, and every template has a `template_id`. Add the templates with their evidence posts, view counts and media decision; the drafting yes and the draft ids saved; the check results per post; the schedule proposal with the live calendar total; and per post the state, fingerprint, idempotency key, returned scheduled post id and readback result. Before the yes, `status` is `awaiting_approval` and `approved_text` is empty. In the fallback, `fallback_used` is true and `action` is `local_packet`. Keep the creator's posts, numbers and receipts out of any public place.
