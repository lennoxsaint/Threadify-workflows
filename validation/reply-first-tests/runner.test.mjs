import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn,spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { runReplyFirst, normalizeInput, batchComments, decodeJev, buildEvaluation, RUBRIC,renderReplyFirst } from '../../lib/reply-first.mjs';
import { createProvider, createBudget } from '../../lib/reply-first-provider.mjs';
import { createThreadifySource } from '../../lib/reply-first-source.mjs';

const item=i=>({id:`c${i}`,text:'How does this work?',parent_text:'A guide to writing posts.',url:`https://www.threads.com/@example/post/${i}`,parent_url:'https://www.threads.com/@example/post/parent',created_at:'2026-09-22T00:00:00Z',owner_already_replied:false});
const input=(count=30)=>({account:'synthetic',offer:'A guide to writing posts.',comments:Array.from({length:count},(_,i)=>item(i))});

test('per-request reservations preserve unknown charges and reject invalid bounds',async t=>{
 const dir=await state(t),file=path.join(dir,'budget.json'),budget=createBudget({file,cap:.5,reservation:.1});
 for(const amount of [0,-1,Infinity,NaN,.51])await assert.rejects(budget.reserve(amount),/invalid_request_reservation/);
 const a=await budget.reserve(.3);await budget.settle(a,null);
 const b=await budget.reserve(.2);await assert.rejects(budget.reserve(.001),/budget_exhausted/);
 await budget.settle(b,.01);const c=await budget.reserve(.19);await budget.settle(c,null);
 const ledger=JSON.parse(await fs.readFile(file));assert.ok(Math.abs(Object.values(ledger.days).flat().reduce((s,r)=>s+r.charged,0)-.5)<1e-8);
});

test('provider computes and validates reservation before actual HTTP attempt',async t=>{
 const dir=await state(t);let seen=0;
 const endpoint=await server(t,async(body,res)=>{seen++;res.end(JSON.stringify(payload(body)));});
 const budget=createBudget({file:path.join(dir,'budget.json'),cap:.01,reservation:.001});
 const adapter=createProvider({apiKey:'synthetic',privacy:'non-zdr',endpoint,budget,reservationForRequest:body=>{assert.equal(body.model,'typesafe-ai/jev');return .001;}});
 await adapter.evaluate([item(0)],'offer');assert.equal(seen,1);
 const invalid=createProvider({apiKey:'synthetic',privacy:'non-zdr',endpoint,budget,reservationForRequest:()=>0});
 await assert.rejects(invalid.evaluate([item(0)],'offer'),/invalid_request_reservation/);assert.equal(seen,1);
});

