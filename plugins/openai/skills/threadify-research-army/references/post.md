# Research Army: the post step

Threadify writes one research post from the winner's backed findings, the owner edits it if they want, and it is scheduled only after one exact "yes". Resolve `scripts/` against the skill directory (one level up from this file). A connection never authorizes scheduling; only the owner's exact "yes" to the post card does.

## Rules

- Threadify writes the post with `generate_content`. Show its exact text in full, in chat. Never reword it and never use `edit_draft`. Never call `publish_now`.
- The only change the agent may make is casing (lowercase, proper nouns kept), and only when the owner asks; prove it with `scripts/casing-guard.mjs` (`lower(original) == lower(final)` PASS). Wording changes are the owner's, typed into the editable block.
- Every number in the post must be one of the `facts` from `research-army.mjs facts` (the checker's recount of the winner's backed claims). If the post states any other number or a claim the facts don't support, ask Threadify once for a replacement with the same input; if it fails again, say so and stop.
- The post names the source honestly with the corpus label (or a shorter true version, such as "the 100 most-liked Threads posts in <niche> this month"). Never "most viewed", never "top on Threads", and never another creator's handle or words.
- Without a Threadify connection or generation access, never write the post yourself; say what is missing.

## Steps

1. **Offer (optional).** Call `list_offers`. If the owner has an offer that fits, note its `offer_id` and say "I'll add a tracked link to <offer name>." If there's none, say "No offer saved; the post goes out without a link." Threadify links on Threads are tracked automatically; add no UTM tags. If `link_tracking` from `get_connection_defaults` is off or unknown, say clicks may not be measured.
2. **Write.** One `generate_content` call: `content_type: "short-form"`, `strict_facts: true`, `selectedModel` from [generation models](generation-models.json) (record the requested and reported model), the `offer_id` when there is one, and `inputText` = the `input_text` from `facts` plus: "Write one research post in my voice for creators in <niche>. Open with the most surprising finding in the first 3 to 5 words, then 2 to 4 findings with their exact numbers, then one clear so-what line for the reader. Under 350 characters if it fits. Use only these numbers." Keep Threadify's exact text and `draft_id` (call `save_draft` with the exact text if no draft id comes back). Save it to `<run>/post.md` with the model and draft id.
3. **Show it in full** in chat, then say which findings it used.
4. **Editable block.** Open one editable block with a real **Done editing** button: write `<run>/post-drafts.json` as `{"auto_plugs": false, "posts": [{"id": "post-1", "original": "<Threadify's exact text>"}]}` and run `node scripts/post-editor.mjs --input <run>/post-drafts.json --output <run>/owner-review.json` in the background. Open the URL it prints in the browser and say "Edit it if you like, then press Done editing." Wait for the command to report `owner_review_done`, then read `owner-review.json`. If the owner changed wording, the final text is theirs (mode `owner-requested edit`, never casing PASS); re-check that every number in it is still one of the facts and say if one isn't. Done editing never approves scheduling. If the owner says it's fine as is, skip the editor.
5. **Lowercase (only on request).** `node scripts/casing-guard.mjs lowercase` with the proper nouns to keep, then `check`, and show "guard: lower(original) == lower(final) PASS".
6. **One post card.** Call `best_time_to_post` (owner's timezone) and `list_scheduled_posts`; a truncated response is not an empty calendar. Pick tomorrow's best slot (or the next open best slot) at least 60 minutes from now and not within 90 minutes of another scheduled post; with no history, say the time is general, not measured. Call `validate_post` on the exact final text. Send one message:

```text
Research Army · @handle · <timezone>
<weekday date, local time> · <unchanged | casing guard PASS | owner edit>
<exact final post text>
<tracked link / offer, if any>
Action: schedule this post exactly as shown. Nothing publishes now.
Reply "yes" to schedule it, or "no" to schedule nothing.
```

7. **Schedule.** Only on an exact "yes". Any change to text, account or time needs a new card and a new "yes". Re-check `list_scheduled_posts`, then call `schedule_post` once with a stable `idempotency_key` (account, slot and text hash): unchanged text passes `draft_id` and `content_type`; lowercased or owner-edited text passes the exact final `text` without `draft_id`, because Threadify schedules a draft's stored text when given a `draft_id`. Omit `platforms` and `auto_repost`. Read it back with `get_schedule_status` (and `list_scheduled_posts`): text and local time must match the card; a failed or cancelled record is a mismatch. If the outcome is unclear, read back before retrying, and retry only with the same key. On "no", schedule nothing; the post stays a Threadify draft.
