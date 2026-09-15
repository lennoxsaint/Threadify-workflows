import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { renderHtml, validatePlan, writePlan } from '../../tools/profile-plan/cli.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

function bio(text, claimNotes = []) { return { text, character_count: Array.from(text).length, claim_notes: claimNotes }; }
function picture(overrides = {}) {
  return {
    mode: 'photography_brief', asset_ref: null, asset_sha256: null, source_reference_refs: [], rights_basis: 'not_applicable', rights_confirmed: false,
    alt_description: 'A warm face-led portrait against a clean orange background.', framing: 'Head and shoulders inside the central circular safe zone.',
    direction: 'Use one face, simple light, and high subject-background separation.', accent_color: '#F97316', ...overrides,
  };
}
function source(kind, status, summary) { return { kind, status, label: kind.replaceAll('_', ' '), observed_at: status === 'unavailable' ? null : '2026-09-15T08:00:00Z', summary, conflicts: [] }; }
export function fixture() {
  const oldBio = 'Broad creator notes.';
  const a = { id: 'A', strategy: 'clarity_first', label: 'Make the promise obvious', bio: bio('Helping independent experts turn audience evidence into clearer Threads content.'), picture: picture({ mode: 'existing', asset_ref: 'portrait-a', asset_sha256: hash(png), rights_basis: 'user_owned', rights_confirmed: true }), scores: { clarity: 5, credibility: 4, distinctiveness: 3, cta_alignment: 5, tiny_circle_legibility: 5 } };
  const b = { id: 'B', strategy: 'authority_proof', label: 'Lead with verified work', bio: bio('Hundreds of owned posts reviewed. Sharing practical Threads experiments for independent experts.', [{ text: 'Hundreds of owned posts reviewed', status: 'owner_attested', evidence_refs: ['interview-proof-1'] }]), picture: picture({ mode: 'generate_or_edit', source_reference_refs: ['portrait-a'], rights_basis: 'user_owned', rights_confirmed: true, direction: 'Edit a consented portrait into a restrained studio treatment; preserve identity features.', accent_color: '#1D4ED8' }), scores: { clarity: 4, credibility: 5, distinctiveness: 4, cta_alignment: 4, tiny_circle_legibility: 4 } };
  const c = { id: 'C', strategy: 'personality_distinctiveness', label: 'Make the point of view memorable', bio: bio('Writing about creator evidence, useful systems, and humane automation. Building a clearer way to create.'), picture: picture({ direction: 'Photograph one recognizable face with a repeatable red wardrobe cue.', accent_color: '#B91C1C' }), scores: { clarity: 4, credibility: 3, distinctiveness: 5, cta_alignment: 4, tiny_circle_legibility: 5 } };
  return {
    schema_version: 1,
    generated_at: '2026-09-15T08:00:00Z',
    account: { label: '@example_creator', verified_for_write: false, timezone: 'Australia/Perth', current_profile_source: 'owner_supplied' },
    context_coverage: {
      priority: ['explicit_interview', 'prior_niche_report', 'approved_local_context', 'verified_linked_account', 'public_past_content'],
      sources: [
        source('explicit_interview', 'used', 'The owner confirmed the audience, desired action, tone, proof boundaries, and visual preferences.'),
        source('prior_niche_report', 'used', 'A private niche report supplied the current audience, outcome, and content pillars.'),
        source('approved_local_context', 'used', 'The owner approved a bounded local context set about profile-to-content alignment.'),
        source('verified_linked_account', 'unavailable', 'No verified linked-account profile read was available; owner-supplied baseline used.'),
        source('public_past_content', 'used', 'Dated public positioning was treated as historical and subordinated to the current interview.'),
      ],
      gaps: ['Live profile editor limits and account-linking state remain unknown until preflight.'],
    },
    platform_constraints: { bio_limit: { state: 'observed_current_ui', value: 160, source: 'current editor counter supplied by owner' }, image_requirements: 'unknown', editor_capability: 'manual_ui', observed_at: '2026-09-15T08:00:00Z' },
    interview_summary: {
      audience: 'Independent experts with useful audience evidence', niche: 'Evidence-led Threads content systems', desired_action: 'Read recent posts, then follow if relevant',
      credible_proof: ['The owner has reviewed a substantial body of owned posts.'], tone: 'Clear, practical, warm', claims_to_avoid: ['Any promise that the profile causes follower or revenue growth.'],
      visual_preferences: ['One recognizable face', 'Simple background', 'Strong small-circle contrast'], source_rights_confirmed: true,
      external_image_transfer: { status: 'not_used', provider: null, terms_reviewed: false, no_upload_fallback_offered: true },
    },
    baseline_profile: { captured: true, observed_at: '2026-09-15T08:00:00Z', bio: { text: oldBio, sha256: hash(oldBio) }, picture: { asset_ref: 'baseline-portrait', sha256: 'b'.repeat(64) }, evidence_status: 'owner_supplied' },
    candidates: [a, b, c],
    selected_profile: { candidate_id: 'A', selection_status: 'owner_selected', bio: structuredClone(a.bio), picture: structuredClone(a.picture), selection_reason: 'The owner chose the clearest audience and outcome match for this stage.' },
    apply_plan: {
      mode: 'manual', status: 'preparation_only', exact_account_verified: false, sync_and_verification_review: 'unknown',
      confirmation: { required: true, state: 'not_requested', approved_plan_sha256: null },
      rollback: { status: 'unavailable', prior_picture_asset_ref: null, note: 'A restorable local copy must be acquired or rollback shown as unavailable before confirmation.' },
      manual_instructions: ['Open the current Threads profile while signed into the intended account.', 'Choose Edit profile and compare the displayed handle with this plan.', 'Review sync, import, and verification warnings before changing either field.', 'Paste the selected bio and choose the frozen square picture only after final confirmation.', 'Save once, return to the profile, and verify both fields; stop without retry if either result is unclear.'],
      agent_instructions: ['Use current semantic browser or native controls, never stored coordinates.', 'Pause on any unexpected account, sync, verification, crop, or save warning.', 'Save once and read both fields back; do not repeat an ambiguous action.'],
      readback: { state: 'not_attempted', bio_matches: null, picture_matches: null }, retry_allowed: true,
    },
    limitations: ['This profile plan does not prove growth or conversion.', 'Live limits, image acceptance, sync behavior, and editor controls require current account preflight.'],
  };
}

