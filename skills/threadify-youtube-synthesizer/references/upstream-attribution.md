# YouTube Synthesizer attribution and rights

## Runtime dependencies

- `youtube-transcript` 1.3.1 by Kakulukian — MIT license — public caption
  extraction through an unofficial YouTube endpoint. The exact ESM build and
  MIT notice are bundled for installed-skill parity and verified at runtime as
  SHA-256 `19f59f7b46fec09610143f587995573796a645437eca25af2e8517eeadfb0041`.
  Availability is not promised; pasted captions remain the durable fallback.
- `yt-dlp` — optional system executable, not bundled. It is invoked only for
  captions with media downloading disabled. Its own license and installation are
  controlled by the operator.
- Node.js built-ins — URL parsing, hashing, temporary files, and subprocess
  execution.

## Template originals

The bundled thirty-six originals were authored and published by
`@lennox_saint`. Lennox attested permission to redistribute them with this
workflow on 2026-09-27. Every record retains its native Threads root ID,
permalink, publication timestamp, exact post sequence, and the template it
illustrates. Metrics are dated observations, not promises or evidence that a
template caused performance.

## Source-video boundary

A user's source transcript is processed locally and is not redistributed by this
package. Verbatim source quotations in generated drafts must be brief,
attributed, and supported by transcript spans. Operators remain responsible for
their source rights and final editorial review.
