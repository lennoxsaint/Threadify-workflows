---
name: threadify-greatest-hits-runway
description: Prepare a reviewed runway of existing best-performing posts, check stale facts and calendar conflicts, and schedule only after exact approval. The episode 17 workflow.
---

# Threadify Greatest Hits Runway

Start locally from confirmed facts and supplied sources without a Threadify account. Honor an existing connection choice. Offer a connection only when an available hosted capability would help; explain the benefit and obtain approval for the exact provider action.

Follow [Threadify-001: setup and first-loop video](references/threadify-001.md). Honor an existing choice; setup never authorizes scheduling.

Start from a request such as: “Prepare my greatest hits runway for the next seven days, three posts per day. Show me the plan before scheduling.” Do not promise growth, a full calendar or a fixed number of available posts.

1. Ask only for missing planning choices: intended account, horizon and posts per day. Read current tool schemas. Call get_connection_defaults first, verify the owned account, timezone and scopes, then list_scheduled_posts for the requested window. If the calendar response is incomplete, resolve coverage before approving slots; do not treat a truncated list as an empty calendar.
2. Call plan_greatest_hits_runway with the selected account, runway_days and posts_per_day. Current schema allows up to 365 days and 10 posts per day; verify these limits in the client rather than extrapolating from the episode. The planner prepares a plan; it does not schedule. Its current behavior skips occupied days. Reconcile the live queue slot by slot: preserve each existing item and review remaining positions explicitly, including dates omitted by the planner. Do not infer calendar state from draft labels, change the horizon or silently substitute shorts for missing threads. A capability or tier denial produces a local/manual fallback, not repeated denied calls.
3. Hydrate each source into its full ordered thread chain and per-part media before review; an opening-hook row is insufficient. If hydration is unavailable, leave an honest gap. Review the full text and required media. Apply the owner's configured opening-like threshold, family cooldown, format mix and spacing; never hardcode one creator's policy. Require dated performance and complete family history, exclude duplicate families including existing queued posts, and keep unknown evidence blocked. Check old ages, dates, “today,” prices, membership counts, availability, events, links and other time-sensitive claims against current owner-approved facts. Ask for missing facts or omit the post. Never calculate a current claim from unsupported memory. Show every proposed copy change; do not silently “refresh” someone's past result into a new result. Preserve source attribution privately.
4. Produce a concise review table: source reference, exact proposed text, media, local date/time with timezone, changed claims and reason, and blockers. Separate “proposed” from “approved.” Instruct the user to edit or approve individual rows or the exact complete plan. A partial plan is useful; unavailable slots are not failed publications.
5. Immediately before scheduling, recheck calendar conflicts, account and media. Run validate_post against each exact approved payload. Any copy, media or time change invalidates that row's approval and validation. Bind explicit final approval to the exact plan revision and each account/source/revision/full chain/media/time/action fingerprint. A chat approval of that exact packet remains valid for unchanged rows; do not ask again for the same approved action. Even an autonomous connection does not override this workflow's repository approval contract.
6. Call schedule_post only for approved, validated, conflict-free rows, using current schemas and a supported stable idempotency key bound to account, source, payload, media and time. If the provider does not expose an idempotency field, do not invent one: persist the local intent, issue at most one write and reconcile an uncertain result before any retry. Persist intent and returned scheduled_post_id in a private receipt. On an uncertain result, reconcile that intent using status/calendar before retrying with the same key; never generate a new key to force a second write. Continue independent approved rows after a clear failure, but isolate ambiguous rows.
7. Use get_schedule_status and list_scheduled_posts to verify each scheduled row's account, text, media and time. Return counts and per-row states: proposed, excluded, blocked, approved, scheduled_confirmed or schedule_unverified. Scheduling is not publication; use actual post receipts for later publication proof. Do not infer followers, clicks or sales from a schedule.

## Local fallback

Without a working connector or entitled planner, ask for an approved export of past posts and their dated performance plus the intended time window. Review and prepare the same table locally, clearly labelled manually selected. Unknown performance stays unknown. Do not claim the hosted ranking engine ran or fabricate posting-time analytics. If calendar coverage is unavailable, leave slots tentative and supply manual review steps.

## Receipt

Save the source snapshot time, account, timezone, selected window/volume, duplicate exclusions, factual edits, exact approved rows, validation results, idempotency keys, returned IDs, the readback result and the fallback reason in the owner's private workspace. Keep these details out of public examples. No recurring automation or immediate publishing is created by this skill.

## Portable review and local checks

Use the repository CLI `threadify-workflows greatest-hits review --input input.json --output-dir new-private-directory` when a hosted review hub is unavailable. The [local review contract](references/local-review.md) describes the input, a synthetic example and checks. A standalone skill installation may not include the CLI; use the same contract to prepare a manual review packet instead. Never imply the local helper ran if it is unavailable.

The export is private, read-only and has no provider writes, remote media loads or approval buttons. It shows full copy, each media reference, changed claims, exact timestamps and unavailable receipt labels. Open the output and check phone readability before handing it off. Keep personal input/output outside any public checkout; never commit or upload the owner's corpus, receipts or review pages. Request sharing approval separately. Edits belong in the owner chat and must regenerate the canonical packet. Browser edits or copied pages cannot grant approval.

Immediately before action, refresh the complete calendar and revalidate every approved payload against current schemas. Resolve live conflicts under the owner's spacing and buffer policy; never move an approved time silently. A local proposed row is not a provider validation pass. After a write, confirm account, ordered full chain, all media and time from live status/calendar. Missing, ambiguous, truncated or hook-only readback remains `schedule_unverified`, never a reason for a blind retry. Keep the provider ID and private intent receipt together.

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
