---
name: threadify-x-article-from-daily-post
description: "Expands an approved daily Threads post into a draft X Article packet (brief, article draft, thumbnail brief and scorecard) for the person to review and publish on X themselves. Use when the person asks to turn a Threads post into an X Article or a long-form X piece."
---

# Threadify X Article From Daily Post

## Start here

This skill works from text the person approves; it needs no connection to draft. Honor an existing connection choice. Offer the connection only when it would help, such as making a thumbnail or scheduling a short X post; explain the benefit and get approval for the exact action.

Follow [Connect Threadify](references/connect.md) before provider calls. Honor an explicit choice already given; on continuation, resume without repeating setup. A connection never grants scheduling or publishing authority.


Use when the user has an approved daily post or Threadify-ready output artifact
and wants a draft-only X Article packet.

## Instructions

1. Confirm the approved source post and that the person wants an X Article draft.
2. Use only approved source text or a public-safe post the person has approved.
3. Do not consume raw Current Self packets, private metrics, member data, account
   state, unpublished proof trails, or unapproved memory candidates.
4. Prepare a draft packet containing an article brief, draft article, thumbnail
   brief, thumbnail prompt, and scorecard.
5. The person publishes the X Article in X. Threadify's tools post regular X posts,
   not Articles. If the person wants Threadify to make the thumbnail, call
   `generate_image` with the thumbnail prompt as its `prompt`, and show the image
   before calling it made.
6. Once the article is live, the person may want a short X post that points to it.
   Write it, call `review_post` with that text, `platforms: ["x"]` and the chosen
   `scheduled_at`, show the review, and only after a clear yes call `schedule_post`
   with the same arguments plus the review's `approval`.
7. Return a receipt that says what was drafted, any image made, and any X post
   scheduled with its approved review; say plainly when no X action happened.

Never claim an article, thumbnail, upload, schedule, or publish happened unless a
real supported tool confirms it.

Resolve references against this skill directory. This skill never publishes the article itself.
