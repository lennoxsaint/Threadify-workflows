# Daily Greatest Hits

Use this workflow to turn proven historical posts into a daily review-and-schedule loop.

Public v0 is orchestration-only. It can read basic `greatest_hits` output where Threadify exposes it, or accept a user-supplied clean source pack. It must not expose private analytics logic, private Brain prompts, account IDs, credentials, member data, or proprietary generation systems.

## Source Inputs

Accept one of:

- basic `greatest_hits` readback from Threadify MCP
- a user-approved greatest-hits source pack
- a local file containing approved source post text
- a Threadify-ready output artifact from another workflow

Do not consume raw Current Self packets, private proof trails, private metrics, raw account state, unapproved memory candidates, or community/member data.

## Workflow Outputs

Return a local or chat-visible packet containing:

- the account handle and timezone used
- the selected source pack or greatest-hits readback status
- daily candidate posts
- proposed schedule slots
- validation status for each approved post
- a receipt proving whether MCP execution happened or fallback was used

## Required Behavior

1. Call `get_connection_defaults` once to resolve account, timezone, scopes, and autonomy settings.
2. Use `greatest_hits` only for basic public-safe readback where available.
3. If analytics are unavailable, ask for a clean source pack or top post links.
4. Build candidate texts from approved source material only.
5. Show exact candidate text, schedule slots, timezone, account handle, and action before scheduling.
6. Run `validate_post` on approved candidate text.
7. Call `schedule_post` only after explicit final approval.
8. Read back schedule status with `get_schedule_status` or `get_schedule_report`.
9. Record feedback or return a fallback receipt if the connected tool surface supports it.

## Safety Rules

- Never invent performance proof.
- Never claim advanced analytics ranking is included in public v0.
- Never claim native Threadify generation happened unless a real connected tool did it.
- Never schedule without explicit final approval.
- Preserve exact approved copy once the user confirms it.
- Keep observed source facts separate from interpretation.

## Receipt

Use the shared workflow receipt schema. The receipt must prove the workflow ID, adapter, account handle, source status, exact approved text, schedule or fallback status, timestamp, timezone, tool path, and fallback state.
