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
const optionalText = (value, name) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length > 1000) fail(`${name} must be text of at most 1000 characters`);
  return value;
};
function classify(signal, route) {
  const evidence = signal.evidence ?? {};
  if (evidence.owner_already_replied || evidence.seller_funnel || evidence.advice_post || evidence.stale || evidence.duplicate || !evidence.authored_problem || !evidence.offer_relevant || !evidence.supporting_signal) return 'reject';
  return route === 'warm_inbound' && !evidence.explicit_interest ? 'research' : 'ready';
}
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
function renderMarkdown(desk) {
  const rows = desk.cards.map((card) => `| ${card.id} | ${card.lane[0].toUpperCase()}${card.lane.slice(1)} | ${card.source_url} | ${card.profile_url} |`).join('\n');
  const action = desk.review_action ? `${desk.review_action.type} to ${desk.review_action.destination}: ${desk.review_action.exact_text}` : 'None.';
  return `# Lead Desk\n\nStatus: ${desk.status}\nRoute: ${desk.route}\nObserved: ${desk.as_of}\n\n| Candidate | Lane | Source | Profile |\n| --- | --- | --- | --- |\n${rows || '| None | no candidate | — | — |'}\n\n## One unsent action for review\n\n${action}\n\nEvidence is current-public-context only. This artifact did not search, message, schedule, or send anything.\n`;
}
function renderHtml(desk) {
  const lanes = ['ready', 'research', 'reject'].map((lane) => {
    const cards = desk.cards.filter((card) => card.lane === lane);
    const rows = cards.map((card) => `<li><strong>${escapeHtml(card.id)}</strong>${card.source_text ? `<p>${escapeHtml(card.source_text)}</p>` : ''}${card.review_note ? `<span>${escapeHtml(card.review_note)}</span>` : ''}<span>${escapeHtml(card.route)} · current public context only</span><a href="${escapeHtml(card.source_url)}" target="_blank" rel="noopener noreferrer">Source · ${escapeHtml(card.source_observed_at)}</a><a href="${escapeHtml(card.profile_url)}" target="_blank" rel="noopener noreferrer">Profile · ${escapeHtml(card.profile_inspected_at)}</a></li>`).join('');
    return `<section class="lane"><h2>${lane[0].toUpperCase()}${lane.slice(1)} <span>${cards.length}</span></h2><ul>${rows || '<li class="empty">No cards in this category.</li>'}</ul></section>`;
  }).join('');
  const action = desk.review_action ? `<section class="editor"><h2>One public reply for review</h2><p>Destination: <a href="${escapeHtml(desk.review_action.destination)}" target="_blank" rel="noopener noreferrer">${escapeHtml(desk.review_action.destination)}</a></p><label for="reply">Exact reply text</label><textarea id="reply" rows="6" spellcheck="false">${escapeHtml(desk.review_action.exact_text)}</textarea><div class="controls"><button id="save" type="button" disabled>Save draft</button><button id="final" type="button" disabled>Mark Final for Review</button></div><p id="review-status" role="status">Start the local review server to edit and save this reply.</p></section>` : '<section class="editor"><h2>No reply drafted</h2><p>There is no eligible Ready action to finalize.</p></section>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lead Desk</title><style>body{font:16px/1.5 system-ui;margin:2rem auto;padding:0 1rem;max-width:1000px;color:#19232c;background:#f5f7f8}h1{margin-bottom:.2rem}.subtitle{color:#52616b}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem;margin:2rem 0}.lane,.editor{background:#fff;border:1px solid #dce3e8;border-radius:12px;padding:1.25rem}.lane h2{margin-top:0}.lane h2 span{color:#62717b}.lane ul{list-style:none;padding:0}.lane li{border-top:1px solid #e4e9ed;padding:.8rem 0;overflow-wrap:anywhere}.lane li>*{display:block}.lane li span,.empty{color:#62717b}a{color:#07518a}textarea{box-sizing:border-box;display:block;width:100%;margin:.5rem 0 1rem;padding:.8rem;font:inherit;border:1px solid #9aabb7;border-radius:8px}button{font:inherit;padding:.65rem 1rem;margin-right:.5rem;border:0;border-radius:8px;background:#07518a;color:#fff;cursor:pointer}button:disabled{background:#a2aeb6;cursor:not-allowed}#review-status{font-weight:600}.note{font-size:.9rem;color:#52616b}@media(max-width:750px){.grid{grid-template-columns:1fr}}</style></head><body><h1>Anti-Spam Lead Desk</h1><p class="subtitle">${escapeHtml(desk.account.label ?? 'Verified account')} · ${escapeHtml(desk.route)} · ${escapeHtml(desk.as_of)}</p><div class="grid">${lanes}</div>${action}<p class="note">Ready means reviewable public context, not a buyer or permission to DM. Marking final saves exact text for a later verified send. This page never sends, schedules, or messages anyone.</p><script src="/lead-desk-review.js" defer></script></body></html>`;
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
    return { id: signal.id, lane: classify(signal, input.route), route: input.route, source_text: optionalText(signal.source.text, 'source.text'), review_note: optionalText(signal.review_note, 'review_note'), source_url, source_observed_at: signal.source.observed_at, profile_url, profile_inspected_at: signal.profile.inspected_at, reinspection_state: 'current_public_context_verified', evidence_limit: 'current_public_context_only' };
  });
  const readySignal = input.signals.find((signal, index) => cards[index].lane === 'ready' && signal.suggested_action?.exact_text);
  const review_action = readySignal ? { signal_id: readySignal.id, type: required(readySignal.suggested_action.type, 'suggested_action.type'), destination: threadsUrl(readySignal.suggested_action.destination, 'suggested_action.destination'), exact_text: required(readySignal.suggested_action.exact_text, 'suggested_action.exact_text'), state: 'draft', send_performed: false } : null;
  if (review_action && review_action.type !== 'public_reply') fail('suggested_action.type must be public_reply');
  const hasReady = cards.some((card) => card.lane === 'ready');
  const status = input.route === 'warm_inbound' && !hasReady ? 'cold_research_required' : hasReady ? (review_action ? 'review_ready' : 'action_draft_required') : 'no_qualified_candidate';
  const desk = { schema_version: 1, workflow_id: 'anti-spam-lead-desk', status, route: input.route, as_of: input.as_of, account: { label: input.account.label ?? null, comment_read_tool: input.account.comment_read_tool }, offer: { id: input.offer.id, statement: input.offer.statement }, cards, review_action, next_workflow: status === 'cold_research_required' ? 'qualified-buyer-research' : null, external_effects: { searched: false, messaged: false, scheduled: false, sent: false } };
  return { ...desk, markdown: renderMarkdown(desk), html: renderHtml(desk) };
}
