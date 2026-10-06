---
name: threadify-run-my-threads
description: Set up one daily schedule so your agent prepares five Threadify-written Threads posts every morning from a weekly plan (one long-form thread on six days, one greatest-hit repost a day, hook-first structures and a chosen CTA level), shows them in this thread, and schedules them only after you reply "yes". Use when someone asks Threadify to run their Threads, prepare posts every morning for approval, or says "I want to approve posts, not write them".
---

# Run My Threads

"I don't write posts anymore. I approve them."

One setup builds a week plan. Then once a day the agent prepares that day's five posts, shows them in the thread with their times, and schedules them only when the owner replies "yes", from a phone if they like. Most always-on agents run on a pile of schedules, burn tokens and do very little. This one runs once a day and reports what the run used when the host shows it.

Follow [Threadify-001: setup and first-loop video](references/threadify-001.md) before the first connected call. A connection or a schedule never authorizes scheduling posts. Only the owner's reply to the exact card does.

## Rules

- Threadify writes every new post, rewrite and plug with `generate_content`. Never write, rewrite, shorten or edit post copy yourself, and never use `edit_draft`.
- `save_draft` is allowed only for an exact greatest-hit repost: the owner's own past post saved word for word, byte-identical to the original. Never use it for anything else.
- The only permitted change to generated copy is lowercasing, keeping proper nouns, and only when the owner chose it. Prove it for every post with this skill's `scripts/casing-guard.mjs` (Node 18+, JSON on stdin). On FAIL, use Threadify's original unchanged. Never lowercase a greatest hit.
- Never invent facts. Pass `strict_facts: true`; a number in a hook only if it really happened.
- Never publish now. Never schedule without the owner's "yes" to the exact card. Never move, replace or overwrite an occupied slot. Never create a second daily schedule.
- The craft rules live in [references/threads-playbook.md](references/threads-playbook.md) and [references/hook-bank.md](references/hook-bank.md). Name them in `inputText`; check with the scripts; never fix copy by hand.

## The week

Five posts a day, 35 a week. On six days: one long-form thread and four short-form posts. On the short day (default Sunday): five short-form posts. Each day one short-form slot is a greatest-hit repost. So a week is 6 threads and 29 short-form posts.

- Long-form rotates `teacher` → `storyteller` → `synthesizer`. Short-form rotates `one-liner`, `listicle` and `random`; `listicle-plug` is used only on CTA slots. Each generated slot also gets a proven structure and a hook archetype.
- CTA level, chosen at setup (a plug is a CTA): **Growth** 0 a week; **Balanced** (default) 2 a day, 14 a week (one or two a day tops out at 14, not 15); **Conversion** 25 a week, 3 or 4 a day. A CTA is either a thread with an Auto Plug reply (`plug`) or a short-form `listicle-plug` whose CTA lives in post 2 (`listicle_plug`). Never a CTA or link in post 1.
- Build and check the plan with `node scripts/week-plan.mjs build` (JSON stdin: `start_date`, `mode`, `short_day`, `seed`, `auto_plug`). Exit 0 means every invariant passed. The plan is deterministic, so the same input always rebuilds the same week.

## One-time setup

1. Connect Threadify as Threadify-001 describes. Call `get_connection_defaults`, say only which @handle is in use, and confirm the account and timezone with the owner. Do not read an unset timezone out as fact.
2. Ask once and record: run time (default 05:30 local); casing (as Threadify writes it, or lowercase except proper nouns, plus the names, brands and places to keep); up to five topic lanes, or "let Threadify choose from my Brain"; the short day (default Sunday); CTA level. For Balanced or Conversion, call `list_offers` and let the owner pick one offer. With no offer, use Growth or ask them to create one in Threadify first. Optionally, a page of viral post templates they already keep in a connected tool.
3. Save the choices and the planner input (`start_date` = first run day, `seed` = week number starting at 1, `auto_plug: true`) in the private state folder `~/.threadify-workflows/state/run-my-threads/` (below `THREADIFY_WORKFLOWS_HOME` when set; owner-only permissions), and in the schedule prompt so a fresh cloud run can rebuild the week.
4. Create exactly one daily schedule with [the schedule guide](references/daily-schedule.md). Look for an existing Run My Threads schedule first and reuse it. Read back its name, time, timezone, next run and how to pause it.
5. Build the week plan, show it as one compact table (day, then five cells such as `thread·teacher·step-by-step·plug` or `hit`), then run Day 1 now.

