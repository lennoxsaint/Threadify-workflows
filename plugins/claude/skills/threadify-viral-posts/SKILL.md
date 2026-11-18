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
2. **Short hooks.** The hook (first line) is 80 characters or less, unless the template's own proven hook (the first line of its most-viewed evidence post) is longer. Then match its length, never go past it.
3. **The creator's energy, not a robot's.** Write in the voice and energy of the creator's own top posts. If a draft reads flat next to its evidence posts, it fails.
4. **Deliver what the hook promises.** Run a fresh-reader check: where your host can start a fresh agent or session, give it only this prompt, with the post's full text in place of `{POST}`:

   ```
   Use no tools. You are a stranger scrolling Threads and you see only this one post, nothing else about who wrote it:

   {POST}

   First decide what kind of post it is. If the opening line promises more to come (an explanation, a list, steps, a story, a reason, "here's why", "here's how", or it ends in a colon), the post delivers only if the rest gives exactly that. If the whole post is one complete observation or claim that promises nothing more, it delivers when you understand the whole claim without knowing the author; a bare claim with no reason given is fine.

   Answer in exactly four lines:
   PROMISE: <what the opening line promises the reader, in a few words>
   KIND: <exactly one of: promises more | complete claim>
   DELIVERS: <exactly one of: clear yes | borderline | no>
   WHY: <one sentence>

   Judge honestly. "clear yes" only if the post fully gives you what its opening promised without needing to know the author.
   ```

   Only `DELIVERS: clear yes` passes; `borderline` and `no` fail. The `KIND` line keeps one-line posts fair: a hook that promises more must get it in the rest of the post, while one complete claim passes when a stranger understands it, with no reason needed. Record who read it, its answer word for word, and its verdict: the word after `DELIVERS:`, copied from that answer, never your own summary of it. Your own read is never a pass: when no fresh agent or session is available, the check is **unavailable**. Read the post yourself with the same prompt, record your answer, and show "fresh reader: unavailable (self-read: <your answer>)" at the gate.
5. **Show every part of a thread.** At the approval gate, show the full text of every part, in order. Never show only the first post of a thread.

Never invent a number, quote, name or story. Every fact in a draft must come from the creator's Brain, their own posts or what they told you in this chat.

Copy shape only from posts you have read in full: every part of a thread, no cut-off text. Text that ends in "…" is cut off. Shape you have not seen is unverified, never an exact template.

## What the run saves before any schedule

Some calls save things in the creator's Threadify account before the approval gate. Say so before step 2 and ask for a yes to drafting on its own. That yes covers only these saves; it never covers scheduling.

- Browsing the viral library with `list_viral_items` stores a private audit record, and so does opening a post with `get_viral_item`, which also uses one viral allowance.
- Each `generate_content` call saves one draft and one chat in the account and uses one generation. The batch makes at most 2 versions per template, 6 calls in all. Name that number and the quota left.
- Versions that are not picked stay saved as drafts. List their draft ids at the gate and in the receipt, and leave them for the creator to keep or delete.

## Steps

