# Go Make Money: the action step

The actions come from the plan the owner agreed in step 9, most important first. Each change to the account or the public shows its exact content and gets one "yes" in chat, then a readback. The owner's chat yes is the approval; a connection never is. Resolve `scripts/` against the skill directory (one level up from this file).

## Rules

- Allowed kinds only: (a) the existing offer's copy or destination, (b) one scheduled post with its Auto Plug, (c) page copy the owner pastes, or a pull request when the site's repo is open. Anything else is a new plan item for the owner, not part of this run.
- Show the exact change first: the offer fields before and after, the exact post and Auto Plug text, the exact page copy, or the exact diff. Ask once: "Reply yes to <action>, or no to change nothing." The plan's OK (step 9) agrees the order, not the exact content, so an action still needs its card when its exact content was not in front of the owner. One card may hold several actions with their exact content, and its single yes covers all of them. Any change to the text, link, account, time or diff needs a new card and a new "yes". Never ask the same yes twice.
- Copy checks: Threads copy passes `node scripts/go-make-money.mjs check-copy --file <file> --keep "<proper nouns>"` (lowercase, proper nouns kept); site and offer copy passes `check-copy --channel site` (keeps the site's casing). Both: no em dashes, no revenue or customer guarantees, no emails, at most one link. Fix every FAIL. A weak-proof warning ("1 signup", "0 paid") means a new post, never a hand edit.
- Never call `publish_now`. Never merge a pull request. Never move or overwrite a post already on the calendar. Never change global automation settings.
- If the host holds a call after the yes (an approval queue, a hook or a gate), say "held for approval in <where>" in one line and wait. Never route around it, never retry another way, and never call a held post scheduled.
- If an outcome is unclear, read back before retrying, and retry only with the same idempotency key.

## (a) The existing offer

1. Never create a new offer per run. From `list_offers`, take the offer the money activity's links point to (`money.json` matches them). Compare its destination and copy with the promise (`promise.txt`) and the page (`page.txt`): the destination should be the page that delivers what the post promised, and the copy should use the promise's words.
2. Change it only when its destination or copy is wrong for the promise. Card: the exact `update_offer` fields, before and after. `create_offer` only when the owner has no offer at all, as its own action with its own yes.
3. On "yes": call `update_offer`, then read it back with `list_offers` and show the stored name, destination and copy. The tracked link is the `/go/` link Threadify creates when the plug posts; it appears in `read_link_attribution` after the post goes out.

## (b) One post and its Auto Plug

1. **Template.** From step 11's library, write the chosen post's WHOLE structure as a template with placeholders: hook, line breaks, list shape, length and ending.
2. **Generate.** One `generate_content` call: `content_type: "short-form"`, `strict_facts: true`, no `offer_id`, a stable `idempotency_key`, and `inputText` = the template, this run's facts with their real numbers, and: "Write one post in my voice that follows this template's whole structure, line for line. Hook: a benefit for as many readers as possible, with specific numbers that do not shut most of them out. Diary energy, like I just found out. End with one grand, bold, emotional so-what line for the reader. Never lead with a weak count like 1 signup or 0 paid. No links. No promises of results." Keep Threadify's exact text and `draft_id`. If the call says it is still running, call again with the same key.
3. **Lowercase only.** `node scripts/casing-guard.mjs lowercase` with the proper nouns to keep, then `check` with original and final; show "guard: lower(original) == lower(final) PASS". If it fails, show Threadify's original unchanged. Then `check-copy` on the final text.
4. **Auto Plug.** From the CTA library (step 12): one reply in the shape of the best-clicking plug, specific to this post, 100 to 250 characters, using only the existing offer's approved facts and ending with its plain destination link (Threadify tracks every link it posts, so no UTM tags). It goes under the post with `auto_plug: { trigger: "time", delay_minutes: 50, content }`; it is never in the post body. `check-copy` it.
5. **Time.** Call `best_time_to_post` (owner's timezone) and `list_scheduled_posts` (a truncated response is not an empty calendar). Pick the next best measured slot at least 60 minutes from now and not within 90 minutes of another post. `validate_post` the exact final text.
6. **Show it.** Print the post and the plug in full in chat as plain text first, then the card:

```text
Go Make Money · @handle · <timezone>
<weekday date, local time> · casing guard PASS · check-copy PASS
Action: schedule the post above exactly as shown, with the Auto Plug 50 minutes later. Nothing publishes now.
Reply "yes" to schedule it, or "no" to schedule nothing.
```

7. **On "yes".** `schedule_post` once with a stable `idempotency_key` (account, slot, text hash, plug hash): lowercased text passes the exact final `text` without `draft_id` (Threadify schedules a draft's stored text when given a `draft_id`); with a plug add `auto_plug: { trigger: "time", delay_minutes: 50, content }`. Omit `platforms` and `auto_repost`. Read back with `get_schedule_status`: text, local time and the stored Auto Plug content, trigger and delay must match the card. Report `scheduled_confirmed`, `held`, `blocked`, `failed` or `schedule_unverified`. If the Auto Plug is tier-blocked, state the returned current tier, required tier, allowed alternative and upgrade URL. Do not retry, and offer the post without the plug (a new card and a new "yes").

## (c) Page copy, or a pull request

- **No repo open (the usual case).** Write the change in the site's own casing as before and after text the owner can paste, say exactly where it goes (which heading or section), and pass `check-copy --channel site`. No yes is needed to show text; the owner makes the change.
- **The site's git repo is open in this session and the owner wants a pull request.** `git status` must be clean for the files you touch; never touch unrelated work. Create a new branch (for example `fix/home-promise-match`). Make a small copy change that makes the page say what the promise says (a headline, a subheading or one section), nothing else. Run the repo's own checks if it has a quick one. Card: the exact diff. On "yes": commit, push the branch and run `gh pr create` with a plain-English title and body (the leak, the promise words missing from the page, the change). Print the PR URL. Read the preview URL from the PR checks or comments (`gh pr view --json url,statusCheckRollup,comments`); if no preview appears within a few minutes, say "preview: not posted yet". **Never merge it**, and never push to the default branch.

## Readback file

Write `<run>/fix.json` as `{"decision": "<title>", "kind": "offer" | "post" | "page-copy" | "landing-page-pr", "readbacks": [{"what": "<offer updated | post scheduled | page copy written | PR opened>", "readback": "<the stored values, in plain words>", "url": "<PR or preview URL, if any>", "ids": {...}}]}` (no emails, no tokens), then re-run `report`.
