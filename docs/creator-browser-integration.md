# Browser review integration

The CLI routes `creator` commands to `lib/creator/cli.mjs`. Browser commands persist a separate private session through `store.mjs`; Submit binds exact reviewed content. `runtime.mjs` applies that approval to existing review packs. `review.mjs` requires fresh preflight and matching provider receipts before recording scheduling. Provider calls remain host-owned, as with the local-first architecture in ADR 0001.

The manifest registry selects creator skills. `build-creator-bundles.mjs` copies the shared engine, browser assets and references into those skills. Release builders include these generated bundles alongside the newer conversation and carousel workflows.

This integration carries the reviewed editor onto the v0.8.0 baseline without replacing its registry, catalog, buyer workflows or onboarding. The next candidate is v0.9.0; release intent stays disabled. Existing private review state is not migrated, submitted or delivered by this change. Old proposed times require a fresh review before live delivery.
