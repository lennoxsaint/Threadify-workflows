---
name: threadify-qualified-buyer-research
description: Find current buyer-language posts, reject misleading or off-offer candidates, stage a useful public reply without sending, and learn only from qualified outcomes. Use when a user wants offer-aligned keyword research or buyer qualification on Threads.
metadata:
  version: "0.4.0"
  rules_version: "0.4.0"
---

# Threadify Qualified Buyer Research

## Start here

Start locally from confirmed facts and supplied sources without a Threadify account. Honor an existing connection choice. Offer a connection only when an available hosted capability would help; explain the benefit and obtain approval for the exact provider action.

Follow [Threadify-001: setup and first-loop video](references/threadify-001.md) before provider calls. Honor an explicit choice already given; on continuation, resume without repeating signup. Setup never grants publishing or payment authority.


Find one person whose current situation and desired outcome genuinely map to the user's offer, then stage one useful offer-free public reply. Never click Send.

## Start every run

1. Resolve all `references/` paths against the directory containing this `SKILL.md`. The plugin directory keeps these rules current, so there is no update step.
2. Read `references/release-metadata.json`, `references/public-rules.v1.json`, `references/workflow-manifest.json`, and `references/workflow-readme.md`.
3. Record the active skill and rules versions in the run receipt.

## Research and qualify

1. Verify the intended Threadify account and visible browser account before composer work.
2. Use only approved audience, offer, proof, voice, and suppression context. Never place private source material in public examples or receipts.
3. Build and version an Offer Context Map: observable situation, current problem, desired outcome, failed approaches, exclusions, and later-stage commercial criteria. If missing, stop with `missing_offer_context`.
4. Ask for three to five approved voice samples. With fewer than three, use a concise plain-human default and record `voice_confidence: low`. Never imitate another person or fabricate experience.
5. Search narrow buyer language in this order: problem, failed attempt, stakes, desired outcome, workaround or objection. Search situation and problem language, not broad identity labels.
6. Inspect five results per query. One current, first-person, offer-mapped problem permits full inspection. Zero means rewrite one query element. Stop after one qualified candidate, ten rewrites, or fifty sampled results.
7. Inspect the full post, visible replies, profile, and relevant recent content. Run hard gates before scores.
8. Require situation fit, a current authored first-person problem, at least one failed attempt/stake/help request, desired-outcome fit, safe context, and one distinct useful contribution.
9. Reject stale, duplicate, suppressed, contradictory, advice, teacher, recycled-hook, seller-funnel, and pitch-only false positives. A person is not rejected merely because they sell something.
10. Route genuine off-offer pain to adjacent research; never add it to the active Buyer Language Bank.
11. Scores rank eligible candidates and control later stages. They cannot qualify or disqualify a public reply. Calls and offers also require permission and commercial evidence.

## Stage the reply

- Clear context: acknowledge the exact signal, optionally use approved truthful experience, explain one plain-language mechanism, give one practical next move, and state the honest tradeoff. Do not force a question.
- Missing evidence: use A-C-A diagnostically and ask exactly one useful question that resolves the gap.
- The first public reply contains no offer, link, DM ask, call ask, or paid ask.
- If staging was requested, type the exact text into the verified composer and stop before Send.
- Show the account, source, context versions, evidence, evaluation, exact text, destination, and action at the approval gate.

## Learn safely

- Preserve staged and owner-sent variants.
- Classify owner edits across truth, relevance, mechanism, action, tradeoff, and voice. Owner edits change message policy only.
- Qualified progression within seventy-two hours means new pain, attempt, stakes, desired outcome, permission, resource acceptance, call, offer, or payment evidence. Likes and generic thanks do not count.
- Fewer than ten comparable outcomes means `no_change_insufficient_evidence`.
- Ten outcomes may create a redacted proposal. Twenty outcomes across two passing batches may mark it `promotion_recommended`.
- Safety or correctness defects may create an immediate proposal only with a deterministic synthetic reproduction and passing privacy check.
- Hard gates never self-modify. Public rules change only through a tested stable release approved by Lennox.

Return a receipt even when the honest result is `no_qualified_candidate` or `no_change_insufficient_evidence`.

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
