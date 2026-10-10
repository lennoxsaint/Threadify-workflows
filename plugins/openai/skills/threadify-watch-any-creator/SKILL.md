---
name: threadify-watch-any-creator
description: Watch every video a YouTube creator has published, find the rules their numbers support, have Threadify write those rules as a ten-post thread in your voice saved as a draft plus one standalone post, and schedule that one post only after one exact approval. Use when someone says "watch any creator", "watch every <creator> video", "what are <creator>'s rules" or wants a creator's whole archive turned into posts.
---

# Watch Any Creator

Nobody has time to watch a creator's 5,000 videos. Your audience least of all. Your agent reads the whole archive, ranks the rules the numbers support, and Threadify writes them in your voice: a ten-post thread saved as a draft and one post scheduled after one "yes". It runs the same in Claude Code, Codex and ChatGPT.

Follow [Threadify-001: setup and first-loop video](references/threadify-001.md) before the first connected call. A connection never authorizes scheduling. Only the owner's "yes" to the exact approval card does.

## Rules

- Threadify writes every word of the thread, the post and the plug with `generate_content`. Never hand-write or reword copy. Never use `edit_draft`. The only permitted change is lowercasing, keeping proper nouns, proved by `scripts/casing-guard.mjs`: `lower(original) == lower(final)` must be true and the result PASS. If the guard fails, show the original unchanged.
- Transcripts stay on this computer. Never paste, post or share a transcript. Quotes are twelve words at most.
- A rule needs at least 20 videos on each side inside one format family (long-form or Shorts) and a difference of at least 15%. Smaller groups are described, never ranked. A rule is a pattern in the archive, never a promise: never say a rule "will" get views.
- Missing numbers stay "unknown", never 0.
- Before any paid ScrapeCreators call, show the call and credit estimate and wait for "yes". Stop and report when the credits charged pass the approved estimate.
- Never schedule the thread. Never publish now. Schedule the one post only after the exact reply "yes" to the exact card.
- Never print, repeat or echo the ScrapeCreators API key, tokens or account ids, and never put the API key in a command line. `scripts/scrapecreators-key.mjs save` is the only thing that writes it, to `~/.threadify-workflows/secrets/` with owner-only permissions.

## Steps

1. **Confirm the job.** Call `get_connection_defaults`. Say the Threads account as "@handle · timezone". Confirm the creator's YouTube handle by name, and say the rights note: "Public titles, numbers and transcripts, read privately on this computer. Transcripts are never shared; quotes stay under twelve words." Note the plan for Auto Plug and `link_tracking`.

