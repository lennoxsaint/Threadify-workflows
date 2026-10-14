import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createPostEditor } from '../../plugins/threadify/skills/threadify-whats-working/scripts/post-editor.mjs';
import { reviewPacket } from '../../plugins/threadify/skills/threadify-whats-working/scripts/review-packet.mjs';

const drafts = () => ({ posts: [1, 2, 3].map(n => ({ id: 'private-reference-' + n, original: 'i read the source. useful finding ' + n + '.', mode: 'unchanged' })) });
const packetFor = receipt => ({ account: '@example', timezone: 'UTC', auto_plugs: receipt.auto_plugs,
  posts: receipt.posts.map((p, i) => ({ id: p.id, scheduled_at: `2030-01-0${i + 1}T09:00:00Z`,
    copy: { original: p.original, final: p.final, mode: p.mode, owner_request: p.owner_request },
    review: { facts: { status: 'verified', evidence: 'Synthetic source reviewed; no real outcome claim' } },
    hook: { status: 'unproven', adapted_opening: p.final.split('\n')[0], reason: 'Synthetic fixture has no performance evidence' } })) });

test('real local edit handoff preserves originals; Done editing alone cannot schedule', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'whats-working-edit-'));
  const output = path.join(dir, 'review.json');
  const editor = await createPostEditor(drafts(), { output });
  t.after(async () => { await editor.close(); await rm(dir, { recursive: true }); });
  assert.match(editor.url, /^http:\/\/127\.0\.0\.1:/);
  const html = await (await fetch(editor.url)).text();
  assert.match(html, /Done editing/); assert.doesNotMatch(html, /private-reference/);
  const initial = await (await fetch(editor.url + 'state')).json();
  assert.deepEqual(Object.keys(initial).sort(), ['auto_plugs', 'done', 'posts']);
  assert.equal(initial.auto_plugs, false); assert.equal(initial.done, false);
  const final = [...initial.posts]; final[0] += '\n\nuse what you found.';
  const send = body => fetch(editor.url + 'save', { method: 'POST', headers: { Origin: new URL(editor.url).origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await send({ posts: final, done: false, auto_plugs: false })).status, 200);
  assert.equal(JSON.parse(await readFile(output)).status, 'editing');
  assert.equal((await send({ posts: final, done: true, auto_plugs: false })).status, 200);
  const receipt = await editor.done;
  assert.equal(receipt.status, 'done'); assert.equal(receipt.approval, null);
  assert.equal(receipt.posts[0].original, initial.posts[0]);
  assert.equal(receipt.posts[0].final, final[0]);
  assert.equal(receipt.posts[0].mode, 'owner-requested edit');
  assert.deepEqual(receipt.posts[0].comparison.added_lines, ['', 'use what you found.']);
  const packet = packetFor(receipt);
  const reviewed = reviewPacket({ packet, editor_receipt: receipt });
  assert.equal(reviewed.proof_state, 'review_ready'); assert.deepEqual(reviewed.schedule_args, []);
  const approval = { reply: 'yes', packet_sha256: reviewed.packet_sha256 };
  const validations = reviewed.hashes.map(p => ({ id: p.id, kind: 'post', account: packet.account, sha256: p.post_sha256, valid: true, validated_at: new Date().toISOString() }));
  const approved = reviewPacket({ packet, editor_receipt: receipt, approval, validations });
  assert.equal(approved.proof_state, 'approved'); assert.equal(approved.schedule_args.length, 3);
  assert.ok(approved.schedule_args.every(p => !('auto_plug' in p) && !('draft_id' in p)));
  const readbacks = approved.schedule_args.map((p, i) => ({ ...p, id: packet.posts[i].id, status: 'scheduled', auto_plug: null }));
  assert.equal(reviewPacket({ packet, editor_receipt: receipt, approval, validations, readbacks }).proof_state, 'scheduled_verified');
  readbacks[0].auto_plug = { enabled: true, content: 'unexpected reply' };
  assert.equal(reviewPacket({ packet, editor_receipt: receipt, approval, validations, readbacks }).status, 'FAIL');
  packet.posts[0].copy.final += '!';
  assert.equal(reviewPacket({ packet, editor_receipt: receipt, approval, validations }).status, 'FAIL');
  assert.equal((await send({ posts: final, done: true, auto_plugs: false })).status, 400);
});

