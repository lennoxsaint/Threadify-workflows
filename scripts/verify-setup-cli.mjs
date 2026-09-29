#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const cli=fileURLToPath(new URL('../bin/threadify-workflows.mjs',import.meta.url));
const root=path.join(realpathSync(mkdtempSync(path.join(tmpdir(),'threadify-cli-proof-'))),'private');
function run(command,input={},revision) {
 const args=[cli,'setup',command,'--state',root];
 if(revision!==undefined) args.push('--revision',String(revision));
 return spawnSync(process.execPath,args,{input:JSON.stringify(input),encoding:'utf8'});
}
const first=run('start',{client:'codex',version:'0.21.0',install_receipt:'local-cli-check-only'});
assert.equal(first.status,0,first.stderr);const started=JSON.parse(first.stdout);
const resumed=run('status');assert.equal(resumed.status,0,resumed.stderr);
assert.equal(JSON.parse(resumed.stdout).session_id,started.session_id);
const paused=run('resume',{event:'pause'},started.revision);assert.equal(paused.status,0,paused.stderr);
const stale=run('resume',{event:'pause'},started.revision);assert.notEqual(stale.status,0);
const verify=run('verify');assert.equal(verify.status,0,verify.stderr);
const report=JSON.parse(verify.stdout);assert.equal(report.ready,false);assert.equal(report.paused,true);
assert.equal(report.recurring_routine_verified,false);
console.log(JSON.stringify({result:'passed',proof:'real_separate_cli_processes',state:root,restart_resume:true,stale_write_refused:true,pause_persisted:true,live_account:'not_tested',readiness_claimed:false},null,2));
