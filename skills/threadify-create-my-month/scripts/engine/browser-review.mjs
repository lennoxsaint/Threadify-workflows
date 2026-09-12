import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { readState, updateState } from './store.mjs';
import { reviewHash } from './review.mjs';
import { validateAutomation, validateGlobalRepost } from './automation.mjs';

const assert = (value, message) => {
  if (!value) throw new Error(message);
};
const editable = new Set(['draft', 'validated', 'approved']);
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const equal = (a, b) => reviewHash(a) === reviewHash(b);

function entriesFor(data, planId) {
  return data.reviews
    .filter((review) => review.plan_id === planId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((review) =>
      review.cards
        .filter((card) => editable.has(card.state))
        .map((card) => ({
          review_id: review.id,
          base_hash: reviewHash(card.content),
          content: card.content,
        })),
    );
}

export async function createBrowserReview(root, input) {
  const state = await readState(root);
  const plan = state.payload?.plans.find((item) => item.id === input.plan_id);
  assert(plan, 'Unknown plan. Prepare drafts before opening the editor.');
  assert(
    !state.payload.reviews
      .filter((review) => review.plan_id === plan.id)
      .some((review) => review.cards.some((card) => ['attempt_pending', 'unknown'].includes(card.state))),
    'Reconcile unresolved delivery attempts before opening another review.',
  );
  const entries = entriesFor(state.payload, plan.id);
  assert(entries.length > 0, 'No editable posts in this plan.');
  assert(
    entries.every((entry) => Boolean(entry.content.draft_id) === Boolean(entries[0].content.draft_id)),
    'Finish preparing hosted drafts or use a separate local review; do not mix delivery modes.',
  );
  assert(
    input.username === undefined || (nonempty(input.username) && input.username.length <= 100),
    'A short account username is required.',
  );
  const automation = input.automation ?? {
    available: false,
    global_repost: { known: false, enabled: false },
  };
  assert(
    Object.keys(automation).every((key) =>
      ['available', 'global_repost', 'checked_at', 'evidence_ref'].includes(key),
    ),
    'Pass only the normalized automation settings, never full connection data.',
  );
  assert(
    typeof automation.available === 'boolean' &&
      typeof automation.global_repost?.known === 'boolean' &&
      typeof automation.global_repost.enabled === 'boolean',
    'Explicit automation capability required.',
  );
  validateGlobalRepost(automation.global_repost);
  if (automation.global_repost.known)
    assert(
      nonempty(automation.evidence_ref) && Number.isFinite(Date.parse(automation.checked_at)),
      'Automation settings need provider evidence and time.',
    );
  const session = {
    schema_version: 'creator-browser-review.v1',
    id: randomUUID(),
    plan_id: plan.id,
    title: plan.label,
    username: input.username ?? plan.preferences.account_id,
    plan_hash: reviewHash(plan),
    horizon_days: plan.days.length,
    prepared_days: new Set(entries.map((e) => e.review_id)).size,
    account_id: plan.preferences.account_id,
    automation,
    created_at: new Date().toISOString(),
    status: 'editing',
    entries: structuredClone(entries),
    edits: entries.map((entry) => ({
      id: entry.content.id,
      parts: entry.content.parts,
      auto_plug: entry.content.auto_plug ?? null,
      auto_repost: entry.content.auto_repost ?? null,
      reviewed: false,
    })),
    submission: null,
  };
  const sessionRoot = path.join(root, `browser-review-${session.id}`);
  await updateState(sessionRoot, 0, () => session);
  return { sessionRoot, session };
}

async function assertSourceUnchanged(root, session) {
  const state = await readState(root);
  const plan = state.payload?.plans.find((plan) => plan.id === session.plan_id);
  assert(plan && reviewHash(plan) === session.plan_hash, 'Plan changed. Reopen a fresh review.');
  for (const entry of session.entries) {
    const card = state.payload?.reviews
      .find((r) => r.id === entry.review_id)
      ?.cards.find((c) => c.content.id === entry.content.id);
    assert(
      card && editable.has(card.state) && reviewHash(card.content) === entry.base_hash,
      'A source draft changed outside this editor. Your edits are saved; reopen a fresh review before submitting.',
    );
  }
}

function validateEdits(session, edits, submitting) {
  assert(
    Array.isArray(edits) && edits.length === session.entries.length,
    'All prepared posts must remain in the review.',
  );
  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i];
    const source = session.entries[i].content;
    assert(
      edit &&
        Object.keys(edit).sort().join(',') === 'auto_plug,auto_repost,id,parts,reviewed' &&
        edit.id === source.id &&
        typeof edit.reviewed === 'boolean',
      'Invalid post edit or order.',
    );
    assert(
      Array.isArray(edit.parts) &&
        edit.parts.length === source.parts.length &&
        edit.parts.every((part) => typeof part === 'string' && part.length <= 20000),
      'Keep the existing thread parts.',
    );
    validateAutomation(edit.auto_plug, true, !submitting);
    validateAutomation(edit.auto_repost, false, !submitting);
    if (edit.auto_plug || edit.auto_repost)
      assert(session.automation.available, 'Post automation is unavailable for this connection.');
    if (edit.auto_repost)
      assert(
        session.automation.global_repost.known && !session.automation.global_repost.enabled,
        'Account-wide Auto Repost overrides per-post settings.',
      );
    if (submitting) {
      assert(edit.reviewed, 'Review every post before submitting.');
      assert(
        edit.parts.every((part) => nonempty(part) && [...part].length <= 500),
        'Each thread part needs 1–500 characters.',
      );
      if (source.draft_id && edit.auto_plug)
        assert(
          edit.auto_plug.content === edit.auto_plug.content.trim(),
          'Threadify trims the outside whitespace of Auto Plug replies. Remove that whitespace yourself before submitting; internal spacing stays unchanged.',
        );
    }
  }
}

