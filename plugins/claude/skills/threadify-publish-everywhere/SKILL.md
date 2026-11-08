---
name: threadify-publish-everywhere
description: Hand your agent one video. It checks where the video can go, has Threadify write the post and the YouTube title in your voice, and schedules it to YouTube, Threads and X only after one exact approval. Use when someone says "publish everywhere", "post this video to youtube", "upload this video" or "schedule this video on youtube threads and x".
---

# Publish Everywhere

One video in. The agent measures it, says which of YouTube, Threads and X can take it and why, has Threadify write the post and the YouTube title in the owner's voice, and shows one approval card. Nothing is scheduled until the owner replies "yes". It runs the same in Claude Code, Codex and ChatGPT.

Follow [Threadify-001: setup and first-loop video](references/threadify-001.md) before the first connected call. A connection never authorizes scheduling. Only the owner's "yes" to the exact approval card does.

## Rules

- One video per run. Never delete anything. Never publish now: this workflow only schedules, and only after the "yes".
- Threadify writes the post with `generate_content`. Never hand-write or reword the post or the title. Never use `edit_draft`. The only permitted change is lowercasing, keeping proper nouns. Prove it with this skill's `scripts/casing-guard.mjs` (Node 18+, JSON on stdin): `lower(original) == lower(final)` must be true and the result PASS, and show that result. If the guard fails, show the original unchanged.
- Ask, never default: YouTube privacy (public, unlisted or private) is asked on every run. Never set `made_for_kids` without asking. Never switch brand or account without the owner's confirmation.
- A platform that cannot take the video is dropped with a plain-English reason, on the card. Never drop one silently and never continue silently when something is not connected.
- Say "scheduled", never "posted". A scheduled post is not a published post.
- X is metered: say so on the card.
- Stop on HTTP 402 or a quota error and say plainly what ran out. Never retry around it.
- Never print the upload URL, credentials, tokens or account ids.

## Limits

The table lives in [platform-limits.json](references/platform-limits.json) and `scripts/video-fit.mjs` applies it. When a Threadify tool reports a tighter limit, the tool's answer wins: say so and drop that platform or stop.

| Where | Limit |
| --- | --- |
| File type | MP4 or MOV only |
| Threadify storage, every platform | 1 GB (1024 MB) |
| Threads | 300 seconds (5 minutes) |
| X | 20 minutes by default |
| YouTube | 12 hours; a channel not cleared for long uploads is held to 15 minutes |
| YouTube format | vertical or square and 3 minutes or less is `short`; everything else is `long` |
| YouTube title | 100 characters |

## Steps

1. **Read back the accounts.** Call `get_connection_defaults` first, then `list_brands`. Run `node scripts/publish-card.mjs connections` with `{"brand", "handles": {"threads", "x", "youtube"}}` and say its readback: the brand and each connected handle, for example "Brand: Lennox · YouTube: @lennox · Threads: @lennox · X: not connected", plus the timezone. If YouTube is not connected, stop and say: "YouTube is not connected to <brand>. Connect it at threadify.app (Brands), then run this again." Never continue without it. If the owner means another brand or account, confirm it by name before any call uses it. Note whether global auto-repost is on.
2. **Take one video.** One local path or one public https URL. More than one: ask which one, and run again for the others. Run `node scripts/video-fit.mjs probe <path-or-url>`. It uses ffprobe and returns size in MB, length, width x height, container and codec. Say those facts in one line. If it returns `ffprobe_missing`, ask its questions (length, shape) and use the owner's answers; never guess. Only MP4 or MOV: anything else stops here with "convert it to MP4 first".
3. **Decide where it can go.** Pipe `{"video": <facts>, "connected": {"youtube": true, "threads": true, "x": false}, "youtube_long_uploads_cleared": true|false|null}` into `node scripts/video-fit.mjs decide`. Say each platform's decision and reason exactly as returned: kept, dropped (and why) or not connected. If it asks whether the YouTube channel is cleared for uploads longer than 15 minutes, ask the owner and run it again with the answer. State the YouTube format it chose, `short` or `long`, and why. If YouTube is dropped, say so and ask whether to continue with the rest or stop. If nothing can take the video, stop.
4. **Threadify writes the post.** Ask for a one-line description of the video if the owner has not given one. Call `generate_content` once with `contentType: "short-form"` and that description as `inputText`. Keep Threadify's exact text and `draft_id`. Run `node scripts/publish-card.mjs title` with `{"post_text", "supplied_title"?}`: the YouTube title is the first line of Threadify's post unless the owner supplied one, 100 characters at most. If it asks for a title, ask the owner; never shorten or rewrite the line yourself. Lowercase only when the owner asks: run `casing-guard.mjs lowercase` on the post and the title with the proper nouns to keep, then `check`, and show the line "casing guard: lower(original) == lower(final) PASS".
5. **Ask what only the owner can decide.** YouTube privacy: "public, unlisted or private?" Ask every run, even when a past run used one. The time, if not given: one time for all, or one per platform. Write every time as ISO with the offset for the owner's timezone, for example `2026-10-12T09:00:00+08:00`, at least 5 minutes ahead. Tags are optional. Leave `made_for_kids` unset unless the owner answers that question.
6. **Upload.** For a local file call `create_media_upload` with the filename and `content_type` `video/mp4` (MP4) or `video/quicktime` (MOV). HTTP PUT the file's bytes to the one-time URL with that same content type, for example `curl --fail --silent --show-error -o /dev/null -X PUT -H "Content-Type: video/mp4" --upload-file <path> "$UPLOAD_URL"`, keeping the URL in a variable. Never print the upload URL or put it in a receipt. Use the returned `public_url` as the video. A public https URL is passed as the video directly, with no upload. Then call `validate_post` with the exact text and video. On a failure, say why; for wording, ask Threadify for a new post through step 4.
7. **One approval card.** Build the plan and run `node scripts/publish-card.mjs card`. While anything is undecided it returns `blocked` with the question to ask: privacy is never filled in for the owner. When it returns `ready`, send its `card` exactly as one message and keep its `card_sha256`:

