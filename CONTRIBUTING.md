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

- Initialize it with `git submodule update --init engines/eddy`.
- To advance the pin, check out the desired Eddy release tag inside `engines/eddy`
  (`git -C engines/eddy fetch --tags && git -C engines/eddy checkout vX.Y.Z`), then commit the
  updated gitlink here. Re-pin deliberately to a tag, not to a feature-branch commit.
- Do not edit Eddy source from this repo; send Eddy changes upstream to `lennoxsaint/eddy`.
- The validator (`npm test`) intentionally skips `engines/eddy`; Eddy validates itself in its own
  repo.
