---
name: threadify-run-my-threads
description: Set up one daily schedule so your agent prepares up to five Threadify-written Threads posts every morning, shows them in this thread, and schedules them only after you reply "yes". Use when someone asks Threadify to run their Threads, prepare posts every morning for approval, or says "I want to approve posts, not write them".
---

# Run My Threads

"I don't write posts anymore. I approve them."

One setup. Then once a day the agent asks Threadify for up to five posts, shows them in the thread with their times, and schedules them only when the owner replies "yes", from a phone if they like. Most always-on agents run on a pile of schedules, burn tokens and do very little. This one runs once a day and reports what the run used when the host shows it.

Follow [Threadify-001: setup and first-loop video](references/threadify-001.md) before the first connected call. A connection or a schedule never authorizes scheduling posts. Only the owner's reply to the exact card does.

## Rules

- Threadify writes every post with `generate_content`. Never write, rewrite, shorten or edit post copy yourself, and never use `edit_draft`.
- The only permitted change is lowercasing, keeping proper nouns, and only when the owner chose it. Prove it for every post with this skill's `scripts/casing-guard.mjs` (Node 18+, JSON on stdin). On FAIL, use Threadify's original unchanged.
- Never publish now. Never schedule without the owner's "yes" to the exact card. Never move, replace or overwrite an occupied slot. Never create a second daily schedule.
- Posts per day: default 5, owner may choose 1 to 5.

## One-time setup

1. Connect Threadify as Threadify-001 describes. Call `get_connection_defaults`, say only which @handle is in use, and confirm the account and timezone with the owner. Do not read an unset timezone out as fact.
2. Ask once and record: posts per day (1 to 5, default 5); run time (default 05:30 local); casing (as Threadify writes it, or lowercase except proper nouns, plus the names, brands and places to keep); format (short-form unless they choose threads); up to five topic lanes, or "let Threadify choose from my Brain".
3. Create exactly one daily schedule with [the schedule guide](references/daily-schedule.md). Look for an existing Run My Threads schedule first and reuse it. Read back its name, time, timezone, next run and how to pause it.
4. Offer a first run now.

## Daily run

If today's card or receipt is already in this thread, resume it. Do not generate again. Note the run start time.

1. **Account.** Call `get_connection_defaults`. Stop and report if the account differs from setup or the connection fails. Note the remaining generation quota.
2. **Open slots.** Call `list_scheduled_posts` with `days: 2`. A truncated response is not an empty calendar. Take candidate times from `best_time_to_post` (owner's timezone); otherwise use the owner's saved times or 08:00, 11:00, 14:00, 17:00, 20:00. A slot is open when no scheduled post is within 60 minutes of it and it is at least 60 minutes from now. Pick up to the chosen count, earliest first, at least 60 minutes apart, today then tomorrow. Never touch occupied slots. If fewer are open, prepare fewer and say why.
3. **Generate.** One `generate_content` call per post with the saved `contentType` and an `inputText` naming that post's topic lane and asking for a fresh angle, not a repeat of recent posts. Try the `selectedModel` ids in [references/generation-models.json](references/generation-models.json) in order. Move to the next id only on `Model "<id>" is not available on your plan.` or a model or provider failure. Stop on content, input, usage-limit or rate-limit errors and report them. For each post record the requested id and the `model` the response reports; if none is reported, write "requested <id>, model not reported". Never claim a model the response does not confirm. Keep each `draft_id` and Threadify's exact text.
4. **Copy rule.** As written: final equals the original. Lowercase: run `node scripts/casing-guard.mjs lowercase` with a keep list of the proper nouns in that post (names, brands, places, "I"). Then run `check` on every post with original, final and keep, and show PASS. On FAIL, set final to the original and check again. The guard leaves links, @handles and #hashtags untouched.
5. **Validate.** Call `validate_post` on each final text. Drop an invalid post and say why; you may generate one replacement through steps 3 and 4. Do not fix copy yourself.
6. **Approval card.** Send one message:

```text
Run My Threads · @handle · Area/City · 5 posts for approval
1) Tue 6 Oct, 08:00 (00:00 UTC) · model: <reported> (requested claude-opus) · guard PASS, lowercased
<exact final text>
...
Account-wide Auto Plug / Auto Repost: <as returned, unchanged> · per post: none
Reply "yes" to schedule all exactly as shown, "skip 2" to drop post 2, or "no" to schedule nothing.
```

7. **Schedule on "yes".** Approval binds the exact text, slot and account shown. Re-check with `get_connection_defaults` and `list_scheduled_posts`; a slot now taken or less than 15 minutes away is not scheduled, so re-plan that row, validate it and show it for a new "yes". Then call `schedule_post` for each approved row with a stable `idempotency_key` (run date, account, slot, guard `final_sha256`):
   - unchanged text: pass `draft_id` and `content_type`;
   - lowercased text: pass the exact final `text` (or `posts` for a thread) without `draft_id`, because Threadify schedules a draft's stored text when given a `draft_id`.
   Omit `platforms`, `auto_plug` and `auto_repost`. Call `get_schedule_status` for each returned `scheduled_post_id` and confirm the stored text and time match the card, then read back with `list_scheduled_posts`. If an outcome is unclear, read back before retrying, retry only that row with the same key, and never replay the batch.
   On "no", schedule nothing; the posts stay as Threadify drafts. With no reply, nothing is scheduled and the next run starts fresh.
8. **Receipt.** Report posts scheduled with `scheduled_post_id`, local and UTC times, models, guard results, skipped or blocked rows, run start and end, Threadify quota before and after, and the host's token or usage readout when the host exposes it. Otherwise say "usage not exposed by this host". Never estimate. A scheduled post is not a published post.

## When something is missing

Without a Threadify connection, generation entitlement or an available model, do not write posts yourself instead. Report the exact blocker and the manual next step. If the host has no durable scheduler, say so and offer to run the workflow when the owner asks each morning.
