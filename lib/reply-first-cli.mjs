import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProvider, createBudget } from './reply-first-provider.mjs';
import { runReplyFirst, atomicJson } from './reply-first.mjs';
import { createMcpReader, createThreadifySource,createFrozenThreadifySource } from './reply-first-source.mjs';
import { benchmarkReplyFirst,prepareChallenge,evaluateChallenge } from './reply-first-benchmark.mjs';
import { createReviewObserver } from './reply-first-browser.mjs';

function parse(args) {
  const [command,...rest]=args,options={command};
  for(let i=0;i<rest.length;i++) {
    const key=rest[i];
    if(key==='--no-cache'){options.cache=false;continue;}
    if(key==='--browser'){options.browser=true;continue;}
    if(!['--input','--state','--privacy','--provider','--model','--baseline-model','--labels','--account','--offer','--days','--count','--live-cohort','--batch-size','--baseline-batch-size','--reasoning-effort','--baseline-reasoning-effort','--fixture'].includes(key)||!rest[i+1]||rest[i+1].startsWith('--'))throw new Error('invalid_reply_first_option');
    options[key.slice(2)]=rest[++i];
  }
  return options;
}
const read=async file=>JSON.parse(await fs.readFile(path.resolve(file),'utf8'));
export async function replyFirstMain(argv=process.argv.slice(2)) {
  const options=parse(argv),key=process.env.AI_GATEWAY_API_KEY;
  const budget=createBudget({ ...(process.env.THREADIFY_JEV_BUDGET_FILE?{file:path.resolve(process.env.THREADIFY_JEV_BUDGET_FILE)}:{}),cap:Number(process.env.THREADIFY_JEV_DAILY_CAP??10) });
  if(options.command==='setup') return {status:'instructions',steps:['Install Threadify Workflows for your host.','Connect your Threadify account through its supported MCP connection.','Set AI_GATEWAY_API_KEY in your local environment or secret manager, never in this chat.','Choose --privacy zdr or --privacy non-zdr explicitly. A missing ZDR route stops; no silent fallback.','Run reply-first doctor --privacy <choice>, then supply your confirmed offer.'],pricing:'Verify current Vercel Jev pricing. Do not assume promotional pricing persists.',source:'Host may export read-only list_comments results to the documented input envelope. That path is labelled file_replay. Direct live CLI retrieval requires THREADIFY_MCP_TOKEN; no host credentials are scraped.'};
  if(options.command==='doctor') {
    if(!key)return {status:'blocked',error:'provider_credential_missing',env:'AI_GATEWAY_API_KEY'};
    const adapter=createProvider({apiKey:key,privacy:options.privacy,model:options.model,provider:options.provider,reasoningEffort:options['reasoning-effort'],budget});
    const result=await adapter.preflight();return {status:'provider_verified',model:adapter.model,privacy:adapter.privacy,attempts:result.attempts,threadify_live_configured:Boolean(process.env.THREADIFY_MCP_TOKEN)};
  }
  if(!['run','benchmark','challenge'].includes(options.command)||!options.state)throw new Error('usage_reply_first_run_benchmark_or_challenge_requires_state');
  const stateDir=path.resolve(options.state);
  const adapter=createProvider({apiKey:key,privacy:options.privacy,provider:options.provider,model:options.model,reasoningEffort:options['reasoning-effort'],budget});
  if(options.command==='challenge') {
    if(!options.fixture)throw new Error('challenge_requires_fixture');
    const {input,reference}=prepareChallenge(await read(options.fixture));
    const result=await runReplyFirst({input,adapter,stateDir,cache:false,batchSize:Number(options['batch-size']??10)});
    const report=evaluateChallenge(result,reference);
    await atomicJson(path.join(stateDir,'runs',result.run_id,'challenge.json'),report);
    return {status:report.challenge_gate?'challenge_passed':'challenge_failed',...report};
  }
  let input,source;
  if(options.input) {
    input=await read(options.input);
    if(options['live-cohort'])source=createFrozenThreadifySource({callTool:createMcpReader({token:process.env.THREADIFY_MCP_TOKEN}),input,manifest:await read(options['live-cohort'])});
  }
  else {
    if(options['live-cohort'])throw new Error('live_cohort_requires_frozen_input');
    if(!options.account||!options.offer)throw new Error('live_source_requires_account_and_offer');
    source=createThreadifySource({callTool:createMcpReader({token:process.env.THREADIFY_MCP_TOKEN}),account:options.account,offer:options.offer,days:Number(options.days??14),targetCount:Number(options.count??100)});
  }
  if(options.command==='run') {
    const result=await runReplyFirst({input,source,adapter,stateDir,cache:options.cache??true,batchSize:Number(options['batch-size']??10)});
    return {status:result.status,run_id:result.run_id,total:result.total,processed:result.processed,cached_count:result.cached_count,source_mode:result.source_mode,timings:result.timings,missing:result.missing,errors:result.errors,review:path.join(stateDir,'runs',result.run_id,'review.html')};
  }
  if(!options.labels||!options['baseline-model'])throw new Error('benchmark_requires_labels_and_pinned_baseline_model');
  const observer=options.browser?await createReviewObserver({stateDir}):null;
  let benchmark;
  try {
    if(observer){process.stderr.write(`Open the private local benchmark observer: ${observer.url}\n`);await observer.waitForBrowser();}
    benchmark=await benchmarkReplyFirst({input,source,reference:await read(options.labels),jev:adapter,baseline:createProvider({provider:'llm',model:options['baseline-model'],reasoningEffort:options['baseline-reasoning-effort'],privacy:options.privacy,apiKey:key,budget}),jevOptions:{batchSize:Number(options['batch-size']??10)},baselineOptions:{batchSize:Number(options['baseline-batch-size']??10)},stateDir,measureReview:observer?.measureReview});
  }finally{await observer?.close();}
  await atomicJson(path.join(stateDir,'benchmark-summary.json'),benchmark.summary);
  return {status:observer?'benchmark_recorded':'diagnostic_only',summary:benchmark.summary,note:observer?'Browser rendering measured; missing correction timing, file replay or failed quality/performance gates still prevent a win.':'Use --browser to observe actual browser rendering. Without it full speed acceptance remains unproven.'};
}
// Installers expose skills through directory symlinks. Compare real paths so that
// direct invocation executes there, while importing this module remains side-effect free.
const invokedFile=process.argv[1]?await fs.realpath(process.argv[1]).catch(()=>null):null;
if(invokedFile===fileURLToPath(import.meta.url)) {
  replyFirstMain().then(result=>{console.log(JSON.stringify(result,null,2));if(['partial','blocked','challenge_failed'].includes(result.status))process.exitCode=1;}).catch(error=>{console.error(JSON.stringify({status:'failed',error:error.message}));process.exitCode=1;});
}