1. **Connect check.** Call `get_connection_defaults` first. Read the account, timezone, scopes and generation quota from it. The **account** is its `account.username` with no @; use that same form in every fingerprint and key. Use that timezone for every time you show. Also read the global auto-repost setting (`automation.global_auto_repost`: on or off, and its trigger, delay or likes threshold). If it is missing or not `known`, it is unknown, never off. If there is no working connection, go to the local fallback below. Then ask for the drafting yes (above). Without it, skip `list_viral_items`, `get_viral_item` and every later save, and stop after step 2 with evidence from the creator's own posts only.
2. **Find what went viral more than once.**
   - Call `greatest_hits` with `metric: "views"` and a `limit` of at least 20, all-time. Call `read_post_performance` with `all_time: true` and `sort_by: "views"`. Its `total_matched` is the account's post count; raise the `limit` until the post ranked at a tenth of that count, rounded down and at least 1 (rank 120 of 1,200; rank 1 for 1 to 19 posts), comes back. That post's views are the **top 10% line**. If `total_matched` is 0, there is nothing to copy: say so and stop before drafting. Record the count and the rank in the receipt. Use `search_posts` to find more posts that share a hook or shape you spotted.
   - For every evidence post, call `get_post_thread` to read every part in full and note its `media_type` and part count. The analytics tools return only the first part, and their text can be cut off. If an evidence post's later parts are only a plug (a link or a call to action) that the other evidence posts do not have, the template is the parts they share: say so at the gate and never copy the plug. If `get_post_thread` fails for an evidence post, its text is not read in full: label the template "shape unverified". If it returns no `media_type`, label the template "media unknown". Leave both out of this batch.
   - After the drafting yes only, call `list_viral_items` and `get_viral_item` to look at viral posts in the shared Viral library that match the creator's topics. Library posts only point you to shapes worth searching for in the creator's own posts. A shape seen only in the library is "unproven" for this creator and stays out of the batch. Being public does not give copy rights: borrow the shape only, never the words.
   - A **template** is a hook skeleton or post shape that reached the creator's top 10% by views at least twice, with two different fills. Posts whose text is the same after ignoring case, punctuation and spacing, or that differ only in a number such as an age or a year, are one fill, so a reposted or recycled post counts once. Write the skeleton with placeholders, for example `i [did X] for [time]. here's what [result]:`.
   - For each template show its evidence: per post its first line, date, views, media type, part count, fill and whether its text was complete, plus the top 10% line it beat. A shape that hit the top 10% only once, or only with one fill, is "unproven". Label it that way and never use it in this batch.
   - This workflow writes text posts. If a template's evidence posts are image, carousel or video posts (`media_type` other than `TEXT_POST`), the picture was part of what went viral. Label the template "needs media" and leave it out of this batch.
   - Check each template is not **tired**: call `search_posts` with the longest stretch of fixed words between placeholders (most words; the first on a tie), as written in the evidence posts, as the query (record the query in the receipt; search matches apostrophes and quote marks exactly, so when the stretch has one, search it again with the other form, curly `’` `“` `”` or straight `'` `"`, and merge the two results), with `sort_by: "recent"` and a `limit` of at least its `total_matched`. If fewer posts come back than `total_matched`, raise the limit and call again. Keep only the returned posts whose text fits the skeleton, then take its three most recent uses by date. A reposted copy counts as a use here, because the audience saw it again; record that rule and the three uses (date, views, fill) in the receipt. If the skeleton has no stretch of at least two fixed words, the search cannot find its uses: label it "tired check incomplete". If all three fell under the top 10% line, the audience has had enough of it for now. Label it "tired", show those three view counts, and pick another template; this holds even when more uses may be hidden. Otherwise, if you cannot see every match, label it "tired check incomplete" and say so at the gate.
   - **Calibrate the fresh-reader check** before any `generate_content` call. For each template you may use, give a fresh reader (rule 4) the template's most-viewed evidence post on its own, with the same prompt the new posts will get. Record who read it, its answer word for word and its verdict. If the creator's own winner is not a clear yes, the check is stricter than what went viral for them on this template. Show the creator that post and the answer, and ask: waive the fresh-reader check for this template in this run, or leave the template out. Until they waive it, label the template "control failed" and leave it out. With no fresh reader available, the control is unavailable too and nothing is asked.
3. **Write.** Pick up to three templates, each one different. Leave out every template labelled unproven, tired, needs media, media unknown, shape unverified or control failed. A "tired check incomplete" template may be used only with that flag shown next to it at the gate. For each, call `query_brain` for the real facts that fill its placeholders. Then call `generate_content` with the skeleton written out line for line, the facts, and the rule "keep this skeleton exactly; change only the placeholder words". Use `contentType: "long-form"` for a thread template and `"short-form"` for a single post. Make two versions per template (two calls, for example with a different style preset) and keep the draft id each call returns. Pick the best one per template and say why in one line. Never make more calls than the creator said yes to. If a version comes back off the skeleton, it counts as a failed version, not a draft to fix by hand.
4. **Check every final post.** A post must pass all of these before it can be shown for approval. Each check is pass or fail: "pass with a flag" or "the creator should confirm" is a fail. Two results are neither: a fresh-reader check the creator waived for this template in step 2 is recorded as "fail, waived", and one with no fresh reader available is recorded as "unavailable" (rule 4). A post with either may be proposed, with that result shown at the gate.
   - `validate_post` returns valid for the exact parts, in order.
   - The skeleton matches the template line for line (same line count and shape).
   - The hook is 80 characters or less, or no longer than the template's proven hook.
   - The fresh-reader check is a clear yes: the body gives what the hook promised, with nothing that needs outside context. On a template the creator waived in step 2, the reader still reads the post and its answer goes to the gate, marked "fail, waived" unless it is a clear yes. A waiver covers that template in this run only, and it is not a yes to schedule: the post still needs the yes at the gate.
   - The post is text only, and its template needs no media.
   - It reads at the energy of its evidence posts (their own swear words, short lines), not flat next to them. A fix that drops the creator's own swear words or intensifiers from a fact fails. Record a one-line reason for every energy result.
   - A thread has every part present and in order.
   - Every number, quote and story traces to the Brain, the creator's posts or this chat. A fact may be shortened to fit a slot only if its claim stays the same; changing who or what it is about makes a new claim, and that fails.
   - The filled-in words are new: they differ from every evidence post and every use found in the tired check. The same subject and idea in the same slot is a repeat and fails.
   - No two posts in the batch share a hook or a template.
   If a post fails, say which check failed. Fix it by hand only when the fix keeps the skeleton and the facts (for example a shorter hook), then check again and say what changed. Writing it again needs a new drafting yes that names the extra `generate_content` calls and the drafts they save; without that yes, drop the post from the batch.
