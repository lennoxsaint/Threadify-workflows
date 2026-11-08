# Contributing

Threadify Workflows accepts public-safe workflow improvements only. The repo is open source under
the MIT License; by contributing you agree your contribution is licensed under MIT.
The public local engine supports planning, review and recovery. Threadify MCP is
optional for local drafting and required for hosted capabilities.

## Contribution Rules

- Keep generalized methods and the local engine public; keep proprietary service
  implementations, corpora and personal state out of the package.
- Require explicit final approval before any public or queue-changing action.
- Use fallback artifacts when MCP tools are unavailable.
- Do not add private prompts, anti-slop internals, account IDs, member data,
  credentials, raw Current Self packets, or paid strategy logic.
- Update or add validation fixtures for manifest, receipt, or fallback changes.

## Local Checks

Run:

```sh
npm ci --ignore-scripts
npm test
```

The validator checks workflow manifests, receipt fixtures, launch claims, and
redaction patterns.

## Workflow Changes

Each workflow must include:

- a strict manifest
- a README
- required and optional MCP tools, with disconnected behavior where supported
- fallback behavior
- explicit approval gate
- receipt requirements

## The Eddy engine submodule

The YouTube Edit workflow drives [Eddy](https://github.com/lennoxsaint/eddy), vendored as the
`engines/eddy` submodule. Eddy stays the canonical, independently-released source of truth; this
repo only pins a specific Eddy **release tag**. The current pin is **v1.9.1**.

- The submodule URL is `https://github.com/lennoxsaint/eddy-legacy.git`, the public archive that contains the pinned commit. A URL whose repository does not serve the pinned commit breaks every `npx github:` install, because npm initializes submodules.
- Initialize it with `git submodule update --init engines/eddy`.
- To advance the pin, check out the desired Eddy release tag inside `engines/eddy`
  (`git -C engines/eddy fetch --tags && git -C engines/eddy checkout vX.Y.Z`), then commit the
  updated gitlink here. If the new commit lives in a different repository, update `.gitmodules` in the same commit. Re-pin deliberately to a tag, not to a feature-branch commit.
- Do not edit Eddy source from this repo; send Eddy changes upstream to `lennoxsaint/eddy`.
- The validator (`npm test`) intentionally skips `engines/eddy`; Eddy validates itself in its own
  repo.

## Claude Code plugin folder

`plugins/claude` is the Claude Code plugin root and the folder submitted to the Claude plugin directory. `scripts/build-claude-plugin.mjs` builds it from `skills/` and the threadify entry of `.mcp.json`; `npm run bundle:build` regenerates it and `npm run bundle:check` fails on drift. Edit skills at their source, never inside the mirror. `plugins/claude/.claude-plugin/plugin.json`, `icon.png` and `README.md` are source files: the manifest version moves with `npm run bump`, the icon is the directory listing icon, and the README is the listing text, so it must name every program the skills run and every destination they contact.

### The directory's rules are enforced here

Every build audits the whole folder against `lib/claude-plugin-policy.mjs`, which encodes each rule the directory's validator or scan has raised on this plugin. A version that breaks one is held for review or blocked, and a held version cannot auto-publish. The build refuses:

- More than 512 files (the directory stops checking and blocks the version as not fully checked), any non-image file over 256 KiB, or a file type it cannot inspect.
- Anything that looks like reading a credential: an environment variable named like a key or token, an `x-api-key` header, `process.env` beyond `PATH`, `PATHEXT` and `THREADIFY_WORKFLOWS_HOME`, storage items or variables named token or key, or prose where a credential word sits next to a read word ("Vault readback", "pass get_post_thread").
- Download-and-run patterns: `curl` or `wget` in a script, a shell started with `-c`, a download piped into an interpreter or saved with `-o`, and a script that both talks to the network and starts processes. Put network calls in their own module that never starts processes (see `page-fetch.mjs`, `director-net.mjs`, `youtube-synthesizer-captions.mjs`).
- The npx installer's self-updater, which is code from outside the plugin; the directory updates plugin installs itself.

A skill that cannot meet these rules stays in the installer and the other plugins and leaves the Claude plugin by declaration in its workflow manifest, never by editing the build:

- `external_engines`: it drives a separate engine no plugin ships (YouTube Edit drives Eddy).
- `external_credentials`: it needs the owner's own API key for another service (Research Army and Watch Any Creator use ScrapeCreators). A skill script cannot receive a sensitive plugin `userConfig` value, so there is no compliant way to ship these in the Claude plugin.

### Guards

`npm install` runs `scripts/install-git-hooks.mjs`, which points this checkout's git hooks at `.githooks/`. The pre-commit and pre-push hooks run `scripts/guard-plugins.mjs`, which runs `npm run validate` and refuses the commit or push on any failure. Claude Code sessions in this repository get the same check from `.claude/settings.json`, which blocks `git commit`, `git push`, `gh pr create` and `gh pr merge` while validation fails. Run it by hand with `npm run guard`. Do not bypass the hooks with `--no-verify`; fix the source instead. `validation/registry-tests/claude-plugin-policy.test.mjs` keeps every rule tied to the finding it came from, so loosening a rule fails the tests.

## OpenAI plugin folder

`plugins/openai` is the package submitted to OpenAI's plugin directory (ChatGPT and Codex). `scripts/build-openai-plugin.mjs` copies the skills from `plugins/claude/skills`, so both directories carry the same workflows, and changes only what OpenAI's platform needs: the connection points at `https://www.threadify.app/api/mcp/openai`, and no skill links to Threadify's plans page, offers a free trial or states an upgrade URL (OpenAI's commerce rules); two YouTube Synthesizer example posts that advertised a plan are replaced by a marked omission and that library's integrity lock is recomputed with the skill's own checks. Each of those rewrites must match an exact number of files, so rewording a source sentence fails `npm run bundle:check` until the build is updated. `npm run bundle:build` regenerates the folder after the Claude mirror. It is packaged in OpenAI's Codex format (`.codex-plugin/plugin.json` and `.mcp.json`), never with a root `plugin.json`: Codex loads that as an Agent Plugin and hides any tools beyond 64,000 bytes of definitions, which hid most of Threadify's. `plugins/openai/.codex-plugin/plugin.json`, `README.md` and `assets/` are source files: the manifest version moves with `npm run bump`. To submit, zip the folder's contents, hidden folders included (the README has the command).

## Versions and releases

Every merge to `main` is a stable release: the release workflow tags it and publishes the assets, and Claude Code plugin installs see it as an update. The version lives in several files, so never edit them by hand. Run one command in your branch instead:

```sh
npm run bump -- patch --summary "One changelog line describing the change"
```

Use `minor` or `major` instead of `patch` when the change warrants it, repeat `--summary` for more changelog lines, or pass an explicit `x.y.z`. The command moves `package.json`, the lockfile, the Codex, Claude, OpenAI and compatibility plugin manifests, `release/release-intent.json`, `installation.md` and `release/CHANGELOG.md` together, then refreshes the generated bundles. `npm run validate` fails if any copy drifts.

If a merge lands without a bump, the `auto-bump` workflow bumps the patch version on `main`, using the merged commit subjects as the changelog lines, and the release workflow publishes it. It needs the `RELEASE_BUMP_TOKEN` repository secret, a fine-grained token with Contents: read and write, because `main` requires pull requests and the default Actions token cannot push there.
