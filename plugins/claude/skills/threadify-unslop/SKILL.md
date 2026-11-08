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
7. **One Auto Plug each.** Call `list_offers` and let the owner pick one offer if more than one fits. Each plug sells that offer, the product the owner sells, never this workflow or Unslop itself. It is specific, it fits the post it replies to, and it reads as the next thing that post would say. For each post, make one more `generate_content` call with that `offer_id`. The brief names the post the plug continues and asks for exactly this structure, one short line per slot, with a blank line between slots:

```text
[cheeky transition sentence from the post to the subject of the offer]

[concise pain point]

[concise example of how the offer is the solution]

free to try - join [number of people] [community word]

[link]
```

   - The "free to try" line goes in only when the offer really is free to try and the number of people comes from a verified, dated source: the offer facts, the owner's confirmation or account data. Never invent the number or round it up. If either one is unknown, ask the owner for the number or drop the line. Never guess.
   - The community word is the owner's own word for their audience when the Brain or the offer has one, for example "thriends". Otherwise it is "people".
   - The link is the offer's saved destination, exact. Threadify links on Threads are auto-tracked, so add no UTM tags.

   Every plug goes through the same gate (softened CTAs fail), the same three-call limit and the casing guard. Never advertise an unavailable workflow, download or free offer. If `link_tracking` is off or unknown, say clicks are not measured and leave the setting alone. If the plan has no Auto Plug, say so and ask whether to schedule the posts without plugs or stop.
8. **Pick 3 slots.** Call `best_time_to_post` (owner's timezone) and `list_scheduled_posts`. A truncated response is not an empty calendar. Pick one slot on each of the next three days, at the best measured time, with no scheduled post within 90 minutes and at least 60 minutes from now. Call `validate_post` on every post and plug. On a validation failure, say why and ask Threadify for a replacement through steps 5-7.
9. **One approval packet.** Send one message:

```text
Unslop · @handle · <timezone>
Raw pattern: <one line from step 5>
1) <weekday date, local time> · gate PASS (attempt <n>) · <unchanged | casing guard PASS> · model <reported>
<exact final post text>
Auto Plug (15 min after) · gate PASS (attempt <n>) · <unchanged | casing guard PASS>
<exact plug text, every line and blank line as written>
Join count: <number> · <source>, <date> | line dropped: <reason>
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

Keep a local receipt: account, real window, script output, every gate attempt and reason, each plug brief with the join count, its source and date or why the line was dropped, models requested and reported, casing guard results, the approval reply, scheduled post ids, slots and Auto Plug echo, and the readback. A scheduled post is not a published post.

## When something is missing

Without generation access, stop and say exactly what is missing and the manual next step. Never write posts yourself instead.

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
