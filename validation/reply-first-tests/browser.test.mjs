import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createReviewObserver} from '../../lib/reply-first-browser.mjs';
import {atomicJson,renderReplyFirst} from '../../lib/reply-first.mjs';

test('observer requires token, same-origin receipt, current generation and complete rendered card count',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'reply-observer-'));
  const observer=await createReviewObserver({stateDir:dir,timeoutMs:2000});
  t.after(async()=>{await observer.close();await fs.rm(dir,{recursive:true,force:true});});
  const origin=new URL(observer.url).origin;
  assert.equal((await fetch(origin+'/wrong')).status,404);
  assert.equal((await fetch(observer.url+'/ready',{method:'POST',body:'{}'})).status,403);
  const post=(route,body)=>fetch(observer.url+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
  await post('/ready',{});await observer.waitForBrowser();
  const result={rows:[],total:0,processed:0,status:'complete',model:'synthetic',source_mode:'synthetic',privacy:'none'};
  await atomicJson(path.join(dir,'result.json'),result);await fs.writeFile(path.join(dir,'review.html'),renderReplyFirst(result));
  const measured=observer.measureReview(path.join(dir,'review.html'));
  let id;for(let i=0;i<20&&!id;i++){id=(await(await fetch(observer.url+'/current')).json()).id;if(!id)await new Promise(r=>setTimeout(r,5));}
  assert.ok(id);assert.equal((await post('/observed',{id:'stale',cards:0,heading:'Reply first.',elapsed_ms:3})).status,409);
  assert.equal((await post('/observed',{id,cards:1,heading:'Reply first.',elapsed_ms:3})).status,409);
  assert.equal((await post('/observed',{id,cards:0,heading:'Reply first.',elapsed_ms:3})).status,204);
  const receipt=await measured;assert.equal(receipt.cards,0);assert.equal(receipt.method,'loopback_browser_dom_after_two_frames');
  // This is HTTP contract validation with a synthetic receipt, not actual browser render proof.
});

test('unopened browser times out without returning a zero-time success',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'reply-observer-'));
  const observer=await createReviewObserver({stateDir:dir,timeoutMs:100});
  t.after(async()=>{await observer.close();await fs.rm(dir,{recursive:true,force:true});});
  await assert.rejects(observer.waitForBrowser(),/browser_not_opened/);
});
