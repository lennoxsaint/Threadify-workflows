---
name: threadify-inbound-replies
description: Connect Threadify MCP, review a backlog of Threads comments and mentions grouped beneath full posts, edit five cards or all comments, explicitly send approved replies, and learn from verified edits. Supports interrupted batches and custom periods.
---

# Threadify Inbound Replies

Read `../../../../workflows/inbound-replies/README.md` and `../../../../workflows/inbound-replies/CONTRACT.md` relative to this file. The helper is `../../../../tools/inbound/cli.mjs`.

Follow that workflow with the user's own connected account and Brain. Never assume the package author's identity, style, timezone or private filesystem. Call Threadify `get_connection_defaults` before other Threadify tools. Missing connection means guide setup, not invent inbound.

On first use, ask whether to remember five comments per round or all safe pending comments for the chosen period. Save the answer per account. Default the period to since the last completed scan plus unresolved/deferred items (24 hours on first use). Explicit periods override this.

Use native editable Writing blocks only after verifying create, stable item binding and edited-text readback. Otherwise say `editable_surface_unavailable`, show grouped full context in chat, open the local editable page and read saved revisions with the helper. Do not pretend Markdown code fences are editable Writing blocks.

Every reply belongs to an exact native source ID. A text edit revokes approval. Approval stays local. Send only after an explicit chat instruction naming the unambiguous approved set; the page cannot send. Respect this workflow's reviewed send route even if broader account settings permit automation.

After a send, independently verify the exact published text, record feedback and retry feedback failures without resending replies. Finish with honest coverage, verified/queued/uncertain states and pending work. Public receipt bodies must not contain raw inbound or reply text.
