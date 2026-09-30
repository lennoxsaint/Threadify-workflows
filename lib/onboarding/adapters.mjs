import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { CLIENTS } from './setup.mjs';
import { reviewHash } from '../creator/review.mjs';

const commands = { codex: 'codex', claude: 'claude', cursor: 'cursor-agent', gemini: 'gemini', openclaw: 'openclaw', hermes: 'hermes' };
export function probeSetupClient(client, env = process.env) {
  if (!CLIENTS.includes(client)) throw new Error('Unsupported client.');
  const name = commands[client];
  const candidates = (env.PATH ?? '').split(path.delimiter).filter(Boolean).map((dir) => path.join(dir, name));
  const executable = candidates.find((p) => { try { fs.accessSync(p, fs.constants.X_OK); return fs.statSync(p).isFile(); } catch { return false; } });
  if (!executable) return { client, installed: false, native_discovery: 'unverified', connection: 'unverified', routine: 'unverified' };
  const version = spawnSync(executable, ['--version'], { encoding: 'utf8', timeout: 10_000, env, maxBuffer: 16_384 });
  return { client, executable, installed: version.status === 0, version: version.status === 0 ? version.stdout.trim().slice(0, 300) : null,
    native_discovery: 'unverified', connection: 'unverified', routine: 'unverified',
    next: 'Use actual native skill discovery and account-scoped read tools; installation alone does not verify either.' };
}

/** Build a reviewable command without registering anything. Native registration
 * belongs to the host's supported controls; no private config-file forgery.
 */
export function routineProposal(input) {
  if (!CLIENTS.includes(input.client) || !path.isAbsolute(input.setup_root ?? '') || !path.isAbsolute(input.executable ?? '')) throw new Error('Client and absolute private state/executable required.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time ?? '')) throw new Error('Daily HH:MM time required.');
  new Intl.DateTimeFormat('en', { timeZone: input.timezone });
  const prompt = `Resume my Threadify setup at ${input.setup_root}. Read status and stop if paused. Verify the explicit account, entitlement, current facts, allowance and Calendar. Persist begin-run before work; never overlap an unresolved run. Fill only missing slots in the next seven local days using the saved permission and creator records. Reviewed mode prepares drafts for approval; automatic mode uses authorize-from-setup, validates and schedules with exact readback. Never publish immediately or send replies. Reconcile unknowns, then finish-run with observed evidence. Report blockers or review work. Never call fixtures live proof.`;
  const args = input.client === 'codex' ? ['exec', prompt]
    : ['claude', 'cursor', 'gemini'].includes(input.client) ? ['-p', prompt] : null;
  const plan = { client: input.client, setup_root: input.setup_root, executable: input.executable,
    time: input.time, timezone: input.timezone, prompt, args, registered: false,
    native_preferred: true, os_schedule_supported: args !== null,
    next: args ? 'Prefer native controls. If unavailable, show this exact command and obtain OS-schedule consent; verify unattended MCP access before registration.' : 'Use the native gateway cron controls; verify scheduler heartbeat, configuration and run history.',
    device_must_stay_on: true, limits: 'No skip-permissions flags. A proposal is not a saved job or a successful run.' };
  return { ...plan, confirmation_hash: reviewHash(plan) };
}
