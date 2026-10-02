# 0.24.1

- Fix `npx github:lennoxsaint/Threadify-workflows` installs failing with exit 128: the `engines/eddy` submodule now points at `lennoxsaint/eddy-legacy`, which serves the pinned commit. The pinned commit is unchanged.
- Add a regression test that keeps the submodule URL and pinned commit consistent.

# 0.24.0

- Add Threads Teach, a stateful teaching workflow with ten short lessons on Lennox Saint's core Threads frameworks, each illustrated with one of his real public posts.
- Keep a private learning workspace (mission, lessons, learning records, glossary) so each session continues from the last and opens with retrieval practice.
- Teach on the learner's own posts through read-only Threadify tools when connected, and on pasted posts otherwise, stating what cannot be seen.
- End every lesson with one post the learner writes themselves; saving a draft and scheduling are separate actions that each need exact approval and readback.
- Credit the teaching method to Matt Pocock's MIT-licensed `teach` skill and ship its licence notice with the skill.

# 0.23.1

- Reject a new retry key for the same Growth Loop account/day/card, preserving the original persisted save intent and its reconciled status.
- Block ambiguous legacy state containing multiple save intents for one card until provider state is inspected and reconciled; do not delete intents or imply provider cleanup occurred.
- Give Growth Loop its own six-hour recurring instructions for maturity scans, tomorrow's six-card plan and authoritative draft-save reconciliation, replacing the unrelated creator setup/seven-day-fill prompt.
- Preserve the draft-only boundary: skip reconciled saves, inspect ambiguous outcomes before retrying, and never schedule or publish automatically.
- Verify three regressions that fail on the prior release, generated bundle parity and the full synthetic test suite. Native runner and live provider behavior remain separate verification steps.

# 0.23.0

- Add Monetize My Week, which selects exactly seven offer-relevant existing drafts while preserving every post body, thread part and media item unchanged.
- Use the first seven conflict-free local dates at current measured best times, with one tailored tracked Auto Plug exactly 50 minutes after each post.
- Require one exact seven-row approval packet, fresh validation, stable idempotency, schedule reconciliation and provider readback before reporting a confirmed schedule.
- Keep Threads-only scope, existing global automation, incomplete entitlements and ambiguous outcomes explicit; no workflow result is described as published, clicked or converted without readback.
- Measure publication, performance and link attribution over a common observation window, saying “attributed” rather than “caused” and keeping Auto Plug-only results separate from broader account totals.

# 0.22.0

- Add Threadify Growth Loop as an installable workflow on top of 30-Day Viral Vault.
- Let a new user prepare the first six-draft day immediately from two explicit safety- and rights-reviewed candidate hypotheses; promotion remains an evidence label, not a cold-start blocker.
- Evaluate authoritative 72-hour reach evidence and attributed 7-day commercial evidence without inventing missing attribution.
- Promote a hypothesis only after three comparable tests across two days, two positive results, a median win over baseline, and no safety, rights, or known commercial regression.
- Keep tomorrow's portfolio fixed at two Greatest Hits, two Viral Vault, two My Vault; four proven and two challenger; two broad, two expertise, and two personal cards.
- Persist private versioned state, save intents, authoritative draft receipts, pause state, and verified six-hour runner readback.
- Support Codex, Claude Code, Cursor, Gemini CLI, OpenClaw, Hermes, and generic MCP installation while labeling unobserved native scheduling routes unverified.
- Intentionally provide no automatic scheduling or publishing command.

## 0.21.0

- Add Get Set Up, private recovery state and six runtime installation adapters.
- Add explicitly selected scheduling permission with revocation and provider readback requirements.
- Add a public single-file entry and a short one-prompt customer start.
- Add an honest OpenAI Dot-to-supported-runtime handoff without claiming native Dot installation.
- Add a compact operator-proof completion card for account, Brain, first week, review and routine readback.
- Keep native runtime, customer connection and provider results explicit: adapter presence is not live acceptance proof.

# Threadify Workflows stable releases

## 0.20.0

- Preserves YouTube Synthesizer's pure `youtube-synthesizer.v1` generation contract and zero-write receipt while adding a separate `youtube-synthesizer-delivery.v1` module.
- Freezes the exact ordered thread, target Threads account, action, time and timezone, optional owner-image hash and provider reference, visible automation state, and a stable idempotency key into one immutable approval packet.
- Defaults to fresh best-time scheduling with calendar-conflict checks and also supports explicit publish-now when the current Threadify connector advertises it.
- Requires separate approval before uploading one local owner-supplied image, then fresh final delivery approval after the provider URL is known.
- Persists request intent before every provider write, dispatches once, and blocks ambiguous retries until authoritative schedule or publication readback matches the exact approved content.
- Keeps exact-post validation, best-time evidence, and the account calendar fresh through final approval; an ambiguous image-upload attempt is counted and can never be relabelled as a zero-write manual fallback.
- Never downloads YouTube media, silently rewrites copy, adds a plug, enables per-post reposting, hides account-wide Auto Repost, or cross-posts to another platform.
- Includes a private manual fallback and deterministic in-memory adapter tests; this release does not schedule or publish a real Threads post.

