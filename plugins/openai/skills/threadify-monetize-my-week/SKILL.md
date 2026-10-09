---
name: threadify-monetize-my-week
description: Turn an existing Threadify draft backlog into a reviewed seven-post offer campaign, keeping every post unchanged while adding tailored tracked Auto Plugs and scheduling only after exact approval. Use when a creator asks to monetize, sell from, or add a measurable offer layer to an existing week or draft backlog.
---

# Threadify Monetize My Week

Use existing drafts to prepare one measurable seven-post campaign. Do not create a new content week, rewrite post bodies, promise sales, or treat a schedule as a published result.

Follow [Threadify-001: setup and first-loop video](references/threadify-001.md) before the first connected call. Setup and connection never authorize scheduling.

## Fixed campaign contract

- Use one owned Threads account and one saved offer.
- Select exactly seven unposted drafts when seven eligible drafts exist.
- Leave every selected draft's post text, thread parts and media unchanged.
- Use the first seven conflict-free local dates, one post per date, at the best measured time for that date.
- Add one context-specific Auto Plug to every selected post with `trigger: "time"` and `delay_minutes: 50`.
- Schedule Threads only. Omit `platforms`; do not spend X credits or change global automation preferences.
- Stop for one exact campaign approval before any scheduling call.

If the owner requests a different account, offer, volume, cadence, delay, editing policy or platform, treat that as a new explicit campaign contract and show the changed contract before continuing.

## Preflight

1. Read current tool schemas. Call `get_connection_defaults` first. Verify the intended owned account, timezone, scopes, automation state and current entitlement. State the exact `@handle`. Do not infer an account or plan from installation.
2. Call `list_offers` for that account. If more than one offer could match, ask the owner to choose. Preserve the saved offer destination and approved facts exactly.
3. Call `list_scheduled_posts` with enough coverage to identify seven wholly unoccupied local dates. Treat an occupied date as unavailable. A truncated response is not an empty calendar.
4. Call `best_time_to_post` for current measured timing. If it is unavailable, ask for one posting time instead of guessing or claiming an analytic recommendation.
5. Page `list_drafts` with `status: "unposted"` until the complete metadata set is covered. Record the observed total and snapshot time. Retrieve the full text of finalists with `get_draft`; previews are not sufficient for approval or offer-fit review.

## Select the seven

Apply these hard exclusions before ranking:

- The body already contains a CTA, competing offer or destination.
- A factual, dated, availability, pricing or identity claim cannot be verified as current.
- The Threadify offer would be a forced topic change rather than a natural continuation.
- The draft is duplicate, incomplete, placeholder copy, or missing required media.
- The post would need any body edit to make the plug honest or coherent.

Offer relevance is mandatory. Among eligible drafts, prefer likely audience pull supported by owned performance/context, then a varied weekly mix of topics and formats. Describe this as editorial selection, not predicted performance. Never claim the selected posts will outperform excluded posts.

If fewer than seven drafts survive, return the eligible shortlist and blockers. Ask whether the owner wants a smaller campaign, permission for body edits, or replacement drafts. Do not silently relax the gates.

## Write the offer layer

Write one Auto Plug per selected post using only the post's actual context and the saved offer's approved facts. Make the transition specific enough that it could not be pasted under an unrelated post. Keep one campaign destination, but allow different lead-in copy. Include the exact tracked destination in every plug.

Do not insert the offer into the post body. Do not add unsupported urgency, savings, results, user counts, plan entitlements or revenue claims. Link tracking establishes attribution, not causation.

## Review and approve

Recheck the Calendar immediately before review. Present one seven-row packet containing:

- account and timezone;
- full unchanged post or every thread part;
- draft reference;
- exact local date and time;
- exact Auto Plug copy and destination;
- fixed `+50 minutes` trigger;
- exclusions, conflicts and current global automation that will remain unchanged.

Ask for exact approval of the complete packet or named rows. Any text, destination, account, date, time, media or automation change invalidates approval for the affected row. Reviewed or autonomous connection settings do not replace this workflow approval.

## Validate, schedule and reconcile

1. Re-read account and Calendar state. A new conflict invalidates that row and requires a replacement date plus renewed approval.
2. Call `validate_post` on each exact unchanged draft payload.
3. Prepare a stable idempotency key bound to workflow, account, draft, scheduled instant, media, plug copy, destination and delay.
4. Call `schedule_post` with the original `draft_id`, exact `content_type`, approved time, and `auto_plug: { trigger: "time", delay_minutes: 50, content: <approved plug> }`. Omit `platforms` and `auto_repost`.
5. Preserve confirmed independent rows if another row clearly fails. If an outcome is uncertain, inspect `get_schedule_status` and `list_scheduled_posts` before retrying the identical request with the same key. Never create a fresh key to force a duplicate.
6. Read back every scheduled row. Verify account, post text/media, local instant and stored Auto Plug content/trigger/delay. Report `scheduled_confirmed`, `blocked`, `failed`, or `schedule_unverified` per row. Scheduling is not publication.

## Measure after publication

After all seven posts have had the agreed observation window, call `read_link_attribution` and post-performance reads using a common cutoff. Report publication/plug status, views, interactions, total clicks, unique clicks, attributed conversions and attributed value when available. Keep unmatched conversion events and incomplete tracking visible.

Say “attributed,” not “caused.” Do not merge Auto Plug-only clicks with broader account revenue unless the returned records share the same source and attribution scope.

## Entitlement and local fallback

If Auto Plug is tier-blocked, state the returned current tier, required tier and allowed alternative. Keep the campaign packet staged and offer manual follow-up replies; do not retry the denied call or pretend automation is configured.

Without connected draft, offer, Calendar or attribution reads, accept an owner-approved export and prepare a local seven-row review packet. Mark selection, times, tracking, scheduling and outcomes as unverified where appropriate. Local preparation never proves a provider action.

## Private receipt

Retain the source snapshot, account, offer/destination, exclusions, seven exact rows, approval revision, validation results, idempotency keys, returned schedule references, automation readback, attribution window and fallback state in the owner's private workspace. Keep private post bodies, account IDs and provider references out of public fixtures.
