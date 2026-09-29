# Setup candidate verification

Status: local implementation candidate, not released and not live-customer accepted.

## Changed behavior

- Public matching-version installation file; verified stable installer and disabled automatic updates during setup.
- Private resumable setup state, consented bounded filename discovery, confirmation hashes and phase evidence.
- Standing schedule permission bound to account, topic, local times, voice approval and pending run. Review remains default.
- Pending-run exclusion, revocation, daily frequency checks, occupied-slot preservation and unknown-outcome reconciliation.
- Six runtime probes and host adapters; native persistent registration belongs to each host, not forged config files.
- Companion product branch adds anonymous setup and account-scoped Brain processing/status tools.

## Local evidence

The full workflows suite passed (278 tests before the final run-binding check); targeted creator (127) and setup (8) checks passed after that change. The actual CLI was started in separate processes: session identity survived, pause persisted, stale revision failed and incomplete readiness stayed false. Candidate asset hashes and standalone CLI extraction were checked. Installer tests cover baseline upgrade, preserving private material and rollback with synthetic hosts.

These are local behavior and synthetic-provider checks. They are not account signup, Brain learning, scheduling or real recurring-job proof.

## Required live acceptance before support/release claims

For EACH of Codex, Claude Code, Cursor, Gemini CLI, OpenClaw and Hermes: native discovery, intended account access, persistent job readback, read-only unattended access, one real invocation, pause/resume, restart, timezone and overlap behavior. Current local probes returned versions for the first five; Hermes version execution was unsuccessful. All six connection and recurring acceptance states remain unverified.

Separately test fresh normal-customer signup, existing-customer reconnect, no writing/offer, mixed brands and conflicting facts, processing plus retrieval, durable voice after later processing, calendar exact readback, interruption and uncertain provider outcomes. Current demonstration connection cannot access the requested profile. No alternative profile may substitute.

The candidate has `release:false`. Merge, migration application, deployment, stable release and live customer writes need their respective authorization. This document does not approve them.
