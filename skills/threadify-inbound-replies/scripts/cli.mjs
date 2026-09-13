#!/usr/bin/env node
import fs from 'node:fs';
import { Store, normalizeAccount, editorSurface } from './store.mjs';
import { serve } from './server.mjs';
const [command, ...args] = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i += 2) {
  if (!args[i].startsWith('--') || args[i + 1] === undefined) throw new Error('Use --name value arguments');
  options[args[i].slice(2)] = args[i + 1];
}
try {
  const store = new Store(options.root);
  const packet = options.packet ? JSON.parse(fs.readFileSync(options.packet, 'utf8')) : null;
  const account = normalizeAccount(options.account || packet?.account || '');
  let result;
  if (command === 'serve') { const running = await serve(store, account, Number(options.port || 0)); console.log(JSON.stringify({ review_url: running.url, account })); }
  else {
    const methods = { configure: 'configure', context: 'context', import: 'import', drafts: 'drafts', edit: 'edit', decide: 'decide', 'prepare-send': 'prepare', 'record-send': 'recordSend', reconcile: 'reconcile', feedback: 'feedback', close: 'close' };
    if (command === 'receipt') result = store.receipt(account, options.batch);
    else if (command === 'status') result = store.status(account, options.batch);
    else if (command === 'window') result = store.window(account, options);
    else if (command === 'surface') result = { surface: editorSurface(packet?.capabilities) };
    else if (methods[command]) { if (!packet) throw new Error('--packet is required'); if (normalizeAccount(packet.account) !== account) throw new Error('account_mismatch'); result = store[methods[command]](packet); }
    else throw new Error('Commands: configure window import context drafts serve status edit decide prepare-send record-send reconcile feedback close receipt surface');
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) { console.error(JSON.stringify({ error: error.message })); process.exitCode = 1; }
