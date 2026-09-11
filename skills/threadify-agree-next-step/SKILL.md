---
name: threadify-agree-next-step
description: Prepare and review one explicit next step from an active buyer conversation. Use when the owner wants exact wording, destination, permission checks and a recorded result.
---

# Threadify Agree the Next Step

Read `references/threadify-001.md`, `references/workflow-manifest.json` and `references/workflow-readme.md` from this skill directory.

Start from the supplied conversation and confirmed offer. Prepare exactly one next step with its recipient, destination, text and any promised date. If offer relevance or the next step is still unknown, ask one useful question or return to `threadify-your-next-moves`.

Use the installed exact-release CLI at `node ~/.threadify-workflows/current/cli/bin/threadify-workflows.mjs conversations`; when `THREADIFY_WORKFLOWS_HOME` was set during installation, resolve the same path below that state root. In a source checkout, use `node bin/threadify-workflows.mjs conversations`. Keep state private. Run `review`, show the exact action and hash, and accept only `approve` or `reject` for that display. Keep recipient interest, channel permission and owner approval separate.

Before a host delivery tool or manual handoff, re-open the source and record the fresh inspection. Persist `attempt_pending` through `begin-attempt` before the host acts. Record `succeeded`, `confirmed_not_sent` or `unknown` only from the real result. Never infer approval from silence or replay an uncertain action.

If the tool is unsupported, provide the manual next-step artifact and keep delivery unverified until the owner supplies evidence. A native reminder can prompt review only after explicit opt-in; it cannot approve or send.
