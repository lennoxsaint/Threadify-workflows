import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  applyGrowthLoopScan,
  beginGrowthLoopSave,
  configureGrowthLoopRunner,
  createGrowthLoopWorkspace,
  displayGrowthLoopHypotheses,
  displayGrowthLoopRun,
  growthLoopStatus,
  prepareGrowthLoopDay,
  reconcileGrowthLoopSave,
  setGrowthLoopPaused,
} from './growth-loop.mjs';
import { readGrowthLoopState, updateGrowthLoopState } from './growth-loop-store.mjs';

function parse(argv) {
  const [command, ...rest] = argv;
  const options = { command };
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (!['--state', '--input', '--revision', '--date'].includes(flag) || value === undefined) {
      throw new Error('usage: growth-loop <setup|status> --state PATH [--input PATH --revision N]');
    }
    options[flag.slice(2)] = value;
  }
  if (!options.state) throw new Error('--state is required.');
  if (options.revision !== undefined && !/^\d+$/.test(options.revision)) throw new Error('--revision must be a non-negative integer.');
  return options;
}

function readInput(file) {
  if (!file) throw new Error('--input is required.');
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

export async function growthLoopMain(argv = process.argv.slice(2)) {
  const options = parse(argv);
  const stateRoot = path.resolve(options.state);
  if (options.command === 'setup') {
    if (options.revision === undefined) throw new Error('--revision is required for setup.');
    const input = readInput(options.input);
    const result = await updateGrowthLoopState(stateRoot, Number(options.revision), (current) => {
      if (current) throw new Error('Growth Loop is already set up.');
      return createGrowthLoopWorkspace(input);
    });
    return { revision: result.revision, status: growthLoopStatus(result.payload) };
  }
  if (options.command === 'status') {
    const current = await readGrowthLoopState(stateRoot);
    return { revision: current.revision, status: growthLoopStatus(current.payload) };
  }
  if (options.command === 'display-hypotheses') {
    const current = await readGrowthLoopState(stateRoot);
    return { revision: current.revision, ...displayGrowthLoopHypotheses(current.payload) };
  }
  if (options.command === 'display-run') {
    const current = await readGrowthLoopState(stateRoot);
    return { revision: current.revision, ...displayGrowthLoopRun(current.payload, options.date) };
  }
  if (options.command === 'scan') {
    if (options.revision === undefined) throw new Error('--revision is required for scan.');
    const input = readInput(options.input);
    let report;
    const result = await updateGrowthLoopState(stateRoot, Number(options.revision), (current) => {
      report = applyGrowthLoopScan(current, input);
      return current;
    });
    return { revision: result.revision, ...report };
  }
  if (['prepare-day', 'begin-save', 'reconcile-save'].includes(options.command)) {
    if (options.revision === undefined) throw new Error(`--revision is required for ${options.command}.`);
    const input = readInput(options.input);
    let report;
    const result = await updateGrowthLoopState(stateRoot, Number(options.revision), (current) => {
      if (options.command === 'prepare-day') report = { day: prepareGrowthLoopDay(current, input) };
      else if (options.command === 'begin-save') report = { operation: beginGrowthLoopSave(current, input) };
      else report = { receipt: reconcileGrowthLoopSave(current, input) };
      return current;
    });
    return { revision: result.revision, ...report };
  }
  if (options.command === 'configure-runner') {
    if (options.revision === undefined) throw new Error('--revision is required for configure-runner.');
    const input = readInput(options.input);
    let status;
    const result = await updateGrowthLoopState(stateRoot, Number(options.revision), (current) => {
      status = configureGrowthLoopRunner(current, input);
      return current;
    });
    return { revision: result.revision, status };
  }
  if (['pause', 'resume'].includes(options.command)) {
    if (options.revision === undefined) throw new Error(`--revision is required for ${options.command}.`);
    let status;
    const result = await updateGrowthLoopState(stateRoot, Number(options.revision), (current) => {
      status = setGrowthLoopPaused(current, options.command === 'pause');
      return current;
    });
    return { revision: result.revision, status };
  }
  throw new Error('usage: growth-loop <setup|status|scan|prepare-day|begin-save|reconcile-save|configure-runner|pause|resume|display-hypotheses|display-run> --state PATH');
}

const invokedPath = process.argv[1] ? fs.realpathSync(path.resolve(process.argv[1])) : null;
const modulePath = fs.realpathSync(fileURLToPath(import.meta.url));

if (invokedPath === modulePath) {
  growthLoopMain().then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
