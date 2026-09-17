import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLeadDesk } from '../../lib/lead-desk.mjs';

const base = {
  schema_version: 1,
  as_of: '2026-09-17T08:00:00Z',
  account: { label: '@threadify', verified: true, comment_read_tool: 'get_post_thread' },
  offer: { id: 'offer-1', confirmed: true, statement: 'Help independent experts turn Threads conversations into useful content systems.' },
  route: 'warm_inbound',
};

function signal(id, overrides = {}) {
  return {
    id,
    source: { kind: 'owned_thread_comment', url: `https://www.threads.com/@reader/post/${id}`, observed_at: '2026-09-17T07:58:00Z', safe_to_show: true },
    profile: { url: `https://www.threads.com/@reader${id}`, inspected_at: '2026-09-17T07:59:00Z', public_context_complete: true },
    evidence: { authored_problem: true, offer_relevant: true, explicit_interest: false, supporting_signal: true },
    ...overrides,
  };
}

test('Lead Desk classifies a bounded warm-comment set and exposes one unsent review action', () => {
  const desk = buildLeadDesk({ ...base, signals: [
    signal('ready', { evidence: { authored_problem: true, offer_relevant: true, explicit_interest: true, supporting_signal: true }, suggested_action: { type: 'public_reply', destination: 'https://www.threads.com/@reader/post/ready', exact_text: 'I can share the one-step checklist I use for this.' } }),
    signal('research'),
    signal('seller', { evidence: { authored_problem: true, offer_relevant: true, explicit_interest: true, supporting_signal: true, seller_funnel: true } }),
  ] });

  assert.equal(desk.route, 'warm_inbound');
  assert.deepEqual(desk.cards.map((card) => [card.id, card.lane]), [
    ['ready', 'ready'], ['research', 'research'], ['seller', 'reject'],
  ]);
  assert.deepEqual(desk.review_action, {
    signal_id: 'ready', type: 'public_reply', destination: 'https://www.threads.com/@reader/post/ready',
    exact_text: 'I can share the one-step checklist I use for this.', state: 'draft', send_performed: false,
  });
  assert.match(desk.markdown, /Ready/);
  assert.match(desk.html, /Lead Desk/);
});

test('Lead Desk returns a cold-research handoff when no warm comment qualifies', () => {
  const desk = buildLeadDesk({ ...base, signals: [
    signal('generic', { evidence: { authored_problem: false, offer_relevant: false, explicit_interest: false, supporting_signal: false } }),
  ] });

  assert.equal(desk.status, 'cold_research_required');
  assert.equal(desk.review_action, null);
  assert.equal(desk.next_workflow, 'qualified-buyer-research');
});

test('Lead Desk fails closed on unverified sources, unsafe content, and more than five signals', () => {
  assert.throws(() => buildLeadDesk({ ...base, signals: [signal('unsafe', { source: { kind: 'owned_thread_comment', url: 'https://www.threads.com/@reader/post/unsafe', observed_at: '2026-09-17T07:58:00Z', safe_to_show: false } })] }), /safe_to_show/);
  assert.throws(() => buildLeadDesk({ ...base, signals: Array.from({ length: 6 }, (_, index) => signal(`signal-${index}`)) }), /at most five/);
  assert.throws(() => buildLeadDesk({ ...base, account: { ...base.account, verified: false }, signals: [] }), /verified account/);
});

test('already-replied comments cannot become Ready or create a send draft', () => {
  const desk = buildLeadDesk({ ...base, signals: [signal('answered', {
    evidence: { authored_problem: true, offer_relevant: true, explicit_interest: true, supporting_signal: true, owner_already_replied: true },
    suggested_action: { type: 'public_reply', destination: 'https://www.threads.com/@reader/post/answered', exact_text: 'Do not send this twice.' },
  })] });
  assert.equal(desk.cards[0].lane, 'reject');
  assert.equal(desk.cards[0].reinspection_state, 'current_public_context_verified');
  assert.equal(desk.review_action, null);
});
