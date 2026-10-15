# First Followers on a schedule

Asked once at the end of a run: "Want me to run this for you on a schedule?" Create a schedule only after the owner says yes and picks the days and time. Never create one silently, never create a second one, and never add an hourly or repeating check.

## What a scheduled run does

A scheduled run starts the workflow and stops at the batch approval: it checks the account, finds up to 10 people, drafts and checks the comments, and shows the list. Nothing is staged or followed until the owner replies "yes" in that run, and the owner still presses Post on every comment. The schedule's own prompt is never approval.

Staged mode needs the browser that is signed in to Threads on the owner's computer, so prefer a scheduler that runs on this computer while it is awake. A cloud run cannot see that browser; it can only run copy mode.

## Find before you create

List the host's existing schedules first and look for one named "First Followers" or whose prompt runs `threadify-first-followers`. One found: reuse it and change its time in place only when the owner asks. More than one: show them and ask which to keep. None: create one, then read it back.

## The prompt

> Run the installed threadify-first-followers skill. Account: @HANDLE. Timezone: AREA/CITY. People: 10. Read the installed SKILL.md on each run. Stop at the batch approval and wait for my "yes" in this conversation; never stage, follow or post without it.

## Create it with the host's own scheduler

- **Claude Desktop / Claude Code:** a local scheduled task (Desktop: Routines, New routine, Local, at the chosen time), so it can reach this computer's browser. A cloud routine (`/schedule` or claude.ai/code/routines) runs copy mode only. Do not use `/loop`; it needs an open session and expires.
- **ChatGPT:** a scheduled task in ChatGPT at the chosen time.
- **Codex:** an automation from Codex's own automation controls (ask in this thread, or the Automations view), preferably attached to this thread. Do not hand-write Codex state files.
- **Other hosts:** the host's one native scheduler (Cursor Automations, Gemini CLI, OpenClaw or Hermes cron).
- **Last resort:** an OS schedule (cron or launchd) that runs the agent's non-interactive command. Show the exact command, time and timezone and get the owner's consent before registering it.

Read back the name, days, time, timezone, next run and how to pause it. If the host has no scheduler, say so and offer to run it whenever the owner asks.
