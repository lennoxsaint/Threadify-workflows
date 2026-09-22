import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrozenThreadifySource,createMcpReader} from '../../lib/reply-first-source.mjs';
import {normalizeInput,hash} from '../../lib/reply-first.mjs';
const comment={id:'c',text:'A question',parent_text:'Parent',url:'https://example.invalid/c',parent_url:'https://example.invalid/p',created_at:'2026-09-22T00:00:00Z',owner_already_replied:false};
const input={account:'synthetic',offer:'guide',comments:[comment]};
const manifest={input_hash:hash(normalizeInput(input)),posts:[{post_id:'p',parent_url:comment.parent_url}]};
const group=()=>({post:{post_id:'p',permalink:comment.parent_url,text:comment.parent_text,media_type:'TEXT_POST'},comments:[{comment_id:'c',text:comment.text,permalink:comment.url,timestamp:comment.created_at,owner_already_replied:false}],has_more_comments:false});

test('frozen cohort paginates fresh reads and returns exact hash; each invocation refetches',async()=>{
  let calls=0;
  const source=createFrozenThreadifySource({input,manifest,callTool:async(name,args)=>{
    calls++;assert.equal(name,'list_comments');assert.equal(args.post_id,'p');
    return {ok:true,posts:[args.cursor?group():{...group(),comments:[],has_more_comments:true,next_cursor:'second'}]};
  }});
  assert.equal(hash(normalizeInput(await source())),manifest.input_hash);await source();assert.equal(calls,4);
});
test('frozen cohort refuses changes, handled or missing items, wrong parent and bad manifest',async()=>{
  for(const [mutate,pattern]of [
    [g=>{g.comments[0].text='Changed';},/frozen_comment_changed/],
    [g=>{g.comments[0].owner_already_replied=true;},/no_longer_pending/],
    [g=>{g.comments=[];},/frozen_comment_missing/],
    [g=>{g.post.post_id='other';},/parent_mismatch/],
  ]){
    const source=createFrozenThreadifySource({input,manifest,callTool:async()=>{const g=group();mutate(g);return {ok:true,posts:[g]};}});
    await assert.rejects(source(),pattern);
  }
  assert.throws(()=>createFrozenThreadifySource({input,manifest:{...manifest,input_hash:'wrong'},callTool:async()=>{}}),/manifest_mismatch/);
});
test('concurrent MCP reads share one initialization and preserve their request IDs',async()=>{
  const calls=[];
  const reader=createMcpReader({token:'synthetic',fetchImpl:async(url,options)=>{
    const body=JSON.parse(options.body);calls.push(body);
    await new Promise(r=>setTimeout(r,2));
    return new Response(JSON.stringify({jsonrpc:'2.0',id:body.id,result:{ok:true,posts:[]}}),{status:200,headers:{'Content-Type':'application/json'}});
  }});
  await Promise.all(Array.from({length:4},()=>reader('list_comments',{})));
  assert.equal(calls.filter(c=>c.method==='initialize').length,1);assert.equal(calls.filter(c=>c.method==='notifications/initialized').length,1);assert.equal(calls.filter(c=>c.method==='tools/call').length,4);
  assert.equal(new Set(calls.map(c=>c.id).filter(Boolean)).size,5);
});
test('declared bulk discovery satisfies the exact cohort without per-post refetches',async()=>{
  let calls=0;
  const source=createFrozenThreadifySource({input,manifest:{...manifest,discovery_pages:[{days:14,limit:30,posts_offset:0}]},callTool:async(name,args)=>{
    calls++;assert.equal(args.post_id,undefined);assert.equal(args.limit,30);return {ok:true,posts:[group()]};
  }});
  const result=await source();assert.equal(calls,1);assert.equal(hash(normalizeInput(result)),manifest.input_hash);
  assert.equal(result.source.reads[0].kind,'bulk_discovery');
});
test('exact parent discovery forwards only frozen IDs and rejects invalid scopes',async()=>{
  const plan={post_ids:['p'],limit:30,posts_offset:0};let calls=0;
  const source=createFrozenThreadifySource({input,manifest:{...manifest,discovery_pages:[plan]},callTool:async(name,args)=>{
    calls++;assert.deepEqual(args.post_ids,['p']);assert.equal(args.days,undefined);return {ok:true,posts:[group()]};
  }});
  assert.equal(hash(normalizeInput(await source())),manifest.input_hash);assert.equal(calls,1);
  for(const bad of [{...plan,post_ids:[]},{...plan,post_ids:['p','p']},{...plan,post_ids:['foreign']},{...plan,days:14},{...plan,limit:31}]){
    assert.throws(()=>createFrozenThreadifySource({input,manifest:{...manifest,discovery_pages:[bad]},callTool:async()=>{}}),/discovery_bounds_invalid/);
  }
});