test('autosave survives reopening; malformed or foreign requests cannot complete review', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'whats-working-resume-'));
  const output = path.join(dir, 'review.json');
  let editor = await createPostEditor(drafts(), { output });
  t.after(async () => { await editor.close(); await rm(dir, { recursive: true }); });
  const final = drafts().posts.map(p => p.original); final[2] = 'an owner rewrite.';
  const send = (body, origin = new URL(editor.url).origin) => fetch(editor.url + 'save', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await send({ posts: final, done: true, auto_plugs: false }, 'https://foreign.example')).status, 403);
  assert.equal((await send({ posts: final, done: true, auto_plugs: false, approval: 'yes' })).status, 400);
  assert.equal((await send({ posts: ['', ...final.slice(1)], done: true, auto_plugs: false })).status, 400);
  assert.equal((await send({ posts: final, done: false, auto_plugs: true })).status, 200);
  await editor.close();
  editor = await createPostEditor(drafts(), { output });
  const resumed = await (await fetch(editor.url + 'state')).json();
  assert.deepEqual(resumed.posts, final); assert.equal(resumed.auto_plugs, true); assert.equal(resumed.done, false);
  await send({ posts: final, done: true, auto_plugs: true });
  const receipt = await editor.done;
  assert.equal(receipt.posts[2].original, drafts().posts[2].original);
  const wrongChoice = packetFor(receipt); wrongChoice.auto_plugs = false;
  assert.match(reviewPacket({ packet: wrongChoice, editor_receipt: receipt }).errors.join(), /choice changed/);
  await assert.rejects(createPostEditor(drafts(), { output }), /completed/);
});

test('preserved originals cannot be overwritten by a different source or tampered resume', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'whats-working-custody-'));
  const output = path.join(dir, 'review.json');
  const editor = await createPostEditor(drafts(), { output });
  t.after(async () => { await editor.close(); await rm(dir, { recursive: true }); });
  const changed = drafts(); changed.posts[0].original = 'different source';
  await assert.rejects(createPostEditor(changed, { output }), /different originals/);
  const state = JSON.parse(await readFile(output)); state.posts[0].original = 'tampered';
  await writeFile(output, JSON.stringify(state));
  await assert.rejects(createPostEditor(drafts(), { output }), /originals changed/);
});

test('post-only review rejects stale plugs, unresolved facts and unknown disabled readback', () => {
  const receipt = { status: 'done', approval: null, auto_plugs: false, posts: drafts().posts.map(p => ({ ...p, final: p.original })) };
  const packet = packetFor(receipt);
  assert.equal(reviewPacket({ packet }).status, 'PASS');
  packet.posts[0].plug = { original: 'a reply', final: 'a reply', mode: 'unchanged' };
  assert.match(reviewPacket({ packet }).errors.join(), /disabled Auto Plugs/);
  delete packet.posts[0].plug;
  packet.posts[0].review.facts.status = 'unsupported';
  assert.equal(reviewPacket({ packet }).status, 'FAIL');
  packet.posts[0].review.facts.status = 'verified';
  packet.auto_plugs = null;
  assert.equal(reviewPacket({ packet }).status, 'FAIL');
});

test('legacy plug packets retain validation and exact enabled readback requirements', () => {
  const receipt = { status: 'done', approval: null, auto_plugs: true, posts: drafts().posts.map(p => ({ ...p, final: p.original })) };
  const packet = packetFor(receipt);
  delete packet.auto_plugs; // Pre-upgrade packets had mandatory plugs.
  for (const p of packet.posts) {
    p.destination = 'https://example.org/tool';
    p.plug = { original: 'try it https://example.org/tool', final: 'try it https://example.org/tool', mode: 'unchanged' };
    p.review.destination = { status: 'verified', evidence: 'Synthetic destination reviewed' };
  }
  const reviewed = reviewPacket({ packet });
  assert.equal(reviewed.status, 'PASS');
  const approval = { reply: 'yes', packet_sha256: reviewed.packet_sha256 };
  const validations = reviewed.hashes.flatMap(p => ['post', 'plug'].map(kind => ({ id: p.id, kind, account: packet.account, sha256: p[kind + '_sha256'], valid: true, validated_at: new Date().toISOString() })));
  const approved = reviewPacket({ packet, approval, validations });
  assert.equal(approved.status, 'PASS');
  assert.ok(approved.schedule_args.every(p => p.auto_plug.delay_minutes === 15));
  const readbacks = approved.schedule_args.map((p, i) => ({ ...p, id: packet.posts[i].id, status: 'scheduled' }));
  assert.equal(reviewPacket({ packet, approval, validations, readbacks }).proof_state, 'scheduled_verified');
  readbacks[0].auto_plug.enabled = false;
  assert.equal(reviewPacket({ packet, approval, validations, readbacks }).status, 'FAIL');
});
