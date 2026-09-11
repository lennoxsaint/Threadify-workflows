// Synthetic fixture-driven walkthrough. No network, generation, send, approval
// or reminder is performed outside the private temporary state directory.
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reviewHash } from '../../lib/creator/review.mjs';
import { runConversationCommand } from '../../lib/conversations/runtime.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(await readFile(path.join(here, 'walkthrough.fixture.json'), 'utf8'));
const root = await mkdtemp(path.join(os.tmpdir(), 'threadify-conversations-synthetic-'));
let revision = 0;

async function write(command, input) {
  const result = await runConversationCommand(command, { root, revision, input });
  revision = result.revision;
  return result.result;
}

async function read(command, input = {}) {
  return (await runConversationCommand(command, { root, input })).result;
}

await write('init', fixture.init);
const beforeOffer = await read('next-actions');
await write('add-evidence', fixture.evidence_import);
const yourNextMoves = await read('next-actions');
await write('prepare-action', fixture.action);
const exactReview = await read('review', { action_id: fixture.action.id });
await write('decide', { displayed: exactReview, decision: fixture.decision });
await write('begin-attempt', fixture.attempt);
const pending = await read('status');

const pendingAction = (await import('../../lib/conversations/store.mjs')).readConversationState;
const pendingState = await pendingAction(root);
const action = pendingState.payload.actions.find((entry) => entry.id === fixture.action.id);
const attempt = action.attempts.at(-1);
await write('receipt', { action_id: action.id, receipt: {
  ...fixture.receipt,
  idempotency_key: attempt.idempotency_key,
  action_hash: attempt.action_hash,
  account_id: action.account_id,
  destination: action.destination,
  exact_text_sha256: reviewHash(action.exact_text),
} });

for (const commitment of fixture.commitments) await write('commit', commitment);
const followThroughBeforeOutcome = await read('follow-through', { now: fixture.weekly.as_of });
await write('outcome', fixture.outcome);
const followThroughAfterOutcome = await read('follow-through', { now: fixture.weekly.as_of });
const questionGroups = await read('questions-to-content', { offer_id: 'offer-main' });
await write('save-content', fixture.content);
const weeklyOutcomes = await read('weekly-outcomes', fixture.weekly);
const reminder = await read('reminder', { now: fixture.weekly.as_of });
const finalStatus = await read('status');

process.stdout.write(`${JSON.stringify({
  demonstration: 'synthetic_private_conversation_walkthrough',
  state_directory: root,
  proof_note: 'All provider evidence is synthetic and host supplied. The engine made no network call and created no reminder.',
  workflows: {
    your_next_moves: { before_offer: beforeOffer, after_evidence: yourNextMoves },
    agree_the_next_step: { exact_review: exactReview, pending_state: pending.action_states[action.id], final_state: finalStatus.action_states[action.id] },
    follow_through: { before_outcome: followThroughBeforeOutcome, after_outcome: followThroughAfterOutcome },
    questions_to_content: questionGroups,
    weekly_buyer_outcomes: weeklyOutcomes,
  },
  reminder,
  final_status: finalStatus,
}, null, 2)}\n`);
