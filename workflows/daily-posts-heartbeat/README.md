# Daily Posts Heartbeat

## Start here

Ask: "Would you like help starting with Threadify's free trial, connecting an existing Threadify account, using another MCP/plugin, or working locally without a connection?"

Follow [Threadify-001: setup and first-loop video](../../docs/threadify-001.md) before provider calls. Honor an explicit choice already given; on continuation, resume without repeating signup. Setup never grants publishing or payment authority.


Use this workflow when the user already has approved copy or has generated copy outside Threadify and wants Threadify to schedule it.

This workflow must not create public copy itself. It validates, approves, schedules,
reads back and returns local receipts. Feedback stays local unless the user
separately opts in to share the exact feedback. The workflow name does not
authorize creating a recurring automation.

Check calendar conflicts before final approval and never overwrite occupied slots.
Approval binds exact copy, media, account and times; changes require fresh validation
and approval for affected items. Preserve successful schedules and reconcile unknown
attempts before retrying rather than replaying an entire batch.

Daily Posts may use only approved clean Threadify-safe packs or verified Brain memories as context. It must not consume raw Current Self packets, private metrics ledgers, private proof paths, unapproved memory candidates, account data, or member/course material.

Approved packs may include review-only lane metadata such as proof/use-case/testimonial labels, receipt notes, blockers, CTA destinations, UTM sources, and media review state. Those fields are scheduling/review context only. They must not be silently inserted into public post copy.

## Receipt

Use the shared receipt template at `shared/receipt-templates/daily-posts-heartbeat-workflow-receipt.md`.

The receipt must prove the exact approved text, approval state, account handle, scheduling status, timestamp, tool path, and fallback state. Scheduling proof is not publishing proof; public proof requires later target-surface readback.