export async function saveBrowserReview(root, sessionRoot, revision, edits, submit = false) {
  const current = await readState(sessionRoot);
  const session = current.payload;
  assert(session?.schema_version === 'creator-browser-review.v1', 'Unknown editor session.');
  // A repeated response-loss retry returns the durable original, never a second intent.
  if (session.status === 'submitted' && submit && equal(session.edits, edits)) return current;
  assert(session.status === 'editing', 'This review is already submitted and locked.');
  validateEdits(session, edits, submit);
  if (submit) {
    await assertSourceUnchanged(root, session);
    assert(
      session.automation.global_repost.known || session.entries.every((e) => !e.content.draft_id),
      'Check account-wide Auto Repost before approving a connected schedule. Your edits remain saved.',
    );
  }
  return updateState(sessionRoot, revision, (data) => {
    assert(data.status === 'editing', 'This review is already submitted.');
    data.edits = structuredClone(edits);
    if (submit) {
      const body = {
        schema_version: 'creator-browser-submission.v1',
        session_id: data.id,
        plan_id: data.plan_id,
        action: data.entries.every((e) => !e.content.draft_id) ? 'local_handoff' : 'schedule',
        at: new Date().toISOString(),
        automation: data.automation,
        entries: data.entries.map((entry, i) => ({
          review_id: entry.review_id,
          base_hash: entry.base_hash,
          content: {
            ...entry.content,
            parts: edits[i].parts,
            auto_plug: edits[i].auto_plug,
            auto_repost: edits[i].auto_repost,
            automation_context: data.automation.global_repost,
          },
        })),
      };
      data.submission = { ...body, hash: reviewHash(body) };
      data.status = 'submitted';
    }
    return data;
  });
}

export async function browserReviewStatus(root, sessionRoot) {
  const saved = await readState(sessionRoot);
  assert(saved.payload?.schema_version === 'creator-browser-review.v1', 'Unknown editor session.');
  const source = await readState(root);
  const delivery = (saved.payload.submission?.entries ?? []).map((entry) => {
    const card = source.payload?.reviews
      .find((r) => r.id === entry.review_id)
      ?.cards.find((c) => c.content.id === entry.content.id);
    return {
      id: entry.content.id,
      state: card && equal(card.content, entry.content) ? card.state : 'awaiting_host',
    };
  });
  return { revision: saved.revision, ...saved.payload, delivery, provider_writes_performed: false };
}

