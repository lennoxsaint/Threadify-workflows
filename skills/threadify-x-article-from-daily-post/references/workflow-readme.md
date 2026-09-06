# X Article From Daily Post

Use this workflow after a daily post has been approved or prepared and the user wants an optional deeper X Article draft.

Public v0 is draft-only. It prepares a review packet and a manual fallback receipt. It must not publish, schedule, upload media, submit a browser form, like, reply, repost, bookmark, or otherwise mutate X state.

## Source Inputs

Accept one of:

- an approved daily post
- a local review artifact containing the daily post
- a user-supplied source post text file
- a Threadify-ready output artifact from another workflow

Do not consume raw private metrics, account state, member data, unpublished proof trails, or unapproved memory packets.

## Draft Packet Outputs

Return a local or chat-visible packet containing:

- `article_brief.md`: audience, promise, proof available, article archetype, structure, source constraints
- `article_draft.md`: the draft X Article text
- `thumbnail_brief.md`: visual direction, focal object, proof cue, text overlay, contrast/readability notes
- `thumbnail_prompt.md`: image-generation prompt or manual design brief
- `scorecard.json`: headline score, bookmark score, proof score, thumbnail score, risk flags

## Required Behavior

1. Read the source post exactly.
2. Ask whether to turn it into an X Article only if the user has not already asked for the conversion.
3. Map the source post to an article archetype.
4. Draft three title options.
5. Create one article brief and one draft.
6. Create three thumbnail directions and choose the highest-scoring one.
7. Run a review gate over proof, specificity, and saved-for-later value.
8. Return the packet for human review.
9. Record feedback or a receipt if the connected tool surface supports it.

## Safety Rules

- Never invent proof.
- Never turn a thin post into a padded ultimate guide.
- Prefer save-worthy utility over engagement bait.
- Keep observed source facts separate from interpretation.
- Do not claim X Article publishing support unless the product surface has verified X support.
- Do not claim a thumbnail was generated unless a real image asset or image-generation request packet exists.

## Receipt

Use the shared workflow receipt schema. The receipt must prove the source post, exact draft packet status, fallback state, timestamp, adapter, and the fact that no live X action was performed.
