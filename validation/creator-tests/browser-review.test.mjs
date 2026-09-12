import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, cp } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { updateState, readState } from '../../lib/creator/store.mjs';
import { createReviewPack, reviewHash, beginAttempt, reconcileAttempt } from '../../lib/creator/review.mjs';
import { runCreatorCommand } from '../../lib/creator/runtime.mjs';
import {
  createBrowserReview,
  saveBrowserReview,
  startBrowserReview,
  browserReviewStatus,
  waitForBrowserReview,
  recordBrowserHostNote,
} from '../../lib/creator/browser-review.mjs';

const now = '2030-01-01T00:00:00Z';
const automation = {
  available: true,
  global_repost: { known: true, enabled: false },
  checked_at: now,
  evidence_ref: 'synthetic-settings',
};
async function fixture(t, count = 1) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'creator-browser-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cards = Array.from({ length: count }, (_, i) => ({
    id: `post-${i}`,
    account_id: 'synthetic-account',
    timezone: 'Australia/Perth',
    scheduled_at: `2030-01-${String(i + 2).padStart(2, '0')}T09:00:00+08:00`,
    parts: [
      'one small thing, finished.\n\nthat is the whole plan for today.',
      'what are you finishing today?',
    ],
    media: [],
    source: { id: `source-${i}`, url: `https://example.com/${i}` },
    adaptation_mode: 'structure_only',
    method: 'host_authored',
    gaps: [],
    draft_id: `draft-${i}`,
    cta: 'none',
  }));
  await updateState(root, 0, () => ({
    schema_version: 'creator-workspace.v1',
    plans: [
      {
        id: 'plan',
        label: 'Week',
        days: cards.map((c) => ({ date: c.scheduled_at.slice(0, 10) })),
        preferences: { account_id: 'synthetic-account' },
      },
    ],
    reviews: cards.map((card, i) => ({
      ...createReviewPack({ id: `review-${i}`, cards: [card], now }),
      plan_id: 'plan',
      date: card.scheduled_at.slice(0, 10),
    })),
    setups: [],
    feedback: [],
  }));
  return root;
}
const approveAll = (session) => session.edits.map((edit) => ({ ...edit, reviewed: true }));

test('all standalone creator bundles serve the complete editor outside the source repository', async (t) => {
  const root = await fixture(t);
  for (const name of ['threadify-create-my-day', 'threadify-create-my-week', 'threadify-create-my-month', 'threadify-vault-setup']) {
    const target = path.join(root, 'isolated', name);
    await cp(new URL(`../../skills/${name}/`, import.meta.url), target, { recursive: true });
    const module = await import(pathToFileURL(path.join(target, 'scripts/engine/browser-review.mjs')).href);
    const editor = await module.startBrowserReview({ root, input: { plan_id: 'plan', automation } });
    try {
      const origin = new URL(editor.url).origin;
      assert.match(await (await fetch(origin)).text(), /Review your posts/);
      assert.match(await (await fetch(`${origin}/review.css`)).text(), /post-card/);
      assert.match(await (await fetch(`${origin}/review.js`)).text(), /renderSummary/);
      assert.match(await readFile(path.join(target, 'references/creator-browser-review.md'), 'utf8'), /deterministic/);
    } finally {
      await new Promise((resolve) => { editor.server.close(resolve); editor.server.closeAllConnections(); });
    }
  }
});

test('versioned browser schema accepts real Day, Week and Month sessions and exact submissions', async (t) => {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(
    JSON.parse(await readFile(new URL('../../schemas/creator-browser.v1.json', import.meta.url), 'utf8')),
  );
  for (const count of [1, 7, 28]) {
    const root = await fixture(t, count);
    const { sessionRoot, session } = await createBrowserReview(root, { plan_id: 'plan', automation });
    assert.ok(validate(session), JSON.stringify(validate.errors));
    const saved = await saveBrowserReview(root, sessionRoot, 1, approveAll(session), true);
    assert.ok(validate(saved.payload), JSON.stringify(validate.errors));
    assert.ok(validate(saved.payload.submission), JSON.stringify(validate.errors));
    const broken = structuredClone(saved.payload.submission);
    broken.entries[0].content.parts = [' '];
    assert.equal(validate(broken), false);
  }
});

