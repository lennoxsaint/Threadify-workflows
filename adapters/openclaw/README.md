# OpenClaw Adapter

OpenClaw should treat Threadify workflows as external-action guardrails.

Rules:

- no private memory export into public receipts
- no live write without explicit user approval
- no Threadify-native generation from public workflow steps
- fallback artifact when MCP is missing or unsafe
