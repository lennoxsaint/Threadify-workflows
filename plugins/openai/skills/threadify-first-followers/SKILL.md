---
name: threadify-first-followers
description: Get your first Threads followers from zero. Find today's newcomers, active creators and early big posts in your niche in the visible browser, draft every welcome, comment and reply for the owner to send by hand, have Threadify write the account's first three posts and schedule them only after one exact approval, then track day one on a local scoreboard. Works with no post history. Use when someone has few or zero followers, a brand-new Threads account, or asks how to get their first followers.
---

# First Followers

You don't need posts to get your first followers. You need to show up where people are, today. This is Lennox Saint's playbook from when he started Threads with 17 followers in July 2023: welcome the newcomers, follow and comment on creators in your lane, reply early to the day's big posts, and post three times a day. This workflow does the searching, reading and drafting. The owner does every follow and every send by hand. It works the same in Claude Code, Codex and ChatGPT, with no post history.

Follow [Threadify-001: setup and first-loop video](references/threadify-001.md) before the first connected call. A connection never authorizes scheduling. Only the owner's "yes" to the exact approval packet does.

## Rules

- Follow [demo feedback rules](references/demo-feedback-rules.md) for the whole run. If `~/.threadify/owner-overlay.md` exists, read it too and follow it; it is private, so never quote it into posts, files you publish or receipts.
- **Hands off the account.** Never follow, like, comment, reply, repost, post or DM from the browser, and never type into a Threads composer. The browser is for search and reading only. The owner follows and sends every card by hand. Scheduling the owner's three posts needs one explicit "yes" to the exact packet.
- At most 20 welcomes per day and 10 welcome cards per run. No links in any comment. No duplicate comment text. Every line references something specific from that person's bio or post. No flattery templates ("great post", "love this", "so true"). No DMs and no DM asks.
- Skip anyone who looks under 18, a private account, anyone who seems distressed, and brands, bots or giveaway accounts. Never comment on sensitive posts (grief, health, crisis, politics, abuse).
- Never claim follow-back rates, follower outcomes or guarantees. Never credit a follower to one action; say "since you started".
- Keep other people's details in this run only. Show what a card needs (display name, short bio, the post) and store nothing about them. Receipts and the scoreboard are counts only.
- Threadify writes the owner's three posts with `generate_content`. Show and schedule its exact text. The only permitted change is lowercasing, keeping proper nouns, and only when the owner asks; prove it with `scripts/casing-guard.mjs` (`lower(original) == lower(final)` PASS). Never reword Threadify's output and never use `edit_draft`. Never publish now.
- Every number comes from the tools or the screen. Missing data stays unknown: say "unknown", never 0.

## Steps

1. **Check the account.** Call `get_connection_defaults` and say only the @handle and timezone, for example "@handle · Australia/Perth". In the visible browser, open `https://www.threads.com/@handle` and confirm the browser is signed in to that same account (its own profile shows "Edit profile"). If it is a different account or signed out, stop and ask the owner to switch; do no search until it matches. Read the follower count from the profile, and the post count from `search_posts` (`query: "*"`, `total_matched`) or the profile; `get_growth_signal` may cross-check. Record both with a local timestamp. Zero posts is fine: say it and keep going. Say in one line what the owner gets: "I'll find today's newcomers, creators and big posts in your niche, draft every welcome and reply for you to send, and Threadify writes your first 3 posts."
2. **Niche.** If a Threadify Brain exists, read it with `get_brain_overview` / `query_brain`. Otherwise ask at most three short questions in one batch, each with a suggested answer: what you post about, who it's for, one thing you're proud of. Never ask for post history. Turn the answers into 3-5 niche search phrases in plain words.
3. **Move 1: Welcome to Threads.** In the visible browser, search Threads for `first thread` and open the Recent tab (`https://www.threads.com/search?q=first%20thread&filter=recent`). Threads search is fuzzy and loads a few posts at a time, so work down this ladder until you have 10 genuine newcomers or have tried every rung: `first thread`, `hello threads`, `new to threads`, `new here`, `just joined threads`, `introduce myself`, then each niche phrase plus `new here` or `first post`. On each rung, scroll the Recent tab several times before moving on. Keep posts from the last ~24 hours by people who look genuinely new: a first-thread marker, "first thread", "new here", "hello threads" or "just joined" language, or a profile with only a handful of posts. Newcomers do not have to be in the niche (welcoming anyone is the tactic); rank niche-adjacent bios first. Skip anyone the rules exclude. If the ladder finds fewer than 10, show what you found, say how many rungs you tried, and move on; never pad the list with people who are not new. Show up to 10 cards, phone-readable:

