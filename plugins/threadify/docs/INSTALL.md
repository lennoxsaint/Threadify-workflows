# Threadify Workflows Codex Plugin Install

This local plugin wrapper is for dogfood/testing. It is not OpenAI public
directory approval.

## Install From Local Marketplace

From this repo root:

```sh
codex plugin marketplace add .
codex plugin add threadify-workflows@threadify-workflows
```

The marketplace source path is the repo root, not only `plugins/threadify/`, so
installed skills can read the workflow manifests under `workflows/`.

Marketplace registration is not plugin installation. On the locally tested
Codex CLI 0.147.0, `codex plugin marketplace list --json` reads back registered
sources and plugin installation returns a version and cache path. Inspect those
results, then start a new task to verify skill discovery. A cache entry alone
does not prove host routing, OAuth or connected service availability. Check
your installed CLI's help if its command surface differs.

## MCP Connection

Local drafting requires no Threadify connection. For hosted services, use OAuth with:

```text
https://www.threadify.app/api/mcp/threadify
```

Do not put bearer tokens, OAuth tokens, account IDs, or local proxy config in
this repo.

## Safety

The skills in this wrapper load workflow manifests and require explicit final
approval before any queue-changing or public Threadify action.
