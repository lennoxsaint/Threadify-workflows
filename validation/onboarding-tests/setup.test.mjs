import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, symlink, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { startSetup, resumeSetup, inspectSetup } from '../../lib/onboarding/setup.mjs';
import { discoverSetupFiles } from '../../lib/onboarding/discovery.mjs';
import { reviewHash } from '../../lib/creator/review.mjs';
const now = '2026-09-29T00:00:00Z';
async function create() {
  const base = await realpath(await mkdtemp(path.join(os.tmpdir(), 'threadify-setup-test-')));
  const root = path.join(base, 'setup');
  let status = await startSetup(root, {client:'codex',version:'0.20.0',install_receipt:'fixture-only'}, now);
  const step = async (event, input) => { status = await resumeSetup(root,status.revision,{event,...input},now); return status; };
  const e = (other={}) => ({kind:'observed',reference:'fixture:unit-test-not-live-proof',observed_at:now,account:'test-only',...other});
  await step('runtime',{evidence:e({client:'codex',workflow_discovered:true,tools_callable:true})});
  await step('connection',{account:'test-only',evidence:e({authenticated:true,entitled:true,threads_connected:true,agent_connected:true})});
  return {base,root,step,e,status:()=>status};
}
test('resume pins identity and refuses stale revision and simulated runtime proof', async()=>{
  const x = await create();
  await assert.rejects(resumeSetup(x.root,0,{event:'pause'},now),/revision/);
  await assert.rejects(x.step('connection',{account:'wrong',evidence:x.e()}),/cannot change/);
  await assert.rejects(x.step('runtime',{evidence:{kind:'simulated'}}),/Observed/);
  assert.equal((await inspectSetup(x.root)).ready,false);
});
test('discovery requires consent, excludes credentials and never follows symlinks', async()=>{
  const x=await create();const docs=path.join(x.base,'Documents');await mkdir(docs);
  await writeFile(path.join(docs,'brand-notes.md'),'private test sample');
  await writeFile(path.join(docs,'brand-password.txt'),'not a real credential');
  await symlink(x.base,path.join(docs,'linked-brand'));
  await assert.rejects(discoverSetupFiles(x.root),/Approve/);
  await x.step('discovery',{consent:true,roots:[docs],exclude:[]});
  const r=await discoverSetupFiles(x.root);
  assert.equal(r.candidates.length,1);assert.equal(r.candidates[0].content_read,false);assert.equal(r.uploaded,false);
});
test('confirmation and processing proof are mandatory; changed facts invalidate readiness',async()=>{
  const x=await create();await x.step('discovery',{consent:true,roots:[x.base],exclude:[]});
  const facts={audience:'runners',voice:'plain',topics:'running',outcome:'share useful lessons',timezone:'Australia/Perth',posts_per_day:1,times:['09:00']};
  const summary={facts,sources:[{reference:'customer-answer',supports:'all fields'}],confirmed_hash:reviewHash(facts),confirmation:'test customer confirmation'};
  await assert.rejects(x.step('summary',{...summary,confirmed_hash:'bad'}),/exact/);
  await x.step('summary',summary);
  await assert.rejects(x.step('brain',{evidence:x.e({summary_hash:summary.confirmed_hash,processing_complete:false})}),/processing/);
  await x.step('brain',{evidence:x.e({summary_hash:summary.confirmed_hash,processing_complete:true,retrieval_verified:true,durable_voice_verified:true})});
  facts.voice='warmer';await x.step('summary',{...summary,facts,confirmed_hash:reviewHash(facts)});
  assert.equal(x.status().brain_ready,false);assert.equal(x.status().paused,true);
});
test('all six targets accepted but no target is ready from installation alone',async()=>{
  for(const client of ['codex','claude','cursor','gemini','openclaw','hermes']) {
    const root=path.join(await mkdtemp(path.join(os.tmpdir(),'tf-client-')),'setup');
    const s=await startSetup(root,{client,version:'0.20.0',install_receipt:'fixture'},now);
    assert.equal(s.ready,false);assert.equal(s.recurring_routine_verified,false);
  }
});
test('routine requires a real-run receipt; overlap, pause and unknown outcomes block continuation',async()=>{
  const x=await create();await x.step('discovery',{consent:true,roots:[x.base],exclude:[]});
  const facts={audience:'runners',voice:'plain',topics:'running',outcome:'share useful lessons',timezone:'Australia/Perth',posts_per_day:1,times:['09:00']};
  const hash=reviewHash(facts);
  await x.step('summary',{facts,sources:[{reference:'customer',supports:'all fields'}],confirmed_hash:hash,confirmation:'fixture confirmation'});
  for (const [event,extra] of Object.entries({brain:{processing_complete:true,retrieval_verified:true,durable_voice_verified:true},offer:{confirmed_none:true},vault:{selection_approved:true,readback_verified:true},voice:{sample_approved:true,sample_hash:'sample'}})) await x.step(event,{evidence:x.e({summary_hash:hash,...extra})});
  await x.step('permission',{mode:'reviewed',confirmed:true,confirmation:'fixture choice'});
  await x.step('week',{evidence:x.e({summary_hash:hash,timezone:facts.timezone,days:7,draft_count:7,content_verified:true,scheduled_count:0})});
  const routine=x.e({permission_id:x.status().permission.id,client:'codex',job_id:'fixture-job',persisted:true,real_run_verified:false,run_id:'fixture-run',next_run:'2026-09-30T00:00:00Z',device_must_stay_on:true,pause_command:'pause fixture job',runner:'native'});
  await assert.rejects(x.step('routine',{evidence:routine}),/real invocation/);
  await x.step('routine-configured',{evidence:routine});
  assert.equal(x.status().ready,false);assert.equal(x.status().posts_scheduled,0);
  const preflight={account:'test-only',timezone:facts.timezone,checked_at:now,connection_ok:true,entitled:true,facts_current:true,allowance_ok:true,calendar_read:true,occupied_instants:[]};
  await x.step('begin-run',{preflight});const run=x.status().pending.id;
  await assert.rejects(x.step('begin-run',{preflight}),/another run/);
  await assert.rejects(x.step('finish-run',{run_id:run,evidence:x.e({outcome:'unknown'})}),/Unknown/);
  await x.step('finish-run',{run_id:run,evidence:x.e({outcome:'confirmed_no_actions',job_id:'fixture-job',runner_run_id:'fixture-run'})});
  await x.step('routine',{evidence:{...routine,real_run_verified:true,local_run_id:run}});
  assert.equal(x.status().ready,true);
  await x.step('routine-configured',{evidence:{...routine,job_id:'replacement-job'}});
  assert.equal(x.status().recurring_routine_verified,false);
  await assert.rejects(x.step('routine',{evidence:{...routine,job_id:'replacement-job',real_run_verified:true,local_run_id:run}}),/matching job/);
  await x.step('pause',{});await assert.rejects(x.step('begin-run',{preflight}),/paused/);
  await x.step('permission',{mode:'automatic',confirmed:true,confirmation:'changed fixture choice'});
  await assert.rejects(x.step('begin-run',{preflight}),/unverified/);
});