```text
Publish Everywhere · <brand> · <timezone>
Video: <name> · <length> · <width x height> · <size> MB · <container>
Post, written by Threadify (<unchanged | lowercased, casing guard PASS: lower(original) == lower(final)>):
<exact post text>
YouTube title (<the post's first line | you supplied it>): <title>
YouTube format: <short | long> (<why>)
YouTube privacy: <public | unlisted | private> (you chose it)
Made for kids: <not set, your channel's own setting applies | yes | no>
Going to:
- YouTube @handle · <local time> · <ISO time with offset> (<timezone>)
- Threads @handle · <local time> · <ISO time with offset> (<timezone>)
- X @handle · <local time> · <ISO time with offset> (<timezone>) · X is metered: this post counts against your X allowance
Dropped: <platform, because reason | nothing>
Note: global auto-repost is on, so Threadify will also re-share this post later under your saved setting.
Action: schedule this video exactly as shown. Nothing publishes now.
Reply "yes" to schedule it, or "no" to schedule nothing.
```

   Proceed only on the exact reply "yes". "ok", "sure", "go ahead" and silence are not a yes: ask again. Any change to the text, title, privacy, format, platforms, accounts or times needs a new card and a new "yes". On "no", schedule nothing; the post stays a Threadify draft.
8. **Schedule.** Run `node scripts/publish-card.mjs schedule` with `{"plan", "card_sha256", "reply"}`. It returns the `schedule_post` arguments only for "yes" to that exact card: `text`, `video`, `platforms`, `scheduled_at`, `platform_times` when the times differ, `youtube_options` `{format, privacy, title, tags?}` and one stable `idempotency_key`. Call `schedule_post` once with exactly those arguments. Omit `auto_repost` and `auto_plug`. If the result is unclear (a timeout, an error after sending, a partial answer), look first with `get_schedule_status` or `list_scheduled_posts`. Retry only when the post is not there, once, with the same `idempotency_key`. Never repeat blind.
9. **Read back.** Call `get_schedule_status` with the returned id. Say, per platform, the scheduled time in the owner's timezone and the status, and name anything that was dropped. If the readback differs from the card, say exactly what differs and change nothing. Say "scheduled", never "posted".

## Receipt

Keep a local receipt: brand and handles, the video facts, each platform decision and reason, the YouTube format and why, the description given to Threadify, the `draft_id`, the casing guard result, the title and its source, the privacy answer, the card and its hash, the approval reply, the `idempotency_key`, the scheduled id and the readback. Never the upload URL.

## When something is missing

Without a Threadify connection, measure the video, say where it would fit, and say: "Connect Threadify at threadify.app to have the post written and the video scheduled." Without generation access (HTTP 402 or no quota left), stop and say what ran out. Never write the post yourself instead.

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
