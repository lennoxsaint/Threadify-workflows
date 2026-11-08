---
name: threadify-director-mode
description: Stop editing. Start directing. Turn one raw talking-head video into a finished post in four levels - Speed (cut dead air and retakes), Altitude (move the strongest proof line to second 1), Depth (an outside judge scores the first 3 seconds, the agent fixes the top fault) and Range (sound effects, word-highlight captions and a title card) - with a one-line scoreboard after each, then Threadify writes the post in your voice and schedules it with the video only after one exact yes. Free and local; your original file is never touched. Use when someone has a raw clip, wants it edited for them, says "director mode", or asks to turn a talking-head take into a post.
---

# Director Mode

Stop editing. Start directing. You give the agent one raw talking-head video (60-90 seconds is typical). The agent makes four better versions, one level at a time, and tells you after each what changed in one line. You make the calls; the agent does the cutting.

It is free. Everything runs on this computer with free tools (ffmpeg, whisper.cpp and free sound effects from Openverse). Only the optional last step uses Threadify: writing the post and scheduling it.

Follow [Threadify-001: setup and first-loop video](references/threadify-001.md) before the first connected call. A connection never authorizes uploading or scheduling. Only the owner's exact "yes" to the post card does.

Resolve `scripts/` and `references/` paths against the directory containing this SKILL.md. The script is `node scripts/director-mode.mjs` (Node 18+, no npm packages); every command prints JSON.

## Rules

- Follow the demo feedback rules at the end of this file for the whole run. If `~/.threadify/owner-overlay.md` exists, read it too and follow it; it is private, so never quote it into posts, files you publish or receipts.
- **Never touch the original.** Every version goes into a `director/` folder next to it (`v1.mp4`, `v2.mp4`, `v3.mp4`, `final.mp4`). The script refuses to write over its source.
- **Raw media stays on this computer.** Never upload the raw video, the audio or the transcript anywhere. The outside judge gets only a small folder of still frames and words. Only the finished video is uploaded, and only to Threadify for the post.
- **The agent directs, the script cuts.** Judgement (what is the proof, what to cut, what order) is yours; timings, joins and loudness come from the script. Never hand-edit timestamps.
- **No clipped words.** Every cut keeps room tone around speech (about 0.1 s at each join). If `verify` reports a word missing at a cut that ran through sound, fix it before showing the final.
- **Sounds.** At most 4 short sounds. CC0 or public domain by default. CC BY only when the owner opts in, and then its credit line goes in the post. Never NC, ND or SA. Sounds sit about 15 LU under the voice (never less than 12) and their loud start never lands on a word onset.
- **Openverse limits.** No key; at most 20 requests a minute and 200 a day; page size 20. The script waits between calls and caches every search and sound; reuse the cache.
- **Posting.** Threadify writes the post. The agent may only lowercase it, keeping proper nouns, and proves `lower(original) == lower(final)` with `scripts/casing-guard.mjs`. Never publish now. Schedule only after the owner's exact "yes" to the post card, then read it back.
- After every level, print the scoreboard line from the script's `scoreboard` field: `L1 Speed | cut 7 gaps, 5 retakes | 19.0s | director/v1.mp4`.

## Steps

