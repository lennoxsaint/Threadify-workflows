# Cursor adapter

Install with `npx --yes github:lennoxsaint/Threadify-workflows install --workflows all --targets cursor`, then inspect the selected manifest. Start from the supplied offer and conversations; do not require a connection for local work. Follow [Threadify-001](../../docs/threadify-001.md) only for a useful connected step.

Use the [generic adapter](../generic-mcp/README.md) for the shared workflow contract. Keep private state outside the app repository, show one bound action at a time, and use the manual fallback when Cursor cannot expose the local conversation CLI or required provider readback.

This adapter is structural guidance. Native installation, discovery and first-run behavior for the new buyer skills have not yet been observed.
