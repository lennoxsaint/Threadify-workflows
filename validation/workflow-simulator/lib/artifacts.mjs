// Builders for the three artifact shapes this repo's workflows produce, matching the field
// vocabulary already used in shared/receipt-templates and examples/*-redacted (action/status
// strings like "scheduled" / "fallback_ready", write_status "written" / "not_executed", etc.).

import crypto from 'node:crypto';

const SIM_TIMESTAMP = '2026-06-30T09:00:00+08:00';
const SIM_TIMEZONE = 'Australia/Perth';

function sha256(parts) {
  return crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

export function makeReceipt({ workflowId, adapter, accountHandle, action, approvedText, status, toolPath, fallbackUsed }) {
  return {
    workflow_id: workflowId,
    adapter,
    account_handle: accountHandle,
    action,
    approved_text: approvedText,
    approved_text_sha256: sha256(approvedText),
    status,
    timestamp: SIM_TIMESTAMP,
    timezone: SIM_TIMEZONE,
    tool_path: toolPath,
    fallback_used: fallbackUsed,
    artifact_ids: ['sim-artifact-1'],
  };
}

export function makeReadyOutput({ workflowId, posts, approvalState, fallbackReason, scheduledAt }) {
  const out = {
    workflow_id: workflowId,
    posts,
    approval_state: approvalState,
    fallback_reason: fallbackReason,
  };
  if (scheduledAt) {
    out.scheduled_at = scheduledAt;
    out.timezone = SIM_TIMEZONE;
  }
  return out;
}

export function makeLedger({ workflowId, adapter, sourceArtifact, items, fallbackUsed }) {
  return {
    workflow_id: workflowId,
    adapter,
    source_artifact: sourceArtifact,
    fallback_used: fallbackUsed,
    timestamp: SIM_TIMESTAMP,
    items,
  };
}