test('host waits are bounded, notes never manufacture delivery, and unresolved attempts block new reviews', async (t) => {
  const root = await fixture(t);
  const { sessionRoot, session } = await createBrowserReview(root, { plan_id: 'plan', automation });
  assert.equal((await waitForBrowserReview(root, sessionRoot, 0)).status, 'editing');
  await assert.rejects(waitForBrowserReview(root, sessionRoot, 60001), /between/);
  await assert.rejects(
    recordBrowserHostNote(sessionRoot, 1, {
      stage: 'finished',
      message: 'Synthetic',
      evidence_ref: 'synthetic',
    }),
    /submitted review/,
  );
  await saveBrowserReview(root, sessionRoot, 1, approveAll(session), true);
  assert.equal((await waitForBrowserReview(root, sessionRoot, 0)).status, 'submitted');
  await recordBrowserHostNote(sessionRoot, 2, {
    stage: 'finished',
    message: 'Synthetic note',
    evidence_ref: 'synthetic',
  });
  assert.equal((await browserReviewStatus(root, sessionRoot)).delivery[0].state, 'awaiting_host');
  await updateState(root, 1, (data) => {
    data.reviews[0].cards[0].state = 'unknown';
    return data;
  });
  await assert.rejects(createBrowserReview(root, { plan_id: 'plan', automation }), /Reconcile unresolved/);
});

test('exact whitespace and emoji survive save, restart, submit and atomic approval; duplicate submit is idempotent', async (t) => {
  const root = await fixture(t, 2);
  const { sessionRoot, session } = await createBrowserReview(root, { plan_id: 'plan', automation });
  const edits = approveAll(session);
  edits[0].parts[0] = '  hello 🧑🏽‍💻\n\nline two  \n';
  await saveBrowserReview(root, sessionRoot, 1, edits);
  await assert.rejects(saveBrowserReview(root, sessionRoot, 1, edits), /revision changed/);
  const submitted = await saveBrowserReview(root, sessionRoot, 2, edits, true);
  assert.equal((await saveBrowserReview(root, sessionRoot, 2, edits, true)).revision, submitted.revision);
  assert.equal(
    (await browserReviewStatus(root, sessionRoot)).submission.entries[0].content.parts[0],
    edits[0].parts[0],
  );
  await runCreatorCommand('apply-browser-review', {
    root,
    revision: 1,
    input: { session_root: sessionRoot, now },
  });
  const state = await readState(root);
  assert.equal(state.payload.reviews[0].cards[0].content.parts[0], edits[0].parts[0]);
  assert.ok(state.payload.reviews.every((r) => r.cards[0].state === 'approved'));
  assert.ok(state.payload.reviews.every((r) => r.cards[0].attempts.length === 0));
  await assert.rejects(
    runCreatorCommand('apply-browser-review', {
      root,
      revision: 2,
      input: { session_root: sessionRoot, now },
    }),
    /Source changed/,
  );
});

test('submission refuses unreviewed, oversized, blank, missing and reordered parts without losing saved drafts', async (t) => {
  const root = await fixture(t, 2);
  const { sessionRoot, session } = await createBrowserReview(root, { plan_id: 'plan', automation });
  const edits = approveAll(session);
  for (const change of [
    (e) => {
      e[0].reviewed = false;
    },
    (e) => {
      e[0].parts[0] = 'x'.repeat(501);
    },
    (e) => {
      e[0].parts[0] = ' ';
    },
    (e) => {
      e[0].parts.pop();
    },
    (e) => e.reverse(),
  ]) {
    const bad = structuredClone(edits);
    change(bad);
    await assert.rejects(saveBrowserReview(root, sessionRoot, 1, bad, true));
    assert.equal((await readState(sessionRoot)).revision, 1);
  }
  const blank = structuredClone(edits);
  blank[0].parts[0] = '';
  await saveBrowserReview(root, sessionRoot, 1, blank);
  assert.equal((await readState(sessionRoot)).payload.edits[0].parts[0], '');
});

test('source drift blocks submit and drift after submit blocks applying approval atomically', async (t) => {
  for (const beforeSubmit of [true, false]) {
    const root = await fixture(t);
    const { sessionRoot, session } = await createBrowserReview(root, { plan_id: 'plan', automation });
    if (!beforeSubmit) await saveBrowserReview(root, sessionRoot, 1, approveAll(session), true);
    await updateState(root, 1, (data) => {
      data.reviews[0].cards[0].content.parts[0] = 'A newer owner edit';
      return data;
    });
    if (beforeSubmit)
      await assert.rejects(
        saveBrowserReview(root, sessionRoot, 1, approveAll(session), true),
        /changed outside/,
      );
    else
      await assert.rejects(
        runCreatorCommand('apply-browser-review', {
          root,
          revision: 2,
          input: { session_root: sessionRoot, now },
        }),
        /Source changed/,
      );
    assert.equal((await readState(root)).payload.reviews[0].cards[0].content.parts[0], 'A newer owner edit');
  }
});

