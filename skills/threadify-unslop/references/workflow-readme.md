# Threadify Unslop

"AI doesn't make your posts slop. Polish does."

Use the complete [installable skill](../../skills/threadify-unslop/SKILL.md). In Claude Code type `/threadify-unslop`. In Codex type `$threadify-unslop`.

Unslop reads your last 90 days of Threads posts and scores every one on four slop families: corporate and LinkedIn voice, AI tells, over-formatting and hedging. Hedging weighs three times the rest. Each post lands in one of two classes. Raw: zero hedges and at most one other marker. Polished: everything else.

Then it puts raw against polished on your own numbers: median views for each class, labelled "on your account", plus your five worst offenders with the exact phrases that flagged them. If your polished posts won, Unslop says so.

Threadify then writes three new posts in the shape of your best raw posts. Every post runs through a zero-hedge gate. Zero means zero: no `might`, no `maybe`, no `i think`, no both-sides, no closing question that dodges the take, no disclaimers, no soft asks. A post that fails goes back to Threadify with the reasons, three attempts in total. Your agent never rewrites a word. The one change it makes is lowercasing, and a casing guard proves `lower(original) == lower(final)`.

Each post gets a tracked Auto Plug for your saved offer, and the plug passes the same gate. You see one approval packet. Nothing is scheduled until you say "yes", and nothing is published immediately.

No post history? Paste 5-20 posts or drafts. You get the flags and the offenders, labelled with no view comparison, and a prompt to connect Threadify so it writes the three raw posts.

The rules, with sources, live in [slop-markers.md](../../skills/threadify-unslop/references/slop-markers.md). A scheduled post is not a published post.
