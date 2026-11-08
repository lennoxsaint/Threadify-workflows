---
name: threadify-market-to-pipeline
description: Turn one offer and one bounded market into a private qualified pipeline, exact permission-aware actions, seven de-identified posts, and body-free receipts using Threadify signals and optional Treg research.
metadata:
  version: "0.1.0"
---

# Market to Pipeline

Read `references/workflow-readme.md`, `references/market-to-pipeline.v1.json`,
`references/treg-attribution.md`, and `references/threadify-001.md`. Use the
bundled Node 18+ scripts. The local engine makes no network call and sends nothing.

## Freeze the run

Confirm one offer version and one bounded market. Default to a seven-day window,
at most 50 normalized signals, at most 10 selected prospects, and a spend cap no
greater than US$3.00. Narrow the offer by observable situation, current problem,
desired outcome, ideal customer, and exclusions. Record jurisdictions before
contact research.

Verify the intended Threadify account before current owned-account reads. Discover
capabilities at runtime and record actual provider, endpoint or tool, observation
time, requested and returned coverage, completeness, rights basis, and limitations.
Source inspection is not deployment, consent, delivery, response, or performance
proof.

## Combine Threadify with Treg

Use Threadify for current owner-controlled buyer signals and content context when
available. Use Treg only through a current host-supplied official CLI or MCP. Search
the catalog by the job, inspect the current record and displayed price, and obtain
confirmation before a metered call. Never select a paid endpoint silently.

Spend in this order: discovery, company fit, person, contact. Stop before person
or contact enrichment unless the company already passed the offer-fit gate. Keep
the cumulative quoted and charged total within the confirmed run cap. Record an
opaque call identity and balance/call readback, but never a Treg token, provider
credential, or raw private payload in a public artifact.

If Treg is unavailable, use approved local/public evidence and label the coverage
gap. Do not weaken qualification or permission gates to make the demo succeed.

## Qualify without manufacturing consent

Deduplicate stable company plus destination identities. Route no more than ten
candidates to `ready_for_approval`, `research`, or `rejected`.

- Warm: require explicit current offer-relevant interest. A private channel also
  requires explicit permission for that exact channel.
- Cold B2B: require offer fit, current relevant role, recently verified work
  contact, documented jurisdiction-appropriate lawful basis, sender identity and
  contact, unsubscribe, and suppression checks.
- Treat `verified email` as contact evidence only. It is never consent.
- Scores rank eligible records. They never override a hard gate, exclusion, or
  suppression entry.

Apply current law, platform terms, and user policy. The workflow is not legal
advice. When uncertain, stop at `research` and name the missing evidence.

## Build the private package

Normalize only the bounded read results into the schema, then run:

```sh
node scripts/market-to-pipeline-cli.mjs build --input INPUT.json --output-dir ABSOLUTE_PRIVATE_DIRECTORY
```

If the installed script is imported rather than executable, invoke the repository
CLI form from `references/workflow-readme.md`. Keep private JSON, CSV, and HTML
outside public repositories and release artifacts.

Create exactly seven posts from de-identified aggregate themes. Every post needs
theme evidence and a limitation. Reject campaign text containing a prospect name,
company, contact destination, private source body, unsupported result, or implied
performance guarantee.

## Review and act

Show one action at a time with verified account, destination, lane, current role,
evidence, every gate, exact copy, action hash, idempotency key, sender identity,
unsubscribe path, suppression result, and consequence. The binding includes the
account, target, evidence hashes, permission/compliance state, channel, and copy;
changing any of them requires a new build or approval.

Immediately before an authorized provider action, re-read the exact account and
pass that fresh identity proof while persisting `attempt_pending`. Then call the
provider once. Reconcile through an authoritative readback as `succeeded`,
`confirmed_not_sent`, or `unknown`. Unknown blocks retry but the same attempt can
later be resolved by decisive readback. Never infer success from a timeout, UI
disappearance, or source code. Refresh the body-free receipt after every state
transition so it reports `false`, `null` for pending/unknown, or `true` only from
authoritative reconciliation.

Return a body-free receipt even when no candidate is ready, Treg is unavailable,
or every action remains draft-only. Say `prepared privately`, not generated leads,
sent, replied, booked, or sold.

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
