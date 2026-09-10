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
 const installed=path.join(temp,'Threadify Workflows');
 fs.cpSync(root,installed,{recursive:true,filter:source=>!['.git','node_modules','.codex'].includes(path.basename(source))});
 const result=execFileSync(process.execPath,[path.join(installed,'validation/schema-checks/validate.mjs')],{encoding:'utf8'});assert.match(result,/validation passed/);
 const skill=path.join(installed,'plugins/threadify/skills/threadify-inbound-replies');
 for(const ref of ['../../../../workflows/inbound-replies/README.md','../../../../workflows/inbound-replies/CONTRACT.md','../../../../tools/inbound/cli.mjs'])assert.equal(fs.existsSync(path.resolve(skill,ref)),true);
 const window=JSON.parse(execFileSync(process.execPath,[path.join(installed,'tools/inbound/cli.mjs'),'window','--account','@fresh','--root',path.join(temp,'state')],{encoding:'utf8'}));assert.equal(window.preference_required,true);
});
