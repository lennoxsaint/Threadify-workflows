# Hermes adapter

Install with `npx --yes github:lennoxsaint/Threadify-workflows install --workflows all --targets hermes`, then load the selected manifest and local conversation state. Start from the user's offer and supplied conversations. Follow [Threadify-001](../../docs/threadify-001.md) only when a useful step needs Threadify or another current provider.

Use the [generic adapter](../generic-mcp/README.md) as the base behavior. Keep private Hermes logs out of public receipts. Record the workflow ID, state revision, exact reviewed action, tool path, approval hash, fallback state and actual result without copying the source conversation.

When Hermes lacks the shared CLI or authoritative provider readback, return the manual review artifact. This adapter is structural guidance; native installation, discovery and first-run behavior for the new buyer skills have not yet been observed.
