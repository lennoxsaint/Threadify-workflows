# Contributing

Threadify Workflows accepts public-safe workflow improvements only. The repo is open source under
the MIT License; by contributing you agree your contribution is licensed under MIT. The "tie" to
Threadify is the runtime MCP dependency, not a usage restriction.

## Contribution Rules

- Keep workflows orchestration-only.
- Require explicit final approval before any public or queue-changing action.
- Use fallback artifacts when MCP tools are unavailable.
- Do not add private prompts, anti-slop internals, account IDs, member data,
  credentials, raw Current Self packets, or paid strategy logic.
- Update or add validation fixtures for manifest, receipt, or fallback changes.

## Local Checks

Run:

```sh
npm test
```

The validator checks workflow manifests, receipt fixtures, launch claims, and
redaction patterns.

## Workflow Changes

Each workflow must include:

- a strict manifest
- a README
- required MCP tools
- fallback behavior
- explicit approval gate
- receipt requirements

## The Eddy engine submodule

The YouTube Edit workflow drives [Eddy](https://github.com/lennoxsaint/eddy), vendored as the
`engines/eddy` submodule. Eddy stays the canonical, independently-released source of truth; this
repo only pins a specific Eddy commit.

- Initialize it with `git submodule update --init engines/eddy`.
- To advance the pin, check out the desired Eddy commit (prefer a release tag once Eddy cuts one)
  inside `engines/eddy`, then commit the updated gitlink here. Re-pin deliberately, not implicitly.
- Do not edit Eddy source from this repo; send Eddy changes upstream to `lennoxsaint/eddy`.
- The validator (`npm test`) intentionally skips `engines/eddy`; Eddy validates itself in its own
  repo.
