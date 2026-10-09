# Setup execution adapters

All six clients use the same setup/creator state and explicitly scoped Threadify connection. Probe the current installed runtime; CLI presence alone is not connection, discovery or scheduler proof. Do not export the customer's entire home directory to a cloud agent.

| Client | Persistent route to verify | Local unattended route when needed |
| --- | --- | --- |
| Codex | Native app automation, saved configuration and run history | `codex exec` under an approved OS schedule |
| Claude Code | Supported persistent scheduled task with MCP available | `claude -p` under an approved OS schedule; `/loop` alone is insufficient |
| Cursor | Cloud Automation with the required MCP and private setup state available | `cursor-agent -p` under an approved OS schedule |
| Gemini CLI | Existing persistent automation if actually exposed | `gemini -p` under an approved OS schedule |
| OpenClaw | Gateway automation/cron; verify gateway heartbeat and next run | Keep the verified gateway running; no second duplicate scheduler |
| Hermes | Native cron with gateway/desktop scheduler status and real run history | Keep the verified scheduler running; no second duplicate scheduler |

Use supported native controls and current official documentation for the installed version. For an OS schedule, show the exact agent executable, private working directory, prompt, daily local time/timezone and device-on requirement; obtain consent before registration. Use launchd (macOS), systemd user timer (Linux), or Task Scheduler on a supported Windows private-state host. The current shared creator store requires POSIX permissions: Windows customers need a supported private POSIX environment such as WSL; do not claim native Windows state compatibility.

The recurring prompt: “Resume my private Threadify setup at [directory]. Read status. If paused, stop. Verify account, entitlement, current facts, allowance and Calendar. Persist begin-run before work. Fill only missing slots in the next seven local days using the saved mode and creator records. Reconcile unknown outcomes. Finish-run with actual evidence. Notify me only for review, a blocker or a meaningful result.”

Never add skip-permissions flags or blanket tool approval to make a background job work. Verify unattended access with a read-only invocation first. If required permissions cannot be established, report routine pending, keep the first week useful, and show the exact next step.

Native proof checklist per client: version/host; skill discovery; selected account connection; persistent configuration readback; real invocation; pause/resume; restart behavior; timezone; overlapping-run refusal. Mark each untested client unverified in the release evidence. No fixtures can fill this checklist.

Official scheduling references checked 2026-09-29: [Claude scheduled tasks](https://code.claude.com/docs/en/scheduled-tasks) distinguishes persistent Desktop/cloud routes from session loops. [Cursor Automations](https://prod.cursor.com/help/ai-features/automations) describes cloud execution. A fresh cloud checkout cannot see this local private state automatically: use a verified persistent private workspace or the local route. This documentation is not six-client live acceptance.
