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
