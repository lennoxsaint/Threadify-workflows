import {createServer} from 'node:http';
import {randomBytes,randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {performance} from 'node:perf_hooks';

// Serves only one caller-selected review at a time. No directory browsing or external assets.
export async function createReviewObserver({stateDir,timeoutMs=45000}={}) {
  if(!path.isAbsolute(stateDir??''))throw new Error('absolute_review_state_required');
  if(!Number.isFinite(timeoutMs)||timeoutMs<100||timeoutMs>60000)throw new Error('invalid_browser_timeout');
  await fs.mkdir(stateDir,{recursive:true,mode:0o700});
  const realRoot=await fs.realpath(stateDir),prefix=`/${randomBytes(24).toString('hex')}`;
  let origin,current=null,pending=null,ready=false,readyWait=null,closed=false;
  const client=`const frame=document.querySelector('iframe'),status=document.querySelector('#status');let seen='';
    async function post(route,value){const r=await fetch(location.pathname+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});if(!r.ok)throw Error('observer rejected');}
    async function tick(){try{const r=await fetch(location.pathname+'/current',{cache:'no-store'});const c=await r.json();if(c.id&&c.id!==seen){seen=c.id;const began=performance.now();frame.onload=()=>requestAnimationFrame(()=>requestAnimationFrame(async()=>{try{const d=frame.contentDocument;await post('/observed',{id:c.id,cards:d.querySelectorAll('article').length,heading:d.querySelector('h1')?.textContent,elapsed_ms:performance.now()-began});status.textContent='Queue rendered. Waiting for next trial.';}catch{status.textContent='Browser proof failed.';}}));frame.src=location.pathname+'/review/'+c.id;status.textContent='Rendering trial...';}}catch{status.textContent='Observer stopped or unavailable.';}setTimeout(tick,100);}
    post('/ready',{}).then(tick).catch(()=>{status.textContent='Observer unavailable.';});`;
  const shell=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reply First benchmark observer</title><style>body{margin:0;background:#111516;color:#e5f1e9;font:14px system-ui}p{margin:8px 16px}iframe{display:block;width:100%;height:calc(100vh - 38px);border:0}</style><p id="status">Connecting local benchmark observer...</p><iframe title="Current Reply First queue"></iframe><script src="${prefix}/client.js"></script></html>`;
  const server=createServer(async(req,res)=>{
    const send=(code,body='',type='text/plain')=>{res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(body);};
    try {
      if(req.headers.host!==new URL(origin).host || !req.url?.startsWith(prefix))return send(404);
      const route=req.url.slice(prefix.length);
      if(req.method==='GET') {
        if(route==='') {res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; frame-src 'self'; frame-ancestors 'none'; base-uri 'none'");return send(200,shell,'text/html; charset=utf-8');}
        if(route==='/client.js')return send(200,client,'text/javascript');
        if(route==='/current')return send(200,JSON.stringify({id:current?.id??null}),'application/json');
        if(current && route===`/review/${current.id}`)return send(200,current.html,'text/html; charset=utf-8');
        return send(404);
      }
      if(req.method!=='POST'||req.headers.origin!==origin||req.headers['content-type']!=='application/json')return send(403);
      let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>4096)return send(413);}
      let body;try{body=JSON.parse(text);}catch{return send(400);}
      if(route==='/ready'){ready=true;readyWait?.resolve();return send(204);}
      if(route==='/observed'&&current&&pending&&body.id===current.id&&body.cards===current.total&&body.heading==='Reply first.'&&Number.isFinite(body.elapsed_ms)&&body.elapsed_ms>=0) {
        pending.resolve({verified:true,method:'loopback_browser_dom_after_two_frames',cards:body.cards,client_render_ms:body.elapsed_ms,observer_elapsed_ms:performance.now()-current.started,id:current.id});return send(204);
      }
      return send(409);
    }catch{return send(500);}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  origin=`http://127.0.0.1:${server.address().port}`;
  function wait(setter,code) {
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{setter(null);reject(new Error(code));},timeoutMs);
      setter({resolve:value=>{clearTimeout(timer);setter(null);resolve(value);},reject:error=>{clearTimeout(timer);setter(null);reject(error);}});
    });
  }
  return {
    url:origin+prefix,
    async waitForBrowser(){if(closed)throw new Error('browser_observer_closed');if(!ready)await wait(value=>{readyWait=value;},'browser_not_opened');},
    async measureReview(file){
      if(closed||!ready)throw new Error('browser_not_ready');if(pending)throw new Error('browser_trial_already_pending');
      const real=await fs.realpath(file),relative=path.relative(realRoot,real);
      if(relative.startsWith('..')||path.isAbsolute(relative)||path.basename(real)!=='review.html')throw new Error('review_outside_private_state');
      const result=JSON.parse(await fs.readFile(path.join(path.dirname(real),'result.json'),'utf8'));
      if(!Number.isInteger(result.total)||result.total<0||result.rows?.length!==result.total)throw new Error('review_result_invalid');
      const html=await fs.readFile(real,'utf8');
      const waiting=wait(value=>{pending=value;},'browser_render_unverified');
      current={id:randomUUID(),html,total:result.total,started:performance.now()};return waiting;
    },
    async close(){closed=true;pending?.reject(new Error('browser_observer_closed'));readyWait?.reject(new Error('browser_observer_closed'));server.closeAllConnections();await new Promise(resolve=>server.close(resolve));},
  };
}
