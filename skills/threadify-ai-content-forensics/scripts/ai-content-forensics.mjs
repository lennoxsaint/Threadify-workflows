import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const PLATFORM_LIMITS = Object.freeze({ threads: 500, x: 280, linkedin: 3000, bluesky: 300 });
const CATEGORIES = Object.freeze(['opener', 'proof', 'structure', 'media', 'cta']);
const METRIC_PRIORITY = Object.freeze(['views', 'likes']);

function fail(message) {
  throw new Error(message);
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : canonical(value));
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) fail(`${label}_must_be_nonempty_text`);
  return value.trim();
}

function timestamp(value, label) {
  text(value, label);
  if (Number.isNaN(Date.parse(value))) fail(`${label}_must_be_iso_timestamp`);
  return value;
}

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label}_must_be_object`);
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length) fail(`${label}_unexpected_keys:${unexpected.sort().join(',')}`);
}

function normalizeBody(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

function metricCompleteness(item) {
  return METRIC_PRIORITY.filter((metric) => Number.isInteger(item.metrics?.[metric])).length;
}

function preferItem(left, right) {
  const delta = metricCompleteness(right) - metricCompleteness(left);
  if (delta) return delta > 0 ? right : left;
  for (const metric of METRIC_PRIORITY) {
    const leftMetric = left.metrics?.[metric];
    const rightMetric = right.metrics?.[metric];
    if (Number.isInteger(leftMetric) && Number.isInteger(rightMetric) && leftMetric !== rightMetric) {
      return rightMetric > leftMetric ? right : left;
    }
  }
  if (right.text.length !== left.text.length) return right.text.length > left.text.length ? right : left;
  return right.evidence_id < left.evidence_id ? right : left;
}

function validateSource(source) {
  exactKeys(source, [
    'source_id', 'provider', 'platform', 'auth_mode', 'observed_at', 'requested_count',
    'returned_count', 'complete', 'cache_status', 'evidence_ref',
  ], `source:${source?.source_id ?? 'unknown'}`);
  for (const key of ['source_id', 'provider', 'platform', 'auth_mode', 'evidence_ref']) text(source[key], `source_${key}`);
  timestamp(source.observed_at, 'source_observed_at');
  if (!['local_export', 'public', 'owned_account', 'byo_key'].includes(source.auth_mode)) fail('source_auth_mode_invalid');
  for (const key of ['requested_count', 'returned_count']) {
    if (!Number.isInteger(source[key]) || source[key] < 0) fail(`source_${key}_invalid`);
  }
  if (typeof source.complete !== 'boolean') fail('source_complete_must_be_boolean');
  if (source.returned_count > source.requested_count && source.requested_count !== 0) fail('source_returned_exceeds_requested');
  return structuredClone(source);
}

function validateItem(item, sourcesById) {
  exactKeys(item, [
    'evidence_id', 'source_id', 'platform', 'creator_handle', 'native_id', 'url',
    'published_at', 'format_family', 'title', 'text', 'metrics', 'source_kind', 'rights_basis',
  ], `item:${item?.evidence_id ?? 'unknown'}`);
  for (const key of ['evidence_id', 'source_id', 'platform', 'creator_handle', 'native_id', 'format_family', 'rights_basis']) {
    text(item[key], `item_${key}`);
  }
  const source = sourcesById.get(item.source_id);
  if (!source) fail(`item_unknown_source:${item.source_id}`);
  if (item.platform !== source.platform) fail(`item_source_platform_mismatch:${item.evidence_id}`);
  timestamp(item.published_at, 'item_published_at');
  if (typeof item.text !== 'string') fail('item_text_must_be_string');
  if (!['owned', 'public', 'licensed', 'permissioned'].includes(item.source_kind)) fail('item_source_kind_invalid');
  exactKeys(item.metrics, ['views', 'likes', 'replies', 'reposts'], `item_metrics:${item.evidence_id}`);
  const metrics = {};
  for (const key of ['views', 'likes', 'replies', 'reposts']) {
    const value = item.metrics[key] ?? null;
    if (value !== null && (!Number.isInteger(value) || value < 0)) fail(`item_metric_invalid:${item.evidence_id}:${key}`);
    metrics[key] = value;
  }
  return { ...structuredClone(item), metrics };
}

export function dedupeItems(items) {
  const byNative = new Map();
  const evidenceAliases = {};
  let duplicateNativeCount = 0;
  for (const item of [...items].sort((left, right) => left.evidence_id.localeCompare(right.evidence_id))) {
    const key = `${item.platform}\u0000${item.native_id}`;
    if (byNative.has(key)) {
      duplicateNativeCount += 1;
      const previous = byNative.get(key);
      const winner = preferItem(previous, item);
      const loser = winner === previous ? item : previous;
      evidenceAliases[loser.evidence_id] = winner.evidence_id;
      byNative.set(key, winner);
    } else byNative.set(key, item);
  }
  const byBody = new Map();
  const bodyless = [];
  let duplicateBodyCount = 0;
  for (const item of byNative.values()) {
    const body = normalizeBody(item.text || item.title || '');
    if (!body) { bodyless.push(item); continue; }
    const key = `${item.platform}\u0000${item.creator_handle.toLowerCase()}\u0000${body}`;
    if (byBody.has(key)) {
      duplicateBodyCount += 1;
      const previous = byBody.get(key);
      const winner = preferItem(previous, item);
      const loser = winner === previous ? item : previous;
      evidenceAliases[loser.evidence_id] = winner.evidence_id;
      byBody.set(key, winner);
    } else byBody.set(key, item);
  }
  return {
    items: [...byBody.values(), ...bodyless].sort((left, right) =>
      left.platform.localeCompare(right.platform) || left.published_at.localeCompare(right.published_at)
      || left.evidence_id.localeCompare(right.evidence_id)),
    duplicate_native_count: duplicateNativeCount,
    duplicate_body_count: duplicateBodyCount,
    evidence_aliases: evidenceAliases,
  };
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function round(value) {
  return value === null ? null : Number(value.toFixed(2));
}

export function buildCoverage(items, sources) {
  const groups = new Map();
  for (const item of items) {
    const key = `${item.platform}\u0000${item.format_family}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const cohorts = [];
  for (const [key, group] of [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const [platform, formatFamily] = key.split('\u0000');
    let primaryMetric = null;
    let values = [];
    let availableMetricCount = 0;
    for (const metric of METRIC_PRIORITY) {
      const candidate = group.map((item) => item.metrics[metric]).filter(Number.isInteger);
      availableMetricCount = Math.max(availableMetricCount, candidate.length);
      if (candidate.length >= 20) { primaryMetric = metric; values = candidate; break; }
    }
    const comparable = primaryMetric !== null;
    const sorted = [...values].sort((a, b) => a - b);
    const topCount = comparable ? Math.max(2, Math.ceil(sorted.length * 0.1)) : 0;
    const bottomCount = comparable ? Math.max(5, Math.ceil(sorted.length * 0.25)) : 0;
    cohorts.push({
      evidence_id: comparable ? `aggregate:${platform}:${formatFamily}:${primaryMetric}` : null,
      platform,
      format_family: formatFamily,
      unique_count: group.length,
      primary_metric: primaryMetric,
      metric_valid_count: comparable ? values.length : availableMetricCount,
      comparison_status: comparable ? 'comparative' : 'descriptive_only',
      median: round(median(values)),
      top_decile_mean: comparable ? round(mean(sorted.slice(-topCount))) : null,
      bottom_quartile_mean: comparable ? round(mean(sorted.slice(0, bottomCount))) : null,
      limitation: comparable
        ? 'Observed within this platform and format family; correlation does not prove causation or future performance.'
        : 'Fewer than 20 unique items share one supported comparison metric; use descriptive patterns only.',
    });
  }
  return {
    requested_count: sources.reduce((sum, source) => sum + source.requested_count, 0),
    returned_count: sources.reduce((sum, source) => sum + source.returned_count, 0),
    source_complete: sources.every((source) => source.complete),
    source_count: sources.length,
    cohorts,
  };
}

