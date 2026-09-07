# Threadify Workflows stable releases

## 0.6.0 candidate (not released)

- Adds a private in-app browser editor to Day, Week and Month with Threads-style
  cards, exact text/spacing edits, local saving and one final Submit.
- Binds opt-in Auto Plug and Auto Repost to the reviewed post; displays account-wide
  repost overrides and requires matching fresh settings and schedule receipts.
- Adds resumable submitted intents, stale-tab protection, atomic approval application
  and local-only edit feedback. Provider delivery still runs through the active host.
- Keeps v0.5.0 as the published stable version. Release approval is pending.

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
