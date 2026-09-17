import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('lead-desk CLI accepts JSON on stdin and reports no external effects', () => {
  const input = {
    schema_version: 1,
    as_of: '2026-09-17T08:00:00Z',
    account: { label: '@threadify', verified: true, comment_read_tool: 'discovered_comment_reader' },
    offer: { id: 'offer-1', confirmed: true, statement: 'Help experts turn conversations into useful content.' },
    route: 'cold_research',
    signals: [{
      id: 'candidate-1',
      source: { kind: 'public_browser', url: 'https://www.threads.com/@candidate/post/1', observed_at: '2026-09-17T07:58:00Z', safe_to_show: true },
      profile: { url: 'https://www.threads.com/@candidate', inspected_at: '2026-09-17T07:59:00Z', public_context_complete: true },
      evidence: { authored_problem: true, offer_relevant: true, supporting_signal: true },
      suggested_action: { type: 'public_reply', destination: 'https://www.threads.com/@candidate/post/1', exact_text: 'I can share a one-step checklist if useful.' },
    }],
  };
  const result = spawnSync(process.execPath, ['bin/threadify-workflows.mjs', 'lead-desk'], {
    cwd: process.cwd(), input: JSON.stringify(input), encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const desk = JSON.parse(result.stdout);
  assert.equal(desk.status, 'review_ready');
  assert.deepEqual(desk.external_effects, { searched: false, messaged: false, scheduled: false, sent: false });
});
