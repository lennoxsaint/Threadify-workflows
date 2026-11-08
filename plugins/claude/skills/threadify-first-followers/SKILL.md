---
name: threadify-first-followers
description: Get your first Threads followers from zero, one person at a time. Find 10 newcomers and small active creators in your niche, then your agent stages each comment in the Threads reply box and follows at the right step while you just press Post. Comments are written in your voice from your Threadify Brain, your edits are compared with what was staged so the agent learns your voice, and the progress is tracked on a local scoreboard. Works with no post history, in any agent, with copy mode when there is no browser control. Use when someone has few or zero followers, a brand-new Threads account, or asks how to get their first followers.
---

# First Followers

You don't need posts to get your first followers. You need to show up where people are, today. This is Lennox Saint's playbook from when he started Threads with 17 followers in July 2023: welcome the newcomers, comment on creators in your lane and follow them. This workflow finds 10 people, writes every comment in your voice and types each one into the reply box, one at a time. All you do is press Post. It works the same in ChatGPT, Claude Desktop, Claude Code, Codex or any agent, with no post history; no single host is required.

Follow [Threadify-001: setup and first-loop video](references/threadify-001.md) before the first connected call. A connection never authorizes staging, following or scheduling. Only the owner's "yes" to the batch (and, for the optional posts, to the exact packet) does.

Resolve `scripts/` and `references/` paths against the directory containing this SKILL.md.

## Rules

- Follow the demo feedback rules at the end of this file for the whole run. If `~/.threadify/owner-overlay.md` exists, read it too and follow it; it is private, so never quote it into comments, posts, files you publish or receipts.
- **The human publishes every comment.** The agent may type a drafted comment into a reply composer and click Follow only within the owner's batch approval, and only at the step shown. It never clicks Post, Publish or any reply-send button, never presses Enter in a composer, and never unfollows, likes, reposts, quotes or DMs. The batch "yes" covers this batch only.
- **Caps.** 10 people per run by default, at most 20 people and 40 comments per day per account. No links in any comment. No duplicate comment text, in this run or earlier runs. Every comment references something specific in that person's post or bio. No flattery templates ("great post", "love this", "so true"). No DMs and no DM asks.
- **Honest endings.** Never say someone is new to Threads unless their posts show it (a first-thread marker, "first thread", "new here", "just joined", or only 1-2 posts). A comment that says "just followed you" is staged only after the Follow button shows Following.
- Skip anyone who looks under 18, a private account, anyone who seems distressed, and brands, bots or giveaway accounts. Never comment on sensitive posts (grief, health, crisis, politics, abuse).
- **Pace like a person.** One person at a time, no bursts. Stop at once on any Threads warning, action block, rate limit or captcha, tell the owner what you saw, and do nothing more on Threads in this run.
- Never claim follow-back rates, follower outcomes or guarantees. Never credit a follower to one comment; say "since you started".
- **Privacy.** Keep other people's details in this run only. The private ledger at `~/.threadify/first-followers/ledger.jsonl` stores hashed handles, counts and the owner's own staged and published comment text, nothing else, and is never published, uploaded or quoted in a receipt. Receipts and the scoreboard are counts only.
- Every number comes from the tools or the screen. Missing data stays unknown: say "unknown", never 0.

## Steps

