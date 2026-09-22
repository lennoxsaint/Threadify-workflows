import { performance } from 'node:perf_hooks';
import {normalizeInput,hash} from './reply-first.mjs';

function unwrap(result) {
  if (result?.isError) throw new Error('threadify_tool_error');
  const data = result?.structuredContent ?? (result?.content ? JSON.parse(result.content.find(c=>c.type==='text')?.text ?? '{}') : result);
  if (data?.ok !== true || !Array.isArray(data.posts)) throw new Error('threadify_comments_response_invalid');
  return data;
}

// callTool is supplied by the host connection or the authenticated HTTP MCP adapter.
// Process a disclosed bounded window; no guarantee that an unseen older post lacks a new reply.
export function createThreadifySource({ callTool, account, offer, days = 14, postBatch = 10, targetCount = 100, maxPosts = 100, maxPages = 100, concurrency = 4 }) {
  if (typeof callTool !== 'function' || !account || !offer) throw new Error('source_connection_account_offer_required');
  if (![days,postBatch,targetCount,maxPosts,maxPages].every(Number.isInteger) || days<1 || days>90 || postBatch<1 || targetCount<1 || maxPosts<1 || maxPages<1) throw new Error('invalid_source_bounds');
  if(!Number.isInteger(concurrency)||concurrency<1||concurrency>4) throw new Error('invalid_source_concurrency');
  return async () => {
    const started=performance.now(), comments=[], seen=new Map(), reads=[], seenOffsets=new Set(), excludedPosts=[];
    let offset=0, scannedPosts=0, pages=0, exhausted=false;
    const pendingCount=()=>comments.filter(c=>!c.owner_already_replied).length;
    async function read(args) {
      if (++pages>maxPages) throw new Error('source_page_bound_exceeded');
      const start=performance.now(); const data=unwrap(await callTool('list_comments',{account,...args}));
      reads.push({ elapsed_ms:performance.now()-start,post_count:data.posts.length,comment_count:data.posts.reduce((n,p)=>n+(p.comments?.length??0),0) });
      return data;
    }
    function accept(group, parent) {
      const post=group.post??parent;
      if (!post || typeof post.text!=='string' || !post.permalink || !Array.isArray(group.comments)) throw new Error('source_parent_context_missing');
      for (const c of group.comments) {
        if(c.is_my_reply===true) continue;
        if(typeof c.owner_already_replied!=='boolean') throw new Error('source_handled_state_unknown');
        const row={id:c.comment_id,text:c.text,parent_text:post.text,url:c.permalink,parent_url:post.permalink,created_at:c.timestamp,owner_already_replied:c.owner_already_replied};
        if(seen.has(row.id)) {
          if(JSON.stringify(seen.get(row.id))!==JSON.stringify(row)) throw new Error('source_changed_during_retrieval');
        } else { seen.set(row.id,row); comments.push(row); }
      }
    }
    while (pendingCount()<targetCount && scannedPosts<maxPosts) {
      if(seenOffsets.has(offset)) throw new Error('source_repeated_post_cursor'); seenOffsets.add(offset);
      const data=await read({days,limit:Math.min(postBatch,maxPosts-scannedPosts),posts_offset:offset,include_my_replies:false});
      scannedPosts+=data.posts.length;
      for(let start=0;start<data.posts.length && pendingCount()<targetCount;start+=concurrency) {
        const wave=data.posts.slice(start,start+concurrency);
        const results=await Promise.all(wave.map(async group=>{
          if(group.post?.media_type!=='TEXT_POST') {
            return {excluded:{post_id:group.post?.post_id??null,reason:'visual_or_unknown_parent_context_unavailable'}};
          }
          if(!Array.isArray(group.comments)) throw new Error('source_comments_missing');
          const groups=[group],localIds=new Set(group.comments.filter(c=>!c.is_my_reply&&!c.owner_already_replied).map(c=>c.comment_id));
          let cursor=group.next_cursor,more=group.has_more_comments;const cursors=new Set();
          while(more && localIds.size<targetCount) {
            if(!cursor || cursors.has(cursor)) throw new Error('source_repeated_comment_cursor');cursors.add(cursor);
            const next=await read({post_id:group.post.post_id,cursor,include_my_replies:false});
            if(next.posts.length!==1 || next.posts[0].post?.post_id!==group.post.post_id) throw new Error('source_post_identity_mismatch');
            if(next.posts[0].post.text!==group.post.text || next.posts[0].post.permalink!==group.post.permalink) throw new Error('source_parent_changed_during_retrieval');
            const page=next.posts[0];if(!Array.isArray(page.comments)) throw new Error('source_comments_missing');
            groups.push(page);for(const c of page.comments)if(!c.is_my_reply&&!c.owner_already_replied)localIds.add(c.comment_id);
            cursor=page.next_cursor;more=page.has_more_comments;
          }
          return {groups};
        }));
        // Stable provider order, never completion order; bound over-reading to the current wave.
        for(const result of results) {
          if(result.excluded) excludedPosts.push(result.excluded);
          else for(const group of result.groups) accept(group);
        }
      }
      if(data.posts_offset_next===null) { exhausted=true; break; }
      if(!Number.isInteger(data.posts_offset_next) || data.posts_offset_next<=offset) throw new Error('source_invalid_post_cursor');
      offset=data.posts_offset_next;
    }
    const pending=comments.filter(c=>!c.owner_already_replied).slice(0,targetCount);
    return {account,offer,comments:pending,source:{kind:'threadify_owned_comments',days,scanned_posts:scannedPosts,reads,elapsed_ms:performance.now()-started,target_count:targetCount,selected_count:pending.length,
      bounded_selection:true,selection:'first unhandled text-parent comments in provider post and comment pagination order',retrieval_concurrency:concurrency,excluded_posts:excludedPosts,overread_pending:Math.max(0,pendingCount()-targetCount),post_window_exhausted:exhausted,all_comments_exhausted:false,excluded_handled:comments.length-comments.filter(c=>!c.owner_already_replied).length}};
  };
}

