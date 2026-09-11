# ADR 0002: Derive catalog and bundles from manifests

Status: accepted, 2026-09-11.

## Decision

Treat each workflow manifest as the canonical record for discovery, dependencies, bundle membership, triggers and input/output records. The registry reader generates the catalog and install membership from those manifests.

Fresh installs select the full runnable catalog. When an existing client upgrades without a new selection, the installer preserves its saved workflow selection. Moving that client to the full catalog requires `threadify-workflows install --workflows all`; `--targets` limits the named clients.

## Why

Hand-maintained skill lists had begun to drift across the plugin, installer and docs. One registry seam keeps the public inventory consistent while preserving older user choices.

## Consequences

Manifest changes must pass schema validation and bundle parity checks. Legacy selections remain valid until the user chooses a migration. Published archives and receipts stay immutable; rebuilding current source does not rewrite old proof.
