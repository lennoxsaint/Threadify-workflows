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

- Before the first step, read [demo feedback rules](references/demo-feedback-rules.md) and follow them for the whole run. If `~/.threadify/owner-overlay.md` exists, read it and follow it too; it is private, so never quote, publish or upload it.
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
5. **Fix the worst one.** Take `worst_twin` from the reveal. Call `generate_content` with `contentType: "short-form"`, `strict_facts: true`, no offer, and `inputText` set to the same prompt the twin answered: `worst_twin.prompt`. Same prompt, now written from the owner's Brain. Keep Threadify's exact text and `draft_id`. Save the text to `original.txt`. Threads copy is lowercase, so lowercase it keeping proper nouns (`node scripts/casing-guard.mjs lowercase`, JSON on stdin) and save `final.txt`; if it is already lowercase, `final.txt` is the original. Run `fix --dir <run> --original original.txt --final final.txt --keep "<proper nouns>"`. It runs the casing guard, re-scores the post with the same scorer and prints "slop NN -> NN". On a guard FAIL, stop and show the original. If it reports a reused hook, call `generate_content` once more with the same prompt (three calls at most); if it still fails, say so and stop. Print the updated `card`.
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
