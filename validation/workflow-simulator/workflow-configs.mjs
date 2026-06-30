// Declarative per-workflow shape for the simulator engine (lib/engine.mjs). Derived directly from
// each workflow's manifest.json `required_mcp_tools` + README "Required Behavior" / "Operating
// Loop" sections — see those for the source of truth this mirrors. Keep in sync when a workflow's
// README step order or required tools change.

export const WORKFLOW_CONFIGS = {
  'daily-greatest-hits': {
    kind: 'schedule',
    dataTools: ['greatest_hits', 'validate_post'],
    mutatingTool: 'schedule_post',
    postTools: ['get_schedule_status', 'get_schedule_report'],
    feedbackTool: 'record_feedback',
  },
  'daily-posts-heartbeat': {
    kind: 'schedule',
    dataTools: ['validate_post'],
    mutatingTool: 'schedule_post',
    postTools: ['get_schedule_status', 'get_schedule_report'],
    feedbackTool: 'record_feedback',
  },
  'weekly-winner-replication': {
    kind: 'schedule',
    dataTools: ['greatest_hits', 'validate_post'],
    mutatingTool: 'schedule_post',
    postTools: ['get_schedule_status', 'get_schedule_report'],
    feedbackTool: 'record_feedback',
  },
  'youtube-edit': {
    kind: 'schedule',
    // upload_media here is attaching the chosen thumbnail/media for review, not a publish step —
    // it still runs before the approval gate per the workflow's "Required Behavior" order.
    dataTools: ['upload_media', 'validate_post'],
    mutatingTool: 'schedule_post',
    postTools: ['get_schedule_status', 'get_schedule_report'],
    feedbackTool: 'record_feedback',
  },
  'crosspost-x-after-threads': {
    kind: 'draft-only',
    dataTools: ['get_schedule_status', 'get_schedule_report', 'get_publish_status', 'validate_post'],
    feedbackTool: 'record_feedback',
  },
  'x-article-from-daily-post': {
    kind: 'draft-only',
    dataTools: ['validate_post'],
    feedbackTool: 'record_feedback',
  },
  'personal-brain-sync-current-self': {
    kind: 'memory',
    dataTools: ['query_brain'],
    mutatingTool: 'remember',
    readbackTool: 'query_brain',
    feedbackTool: 'audit_log',
  },
};