function resolveAlias(evidenceId, evidenceAliases) {
  const visited = new Set();
  let current = evidenceId;
  while (evidenceAliases[current]) {
    if (visited.has(current)) fail(`evidence_alias_cycle:${evidenceId}`);
    visited.add(current);
    current = evidenceAliases[current];
  }
  return current;
}

function validateFinding(finding, evidenceIds, evidenceAliases) {
  exactKeys(finding, [
    'finding_id', 'rank', 'category', 'claim', 'explanation', 'copy_this', 'evidence_ids', 'limitation',
  ], `finding:${finding?.finding_id ?? 'unknown'}`);
  for (const key of ['finding_id', 'claim', 'explanation', 'copy_this', 'limitation']) text(finding[key], `finding_${key}`);
  if (!Number.isInteger(finding.rank) || finding.rank < 1) fail('finding_rank_invalid');
  if (!CATEGORIES.includes(finding.category)) fail(`finding_category_invalid:${finding.finding_id}`);
  if (!Array.isArray(finding.evidence_ids) || !finding.evidence_ids.length) fail(`finding_evidence_missing:${finding.finding_id}`);
  const resolvedEvidenceIds = finding.evidence_ids.map((evidenceId) => resolveAlias(evidenceId, evidenceAliases));
  for (const evidenceId of resolvedEvidenceIds) {
    if (!evidenceIds.has(evidenceId)) fail(`finding_unknown_evidence:${finding.finding_id}:${evidenceId}`);
  }
  return { ...structuredClone(finding), evidence_ids: [...new Set(resolvedEvidenceIds)] };
}

