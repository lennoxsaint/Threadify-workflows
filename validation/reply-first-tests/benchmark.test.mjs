import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { quality,summarizeBenchmark,benchmarkReplyFirst } from '../../lib/reply-first-benchmark.mjs';
import {hash,normalizeInput} from '../../lib/reply-first.mjs';

test('terminal partial results stop the benchmark before another trial or review',async t=>{
  for(const code of ['http_401','http_403','zdr_route_unavailable','perth_day_budget_exhausted','rate_limit_retry_after_exceeds_run_bound']){
    const stateDir=await fs.mkdtemp(path.join(os.tmpdir(),'reply-benchmark-terminal-'));
    t.after(()=>fs.rm(stateDir,{recursive:true,force:true}));
    const input={account:'synthetic',offer:'Writing help',comments:[{id:'a',text:'How?',parent_text:'Writing help',url:'https://example.invalid/a',parent_url:'https://example.invalid/p',created_at:'2026-09-22T00:00:00Z',owner_already_replied:false}]};
    const reference={adjudicated:true,reviewers:['a','b'],input_hash:hash(normalizeInput(input)),labels:[{id:'a',category:'direct_question',relevant:true}]};
    let calls=0,reviews=0;
    const adapter={model:'synthetic',provider:'test',privacy:'non-zdr',preflight:async()=>({attempts:[]}),evaluate:async(_b,_o,{onAttempt})=>{
      calls++;await onAttempt({attempt:1,status:429,http_ms:1,cost_usd:null,error:code});throw new Error(code);
    }};
    const result=await benchmarkReplyFirst({input,reference,jev:adapter,baseline:adapter,stateDir,measureReview:async()=>{reviews++;},measureCorrections:async()=>{reviews++;}});
    assert.equal(calls,1);assert.equal(reviews,0);assert.equal(result.runs.length,1);assert.equal(result.stopped_reason,code);
    assert.equal(result.runs[0].status,'partial');assert.equal(result.runs[0].errors[0].code,code);
    assert.equal(result.runs[0].attempts.length,1);assert.equal(result.summary.performance_gate,false);
    const saved=JSON.parse(await fs.readFile(path.join(stateDir,'benchmark.json')));assert.equal(saved.stopped_reason,code);
  }
});

const runs=()=>Array.from({length:5},(_,trial)=>['jev','baseline'].map(route=>({route,trial,status:'complete',total:100,cached_count:0,source_mode:'live_adapter',click_to_queue_ms:route==='jev'?10000:35000,correction_ms:0,quality:{accuracy:0.96,critical_recall:1}}))).flat();
test('acceptance cannot pass on file replay, omitted render timing, insufficient count or failed attempts',()=>{
  assert.equal(summarizeBenchmark(runs()).performance_gate,true);
  for(const change of [{source_mode:'file_replay'},{click_to_queue_ms:null},{correction_ms:null},{correction_ms:-1},{total:99},{cached_count:1},{status:'partial'}]){
    const data=runs();Object.assign(data[0],change);assert.equal(summarizeBenchmark(data).performance_gate,false);
  }
  assert.equal(summarizeBenchmark(runs().slice(1)).performance_gate,false);
});
test('correction time counts in the headline gate and relevance-only mistakes need correction',()=>{
  const data=runs();for(const row of data)if(row.route==='jev')row.correction_ms=10000;
  assert.equal(summarizeBenchmark(data).performance_gate,false);assert.equal(summarizeBenchmark(data).jev.median_ms,20000);
  const result={input_hash:'frozen',total:1,rows:[{id:'a',category:'conversation',relevant:true}]};
  const metric=quality(result,{input_hash:'frozen',labels:[{id:'a',category:'conversation',relevant:false}]});
  assert.equal(metric.accuracy,1);assert.deepEqual(metric.correction_ids,['a']);
});
test('quality counts missing as wrong and does not invent recall without critical examples',()=>{
  const result={input_hash:'frozen',total:2,rows:[{id:'a',category:'direct_question',relevant:true},{id:'b',category:'uncertain',relevant:false,missing:true}]};
  const reference={input_hash:'frozen',labels:[{id:'a',category:'direct_question',relevant:true},{id:'b',category:'direct_question',relevant:false}]};
  const metric=quality(result,reference);assert.equal(metric.accuracy,0.5);assert.equal(metric.critical_recall,0.5);
  assert.throws(()=>quality(result,{...reference,input_hash:'changed'}),/binding_mismatch/);
  assert.throws(()=>quality(result,{...reference,labels:[reference.labels[0],reference.labels[0]]}),/invalid_reference/);
});
test('failed preflight attempts remain in benchmark evidence; auth failure stops repeated work',async t=>{
  const stateDir=await fs.mkdtemp(path.join(os.tmpdir(),'reply-benchmark-'));
  t.after(()=>fs.rm(stateDir,{recursive:true,force:true}));
  let calls=0;
  const adapter={model:'synthetic',provider:'test',privacy:'non-zdr',preflight:async({onAttempt})=>{
    calls++;await onAttempt({attempt:1,status:401,http_ms:2,cost_usd:0,error:'http_401'});throw new Error('http_401');
  }};
  const args={input:{},reference:{adjudicated:true,reviewers:['a','b']},jev:adapter,baseline:adapter,stateDir};
  const result=await benchmarkReplyFirst(args);
  assert.equal(calls,1);assert.equal(result.stopped_reason,'http_401');assert.equal(result.runs[0].attempts.length,1);
  assert.equal(result.summary.performance_gate,false);
  await assert.rejects(benchmarkReplyFirst(args),{code:'EEXIST'});assert.equal(calls,1);
  const saved=JSON.parse(await fs.readFile(path.join(stateDir,'benchmark.json')));assert.equal(saved.runs[0].attempts[0].status,401);
});
