# Buyer-conversation architecture

Implementation baseline: public main `a14e6ee`, inspected 2026-09-11. This refreshes the bounded maps in `docs/proof-loops-coverage-architecture.md`, `docs/creator-verification-map.md`, and `workflows/offer-builder/architecture.md`; older verification statements remain historical.

Current flow: workflow manifests and separately maintained builder lists produce skill bundles; the installer treats the full plugin and standalone Qualified Buyer Research differently. Native discovery depends on the client. Offer Builder and Buyer Research have separate records; creator review cards require scheduling fields and cannot represent conversation actions honestly.

Chosen flow: canonical workflow manifests -> registry reader -> generated catalog/bundle membership -> selected install -> native discovery. Offer reference -> minimal conversation evidence -> one reviewed action -> commitment/outcome receipt is owned by a small conversation module beside the creator engine. The host agent performs research and delivery; the module validates and persists evidence without asserting provider verification.

This addresses drift at its source and makes the first useful journey consistent. A second hand-maintained registry was rejected because it would reproduce the drift. Reusing scheduling cards for conversations was rejected because it would require fictitious times and delivery states. Reuse safe storage/hash mechanisms only where their interfaces fit, preserving creator formats and legacy installer assets.

Scope: public repo, all five buyer workflows, local-first preparation, Threads discovery, full-catalog fresh installs, existing-selection preservation, explicit migration, optional native review reminders, and stable publication after proof. No hosted product, database or MCP implementation changes. Codex and Claude Code require real walkthroughs. Other clients and Windows state limitations are labeled.

Authority and evidence: exact-action approval remains required within workflows; recipient permission is a separate fact. Published artifacts remain immutable. Minimal private conversation state stays outside archives. Tests, native first runs, rendered GitHub review, published hashes and post-publication installation establish separate proof states.
