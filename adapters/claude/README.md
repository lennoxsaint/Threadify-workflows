# Claude Adapter

Claude Desktop or Claude Code should follow the [generic MCP adapter](../generic-mcp/README.md).
Connect Threadify only for requested hosted capabilities; local drafting remains available.

Recommended phrasing:

```text
Use the selected Threadify workflow manifest. Do not choose Threadify tools yourself unless the manifest lists them. Stop for final approval before any schedule, cancel, or reschedule action.
```

If tool access is missing, produce the fallback artifact.
