---
name: threadify-whats-working
description: Check every Threads post you published this year against your own median views, show which kinds of posts Threads is killing and the one kind it still pushes 100x, then have Threadify write three posts in that winning pattern with tracked Auto Plugs and schedule them only after one exact approval. Use when someone asks "is Threads dead", "what's actually working on Threads", why their views dropped, or which of their posts get pushed.
---

# What's Working

Threads isn't dead. Most of your posts are. This workflow reads every post you published this year, labels each one against **your own median views** (dead, stuck or alive), answers "is Threads dead for me?" month by month, names what the dead posts share and the one kind of post Threads still pushes hardest, then asks Threadify to write three new posts in that pattern, each with a tracked Auto Plug, and schedules them only after one "yes". It works the same in Claude Code, Codex and ChatGPT.

Follow [Threadify-001: setup and first-loop video](references/threadify-001.md) before the first connected call. A connection never authorizes scheduling. Only the owner's "yes" to the exact approval packet does.

## Rules

- Follow [demo feedback rules](references/demo-feedback-rules.md) for the whole run. If `~/.threadify/owner-overlay.md` exists, read it too and follow it; it is private, so never quote it into posts, files you publish or receipts.
- Every number comes from the tools or the script. Missing data stays unknown: say "unknown", never 0. Describe what happened, never what will happen: no post or pattern "will" go viral.
- Say "this year" only when the read starts on 1 January. Otherwise say the real window: "read N posts, <first date> to <last date>".
- Threadify writes every post and every plug with `generate_content`. Preserve generated wording by default; the agent edits only when the owner explicitly asks. Record the request and original copy. Never use `edit_draft`.
- Without an editing request, the only permitted change is lowercasing, keeping proper nouns, and only when the owner asks for it. Prove it for every post and plug with `scripts/casing-guard.mjs` (Node 18+, JSON on stdin): `lower(original) == lower(final)` must be true and the result PASS. If the guard fails, show the original unchanged.
- Never publish now. Never schedule without the owner's "yes" to the exact packet. Never move or overwrite a post already on the calendar.
- Never print credentials, tokens, account ids, other people's handles from replies, or customer details. Show the owner's own posts and numbers; they are the point.

## Steps

1. **Connect.** Call `get_connection_defaults`. Confirm the account by saying only the @handle and timezone, for example "@handle · Australia/Perth". Note `link_tracking` and the plan for Auto Plug. Say in one line what the owner gets: "I'll check every post you published this year against your own median, show you what Threads is killing and the one kind it still pushes, then Threadify writes 3 of those for you."
2. **Read the year.** Call `search_posts` with `query: "*"`, `from` / `to` set to one calendar month at a time from 1 January to today, `sort_by: "recent"` and a `limit` above that month's `total_matched`; if a month returns fewer rows than `total_matched`, split it into halves and read again. Keep every page. (`read_post_performance` with a long window can fail with `artifact-write-failed`; use it only for a window it returns in full.) If the account's history doesn't reach 1 January, keep what it returns and say the real window. Save the raw pages locally (never in a public repo).
3. **Diagnose.** Pipe `{"performance": <every search_posts page>, "from": "<YYYY>-01-01", "handle": "@handle"}` into `node scripts/whats-working.mjs --html whats-working.html`. Say the coverage line first ("Read N posts, date to date. Counted M; K too new to judge; U with unknown views."), then the median, the best post and its multiple, and `never_broke_out_percent`. Labels are relative to the median: **dead** under 1x, **stuck** 1x to under 3x, **alive** 3x or more; posts under 3 days old are left out because they are still collecting views. Then answer "is Threads dead for you?" from `monthly`: compare the first and last full months' median views and alive share, in numbers, with no verdict the numbers don't show.
4. **Name the patterns.** Read the posts (top 30 by views, the 30 lowest, and every alive post) and give each counted post one short pattern label that joins its hook and format, for example "news reaction", "i got AI to do a huge task", "hot take", "how-to list", "personal story", "question", "promo". Use the owner's own words for topics. Use 6-10 labels in total so groups are big enough. Re-run the script with `"tags": {"<post_id>": {"pattern": "<label>"}}`. Patterns with fewer than 5 posts are marked `small_sample` and are not ranked; say so if one looks big.
5. **Show what's working.** Open the local report page and keep it on screen. In chat, keep it short and phone-readable (no wide tables):
   - **What Threads killed:** up to 3 `most_dead` patterns, each with its median multiple and one real post (first line + views).
   - **What it still pushes:** `most_alive`, ending on **#1** (`number_one`): its median multiple, alive share and its 3 real example posts.
   - One line: what the #1 posts share that the dead ones don't (first line, subject, format), tied to the examples. Describe, don't predict.
