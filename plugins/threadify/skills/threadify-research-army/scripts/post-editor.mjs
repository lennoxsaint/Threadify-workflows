#!/usr/bin/env node
// Research Army (adapted from What's Working's editable review): editable post
// blocks with a real Done editing button. Local owner editing only. This module
// has no Threadify or scheduling calls.
//
//   node post-editor.mjs --input drafts.json --output owner-review.json [--port 8051]
//   drafts.json: {"auto_plugs": false, "posts": [{"id": "post-1", "original": "<Threadify's exact text>"}]}
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkPost } from './casing-guard.mjs';

const hash = text => createHash('sha256').update(text).digest('hex');
const nonempty = text => typeof text === 'string' && text.trim().length > 0;

function prepare(input) {
  if (!Array.isArray(input?.posts) || input.posts.length < 1 || input.posts.length > 3) throw new Error('Prepare one to three posts.');
  const ids = new Set();
  return input.posts.map(post => {
    if (!nonempty(post.id) || ids.has(post.id) || !nonempty(post.original)) throw new Error('Distinct post references and preserved originals required.');
    ids.add(post.id);
    const final = post.final ?? post.original;
    if (!nonempty(final) || [...final].length > 500) throw new Error('Each post needs 1–500 characters.');
    const mode = post.mode ?? 'unchanged';
    if (mode === 'unchanged' && post.original !== final) throw new Error('Initial wording changed without a request.');
    if (mode === 'lowercase' && (!nonempty(post.owner_request) || checkPost({ ...post, final }).status !== 'PASS')) throw new Error('Initial casing needs its request and guard.');
    if (mode === 'owner-requested edit' && !nonempty(post.owner_request)) throw new Error('Initial edit needs its owner request.');
    if (!['unchanged', 'lowercase', 'owner-requested edit'].includes(mode)) throw new Error('Unknown editing mode.');
    return { id: post.id, original: post.original, initial: final, final, mode, owner_request: post.owner_request ?? null };
  });
}

