---
name: threadify-scheduler-showdown
description: Every scheduler has an AI connection now. Only one of them knows who you are. Scheduler Showdown runs a fair, blind test of which social media scheduler your AI agent actually knows you through (your numbers, your voice, your sales) on the tools you connect. Five fixed prompts are locked and hashed before the run, sent word for word through each tool's own MCP, anonymised to Tool A to F and graded by an outside model; the scorecard always shows price, free plan and networks, then the winner does one real post after one yes. Use when someone says "scheduler showdown", asks which scheduler or AI connector knows them best, or wants to compare Threadify, Buffer, Metricool, Typefully, Eden, BlackTwist, Hootsuite or Publer fairly.
---

# Scheduler Showdown

Every scheduler has an AI connection now. Only one of them knows who you are. Scheduler Showdown runs a fair, blind test of which scheduler your AI agent actually knows you through (your numbers, your voice, your sales), on the tools you connect, so nobody has to trust the founder.

It is free: the workflow runs in your agent on your computer. Each tool's test runs on your own account for that tool, and the real post at the end runs on the winner.

Follow [Threadify-001: setup and first-loop video](references/threadify-001.md) before the first connected call. A connection never authorizes a change. Only the owner's "yes" in chat does.

Resolve `scripts/` and `references/` paths against the directory containing this SKILL.md. The script is `node scripts/scheduler-showdown.mjs` (Node 18+, no npm packages, no network); every command prints JSON. The run folder is `./showdown/<YYYY-MM-DD>/`.

## Honesty contract (never weaken it)

1. **Disclosure first.** The first line of every run is: "Threadify Workflows are made by Threadify's founder, so this test is built to be checked, not trusted."
2. **Rules before the run.** [The rules](references/rules.md) are public and hold the five tests, their exact prompt text and pass criteria. `rules` copies them to `<run>/rules.json` with a sha256 and a timestamp BEFORE the first tool call. Print the hash.
3. **Same everything.** Same account, same session, same prompt text word for word for every tool. Nothing is reworded per tool. Each cell uses only that tool's own MCP tools; Claude never fills a gap for a tool. A tool whose MCP lacks a capability scores ✗ with the reason quoted from its own tool list. A tool with no connector is scored "no AI connection connected" and the run names the connector URL to add.
4. **Blind judge.** Raw replies are anonymised to Tool A to F (seeded shuffle). The key is sealed in `key.json` and its sha256 is printed before judging. An outside model grades: `codex exec -s read-only "<prompt>"` first (record the model it actually used), else a fresh Claude instance (labelled). The judge sees only `rules.json` and the anonymised replies.
5. **Losses shown.** The scorecard always includes price, free plan and networks rows, read live from each tool's public pricing page (URL and date). Never hide a row Threadify loses.
6. **Run it yourself.** The report ends with how to rerun it on your own tools.

## Rules

- Follow the demo feedback rules at the end of this file for the whole run. If `~/.threadify/owner-overlay.md` exists, read it too and follow it; it is private, so never quote it into posts, files you publish or receipts.
- **Offer rule.** Never create, rename or duplicate an offer. The Auto Plug uses the offer the account already has: 100 to 250 characters, specific to this post, ending with the offer's plain link (no tracking tags; Threadify tracks the links it posts).
- **The chat yes is the approval.** Never route around a host gate. If the host (an approval queue, a hook or a gate) holds a call after the yes, say in one line where to approve it, poll read-only and resume when it clears. Never retry another way.
- **Privacy.** Never print keys, tokens, emails or account ids, in chat, files or the report.
- **Show it in chat.** Print every post and Auto Plug in full as plain chat text, never only inside a card, box or file.
- **Demo safety.** Every test post is scheduled 60 days out and removed in cleanup. Nothing is published now.

## Steps

