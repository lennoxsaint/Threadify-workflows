# Growth Loop execution adapters

All six clients use the same private Growth Loop state and explicitly scoped Threadify connection. Probe the current installed runtime; CLI presence alone is not connection, discovery or scheduler proof. Do not export the customer's entire home directory to a cloud agent.

| Client | Persistent route to verify | Local unattended route when needed |
| --- | --- | --- |
| Codex | Native app automation, saved configuration and run history | `codex exec` under an approved OS schedule |
| Claude Code | Supported persistent scheduled task with MCP available | `claude -p` under an approved OS schedule; `/loop` alone is insufficient |
| Cursor | Cloud Automation with the required MCP and private Growth Loop state available | `cursor-agent -p` under an approved OS schedule |
| Gemini CLI | Existing persistent automation if actually exposed | `gemini -p` under an approved OS schedule |
| OpenClaw | Gateway automation/cron; verify gateway heartbeat and next run | Keep the verified gateway running; no second duplicate scheduler |
| Hermes | Native cron with gateway/desktop scheduler status and real run history | Keep the verified scheduler running; no second duplicate scheduler |

Use supported native controls and current official documentation for the installed version. For an OS schedule, show the exact agent executable, private working directory, prompt, six-hour interval/timezone and device-on requirement; obtain consent before registration. Use launchd (macOS), systemd user timer (Linux), or Task Scheduler on a supported Windows private-state host. The Growth Loop store requires POSIX permissions: Windows customers need a supported private POSIX environment such as WSL; do not claim native Windows state compatibility.

The recurring prompt: “Resume Threadify Growth Loop at [directory] every six hours using the installed threadify-growth-loop skill. Read status; if paused, stop, and refuse overlapping runs. Verify the selected account, current capabilities and standing six-draft save approval. Inspect provider state for pending or ambiguous saves before any retry; reuse each original idempotency key, and never save an already reconciled card again. Collect only newly mature 72-hour engagement and attributed seven-day commercial checkpoints; keep unavailable evidence unknown. Run scan with the current revision and display-hypotheses. Prepare tomorrow's six-card day in the saved timezone with prepare-day: two Greatest Hits, two Viral Vault, two My Vault; four proven and two challenger; two broad, two expertise, two personal; at least three structures including a listicle; at most one earned CTA. Preserve any existing day plan. Persist begin-save before each save_draft call under the approved draft-only scope, then reconcile-save using authoritative account, provider draft ID, readback of the original key and content hash. Use the current revision for every mutation. Read display-run for the target date and report reconciled saves, unknown outcomes, next run and pause command. Notify me only for review, a blocker or a meaningful result. Never schedule or publish.”

Never add skip-permissions flags or blanket tool approval to make a background job work. Verify unattended access with a read-only invocation first. If required permissions cannot be established, report routine pending, keep the prepared six-card day local, and show the exact next step.

Native proof checklist per client: version/host; skill discovery; selected account connection; persistent configuration readback; real invocation; pause/resume; restart behavior; timezone; overlapping-run refusal. Mark each untested client unverified in the release evidence. No fixtures can fill this checklist.

Official scheduling references checked 2026-09-29: [Claude scheduled tasks](https://code.claude.com/docs/en/scheduled-tasks) distinguishes persistent Desktop/cloud routes from session loops. [Cursor Automations](https://prod.cursor.com/help/ai-features/automations) describes cloud execution. A fresh cloud checkout cannot see this local private state automatically: use a verified persistent private workspace or the local route. This documentation is not six-client live acceptance.
