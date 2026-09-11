# Plugin packaging

## Current 0.8.0 candidate

The root plugin discovers the runnable catalog generated from canonical workflow manifests. A fresh install selects the full catalog. Existing client selections stay unchanged when an upgrade omits `--workflows`; `threadify-workflows install --workflows all` is the explicit full-catalog migration.

The recommended starter is Your Next Moves. It calls Offer Builder when no confirmed offer exists, then returns to the supplied conversation review. The five buyer skills share the local conversation engine and keep their private state outside plugin and release archives.

The root `.codex-plugin/plugin.json` and release bundle include current source skills through the registry. No second handwritten workflow list is authoritative. The plugin still exposes `.mcp.json`, but local preparation does not require authentication. Connect Threadify only when a useful step needs a current hosted capability.

Source validation and extracted archive tests do not prove native client discovery. Codex and Claude Code walkthroughs for the new starter remain pending. Other client adapters are structural-only until separately observed. Local conversation state is supported on macOS and Linux; Windows installation is not state-engine proof.

## Prior packaging evidence

The statements below record earlier release checks. They do not describe the current catalog or prove the 0.8.0 candidate.

In the 0.5.0 packaging design, four creator skills were the primary entrypoints and seven existing skills retained their names as advanced or approved-copy compatibility workflows. Its starter prompts were Vault Setup, Create My Day and Plan My Content.

`npm run bundle:build` renders the QBR compatibility bundle, four creator
bundles and seven root advanced bundles. `npm run bundle:check` checks parity.
Root advanced bundles contain local references, not checkout-relative manifest
dependencies. The nested QBR bundle remains the existing standalone installer
source; this packaging change does not silently replace its update protocol.
YouTube editing still requires the separate Eddy engine; an archived plugin
does not include that submodule or prove an edit can run.

September 7, 2026 verification used the installed plugin-creator validator and
the [official packaging reference](https://developers.openai.com/plugins/build/plugins).
The installed validator requires a `mcpServers` wrapper in `.mcp.json`, whereas
the web reference also documents direct maps. This package uses the locally
validated wrapper with the existing Threadify HTTPS endpoint. No credentials
are bundled. An accepted manifest is not proof of authentication, entitlement,
host loading or a live provider operation.

The contract's Autopilot 0.5.0 skill is unavailable at its recorded path and no
replacement was found in the installed skill locations. Its validation has
not been rerun. Plugin-creator supplies the current local packaging fallback.

## Release scope and remaining verification

The owner authorized the 0.5.0 GitHub release with all creator workflows and
shared onboarding, explicitly deferring Directory submission. App PR 178 is
not required and must not be merged or deployed for this release.

The release gate is source validation, relevant tests, bundle parity, final diff
review and immutable artifact verification. Full-source install/upgrade tests
cover filesystem and CLI behavior. Automatic client discovery and owner-approved
live scheduling remain separate, unproven acceptance checks; this version does
not claim those results. Seven connected editable drafts were validated without
scheduling. Directory identity, support and visual assets are later work.

Run bundle:build explicitly before release generation. The release builder
checks parity without rewriting sources, reserves a new output directory and
refuses existing paths. It never deletes earlier outputs. An in-repository
output must be under dist; its parent must already exist. Failed builds may
leave their new directory for inspection; choose another new path for a retry.

Plugin, standalone skill and CLI assets all use the same explicit public-root
inventory. Local state, hidden scratch files and symlinks are excluded or
rejected. This does not classify arbitrary document contents as public: the
final archive still needs privacy and whole-inventory review. Local package
validation is not release readiness or Directory acceptance.

## Local candidate verification

Use `node scripts/build-release-assets.mjs --candidate --out /absolute/new-directory`
for local verification of uncommitted work. The parent directory must exist.
Candidate bundles identify the checked-out base commit, whether the worktree is
dirty, and a deterministic content-manifest hash. Their version fields reflect
the current release intent, not a new published version. A commit override must
match HEAD; it cannot relabel different source code.

Candidates use distinct bundle and manifest record types and are rejected by
the stable installer. Stable builds require a clean worktree. Neither build
mode grants permission to publish, deploy or submit a plugin.

The candidate test builds twice and compares every output byte, verifies file
hashes after temporary extraction, and runs the extracted plugin and standalone
CLI without dependencies from the checkout. This is local extraction and CLI
smoke proof, not Codex host installation, upgrade or connected-provider proof.

`validation/creator-tests/full-install.test.mjs` adds full-source filesystem
installation proof. It builds the recorded v0.4.1 source and a clean temporary
snapshot of current public files, then exercises fresh Codex-target installation,
upgrade, all four creator skill paths, installed CLI execution and rollback.
Synthetic private user data survives upgrade and rollback. Only the disposable
snapshot enables stable building at candidate version 0.5.0 to exercise the updater;
the canonical release intent stays disabled. This is not a published artifact. Automatic updates are disabled,
and owner settings are untouched. Codex UI discovery and authentication remain
separate checks.

The release builder also emits `threadify-workflows-plugin-candidate.tar.gz`
(or `threadify-workflows-plugin.tar.gz` for a clean stable build), with its SHA-256
and size in the manifest and checksum list. It uses exactly the plugin bytes
already captured in the JSON bundle. File order, permissions, ownership and
timestamps are normalized; staging is private and disposable. BSD tar or GNU
tar is required. Two-build reproducibility and extracted-file hash equality
are tested on the current toolchain; equal compressed bytes across different
tar/zlib implementations are not claimed. The archive is not a Directory
submission or evidence that Codex has loaded the plugin.
