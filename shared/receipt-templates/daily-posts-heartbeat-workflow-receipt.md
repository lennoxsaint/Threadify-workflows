# Daily Posts Heartbeat Workflow Receipt

Use this receipt after an approved daily-posts heartbeat validates and schedules through Threadify, or after it produces a fallback artifact because the MCP path is unavailable.

This template is public-safe. Replace placeholders with real values only inside the private operator workspace.

## Proof Rules

- Approved text must match the final approval exactly.
- `approved_text_sha256` must hash the exact approved text array used for scheduling.
- `tool_path` must list only tools actually called.
- `fallback_used` must be true when scheduling did not happen inside Threadify.
- Queue or schedule readback is not public proof; it is scheduling proof only.
- Publishing proof requires a later public or target-surface readback.

## JSON Shape

```json
{
  "workflow_id": "daily-posts-heartbeat",
  "adapter": "codex",
  "account_handle": "@example_creator",
  "action": "schedule_post",
  "approved_text": [
    "approved post text exactly as scheduled"
  ],
  "review_items": [
    {
      "slot": 1,
      "review_label": "optional review-only label",
      "public_copy_label_included": false,
      "source_receipt_status": "verified|blocked|not_applicable",
      "blockers": [],
      "cta_destination": "optional destination",
      "utm_source": "optional tracked URL",
      "media_review_status": "approved|review_gated|not_applicable"
    }
  ],
  "approved_text_sha256": "sha256-placeholder",
  "status": "scheduled",
  "timestamp": "2026-06-04T09:00:00+08:00",
  "timezone": "Australia/Perth",
  "tool_path": [
    "get_connection_defaults",
    "validate_post",
    "schedule_post",
    "get_schedule_status",
    "get_schedule_report"
  ],
  "fallback_used": false,
  "artifact_ids": [
    "redacted-artifact-id"
  ]
}
```

## Proof State

```yaml
proof_state:
  current: scheduled
  target_surface: "Threadify scheduled queue"
  evidence: "schedule_post receipt plus get_schedule_status/get_schedule_report readback"
  approval_gate: already_explicit
  recovery_path: "cancel_schedule or reschedule_post before publish time"
  next_verification: "public/thread readback after publish time"
```

## Fallback Receipt Notes

When MCP execution is unavailable, set:

```json
{
  "status": "fallback_artifact_ready",
  "tool_path": ["get_connection_defaults"],
  "fallback_used": true
}
```

Then attach the Threadify-ready artifact path and state that no scheduling occurred.
