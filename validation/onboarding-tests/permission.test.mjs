import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertStandingPermission, assertCalendarCapacity } from '../../lib/creator/standing-permission.mjs';
import { reviewHash } from '../../lib/creator/review.mjs';
const now='2026-09-29T00:00:00Z';
function fixture() {
  const facts={timezone:'Australia/Perth',times:['09:00'],topics:'running',posts_per_day:1};
  const s={kind:'threadify-setup.v1',paused:false,account:'a',pending:{id:'run',permission_id:'p'},summary:{facts},permission:{id:'p',mode:'automatic',summary_hash:reviewHash(facts),confirmation:'explicit test consent'},completed:{voice:true},observations:{offer:{confirmed_none:true}}};
  const content={account_id:'a',timezone:'Australia/Perth',scheduled_at:'2026-09-29T01:00:00Z',topic:'running',gaps:[],cta:'none'};
  return {s,card:{content,validation:{kind:'threadify',status:'passed',card_hash:reviewHash(content),valid_until:'2026-09-29T00:04:00Z'}}};
}
test('standing permission binds identity, scope, exact validation and revocation',()=>{
  const {s,card}=fixture();assert.equal(assertStandingPermission(s,'/private',card,now).permission_id,'p');
  s.paused=true;assert.throws(()=>assertStandingPermission(s,'/private',card,now),/Active/);s.paused=false;
  assert.throws(()=>assertStandingPermission(s,'/private',card,now,'old'),/changed/);
  card.content.account_id='other';assert.throws(()=>assertStandingPermission(s,'/private',card,now),/account/);
});
test('an existing post at another time fills the daily allowance and ended runs cannot authorize',()=>{
  const {s,card}=fixture();
  assert.throws(()=>assertCalendarCapacity(s,card,{occupied_instants:['2026-09-29T02:00:00Z']}),/frequency/);
  assert.doesNotThrow(()=>assertCalendarCapacity(s,card,{occupied_instants:['2026-09-30T02:00:00Z']}));
  s.pending=null;assert.throws(()=>assertStandingPermission(s,'/private',card,now),/lock first/);
});
test('reviewed mode, off-topic, stale and out-of-window cards cannot auto-schedule',()=>{
  for(const mutate of [x=>x.s.permission.mode='reviewed',x=>x.card.content.topic='sales',x=>x.card.validation.valid_until=now,x=>x.card.content.scheduled_at='2026-10-07T01:00:00Z',x=>x.card.content.cta='buy']) {
    const x=fixture();mutate(x);assert.throws(()=>assertStandingPermission(x.s,'/private',x.card,now));
  }
});
