import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {artifacts,inspect} from '../../plugins/threadify/skills/threadify-choose-your-first-offer/scripts/choose-offer.mjs';

const notes=['Audience evidence note','Speed note','Delivery note','Fulfillment note','Scale note'];
const input={mode:'real',confirmed:true,audience:'Independent experts',problem:'They do not know what to sell first',result:'One bounded offer hypothesis and a 30-day validation plan',boundary:'No demand, sales, or conversion claim',evidence:{coverage_complete:true,summary:'Reviewed niche report and complete aggregate evidence.',limitations:['Engagement indicates resonance, not purchase intent.']},models:{intensive:{name:'Audience Signal Intensive',scores:{audience_evidence_fit:5,speed_to_valid_signal:5,credible_deliverability_now:5,fulfillment_simplicity:5,scalability:2},notes},lab:{name:'Proof Loop Lab',scores:{audience_evidence_fit:4,speed_to_valid_signal:3,credible_deliverability_now:3,fulfillment_simplicity:3,scalability:4},notes},kit:{name:'Proof Loop Kit',scores:{audience_evidence_fit:3,speed_to_valid_signal:2,credible_deliverability_now:2,fulfillment_simplicity:2,scalability:5},notes}}};
test('fixed scorecard selects the intensive',()=>{const out=inspect(input);assert.equal(out.selected.id,'intensive');assert.equal(out.status,'evidence_informed_hypothesis');assert.deepEqual(out.ranked.map(x=>x.id),['intensive','lab','kit']);});
test('incomplete evidence stays explicit',()=>{assert.equal(inspect({...input,evidence:{...input.evidence,coverage_complete:false}}).status,'constraint_led_hypothesis');});
test('real input requires confirmation and five notes',()=>{assert.throws(()=>inspect({...input,confirmed:false}));assert.throws(()=>inspect({...input,models:{...input.models,kit:{...input.models.kit,notes:['one']}}}));});
test('artifacts keep CTA inactive and escape content',()=>{const out=artifacts({...input,result:'<script>bad</script>'});assert.match(out['validation-page.html'],/&lt;script&gt;/);assert.doesNotMatch(out['validation-page.html'],/<script>/);assert.match(out['validation-page.html'],/button disabled/);assert.equal(JSON.parse(out['receipt.json']).external_actions,0);});
test('both evidence states end with an optional Sites handoff without external effects',()=>{
  for(const coverage_complete of [true,false]){
    const out=artifacts({...input,evidence:{...input.evidence,coverage_complete}});
    assert.match(out['offer-decision.md'],/Would you like me to create a ChatGPT Sites landing page/);
    assert.match(out['offer-decision.md'],/public deployment and Threads publishing are separate choices/);
    assert.equal(JSON.parse(out['receipt.json']).external_actions,0);
    assert.match(out['validation-page.html'],/button disabled/);
    assert.equal(Object.keys(out).length,5);
  }
});
test('CLI produces five artifacts from installed paths',()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'offer-decision-'));try{const inputFile=path.join(root,'input.json');const output=path.join(root,'output');fs.writeFileSync(inputFile,JSON.stringify(input));const result=spawnSync(process.execPath,['plugins/threadify/skills/threadify-choose-your-first-offer/scripts/choose-offer.mjs',inputFile,output],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.deepEqual(fs.readdirSync(output).sort(),['offer-decision.json','offer-decision.md','proof-loop-map.json','receipt.json','validation-page.html']);}finally{fs.rmSync(root,{recursive:true,force:true});}});
