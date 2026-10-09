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

`plugins/claude` is the Claude Code plugin root and the folder submitted to the Claude plugin directory. `scripts/build-claude-plugin.mjs` mirrors `skills/` and the threadify entry of `.mcp.json` into it; `npm run bundle:build` regenerates it and `npm run bundle:check` fails on drift. Edit skills at the root, never inside the mirror. `plugins/claude/.claude-plugin/plugin.json` and `icon.png` are source files: the manifest version moves with `npm run bump`, and the icon is the directory listing icon.

## OpenAI plugin folder

`plugins/openai` is the package submitted to OpenAI's plugin directory (ChatGPT and Codex). `scripts/build-openai-plugin.mjs` copies the skills from `plugins/claude/skills`, so both directories carry the same workflows, and changes only what OpenAI's platform needs: the connection points at `https://www.threadify.app/api/mcp/openai`, and no skill links to Threadify's plans page, offers a free trial or states an upgrade URL (OpenAI's commerce rules); two YouTube Synthesizer example posts that advertised a plan are replaced by a marked omission and that library's integrity lock is recomputed with the skill's own checks. Each of those rewrites must match an exact number of files, so rewording a source sentence fails `npm run bundle:check` until the build is updated. `npm run bundle:build` regenerates the folder after the Claude mirror. `plugins/openai/plugin.json`, `README.md` and `assets/` are source files: the manifest version moves with `npm run bump`. To submit, zip the folder's contents so `plugin.json` sits at the ZIP root (the README has the command).

## Versions and releases

Every merge to `main` is a stable release: the release workflow tags it and publishes the assets, and Claude Code plugin installs see it as an update. The version lives in several files, so never edit them by hand. Run one command in your branch instead:

```sh
npm run bump -- patch --summary "One changelog line describing the change"
```

Use `minor` or `major` instead of `patch` when the change warrants it, repeat `--summary` for more changelog lines, or pass an explicit `x.y.z`. The command moves `package.json`, the lockfile, the Codex, Claude, OpenAI and compatibility plugin manifests, `release/release-intent.json`, `installation.md` and `release/CHANGELOG.md` together, then refreshes the generated bundles. `npm run validate` fails if any copy drifts.

If a merge lands without a bump, the `auto-bump` workflow bumps the patch version on `main`, using the merged commit subjects as the changelog lines, and the release workflow publishes it. It needs the `RELEASE_BUMP_TOKEN` repository secret, a fine-grained token with Contents: read and write, because `main` requires pull requests and the default Actions token cannot push there.
