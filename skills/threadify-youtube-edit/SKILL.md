---
name: threadify-youtube-edit
description: "Advanced workflow. Start locally from confirmed facts and supplied sources without a Threadify account. Honor an existing connection choice. Offer a connection only when an available hosted capability would help; explain the benefit and obtain approval for the exact provider action."
---

# Threadify YouTube Edit

## Start here

Start locally from confirmed facts and supplied sources without a Threadify account. Honor an existing connection choice. Offer a connection only when an available hosted capability would help; explain the benefit and obtain approval for the exact provider action.

Follow [Threadify-001: setup and first-loop video](references/threadify-001.md) before provider calls. Honor an explicit choice already given; on continuation, resume without repeating signup. Setup never grants publishing or payment authority.


Use when the user has raw footage (or a finished Eddy launch kit) and wants a finished YouTube edit
and, optionally, scheduled Threadify promotional posts about the video.

## Instructions

1. Read `references/workflow-manifest.json`.
2. Confirm the mode: `edit-only` (deliverable is the edit) or `edit-then-promote` (edit, then
   prepare and schedule promo posts after approval).
3. Skip editing when the user supplies a finished launch kit. Otherwise use an available,
   verified Eddy installation: prefer `eddy_edit_start` / `eddy_job_status` / `eddy_artifacts`,
   with the `eddy edit` CLI as a fallback. The plugin archive does not include Eddy. Only in a
   source checkout containing `.gitmodules`, initialize `engines/eddy` with
   `git submodule update --init engines/eddy`; read its current installation instructions before
   changing host configuration. Do not run source-checkout installation commands inside an
   installed skill directory. If Eddy is unavailable, ask for finished video assets instead.
4. Keep raw media local and do not authorize publishing or external source-media transfer.
   Verify Eddy's configured processing path before starting; stop if it needs an unapproved
   transfer. Never claim a finished edit unless a completed run and inspectable output assets
   support it. A completed status alone does not prove every launch-kit component exists.
5. In `edit-only` mode, return the launch kit (long video, Shorts, titles, thumbnails, chapters,
   description) and stop.
6. In `edit-then-promote` mode, read `get_connection_defaults` when available and draft promo
   candidates grounded in the real video. Show the exact thumbnail/media locally and obtain
   approval for external upload before `upload_media`; a public media URL is a provider write,
   not a local preview. Validate copy with `validate_post` when available. Without Threadify
   tools, return a local review packet with validation/scheduling marked unavailable; do not
   block delivery of the finished edit or invent provider receipts.
7. Do not consume raw Current Self packets, private metrics, member data, account state, or
   unapproved memory candidates.
8. Show the full approval packet (account, exact text, media, scheduled times, timezone, action)
   and stop for explicit final approval before any `schedule_post`.
9. Schedule only approved posts and read back status with `get_schedule_status` /
   `list_scheduled_posts`. Preserve confirmed successes; reconcile unknown outcomes before
   retrying, rather than rescheduling the whole batch.
10. Keep receipts and feedback local by default. Use `record_feedback` only with separate
    explicit opt-in to share the exact feedback with Threadify. Scheduling approval does not
    authorize feedback sharing.

Never claim an edit, upload, schedule, or publish happened unless a real supported tool confirms
it. Never invent performance claims or features the video does not contain.

Resolve references against this skill directory. For a new creator Day, Week or Month, use the primary creator skills instead.