test('automation is exact, entitlement gated and global-aware', async (t) => {
  for (const settings of [
    { ...automation, available: false },
    { ...automation, global_repost: { known: true, enabled: true, trigger: 'time', delay_minutes: 480 } },
  ]) {
    const root = await fixture(t);
    const { sessionRoot, session } = await createBrowserReview(root, {
      plan_id: 'plan',
      automation: settings,
    });
    const edits = approveAll(session);
    edits[0].auto_repost = { trigger: 'time', delay_minutes: 720 };
    await assert.rejects(saveBrowserReview(root, sessionRoot, 1, edits, true), /unavailable|overrides/);
  }
  const root = await fixture(t);
  const { sessionRoot, session } = await createBrowserReview(root, { plan_id: 'plan', automation });
  const edits = approveAll(session);
  edits[0].auto_plug = { content: '  exact plug\n', trigger: 'time', delay_minutes: 15 };
  await assert.rejects(saveBrowserReview(root, sessionRoot, 1, edits, true), /outside whitespace/);
  edits[0].auto_plug.content = 'exact plug\n\ninternal spacing';
  const result = await saveBrowserReview(root, sessionRoot, 1, edits, true);
  assert.deepEqual(result.payload.submission.entries[0].content.auto_plug, edits[0].auto_plug);
});

test('browser approval cannot schedule without matching fresh automation evidence and exact receipt', async (t) => {
  const root = await fixture(t);
  const { sessionRoot, session } = await createBrowserReview(root, { plan_id: 'plan', automation });
  await saveBrowserReview(root, sessionRoot, 1, approveAll(session), true);
  await runCreatorCommand('apply-browser-review', {
    root,
    revision: 1,
    input: { session_root: sessionRoot, now },
  });
  const pack = (await readState(root)).payload.reviews[0];
  const c = pack.cards[0].content;
  const preflight = {
    card_hash: reviewHash(c),
    account_id: c.account_id,
    timezone: c.timezone,
    facts: true,
    offers: true,
    source_availability: true,
    validation: true,
    calendar: true,
    timezone_offset: true,
    evidence_ref: 'synthetic',
    checked_at: now,
    valid_until: '2030-01-01T00:05:00Z',
    occupied_instants: [],
  };
  assert.throws(() => beginAttempt(pack, c.id, preflight, now), /automation settings/);
  preflight.automation_verified = true;
  preflight.automation = { auto_plug: null, auto_repost: null, global_repost: automation.global_repost };
  const pending = beginAttempt(pack, c.id, preflight, now);
  const receipt = {
    status: 'scheduled',
    authoritative: true,
    checked_at: now,
    evidence_ref: 'synthetic',
    provider_ref: 'schedule',
    account_id: c.account_id,
    draft_id: c.draft_id,
    parts: c.parts,
    media: [],
    scheduled_at: c.scheduled_at,
  };
  assert.throws(() => reconcileAttempt(pending, c.id, receipt), /automation settings/);
  assert.equal(
    reconcileAttempt(pending, c.id, {
      ...receipt,
      automation_verified: true,
      automation: preflight.automation,
    }).cards[0].state,
    'scheduled',
  );
});

test('HTTP serves only allowlisted assets, denies missing token, hostile origins and DNS rebinding', async (t) => {
  const root = await fixture(t);
  const running = await startBrowserReview({ root, input: { plan_id: 'plan', automation } });
  t.after(
    () =>
      new Promise((resolve) => {
        running.server.close(resolve);
        running.server.closeAllConnections();
      }),
  );
  const url = new URL(running.url);
  const headers = { Authorization: `Bearer ${url.hash.slice(1)}` };
  assert.equal((await fetch(url.origin)).status, 200);
  assert.equal((await fetch(`${url.origin}/api/state`)).status, 403);
  assert.equal((await fetch(`${url.origin}/state.json`, { headers })).status, 404);
  const state = await (await fetch(`${url.origin}/api/state`, { headers })).json();
  assert.equal(state.entries.length, 1);
  assert.equal(
    (
      await fetch(`${url.origin}/api/submit`, {
        method: 'POST',
        headers: { ...headers, Origin: 'https://evil.example', 'Content-Type': 'application/json' },
        body: '{}',
      })
    ).status,
    403,
  );
  const status = await new Promise((resolve, reject) => {
    const request = http.get(
      `${url.origin}/api/state`,
      { headers: { ...headers, Host: 'evil.example' } },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      },
    );
    request.on('error', reject);
  });
  assert.equal(status, 403);
  const edits = approveAll(state);
  edits[0].parts[0] = '🧑🏽‍💻  exact\n\nformat';
  assert.equal(
    (
      await fetch(`${url.origin}/api/save`, {
        method: 'POST',
        headers: { ...headers, Origin: url.origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision: state.revision, edits }),
      })
    ).status,
    200,
  );
  assert.equal((await readState(running.sessionRoot)).payload.edits[0].parts[0], edits[0].parts[0]);
});
