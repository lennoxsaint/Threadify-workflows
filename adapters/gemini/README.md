# Gemini Adapter

Gemini clients should load the manifest, identify the allowed Threadify MCP actions, and keep public copy supplied by the user or another approved source.

Default behavior:

- no public workflow generation prompts
- explicit final approval before schedule/cancel/reschedule
- action-proof receipt after status readback
- fallback artifact when MCP is unavailable
