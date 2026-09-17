# Anti-Spam Lead Desk

Turn a small, current set of public Threads signals into a reviewable desk without pretending that a lead is qualified, a message was sent, or revenue happened.

## Route A: warm inbound

1. Confirm the correct Threadify account and a confirmed offer.
2. Discover the available comment/reply-read capability at runtime; do not assume a tool name.
3. Read comments from one to three owner-selected, owned Threads posts. For an explicitly requested account-wide period, scan that bounded period and state any coverage limits; a provider `days` filter may select posts by publication date rather than all comments written during the period.
4. Keep only explicit, offer-relevant problem/help signals. Reject already-replied comments, generic praise, seller funnels, stale or duplicate signals, and ambiguous context. Historical examples requested when nothing is pending are filter examples, not send targets.
5. Open each shortlisted profile in the authenticated Threads browser and record current public context, URL, and timestamp.
6. Classify no more than five cards as `ready`, `research`, or `reject`. Draft at most one useful public reply for explicit owner review.

## Route B: cold research fallback

If no warm candidate is `ready`, invoke `threadify-qualified-buyer-research`. Reuse its offer context, narrow query order, five-result cap, and current-public-browser inspection rules. The Lead Desk may classify those results, but it must not manufacture a warm signal or send a message.

## Local artifact

Run from a source checkout:

```sh
node bin/threadify-workflows.mjs lead-desk < input.json > lead-desk.json
```

The JSON output includes a compact `markdown` view and a three-lane `html` preview. The classifier reads stdin and writes stdout; it has no browser, search, messaging, scheduling, or sending code. The HTML is editable only through the local review server, not by opening an exported `file://` preview:

```sh
node bin/threadify-workflows.mjs lead-desk serve --input /absolute/input.json --state /absolute/private/review.json
```

Open the printed `127.0.0.1` URL in the owner's browser and keep the process running. The server has a random session token, binds loopback only, and persists edits in the specified private file. **Save draft** records an edit; **Mark Final for Review** records the exact final text, SHA-256 hash and revision. Any later edit revokes final status. To read the owner's final result after they say it is ready:

```sh
node bin/threadify-workflows.mjs lead-desk status --state /absolute/private/review.json
```

Require `status: final_for_review`, then recheck the exact account, reply target, pending state, safety and publishing gate. Read the same final revision again immediately before a separately authorized send, and verify the live provider reply afterward. The page and CLI never send automatically; a final mark by itself does not authorize publication.

Use [the ChatGPT template](chatgpt-template.md) as the human-facing host prompt. It coordinates evidence collection; the Threadify workflow remains the local classifier and artifact generator.

## Boundaries

- Never scrape or automate browsing.
- Never infer lead quality, consent, a booked call, or revenue from likes, follows, or vague comments.
- A public reply remains unsent until the owner explicitly requests a send in the host, the exact final revision passes fresh checks, and the provider confirms it.
- A private contact requires separate recipient interest and channel permission through `threadify-agree-next-step`.