2. **Load the archive.** Use the cache when there is one: a folder with `manifest.json`, `videos/`, `shorts/` and `transcripts/`, laid out as in [corpus-layout.md](references/corpus-layout.md). Without a cache, pull one into `~/.threadify-workflows/state/watch-any-creator/<handle>/corpus/` with the owner's own ScrapeCreators account.
   - **Set up ScrapeCreators once.** Skip this when the SCRAPECREATORS_API_KEY environment variable is set or the client has a connected ScrapeCreators tool. Otherwise run `node scripts/scrapecreators-key.mjs status`. When it says `missing`, send the owner one message in plain words:
     "Watch Any Creator reads the archive through ScrapeCreators, a data service you pay for yourself. One-time setup, about two minutes:
     1. Sign up at https://app.scrapecreators.com. New accounts get free credits.
     2. Copy your API key from the ScrapeCreators dashboard.
     3. Open Terminal (Mac) or PowerShell (Windows), paste this line, press Enter, then paste your API key when it asks. It stays hidden and is saved only on this computer:
        `node "<absolute path to scripts/scrapecreators-key.mjs>" save`
     Tell me when it says saved."
     Fill in the real absolute path. If the owner pastes the API key into the chat instead, pipe it to `node scripts/scrapecreators-key.mjs save` through stdin (a heredoc, never a command-line argument), never repeat it, and say once that it is now in this chat's history.
   - **Check it (free)** through whichever route is in use:
     - Saved header file: `curl -s -w '\n%{http_code}' -H @"<header_file from status>" https://api.scrapecreators.com/v1/account/credit-balance | node scripts/scrapecreators-key.mjs balance`.
     - Environment variable: the same curl and pipe, with the shell filling the `x-api-key` header from SCRAPECREATORS_API_KEY instead of `-H @<file>`.
     - Connected ScrapeCreators tool: use its balance call when it has one; otherwise say "balance unknown" and go on.
     Say "ScrapeCreators connected · <credits_remaining> credits left". On `rejected`, ask the owner to copy the API key again (and run save again for the saved route). Never guess a balance.
   - **Every call sends the header file, never the value:** `curl -s -H @"<header_file>" "https://api.scrapecreators.com/..."`. With the environment variable, curl sends it as the `x-api-key` header from the shell, never echoed.
   - Run `node scripts/watch-any-creator.mjs estimate --long <videos> --shorts 0 --transcripts 0` with the channel's video count for the listing estimate. Show it with the balance: "Listing: <calls> calls, <credits> credits. You have <balance>. Reply yes to pull the list." Wait for "yes". Unknown count: the first "yes" covers the 1-credit channel lookup only, then show the listing estimate.
   - Page the long-form list and the Shorts list to the end. Save every raw page and the manifest as the layout says.
   - Run `estimate --long <long-form count> --shorts 0 --transcripts <long-form count>` and show the transcript credits next to the balance. When the estimate is more than the balance, say exactly how many credits are missing and that credit packs are bought at https://app.scrapecreators.com (the owner buys; never buy for them), or offer to read only the newest transcripts the balance covers, saying so in the counts. Wait for a second "yes". Save one raw transcript per long-form video.

3. **Watch it.** Run `node scripts/watch-any-creator.mjs analyse --corpus <corpus> --out <work folder>`. It reads every listing and transcript, dedupes with the AI Content Forensics engine, and ranks the rules in seconds. Say the counts exactly as returned: videos watched, long-form, Shorts, transcripts read, observed date. Show the top rules from `rules.md` as a countdown, #5 to #1, each with its evidence line and example video ids. Say the Shorts vs long-form line as description, never as a rule. Name any gap the output lists.

4. **Then vs now (optional).** When the owner gives an older rules file (Markdown list or JSON), match each old rule by meaning, never by shared words:
   - Run `node scripts/watch-any-creator.mjs prior --prior <file>` (each old rule with its `prior_id`) and `node scripts/watch-any-creator.mjs features --rules <work folder>/rules.json` (everything this archive can measure).
   - Write `<work folder>/mapping.json`: one entry per old rule, `{ "prior_id", "feature", "direction" }`, where `feature` is an id from the features list that measures the same thing and `direction` is `do` or `avoid`. Use `"feature": null` when nothing measures it (posting time, retention, editing style, delivery). A shared word is not a match: "must work as a post" is not about the topic "work". When unsure, use null.
   - Show the mapping as a table (old rule · what it is measured by, or "no measure") and wait for "next".
   - Run `node scripts/watch-any-creator.mjs compare --rules <work folder>/rules.json --prior <file> --map <work folder>/mapping.json --out <work folder>`. Show three lists, held, broke and new, each with its evidence. Say the untestable count as one line. A rule with no measure is "untestable", never "held".
5. **Threadify writes the thread.** Run `node scripts/watch-any-creator.mjs brief --rules <work folder>/rules.json --account @handle --agent <your agent's name>` (add `--then-vs-now <work folder>/then-vs-now.json` after step 4). Call `generate_content` once with `contentType: "long-form"`, `longFormType: "teacher"`, `strict_facts: true` and `inputText` = `thread_input_text`. Keep Threadify's exact posts and `draft_id`, and record the model the response reports. Pipe the posts into `node scripts/watch-any-creator.mjs check-thread`: exactly ten posts, posts 2-8 each with a `copy this:` line, every post under 500 characters. On FAIL, call `generate_content` again with the same brief plus the exact reasons; three calls in total, then hold the thread and show why. Lowercase only when the owner asks: `casing-guard.mjs lowercase` with the proper nouns to keep, then `check`. Read the draft back with `get_draft` and confirm every post matches. For lowercased copy, save the final posts with `save_draft` (`posts`, exact text) and read that draft back with `get_draft`. Say "saved as a draft", never "posted". The thread is never scheduled.

