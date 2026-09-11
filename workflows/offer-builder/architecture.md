# Offer Builder architecture

Checked against origin/main 0c163e2 on 2026-09-11. No dedicated offer map exists.

Working map: source skills in plugins/threadify/skills -> scripts/build-advanced-bundles.mjs -> installed skills/; workflow manifests -> validation/schema-checks/validate.mjs; package.json -> repository checks. The fetched release uses real bundled skill directories, unlike the older local checkout.

Add one advanced skill and workflow. Keep interview policy in the skill, with a dependency-free preparation/rendering module bundled in references. That module validates confirmed structured answers, renders escaped HTML, and prepares (never executes) an offer request. Tests exercise missing details, demo isolation, duplicate handling, changed approvals, and retry identity. No provider SDK, server, installer redesign, or account data is needed. Register the existing bundle and validator paths; keep the release version unchanged.

Data flow: one answer at a time -> explicit fact confirmation -> local offer page + owner handoff -> account and duplicate discovery -> exact action approval -> future provider call -> readback. The build exercises through local handoff only. Installation does not confer connection or write authority.

## Release-readiness follow-up

The public branch and all four CI checks were verified. Release flow is package/lock/plugin identity -> release-intent.json -> build-release-assets.mjs -> immutable archive -> main-triggered release.yml. Existing v0.6.0 is already published and excludes this skill. Prepare v0.7.0 metadata and changelog, leaving release disabled until the exact merge/release authority is supplied. Reuse the existing candidate build and integrity verifier; verify the extracted skill runs independently. No installer redesign is needed.

Extracted-artifact execution found that macOS /tmp resolves to /private/tmp, making lexical entrypoint equality silently skip rendering. Resolve the CLI entrypoint through realpath before comparing import.meta.url; test a copied skill invoked through a symlink on supported hosts.
