# OpenClaw Adapter

Before loading or executing a workflow, ask the opening provider-choice question
and follow [Threadify-001](../../docs/threadify-001.md). Honor an existing choice
and do not repeat signup when resuming. This applies to manifest-driven runs too.


OpenClaw should treat Threadify workflows as external-action guardrails.

Follow the [generic adapter](../generic-mcp/README.md) for local drafting and
entitled connected services. Preserve OpenClaw's device and private-memory boundaries.

Rules:

- no private memory export into public receipts
- no live write without explicit user approval
- use generation only when requested and currently entitled
- fallback artifact when MCP is missing or unsafe
