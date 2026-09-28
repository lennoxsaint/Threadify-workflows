# YouTube Synthesizer

YouTube Synthesizer turns one YouTube URL into three evidence-backed hooks and one
complete long-form Threads draft in the creator's voice. It scores twelve
immutable structures across Authority, Investigation / Data, Wisdom, and Playbook
/ Case Study, then uses only transcript-supported placeholder values.

## What ships

- twelve genuinely distinct, word-for-word hook and body skeletons;
- three attributed, permission-cleared originals for every template;
- a human-readable gallery with every exact original grouped under its template;
- no-key public-caption extraction using `youtube-transcript`;
- optional caption-only `yt-dlp` fallback with `--skip-download`;
- pasted TXT, VTT, and SRT fallback;
- Threadify Brain voice context when connected, or three approved samples;
- all-template scoring, evidence references, hard abstention, and a body-free
  receipt;
- a separate hash-bound delivery module for approved Threads scheduling or
  publish-now, with exact provider readback;
- one optional owner-supplied first-post image with its own transfer approval;
- a private manual handoff when the current Threadify connector cannot deliver.

Synthesis always produces a private zero-write draft. It does not download video
or audio, obey transcript instructions, fabricate evidence, save, schedule, or
publish. Optional delivery is a separate `youtube-synthesizer-delivery.v1`
transaction that starts only after the exact thread is approved.

## Run locally

From the source repository, run `node lib/youtube-synthesizer-cli.mjs`. From an
installed skill directory, run `node scripts/youtube-synthesizer-cli.mjs`:

```bash
node lib/youtube-synthesizer-cli.mjs extract --url "https://www.youtube.com/watch?v=VIDEO_ID" --out transcript.json
node lib/youtube-synthesizer-cli.mjs synthesize --input input.json --out output.json
node lib/youtube-synthesizer-cli.mjs validate --input output.json
```

Use `--pasted transcript.vtt` when captions are unavailable. Add
`--allow-yt-dlp` only when the local executable is trusted; the runtime invokes
caption flags with media downloading disabled.

## Optional Threads delivery

Default to best-time scheduling. Fresh-read the exact account, timezone,
capabilities, best-time evidence, validation, account-wide Auto Repost state,
and calendar before preparing the immutable approval packet. Publish-now is
available only when explicitly selected and currently advertised by Threadify.

The packet binds every ordered post, account, action, time and timezone, optional
image hash/reference, visible automation state, and stable idempotency key. One
local owner image needs separate approval before upload and a second final
approval after its provider URL is known. Persist intent before the write,
dispatch once, then require exact `get_schedule_status` plus calendar readback or
`get_publish_status`. An ambiguous result blocks retry. The module never
regenerates copy, adds a plug, enables per-post reposting, cross-posts, or changes
global preferences.
