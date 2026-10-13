---
name: threadify-reverse-engineer-my-app
description: Point REA at an app you own (or paste your product page), get a plain-English feature map with evidence, then have Threadify write a week of build-in-public posts, each with a tracked Auto Plug, scheduled one a day only after one exact approval. Use when someone says "reverse engineer my app", "x-ray my app", "map my app's features" or wants a week of build-in-public posts about their own product.
---

# Reverse Engineer My App

Anyone can x-ray your app now. Building is cheap, distribution is expensive. Point REA at an app you own (or paste your product page), get a plain-English feature map with evidence, then Threadify writes a week of build-in-public posts, scheduled after one "yes". It runs the same in Claude Code, Codex and ChatGPT.

Follow [Threadify-001: setup and first-loop video](references/threadify-001.md) before the first connected call. A connection never authorizes scheduling. Only the owner's "yes" to the exact approval card does.

## Rules

- Only an app the owner owns or has written permission to analyse. REA's own rule: it is for software you own or are authorized to examine. Never analyse a third-party app, even when asked, and stop when the conversation shows the app belongs to someone else.
- REA comes only from the official npm package `rea-agents`, published from github.com/morluto/rea. Repositories and packages with similar names exist; never install any of them. Install only after the owner says "yes" to the exact command.
- REA looks at the app logged out, in a fresh, empty browser profile that is signed in to nothing. Never use the owner's everyday browser profile and never sign in inside the scan window.
- The map holds only what the app shows and what its browser code does. Never claim anything about the app's server, database or data handling.
- Redact before you show anything: run every REA result, page quote and list through `scripts/feature-map.mjs redact` (or `map`, which redacts). Never print strings that look like keys, login strings, account or record ids, or email addresses.
- Threadify writes every post and every plug with `generate_content`. Never hand-write or reword copy. Never use `edit_draft`. The only permitted change is lowercasing, keeping proper nouns, proved by `scripts/casing-guard.mjs`: `lower(original) == lower(final)` must be true and the result PASS. If the guard fails, show the original unchanged.
- A post may state only features and numbers from the map. Any other feature, number, customer, result or price fails the fact check, and Threadify writes that post again.
- Never publish now. Schedule only after the exact reply "yes" to the exact card. Never move or overwrite a post already on the calendar.
- Missing numbers stay "unknown", never 0. Say "scheduled", never "posted".

## Steps

1. **Confirm the account.** Call `get_connection_defaults`. Say the Threads account as "@handle · timezone", for example "@handle · Australia/Perth". Note the plan for Auto Plug and `link_tracking`.

2. **Ownership gate.** Ask exactly: "Do you own this app, or have written permission to analyse it? Reply "yes" or "no"." Pipe the reply into `node scripts/feature-map.mjs gate` as `{"answer": "<reply>"}`. Continue only on `owner_confirmed`. Anything else (no, unsure, "it's a competitor", silence) returns `stopped`: say its message and stop. Nothing is scanned, installed or written.

3. **Pick the input.** Ask which one the owner has, then use it:
   - **(a) A web app they own, by its address.** Check for REA: `rea --version` in the terminal, or REA's MCP tools (`list_browser_targets`, `analyze_web_bundle`) in this client. With REA:
     1. Make a throwaway profile folder (`mktemp -d`) and start Chrome logged out on a free loopback port that is not the owner's everyday browser port, for example on macOS: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9333 --user-data-dir="<throwaway folder>" --no-first-run --no-default-browser-check "<app address>"`.
     2. `rea list-browser-targets http://127.0.0.1:9333 --format json` and pick the target whose address is the app.
     3. `rea analyze-web-bundle http://127.0.0.1:9333 <targetId> --observation-ms 5000 --format json > <work folder>/rea-bundle.json`. With REA's MCP tools, call `analyze_web_bundle` with the same endpoint, target and `observation_ms: 5000`.
     4. Close that Chrome window and delete the throwaway folder. Say "REA looked at the logged-out app for 5 seconds."
   - **(b) REA is missing.** Say in plain words: "REA is a free, open-source tool (MIT) that reads the code your app sends to the browser. The only official package is rea-agents from github.com/morluto/rea. Packages with similar names exist, so I install only that one. Command: `npx rea-agents setup`. It shows the changes it wants to make to your agent and asks before applying them. Reply yes to install, or no to use your product page instead." Before running it, check `npm view rea-agents repository.url` returns `git+https://github.com/morluto/rea.git`; anything else, stop and say so. Run setup only on "yes", then ask the owner to restart this agent and run the workflow again. On "no", use (c).
   - **(c) No app to scan.** Take the owner's product or offer page address (read the page and quote it exactly) or a feature list they paste.

4. **Feature map.** Write `<work folder>/feature-map.json` with 5-10 features in plain English: `{"app": {"name", "url"}, "source": "rea" | "page" | "list", "observed_at", "features": [{"id": "F1", "name", "what", "evidence"}], "unknowns": [...], "limitations": [...]}`. Evidence is `{"kind": "rea", "script", "line", "column", "detail"}` with the location REA returned, or `{"kind": "quote", "quote", "from"}` with the exact words (30 at most) and the page address or "your list". Copy REA's unknowns and limitations as it states them. Describe what a person sees or what the browser code does, never what the server does. Run `node scripts/feature-map.mjs map < feature-map.json`. On `blocked`, fix what it lists. On `ok`, show its `table` (already redacted) and the redaction count, and keep `map` and `map_sha256`. Ask the owner to correct anything wrong before going on.

