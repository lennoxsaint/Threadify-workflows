# Gemini Adapter

Gemini clients should load the manifest and follow the [generic adapter](../generic-mcp/README.md).
Use supplied sources and confirmed facts for local drafting, or entitled
Threadify generation when requested.

Default behavior:

- keep private generation prompts and proprietary service logic out of the package
- explicit final approval before schedule/cancel/reschedule
- action-proof receipt after status readback
- fallback artifact when MCP is unavailable
