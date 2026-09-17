const MAX_SIGNALS = 5;
const THREADS_URL = /^https:\/\/(?:www\.)?threads\.com\//i;
const fail = (message) => { throw new Error(message); };
const required = (value, name) => {
  if (typeof value !== 'string' || !value.trim()) fail(`${name} is required`);
  return value.trim();
};
const observedAt = (value, name) => {
  required(value, name);
  if (Number.isNaN(Date.parse(value))) fail(`${name} must be an ISO timestamp`);
  return value;
};
const threadsUrl = (value, name) => {
  const url = required(value, name);
  if (!THREADS_URL.test(url)) fail(`${name} must be a public Threads URL`);
  return url;
};
function classify(signal, route) {
  const evidence = signal.evidence ?? {};
  if (evidence.seller_funnel || evidence.advice_post || evidence.stale || evidence.duplicate || !evidence.authored_problem || !evidence.offer_relevant || !evidence.supporting_signal) return 'reject';
  return route === 'warm_inbound' && !evidence.explicit_interest ? 'research' : 'ready';
}
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
function renderMarkdown(desk) {
  const rows = desk.cards.map((card) => `| ${card.id} | ${card.lane[0].toUpperCase()}${card.lane.slice(1)} | ${card.source_url} | ${card.profile_url} |`).join('\n');
  const action = desk.review_action ? `${desk.review_action.type} to ${desk.review_action.destination}: ${desk.review_action.exact_text}` : 'None.';
  return `# Lead Desk\n\nStatus: ${desk.status}\nRoute: ${desk.route}\nObserved: ${desk.as_of}\n\n| Candidate | Lane | Source | Profile |\n| --- | --- | --- | --- |\n${rows || '| None | no candidate | — | — |'}\n\n## One unsent action for review\n\n${action}\n\nEvidence is current-public-context only. This artifact did not search, message, schedule, or send anything.\n`;
}
function renderHtml(desk) {
  const rows = desk.cards.map((card) => `<tr><td>${escapeHtml(card.id)}</td><td>${escapeHtml(card.lane)}</td><td><a href="${escapeHtml(card.source_url)}">source</a></td><td><a href="${escapeHtml(card.profile_url)}">profile</a></td></tr>`).join('');
  const action = desk.review_action ? `${escapeHtml(desk.review_action.type)} to ${escapeHtml(desk.review_action.destination)}: ${escapeHtml(desk.review_action.exact_text)}` : 'None.';
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Lead Desk</title><style>body{font:16px system-ui;margin:2rem;max-width:900px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:.5rem;text-align:left}</style><h1>Lead Desk</h1><p><b>Status:</b> ${escapeHtml(desk.status)} · <b>Route:</b> ${escapeHtml(desk.route)}</p><table><thead><tr><th>Candidate</th><th>Lane</th><th>Source</th><th>Profile</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No candidate</td></tr>'}</tbody></table><h2>One unsent action for review</h2><p>${action}</p><p><small>Current-public-context only. Nothing was searched, messaged, scheduled, or sent.</small></p></html>`;
}
export function buildLeadDesk(input) {
  if (!input || typeof input !== 'object') fail('input must be an object');
  if (!input.account?.verified) fail('verified account is required');
  required(input.account.comment_read_tool, 'account.comment_read_tool');
  if (!input.offer?.confirmed) fail('confirmed offer is required');
  required(input.offer.id, 'offer.id');
  required(input.offer.statement, 'offer.statement');
  if (!['warm_inbound', 'cold_research'].includes(input.route)) fail('route must be warm_inbound or cold_research');
  observedAt(input.as_of, 'as_of');
  if (!Array.isArray(input.signals)) fail('signals must be an array');
  if (input.signals.length > MAX_SIGNALS) fail('at most five signals are allowed');
  const cards = input.signals.map((signal) => {
    required(signal?.id, 'signal.id');
    if (!signal.source?.safe_to_show) fail('source.safe_to_show must be true');
    const source_url = threadsUrl(signal.source.url, 'source.url');
    observedAt(signal.source.observed_at, 'source.observed_at');
    if (!signal.profile?.public_context_complete) fail('profile.public_context_complete must be true');
    const profile_url = threadsUrl(signal.profile.url, 'profile.url');
    observedAt(signal.profile.inspected_at, 'profile.inspected_at');
    return { id: signal.id, lane: classify(signal, input.route), route: input.route, source_url, source_observed_at: signal.source.observed_at, profile_url, profile_inspected_at: signal.profile.inspected_at, evidence_limit: 'current_public_context_only' };
  });
  const readySignal = input.signals.find((signal, index) => cards[index].lane === 'ready' && signal.suggested_action?.exact_text);
  const review_action = readySignal ? { signal_id: readySignal.id, type: required(readySignal.suggested_action.type, 'suggested_action.type'), destination: required(readySignal.suggested_action.destination, 'suggested_action.destination'), exact_text: required(readySignal.suggested_action.exact_text, 'suggested_action.exact_text'), state: 'draft', send_performed: false } : null;
  const hasReady = cards.some((card) => card.lane === 'ready');
  const status = input.route === 'warm_inbound' && !hasReady ? 'cold_research_required' : hasReady ? (review_action ? 'review_ready' : 'action_draft_required') : 'no_qualified_candidate';
  const desk = { schema_version: 1, workflow_id: 'anti-spam-lead-desk', status, route: input.route, as_of: input.as_of, account: { label: input.account.label ?? null, comment_read_tool: input.account.comment_read_tool }, offer: { id: input.offer.id, statement: input.offer.statement }, cards, review_action, next_workflow: status === 'cold_research_required' ? 'qualified-buyer-research' : null, external_effects: { searched: false, messaged: false, scheduled: false, sent: false } };
  return { ...desk, markdown: renderMarkdown(desk), html: renderHtml(desk) };
}
