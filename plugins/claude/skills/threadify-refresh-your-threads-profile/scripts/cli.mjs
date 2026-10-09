#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleFile = fileURLToPath(import.meta.url);
const strategies = [
  ['A', 'clarity_first'],
  ['B', 'authority_proof'],
  ['C', 'personality_distinctiveness'],
];
const contextPriority = ['explicit_interview', 'prior_niche_report', 'approved_local_context', 'verified_linked_account', 'public_past_content'];
const rasterTypes = [
  { extension: 'png', mime: 'image/png', match: (value) => value.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  { extension: 'jpg', mime: 'image/jpeg', match: (value) => value[0] === 0xff && value[1] === 0xd8 && value[2] === 0xff },
  { extension: 'gif', mime: 'image/gif', match: (value) => value.subarray(0, 6).toString('ascii') === 'GIF87a' || value.subarray(0, 6).toString('ascii') === 'GIF89a' },
  { extension: 'webp', mime: 'image/webp', match: (value) => value.subarray(0, 4).toString('ascii') === 'RIFF' && value.subarray(8, 12).toString('ascii') === 'WEBP' },
];

function fail(message) { throw new Error(message); }
function sameFile(left, right) {
  if (!left || !right) return false;
  try { return fs.realpathSync(left) === fs.realpathSync(right); } catch { return false; }
}
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function isHash(value) { return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value); }
function isObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function isAssetRef(value) { return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value); }
function exactKeys(value, allowed, field) {
  if (!isObject(value)) fail(`${field} must be an object`);
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length) fail(`${field} contains undeclared fields: ${extras.join(', ')}`);
  const missing = allowed.filter((key) => !Object.hasOwn(value, key));
  if (missing.length) fail(`${field} is missing fields: ${missing.join(', ')}`);
}
function strings(value, field, minimum = 0) {
  if (!Array.isArray(value) || value.length < minimum || value.some((item) => typeof item !== 'string' || !item.trim())) fail(`${field} must contain ${minimum ? `at least ${minimum}` : 'only'} non-empty strings`);
}
function codePoints(value) { return Array.from(value).length; }
function canonicalJson(value) { return `${JSON.stringify(value, null, 2)}\n`; }

