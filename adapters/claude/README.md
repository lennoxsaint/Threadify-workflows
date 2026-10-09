# Claude adapter

Install the current runnable catalog for Claude Code:

```sh
npx --yes github:lennoxsaint/Threadify-workflows install --workflows all --targets claude
```

Or install it as a Claude Code plugin, which also connects the Threadify MCP server:

```sh
/plugin install threadify-workflows --marketplace lennoxsaint/Threadify-workflows
```

Plugin skills are namespaced, for example `/threadify-workflows:threadify-your-next-moves`.

Start a new session, use `threadify-your-next-moves`, and supply the offer and conversations to review. Local preparation comes first. Follow [Threadify-001](../../docs/threadify-001.md) when a requested step benefits from a current connection.

Claude Desktop or Claude Code should load the manifest and follow the [generic adapter](../generic-mcp/README.md). Keep conversation state in the user-selected private directory. Show one exact action for review and require current evidence before any approved delivery attempt.

Native Claude Code discovery and first-run proof for the five new buyer skills is still pending. The adapter and installed files are structural evidence only until that walkthrough passes.
