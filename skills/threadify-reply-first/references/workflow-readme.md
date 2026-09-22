# Reply First

Experimental, not release-ready: the held-out experiment failed its critical-question recall and speed requirements. Read [the measured results and limits](EXPERIMENT.md) before using or demonstrating this candidate. Do not replace a working inbox process with it on a speed claim.

Reply First turns recent comments on your own Threads posts into a private review queue. It keeps category and offer relevance separate, shows the comment with its parent-post context, and sorts by category before recency. It never sends a reply.

The five category labels are fixed:

- `direct_question` - the person directly asks for help, instructions, clarity or product information.
- `relevant_problem` - the person describes their own unresolved problem that fits the confirmed offer, without directly asking for help.
- `conversation` - praise, agreement, jokes, advice, rhetorical questions or unrelated discussion.
- `promotion` - spam or promotion of the commenter's product, service, account or unrelated link.
- `uncertain` - missing context, mixed signals, sensitive content or anything that needs human review.

Offer relevance is a separate yes-or-no decision. A relevant comment is not proof of purchase intent, permission to message someone or permission to send a public reply.

## Install and set up

Development status: this replacement workflow has not been publicly released or shown a measured speed improvement. The install command below installs the published catalog; it will include Reply First only after a verified release. Do not use this draft as a filming-ready installation claim.

Install the current workflow catalog for Codex:

```sh
npx --yes github:lennoxsaint/Threadify-workflows install --workflows all --targets codex
```

Change `codex` to `claude` for Claude Code. Then run the portable setup and doctor commands:

```sh
threadify_cli="${THREADIFY_WORKFLOWS_HOME:-$HOME/.threadify-workflows}/current/cli/bin/threadify-workflows.mjs"
node "$threadify_cli" reply-first setup
export AI_GATEWAY_API_KEY="your Vercel AI Gateway key"
node "$threadify_cli" reply-first doctor --privacy zdr
```

These commands use the checksummed CLI installed with the workflow, not a fresh checkout of GitHub main. They require a release that actually includes Reply First; the currently published catalog does not yet provide it.

Choose `zdr` or `non-zdr` yourself. Do not infer consent from a prior run. Setup uses environment variables or your host's secret manager and a private state directory you choose.

File replay works without a Threadify connection. Direct live retrieval needs `THREADIFY_MCP_TOKEN` for a connected Threadify account with the required read scope. Keep it in the local environment or a secret manager, never in chat, input JSON or logs. Check current provider pricing before a paid run instead of relying on a promotion.

## Private input

Save the input outside a public repository. The offer must be supplied or confirmed by the creator. Each comment needs its actual parent-post text and source links:

```json
{
  "account": "example_creator",
  "offer": "A short setup review for creators who need a clear reply workflow",
  "comments": [
    {
      "id": "comment-example-1",
      "text": "how do you decide which question to answer first?",
      "parent_text": "I stopped treating every reply as the same job.",
      "url": "https://example.invalid/comments/comment-example-1",
      "parent_url": "https://example.invalid/posts/post-example-1",
      "created_at": "2026-01-15T04:30:00.000Z",
      "owner_already_replied": false
    }
  ]
}
```

Run the file through Jev and keep state in an absolute private directory:

```sh
node "$threadify_cli" reply-first run \
  --input /absolute/private/reply-first-input.json \
  --state /absolute/private/reply-first-state \
  --privacy zdr
```

`run --input` is a **file replay**. Its receipt uses `file_replay`. Exporting fresh comments immediately before the command does not turn the timed CLI run into live retrieval. A result can be called **live retrieval** only when a connected source adapter retrieves the comments and parent context inside the same measured run; that receipt uses `live_adapter`. Keep those states separate in receipts and filming.

For a matched benchmark, `--input FROZEN_INPUT --live-cohort PRIVATE_MANIFEST` is the explicit exception: the file declares the cohort, but every comment is freshly retrieved inside the run. The manifest contains the normalized input hash and `posts: [{post_id, parent_url}]` from verified source records, never guessed IDs. Optional `discovery_pages: [{days, limit, posts_offset}]` enables up to four bounded bulk listing pages before per-post recovery. Each page is capped at 30 posts. Both routes must use the same manifest. Changed, missing or already-handled frozen comments stop the trial instead of being substituted. This needs `THREADIFY_MCP_TOKEN` and the same explicit data-transfer approval as any live run. Bulk retrieval time and pagination remain inside the measured run.

