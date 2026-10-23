# Scheduler Showdown

"Every scheduler has an AI connection now. Only one of them knows who you are."

Use the complete [installable skill](../../skills/threadify-scheduler-showdown/SKILL.md).

A fair, blind test of which social media scheduler your AI agent actually knows you through: your numbers, your voice, your sales. It runs on the tools you connect, so nobody has to trust the founder.

Threadify Workflows are made by Threadify's founder, so this test is built to be checked, not trusted.

1. **Check-in.** Your agent lists the schedulers you have connected (Threadify, Buffer, Metricool, Typefully, Eden, BlackTwist, Hootsuite, Publer), asks which ones you pay for, gives the connector link for any that are missing, and reads each tool's public pricing page.
2. **Rules locked.** [The five tests](../../skills/threadify-scheduler-showdown/references/rules.md) are public. Your run copies them, hashes them and prints the hash before any tool is touched.
3. **The run.** The same five prompts, word for word, go through each tool's own AI connection: find my best post and why it worked, write tomorrow's post in my voice, schedule it at my best time, add a tracked link to my offer, and how many clicks did last week's links get. Every raw reply is saved. Test posts are scheduled 60 days out.
4. **Blind.** The replies are shuffled into Tool A to F with every name, handle and link removed. The key is sealed and its hash printed.
5. **Outside judge.** A different model (Codex when you have it, otherwise a fresh Claude, labelled) grades each cell pass, partial or fail with one line of evidence. It sees only the rules and the blind replies.
6. **Scorecard.** Tools by tests, then price, free plan and networks, read live from each pricing page. A row Threadify loses is never hidden.
7. **Unblind.** The key hash is checked first; if anything changed, it refuses. Then the names appear and the verdict is one line, honest about ties.
8. **The real job.** The winner does one real post: written in your voice, only lowercased (a guard proves nothing else changed), scheduled at your best time with an Auto Plug from your existing offer, after one yes.
9. **Cleanup and report.** Every test post is deleted and read back as gone. A Threadify report page shows the scorecard, the rules hash, the judge model, what each tool did, and how to run it on your own tools.

It's free: it runs in your agent on your computer, and each tool's test runs on your own account for that tool. If it helped, star [Threadify Workflows on GitHub](https://github.com/lennoxsaint/Threadify-workflows) so the next creator finds it.

## Install

Copy this into your terminal (Claude Code and Codex; it installs every Threadify workflow, Scheduler Showdown included):

```sh
npx --yes github:lennoxsaint/Threadify-workflows#v0.44.1 install --version 0.44.1 --workflows all --targets claude,codex --disable-auto-update
```

The installer takes `--workflows all` only; choosing a single workflow such as `--workflows scheduler-showdown` is not supported. Then connect the schedulers you pay for and say `/threadify-scheduler-showdown`.
