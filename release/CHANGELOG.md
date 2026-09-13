# Threadify Workflows stable releases

## 0.10.0

- Adds Inbound Replies to the public workflow catalog with grouped post context, exact local editing and approval, deferral and suppression, and private resumable state.
- Ships the complete local UI and CLI inside the installed skill, including paths with spaces and fresh-install execution.
- Discovers current Threadify read, draft and delivery capabilities through the dispatcher; unavailable capabilities remain explicit and no historical tool name is treated as live authority.
- Preserves idempotent delivery preparation, ambiguous-outcome reconciliation and body-free public receipts. This release does not send a live reply or deploy Threadify application code.

## 0.9.0

- Adds exact-copy browser review for Day, Week and Month, optional automation controls, durable Submit approval and verified host delivery handoff.
- Preserves the v0.8.0 workflow catalog, buyer-conversation engine, carousel workflow and current onboarding.
- Published through the owner-approved release process; no live content scheduling or app deployment is implied.

## 0.8.0

- Makes Your Next Moves the starting point for offer-led buyer conversations, with local preparation before an optional account connection.
- Adds Agree the Next Step, Follow Through, Buyer Questions to Content and Weekly Buyer Outcomes.
- Adds private, revision-checked conversation records, exact-action review, separate recipient permission, pending-attempt recovery and evidence-based outcome summaries. The local engine does not perform provider actions.
- Generates the workflow catalog and compatibility reference from canonical manifests, with JSON list, describe and doctor commands.
- Installs the full runnable catalog for fresh clients. Existing installations retain their selection until explicit migration; rollback preserves private working state.
- Includes Greatest Hits Runway and Content Brain Repair in stable assets.
- Reworks the README and client guides around the first useful conversation review, with explicit current capability gaps.

## 0.7.0

- Adds Threadify Offer Builder (`threadify-offer-builder`), with the Offer Architect interview.
- Supports ten adaptive questions, shortened filming mode and clearly labelled fictional demos.
- Creates a responsive local offer page and separate owner handoff without a provider connection.
- Prepares optional offer saves with duplicate checks, exact approval, stable retry identity and readback checks.
- Preserves the separate live integration and stable publication gates.

## 0.6.0

- Bundles the exact public Viral Carousel Maker v0.2.0 runtime, source skill,
  templates, and byte-identical controlled-mutation demo and QA contracts.
- Adds a free local viral-carousel workflow that completes seven-edit creation
  and review without a Threadify MCP call, provider write, or external action.
- Adds fresh connector/account/timezone/capability/best-time/calendar gates,
  separate hash-bound media-transfer and schedule approvals, durable request
  intent, crash reconciliation, and duplicate prevention.
- Adds one-install parity, lifecycle safety, clean-install, and privacy evidence
  required by THREADIFY-021. Directory submission and app deployment remain deferred.

## 0.5.0

- Adds Vault Setup, Create My Day, Create My Week and Create My Month, including
  local drafting without a Threadify connection and a clearly labeled four-week month.
- Adds the local Node review engine, versioned records, source-rights checks,
  approval binding, private state, interrupted-run recovery and opt-in feedback.
- Bundles four primary creator skills and seven preserved advanced/compatibility skills.
- Adds reproducible candidate archives and isolated install/upgrade/rollback checks.
- Keeps hosted Brain services and shared corpus data outside the public package.
- Adds a shared opening question and bundled Threadify-001 setup/video guide to
  every workflow: new trial, existing connection, another provider or local work.
- GitHub release approved by the owner. Directory submission is deferred.
  Seven editable connected drafts were validated; live scheduling acceptance and
  automatic host discovery remain unproven. This release does not claim either.
- Works without the unreleased shared-Viral app changes. Existing My Vault,
  Greatest Hits and supplied-source fallbacks remain available. No app deployment.

## 0.4.1

- Prevents duplicate discovery by excluding the universal `~/.agents` target from native `--targets all` installations.
- Keeps `~/.agents/skills` available as an explicit target and as the fallback when no native client is detected.
- Reconciles and removes only stale Threadify-managed targets when the selected client set changes.

## 0.4.0

- Makes Qualified Buyer Research self-contained for standalone agent installation.
- Adds a versioned public durable ruleset and redacted proposal contracts.
- Adds stable-channel install, update, status, rollback, and uninstall commands.
- Adds daily and on-use update checks with explicit consent, locking, validation, atomic switching, cached fallback, and rollback.
- Keeps private FC5 context, voice samples, student data, account identifiers, and raw outcomes outside the public repository.
- Changes twenty-outcome learning from automatic public mutation to `promotion_recommended`; Lennox approves a public release by merging its tested release PR.