test('schema and standalone validator accept a complete three-system plan', () => {
  const ajv = new Ajv({ strict: true }); addFormats(ajv); const validate = ajv.compile(JSON.parse(fs.readFileSync(path.join(root, 'schemas/profile-plan.v1.json'))));
  const plan = fixture(); assert.equal(validate(plan), true, JSON.stringify(validate.errors)); assert.equal(validatePlan(plan), plan);
});

test('selection stays coherent and Unicode count honors an observed live limit', () => {
  const mixed = fixture(); mixed.selected_profile.bio = structuredClone(mixed.candidates[1].bio); assert.throws(() => validatePlan(mixed), /coherent candidate/);
  const unicode = fixture(); unicode.candidates[0].bio.text = 'Clear ✨'; unicode.candidates[0].bio.character_count = 7; unicode.selected_profile.bio = structuredClone(unicode.candidates[0].bio); assert.equal(validatePlan(unicode), unicode);
  unicode.platform_constraints.bio_limit.value = 6; assert.throws(() => validatePlan(unicode), /exceeds/);
});

test('image rights, transfer consent, and frozen hashes fail closed', () => {
  const rights = fixture(); rights.candidates[0].picture.rights_confirmed = false; rights.selected_profile.picture.rights_confirmed = false; assert.throws(() => validatePlan(rights), /requires a frozen owned/);
  const transfer = fixture(); transfer.interview_summary.external_image_transfer = { status: 'approved', provider: 'example processor', terms_reviewed: false, no_upload_fallback_offered: true }; assert.throws(() => validatePlan(transfer), /reviewed terms/);
  const hashless = fixture(); hashless.candidates[0].picture.asset_sha256 = null; hashless.selected_profile.picture.asset_sha256 = null; assert.throws(() => validatePlan(hashless), /frozen together/);
});

test('confirmation, rollback, account verification, readback, and no-retry invariants are enforced', () => {
  const confirmation = fixture(); confirmation.apply_plan.confirmation = { required: true, state: 'granted', approved_plan_sha256: 'a'.repeat(64) }; assert.throws(() => validatePlan(confirmation), /confirmation requires/);
  const rollback = fixture(); rollback.apply_plan.rollback = { status: 'authorized_local_copy', prior_picture_asset_ref: null, note: 'missing ref' }; assert.throws(() => validatePlan(rollback), /authorized rollback/);
  const ambiguous = fixture(); ambiguous.apply_plan.status = 'ambiguous'; ambiguous.apply_plan.readback.state = 'ambiguous'; ambiguous.apply_plan.retry_allowed = true; assert.throws(() => validatePlan(ambiguous), /stop without retry/);
  const mismatch = fixture(); mismatch.apply_plan.readback.state = 'mismatch'; assert.throws(() => validatePlan(mismatch), /stop without retry/);
  const falseSuccess = fixture(); falseSuccess.apply_plan.status = 'applied'; assert.throws(() => validatePlan(falseSuccess), /applied requires/);
});

test('undeclared fields cannot leak through the standalone renderer', () => {
  const plan = fixture(); plan.private_customer_body = 'must never copy'; assert.throws(() => validatePlan(plan), /undeclared fields/);
  const nested = fixture(); nested.candidates[0].picture.absolute_path = '/private/path'; assert.throws(() => validatePlan(nested), /undeclared fields/);
});

