---
name: threadify-anti-spam-lead-desk
description: Turn current public Threads comments or a bounded cold-research fallback into a five-card anti-spam Lead Desk and one unsent public-reply draft. Use when the owner wants to find warm signals without automated outreach.
---

# Threadify Anti-Spam Lead Desk

Read `references/threadify-001.md`, `references/workflow-manifest.json`, `references/workflow-readme.md`, and `references/chatgpt-template.md` from this skill directory.

Begin by confirming a real offer and the correct connected Threads account. Discover the host's current comment/reply-read capability before saying the warm-inbound route is available; never hard-code a tool name or simulate a read.

For warm inbound, ask the owner to select one to three owned posts. If the owner explicitly requests an account-wide period, use the discovered read capability to scan that bounded period instead and report coverage limits; a `days` filter may select posts by publication date, not all comments written in the period. Retain only explicit, offer-relevant help or problem signals. Reject generic praise, vague interest, seller funnels, advice posts, stale evidence, duplicates, already-replied comments, and anything whose public context cannot be re-inspected. Open each retained profile in the authenticated Threads browser and record current URL and inspection timestamp. Do not scrape or automate browser navigation. If there are no unreplied comments and the owner asks for examples, label historical comments as filter examples, not pending leads or send targets.

If no warm candidate is Ready, invoke `threadify-qualified-buyer-research` once. Reuse its confirmed Offer Context, narrow-query order, browser inspection, and five-result stopping rule. Do not convert cold evidence into a claim that someone commented or asked for help.

Create no more than five cards: Ready, Research, or Reject. Every card must include route, source URL and timestamp, profile URL and timestamp, reinspection state, and the limitation `current_public_context_only`. Draft at most one useful public reply, with exact text and destination, marked `draft` and `send_performed: false`. Desk creation does not DM, schedule, or send, and it does not claim lead, booking, sale, or revenue outcomes.

Use the installed exact-release CLI at `node ~/.threadify-workflows/current/cli/bin/threadify-workflows.mjs lead-desk < input.json`; when `THREADIFY_WORKFLOWS_HOME` was set during installation, resolve `current/cli/bin/threadify-workflows.mjs` below that state root instead. In a source checkout, use `node bin/threadify-workflows.mjs lead-desk < input.json`. It produces JSON with Markdown and a three-lane HTML preview. For an editable review page, run `lead-desk serve --input /absolute/input.json --state /absolute/private/review.json`, open its printed loopback URL, and keep the server running. The page saves the exact edited reply to private local state; clicking **Mark Final for Review** saves its final text, SHA-256 hash, and revision. After the owner says to send, read `lead-desk status --state /absolute/private/review.json` and require `status: final_for_review`. Recheck the account, exact target, pending reply state, safety, and anti-slop gate before any separately authorized live send; re-read the same final revision immediately before sending. If the text changes, final status is revoked. Never infer final approval from an exported HTML file, browser local storage, or a stale screenshot. A missing capability or no viable candidate is a valid, explicit outcome.

The review page and CLI do not send. A final mark alone is not send authority; the owner must separately request sending, then the host must use a verified live delivery route and provider readback. Do not DM from this skill. If the owner wants to turn a Ready card into a private next step, hand off to `threadify-agree-next-step`; that workflow separately enforces recipient interest and channel permission.

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
