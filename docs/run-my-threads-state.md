# Run My Threads: source, revisions and recovery

The existing agent-driven workflow remains the provider adapter. A small private-state module owns source assignments, generation attempts, exact edits and approval hashes. It has one event interface and no network calls. Provider validation and readback remain explicit agent steps. It cannot certify source truth or semantic novelty; those are established while reading sources before generation.

Flow: full source read → assignment → persisted generation attempt → saved result or reconciliation → optional requested edits/casing → exact approval → persisted schedule attempt → provider readback.

Canonical files live under plugins/threadify/skills/threadify-run-my-threads. Generated skills are rebuilt with npm run bundle:build. The legacy hook diagnostic remains available for explicit use but is not part of daily execution.

## Local preview

Build with `npm run release:build -- --candidate --commit <HEAD> --out <new-directory>`. Validate with `node scripts/verify-release-assets.mjs <directory>`. Install through `node bin/threadify-workflows.mjs preview-install --source-bundle <directory>/threadify-workflows-bundle.json --source-manifest <directory>/candidate-release-manifest.json`.

This validates candidate types and checksums and installs under the workflow home's previews/<bundle-sha256>. It does not activate a stable release, write client plugin caches, change auto-update or replace the current symlink. Point the existing local automation at the returned preview skill path for a trial. Back up its prompt and personal settings first, then update through host controls. Restore those backups through the same controls to roll back. A cloud automation needs a reachable versioned source, not a local path.

Existing pending cards and schedules are not migrated. New runs use the private event state. Public fixtures are synthetic; owner IDs, drafts, performance snapshots and private vault material never belong here. Merge and stable publication require separate release approval.
