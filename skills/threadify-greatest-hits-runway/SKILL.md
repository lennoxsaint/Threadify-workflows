---
name: threadify-greatest-hits-runway
description: Prepare a reviewed runway of existing best-performing posts, check stale facts and calendar conflicts, and schedule only after exact approval. The episode 17 workflow.
---

# Threadify Greatest Hits Runway

If no setup choice is known, ask: "Would you like help starting with Threadify's free trial, connecting an existing Threadify account, using another MCP/plugin, or working locally without a connection?"

Follow [Threadify-001: setup and first-loop video](references/threadify-001.md). Honor an existing choice; setup never authorizes scheduling.

Start from a request such as: “Prepare my greatest hits runway for the next seven days, three posts per day. Show me the plan before scheduling.” Do not promise growth, a full calendar or a fixed number of available posts.

1. Ask only for missing planning choices: intended account, horizon and posts per day. Read current tool schemas. Call get_connection_defaults first, verify the owned account, timezone and scopes, then list_scheduled_posts for the requested window. If the calendar response is incomplete, resolve coverage before approving slots; do not treat a truncated list as an empty calendar.
2. Call plan_greatest_hits_runway with the selected account, runway_days and posts_per_day. Current schema allows up to 365 days and 10 posts per day; verify these limits in the client rather than extrapolating from the episode. The planner prepares a plan; it does not schedule. Its current behavior skips occupied days. Respect returned slots and explain a shortfall rather than changing the horizon or volume silently. A capability or tier denial produces a local/manual fallback, not repeated denied calls.
3. Review each returned post's full text and required media. Remove duplicates. Check old ages, dates, “today,” prices, membership counts, availability, events, links and other time-sensitive claims against current owner-approved facts. Ask for missing facts or omit the post. Never calculate a current claim from unsupported memory. Show every proposed copy change; do not silently “refresh” someone's past result into a new result. Preserve source attribution privately.
4. Produce a concise review table: source reference, exact proposed text, media, local date/time with timezone, changed claims and reason, and blockers. Separate “proposed” from “approved.” Instruct the user to edit or approve individual rows or the exact complete plan. A partial plan is useful; unavailable slots are not failed publications.
5. Immediately before scheduling, recheck calendar conflicts, account and media. Run validate_post against each exact approved payload. Any copy, media or time change invalidates that row's approval and validation. Request explicit final approval showing exact account/text/media/time/action. Even an autonomous connection does not override this workflow's repository approval contract.
6. Call schedule_post only for approved, validated, conflict-free rows, using current schemas and a stable idempotency key bound to account, source, payload, media and time. Persist intent and returned scheduled_post_id in a private receipt. On an uncertain result, reconcile that intent using status/calendar before retrying with the same key; never generate a new key to force a second write. Continue independent approved rows after a clear failure, but isolate ambiguous rows.
7. Use get_schedule_status and list_scheduled_posts to verify each scheduled row's account, text, media and time. Return counts and per-row states: proposed, excluded, blocked, approved, scheduled_confirmed or schedule_unverified. Scheduling is not publication; use actual post receipts for later publication proof. Do not infer followers, clicks or sales from a schedule.

## Local fallback

Without a working connector or entitled planner, ask for an approved export of past posts and their dated performance plus the intended time window. Review and prepare the same table locally, clearly labelled manually selected. Unknown performance stays unknown. Do not claim the hosted ranking engine ran or fabricate posting-time analytics. If calendar coverage is unavailable, leave slots tentative and supply manual review steps.

## Receipt

Save the source snapshot time, account, timezone, selected window/volume, duplicate exclusions, factual edits, exact approved rows, validation results, idempotency keys, returned IDs, readback and fallback reason in the owner's private workspace. Keep these details out of public examples. No recurring automation or immediate publishing is created by this skill.
