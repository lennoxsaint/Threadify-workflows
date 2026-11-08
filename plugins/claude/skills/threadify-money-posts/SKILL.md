---
name: threadify-money-posts
description: Rank your Threads posts by clicks per 1,000 views instead of views, explain why the winners get clicks, then have Threadify write three posts in the winning pattern with tracked Auto Plugs and schedule them only after one exact approval. Use when someone says "money posts", asks which of their posts actually get clicks, or wants to stop chasing views.
---

# Money Posts

Views are not money. Clicks are closer. This workflow ranks the owner's posts by **clicks per 1,000 views**, shows why the top ones get clicks, then asks Threadify to write three new posts in that pattern, each with a tracked Auto Plug, and schedules them only after one "yes". It works the same in Claude Code, Codex and ChatGPT.

Follow [Threadify-001: setup and first-loop video](references/threadify-001.md) before the first connected call. A connection never authorizes scheduling. Only the owner's "yes" to the exact approval packet does.

## Rules

- Threadify writes every post and every plug with `generate_content`. Preserve generated wording by default; the agent edits only when the owner explicitly asks. Record the request and original copy. Never use `edit_draft`.
- Without an editing request, the only permitted change is lowercasing, keeping proper nouns, and only when the owner asks for it. Prove it for every post and plug with this skill's `scripts/casing-guard.mjs` (Node 18+, JSON on stdin): `lower(original) == lower(final)` must be true and the result PASS. If the guard fails, show the original unchanged.
- Never publish now. Never schedule without the owner's "yes" to the exact packet. Never move or overwrite a post already on the calendar.
- Missing data stays unknown. Say "unknown", never 0, for a number the tools did not return. No performance predictions: never say a post or pattern "will" get clicks.
- Say "conversions", exactly as the tool labels them. Never say "sales" unless that row's revenue is above 0. Say "attributed", not "caused".
- Never print credentials, tokens, account ids or customer details.

## Steps

1. **Connect.** Call `get_connection_defaults`. Confirm the account by saying only the @handle and timezone, for example "@handle · Australia/Perth". Note `link_tracking` and the plan for Auto Plug.
2. **Read 90 days.** Call `read_link_attribution` with `days: 90` and a `limit` high enough for every link (raise it if the rows hit the limit). Call `read_post_performance` with `days: 90`, `include_full_text: true` and a `limit` above `total_matched`. For any linked post missing from that page, call `read_post_performance` with its `post_id`; if it is still missing, look it up with `search_posts` using the link's `root_post_text`. Threadify can file an Auto Plug's clicks under the plug reply instead of its post: for every linked id that is still missing (usually `source_kind: auto_plug`), call `get_post_thread` with that id and keep the results. If the plan returns a shorter window than 90 days, say the real window.
3. **Rank.** Pipe the results into `node scripts/rank-money-posts.mjs` as `{"attribution": ..., "performance": ..., "threads": {"<missing id>": <get_post_thread result>}}`. It moves each plug reply's clicks onto the post its thread opens with (`plug_rows_moved_to_post`). If `big_posts_no_link_caveat` is set, say it next to the "big posts with no link" list. It joins each link row to its post by `root_threads_post_id` (fallback `final_threads_post_id`), sums clicks per post, and computes clicks per 1,000 views = unique clicks / views × 1000. Show one table, best first:

   | # | Post (first line) | Date | Views | Clicks | Clicks per 1,000 views | Conversions |

   Then a short list, "Big posts with no link": the top posts by views that carried no tracked link. Use the script's numbers exactly. A row marked `few_clicks` has fewer than 5 clicks, so say it is a small sample.
4. **Explain.** Name 2-4 patterns that the top click posts share, and tie each one to the named posts and the evidence (the first line, the ask, where the link sat, the format). Read a winner's full thread with `get_post_thread` when needed. Contrast with a big post with no link or few clicks. Describe what happened, never what will happen.
5. **Cold start.** If the script says `mode: "proxy"` (fewer than 5 linked posts, or fewer than 30 clicks in 90 days), say so plainly. Then rank on proxy signals instead: replies per 1,000 views, and replies asking how, for the link, or where to get it. Count those asks only from replies you can actually read and pass them as `asks`; otherwise show "unknown". Label every proxy number "proxy, not clicks". Steps 6-10 still run; the 7-day check is what turns the proxy into real clicks.
6. **Ground hooks, then Threadify writes 3.** Read 3–5 relevant owner greatest hits (`greatest_hits`), expanding when needed. If available, use `list_vault_items`/`get_vault_item` or `list_viral_items`/`get_viral_item` for a better fit. Keep the click patterns from step 4 as the subject/structure; hook research is separate. Record source, observed metric, original opening, adapted opening and limitations for each hook. A high-performing source does not prove its hook caused performance; saved likes alone do not establish an account-relative outlier. Adapt third-party structure, not wording or personal stories. If no relevant evidence is available, label the hook **unproven** and continue.

   **Generation brief:** request concise copy, short paragraphs, useful white space, correct grammar/punctuation, plain audience language ("posts that get people to click", not "click winners"), and a strong closing point that follows the evidence. Match the owner’s voice; polarizing language and profanity are not universal defaults. Avoid unrelated slogans and generic morals. Keep irrelevant measurement caveats in the analysis; omitting zero-conversion commentary never permits implying sales or revenue.

    Make one `generate_content` call per post, matching the winning post's format, with `strict_facts: true` and `inputText` describing the winning pattern as a shape (the patterns from step 4, never a past post's copy to paste). No offer and no link in the post itself. Keep Threadify's exact text and `draft_id`, and record the `model` the response reports. If the owner wants lowercase, run `casing-guard.mjs lowercase` with the proper nouns to keep, then `check` on every post with original and final. Show the proof per post, for example "guard: lower(original) == lower(final) PASS". If the guard fails, show the original unchanged.
