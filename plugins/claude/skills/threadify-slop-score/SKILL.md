---
name: threadify-slop-score
description: Can you tell your own Threads posts from AI slop? Slop Score puts five of your posts from the last 30 days next to five plain-AI twins on the same topics, shuffles all ten and has you swipe each one blind - human or slop. Then it reveals your hit rate and a Slop Score from 0 to 100 for every card with the exact flagged words (Unslop's four tells - hedging, AI phrases, corporate voice, over-formatting), has Threadify rewrite the worst twin's topic from your Brain, re-scores it and schedules it with an Auto Plug from your existing offer after one yes. Use when someone says "slop score", asks whether their posts sound like AI, or wants a human-or-slop test.
---

# Slop Score

Can you tell your own posts from AI slop? Five of your real Threads posts meet five plain-AI twins on the same topics. You swipe all ten blind. Then every card gets a Slop Score, Threadify fixes the worst one from your Brain, and one post gets scheduled after one yes.

Input: the connected Threadify account only. Ask nothing to start. Output: a scored card and one scheduled post.

Follow [Threadify-001: setup and first-loop video](references/threadify-001.md) before the first connected call. A connection never authorizes scheduling. Only the owner's "yes" in chat does.

Resolve `scripts/` and `references/` paths against the directory containing this SKILL.md. The script is `node scripts/slop-score.mjs` (Node 18+, no npm packages, no network); every command prints JSON. The run folder is `./slop-score/<YYYY-MM-DD>/`. Run every command yourself; never hand the owner a terminal command.

## Rules

- Before the first step, read the demo feedback rules at the end of this file and follow them for the whole run. If `~/.threadify/owner-overlay.md` exists, read it and follow it too; it is private, so never quote, publish or upload it.
- **Threadify writes every real post.** The post and its Auto Plug come only from `generate_content`. The agent never writes or edits them and never calls `edit_draft`. The only allowed change is lowercasing, proper nouns kept, proven by the casing guard: `lower(original) == lower(final)`. If the guard fails, stop and show Threadify's original unchanged.
- **The twins are the only text the agent writes**, and only as test cards. Each one is labelled "AI twin · plain Claude, no context" at the reveal. Twins are never posted, saved or scheduled.
- **Own posts only.** Read the owner's own posts from `read_post_performance`. Never use, quote or score anyone else's posts.
- **One scorer.** Every Slop Score comes from `scripts/slop-score.mjs`, which uses Unslop's scorer (`scripts/hedge_gate.mjs`, copied unchanged from Threadify Unslop). Show its numbers and flagged words exactly. Never add a phrase it did not flag and never change a score.
- **Unknown stays unknown.** Never invent a metric, a count or a join number. No predictions: never say a post "will" get views.
- **Plain words.** Viewer-facing narration has no hedges and no jargon, and uses " - " or "·", never em dashes. Never reuse a hook within the batch: `deal` and `fix` refuse a repeated hook.
- **Offer rule.** Never create, rename or duplicate an offer. The Auto Plug sells the offer the account already has (`list_offers`): 100 to 250 characters, ending with the offer's plain link, no tracking tags (Threadify tracks the links it posts).
- **Show it in full.** Print the post and the Auto Plug in full as plain chat text before asking for the yes. Never only a file path, a summary or a card.
- **The chat yes is the approval.** Nothing is scheduled without it. If the host (an approval queue, a hook or a gate such as a Video Queue gate) holds the schedule call after the yes, say in one line where to approve it, poll read-only (`get_schedule_status` or `list_scheduled_posts`) and resume when it clears. Never route around it or retry another way.
- Never publish now. Never print keys, tokens, account ids or emails.

## Steps

1. **Read your posts.** Call `get_connection_defaults` and say only "@handle · timezone". Call `read_post_performance` with `days: 30`, `include_full_text: true` and `sort_by: "recent"`, with a `limit` above `total_matched`; page until every post is read. Save the pages and run `candidates --dir <run> --file <pages.json>`. It keeps the owner's own posts from the last 30 days and drops reposts. Pick 5 on 5 different topics, name each topic in two to four plain words, and say "I read your last 30 days and picked 5 posts on 5 different topics." Do not show the posts yet: the swipe stays blind.
2. **Write the AI twins.** For each topic, write what plain Claude writes for the exact prompt "write a Threads post about <topic>" in a fresh chat with no Brain, no context and none of the owner's posts. Write it the way default Claude answers that prompt: do not add tells on purpose and do not scrub them. Each twin is labelled "AI twin · plain Claude, no context". Write `<run>/cards.json` as `{"handle": "@handle", "posts": [{"id", "topic", "text"}], "twins": [{"topic", "text"}]}`, with each post's text exactly as Threadify returned it.
3. **Blind swipe.** Run `deal --dir <run> --file <run>/cards.json`. It checks the batch (5 own posts from the candidates, 5 different topics, one twin per topic, no reused hook), shuffles the ten cards and stores the seed in `deck.json`. Say its `line`. Then show the cards one at a time from `blind`, in order: print "Card N of 10" and the full card text as plain chat text, then ask one single-choice question with two options, "human" and "slop" (AskUserQuestion in Claude; the host's single-choice prompt in Codex; elsewhere ask for a one-word reply). Never say which is which, never hint, and never comment on a card until all ten are answered.
4. **Reveal.** Run `reveal --dir <run> --guesses <the 10 answers in card order, comma separated>`. Print its `card` exactly as returned: "You got X of 10 right", a Slop Score from 0 to 100 for every card with the exact flagged words, and the average for "your posts" against "AI twins". Then say the headline in one line from those numbers.
5. **Fix the worst one.** Take `worst_twin` from the reveal. Call `generate_content` with `contentType: "short-form"`, `strict_facts: true`, no offer, and `inputText` set to the same prompt the twin answered: `worst_twin.prompt`. Same prompt, now written from the owner's Brain. Keep Threadify's exact text and `draft_id`. Save the text to `original.txt`. Threads copy is lowercase, so lowercase it keeping proper nouns (`node scripts/casing-guard.mjs lowercase`, JSON on stdin) and save `final.txt`; if it is already lowercase, `final.txt` is the original. Run `fix --dir <run> --original original.txt --final final.txt --keep "<proper nouns>"`. It runs the casing guard, re-scores the post with the same scorer and prints "slop NN -> NN". On a guard FAIL, stop and show the original. If it reports a reused hook (the Brain often copies the owner's own openers), call `generate_content` again with the same prompt plus one line: `Open with a different first line than: "<the reused first line>".` (three calls at most); if it still fails, say so and stop. Print the updated `card`.
6. **Auto Plug from your existing offer.** Call `list_offers`. Use the one offer that fits the post; with several, pick the best fit and state the choice in one line. With none, say so and offer to schedule the post without a plug. Call `generate_content` with that `offer_id`, `contentType: "short-form"`, `strict_facts: true` and `inputText`: "Write only the Auto Plug reply that follows this post: <final post>. 100 to 250 characters. One line from the post's subject to <offer name>, one line of the pain, the offer as the fix, then end with exactly this link and nothing after it: <offer link>. No hashtags, no tracking tags, no hedges." Lowercase it only, with the casing guard (`guard --original --final`), then run `plug-check --link "<offer link>" --file plug.txt`. On FAIL, call `generate_content` again with the check's exact `reasons` (three calls at most). If it still fails, show the reasons and ask whether to schedule the post without a plug or stop.
7. **One yes.** Call `best_time_to_post` (owner's timezone) and `list_scheduled_posts`. Pick the next best slot at least 60 minutes from now with no scheduled post within 90 minutes, and state it in one line. Send one message:

```text
Slop Score · @handle · <timezone>
Post (<weekday date, local time>) · slop <NN> · <unchanged | guard PASS>
<exact final post text>
Auto Plug (15 min after) · <characters> characters · check PASS · <unchanged | guard PASS>
<exact plug text, every line as written>
Offer: <offer name> · <offer link>
Reply "yes" to schedule this post with its Auto Plug. Nothing publishes now.
```

8. **Schedule on yes.** Only on an explicit "yes": call `validate_post` on the post and on the plug. On a validation issue, say it in one line and stop. Then call `schedule_post` once with `scheduled_at` (local time, no offset), `auto_plug: {content: <exact plug text>, trigger: "time", delay_minutes: 15}` and a stable `idempotency_key` (account, slot and the post and plug hashes). Unchanged text: pass `draft_id` and `content_type: "short-form"`. Lowercased text: pass the exact final `text` without `draft_id`, because a `draft_id` schedules the draft's stored text. Omit `platforms` and `auto_repost`. Read it back with `get_schedule_status`: the text, local time and Auto Plug must match the message. Say the readback in one line, then print how to undo: "To undo before it posts, say 'cancel it' and I'll call `cancel_schedule`; the post goes back to your drafts." If an outcome is unclear, read back before any retry, and retry only with the same key. On "no", schedule nothing; Threadify's text stays a draft.

## When something is missing

No Threadify connection: say "Connect Threadify at threadify.app to run Slop Score on your own posts" and stop. Fewer than 5 own posts on 5 different topics in the last 30 days: say the real count and ask one question, whether to use the last 90 days instead; never pad with someone else's posts. No generation access (`generate_content` refuses): show the scored card, say exactly what is missing and stop; never write the post yourself. A host gate holding a call: say where to approve it and wait. A scheduled post is not a published post.

## Receipt

Keep a local receipt in the run folder: the account, `candidates.json`, `cards.json`, `deck.json` (seed and deck sha256), the ten answers, `reveal.json`, `fix.json` with the casing guard, the plug brief and check, the offer used, the approval reply, the scheduled post and its readback.

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