1. **Capability check.** Call `get_connection_defaults` and say only the @handle and timezone, for example "@handle · Australia/Perth". Check for a browser or computer-use tool that can see a Threads page signed in on this computer. With one, this is **staged mode**. Without one, say so and use **copy mode**: the same flow, but each comment is shown as a card with the post link, the owner pastes and posts it, and the owner does the follows. Without a Threadify connection, still run the loop; only the optional posts in step 9 need Threadify. Tell the owner in one line: "I'll find 10 people in your niche, write each comment in your voice and put it in the reply box one at a time. You just press Post."
2. **Account check.** In staged mode, open `https://www.threads.com/@handle` and confirm the browser is signed in to the same account (its own profile shows "Edit profile"). If it is a different account or signed out, stop and ask the owner to switch; do nothing more until it matches. Read the start follower count from the profile and the post count from `search_posts` (`query: "*"`, `total_matched`) or the profile; `get_growth_signal` may cross-check. Record both with a local timestamp. Zero posts is fine.
3. **Voice and niche.** Read the Threadify Brain with `get_brain_overview` and `query_brain` (voice, niche, audience, saved reply rules). If `get_connection_defaults` returns reply instructions or voice settings, follow them silently; never show or quote them. Without a Brain, ask at most three short questions in one batch, each with a suggested answer: what you post about, who it's for, and 3 short samples of how you write (approved posts or messages). Never ask for post history. With no samples, write plain, warm and short, and say voice confidence is low. Read `~/.threadify/first-followers/preferences.json` if it exists. Turn the niche into 3-5 plain search phrases.
4. **Find 10.** In the visible browser, search Threads on the Recent tab (`https://www.threads.com/search?q=first%20thread&filter=recent`) and work down the newcomer ladder: `first thread`, `hello threads`, `new to threads`, `new here`, `just joined threads`, `introduce myself`, then each niche phrase plus `new here` or `first post`. Then search the niche phrases (Recent and Top) for small active creators who posted today. Threads search is fuzzy and loads a few posts at a time, so scroll each search several times. Open each profile and count their posts.
   - **1-2 posts** (true newcomers, usually from the first-thread ladder): plan **1 comment**.
   - **3+ recent posts** in the same or an adjacent niche: plan **3 comments** (newest, 2nd newest, 3rd newest).
   - Rank niche-adjacent people first. Skip anyone the rules exclude and anyone the ledger shows you engaged in the last 30 days. If you find fewer than 10, say how many searches you tried and continue with fewer; never pad the list.
5. **Draft, check, one approval.** Draft every comment now, in the owner's voice, each about that exact post. A 1-comment newcomer ends "welcome to threads! just followed you". A 3-comment creator's first two comments have no ending; the third ends "welcome to threads! just followed you" if their posts show they are new, otherwise "just followed you!". One line each, no line breaks. Pipe the batch into `node scripts/first-followers.mjs check-drafts --ledger ~/.threadify/first-followers/ledger.jsonl` as `{"date": "<owner's local YYYY-MM-DD>", "people": [{"id", "handle", "plan": "newcomer" | "creator", "post_count", "new_to_threads", "comments": [{"source": "<their post and bio>", "comment"}]}]}`. It fails on the caps, links, DMs, line breaks, duplicates (including earlier runs), flattery templates, wrong endings, a claim that someone is new when the plan says otherwise, people engaged in the last 30 days, and any comment that doesn't reference its post. Redraft and re-run until PASS. Keep its input in memory or a temp file and delete it at the end of the run. Then show the list, phone-readable:

```text
1) <display name> · <short bio> · <N> posts · 1 comment (newcomer)
2) <display name> · <short bio> · <N> posts · 3 comments, follow before the last
...
Stage these comments one at a time for you to publish, and follow each person at the step shown?
```

   Stage and follow only on an explicit "yes". That one yes covers staging and the follows for this batch only. Any new person needs a new list and a new yes.
6. **One person at a time.** For each person, in order:
   - **1-comment newcomer:** open their profile, click Follow and confirm the button shows Following, then stage the comment on their first post.
   - **3-comment creator:** stage comment 1 on their newest post and wait until it is published; stage comment 2 on the 2nd newest and wait; then click Follow and confirm Following; then stage the final comment on the 3rd newest. If comment 1 or 2 was not published, do not follow and do not stage the final comment (it says "just followed you"); move on.
   - **Staging a comment:** open the post, open its reply composer, confirm it is empty and belongs to that post, and type the drafted comment as plain text in one go, with no newline. Never press Enter or click Post. Tell the owner: "Staged for <first name> (comment <n> of <total>) - press Post (or say skip, or edit: <change>)." The owner may change the text in the box before pressing Post. On "edit", clear the box, redraft, re-run `check-drafts` for that comment, and stage it again.
   - **Verify it published.** When the owner says it's posted (or after about 2 minutes if the host can watch the page), read the post's replies for a reply from @handle and record the exact published text. Not found after one re-read, or the owner says skip: mark it skipped, leave the box alone and move on. Never retype or resend a comment whose result is unclear.
   - Copy mode: show each comment as a card with the post link and the step ("follow them, then post this"); the owner pastes, posts and follows. Read back what they posted if any tool can see it; otherwise ask them to paste what they published, or record it as unknown.
