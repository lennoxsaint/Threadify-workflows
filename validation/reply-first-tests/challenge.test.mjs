import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {prepareChallenge,evaluateChallenge,quality,summarizeBenchmark} from '../../lib/reply-first-benchmark.mjs';
import {normalizeInput,RUBRIC} from '../../lib/reply-first.mjs';

const authored=JSON.parse(await fs.readFile(new URL('../../plugins/threadify/skills/threadify-reply-first/references/challenge.json',import.meta.url),'utf8'));
// Stub reference metadata exercises mechanics, not independent or model quality.
const fixture={...authored,adjudicated:true,reviewers:['synthetic-test-a','synthetic-test-b']};
const prepared=prepareChallenge(fixture);
function perfect(){return {input_hash:prepared.reference.input_hash,model:'synthetic',status:'complete',cached_count:0,processed:24,total:24,rows:prepared.reference.labels.map(row=>({...row,confidence:null})),excluded:normalizeInput(prepared.input).excluded};}

test('challenge provider input contains neutral IDs, no labels or expected acceptance answers',()=>{
  assert.equal(prepared.input.comments.length,25);assert.equal(prepared.reference.labels.length,24);
  for(const row of prepared.input.comments){assert.match(row.id,/^challenge-\d{3}$/);assert.equal(row.category,undefined);assert.equal(row.relevant,undefined);assert.equal(row.excluded,undefined);}
  assert.equal(prepared.input.acceptance,undefined);assert.equal(prepared.input.reviewers,undefined);
  assert.throws(()=>prepareChallenge({...fixture,adjudicated:false}),/independent_challenge/);
  assert.throws(()=>prepareChallenge({...fixture,reviewers:['same','same']}),/independent_challenge/);
});

test('challenge hard requirements cannot hide behind high aggregate accuracy',()=>{
  assert.equal(evaluateChallenge(perfect(),prepared.reference).challenge_gate,true);
  for(const alter of [
    r=>{r.excluded=[];},
    r=>{r.rows.find(row=>row.id===prepared.reference.review_ids[0]).category='conversation';},
    r=>{r.rows.find(row=>row.id===prepared.reference.non_relevant_ids[0]).relevant=true;},
    r=>{r.rows.find(row=>row.category==='direct_question').category='conversation';},
    r=>{r.cached_count=24;},r=>{r.status='partial';}
  ]){const result=perfect();alter(result);assert.equal(evaluateChallenge(result,prepared.reference).challenge_gate,false);}
  const report=evaluateChallenge(perfect(),prepared.reference);assert.equal(report.live_speed_proven,false);assert.equal(report.publication_ready,false);
});

test('quality rejects duplicate rows, missing coverage and empty benchmark quality',()=>{
  const duplicate=perfect();duplicate.rows[1]={...duplicate.rows[0]};assert.throws(()=>quality(duplicate,prepared.reference),/coverage_mismatch/);
  const missing=perfect();missing.rows.pop();assert.throws(()=>quality(missing,prepared.reference),/coverage_mismatch/);
  assert.equal(summarizeBenchmark([]).quality_gate,false);
});

test('both real CLI entrypoints enforce synthetic challenge outcome and exit status',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'reply-challenge-cli-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const fixturePath=fileURLToPath(new URL('../../plugins/threadify/skills/threadify-reply-first/references/challenge.json',import.meta.url));
  const labels=Object.fromEntries(authored.cases.filter(c=>!c.owner_already_replied).map(c=>[c.text,{category:c.category,relevant:c.relevant}]));
  for(const [entry,incorrect] of [['../../lib/reply-first-cli.mjs',false],['../../bin/threadify-workflows.mjs',true]]) {
    // Stub transport only. No gateway calls, credentials or model quality claim.
    const hook=`globalThis.fetch=async(url,options)=>{
      const body=JSON.parse(options.body),items=JSON.parse(body.state).items,labels=${JSON.stringify(labels)},categories=${JSON.stringify(Object.keys(RUBRIC))};
      const answers={};
      items.forEach((item,i)=>{if('category' in item||'relevant' in item)throw Error('label_leak');
        const truth=labels[item.comment]??{category:'conversation',relevant:false};const category=${incorrect}?'conversation':truth.category;
        answers['category_'+i]={choice:category,confidence:1,probabilities:Object.fromEntries(categories.map(k=>[k,k===category?1:0]))};
        answers['relevant_'+i]={probability:${incorrect}?0:(truth.relevant?1:0)};
      });return new Response(JSON.stringify({answers,usage:{cost:0}}),{status:200});};`;
    const command=[fileURLToPath(new URL(entry,import.meta.url)),...(entry.includes('/bin/')?['reply-first']:[]),'challenge','--fixture',fixturePath,'--state',path.join(dir,String(incorrect)),'--privacy','non-zdr'];
    const child=spawnSync(process.execPath,['--import',`data:text/javascript,${encodeURIComponent(hook)}`,...command],{encoding:'utf8',env:{...process.env,AI_GATEWAY_API_KEY:'synthetic-test',THREADIFY_JEV_BUDGET_FILE:path.join(dir,'budget.json')}});
    assert.equal(child.status,incorrect?1:0,child.stderr);const result=JSON.parse(child.stdout);
    assert.equal(result.status,incorrect?'challenge_failed':'challenge_passed');assert.equal(result.live_speed_proven,false);assert.equal(result.quality.critical_count,10);
  }
});
