#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

function fail(message) { throw new Error(message); }
function strings(value, field, exact) {
  if (!Array.isArray(value) || value.length < (exact ?? 1) || (exact && value.length !== exact) || value.some((item) => typeof item !== 'string' || !item.trim())) fail(`${field} must contain ${exact ?? 'one or more'} non-empty strings`);
}
export function validateReport(report) {
  if (!report || report.schema_version !== 1) fail('schema_version must be 1');
  if (!report.account?.label || typeof report.account.verified !== 'boolean') fail('account label and verified state are required');
  const window = report.window ?? {};
  if (window.requested_days !== 90 || !Number.isInteger(window.expanded_days) || window.expanded_days < 90 || window.expanded_days > 365 || !Number.isInteger(window.owned_post_count) || window.owned_post_count < 0) fail('window must use the bounded 90-to-365-day contract');
  for (const key of ['posts_complete', 'audience_comments_complete', 'creator_replies_complete']) if (typeof report.coverage?.[key] !== 'boolean') fail(`coverage.${key} is required`);
  if (!Array.isArray(report.coverage?.gaps)) fail('coverage.gaps must be an array');
  if (!['provider_ranked', 'user_export_ranked', 'sampled'].includes(report.evidence_method)) fail('invalid evidence_method');
  if (!report.niche?.statement || !report.niche?.avatar || !report.niche?.problem || !report.niche?.mechanism || !report.niche?.why) fail('complete niche recommendation is required');
  if (report.ideal_client?.purchase_intent_proven !== false) fail('purchase intent cannot be claimed from this workflow');
  for (const key of ['pains', 'desired_outcomes', 'language', 'objections']) strings(report.ideal_client?.[key], `ideal_client.${key}`);
  if (!Array.isArray(report.themes) || !report.themes.length) fail('at least one evidence theme is required');
  for (const [index, theme] of report.themes.entries()) {
    if (!theme.theme || !theme.observation || !['owned_post', 'audience_comment', 'creator_reply', 'cross_lane'].includes(theme.lane) || !Number.isInteger(theme.distinct_sources) || theme.distinct_sources < 1) fail(`themes[${index}] is incomplete`);
    strings(theme.evidence_refs, `themes[${index}].evidence_refs`);
  }
  if (!Array.isArray(report.content_pillars) || report.content_pillars.length !== 3) fail('exactly three content pillars are required');
  for (const [index, pillar] of report.content_pillars.entries()) { if (!pillar.name || !pillar.promise) fail(`content_pillars[${index}] is incomplete`); strings(pillar.example_topics, `content_pillars[${index}].example_topics`); }
  strings(report.emphasize, 'emphasize'); strings(report.stop_pursuing, 'stop_pursuing'); strings(report.limitations, 'limitations');
  if (!report.next_profile_action || !['low', 'medium', 'high'].includes(report.confidence)) fail('profile action and confidence are required');
  if (report.evidence_method === 'provider_ranked' && (!report.account.verified || !report.coverage.posts_complete)) fail('provider_ranked requires a verified account and complete post coverage');
  return report;
}
function esc(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
function list(values) { return `<ul>${values.map((value) => `<li>${esc(value)}</li>`).join('')}</ul>`; }
function mdList(values) { return values.map((value) => `- ${value}`).join('\n'); }
export function renderHtml(report) {
  const gaps = report.coverage.gaps.length ? list(report.coverage.gaps) : '<p>None recorded.</p>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><title>${esc(report.niche.statement)}</title><style>:root{color-scheme:light;--ink:#171717;--muted:#68645f;--paper:#f5f0e8;--card:#fffdfa;--accent:#ff4d2e}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 ui-sans-serif,system-ui,-apple-system,sans-serif}.page{max-width:980px;margin:0 auto;padding:56px 24px 80px}.eyebrow{color:var(--accent);font-weight:800;letter-spacing:.12em;text-transform:uppercase}.hero{background:var(--ink);color:white;border-radius:28px;padding:42px;margin:12px 0 28px}h1{font-size:clamp(36px,7vw,68px);line-height:1.02;margin:.2em 0}h2{margin-top:0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:18px}.card{background:var(--card);border:1px solid #ded7cc;border-radius:20px;padding:24px;margin-bottom:18px}.pill{display:inline-block;border:1px solid #ded7cc;border-radius:99px;padding:5px 10px;margin:3px;color:var(--muted)}small{color:var(--muted)}@media print{body{background:white}.page{padding:0}.card,.hero{break-inside:avoid}}</style></head><body><main class="page"><p class="eyebrow">Threadify · Find Your Niche</p><section class="hero"><small>${esc(report.account.label)} · ${esc(report.window.start.slice(0,10))} to ${esc(report.window.end.slice(0,10))}</small><h1>${esc(report.niche.statement)}</h1><p>${esc(report.niche.why)}</p></section><div class="grid"><section class="card"><h2>Your ideal client</h2><h3>${esc(report.ideal_client.label)}</h3><p>${esc(report.ideal_client.situation)}</p><h3>Pains</h3>${list(report.ideal_client.pains)}<h3>Desired outcomes</h3>${list(report.ideal_client.desired_outcomes)}</section><section class="card"><h2>What they say</h2>${list(report.ideal_client.language)}<h3>Objections</h3>${list(report.ideal_client.objections)}</section></div><section class="card"><h2>Your three content pillars</h2><div class="grid">${report.content_pillars.map((pillar) => `<div><h3>${esc(pillar.name)}</h3><p>${esc(pillar.promise)}</p>${list(pillar.example_topics)}</div>`).join('')}</div></section><div class="grid"><section class="card"><h2>Double down on</h2>${list(report.emphasize)}</section><section class="card"><h2>Stop pursuing</h2>${list(report.stop_pursuing)}</section></div><section class="card"><h2>Why this recommendation</h2>${report.themes.map((theme) => `<p><strong>${esc(theme.theme)}</strong> <span class="pill">${esc(theme.lane)}</span><br>${esc(theme.observation)} <small>${theme.distinct_sources} distinct source(s): ${esc(theme.evidence_refs.join(', '))}</small></p>`).join('')}</section><section class="card"><h2>Next profile action</h2><p>${esc(report.next_profile_action)}</p></section><section class="card"><h2>Coverage and limits</h2><p><strong>${esc(report.evidence_method)}</strong> · ${report.window.owned_post_count} owned posts · ${esc(report.confidence)} confidence</p>${gaps}${list(report.limitations)}<small>This avatar is a single recommendation from observed resonance. Engagement does not prove purchase intent.</small></section></main></body></html>`;
}
export function renderMarkdown(report) {
  return `# ${report.niche.statement}\n\n**Account:** ${report.account.label}  \n**Window:** ${report.window.start} to ${report.window.end}  \n**Method:** ${report.evidence_method}  \n**Confidence:** ${report.confidence}\n\n## Ideal client\n\n**${report.ideal_client.label}** — ${report.ideal_client.situation}\n\n### Pains\n\n${mdList(report.ideal_client.pains)}\n\n### Desired outcomes\n\n${mdList(report.ideal_client.desired_outcomes)}\n\n### Their language\n\n${mdList(report.ideal_client.language)}\n\n### Objections\n\n${mdList(report.ideal_client.objections)}\n\n## Content pillars\n\n${report.content_pillars.map((pillar, index) => `${index + 1}. **${pillar.name}:** ${pillar.promise}\n${mdList(pillar.example_topics)}`).join('\n\n')}\n\n## Double down on\n\n${mdList(report.emphasize)}\n\n## Stop pursuing\n\n${mdList(report.stop_pursuing)}\n\n## Next profile action\n\n${report.next_profile_action}\n\n## Evidence and limitations\n\n${report.themes.map((theme) => `- **${theme.theme} (${theme.lane}):** ${theme.observation} — ${theme.distinct_sources} distinct source(s); ${theme.evidence_refs.join(', ')}`).join('\n')}\n\n### Coverage gaps\n\n${report.coverage.gaps.length ? mdList(report.coverage.gaps) : '- None recorded.'}\n\n${mdList(report.limitations)}\n\n_The avatar is a single recommendation from observed resonance. Engagement does not prove purchase intent._\n`;
}
export function writeReport(report, outputDir) {
  validateReport(report); fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });
  const canonical = `${JSON.stringify(report, null, 2)}\n`; const hash = crypto.createHash('sha256').update(canonical).digest('hex');
  const files = { json: path.join(outputDir, 'niche-report.json'), markdown: path.join(outputDir, 'niche-report.md'), html: path.join(outputDir, 'niche-report.html'), receipt: path.join(outputDir, 'niche-report-receipt.json') };
  fs.writeFileSync(files.json, canonical, { mode: 0o600 }); fs.writeFileSync(files.markdown, renderMarkdown(report), { mode: 0o600 }); fs.writeFileSync(files.html, renderHtml(report), { mode: 0o600 });
  fs.writeFileSync(files.receipt, `${JSON.stringify({ schema_version: 1, workflow_id: 'find-your-niche', account_label: report.account.label, window: report.window, coverage: report.coverage, evidence_method: report.evidence_method, report_sha256: hash, fallback_state: report.evidence_method === 'provider_ranked' ? 'not_used' : 'used' }, null, 2)}\n`, { mode: 0o600 });
  return { ...files, report_sha256: hash };
}
function args(argv) { const out = { command: argv[2] }; for (let i = 3; i < argv.length; i += 2) out[argv[i]?.replace(/^--/, '')] = argv[i + 1]; return out; }
if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  try { const options = args(process.argv); if (options.command !== 'render' || !options.input || !options['output-dir']) fail('usage: cli.mjs render --input PATH --output-dir PATH'); const report = JSON.parse(fs.readFileSync(path.resolve(options.input), 'utf8')); process.stdout.write(`${JSON.stringify(writeReport(report, path.resolve(options['output-dir'])), null, 2)}\n`); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
