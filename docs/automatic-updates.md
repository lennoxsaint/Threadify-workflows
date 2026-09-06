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

For the current user's home, Codex targets respect an intentional `CODEX_HOME` setting. An alternate `home` supplied through the installer API targets that home's `.codex` directory instead of inheriting the caller's Codex configuration. Native commands and filesystem fallback links use the same rule. This isolates the Codex target; it is not a general process or credential sandbox.

Native installation checks configured marketplaces before changing them. A same-name marketplace is replaced only when its local source resolves to a marked release owned by this installer. Unknown, remote or unrelated sources stop installation. Updates re-register a changed managed marketplace source and reinstall the plugin without first uninstalling its cache. A later failure still requires recovery; this is not an atomic native update.

Local `status` checks filesystem targets, but a native plugin entry remains `installed_unverified` with `exists: null` until a separate native readback is obtained. The saved installation record does not prove current Codex loading. Empty target lists report `not_installed`.

Install, rollback and uninstall share the update lock. An aged lock is recovered only when its recorded process is confirmed absent; live processes, unknown owners and permission-denied probes stop the operation. A separate recovery lock serializes recovery attempts. If that recovery lock itself is left behind, verify the owning processes and client state before manual repair; age alone never authorizes removing it.

## Update behavior

- Daily scheduler checks include up to thirty minutes of jitter.
- Skill use checks only when the last successful check is older than twenty-four hours.
- Rules-only changes reload and continue.
- Skill logic or installer changes return `updated_restart_required`.
- Offline, invalid, or checksum-failed updates before target changes return `update_failed_using_cached_version`.
- Once target changes begin, a failed or interrupted attempt requires recovery. The updater records `mutation.json` before changing targets and returns `update_failed_requires_recovery`, with no claim about installed targets or the active version. `status` reports `installation_requires_recovery`; subsequent automatic updates do not retry the unresolved attempt.
- The active release pointer switches only after target and scheduler operations succeed. These operations are not a cross-client transaction: a native plugin removal or a target link change can succeed before another step fails. Inspect the failed operation and actual client state before explicitly reinstalling a verified release or rolling back. A successful explicit install, rollback, or uninstall clears the recovery marker. Do not delete the marker to manufacture a healthy status.
- The current release plus two prior releases are retained for rollback.

The updater never sends a reply, changes Threadify production data, edits Skool, or updates unrelated skills.
