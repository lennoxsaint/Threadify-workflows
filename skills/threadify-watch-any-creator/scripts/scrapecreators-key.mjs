#!/usr/bin/env node
// Watch Any Creator: one-time ScrapeCreators setup that keeps the owner's
// API key out of the chat, every command line and every output.
//
//   node scrapecreators-key.mjs save      hidden prompt in a terminal (or stdin), saves the header file
//   node scrapecreators-key.mjs status    whether the header file exists, and its path
//   node scrapecreators-key.mjs balance   reads `curl -s -w '\n%{http_code}' -H @<file> .../credit-balance` on stdin
//
// The pasted value is written once as an `x-api-key: ...` line to
// ~/.threadify-workflows/secrets/scrapecreators.header with owner-only
// permissions. This script never opens that file again: curl sends it with
// `-H @<file>`, and `balance` only parses ScrapeCreators' reply.
// Output is JSON on stdout. Exit 0 when the step may continue, 1 otherwise.
// Node 18+, no dependencies, no network.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const SIGNUP_URL = 'https://app.scrapecreators.com';
const stateRoot = () => process.env.THREADIFY_WORKFLOWS_HOME || path.join(os.homedir(), '.threadify-workflows');
export const headerFile = () => path.join(stateRoot(), 'secrets', 'scrapecreators.header');

/** The pasted value, trimmed; a pasted header prefix or quotes are tolerated. */
export function cleanPaste(raw) {
  const value = String(raw ?? '').trim().replace(/^x-api-key:\s*/i, '').replace(/^["']|["']$/g, '').trim();
  if (!value) return { problem: 'nothing was pasted' };
  if (/\s/.test(value)) return { problem: 'what was pasted has spaces in it; copy it again from the ScrapeCreators dashboard' };
  if (value.length < 16) return { problem: 'that is too short to be a ScrapeCreators API key; copy it again from the dashboard' };
  return { value };
}

export function status() {
  const file = headerFile();
  return fs.existsSync(file)
    ? { status: 'saved', header_file: file }
    : { status: 'missing', header_file: null, signup: SIGNUP_URL };
}

export function save(raw) {
  const { value, problem } = cleanPaste(raw);
  if (problem) return { status: 'not_saved', problem };
  const file = headerFile();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, `x-api-key: ${value}\n`, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  return { status: 'saved', header_file: file };
}

/** ScrapeCreators' credit-balance reply (body, then the HTTP code on the last line). The call is free. */
export function balance(reply) {
  const lines = String(reply ?? '').trimEnd().split('\n');
  const code = Number(lines.pop());
  let body = {};
  try { body = JSON.parse(lines.join('\n') || '{}'); } catch { body = {}; }
  if (code === 401 || code === 403) {
    return { status: 'rejected', http_status: code, problem: 'ScrapeCreators did not accept this API key; copy it again from the dashboard and run save again' };
  }
  if (code !== 200) return { status: 'error', http_status: Number.isFinite(code) ? code : null, problem: body.message ?? 'unexpected reply' };
  const credits = Number.isFinite(body.creditCount) ? body.creditCount : Number.isFinite(body.credits_remaining) ? body.credits_remaining : null;
  if (credits === null) return { status: 'error', http_status: code, problem: 'the reply had no credit count' };
  return { status: 'ok', credits_remaining: credits };
}

async function readHidden(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: true });
  process.stderr.write(prompt);
  rl._writeToOutput = () => {}; // keep the paste off the screen
  const answer = await new Promise((resolve) => rl.question('', resolve));
  rl.close();
  process.stderr.write('\n');
  return answer;
}

async function readStdin() {
  let text = '';
  for await (const chunk of process.stdin) text += chunk;
  return text;
}

async function main(argv) {
  const command = argv[0];
  if (command === 'status') return status();
  if (command === 'save') {
    return save(process.stdin.isTTY
      ? await readHidden('Paste your ScrapeCreators API key (it stays hidden), then press Enter: ')
      : await readStdin());
  }
  if (command === 'balance') return balance(await readStdin());
  return { status: 'usage', usage: 'scrapecreators-key.mjs save|status|balance' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const result = await main(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = ['saved', 'ok'].includes(result.status) ? 0 : 1;
}
