// Network reads for Director Mode, kept apart from director-mode.mjs, which
// runs ffmpeg and whisper-cli. One rule for every bundled script: a file that
// talks to the network never starts processes, and the reverse.
//
// Openverse needs no key; the anonymous limit is 20 calls a minute and 200 a
// day, so calls are spaced and counted in <homeDir>/openverse/rate.json.
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const OPENVERSE = 'https://api.openverse.org/v1/audio/';
export const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/';
export const DEFAULT_MODEL = 'ggml-base.en.bin';
const USER_AGENT = 'threadify-director-mode/1.0';

function rateState(homeDir) {
  const file = path.join(homeDir, 'openverse', 'rate.json');
  let calls = [];
  try { calls = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* first call */ }
  return { file, calls: calls.filter((t) => Date.now() - t < 86_400_000) };
}

async function openverseGet(homeDir, url) {
  const state = rateState(homeDir);
  if (state.calls.length >= 190) throw new Error('Openverse daily budget reached (200/day anonymous); use cached sounds or try tomorrow');
  const wait = 3200 - (Date.now() - (state.calls[state.calls.length - 1] ?? 0));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  state.calls.push(Date.now());
  fs.mkdirSync(path.dirname(state.file), { recursive: true });
  fs.writeFileSync(state.file, JSON.stringify(state.calls));
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Openverse ${res.status} for ${url}`);
  return res;
}

/** One Openverse API call, parsed as JSON. */
export async function openverseJson(homeDir, url) {
  return (await openverseGet(homeDir, url)).json();
}

/** Save an Openverse audio file to `file` (the caller converts it). */
export async function openverseDownload(homeDir, url, file) {
  const res = await openverseGet(homeDir, url);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

/** Download a whisper.cpp speech model into <homeDir>/models (about 148 MB for the default). */
export async function downloadModel(homeDir, name = DEFAULT_MODEL) {
  if (!/^ggml-[\w.-]+\.bin$/.test(name)) throw new Error(`bad model name ${name} (expected ggml-<name>.bin)`);
  const target = path.join(homeDir, 'models', name);
  if (fs.existsSync(target)) return { model: target, downloaded: false };
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const res = await fetch(`${MODEL_URL}${name}`, { redirect: 'follow', headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok || !res.body) throw new Error(`model download failed: HTTP ${res.status} for ${name}`);
  const partial = `${target}.part`;
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(partial));
  fs.renameSync(partial, target);
  return { model: target, downloaded: true, bytes: fs.statSync(target).size };
}
