# Customer setup working map

- Public `installation.md` -> canonical `lib/installer.mjs` -> immutable release CLI and native skill target paths.
- `workflows/get-set-up/manifest.json` -> registry -> generated catalog and installed skill/references.
- `lib/onboarding/cli.mjs` -> setup state transitions + capability adapters + bounded filename discovery.
- Setup state -> shared creator atomic store, private per customer, separate from creator plans and distributed files.
- Creator runtime -> exact review or checked setup grant -> fresh preflight -> pending delivery -> provider readback.
- Client host owns login, tool calls and native persistent job registration. CLI never claims tool observations independently.
- Existing Threadify MCP tools provide optional account, Brain, draft and Calendar actions; this workflow release does not require an app deployment or migration. When dedicated Brain processing tools are unavailable, the customer uses the existing app Sync control and the agent reads the resulting state.
- OpenAI Dot is an orchestration surface: it delegates to a verified supported runtime and returns the receipt. It is not a native installer target in 0.21.0.
- Release assets use exact 0.21.0 metadata. Native runtime and provider outcome claims remain gated by their own live acceptance and readback.
