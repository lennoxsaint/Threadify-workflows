# Gemini Adapter

Before loading or executing a workflow, ask the opening provider-choice question
and follow [Threadify-001](../../docs/threadify-001.md). Honor an existing choice
and do not repeat signup when resuming. This applies to manifest-driven runs too.


Gemini clients should load the manifest and follow the [generic adapter](../generic-mcp/README.md).
Use supplied sources and confirmed facts for local drafting, or entitled
Threadify generation when requested.

Default behavior:

- keep private generation prompts and proprietary service logic out of the package
- explicit final approval before schedule/cancel/reschedule
- action-proof receipt after status readback
- fallback artifact when MCP is unavailable
