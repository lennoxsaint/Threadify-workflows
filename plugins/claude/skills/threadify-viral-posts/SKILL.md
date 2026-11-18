---
name: threadify-viral-posts
description: "Advanced workflow. Start locally from confirmed facts and supplied posts without a Threadify account. Finds the post shapes that went viral for the creator more than once, writes a small batch of new Threads posts on those exact skeletons from the creator's own facts, checks every post and proposes a schedule. Schedules only after an explicit yes on the exact batch, and never publishes now."
---

# Threadify Viral Posts

Start locally from confirmed facts and supplied posts without a Threadify account. Honor an existing connection choice. Offer a connection only when an available hosted capability would help; explain the benefit and obtain approval for the exact provider action.

Follow [Threadify-001: setup and first-loop video](references/threadify-001.md) before provider calls. Honor an explicit choice already given; setup never grants scheduling or publishing authority.

Use this when the creator says "viral posts", "make me viral posts" or "write posts from my viral templates". It makes posts only, for Threads only. It uses only the Threadify tools named below: no browser, no other scheduler and no other network.

## The five rules creators gave us

These come from real creators turning down drafts. Follow every one for every post.

1. **Copy the proven skeleton line for line.** A draft that is "not an exact template of posts that went viral" gets rejected. Keep the template's line count, line breaks, list shape, length and ending. Change only the filled-in words.
2. **Short hooks.** The hook (first line) is 80 characters or less, unless the template's own proven hook is longer. Then match its length, never go past it.
3. **The creator's energy, not a robot's.** Write in the voice and energy of the creator's own top posts. If a draft reads flat next to its evidence posts, it fails.
4. **Deliver what the hook promises.** Run a fresh-reader check: pretend you see only this post, nothing else. Did it give you what the hook promised? If not, it fails.
5. **Show every part of a thread.** At the approval gate, show the full text of every part, in order. Never show only the first post of a thread.

Never invent a number, quote, name or story. Every fact in a draft must come from the creator's Brain, their own posts or what they told you in this chat.

## Steps

1. **Connect check.** Call `get_connection_defaults` first. Read the account handle, timezone, scopes and generation quota from it. Use that timezone for every time you show. If there is no working connection, go to the local fallback below.
2. **Find what went viral more than once.**
   - Call `greatest_hits` with `metric: "views"` and a `limit` of at least 20, all-time. Call `read_post_performance` with `all_time: true`, `sort_by: "views"` and a `limit` big enough to see the whole account (for example 200) so you know the account's top 10% view line. Use `search_posts` to find more posts that share a hook or shape you spotted.
   - For any thread, call `get_post_thread` to read every part. The analytics tools return only the first part.
   - Call `list_viral_items` and `get_viral_item` to look at viral posts in the shared Viral library that match the creator's topics. A library post counts only when it shows clear engagement (its recorded likes). Being public does not give copy rights: borrow the shape only, never the words.
   - A **template** is a hook skeleton or post shape that reached the creator's top 10% by views at least twice, or a library post with clear engagement. Write the skeleton with placeholders, for example `i [did X] for [time]. here's what [result]:`.
   - For each template show its evidence: each post's first line, date and view count, plus the top 10% line it beat. A shape that hit the top 10% only once is "unproven". Label it that way and never use it in this batch.
3. **Write.** Pick up to three templates, each one different. For each, call `query_brain` for the real facts that fill its placeholders. Then call `generate_content` with the skeleton written out line for line, the facts, and the rule "keep this skeleton exactly; change only the placeholder words". Use `contentType: "long-form"` for a thread template and `"short-form"` for a single post. Make two versions per template (two calls, for example with a different style preset), then pick the best one per template and say why in one line. Check the quota first; do not spend more generations than the batch needs. If a version comes back off the skeleton, it counts as a failed version, not a draft to fix by hand.
4. **Check every final post.** A post must pass all of these before it can be shown for approval:
   - `validate_post` returns valid for the exact parts, in order.
   - The skeleton matches the template line for line (same line count and shape).
   - The hook is 80 characters or less, or no longer than the template's proven hook.
   - The fresh-reader check passes: the body gives what the hook promised.
   - A thread has every part present and in order.
   - Every number, quote and story traces to the Brain, the creator's posts or this chat.
   - No two posts in the batch share a hook or a template.
   If a post fails, fix it (or write it again) and check again. Say which check failed and what changed.
5. **Plan the times.** Call `best_time_to_post` for the best slots. Call `list_scheduled_posts` for the window. The number of posts it returns must equal its `total_in_window`. If it does not, raise the `limit` and call it again. Never treat a short list as a free calendar. Give each post its own slot that is at least 2 hours clear of anything already queued and of the other new posts, and make sure no new post repeats text already queued.
6. **Approval gate.** Show, in chat, in plain text:
   - the account handle and timezone;
   - each template with its evidence posts and view counts;
   - the exact full text of every part of every post;
   - the check results for each post;
   - the exact date and time for each post, in the creator's timezone;
   - the action: schedule, never publish now.
   Ask for one yes on this exact batch. Nothing is scheduled without it. Any change to text or time needs a new yes for that post. If the host holds the call for approval, say where to approve it in one line and wait. Never route around it.
7. **Schedule after the yes.** For each approved post, call `validate_post` again on the exact parts, then `schedule_post` with the exact parts, the exact time and a stable idempotency key built from the account, the template and the post text (for example `viral-posts:<account>:<template-id>:<first 8 characters of the text's sha256>`). Reuse the same key if you must retry; never make a new key to force a second write. Then call `get_schedule_status` for each returned id and compare the stored text and time with what was approved. Report each one as "scheduled", never "published". If the readback is missing or different, report "schedule unverified" and do not retry blindly.

This workflow never publishes now, never deletes and never edits other queued posts.

## Local fallback

Without a working connection, ask the creator to paste their best posts with view counts (the more the better, so you can see the top 10% line) and the facts each new post may use. Find the templates, fill them yourself from those facts only, run the same checks (skip `validate_post` and say so; check the 500 characters per part rule by hand) and propose times as "tentative, not checked against your live calendar". Label every draft "written locally, not by Threadify". Never claim Threadify generated, validated or scheduled anything.

## Receipt

Save a receipt in the creator's private workspace that follows `workflow-receipt.v1` (`workflow_id`, `adapter`, `account_handle`, `action`, `approved_text`, `approved_text_sha256`, `status`, `timestamp`, `timezone`, `tool_path`, `fallback_used`). Add the templates with their evidence posts and view counts, the check results per post, the schedule proposal with the live calendar total, the readback state and the idempotency key per post. Before the yes, `status` is `awaiting_approval` and `approved_text` is empty. In the fallback, `fallback_used` is true and `action` is `local_packet`. Keep the creator's posts, numbers and receipts out of any public place.

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
