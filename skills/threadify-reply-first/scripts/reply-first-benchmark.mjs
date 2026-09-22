import path from 'node:path';
import fs from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { atomicJson, hash, normalizeInput, runReplyFirst, RUBRIC, isTerminalProviderError } from './reply-first.mjs';

export function quality(result, reference) {
  if (!reference || !Array.isArray(reference.labels) || reference.input_hash !== result.input_hash) throw new Error('reference_input_binding_mismatch');
  const expected = new Map();
  for (const row of reference.labels) {
    if (expected.has(row.id) || !Object.hasOwn(RUBRIC,row.category) || typeof row.relevant !== 'boolean') throw new Error('invalid_reference_labels');
    expected.set(row.id,row);
  }
  if (!expected.size || expected.size !== result.total || result.rows.length!==result.total || new Set(result.rows.map(row=>row.id)).size!==result.total || result.rows.some(row=>!expected.has(row.id))) throw new Error('reference_coverage_mismatch');
  let correct=0,relevanceCorrect=0,critical=0,found=0;
  const corrections=[];
  for(const row of result.rows) {
    const truth=expected.get(row.id);
    if(!row.missing && row.category===truth.category) correct++;
    if(!row.missing && row.relevant===truth.relevant) relevanceCorrect++;
    if(row.missing || row.category!==truth.category || row.relevant!==truth.relevant) corrections.push(row.id);
    if(truth.category==='direct_question') { critical++; if(!row.missing&&row.category==='direct_question')found++; }
  }
  return {accuracy:correct/expected.size,relevance_accuracy:relevanceCorrect/expected.size,critical_recall:critical?found/critical:null,critical_count:critical,correction_ids:corrections};
}

// Reference labels and category-signalling fixture IDs never enter provider input.
export function prepareChallenge(fixture) {
  if(fixture?.synthetic!==true || !Array.isArray(fixture.cases) || !fixture.adjudicated || !Array.isArray(fixture.reviewers) || new Set(fixture.reviewers).size<2)throw new Error('independent_challenge_reference_required');
  if(new Set(fixture.cases.map(c=>c.id)).size!==fixture.cases.length)throw new Error('duplicate_challenge_id');
  const labels=[],expectedExcluded=[],reviewIds=[],nonRelevantIds=[];
  const comments=fixture.cases.map((c,i)=>{
    const id=`challenge-${String(i+1).padStart(3,'0')}`;
    if(c.owner_already_replied===true)expectedExcluded.push(id);
    else {
      if(!Object.hasOwn(RUBRIC,c.category)||typeof c.relevant!=='boolean')throw new Error('invalid_challenge_reference');
      labels.push({id,category:c.category,relevant:c.relevant});
      if(c.category==='uncertain')reviewIds.push(id);
      if(c.category==='conversation'&&!c.relevant)nonRelevantIds.push(id);
    }
    return {id,text:c.text,parent_text:c.parent_text,url:`https://example.invalid/comments/${id}`,parent_url:`https://example.invalid/posts/${id}`,created_at:'2026-01-01T00:00:00Z',owner_already_replied:c.owner_already_replied??false};
  });
  const input={account:'synthetic-challenge',offer:fixture.offer,comments};
  const frozen=normalizeInput(input);
  return {input,reference:{input_hash:hash(frozen),fixture_hash:hash(fixture),adjudicated:true,reviewers:fixture.reviewers,labels,expected_excluded:expectedExcluded,review_ids:reviewIds,non_relevant_ids:nonRelevantIds}};
}