export async function waitForBrowserReview(root, sessionRoot, timeoutMs = 55000) {
  assert(
    Number.isSafeInteger(timeoutMs) && timeoutMs >= 0 && timeoutMs <= 60000,
    'Wait must be between 0 and 60000 ms.',
  );
  const deadline = Date.now() + timeoutMs;
  let state;
  do {
    state = await browserReviewStatus(root, sessionRoot);
    if (state.status === 'submitted' || Date.now() >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(250, deadline - Date.now())));
  } while (true);
  return { status: state.status, session_root: sessionRoot, submission: state.submission };
}

export async function recordBrowserHostNote(sessionRoot, revision, input) {
  assert(
    ['checking', 'blocked', 'finished'].includes(input.stage) &&
      nonempty(input.message) &&
      input.message.length <= 1000 &&
      nonempty(input.evidence_ref),
    'A short evidenced host status is required.',
  );
  return updateState(sessionRoot, revision, (session) => {
    assert(
      session?.schema_version === 'creator-browser-review.v1' && session.status === 'submitted',
      'Host status requires a submitted review.',
    );
    session.host_status = {
      stage: input.stage,
      message: input.message,
      evidence_ref: input.evidence_ref,
      at: new Date().toISOString(),
    };
    return session;
  });
}

export async function startBrowserReview({ root, input, onSubmit = () => {} }) {
  const created = input.session_root
    ? { sessionRoot: input.session_root }
    : await createBrowserReview(root, input);
  const { sessionRoot } = created;
  await browserReviewStatus(root, sessionRoot);
  const token = randomBytes(32).toString('hex');
  let origin;
  const assets = new Map([
    ['/', ['index.html', 'text/html; charset=utf-8']],
    ['/review.js', ['review.js', 'text/javascript; charset=utf-8']],
    ['/review.css', ['review.css', 'text/css; charset=utf-8']],
  ]);
  const server = createServer(async (request, response) => {
    const headers = {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Content-Security-Policy':
        "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' https:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    };
    const send = (code, value, type = 'application/json') => {
      response.writeHead(code, { ...headers, 'Content-Type': type });
      response.end(type === 'application/json' ? JSON.stringify(value) : value);
    };
    try {
      if (request.headers.host !== new URL(origin).host) return send(403, { error: 'Unexpected host.' });
      const asset = assets.get(request.url);
      if (request.method === 'GET' && asset)
        return send(200, await readFile(new URL(`./browser/${asset[0]}`, import.meta.url)), asset[1]);
      const supplied = request.headers.authorization?.replace(/^Bearer /, '') ?? '';
      if (supplied.length !== token.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(token)))
        return send(403, { error: 'Open the private editor link from your host.' });
      if (request.method === 'GET' && request.url === '/api/state')
        return send(200, await browserReviewStatus(root, sessionRoot));
      if (request.method !== 'POST' || !['/api/save', '/api/submit'].includes(request.url))
        return send(404, { error: 'Not found.' });
      if (request.headers.origin !== origin || request.headers['content-type'] !== 'application/json')
        return send(403, { error: 'Same-origin JSON required.' });
      let body = '';
      let bytes = 0;
      request.setEncoding('utf8');
      for await (const chunk of request) {
        bytes += Buffer.byteLength(chunk, 'utf8');
        if (bytes > 2_000_000) {
          send(413, { error: 'Review exceeds 2 MB.' });
          return;
        }
        body += chunk;
      }
      const inputBody = JSON.parse(body);
      assert(Object.keys(inputBody).sort().join(',') === 'edits,revision', 'Unexpected request fields.');
      const submit = request.url === '/api/submit';
      const state = await saveBrowserReview(root, sessionRoot, inputBody.revision, inputBody.edits, submit);
      send(200, { revision: state.revision, status: state.payload.status });
      if (submit)
        onSubmit({
          action: 'browser_review_submitted',
          session_root: sessionRoot,
          hash: state.payload.submission.hash,
        });
    } catch (error) {
      send(409, { error: error.message });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
  return { server, sessionRoot, url: `${origin}/#${token}` };
}
