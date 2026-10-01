---
name: threadify-growth-loop
description: "Advanced workflow. Learn from mature Threadify post evidence, update a private hypothesis ledger, prepare tomorrow's four-proven/two-challenger queue, and save six drafts without scheduling them."
---

# Threadify Growth Loop

Use this skill when the owner asks for a self-improving content workflow, wants mature posts turned into tomorrow's drafts, or names the Threadify Growth Loop.

Read `references/workflow-readme.md`, `references/setup-adapters.md`, and `references/growth-loop.v1.json` before setup. Resolve scripts and references relative to this skill directory.

## Non-negotiable boundary

This workflow can read evidence, learn, prepare, and save drafts after the owner approves that standing draft-save scope. It cannot schedule or publish. There is no scheduling command in the engine. If the owner wants one post scheduled, hand off to the 30-Day Viral Vault approval path and show the verified account, exact copy, exact time/timezone, validation result, and action immediately before the provider call. Read the provider result back once.

Never expose credentials, private customer data, exact draft bodies in status receipts, or the whole private state file. Never infer a metric, attribution, source right, save, schedule, or publication. Unknown stays unknown.

## First setup

1. Verify the selected Threadify account by immutable ID and label. For balanced mode, verify the active offer. Confirm the timezone and six unique daily times.
2. Explain the fixed portfolio: two Greatest Hits, two Viral Vault, two My Vault; four proven and two challenger; two broad, two expertise, two personal; at least three structures including a listicle; at most one earned CTA.
3. Show the owner that the loop may save all six drafts automatically, but will never schedule them. Obtain one explicit approval for that standing draft-save scope and the persistent six-hour runner.
4. Choose a dedicated absolute private state directory with owner-only permissions. Do not use a home directory root, shared folder, symlink, or cloud checkout.
5. Write `growth-loop-setup.v1` JSON and run:

   `node scripts/growth-loop-cli.mjs setup --state /absolute/private-directory --input /absolute/setup.json --revision 0`

6. Configure a supported persistent route from `references/setup-adapters.md`. Native controls come first. An operating-system scheduler is allowed only after showing the exact executable, working directory, prompt, six-hour interval, timezone, device-on requirement, and pause command. Never add blanket permission-bypass flags.
7. A configured job is not verified. Run one real read-only invocation, read the job configuration and next run back, then run `configure-runner` with `growth-loop-runner.v1` proof containing the job ID, next run, invocation ID, device requirement, and pause command. Label every untested adapter `unverified`.

## Six-hour maturity run

1. Run `status`. If paused, stop. Refuse overlapping runs.
2. Verify the account and current connected capabilities. Find posts that newly crossed 72 hours or seven days; do not reread a checkpoint already in state.
3. At 72 hours, collect authoritative reach/engagement evidence and a matched baseline of at least five comparable posts. At seven days, use commercial evidence only when it has post-level attribution. Otherwise record attribution as unknown.
4. Each observation must name one hypothesis, one changed dimension, its value, source lane, template, format, goal, time band, evidence reference, published/check times, safety state, and rights state.
5. Run `scan` with the current revision. A hypothesis is promoted only after three comparable mature tests across two publication days, two positive results, median performance above baseline, no safety/rights issue, and no known commercial regression.
6. Show `display-hypotheses`. Do not claim causality or future performance; describe observed matched evidence.

## Prepare and save tomorrow

1. Use the 30-Day Viral Vault source and template rules. Rights-check every source and preserve the exact literal template pattern.
2. Keep four proven cards stable. Bind exactly one of the two highest-ranked promoted hypotheses to each challenger, changing only its named dimension.
3. Run `prepare-day` with the current revision. The public output is body-free and includes hashes.
4. For each of the six cards, run `begin-save` before calling `save_draft`. The returned operation carries the exact body, verified account, content hash, and idempotency key.
5. Call `save_draft` once. Then read the provider result and run `reconcile-save` with an authoritative matching account, provider draft ID, idempotency key, and content hash. If the result is ambiguous, inspect provider state before any retry.
6. Run `display-run --date YYYY-MM-DD`. Report six reconciled draft saves, any unknown result, the next six-hour run, and the pause command. Do not schedule.

## Operator commands

- `setup`, `scan`, `prepare-day`, `begin-save`, `reconcile-save`, and `configure-runner` require `--state`, `--input`, and the current `--revision`.
- `status` and `display-hypotheses` require `--state`.
- `display-run` requires `--state` and `--date`.
- `pause` and `resume` require `--state` and the current `--revision`.

Use `threadify-workflows growth-loop ...` from the package or `node scripts/growth-loop-cli.mjs ...` inside the installed skill.
