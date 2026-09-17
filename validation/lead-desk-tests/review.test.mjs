import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildLeadDesk } from '../../lib/lead-desk.mjs';
import { LeadDeskReview } from '../../lib/lead-desk-review.mjs';
import { serveLeadDesk } from '../../lib/lead-desk-review-server.mjs';

function desk() {
  return buildLeadDesk({
    as_of: '2026-09-17T08:00:00Z', account: { label: '@threadify', verified: true, comment_read_tool: 'verified_reader' },
    offer: { id: 'offer', statement: 'Helpful Threads conversations', confirmed: true }, route: 'warm_inbound',
    signals: [
      { id: 'ready', source: { url: 'https://www.threads.com/@a/post/1', text: '<script>alert(1)</script>', observed_at: '2026-09-17T07:58:00Z', safe_to_show: true }, profile: { url: 'https://www.threads.com/@a', inspected_at: '2026-09-17T07:59:00Z', public_context_complete: true }, evidence: { authored_problem: true, offer_relevant: true, explicit_interest: true, supporting_signal: true }, suggested_action: { type: 'public_reply', destination: 'https://www.threads.com/@a/post/1', exact_text: 'Original draft.' } },
      { id: 'research', source: { url: 'https://www.threads.com/@b/post/2', observed_at: '2026-09-17T07:58:00Z', safe_to_show: true }, profile: { url: 'https://www.threads.com/@b', inspected_at: '2026-09-17T07:59:00Z', public_context_complete: true }, evidence: { authored_problem: true, offer_relevant: true, supporting_signal: true } },
      { id: 'reject', source: { url: 'https://www.threads.com/@c/post/3', observed_at: '2026-09-17T07:58:00Z', safe_to_show: true }, profile: { url: 'https://www.threads.com/@c', inspected_at: '2026-09-17T07:59:00Z', public_context_complete: true }, evidence: { authored_problem: false, offer_relevant: false, supporting_signal: false } },
    ],
  });
}

test('three lanes render and exact final text persists across review instances', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lead-desk-review-'));
  try {
    const file = path.join(root, 'review.json');
    const review = new LeadDeskReview(file);
    const source = desk();
    assert.match(source.html, /Ready <span>1<\/span>/);
    assert.match(source.html, /Research <span>1<\/span>/);
    assert.match(source.html, /Reject <span>1<\/span>/);
    assert.match(source.html, /Mark Final for Review/);
    assert.match(source.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(source.html, /<script>alert\(1\)<\/script>/);
    review.initialize(source);
    const exact = 'hmm good question! i like "what\'s your biggest blocker/challenge rn?" - then if that happens to be something i help with, i do that!';
    const finalized = review.update({ action: 'finalize', revision: 0, text: exact });
    assert.equal(finalized.status, 'final_for_review');
    assert.equal(new LeadDeskReview(file).status().final_text, exact);
    assert.equal(finalized.final_hash.length, 64);
    assert.equal(finalized.send_performed, false);
    assert.throws(() => review.update({ action: 'save', revision: 0, text: 'Stale' }), /revision_conflict/);
    const edited = review.update({ action: 'save', revision: 1, text: 'Changed after final.' });
    assert.equal(edited.status, 'draft');
    assert.equal(edited.final_text, null);
    assert.equal(edited.final_hash, null);
    assert.throws(() => review.initialize({ ...source, cards: [] }), /different_desk/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('loopback page requires session for readback and persists browser final action', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lead-desk-server-'));
  const review = new LeadDeskReview(path.join(root, 'review.json'));
  review.initialize(desk());
  const { server, url } = await serveLeadDesk(review);
  try {
    const origin = new URL(url).origin;
    const token = new URL(url).hash.slice(1);
    assert.equal((await fetch(origin)).status, 200);
    assert.equal((await fetch(`${origin}/api/status`)).status, 403);
    assert.equal((await fetch(`${origin}/api/status`, { headers: { 'X-Review-Session': token, Origin: 'https://attacker.example' } })).status, 403);
    const response = await fetch(`${origin}/api/review`, { method: 'POST', headers: { 'X-Review-Session': token, 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ action: 'finalize', revision: 0, text: 'Edited in the HTML.' }) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).final_text, 'Edited in the HTML.');
    assert.equal(review.status().final_text, 'Edited in the HTML.');
  } finally { await new Promise((resolve) => server.close(resolve)); fs.rmSync(root, { recursive: true, force: true }); }
});
