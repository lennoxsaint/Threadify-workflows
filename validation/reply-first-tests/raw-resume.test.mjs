import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {runReplyFirst} from '../../lib/reply-first.mjs';
const input={account:'synthetic',offer:'writing guide',comments:[{id:'c0',text:'How?',parent_text:'A guide.',url:'https://example.invalid/c0',parent_url:'https://example.invalid/p0',created_at:'2026-09-22T00:00:00Z',owner_already_replied:false}]};
test('crash after raw response persistence resumes without repeating classification',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'raw-resume-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const moduleUrl=new URL('../../lib/reply-first.mjs',import.meta.url).href;
 const child=spawn(process.execPath,['--input-type=module','-e',`
  import {runReplyFirst} from ${JSON.stringify(moduleUrl)};
  const adapter={model:'synthetic',provider:'test',privacy:'non-zdr',evaluate:async batch=>({raw:batch.map(c=>({id:c.id,category:'direct_question',relevant:true,confidence:null})),attempts:[]}),decode:()=>{process.send('raw-persisted');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);}};
  await runReplyFirst({input:${JSON.stringify(input)},adapter,stateDir:${JSON.stringify(dir)},preflight:false});
 `],{stdio:['ignore','ignore','pipe','ipc']});
 t.after(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');});
 const [message]=await once(child,'message',{signal:AbortSignal.timeout(5000)});assert.equal(message,'raw-persisted');
 const exited=once(child,'exit');child.kill('SIGKILL');await exited;
 let calls=0;const adapter={model:'synthetic',provider:'test',privacy:'non-zdr',evaluate:async batch=>{calls++;return{raw:batch.map(c=>({id:c.id,category:'direct_question',relevant:true,confidence:null})),attempts:[]};},decode:raw=>raw};
 const resumed=await runReplyFirst({input,adapter,stateDir:dir,preflight:false});
 assert.equal(calls,0);assert.equal(resumed.status,'complete');assert.equal(resumed.cached_count,1);assert.equal(resumed.external_action_count,0);assert.equal(resumed.fallback_used,false);
 const uncached=await runReplyFirst({input,adapter,stateDir:dir,preflight:false,cache:false});
 assert.equal(calls,1);assert.equal(uncached.cached_count,0);
 const changed=await runReplyFirst({input:{...input,offer:'different offer'},adapter,stateDir:dir,preflight:false});
 assert.equal(calls,2);assert.equal(changed.cached_count,0);
});
