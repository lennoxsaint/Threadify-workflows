# Go Make Money: the fix step

Fix #1 is the top-ranked decision from step 7. One fix per run, one exact "yes" before any change, and a readback after. Resolve `scripts/` against the skill directory (one level up from this file). A connection never authorizes a change; only the owner's exact "yes" to the fix card does.

## Rules

- Allowed actions only: (a) offer + Auto Plug + tracked link, (b) one scheduled post, (c) an optional landing-page pull request. Anything else is a new decision for the owner, not part of this fix.
- Show the exact change first: the exact offer fields before and after, the exact post and Auto Plug text, or the exact diff. Ask once: "Reply yes to <action>, or no to change nothing." Any change to the text, link, account, time or diff needs a new card and a new "yes".
- Public copy passes `node scripts/go-make-money.mjs check-copy --file <file> --keep "<proper nouns>"`: no em dashes, lowercase with proper nouns kept, no revenue or customer guarantees, no emails, at most one link.
- Never call `publish_now`. Never merge a pull request. Never move or overwrite a post already on the calendar. Never change global automation settings.
- If an outcome is unclear, read back before retrying, and retry only with the same idempotency key.

## (a) Offer + Auto Plug + tracked link (the Monetize My Week way)

1. From `list_offers`, pick the offer the leaking links point to. Compare its destination and copy with the promise (`promise.txt`) and the page (`page.txt`): the destination should be the page that delivers what the post or video promised, and the copy should use the promise's words.
2. Card: the exact `update_offer` fields (or `create_offer` when no offer fits), before and after, plus the exact Auto Plug text: one context-specific reply, 100 to 250 characters, using only the offer's approved facts, ending with the offer's plain destination link (Threadify tracks every link it posts, so no UTM tags). The Auto Plug goes under the next scheduled post with `auto_plug: { trigger: "time", delay_minutes: 50, content }`; it is never inserted into a post body.
3. On "yes": call `update_offer` (or `create_offer`), then read it back with `list_offers` and show the stored name, destination and copy. The tracked link is the `/go/` link Threadify creates when the plug posts; say it will appear in `read_link_attribution` after the post goes out.

## (b) One post about the decision

1. One `generate_content` call: `content_type: "short-form"`, `strict_facts: true`, no `offer_id`, and `inputText` = the decision, the leak line and its real numbers, plus: "Write one short post in my voice about this decision and why I made it, using only these numbers. Put the strongest point in the first 3 to 5 words. End with one confident so-what line for the reader. About 300 characters. No links. No promises of results." Keep Threadify's exact text and `draft_id`.
2. Lowercase only: `node scripts/casing-guard.mjs lowercase` with the proper nouns to keep, then `check` with original and final; show "guard: lower(original) == lower(final) PASS". If it fails, show Threadify's original unchanged. Then `check-copy` on the final text (and on the plug).
3. Call `best_time_to_post` (owner's timezone) and `list_scheduled_posts` (a truncated response is not an empty calendar). Pick the best measured slot at least 60 minutes from now and not within 90 minutes of another post. `validate_post` the exact final text. Card:

```text
Go Make Money · @handle · <timezone>
<weekday date, local time> · casing guard PASS · check-copy PASS
<exact final post text>
Auto Plug (+50 min): <exact plug text, or "none">
Action: schedule this post exactly as shown. Nothing publishes now.
Reply "yes" to schedule it, or "no" to schedule nothing.
```

4. On "yes": `schedule_post` once with a stable `idempotency_key` (account, slot, text hash, plug hash): lowercased text passes the exact final `text` without `draft_id` (Threadify schedules a draft's stored text when given a `draft_id`); with a plug add `auto_plug: { trigger: "time", delay_minutes: 50, content }`. Omit `platforms` and `auto_repost`. Read back with `get_schedule_status`: text, local time and the stored Auto Plug content, trigger and delay must match the card. Report `scheduled_confirmed`, `blocked`, `failed` or `schedule_unverified`. If the Auto Plug is tier-blocked, state the returned current tier, required tier and allowed alternative. Do not retry, and offer the post without the plug (a new card and a new "yes").

## (c) Optional landing-page pull request

Only when the site's git repository is open in this session and the owner has said the page may change by pull request.

1. `git status` must be clean for the files you touch; never touch unrelated work. Create a new branch (for example `fix/home-promise-match`). Make a small copy change that makes the page say what the promise says (a headline, a subheading or one section), nothing else. Run the repo's own checks if it has a quick one.
2. Card: the exact diff. On "yes": commit, push the branch and run `gh pr create` with a plain-English title and body (the leak, the promise words missing from the page, the change). Print the PR URL. Read the preview URL from the PR checks or comments (`gh pr view --json url,statusCheckRollup,comments`); if no preview appears within a few minutes, say "preview: not posted yet". **Never merge it**, and never push to the default branch.

## Readback file

Write `<run>/fix.json` as `{"decision": "<title>", "kind": "offer" | "post" | "landing-page-pr", "readbacks": [{"what": "<offer updated | post scheduled | PR opened>", "readback": "<the stored values, in plain words>", "url": "<PR or preview URL, if any>", "ids": {...}}]}` (no emails, no tokens), then re-run `report`.
