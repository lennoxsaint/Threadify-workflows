# Automatic updates

Threadify Qualified Buyer Research uses a controlled stable channel:

`dogfood evidence -> redacted tested PR -> Lennox merge approval -> GitHub stable release -> validated client update`

`main` is never the update authority. The updater downloads only the latest GitHub Release, verifies its stable release manifest and SHA-256 bundle hash, validates every bundled file, stages the release, then switches managed targets.

## Install

Node 18 or newer is required.

```sh
npx --yes github:lennoxsaint/Threadify-workflows install
```

Or from a clone:

```sh
node bin/threadify-workflows.mjs install
```

The installer asks for explicit automatic-update consent in an interactive terminal. Agents acting from an explicit owner instruction may pass `--enable-auto-update`. Use `--disable-auto-update` to install the current stable release without background mutation.

## Commands

```sh
threadify-workflows install
threadify-workflows update
threadify-workflows status
threadify-workflows rollback
threadify-workflows uninstall
```

The installer detects Codex, Claude Code, Cursor, Gemini CLI, OpenClaw, Hermes, and the universal `~/.agents/skills` directory. It changes only Threadify-owned targets and refuses to overwrite unrelated skills.

State, release history, receipts, preserved migration context, and the last-known-good releases live under `~/.threadify-workflows/`.

## Update behavior

- Daily scheduler checks include up to thirty minutes of jitter.
- Skill use checks only when the last successful check is older than twenty-four hours.
- Rules-only changes reload and continue.
- Skill logic or installer changes return `updated_restart_required`.
- Offline, invalid, interrupted, or checksum-failed updates return `update_failed_using_cached_version`.
- The current release plus two prior releases are retained for rollback.

The updater never sends a reply, changes Threadify production data, edits Skool, or updates unrelated skills.
