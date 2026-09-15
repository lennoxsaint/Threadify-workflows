# Refresh Your Threads Profile contract

## Source priority

Use five context lanes in this exact order:

1. explicit interview;
2. prior niche report;
3. relevant local context explicitly approved by the user;
4. current profile data from a verified linked Threadify account;
5. dated public past content.

Record all lanes, including unavailable ones. Do not search unrelated local files or copy raw private context into a public fixture, receipt, or repository. A newer, higher-priority source resolves a conflict unless the owner says otherwise. A dated profile observation is historical, not a live baseline.

## Interview and claims

Collect the intended audience, niche, desired visitor action, credible proof, tone, claims to avoid, visual preferences, and image-rights state. Before any likeness leaves the local environment, identify the external image processor, review its applicable retention/privacy terms, obtain explicit transfer consent, and offer a no-upload fallback. Keep profile claims specific and traceable. A claim may be current-verified, historical-verified, owner-attested, or omitted; do not put an unverified claim in a candidate bio.

Treat profile clarity, processing fluency, first impressions, creator precedent, and picture selection as design guidance. Do not infer that a bio or picture caused reach, follows, leads, revenue, trust, or conversion.

## Candidate and selection invariants

- Return exactly three candidates in order: `A/clarity_first`, `B/authority_proof`, `C/personality_distinctiveness`.
- Pair one bio and one picture direction per candidate. Score every candidate on the five declared dimensions.
- Observe the live editor's limit when possible; otherwise mark it unknown. Never use a remembered limit as a platform fact.
- Preview every picture at small-circle scale. Use an existing owned/licensed image, generate/edit only from consented references, or provide a photography brief.
- Require the owner to select exactly one complete candidate. If they want a hybrid, revise it into one of the three candidates and present the updated complete set again.

## Renderer boundary

Validate against `schemas/profile-plan.v1.json`. The optional asset map is private input with opaque refs as keys and absolute local paths as values. Do not serialize those paths. Reject symlinks, unsupported formats, asset refs not owned/licensed/consented, and files above 25 MiB.

The HTML and SVG artifacts must be self-contained. If the selected raster is absent, emit a visible deterministic placeholder and report that fallback. The receipt contains only workflow state, candidate ID, hashes, relative filenames, and fallback state. It contains no handle, bio, prompt, image bytes, raw context, or absolute paths.

## Mutation state machine

Rendering is preparation, not authorization to edit.

1. Discover current read/write affordances at execution time. No official Threads profile-write API is assumed.
2. Capture the current bio and picture hashes or stable private refs. Preserve an authorized restorable local copy of the prior picture, or explicitly mark picture rollback unavailable before confirmation.
3. Inspect related-account sync/import choices and verification warnings; unknown state blocks unattended action.
4. Verify the exact logged-in Threads handle immediately before mutation.
5. Show the exact final bio, picture, account, and action. Ask once for confirmation of the complete profile change.
6. Use current semantic browser/native UI controls, or give the manual steps. Do not use stored screen coordinates.
7. Save once and read both fields back.
8. Mark `applied` only when readback verifies both. On mismatch, partial change, or ambiguous result, preserve the baseline, set retry to false, and stop for owner reconciliation.

The manual fallback remains useful when agent control, a connected account, image generation, or an accepted upload format is unavailable.
