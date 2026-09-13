# Synthetic reply review

Every post, comment, metric, handle and URL here is synthetic. This is a local demonstration, not a provider receipt.

```sh
node examples/inbound-synthetic/demo.mjs /path/to/new-demo-state
node tools/inbound/cli.mjs serve --account @example --root /path/to/new-demo-state
```

Open the private loopback URL printed by the second command. Try editing, approving, deferring, skipping/undoing, changing five/all mode, and reloading. No MCP calls are made and this page cannot publish. Use a fresh directory for each demonstration. Do not point this generator at your real review state.