function buildPost(index, finding) {
  return `${index}. ${finding.claim}\n\n${finding.explanation}\n\ncopy this: ${finding.copy_this}`;
}

function validatePosts(posts, platform) {
  const limit = PLATFORM_LIMITS[platform];
  if (!limit) fail(`unsupported_destination_platform:${platform}`);
  if (posts.length !== 10) fail('thread_must_have_exactly_ten_posts');
  posts.forEach((post, index) => {
    if (!post.trim()) fail(`thread_post_empty:${index + 1}`);
    if (post.length > limit) fail(`thread_post_too_long:${index + 1}:${post.length}:${limit}`);
    if (index >= 1 && index <= 7 && !post.includes('\n\ncopy this: ')) fail(`thread_post_missing_copy_this:${index + 1}`);
  });
}

function escapeXml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function wrap(value, width = 42) {
  const lines = [];
  let current = '';
  for (const word of value.replace(/\s+/g, ' ').trim().split(' ')) {
    if (!current || `${current} ${word}`.length <= width) current = current ? `${current} ${word}` : word;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines.slice(0, 14);
}

export function writeVisuals(posts, outputDirectory) {
  fs.mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
  const manifest = [];
  posts.forEach((post, index) => {
    const number = String(index + 1).padStart(2, '0');
    const lines = wrap(post);
    const tspans = lines.map((line, lineIndex) =>
      `<tspan x="92" dy="${lineIndex ? 56 : 0}">${escapeXml(line)}</tspan>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><rect width="1080" height="1350" fill="#f5efe4"/><rect x="52" y="52" width="976" height="1246" rx="32" fill="#fffaf2" stroke="#ef3b2d" stroke-width="6"/><text x="92" y="130" font-family="Inter,Arial,sans-serif" font-size="30" fill="#ef3b2d">AI CONTENT FORENSICS · ${number}/10</text><text x="92" y="240" font-family="Inter,Arial,sans-serif" font-size="42" fill="#111827">${tspans}</text><text x="92" y="1250" font-family="Inter,Arial,sans-serif" font-size="24" fill="#6b7280">Observed pattern · not a performance guarantee</text></svg>\n`;
    const html = `<!doctype html><meta charset="utf-8"><title>AI Content Forensics ${number}</title><style>html,body{margin:0;background:#ddd}img{display:block;width:min(100vw,1080px);margin:auto}</style><img alt="AI Content Forensics card ${number}" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">\n`;
    const svgName = `${number}-forensics.svg`;
    const htmlName = `${number}-forensics.html`;
    fs.writeFileSync(path.join(outputDirectory, svgName), svg, { mode: 0o600 });
    fs.writeFileSync(path.join(outputDirectory, htmlName), html, { mode: 0o600 });
    manifest.push({ post: index + 1, svg: svgName, html: htmlName, post_sha256: sha256(post) });
  });
  fs.writeFileSync(path.join(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  return manifest;
}

export function runForensics(input, { visualDirectory = null } = {}) {
  exactKeys(input, [
    'record_type', 'schema_version', 'run_id', 'creator', 'destination_platform', 'observed_at',
    'sources', 'items', 'finding_candidates', 'hook', 'action_post', 'cta_post',
  ], 'input');
  if (input.record_type !== 'AIContentForensicsInputV1' || input.schema_version !== 1) fail('input_identity_invalid');
  text(input.run_id, 'run_id');
  timestamp(input.observed_at, 'observed_at');
  exactKeys(input.creator, ['display_name', 'handle', 'publisher_handle'], 'creator');
  text(input.creator.display_name, 'creator_display_name');
  text(input.creator.handle, 'creator_handle');
  if (!Array.isArray(input.sources) || !input.sources.length) fail('sources_required');
  const sources = input.sources.map(validateSource);
  const sourcesById = new Map(sources.map((source) => [source.source_id, source]));
  if (sourcesById.size !== sources.length) fail('duplicate_source_id');
  if (!Array.isArray(input.items) || !input.items.length) fail('items_required');
  const validatedItems = input.items.map((item) => validateItem(item, sourcesById));
  const itemEvidenceIds = new Set(validatedItems.map((item) => item.evidence_id));
  if (itemEvidenceIds.size !== validatedItems.length) fail('duplicate_item_evidence_id');
  for (const source of sources) {
    const observedCount = validatedItems.filter((item) => item.source_id === source.source_id).length;
    if (observedCount !== source.returned_count) fail(`source_returned_count_mismatch:${source.source_id}`);
  }
  const deduped = dedupeItems(validatedItems);
  const coverage = buildCoverage(deduped.items, sources);
  coverage.input_item_count = validatedItems.length;
  coverage.unique_item_count = deduped.items.length;
  coverage.duplicate_native_count = deduped.duplicate_native_count;
  coverage.duplicate_body_count = deduped.duplicate_body_count;
  coverage.evidence_aliases = deduped.evidence_aliases;
  const evidenceIds = new Set(deduped.items.map((item) => item.evidence_id));
  for (const cohort of coverage.cohorts) if (cohort.evidence_id) evidenceIds.add(cohort.evidence_id);
  if (!Array.isArray(input.finding_candidates) || input.finding_candidates.length < 10) fail('at_least_ten_findings_required');
  const findings = input.finding_candidates.map((finding) => validateFinding(finding, evidenceIds, deduped.evidence_aliases));
  const findingIds = new Set(findings.map((finding) => finding.finding_id));
  if (findingIds.size !== findings.length) fail('duplicate_finding_id');
  const selected = [...findings].sort((left, right) => left.rank - right.rank || left.finding_id.localeCompare(right.finding_id)).slice(0, 7);
  if (new Set(selected.map((finding) => finding.rank)).size !== selected.length) fail('selected_finding_ranks_must_be_unique');
  const selectedCategories = new Set(selected.map((finding) => finding.category));
  for (const required of CATEGORIES) {
    if (!selectedCategories.has(required)) fail(`selected_findings_missing_category:${required}`);
  }
  const posts = [
    text(input.hook, 'hook'),
    ...selected.map((finding, index) => buildPost(index + 1, finding)),
    text(input.action_post, 'action_post'),
    text(input.cta_post, 'cta_post'),
  ];
  validatePosts(posts, input.destination_platform);
  const constitutions = Object.fromEntries(CATEGORIES.map((category) => [category, selected
    .filter((finding) => finding.category === category)
    .map((finding) => ({ finding_id: finding.finding_id, rule: finding.claim, evidence_ids: finding.evidence_ids }))]));
  constitutions.master = selected.map((finding) => ({ finding_id: finding.finding_id, rule: finding.claim }));
  const threadHash = sha256(posts);
  const visualManifest = visualDirectory ? writeVisuals(posts, visualDirectory) : [];
  return {
    record_type: 'AIContentForensicsOutputV1',
    schema_version: 1,
    run_id: input.run_id,
    status: 'prepared_locally',
    coverage,
    constitutions,
    insight_audit: {
      selected,
      runner_ups: findings.filter((finding) => !selected.some((choice) => choice.finding_id === finding.finding_id)),
      selection_rule: 'Lowest unique rank first after evidence validation; exact seven covering opener, proof, structure, media, and CTA.',
    },
    thread: posts,
    receipt: {
      workflow_id: 'ai-content-forensics',
      adapter: sources.map((source) => source.provider).sort(),
      account_handle: input.creator.handle,
      action: 'prepare_local_forensics_package',
      approved_text: null,
      approved_text_sha256: threadHash,
      status: 'prepared_locally',
      timestamp: input.observed_at,
      timezone: 'UTC',
      tool_path: 'local_engine',
      fallback_used: sources.every((source) => source.auth_mode === 'local_export'),
      fallback_state: sources.every((source) => source.auth_mode === 'local_export') ? 'local_export' : 'not_used',
      provider_writes_performed: false,
      source_count: sources.length,
      input_item_count: validatedItems.length,
      unique_item_count: deduped.items.length,
      selected_finding_ids: selected.map((finding) => finding.finding_id),
      thread_post_count: posts.length,
      thread_sha256: threadHash,
      visuals_generated: visualManifest.length,
      raw_bodies_retained_in_receipt: false,
      limitations: [
        'Observed associations do not prove causation or future performance.',
        'Coverage and metric availability differ by platform and provider.',
        'Prepared locally does not mean saved, scheduled, or published.',
      ],
    },
  };
}

export { PLATFORM_LIMITS };
