---
name: threadify-money-posts
description: Rank your Threads posts by clicks per 1,000 views instead of views, explain why the winners get clicks, then have Threadify write three posts in the winning pattern with tracked Auto Plugs and schedule them only after one exact approval. Use when someone says "money posts", asks which of their posts actually get clicks, or wants to stop chasing views.
---

# Money Posts

Views are not money. Clicks are closer. This workflow ranks the owner's posts by **clicks per 1,000 views**, shows why the top ones get clicks, then asks Threadify to write three new posts in that pattern, each with a tracked Auto Plug, and schedules them only after one "yes". It works the same in Claude Code, Codex and ChatGPT.

Follow [Threadify-001: setup and first-loop video](references/threadify-001.md) before the first connected call. A connection never authorizes scheduling. Only the owner's "yes" to the exact approval packet does.

## Rules

- Threadify writes every post and every plug with `generate_content`. The agent never writes or edits post copy. Never use `edit_draft`.
- The only permitted change is lowercasing, keeping proper nouns, and only when the owner asks for it. Prove it for every post and plug with this skill's `scripts/casing-guard.mjs` (Node 18+, JSON on stdin): `lower(original) == lower(final)` must be true and the result PASS. If the guard fails, show the original unchanged.
- Never publish now. Never schedule without the owner's "yes" to the exact packet. Never move or overwrite a post already on the calendar.
- Missing data stays unknown. Say "unknown", never 0, for a number the tools did not return. No performance predictions: never say a post or pattern "will" get clicks.
- Say "conversions", exactly as the tool labels them. Never say "sales" unless that row's revenue is above 0. Say "attributed", not "caused".
- Never print credentials, tokens, account ids or customer details.

## Steps

1. **Connect.** Call `get_connection_defaults`. Confirm the account by saying only the @handle and timezone, for example "@handle · Australia/Perth". Note `link_tracking` and the plan for Auto Plug.
2. **Read 90 days.** Call `read_link_attribution` with `days: 90` and a `limit` high enough for every link (raise it if the rows hit the limit). Call `read_post_performance` with `days: 90`, `include_full_text: true` and a `limit` above `total_matched`. For any linked post missing from that page, call `read_post_performance` with its `post_id`; if it is still missing, look it up with `search_posts` using the link's `root_post_text`. Threadify can file an Auto Plug's clicks under the plug reply instead of its post: for every linked id that is still missing (usually `source_kind: auto_plug`), call `get_post_thread` with that id and keep the results. If the plan returns a shorter window than 90 days, say the real window.
3. **Rank.** Pipe the results into `node scripts/rank-money-posts.mjs` as `{"attribution": ..., "performance": ..., "threads": {"<missing id>": <get_post_thread result>}}`. It moves each plug reply's clicks onto the post its thread opens with (`plug_rows_moved_to_post`). If `big_posts_no_link_caveat` is set, say it next to the "big posts with no link" list. It joins each link row to its post by `root_threads_post_id` (fallback `final_threads_post_id`), sums clicks per post, and computes clicks per 1,000 views = unique clicks / views × 1000. Show one table, best first:

   | # | Post (first line) | Date | Views | Clicks | Clicks per 1,000 views | Conversions |

   Then a short list, "Big posts with no link": the top posts by views that carried no tracked link. Use the script's numbers exactly. A row marked `few_clicks` has fewer than 5 clicks, so say it is a small sample.
4. **Explain.** Name 2-4 patterns that the top click posts share, and tie each one to the named posts and the evidence (the first line, the ask, where the link sat, the format). Read a winner's full thread with `get_post_thread` when needed. Contrast with a big post with no link or few clicks. Describe what happened, never what will happen.
5. **Cold start.** If the script says `mode: "proxy"` (fewer than 5 linked posts, or fewer than 30 clicks in 90 days), say so plainly. Then rank on proxy signals instead: replies per 1,000 views, and replies asking how, for the link, or where to get it. Count those asks only from replies you can actually read and pass them as `asks`; otherwise show "unknown". Label every proxy number "proxy, not clicks". Steps 6-10 still run; the 7-day check is what turns the proxy into real clicks.
6. **Threadify writes 3.** Make one `generate_content` call per post, matching the winning post's format, with `strict_facts: true` and `inputText` describing the winning pattern as a shape (the patterns from step 4, never a past post's copy to paste). No offer and no link in the post itself. Keep Threadify's exact text and `draft_id`, and record the `model` the response reports. If the owner wants lowercase, run `casing-guard.mjs lowercase` with the proper nouns to keep, then `check` on every post with original and final. Show the proof per post, for example "guard: lower(original) == lower(final) PASS". If the guard fails, show the original unchanged.
7. **One Auto Plug each.** Call `list_offers` and let the owner pick one offer if more than one fits. For each post, make one more `generate_content` call with that `offer_id`, asking for a one-post plug reply that continues that exact post. Run the guard on each plug the same way. The plug's link is the offer's saved destination. Threadify links on Threads are auto-tracked, so add no UTM tags. If `link_tracking` is off or unknown, say clicks may not be measured and leave the setting alone. If the plan has no Auto Plug, say so and ask whether to schedule the posts without plugs or stop.
8. **Pick 3 slots.** Call `best_time_to_post` (owner's timezone) and `list_scheduled_posts`. A truncated response is not an empty calendar. Pick one slot on each of the next three days, at the best measured time with no scheduled post within 90 minutes and at least 60 minutes from now. Call `validate_post` on every post and plug; if one fails, say why and ask Threadify once for a replacement through steps 6-7.
9. **One approval packet.** Send one message:

```text
Money Posts · @handle · <timezone>
Pattern: <one line from step 4>
1) <weekday date, local time> · guard PASS
<exact final post text>
Auto Plug (15 min after): <exact plug text>
Destination: <exact offer destination>
2) ...
3) ...
Action: schedule these 3 posts with their Auto Plugs exactly as shown. Nothing publishes now.
Reply "yes" to schedule all 3, or "no" to schedule nothing.
```

   Schedule only on an explicit "yes". Any change to text, plug, destination, account or time needs a new packet and a new "yes". On "yes", re-check `list_scheduled_posts`, then call `schedule_post` three times with a stable `idempotency_key` per post (account, slot, guard `final_sha256`) and `auto_plug: {content: <exact plug text>, trigger: "time", delay_minutes: 15}`. Unchanged text: pass `draft_id` and `content_type`. Lowercased text: pass the exact final `text` without `draft_id`, because Threadify schedules a draft's stored text when given a `draft_id`. Omit `platforms` and `auto_repost`. Then read back each one with `get_schedule_status`: text, local time and the `auto_plug` echo must match the packet. If an outcome is unclear, read back before retrying, and retry only that post with the same key. On "no", schedule nothing; the posts stay as Threadify drafts (use `save_draft` only to keep a guard-passed lowercased final the owner wants to keep).
10. **7-day check.** Offer to re-run Money Posts 7 days after the last of the 3 posts goes out, to rank them by real clicks next to the old winners. If the host supports a reminder or scheduled run (for example `/schedule` in Claude Code), offer to create one, and create it only after the owner agrees. Otherwise give a dated note: "Run Money Posts on <date> to rank these 3 by real clicks."

## When something is missing

Without a Threadify connection or generation access, stop and say exactly what is missing and the manual next step. Never write posts yourself instead. A scheduled post is not a published post, and a click is not a sale.
