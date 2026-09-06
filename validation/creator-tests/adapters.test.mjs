import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL('../../' + file, import.meta.url), 'utf8');

test('every adapter preserves the shared connected and disconnected creator policy', () => {
  for (const adapter of ['codex', 'claude', 'cursor', 'gemini', 'hermes', 'openclaw']) {
    const body = read(`adapters/${adapter}/README.md`);
    assert.match(body, /\.\.\/generic-mcp\/README\.md/, adapter);
    assert.doesNotMatch(body, /orchestration-only|no Threadify-native generation|no public workflow generation prompts/, adapter);
  }
  const generic = read('adapters/generic-mcp/README.md');
  assert.match(generic, /local drafting/);
  assert.match(generic, /generate_content/);
  assert.match(generic, /save_draft/);
  assert.match(generic, /explicit opt-in/);
  assert.match(generic, /required_mcp_tools/);
  assert.match(generic, /optional_mcp_tools/);
  assert.doesNotMatch(generic, /Do not call Threadify-native generation tools/);
});

test('receipt examples use current readback names without asserting tools were called', () => {
  for (const file of ['action-proof-receipt.md', 'daily-posts-heartbeat-workflow-receipt.md']) {
    const body = read(`shared/receipt-templates/${file}`);
    assert.doesNotMatch(body, /get_schedule_report/);
    assert.match(body, /list_scheduled_posts/);
    assert.match(body, /only tools actually called/);
  }
});

test('X Article preparation distinguishes thumbnail requests and optional feedback from completed actions', () => {
  const body = read('workflows/x-article-from-daily-post/README.md');
  assert.match(body, /explicit opt-in/);
  assert.match(body, /request packet is not a generated image/);
  assert.doesNotMatch(body, /real image asset or image-generation request packet exists/);
});

test('root contributor, security and publication guidance permits the public local engine', () => {
  for (const file of ['CONTRIBUTING.md', 'SECURITY.md', 'PUBLICATION_CHECKLIST.md']) {
    const body = read(file);
    assert.doesNotMatch(body, /orchestration-only/, file);
    assert.match(body, /local engine/, file);
  }
  const checklist = read('PUBLICATION_CHECKLIST.md');
  assert.match(checklist, /Lennox approves/);
  assert.match(checklist, /SamSam approves/);
  assert.match(checklist, /Support\/security contact is confirmed/);
});
