---
name: threadify-whats-working
description: Check every Threads post you published this year against your own median views, show which kinds of posts Threads is killing and the one kind it still pushes 100x, then have Threadify write three posts in that winning pattern with tracked Auto Plugs and schedule them only after one exact approval. Use when someone asks "is Threads dead", "what's actually working on Threads", why their views dropped, or which of their posts get pushed.
---

# What's Working

Threads isn't dead. Most of your posts are. This workflow reads every post you published this year, labels each one against **your own median views** (dead, stuck or alive), answers "is Threads dead for me?" month by month, names what the dead posts share and the one kind of post Threads still pushes hardest, then asks Threadify to write three new posts in that pattern, each with a tracked Auto Plug, and schedules them only after one "yes". It works the same in Claude Code, Codex and ChatGPT.

Follow [Threadify-001: setup and first-loop video](references/threadify-001.md) before the first connected call. A connection never authorizes scheduling. Only the owner's "yes" to the exact approval packet does.

## Rules

- Follow the demo feedback rules at the end of this file for the whole run. If `~/.threadify/owner-overlay.md` exists, read it too and follow it; it is private, so never quote it into posts, files you publish or receipts.
- Every number comes from the tools or the script. Missing data stays unknown: say "unknown", never 0. Describe what happened, never what will happen: no post or pattern "will" go viral.
- Say "this year" only when the read starts on 1 January. Otherwise say the real window: "read N posts, <first date> to <last date>".
- Threadify writes every post and every plug with `generate_content`. Preserve generated wording by default; the agent edits only when the owner explicitly asks. Record the request and original copy. Never use `edit_draft`.
- Without an editing request, the only permitted change is lowercasing, keeping proper nouns, and only when the owner asks for it. Prove it for every post and plug with `scripts/casing-guard.mjs` (Node 18+, JSON on stdin): `lower(original) == lower(final)` must be true and the result PASS. If the guard fails, show the original unchanged.
- Never publish now. Never schedule without the owner's "yes" to the exact packet. Never move or overwrite a post already on the calendar.
- Never print credentials, tokens, account ids, other people's handles from replies, or customer details. Show the owner's own posts and numbers; they are the point.

## Steps

1. **Connect.** Call `get_connection_defaults`. Confirm the account by saying only the @handle and timezone, for example "@handle · Australia/Perth". Note `link_tracking` and the plan for Auto Plug. Say in one line what the owner gets: "I'll check every post you published this year against your own median, show you what Threads is killing and the one kind it still pushes, then Threadify writes 3 of those for you."
2. **Read the year.** Call `search_posts` with `query: "*"`, `from` / `to` set to one calendar month at a time from 1 January to today (`to` is exclusive: use the first day of the next month, and tomorrow for the current month, or the last day of every month goes missing), `sort_by: "recent"` and a `limit` above that month's `total_matched`; if a month returns fewer rows than `total_matched`, split it into halves and read again. Keep every page, and check that the months' row counts add up to the total before you diagnose. (`read_post_performance` with a long window can fail with `artifact-write-failed`; use it only for a window it returns in full.) If the account's history doesn't reach 1 January, keep what it returns and say the real window. Save the raw pages locally (never in a public repo).
3. **Diagnose.** Pipe `{"performance": <every search_posts page>, "from": "<YYYY>-01-01", "handle": "@handle"}` into `node scripts/whats-working.mjs --html whats-working.html`. Say the coverage line first ("Read N posts, date to date. Counted M; K too new to judge; U with unknown views."), then the median, the best post and its multiple, and `never_broke_out_percent`. Labels are relative to the median: **dead** under 1x, **stuck** 1x to under 3x, **alive** 3x or more; posts under 3 days old are left out because they are still collecting views. Then answer "is Threads dead for you?" from `monthly`: compare the first and last full months' median views and alive share, in numbers, with no verdict the numbers don't show.
4. **Name the patterns.** Read the posts (top 30 by views, the 30 lowest, and every alive post) and give each counted post one short pattern label that joins its hook and format, for example "news reaction", "i got AI to do a huge task", "hot take", "how-to list", "personal story", "question", "promo". Use the owner's own words for topics. Use 6-10 labels in total so groups are big enough. Re-run the script with `"tags": {"<post_id>": {"pattern": "<label>"}}`. Patterns with fewer than 5 posts are marked `small_sample` and are not ranked; say so if one looks big.
5. **Show what's working.** Open the report page and keep it on screen: serve its folder on this computer only (for example `python3 -m http.server 8047 --bind 127.0.0.1 --directory <report folder>` in the background) and open `http://127.0.0.1:8047/whats-working.html` in the browser, because some hosts' browsers refuse `file://` pages. Stop the server when the run ends. In chat, keep it short and phone-readable (no wide tables):
   - **What Threads killed:** up to 3 `most_dead` patterns, each with its median multiple and one real post (first line + views).
   - **What it still pushes:** `most_alive`, ending on **#1** (`number_one`): its median multiple, alive share and its 3 real example posts.
   - One line: what the #1 posts share that the dead ones don't (first line, subject, format), tied to the examples. Describe, don't predict.
