# Setup release verification

Status: 0.21.0 release candidate with stable intent enabled; not yet merged, released or live-customer accepted.

## Changed behavior

- Public matching-version installation file; verified stable installer and disabled automatic updates during setup.
- Private resumable setup state, consented bounded filename discovery, confirmation hashes and phase evidence.
- Standing schedule permission bound to account, topic, local times, voice approval and pending run. Review remains default.
- Pending-run exclusion, revocation, daily frequency checks, occupied-slot preservation and unknown-outcome reconciliation.
- Six runtime probes and host adapters; native persistent registration belongs to each host, not forged config files.
- The current authenticated Threadify MCP advertises the account, Brain, draft, offer, validation, Calendar and scheduling tools used by the setup flow. Brain processing may still require the existing app Sync control when dedicated processing tools are unavailable.
- OpenAI Dot requests use an honest Dot-to-supported-runtime handoff. Dot is not a seventh native installer target.

## Local evidence

The exact release branch passes the full workflows suite, including installer, creator, setup, release, upgrade and rollback coverage. The actual CLI was started in separate processes: session identity survived, pause persisted, stale revision failed and incomplete readiness stayed false. Candidate asset hashes and standalone CLI extraction were checked. Installer tests cover baseline upgrade, preserving private material and rollback with synthetic hosts.

These are local behavior and synthetic-provider checks. They are not account signup, Brain learning, scheduling or real recurring-job proof.

## Required live acceptance before native runtime and outcome claims

For each client named in a public native-support claim: native discovery, intended account access, persistent job readback, read-only unattended access, one real invocation, pause/resume, restart, timezone and overlap behavior. Adapter and isolated-install coverage may ship while each untested native runtime remains explicitly unverified. A Dot claim separately requires an observed Dot-to-supported-runtime delegation and returned receipt.

Separately test fresh normal-customer signup, existing-customer reconnect, no writing/offer, mixed brands and conflicting facts, processing plus retrieval, durable voice after later processing, calendar exact readback, interruption and uncertain provider outcomes. Current demonstration connection cannot access the requested profile. No alternative profile may substitute.

The candidate has `release:true` under the owner's 30 September 2026 release request. The flag is inert on the feature branch. Merging PR 28 into `lennoxsaint/Threadify-workflows` main will trigger the stable v0.21.0 GitHub release and advance `stable`; that consequential merge still requires the repository's immediate confirmation. No app deployment, migration or live customer write is part of this workflow release.
