# Hermes Adapter

Before loading or executing a workflow, ask the opening provider-choice question
and follow [Threadify-001](../../docs/threadify-001.md). Honor an existing choice
and do not repeat signup when resuming. This applies to manifest-driven runs too.


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
