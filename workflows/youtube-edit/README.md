# YouTube Edit (Eddy)

Use this workflow to turn raw footage into a finished YouTube edit and, optionally, schedule
Threadify promotional posts about the video.

The editing engine is [Eddy](https://github.com/lennoxsaint/eddy), vendored in this repo as the
`engines/eddy` submodule. Eddy runs **locally**, keeps raw media on the user's machine, and never
publishes anything by itself. This workflow is orchestration-only: it drives Eddy and then hands
off to Threadify MCP for the promotion step behind an explicit approval gate. It must not expose
private analytics logic, Brain prompts, account IDs, credentials, or member data.

## Modes

- **`edit-only`** — run Eddy and return the launch kit. The deliverable is the edited long video,
  Shorts (only when the footage has genuinely strong standalone moments), thumbnail candidates,
  grounded title candidates, chapters, and the YouTube description. No Threadify posting step.
- **`edit-then-promote`** — after the edit, prepare Threadify promotional post/thread candidates
  from the launch kit and schedule them **only after explicit final approval** (the lead-gen loop).

Ask the user which mode they want if they have not already said.

## The Eddy engine

Eddy is a separate MIT project. Initialize it once:

```sh
git submodule update --init engines/eddy
```

Install and run Eddy per its own docs (`engines/eddy/README.md`). The supported agent shape is
**skill plus MCP** (`python3 engines/eddy/scripts/install_codex.py`), after which the agent should
prefer Eddy's `eddy_edit_start` / `eddy_job_status` / `eddy_artifacts` MCP tools and fall back to
the `eddy edit` CLI.

### Eddy invocation contract

- **Input:** a path to raw footage (and optional focus phrasing, e.g. "only keep the part about X").
- **Output (launch kit):** edited long video, optional Shorts, thumbnail candidates, ~10 title
  candidates, chapters, and a YouTube description, plus Eddy's per-run receipts.
- Eddy never publishes; it produces local review assets or an exact blocker.

## Source Inputs

Accept one of:

- a local path to raw footage for Eddy to edit
- an already-finished Eddy launch kit (skip straight to the promote step)
- user-supplied finished video assets, titles, and description (when Eddy is unavailable)

Do not consume raw private metrics, account state, member data, unpublished proof trails, or
unapproved memory candidates.

## Workflow Outputs

Return a local or chat-visible packet containing:

- the selected mode and the account handle and timezone used (promote mode)
- the Eddy edit run status and launch-kit summary
- promotional post/thread candidates derived from the launch kit (promote mode)
- the thumbnail/media chosen for any post
- proposed schedule slots and validation status for each approved post
- a receipt proving whether Eddy ran, whether Threadify execution happened, or fallback was used

## Required Behavior

1. Confirm the mode (`edit-only` or `edit-then-promote`).
2. Run Eddy on the footage (or accept an existing launch kit). Never claim a finished edit unless
   Eddy reports a completed run.
3. In `edit-only` mode, return the launch kit and stop.
4. In `edit-then-promote` mode, read `get_connection_defaults`, then draft promo post/thread
   candidates grounded in the actual video (title, hook, description) — no invented claims.
5. Attach the chosen thumbnail/media via `upload_media` for review only.
6. Validate approved copy with `validate_post`.
7. Show the full approval packet (account, exact text, media, times, timezone, action) and stop for
   explicit final approval before any `schedule_post`.
8. Schedule only approved posts; read back with `get_schedule_status` / `get_schedule_report`.
9. Record feedback or a receipt with `record_feedback` if the surface supports it.

## Safety Rules

- No `schedule_post` (or any state change) until the user gives explicit final approval.
- Never invent performance claims, proof, or features the video does not contain.
- Raw footage stays local; do not upload source media anywhere except thumbnails the user approves.
- If Eddy or Threadify MCP is unavailable, produce the fallback review packet — never pretend the
  edit, upload, or schedule happened.

## Receipt

Use the shared workflow receipt schema. The receipt must prove the workflow ID, adapter, account
handle, Eddy edit run status, approved text, schedule status, timestamp, tool path, and fallback
state.
