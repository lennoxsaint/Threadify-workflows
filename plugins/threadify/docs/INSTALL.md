# Threadify Workflows Codex Plugin Install

This local plugin wrapper is for dogfood/testing. It is not OpenAI public
directory approval.

## Install From Local Marketplace

From this repo root:

```sh
codex plugin marketplace add .
```

The marketplace source path is the repo root, not only `plugins/threadify/`, so
installed skills can read the workflow manifests under `workflows/`.

The installed Codex CLI on 2026-06-03 supports `add`, `upgrade`, and `remove`
for marketplaces. It does not support `codex plugin marketplace list`, so verify
installation in the Codex app/plugin UI or local config.

## MCP Connection

Use OAuth with:

```text
https://www.threadify.app/api/mcp/threadify
```

Do not put bearer tokens, OAuth tokens, account IDs, or local proxy config in
this repo.

## Safety

The skills in this wrapper load workflow manifests and require explicit final
approval before any queue-changing or public Threadify action.
