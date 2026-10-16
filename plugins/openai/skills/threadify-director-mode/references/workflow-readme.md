# Director Mode

"Stop editing. Start directing."

Use the complete [installable skill](../../skills/threadify-director-mode/SKILL.md).

You have one raw talking-head video. Director Mode makes four better versions, one level at a time, and after each one prints a one-line scoreboard: the level, what changed, the length and the file. Your original file is never touched; every version lands in a `director/` folder next to it.

1. **Speed.** Your agent transcribes the video with word timings, cuts dead air longer than 0.3 seconds down to about 0.1, and removes retakes, keeping your last clean take. No word is clipped at a cut.
2. **Altitude.** The goal is a video people finish. Your agent picks your strongest proof line, moves it to second 1 when that keeps the meaning, and cuts anything that doesn't serve the viewer.
3. **Depth.** An outside judge that has never seen the conversation or the edit plan scores your first 3 seconds out of 10 (12 words or fewer, proof, curiosity, specificity, relevance, no preamble, one breath). Your agent fixes the top fault and a new judge scores it again. You see both scores.
4. **Range.** The crew: up to 4 free sound effects from Openverse (public domain by default, about 15 LU under your voice and never on top of a word), burned word-highlight captions (lowercase, 3 words at a time) and one title card. The final is a 1920x1080 MP4 under 95 MB, checked by re-transcribing it.

Then, if you want, Threadify writes the post in your voice, uploads the final video and shows you one post card with the time. It schedules only after your exact "yes" and reads the schedule back. It never publishes now.

It's free: ffmpeg, whisper.cpp and Openverse run on your computer at no cost. Only the optional Threadify post uses your plan. Raw video, audio and transcripts never leave your computer; the judge sees a few still frames and the words, and only the finished video is uploaded, for the post.
