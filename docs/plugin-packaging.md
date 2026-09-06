# Creator plugin packaging

The root `.codex-plugin/plugin.json` discovers `skills/` and `.mcp.json`.
Four creator skills are the primary entrypoints. Seven existing skills retain
their names as advanced or approved-copy compatibility workflows. The three
starter prompts are Vault Setup, Create My Day and Plan My Content.

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

## Remaining release gates

- Repeat full install/upgrade checks against the final release artifact and
  verify Codex host discovery/loading, not only filesystem installation.
- Audit advanced workflow behavior and generation/free-versus-paid guidance.
- Complete actual reviewer demonstrations; creator schemas and validation states
  already have local implementation and automated fixture coverage.
- Select and verify visual assets and publisher, support and legal details.
- Build and compare two release archives, then test the extracted contents.
- Obtain exact approval for the live connected Day and for any deployment,
  release publication or Directory submission. None is implied by this file.

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
