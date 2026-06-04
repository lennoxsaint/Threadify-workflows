# Contributing

Threadify Workflows accepts public-safe workflow improvements only.

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
