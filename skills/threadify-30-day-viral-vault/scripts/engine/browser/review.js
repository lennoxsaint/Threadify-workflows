const app = document.querySelector('#app');
const saved = document.querySelector('#saved');
const errorBox = document.querySelector('#error');
const fragment = location.hash.slice(1);
if (fragment) {
  sessionStorage.setItem('review-token', fragment);
  history.replaceState(null, '', '/');
}
const token = sessionStorage.getItem('review-token');
let state;
let edits;
let index = 0;
let timer;
let chain = Promise.resolve();
let dirty = 0;
let persisted = 0;
let busy = false;
let navigating = false;
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const fail = (error) => {
  errorBox.textContent = error.message;
  errorBox.hidden = false;
  saved.textContent = 'Edits need saving';
};
const clearError = () => {
  errorBox.hidden = true;
};
async function api(route, body) {
  const response = await fetch(`/api/${route}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Could not save. Keep this tab open.');
  return data;
}
function changed() {
  edits[index].reviewed = false;
  dirty++;
  saved.textContent = 'Saving…';
  clearTimeout(timer);
  timer = setTimeout(() => save().catch(fail), 450);
}
function save() {
  clearTimeout(timer);
  const operation = chain
    .catch(() => {})
    .then(async () => {
      if (dirty === persisted) return;
      const version = dirty;
      const snapshot = structuredClone(edits);
      const result = await api('save', { revision: state.revision, edits: snapshot });
      state.revision = result.revision;
      persisted = version;
      saved.textContent = dirty === persisted ? 'Saved locally' : 'Saving…';
      clearError();
    });
  chain = operation;
  return operation;
}
function dateLabel(content) {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: content.timezone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(content.scheduled_at));
}
function button(text, handler, primary = false) {
  const node = el('button', text, `action${primary ? ' primary' : ''}`);
  node.type = 'button';
  node.addEventListener('click', async () => {
    if (navigating) return;
    navigating = true;
    const disabled = node.disabled;
    node.disabled = true;
    try {
      await handler();
    } catch (error) {
      fail(error);
    } finally {
      navigating = false;
      if (node.isConnected) node.disabled = disabled;
    }
  });
  return node;
}
function resize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.max(72, textarea.scrollHeight)}px`;
}
function textEditor(value, label, onInput) {
  const box = el('div', undefined, 'editor');
  const area = el('textarea');
  area.value = value;
  area.setAttribute('aria-label', label);
  const count = el('span', undefined, 'counter');
  const updateCount = () => {
    const length = [...area.value].length;
    count.textContent = `${length} / 500`;
    count.className = `counter${length > 500 || !area.value.trim() ? ' invalid' : ''}`;
  };
  area.addEventListener('input', () => {
    onInput(area.value);
    updateCount();
    resize(area);
  });
  box.append(area, count);
  updateCount();
  requestAnimationFrame(() => resize(area));
  return box;
}
function automationOption(key, label) {
  const section = el('section', undefined, 'option');
  const row = el('div', undefined, 'option-row');
  row.append(el('span', label));
  const controls = el('div', undefined, 'switch-group');
  const value = edits[index][key];
  const global = state.automation.global_repost;
  const blocked = !state.automation.available || (key === 'auto_repost' && (!global.known || global.enabled));
  const status =
    key === 'auto_repost' && !global.known
      ? 'Unknown'
      : key === 'auto_repost' && global.enabled
        ? 'Account-wide'
        : value
          ? 'On'
          : 'Off';
  controls.append(el('span', status));
  const toggle = el('button', undefined, 'switch');
  toggle.type = 'button';
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-label', label);
  toggle.setAttribute('aria-checked', String(Boolean(value) || (key === 'auto_repost' && global.enabled)));
  toggle.disabled = blocked && !value;
  toggle.addEventListener('click', () => {
    edits[index][key] = value
      ? null
      : {
          trigger: 'time',
          delay_minutes: key === 'auto_plug' ? 15 : 720,
          ...(key === 'auto_plug' ? { content: '' } : {}),
        };
    changed();
    render();
  });
  controls.append(toggle);
  row.append(controls);
  section.append(row);
  if (key === 'auto_repost' && global.enabled)
    section.append(
      el(
        'p',
        `Your account reposts ${global.trigger === 'likes' ? `at ${global.likes_threshold} likes` : `after ${global.delay_minutes} minutes`}. Change this in Threadify settings.`,
        'notice',
      ),
    );
  else if (blocked)
    section.append(
      el(
        'p',
        global.known
          ? 'Unavailable on this connection.'
          : 'Account settings need checking before scheduling.',
        'notice',
      ),
    );
  if (value && !blocked) {
    const fields = el('div', undefined, 'option-fields');
    if (key === 'auto_plug')
      fields.append(
        textEditor(value.content, 'Auto Plug text', (text) => {
          value.content = text;
          changed();
        }),
      );
    const triggers = el('div', undefined, 'trigger-fields');
    const triggerLabel = el('label', 'Send after');
    const select = el('select');
    for (const [id, name] of [
      ['time', 'Time'],
      ['likes', 'Likes'],
    ]) {
      const option = el('option', name);
      option.value = id;
      select.append(option);
    }
    select.value = value.trigger;
    select.setAttribute('aria-label', `${label} trigger`);
    select.addEventListener('change', () => {
      const content = value.content;
      edits[index][key] = {
        trigger: select.value,
        ...(select.value === 'time'
          ? { delay_minutes: key === 'auto_plug' ? 15 : 720 }
          : { likes_threshold: 10 }),
        ...(content !== undefined ? { content } : {}),
      };
      changed();
      render();
    });
    triggerLabel.append(select);
    const amountLabel = el('label', value.trigger === 'time' ? 'Minutes after publication' : 'Likes');
    const amount = el('input');
    amount.type = 'number';
    const field = value.trigger === 'time' ? 'delay_minutes' : 'likes_threshold';
    amount.min = value.trigger === 'time' ? '5' : '1';
    amount.step = '1';
    amount.value = value[field];
    amount.setAttribute('aria-label', `${label} ${field}`);
    amount.addEventListener('input', () => {
      value[field] = Number(amount.value);
      changed();
    });
    amountLabel.append(amount);
    triggers.append(triggerLabel, amountLabel);
    fields.append(triggers);
    section.append(fields);
  }
  return section;
}
function details(content) {
  const details = el('details');
  details.append(el('summary', 'Source, account & details'));
  const body = el('div', undefined, 'detail-body');
  body.append(el('p', `Account: ${content.account_id}`), el('p', `Adaptation: ${content.adaptation_mode}`));
  const url = content.source.url;
  const link = el('a', url);
  if (/^https?:\/\//.test(url)) {
    link.href = url;
    link.target = '_blank';
    link.rel = 'noreferrer noopener';
  }
  body.append(link);
  if (content.gaps.length) body.append(el('p', `Needs checking: ${content.gaps.join('; ')}`));
  if (content.media.length) body.append(el('pre', JSON.stringify(content.media, null, 2)));
  details.append(body);
  return details;
}
function render() {
  app.replaceChildren();
  document.querySelector('#title').textContent =
    state.horizon_days === 1
      ? 'Review your day'
      : state.horizon_days === 7
        ? 'Review your week'
        : 'Review your month';
  document.querySelector('.intro').textContent =
    state.horizon_days === 28
      ? 'Four weeks. 28 days. Your words, your spacing.'
      : 'Edit the words. Keep the spacing. Make it yours.';
  if (state.status === 'submitted') return renderSubmitted();
  if (index === edits.length) return renderSummary();
  const entry = state.entries[index];
  const content = entry.content;
  const progressRow = el('div', undefined, 'progress-row');
  const left = el('div', `Post ${index + 1} of ${edits.length}`, 'progress-left');
  const progress = el('progress');
  progress.max = edits.length;
  progress.value = index + 1;
  progress.setAttribute('aria-label', 'Review progress');
  left.append(progress);
  const date = el('div', dateLabel(content), 'date');
  date.append(el('br'), el('small', content.timezone));
  progressRow.append(left, date);
  app.append(progressRow);
  const card = el('article', undefined, 'post-card');
  card.setAttribute('aria-label', `Post ${index + 1}`);
  edits[index].parts.forEach((part, partIndex, all) => {
    const row = el('div', undefined, 'part');
    const identity = el('div', undefined, 'identity');
    const avatar = el('span', state.username.slice(0, 1).toUpperCase(), 'avatar');
    avatar.setAttribute('aria-hidden', 'true');
    identity.append(avatar);
    if (partIndex < all.length - 1) identity.append(el('span', undefined, 'line'));
    const body = el('div');
    if (partIndex === 0) body.append(el('div', state.username, 'username'));
    body.append(
      textEditor(part, `Post ${index + 1}, part ${partIndex + 1}`, (text) => {
        edits[index].parts[partIndex] = text;
        changed();
      }),
    );
    row.append(identity, body);
    card.append(row);
  });
  if (content.media.length) card.append(el('p', 'Attached media is unchanged. See details below.', 'notice'));
  app.append(card);
  const options = el('div', undefined, 'options');
  options.append(automationOption('auto_plug', 'Auto Plug'), automationOption('auto_repost', 'Auto Repost'));
  app.append(options, details(content));
  const actions = el('div', undefined, 'actions');
  const back = button('Back', async () => {
    await save();
    index--;
    render();
  });
  back.disabled = index === 0;
  const next = button(
    index === edits.length - 1 ? 'Review all posts' : 'Next post',
    async () => {
      if (edits[index].parts.some((part) => !part.trim() || [...part].length > 500))
        throw new Error('Keep each part between 1 and 500 characters.');
      edits[index].reviewed = true;
      dirty++;
      await save();
      index++;
      render();
      window.scrollTo(0, 0);
    },
    true,
  );
  actions.append(back, next);
  app.append(actions, el('p', 'Nothing is scheduled until you submit all posts.', 'footnote'));
}
function renderSummary() {
  const complete = edits.every((edit) => edit.reviewed);
  app.append(
    el('p', `${edits.filter((edit) => edit.reviewed).length} of ${edits.length} posts reviewed.`, 'muted'),
  );
  if (state.prepared_days < state.horizon_days)
    app.append(
      el(
        'p',
        `Only ${state.prepared_days} of ${state.horizon_days} days are drafted. Submit covers these ${edits.length} posts only.`,
        'notice',
      ),
    );
  const list = el('ol', undefined, 'summary-list');
  edits.forEach((edit, i) => {
    const item = el('li');
    const copy = el('div');
    copy.append(
      el('strong', dateLabel(state.entries[i].content)),
      el('p', edit.parts[0].slice(0, 100)),
      el(
        'small',
        `${edit.parts.length} part${edit.parts.length === 1 ? '' : 's'} · Auto Plug ${edit.auto_plug ? 'on' : 'off'} · Auto Repost ${state.automation.global_repost.enabled ? 'account-wide' : edit.auto_repost ? 'on' : 'off'}`,
      ),
    );
    const editButton = button(edit.reviewed ? 'Edit' : 'Review', () => {
      index = i;
      render();
    });
    item.append(copy, editButton);
    list.append(item);
  });
  app.append(list);
  const local = state.entries.every((entry) => !entry.content.draft_id);
  app.append(
    el(
      'p',
      local
        ? 'Submit saves your final local drafts. No account is connected for scheduling.'
        : `Submit approves these exact posts and automation settings for scheduling to ${state.username} (${state.entries[0].content.timezone}). Your host checks and schedules them, then reports receipts here.`,
      'notice',
    ),
  );
  const actions = el('div', undefined, 'actions');
  actions.append(
    button('Back', () => {
      index = edits.length - 1;
      render();
    }),
  );
  const submit = button(
    `Submit ${edits.length} posts`,
    async () => {
      if (busy) return;
      busy = true;
      submit.disabled = true;
      try {
        await save();
        const result = await api('submit', { revision: state.revision, edits });
        state.revision = result.revision;
        state.status = result.status;
        saved.textContent = 'Submitted';
        render();
        poll();
      } finally {
        busy = false;
        submit.disabled = !complete;
      }
    },
    true,
  );
  submit.disabled = !complete;
  actions.append(submit);
  app.append(actions);
}
function renderSubmitted() {
  const panel = el('section', undefined, 'status-panel');
  const delivery = state.delivery ?? [];
  const scheduled = delivery.filter((card) =>
    ['scheduled', 'published', 'observed'].includes(card.state),
  ).length;
  const local = state.entries.every((entry) => !entry.content.draft_id);
  panel.append(
    el(
      'h2',
      scheduled === edits.length
        ? 'All posts scheduled'
        : local
          ? 'Final drafts submitted'
          : 'Submitted. Your host takes it from here.',
    ),
  );
  panel.append(
    el(
      'p',
      scheduled === edits.length
        ? 'The saved schedule receipts match your reviewed text.'
        : local
          ? 'Your exact edits are saved locally. Nothing was scheduled.'
          : 'Your edits are locked. This is approval, not a schedule receipt. Keep your host task running while it validates and schedules.',
    ),
  );
  if (state.host_status) panel.append(el('p', state.host_status.message));
  const labels = {
    awaiting_host: 'Waiting for your host',
    draft: 'Needs validation',
    validated: 'Validated',
    approved: 'Ready for final checks',
    attempt_pending: 'Checking delivery',
    unknown: 'Delivery needs checking',
    scheduled: 'Scheduled',
    published: 'Published',
    observed: 'Published',
    reviewed_local: 'Saved locally',
  };
  for (const [i, entry] of state.entries.entries())
    panel.append(
      el(
        'p',
        `Post ${i + 1} · ${dateLabel(entry.content)} · ${labels[delivery[i]?.state ?? 'awaiting_host']}`,
        'muted',
      ),
    );
  app.append(panel);
}
async function poll() {
  try {
    state = await api('state');
    render();
  } catch (error) {
    fail(
      new Error(
        'Editor connection closed. Your saved review remains on this computer; ask your host to resume it.',
      ),
    );
    return;
  }
  setTimeout(poll, 3000);
}
window.addEventListener('beforeunload', (event) => {
  if (dirty !== persisted) {
    event.preventDefault();
    event.returnValue = '';
  }
});
try {
  state = await api('state');
  edits = structuredClone(state.edits);
  saved.textContent = state.status === 'submitted' ? 'Submitted' : 'Saved locally';
  render();
  if (state.status === 'submitted') poll();
} catch (error) {
  fail(error);
}
