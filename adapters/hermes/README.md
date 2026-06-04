# Hermes Adapter

Hermes should treat workflow manifests as action recipes, not as generation prompts.

Use the generic MCP adapter as the base behavior. Preserve Hermes run logging and make receipts explicit:

- workflow ID
- Threadify account handle
- exact approved text
- selected MCP tools
- fallback state
- final status

If Hermes cannot access Threadify MCP, return the fallback artifact instead of attempting browser or provider writes.
