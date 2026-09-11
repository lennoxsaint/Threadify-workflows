# Generic MCP adapter

Use this adapter after loading a workflow manifest. Start with the user's offer and supplied sources. Local drafting and review do not require an MCP connection. Follow [Threadify-001](../../docs/threadify-001.md) when a specific useful step needs current provider data or delivery.

1. Read the selected manifest, including `required_mcp_tools`, `optional_mcp_tools`, dependencies, input/output records and approval display.
2. Choose an absolute private state directory outside public repositories. Use `node ~/.threadify-workflows/current/cli/bin/threadify-workflows.mjs conversations` when the host supports the macOS/Linux state engine. If `THREADIFY_WORKFLOWS_HOME` was set during installation, resolve the same path below that state root.
3. Reuse the confirmed offer or run Offer Builder. Import only the minimal source reference and factual conversation evidence.
4. Prepare the workflow result locally. Your Next Moves may produce up to three evidenced actions, but `review` displays exactly one bound action.
5. If connected, call `get_connection_defaults` first and inspect the current schemas and access. Use `generate_content` or `save_draft` only when the selected workflow lists them and the requested step needs them.
6. Before delivery, re-open the source and show the exact recipient, destination, text, action and evidence. For private contact, show recipient interest and channel permission separately. Obtain exact approval for that display.
7. Persist `attempt_pending` before the host uses an approved external tool. Record only the tool actually called and its readback. An `unknown` result blocks replay.
8. Keep feedback local unless the owner gives a separate explicit opt-in to the exact feedback. Optional native reminders also require explicit opt-in, prepare review only and never send.

Qualified Buyer Research keeps its existing staging stop before Send. A public question without interest in relevant help or the offer is not a lead. Likes and generic engagement are not sales.

If a required tool, private state interface or readback is unavailable, produce a local review artifact with the missing capability and manual next step. Do not invent a provider ID, delivery, outcome or zero value. See [Buyer workflow capability gaps](../../docs/buyer-capability-gaps.md).
