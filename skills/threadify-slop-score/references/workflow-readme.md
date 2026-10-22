# Slop Score

"Can you tell your own posts from AI slop?"

Use the complete [installable skill](../../skills/threadify-slop-score/SKILL.md).

A blind test on your own Threads posts. Five of your real posts meet five plain-AI twins on the same topics, and you swipe all ten without knowing which is which. It needs only your connected Threadify account: no questions to start.

1. **Read.** Your agent reads your posts from the last 30 days and picks 5 on 5 different topics. Only your own posts, never anyone else's.
2. **AI twins.** For each topic it writes what plain Claude writes for "write a Threads post about <topic>" with no context about you. Each one is labelled "AI twin · plain Claude, no context" at the reveal.
3. **Blind swipe.** The ten cards are shuffled with a stored seed and shown one at a time. You tap "human" or "slop" for each. Nothing is revealed until the end.
4. **Reveal.** Your hit rate (X of 10 right) and a Slop Score from 0 to 100 for every card, with the exact words that were flagged. The scorer is [Unslop's](../unslop/README.md) four tells: hedging, AI phrases, corporate voice and over-formatting. You see the average for your posts against the AI twins.
5. **Fix.** Threadify writes the worst twin's topic again from your Brain, with the same prompt. It is only lowercased (a guard proves nothing else changed) and scored the same way, for example "slop 60 -> 0".
6. **Schedule on yes.** You see the post and its Auto Plug in full. The plug sells the offer you already have and ends with its plain link. Say "yes" and it is checked, scheduled at your next best time and read back, with how to undo it. Nothing is scheduled without your yes.

It's free: it runs in your agent on your computer, and the post is written and scheduled by your own Threadify account. If it helped, star [Threadify Workflows on GitHub](https://github.com/lennoxsaint/Threadify-workflows) so the next creator finds it.

## Install

Copy this into your terminal (Claude Code and Codex; it installs every Threadify workflow, Slop Score included):

```sh
npx --yes github:lennoxsaint/Threadify-workflows#v0.43.1 install --version 0.43.1 --workflows all --targets claude,codex --disable-auto-update
```

The installer takes `--workflows all` only; choosing a single workflow such as `--workflows slop-score` is not supported. Then say `/threadify-slop-score`.
