# Hermes Adapter

Hermes should use the selected manifest and creator protocol for local drafting
and approval-gated connected actions.

Use the [generic MCP adapter](../generic-mcp/README.md) as the base behavior.
Preserve private Hermes run logging and make receipts explicit:

- workflow ID
- Threadify account handle
- exact approved text
- selected MCP tools
- fallback state
- final status

If Hermes cannot access Threadify MCP, return the fallback artifact instead of attempting browser or provider writes.
