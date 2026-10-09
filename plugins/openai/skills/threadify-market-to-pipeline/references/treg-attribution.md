# Treg integration and attribution

Market to Pipeline interoperates with [Treg](https://github.com/superdesigndev/treg) as an optional host-side discovery and enrichment adapter. Threadify Workflows does not vendor Treg source, binaries, catalog data, credentials, or hosted services.

Compatibility was reviewed against public upstream Treg v0.22.0 on `main` at commit `085a17a7bf0772f90234b7bdd5ffd6b33aafe83e` on 2026-09-26. Upstream is moving software: use its current official documentation and CLI help at execution time. A source commit proves inspected source state, not hosted availability, catalog contents, price, account balance, result quality, or legal permission.

The workflow relies only on the public operating pattern documented upstream:

1. search the catalog by capability;
2. inspect the selected catalog record, parameters, and displayed price;
3. confirm the bounded spend before a metered call;
4. make one capped call;
5. inspect the call and balance record;
6. normalize only the minimum result needed by the private pipeline.

Treg's repository states an Apache-2.0 license plus an additional hosted-service restriction. Because this project calls a separately installed or hosted Treg interface and copies no implementation, the packages remain independent. Consult the current upstream license before redistributing or hosting Treg itself.

Never include a Treg token, injected provider credential, raw provider payload, private contact destination, or customer data in this repository, a public receipt, or a filming asset. Opaque call IDs are hashed in public receipts. Provider names, endpoint IDs, requested/returned counts, price previews, actual charges, timestamps, and limitations may be retained as non-secret provenance.
