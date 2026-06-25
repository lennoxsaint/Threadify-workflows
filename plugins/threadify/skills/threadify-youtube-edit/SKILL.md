# Threadify YouTube Edit

Use when the user has raw footage (or a finished Eddy launch kit) and wants a finished YouTube edit
and, optionally, scheduled Threadify promotional posts about the video.

## Instructions

1. Read `workflows/youtube-edit/manifest.json`.
2. Confirm the mode: `edit-only` (deliverable is the edit) or `edit-then-promote` (edit, then
   prepare and schedule promo posts after approval).
3. Run the Eddy engine from the `engines/eddy` submodule. Initialize it with
   `git submodule update --init engines/eddy`, then use Eddy's own install
   (`python3 engines/eddy/scripts/install_codex.py`). Prefer Eddy's `eddy_edit_start` /
   `eddy_job_status` / `eddy_artifacts` MCP tools; fall back to the `eddy edit` CLI.
4. Eddy runs locally and never publishes. Raw media stays on the user's machine. Never claim a
   finished edit unless Eddy reports a completed run; if Eddy is unavailable, ask for finished
   video assets instead.
5. In `edit-only` mode, return the launch kit (long video, Shorts, titles, thumbnails, chapters,
   description) and stop.
6. In `edit-then-promote` mode, read `get_connection_defaults`, draft promo post/thread candidates
   grounded in the real video, attach the chosen thumbnail with `upload_media` for review, and
   validate copy with `validate_post`.
7. Do not consume raw Current Self packets, private metrics, member data, account state, or
   unapproved memory candidates.
8. Show the full approval packet (account, exact text, media, scheduled times, timezone, action)
   and stop for explicit final approval before any `schedule_post`.
9. Schedule only approved posts, read back status with `get_schedule_status` /
   `get_schedule_report`, and record a receipt with `record_feedback` if supported.

Never claim an edit, upload, schedule, or publish happened unless a real supported tool confirms
it. Never invent performance claims or features the video does not contain.
