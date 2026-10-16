# Offer evidence and Sites handoff map

Canonical skill and references in `plugins/threadify/skills/threadify-choose-your-first-offer/` own the agent interaction. `scripts/build-advanced-bundles.mjs` copies them into `skills/` for the public package and local native install. The workflow manifest and README describe discovery and scope. The deterministic `choose-offer.mjs` generates five local artifacts; it does not connect accounts or deploy sites.

Change boundary: lesson evidence -> connected Threads fallback with identity/coverage checks -> confirmed scorecard -> unchanged five-artifact contract -> explicit Sites question -> optional Sites execution and separate deployment/distribution approvals. The report includes the question so CLI consumers also see it. No new provider API, schema migration, dependency or production write is needed.

Verification: existing score/escaping/CLI tests plus report handoff assertions; full package tests and bundle parity. Instructions require host-mediated OAuth/read discovery and installed Sites capabilities. Automated tests do not establish live account connection, site deployment, conversion or public distribution. Native discovery requires a fresh task after installation.