5. **Seven briefs.** Pick 7 features (all different when the map has 7 or more; otherwise use every feature at least once), one per day. Ask once, optionally: "Want to add why you built it, or a real user win? Skip if not." Run `node scripts/feature-map.mjs briefs` with `{"map", "picks", "owner": {"why"?, "user_win"?}}`. The angles run in order: what it does, why i built it, the problem it kills, behind the scenes, a fact from the map, building is cheap, distribution is expensive, and a user win only when the owner supplied one (otherwise a question for the audience).

6. **Threadify writes each post.** For each brief, make one `generate_content` call with `contentType: "short-form"`, `strict_facts: true`, `inputText` = the brief's `input_text`, and the model order in [generation-models.json](references/generation-models.json) (Claude Opus 5.5 when the plan allows it, Gemini as fallback). Keep Threadify's exact text and `draft_id`, and record the model the response reports; never claim a model it does not confirm. List every capability the post says the app has and map each one by meaning to a feature id, or null when nothing in the map covers it. Run `node scripts/feature-map.mjs check-post` with `{"map", "brief", "text", "claims"}`. On FAIL, call `generate_content` again with the same brief plus the exact reasons; three calls per post in total. When a post still fails, pick an unused feature for that day and try once more; when none is left, stop and say which days are held. Then lowercase: run `casing-guard.mjs lowercase` with the proper nouns to keep (the app name, product and people names, "I"), then `check` with original and final. Show "lower(original) == lower(final) PASS" per post.

7. **One tracked Auto Plug per post.** Call `list_offers` and let the owner pick the one offer for the week (usually the app itself). For each post, call `generate_content` with that `offer_id` for a one-post plug reply that continues that exact post, and run the casing guard on it the same way. The plug's link is the offer's saved destination; Threadify links on Threads are auto-tracked, so add no UTM tags. If `link_tracking` is off or unknown, say clicks may not be measured and leave the setting alone. No Auto Plug on the plan: say so and ask whether to schedule the 7 posts without plugs (`"auto_plug_unavailable": "<reason>"`) or stop. Call `validate_post` on every post and every plug; on a failure, say why and ask Threadify once for a replacement through step 6 or 7.

8. **One approval card.** Call `best_time_to_post` (owner's timezone) and `list_scheduled_posts`; a truncated response is not an empty calendar. Pick one slot on each of the next 7 days: the best measured time with no scheduled post within 90 minutes and at least 60 minutes from now. Build the plan and run `node scripts/app-card.mjs card`. While anything is unproven it returns `blocked` with what is missing. When it returns `ready`, send its `card` exactly as one message and keep its `card_sha256`:

```text
Reverse Engineer My App · @handle · <timezone>
App: <name> · mapped from <REA, logged out | your product page | your feature list> · <n> features with evidence · observed <date>
Ownership: you said yes, you own this app or have written permission to analyse it

1) <local time> · <ISO time with offset> · <angle> · <F#>: <feature>
written by Threadify (model <reported>) · facts PASS · <unchanged | lowercased, casing guard PASS>
<exact post text>
Auto Plug, 50 min after (<unchanged | lowercased, casing guard PASS>): <exact plug text>
Plug link: <offer destination> (Threadify tracks it)

2) ... through 7)

Action: schedule these 7 posts with their Auto Plugs exactly as shown, one a day. Nothing publishes now.
Reply "yes" to schedule all 7, or "no" to schedule nothing.
```

   Proceed only on the exact reply "yes". "ok", "sure", "yes but change day 3" and silence are not a yes. Any change to a post, plug, account or time needs a new card and a new "yes". On "no", schedule nothing; every post stays a Threadify draft.

9. **Schedule, read back and receipt.** Run `node scripts/app-card.mjs schedule` with `{"plan", "card_sha256", "reply"}`. Re-check `list_scheduled_posts`, then call `schedule_post` once per returned item with exactly those arguments; omit `platforms` and `auto_repost`. Call `get_schedule_status` for each and pipe `{"plan", "statuses"}` into `app-card.mjs readback`: text, time and the Auto Plug echo must match every row. On MISMATCH, say exactly what differs and change nothing. If a result is unclear, read back first and retry only that post once with the same `idempotency_key`; never repeat blind. Then run `app-card.mjs receipt` and keep it in the work folder: counts, feature ids, models, hashes, ids, the approval reply and the readback, never post text or the map. Close with: "7 build-in-public posts scheduled, one a day, each with a tracked Auto Plug. Building was the cheap part."

## When something is missing

No "yes" to the ownership question: stop, nothing scanned. No REA and no install approval: use the product page or a pasted list. Without a Threadify connection, stop after step 5 with the map and the briefs and say: "Connect Threadify at threadify.app to have the posts written in your voice." Without generation access (HTTP 402 or no quota left), stop and say what ran out. Never write the posts yourself instead. A scheduled post is not a published post, and a click is not a sale.
