# Codex Adapter

Codex should use these workflows as repo-grounded operating instructions.

Default behavior:

- inspect the manifest before acting
- avoid live actions until the approval gate is satisfied
- call Threadify MCP tools only through the allowed workflow path
- do not rewrite approved public text silently
- produce the receipt in the shape required by the manifest

Follow the [generic adapter](../generic-mcp/README.md) for local drafting,
entitled connected services and exact action gates. Codex may run the bundled
local engine; that does not grant permission to schedule or publish.
