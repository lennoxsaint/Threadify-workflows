# Refresh Your Threads Profile

Refresh Your Threads Profile interviews a creator and uses their niche plus explicitly approved context to produce exactly three coherent Threads bio-and-profile-picture systems. The creator selects one before any profile editor is opened.

## Context and interview

Use sources in a fixed order: the current interview, a prior Find Your Niche report, relevant local files the user approves, a verified linked Threadify account, then dated public past content. Record which lanes were available, used, stale, or in conflict. Historical bios are directional context, never current account state.

Ask for the intended audience and niche, the one desired visitor action, credible proof, tone, claims to avoid, visual preferences, and image rights. A useful profile reduces visitor guessing and aligns the bio, picture, content lane, and next action. It does not prove follows, clicks, sales, or conversion.

## Three systems

Return exactly these whole-system alternatives:

1. **Clarity first:** make the audience, topic, and useful outcome easy to parse.
2. **Authority/proof:** foreground a specific, supportable credential or body of work without implying causation.
3. **Personality/distinctiveness:** make a recognizable point of view or small set of content lanes memorable while retaining relevance.

Each system includes bio copy, claim notes, one picture mode and direction, small-circle framing, and scores for clarity, credibility, distinctiveness, next-action alignment, and tiny-circle legibility. The owner chooses one system; do not silently combine the highest-scoring parts.

## Pictures and local rendering

An image must be user-created, licensed for use, or based on references whose people and rightsholders consented. The picture mode may select an existing image, generate/edit from consented references, or produce a photography brief. Before uploading a likeness to an external provider, disclose that processor and its applicable privacy/retention terms, get explicit transfer consent, and offer a no-upload path. Generation is optional and never required to finish.

Prepare a normalized plan following [CONTRACT.md](CONTRACT.md), then run:

```sh
node tools/profile-plan/cli.mjs render --input /absolute/path/profile-plan-input.json --output-dir /absolute/private/output
```

Optionally pass `--asset-map /absolute/private/asset-map.json`. That private map has opaque keys and absolute local raster paths, for example `{ "portrait-a": "/private/path/portrait.png" }`. Paths are used only to read the file; they are never written to outputs. PNG, JPEG, WebP, and GIF are accepted. Without a matching consented asset, the renderer creates a clearly labelled deterministic placeholder.

The command writes `profile-plan.json`, `profile-plan.md`, `profile-plan.html`, `profile-picture-selected.svg`, `profile-picture-preview-grid.svg`, and `profile-plan-receipt.json`. When a selected raster is mapped, it also copies it to `profile-picture-source.<ext>` for upload/cropping. The HTML and SVG previews are self-contained and make no external requests.

## Applying the profile

The renderer only prepares artifacts. A live update uses the current Threads browser or native interface unless Meta documents a supported profile-write capability at execution time. Capture the old bio and picture, retain an authorized restorable local picture or label rollback unavailable, check account linking/import/sync and verification warnings, verify the exact handle, show the complete change, and ask once immediately before saving.

Manual instructions are always present. Codex, Claude, or another capable agent may drive the current interface when the user asks, but it must use semantic controls and current labels rather than saved coordinates. Read the profile back after saving. If either field is partial, mismatched, or ambiguous, stop without retrying and preserve the baseline for reconciliation.

## Evidence limits

Profile templates and before/after screenshots are design tools, not evidence that a profile change caused growth. Live character limits, upload formats, editor controls, topics, links, account linking, and verification behavior must be observed on the intended account. See the bundled research report for the evidence labels and source notes.
