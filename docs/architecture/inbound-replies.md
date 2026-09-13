# Inbound replies architecture

The bounded map is plugin skill -> workflow contract -> Threadify MCP -> portable review store -> loopback editor -> approved send packet -> MCP readback and feedback.

Sources inspected: package.json, validation/schema-checks/validate.mjs, workflow manifests, adapter setup guides and the existing private Quest batch interface. No repo-wide map exists. The private Quest hardcodes one account, timezone and packet size and mixes CRM/XP concerns with review. Reusing it would export private dependencies; a standalone dependency-free Node store keeps those decisions local and allows a private optional adapter.

The helper owns durable identities, revision checks, grouping, decisions, send attempts and feedback measurements. The agent owns MCP calls and evidence collection. The editor only changes local review decisions and cannot send. JSON packets form the interface for both CLI and client adapters. No provider token enters the helper.

A static editable file was considered but cannot reliably autosave concurrent revisions or record attempts atomically. A loopback server with a serialized file transaction store provides that behavior without a hosted product or dependency framework. Publication proof and feedback delivery are separate states so a feedback failure never causes a resend.
