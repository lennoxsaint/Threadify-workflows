---
name: threadify-greatest-hits-runway
description: Prepare a reviewed runway of existing best-performing posts, check stale facts and calendar conflicts, and schedule only after exact approval. The episode 17 workflow.
---

# Threadify Greatest Hits Runway

Start locally from confirmed facts and supplied sources without a Threadify account. Honor an existing connection choice. Offer a connection only when an available hosted capability would help; explain the benefit and obtain approval for the exact provider action.

Follow [Threadify-001: setup and first-loop video](references/threadify-001.md). Honor an existing choice; setup never authorizes scheduling.

Start from a request such as: “Prepare my greatest hits runway for the next seven days, three posts per day. Show me the plan before scheduling.” Do not promise growth, a full calendar or a fixed number of available posts.

1. Ask only for missing planning choices: intended account, horizon and posts per day. Read current tool schemas. Call get_connection_defaults first, verify the owned account, timezone and scopes, then list_scheduled_posts for the requested window. If the calendar response is incomplete, resolve coverage before approving slots; do not treat a truncated list as an empty calendar.
2. Call plan_greatest_hits_runway with the selected account, runway_days and posts_per_day. Current schema allows up to 365 days and 10 posts per day; verify these limits in the client rather than extrapolating from the episode. The planner prepares a plan; it does not schedule. Its current behavior skips occupied days. Reconcile the live queue slot by slot: preserve each existing item and review remaining positions explicitly, including dates omitted by the planner. Do not infer calendar state from draft labels, change the horizon or silently substitute shorts for missing threads. A capability or tier denial produces a local/manual fallback, not repeated denied calls.
3. Hydrate each source into its full ordered thread chain and per-part media before review; an opening-hook row is insufficient. If hydration is unavailable, leave an honest gap. Review the full text and required media. Apply the owner's configured opening-like threshold, family cooldown, format mix and spacing; never hardcode one creator's policy. Require dated performance and complete family history, exclude duplicate families including existing queued posts, and keep unknown evidence blocked. Check old ages, dates, “today,” prices, membership counts, availability, events, links and other time-sensitive claims against current owner-approved facts. Ask for missing facts or omit the post. Never calculate a current claim from unsupported memory. Show every proposed copy change; do not silently “refresh” someone's past result into a new result. Preserve source attribution privately.
4. Produce a concise review table: source reference, exact proposed text, media, local date/time with timezone, changed claims and reason, and blockers. Separate “proposed” from “approved.” Instruct the user to edit or approve individual rows or the exact complete plan. A partial plan is useful; unavailable slots are not failed publications.
5. Immediately before scheduling, recheck calendar conflicts, account and media. Run validate_post against each exact approved payload. Any copy, media or time change invalidates that row's approval and validation. Bind explicit final approval to the exact plan revision and each account/source/revision/full chain/media/time/action fingerprint. A chat approval of that exact packet remains valid for unchanged rows; do not ask again for the same approved action. Even an autonomous connection does not override this workflow's repository approval contract.
6. Call schedule_post only for approved, validated, conflict-free rows, using current schemas and a supported stable idempotency key bound to account, source, payload, media and time. If the provider does not expose an idempotency field, do not invent one: persist the local intent, issue at most one write and reconcile an uncertain result before any retry. Persist intent and returned scheduled_post_id in a private receipt. On an uncertain result, reconcile that intent using status/calendar before retrying with the same key; never generate a new key to force a second write. Continue independent approved rows after a clear failure, but isolate ambiguous rows.
7. Use get_schedule_status and list_scheduled_posts to verify each scheduled row's account, text, media and time. Return counts and per-row states: proposed, excluded, blocked, approved, scheduled_confirmed or schedule_unverified. Scheduling is not publication; use actual post receipts for later publication proof. Do not infer followers, clicks or sales from a schedule.

## Local fallback

Without a working connector or entitled planner, ask for an approved export of past posts and their dated performance plus the intended time window. Review and prepare the same table locally, clearly labelled manually selected. Unknown performance stays unknown. Do not claim the hosted ranking engine ran or fabricate posting-time analytics. If calendar coverage is unavailable, leave slots tentative and supply manual review steps.

## Receipt

Save the source snapshot time, account, timezone, selected window/volume, duplicate exclusions, factual edits, exact approved rows, validation results, idempotency keys, returned IDs, the readback result and the fallback reason in the owner's private workspace. Keep these details out of public examples. No recurring automation or immediate publishing is created by this skill.

## Portable review and local checks

Use the repository CLI `threadify-workflows greatest-hits review --input input.json --output-dir new-private-directory` when a hosted review hub is unavailable. The [local review contract](references/local-review.md) describes the input, a synthetic example and checks. A standalone skill installation may not include the CLI; use the same contract to prepare a manual review packet instead. Never imply the local helper ran if it is unavailable.

The export is private, read-only and has no provider writes, remote media loads or approval buttons. It shows full copy, each media reference, changed claims, exact timestamps and unavailable receipt labels. Open the output and check phone readability before handing it off. Keep personal input/output outside any public checkout; never commit or upload the owner's corpus, receipts or review pages. Request sharing approval separately. Edits belong in the owner chat and must regenerate the canonical packet. Browser edits or copied pages cannot grant approval.

Immediately before action, refresh the complete calendar and revalidate every approved payload against current schemas. Resolve live conflicts under the owner's spacing and buffer policy; never move an approved time silently. A local proposed row is not a provider validation pass. After a write, confirm account, ordered full chain, all media and time from live status/calendar. Missing, ambiguous, truncated or hook-only readback remains `schedule_unverified`, never a reason for a blind retry. Keep the provider ID and private intent receipt together.

## Demo feedback rules

Before the first step, read [demo feedback rules](references/demo-feedback-rules.md) and follow them for the whole run. If `~/.threadify/owner-overlay.md` exists, follow it too; it is private, so never quote, publish or upload it.
