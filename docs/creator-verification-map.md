# Creator verification map

Checkpoint: September 7, 2026. This is a source/test review map, not release approval
or a completed whole-diff audit. Recheck the final commit and extracted artifact.
Paths below are relative to this repository; tests live in `validation/creator-tests/`.

## Local behavior and evidence

| Contract area | Implementation and checks | Evidence limit / remaining work |
| --- | --- | --- |
| Guided 10–20 user links plus small shared selection; fewer strong sources allowed | `setup.mjs`, `urls.mjs`; `setup.test.mjs`, `runtime.test.mjs`: caps, coverage note, canonical duplicates, extraction failure, exact preview hash, same-user cross-setup capacity and unresolved-source reservations | No real source extraction or Vault import in these fixtures. Reservations cover one private workspace, not separate hosts. |
| Shared-publication disclosure, capacity and YouTube access | `setup.mjs` approval/access checks, pending reservation and exact My Vault readback; setup tests | Access, ownership and provider receipts are host-normalized evidence, not independently fetched by the engine. |
| Day volume 1–5 and balanced source substitution | `planner.mjs`; `planner.test.mjs`: five-slot mix, smaller-volume rotation, relevance, dedupe and explicit gaps | Qualified/relevance labels come from the host. A blueprint is not drafted copy. |
| Week seven days; Month 28 days/four weeks; rolling and upfront | Planner/runtime; planner and separate-process runtime/example tests | Synthetic Day and resumed horizons pass; no human quality/time-to-acceptable-pack measurement yet. |
| Adjustable long-form cadence; Growth/Conversion | Planner preferences and runtime CTA checks; planner/runtime tests | Human review must confirm an earned CTA and verified offer; flags cannot establish editorial merit. |
| Rights-gated exact/literal reuse | `sources.mjs` and runtime reuse proofs; `sources.test.mjs`: ownership, license/permission, expiry, complete inventories, deterministic reconstruction, invalid tokens, hostile text | Rights and semantic inventory completeness are attestations. Similarity is descriptive, never legal permission or originality proof. |
| Exact daily/individual approval and affected edits | `review.mjs`, runtime; review/validation/runtime tests, including plan account/day preservation and same-day time/source/copy edits invalidating only the affected approval | Hashes bind supplied display bytes, not proof the host actually showed them. Source substitutions still need fresh host evidence and literal reuse proofs where applicable. |
| Validation and refreshed delivery gates | `recordValidation`, `beginAttempt`; `validation.test.mjs`, `review.test.mjs` | Fresh preflight is required even after validation; actual provider validation and calendar reads remain unproven. |
| Conflicts, partial success and ambiguous retries | Review/runtime/store; tests cover occupied instants, stable retry keys, exact absence, mismatched readbacks and cross-plan local reservations | Local reservation spans one state directory only. Provider-side conflicts still need fresh readback. |
| Continue unresolved work first | Runtime test for out-of-order upfront reviews and later pending attempts | Priority is pending/unknown reconciliation, existing unresolved review, then earliest missing day. No reminder has been created. |
| Optional reminders and manual continuation | `learning.mjs`, runtime; learning/lifecycle tests | Preparation always returns `created:false`. Native creation/configuration readback requires host support and explicit approval. |
| Disconnected drafts versus connected services | Host instructions plus local engine; runtime/example tests; `creator-engine.md` | Engine does not generate or call providers. Host must distinguish `generate_content`, exact `save_draft` and audit-only `save_final_draft`. Actual connected Day pending. |
| Private versioned state and interrupted recovery | `store.mjs`; store tests exercise permissions, checksum, revision conflict and real child-process exit/lock recovery | POSIX-only permission proof. Checksums detect corruption, not malicious owner edits. Source/review evidence is private and must stay outside public artifacts. |
| Local feedback and separate sharing consent | `learning.mjs`, runtime; learning/runtime/lifecycle tests | No feedback sent. Unknown shares cannot be replayed; local feedback is not an automatic durable rule. |
| Draft/validated/approved/scheduled/published/observed separation | Review/outcomes/runtime and schemas; validation/outcome/schema tests | Publication requires host-supplied matching provider evidence. Counts are directional observations, not causal growth proof. |

## Package and release gates

| Requirement | Current evidence | Gate still open |
| --- | --- | --- |
| Four core and seven advanced/compatibility skills; three starter prompts | Root plugin manifest, bundle builders and parity tests | Actual host discovery and realistic routing/reviewer scenarios. |
| Preserve QBR, X artifacts, Brain Sync, YouTube editing and legacy workflow IDs | Canonical advanced skills, manifests, disposition audit and generated copies | Complete final advanced-policy/dependency review. Eddy is separate and unexecuted. |
| Public method/kernel, MIT, no private corpus | Explicit release inventory, source boundaries and synthetic fixtures | Final extracted-content privacy review; an allowlist alone cannot certify every file's content. |
| Versioned metadata and publication gate | Candidate 0.5.0; shared release-metadata validation; `release:false` | Release approval. No tag, stable branch advancement, deployment or submission. |
| Reproducible archive and extracted execution | Candidate tests build twice, compare bytes/hashes, extract and run CLI | Persistent reviewed final artifact and exact final hashes. Tested local tar toolchain; Linux CI not yet run. |
| Clean install, upgrade from 0.4.1 and rollback | `full-install.test.mjs` builds isolated source snapshots and preserves synthetic private data | Final-artifact installation and actual host loading. Stable enablement in test fixtures is not canonical release intent. |
| GitHub review candidate before Directory | Local app feature commit; workflow implementation remains under review | Workflow commit, feature-branch push/draft PR handoff, final GitHub validation. |
| Directory submission package | Preparation doc and five positive/three negative reviewer scenarios | Current official form requirements, verified publisher/support/policy suitability, approved visual assets and actual scenario results. |
| Owner-reviewed live connected Day | Explicitly gated in reviewer scenarios | Deployment/availability plus exact account/source/copy/action approval and provider readbacks. Never substitute fixtures. |

## Next review order

1. The two recorded integration questions now have local regression coverage:
   cross-setup reservations and edited-card account/day preservation. Host behavior
   and provider evidence remain separate gates.
2. Finish the final whole diff, docs/reference-path and public-content review.
3. Commit reviewed workflow source and build persistent candidate artifacts twice;
   verify extraction and installation against those exact bytes.
4. Prepare feature-branch/draft PR handoff and complete independent submission work.
5. Request only the remaining exact owner choices/actions for host and live gates.

Do not mark this map complete merely because the automated suite is green.