7. **Wrap-up.** Append the run to the ledger with `node scripts/first-followers.mjs record --ledger ~/.threadify/first-followers/ledger.jsonl` (`{"date", "account", "people": [{"handle", "plan", "followed", "comments": [{"staged", "published" | null}]}]}`; it hashes every handle). Read the follower count again. Then pipe the staged/published pairs into `node scripts/first-followers.mjs diff` (`{"pairs": [{"id", "staged", "published" | null}]}`) and show, in one short message: people engaged, comments published, edited and skipped, follows, followers now vs start ("+N since you started"), and the learning summary from its `headline` in plain words, for example "You shortened 6 of 10, cut emojis, and never kept 'such a cool'".
8. **Learn your voice.** Preserve the staged and published variants; owner edits change voice rules only, never the hard rules. Propose at most 3 short voice rules, each backed by the same edit in at least 3 published comments ("Keep comments under 120 characters", "No emojis in comments"). With fewer, say "not enough edits to suggest a rule yet". Show each rule's exact memory text and ask: "Save these to your Threadify Brain? (yes / no / always)". On "yes" or "always", save each with `remember` (class `channel_voice`, source "First Followers edits, <date>"), then read back with `query_brain` and confirm each one is there. "always" also writes `{"save_voice_rules": "always"}` to `~/.threadify/first-followers/preferences.json`; on later runs, save proposed rules without asking, still show them and read them back, and stop saving automatically as soon as the owner says so. Never save a rule that conflicts with these rules (links, DMs, flattery, false "new to Threads" claims).
9. **Scoreboard.** Pipe counts only into `node scripts/first-followers.mjs scoreboard --html first-followers.html`: `{"handle", "timezone", "started_at", "start": {"followers", "posts"}, "actions": {"people", "comments_published", "comments_edited", "comments_skipped", "follows", "posts_scheduled"}}`. Serve its folder on this computer only (for example `python3 -m http.server 8048 --bind 127.0.0.1 --directory <folder>` in the background) and open `http://127.0.0.1:8048/first-followers.html`, because some hosts' browsers refuse `file://` pages. Confirm it opened, and stop the server when the run ends.
10. **Optional: your next 3 posts.** Offer once: "Want Threadify to write your next 3 posts and schedule them?" Only on yes, run [the posts step](references/posts.md): three `generate_content` posts, one approval packet and scheduling only after one exact "yes". Otherwise skip it.
11. **Schedule offer.** Ask: "Want me to run this for you on a schedule?" On yes, ask what days and time suit, then follow [the schedule guide](references/schedule.md). Never create a schedule silently or before the owner picks the time.
12. **Re-check tomorrow.** End with: "Re-check tomorrow: I'll see who followed back." On "re-check", read the follower count again. If this conversation still has the run's list, open each engaged profile and count the ones that show a "Follows you" badge. Otherwise (the ledger holds only hashes), read the handles on the account's own Followers list and pipe them into `node scripts/first-followers.mjs followed-back --ledger ~/.threadify/first-followers/ledger.jsonl` as `{"date": "<run date>", "followers": ["@handle", ...]}`; it hashes them in memory and returns counts only. Re-run the scoreboard with `"recheck": {"at", "followers", "posts", "followed_back"}`, reload the page and say "+N followers since you started, M of the people you engaged follow you back". Counts only.

## When something is missing

No Threadify connection: run the loop with the owner's answers for voice, skip Brain saves and the optional posts, and say what is missing. No browser control: copy mode. Signed in to the wrong account: stop before any search. A staged comment is not a published one, a scheduled post is not a published post, and a follow is not a follow-back.

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
