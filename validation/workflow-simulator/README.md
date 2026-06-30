# Workflow Simulator

`validation/schema-checks/validate.mjs` checks that manifests, fixtures, and examples are
*shaped* correctly. It cannot tell you whether an agent that actually follows a manifest would
honor the approval gate, or what happens when a tool the workflow depends on is unavailable. This
simulator answers that: it drives each workflow's call sequence against a mock Threadify MCP
client and asserts the safety properties every manifest claims.

Run it with `npm run simulate` (or `npm test`, which runs it after the static validator).

## How it works

- `lib/mock-mcp-client.mjs` — a fake MCP client with the same tool surface as the real one
  (canned, deterministic responses), plus `failTool(name)` to simulate "this tool is unavailable."
- `lib/engine.mjs` — one generic driver (`runWorkflow`) that walks the shape every workflow in
  this repo follows: connection defaults → gather/validate data → **stop for explicit approval** →
  the mutating call (`schedule_post` / `remember`, or none for draft-only workflows) → best-effort
  readback/feedback. The approval gate and fallback handling live here, once, instead of being
  re-implemented per workflow.
- `workflow-configs.mjs` — a small declarative config per workflow (which tools are
  pre-approval data calls, which one mutates, which are best-effort) derived from each manifest's
  `required_mcp_tools` and its README's "Required Behavior" steps.
- `lib/artifacts.mjs` — builds the receipt / ready-output / memory-ledger objects a real workflow
  run would produce, using the same field vocabulary as `shared/receipt-templates/` and
  `examples/*-redacted/`.
- `lib/json-schema-lite.mjs` — a small dependency-free JSON Schema (subset) validator used to
  check those artifacts against `schemas/*.json`.
- `run.mjs` — for every workflow manifest, runs:
  1. **approved** — every tool available, approval granted → expect a real (non-fallback) outcome.
  2. **denied** — approval withheld (skipped for draft-only workflows, which never mutate) →
     expect a fallback artifact and zero mutating-tool calls.
  3. **tool-unavailable** — once per tool in `required_mcp_tools`, with approval granted → a
     failure anywhere from `get_connection_defaults` through the mutating call must fall back and
     never mutate; a failure in a best-effort tool (readback, `record_feedback`) must not erase an
     already-completed mutation.

Every scenario asserts: the workflow never calls a tool it didn't declare, the mutating tool only
ever *completes* with approval, and every produced artifact validates against its declared schema.

## Adding a workflow

1. Add the manifest under `workflows/<id>/manifest.json` as usual.
2. Add an entry to `workflow-configs.mjs` — pick a `kind` (`schedule`, `memory`, or `draft-only`),
   and list `dataTools` (pre-approval), `mutatingTool` (omit for draft-only), `postTools`/
   `readbackTool` (best-effort, post-mutation), and `feedbackTool`.
3. Run `npm run simulate` — it will fail loudly if the config references a tool the manifest
   didn't declare, or if a manifest has no matching config.
