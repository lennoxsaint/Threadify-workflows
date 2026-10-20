# Go Make Money

"go make money: get me to 1,000 paying members by Dec 31."

Use the complete [installable skill](../../skills/threadify-go-make-money/SKILL.md).

Give Claude your real goal, not a task. "Claude, go make money" usually fails because Claude can't see the money. Threadify gives it eyes (your raw posts, tracked clicks, signups and offers) and hands (the offer, the Auto Plug and a scheduled post).

1. **The goal.** Your number, what you count and the date. If your current number isn't readable, it asks once. A script works out the weekly pace: `ceil((goal - current) / weeks left)`. If you don't know your current number, it says UNKNOWN and "needs real baseline".
2. **The raw data.** Your agent reads your last 30 days through Threadify, row by row: every post, every tracked link and its clicks and signups, your offers and your conversion setup, plus the page your links land on. Add your own files to a `data/` folder (for example YouTube analytics with average % viewed and when your call to action happens). A script builds the funnel: views, clicks, signups, paid.
3. **The leak.** The single biggest drop, with the exact rows behind it.
4. **Your belief, tested.** It asks you one question: "why do you think this happens?" Then it checks your answer against the rows: supported, not supported or unknown. It can check "my link lands on a page that doesn't match what I promised" (your words vs the page's words) and "people don't get far enough to see my call to action" (your retention data).
5. **An outside judge.** A different model (Codex when you have it, otherwise a fresh Claude that never saw the chat) gets only the diagnosis and the raw table, and agrees or disputes. Disputes are shown, not hidden.
6. **The short seller.** The 3 claims on your offer or page a skeptical buyer would doubt, each with the evidence that would make them doubt it.
7. **Three decisions**, each with arguments for and against, ranked by impact on paid conversion, speed and how easy it is to undo.
8. **Fix #1, after one yes.** It shows the exact change and asks once: fix the offer, Auto Plug and tracked link so they match your promise; or have Threadify write one post about the decision and schedule it at your best time; or, if your site's code is open in the session, open a pull request with a small page change (never merged for you).
9. **It remembers.** A goal ledger on your computer. Next time, it grades yesterday's fix on the same numbers before anything else.

You get a local report page with the funnel, a big leak card, the verdicts, the decisions and the fix. No revenue or customer promises: unknown stays unknown, and clicks are "attributed", never "caused".

It's free: it runs in your agent on your computer, and the reads, the offer and the post run on your Threadify account.

## Install

Copy this into your terminal (Claude Code and Codex; it installs every Threadify workflow, Go Make Money included):

```sh
npx --yes github:lennoxsaint/Threadify-workflows#v0.40.1 install --version 0.40.1 --workflows all --targets claude,codex --disable-auto-update
```

The installer takes `--workflows all` only; choosing a single workflow such as `--workflows go-make-money` is not supported. Then say "go make money: get me to <N> paying <customers/members> by <date>".
