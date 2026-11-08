---
name: threadify-growth-loop
description: "Advanced workflow. Learn from mature Threadify post evidence, update a private hypothesis ledger, prepare tomorrow's four-proven/two-challenger queue, and save six drafts without scheduling them."
---

# Threadify Growth Loop

Use this skill when the owner asks for a self-improving content workflow, wants mature posts turned into tomorrow's drafts, or names the Threadify Growth Loop.

Read `references/workflow-readme.md`, `references/setup-adapters.md`, and `references/growth-loop.v1.json` before setup. Resolve scripts and references relative to this skill directory.

## Non-negotiable boundary

This workflow can read evidence, learn, prepare, and save drafts after the owner approves that standing draft-save scope. It cannot schedule or publish. There is no scheduling command in the engine. If the owner wants one post scheduled, hand off to the 30-Day Viral Vault approval path and show the verified account, exact copy, exact time/timezone, validation result, and action immediately before the provider call. Read the provider result back once.

Never expose credentials, private customer data, exact draft bodies in status receipts, or the whole private state file. Never infer a metric, attribution, source right, save, schedule, or publication. Unknown stays unknown.

## First setup

1. Verify the selected Threadify account by immutable ID and label. For balanced mode, verify the active offer. Confirm the timezone and six unique daily times.
2. Explain the fixed portfolio: two Greatest Hits, two Viral Vault, two My Vault; four proven and two challenger; two broad, two expertise, two personal; at least three structures including a listicle; at most one earned CTA.
3. Define at least two explicit cold-start hypotheses. Each needs one changed dimension, one value, engagement rate as its 72-hour metric, a unique priority, and completed safety and rights review. Label them candidates, not proven findings. This is what lets a new user prepare the first day immediately.
4. Show the owner that the loop may save all six drafts automatically, but will never schedule them. Obtain one explicit approval for that standing draft-save scope and the persistent six-hour runner.
5. Choose a dedicated absolute private state directory with owner-only permissions. Do not use a home directory root, shared folder, symlink, or cloud checkout.
6. Write `growth-loop-setup.v1` JSON, including `initial_hypotheses`, and run:

   `node scripts/growth-loop-cli.mjs setup --state /absolute/private-directory --input /absolute/setup.json --revision 0`

7. Configure a supported persistent route from `references/setup-adapters.md`. Native controls come first. An operating-system scheduler is allowed only after showing the exact executable, working directory, prompt, six-hour interval, timezone, device-on requirement, and pause command. Never add blanket permission-bypass flags.
8. A configured job is not verified. Run one real read-only invocation, read the job configuration and next run back, then run `configure-runner` with `growth-loop-runner.v1` proof containing the job ID, next run, invocation ID, device requirement, and pause command. Label every untested adapter `unverified`.

## Six-hour maturity run

1. Run `status`. If paused, stop. Refuse overlapping runs.
2. Verify the account and current connected capabilities. Find posts that newly crossed 72 hours or seven days; do not reread a checkpoint already in state.
3. At 72 hours, collect authoritative reach/engagement evidence and a matched baseline of at least five comparable posts. At seven days, use commercial evidence only when it has post-level attribution. Otherwise record attribution as unknown.
4. Each observation must name one hypothesis, one changed dimension, its value, source lane, template, format, goal, time band, evidence reference, published/check times, safety state, and rights state.
5. Run `scan` with the current revision. A hypothesis is promoted only after three comparable mature tests across two publication days, two positive results, median performance above baseline, no safety/rights issue, and no known commercial regression.
6. Show `display-hypotheses`. Do not claim causality or future performance; describe observed matched evidence.

## Prepare and save tomorrow

1. Use the 30-Day Viral Vault source and template rules. Rights-check every source and preserve the exact literal template pattern.
2. Keep four proven cards stable. Bind exactly one of the two highest-ranked eligible hypotheses to each challenger, changing only its named dimension. On the first day these can be reviewed candidates; after evidence matures, promoted or positive-testing hypotheses outrank untouched candidates, while a known commercial regression is ineligible.
3. Run `prepare-day` with the current revision. The public output is body-free and includes hashes.
4. For each of the six cards, run `begin-save` before calling `save_draft`. The returned operation carries the exact body, verified account, content hash, and idempotency key. Keep that original key for every retry of the same account/day/card; a different key is rejected.
5. If the operation is already `saved`, skip the provider call. For a replayed pending intent, inspect provider state before retrying; pending does not prove the earlier call failed. Call `save_draft` once. Then read the provider result and run `reconcile-save` with an authoritative matching account, provider draft ID, idempotency key, and content hash. If the result is ambiguous, inspect provider state before any retry.
6. Run `display-run --date YYYY-MM-DD`. Report six reconciled draft saves, any unknown result, the next six-hour run, and the pause command. Do not schedule.

## Operator commands

- `setup`, `scan`, `prepare-day`, `begin-save`, `reconcile-save`, and `configure-runner` require `--state`, `--input`, and the current `--revision`.
- `status` and `display-hypotheses` require `--state`.
- `display-run` requires `--state` and `--date`.
- `pause` and `resume` require `--state` and the current `--revision`.

Use `threadify-workflows growth-loop ...` from the package or `node scripts/growth-loop-cli.mjs ...` inside the installed skill.

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
