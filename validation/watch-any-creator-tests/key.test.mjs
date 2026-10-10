import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const cli = path.join(root, 'plugins/threadify/skills/threadify-watch-any-creator/scripts/scrapecreators-key.mjs');
const PASTE = 'sc_test_0123456789abcdefWXYZ';

function run(args, { home, input = '' }) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    input,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, THREADIFY_WORKFLOWS_HOME: home },
  });
  return { code: result.status, out: result.stdout, json: JSON.parse(result.stdout) };
}

function withHome(body) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'wac-sc-'));
  try {
    body(home);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}

test('save writes an owner-only curl header file and never prints the pasted value', () => withHome((home) => {
  assert.equal(run(['status'], { home }).json.status, 'missing');
  const saved = run(['save'], { home, input: `  ${PASTE}\n` });
  assert.deepEqual([saved.code, saved.json.status], [0, 'saved']);
  assert.ok(!saved.out.includes(PASTE), 'output never contains the pasted value');
  const file = saved.json.header_file;
  assert.equal(fs.readFileSync(file, 'utf8'), `x-api-key: ${PASTE}\n`, 'curl -H @file sends exactly this header');
  if (process.platform !== 'win32') assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  const status = run(['status'], { home });
  assert.deepEqual([status.json.status, status.json.header_file], ['saved', file]);
  assert.ok(!status.out.includes(PASTE));
}));

test('a bad paste is refused with a plain reason and nothing is written', () => withHome((home) => {
  const bad = run(['save'], { home, input: 'not a real paste\n' });
  assert.deepEqual([bad.code, bad.json.status], [1, 'not_saved']);
  assert.match(bad.json.problem, /spaces/);
  assert.equal(run(['status'], { home }).json.status, 'missing');
}));

test('balance reads the credit count, a rejected key and an unexpected reply', () => withHome((home) => {
  const ok = run(['balance'], { home, input: '{"success":true,"creditCount":100,"message":"You have 100 credits remaining."}\n200' });
  assert.deepEqual([ok.code, ok.json.status, ok.json.credits_remaining], [0, 'ok', 100]);
  const rejected = run(['balance'], { home, input: '{"message":"Unauthorized"}\n401' });
  assert.deepEqual([rejected.code, rejected.json.status], [1, 'rejected']);
  const broken = run(['balance'], { home, input: 'oops\n500' });
  assert.deepEqual([broken.code, broken.json.status, broken.json.http_status], [1, 'error', 500]);
}));
