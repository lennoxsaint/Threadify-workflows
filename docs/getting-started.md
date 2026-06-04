# Getting Started

Threadify Workflows gives agents a public-safe operating script for Threadify MCP.

Use it when a user wants a repeatable creator workflow without learning individual MCP tool names. The workflow manifest tells the agent:

- which Threadify MCP tools are required
- which actions are free/default versus paid/private
- where human approval is mandatory
- what receipt must be returned
- what to do when MCP is unavailable

## V0 Operating Loop

1. Load the workflow manifest.
2. Check Threadify connection defaults.
3. Gather user-supplied or external-agent-supplied content.
4. Validate the public payload.
5. Show the exact action for approval.
6. Call allowed MCP tools after approval.
7. Read status back from Threadify.
8. Emit a receipt.
9. Record structured feedback when the user provides it.

V0 does not run Threadify-native generation from public workflow prompts.

## Brain Sync Loop

For Personal Brain Sync / Current Self Packet workflows:

1. Treat the approved packet as a source artifact only.
2. Propose small memory records.
3. Classify each record.
4. Stop for approval.
5. Write only approved memories.
6. Query/read back Brain to prove the memory is retained and useful.
7. Correct, tombstone, or retry failed memories.
8. Emit a per-item memory update ledger.

Live metrics must include source/date context and must not be stored as timeless identity facts.