export function validatePlan(plan) {
  if (!isObject(plan) || plan.schema_version !== 1) fail('schema_version must be 1');
  exactKeys(plan, ['schema_version', 'generated_at', 'account', 'context_coverage', 'platform_constraints', 'interview_summary', 'baseline_profile', 'candidates', 'selected_profile', 'apply_plan', 'limitations'], 'plan');
  if (!Number.isFinite(Date.parse(plan.generated_at))) fail('generated_at must be a date-time');
  exactKeys(plan.account, ['label', 'verified_for_write', 'timezone', 'current_profile_source'], 'account');
  if (!plan.account?.label || typeof plan.account.verified_for_write !== 'boolean' || !plan.account.timezone) fail('account label, timezone, and verified_for_write are required');
  if (!['verified_live_read', 'owner_supplied', 'historical_only', 'unavailable'].includes(plan.account.current_profile_source)) fail('invalid current_profile_source');

  exactKeys(plan.context_coverage, ['priority', 'sources', 'gaps'], 'context_coverage');
  if (JSON.stringify(plan.context_coverage?.priority) !== JSON.stringify(contextPriority)) fail('context priority must follow the five-lane contract');
  if (!Array.isArray(plan.context_coverage?.sources) || plan.context_coverage.sources.length !== 5) fail('all five context lanes are required');
  plan.context_coverage.sources.forEach((source, index) => {
    exactKeys(source, ['kind', 'status', 'label', 'observed_at', 'summary', 'conflicts'], `context_coverage.sources[${index}]`);
    if (source?.kind !== contextPriority[index]) fail(`context_coverage.sources[${index}] is out of priority order`);
    if (!['used', 'available_not_used', 'unavailable'].includes(source.status) || !source.label || !source.summary || !Array.isArray(source.conflicts)) fail(`context_coverage.sources[${index}] is incomplete`);
  });
  strings(plan.context_coverage.gaps, 'context_coverage.gaps');

  exactKeys(plan.platform_constraints, ['bio_limit', 'image_requirements', 'editor_capability', 'observed_at'], 'platform_constraints');
  const limit = plan.platform_constraints?.bio_limit;
  exactKeys(limit, ['state', 'value', 'source'], 'platform_constraints.bio_limit');
  if (!['observed_current_ui', 'unknown'].includes(limit?.state) || !limit.source) fail('bio_limit state and source are required');
  if (limit.state === 'observed_current_ui' && (!Number.isInteger(limit.value) || limit.value < 1)) fail('an observed bio limit requires a positive value');
  if (limit.state === 'unknown' && limit.value !== null) fail('an unknown bio limit must use null');
  if (!['observed_current_ui', 'unknown'].includes(plan.platform_constraints?.image_requirements)) fail('invalid image requirements state');
  if (!['manual_ui', 'agent_ui_available', 'read_only', 'unknown'].includes(plan.platform_constraints?.editor_capability)) fail('invalid editor capability');

  const interview = plan.interview_summary ?? {};
  exactKeys(interview, ['audience', 'niche', 'desired_action', 'credible_proof', 'tone', 'claims_to_avoid', 'visual_preferences', 'source_rights_confirmed', 'external_image_transfer'], 'interview_summary');
  exactKeys(interview.external_image_transfer, ['status', 'provider', 'terms_reviewed', 'no_upload_fallback_offered'], 'interview_summary.external_image_transfer');
  for (const key of ['audience', 'niche', 'desired_action', 'tone']) if (!interview[key]) fail(`interview_summary.${key} is required`);
  strings(interview.credible_proof, 'interview_summary.credible_proof');
  strings(interview.claims_to_avoid, 'interview_summary.claims_to_avoid');
  strings(interview.visual_preferences, 'interview_summary.visual_preferences');
  if (typeof interview.source_rights_confirmed !== 'boolean') fail('interview_summary.source_rights_confirmed is required');
  const transfer = interview.external_image_transfer;
  if (!['not_used', 'approved', 'declined'].includes(transfer.status) || transfer.no_upload_fallback_offered !== true) fail('external image transfer state and no-upload fallback are required');
  if (transfer.status === 'approved' && (!transfer.provider || transfer.terms_reviewed !== true || !interview.source_rights_confirmed)) fail('external likeness transfer requires provider disclosure, reviewed terms, and source rights');
  if (transfer.status !== 'approved' && transfer.provider !== null) fail('only an approved external transfer may name a provider');

  const baseline = plan.baseline_profile ?? {};
  exactKeys(baseline, ['captured', 'observed_at', 'bio', 'picture', 'evidence_status'], 'baseline_profile');
  exactKeys(baseline.bio, ['text', 'sha256'], 'baseline_profile.bio');
  exactKeys(baseline.picture, ['asset_ref', 'sha256'], 'baseline_profile.picture');
  if (typeof baseline.captured !== 'boolean' || !['verified_live', 'owner_supplied', 'historical_only', 'unavailable'].includes(baseline.evidence_status)) fail('baseline profile state is incomplete');
  if (baseline.captured) {
    if (!baseline.observed_at || !Number.isFinite(Date.parse(baseline.observed_at))) fail('a captured baseline requires observed_at');
    if (typeof baseline.bio?.text !== 'string' || !isHash(baseline.bio?.sha256) || sha256(Buffer.from(baseline.bio.text)) !== baseline.bio.sha256) fail('captured baseline bio and hash must match');
    if (!isAssetRef(baseline.picture?.asset_ref) || !isHash(baseline.picture?.sha256)) fail('captured baseline picture requires an opaque ref and hash');
  } else if (baseline.bio?.text !== null || baseline.bio?.sha256 !== null || baseline.picture?.asset_ref !== null || baseline.picture?.sha256 !== null || baseline.observed_at !== null) {
    fail('an uncaptured baseline must use null profile values');
  }

  if (!Array.isArray(plan.candidates) || plan.candidates.length !== 3) fail('exactly three candidates are required');
  plan.candidates.forEach((candidate, index) => {
    const [id, strategy] = strategies[index];
    exactKeys(candidate, ['id', 'strategy', 'label', 'bio', 'picture', 'scores'], `candidates[${index}]`);
    if (candidate?.id !== id || candidate.strategy !== strategy || !candidate.label) fail(`candidate ${id} must use strategy ${strategy}`);
    validateBio(candidate.bio, `candidates[${index}].bio`, limit);
    validatePicture(candidate.picture, `candidates[${index}].picture`, interview.source_rights_confirmed);
    exactKeys(candidate.scores, ['clarity', 'credibility', 'distinctiveness', 'cta_alignment', 'tiny_circle_legibility'], `candidates[${index}].scores`);
    for (const score of ['clarity', 'credibility', 'distinctiveness', 'cta_alignment', 'tiny_circle_legibility']) {
      if (!Number.isInteger(candidate.scores?.[score]) || candidate.scores[score] < 1 || candidate.scores[score] > 5) fail(`candidates[${index}].scores.${score} must be 1-5`);
    }
  });

  const selection = plan.selected_profile ?? {};
  exactKeys(selection, ['candidate_id', 'selection_status', 'bio', 'picture', 'selection_reason'], 'selected_profile');
  const selected = plan.candidates.find((candidate) => candidate.id === selection.candidate_id);
  if (!selected || selection.selection_status !== 'owner_selected' || !selection.selection_reason) fail('one owner-selected candidate is required');
  validateBio(selection.bio, 'selected_profile.bio', limit);
  validatePicture(selection.picture, 'selected_profile.picture', interview.source_rights_confirmed);
  if (canonicalJson(selection.bio) !== canonicalJson(selected.bio) || canonicalJson(selection.picture) !== canonicalJson(selected.picture)) fail('selected profile must preserve one coherent candidate without silent mixing');

  const apply = plan.apply_plan ?? {};
  exactKeys(apply, ['mode', 'status', 'exact_account_verified', 'sync_and_verification_review', 'confirmation', 'rollback', 'manual_instructions', 'agent_instructions', 'readback', 'retry_allowed'], 'apply_plan');
  exactKeys(apply.confirmation, ['required', 'state', 'approved_plan_sha256'], 'apply_plan.confirmation');
  exactKeys(apply.rollback, ['status', 'prior_picture_asset_ref', 'note'], 'apply_plan.rollback');
  exactKeys(apply.readback, ['state', 'bio_matches', 'picture_matches'], 'apply_plan.readback');
  if (!['manual', 'agent_control'].includes(apply.mode) || !['preparation_only', 'ready_for_confirmation', 'manual_pending', 'applied', 'failed', 'ambiguous'].includes(apply.status)) fail('invalid apply mode or status');
  if (typeof apply.exact_account_verified !== 'boolean' || !['reviewed_clear', 'reviewed_risk', 'unknown'].includes(apply.sync_and_verification_review)) fail('account and sync review states are required');
  if (apply.confirmation?.required !== true || !['not_requested', 'granted'].includes(apply.confirmation?.state)) fail('an explicit confirmation state is required');
  if (apply.confirmation.state === 'granted' && !isHash(apply.confirmation.approved_plan_sha256)) fail('granted confirmation requires an approved plan hash');
  if (apply.confirmation.state === 'not_requested' && apply.confirmation.approved_plan_sha256 !== null) fail('unrequested confirmation cannot have an approved plan hash');
  if (!['authorized_local_copy', 'unavailable'].includes(apply.rollback.status) || !apply.rollback.note) fail('rollback must be available or explicitly unavailable');
  if (apply.rollback.status === 'authorized_local_copy' && !isAssetRef(apply.rollback.prior_picture_asset_ref)) fail('authorized rollback requires an opaque prior picture ref');
  if (apply.rollback.status === 'unavailable' && apply.rollback.prior_picture_asset_ref !== null) fail('unavailable rollback cannot name an asset');
  strings(apply.manual_instructions, 'apply_plan.manual_instructions', 4);
  strings(apply.agent_instructions, 'apply_plan.agent_instructions', 3);
  if (!['not_attempted', 'verified', 'mismatch', 'ambiguous'].includes(apply.readback?.state)) fail('invalid readback state');
  if (typeof apply.retry_allowed !== 'boolean') fail('retry_allowed is required');
  if (apply.confirmation.state === 'granted' && (!apply.exact_account_verified || !baseline.captured || apply.sync_and_verification_review === 'unknown')) fail('confirmation requires a captured baseline, exact account check, and sync/verification review');
  if (apply.status === 'applied' && (apply.confirmation.state !== 'granted' || apply.readback.state !== 'verified' || apply.readback.bio_matches !== true || apply.readback.picture_matches !== true || !plan.account.verified_for_write)) fail('applied requires confirmation, verified write identity, and matching readback of both fields');
  if (apply.status === 'ambiguous' && (apply.readback.state !== 'ambiguous' || apply.retry_allowed !== false)) fail('ambiguous results must stop without retry');
  if (['mismatch', 'ambiguous'].includes(apply.readback.state) && apply.retry_allowed !== false) fail('mismatched or ambiguous readback must stop without retry');
  strings(plan.limitations, 'limitations', 1);
  return plan;
}

