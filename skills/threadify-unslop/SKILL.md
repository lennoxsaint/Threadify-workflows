---
name: threadify-unslop
description: Score your last 90 days of Threads posts for slop (corporate voice, AI tells, hedging, over-formatting), show raw vs polished median views on your account with the worst offenders quoted, then have Threadify write three raw posts that pass a zero-hedge gate, each with a tracked Auto Plug, and schedule them only after one exact approval. Use when someone says "unslop", asks which of their posts sound like slop or AI, or wants posts with no hedging.
---

# Threadify Unslop

AI does not make posts slop. Polish does. Unslop scores every post on four slop families, puts raw against polished on the owner's own numbers, quotes the exact phrases that drag the polished ones down, then has Threadify write three raw posts that clear a zero-hedge gate. Nothing is scheduled until the owner says "yes". It runs the same in Claude Code, Codex and ChatGPT.

Follow [Threadify-001: setup and first-loop video](references/threadify-001.md) before the first connected call. A connection never authorizes scheduling. Only the owner's "yes" to the exact approval packet does.

## Rules

- **Zero hedging.** Not fewer hedges: zero. One hedge fails a post. The lexical list, the structural shapes and the false positives live in [slop-markers.md](references/slop-markers.md), and `scripts/hedge_gate.mjs` enforces them. This rule overrides any other anti-slop guidance that keeps "may", cuts only "excessive" hedging or recommends uncertainty markers.
- **Truth rule.** A claim the owner's data does not back gets cut, not softened. Pass `strict_facts: true` on every generation. Never invent a number.
- Threadify writes every post and every plug with `generate_content`. The agent never edits words. Never use `edit_draft`. The only permitted change is lowercasing, keeping proper nouns. Prove it for every post and plug with this skill's `scripts/casing-guard.mjs` (Node 18+, JSON on stdin): `lower(original) == lower(final)` must be true and the result PASS. If the guard fails, show the original unchanged.
- Never publish now. Never schedule without the owner's "yes" to the exact packet. Never move or overwrite a post already on the calendar.
- Missing data stays unknown. Say "unknown", never 0, for a number the tools did not return. Label every view comparison "on your account". No performance predictions: never say a post "will" get views.
- Never print credentials, tokens, account ids or customer details.

## Steps