// Benchmark-only source: freshly retrieve a predeclared cohort, never substitute newer items.
export function createFrozenThreadifySource({callTool,input,manifest,concurrency=4,maxPages=100}) {
  const frozen=normalizeInput(input);
  if(typeof callTool!=='function'||manifest?.input_hash!==hash(frozen)||!Array.isArray(manifest.posts))throw new Error('frozen_source_manifest_mismatch');
  if(!Number.isInteger(concurrency)||concurrency<1||concurrency>4||!Number.isInteger(maxPages)||maxPages<1)throw new Error('invalid_source_bounds');
  const groups=new Map();for(const row of frozen.comments){if(!groups.has(row.parent_url))groups.set(row.parent_url,[]);groups.get(row.parent_url).push(row);}
  const postMap=new Map();
  for(const post of manifest.posts){
    if(typeof post.post_id!=='string'||!post.post_id||!groups.has(post.parent_url)||postMap.has(post.parent_url))throw new Error('frozen_source_post_manifest_invalid');
    postMap.set(post.parent_url,post.post_id);
  }
  if(postMap.size!==groups.size||new Set(postMap.values()).size!==postMap.size)throw new Error('frozen_source_post_coverage_invalid');
  const bulkPages=manifest.discovery_pages??[];
  const validDiscovery=p=>{
    if(!p||Object.keys(p).some(k=>!['days','limit','posts_offset','post_ids'].includes(k))||!Number.isInteger(p.limit)||p.limit<1||p.limit>30||!Number.isInteger(p.posts_offset)||p.posts_offset<0)return false;
    if(p.post_ids!==undefined)return p.days===undefined&&Array.isArray(p.post_ids)&&p.post_ids.length>0&&p.post_ids.length<=30&&new Set(p.post_ids).size===p.post_ids.length&&p.post_ids.every(id=>[...postMap.values()].includes(id));
    return Number.isInteger(p.days)&&p.days>=1&&p.days<=90;
  };
  if(!Array.isArray(bulkPages)||bulkPages.length>4||bulkPages.some(p=>!validDiscovery(p)))throw new Error('frozen_source_discovery_bounds_invalid');
  return async()=>{
    const started=performance.now(),reads=[],found=new Map(),entries=[...groups.entries()];let next=0,pages=0,failure;
    const firstPages=new Map();
    const accept=(group,parentUrl,postId,expected)=>{
      const post=group.post;
      if(post?.post_id!==postId||post.permalink!==parentUrl||post.media_type!=='TEXT_POST'||!Array.isArray(group.comments))throw new Error('frozen_source_parent_mismatch');
      const wanted=new Map(expected.map(c=>[c.id,c]));
      for(const comment of group.comments){
        const truth=wanted.get(comment.comment_id);if(!truth)continue;
        if(comment.is_my_reply||comment.owner_already_replied!==false)throw new Error('frozen_comment_no_longer_pending');
        const row={id:comment.comment_id,text:comment.text,parent_text:post.text,url:comment.permalink,parent_url:post.permalink,created_at:comment.timestamp,owner_already_replied:comment.owner_already_replied};
        if(hash(row)!==hash(truth))throw new Error('frozen_comment_changed');found.set(row.id,row);
      }
    };
    // Optional predeclared bulk discovery avoids one full HTTP round trip per parent.
    // Exact frozen IDs/context remain the acceptance criteria, not broad-window contents.
    for(let i=0;i<bulkPages.length;i+=concurrency){
      const wave=await Promise.all(bulkPages.slice(i,i+concurrency).map(async plan=>{
        if(++pages>maxPages)throw new Error('source_page_bound_exceeded');const began=performance.now();
        const data=unwrap(await callTool('list_comments',{account:frozen.account,...plan,include_my_replies:false}));
        reads.push({kind:'bulk_discovery',...plan,elapsed_ms:performance.now()-began});return data;
      }));
      for(const data of wave)for(const group of data.posts){
        const url=group.post?.permalink;if(!groups.has(url))continue;
        accept(group,url,postMap.get(url),groups.get(url));firstPages.set(url,group);
      }
    }
    await Promise.all(Array.from({length:Math.min(concurrency,entries.length)},async()=>{
      try{for(;;){
        if(failure)return;const index=next++;if(index>=entries.length)return;
        const [parentUrl,expected]=entries[index],postId=postMap.get(parentUrl),seenCursors=new Set();let cursor;
        if(expected.every(c=>found.has(c.id)))continue;
        if(firstPages.has(parentUrl)){
          const initial=firstPages.get(parentUrl);if(!initial.has_more_comments)throw new Error('frozen_comment_missing');
          cursor=initial.next_cursor;if(!cursor)throw new Error('source_repeated_comment_cursor');seenCursors.add(cursor);
        }
        do{
          if(failure)return;if(++pages>maxPages)throw new Error('source_page_bound_exceeded');
          const began=performance.now();
          const data=unwrap(await callTool('list_comments',{account:frozen.account,post_id:postId,include_my_replies:false,...(cursor?{cursor}:{})}));
          reads.push({post_id:postId,elapsed_ms:performance.now()-began});
          if(data.posts.length!==1)throw new Error('frozen_source_post_missing');
          const group=data.posts[0];accept(group,parentUrl,postId,expected);
          if(expected.every(c=>found.has(c.id)))break;
          if(!group.has_more_comments)throw new Error('frozen_comment_missing');
          cursor=group.next_cursor;if(!cursor||seenCursors.has(cursor))throw new Error('source_repeated_comment_cursor');seenCursors.add(cursor);
        }while(true);
      }}catch(e){failure??=e;}
    }));
    if(failure)throw failure;
    return {account:frozen.account,offer:frozen.offer,comments:frozen.comments.map(c=>found.get(c.id)),source:{kind:'fresh_frozen_cohort',input_hash:manifest.input_hash,reads,elapsed_ms:performance.now()-started,selected_count:found.size,post_count:groups.size,retrieval_concurrency:concurrency,scope:'only the predeclared frozen IDs; not all recent comments'}};
  };
}

