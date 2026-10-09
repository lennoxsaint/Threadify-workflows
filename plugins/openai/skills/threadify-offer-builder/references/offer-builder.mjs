import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const questionOrder = mode => mode === 'filming' ? [1, 2, 3, 10] : [1,2,3,4,5,6,7,8,9,10];
const types = ['community', 'course', 'asset', 'newsletter', 'other'];
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function validDestination(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && u.hostname.includes('.') && !/(^|\.)(example\.(com|org|net)|localhost|invalid|test)$/.test(u.hostname); } catch { return false; }
}
export function inspect(input) {
  const missing = ['name','buyer','benefit','delivery','cta'].filter(k => typeof input[k] !== 'string' || !input[k].trim());
  const mode = input.mode ?? 'full';
  if (!['full','filming','demo'].includes(mode)) throw new Error('Unknown interview mode');
  if (input.facts !== undefined && (!Array.isArray(input.facts) || input.facts.some(x => typeof x !== 'string'))) throw new Error('facts must be strings');
  const order = questionOrder(mode);
  const answered = [...new Set(input.answered ?? [])];
  const complete = mode !== 'demo' && order.every(n => answered.includes(n)) && input.confirmed === true;
  return {mode, answered, skipped: mode === 'filming' ? [4,5,6,7,8,9] : [], missing,
    interview_complete: complete, confirmed: input.confirmed === true,
    destination_ready: validDestination(input.link),
    unknowns: input.unknowns ?? [], status: mode === 'demo' ? 'demo' : complete && !missing.length ? 'prepared_local' : 'draft_local'};
}
export function payloadFor(input) {
  return {name: input.name, benefit: input.benefit, link: input.link,
    type: types.includes(input.type) ? input.type : 'other', facts: input.facts ?? []};
}
export function prepareSave(input, context) {
  const state = inspect(input);
  if (state.mode === 'demo') throw new Error('Demo cannot save');
  if (!state.interview_complete || state.missing.length || !state.destination_ready) throw new Error('Confirm interview and resolve required details/destination');
  if (!context.account || context.accountVerified !== true || context.discoveryComplete !== true) throw new Error('Verify account and complete duplicate discovery');
  const payload = payloadFor(input);
  const matches = (context.offers ?? []).filter(o => o.name?.trim().toLowerCase() === payload.name.trim().toLowerCase() || o.link === payload.link);
  if (matches.length > 1) throw new Error('Ambiguous duplicate: choose and reconcile target');
  const existing = matches[0];
  if (existing && !existing.offer_id) throw new Error('Missing existing offer ID');
  const action = existing ? 'update_offer' : 'create_offer';
  const args = {...payload, account: context.account, ...(existing ? {offer_id: existing.offer_id} : {})};
  const digest = createHash('sha256').update(JSON.stringify({action,args})).digest('hex');
  const unchanged = existing && Object.keys(payload).every(k => JSON.stringify(existing[k]) === JSON.stringify(payload[k]));
  return {action: unchanged ? 'no_change' : action, args: {...args, idempotency_key: `offer-${digest}`},
    approval_digest: digest, approved: !unchanged && context.approvedDigest === digest,
    status: unchanged ? 'no_change' : context.approvedDigest === digest ? 'approved_prepared' : 'awaiting_action_approval'};
}
export function verifyReadback(prepared, record, account) {
  return account === prepared.args.account && (!prepared.args.offer_id || record?.offer_id === prepared.args.offer_id) && Boolean(record?.offer_id) && ['name','benefit','link','type','facts'].every(k => JSON.stringify(record[k]) === JSON.stringify(prepared.args[k]));
}
export function render(input) {
  const state = inspect(input);
  const text = k => escape(input[k]);
  const label = state.mode === 'demo' ? 'DEMO — fictional example' : state.status === 'draft_local' ? 'DRAFT — awaiting confirmation' : 'THE OFFER';
  const facts = (input.facts ?? []).map(f => `<li>${escape(f)}</li>`).join('');
  const link = state.destination_ready ? `<a href="${text('link')}">${text('cta')}</a>` : `<span class="inactive">${text('cta') || 'Next step pending'}</span>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${text('name') || 'Offer draft'}</title><style>
*{box-sizing:border-box}body{margin:0;background:#f5f3ed;color:#172d2a;font:18px/1.6 system-ui,sans-serif}main{max-width:1080px;margin:auto;padding:clamp(28px,7vw,92px)}.label{font-size:12px;letter-spacing:.15em;font-weight:700}h1{font-size:clamp(42px,7vw,84px);line-height:1.04;letter-spacing:-.045em;max-width:900px;margin:34px 0}p{max-width:640px}.benefit{font-size:clamp(22px,3vw,30px)}.details{border-top:1px solid #afbab3;margin-top:45px;padding-top:24px;display:grid;grid-template-columns:1fr 1fr;gap:32px}h2{font-size:14px;text-transform:uppercase;letter-spacing:.09em}ul{padding-left:20px}a,.inactive{display:inline-block;margin-top:28px;background:#183e36;color:#fff;padding:16px 26px;border-radius:6px;font-weight:650;text-decoration:none;overflow-wrap:anywhere}a:focus-visible{outline:3px solid #ae4e20;outline-offset:5px}.inactive{background:#576862}@media(max-width:650px){.details{grid-template-columns:1fr;gap:12px}main{padding:28px 24px}h1{overflow-wrap:anywhere}}
</style></head><body><main><div class="label">${label}</div><h1>${text('name') || 'Offer draft'}</h1><p class="benefit">${text('benefit')}</p><p>For ${text('buyer')}</p><div class="details"><section><h2>What you get</h2><p>${text('delivery')}</p>${input.limits ? `<p>${text('limits')}</p>` : ''}</section><section>${facts ? `<h2>Supporting facts</h2><ul>${facts}</ul>` : ''}${input.terms ? `<h2>Price and terms</h2><p>${text('terms')}</p>` : ''}</section></div>${link}</main></body></html>`;
}
export function writeArtifacts(input, directory) {
  const state = inspect(input);
  fs.mkdirSync(directory, {recursive:true});
  fs.writeFileSync(path.join(directory,'offer.html'), render(input), {flag:'wx'});
  fs.writeFileSync(path.join(directory,'owner-handoff.json'), JSON.stringify({...state, mapping:payloadFor(input), owner_notes:input.owner_notes ?? [], action_approval:'not_requested', save_state:'not_attempted', provider_readback:'unavailable', ui_state:'unverified'}, null, 2)+'\n', {flag:'wx'});
}
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  if (!process.argv[2] || !process.argv[3]) throw new Error('Usage: node offer-builder.mjs input.json output-directory');
  writeArtifacts(JSON.parse(fs.readFileSync(process.argv[2],'utf8')), process.argv[3]);
}
