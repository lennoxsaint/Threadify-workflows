# Threadify Ready Fallback Artifact

Use this when MCP cannot complete the workflow.

```json
{
  "workflow_id": "daily-posts-heartbeat",
  "posts": [
    {
      "text": "exact text ready for Threadify",
      "media": []
    }
  ],
  "scheduled_at": "2026-06-03T09:00:00+08:00",
  "timezone": "Australia/Perth",
  "approval_state": "ready_for_manual_review",
  "fallback_reason": "Threadify MCP unavailable or missing required scope"
}
```