After day 7, increase `seed` by one and move `start_date` on seven days. When Auto Plug is unavailable, save `auto_plug: false`; future thread plugs become `listicle-plug` posts (Conversion then tops out at 22 a week, and the planner says so).

## Daily run

If today's card or receipt is already in this thread, resume it. Do not generate again. Note the run start time and rebuild today's row of the plan.

1. **Account.** Call `get_connection_defaults`. Stop and report if the account differs from setup or the connection fails. Note the remaining generation quota, `link_tracking` (`enabled`, `known`) and account-wide Auto Plug and Auto Repost.
2. **Open slots.** Call `list_scheduled_posts` with `days: 2`. A truncated response is not an empty calendar. Take candidate times from `best_time_to_post` (owner's timezone); otherwise use the owner's saved times or 08:00, 10:00, 12:30, 15:30, 19:00. A slot is open when no scheduled post is within 90 minutes of it and it is at least 60 minutes from now. Pick five, earliest first, at least 90 minutes apart, today then tomorrow, and fill them in plan order. Never touch occupied slots. If fewer are open, keep the thread, then the greatest hit, then CTA posts, and say what was dropped.
3. **Greatest hit.** Call `greatest_hits` (`metric: engagement_rate`, `media_type: TEXT_POST`, `limit: 20`; try `views` or `likes` if too few). Take the first that passes: `get_post_thread` shows a single post; it was not published or reposted in the last 60 days (check `search_posts` with its opening words, `list_scheduled_posts` and the state folder's repost log); it has no link while link tracking is on or unknown; and the stale-fact check passes (old ages, dates, "today", "this year", prices, counts, availability, events). If a fact is stale, pick another; never rewrite. Save it with `save_draft` and confirm the stored text equals the original byte for byte (`casing-guard.mjs check` with original and final must show PASS and `unchanged: true`).
4. **Hooks.** For each generated slot choose a proven hook pattern in this order: the owner's own greatest hits and `list_vault_suggestions` (rising or viral own posts); Threadify Vault outliers via `list_vault_items` (`sort_by: most_liked`, `min_likes`); the owner's connected viral templates, if any; then [the hook bank](references/hook-bank.md) for the slot's archetype. Pass the pattern as a shape, never as copy to paste.
5. **Generate.** One `generate_content` call per slot with `contentType`, `shortFormType` or `longFormType` from the plan, `strict_facts: true`, and `inputText` built from the playbook skeleton: topic lane and a fresh angle, the slot's structure and hook archetype, the chosen hook pattern, "the first 3-5 words carry the hook; first sentence 4-8 words", and the CTA instruction. `listicle_plug` slots pass the chosen `offer_id`. Every other slot: no offer, no link. For a `plug` slot, make a second short-form call with `offer_id` asking for a one-post plug reply that continues that thread and passes the RSS test. Try the `selectedModel` ids in [references/generation-models.json](references/generation-models.json) in order. Move to the next id only on `Model "<id>" is not available on your plan.` or a model or provider failure. Stop on content, input, usage-limit or rate-limit errors and report them. For each post record the requested id and the `model` the response reports; if none is reported, write "requested <id>, model not reported". Never claim a model the response does not confirm. Keep each `draft_id` and Threadify's exact text.
6. **Hook check.** Run `node scripts/hook-check.mjs` on every generated post. On FAIL, ask Threadify once for a replacement through a new `generate_content` call with the failure reasons in `inputText`. If it still fails, show it marked FAIL and suggest "skip N". Never hand-edit.
7. **Copy rule.** As written: final equals the original. Lowercase: run `node scripts/casing-guard.mjs lowercase` with a keep list of the proper nouns in that post (names, brands, places, "I"). Then run `check` on every generated post and plug with original, final and keep, and show PASS. On FAIL, set final to the original and check again. The guard leaves links, @handles and #hashtags untouched.
8. **Validate.** Call `validate_post` on each final text and plug. Drop an invalid post and say why; you may generate one replacement through steps 5 to 7.
9. **Approval card.** Send one message:

```text
Run My Threads · @handle · Area/City · Tue 6 Oct · 5 posts for approval · CTA level: balanced
1) 08:00 (00:00 UTC) · short-form one-liner · setup-twist-mic-drop · hook contrarian PASS · model: <reported> (requested claude-opus) · guard PASS, lowercased · CTA: none
<exact final text>
2) 10:00 (02:00 UTC) · thread teacher · step-by-step · hook PASS · CTA: plug (Auto Plug reply 15 min after)
<every post of the thread in full>
Plug: <exact plug text>
4) 15:30 (07:30 UTC) · greatest hit, verbatim · first posted <date> · <metric> · stale-fact check PASS
...
Account-wide Auto Plug / Auto Repost: <as returned, unchanged>
Link tracking: <on / off / unknown> · posts with links held: <none or numbers>
Reply "yes" to schedule all exactly as shown, "skip 2" to drop post 2, or "no" to schedule nothing.
```

10. **Schedule on "yes".** Approval binds the exact text, slot and account shown. Re-check with `get_connection_defaults` and `list_scheduled_posts`; a slot now taken or less than 15 minutes away is not scheduled, so re-plan that row, validate it and show it for a new "yes". Then call `schedule_post` for each approved row with a stable `idempotency_key` (run date, account, slot, guard `final_sha256`):
    - unchanged text and greatest hits: pass `draft_id` and `content_type` (plus `short_form_type` for a listicle-plug);
    - lowercased text: pass the exact final `text` (or `posts` for a thread) without `draft_id`, because Threadify schedules a draft's stored text when given a `draft_id`;
    - a `plug` row also passes `auto_plug: {content: <exact plug text>, trigger: "time", delay_minutes: 15}`. Omit `platforms` and `auto_repost`.
    Links: Threadify link tracking can replace URLs when a post is scheduled. The offer link may appear only in the CTA post (post 2 of a `listicle-plug`, or the plug reply), where a tracked link is expected. If any other post or thread part contains a link and `link_tracking.enabled` is true or `known` is false, do not schedule that post; mark it held on the card, say that account-wide link tracking would rewrite the link, and leave the setting alone. Never claim a transformed link matches.
    Readback: call `get_schedule_status` for each returned `scheduled_post_id` and confirm the stored text and time match the card (only the CTA post's offer link may differ), then read back with `list_scheduled_posts`. For a `plug` row, read the receipt's `auto_plug` echo. If it is missing, Auto Plug is not on this plan: say so, save `auto_plug: false`, and rebuild future days. If a stored text or time does not match the card, stop, show the difference and offer `cancel_schedule` for that post; cancel only after the owner's reply. If an outcome is unclear, read back before retrying, retry only that row with the same key, and never replay the batch.
    On "no", schedule nothing; the posts stay as Threadify drafts. With no reply, nothing is scheduled and the next run starts fresh.
11. **Receipt.** Report posts scheduled with `scheduled_post_id`, local and UTC times, types, models, hook and guard results, the greatest hit used, CTA count today and this week, Auto Plug echo, skipped or held rows, run start and end, Threadify quota before and after, and the host's token or usage readout when the host exposes it. Otherwise say "usage not exposed by this host". Never estimate. Log the greatest hit's id and date in the state folder. A scheduled post is not a published post.

## When something is missing

Without a Threadify connection, generation entitlement or an available model, do not write posts yourself instead. Report the exact blocker and the manual next step. With no eligible greatest hit (or no `greatest_hits` on the plan), generate a short-form post for that slot and say why. If the host has no durable scheduler, say so and offer to run the workflow when the owner asks each morning.
