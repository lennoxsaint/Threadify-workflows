import test from 'node:test';
import assert from 'node:assert/strict';
import {inspect, questionOrder, prepareSave, render, validDestination, verifyReadback} from '../../plugins/threadify/skills/threadify-offer-builder/references/offer-builder.mjs';
const input = {mode:'full', answered:[1,2,3,4,5,6,7,8,9,10],confirmed:true,name:'Page review',buyer:'designers',benefit:'A clear service page',delivery:'Written notes',cta:'Read the details',link:'https://www.threadify.app/plans',type:'other',facts:[]};
const context = {account:'test-account',accountVerified:true,discoveryComplete:true,offers:[]};
test('full and filming paths preserve skipped questions',()=>{assert.equal(questionOrder('full').length,10);assert.deepEqual(questionOrder('filming'),[1,2,3,10]);const s=inspect({...input,mode:'filming',answered:[1,2,3,10]});assert.deepEqual(s.skipped,[4,5,6,7,8,9]);assert.equal(s.interview_complete,true);});
test('vague or incomplete input cannot prepare a save',()=>{for(const changes of [{answered:[1,2,3]},{confirmed:false},{delivery:''},{link:null},{mode:'demo'}])assert.throws(()=>prepareSave({...input,...changes},context));});
test('missing account verification or duplicate discovery blocks',()=>{assert.throws(()=>prepareSave(input,{...context,accountVerified:false}));assert.throws(()=>prepareSave(input,{...context,discoveryComplete:false}));});
test('stable retry key and exact approval invalidation',()=>{const p=prepareSave(input,context);assert.equal(p.status,'awaiting_action_approval');const c={...context,approvedDigest:p.approval_digest};assert.equal(prepareSave(input,c).approved,true);assert.equal(prepareSave(input,c).args.idempotency_key,p.args.idempotency_key);assert.equal(prepareSave({...input,benefit:'Changed'},c).approved,false);assert.equal(prepareSave(input,{...c,account:'another-test-account'}).approved,false);});
test('duplicate ambiguity blocks and updates replace full facts',()=>{const old={...input,offer_id:'fixture-offer',facts:['Old fact']};assert.throws(()=>prepareSave(input,{...context,offers:[old,{...old,offer_id:'second-fixture'}]}));const p=prepareSave(input,{...context,offers:[old]});assert.equal(p.action,'update_offer');assert.deepEqual(p.args.facts,[]);assert.equal(prepareSave(input,{...context,offers:[{...old,facts:[]}]}).action,'no_change');});
test('readback requires exact account, fields and target',()=>{const p=prepareSave(input,{...context,offers:[{...input,offer_id:'fixture-offer',benefit:'Old'}]});const record={...input,offer_id:'fixture-offer'};assert.equal(verifyReadback(p,record,context.account),true);assert.equal(verifyReadback(p,{...record,link:'https://wrong.org'},context.account),false);assert.equal(verifyReadback(p,record,'wrong'),false);assert.equal(verifyReadback(p,{...record,offer_id:'wrong'},context.account),false);});
test('HTML escapes supplied content and omits unsafe links and private notes',()=>{const html=render({...input,name:'<script>alert(1)</script>',link:'javascript:alert(1)',owner_notes:['PRIVATE_NOTE']});assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('href='));assert.ok(!html.includes('PRIVATE_NOTE'));for(const link of ['http://site.org','https://user:pass@site.org','https://example.com','https://localhost'])assert.equal(validDestination(link),false);});
test('mock is visibly labelled and never interview complete',()=>{const demo={...input,mode:'demo'};assert.match(render(demo),/DEMO — fictional example/);assert.equal(inspect(demo).interview_complete,false);assert.throws(()=>prepareSave(demo,context));});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('CLI runs through a symlinked installed path and produces actual artifacts',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'offer-cli-'));
 try {
  const source=fileURLToPath(new URL('../../plugins/threadify/skills/threadify-offer-builder/references',import.meta.url));
  const actual=path.join(root,'actual');fs.cpSync(source,actual,{recursive:true});
  const alias=path.join(root,'alias');fs.symlinkSync(actual,alias,process.platform==='win32'?'junction':'dir');
  const out=path.join(root,'result');
  const result=spawnSync(process.execPath,[path.join(alias,'offer-builder.mjs'),path.join(alias,'example.json'),out],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.match(fs.readFileSync(path.join(out,'offer.html'),'utf8'),/DEMO/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(out,'owner-handoff.json'),'utf8')).save_state,'not_attempted');
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});
