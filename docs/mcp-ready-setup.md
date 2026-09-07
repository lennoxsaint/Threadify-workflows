# MCP Ready Setup

The public setup path should guide users to Threadify Agent Connections, then into their preferred MCP client.

Preferred public setup:

1. Open the MCP connector/add-tool dialog in the agent client.
2. Use `https://www.threadify.app/api/mcp/threadify`.
3. Choose OAuth when supported.
4. Log in to Threadify and approve the connection.
5. Run a read-only check such as `get_connection_defaults` before any workflow.

For local Codex dogfood, the repository root is the plugin source. From that
root, register and install it:

```sh
codex plugin marketplace add .
codex plugin add threadify-workflows@threadify-workflows
```

Registration alone does not install the plugin. Start a new task to check skill
discovery. The nested `plugins/threadify/` directory preserves compatibility
sources; it is not the root creator plugin. Local drafting does not need OAuth;
connect only when using Threadify's hosted services.

Manual token setup is for power users only. Do not place manual tokens in this
repo.

## User Steps

1. Open Threadify.
2. Create an Agent Connection.
3. Select the account and scopes required by the workflow.
4. Copy the MCP connection details into the agent client.
5. Run the adapter's connection check.

## Agent Verification

The agent should call:

- `get_connection_defaults`
- `list_accounts` when account choice is unclear
- `list_dispatcher_tools` when tool availability is unclear

The agent must never print tokens, credentials, raw auth headers, or secret configuration.

## Required MCP Endpoint

The expected Threadify MCP endpoint is:

```text
/api/mcp/threadify
```

Hosted base URL and user authentication are configured inside Threadify and the user's MCP client.