## 0.19.0

- Adds YouTube Synthesizer: one URL becomes three evidence-backed hook options and one complete long-form Threads draft, or a hard abstention when no structure is supported.
- Ships exactly twelve immutable word-for-word templates across Authority, Investigation / Data, Wisdom, and Playbook / Case Study, plus exactly thirty-six owned, attributed, permission-cleared original threads.
- Scores every template, fills only transcript- or verified-metadata-backed placeholders, requires Threadify Brain context or three distinct approved samples, and locks fixed wording and originals with SHA-256 integrity checks.
- Extracts public captions without an API key, supports optional caption-only `yt-dlp` with media downloading disabled, and accepts local TXT, VTT, or SRT fallbacks.
- Treats transcripts as untrusted data, never executes their instructions, never downloads video or audio, never fabricates a claim, and never saves, schedules, or publishes generated content.
- Includes strict schemas, transcript fixtures, abstention and prompt-injection cases, body-free receipts, and full Codex, Claude Code, Cursor, Gemini CLI, OpenClaw and Hermes bundles.

## 0.18.0

- Adds Market to Pipeline: a local-first workflow for turning one offer and one bounded market into a private qualified pipeline, exact next actions, and exactly seven evidence-linked posts.
- Combines normalized Threadify-owned buyer signals with host-supplied Treg discovery and enrichment while keeping every network call, credential, and raw private payload outside the bundled engine.
- Caps each run at 50 raw signals, 10 selected prospects, and a caller-confirmed price-previewed budget no greater than US$3.00; company fit must precede person or contact enrichment.
- Keeps warm interest, private-channel permission, current work-contact verification, lawful basis, suppression, sender identity, and unsubscribe controls as separate gates. A verified email is never treated as consent.
- Binds approval to the exact action hash, persists a pending attempt before delivery, blocks ambiguous retries until reconciliation, and emits public receipts without bodies or contact destinations.
- Ships deterministic synthetic proof, private JSON/CSV/HTML review artifacts, and full Codex, Claude Code, Cursor, Gemini CLI, OpenClaw and Hermes bundles.

## 0.17.0

- Adds AI Content Forensics: a local-first workflow for turning an inspectable creator corpus into evidence-linked content rules and copyable templates.
- Keeps metrics platform- and format-specific, requires 20 unique metric-valid items for comparative claims, and labels every relationship as observed rather than causal or predictive.
- Produces five constitutions, an insight audit, exactly ten posts with seven `copy this:` templates, a body-free receipt, and optional local SVG/HTML visuals.
- Supports approved exports and read-only Threadify evidence by default, with an optional bounded Scrape Creators BYO-key adapter that never persists or prints credentials.
- Installs through the full catalog for Codex, Claude Code, Cursor, Gemini CLI, OpenClaw and Hermes while keeping all outputs draft-only.

## 0.16.0

- Adds 30-Day Viral Vault: a slot-only 30-day blueprint that prepares the current day's six posts instead of creating 180 drafts upfront.
- Requires exactly two owned Greatest Hits, two eligible Viral Vault sources and two eligible My Vault sources, with reach-first, balanced and lead-first composition modes.
- Preserves exact owned reposts and rights-gated literal fill-in templates while blocking missing permission, placeholder coverage, claims evidence or replacement facts.
- Reveals only the current card and persists edit, approval, skip, rejection, local handoff and idempotent scheduling states; ambiguous delivery blocks retries and never becomes a publication claim.
- Installs through the existing full catalog for Codex, Claude Code, Cursor, Gemini CLI, OpenClaw and Hermes, with a generic MCP-compatible operating contract.

## 0.15.0

- Adds Post This Next, a read-only workflow that evaluates every eligible draft from one verified Threadify account before recommending what to review next.
- Supports three explicit goals: most useful now, best match to owned engagement patterns, and closest to ready. Comparison mode can show all three without treating pattern fit as a traffic forecast.
- Uses a portable Jev adapter for typed scoring, abstains to the top two when confidence or separation is weak, and preserves a clearly labelled manual shortlist when Jev is unavailable.
- Binds evaluations to complete pagination and exact content hashes, rechecks the selected draft before display, keeps artifacts private and performs no draft edit, save, schedule, publish or delete action.

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