6. **Threadify writes one post.** Call `generate_content` once with `contentType: "short-form"`, `strict_facts: true` and `inputText` = `post_input_text`. Keep the exact text and `draft_id`. Run the casing guard the same way when lowercasing. Auto Plug: when the plan includes it, call `list_offers`, let the owner pick one offer, and call `generate_content` with that `offer_id` for a one-post plug that continues this post. Threadify links on Threads are auto-tracked, so add no UTM tags. No Auto Plug on the plan: the card says so. Call `validate_post` on the post and the plug.

7. **One approval card.** Call `best_time_to_post` (owner's timezone) and `list_scheduled_posts`; a truncated response is not an empty calendar. Pick the next open best-time window: at least 60 minutes from now, with no scheduled post within 90 minutes. Build the plan and run `node scripts/watch-card.mjs card`. While anything is unproven it returns `blocked` with what is missing. When it returns `ready`, send its `card` exactly as one message and keep its `card_sha256`:

```text
Watch Any Creator · @handle · <timezone>
Watched: @creator · <videos> videos (<long> long-form, <shorts> Shorts) · <transcripts> transcripts · observed <date>
Thread: 10 posts saved as a Threadify draft, read back, not scheduled
Post, written by Threadify (<unchanged | lowercased, casing guard PASS: lower(original) == lower(final)>):
<exact post text>
Auto Plug, 15 min after (<unchanged | lowercased, casing guard PASS: ...>):
<exact plug text>
Plug link: <offer destination> (Threadify tracks it)
When: <local time> · <ISO time with offset> (<timezone>) · next open best-time window
Action: schedule this one post exactly as shown. Nothing publishes now. The thread stays a draft.
Reply "yes" to schedule it, or "no" to schedule nothing.
```

   When the plan has no Auto Plug, pass `"auto_plug": {"unavailable": "<reason>"}` and the three plug lines become one: `Auto Plug: none (<reason>)`.

   Proceed only on the exact reply "yes". "ok", "sure" and silence are not a yes. Any change to the text, plug, account or time needs a new card and a new "yes". On "no", schedule nothing; everything stays a Threadify draft.

8. **Schedule and read back.** Run `node scripts/watch-card.mjs schedule` with `{"plan", "card_sha256", "reply"}`. Call `schedule_post` once with exactly the returned arguments; omit `platforms` and `auto_repost`. Call `get_schedule_status` with the returned id and pipe `{"plan", "status"}` into `watch-card.mjs readback`. On MISMATCH, say exactly what differs and change nothing. If a result is unclear, read back first and retry once with the same `idempotency_key`; never repeat blind. Say "scheduled", never "posted".

9. **Verdict and receipt.** Say the verdict in two lines: the #1 rule with its evidence number, and the time saved: "Your audience does not have to watch <videos> videos. The rules are in your voice now." Then run `watch-card.mjs receipt` and keep it with the work folder. The receipt holds counts, rule ids, hashes, ids, the approval reply and the readback, never post text or transcripts.

## When something is missing

No cache and no ScrapeCreators access: give the step 2 setup message and wait; continue only after the free balance check says `ok` (or, with a connected tool that has no balance call, after its first successful call). Without a Threadify connection, stop after step 4 with the rules and say: "Connect Threadify at threadify.app to have the thread and the post written in your voice." Without generation access (HTTP 402 or no quota left), stop and say what ran out. Never write the posts yourself instead.