export function evaluateChallenge(result,reference) {
  const metrics=quality(result,reference),byId=new Map(result.rows.map(row=>[row.id,row]));
  const handled=(reference.expected_excluded??[]).every(id=>!byId.has(id)&&result.excluded?.some(row=>row.id===id&&row.reason==='already_handled'));
  const review=(reference.review_ids??[]).every(id=>byId.get(id)?.category==='uncertain'&&!byId.get(id)?.missing);
  const noFalseLeads=(reference.non_relevant_ids??[]).every(id=>byId.get(id)?.relevant===false&&!byId.get(id)?.missing);
  const complete=result.status==='complete'&&result.processed===result.total&&result.cached_count===0;
  return {synthetic:true,input_hash:result.input_hash,fixture_hash:reference.fixture_hash,model:result.model,request_config:result.request_config,quality:metrics,
    all_handled_excluded:handled,all_uncertain_cases_reviewable:review,conversation_not_offer_relevant:noFalseLeads,
    challenge_gate:complete&&metrics.accuracy>=0.9&&metrics.relevance_accuracy>=0.9&&metrics.critical_recall>=0.95&&handled&&review&&noFalseLeads,
    live_speed_proven:false,publication_ready:false};
}
const median=values=>{const sorted=[...values].sort((a,b)=>a-b);return sorted.length?sorted[Math.floor(sorted.length/2)]:null;};

export function summarizeBenchmark(runs) {
  const groups=Object.fromEntries(['jev','baseline'].map(route=>[route,runs.filter(r=>r.route===route&&!r.warmup)]));
  const summaries={};
  for(const [route,group]of Object.entries(groups)) {
    const valid=group.filter(r=>r.status==='complete'&&r.total===100&&r.cached_count===0&&Number.isFinite(r.click_to_queue_ms)&&Number.isFinite(r.correction_ms)&&r.correction_ms>=0&&r.source_mode==='live_adapter');
    summaries[route]={attempted:group.length,complete:valid.length,median_ms:median(valid.map(r=>r.click_to_queue_ms+r.correction_ms)),slowest_ms:valid.length?Math.max(...valid.map(r=>r.click_to_queue_ms+r.correction_ms)):null,
      http_attempts:group.reduce((n,r)=>n+(r.attempts?.length??0),0),known_cost_usd:group.flatMap(r=>r.attempts??[]).reduce((n,a)=>n+(a.cost_usd??0),0),unknown_cost_attempts:group.flatMap(r=>r.attempts??[]).filter(a=>a.cost_usd===null).length,
      failures:group.filter(r=>r.status!=='complete').length,min_accuracy:Math.min(...group.map(r=>r.quality?.accuracy??0)),min_critical_recall:Math.min(...group.map(r=>r.quality?.critical_recall??0))};
  }
  const j=summaries.jev,b=summaries.baseline;
  const ratio=j.median_ms&&b.median_ms?b.median_ms/j.median_ms:null;
  return {...summaries,speed_ratio:ratio,performance_gate:j.complete===5&&b.complete===5&&j.attempted===5&&b.attempted===5&&j.median_ms<30000&&j.slowest_ms<60000&&ratio>=3,
    quality_gate:j.attempted===5&&b.attempted===5&&j.failures===0&&b.failures===0&&j.min_accuracy>=0.9&&b.min_accuracy>=0.9&&j.min_critical_recall>=0.95&&b.min_critical_recall>=0.95&&j.min_accuracy>=b.min_accuracy-0.02,
    publication_ready:false,limitations:['Challenge-set pass, independent reference adjudication, correction time, both-host installations and browser review require separate proof.']};
}