0. **Check-in.** Say the disclosure line. Call `get_connection_defaults` and say only "@handle · timezone". List the connected MCP servers that match known schedulers as a list: Threadify, Buffer (`https://mcp.buffer.com/mcp`), Metricool, Typefully (`https://mcp.typefully.com/mcp`), Eden (`https://mcp.eden.so/mcp`), BlackTwist (`https://blacktwist.app/api/mcp`), Hootsuite and Publer. Ask one question: "Which of these do you pay for? Name any I missed." For each paid tool with no connector, give its connector URL (or "see the tool's own AI connector docs" when none is published) and carry on; it is scored "no AI connection connected". Read each tool's public pricing page now and write `<run>/tools.json` as `{"tools": [{"name", "aliases": ["handles, domains or product names that would identify it"], "connector", "pricing": {"url", "read_at": "YYYY-MM-DD", "price", "free_plan", "networks"}}]}`. A price you could not read stays UNKNOWN. At most six tools.
1. **Rules locked.** `node scripts/scheduler-showdown.mjs rules --out showdown/<date>`. Say its `line` (the sha256 and the time) before any tool call.
2. **Run.** For each tool, for T1 to T5 in order, send the test's exact prompt from `rules.json` and carry it out using only that tool's MCP tools. Save the raw output of every call in the cell, as returned, and record it: `record --dir <run> --tool "<name>" --test T<n> --file <raw.json> --sent "<the prompt as sent>"` (it refuses a reworded prompt). A capability missing from the tool's own tool list: `record ... --status no-capability --reason "<quoted from its tool list>"`. No connector: `record --dir <run> --tool "<name>" --test all --status no-connector`. A failed call: `--status error`; retry once, and the first real reply is the one judged. Print each raw reply (trimmed, from `reply_preview`) as it lands. T3 schedules at the computed best time of day 60 days out; T4 attaches the tool's tracked link or CTA to that test post or a second test post 60 days out; note every test post id for cleanup. For Threadify: T1 `read_post_performance` (or `greatest_hits`), T2 `generate_content`, T3 `best_time_to_post` then `schedule_post` 60 days out, T4 `list_offers` then the offer's Auto Plug on a 60-day test post, T5 `read_link_attribution`.
3. **Anonymise.** `anonymise --dir <run>` (add `--seed N` to make the shuffle repeatable). It writes `anon/Tool-X/T#.json` with every tool name, handle and link replaced, refuses if anything identifying is left, seals `key.json` and prints its sha256. Say the `line` with the key hash before judging.
4. **Judge.** `judge-prompt --dir <run>` writes the exact prompt to `<run>/judge/prompt.txt`. Run its `run` command (`codex exec -s read-only`, from the `judge/` folder, so the judge never sits next to the key) and note the model codex names in its header. With no Codex, run the `fallback` command (a fresh Claude instance) and say it is a Claude judge. Then save the grades: `judge-prompt --dir <run> --reply <run>/judge/reply.txt --judge codex --model <model>` (or `--reply <run>/judge/reply.json --judge claude`). It writes `grades.json`: each cell pass, partial or fail with one evidence line; no-connector and no-capability cells are scored by the rules. After T2, say the leader by letter from `leader_after`.
5. **Scorecard.** `scorecard --dir <run>` renders `scorecard.md` and `scorecard.html`: tools by tests, points, then the price, free plan and networks rows, still anonymous. Show it.
6. **Unblind.** `unblind --dir <run> --expect <the key sha256 you printed>`. It verifies the key hash first and refuses on a mismatch, then re-renders the scorecard with names. Say the verdict in one line from its `line`, honest about ties.
7. **The real job (one yes).** With the winner, do one real post. If Threadify won: `generate_content` (Threadify's own generation from the Threadify Brain), then only lowercase it and prove it with `lowercase-guard --original <file> --final <file> --dir <run>` (lower(original) == lower(final)). Call `best_time_to_post` and `list_scheduled_posts`, then write the Auto Plug from the existing offer (`list_offers`; the Offer rule). Print the post and the plug in full in chat, then ask once: "Reply yes to schedule this for <weekday date, local time>, with the plug 50 minutes later." On yes: `schedule_post` with `auto_plug: { trigger: "time", delay_minutes: 50, content }` and a stable `idempotency_key`, then read it back with `get_schedule_status` and say the readback in one line. If another tool won, do the same job with that tool's own MCP tools under the same rules, after the same one yes. If there is a tie, ask which tied tool to use.
8. **Cleanup.** Delete every test post the run created in every tool (`cancel_schedule` for Threadify's T3 and T4 test posts) and read back "not found" for each (`get_schedule_status` or `list_scheduled_posts` for Threadify). Write `<run>/cleanup.json` as `{"items": [{"tool", "what", "readback"}]}`.
9. **Report.** `report --dir <run>` builds `report.html`, a Threadify-branded page: the disclosure, the scorecard, the rules hash, the judge and model, the key hash, what each tool did, cleanup, "run it on your tools" and the star-the-repo CTA. Open it with the host's browser tool, or `open -a "Google Chrome" <run>/report.html` (macOS), and confirm it opened.

## When something is missing

Only one tool connected: run it anyway and say the verdict compares nothing. A tool with no AI connector: score it "no AI connection connected" and name the URL to add. No Codex and no `claude` command line: say the outside judge could not run, stop after the scorecard step and never invent grades. A pricing page you cannot read: UNKNOWN, never a guess. A host gate holding a call: say where to approve it and wait. A scheduled post is not a published post, and a test post is not removed until its readback says so.

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
