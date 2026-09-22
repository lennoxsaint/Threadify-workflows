import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createBudget } from '../../lib/reply-first-provider.mjs';
import { replyFirstMain } from '../../lib/reply-first-cli.mjs';

async function state(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'reply-first-security-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

async function stoppedPid() {
  const child = spawn(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'ignore' });
  const pid = child.pid;
  await once(child, 'exit');
  assert.throws(() => process.kill(pid, 0), error => error?.code === 'ESRCH');
  return pid;
}

const perthDay = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Australia/Perth', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

test('budget recovers only an exact dead local owner and preserves prior charges', async t => {
  const directory = await state(t);
  const file = path.join(directory, 'budget.json');
  const existing = { id: 'unknown-cost', charged: 0.4, status: 'cost_unknown_reservation_retained' };
  await fs.writeFile(file, JSON.stringify({ days: { [perthDay()]: [existing] } }));
  const stale = { pid: await stoppedPid(), hostname: os.hostname(), started_at: '2026-09-22T00:00:00.000Z' };
  await fs.writeFile(`${file}.lock`, JSON.stringify(stale));
  // Exact crash boundary: the old owner created its recovery guard, then died
  // before it could archive the primary lock or enter the ledger transaction.
  await fs.writeFile(`${file}.lock.recovery`, JSON.stringify(stale));

  const ticket = await createBudget({ file, cap: 1, reservation: 0.5 }).reserve();
  const ledger = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.deepEqual(ledger.days[perthDay()][0], existing);
  assert.equal(ledger.days[perthDay()].reduce((total, entry) => total + entry.charged, 0), 0.9);
  assert.equal(ticket.day, perthDay());
  assert.equal((await fs.readdir(directory)).filter(name => name.startsWith('budget.json.lock.recovered-')).length, 1);
  assert.equal((await fs.readdir(directory)).filter(name => name.startsWith('budget.json.lock.recovery.recovered-')).length, 1);
  await assert.rejects(fs.access(`${file}.lock`), error => error?.code === 'ENOENT');
  await assert.rejects(fs.access(`${file}.lock.recovery`), error => error?.code === 'ENOENT');
});

test('budget never recovers unknown-host or live-owner locks', async t => {
  const directory = await state(t);
  const locks = [
    { name: 'unknown', owner: { pid: process.pid, hostname: 'unknown.example', started_at: new Date().toISOString() } },
    { name: 'live', owner: { pid: process.pid, hostname: os.hostname(), started_at: new Date().toISOString() } },
  ];
  for (const { name, owner } of locks) {
    await fs.writeFile(path.join(directory, `${name}.json.lock`), JSON.stringify(owner));
  }

  const attempts = await Promise.allSettled(locks.map(({ name }) =>
    createBudget({ file: path.join(directory, `${name}.json`) }).reserve()));
  for (const [index, result] of attempts.entries()) {
    assert.equal(result.status, 'rejected');
    assert.match(result.reason.message, /budget_lock_unavailable/);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(directory, `${locks[index].name}.json.lock`), 'utf8')), locks[index].owner);
  }
});

test('CLI ignores ambient Vercel OIDC and requires the explicit gateway key', async t => {
  const directory = await state(t);
  const priorGateway = process.env.AI_GATEWAY_API_KEY;
  const priorOidc = process.env.VERCEL_OIDC_TOKEN;
  t.after(() => {
    if (priorGateway === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = priorGateway;
    if (priorOidc === undefined) delete process.env.VERCEL_OIDC_TOKEN;
    else process.env.VERCEL_OIDC_TOKEN = priorOidc;
  });
  delete process.env.AI_GATEWAY_API_KEY;
  process.env.VERCEL_OIDC_TOKEN = 'ambient-token-must-not-authorize';

  assert.deepEqual(await replyFirstMain(['doctor', '--privacy', 'non-zdr']), {
    status: 'blocked', error: 'provider_credential_missing', env: 'AI_GATEWAY_API_KEY',
  });
  await assert.rejects(
    replyFirstMain(['run', '--input', path.join(directory, 'unused.json'), '--state', directory, '--privacy', 'non-zdr']),
    /provider_credential_missing/,
  );
});
