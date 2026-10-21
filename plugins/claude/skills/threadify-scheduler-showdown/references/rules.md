# Scheduler Showdown: the rules

Threadify Workflows are made by Threadify's founder, so this test is built to be checked, not trusted.

These rules are public and fixed before any run. Each run copies this file to `showdown/<date>/rules.json`
with its sha256 and a timestamp before the first tool call, and prints the hash. If this file changes, the
hash changes, so anyone can check that a run used the published rules.

## The five tests

The prompt text is fixed. Every tool gets the same prompt, word for word, sent through that tool's own MCP.

| # | Prompt sent through each tool's own MCP | Pass | Partial | Fail |
|---|---|---|---|---|
| T1 | "Find my best post from the last 30 days and tell me why it worked." | names a real post from the account with a real metric from the tool's own data | finds posts but no metrics, or older than 30 days | can't read my posts |
| T2 | "Write tomorrow's post from that, in my voice." | the TOOL's own generation, grounded in my history/voice profile | tool drafts generic copy | tool has no generation (Claude would have to write it) |
| T3 | "Schedule it at my best time." | tool computes the best time from my own data and schedules | schedules but at a time I or Claude chose | can't schedule |
| T4 | "Add a tracked link to my offer." | tool attaches a tracked link/CTA to an offer it already knows | link added but not tracked, or offer must be typed in | can't |
| T5 | "How many clicks did last week's links get?" | real click numbers from the tool's own tracking | totals without per-link detail | can't |

Demo safety for T3: competitor test posts are scheduled at the computed best time-of-day **60 days out**, then
deleted in cleanup. Threadify's T3 in the showdown is also scheduled 60 days out and cancelled; the real post
happens only after the showdown, with one yes.

## Same everything

1. Same account, same session, same prompt text word for word for every tool. Nothing is reworded per tool.
2. Each cell uses only that tool's own MCP tools. Claude does not fill a gap for a tool: if Claude would have
   to write, compute or track something itself, the tool did not do it.
3. A tool whose MCP lacks a capability scores fail, with the reason quoted from its own tool list.
4. A tool with no AI connector connected is scored "no AI connection connected" in every cell, and the run
   names the connector URL to add.
5. A retry is allowed only after an error. The first real reply is the one judged, and every attempt is kept.

## The blind judge

1. Raw replies are anonymised to Tool A to Tool F (a seeded shuffle). Tool names, handles and links are removed
   from every reply. The key is sealed in `key.json` and its sha256 is printed before judging.
2. An outside model grades: `codex exec -s read-only` first (the run records the model it actually used),
   otherwise a fresh Claude instance with no prior context, labelled as such.
3. The judge sees only these rules and the anonymised replies. It grades each cell pass, partial or fail with
   one evidence line.
4. Unblinding verifies the key's sha256 first. If the key changed, the run refuses to unblind.

## Scoring

- Pass is 2 points, partial is 1, fail is 0. "No AI connection connected" is 0. The most a tool can score is 10.
- The verdict is one line and honest about ties: equal points is a tie, never a winner.

## Losses shown

The scorecard always includes price, free plan and networks rows, read live from each tool's public pricing page
(URL and date). No row is hidden because Threadify loses it.

## Run it yourself

Install Threadify Workflows, connect the schedulers you pay for, and say `/threadify-scheduler-showdown`. The
rules above are the ones your run will lock and hash.