test('renderer writes self-contained escaped visuals, a frozen source, and a body-free receipt', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-plan-')); const image = path.join(dir, 'owned.png'); fs.writeFileSync(image, png);
  const plan = fixture(); plan.candidates[1].label = '<script>unsafe()</script>'; const result = writePlan(plan, path.join(dir, 'out'), { assetMap: { 'portrait-a': image } });
  assert.deepEqual(result.files.sort(), ['profile-picture-preview-grid.svg', 'profile-picture-selected.svg', 'profile-picture-source.png', 'profile-plan-receipt.json', 'profile-plan.html', 'profile-plan.json', 'profile-plan.md'].sort());
  const html = fs.readFileSync(path.join(dir, 'out/profile-plan.html'), 'utf8'); const grid = fs.readFileSync(path.join(dir, 'out/profile-picture-preview-grid.svg'), 'utf8');
  assert.match(html, /Content-Security-Policy/); assert.doesNotMatch(html, /<script>/); assert.match(html, /&lt;script&gt;/); assert.match(grid, /<clipPath[^>]*><circle/); assert.doesNotMatch(grid, /<script>/);
  assert.match(grid, /<text x="80" y="386"[^>]*>Helping independent experts/); assert.match(grid, /<text x="80" y="416"[^>]*>evidence into clearer Threads content/); assert.doesNotMatch(grid, /<tspan/);
  const receiptText = fs.readFileSync(path.join(dir, 'out/profile-plan-receipt.json'), 'utf8'); const receipt = JSON.parse(receiptText);
  for (const privateValue of [plan.account.label, plan.selected_profile.bio.text, plan.selected_profile.picture.direction, image, png.toString('base64')]) assert.equal(receiptText.includes(privateValue), false);
  assert.equal(receipt.visual_delivery, 'consented_local_raster'); assert.equal(receipt.files['profile-picture-source.png'].sha256, hash(png));
  assert.doesNotMatch(receiptText, /(?:^|["\s])\/(?:Users|tmp)\//); assert.doesNotMatch(receiptText, /[A-Za-z]:\\/);
});

test('missing optional raster produces a deterministic placeholder and idempotent rerender', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-placeholder-')); const plan = fixture(); const first = writePlan(plan, dir); const second = writePlan(plan, dir);
  assert.equal(first.plan_sha256, second.plan_sha256); assert.equal(first.visual_delivery, 'deterministic_placeholder'); assert.equal(fs.existsSync(path.join(dir, 'profile-picture-source.png')), false);
  const receipt = JSON.parse(fs.readFileSync(path.join(dir, 'profile-plan-receipt.json'))); assert.equal(receipt.fallback_state, 'visual_placeholder_used');
  fs.writeFileSync(path.join(dir, 'profile-plan.md'), 'changed'); assert.throws(() => writePlan(plan, dir), /refusing to overwrite differing artifact/);
});

test('asset content and filesystem safety are verified before rendering', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-asset-')); const image = path.join(dir, 'owned.png'); fs.writeFileSync(image, Buffer.concat([png, Buffer.from('changed')]));
  assert.throws(() => writePlan(fixture(), path.join(dir, 'hash-output'), { assetMap: { 'portrait-a': image } }), /frozen SHA-256/);
  const real = path.join(dir, 'real.png'); const link = path.join(dir, 'link.png'); fs.writeFileSync(real, png);
  try { fs.symlinkSync(real, link); } catch { t.skip('symlinks unavailable'); return; }
  assert.throws(() => writePlan(fixture(), path.join(dir, 'link-output'), { assetMap: { 'portrait-a': link } }), /non-symlink/);
});

test('HTML renderer escapes untrusted fields without external resource attributes', () => {
  const plan = fixture(); plan.selected_profile.selection_reason = '<img src="https://bad.invalid/x">';
  const html = renderHtml(plan, '<svg></svg>', '<svg></svg>', true); assert.doesNotMatch(html, /<img/); assert.match(html, /&lt;img/); assert.doesNotMatch(html, /(?:src|href)=["']https?:/);
});

test('CLI executes through a symlinked installed path', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-cli-link-')); const linkedRoot = path.join(dir, 'linked-root');
  try { fs.symlinkSync(root, linkedRoot, 'dir'); } catch { t.skip('directory symlinks unavailable'); return; }
  const input = path.join(dir, 'input.json'); const output = path.join(dir, 'output'); fs.writeFileSync(input, JSON.stringify(fixture()));
  const result = spawnSync(process.execPath, [path.join(linkedRoot, 'tools/profile-plan/cli.mjs'), 'render', '--input', input, '--output-dir', output], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /"plan_sha256"/); assert.equal(fs.existsSync(path.join(output, 'profile-plan-receipt.json')), true);
});