```text
1) <display name> · <short bio>
Their first post: "<their post>"
Comment: welcome to threads, <first name>! just followed you. <one genuine line about something specific in their bio or post>
```

   The owner follows and sends each one by hand. Count what they say they sent toward the 20-a-day cap.
4. **Move 2: Follow + 3 comments.** Search the niche phrases (Recent and Top) for 3 creators in the same or an adjacent niche who posted today. Open each profile and read their 3 most recent posts. Draft one comment per post, each about that post; the third comment ends with "followed!". Show each creator as one card: name, short bio, then post → comment ×3. The owner follows and sends.
5. **Move 3: Reply up.** Search the niche phrases on Top and keep up to 5 of today's biggest niche posts still in their early window: posted in the last few hours and gaining replies and likes fast. Draft one sharp, specific reply each that adds value (a number, a step, a counterpoint or a short story), never praise. Show post → reply. The owner sends.
6. **Check the drafts.** Before showing any card, pipe every draft into `node scripts/first-followers.mjs check-drafts` as `{"welcomes_sent_today": N, "welcomes": [{"id", "first_name", "source", "comment"}], "creators": [{"id", "comments": [{"source", "comment"}]}], "replies": [{"id", "source", "comment"}]}`. It fails on the daily cap, links, DMs, duplicates, flattery templates, a wrong welcome opener, a missing "followed!" and any line that doesn't reference its source. Redraft the failures and run it again until PASS. Keep its input in memory or a temp file and delete it at the end of the run.
7. **Move 4: Post 3x a day.** Make three `generate_content` calls with `strict_facts: true` for the account's first three posts: an **intro** (who you are and who you help), a **proof** post (the thing you're proud of, with its real detail) and an **opinion** (one clear take from the niche), in the owner's voice from the Brain or their answers, and `selectedModel` from [generation models](references/generation-models.json) (Claude Opus 5.5 when the plan allows it, Gemini as fallback; record requested and reported model). Ask for concise copy, a first line that opens a loop and a strong closing line. No links. Keep Threadify's exact text and `draft_id` (save with `save_draft` if no draft id comes back). Show all three posts in full. If the owner wants lowercase, run `casing-guard.mjs lowercase` with the proper nouns to keep, then `check`; show "guard: lower(original) == lower(final) PASS" per post.
8. **One approval packet.** Call `best_time_to_post` (owner's timezone) and `list_scheduled_posts`; a truncated response is not an empty calendar. With no post history, say the times are general, not measured. Pick three slots in the next 24 hours, at least 3 hours apart, the first at least 30 minutes from now, none within 90 minutes of a scheduled post. Call `validate_post` on each post. Send one message:

```text
First Followers · @handle · <timezone>
1) <weekday date, local time> · intro · <unchanged | casing guard PASS>
<exact final post text>
2) ... · proof
3) ... · opinion
Action: schedule these 3 posts exactly as shown. Nothing publishes now.
Reply "yes" to schedule all 3, or "no" to schedule nothing.
```

   Schedule only on an explicit "yes". Any change to text, account or time needs a new packet and a new "yes". On "yes", re-check `list_scheduled_posts`, then call `schedule_post` three times with a stable `idempotency_key` per post (account, slot and final text hash). Unchanged text: pass `draft_id` and `content_type`. Lowercased text: pass the exact final `text` without `draft_id`. Omit `platforms` and `auto_repost`. Read back each one with `get_schedule_status`: text and local time must match the packet. If an outcome is unclear, read back before retrying, and retry only that post with the same key. On "no", schedule nothing; the posts stay as Threadify drafts.
9. **Day-one scoreboard.** Pipe counts only into `node scripts/first-followers.mjs scoreboard --html first-followers.html`: `{"handle", "timezone", "started_at", "start": {"followers", "posts"}, "actions": {"welcomes", "creator_comments", "follows", "replies", "posts_scheduled"}}`, using the numbers the owner says they sent. Serve its folder on this computer only (for example `python3 -m http.server 8048 --bind 127.0.0.1 --directory <folder>` in the background) and open `http://127.0.0.1:8048/first-followers.html`, because some hosts' browsers refuse `file://` pages. Confirm it opened. Tell the owner: "Re-check tonight: say 're-check' and I'll read your follower count again." On re-check, read the follower count from the profile again, re-run the scoreboard with `"recheck": {"at", "followers", "posts"}`, reload the page and say the change as "+N followers since you started", never as caused by one move. Stop the server when the run ends. Offer to run the moves again tomorrow; if the host supports a reminder, create one only after the owner agrees.

## When something is missing

No visible browser or not signed in: stop before Moves 1-3 and say exactly what is missing. Without a Threadify connection or generation access, still draft the cards, but never write the three posts yourself; say what is missing and the manual next step. A scheduled post is not a published post, and a drafted card is not a sent one.
