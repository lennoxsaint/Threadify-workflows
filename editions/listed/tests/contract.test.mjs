import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// contract/tools.json is threadify-app's own export (docs/plugin/tool-contract.json, written by
// scripts/mcp/export-tool-contract.ts from the tool list the server serves), copied here unchanged.
const committed = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../contract/tools.json', import.meta.url)), 'utf8'));

test('the committed contract is the server export, sorted by name, with only the exported keys', () => {
  assert.match(committed.note, /export-tool-contract/);
  const names = committed.tools.map((tool) => tool.name);
  assert.deepEqual(names, [...names].sort());
  for (const tool of committed.tools) {
    assert.deepEqual(Object.keys(tool).sort(), ['hints', 'name', 'renders_in_screen', 'required', 'title']);
  }
});

test('the committed contract holds the review tools and the schedule and reply tools with their required parameters', () => {
  const byName = new Map(committed.tools.map((tool) => [tool.name, tool]));
  // review_post gained action "publish" (threadify-app#244), so its schema no longer requires scheduled_at.
  assert.deepEqual(byName.get('review_post').required, []);
  assert.equal(byName.get('review_post').hints.readOnlyHint, true);
  // review_reply (threadify-app#248) reviews one send tool's exact arguments and returns its approval.
  assert.deepEqual(byName.get('review_reply').required, ['tool']);
  assert.equal(byName.get('review_reply').hints.readOnlyHint, true);
  assert.deepEqual(byName.get('send_reply').required, ['draft_text']);
  assert.deepEqual(byName.get('send_replies').required, ['drafts']);
  assert.deepEqual(byName.get('schedule_post').required, ['scheduled_at']);
  assert.deepEqual(byName.get('get_schedule_status').required, ['scheduled_post_id']);
  for (const tool of committed.tools) {
    assert.deepEqual(Object.keys(tool.hints).sort(), ['destructiveHint', 'idempotentHint', 'openWorldHint', 'readOnlyHint']);
  }
  // The screen draws the review and the calendar (threadify-app#245, #250).
  assert.equal(byName.get('review_post').renders_in_screen, true);
  assert.equal(byName.get('open_calendar').renders_in_screen, true);
});
