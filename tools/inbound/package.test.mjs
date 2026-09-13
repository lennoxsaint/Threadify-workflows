import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root=fileURLToPath(new URL('../../',import.meta.url));
test('package works from an installation path containing spaces',t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'workflow package '));t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const installed=path.join(temp,'Threadify Inbound Replies');
 fs.cpSync(path.join(root,'skills/threadify-inbound-replies'),installed,{recursive:true});
 for(const ref of ['references/workflow-readme.md','references/inbound-contract.md','scripts/cli.mjs','scripts/store.mjs','scripts/server.mjs','scripts/index.html'])assert.equal(fs.existsSync(path.join(installed,ref)),true);
 const window=JSON.parse(execFileSync(process.execPath,[path.join(installed,'scripts/cli.mjs'),'window','--account','@fresh','--root',path.join(temp,'state')],{encoding:'utf8'}));assert.equal(window.preference_required,true);
});
