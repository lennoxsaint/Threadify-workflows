# Customer setup working map

- Public `installation.md` -> canonical `lib/installer.mjs` -> immutable release CLI and native skill target paths.
- `workflows/get-set-up/manifest.json` -> registry -> generated catalog and installed skill/references.
- `lib/onboarding/cli.mjs` -> setup state transitions + capability adapters + bounded filename discovery.
- Setup state -> shared creator atomic store, private per customer, separate from creator plans and distributed files.
- Creator runtime -> exact review or checked setup grant -> fresh preflight -> pending delivery -> provider readback.
- Client host owns login, tool calls and native persistent job registration. CLI never claims tool observations independently.
- Product change lives in companion app branch: `/setup`, shared knowledge queue, account-scoped processing status.
- Release assets retain candidate metadata until live acceptance and explicit release approval.
