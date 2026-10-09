# Run My Threads daily schedule

Run My Threads uses exactly one host schedule that fires once a day. The default time is 05:30 in the owner's timezone; the owner may choose another time. The run prepares the approval card and stops. Nothing is scheduled on Threads until the owner replies.

## Find before you create

Before creating anything, list the host's existing schedules and look for one named "Run My Threads" or whose prompt runs `threadify-run-my-threads`.

- One found: reuse it. Show its name, time, timezone, status and next run. Change its time or settings in place only when the owner asks.
- More than one found: show them all and ask which one to keep. Pause or delete the others only with the owner's approval.
- None found: create one, then read it back.

Never create a second schedule to change a time or a setting. Never add an hourly or repeating check.

## The daily prompt

Save the owner's choices in the schedule's prompt so each run is self-contained:

> Run the installed threadify-run-my-threads skill for today. Account: @HANDLE. Timezone: AREA/CITY. Week plan: start_date YYYY-MM-DD, mode growth | balanced | conversion, short_day WEEKDAY, seed N, auto_plug true | false. Offer: OFFER_ID or none. Casing: as Threadify writes it | lowercase except proper nouns, keep: NAMES. Topic lanes: LANES or let Threadify choose from my Brain. Approved destination: DESTINATION. Sources: own greatest hits, My Vault, optional connected Viral Vault. Policy: read the installed SKILL.md, threads-playbook.md and state-and-recovery.md on each run; these own generation, revision and recovery behavior. State folder: ~/.threadify-workflows/state/run-my-threads/. Prepare today's five posts and the approval card in this conversation and wait for my reply. Never schedule without my "yes" here. If today's card or receipt already exists, do not generate again.

The week plan values let any run rebuild the same plan with `scripts/week-plan.mjs`, even a cloud run without the local state folder. When the seven days end, the run moves `start_date` on seven days and adds one to `seed`; update the schedule prompt in place (never a second schedule). The state folder keeps the setup choices, the current week plan and the greatest-hit repost log; without it, the 60-day repost check relies on Threadify's `search_posts` and `list_scheduled_posts`.

A schedule's own prompt is never approval to schedule posts. Only the owner's reply to the card is.

## Codex

Create the schedule with Codex's own automation controls: ask Codex in this thread to add a daily automation, or use the Automations view. Do not hand-write Codex state files.

Prefer a thread automation attached to this thread, so every morning's card arrives in the conversation the owner opens from the Codex app and the "yes" lands in the same place. If thread automations are unavailable, use a project automation with the Threadify connection available; each run then opens a new thread. Codex saves an automation as `automation.toml` in its own automations folder; a thread automation reads back roughly as:

```toml
version = 1
id = "run-my-threads"
kind = "heartbeat"
name = "Run My Threads"
prompt = "Run the installed threadify-run-my-threads skill for today. ..."
status = "ACTIVE"
rrule = "FREQ=DAILY;BYHOUR=5;BYMINUTE=30;BYSECOND=0"
target_thread_id = "THIS_THREAD"
```

A project automation uses `kind = "cron"` with a project target and working folder instead of `target_thread_id`. Read back the name, `ACTIVE` status, daily rule and the next run Codex shows, and confirm that next run is 05:30 (or the chosen time) in the owner's timezone. Pause by setting the automation to paused in Codex.

## Claude Code

Preferred: a cloud routine. Create it with `/schedule` in the Claude Code CLI, at claude.ai/code/routines, or from the Desktop app's Routines page (New routine, Cloud). Choose a daily schedule at 05:30 local; times are entered in local time and converted for you. Read back the next run time.

- Connectors: include the Threadify connector from the owner's claude.ai connectors. A server added only on this computer with `claude mcp add` is not available to a cloud routine. Remove connectors the routine does not need.
- Skill: a routine runs in a fresh cloud copy of the repository you select, not on this computer. Select a repository that contains the installed skill, or the public `lennoxsaint/Threadify-workflows` repository with the prompt telling Claude to read `skills/threadify-run-my-threads/SKILL.md` at the installed release tag.
- Approval from the phone: each run creates a session. Open it in the Claude app and reply there. Routines run without permission prompts, so the skill's own stop-before-scheduling rule is what protects the owner.
- Manage: `/schedule list`, `/schedule update`, the on/off switch to pause.

Fallback when Threadify is configured only on this computer: a Desktop local scheduled task (Routines, New routine, Local, Daily 05:30). It runs only while the Desktop app is open and the computer is awake. A missed run catches up once on wake, so the run must plan slots from the current time, not from 05:30.

Do not use `/loop` or in-session scheduled tasks for this workflow. They need an open session and recurring ones expire after seven days.

## Other hosts

Use the host's one native daily scheduler (Cursor Automations, Gemini CLI, OpenClaw or Hermes cron) with the same prompt, or an owner-approved OS schedule that runs the agent's non-interactive command. Show the exact command, time and timezone and get consent before registering it. The same one-schedule rule applies.

## Usage readout

Each run reports what it used only when the host exposes it (for example a token or cost figure in the run details). Threadify's remaining generation quota comes from `get_connection_defaults` before and after the run. When the host shows no usage figure, say "usage not exposed by this host". Never estimate.

Notify only when a card is ready or an actionable blocker changes. Stay quiet for unchanged state. Expire unapproved prior cards only when preparing a new daily card; never migrate historical card text during a policy upgrade.