1. **Check.** Run `node scripts/director-mode.mjs check`. It finds ffmpeg, ffprobe, whisper-cli, the ffmpeg filters it needs and a speech model. If `ok` is false, follow its `fixes` yourself and say what you're doing. A missing model is a free 148 MB download: run `node scripts/director-mode.mjs model get`, which saves `ggml-base.en.bin` to `~/.threadify/director-mode/models/` (`model get --name ggml-small.en.bin`, 488 MB, is more accurate). Pass `--model <path>` to use another file. Tell the owner in one line: "Four levels: speed, altitude, depth, range. Your original stays untouched."
2. **Level 1 · Speed.** `transcribe <video>` (word timings from whisper.cpp; each stretch of speech is transcribed on its own so words land in the right place), then `cut-plan <video> --words director/<name>.words.json`. The plan shrinks dead air over 0.3 s to about 0.1 s, drops clicks and filler-only bits, and cuts retakes: when a line is restarted, the last clean take stays. Read its `retakes`; if one is not a real restart, re-run with `--keep-retake r2`. Then `render --plan director/plan.json --out director/v1.mp4 --level 1 --label Speed`. Print the scoreboard.
3. **Level 2 · Altitude.** The goal is a video people finish. Read the plan's `lines`. Pick the strongest proof line (a number, a result, something the viewer can check) and move it to second 1 when that doesn't break the meaning. Cut every line that doesn't serve the viewer (preamble, "so", repeats, half-thoughts). Trim inside a line with `{"id": "L4", "start_word": 2}` or `"end_word"`. Write `director/altitude.json` as `{"order": ["L8", "L2", ...], "why": "<one line>"}` and `render --plan director/plan.json --order director/altitude.json --out director/v2.mp4 --level 2 --label Altitude --changed "<what you changed>"`. Print the scoreboard.
4. **Level 3 · Depth.** Get an outside opinion on the first 3 seconds. Run `transcribe director/v2.mp4` and `contact-sheet director/v2.mp4 --words director/v2.words.json --out director/judge-1`. That folder holds `rubric.md`, a 1-frame-per-second contact sheet, 6 frames of the first 3 seconds and the words. Start a **fresh** judge that has never seen this conversation, the script or the plan: a new host subagent (default), or an external model CLI the owner has, given only this prompt: "Read <folder>/rubric.md and follow it exactly. Use only the files in that folder. Reply with the JSON only." It scores the opening out of 10 on: 12 words or fewer, proof on screen, curiosity, specificity, viewer relevance, no preamble, one breath. Fix its `top_fault` (reorder, trim, or plan the proof for the title card), render `director/v3.mp4` with `--level 3 --label Depth`, build `director/judge-2` and ask a **new** cold judge. Print both scores: "Judge: 4/10 -> 7/10". If the score did not go up, say so plainly and continue with the better version.
5. **Level 4 · Range.** Bring in the crew on the chosen version (`vN`):
   - Run `transcribe director/vN.mp4` so cues and captions use its own timing.
   - **Sound designer.** `sfx search "whoosh" --max-seconds 2` and `sfx search "pop" --max-seconds 1.5` (add `--allow-by` only on the owner's opt-in), pick at most 4, `sfx fetch <id> --dir director` for each (it writes `director/credits.json`: title, creator, licence, url). Write `director/cues.json` as `{"cues": [{"file": "sfx/<id>.wav", "at": <seconds>, "why": "whoosh on the cut"}]}` (whoosh on a cut from `director/vN.mp4.edl.json` `joins`, pop on a key word) and run `mix director/vN.mp4 --cues director/cues.json --words director/vN.words.json --out director/mix.wav`. It moves any cue off a word onset and must report `pass: true` with `sfx_under_speech_lu` of 12 or more.
   - **Captions.** `captions --words director/vN.words.json --out director/captions.ass`: burned word-highlight captions, lowercase, at most 3 words at a time.
   - **Motion.** One title card that puts the proof on screen in a few words. With HyperFrames available (`npx hyperframes@0.8.77`), render a transparent 1920x1080 overlay and pass `--overlay title.mov`; otherwise pass `--title "<text>"` and ffmpeg draws it.
   - `finalize director/vN.mp4 --audio director/mix.wav --captions director/captions.ass --title "<text>" --out director/final.mp4` (1920x1080, 30 fps, at most 95 MB). Then `verify --final director/final.mp4 --ref director/vN.mp4.edl.json --edl director/vN.mp4.edl.json`: it decodes the whole file, checks the format and size, re-transcribes the final and checks every cut edge for sound. Fix anything that fails, then print the scoreboard and open `director/final.mp4` for the owner.
6. **Post it with Threadify (optional).** Offer once: "Want Threadify to write the post and schedule it with this video?" Only on yes, follow [the post step](references/post.md).

## When something is missing

No whisper-cli or model: say exactly what is missing and run the fix from `check`. No libass in ffmpeg: captions can't be burned; say so and finish without them. Openverse down or over its limit: use cached sounds or none, and say so. No subagent and no external CLI: say the judge is unavailable and skip to Level 4; never judge your own work as the outside judge. No Threadify connection: stop after the final video. A rendered video is not a posted one, and a scheduled post is not a published post.

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
