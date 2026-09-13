const token = location.hash.slice(1) || sessionStorage.getItem('review-session') || '';
if (token) sessionStorage.setItem('review-session', token);
history.replaceState(null, '', location.pathname);
const $ = id => document.getElementById(id);
let state, page = 0, visible = 50, saveFailed = false;
const pending = new Map();
async function api(route, body) {
  const response = await fetch('/api/' + route, { method: body ? 'POST' : 'GET', headers: { 'X-Review-Session': token, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}
function node(tag, value, className) { const e = document.createElement(tag); if (value !== undefined) e.textContent = value; if (className) e.className = className; return e; }
function link(label, url) {
  try { const u = new URL(url); if (u.protocol === 'https:') { const a = node('a', label); a.href = u.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; } } catch {}
  return node('span', label + ' unavailable', 'muted');
}
function date(value) { return value ? new Date(value).toLocaleString(undefined, {timeZone:state.timezone}) : 'unavailable'; }
function report(error) { saveFailed = true; $('refresh').textContent = 'Reload saved version'; $('error').textContent = error.message === 'revision_conflict' ? 'This reply changed elsewhere. Your text is still in the editor. Copy it before refreshing, then compare the saved version.' : error.message; }
function queue(item, task) {
  const prior = pending.get(item.id) || Promise.resolve();
  const current = prior.then(task);
  pending.set(item.id, current);
  current.catch(report);
  return current;
}
async function flush() { await Promise.all([...pending.values()]); }
async function refresh() { await flush(); state = await api('status'); pending.clear(); render(); }
function comment(item, number) {
  const section = node('section', undefined, 'comment');
  section.dataset.item = item.id;
  const line = node('div', undefined, 'byline'); line.append(node('strong', `${number}. ${item.author}`), node('span', date(item.occurred_at)), link('Comment ↗', item.url), node('span', item.state, 'badge')); section.append(line);
  if (item.ancestry.length) section.append(node('div', item.ancestry.map(a => `${a.author}: ${a.text}`).join('\n\n'), 'ancestry'));
  section.append(node('p', item.text, 'verbatim'));
  const label = node('label', item.mode === 'native' ? 'Your reply · Threadify draft' : item.mode === 'agent' ? 'Your reply · Agent draft' : 'Your reply'); label.className = 'reply-label'; label.htmlFor = 'reply-' + item.id;
  const editor = node('textarea'); editor.id = label.htmlFor; editor.value = item.final_text; editor.setAttribute('aria-label', `Reply to ${item.author}`);
  const locked = ['queued','uncertain','published','skipped','unavailable'].includes(item.state);
  editor.disabled = locked;
  const actions = node('div', undefined, 'actions'), saved = node('span', 'Saved on this device', 'save-state');
  const approve = node('button', item.state === 'approved' ? 'Approved' : 'Approve', 'approve');
  approve.disabled = locked || !item.final_text.trim() || !item.context_complete;
  editor.addEventListener('input', () => {
    const value = editor.value; saved.textContent = 'Saving…'; approve.textContent = 'Approve';
    approve.disabled = !value.trim() || !item.context_complete;
    queue(item, async () => { const updated = await api('edit', { id: item.id, revision: item.revision, text: value }); Object.assign(item, updated); line.querySelector('.badge').textContent = item.state; updateSummary(); saved.textContent = editor.value === value ? 'Saved on this device' : 'Saving…'; });
  });
  async function act(action) {
    actions.querySelectorAll('button').forEach(b => b.disabled = true);
    try { await queue(item, async () => Object.assign(item, await api('decide', { id: item.id, revision: item.revision, action }))); await refresh(); } catch (e) { report(e); }
  }
  approve.onclick = () => act('approve'); actions.append(approve);
  for (const [action, title] of [['defer','Defer'],['skip','Skip'],['regenerate','Regenerate']]) { const b = node('button', title); b.disabled = locked; b.onclick = () => act(action); actions.append(b); }
  if (['skipped','deferred','unavailable'].includes(item.state)) { const b = node('button','Undo'); b.onclick = () => act('undo'); actions.append(b); }
  actions.append(saved); section.append(label, editor, actions);
  if (!item.context_complete) section.append(node('p', 'Waiting for complete conversation context.', 'muted'));
  if (item.state === 'regenerate') section.append(node('p', 'Regeneration requested. Ask your agent to regenerate requested replies, then refresh.', 'muted'));
  if (item.state === 'published') section.append(link('Published reply ↗', item.published_url));
  return section;
}
function updateSummary() {
  const items = state.items;
  const approved = items.filter(i => i.state === 'approved').length, published = items.filter(i => i.state === 'published').length;
  $('progress').textContent = `${items.length} comments · ${approved} approved · ${published} published`;
  $('message').textContent = approved ? `${approved} saved approval${approved === 1 ? '' : 's'}. Return to chat and say “send approved replies” when ready.` : 'Approve individual replies after reviewing them.';
}
function render() {
  $('account').textContent = state.account;
  $('mode').value = state.preference || 'five';
  const items = state.items;
  updateSummary();
  $('period').textContent = state.batch ? `${date(state.batch.start)} – ${date(state.batch.end)} · ${state.timezone}` : 'No batch loaded yet.';
  $('coverage').textContent = state.batch?.coverage.complete && !state.batch.coverage.gaps.length ? '' : 'Coverage incomplete: ' + (state.batch?.coverage.gaps.join('; ') || 'not yet verified');
  const all = state.preference === 'all', pages = Math.max(1, Math.ceil(items.length / 5)); page = Math.min(page, pages - 1);
  const start = all ? 0 : page * 5, rows = items.slice(start, all ? visible : start + 5);
  $('groups').replaceChildren(); let group;
  rows.forEach((item, index) => {
    if (!group || group.dataset.group !== item.group) {
      group = node('article'); group.dataset.group = item.group;
      const post = node('div', undefined, 'post');
      post.append(node('h2', item.post.id ? 'The conversation starts here' : 'Conversation context'), link('Original post ↗', item.post.url), node('p', item.post.text, 'post-body'));
      const metrics = node('div', undefined, 'metrics');
      for (const metric of ['views','likes','replies','reposts','quotes','shares']) metrics.append(node('span', `${item.post.metrics?.[metric] ?? 'Unavailable'} ${metric}`));
      post.append(metrics, node('p', `Metrics checked: ${date(item.post.metrics_checked_at)} · source updated: ${date(item.post.metrics_as_of)}`, 'muted'));
      group.append(post); $('groups').append(group);
    }
    group.append(comment(item, start + index + 1));
  });
  $('previous').hidden = $('next').hidden = all; $('previous').disabled = page === 0; $('next').disabled = page >= pages - 1;
  $('page').textContent = all ? `Showing ${rows.length} of ${items.length}` : `Round ${page + 1} of ${pages}`;
  $('more').hidden = !all || visible >= items.length;
  $('learning').replaceChildren();
  for (const [mode, data] of Object.entries(state.learning)) $('learning').append(node('p', `${mode === 'native' ? 'Threadify' : 'Agent'} drafts: ${data.recent.count} recent verified examples. Unchanged: ${data.recent.unchanged_rate === null ? 'unavailable' : Math.round(data.recent.unchanged_rate * 100) + '%'}. ${data.comparison === 'insufficient_data' ? 'Not enough comparable examples to assess improvement.' : 'Comparable samples available; this is not proof of causation.'}`));
}
$('refresh').onclick = () => {
  if (saveFailed) {
    if (!window.confirm('Reload the saved version? Copy any unsaved text from the editors first.')) return;
    pending.clear(); saveFailed = false; $('error').textContent = ''; $('refresh').textContent = 'Refresh saved replies';
  }
  refresh().catch(report);
};
$('mode').onchange = async e => { try { await flush(); await api('preference', { preference: e.target.value }); page = 0; await refresh(); } catch (error) { report(error); } };
$('previous').onclick = async () => { try { await flush(); page--; render(); } catch(e) { report(e); } };
$('next').onclick = async () => { try { await flush(); page++; render(); } catch(e) { report(e); } };
$('more').onclick = async () => { try { await flush(); visible += 50; render(); } catch(e) { report(e); } };
refresh().catch(report);
