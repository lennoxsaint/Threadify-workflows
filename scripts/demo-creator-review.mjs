// Synthetic local-only UI demo. No provider credentials, calls or real posts.
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { updateState } from '../lib/creator/store.mjs';
import { createReviewPack } from '../lib/creator/review.mjs';
import { startBrowserReview } from '../lib/creator/browser-review.mjs';

const root = await mkdtemp(path.join(os.tmpdir(), 'threadify-review-demo-'));
const now = new Date().toISOString();
const reviews = Array.from({ length: 7 }, (_, i) => {
  const date = `2030-01-${String(i + 2).padStart(2, '0')}`;
  const card = {
    id: `synthetic-post-${i + 1}`,
    account_id: 'synthetic-alex',
    timezone: 'Australia/Perth',
    scheduled_at: `${date}T09:00:00+08:00`,
    parts:
      i === 0
        ? ['one small thing, finished.\n\nthat is the whole plan for today.', 'what are you finishing today?']
        : [`a small writing exercise for day ${i + 1}.\n\nwhat is one thing you would change?`],
    media: [],
    source: { id: `synthetic-source-${i + 1}`, url: `https://example.com/writing-${i + 1}` },
    adaptation_mode: 'structure_only',
    method: 'host_authored',
    cta: 'none',
    gaps: [],
    draft_id: null,
  };
  return {
    ...createReviewPack({ id: `synthetic-review-${i + 1}`, cards: [card], now }),
    plan_id: 'synthetic-week',
    date,
  };
});
await updateState(root, 0, () => ({
  schema_version: 'creator-workspace.v1',
  plans: [
    {
      id: 'synthetic-week',
      label: 'Week',
      preferences: { account_id: 'synthetic-alex' },
      days: reviews.map((r) => ({ date: r.date })),
    },
  ],
  reviews,
  feedback: [],
  setups: [],
}));
const editor = await startBrowserReview({
  root,
  input: {
    plan_id: 'synthetic-week',
    username: 'alex',
    automation: {
      available: true,
      global_repost: { known: true, enabled: false },
      checked_at: now,
      evidence_ref: 'synthetic-demo-only',
    },
  },
  onSubmit: (event) => process.stdout.write(`${JSON.stringify(event)}\n`),
});
process.stdout.write(
  `${JSON.stringify({ url: editor.url, state_root: root, session_root: editor.sessionRoot, synthetic: true })}\n`,
);
