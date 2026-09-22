import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createProvider,createBudget} from '../../lib/reply-first-provider.mjs';
import {runReplyFirst,normalizeInput,hash} from '../../lib/reply-first.mjs';
import {benchmarkReplyFirst} from '../../lib/reply-first-benchmark.mjs';

const data={account:'synthetic',offer:'Help write posts',comments:Array.from({length:100},(_,i)=>({id:`c${i}`,text:'How do I write a post?',parent_text:'A posting guide',url:`https://example.invalid/c${i}`,parent_url:'https://example.invalid/p',created_at:'2026-09-22T00:00:00Z',owner_already_replied:false}))};
async function state(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'reply-baseline-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));return dir;}

test('LLM can classify 100 in one actual HTTP request; Jev retains its typed-question limit',async t=>{
  const dir=await state(t),requests=[];
  const server=http.createServer(async(req,res)=>{
    let text='';for await(const part of req)text+=part;
    const body=JSON.parse(text);requests.push(body);
    const items=JSON.parse(body.messages[1].content).items;
    res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({rows:items.map(({item})=>({item,category:'direct_question',relevant:true}))})}}],usage:{cost:0}}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const options={apiKey:'synthetic',privacy:'non-zdr',endpoint:`http://127.0.0.1:${server.address().port}`,budget:createBudget({file:path.join(dir,'budget.json')})};
  const adapter=createProvider({...options,provider:'llm',model:'google/gemini-3.5-flash-lite',reasoningEffort:'minimal'});
  const result=await runReplyFirst({input:data,adapter,stateDir:dir,preflight:false,batchSize:100});
  assert.equal(result.processed,100);assert.equal(requests.length,1);assert.deepEqual(requests[0].reasoning,{effort:'minimal'});
  assert.equal(requests[0].response_format.json_schema.strict,true);assert.equal(result.batching.max_input_tokens,128000);
  assert.equal(result.request_config.reasoning_effort,'minimal');
  assert.equal(result.request_config.version,'reply-first-llm-request-v3');
  assert.match(requests[0].messages[0].content,/unrelated to the offer/);
  const cached=await runReplyFirst({input:data,adapter,stateDir:dir,preflight:false,batchSize:100});assert.equal(cached.cached_count,100);
  const changed=createProvider({...options,provider:'llm',model:adapter.model,reasoningEffort:'low'});
  const rerun=await runReplyFirst({input:data,adapter:changed,stateDir:dir,preflight:false,batchSize:100});assert.equal(rerun.cached_count,0);assert.equal(requests.length,2);
  const jev=createProvider(options);assert.throws(()=>jev.batch(data.comments,data.offer,{batchSize:100}),/1_to_16/);
  assert.throws(()=>adapter.batch(data.comments,data.offer,{batchSize:101}),/1_to_100/);
  assert.throws(()=>adapter.batch([{...data.comments[0],text:'x'.repeat(128000)}],data.offer),/oversized_comment/);
});

test('bounded reservations allow four requests without weakening the total cap',async t=>{
  const dir=await state(t),budget=createBudget({file:path.join(dir,'budget.json'),cap:1,reservation:.25});
  const tickets=await Promise.all(Array.from({length:4},()=>budget.reserve()));
  await assert.rejects(budget.reserve(),/perth_day_budget_exhausted/);
  await budget.settle(tickets[0],null); // unknown charge remains reserved conservatively
  await assert.rejects(budget.reserve(),/perth_day_budget_exhausted/);
  await budget.settle(tickets[1],.01);
  await assert.rejects(budget.reserve(),/perth_day_budget_exhausted/); // .76 + .25 >1
  await budget.settle(tickets[2],.01);
  await budget.reserve();
  const ledger=JSON.parse(await fs.readFile(path.join(dir,'budget.json')));
  assert.ok(Object.values(ledger.days).flat().reduce((n,e)=>n+e.charged,0)<=1);
});

test('benchmark freezes independent route settings before trials and rejects bypass options',async t=>{
  const dir=await state(t),sizes={jev:[],baseline:[]};
  const adapter=route=>({model:route,provider:route,privacy:'non-zdr',preflight:async()=>({attempts:[]}),
    batch:(comments,offer,{batchSize})=>{sizes[route].push(batchSize);return [comments];},
    evaluate:async comments=>({raw:comments.map(c=>({id:c.id,category:'direct_question',relevant:true,confidence:null})),attempts:[]}),decode:raw=>raw});
  const args={input:data,reference:{adjudicated:true,reviewers:['a','b'],input_hash:hash(normalizeInput(data)),labels:data.comments.map(c=>({id:c.id,category:'direct_question',relevant:true}))},jev:adapter('jev'),baseline:adapter('baseline'),stateDir:dir,jevOptions:{batchSize:10},baselineOptions:{batchSize:100}};
  const result=await benchmarkReplyFirst(args);assert.equal(result.runs.length,12);assert.ok(sizes.jev.every(x=>x===10));assert.ok(sizes.baseline.every(x=>x===100));
  const frozen=JSON.parse(await fs.readFile(path.join(dir,'benchmark-started.json')));assert.equal(frozen.settings.baseline.batchSize,100);
  assert.equal(result.summary.performance_gate,false); // Synthetic replay is not a live win.
  await assert.rejects(benchmarkReplyFirst({...args,baselineOptions:{preflight:false}}),/invalid_benchmark_route_option/);
});
