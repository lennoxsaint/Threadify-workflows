---
name: threadify-run-my-threads
description: Set up one daily schedule so your agent prepares five Threadify-written Threads posts every morning from a weekly plan (one long-form thread on six days, one greatest-hit repost a day, hook-first structures and a chosen CTA level), shows them in this thread, and schedules them only after you reply "yes". Use when someone asks Threadify to run their Threads, prepare posts every morning for approval, or says "I want to approve posts, not write them".
---

# Run My Threads

"I don't write posts anymore. I approve them."

One setup builds a week plan. Then once a day the agent prepares that day's five posts, shows them in the thread with their times, and schedules them only when the owner replies "yes", from a phone if they like. Most always-on agents run on a pile of schedules, burn tokens and do very little. This one runs once a day and reports what the run used when the host shows it.

Follow [Threadify-001: setup and first-loop video](references/threadify-001.md) before the first connected call. A connection or a schedule never authorizes scheduling posts. Only the owner's reply to the exact card does.

## Rules

- Threadify writes initial drafts and plugs with `generate_content`. The assistant makes only explicitly owner-requested wording edits, narrowly, through the revision contract in [state and recovery](references/state-and-recovery.md). Never use `edit_draft` or run unsolicited editorial/slop/hook audit-and-regenerate loops.
- `save_draft` is allowed only for an exact greatest-hit repost: the owner's own past post saved word for word, byte-identical to the original. Never use it for anything else.
- Casing-only changes are separate from owner-requested wording edits: lowercase ordinary words, keeping proper nouns, only when the owner chose it. Prove it for every post with this skill's `scripts/casing-guard.mjs` (Node 18+, JSON on stdin). On FAIL, use Threadify's original unchanged. Never lowercase a greatest hit.
- Never invent facts. Pass `strict_facts: true`; a number in a hook only if it really happened.
- Never publish now. Never schedule without the owner's "yes" to the exact card. Never move, replace or overwrite an occupied slot. Never create a second daily schedule.
- The craft rules live in [references/threads-playbook.md](references/threads-playbook.md) and [references/hook-bank.md](references/hook-bank.md). Include them in `inputText`; they are generation requirements, not automatic rewrite gates.

## The week

Five posts a day, 35 a week. On six days: one long-form thread and four short-form posts. On the short day (default Sunday): five short-form posts. Each day one short-form slot is a greatest-hit repost. So a week is 6 threads and 29 short-form posts.

- Long-form rotates `teacher` → `storyteller` → `synthesizer`. Short-form rotates `one-liner`, `listicle` and `random`; `listicle-plug` is used only on CTA slots. Each generated slot also gets a proven structure and a hook archetype.
- CTA level, chosen at setup (a plug is a CTA): **Growth** 0 a week; **Balanced** (default) 2 a day, 14 a week (one or two a day tops out at 14, not 15); **Conversion** 25 a week, 3 or 4 a day. A CTA is either a thread with an Auto Plug reply (`plug`) or a short-form `listicle-plug` whose CTA lives in post 2 (`listicle_plug`). Never a CTA or link in post 1.
- Build and check the plan with `node scripts/week-plan.mjs build` (JSON stdin: `start_date`, `mode`, `short_day`, `seed`, `auto_plug`). Exit 0 means every invariant passed. The plan is deterministic, so the same input always rebuilds the same week.

## One-time setup

1. Connect Threadify as Threadify-001 describes. Call `get_connection_defaults`, say only which @handle is in use, and confirm the account and timezone with the owner. Do not read an unset timezone out as fact.
2. Ask once and record: run time (default 05:30 local); casing (as Threadify writes it, or lowercase except proper nouns, plus the names, brands and places to keep); up to five topic lanes, or "let Threadify choose from my Brain"; the short day (default Sunday); CTA level. For Balanced or Conversion, call `list_offers` and let the owner pick one offer. With no offer, use Growth or ask them to create one in Threadify first. Optionally, a page of viral post templates they already keep in a connected tool.
3. Decide Auto Plug before the first plan: it is a Founder-tier feature that Threadify silently strips otherwise. Set `auto_plug: true` only when `get_connection_defaults` reports `quota.plan` as Founder or Operator, or the owner confirms their plan includes Auto Plug; otherwise, or when unsure, `auto_plug: false`. Save the choices and the planner input (`start_date` = first run day, `seed` = week number starting at 1, `auto_plug`) in the private state folder `~/.threadify-workflows/state/run-my-threads/` (below `THREADIFY_WORKFLOWS_HOME` when set; owner-only permissions), and in the schedule prompt so a fresh cloud run can rebuild the week.
4. Create exactly one daily schedule with [the schedule guide](references/daily-schedule.md). Look for an existing Run My Threads schedule first and reuse it. Read back its name, time, timezone, next run and how to pause it.
5. Build the week plan, show it as one compact table (day, then five cells such as `thread·teacher·step-by-step·plug` or `hit`), then run Day 1 now.

