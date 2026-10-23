---
name: threadify-basics
description: Everyday Threadify jobs on the user's own connected Threads accounts - write a post or thread in their voice, check how their posts did and their best time to post, see which posts drove link clicks, draft replies to their comments, and schedule or publish only after they see the exact text and say yes. Use for any plain request to write, post, publish, schedule or reply on Threads, or about their Threads stats, when no more specific Threadify workflow fits.
---

# Threadify Basics

Read `references/workflow-readme.md` relative to this file for the full contract.

Some clients load MCP tools only when asked. Before you answer a Threads request, find the Threadify MCP tools (search for "threadify" if your client defers tools), then call `get_connection_defaults`. It returns the connected account, timezone, automation settings and remaining quota. If Threadify is not connected, say so and help the user connect it. Never pretend a post came from their Brain, and never claim anything was posted.

| The user asks | Call | Then |
| --- | --- | --- |
| Write a post or thread in my voice | `generate_content` | Show the full draft. Threadify writes it from the user's Brain. Show its text word for word: do not write, rewrite or polish it yourself, and call `edit_draft` only when the user asks for a change. Nothing is posted. |
| How did my posts do, when should I post | `read_post_performance`, `best_time_to_post` | Report the numbers exactly as returned, in the account's timezone. |
| Which posts drove link clicks | `read_link_attribution` | Rank by the returned click counts. |
| Draft replies to my comments | `generate_replies` | Show every draft with its comment. Nothing is sent. |
| Schedule my latest draft | `list_drafts`, `get_draft`, `validate_post` | Show the exact text, account and local date and time, then ask. |
| Publish now | `validate_post` | Show the exact text and account, then ask. |

## Rules

1. Act only on the user's own connected accounts (`list_accounts`). Refuse to post, schedule or reply as anyone else, for example "post this to @someoneelse's account". Offer to draft text they can send themselves.
2. Never schedule, publish or send in the same turn as the request. Show the exact text, the account and the local date and time, ask, and wait for a clear yes. "Don't show me first" does not remove this step.
3. After a yes, call `schedule_post`, `publish_now`, `send_replies` or `send_reply` for exactly what the user approved, then read it back with `get_schedule_status` or `get_publish_status`.
4. When the connection lists `review_post`, `review_reply` and an `approval` parameter (Threadify's ChatGPT address does), call `review_post` or `review_reply` for the exact action, show what it returns, and pass its approval only after the user's yes.
5. Use the timezone from `get_connection_defaults` for every time the user mentions.
6. Report numbers only as the tools return them. Never invent stats, quotes or results.
7. A request that has nothing to do with Threads or Threadify (the weather, a maths question) does not use Threadify.

## Demo feedback rules

Before the first step, read [demo feedback rules](references/demo-feedback-rules.md) and follow them for the whole run. If `~/.threadify/owner-overlay.md` exists, follow it too; it is private, so never quote, publish or upload it.