export function createMcpReader({ token, url='https://www.threadify.app/api/mcp/threadify', fetchImpl=fetch }) {
  if(!token) throw new Error('threadify_credential_missing');
  if(new URL(url).protocol!=='https:') throw new Error('threadify_https_required');
  let session, initialization, requestId=0;
  async function rpc(method,params,notification=false) {
    const id = ++requestId;
    const res=await fetchImpl(url,{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',Accept:'application/json, text/event-stream',...(session?{'Mcp-Session-Id':session}:{})},
      body:JSON.stringify({jsonrpc:'2.0',...(notification?{}:{id}),method,params}),signal:AbortSignal.timeout(20000)});
    if(!res.ok) throw new Error(`threadify_http_${res.status}`);
    session=res.headers.get('mcp-session-id')??session;
    if(notification || res.status===202) return;
    const text=await res.text(); let data;
    if(res.headers.get('content-type')?.includes('text/event-stream')) {
      const events=text.split('\n').filter(line=>line.startsWith('data:')).map(line=>JSON.parse(line.slice(5).trim()));
      data=events.find(event=>event.id===id);
    } else data=JSON.parse(text);
    if(!data || data.error) throw new Error('threadify_rpc_error');
    return data.result;
  }
  return async(name,args)=>{
    if(name!=='list_comments') throw new Error('read_only_source_tool_rejected');
    initialization??=(async()=>{await rpc('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'threadify-reply-first',version:'0.1.0'}});await rpc('notifications/initialized',{},true);})();
    await initialization;
    return rpc('tools/call',{name,arguments:args});
  };
}