6. **Threadify writes 3 in the #1 pattern.** Make one `generate_content` call per post with `strict_facts: true`, `inputText` describing the #1 pattern as a shape (never a past post's copy to paste) plus a fresh subject from the owner's own recent topics, and `selectedModel` from [generation models](references/generation-models.json) (Claude Opus 5.5 when the plan allows it, Gemini as fallback; record the requested and reported model). Ask for concise copy, a first line that opens a loop, short paragraphs and a strong closing point in the owner's voice. Give numbers as whole numbers, and keep the analysis caveats (association, sample size) in the report, not in the post. No offer and no link in the post itself. Keep Threadify's exact text and `draft_id`. If the owner wants lowercase, run `casing-guard.mjs lowercase` with the proper nouns to keep, then `check` on every post; show "guard: lower(original) == lower(final) PASS" per post.
7. **One Auto Plug each.** Call `list_offers` and let the owner pick one offer if more than one fits. For each post, make one more `generate_content` call with that `offer_id`, asking for a one-post plug reply that continues that exact post. Run the guard on each plug the same way. Promote the selected offer, and claim only what its destination provides. The plug's link is the offer's saved destination; Threadify links on Threads are auto-tracked, so add no UTM tags. If `link_tracking` is off or unknown, say clicks may not be measured. If the plan has no Auto Plug, say so and ask whether to schedule without plugs or stop.
8. **Review and pick 3 slots.** Follow [review and editing](references/review.md) and run `node scripts/review-packet.mjs < review.json` as described there. Call `best_time_to_post` (owner's timezone) and `list_scheduled_posts`; a truncated response is not an empty calendar. Pick one slot on each of the next three days at the best measured time with no scheduled post within 90 minutes and at least 60 minutes from now. Call `validate_post` on every post and plug; if one fails, say why and ask Threadify once for a replacement through steps 6-7.
9. **One approval packet.** Send one message:

```text
What's Working · @handle · <timezone>
#1 pattern: <label> · <median multiple>x your median
1) <weekday date, local time> · <unchanged | casing guard PASS | owner-requested edit>
<exact final post text>
Auto Plug (15 min after): <exact plug text>
Destination: <exact offer destination>
2) ...
3) ...
Action: schedule these 3 posts with their Auto Plugs exactly as shown. Nothing publishes now.
Reply "yes" to schedule all 3, or "no" to schedule nothing.
```

   Schedule only on an explicit "yes". Any change to text, plug, destination, account or time needs a new packet and a new "yes". On "yes", re-check `list_scheduled_posts`, then call `schedule_post` three times with a stable `idempotency_key` per post (account, slot, final post and plug hashes) and `auto_plug: {content: <exact plug text>, trigger: "time", delay_minutes: 15}`. Unchanged text: pass `draft_id` and `content_type`. Lowercased or owner-edited text: pass the exact final `text` without `draft_id`, because Threadify schedules a draft's stored text when given a `draft_id`. Omit `platforms` and `auto_repost`. Read back each one with `get_schedule_status`: text, local time and the `auto_plug` echo must match the packet; a failed or cancelled record is a mismatch. If an outcome is unclear, read back before retrying, and retry only that post with the same key. On "no", schedule nothing; originals stay as Threadify drafts.
10. **7-day check.** Offer to re-run What's Working 7 days after the last of the 3 posts goes out, to see where they landed against the median. If the host supports a reminder or scheduled run, offer to create one and create it only after the owner agrees. Otherwise give a dated note: "Run What's Working on <date> to see where these 3 landed."

## When something is missing

Without a Threadify connection or generation access, stop and say exactly what is missing and the manual next step. Never write posts yourself instead. A scheduled post is not a published post.

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
