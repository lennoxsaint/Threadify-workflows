import { prepareMarketContentBriefs } from './market-content.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  approveMarketAction, beginMarketActionAttempt, buildMarketPipeline, editMarketAction,
  reconcileMarketActionAttempt, saveMarketPipelineState, writeMarketPipelineArtifacts,
} from './market-to-pipeline.mjs';

function parse(argv) {
  const [command = 'help', ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (!value.startsWith('--')) throw new Error(`unknown_argument:${value}`);
    const key = value.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = rest[index + 1];
    if (!next || next.startsWith('--')) throw new Error(`missing_value:${value}`);
    options[key] = next;
    index += 1;
  }
  return { command, options };
}
function required(options, key) {
  if (!options[key]) throw new Error(`missing_option:--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`);
  return options[key];
}
function readJson(file) { return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')); }

export function marketToPipelineMain(argv) {
  const { command, options } = parse(argv);
  if (command === 'help') return { usage: [
    'market-to-pipeline briefs --input input.json',
    'market-to-pipeline build --input input.json --output-dir /absolute/private-directory',
    'market-to-pipeline status --state pipeline.private.json',
    'market-to-pipeline edit --state pipeline.private.json --action ACTION --text "exact text"',
    'market-to-pipeline approve --state pipeline.private.json --action ACTION --hash SHA256 --at ISO_TIME',
    'market-to-pipeline begin-attempt --state pipeline.private.json --action ACTION --hash SHA256 --attempt ID --at ISO_TIME --account-ref REF --account-verified-at ISO_TIME',
    'market-to-pipeline reconcile --state pipeline.private.json --action ACTION --attempt ID --status succeeded|confirmed_not_sent|unknown --at ISO_TIME --evidence-ref REF [--provider-ref REF]',
  ] };
  if (command === 'briefs') {
    return prepareMarketContentBriefs(readJson(required(options, 'input')));
  }
  if (command === 'build') {
    const state = buildMarketPipeline(readJson(required(options, 'input')));
    return { status: 'prepared_privately', ...writeMarketPipelineArtifacts(state, required(options, 'outputDir')) };
  }
  const file = required(options, 'state');
  const state = readJson(file);
  if (command === 'status') {
    return { run_id: state.run_id, status: state.status, coverage: state.coverage,
      actions: state.pipeline.map((entry) => ({ prospect_id: entry.prospect_id, action_id: entry.action.action_id,
        channel: entry.contact.channel, readiness: entry.readiness, action_state: entry.action.state,
        action_hash: entry.action.action_hash, exact_text: entry.action.exact_text })) };
  }
  let next;
  if (command === 'edit') next = editMarketAction(state, { action_id: required(options, 'action'), exact_text: required(options, 'text') });
  else if (command === 'approve') next = approveMarketAction(state, { action_id: required(options, 'action'),
    action_hash: required(options, 'hash'), approved_at: required(options, 'at') });
  else if (command === 'begin-attempt') next = beginMarketActionAttempt(state, { action_id: required(options, 'action'),
    action_hash: required(options, 'hash'), attempt_id: required(options, 'attempt'), started_at: required(options, 'at'),
    account_ref: required(options, 'accountRef'), account_verified_at: required(options, 'accountVerifiedAt') });
  else if (command === 'reconcile') next = reconcileMarketActionAttempt(state, { action_id: required(options, 'action'),
    attempt_id: required(options, 'attempt'), status: required(options, 'status'), checked_at: required(options, 'at'),
    provider_ref: options.providerRef ?? null, evidence_ref: required(options, 'evidenceRef') });
  else throw new Error(`unknown_market_to_pipeline_command:${command}`);
  saveMarketPipelineState(file, next);
  const prospect = next.pipeline.find((entry) => entry.action.action_id === options.action);
  return { status: 'state_updated', state_file: path.resolve(file), action_id: options.action,
    action_state: prospect.action.state, action_hash: prospect.action.action_hash };
}

if (process.argv[1]
  && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  try {
    process.stdout.write(`${JSON.stringify(marketToPipelineMain(process.argv.slice(2)), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ status: 'failed', error: String(error.message ?? error) }, null, 2)}\n`);
    process.exitCode = 1;
  }
}
