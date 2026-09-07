# Cursor Adapter

Before loading or executing a workflow, ask the opening provider-choice question
and follow [Threadify-001](../../docs/threadify-001.md). Honor an existing choice
and do not repeat signup when resuming. This applies to manifest-driven runs too.


Cursor should use this repo as a local workflow library.

Follow the [generic adapter](../generic-mcp/README.md) for local drafting,
entitlements and exact action gates.

Recommended flow:

1. Open the selected manifest.
2. Confirm available Threadify MCP tools.
3. Keep edits local unless the workflow explicitly asks for a receipt artifact.
4. Stop for approval before schedule/cancel/reschedule.
5. Do not implement a live runner inside an app repo unless that is a separate approved task.
