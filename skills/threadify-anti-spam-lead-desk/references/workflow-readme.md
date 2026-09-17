# Anti-Spam Lead Desk

Turn a small, current set of public Threads signals into a reviewable desk without pretending that a lead is qualified, a message was sent, or revenue happened.

## Route A: warm inbound

1. Confirm the correct Threadify account and a confirmed offer.
2. Discover the available comment/reply-read capability at runtime; do not assume a tool name.
3. Read comments from one to three owner-selected, owned Threads posts.
4. Keep only explicit, offer-relevant problem/help signals. Reject generic praise, seller funnels, stale or duplicate signals, and ambiguous context.
5. Open each shortlisted profile in the authenticated Threads browser and record current public context, URL, and timestamp.
6. Classify no more than five cards as `ready`, `research`, or `reject`. Draft at most one useful public reply for explicit owner review.

## Route B: cold research fallback

If no warm candidate is `ready`, invoke `threadify-qualified-buyer-research`. Reuse its offer context, narrow query order, five-result cap, and current-public-browser inspection rules. The Lead Desk may classify those results, but it must not manufacture a warm signal or send a message.

## Local artifact

Run from a source checkout:

```sh
node bin/threadify-workflows.mjs lead-desk < input.json > lead-desk.json
```

The JSON output includes a compact `markdown` view and self-contained `html` view. Save those separately only when the owner wants files. The CLI reads stdin and writes stdout; it has no network, browser, search, messaging, scheduling, or sending code.

Use [the ChatGPT template](chatgpt-template.md) as the human-facing host prompt. It coordinates evidence collection; the Threadify workflow remains the local classifier and artifact generator.

## Boundaries

- Never scrape or automate browsing.
- Never infer lead quality, consent, a booked call, or revenue from likes, follows, or vague comments.
- A public reply remains a draft until the owner explicitly approves it in the host.
- A private contact requires separate recipient interest and channel permission through `threadify-agree-next-step`.