7. **One Auto Plug each.** Call `list_offers` and let the owner pick one offer if more than one fits. For each post, make one more `generate_content` call with that `offer_id`, asking for a one-post plug reply that continues that exact post. Run the guard on each plug the same way. Before generation, confirm what the destination provides from the offer record and available destination evidence. A mismatch or unavailable evidence requires clarification before drafting a claim about what the link provides. Promote the selected offer, not this workflow or Threadify by default. Request a short, specific CTA that naturally continues the post. Never advertise an unavailable workflow, download or free offer. The plug's link is the offer's saved destination. Updating that record needs separate authorization; a copy edit is not permission to change it. Threadify links on Threads are auto-tracked, so add no UTM tags. If `link_tracking` is off or unknown, say clicks may not be measured and leave the setting alone. If the plan has no Auto Plug, say so and ask whether to schedule the posts without plugs or stop.
8. **Review and pick 3 slots.** Follow [review and editing](references/review.md). Do not request replacement drafts merely because you dislike their style. Report factual or validation problems without silently changing locked copy. Owner-requested edits preserve facts and destinations and change only the requested scope; a one-sentence correction leaves every other byte unchanged. Keep original/final copy, model, editing mode, owner request, hook evidence, review findings and final hashes in a local receipt. Run `node scripts/review-packet.mjs < review.json` as described in the reference. Never present owner-requested edits as casing-only PASS.  Call `best_time_to_post` (owner's timezone) and `list_scheduled_posts`. A truncated response is not an empty calendar. Pick one slot on each of the next three days, at the best measured time with no scheduled post within 90 minutes and at least 60 minutes from now. Call `validate_post` on every post and plug; if one fails, say why and ask Threadify once for a replacement through steps 6-7.
9. **One approval packet.** Send one message:

```text
Money Posts · @handle · <timezone>
Pattern: <one line from step 4>
1) <weekday date, local time> · <unchanged | casing guard PASS | owner-requested edit>
<exact final post text>
Auto Plug (15 min after): <exact plug text>
Destination: <exact offer destination>
2) ...
3) ...
Action: schedule these 3 posts with their Auto Plugs exactly as shown. Nothing publishes now.
Reply "yes" to schedule all 3, or "no" to schedule nothing.
```

   Schedule only on an explicit "yes". Any change to text, plug, destination, account or time needs a new packet and a new "yes". On "yes", re-check `list_scheduled_posts`, then call `schedule_post` three times with a stable `idempotency_key` per post (account, slot, final post and plug hashes) and `auto_plug: {content: <exact plug text>, trigger: "time", delay_minutes: 15}`. Unchanged text: pass `draft_id` and `content_type`. Lowercased or owner-edited text: pass the exact final `text` without `draft_id`, because Threadify schedules a draft's stored text when given a `draft_id`. Omit `platforms` and `auto_repost`. Then read back each one with `get_schedule_status`: text, local time and the `auto_plug` echo must match the packet. If an outcome is unclear, read back before retrying, and retry only that post with the same key. Persist the exact approved revision before scheduling. Run the review checker with the approval hash and fresh validations; stop on mismatch. After readback, run it again with the actual saved text, time and plug. On "no", schedule nothing; originals stay as Threadify drafts. Use `save_draft` only when the owner asks to retain a reviewed final. Re-output revisions losslessly: do not retype or alter unrelated fields.
10. **7-day check.** Offer to re-run Money Posts 7 days after the last of the 3 posts goes out, to rank them by real clicks next to the old winners. If the host supports a reminder or scheduled run (for example `/schedule` in Claude Code), offer to create one, and create it only after the owner agrees. Otherwise give a dated note: "Run Money Posts on <date> to rank these 3 by real clicks."

## When something is missing

Without a Threadify connection or generation access, stop and say exactly what is missing and the manual next step. Never write posts yourself instead. A scheduled post is not a published post, and a click is not a sale.

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
