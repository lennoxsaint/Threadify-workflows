import {
  beginActionAttempt,
  createConversationWorkspace,
  decideAction,
  displayActionReview,
  groupQuestions,
  importConversationRecords,
  planFollowThrough,
  planNextActions,
  prepareAction,
  prepareReminder,
  recordActionReceipt,
  recordCommitment,
  recordOutcome,
  saveQuestionContent,
  summarizeWeeklyOutcomes,
  validateWorkspace,
} from './engine.mjs';
import { readConversationState, updateConversationState } from './store.mjs';

const READS = new Set(['status', 'next-actions', 'review', 'follow-through', 'questions-to-content', 'weekly-outcomes', 'reminder']);
const WRITES = new Set(['init', 'add-evidence', 'prepare-action', 'decide', 'begin-attempt', 'receipt', 'commit', 'outcome', 'save-content']);

function assertWorkspace(payload) {
  if (payload === null) throw new Error('Conversation workspace is not initialized.');
  validateWorkspace(payload);
  return payload;
}

function readResult(command, payload, input) {
  if (command === 'status') {
    if (payload === null) return { initialized: false };
    validateWorkspace(payload);
    return { initialized: true, schema_version: payload.schema_version, workspace_id: payload.id,
      account_id: payload.account_id, platform: payload.platform, timezone: payload.timezone,
      counts: Object.fromEntries(['offers', 'evidence', 'actions', 'commitments', 'outcomes', 'content', 'imports', 'receipts']
        .map((field) => [field, payload[field].length])),
      action_states: Object.fromEntries(payload.actions.map((action) => [action.id, action.state])) };
  }
  const workspace = assertWorkspace(payload);
  if (command === 'next-actions') return planNextActions(workspace, input);
  if (command === 'review') return displayActionReview(workspace, input.action_id);
  if (command === 'follow-through') return planFollowThrough(workspace, input);
  if (command === 'questions-to-content') return groupQuestions(workspace, input);
  if (command === 'weekly-outcomes') return summarizeWeeklyOutcomes(workspace, input);
  if (command === 'reminder') return prepareReminder(workspace, input);
  throw new Error(`unknown_conversation_command:${command}`);
}

function writeResult(command, payload, input) {
  if (command === 'init') {
    if (payload !== null) throw new Error('Conversation workspace is already initialized.');
    return createConversationWorkspace(input);
  }
  const workspace = assertWorkspace(payload);
  if (command === 'add-evidence') return importConversationRecords(workspace, input);
  if (command === 'prepare-action') return prepareAction(workspace, input);
  if (command === 'decide') return decideAction(workspace, input.displayed, input.decision);
  if (command === 'begin-attempt') return beginActionAttempt(workspace, input);
  if (command === 'receipt') return recordActionReceipt(workspace, input);
  if (command === 'commit') return recordCommitment(workspace, input);
  if (command === 'outcome') return recordOutcome(workspace, input);
  if (command === 'save-content') return saveQuestionContent(workspace, input);
  throw new Error(`unknown_conversation_command:${command}`);
}

export async function runConversationCommand(command, options) {
  if (!READS.has(command) && !WRITES.has(command)) throw new Error(`unknown_conversation_command:${command}`);
  if (READS.has(command)) {
    const state = await readConversationState(options.root);
    return { revision: state.revision, result: readResult(command, state.payload, options.input ?? {}) };
  }
  if (!Number.isSafeInteger(options.revision) || options.revision < 0) throw new Error('Conversation write requires an exact nonnegative revision.');
  let result;
  const state = await updateConversationState(options.root, options.revision, (payload) => {
    const next = writeResult(command, payload, options.input ?? {});
    result = next;
    return next;
  });
  return { revision: state.revision, result };
}

