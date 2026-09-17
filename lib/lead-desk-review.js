const token = location.hash.slice(1);
const input = document.getElementById('reply');
const status = document.getElementById('review-status');
const save = document.getElementById('save');
const final = document.getElementById('final');
let revision;
let savedText;
let pending = false;

async function api(method, path, body) {
  const response = await fetch(path, { method, headers: { 'X-Review-Session': token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function show(state) {
  revision = state.revision;
  savedText = state.draft_text;
  input.value = savedText || '';
  status.textContent = state.status === 'final_for_review' ? `Marked final for review · revision ${revision} · SHA-256 ${state.final_hash}. No reply has been sent.` : `Draft saved · revision ${revision}. No reply has been sent.`;
  save.disabled = false;
  final.disabled = false;
}

if (input && token && location.protocol === 'http:') {
  api('GET', '/api/status').then(show).catch((error) => { status.textContent = `Review state unavailable: ${error.message}`; });
  input.addEventListener('input', () => { if (input.value !== savedText) status.textContent = 'Unsaved edit - save or mark final before leaving.'; });
  async function submit(action) {
    if (pending || revision === undefined) return;
    pending = true;
    save.disabled = true;
    final.disabled = true;
    try { show(await api('POST', '/api/review', { action, revision, text: input.value })); }
    catch (error) { status.textContent = `Not saved: ${error.message}. Refresh and inspect the current state before retrying.`; }
    finally { pending = false; if (revision !== undefined) { save.disabled = false; final.disabled = false; } }
  }
  save.addEventListener('click', () => submit('save'));
  final.addEventListener('click', () => submit('finalize'));
}
