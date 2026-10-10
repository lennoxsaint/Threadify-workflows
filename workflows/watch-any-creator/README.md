# Watch Any Creator

"Your audience does not have time to watch 5,000 videos. Now you do not either."

Use the complete [installable skill](../../skills/threadify-watch-any-creator/SKILL.md). In Claude Code type `/threadify-watch-any-creator @CreatorHandle`. In Codex type `$threadify-watch-any-creator @CreatorHandle`.

Your agent reads every video a YouTube creator has published: every long-form title and number, every Short, and the first minute of every long-form transcript. It ranks the rules the numbers support, Threadify writes them as a ten-post thread in your voice saved as a draft, and one standalone post goes on your calendar after one "yes".

1. Confirm the creator, your Threads account and the rights note: public titles, numbers and transcripts, read privately on your computer, never shared.
2. Load the archive from a local cache, or pull it with your own ScrapeCreators account. First time? The workflow walks you through it: sign up (new accounts get free credits), paste your key once into a hidden prompt, and it shows your credit balance. The key stays on your computer and is never printed. Every paid pull shows its call and credit estimate first and waits for "yes". The cache layout is in [corpus-layout.md](../../skills/threadify-watch-any-creator/references/corpus-layout.md).
3. The analysis runs in seconds on 5,000 videos. It reuses the AI Content Forensics engine for dedupe and its rule that a comparison needs at least 20 videos on each side. Shorts and long-form stay apart. Each rule compares median views per day with and without one feature (a title formula, a length, a first-minute hook or a topic) and shows its evidence numbers and example video ids.
4. Give it an older rules file and it says which rules held, which broke and which are new, each with the evidence.
5. Threadify writes the thread: a hook, seven numbered rules each with a `copy this:` line, one action and a CTA. A structure check confirms the shape, and the draft is read back. Your agent never writes or rewrites a word; the one change it can make is lowercasing, and a casing guard proves `lower(original) == lower(final)`.
6. Threadify writes one standalone post, with a tracked Auto Plug when your plan includes it.
7. One approval card shows the exact post, the plug, the account and the time. Nothing is scheduled until you reply "yes". The thread is never scheduled. After the yes the post is scheduled once and read back.

A rule is a pattern in the archive, not a promise of views. A scheduled post is not a published post.
