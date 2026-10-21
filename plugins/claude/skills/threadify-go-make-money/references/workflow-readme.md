# Go Make Money

"go make money: get me to 1,000 paying members by Dec 31."

Use the complete [installable skill](../../skills/threadify-go-make-money/SKILL.md).

Give Claude your real goal, not a task. "Claude, go make money" usually fails because Claude can't see the money. Threadify gives it eyes (your raw posts, tracked clicks, signups and offers) and hands (your offer, the Auto Plug and a scheduled post).

**Find the money**

1. **The goal.** Your number, what you count and the date. A script works out the weekly pace: `ceil((goal - current) / weeks left)`. If you don't know your current number, it says UNKNOWN and "needs real baseline".
2. **What makes you money.** It reads your tracked links and offers and says where your clicks, signups and sales actually go. You confirm it, or tell it what people really pay you for.
3. **All the data.** Your last 30 days through Threadify, row by row, plus the page your links land on. If something that would help is not connected yet (conversion tracking, your payment tool, site analytics, YouTube analytics, your site's code), it tells you what each one unlocks and carries on.
4. **The leak.** A script builds the funnel (views, clicks, signups, paid) and names the single biggest drop, with the exact rows behind it and what closing it could be worth at a rule-of-thumb rate.
5. **Your belief, tested.** It asks "why do you think this happens?" and checks your answer against the rows: supported, not supported or unknown.
6. **An outside judge.** A different model (Codex when you have it, otherwise a fresh Claude that never saw the chat) gets only the diagnosis and the raw table, and agrees or disputes. Disputes are shown, not hidden.
7. **The short seller.** The 3 claims on your offer or page a skeptical buyer would doubt, each with the evidence.

**Plan it with you**

8. **The action plan.** Three actions that fit your setup (no coding needed: your Auto Plug, your existing offer, a post, page copy you can paste; a pull request only if your site's code is open). "Here's what I'll do, in this order, and why. OK?" You push back until it's right.

**Ship the post**

9. **A post built on a proven structure.** It copies the whole shape of a post that already worked (your greatest hits, your Threadify Vault, the Viral Vault, your own posts that drove the most clicks), and Threadify writes it in your voice: a hook with a benefit for most readers, diary energy, and a big so-what ending.
10. **An Auto Plug built from your best CTAs.** It reads the plugs that got the most clicks and writes one in the same shape, pointing at your existing offer. It never creates a new offer per run.
11. **One yes.** You see the post and the plug in full, in chat. Say yes and it's scheduled at your next best time, then read back.

**Keep score and celebrate**

12. **It remembers.** A goal ledger on your computer. Next time, it grades this fix on the same numbers before anything else.
13. **Your celebration page.** A Threadify page with confetti: your progress to the goal, the achievements you unlocked, why the leak mattered, why it's a big deal, what was done, your post, the next step and a link to the full diagnosis.
14. **A Claude check-in.** Say yes and Claude checks in about a week after the post goes out (a scheduled task in your app, or a calendar reminder), reads your numbers again and grades the fix.

No revenue or customer promises: unknown stays unknown, and clicks are "attributed", never "caused".

It's free: it runs in your agent on your computer, and the reads, the offer and the post run on your Threadify account. If it helped, star [Threadify Workflows on GitHub](https://github.com/lennoxsaint/Threadify-workflows) so the next creator finds it.

## Install

Copy this into your terminal (Claude Code and Codex; it installs every Threadify workflow, Go Make Money included):

```sh
npx --yes github:lennoxsaint/Threadify-workflows#v0.42.0 install --version 0.42.0 --workflows all --targets claude,codex --disable-auto-update
```

The installer takes `--workflows all` only; choosing a single workflow such as `--workflows go-make-money` is not supported. Then say "go make money: get me to <N> paying <customers/members> by <date>".
