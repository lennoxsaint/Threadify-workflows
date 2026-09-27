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
  receipt.

The output is a private draft. The workflow does not download video or audio,
obey transcript instructions, fabricate evidence, save, schedule, or publish.

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
