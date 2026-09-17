# Threadify Workflows stable releases

## 0.14.2

- Fixes horizontal clipping in the Lead Desk review page at narrow mobile widths. Cards, the reply editor and long destination links now wrap within the viewport.

## 0.14.1

- Adds an editable three-category Anti-Spam Lead Desk page served locally with private, revision-checked exact-text persistence.
- A final mark records the exact reply and hash for later readback; any edit revokes final status. The page itself never sends.
- Clarifies bounded two-week scans, coverage limits, already-replied exclusions, and historical filter examples.
- Live public replies require a separate owner send request, fresh account/target/safety checks, and provider readback.

## 0.14.0

- Adds Anti-Spam Lead Desk: a bounded five-card classifier for current public Threads evidence.
- Uses a verified-account/comment-read gate for warm owned-post comments, with current public browser profile inspection and an explicit Qualified Buyer Research fallback.
- Produces local JSON, Markdown and self-contained HTML plus at most one unsent useful public-reply draft.
- Does not scrape, automate research, DM, schedule, send, or claim leads, bookings, sales, or revenue.

## 0.13.0

- Adds Choose Your First Offer, a distinct niche-to-offer decision workflow for creators choosing between an intensive, guided lab, and self-serve kit.
- Uses one fixed scorecard across all three models: audience-evidence fit, speed to a valid signal, credible deliverability now, fulfillment simplicity, and scalability.
- Produces a ranked decision, Proof Loop Map, inactive validation page, and body-free receipt without creating an offer record or publishing anything.
- Preserves incomplete evidence as a constraint-led hypothesis and keeps engagement separate from demand, sales, conversion, product-market fit, and virality.

## 0.12.0

- Adds Refresh Your Threads Profile, which interviews the creator and combines their current niche with a bounded, priority-ordered set of approved context.
- Produces exactly three coherent clarity-, authority-, and personality-led bio-and-picture systems for explicit owner selection.
- Renders private JSON, Markdown, self-contained HTML, a circular small-avatar preview grid, a selected square SVG, and a body-free receipt.
- Freezes consented image assets by SHA-256, discloses external likeness processing, requires transfer consent, and preserves a no-upload visual fallback.
- Keeps live profile editing separate from preparation: current UI discovery, exact-account verification, sync/verification review, rollback state, one final confirmation, and readback are required. Ambiguous or mismatched results are never retried blindly.
- Does not claim that profile copy or imagery causes growth, conversion, or trust, and does not assume an official Threads profile-write API.

## 0.11.0

- Adds Find Your Niche, a read-only workflow that analyzes bounded owned Threads posts, audience comments and creator replies.
- Produces one recommended niche, one ideal-client avatar and three content pillars as private JSON, Markdown and self-contained HTML.
- Defaults to 90 days, expands only until 20 owned posts or a 365-day cap, and preserves incomplete coverage and unknown metrics.
- Keeps engagement separate from purchase intent and performs no draft save, profile edit, reply, schedule or publication.
- GitHub release approved by the owner. Live connected-account acceptance remains separate and unverified.

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
