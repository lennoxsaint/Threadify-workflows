import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { transition as step, revision, persist } from '../../plugins/threadify/skills/threadify-run-my-threads/scripts/run-state.mjs';
const at = '2030-01-01T00:00:00Z';
const init = () => step(null, { type:'init', account:'@example', expires:'2030-01-02T00:00:00Z', slots:[{ id:'a',time:'2030-01-01T08:00:00Z' },{id:'b',time:'2030-01-01T10:00:00Z'}] });
const assignment = { source:{url:'https://example.org/post/1',text:'An actual synthetic fixture.',performance:{likes:100},observed_at:at},template:'[cause] changes [result]',adaptation:'A source-grounded adaptation.',angle:'cause',mechanism:'withheld cause',proof:'experiment-1' };
const assigned = () => step(init(),{type:'assign',slot:'a',assignment});
function ready(parts=['A hook.\n1. useful detail'], plug='visit example.org/Home') {
 let s=step(assigned(),{type:'begin',slot:'a',marker:'attempt-1',at});
 s=step(s,{type:'result',slot:'a',draft_id:'draft-1',parts,plug});
 return step(s,{type:'hold',slot:'b',reason:'no source'});
}
test('source/template/adaptation required, repeated proof rejected, missing slot held independently',()=>{
 assert.throws(()=>step(init(),{type:'assign',slot:'a',assignment:{}}),/missing_source/);
 assert.throws(()=>step(assigned(),{type:'assign',slot:'b',assignment:{...assignment,angle:'other',mechanism:'other'}}),/proof/);
 assert.equal(ready().slots[0].status,'ready');
});
test('three deletion requests and hook-only revision preserve unrelated parts, CTA and time',()=>{
 for(const selected of ['a redundant transition.','an unnecessary analogy.','an extra punchline.']){
  const original=`A hook.\n${selected}\n1. useful detail`;
  let s=ready([original,'another unchanged part']); const old=revision(s);
  s=step(s,{type:'approve',hash:old,at});
  s=step(s,{type:'edit',slot:'a',instruction:'delete this',edits:[{part:0,start:8,end:8+selected.length,expected:selected,replacement:''}]});
  assert.equal(s.slots[0].parts[0],original.replace(selected,''));
  assert.equal(s.slots[0].parts[1],'another unchanged part');assert.equal(s.slots[0].plug,'visit example.org/Home');
  assert.equal(s.slots[0].time,'2030-01-01T08:00:00Z');assert.equal(s.approval,null);assert.notEqual(revision(s),old);assert.equal(s.history.length,1);
 }
 let s=ready();s=step(s,{type:'edit',slot:'a',instruction:'change only the hook',scope:'hooks',hook_end:7,edits:[{part:0,start:0,end:7,expected:'A hook.',replacement:'What changed?'}]});
 assert.equal(s.slots[0].parts[0],'What changed?\n1. useful detail');
 assert.throws(()=>step(s,{type:'edit',slot:'a',instruction:'hook',scope:'hooks',hook_end:13,edits:[{part:0,start:14,end:15,expected:'1',replacement:'2'}]}),/outside_hook/);
});
test('timeout recovery uses exact marker and account; no confident match falls back only after complete lookup',()=>{
 let s=step(assigned(),{type:'begin',slot:'a',marker:'unique',at});
 s=step(s,{type:'failure',slot:'a',category:'timeout',error:'timed out'});
 const recovered=step(s,{type:'recover',slot:'a',complete:true,drafts:[{account:'@example',marker:'unique',created_at:at,draft_id:'saved',parts:['saved copy']}]});
 assert.equal(recovered.slots[0].parts[0],'saved copy');assert.equal(recovered.slots[0].attempts[0].reported_model,'not reported');
 assert.throws(()=>step(recovered,{type:'begin',slot:'a',marker:'again',at}),/not_generatable/);
 assert.equal(step(s,{type:'recover',slot:'a',complete:false,drafts:[]}).slots[0].status,'held');
 s=step(s,{type:'recover',slot:'a',complete:true,drafts:[]});s=step(s,{type:'begin',slot:'a',marker:'fallback',at});
 assert.equal(s.slots[0].attempts[1].requested_model,'gemini');
 s=step(s,{type:'failure',slot:'a',category:'provider',error:'failed'});assert.equal(s.slots[0].status,'held');
});
test('casing is separate and protects nouns, acronyms, bare URL paths and reposts',()=>{
 let s=ready(['I Use Threadify AI at example.org/MyPath']);s=step(s,{type:'casing',slot:'a',choice:'lowercase',keep:['Threadify','AI']});
 assert.equal(s.slots[0].parts[0],'i use Threadify AI at example.org/MyPath');
 s=step(init(),{type:'repost',slot:'a',eligible:true,source_id:'published',parts:['Keep THIS']});
 assert.deepEqual(step(s,{type:'casing',slot:'a',choice:'lowercase'}).slots[0].parts,['Keep THIS']);
 assert.throws(()=>step(s,{type:'edit',slot:'a',instruction:'edit',edits:[{}]}),/invalid_edit/);
});
test('latest exact approval, expiry, conflict and mismatched readback fail closed',()=>{
 let s=ready(); const schedule={type:'schedule',slot:'a',at,account:'@example',calendar_complete:true,occupied:[]};
 assert.throws(()=>step(s,schedule),/not_approved/);s=step(s,{type:'approve',hash:revision(s),at});
 assert.throws(()=>step(s,{...schedule,occupied:['2030-01-01T08:30:00Z']}),/occupied/);
 assert.throws(()=>step(s,{...schedule,at:'2030-01-03T00:00:00Z'}),/not_approved/);
 s=step(s,schedule);const key=s.slots[0].schedule.key;assert.equal(step(s,schedule).slots[0].schedule.key,key);
 s=step(s,{type:'readback',slot:'a',id:'external',account:'@example',time:s.slots[0].time,parts:['wrong'],list_verified:true});assert.equal(s.slots[0].schedule.status,'mismatch');
});
test('atomic persisted partial success survives restart and rejects stale revisions',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rmt-')); const file=path.join(dir,'run.json');
 try { persist(file,{type:'init',account:'@example',expires:'2030-01-02',slots:[{id:'a',time:at}]});
 persist(file,{type:'assign',slot:'a',assignment});persist(file,{type:'begin',slot:'a',marker:'one',at});persist(file,{type:'result',slot:'a',draft_id:'saved',parts:['copy']});
 assert.equal(JSON.parse(fs.readFileSync(file)).slots[0].draft_id,'saved');assert.throws(()=>persist(file,{type:'hold',slot:'a',reason:'x',expected_hash:'old'}),/concurrent_revision/);
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('edited text is the scheduled text and verified schedules cannot replay or mutate',()=>{
 let s=ready(['Old hook.\nBody stays.']);
 const old=revision(s); s=step(s,{type:'approve',hash:old,at});
 s=step(s,{type:'edit',slot:'a',instruction:'replace the hook',scope:'hooks',hook_end:9,edits:[{part:0,start:0,end:9,expected:'Old hook.',replacement:'New hook.'}]});
 assert.throws(()=>step(s,{type:'approve',hash:old,at}),/stale/);
 s=step(s,{type:'approve',hash:revision(s),at});
 const schedule={type:'schedule',slot:'a',at,account:'@example',calendar_complete:true,occupied:[]};s=step(s,schedule);
 assert.deepEqual(s.slots[0].schedule.parts,['New hook.\nBody stays.']);
 s=step(s,{type:'readback',slot:'a',id:'external',account:'@example',time:s.slots[0].time,parts:s.slots[0].parts,plug:s.slots[0].plug,list_verified:true});
 assert.equal(s.slots[0].schedule.status,'verified');assert.throws(()=>step(s,schedule),/already_resolved/);
 assert.throws(()=>step(s,{type:'hold',slot:'a',reason:'change'}),/already_started/);
});
test('a failed second slot cannot hide first-slot success and ambiguous matches hold',()=>{
 let s=ready();s=step(s,{type:'assign',slot:'b',assignment:{...assignment,angle:'second',mechanism:'contrast',proof:'experiment-2'}});
 s=step(s,{type:'begin',slot:'b',marker:'second',at});s=step(s,{type:'failure',slot:'b',category:'timeout',error:'timeout'});
 const candidate={account:'@example',marker:'second',created_at:at,draft_id:'one',parts:['copy']};
 s=step(s,{type:'recover',slot:'b',complete:true,drafts:[candidate,{...candidate,draft_id:'two'}]});
 assert.equal(s.slots[0].draft_id,'draft-1');assert.equal(s.slots[1].status,'held');
 assert.equal(s.slots[1].attempts[0].error,'timeout');
});
