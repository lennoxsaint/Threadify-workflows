# 0.43.0

- Add Slop Score: can you tell your own Threads posts from AI slop? Five of your posts from the last 30 days meet five plain-AI twins on the same topics (each labelled AI twin · plain Claude, no context), shuffled with a stored seed and swiped blind one at a time, human or slop. The reveal shows your hit rate and a Slop Score from 0 to 100 for every card with the exact flagged words, using Unslop's unchanged scorer and its four tells (hedging, AI phrases, corporate voice, over-formatting), and the average for your posts against the AI twins. Threadify then writes the worst twin's topic from your Brain with the same prompt, only lowercased under a casing guard and re-scored the same way (slop NN -> NN), and schedules it with an Auto Plug from your existing offer (100 to 250 characters, ending with its plain link) after one yes, with a readback and how to undo it.

# 0.42.0

- Add Scheduler Showdown: every scheduler has an AI connection now, and this is a fair, blind test of which one your AI agent actually knows you through (your numbers, your voice, your sales), on the tools you connect. It opens with the disclosure that Threadify Workflows are made by Threadify's founder, locks five public test prompts with a sha256 before the first tool call, sends them word for word through each tool's own MCP (a missing capability scores fail with the reason quoted from the tool's own list; a tool with no connector is scored no AI connection connected and the connector URL is named), anonymises the raw replies to Tool A to F with a sealed key whose hash is printed before judging, and has an outside model grade them (codex exec read-only first, else a fresh Claude, labelled). The scorecard always shows price, free plan and networks read live from each pricing page, unblinding refuses if the key hash changed, the verdict is honest about ties, and the winner does one real post after one yes. Test posts are scheduled 60 days out and deleted with a not-found readback, and a Threadify report page ends with how to run it on your own tools.

# 0.41.0

- Go Make Money rebuilt: confirms what makes you money, suggests missing connectors, agrees a no-code action plan with you, builds the post from a proven full structure and the Auto Plug from your best-clicking plugs, schedules on one yes, then celebrates on a Threadify page with an optional Claude check-in.
- Never create a new offer per run: Go Make Money, Research Army and Monetize My Week reuse the existing offer.
- Shared feedback rules: one approval packet, reprint everything after a correction, surgical edits, look it up before asking, claim strength, listicle shape, channel casing, and never route around a host gate.

# 0.40.1

- Go Make Money: counts read right ("1 signup", not "1 signups") everywhere a count is printed. The views -> clicks step now says which clicks it compares ("247 of 257 clicks are on the 41 of 44 linked posts with views") in the funnel table, the step line, the report page and the outside judge prompt, so the two click numbers never look like a mismatch. The outside judge records the model it actually used and keeps only its final reply (codex exec -o), so no log lines reach the report. Landing page text decodes HTML entities (&#x27;, &amp; and the rest), and the short seller quote check still matches word for word.

# 0.40.0

- Add Go Make Money: give Claude your real money goal, not a task ("go make money: get me to 1,000 paying members by Dec 31"). It works out the weekly pace (unknown baseline stays UNKNOWN, labelled needs real baseline), reads your raw Threadify rows (posts, tracked links, signups, offers, conversion setup) and the page your links land on, and a script builds the funnel (views, clicks, signups, paid) and names the biggest leak with the exact rows behind it. It asks why you think it happens and tests that belief against the rows (does the page match the promise; do people reach the call to action), sends only the diagnosis and the raw table to an outside judge on a different model (codex exec read-only, else a fresh Claude) with a hard time limit, lists the 3 claims a skeptical buyer would doubt with each quote checked against the page, ranks three decisions by impact on paid conversion, speed and reversibility, and ships fix #1 after one exact yes (offer + Auto Plug + tracked link, one Threadify post scheduled at the best time with the casing guard, or an optional landing-page pull request that is never merged). A goal ledger grades the fix on the same numbers next run, and a local report page shows it all with a big leak card.

# 0.39.2

- Research Army: the post step now picks one proven hook template (your own best-performing shapes from Greatest Hits and your Vault first, otherwise one of ten shipped templates) and asks Threadify for a compact post (about 300 characters, one fact per line) that ends on an encouraging so-what for the reader. The Auto Plug uses your offer's plain link: a new clean-link step removes utm and other tracking tags because Threadify already tracks every link it posts, and the plug check fails a plug that still carries them. Wording changes you ask for in chat are made exactly and re-checked. From the live THREADIFY-050 demo.

# 0.39.1

- Research Army: the tracked link now reaches the post. When you have an offer (an offer named Research Army is used without asking), your agent writes one Auto Plug from the post's own findings and the offer's approved facts with the offer's exact link; it appears in the editable block and on the post card, is scheduled 50 minutes after the post and is read back (a tier-blocked plug is reported, never retried). The post's source line is now always honest: the facts tell Threadify to say "the N most-liked posts from K keyword searches", and a new check-post step fails any post that says top posts, top on Threads, most viewed or most-liked without the searches, or uses a number the checker didn't count, asking Threadify once for a replacement. Pages open with Google Chrome when no browser tool is connected.

# 0.39.0

- Add Research Army: get a research post on your niche. An army of Haiku 5.5 agents and one Opus 5.5 race to research the most-liked recent Threads posts in your niche (ScrapeCreators keyword searches over the last 30 days, deduped, English, top 100 by likes, honestly labelled; one-time key setup that never shows the key). The race is fair: the same brief, the same posts and Read-only tools for both sides, with Bash not offered, denied and audited from each run's own log. Each side picks 8 patterns from a fixed catalog the checker owns and counts them; the army works in two rounds (20 scouts nominate, the commander picks 8, every scout counts and the commander adds them up) while Opus works alone, with a live two-lane terminal view. A script recounts every claim and the scoreboard shows backed claims (exact and within 1), cost, wall time and the models each side really used, plus a local HTML report; the winner has the most backed claims, then the lower cost, then the faster time. Threadify then writes one research post in your voice from the winner's backed findings only, with an editable block and Done editing, and schedules it at the best time tomorrow only after one exact yes.

# 0.37.1

- Director Mode: schedule with the exact text and the video, never draft_id with a video (a draft-linked schedule dropped the video in rehearsal).

# 0.37.0

- Add Director Mode: stop editing, start directing. Give your agent one raw talking-head video and it makes four better versions in a director/ folder (your original is never touched), with a one-line scoreboard after each: Speed cuts dead air over 0.3 s down to about 0.1 s and removes retakes, keeping your last clean take without clipping a word; Altitude moves your strongest proof line to second 1 and cuts what doesn't serve the viewer; Depth has a fresh outside judge score your first 3 seconds out of 10, fixes the top fault and shows both scores; Range adds up to 4 free public-domain Openverse sounds about 15 LU under your voice and never on a word, burned word-highlight captions (lowercase, 3 words at a time) and a title card, in a 1920x1080 MP4 under 95 MB checked by re-transcription. Threadify then writes the post in your voice and schedules it with the video only after one exact yes. Free and local with ffmpeg and whisper.cpp

# 0.36.0

- First Followers now runs one person at a time: your agent finds 10 newcomers and small creators in your niche, stages each comment in your voice in the Threads reply box and follows at the right step after one batch yes, and you just press Post. Newcomers (1-2 posts) get one comment ending "welcome to threads! just followed you"; creators get two comments, a follow, then a final comment. It compares staged and published text to learn your voice, saves up to 3 voice rules to your Threadify Brain only on yes (or "always"), keeps a private local ledger (hashed handles, counts, your own comments), caps days at 20 people and 40 comments, offers to run on a schedule after you pick the time, and re-checks follow-backs the next day. Copy mode works without browser control; writing your next three posts is now optional.

# 0.35.1

- First Followers: Move 1 now works down a ladder of newcomer searches (first thread, hello threads, new to threads, new here, just joined, introduce myself, niche + new here) and scrolls each one, because Threads search is fuzzy and loads a few posts at a time; it never pads the list with people who are not new.

# 0.35.0

- Add First Followers: get your first Threads followers from zero, with no post history. Your agent finds today's newcomers, creators who posted today and the day's early big posts in your niche, and drafts every welcome ("welcome to threads, <name>! just followed you." plus one real line), creator comment and reply for you to send by hand; it never follows, likes, comments, posts or DMs for you, caps welcomes at 20 a day, and uses no links, repeats or copy-paste praise. Threadify writes your first three posts (intro, proof, opinion), scheduled only after one exact yes, and a local day-one scoreboard shows followers since you started, counts only

# 0.34.3

- What's Working: the report chart spans your real lowest to highest views and always shows the median and alive lines, labels no longer overlap, medians are whole numbers, the report opens over 127.0.0.1 (some hosts block file:// pages), and analysis caveats stay out of the posts

# 0.34.2

- What's Working: month slices end on the first day of the next month (search_posts treats to as exclusive), so no month loses its last day

# 0.34.1

- What's Working reads the year through search_posts one month at a time (read_post_performance fails on long windows with artifact-write-failed)

# 0.34.0

- Add What's Working: is Threads dead? It checks every post you published this year against your own median views, labels each dead, stuck or alive, answers month by month, names what Threads is killing and the one kind of post it still pushes hardest with your real posts as proof, charts it on a local report page, then Threadify writes three posts in that pattern, each with a tracked Auto Plug, scheduled only after one exact yes
- Every workflow now follows shared demo feedback rules (ask once, keep going between approved steps, phone-readable output, real numbers only, Threadify's copy untouched) and reads the owner's private ~/.threadify/owner-overlay.md when present, without ever publishing it

# 0.33.0

- Reverse Engineer My App: every post is built on an outlier template from the Viral library, Vault or greatest hits, opens a story loop, runs 100-350 characters and ends on a bold "so what"; every Auto Plug is 100-250 characters, passes the RSS test and states only numbers proven by a quote (new check-plug); an owner can ask the agent to write the copy and the card says so; REA installs and scans in the same run, no restart

# 0.32.1

- Reverse Engineer My App: posts can no longer call a feature new, just shipped or available now (the map has no dates), and spelled-out numbers like three tabs are fact-checked like digits

# 0.32.0

- Add Reverse Engineer My App: built something good and nobody knows it exists? REA maps what your app (or the page for anything you sell) really does, with proof, after a yes that you own it, and Threadify writes a week of posts in your voice, one real feature a day, each with a tracked Auto Plug, scheduled only after one exact yes

# 0.31.3

- Watch Any Creator: first-time ScrapeCreators setup in plain words - sign up, paste the key once into a hidden prompt (saved only on your computer, never printed), and see your live credit balance next to every estimate

# 0.31.2

- Watch Any Creator: an avoid rule now carries its own copy template, so no rule tells you to copy what it says to skip; avoid-length and avoid-topic rules stay out of the ranking (they only restate a winning rule).

# 0.31.1

- Watch Any Creator: older rules are matched by meaning through a mapping file (new features and prior commands); a topic word in passing no longer matches an older rule.

# 0.31.0

- Add Watch Any Creator: read a YouTube creator's whole archive from a local cache or a ScrapeCreators pull (credit estimate and yes first), rank the rules their numbers support with evidence and example video ids, compare them with an older rules file (held, broke, new), and have Threadify write a ten-post thread draft and one post in your voice, scheduling that one post only after one exact yes

# 0.30.12

- List the OpenAI plugin under Business & Operations, the category that matches a lead generation listing

# 0.30.11

- Add the demo video link to the OpenAI plugin's review information, which OpenAI requires before submission

# 0.30.10

- Package the OpenAI plugin in the Codex format so Codex offers every Threadify tool (#60)

# 0.30.9

- Add the OpenAI plugin package for ChatGPT and Codex (#59)

# 0.30.8

- Add terms, support and documentation links to the Claude plugin manifest (#58)

# 0.30.7

- Pass the plugin directory credential scan with a build-time audit (#57)

# 0.30.6

- Rename the browser review page's session storage key (#56)

# 0.30.5

- Reword creator docs so Vault is not paired with read (#55)

# 0.30.4

- Reword vault skill opening and drop explicit child environment for the directory scanner (#54)

# 0.30.3

- Clear the last two directory scan holds (#53)

# 0.30.2

- Clear directory credential-scan false positives in bundled scripts (#52)

# 0.30.1

- Move the Claude Code plugin to plugins/claude for the plugin directory (#51)

# 0.30.0

- Add Publish Everywhere (`/threadify-publish-everywhere`, "One video. Three places. One yes."): hand your agent one MP4 or MOV video. It reads back the brand and each connected handle, measures the video locally with ffprobe (size, length, shape, file type) and says which of YouTube, Threads and X can take it and why. If YouTube is not connected it stops and points to threadify.app (Brands).
- A small limits table (`references/platform-limits.json`, applied by `scripts/video-fit.mjs`): Threads 300 seconds, X 20 minutes by default, YouTube 12 hours with a channel not cleared for long uploads held to 15 minutes, and Threadify storage of 1 GB (1024 MB) for every platform. A platform that cannot take the video is dropped with a plain-English reason, never silently. Vertical or square video of 3 minutes or less is a YouTube `short`; everything else is `long`. Without ffprobe the agent asks for the length and shape.
- Threadify writes the post with `generate_content` from a one-line description. The YouTube title is the post's first line unless the owner supplies one, 100 characters at most; a longer line is a question, never a cut. The agent never writes or rewords copy: lowercasing is the one permitted change, proved by the casing guard (`lower(original) == lower(final)`).
- YouTube privacy is asked on every run and never defaulted, and `made_for_kids` is never set without asking. `scripts/publish-card.mjs` refuses to build the approval card until those are decided, and returns the `schedule_post` arguments only for the exact reply "yes" to that exact card.
- One approval card: exact post, YouTube title, format and privacy, each platform with handle and time, anything dropped and why, the X metered note and a note when global auto-repost is on. Then one `schedule_post` with `platforms`, `youtube_options` and an `idempotency_key`, and a `get_schedule_status` readback. An unclear result is inspected before any retry. One video per run, nothing deleted, never publishes now, and a 402 or quota error stops the run.

# 0.29.3

- Add one-command version bump and post-merge auto-bump workflow (#50)

# 0.29.2

- Unslop: every Auto Plug sells the owner's offer, the product they sell, never the Unslop workflow. It is specific to the post it replies to and continues it.
- Unslop: the plug brief sent to `generate_content` with the `offer_id` names the post it continues and asks for one fixed structure, one short line per slot with a blank line between: a cheeky transition from the post to the offer, a concise pain point, a concise example of the offer solving it, `free to try - join [number of people] [community word]`, then the link.
- Unslop: the join line appears only when the offer is free to try and the number comes from a verified, dated source (offer facts, owner confirmation or account data). The number is never invented or rounded up; when either is unknown, the agent asks the owner for the number or drops the line. The community word is the owner's own word for their audience from the Brain or offer, otherwise "people". The link stays the offer's exact saved destination with no UTM tags.
- Unslop: the approval packet shows the plug on its own lines with its gate attempt, casing result and the join count's source and date, or why the line was dropped. The zero-hedge gate, the three-call limit and the casing guard are unchanged; a regression test proves the template join line passes the gate.

# 0.29.1

- Unslop: the offenders table collapses reposts into one row. Posts with the same normalised text (lowercase, whitespace collapsed), or the same first line and flagged phrases, show once with the most-viewed copy and a repeat count, for example `If you're drawn to: (x4)`. The JSON adds `repeats` and `repeat_ids` per offender.
- Unslop: offenders rank by hedge count, then slop score, then views, so hedged posts lead the top 5 whenever any exist. Hedging is the highest-weighted family; a marker-only listicle no longer pushes every hedged post off the table.
- Unslop: the JSON adds `polished_with_hedges`, and the verdict table adds one line: "X of Y polished posts had a hedge." The raw vs polished medians are unchanged and still count every post, reposts included.

# 0.29.0

- Add Threadify Unslop (`/threadify-unslop`, "AI doesn't make your posts slop. Polish does."): scores the last 90 days of Threads posts on four slop families (corporate and LinkedIn voice, AI tells, hedging, over-formatting) with hedging weighted 3x, quotes every flagged phrase, and compares raw vs polished median views, labelled "on your account", with the top 5 offenders. A polished win or a tie is reported as found.
- Zero-hedge rule: one hedge fails a post. A bundled no-dependency gate (`scripts/hedge_gate.mjs`) runs standalone and prints PASS or FAIL with the matched phrases. It covers lexical hedges, both-sides balancing, closing questions that dodge a stance, disclaimers, trailing qualifiers, softened CTAs and "and that's okay", and it passes "May" the month, "can" as real ability and hedge words inside quoted titles or proper nouns. The rule overrides softer hedging advice in other anti-slop sources; an unbacked claim is cut, not softened.
- Threadify writes three posts in the owner's top raw pattern (Claude Opus 5.5 when the plan allows it, Gemini as fallback). Each post and each Auto Plug runs through the gate; a failure goes back to Threadify with the reasons, three generations per post in total, and a post that fails three times is held, never patched. The agent never edits words: lowercasing is the one permitted change, proved by the casing guard (`lower(original) == lower(final)`).
- One approval packet with gate results, then `schedule_post` and `get_schedule_status` readback only after an explicit yes. Never publishes now.
- No-data path: 5-20 pasted posts or drafts get flags and offenders, labelled "pasted posts: no view data, no view comparison", plus a prompt to connect Threadify.
- `references/slop-markers.md` holds the rules as original prose and credits humanizer (MIT), no-ai-slop (MIT) and Wikipedia's "Signs of AI writing" (linked, not copied).

# 0.28.0

- Run My Threads sources hooks from actual posts, assigns distinct batch evidence, and holds slots without suitable evidence.
- Owner-requested edits preserve unrelated copy and create new approval revisions; automatic editorial rewrite loops are removed.
- Saved-draft recovery precedes eligible Opus-to-Gemini fallback; per-slot state preserves partial success.
- Casing protects proper nouns and links across posts and CTA replies.
- Local candidate bundles can be installed into isolated preview directories without replacing stable installations.

# 0.27.3

- Money Posts preserves Threadify wording by default and supports explicitly requested edits with original/final receipts, hashes and renewed approval.
- Add hook evidence research with optional vault access and an honest unproven fallback; keep click-pattern ranking unchanged.
- Require Auto Plugs to match the selected offer and destination. Improve generation guidance for concise copy and coherent endings.
- Add a local review checker for bounded revisions, fresh account-specific validations and exact schedule readback. Source truth and offer suitability still require evidence review.
- Version 0.27.2 was a local installation candidate only; this is the public stable release.

# 0.27.1

- Fix: the bundled scripts in Money Posts (`rank-money-posts.mjs`, `casing-guard.mjs`) and Run My Threads (`week-plan.mjs`, `hook-check.mjs`, `casing-guard.mjs`) printed nothing and exited 0 when run through a symlinked skills folder such as `~/.claude/skills`. Their entry check now resolves the real path.
- Money Posts: Threadify can file an Auto Plug's clicks under the plug reply instead of its post. The agent now calls `get_post_thread` for linked ids with no views and passes the results as `threads`; the ranking moves those clicks onto the post the thread opens with (the latest same-first-line post published at or before the reply) and reports `plug_rows_moved_to_post`. While any link stays unmatched, "big posts with no link" carries a caveat.

# 0.27.0

- Add Money Posts ("Stop chasing views."): ranks the last 90 days of Threads posts by unique clicks per 1,000 views instead of views. Tracked link rows from `read_link_attribution` are joined to posts by `root_threads_post_id` (fallback `final_threads_post_id`) and summed per post; views come from `read_post_performance`. The table shows first line, date, views, clicks, clicks per 1,000 views and conversions exactly as Threadify labels them (never "sales" unless revenue is above 0), plus "big posts with no link".
- A bundled no-dependency ranking script (`scripts/rank-money-posts.mjs`) does the join and the math, keeps missing views and unmeasured conversions unknown instead of 0, and flags small samples.
- The agent names 2-4 patterns the top click posts share, each tied to named posts and evidence, with no performance predictions.
- Cold start: with fewer than 5 linked posts or fewer than 30 clicks in 90 days, Money Posts says so and ranks on proxy signals (replies per 1,000 views and replies asking how or for the link), labelled "proxy, not clicks".
- Threadify writes three posts in the winning pattern and one Auto Plug per post for the chosen saved offer; the agent never writes or edits copy. Its bundled casing guard proves `lower(original) == lower(final)` for every post and plug, and a failed guard shows the original unchanged. Threadify links on Threads are auto-tracked, so no UTM tags are added.
- Three conflict-free slots over the next three days from `best_time_to_post` and `list_scheduled_posts`, `validate_post` on each, then one approval packet (account and timezone, three exact posts, three exact Auto Plugs and destination, three local dates and times, action). `schedule_post` runs only after an explicit yes, and every post is read back with `get_schedule_status`. Never publishes now.
- A 7-day check offers to re-run Money Posts to rank the three new posts by real clicks, through a host reminder when supported or a dated note.

# 0.26.0

- Run My Threads now plans the week: five posts a day, 35 a week. Six days carry one long-form thread (teacher, storyteller, synthesizer in turn) and four short-form posts; the short day (Sunday by default) carries five short-form posts. Short-form types rotate one-liner, listicle and random, with listicle-plug reserved for CTA slots.
- A bundled no-dependency planner (`scripts/week-plan.mjs`) builds the same plan from the same four setup values and checks every invariant: 35 posts, 6 threads, one greatest hit a day, the CTA count, type rotation, and no structure or hook archetype repeated in a day. Setup shows the plan as a table and runs Day 1.
- One greatest-hit repost a day: the owner's own top single post, reposted word for word after a 60-day reuse check and a stale-fact check. It is saved with `save_draft` and verified byte-identical; that is the only use of `save_draft`. Everything else is still written by Threadify's `generate_content`.
- Hook-first generation: each post gets a proven hook pattern from the owner's own hits and Vault suggestions, Vault outliers, connected templates or the bundled hook bank, plus a planned structure and hook archetype. A new deterministic hook check (`scripts/hook-check.mjs`) reads line 1 of every post; on FAIL Threadify is asked once for a replacement, never hand-edited. Generation passes `strict_facts: true`, and a number belongs in a hook only if it really happened.
- CTA levels chosen at setup: Growth (none), Balanced (two a day, 14 a week, the default) and Conversion (25 a week). A CTA is a thread with a Threadify-written Auto Plug reply or a listicle-plug post with the chosen offer, never in post 1. The Auto Plug echo is read back; when it is missing, future plugs move to listicle-plug posts.
- New public references: a Threads playbook (hook, hold, help, CTA, structures, short-form and long-form types) and a fill-in hook bank. Slots are now at least 90 minutes apart, and the approval card shows type, structure, hook check, CTA and plug text for every post.

# 0.25.0

- Add Run My Threads ("I don't write posts anymore. I approve them."): one setup creates exactly one daily schedule (05:30 local by default) and reuses an existing one instead of adding a second.
- Each morning the agent finds up to five open slots for today and tomorrow, never touching posts already on the calendar, and asks Threadify to write each post with `generate_content`. Count defaults to five and can be set from one to five.
- Generation tries Claude Opus 5.5 when the plan allows it, with Gemini as fallback, moving down one ordered list kept in a single reference file only when a model is unavailable on the plan or fails. Each post records the model requested and the model Threadify reports; an unreported model is never claimed.
- The agent never rewrites Threadify copy. Its only permitted change is lowercasing while keeping proper nouns, links, handles and hashtags, and a bundled no-dependency guard script must show PASS for every post; on FAIL the original text is used unchanged.
- One approval card shows account, timezone, local and UTC times, exact text, model and guard result. A single "yes" schedules exactly what was shown, "skip N" drops a post and "no" schedules nothing. Changed slots need re-validation and a new "yes"; ambiguous attempts are read back before retrying and a batch is never replayed.
- Runs once a day and reports Threadify quota and the host's token or usage readout when the host exposes it, saying so when it does not. Setup guidance covers Codex thread automations and Claude Code routines, with Desktop local tasks as the local fallback.

# 0.24.2

- Threads Teach: rank the learner's best posts by views, with a minimum age, a minimum view count and a check that discards posts whose view counts are incomplete.
- Choose the contrast post by a stated rule (a settled recent text post with real but lower views) and never describe it as the learner's worst post.
- Say only which account is in use; never show the connection's reply instructions, other accounts, settings or quota.
- Use the learner's stated timezone and stop reading an unset connection timezone out as fact; show UTC beside local time when scheduling.
- Make the mission a one-time, resumable setup that can be done before the first lesson, with a short path when the learner has already said what is needed.
- Scope the shared connection guide to its connection sections, name `get_draft` for draft readback, read full post text, tolerate missing workspace files, and have the coach run the pre-publish check until the learner has taken that lesson.

# 0.24.1

- Fix `npx github:lennoxsaint/Threadify-workflows` installs failing with exit 128: the `engines/eddy` submodule now points at `lennoxsaint/eddy-legacy`, which serves the pinned commit. The pinned commit is unchanged.
- Add a regression test that keeps the submodule URL and pinned commit consistent.

# 0.24.0

- Add Threads Teach, a stateful teaching workflow with ten short lessons on Lennox Saint's core Threads frameworks, each illustrated with one of his real public posts.
- Keep a private learning workspace (mission, lessons, learning records, glossary) so each session continues from the last and opens with retrieval practice.
- Teach on the learner's own posts through read-only Threadify tools when connected, and on pasted posts otherwise, stating what cannot be seen.
- End every lesson with one post the learner writes themselves; saving a draft and scheduling are separate actions that each need exact approval and readback.
- Credit the teaching method to Matt Pocock's MIT-licensed `teach` skill and ship its licence notice with the skill.

# 0.23.1

- Reject a new retry key for the same Growth Loop account/day/card, preserving the original persisted save intent and its reconciled status.
- Block ambiguous legacy state containing multiple save intents for one card until provider state is inspected and reconciled; do not delete intents or imply provider cleanup occurred.
- Give Growth Loop its own six-hour recurring instructions for maturity scans, tomorrow's six-card plan and authoritative draft-save reconciliation, replacing the unrelated creator setup/seven-day-fill prompt.
- Preserve the draft-only boundary: skip reconciled saves, inspect ambiguous outcomes before retrying, and never schedule or publish automatically.
- Verify three regressions that fail on the prior release, generated bundle parity and the full synthetic test suite. Native runner and live provider behavior remain separate verification steps.

# 0.23.0

- Add Monetize My Week, which selects exactly seven offer-relevant existing drafts while preserving every post body, thread part and media item unchanged.
- Use the first seven conflict-free local dates at current measured best times, with one tailored tracked Auto Plug exactly 50 minutes after each post.
- Require one exact seven-row approval packet, fresh validation, stable idempotency, schedule reconciliation and provider readback before reporting a confirmed schedule.
- Keep Threads-only scope, existing global automation, incomplete entitlements and ambiguous outcomes explicit; no workflow result is described as published, clicked or converted without readback.
- Measure publication, performance and link attribution over a common observation window, saying “attributed” rather than “caused” and keeping Auto Plug-only results separate from broader account totals.

# 0.22.0

- Add Threadify Growth Loop as an installable workflow on top of 30-Day Viral Vault.
- Let a new user prepare the first six-draft day immediately from two explicit safety- and rights-reviewed candidate hypotheses; promotion remains an evidence label, not a cold-start blocker.
- Evaluate authoritative 72-hour reach evidence and attributed 7-day commercial evidence without inventing missing attribution.
- Promote a hypothesis only after three comparable tests across two days, two positive results, a median win over baseline, and no safety, rights, or known commercial regression.
- Keep tomorrow's portfolio fixed at two Greatest Hits, two Viral Vault, two My Vault; four proven and two challenger; two broad, two expertise, and two personal cards.
- Persist private versioned state, save intents, authoritative draft receipts, pause state, and verified six-hour runner readback.
- Support Codex, Claude Code, Cursor, Gemini CLI, OpenClaw, Hermes, and generic MCP installation while labeling unobserved native scheduling routes unverified.
- Intentionally provide no automatic scheduling or publishing command.

## 0.21.0

- Add Get Set Up, private recovery state and six runtime installation adapters.
- Add explicitly selected scheduling permission with revocation and provider readback requirements.
- Add a public single-file entry and a short one-prompt customer start.
- Add an honest OpenAI Dot-to-supported-runtime handoff without claiming native Dot installation.
- Add a compact operator-proof completion card for account, Brain, first week, review and routine readback.
- Keep native runtime, customer connection and provider results explicit: adapter presence is not live acceptance proof.

# Threadify Workflows stable releases

## 0.20.0

- Preserves YouTube Synthesizer's pure `youtube-synthesizer.v1` generation contract and zero-write receipt while adding a separate `youtube-synthesizer-delivery.v1` module.
- Freezes the exact ordered thread, target Threads account, action, time and timezone, optional owner-image hash and provider reference, visible automation state, and a stable idempotency key into one immutable approval packet.
- Defaults to fresh best-time scheduling with calendar-conflict checks and also supports explicit publish-now when the current Threadify connector advertises it.
- Requires separate approval before uploading one local owner-supplied image, then fresh final delivery approval after the provider URL is known.
- Persists request intent before every provider write, dispatches once, and blocks ambiguous retries until authoritative schedule or publication readback matches the exact approved content.
- Keeps exact-post validation, best-time evidence, and the account calendar fresh through final approval; an ambiguous image-upload attempt is counted and can never be relabelled as a zero-write manual fallback.
- Never downloads YouTube media, silently rewrites copy, adds a plug, enables per-post reposting, hides account-wide Auto Repost, or cross-posts to another platform.
- Includes a private manual fallback and deterministic in-memory adapter tests; this release does not schedule or publish a real Threads post.

## 0.19.0

- Adds YouTube Synthesizer: one URL becomes three evidence-backed hook options and one complete long-form Threads draft, or a hard abstention when no structure is supported.
- Ships exactly twelve immutable word-for-word templates across Authority, Investigation / Data, Wisdom, and Playbook / Case Study, plus exactly thirty-six owned, attributed, permission-cleared original threads.
- Scores every template, fills only transcript- or verified-metadata-backed placeholders, requires Threadify Brain context or three distinct approved samples, and locks fixed wording and originals with SHA-256 integrity checks.
- Extracts public captions without an API key, supports optional caption-only `yt-dlp` with media downloading disabled, and accepts local TXT, VTT, or SRT fallbacks.
- Treats transcripts as untrusted data, never executes their instructions, never downloads video or audio, never fabricates a claim, and never saves, schedules, or publishes generated content.
- Includes strict schemas, transcript fixtures, abstention and prompt-injection cases, body-free receipts, and full Codex, Claude Code, Cursor, Gemini CLI, OpenClaw and Hermes bundles.

## 0.18.0

- Adds Market to Pipeline: a local-first workflow for turning one offer and one bounded market into a private qualified pipeline, exact next actions, and exactly seven evidence-linked posts.
- Combines normalized Threadify-owned buyer signals with host-supplied Treg discovery and enrichment while keeping every network call, credential, and raw private payload outside the bundled engine.
- Caps each run at 50 raw signals, 10 selected prospects, and a caller-confirmed price-previewed budget no greater than US$3.00; company fit must precede person or contact enrichment.
- Keeps warm interest, private-channel permission, current work-contact verification, lawful basis, suppression, sender identity, and unsubscribe controls as separate gates. A verified email is never treated as consent.
- Binds approval to the exact action hash, persists a pending attempt before delivery, blocks ambiguous retries until reconciliation, and emits public receipts without bodies or contact destinations.
- Ships deterministic synthetic proof, private JSON/CSV/HTML review artifacts, and full Codex, Claude Code, Cursor, Gemini CLI, OpenClaw and Hermes bundles.

## 0.17.0

- Adds AI Content Forensics: a local-first workflow for turning an inspectable creator corpus into evidence-linked content rules and copyable templates.
- Keeps metrics platform- and format-specific, requires 20 unique metric-valid items for comparative claims, and labels every relationship as observed rather than causal or predictive.
- Produces five constitutions, an insight audit, exactly ten posts with seven `copy this:` templates, a body-free receipt, and optional local SVG/HTML visuals.
- Supports approved exports and read-only Threadify evidence by default, with an optional bounded Scrape Creators BYO-key adapter that never persists or prints credentials.
- Installs through the full catalog for Codex, Claude Code, Cursor, Gemini CLI, OpenClaw and Hermes while keeping all outputs draft-only.

## 0.16.0

- Adds 30-Day Viral Vault: a slot-only 30-day blueprint that prepares the current day's six posts instead of creating 180 drafts upfront.
- Requires exactly two owned Greatest Hits, two eligible Viral Vault sources and two eligible My Vault sources, with reach-first, balanced and lead-first composition modes.
- Preserves exact owned reposts and rights-gated literal fill-in templates while blocking missing permission, placeholder coverage, claims evidence or replacement facts.
- Reveals only the current card and persists edit, approval, skip, rejection, local handoff and idempotent scheduling states; ambiguous delivery blocks retries and never becomes a publication claim.
- Installs through the existing full catalog for Codex, Claude Code, Cursor, Gemini CLI, OpenClaw and Hermes, with a generic MCP-compatible operating contract.

## 0.15.0

- Adds Post This Next, a read-only workflow that evaluates every eligible draft from one verified Threadify account before recommending what to review next.
- Supports three explicit goals: most useful now, best match to owned engagement patterns, and closest to ready. Comparison mode can show all three without treating pattern fit as a traffic forecast.
- Uses a portable Jev adapter for typed scoring, abstains to the top two when confidence or separation is weak, and preserves a clearly labelled manual shortlist when Jev is unavailable.
- Binds evaluations to complete pagination and exact content hashes, rechecks the selected draft before display, keeps artifacts private and performs no draft edit, save, schedule, publish or delete action.

## 0.14.2

- Fixes horizontal clipping in the Lead Desk review page at narrow mobile widths. Cards, the reply editor and long destination links now wrap within the viewport.

## 0.14.1

- Adds an editable three-category Anti-Spam Lead Desk page served locally with private, revision-checked exact-text persistence.
- A final mark records the exact reply and hash for later readback; any edit revokes final status. The page itself never sends.
- Clarifies bounded two-week scans, coverage limits, already-replied exclusions, and historical filter examples.
- Live public replies require a separate owner send request, fresh account/target/safety checks, and provider readback.

## 0.14.0

- Adds Anti-Spam Lead Desk: a bounded five-card classifier for current public Threads evidence.
- Uses a verified-account/comment-read gate for warm owned-post comments, with current public browser profile inspection and an explicit Qualified Buyer Research fallback.
- Produces local JSON, Markdown and self-contained HTML plus at most one unsent useful public-reply draft.
- Does not scrape, automate research, DM, schedule, send, or claim leads, bookings, sales, or revenue.

## 0.13.0

- Adds Choose Your First Offer, a distinct niche-to-offer decision workflow for creators choosing between an intensive, guided lab, and self-serve kit.
- Uses one fixed scorecard across all three models: audience-evidence fit, speed to a valid signal, credible deliverability now, fulfillment simplicity, and scalability.
- Produces a ranked decision, Proof Loop Map, inactive validation page, and body-free receipt without creating an offer record or publishing anything.
- Preserves incomplete evidence as a constraint-led hypothesis and keeps engagement separate from demand, sales, conversion, product-market fit, and virality.

## 0.12.0

- Adds Refresh Your Threads Profile, which interviews the creator and combines their current niche with a bounded, priority-ordered set of approved context.
- Produces exactly three coherent clarity-, authority-, and personality-led bio-and-picture systems for explicit owner selection.
- Renders private JSON, Markdown, self-contained HTML, a circular small-avatar preview grid, a selected square SVG, and a body-free receipt.
- Freezes consented image assets by SHA-256, discloses external likeness processing, requires transfer consent, and preserves a no-upload visual fallback.
- Keeps live profile editing separate from preparation: current UI discovery, exact-account verification, sync/verification review, rollback state, one final confirmation, and readback are required. Ambiguous or mismatched results are never retried blindly.
- Does not claim that profile copy or imagery causes growth, conversion, or trust, and does not assume an official Threads profile-write API.

## 0.11.0

- Adds Find Your Niche, a read-only workflow that analyzes bounded owned Threads posts, audience comments and creator replies.
- Produces one recommended niche, one ideal-client avatar and three content pillars as private JSON, Markdown and self-contained HTML.
- Defaults to 90 days, expands only until 20 owned posts or a 365-day cap, and preserves incomplete coverage and unknown metrics.
- Keeps engagement separate from purchase intent and performs no draft save, profile edit, reply, schedule or publication.
- GitHub release approved by the owner. Live connected-account acceptance remains separate and unverified.

## 0.10.0

- Adds Inbound Replies to the public workflow catalog with grouped post context, exact local editing and approval, deferral and suppression, and private resumable state.
- Ships the complete local UI and CLI inside the installed skill, including paths with spaces and fresh-install execution.
- Discovers current Threadify read, draft and delivery capabilities through the dispatcher; unavailable capabilities remain explicit and no historical tool name is treated as live authority.
- Preserves idempotent delivery preparation, ambiguous-outcome reconciliation and body-free public receipts. This release does not send a live reply or deploy Threadify application code.

## 0.9.0

- Adds exact-copy browser review for Day, Week and Month, optional automation controls, durable Submit approval and verified host delivery handoff.
- Preserves the v0.8.0 workflow catalog, buyer-conversation engine, carousel workflow and current onboarding.
- Published through the owner-approved release process; no live content scheduling or app deployment is implied.

## 0.8.0

- Makes Your Next Moves the starting point for offer-led buyer conversations, with local preparation before an optional account connection.
- Adds Agree the Next Step, Follow Through, Buyer Questions to Content and Weekly Buyer Outcomes.
- Adds private, revision-checked conversation records, exact-action review, separate recipient permission, pending-attempt recovery and evidence-based outcome summaries. The local engine does not perform provider actions.
- Generates the workflow catalog and compatibility reference from canonical manifests, with JSON list, describe and doctor commands.
- Installs the full runnable catalog for fresh clients. Existing installations retain their selection until explicit migration; rollback preserves private working state.
- Includes Greatest Hits Runway and Content Brain Repair in stable assets.
- Reworks the README and client guides around the first useful conversation review, with explicit current capability gaps.

## 0.7.0

- Adds Threadify Offer Builder (`threadify-offer-builder`), with the Offer Architect interview.
- Supports ten adaptive questions, shortened filming mode and clearly labelled fictional demos.
- Creates a responsive local offer page and separate owner handoff without a provider connection.
- Prepares optional offer saves with duplicate checks, exact approval, stable retry identity and readback checks.
- Preserves the separate live integration and stable publication gates.

## 0.6.0

- Bundles the exact public Viral Carousel Maker v0.2.0 runtime, source skill,
  templates, and byte-identical controlled-mutation demo and QA contracts.
- Adds a free local viral-carousel workflow that completes seven-edit creation
  and review without a Threadify MCP call, provider write, or external action.
- Adds fresh connector/account/timezone/capability/best-time/calendar gates,
  separate hash-bound media-transfer and schedule approvals, durable request
  intent, crash reconciliation, and duplicate prevention.
- Adds one-install parity, lifecycle safety, clean-install, and privacy evidence
  required by THREADIFY-021. Directory submission and app deployment remain deferred.

## 0.5.0

- Adds Vault Setup, Create My Day, Create My Week and Create My Month, including
  local drafting without a Threadify connection and a clearly labeled four-week month.
- Adds the local Node review engine, versioned records, source-rights checks,
  approval binding, private state, interrupted-run recovery and opt-in feedback.
- Bundles four primary creator skills and seven preserved advanced/compatibility skills.
- Adds reproducible candidate archives and isolated install/upgrade/rollback checks.
- Keeps hosted Brain services and shared corpus data outside the public package.
- Adds a shared opening question and bundled Threadify-001 setup/video guide to
  every workflow: new trial, existing connection, another provider or local work.
- GitHub release approved by the owner. Directory submission is deferred.
  Seven editable connected drafts were validated; live scheduling acceptance and
  automatic host discovery remain unproven. This release does not claim either.
- Works without the unreleased shared-Viral app changes. Existing My Vault,
  Greatest Hits and supplied-source fallbacks remain available. No app deployment.

## 0.4.1

- Prevents duplicate discovery by excluding the universal `~/.agents` target from native `--targets all` installations.
- Keeps `~/.agents/skills` available as an explicit target and as the fallback when no native client is detected.
- Reconciles and removes only stale Threadify-managed targets when the selected client set changes.

## 0.4.0

- Makes Qualified Buyer Research self-contained for standalone agent installation.
- Adds a versioned public durable ruleset and redacted proposal contracts.
- Adds stable-channel install, update, status, rollback, and uninstall commands.
- Adds daily and on-use update checks with explicit consent, locking, validation, atomic switching, cached fallback, and rollback.
- Keeps private FC5 context, voice samples, student data, account identifiers, and raw outcomes outside the public repository.
- Changes twenty-outcome learning from automatic public mutation to `promotion_recommended`; Lennox approves a public release by merging its tested release PR.
