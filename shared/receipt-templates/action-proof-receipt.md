# Action Proof Receipt

Synthetic shape only, not execution proof. List only tools actually called and
replace example states with verified readback in the private operator workspace.

```json
{
  "workflow_id": "daily-posts-heartbeat",
  "adapter": "generic-mcp",
  "account_handle": "@example_creator",
  "action": "schedule_post",
  "approved_text": ["exact approved text"],
  "approved_text_sha256": "hash-of-approved-text",
  "status": "scheduled",
  "timestamp": "2026-06-02T10:00:00Z",
  "timezone": "Australia/Perth",
  "tool_path": ["get_connection_defaults", "validate_post", "schedule_post", "get_schedule_status", "list_scheduled_posts"],
  "fallback_used": false,
  "artifact_ids": ["redacted-artifact-id"]
}
```