// measureReview must actually open/render the review and return observed timing.
// Without it, this is a classification diagnostic, never a click-to-queue speed claim.
export async function benchmarkReplyFirst({ input,source,reference,jev,baseline,stateDir,measureReview,measureCorrections,jevOptions={},baselineOptions={} }) {
  const runs=[];
  const settings={};
  for(const [route,options] of Object.entries({jev:jevOptions,baseline:baselineOptions})) {
    if(Object.keys(options).some(key=>!['batchSize','concurrency','maxInputTokens'].includes(key)))throw new Error('invalid_benchmark_route_option');
    settings[route]=Object.freeze({batchSize:10,concurrency:4,...options});
  }
  if(!reference?.adjudicated || !Array.isArray(reference.reviewers) || new Set(reference.reviewers).size<2) throw new Error('independent_adjudicated_reference_required');
  await fs.mkdir(stateDir,{recursive:true,mode:0o700});
  // A fresh state directory makes failed attempts immutable and prevents accidental rerun cherry-picking.
  const reservation=await fs.open(path.join(stateDir,'benchmark-started.json'),'wx',0o600);
  try {await reservation.writeFile(JSON.stringify({started_at:new Date().toISOString(),reference_hash:hash(reference),settings,providers:{jev:{model:jev.model,request_config:jev.requestConfig??null},baseline:{model:baseline.model,request_config:baseline.requestConfig??null}}}));}
  finally {await reservation.close();}
  for(let trial=-1;trial<5;trial++) {
    const routes=trial%2===0?['baseline','jev']:['jev','baseline'];
    for(const route of routes) {
      const start=performance.now(),runState=path.join(stateDir,`${trial<0?'warmup':trial}-${route}`);
      let record={route,trial,warmup:trial<0,status:'failed',reference_hash:hash(reference),correction_ms:null};
      try {
        const result=await runReplyFirst({input,source,adapter:route==='jev'?jev:baseline,stateDir:runState,cache:false,...settings[route]});
        const terminal=result.errors.find(e=>isTerminalProviderError(e.code));
        let browser=null;
        if(measureReview&&!terminal) browser=await measureReview(path.join(runState,'runs',result.run_id,'review.html'));
        const measured=performance.now()-start;
        const qualityResult=quality(result,reference);
        let correction=qualityResult.correction_ids.length===0?{verified:true,elapsed_ms:0,method:'no_reference_disagreements'}:null;
        if(qualityResult.correction_ids.length && measureCorrections&&!terminal) correction=await measureCorrections({result,reference,ids:qualityResult.correction_ids,route,trial});
        record={...record,status:result.status,errors:result.errors,...(terminal?{error:terminal.code}:{}),source_mode:result.source_mode,input_hash:result.input_hash,model:result.model,run_id:result.run_id,total:result.total,
          quality:qualityResult,request_config:result.request_config,batching:result.batching,runner_ms:result.timings.runner_ms,classification_ms:result.timings.classification_ms,
          correction_ms:correction?.verified===true&&Number.isFinite(correction.elapsed_ms)&&correction.elapsed_ms>=0?correction.elapsed_ms:null,correction,
          click_to_queue_ms:browser?.verified===true&&result.source_mode==='live_adapter'?measured:null,browser,
          attempts:[...(result.preflight?.attempts??[]),...result.batches.flatMap(b=>b.attempts??[])],cached_count:result.cached_count};
      } catch(e) { record.error=/^[a-z0-9_:-]+$/i.test(e.message)?e.message:'benchmark_failure'; }
      // Attempt files survive failed preflight, malformed successful responses and partial runs.
      // Read them rather than counting only successful batches returned by the runner.
      const attempts=[];
      let runDirs=[];try { runDirs=await fs.readdir(path.join(runState,'runs')); } catch(e) { if(e.code!=='ENOENT') throw e; }
      for(const run of runDirs) {
        const dir=path.join(runState,'runs',run);
        for(const file of await fs.readdir(dir)) if(/^(preflight-attempt-|attempt-).*\.json$/.test(file)) attempts.push(JSON.parse(await fs.readFile(path.join(dir,file),'utf8')));
      }
      record.attempts=attempts;
      record.attempt_elapsed_ms=performance.now()-start;
      runs.push(record);await atomicJson(path.join(stateDir,'benchmark.json'),{runs,summary:summarizeBenchmark(runs)});
      if(isTerminalProviderError(record.error)) {
        const stopped={runs,summary:summarizeBenchmark(runs),stopped_reason:record.error};
        await atomicJson(path.join(stateDir,'benchmark.json'),stopped);return stopped;
      }
    }
  }
  return {runs,summary:summarizeBenchmark(runs)};
}
