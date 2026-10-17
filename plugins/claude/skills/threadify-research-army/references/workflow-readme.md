# Research Army

"Get a research post on your niche."

Use the complete [installable skill](../../skills/threadify-research-army/SKILL.md).

An army of Haiku 5.5 agents and one Opus 5.5 race to research the most-liked recent Threads posts in your niche; a script checks every claim; Threadify writes the post from the winner and schedules it after one yes.

1. **The corpus.** Your agent searches Threads through ScrapeCreators with 25-30 keyword variants of your niche, keeps the last 30 days, removes duplicates and non-English posts, and keeps the 100 most-liked. It says exactly what that is: "the 100 most-liked recent Threads posts from 28 keyword searches (last 30 days)". There are no view counts, so it never says "most viewed".
2. **The race.** Both sides get the same brief, the same posts and Read-only tools; nobody gets Bash or any way to run code, and the script proves it from each run's own log. They pick the 8 patterns they think matter most from a fixed catalog the checker owns (opens with a number, asks a question, length, first person "I", lists and line breaks, names an AI tool, has a link, a $ amount, emoji, all lowercase and more) and count them. The army works in two rounds: 20 Haiku scouts nominate patterns, the commander picks 8, then every scout counts those 8 in its batch and the commander adds them up. Opus does the same alone over all the posts. A live terminal view shows both lanes.
3. **The check.** A script recounts every claim over all the posts. The scoreboard shows backed claims (exact and within ±1), cost, wall time and the models each side really used, plus a local HTML report. Winner: most backed claims, then lower cost, then faster.
4. **The post.** Threadify writes one research post in your voice from the winner's backed findings only, with the checker's numbers and a tracked link when you have an offer. You can edit it in an editable block and press Done editing. It's scheduled for the best time tomorrow only after your exact "yes", and read back. Nothing publishes now.

It's free: the race runs in Claude Code on your computer (a few cents to about a dollar of model time from your Claude plan). The corpus uses about 25-30 ScrapeCreators credits from your own account (new accounts get free credits), and the post step runs on Threadify.
