# Director Mode: post it with Threadify (optional)

Offered once, after the final video passes `verify`. Run it only when the owner says yes. Resolve `scripts/` against the skill directory (one level up from this file). A connection never authorizes uploading or scheduling; only the owner's exact "yes" to the post card does.

## Rules

- Threadify writes the post with `generate_content`. Show and schedule its exact text. The only permitted change is lowercasing, keeping proper nouns, and only when the owner asks; prove it with `scripts/casing-guard.mjs` (`lower(original) == lower(final)` PASS). Never reword Threadify's output and never use `edit_draft`. Never call `publish_now`.
- Without a Threadify connection or generation access, never write the post yourself; say what is missing and the manual next step (post `director/final.mp4` by hand).
- If any sound in `director/credits.json` has `needs_credit: true`, its `credit_line` must appear in the post or its first reply; show it on the card.

## Steps

1. **Account.** Call `get_connection_defaults` first and say only the @handle and timezone, for example "@handle · Australia/Perth".
2. **Write.** One `generate_content` call (`content_type: "short-form"`, `strict_facts: true`) about what the video says, built from the final transcript, in the owner's voice from the Brain, with `selectedModel` from [generation models](generation-models.json) (record requested and reported model). Ask for a first line that opens a loop and a strong closing line, no links. Keep Threadify's exact text and `draft_id` (save with `save_draft` if no draft id comes back). If the owner wants lowercase, run `node scripts/casing-guard.mjs lowercase` with the proper nouns to keep, then `check`, and show "guard: lower(original) == lower(final) PASS".
3. **Upload the video.** `director/final.mp4` only, never the raw file. Over 100 MB or as raw bytes: `create_media_upload` (`content_type: "video/mp4"`, a stable `idempotency_key`), then HTTP PUT the file bytes to its one-time `upload_url` and keep the `public_url`. A public https copy under 100 MB can go through `upload_media` with `url`. Uploading stores the file in Threadify media; nothing is posted.
4. **One post card.** Call `best_time_to_post` (owner's timezone) and `list_scheduled_posts`; a truncated response is not an empty calendar. Pick the best slot at least 30 minutes from now and not within 90 minutes of another scheduled post; with no history, say the time is general, not measured. Call `validate_post`. Send one message:

```text
Director Mode · @handle · <timezone>
<weekday date, local time> · video <seconds>s · <unchanged | casing guard PASS>
<exact final post text>
<credit line, if any>
Action: schedule this post with the video exactly as shown. Nothing publishes now.
Reply "yes" to schedule it, or "no" to schedule nothing.
```

5. **Schedule.** Only on an exact "yes". Any change to text, video, account or time needs a new card and a new "yes". Re-check `list_scheduled_posts`, then call `schedule_post` once with `video: <public_url>`, `scheduled_at`, and a stable `idempotency_key` (account, slot, text hash and video hash). Unchanged text: pass `draft_id` and `content_type`; lowercased text: pass the exact final `text` without `draft_id`. Omit `platforms` and `auto_repost`. Read it back with `get_schedule_status`: text, video and local time must match the card. If the outcome is unclear, read back before retrying, and retry only with the same key. On "no", schedule nothing; the post stays a Threadify draft.