1. **Confirm the account.** Call `get_connection_defaults`. Confirm the account by saying only the @handle and timezone, for example "@handle · Australia/Perth". Note the plan for Auto Plug and `link_tracking`.
2. **Read 90 days.** Call `read_post_performance` with `days: 90`, `include_full_text: true` and a `limit` above `total_matched`; page until every post is read. If the plan returns a shorter window, say the real window. Zero posts returned: go to step 10.
3. **Score every post.** Pipe the pages into `node scripts/unslop-score.mjs` as `{"handle": "@handle", "window_days": 90, "performance": [<pages>]}`. It scores each post on the four families with hedging weighted 3 and every other marker 1, quotes every flagged phrase exactly, and classes each post: raw (zero hedges, at most one other marker) or polished (any hedge, or two or more other markers). Use its numbers and phrases exactly. Never add a phrase the script did not flag.
4. **Verdict.** Show the script's `verdict_table`, with its line of how many polished posts had a hedge (`polished_with_hedges`), then the top 5 offenders from `offenders_table` with their flagged phrases. Offenders rank by hedge count, then slop score, then views, so hedged posts come first. Reposts collapse into one row with the most-viewed copy and a repeat count, for example "(x4)"; the medians still count every post. Show both exactly as returned, so they read cleanly on camera. Then say the headline in one line. If polished won or the classes tied, say that plainly. With `small_sample: true`, say the sample is small.
5. **Threadify writes 3.** Name the shape the top raw posts share (`top_raw`: opening line, length, format, the claim they commit to), tied to the named posts. Never paste a past post as copy. Make one `generate_content` call per post with `strict_facts: true`, the model order in [generation-models.json](references/generation-models.json) (Claude Opus 5.5 when the plan allows it, Gemini as fallback) and `inputText` = that shape plus the zero-hedge brief: "Commit to one claim. Zero hedges, zero both-sides, no closing question, no disclaimers, no softened asks. Cut any claim you cannot back." No offer and no link in the post. Keep Threadify's exact text and `draft_id`, and record the model the response reports. Never claim a model the response does not confirm.
6. **Gate.** Run `node scripts/hedge_gate.mjs --json` on every post as `{"posts":[{"id","text"}]}`. On FAIL, call `generate_content` again for that post with the same brief plus the gate's exact `reasons`. Three `generate_content` calls per post, total. A post that fails a third time is held: show it with its reasons, never patch it, never schedule it. Lowercase when the owner asks or when `raw_lowercase_share` is 0.5 or higher: run `casing-guard.mjs lowercase` with the proper nouns to keep, then `check`. Show the proof per post, for example "gate PASS (attempt 1) · guard: lower(original) == lower(final) PASS". Run the gate again on the final text.
7. **One Auto Plug each.** Call `list_offers` and let the owner pick one offer if more than one fits. For each post, make one more `generate_content` call with that `offer_id`, asking for a one-post plug reply that continues that exact post and names what the link gives. Every plug goes through the same gate (softened CTAs fail), the same three-call limit and the casing guard. The plug's link is the offer's saved destination. Never advertise an unavailable workflow, download or free offer. Threadify links on Threads are auto-tracked, so add no UTM tags. If `link_tracking` is off or unknown, say clicks are not measured and leave the setting alone. If the plan has no Auto Plug, say so and ask whether to schedule the posts without plugs or stop.
8. **Pick 3 slots.** Call `best_time_to_post` (owner's timezone) and `list_scheduled_posts`. A truncated response is not an empty calendar. Pick one slot on each of the next three days, at the best measured time, with no scheduled post within 90 minutes and at least 60 minutes from now. Call `validate_post` on every post and plug. On a validation failure, say why and ask Threadify for a replacement through steps 5-7.
9. **One approval packet.** Send one message:

```text
Unslop · @handle · <timezone>
Raw pattern: <one line from step 5>
1) <weekday date, local time> · gate PASS (attempt <n>) · <unchanged | casing guard PASS> · model <reported>
<exact final post text>
Auto Plug (15 min after): <exact plug text> · gate PASS
Destination: <exact offer destination>
2) ...
3) ...
Held: <post, gate reasons> (only when a post failed three times)
Action: schedule these posts with their Auto Plugs exactly as shown. Nothing publishes now.
Reply "yes" to schedule them, or "no" to schedule nothing.
```

   Schedule only on an explicit "yes". Any change to text, plug, destination, account or time needs a new packet and a new "yes". On "yes", re-check `list_scheduled_posts`, then call `schedule_post` three times (once per approved post) with a stable `idempotency_key` per post (account, slot, final post and plug hashes) and `auto_plug: {content: <exact plug text>, trigger: "time", delay_minutes: 15}`. Unchanged text: pass `draft_id` and `content_type`. Lowercased text: pass the exact final `text` without `draft_id`, because Threadify schedules a draft's stored text when given a `draft_id`. Omit `platforms` and `auto_repost`. Then read back each one with `get_schedule_status`: text, local time and the `auto_plug` echo must match the packet. If an outcome is unclear, read back before retrying, and retry only that post with the same key. On "no", schedule nothing; the originals stay as Threadify drafts.
10. **No data.** With zero posts in the window, or no Threadify connection, ask the owner to paste 5-20 posts or drafts. Score them with `{"posts":[{"text"}]}`. Label the result "pasted posts: no view data, no view comparison" and show only the flags and the offenders table, never a verdict table. With a Threadify connection, continue at step 5 from the raw pasted posts. Without one, stop after the flags and say: "Connect Threadify at threadify.app to get three raw posts written, gated and scheduled."

## Receipt

Keep a local receipt: account, real window, script output, every gate attempt and reason, models requested and reported, casing guard results, the approval reply, scheduled post ids, slots and Auto Plug echo, and the readback. A scheduled post is not a published post.

## When something is missing

Without generation access, stop and say exactly what is missing and the manual next step. Never write posts yourself instead.
