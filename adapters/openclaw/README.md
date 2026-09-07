# OpenClaw Adapter

OpenClaw should treat Threadify workflows as external-action guardrails.

Follow the [generic adapter](../generic-mcp/README.md) for local drafting and
entitled connected services. Preserve OpenClaw's device and private-memory boundaries.

Rules:

- no private memory export into public receipts
- no live write without explicit user approval
- use generation only when requested and currently entitled
- fallback artifact when MCP is missing or unsafe
