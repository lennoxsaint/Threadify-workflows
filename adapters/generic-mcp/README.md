# Generic MCP Adapter

Use this adapter when the client can call Threadify MCP tools directly.

## Agent Instructions

1. Load the workflow manifest.
2. Verify required tools with `list_dispatcher_tools` if needed.
3. Call `get_connection_defaults`.
4. Ask for exact content and scheduling intent.
5. Use `validate_post` before any write action.
6. Show the approval gate exactly.
7. After explicit approval, call only the tools listed in the manifest.
8. Read status back.
9. Emit a workflow receipt.

Do not call Threadify-native generation tools from public v0 workflows.