function validateBio(bio, field, limit) {
  exactKeys(bio, ['text', 'character_count', 'claim_notes'], field);
  if (!bio?.text || !Number.isInteger(bio.character_count) || bio.character_count !== codePoints(bio.text)) fail(`${field}.character_count must match Unicode code points`);
  if (limit.state === 'observed_current_ui' && bio.character_count > limit.value) fail(`${field} exceeds the observed current UI limit`);
  if (!Array.isArray(bio.claim_notes)) fail(`${field}.claim_notes must be an array`);
  for (const [index, claim] of bio.claim_notes.entries()) {
    exactKeys(claim, ['text', 'status', 'evidence_refs'], `${field}.claim_notes[${index}]`);
    if (!claim?.text || !['verified_current', 'verified_historical', 'owner_attested'].includes(claim.status)) fail(`${field}.claim_notes[${index}] has an unsupported claim state`);
    strings(claim.evidence_refs, `${field}.claim_notes[${index}].evidence_refs`, 1);
  }
}

function validatePicture(picture, field, interviewRights) {
  exactKeys(picture, ['mode', 'asset_ref', 'asset_sha256', 'source_reference_refs', 'rights_basis', 'rights_confirmed', 'alt_description', 'framing', 'direction', 'accent_color'], field);
  if (!['existing', 'generate_or_edit', 'photography_brief'].includes(picture?.mode) || !picture.alt_description || !picture.framing || !picture.direction || !/^#[A-Fa-f0-9]{6}$/.test(picture.accent_color ?? '')) fail(`${field} is incomplete`);
  if (picture.asset_ref !== null && !isAssetRef(picture.asset_ref)) fail(`${field}.asset_ref must be opaque`);
  if ((picture.asset_ref === null) !== (picture.asset_sha256 === null) || (picture.asset_sha256 !== null && !isHash(picture.asset_sha256))) fail(`${field}.asset_ref and asset_sha256 must be frozen together`);
  if (!Array.isArray(picture.source_reference_refs) || picture.source_reference_refs.some((value) => !isAssetRef(value))) fail(`${field}.source_reference_refs must be opaque`);
  if (!['user_owned', 'licensed', 'explicit_consent', 'not_applicable'].includes(picture.rights_basis) || typeof picture.rights_confirmed !== 'boolean') fail(`${field} requires a rights state`);
  if (picture.mode === 'existing' && (!picture.asset_ref || !picture.asset_sha256 || !picture.rights_confirmed || picture.rights_basis === 'not_applicable')) fail(`${field} existing image requires a frozen owned, licensed, or consented asset`);
  if (picture.mode === 'generate_or_edit' && (!picture.source_reference_refs.length || !picture.rights_confirmed || !interviewRights || picture.rights_basis === 'not_applicable')) fail(`${field} generation/editing requires consented source references`);
  if (picture.mode === 'photography_brief' && picture.asset_ref === null && (picture.rights_basis !== 'not_applicable' || picture.rights_confirmed !== false)) fail(`${field} without an asset must use not_applicable rights`);
}

function esc(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
function md(value) { return String(value).replace(/\r?\n/g, ' ').replace(/[<>]/g, '').trim(); }
function mdList(values) { return values.map((value) => `- ${md(value)}`).join('\n'); }
function wrap(value, width = 42, limit = 5) {
  const words = String(value).replace(/\s+/g, ' ').trim().split(' '); const lines = []; let line = '';
  for (const word of words) { const next = line ? `${line} ${word}` : word; if (line && next.length > width) { lines.push(line); line = word; } else line = next; }
  if (line) lines.push(line); if (lines.length > limit) { lines.length = limit; lines[limit - 1] = `${lines[limit - 1].slice(0, Math.max(1, width - 1))}…`; }
  return lines;
}

function readAssetMap(file) {
  if (!file) return {};
  const map = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  if (!isObject(map)) fail('asset map must be a JSON object');
  for (const [ref, source] of Object.entries(map)) if (!isAssetRef(ref) || typeof source !== 'string' || !path.isAbsolute(source)) fail('asset map must map opaque refs to absolute paths');
  return map;
}

function readRaster(ref, picture, assetMap) {
  if (!ref || !Object.hasOwn(assetMap, ref)) return null;
  if (!picture.rights_confirmed || picture.rights_basis === 'not_applicable') fail(`asset ${ref} does not have confirmed rights`);
  const file = assetMap[ref]; const info = fs.lstatSync(file, { throwIfNoEntry: false });
  if (!info || !info.isFile() || info.isSymbolicLink()) fail(`asset ${ref} must be a regular non-symlink file`);
  if (info.size > 25 * 1024 * 1024) fail(`asset ${ref} exceeds 25 MiB`);
  const bytes = fs.readFileSync(file); if (sha256(bytes) !== picture.asset_sha256) fail(`asset ${ref} does not match its frozen SHA-256`); const type = rasterTypes.find((candidate) => candidate.match(bytes));
  if (!type) fail(`asset ${ref} must be PNG, JPEG, WebP, or GIF`);
  return { bytes, ...type };
}

function avatarSvg(picture, id, raster, { x = 0, y = 0, size = 1080, selected = false, clipKey = 'avatar' } = {}) {
  const clip = `clip-${clipKey}-${id}-${x}-${y}`.replace(/[^A-Za-z0-9_-]/g, '-'); const inset = size * 0.055;
  const media = raster
    ? `<image x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" href="data:${raster.mime};base64,${raster.bytes.toString('base64')}" clip-path="url(#${clip})"/>`
    : `<circle cx="${x + size * .5}" cy="${y + size * .5}" r="${size * .5}" fill="${picture.accent_color}"/><circle cx="${x + size * .5}" cy="${y + size * .38}" r="${size * .17}" fill="#fff" opacity=".92"/><path d="M ${x + size * .2} ${y + size * .86} Q ${x + size * .5} ${y + size * .54} ${x + size * .8} ${y + size * .86} Z" fill="#fff" opacity=".92"/><text x="${x + size * .5}" y="${y + size * .91}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${size * .038}" font-weight="700" fill="#fff">VISUAL BRIEF ${esc(id)}</text>`;
  return `<defs><clipPath id="${clip}"><circle cx="${x + size * .5}" cy="${y + size * .5}" r="${size * .5}"/></clipPath></defs><g clip-path="url(#${clip})">${media}</g><circle cx="${x + size * .5}" cy="${y + size * .5}" r="${size * .5 - inset}" fill="none" stroke="${selected ? '#111827' : '#ffffff'}" stroke-width="${Math.max(3, size * .012)}" opacity=".85"/>`;
}

function selectedSvg(plan, selected, raster) {
  const fallback = raster ? 'Constrained square preview of the selected consented raster' : 'Deterministic placeholder — replace with the completed photography or generation brief before upload';
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080" role="img" aria-labelledby="title desc"><title id="title">Selected profile visual ${esc(selected.id)}</title><desc id="desc">${esc(selected.picture.alt_description)}. ${esc(fallback)}.</desc>${avatarSvg(selected.picture, selected.id, raster, { clipKey: 'selected' })}</svg>\n`;
}

function previewSvg(plan, rasters) {
  const cards = plan.candidates.map((candidate, index) => {
    const x = 40 + index * 580; const selected = candidate.id === plan.selected_profile.candidate_id; const bioLines = wrap(candidate.bio.text, 45, 5);
    return `<g><rect x="${x}" y="38" width="540" height="724" rx="34" fill="${selected ? '#fff7ed' : '#ffffff'}" stroke="${selected ? '#f97316' : '#d1d5db'}" stroke-width="${selected ? 6 : 2}"/><g transform="translate(${x + 160} 76) scale(.205)">${avatarSvg(candidate.picture, candidate.id, rasters.get(candidate.id), { size: 1080, selected, clipKey: `preview-${candidate.id}` })}</g><text x="${x + 40}" y="342" font-family="system-ui,sans-serif" font-size="28" font-weight="800" fill="#111827">${esc(candidate.id)} · ${esc(candidate.label)}</text>${bioLines.map((line, lineIndex) => `<text x="${x + 40}" y="${386 + lineIndex * 30}" font-family="system-ui,sans-serif" font-size="19" fill="#374151">${esc(line)}</text>`).join('')}<text x="${x + 40}" y="570" font-family="system-ui,sans-serif" font-size="17" fill="#6b7280">${esc(candidate.strategy.replaceAll('_', ' '))}</text><text x="${x + 40}" y="612" font-family="system-ui,sans-serif" font-size="17" fill="#111827">Clarity ${candidate.scores.clarity}/5 · Proof ${candidate.scores.credibility}/5</text><text x="${x + 40}" y="646" font-family="system-ui,sans-serif" font-size="17" fill="#111827">Distinct ${candidate.scores.distinctiveness}/5 · CTA ${candidate.scores.cta_alignment}/5</text><text x="${x + 40}" y="680" font-family="system-ui,sans-serif" font-size="17" fill="#111827">Tiny circle ${candidate.scores.tiny_circle_legibility}/5</text>${selected ? `<text x="${x + 40}" y="726" font-family="system-ui,sans-serif" font-size="18" font-weight="800" fill="#c2410c">OWNER SELECTED</text>` : ''}</g>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="1800" height="800" viewBox="0 0 1800 800" role="img" aria-labelledby="title desc"><title id="title">Three Threads profile systems</title><desc id="desc">Clarity, authority, and personality alternatives with small-circle previews.</desc><rect width="1800" height="800" fill="#f3f4f6"/>${cards}</svg>\n`;
}

export function renderMarkdown(plan, visualFallback) {
  const selected = plan.selected_profile;
  return `# Threads profile refresh\n\n**Account:** ${md(plan.account.label)}  \n**Selection:** ${md(selected.candidate_id)} — ${md(plan.candidates.find((candidate) => candidate.id === selected.candidate_id).label)}  \n**Visual delivery:** ${visualFallback ? 'deterministic placeholder' : 'consented local raster preview'}  \n**Apply state:** ${md(plan.apply_plan.status)}\n\n## Selected system\n\n### Bio\n\n${md(selected.bio.text)}\n\n${selected.bio.character_count} Unicode code points.\n\n### Picture\n\n**Mode:** ${md(selected.picture.mode)}  \n**Direction:** ${md(selected.picture.direction)}  \n**Framing:** ${md(selected.picture.framing)}  \n**Alt description:** ${md(selected.picture.alt_description)}\n\n## All three systems\n\n${plan.candidates.map((candidate) => `### ${candidate.id}. ${md(candidate.label)}\n\n${md(candidate.bio.text)}\n\nPicture: ${md(candidate.picture.direction)}\n\nScores: clarity ${candidate.scores.clarity}/5; credibility ${candidate.scores.credibility}/5; distinctiveness ${candidate.scores.distinctiveness}/5; CTA ${candidate.scores.cta_alignment}/5; tiny circle ${candidate.scores.tiny_circle_legibility}/5.`).join('\n\n')}\n\n## Why this one\n\n${md(selected.selection_reason)}\n\n## Manual apply instructions\n\n${mdList(plan.apply_plan.manual_instructions)}\n\n## Agent-control guardrails\n\n${mdList(plan.apply_plan.agent_instructions)}\n\n## Context coverage\n\n${plan.context_coverage.sources.map((source) => `- **${md(source.kind)} — ${md(source.status)}:** ${md(source.summary)}`).join('\n')}\n\n### Gaps\n\n${plan.context_coverage.gaps.length ? mdList(plan.context_coverage.gaps) : '- None recorded.'}\n\n## Limits\n\n${mdList(plan.limitations)}\n\n_A profile transformation is not proof of growth or conversion. Rendering this plan does not authorize or perform a live profile edit._\n`;
}

export function renderHtml(plan, selectedVisual, previewGrid, visualFallback) {
  const selected = plan.selected_profile; const candidate = plan.candidates.find((item) => item.id === selected.candidate_id);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><title>Threads profile refresh</title><style>:root{color-scheme:light;--ink:#111827;--muted:#6b7280;--paper:#f3f4f6;--card:#fff;--accent:#f97316}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 system-ui,-apple-system,sans-serif}.page{max-width:1080px;margin:auto;padding:48px 24px}.hero,.card{background:var(--card);border:1px solid #d1d5db;border-radius:24px;padding:28px;margin:0 0 20px}.hero{display:grid;grid-template-columns:minmax(180px,300px) 1fr;gap:28px;align-items:center}.avatar svg{display:block;width:100%;height:auto}.eyebrow{color:var(--accent);font-weight:800;text-transform:uppercase;letter-spacing:.08em}h1{font-size:clamp(34px,6vw,62px);line-height:1;margin:.15em 0}.bio{font-size:22px;white-space:pre-wrap}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px}.preview svg{width:100%;height:auto}.pill{display:inline-block;border:1px solid #d1d5db;border-radius:999px;padding:4px 10px;margin:2px;color:var(--muted)}small{color:var(--muted)}@media(max-width:700px){.hero{grid-template-columns:1fr}.avatar{max-width:260px}}@media print{body{background:#fff}.page{padding:0}.card,.hero{break-inside:avoid}}</style></head><body><main class="page"><p class="eyebrow">Threadify · Refresh Your Threads Profile</p><section class="hero"><div class="avatar">${selectedVisual.replace(/^<\?xml[^>]+>/, '')}</div><div><small>${esc(plan.account.label)} · candidate ${esc(candidate.id)} · ${visualFallback ? 'placeholder visual' : 'consented asset preview'}</small><h1>${esc(candidate.label)}</h1><p class="bio">${esc(selected.bio.text)}</p><p>${selected.bio.character_count} Unicode code points</p></div></section><section class="card preview"><h2>Three systems</h2>${previewGrid.replace(/^<\?xml[^>]+>/, '')}</section><div class="grid"><section class="card"><h2>Picture direction</h2><p>${esc(selected.picture.direction)}</p><p><strong>Framing:</strong> ${esc(selected.picture.framing)}</p><p><strong>Small-circle description:</strong> ${esc(selected.picture.alt_description)}</p></section><section class="card"><h2>Why this one</h2><p>${esc(selected.selection_reason)}</p><span class="pill">${esc(plan.apply_plan.status)}</span><span class="pill">${esc(plan.apply_plan.mode)}</span></section></div><section class="card"><h2>Manual apply</h2><ol>${plan.apply_plan.manual_instructions.map((step) => `<li>${esc(step)}</li>`).join('')}</ol></section><section class="card"><h2>Agent-control guardrails</h2><ul>${plan.apply_plan.agent_instructions.map((step) => `<li>${esc(step)}</li>`).join('')}</ul></section><section class="card"><h2>Coverage and limits</h2>${plan.context_coverage.sources.map((source) => `<p><strong>${esc(source.kind)}</strong> · ${esc(source.status)}<br>${esc(source.summary)}</p>`).join('')}<ul>${plan.limitations.map((value) => `<li>${esc(value)}</li>`).join('')}</ul><small>A profile transformation is not proof of growth or conversion. This report does not authorize or perform a live edit.</small></section></main></body></html>\n`;
}

export function writePlan(plan, outputDir, { assetMap = {} } = {}) {
  validatePlan(plan); fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });
  const outputInfo = fs.lstatSync(outputDir); if (!outputInfo.isDirectory() || outputInfo.isSymbolicLink()) fail('output directory must be a real directory');
  const selected = plan.candidates.find((candidate) => candidate.id === plan.selected_profile.candidate_id);
  const rasters = new Map(plan.candidates.map((candidate) => [candidate.id, readRaster(candidate.picture.asset_ref, candidate.picture, assetMap)]));
  const selectedRaster = rasters.get(selected.id); const selectedVisual = selectedSvg(plan, selected, selectedRaster); const previewGrid = previewSvg(plan, rasters);
  const json = canonicalJson(plan); const markdown = renderMarkdown(plan, !selectedRaster); const html = renderHtml(plan, selectedVisual, previewGrid, !selectedRaster);
  const contents = new Map([
    ['profile-plan.json', Buffer.from(json)],
    ['profile-plan.md', Buffer.from(markdown)],
    ['profile-plan.html', Buffer.from(html)],
    ['profile-picture-selected.svg', Buffer.from(selectedVisual)],
    ['profile-picture-preview-grid.svg', Buffer.from(previewGrid)],
  ]);
  if (selectedRaster) contents.set(`profile-picture-source.${selectedRaster.extension}`, selectedRaster.bytes);
  const files = {};
  for (const [name, content] of contents) {
    files[name] = { name, sha256: sha256(content), bytes: content.length };
  }
  const receipt = {
    schema_version: 1,
    workflow_id: 'refresh-your-threads-profile',
    generated_at: plan.generated_at,
    account_label_sha256: sha256(Buffer.from(plan.account.label)),
    plan_sha256: sha256(Buffer.from(json)),
    selected_candidate_id: selected.id,
    visual_delivery: selectedRaster ? 'consented_local_raster' : 'deterministic_placeholder',
    apply_mode: plan.apply_plan.mode,
    apply_status: plan.apply_plan.status,
    exact_account_verified: plan.apply_plan.exact_account_verified,
    confirmation_state: plan.apply_plan.confirmation.state,
    readback_state: plan.apply_plan.readback.state,
    retry_allowed: plan.apply_plan.retry_allowed,
    fallback_state: selectedRaster ? 'not_used' : 'visual_placeholder_used',
    files,
  };
  const receiptName = 'profile-plan-receipt.json'; const receiptContent = Buffer.from(canonicalJson(receipt));
  for (const [name, content] of contents) preflightArtifact(path.join(outputDir, name), content);
  preflightArtifact(path.join(outputDir, receiptName), receiptContent);
  for (const [name, content] of contents) writeArtifact(path.join(outputDir, name), content);
  writeArtifact(path.join(outputDir, receiptName), receiptContent);
  return { files: [...contents.keys(), receiptName], plan_sha256: receipt.plan_sha256, visual_delivery: receipt.visual_delivery };
}

function writeArtifact(file, content) {
  preflightArtifact(file, content);
  if (fs.existsSync(file)) return;
  fs.writeFileSync(file, content, { flag: 'wx', mode: 0o600 });
}

function preflightArtifact(file, content) {
  const info = fs.lstatSync(file, { throwIfNoEntry: false });
  if (info) {
    if (!info.isFile() || info.isSymbolicLink()) fail(`refusing unsafe existing artifact: ${path.basename(file)}`);
    if (!fs.readFileSync(file).equals(content)) fail(`refusing to overwrite differing artifact: ${path.basename(file)}`);
  }
}

function args(argv) {
  const out = { command: argv[2] };
  for (let index = 3; index < argv.length; index += 2) {
    const flag = argv[index]; if (!flag?.startsWith('--') || argv[index + 1] === undefined) fail('options must be --name VALUE pairs'); out[flag.slice(2)] = argv[index + 1];
  }
  return out;
}

if (sameFile(process.argv[1], moduleFile)) {
  try {
    const options = args(process.argv);
    if (options.command !== 'render' || !options.input || !options['output-dir']) fail('usage: cli.mjs render --input PATH --output-dir PATH [--asset-map PATH]');
    const plan = JSON.parse(fs.readFileSync(path.resolve(options.input), 'utf8'));
    process.stdout.write(`${JSON.stringify(writePlan(plan, path.resolve(options['output-dir']), { assetMap: readAssetMap(options['asset-map']) }), null, 2)}\n`);
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
