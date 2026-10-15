# First Followers: your next 3 posts (optional)

Offered once, after the engagement loop. Run it only when the owner says yes. Resolve `scripts/` against the skill directory (one level up from this file). A connection never authorizes scheduling; only the owner's "yes" to the exact packet does.

## Rules

- Threadify writes the posts with `generate_content`. Show and schedule its exact text. The only permitted change is lowercasing, keeping proper nouns, and only when the owner asks; prove it with `scripts/casing-guard.mjs` (`lower(original) == lower(final)` PASS). Never reword Threadify's output and never use `edit_draft`. Never publish now.
- No links. Without a Threadify connection or generation access, never write the posts yourself; say what is missing and the manual next step.

## Steps

1. **Write.** Make three `generate_content` calls with `strict_facts: true`: an **intro** (who you are and who you help), a **proof** post (the thing you're proud of, with its real detail) and an **opinion** (one clear take from the niche), in the owner's voice from the Brain or their answers, and `selectedModel` from [generation models](generation-models.json) (Claude Opus 5.5 when the plan allows it, Gemini as fallback; record requested and reported model). Ask for concise copy, a first line that opens a loop and a strong closing line. Keep Threadify's exact text and `draft_id` (save with `save_draft` if no draft id comes back). Show all three posts in full. If the owner wants lowercase, run `casing-guard.mjs lowercase` with the proper nouns to keep, then `check`; show "guard: lower(original) == lower(final) PASS" per post.
2. **One approval packet.** Call `best_time_to_post` (owner's timezone) and `list_scheduled_posts`; a truncated response is not an empty calendar. With no post history, say the times are general, not measured. Pick three slots in the next 24 hours, at least 3 hours apart, the first at least 30 minutes from now, none within 90 minutes of a scheduled post. Call `validate_post` on each post. Send one message:

```text
First Followers · @handle · <timezone>
1) <weekday date, local time> · intro · <unchanged | casing guard PASS>
<exact final post text>
2) ... · proof
3) ... · opinion
Action: schedule these 3 posts exactly as shown. Nothing publishes now.
Reply "yes" to schedule all 3, or "no" to schedule nothing.
```

3. **Schedule.** Schedule only on an explicit "yes". Any change to text, account or time needs a new packet and a new "yes". On "yes", re-check `list_scheduled_posts`, then call `schedule_post` three times with a stable `idempotency_key` per post (account, slot and final text hash). Unchanged text: pass `draft_id` and `content_type`. Lowercased text: pass the exact final `text` without `draft_id`. Omit `platforms` and `auto_repost`. Read back each one with `get_schedule_status`: text and local time must match the packet. If an outcome is unclear, read back before retrying, and retry only that post with the same key. On "no", schedule nothing; the posts stay as Threadify drafts. Add the scheduled count to the scoreboard's `posts_scheduled`.
