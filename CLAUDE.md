# CLAUDE.md — Threadify Workflows

This repo is a public, MIT-licensed library of **orchestration recipes**, not an app. It teaches
agent clients (Claude, Codex, Gemini, Cursor, Hermes, OpenClaw, generic MCP) which Threadify MCP
tools to call, in what order, with what approval gates, to run creator workflows (posting,
scheduling, cross-posting, replicating winners, video editing via the sibling Eddy project). It is
orchestration-only: it never embeds Threadify's private generation/quality logic.

## Hard rules

- **No workflow mutates Threadify or account state without explicit final approval**, shown as
  exact text, account, time, media, and action. This is the single most important invariant in
  the repo — see `validation/workflow-simulator/` for how it's tested, not just documented.
- **No secrets, account IDs, member data, or private generation/quality logic** ever land in this
  repo. `validation/schema-checks/validate.mjs` scans every tracked `.md`/`.json` file for
  secret-shaped and forbidden-content patterns; keep it passing.
- Public examples under `examples/` must be redacted, not real operator data — follow the existing
  `*-redacted` pattern.

## Layout

- `workflows/<id>/manifest.json` + `README.md` — one strict manifest per workflow (required MCP
  tools, approval gate, fallback behavior, receipt requirements) plus its human-readable spec.
- `adapters/<client>/` — per-client prompt wrappers (claude, codex, cursor, gemini, generic-mcp,
  hermes, openclaw).
- `schemas/*.json` — JSON Schemas for manifests, receipts, the memory-update ledger, and the
  Threadify-ready-output artifact.
- `examples/*-redacted/` — real-shaped, redacted sample outputs.
- `shared/` — shared receipt/fallback/approval-gate templates referenced by workflow READMEs.
- `engines/eddy` — a git submodule (the separate Eddy video editor); validated by its own repo,
  skipped by this repo's checks. Pinned to a release tag, never a feature-branch commit — see
  CONTRIBUTING.md.

## Validation

Run `npm test` before any change lands. It runs two checks:

1. `validation/schema-checks/validate.mjs` — static shape: manifests have all required fields,
   only declare allowed MCP tools, receipts/fixtures have required fields, redaction patterns
   don't appear anywhere, and README claims stay honest (no overclaiming, no "guaranteed").
2. `validation/workflow-simulator/run.mjs` — dynamic: walks every workflow against a mock
   Threadify MCP client through approved / approval-denied / tool-unavailable scenarios and
   asserts the mutating tool only ever completes with approval, and every produced artifact
   validates against its declared schema. See `validation/workflow-simulator/README.md`.

If you add or change a workflow, update both: the manifest/README, and (if its tool sequence or
approval shape changed) its entry in `validation/workflow-simulator/workflow-configs.mjs`.
