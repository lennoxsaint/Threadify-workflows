# Claude Adapter

Before loading or executing a workflow, ask the opening provider-choice question
and follow [Threadify-001](../../docs/threadify-001.md). Honor an existing choice
and do not repeat signup when resuming. This applies to manifest-driven runs too.


Claude Desktop or Claude Code should follow the [generic MCP adapter](../generic-mcp/README.md).
Connect Threadify only for requested hosted capabilities; local drafting remains available.

Recommended phrasing:

```text
Use the selected Threadify workflow manifest. Do not choose Threadify tools yourself unless the manifest lists them. Stop for final approval before any schedule, cancel, or reschedule action.
```

If tool access is missing, produce the fallback artifact.
