---
name: threadify-ai-content-forensics
description: Reverse-engineer a bounded creator corpus into evidence-linked content rules, copyable templates, and one validated ten-post thread. Use for AI Content Forensics or creator-content pattern analysis.
---

# AI Content Forensics

Read `references/workflow-readme.md`, `references/ai-content-forensics.v1.json`,
and `references/upstream-attribution.md`. Use the bundled Node 18+ scripts. This
workflow is read-only and draft-only: it never saves, schedules, publishes, or
claims that a pattern caused performance.

## Start or resume

Confirm the target creator, destination platform, the creator's permission or
public-source basis, and the exact bounded sources. Prefer an owner-approved local
export. For a connected Threadify account, verify the account before current
read-only calls. Never infer availability from source code or a historical tool
name.

If the user chooses Scrape Creators, use only a current host-supplied MCP, skill,
or official CLI whose key is already configured outside this package. The bundled
local engine performs no network calls. Do not echo the key, pass it in arguments,
collect private/login-only material, or silently broaden the sample. Normalize
only the bounded read result and record vendor, endpoint, query, requested limit,
observation time, cache/freshness information, and gaps. An unavailable connector
routes to local export; it does not weaken the evidence gate.

When the key is stored in 1Password, let the host resolve an `op://` secret
reference only for the connector process at execution time. Never copy the secret
value into chat, shell history, an environment file, the normalized packet, logs,
receipts, or release artifacts. Record only that the auth mode was `byo_key` and
whether the bounded provider read succeeded.

## Build the case file

Normalize local JSON, JSONL, or CSV exports with
`scripts/ai-content-forensics-import.mjs`, then combine the returned source and
items with any already-normalized host read results in one input packet for
`scripts/ai-content-forensics-cli.mjs`. Keep each platform's metrics in its own
namespace. Deduplicate platform/native IDs first, then same-creator normalized
bodies. Preserve zero and missing metrics but exclude unavailable values from
comparisons. Inspect the import limitations and stop on a wrong creator,
platform, rights basis, or unexpectedly empty/partial export.

Comparative findings require at least 20 unique metric-valid items inside one
platform and format family. Smaller or incomplete groups may support descriptive
patterns only. Never create a universal engagement rate, compare unlike raw
metrics, label correlation as causation, or predict reach, virality, followers,
leads, or sales.

Research the corpus across five portable axes:

1. opener or title;
2. proof and specificity;
3. structure and pacing;
4. media or format use;
5. CTA or next action.

Create at least ten finding candidates. Each candidate needs one distinct claim,
plain-language explanation, portable `copy_this` template, category, evidence
IDs, and a limitation. Choose exactly seven that cover all five axes; keep
runner-ups in the audit. A copied phrase is not a portable template. Preserve ideas and
structures while excluding source-specific names, stories, claims, and wording.

## Produce the exact package

The engine outputs exactly ten posts:

1. evidence-led hook;
2–8. seven numbered findings, each ending with `copy this:`;
9. one bounded action plan;
10. one natural CTA.

Every post must fit the destination platform limit. The engine also returns five
constitutions, the insight audit, coverage/limitations, and a body-free receipt.
With `--visuals`, it writes ten evidence-bound SVG and HTML cards to the chosen
private output directory. Visual rendering is optional; a missing renderer must
not invalidate a verified thread.

Show the complete case file and exact thread for owner review. Say “prepared
locally,” not saved or published. Any later provider draft, schedule, publication,
or feedback share requires its own current capability, exact approval, and
authoritative readback outside this workflow.

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
