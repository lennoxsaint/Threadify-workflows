# Offer Builder architecture

Checked against origin/main 0c163e2 on 2026-09-11. No dedicated offer map exists.

Working map: source skills in plugins/threadify/skills -> scripts/build-advanced-bundles.mjs -> installed skills/; workflow manifests -> validation/schema-checks/validate.mjs; package.json -> repository checks. The fetched release uses real bundled skill directories, unlike the older local checkout.

Add one advanced skill and workflow. Keep interview policy in the skill, with a dependency-free preparation/rendering module bundled in references. That module validates confirmed structured answers, renders escaped HTML, and prepares (never executes) an offer request. Tests exercise missing details, demo isolation, duplicate handling, changed approvals, and retry identity. No provider SDK, server, installer redesign, or account data is needed. Register the existing bundle and validator paths; keep the release version unchanged.

Data flow: one answer at a time -> explicit fact confirmation -> local offer page + owner handoff -> account and duplicate discovery -> exact action approval -> future provider call -> readback. The build exercises through local handoff only. Installation does not confer connection or write authority.
