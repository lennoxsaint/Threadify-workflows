#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const weights = {audience_evidence_fit:30,speed_to_valid_signal:25,credible_deliverability_now:20,fulfillment_simplicity:15,scalability:10};
const ids = ['intensive','lab','kit'];
const esc = (v) => String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const hash = (v) => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
function fail(message){ throw new Error(message); }
export function inspect(input){
  if (!['real','demo'].includes(input.mode)) fail('mode must be real or demo');
  if (input.mode === 'real' && input.confirmed !== true) fail('real decisions require confirmed facts');
  for (const key of ['audience','problem','result','boundary']) if (!String(input[key]??'').trim()) fail(`missing ${key}`);
  if (!input.evidence || !Array.isArray(input.evidence.limitations) || !input.evidence.limitations.length) fail('evidence limitations are required');
  const ranked = ids.map((id) => {
    const model=input.models?.[id]; if(!model) fail(`missing model ${id}`);
    const notes=model.notes; if(!Array.isArray(notes)||notes.length!==5||notes.some((n)=>!String(n).trim())) fail(`${id} requires five evidence notes`);
    for(const [key] of Object.entries(weights)){ const score=model.scores?.[key]; if(!Number.isInteger(score)||score<1||score>5) fail(`${id}.${key} must be 1-5`); }
    const weighted_score=Object.entries(weights).reduce((sum,[key,weight])=>sum+model.scores[key]*weight/5,0);
    return {id,name:model.name,weighted_score:Number(weighted_score.toFixed(1)),scores:model.scores,notes};
  }).sort((a,b)=>b.weighted_score-a.weighted_score||b.scores.speed_to_valid_signal-a.scores.speed_to_valid_signal||b.scores.fulfillment_simplicity-a.scores.fulfillment_simplicity||ids.indexOf(a.id)-ids.indexOf(b.id));
  return {status:input.evidence.coverage_complete?'evidence_informed_hypothesis':'constraint_led_hypothesis',ranked,selected:ranked[0]};
}
export function artifacts(input){
  const decision=inspect(input); const selected=decision.selected;
  const map={offer_id:selected.id,offer_name:selected.name,deliverables:['One bounded diagnosis','One reviewed offer statement','One 30-day validation plan'],session_flow:['Evidence and constraints','Offer decision','Truthful boundary','Validation actions'],validation_window_days:30,success_signal:'At least one explicit next-step conversation; not engagement alone',claim_ceiling:'A validation hypothesis, not proof of demand or sales.'};
  const body={workflow_id:'choose-your-first-offer',mode:input.mode,...decision,audience:input.audience,problem:input.problem,result:input.result,boundary:input.boundary,evidence:input.evidence,proof_loop_map:map};
  const markdown=`# Choose Your First Offer\n\nStatus: **${decision.status}**\n\nSelected: **${selected.name}** (${selected.weighted_score}/100)\n\n## Decision\n\n${decision.ranked.map((m,i)=>`${i+1}. ${m.name} — ${m.weighted_score}/100`).join('\n')}\n\n## Promise\n\n${input.result}\n\n## Boundary\n\n${input.boundary}\n\n## Claim ceiling\n\nThis chooses what to validate first. It does not prove demand, willingness to pay, sales, conversion, product-market fit, or virality.\n`;
  const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(selected.name)}</title><style>body{font:18px system-ui;max-width:760px;margin:8vh auto;padding:24px;color:#101828}small{color:#667085}.card{border:1px solid #d0d5dd;border-radius:18px;padding:24px}button{padding:12px 18px;border:0;border-radius:10px;background:#e4e7ec;color:#667085}</style></head><body><small>${input.mode==='demo'?'DEMO — fictional example':esc(decision.status)}</small><h1>${esc(selected.name)}</h1><div class="card"><h2>${esc(input.result)}</h2><p>${esc(input.boundary)}</p><button disabled>Join the interest list</button></div><p><small>Inactive validation page. No demand, sale, or conversion is claimed.</small></p></body></html>`;
  const receipt={workflow_id:'choose-your-first-offer',input_sha256:hash(input),decision_sha256:hash(body),selected_id:selected.id,status:decision.status,external_actions:0,fallback_state:input.evidence.coverage_complete?'not_used':'incomplete_evidence_preserved',raw_evidence_retained:false};
  return {'offer-decision.json':JSON.stringify(body,null,2)+'\n','offer-decision.md':markdown,'validation-page.html':html,'proof-loop-map.json':JSON.stringify(map,null,2)+'\n','receipt.json':JSON.stringify(receipt,null,2)+'\n'};
}
if(import.meta.url===`file://${process.argv[1]}`){ const [inputFile,outDir]=process.argv.slice(2); if(!inputFile||!outDir) fail('usage: choose-offer.mjs INPUT OUTPUT_DIR'); const input=JSON.parse(fs.readFileSync(inputFile,'utf8')); fs.mkdirSync(outDir,{recursive:true}); for(const [name,content] of Object.entries(artifacts(input))) fs.writeFileSync(path.join(outDir,name),content,{flag:'wx'}); console.log(JSON.stringify({output_dir:path.resolve(outDir),...inspect(input)})); }