The result retains every processed item, including uncertain and low-priority comments. Duplicate IDs and comments already marked `owner_already_replied: true` are excluded with reasons. The local review page shows the actual comment, parent post, links, category, offer relevance, uncertainty and source mode. It offers no send button.

Direct live retrieval omits `--input` and supplies the account, confirmed offer and retrieval bounds:

```sh
node "$threadify_cli" reply-first run \
  --state /absolute/private/reply-first-state \
  --privacy zdr \
  --account example_creator \
  --offer "A short setup review for creators who need a clear reply workflow" \
  --days 14 \
  --count 100
```

This path uses `THREADIFY_MCP_TOKEN` and records `live_adapter`. It combines retrieval and evaluation in one command. Before invoking it, disclose that comment text, parent-post text and the confirmed offer will reach the selected provider. Show the account, date window, maximum item count, privacy route and zero-send boundary, then get explicit one-time authorization for that bounded run. Do not reuse that authorization for another account, window, count or privacy route.

Selection is bounded, not a claim to scan every comment in the date window. The reader selects unhandled comments in provider order from text-only parent posts. Image/video posts and posts with unknown media type are excluded with reasons because their necessary visual context is unavailable. Pagination uses up to four concurrent post reads; the last wave may retrieve extra comments, and the receipt reports that over-read. A comment arriving on an older post outside the post window may be missed.

## Benchmark

Use a frozen, reviewed dataset and the same required outputs for each route:

```sh
node "$threadify_cli" reply-first benchmark \
  --input /absolute/private/reply-first-benchmark.json \
  --labels /absolute/private/reply-first-labels.json \
  --baseline-model provider/model-version \
  --state /absolute/private/reply-first-benchmark-state \
  --privacy zdr
```

Without `--browser`, the CLI returns `diagnostic_only`: it does not measure browser rendering. Add `--browser` and open the private localhost URL printed by the command to observe each queue after actual browser rendering. The observer serves only the current review, has a random session path, binds to localhost and makes no public writes. Keep its URL private. File replay still does not include live retrieval, and missing correction timing prevents a speed win. Use a fresh benchmark state directory; previous trial evidence is never overwritten. Benchmark output is evidence, not a promised speedup. Keep warm-up, uncached measured runs, retries, failures, retrieval time, classification time, rendering time and correction time visible. Do not publish private comment bodies or claim a speed or quality win until the full acceptance gate passes.

The bundled `references/challenge.json` contains explicitly synthetic cases and expected labels. Its reviewer metadata records the development reference process, not a publicly independently audited result, creator acceptance or model accuracy. Both repaired routes passed that challenge but failed held-out direct-question recall; see `EXPERIMENT.md`. Run `reply-first challenge --fixture /absolute/challenge.json --state /absolute/private-directory --privacy zdr` to evaluate the selected provider uncached. Add `--provider llm --model MODEL --reasoning-effort minimal` for a supported baseline. The command assigns neutral IDs and withholds expected category/relevance labels from provider input. It enforces question recall, category and relevance accuracy, handled exclusion, ambiguous-case review and no conversation-as-lead errors. Failure returns a nonzero exit code. This synthetic challenge cannot prove live-source speed; do not mix it into the real 100-comment benchmark.

Tune each route on separate development inputs before freezing the benchmark. `--batch-size` selects Jev's batch size (at most 16); `--baseline-batch-size` allows the structured LLM up to 100, subject to its conservative input budget. Both default to 10 and four concurrent requests. Do not impose Jev's question limit on the LLM or select a deliberately slow baseline. Use `--baseline-reasoning-effort minimal` only when supported by the selected model; unsupported settings require an explicit development correction, not a hidden fallback. Development LLM runs accept `--provider llm --model MODEL --reasoning-effort minimal --batch-size SIZE`. The runner records request settings, binds them to its cache and freezes route settings before the benchmark warmup. A model listed in a catalog is not qualified until actual access and task quality pass.

## Troubleshooting

- `account_and_confirmed_offer_required` - add the intended account label and the creator-confirmed offer.
- `handled_status_unknown` - provide `owner_already_replied` as a real boolean for every comment.
- `oversized_comment_requires_review` - review the named item separately; the runner will not silently trim it.
- provider or privacy-route failure - rerun `doctor` for the same chosen route. Do not silently fall back from ZDR to non-ZDR.
- partial result - inspect the missing IDs and retry only failed items. Missing answers remain visible as uncertain.
- wrong source label - treat `run --input` as file replay. Do not call it live retrieval.

The queue is for review. Reply drafting and any public send happen in a separate workflow with fresh account, target, safety and approval checks.