5. **Plan the times.** Call `best_time_to_post` for the best slots. Call `list_scheduled_posts` for the window. The number of posts it returns must equal its `total_in_window`. If it does not, raise the `limit` and call it again. Never treat a short list as a free calendar. Every proposed slot must fall inside the window you listed; to plan further out, list a longer window first. Give each post its own slot that is at least 2 hours clear of anything already queued and of the other new posts, and make sure no new post repeats text already queued. The list shows only a preview of each queued post, so for every queued post whose preview ends in "…" or that has more than one part, call `get_schedule_status` once for its full text in order. Compare every part of every new post with those full texts and the full previews. If a full text cannot be fetched, the comparison is unresolved: no post is proposed until it is fetched. If a queued post already uses the same template, say so at the gate and keep the new one on a different day.
6. **Approval gate.** Show, in chat, in plain text:
   - the account handle and timezone;
   - each template with its label, the top 10% line it beat, and its evidence posts: per post its first line, date, views, media type, part count, fill and whether its text was complete, and any plug part left out; for a tired template, the view counts of its last three uses;
   - the exact full text of every part of every post;
   - the check results for each post, each pass or fail, with the hook's length against its limit (for example 78/81 when the proven hook is 81 characters), the energy reason and the fresh reader's answer; a waived check reads "fresh reader: fail, waived by you for <template-id> (your words: "...")";
   - the media for each post: none, as this workflow schedules text posts only;
   - the global auto-repost setting exactly as read: "on: Threadify re-shares each post <delay> after it goes out" (or "after <n> likes"), "off", or "unknown". This workflow never changes it. If it is unknown, nothing can be scheduled until the creator checks it in Threadify;
   - for each post fixed by hand: "schedules the text shown here; saved draft <id> keeps the old wording";
   - every draft saved so far, by id, each marked proposed, excluded or not picked;
   - for each template, its control (the fresh reader's answer on its most-viewed evidence post) and any waiver, in the creator's words;
   - each post's fingerprint and stable idempotency key (step 7.3 says how they are built), so the yes binds them;
   - the exact date and time for each post, in the creator's timezone;
   - the action: schedule, never publish now.
   Ask for one yes on this exact batch. Nothing is scheduled without it. Any change to text or time needs a new yes for that post. If the host holds the call for approval, say where to approve it in one line and wait. Never route around it.

   If the creator sends a post back with a note, change only what the note names and keep the skeleton: a new call-out or a new fact stays on the same template. If the note says the post is flat or boring, or rejects the skeleton, switch to another eligible template; polishing the words of a boring post does not fix it. A new `generate_content` call needs a drafting yes that names the extra calls and drafts. Show the changed post at a new gate; the yes on the other posts stands.
7. **Schedule after the yes.** For each approved post, in order:
   1. **Recheck.** Call `get_connection_defaults` and confirm the same account, timezone and global auto-repost setting as the gate showed; a changed or unknown setting blocks every post until a new yes. Call `list_scheduled_posts` again for the window, with the list length equal to `total_in_window`, and recheck the 2-hour clearance, duplicate text (at every dispatch, fetch the full text again with `get_schedule_status` for every queued post whose preview ends in "…" or that has more than one part, because an edit can change a later part without changing the preview or part count; never reuse text fetched earlier) and same-template days. A post that now conflicts is **blocked**: say why, propose a new time and wait for a new yes for that post. Never move an approved time yourself.
   2. Call `validate_post` again on the exact parts.
   3. **Save the intent first.** The fingerprint is the sha256 of the compact JSON array `[account, parts, media, scheduled_at]` (as `JSON.stringify` writes it): the account (step 1), every part's exact text in order as plain strings (not `{text}` objects), `[]` for media, and the approved time as an ISO instant written `YYYY-MM-DDTHH:mm:ss±hh:mm` in the creator's timezone (no milliseconds, never `Z`; for example `2026-06-03T09:00:00-04:00`). Any other form of the same time makes a different fingerprint. The stable idempotency key is `viral-posts:<account>:<template-id>:<first 12 characters of the fingerprint>`. Recompute both; they must equal what the gate showed. Save them in the receipt as pending. A changed time or text makes a new fingerprint and needs a new yes.
   4. Call `schedule_post` with that key as `idempotency_key`, `scheduled_at` as that same approved time string, `account` as the account from step 1, the matching `content_type` (`short-form` for one post, `long-form` for a thread), and the exact approved text: `posts` as `[{"text": ...}]` objects, one per part in order, or `text` for a single post. Never pass `draft_id`: a saved draft can be edited after the gate, and the tool does not say which text wins when `draft_id` is passed. Keep the draft id in the receipt as where the text came from. Leave out `platforms` (so it goes to Threads only), `auto_plug` and the per-post `auto_repost`; the creator's global auto-repost setting still applies, as shown at the gate. Save the returned scheduled post id in the receipt.
   5. If the call errors or times out, the result is unknown. Look for the post with `list_scheduled_posts` before any retry, and retry only with the same key; never make a new key to force a second write. A clear failure on one post does not stop the others; an unknown one stays on hold until you find it or rule it out.
   6. **Read back.** Call `get_schedule_status` for the returned id. Report "scheduled", never "published", only when its status shows the post queued and its account, every part's text and its time match what was approved. Otherwise report "schedule unverified" and do not retry blindly.

Each post ends in one state: proposed, excluded (its template is unproven, tired, needs media, media unknown or shape unverified, or control failed, or the post failed a check), blocked (a queue conflict, repeated or unresolved queued text, or a changed auto-repost setting), approved, scheduled or schedule unverified.

This workflow never publishes now, never deletes and never edits other queued posts.

## Local fallback

Without a working connection, ask the creator to paste their best posts with view counts and dates (the more the better, so you can see the top 10% line), the full text of every part of each post you will copy a shape from, their 10 most recent posts with view counts, and the facts each new post may use. A post that ends in "…" or is missing thread parts is cut off: ask for the full text. Until you have it, label that template "shape unverified" and leave it out of the batch. Ask how many posts they have published in all: the top 10% line is the view count of the pasted post ranked at a tenth of that total, rounded down and at least 1 (rank 370 of 3,700; rank 370 of 3,709; rank 1 for 1 to 19 posts). If they have published none, there is nothing to copy: say so and stop. If the paste stops before that rank, use its lowest view count and call the line estimated. Ask whether each template post had a picture; a template whose posts did is "needs media", and one with no answer yet is "media unknown" at the gate. The tired check uses every dated use of the template in any paste; recent posts with no text cannot show a use, so they count as missing. A paste of only best posts hides a tired template, so if the recent posts are missing, label the template "tired check incomplete". Find the templates, fill them yourself from those facts only, run the same checks (skip `validate_post` and say so; check the 500 characters per part rule by hand) and propose times from the posting times the creator gives, marked "tentative, not checked against your live calendar". Label every draft "written locally, not by Threadify". Never claim Threadify generated, validated or scheduled anything.

## Receipt

Save a receipt in the creator's private workspace that follows `workflow-receipt.v1` (`workflow_id`, `adapter`, `account_handle`, `action`, `approved_text`, `approved_text_sha256`, `status`, `timestamp`, `timezone`, `tool_path`, `fallback_used`). `tool_path` lists every tool called, in order, including a `get_connection_defaults` call that failed and sent you to the fallback; it is empty only when no tool was called. Every template has a `template_id`. Add the global auto-repost setting as the gate showed it and as each dispatch read it; the templates with their label, media decision and tired-check query, and per evidence post its first line, date, views, media type, part count, fill and whether its text was complete; the drafting yes and the draft ids saved; the check results per post, with the hook length and its limit, the energy reason and the fresh reader (who read it, its answer word for word and its verdict); per template its fresh-reader control (who read it, its answer word for word, its verdict and `after_tool_calls`, the number of `tool_path` entries made before it ran, which is never past the first `generate_content`) and any `fresh_reader_waiver` (`template_id`, `creator_words`, `at`; this run only); the schedule proposal with the live calendar total; and per post the state, fingerprint, idempotency key, returned scheduled post id and readback result. `status` is exactly one of: `awaiting_approval` (posts proposed, no yes yet; `approved_text` is empty), `nothing_to_approve` (every post excluded or blocked), `drafting_declined` (no drafting yes; `action` is `evidence_only`), `fallback_ready` (the local fallback; `action` is `local_packet` and `fallback_used` is true), `scheduled` (every approved post read back as scheduled), `partially_scheduled` (some approved posts scheduled, others blocked, failed or unverified) or `schedule_unverified` (no approved post read back as scheduled). In every other case `action` is `schedule_post`. Keep the creator's posts, numbers and receipts out of any public place.

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