6. **Threadify writes 3 in the #1 pattern.** Make one `generate_content` call per post with `strict_facts: true`, `inputText` describing the #1 pattern as a shape (never a past post's copy to paste) plus a fresh subject from the owner's own recent topics, and `selectedModel` from [generation models](references/generation-models.json) (Claude Opus 5.5 when the plan allows it, Gemini as fallback; record the requested and reported model). Ask for concise copy, a first line that opens a loop, short paragraphs and a strong closing point in the owner's voice. No offer and no link in the post itself. Keep Threadify's exact text and `draft_id`. If the owner wants lowercase, run `casing-guard.mjs lowercase` with the proper nouns to keep, then `check` on every post; show "guard: lower(original) == lower(final) PASS" per post.
7. **One Auto Plug each.** Call `list_offers` and let the owner pick one offer if more than one fits. For each post, make one more `generate_content` call with that `offer_id`, asking for a one-post plug reply that continues that exact post. Run the guard on each plug the same way. Promote the selected offer, and claim only what its destination provides. The plug's link is the offer's saved destination; Threadify links on Threads are auto-tracked, so add no UTM tags. If `link_tracking` is off or unknown, say clicks may not be measured. If the plan has no Auto Plug, say so and ask whether to schedule without plugs or stop.
8. **Review and pick 3 slots.** Follow [review and editing](references/review.md) and run `node scripts/review-packet.mjs < review.json` as described there. Call `best_time_to_post` (owner's timezone) and `list_scheduled_posts`; a truncated response is not an empty calendar. Pick one slot on each of the next three days at the best measured time with no scheduled post within 90 minutes and at least 60 minutes from now. Call `validate_post` on every post and plug; if one fails, say why and ask Threadify once for a replacement through steps 6-7.
9. **One approval packet.** Send one message:

```text
What's Working · @handle · <timezone>
#1 pattern: <label> · <median multiple>x your median
1) <weekday date, local time> · <unchanged | casing guard PASS | owner-requested edit>
<exact final post text>
Auto Plug (15 min after): <exact plug text>
Destination: <exact offer destination>
2) ...
3) ...
Action: schedule these 3 posts with their Auto Plugs exactly as shown. Nothing publishes now.
Reply "yes" to schedule all 3, or "no" to schedule nothing.
```

   Schedule only on an explicit "yes". Any change to text, plug, destination, account or time needs a new packet and a new "yes". On "yes", re-check `list_scheduled_posts`, then call `schedule_post` three times with a stable `idempotency_key` per post (account, slot, final post and plug hashes) and `auto_plug: {content: <exact plug text>, trigger: "time", delay_minutes: 15}`. Unchanged text: pass `draft_id` and `content_type`. Lowercased or owner-edited text: pass the exact final `text` without `draft_id`, because Threadify schedules a draft's stored text when given a `draft_id`. Omit `platforms` and `auto_repost`. Read back each one with `get_schedule_status`: text, local time and the `auto_plug` echo must match the packet; a failed or cancelled record is a mismatch. If an outcome is unclear, read back before retrying, and retry only that post with the same key. On "no", schedule nothing; originals stay as Threadify drafts.
10. **7-day check.** Offer to re-run What's Working 7 days after the last of the 3 posts goes out, to see where they landed against the median. If the host supports a reminder or scheduled run, offer to create one and create it only after the owner agrees. Otherwise give a dated note: "Run What's Working on <date> to see where these 3 landed."

## When something is missing

Without a Threadify connection or generation access, stop and say exactly what is missing and the manual next step. Never write posts yourself instead. A scheduled post is not a published post.
