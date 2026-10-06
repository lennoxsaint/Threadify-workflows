---
name: threadify-greatest-hits-runway
description: "Plans a runway of the person's best past Threads posts through Threadify, checks each one for stale facts and calendar conflicts, and schedules a post only after the person approves its exact review. Use when the person asks to re-share, rerun or schedule their greatest hits or best past Threads posts over the coming days."
---

# Threadify Greatest Hits Runway

Planning from the account needs a connected Threadify account. Without one, work from past posts the person pastes and prepare a manual plan. Honor an existing connection choice. Offer the connection only when it would help; explain the benefit and get approval for the exact action.

Follow [Connect Threadify](references/connect.md) before provider calls. Honor an existing choice; a connection never authorizes scheduling.

Start from a request such as: “Prepare my greatest hits runway for the next seven days, three posts per day. Show me the plan before scheduling.” Do not promise growth, a full calendar or a fixed number of available posts.

1. Ask only for missing planning choices: intended account, horizon and posts per day. Read current tool schemas. Call `get_connection_defaults` first, verify the owned account, timezone and scopes, then `list_scheduled_posts` for the requested window. If the calendar response is incomplete, resolve coverage before approving slots; do not treat a truncated list as an empty calendar.
2. Call `plan_greatest_hits_runway` with the selected account, `runway_days` and `posts_per_day`. The current schema allows up to 365 days and 10 posts per day; check the limits in the tool schema rather than assuming them. The planner prepares a plan; it does not schedule. It skips days that already have posts. Respect returned slots and explain a shortfall rather than changing the horizon or volume silently. If the planner is not available on this account, say so plainly and use the manual fallback below; do not repeat a refused call.
3. Review each returned post's full text and required media. Remove duplicates. Check old ages, dates, “today,” amounts, membership counts, availability, events, links and other time-sensitive claims against current owner-approved facts. Ask for missing facts or omit the post. Never calculate a current claim from unsupported memory. Show every proposed copy change; do not silently “refresh” someone's past result into a new result. Preserve source attribution privately.
4. Produce a concise review table: source reference, exact proposed text, media, local date/time with timezone, changed claims and reason, and blockers. Separate “proposed” from “approved.” Instruct the user to edit or approve individual rows or the exact complete plan. A partial plan is useful; unavailable slots are not failed publications.
5. Immediately before scheduling, recheck calendar conflicts, account and media. Run `validate_post` against each exact approved row. For each row, call `review_post` with the exact text, media and `scheduled_at` you will schedule, and show the person the review it returns: account, text, media, time and action. Any copy, media or time change invalidates that row's review; review it again. Even an autonomous connection does not replace this approval.
6. After a clear yes to a row's review, call `schedule_post` with the same arguments plus that review's `approval`. An approval covers one review and expires after 15 minutes; a retry with the same approval returns the first result instead of scheduling twice. Keep each returned `scheduled_post_id` for the receipt. On an uncertain result, check status and the calendar before retrying with the same approval; never request a new approval to force a second write. Continue independent approved rows after a clear failure, but isolate ambiguous rows.
7. Use `get_schedule_status` with each `scheduled_post_id`, and `list_scheduled_posts`, to verify each scheduled row's account, text, media and time. Return counts and per-row states: proposed, excluded, blocked, approved, scheduled_confirmed or schedule_unverified. Scheduling is not publication; use actual post receipts for later publication proof. Do not infer followers, clicks or sales from a schedule.

## Local fallback

Without a working connection or planner, ask for an approved export of past posts and their dated performance plus the intended time window. Review and prepare the same table locally, clearly labelled manually selected. Unknown performance stays unknown. Do not claim the hosted ranking engine ran or fabricate posting-time analytics. If calendar coverage is unavailable, leave slots tentative and supply manual review steps.

## Receipt

Give the person a receipt in the chat: source snapshot time, account, timezone, selected window and volume, duplicate exclusions, factual edits, exact approved rows, validation results, reviews approved, returned schedule references, readback and fallback reason. Keep these details out of anything shared publicly. No recurring automation or immediate publishing is created by this skill.
