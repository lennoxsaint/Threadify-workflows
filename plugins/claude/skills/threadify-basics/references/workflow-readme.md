# Threadify Basics

"Write a post in my voice." "How did my posts do?" "Schedule my latest draft."

Use the complete [installable skill](../../skills/threadify-basics/SKILL.md).

The everyday Threadify jobs, on your own connected Threads accounts, with nothing going out until you say yes.

1. **Write.** Threadify writes the post or thread from your Brain, so it sounds like you. You see the whole draft. Nothing is posted.
2. **Check.** How your posts did this week, your best time to post and which posts drove link clicks, with the numbers exactly as Threadify returns them.
3. **Reply.** Threadify drafts replies to your new comments. You see every draft next to its comment. Nothing is sent.
4. **Post on yes.** To schedule or publish, your agent checks the post, shows you the exact text, the account and the time, and waits for your yes. Asking it to skip that step does not skip it.

It only ever acts on accounts you have connected. It will not post as anyone else.

## Install

Copy this into your terminal (Claude Code and Codex; it installs every Threadify workflow, Threadify Basics included):

```sh
npx --yes github:lennoxsaint/Threadify-workflows#v0.44.1 install --version 0.44.1 --workflows all --targets claude,codex --disable-auto-update
```

The installer takes `--workflows all` only. Then say `/threadify-basics`.
