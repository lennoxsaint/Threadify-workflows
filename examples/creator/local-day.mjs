// Synthetic offline walkthrough. No network calls, approval, scheduling or publication.
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runCreatorCommand } from '../../lib/creator/runtime.mjs';

const horizon = process.argv[2] ?? 'day';
if (!['day', 'week', 'month'].includes(horizon)) throw new Error('Choose day, week or month.');
const root = await mkdtemp(path.join(os.tmpdir(), 'threadify-synthetic-demo-'));
const now = '2026-09-07T00:00:00Z'; // Fixed example clock, not fresh provider evidence.
const lessons = [
  'Start a draft with one question your reader already asks. Answer it before adding background.',
  'Read a draft aloud. Mark the sentence where you run out of breath. Split it there.',
  'A useful example has a before and an after. Show the changed sentence, not just the advice.',
  'Try removing the opening paragraph. If the piece still makes sense, start with paragraph two.',
  'Save the sentence you cut in a scratch note. You can keep the idea without making this draft carry it.',
];
const planned = await runCreatorCommand('plan', { root, revision: 0, input: {
  id: 'synthetic-writing-plan', now, horizon, start_date: '2026-09-07',
  preferences: { account_id: 'synthetic-local-creator', timezone: 'UTC', times: ['09:00', '11:00', '13:00', '15:00', '17:00'] },
  // These are invented local source cards, not imported My Vault records.
  // Using one lane demonstrates explicit substitutions when other lanes are absent.
  sources: Array.from({ length: 140 }, (_, i) => ({ id: `synthetic-source-${i}`, url: `https://example.invalid/writing/${i}`,
    lane: 'my_vault', topic: `Synthetic writing lesson ${i + 1}`, qualified: true, relevance: 1,
    evidence_ref: 'synthetic-fixture-only', available_until: '2026-11-01T00:00:00Z' })),
} });
const day = planned.result.days[0];
const review = await runCreatorCommand('add-review', { root, revision: planned.revision, input: {
  id: 'synthetic-day-one', plan_id: planned.result.id, date: day.date, now,
  cards: day.slots.map((slot, index) => ({
    id: slot.id, account_id: planned.result.preferences.account_id, timezone: slot.timezone,
    scheduled_at: `${slot.local_date}T${slot.local_time}:00Z`, parts: [lessons[index]], media: [],
    source: { id: slot.source_id, url: slot.source_url }, adaptation_mode: 'structure_only', method: 'host_authored',
    format: slot.format, cta: 'none', draft_id: null,
    gaps: ['Synthetic local source; not fetched or saved in My Vault.', 'Brain, analytics, provider drafts and scheduling unavailable.'],
  })),
} });
const continuation = await runCreatorCommand('continue', { root, input: { plan_id: planned.result.id } });
const status = await runCreatorCommand('status', { root });
process.stdout.write(`${JSON.stringify({
  demonstration: 'synthetic_offline_review_only', clock: now, state_directory: root,
  note: 'State is retained in a newly created temporary directory for inspection. Nothing is approved, scheduled or published.',
  horizon_days: planned.result.days.length, blueprint: planned.result, review: review.result,
  continuation: continuation.result, status: status.result,
}, null, 2)}\n`);