After day 7, increase `seed` by one and move `start_date` on seven days. When Auto Plug is unavailable, save `auto_plug: false`; future thread plugs become `listicle-plug` posts (Conversion then tops out at 22 a week, and the planner says so).

## Daily run

If today's card or receipt is already in this thread, resume it. Do not generate again. Note the run start time and rebuild today's row of the plan.

1. **Account.** Call `get_connection_defaults`. Stop and report if the account differs from setup or the connection fails. Note the remaining generation quota, `link_tracking` (`enabled`, `known`) and account-wide Auto Plug and Auto Repost.
2. **Open slots.** Call `list_scheduled_posts` with `days: 2` and read all pages. Include pending approval cards as occupied slots. A truncated response is not an empty calendar. Take candidate times from `best_time_to_post` (owner's timezone); otherwise use the owner's saved times or 08:00, 10:00, 12:30, 15:30, 19:00. A slot is open when no scheduled post is within 90 minutes of it and it is at least 60 minutes from now. Pick five, earliest first, at least 90 minutes apart, today then tomorrow, and fill them in plan order. Never touch occupied slots. If fewer are open, keep the thread, then the greatest hit, then CTA posts, and say what was dropped.
3. **Greatest hit.** Call `greatest_hits` (`metric: engagement_rate`, `media_type: TEXT_POST`, `limit: 20`; try `views` or `likes` if too few). Take the first that qualifies: `get_post_thread` shows a single post; it was not published or reposted in the last 60 days (check `search_posts` with its opening words, `list_scheduled_posts` and the state folder's repost log); it has no link while link tracking is on or unknown; and the stale-fact check passes (old ages, dates, "today", "this year", prices, counts, availability, events). If a fact is stale, pick another; never rewrite. Save it with `save_draft` and confirm the stored text equals the original byte for byte (`casing-guard.mjs check` with original and final must show PASS and `unchanged: true`).
4. **Sources and assignments.** Read actual posts in full: own `greatest_hits` with `get_post_thread`, My Vault with `list_vault_items` and `get_vault_item`, and an optional connected Viral Vault using its available full-read tools (such as `list_trends`, `search_corpus`, `get_generation_brief`). Search results or generic hook-bank examples alone are not evidence. Record the source URL, full text, recorded performance with observation date, extracted template and relevant adaptation in private state. Assign a distinct angle, hook mechanism and proof to each generated slot before generation. Never borrow another person's facts or identity. Missing suitable actual viral evidence holds only that slot. An unavailable external vault does not block other sources.
5. **Generate and persist.** Follow [state and recovery](references/state-and-recovery.md). Persist each attempt before calling `generate_content`, and its result immediately afterward. Use the plan's types, assigned source template, current owner voice, playbook requirements and `strict_facts: true`. CTA slots use the approved destination and offer; no CTA or link in post 1. Preserve every exact original and draft ID. Use the ordered IDs in [generation-models.json](references/generation-models.json); recover a confidently matched saved draft after an ambiguous timeout before falling back. Never claim a model the response does not confirm. Never regenerate successful slots. Hold invalid text unchanged; generation changes require an owner request.
6. **Requested edits.** Apply only the owner's selected spans or requested hooks, preserving all other text, CTA replies and times byte-for-byte. Record the instruction and a new revision hash, invalidate previous approval, and show the full revised batch when requested. Deleted setup or punchline text stays deleted; do not replace it with new filler. Never apply casing as an unrecorded wording edit.
7. **Copy rule.** As written: final equals the original. Lowercase: run `node scripts/casing-guard.mjs lowercase` with a keep list of the proper nouns in that post (names, brands, places; lowercase ordinary "i"). Then run `check` on every generated post and plug with the current wording revision as original, final and keep, and show PASS. On FAIL, set final to the original and check again. The guard leaves links, @handles and #hashtags untouched.
8. **Validate.** Call `validate_post` on each final text and plug. Hold invalid text unchanged and say why. Do not regenerate automatically.
9. **Approval card.** Send one message:

```text
Run My Threads · @handle · Area/City · Tue 6 Oct · 5 posts for approval · CTA level: balanced
1) 08:00 (00:00 UTC) · short-form one-liner · setup-twist-mic-drop · source-backed contrarian · model: <reported> (requested claude-opus) · guard PASS, lowercased · CTA: none
<exact final text>
2) 10:00 (02:00 UTC) · thread teacher · step-by-step · source-backed hook · CTA: plug (Auto Plug reply 15 min after)
<every post of the thread in full>
Plug: <exact plug text>
4) 15:30 (07:30 UTC) · greatest hit, verbatim · first posted <date> · <metric> · stale-fact check PASS
...
Account-wide Auto Plug / Auto Repost: <as returned, unchanged>
Link tracking: <on / off / unknown> · posts with links held: <none or numbers>
Reply "yes" to schedule all exactly as shown, "skip 2" to drop post 2, or "no" to schedule nothing.
```

10. **Schedule on "yes".** Approval binds the latest revision hash, exact text, slot and account shown; reject expired or superseded approvals. Persist each pending schedule attempt before the external call. Re-check with `get_connection_defaults` and `list_scheduled_posts`; a slot now taken or less than 15 minutes away is not scheduled, so re-plan that row, validate it and show it for a new "yes". Then call `schedule_post` for each approved row with a stable `idempotency_key` (run date, account, slot, guard `final_sha256`):
    - unchanged text and greatest hits: pass `draft_id` and `content_type` (plus `short_form_type` for a listicle-plug);
    - lowercased or owner-edited text: pass the exact final `text` (or `posts` for a thread) without `draft_id`, because Threadify schedules a draft's stored text when given a `draft_id`;
    - a `plug` row also passes `auto_plug: {content: <exact plug text>, trigger: "time", delay_minutes: 15}`. Omit `platforms` and `auto_repost`.
    Links: Threadify link tracking can replace URLs when a post is scheduled. The offer link may appear only in the CTA post (post 2 of a `listicle-plug`, or the plug reply), where a provider-tracked link may be returned and must be disclosed. If any other post or thread part contains a link and `link_tracking.enabled` is true or `known` is false, do not schedule that post; mark it held on the card, say that account-wide link tracking would rewrite the link, and leave the setting alone. Never claim a transformed link matches.
    Readback: call `get_schedule_status` for each returned `scheduled_post_id` and confirm the stored text and time match the card (record any CTA tracking transformation as a mismatch, not an exact match), then read back with `list_scheduled_posts`. For a `plug` row, read the receipt's `auto_plug` echo. If it is missing, Auto Plug is not on this plan and that thread is scheduled without the plug the card showed: say so, offer `cancel_schedule` for it, save `auto_plug: false`, and rebuild future days. If a stored text or time does not match the card, stop, show the difference and offer `cancel_schedule` for that post; cancel only after the owner's reply. If an outcome is unclear, read back before retrying, retry only that row with the same key, and never replay the batch.
    On "no", schedule nothing; the posts stay as Threadify drafts. With no reply, nothing is scheduled and the next run starts fresh.
11. **Receipt.** Report posts scheduled with `scheduled_post_id`, local and UTC times, types, models, source provenance, revision hash and guard results, the greatest hit used, CTA count today and this week, Auto Plug echo, skipped or held rows, run start and end, Threadify quota before and after, and, when the host exposes them, its usage or token figures. Otherwise say "usage not exposed by this host". Never estimate. Log the greatest hit's id and date in the state folder. A scheduled post is not a published post.

## When something is missing

Without a Threadify connection, generation entitlement or an available model, do not write posts yourself instead. Report the exact blocker and the manual next step. With no eligible greatest hit (or no `greatest_hits` on the plan), hold that slot and say why. If the host has no durable scheduler, say so and offer to run the workflow when the owner asks each morning.

## Demo feedback rules

Before the first step, read the demo feedback rules at the end of this file and follow them for the whole run. If `~/.threadify/owner-overlay.md` exists, follow it too; it is private, so never quote, publish or upload it.

## Demo feedback rules (full text)

Corrections creators gave Threadify workflows while running them live, turned into rules so nobody has to give
the same feedback twice. Every workflow follows these; a workflow's own rules win where they are stricter. A private
overlay at `~/.threadify/owner-overlay.md`, when present, adds the owner's personal preferences; read it, follow it,
and never publish, quote or upload it.

### Pace and confirmations
- Keep going until the agreed scope is finished. Never stop just to report progress.
- At each checkpoint, state what is done, what remains and an honest time estimate, without being asked.
- Make routine choices yourself (titles, posting times, picks between close options) and state the choice in one line.
- Ask for one confirmation per irreversible action. Never ask the same confirmation twice.
- Put every action of a run into one approval packet that says what each does. After the single yes, run to the end and read each result back. Never ask again for anything already inside the packet.
- The owner's "yes" in chat is the approval. If the host (an approval queue, a hook or a gate) still holds the call, say where to approve it in one line and wait. Never route around it or retry another way. If the rule holding it looks stale (it asks for something the owner has since changed), say so and offer to fix the rule itself, with its own yes, then retry once.
- Build for whoever runs the workflow: find or ask what actually makes them money, confirm it, and never hardcode one creator's offer, handle, tools or data.
- Plan for the owner's setup, not a developer's: no-code actions first. Say "here's what I'll do, in this order, and why. OK?", then work most important first. Start slow work, ship the quick win, then finish it.
- Look it up before you ask. Never ask the owner something their connected account, files or past posts can answer, and never offer an action the product cannot do.
- Ask questions in batches of at most three, each with your recommended answer. Use the host's native question tool when it has one.
- Run commands yourself. Never hand the user a terminal command you could run.
- In step-by-step demo mode, do exactly one step, then wait for "next".

### Output on screen
- Show generated posts and their Auto Plugs in full, in chat, as plain text. Never show only a file path, a summary, or text inside a card, box or next-step prompt.
- Show Threadify's generated drafts exactly as returned. Don't audit, polish or rewrite them unless the user asks.
- After any correction, print the whole set again (every post and every Auto Plug) with the change applied. Never show only the changed item or a diff.
- Make only the edit the owner asked for. Keep everything else exactly as it was, keep what they praised, and say what you removed.
- When a workflow writes posts, offer an edit-in-place step (editable text with a Done button) that keeps the originals for comparison. Skip it when the owner says they won't edit.
- Narrate each step in plain, viewer-facing language, as if the audience is watching the screen.
- Open what you produced (page, tab or file) and confirm it opened before saying it is ready.
- Review pages and videos must load and play quickly on a phone.
- Work in the background or the in-app browser. Don't take over the presenter's screen.
- Keep tables and visuals phone-readable: few columns and short cells.

### Truth and numbers
- Use real, current account numbers, refreshed at run time. Never use stale or estimated figures.
- Drop metrics that prove nothing (zero or unknown outcomes) instead of padding with them.
- Show real screenshots of what you describe. For a fix, show before and after.
- Hide only real secrets (keys, tokens, IDs, emails). Never blur the evidence the viewer needs.
- Label any hook without performance evidence as unproven. Never call it proven.
- Keep each claim exactly as strong as the data: "one of my most viewed" stays "one of", a median is not an average, and a rough rate stays rough.

### Copy
- Start from the owner's own material before writing from scratch: past posts and threads, testimonials, receipts, screenshots and notes. Use the real story or proof you find there.
- Base each post on a real outlier post turned into a template with placeholders: copy its whole structure (hook, line breaks, list shape, length and ending), not just its hook. Make the first 3 to 5 words the strongest.
- The hook carries a benefit for as many readers as possible. Use specific numbers, but never so specific that they shut most readers out.
- Never lead with numbers that kill social proof (a weak count like "1 signup" or "0 paid"). Frame them as the discovery or the win.
- Write with diary energy: what just happened, told like you just found out.
- Never reuse a hook, template or proof point within one batch.
- Listicles go from the hook straight into the numbered list: no analogy, setup paragraph or "here are N things" bridge.
- Short post: a one-sentence hook that opens a loop. Long thread: a three-sentence hook with two loops that ends in a colon.
- Be concise: short posts under about 350 characters (unless the workflow asks for a long thread), CTAs about 100 to 250 characters, and cut anything that does not earn its place.
- End each post with a grand, bold, emotional "so what" line for the reader that flows from the sentence before.
- Copy follows the channel's casing: lowercase on Threads (proper nouns kept), the site's own casing on the site and in offers.
- CTAs must be relevant, specific and seamlessly integrated. Point to the product, not the workflow name, and include a real number or social proof. Model each Auto Plug on the plugs that got the most clicks. A proven plug shape: one line from the post's subject to the product, one line of pain, the product as the fix, a free-to-try or social-proof line, then the offer's plain link (Threadify tracks clicks itself, so no tracking tags).
- Reuse the offer the account already has for the product. Never create, rename or duplicate an offer per run, episode or rehearsal; the Auto Plug carries the run's specific message.
- Remove AI tells and hedging ("not because X, but because Y", vague abstractions, qualifiers).
- Use plain words and no internal jargon a viewer would not know.

### Failure handling
- If a dependency stalls, switch to the fallback or the files already provided and say so. Never wait silently.
- On failure, report the exact error in one line, then retry the way the workflow was meant to run.
- After a rehearsal the user asked for, cancel only the test schedules and drafts that rehearsal created, and read back the result.
- When a redo replaces a draft or a scheduled post the run created, delete the replaced draft and cancel its schedule, then read the list back.
- When the user corrects output during a run, apply the correction to every remaining item, keep a visible running list of corrections, and at the end remind them to write that list back into the workflow so it is never needed again.
