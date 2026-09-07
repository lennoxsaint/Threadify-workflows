# Generic MCP Adapter

Use this adapter for local drafting and optional connected Threadify services.
For the primary creator workflows, read the [creator protocol](../../docs/creator-system.md).

## Agent Instructions

1. Load the workflow manifest.
2. Distinguish `required_mcp_tools` from `optional_mcp_tools`. Missing optional
   services do not block local drafting from supplied sources and confirmed facts.
3. If connected, call `get_connection_defaults` first, then inspect available
   tool schemas and current entitlements. Never invent missing capabilities.
4. Prepare the requested blueprint or exact drafts. Use entitled `generate_content`
   for Brain-informed drafting and authorized `save_draft` for exact host-authored
   copy. `save_final_draft` is audit-only, not editable storage.
5. Validate actual post payloads with `validate_post` when connected. Label local
   checks honestly. Validate the relevant payload for other operations; do not
   send memory or source-import data to a post validator.
6. Show exact copy, media, source, account, timezone, time and action for approval.
   Drafting does not authorize imports, scheduling, uploads or Brain writes.
7. After exact approval and fresh checks, use only the relevant manifest-listed
   capability. Preserve pending attempts and reconcile unknown outcomes before retry.
8. Read back actual provider state, preserving partial success.
9. Emit a local receipt. Share feedback only after separate explicit opt-in to
   that exact feedback; service availability alone does not authorize a send.

Keep private prompts, corpora and user state out of public artifacts. Core
workflows exclude immediate publishing and automatic replies. The manifest
describes capabilities, not permission to perform every listed action.
