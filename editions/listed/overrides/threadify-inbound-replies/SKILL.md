---
name: threadify-inbound-replies
description: "Set from edition.json at build time."
---

# Threadify Inbound Replies

Answer the people who commented on the person's Threads posts or mentioned them, in the person's voice. Send only replies the person approved word for word.

The person's own instructions come first. If they ask for something different from this guide, do what they ask within the review rules below, and say which step you are leaving out.

Follow [Connect Threadify](references/connect.md) before the first Threadify call.

## Scope

- Use only the Threadify tools named in this skill. Keep no notes in files and run no programs or local pages. Threadify's inbox holds the state: each comment, mention or X item is pending, replied or skipped.
- This skill answers comments and mentions. It does not write or schedule new posts, publish anything, or turn on automatic replies, even when the account allows them.
- If a call answers `account-not-ready`, say only: "Finish setting up your Threadify account at threadify.app, then say continue." Then stop. If a call answers `not-available`, say so plainly and offer what still works, such as drafting replies the person can post themselves.

## 1. Account and window

Call `get_connection_defaults` and say the @handle the replies will come from. Use the period the person names; otherwise use the last 7 days. On a large inbox, ask once whether to work in rounds of five or take all pending items together.

## 2. Load the inbox

A reply can only be reviewed for an item Threadify's inbox holds, so load the inbox first.

- Comments on their posts: `list_comments` with `days` for the period. Leave out any comment marked as already replied, because the person answered it, perhaps in the Threads app. A second reply would post a duplicate.
- Mentions: `list_mentions` with the pending filter.
- X, only when the person asks: `list_social_inbox` with the pending status. Fetch new X items only when they ask for a refresh.

## 3. Group by intent

Sort the pending items into groups and show the count in each:

- questions;
- thanks and praise;
- disagreement or criticism;
- people asking for help or showing they want what the person offers;
- spam or abuse.

Under each group, show every item with its author, their full words and the post it belongs to. Ask which groups or items to answer. Offer to skip spam and abuse.

## 4. Draft the replies

- Threads comments: `generate_replies` with `days` and a `limit` that covers the chosen items. It drafts each reply in the person's voice and returns it with the comment it answers.
- Threads mentions: write each reply yourself, in the voice the comment drafts use. Keep it short and specific to what the person said.
- X items: `generate_social_reply` with the item's words as `comment_text`.

Add no links, offers, numbers or claims the person has not given you.

## 5. Show each exact reply

For every reply, show the post, the author and their comment, and the exact reply under it. Ask the person to approve, edit or skip each one. When they edit, their words become the reply; show it again before it counts as approved. Approval is word for word: if a single character changes after the yes, show the reply again.

## 6. Review, then send

Call `review_reply` with the send tool as `tool` and exactly the arguments you will send with:

- one Threads reply: `tool: "send_reply"`, the `comment_id` or the `mention_id`, and the reply as `draft_text`;
- several Threads replies: `tool: "send_replies"` and `drafts`, the same list you will send, each item with its `comment_id` or `mention_id` and its `text`;
- one X reply: `tool: "send_social_reply"`, the `provider_item_id` and the reply as `text`.

Show the review as it came back: each reply's exact words, the @handle it goes out from, and who it answers with what they said. Ask: "Send these?"

Only after a clear yes to this review, call the tool you named in `tool` with the same arguments plus the review's `approval`: `send_reply`, `send_replies` or `send_social_reply`.

- Silence is never a yes, and a yes given before this review does not count. Never send a reply the person has not approved word for word.
- One reply's approval cannot send a batch. Review a batch as a batch, with the same list you will send.
- A change to any reply's words, to what it answers or to the account needs a new review. An approval expires after 15 minutes; if they take longer, review again.
- If the review answers `reply-target-not-found`, the inbox does not hold that item. Load the inbox again and do not guess an id.
- `send_replies` sends in the background, spaced out like a person would. It returns how many replies are queued and when they should finish, not a sent result.
- If a send's result is unclear, check the inbox before trying again, and retry only with the same approval, which returns the first result instead of sending twice.

## 7. Mark handled and read back

- Threadify marks an item replied when its reply is sent.
- For an item the person chose not to answer, call `update_inbox_item` with `action: "skip"` and that item's `comment_id`, `mention_id` or `provider_item_id`. This is private to Threadify and changes nothing on Threads or X. `action: "restore"` brings a skipped item back.
- Read the inbox back with the same list tools. Report what was sent, what is still queued and when it should finish, what was skipped, what is still pending, and anything refused with the reason.