export const editorHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Edit your post</title><style>
*{box-sizing:border-box}body{margin:0;background:#101010;color:#fff;font:18px/1.5 system-ui,sans-serif}main{max-width:1100px;margin:auto;padding:28px 20px 130px}h1{font-size:32px;margin:0}p{color:#bbb}article{background:#1c1c1c;border:1px solid #444;border-radius:12px;padding:18px;margin:22px 0}h2{font-size:23px;margin:0 0 12px}textarea{display:block;width:100%;min-height:300px;resize:vertical;background:#111;color:#fff;border:1px solid #666;border-radius:8px;padding:16px;font:19px/1.5 system-ui}textarea:focus{outline:2px solid #4ecdc4}small{color:#bbb}footer{position:fixed;bottom:0;width:100%;padding:16px;background:#171717;border-top:1px solid #555;display:flex;align-items:center;justify-content:center;gap:18px}button{font:700 18px system-ui;background:#4ecdc4;border:0;border-radius:8px;padding:14px 22px;cursor:pointer}button:disabled{opacity:.6}#status{max-width:520px;font-size:15px}@media(max-width:600px){footer{flex-direction:column;gap:8px}textarea{font-size:17px}}
</style></head><body><main><h1>Edit your post</h1><p>Type directly into the post. Done editing saves your final copy for the agent. Scheduling needs a separate yes.</p><label><input type="checkbox" id="plugs"> Include Auto Plugs (draft for review)</label><div id="posts"></div></main><footer><button id="done" disabled>Done editing</button><span id="status" role="status">Loading…</span></footer><script>
const root=document.querySelector('#posts'),status=document.querySelector('#status'),done=document.querySelector('#done');
let timer,queue=Promise.resolve(),revision=0,submitted=false,dirty=false;
const texts=()=>Array.from(document.querySelectorAll('textarea')).map(x=>x.value);
function save(finish=false){const current=++revision,payload={posts:texts(),done:finish,auto_plugs:document.querySelector('#plugs').checked};queue=queue.catch(()=>{}).then(async()=>{const r=await fetch('/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await r.json();if(!r.ok)throw Error(data.error||'Save failed. Keep this page open and try again.');if(current===revision){dirty=false;status.textContent=finish?'Saved for the agent. Scheduling still needs a separate yes.':'Saved on this computer';}return data;});return queue;}
fetch('/state').then(r=>{if(!r.ok)throw Error('Could not load the drafts');return r.json()}).then(data=>{data.posts.forEach((text,i)=>{const card=document.createElement('article'),h=document.createElement('h2'),t=document.createElement('textarea'),count=document.createElement('small');h.textContent=(data.ids&&data.ids[i]==='auto-plug')?'Auto Plug (posted as a reply 50 min after)':'Post '+(i+1);t.value=text;t.setAttribute('aria-label','Post '+(i+1));const update=()=>count.textContent=Array.from(t.value).length+' characters';update();t.addEventListener('input',()=>{dirty=true;update();status.textContent='Saving…';clearTimeout(timer);timer=setTimeout(()=>save().catch(e=>status.textContent=e.message),450);});card.append(h,t,count);root.append(card);});document.querySelector('#plugs').checked=data.auto_plugs;document.querySelector('#plugs').disabled=data.done;submitted=data.done;done.disabled=submitted;for(const t of document.querySelectorAll('textarea'))t.disabled=submitted;status.textContent=submitted?'Saved for the agent. Scheduling still needs a separate yes.':'Ready to edit';}).catch(e=>status.textContent=e.message);
document.querySelector('#plugs').addEventListener('change',()=>{dirty=true;status.textContent='Saving…';clearTimeout(timer);timer=setTimeout(()=>save().catch(e=>status.textContent=e.message),450);});
done.addEventListener('click',async()=>{clearTimeout(timer);done.disabled=true;document.querySelector('#plugs').disabled=true;for(const t of document.querySelectorAll('textarea'))t.disabled=true;try{await save(true);submitted=true;}catch(e){status.textContent=e.message;done.disabled=false;document.querySelector('#plugs').disabled=false;for(const t of document.querySelectorAll('textarea'))t.disabled=false;}});
window.addEventListener('beforeunload',e=>{if(!submitted&&dirty){e.preventDefault();e.returnValue='';}});
</script></body></html>`;

export async function createPostEditor(input, { output, port = 0 } = {}) {
  const originals = prepare(input);
  if (input.auto_plugs !== undefined && typeof input.auto_plugs !== 'boolean') throw new Error('Auto Plugs need an explicit boolean choice.');
  if (!nonempty(output) || !Number.isInteger(port) || port < 0 || port > 65535) throw new Error('An output file and valid local port are required.');
  const file = path.resolve(output);
  const sourceHash = hash(JSON.stringify({ originals, auto_plugs: input.auto_plugs ?? false }));
  let state = { schema_version: 'research-army-owner-review.v1', source_sha256: sourceHash, status: 'editing', posts: originals, auto_plugs: input.auto_plugs ?? false, approval: null };
  try {
    const saved = JSON.parse(await readFile(file, 'utf8'));
    if (saved.source_sha256 !== sourceHash || saved.schema_version !== state.schema_version) throw new Error('Existing review belongs to different originals. Use a new output file.');
    if (typeof saved.auto_plugs !== 'boolean' || !Array.isArray(saved.posts) || saved.posts.length !== originals.length || saved.posts.some((p, i) => p.id !== originals[i].id || p.original !== originals[i].original || p.initial !== originals[i].initial || !nonempty(p.final) || [...p.final].length > 500)) throw new Error('Preserved review originals changed. Use a new output file.');
    if (saved.status !== 'editing') throw new Error('This review is already completed. Use a new output file for another revision.');
    state = saved;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
  let completed;
  const done = new Promise(resolve => { completed = resolve; });
  let writes = Promise.resolve();
  const reply = (res, code, data, type = 'application/json') => {
    res.writeHead(code, { 'Content-Type': type + '; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(typeof data === 'string' ? data : JSON.stringify(data));
  };
  const server = createServer(async (req, res) => {
    const address = server.address();
    const hosts = [`127.0.0.1:${address.port}`, `localhost:${address.port}`];
    if (!hosts.includes(req.headers.host)) return reply(res, 403, { error: 'Use the local editor address.' });
    if (req.method === 'GET' && req.url === '/') return reply(res, 200, editorHtml, 'text/html');
    if (req.method === 'GET' && req.url === '/state') return reply(res, 200, { posts: state.posts.map(p => p.final), ids: state.posts.map(p => p.id), done: state.status === 'done', auto_plugs: state.auto_plugs });
    if (req.method !== 'POST' || req.url !== '/save') return reply(res, 404, { error: 'Not found' });
    if (!hosts.map(h => 'http://' + h).includes(req.headers.origin) || req.headers['content-type'] !== 'application/json') return reply(res, 403, { error: 'Save from the local editor.' });
    try {
      let raw = ''; for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 30000) throw new Error('Review request too large.'); }
      const body = JSON.parse(raw);
      if (Object.keys(body).some(fieldName => !['posts', 'done', 'auto_plugs'].includes(fieldName)) || typeof body.auto_plugs !== 'boolean' || typeof body.done !== 'boolean' || !Array.isArray(body.posts) || body.posts.length !== originals.length || body.posts.some(text => !nonempty(text) || [...text].length > 500)) throw new Error('Keep every post filled in with 1–500 characters.');
      const operation = writes.catch(() => {}).then(async () => {
        if (state.status === 'done') throw new Error('This review is completed. Reopen a new review to change it.');
        const next = { ...state, status: body.done ? 'done' : 'editing', updated_at: new Date().toISOString(), auto_plugs: body.auto_plugs, approval: null,
          posts: state.posts.map((post, i) => ({ ...post, final: body.posts[i] })) };
        if (body.done) {
          next.completed_at = next.updated_at;
          next.posts = next.posts.map(post => ({ ...post, changed: post.initial !== post.final,
            mode: post.initial !== post.final ? 'owner-requested edit' : post.mode,
            owner_request: post.initial !== post.final ? 'Owner edited this post in editable text blocks and clicked Done editing.' : post.owner_request,
            original_sha256: hash(post.original), final_sha256: hash(post.final),
            comparison: { removed_lines: post.initial.split('\n').filter(line => !post.final.split('\n').includes(line)), added_lines: post.final.split('\n').filter(line => !post.initial.split('\n').includes(line)) } }));
        }
        await writeFile(file + '.next', JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
        await rename(file + '.next', file);
        state = next;
        return state;
      });
      writes = operation;
      const saved = await operation;
      reply(res, 200, { saved: true, done: saved.status === 'done' });
      if (saved.status === 'done') completed(structuredClone(saved));
    } catch (error) { reply(res, 400, { error: error.message }); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { url: `http://127.0.0.1:${server.address().port}/`, done, close: () => new Promise(resolve => server.close(resolve)) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    const value = name => args[args.indexOf(name) + 1];
    if (!args.includes('--input') || !args.includes('--output')) throw new Error('usage: post-editor.mjs --input drafts.json --output owner-review.json [--port 8048]');
    const input = JSON.parse(await readFile(value('--input'), 'utf8'));
    const editor = await createPostEditor(input, { output: value('--output'), port: args.includes('--port') ? Number(value('--port')) : 0 });
    process.stdout.write(JSON.stringify({ status: 'editing', url: editor.url, posts: input.posts.length }) + '\n');
    const receipt = await editor.done;
    process.stdout.write(JSON.stringify({ status: 'owner_review_done', posts: receipt.posts.length, changed_posts: receipt.posts.filter(p => p.changed).length }) + '\n');
    await editor.close();
  } catch (error) { process.stderr.write(JSON.stringify({ status: 'failed', error: error.message }) + '\n'); process.exitCode = 1; }
}