test('terminal classification failure stops queued batches but retains every admitted attempt',async t=>{
  const dir=await state(t);let calls=0,release;
  const admitted=new Promise(resolve=>{release=resolve;});
  const adapter={model:'synthetic',provider:'test',privacy:'non-zdr',preflight:async()=>({attempts:[]}),evaluate:async(_batch,_offer,{onAttempt})=>{
    calls++;if(calls===4)release();await admitted;
    await onAttempt({attempt:1,status:401,http_ms:1,cost_usd:0,error:'http_401'});
    throw new Error('http_401');
  }};
  const result=await runReplyFirst({input:input(30),adapter,stateDir:dir,batchSize:1,concurrency:4});
  assert.equal(calls,4);assert.equal(result.status,'partial');assert.equal(result.missing.length,30);
  assert.equal(result.errors.length,4);
  const files=await fs.readdir(path.join(dir,'runs',result.run_id));
  assert.equal(files.filter(f=>f.startsWith('attempt-')).length,4);
});
function payload(body) {
  return {answers:Object.fromEntries(Object.entries(body.questions).map(([key,q])=>[key,q.type==='choice'?{type:'choice',choice:'direct_question',confidence:1,probabilities:Object.fromEntries(Object.keys(RUBRIC).map(k=>[k,k==='direct_question'?1:0]))}:{type:'boolean',probability:1}])),providerMetadata:{gateway:{cost:'0'}}};
}
async function server(t,handler) {
  const instance=http.createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;await handler(JSON.parse(body),res);});
  await new Promise(resolve=>instance.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>instance.close(resolve)));return `http://127.0.0.1:${instance.address().port}/evaluate`;
}
async function state(t) {const dir=await fs.mkdtemp(path.join(os.tmpdir(),'reply-first-test-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));return dir;}

test('real network boundary overlaps four requests; durable cache avoids repeats and invalidates offer',async t=>{
  let active=0,maxActive=0,calls=0;
  let releaseWave,wave=new Promise(resolve=>{releaseWave=resolve;});
  const endpoint=await server(t,async(body,res)=>{
    calls++;
    if(JSON.parse(body.state).items[0].comment!=='Thank you!') {
      active++;maxActive=Math.max(maxActive,active);if(active===4)releaseWave();
      let deadline;await Promise.race([wave,new Promise(resolve=>{deadline=setTimeout(resolve,2000);})]);clearTimeout(deadline);
      active--;if(active===0)wave=new Promise(resolve=>{releaseWave=resolve;});
    }
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify(payload(body)));
  });
  const dir=await state(t),adapter=createProvider({apiKey:'synthetic',privacy:'non-zdr',endpoint,budget:createBudget({file:path.join(dir,'budget.json')})});
  const result=await runReplyFirst({input:input(40),adapter,stateDir:dir});
  assert.equal(result.status,'complete');assert.equal(result.processed,40);assert.equal(maxActive,4);assert.equal(calls,5);
  const cached=await runReplyFirst({input:input(40),adapter,stateDir:dir});assert.equal(cached.cached_count,40);assert.equal(calls,6);
  await runReplyFirst({input:{...input(40),offer:'Changed offer'},adapter,stateDir:dir});assert.equal(calls,11);
  const latest=JSON.parse(await fs.readFile(path.join(dir,'latest.json')));assert.match(await fs.readFile(latest.review,'utf8'),/40 \/ 40/);
});

test('deduplication, handled exclusion and invalid/oversized input fail explicitly',()=>{
  const data=input(2);data.comments.push({...item(0)});data.comments[1].owner_already_replied=true;
  const normalized=normalizeInput(data);assert.equal(normalized.comments.length,1);assert.equal(normalized.excluded.length,2);
  assert.throws(()=>normalizeInput({...input(1),comments:[item(0),{...item(0),text:'changed'}]}),/conflicting_duplicate/);
  assert.throws(()=>normalizeInput({...input(1),comments:[{...item(0),owner_already_replied:undefined}]}),/handled_status_unknown/);
  assert.throws(()=>batchComments([{...item(0),text:'x'.repeat(30000)}],'offer'),/oversized_comment/);
  assert.throws(()=>normalizeInput({...input(1),comments:[{...item(0),url:'javascript:alert(1)'}]}),/unsafe_url/);
});

test('missing, zero, mismatched and malformed probabilities rejected',()=>{
  const body=buildEvaluation([item(0)],'offer'),raw=payload(body);assert.equal(decodeJev(raw,[item(0)]).length,1);
  raw.answers.category_0.probabilities.direct_question=0;assert.throws(()=>decodeJev(raw,[item(0)]),/probability_sum/);
  assert.throws(()=>decodeJev({answers:{}},[item(0)]),/coverage/);
  const other=payload(body);other.answers.relevant_0.probability=NaN;assert.throws(()=>decodeJev(other,[item(0)]),/relevance/);
});

test('transient 503 retries are durable; malformed successful batch stays missing and resume retries only missing',async t=>{
  let calls=0,malformed=true;
  const endpoint=await server(t,async(body,res)=>{calls++;if(calls===1){res.statusCode=503;res.end('{}');return;}const raw=payload(body);if(malformed&&JSON.parse(body.state).items[0].comment==='bad')delete raw.answers.category_0;res.end(JSON.stringify(raw));});
  const dir=await state(t),adapter=createProvider({apiKey:'synthetic',privacy:'non-zdr',endpoint,budget:createBudget({file:path.join(dir,'budget.json')}),sleepImpl:async()=>{}});
  const data=input(2);data.comments[1].text='bad';
  const result=await runReplyFirst({input:data,adapter,stateDir:dir,batchSize:1,preflight:false});assert.equal(result.status,'partial');assert.deepEqual(result.missing,['c1']);
  const runPath=path.join(dir,'runs',result.run_id);assert.ok((await fs.readdir(runPath)).some(n=>n.startsWith('attempt-')));assert.ok((await fs.readdir(runPath)).some(n=>n.startsWith('response-')));
  const before=calls;malformed=false;const resumed=await runReplyFirst({input:data,adapter,stateDir:dir,batchSize:1,preflight:false});assert.equal(resumed.status,'complete');assert.equal(resumed.cached_count,1);assert.equal(calls,before+1);
});

test('unavailable ZDR is attempted once, never silently sends non-ZDR',async t=>{
  let calls=0;const endpoint=await server(t,async(body,res)=>{calls++;assert.equal(body.providerOptions.gateway.zeroDataRetention,true);res.statusCode=403;res.end('{"error":"ZdrUnauthorizedError"}');});
  const dir=await state(t),adapter=createProvider({apiKey:'synthetic',privacy:'zdr',endpoint,budget:createBudget({file:path.join(dir,'budget.json')})});
  await assert.rejects(adapter.preflight(),/zdr_route_unavailable/);await assert.rejects(adapter.preflight(),/zdr_route_unavailable/);assert.equal(calls,1);
});

test('private budget counts interrupted or unknown costs and enforces cap',async t=>{
  const dir=await state(t),budget=createBudget({file:path.join(dir,'budget.json'),cap:2});const a=await budget.reserve();await budget.settle(a,null);await budget.reserve();await assert.rejects(budget.reserve(),/budget_exhausted/);
});

test('429 honors a bounded Retry-After and 504 retries retain attempt evidence',async t=>{
  let calls=0;const waits=[],receipts=[];
  const endpoint=await server(t,async(body,res)=>{
    calls++;if(calls===1){res.statusCode=429;res.setHeader('retry-after','1');res.end('{}');return;}
    if(calls===2){res.statusCode=504;res.end('{}');return;}
    res.end(JSON.stringify(payload(body)));
  });
  const dir=await state(t),adapter=createProvider({apiKey:'synthetic',privacy:'non-zdr',endpoint,budget:createBudget({file:path.join(dir,'budget.json')}),sleepImpl:async ms=>waits.push(ms)});
  await adapter.evaluate([item(0)],'guide',{onAttempt:r=>receipts.push(r)});
  assert.deepEqual(receipts.map(r=>r.status),[429,504,200]);assert.equal(calls,3);
  assert.ok(waits.some(ms=>ms>500 && ms<=1000));assert.ok(receipts.every(r=>r.http_ms>=0));
});

test('long rate limit stops; timed out real HTTP attempts are bounded and recorded',async t=>{
  let calls=0;const receipts=[];
  const endpoint=await server(t,async(body,res)=>{calls++;res.statusCode=429;res.setHeader('retry-after','60');res.end('{}');});
  const dir=await state(t),budget=createBudget({file:path.join(dir,'budget.json')});
  const limited=createProvider({apiKey:'synthetic',privacy:'non-zdr',endpoint,budget});
  await assert.rejects(limited.evaluate([item(0)],'guide',{onAttempt:r=>receipts.push(r)}),/retry_after_exceeds/);assert.equal(calls,1);
  assert.equal(receipts[0].retry_after_ms,60000);
  assert.ok(Date.parse(receipts[0].not_before)>Date.parse(receipts[0].started_at)+59000);
  const slow=await server(t,async(body,res)=>{await new Promise(r=>setTimeout(r,75));res.end(JSON.stringify(payload(body)));});
  const adapter=createProvider({apiKey:'synthetic',privacy:'non-zdr',endpoint:slow,budget,timeoutMs:10,maxAttempts:2,sleepImpl:async()=>{}});
  await assert.rejects(adapter.evaluate([item(0)],'guide',{onAttempt:r=>receipts.push(r)}),/provider_timeout/);
  assert.equal(receipts.filter(r=>r.error==='provider_timeout').length,2);
});

test('source pages comments and posts, deduplicates, retains explicit handled state',async()=>{
  let calls=0;const post={post_id:'p',text:'Parent',media_type:'TEXT_POST',permalink:'https://www.threads.com/@example/post/p'};
  const comment=i=>({comment_id:`c${i}`,text:'Comment',timestamp:'2026-09-22T00:00:00Z',permalink:`https://www.threads.com/@example/post/${i}`,owner_already_replied:false});
  const source=createThreadifySource({account:'synthetic',offer:'guide',targetCount:2,callTool:async(name,args)=>{assert.equal(name,'list_comments');calls++;return {ok:true,posts:[{post,comments:[comment(args.cursor?1:0)],has_more_comments:!args.cursor,next_cursor:args.cursor?null:'next'}],posts_offset_next:null};}});
  const data=await source();assert.equal(data.comments.length,2);assert.equal(calls,2);assert.equal(data.source.bounded_selection,true);
});

test('source overlaps four post reads, preserves provider order and discloses missing visual context',async()=>{
  let active=0,maximum=0;
  const group=i=>({post:{post_id:`p${i}`,text:`Parent ${i}`,media_type:'TEXT_POST',permalink:`https://example.invalid/p${i}`},comments:[],has_more_comments:true,next_cursor:'next'});
  const source=createThreadifySource({account:'synthetic',offer:'guide',targetCount:5,callTool:async(name,args)=>{
    if(!args.post_id)return {ok:true,posts:[...Array.from({length:4},(_,i)=>group(i)),{...group(99),post:{...group(99).post,media_type:'IMAGE'}}],posts_offset_next:null};
    active++;maximum=Math.max(maximum,active);const i=Number(args.post_id.slice(1));
    await new Promise(r=>setTimeout(r,(4-i)*5));active--;
    return {ok:true,posts:[{...group(i),comments:[{comment_id:`c${i}`,text:'Comment',timestamp:'2026-09-22T00:00:00Z',permalink:`https://example.invalid/c${i}`,owner_already_replied:false}],has_more_comments:false,next_cursor:null}]};
  }});
  const result=await source();assert.deepEqual(result.comments.map(c=>c.id),['c0','c1','c2','c3']);
  assert.equal(maximum,4);
  assert.equal(result.source.excluded_posts.length,1);assert.equal(result.source.retrieval_concurrency,4);
});

test('incremental cache survives reordered or inserted comments and invalidates changed context only',async t=>{
  let evaluated=[];
  const adapter={model:'synthetic',provider:'test',privacy:'non-zdr',evaluate:async batch=>{evaluated.push(...batch.map(c=>c.id));return {raw:batch.map(c=>({id:c.id,category:'conversation',relevant:false,confidence:null})),attempts:[]};},decode:raw=>raw};
  const dir=await state(t),data=input(12);
  await runReplyFirst({input:data,adapter,stateDir:dir,preflight:false});
  evaluated=[];
  const reordered={...data,comments:[item(50),...data.comments.slice().reverse()]};
  const next=await runReplyFirst({input:reordered,adapter,stateDir:dir,batchSize:3,preflight:false});
  assert.equal(next.cached_count,12);assert.deepEqual(evaluated,['c50']);
  evaluated=[];reordered.comments[2].parent_text='Changed parent context';
  const changed=await runReplyFirst({input:reordered,adapter,stateDir:dir,preflight:false});
  assert.equal(changed.cached_count,12);assert.deepEqual(evaluated,[reordered.comments[2].id]);
});

test('real process interruption recovers dead lock and evaluates only unfinished items',async t=>{
  const dir=await state(t),data=input(2);
  const moduleUrl=new URL('../../lib/reply-first.mjs',import.meta.url).href;
  const child=spawn(process.execPath,['--input-type=module','-e',`
    import {runReplyFirst} from ${JSON.stringify(moduleUrl)};
    let calls=0;
    const adapter={model:'synthetic',provider:'test',privacy:'non-zdr',evaluate:async batch=>{
      if(++calls===2){process.send('second-batch-started');await new Promise(()=>{});}
      return {raw:batch.map(c=>({id:c.id,category:'conversation',relevant:false,confidence:null})),attempts:[]};
    },decode:raw=>raw};
    const keepalive=setInterval(()=>{},1000);
    await runReplyFirst({input:${JSON.stringify(data)},adapter,stateDir:${JSON.stringify(dir)},preflight:false,batchSize:1,concurrency:1});
    clearInterval(keepalive);
  `],{stdio:['ignore','pipe','pipe','ipc']});
  t.after(()=>{if(child.exitCode===null && child.signalCode===null)child.kill('SIGKILL');});
  const [message]=await once(child,'message',{signal:AbortSignal.timeout(5000)});
  assert.equal(message,'second-batch-started');
  const exit=once(child,'exit');child.kill('SIGKILL');await exit;
  let evaluated=[];
  const adapter={model:'synthetic',provider:'test',privacy:'non-zdr',evaluate:async batch=>{evaluated.push(...batch.map(c=>c.id));return {raw:batch.map(c=>({id:c.id,category:'conversation',relevant:false,confidence:null})),attempts:[]};},decode:raw=>raw};
  const result=await runReplyFirst({input:data,adapter,stateDir:dir,preflight:false,batchSize:1});
  assert.equal(result.status,'complete');assert.equal(result.cached_count,1);assert.deepEqual(evaluated,['c1']);
  assert.ok((await fs.readdir(dir)).some(name=>name.startsWith('run.lock.recovered-')));
});

test('standalone setup executes through an installed directory symlink',async t=>{
  const dir=await state(t),link=path.join(dir,'installed-skill');
  await fs.symlink(fileURLToPath(new URL('../../lib',import.meta.url)),link,process.platform==='win32'?'junction':'dir');
  const result=spawnSync(process.execPath,[path.join(link,'reply-first-cli.mjs'),'setup'],{encoding:'utf8'});
  assert.equal(result.status,0);assert.equal(JSON.parse(result.stdout).status,'instructions');
});

test('review distinguishes missing evaluation from a negative decision and escapes source content',()=>{
  const base={processed:0,total:1,status:'partial',model:'synthetic',source_mode:'synthetic',privacy:'non-zdr'};
  const partial=renderReplyFirst({...base,rows:[{...item(0),text:'<script>unsafe()</script>',category:'uncertain',relevant:false,confidence:null,missing:true}]});
  assert.match(partial,/offer relevance not evaluated/);assert.doesNotMatch(partial,/no explicit offer match/);
  assert.match(partial,/&lt;script&gt;/);assert.doesNotMatch(partial,/<script>/);
  const empty=renderReplyFirst({...base,processed:0,total:0,status:'complete',rows:[]});assert.match(empty,/No pending comments/);
  const confidence=renderReplyFirst({...base,rows:[{...item(0),category:'direct_question',relevant:true,confidence:0.78}]});assert.match(confidence,/model confidence 78%/);
});
