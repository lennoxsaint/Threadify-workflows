// A fake Threadify MCP client: same tool surface as the real one (see the `allowedTools` list in
// validation/schema-checks/validate.mjs), deterministic canned responses, and an injectable
// per-tool failure mode so drivers can be exercised against "this tool is unavailable" the same
// way a real agent would see an MCP error.

const CANNED = {
  get_connection_defaults: () => ({ account_handle: '@example_creator', timezone: 'Australia/Perth', default_account: true }),
  list_accounts: () => ({ accounts: [{ account_handle: '@example_creator', default: true }] }),
  list_dispatcher_tools: () => ({ tools: Object.keys(CANNED) }),
  run_workflow: () => ({ status: 'ok' }),
  call_agent_action: () => ({ status: 'ok' }),
  query_brain: () => ({ memories: [{ id: 'mem-existing-1', class: 'channel_voice', text: 'Sample existing voice note.' }] }),
  get_brain_overview: () => ({ summary: 'sample brain overview' }),
  remember: (args = {}) => ({ memory_id: `mem-${args.candidate_id ?? 'new'}`, written: true }),
  correct_memory: (args = {}) => ({ memory_id: args.memory_id ?? 'mem-unknown', written: true }),
  tombstone_memory: (args = {}) => ({ memory_id: args.memory_id ?? 'mem-unknown', tombstoned: true }),
  export_memory_packet: () => ({ packet_id: 'packet-1' }),
  import_memory_packet: () => ({ imported: true }),
  ingest_vault_url: () => ({ vault_item_id: 'vault-1' }),
  generate_content: () => ({ draft_id: 'draft-1' }),
  edit_draft: () => ({ draft_id: 'draft-1' }),
  save_final_draft: () => ({ draft_id: 'draft-1', saved: true }),
  upload_media: () => ({ media_id: 'media-1' }),
  validate_post: () => ({ valid: true, issues: [] }),
  schedule_post: (args = {}) => ({
    schedule_id: 'sched-1', status: 'scheduled', scheduled_at: args.scheduled_at ?? '2026-07-01T08:00:00+08:00',
  }),
  publish_now: () => ({ status: 'published' }),
  get_publish_status: () => ({ status: 'published' }),
  get_schedule_status: () => ({ status: 'scheduled' }),
  get_schedule_report: () => ({ status: 'scheduled', items: [] }),
  cancel_schedule: () => ({ status: 'cancelled' }),
  reschedule_post: () => ({ status: 'scheduled' }),
  greatest_hits: () => ({ items: [{ id: 'hit-1', text: 'Sample top-performing post text.', score: 0.92 }] }),
  generate_replies: () => ({ replies: [] }),
  send_reply: () => ({ sent: true }),
  enable_auto_reply: () => ({ enabled: true }),
  get_auto_reply_status: () => ({ enabled: false }),
  record_feedback: () => ({ recorded: true }),
  audit_log: () => ({ events: [] }),
};

export class MockMcpClient {
  constructor() {
    // `callLog` records every ATTEMPTED call (including ones that go on to throw) — this is what
    // a real tool_path reflects. `succeeded` records only calls that actually completed, which is
    // what safety invariants ("was the mutating tool really invoked") must check against — an
    // attempt that immediately threw never mutated anything.
    this.callLog = [];
    this.succeeded = [];
    this.failing = new Set();
  }

  /** Mark a tool name as unavailable; the next (and every subsequent) call to it throws. */
  failTool(name) {
    this.failing.add(name);
    return this;
  }

  async call(tool, args = {}) {
    this.callLog.push(tool);
    if (this.failing.has(tool)) {
      throw new Error(`mcp_tool_unavailable:${tool}`);
    }
    const fn = CANNED[tool];
    if (!fn) {
      throw new Error(`mock_mcp_client_has_no_canned_response_for:${tool}`);
    }
    const result = fn(args);
    this.succeeded.push(tool);
    return result;
  }
}
