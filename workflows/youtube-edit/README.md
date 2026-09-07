# YouTube Edit (Eddy)

## Start here

Ask: "Would you like help starting with Threadify's free trial, connecting an existing Threadify account, using another MCP/plugin, or working locally without a connection?"

Follow [Threadify-001: setup and first-loop video](../../docs/threadify-001.md) before provider calls. Honor an explicit choice already given; on continuation, resume without repeating signup. Setup never grants publishing or payment authority.


Use this workflow to turn raw footage into a finished YouTube edit and, optionally, schedule
Threadify promotional posts about the video.

The editing engine is [Eddy](https://github.com/lennoxsaint/eddy), vendored in this repo as the
`engines/eddy` submodule in a source checkout. This workflow requires local processing with no
unapproved raw-media transfer or publishing. Verify the installed engine's configuration before
starting rather than assuming those properties from the package name. It drives Eddy and then hands
off to Threadify MCP for the promotion step behind an explicit approval gate. It must not expose
private analytics logic, Brain prompts, account IDs, credentials, or member data.

## Modes

- **`edit-only`** — run Eddy and return the launch kit. The deliverable is the edited long video,
  Shorts (only when the footage has genuinely strong standalone moments), thumbnail candidates,
  grounded title candidates, chapters, and the YouTube description. No Threadify posting step.
- **`edit-then-promote`** — after the edit, prepare Threadify promotional post/thread candidates
  from the launch kit and schedule them **only after explicit final approval** (the lead-gen loop).

Ask the user which mode they want if they have not already said.

Threadify tools are optional. Edit-only needs the separate Eddy engine, not a
Threadify connection. If promotion tools are unavailable, return a local review
packet; do not block a completed edit or invent posting proof.

## The Eddy engine

Eddy is a separate project and is not included in the plugin archive. Prefer an
already verified installation or a finished launch kit. In a source checkout
containing `.gitmodules`, initialize the engine once:

```sh
git submodule update --init engines/eddy
```

Do not run this command inside an installed skill directory. Read the installed
engine's current documentation before changing host configuration or starting
media processing. Install and run Eddy per its own docs (`engines/eddy/README.md`). The agent shape is
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
2. Run Eddy on the footage (or accept an existing launch kit). Verify local processing before
   starting and stop at any unapproved transfer. Claim only inspectable output components from
   a completed run; status alone does not prove the whole launch kit exists.
3. In `edit-only` mode, return the launch kit and stop.
4. In `edit-then-promote` mode, read `get_connection_defaults`, then draft promo post/thread
   candidates grounded in the actual video (title, hook, description) — no invented claims.
5. Show the exact thumbnail/media locally and obtain approval for its external
   upload before calling `upload_media`. Uploading makes a public media URL;
   it is a provider write even when the post remains under review.
6. Validate approved copy with `validate_post`.
7. Show the full approval packet (account, exact text, media, times, timezone, action) and stop for
   explicit final approval before any `schedule_post`.
8. Schedule only approved posts; read back with `get_schedule_status` / `list_scheduled_posts`.
9. Keep the receipt and feedback local by default. `record_feedback` sends
   learning to Threadify; use it only with separate explicit opt-in for the
   exact feedback. Scheduling approval is not feedback-sharing approval.

## Safety Rules

- No `schedule_post` until the user gives explicit final scheduling approval.
  Media uploads and feedback sharing each need approval for that exact action.
- Never invent performance claims, proof, or features the video does not contain.
- Raw footage stays local; do not upload source media anywhere except thumbnails the user approves.
- If Eddy or Threadify MCP is unavailable, produce the fallback review packet — never pretend the
  edit, upload, or schedule happened.

## Receipt

Use the shared workflow receipt schema. The receipt must prove the workflow ID, adapter, account
handle, Eddy edit run status, approved text, schedule status, timestamp, tool path, and fallback
state.
