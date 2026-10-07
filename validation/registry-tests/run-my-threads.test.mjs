import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const base='plugins/threadify/skills/threadify-run-my-threads/';
const read=p=>fs.readFileSync(base+p,'utf8');
test('Run My Threads declares source reads and saved draft recovery without publishing or external vault dependency',()=>{
 const m=JSON.parse(fs.readFileSync('workflows/run-my-threads/manifest.json'));
 for(const tool of ['get_post_thread','list_drafts','get_draft','validate_post','get_schedule_status']) assert.ok(m.required_mcp_tools.includes(tool));
 assert.ok(m.optional_mcp_tools.includes('get_vault_item'));
 for(const tool of ['publish_now','edit_draft','reschedule_post','search_corpus']) assert.ok(!m.required_mcp_tools.includes(tool));
});
test('single fallback configuration and scoped edit policy replace automatic editorial loops',()=>{
 assert.deepEqual(JSON.parse(read('references/generation-models.json')).fallback_chain,['claude-opus','gemini']);
 const skill=read('SKILL.md');assert.match(skill,/only explicitly owner-requested/);assert.match(skill,/Never publish now/);assert.match(skill,/latest revision hash/);assert.match(skill,/Hold invalid text unchanged/);
 assert.doesNotMatch(skill,/ask Threadify once for a replacement|Never write, rewrite, shorten|scripts\/hook-check/);
});
test('public writing rules and schedule template carry source-based formats, not personal branding',()=>{
 const text=read('references/threads-playbook.md');
 for(const phrase of ['exactly one','exactly three','numbered list','22–48','30%','two open loops']) assert.ok(text.includes(phrase));
 assert.doesNotMatch(text,/lennox|borrowed life|threadify\.app\/home/i);
 assert.match(read('references/hook-bank.md'),/hold the affected slot/);
 assert.match(read('references/daily-schedule.md'),/exactly one host schedule/);
 assert.match(read('references/daily-schedule.md'),/Policy: read/);
});
test('synthetic prompt examples encode the requested short, list and thread structures',()=>{
 const short='Something changed overnight.\nThe experiment explains why.';
 const list='One habit hid the answer.\n1. Record the attempt.\n2. Compare the result.';
 const opening='Something disappeared. The next attempt exposed the missing step. Tap to see the three checks that found it:';
 assert.equal(short.split('\n')[0].match(/[.!?]/g).length,1);
 assert.match(list,/^[^\n]+\n1\. /);
 assert.equal(opening.match(/[.!?:]/g).length,3);assert.ok(opening.endsWith(':'));
});
