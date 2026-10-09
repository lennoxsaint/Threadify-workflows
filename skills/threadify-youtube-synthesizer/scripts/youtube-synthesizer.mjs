import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const MODULE_ROOT = path.dirname(fileURLToPath(import.meta.url));
function bundledPath(name) {
  const candidates = [
    path.resolve(MODULE_ROOT, `../references/${name}`),
    path.resolve(MODULE_ROOT, `../plugins/threadify/skills/threadify-youtube-synthesizer/references/${name}`),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}
const DEFAULT_TEMPLATE_FILE = bundledPath('templates.v1.json');
const DEFAULT_ORIGINAL_FILE = bundledPath('originals.v1.json');
const DEFAULT_INTEGRITY_FILE = bundledPath('integrity.v1.json');
const PLACEHOLDER = /\{\{([A-Z0-9_]+)\}\}/g;
const CATEGORY_IDS = Object.freeze(['authority', 'investigation_data', 'wisdom', 'playbook_case_study']);
const TRANSCRIPT_ROUTES = Object.freeze(['youtube-transcript', 'yt-dlp-captions', 'pasted-txt', 'pasted-vtt', 'pasted-srt']);
const THREADS_LIMIT = 500;
const MAX_TRANSCRIPT_BYTES = 5_000_000;
const MAX_SEGMENTS = 25_000;
const VENDORED_TRANSCRIPT_SHA256 = '19f59f7b46fec09610143f587995573796a645437eca25af2e8517eeadfb0041';

function fail(code) {
  throw new Error(code);
}

export function canonical(value) {
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

function nonempty(value, code) {
  if (typeof value !== 'string' || !value.trim()) fail(code);
  return value.trim();
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function parseYouTubeId(value) {
  const raw = nonempty(value, 'youtube_url_required');
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail('invalid_youtube_url');
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    if (/^[A-Za-z0-9_-]{11}$/.test(id ?? '')) return id;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    const queryId = url.searchParams.get('v');
    if (/^[A-Za-z0-9_-]{11}$/.test(queryId ?? '')) return queryId;
    const [kind, id] = url.pathname.split('/').filter(Boolean);
    if (['shorts', 'embed', 'live'].includes(kind) && /^[A-Za-z0-9_-]{11}$/.test(id ?? '')) return id;
  }
  fail('invalid_youtube_url');
}

function parseClock(value) {
  const match = String(value).trim().replace(',', '.').match(/^(?:(\d{1,2}):)?(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/);
  if (!match) fail(`invalid_caption_timestamp:${value}`);
  const [, hours = '0', minutes, seconds, millis = '0'] = match;
  return ((Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)) * 1000)
    + Number(millis.padEnd(3, '0'));
}

function normalizeCaptionText(value) {
  return String(value ?? '')
    .replace(/<\/?c(?:\.[^>]*)?>/gi, '')
    .replace(/<\/?v(?:\s+[^>]*)?>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function parsePastedTranscript(content, format = 'txt') {
  if (typeof content !== 'string' || !content.trim()) fail('pasted_transcript_empty');
  if (Buffer.byteLength(content) > MAX_TRANSCRIPT_BYTES) fail('transcript_too_large');
  const normalizedFormat = String(format).toLowerCase().replace(/^\./, '');
  if (!['txt', 'vtt', 'srt'].includes(normalizedFormat)) fail('unsupported_transcript_format');

  if (normalizedFormat === 'txt') {
    const chunks = content.split(/\r?\n+/).map(normalizeCaptionText).filter(Boolean);
    if (!chunks.length) fail('pasted_transcript_empty');
    if (chunks.length > MAX_SEGMENTS) fail('too_many_transcript_segments');
    return chunks.map((text, index) => ({ start_ms: index * 1000, duration_ms: 1000, text }));
  }

  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/);
  const segments = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line.includes('-->')) continue;
    const [startRaw, endTail] = line.split('-->').map((part) => part.trim());
    const endRaw = endTail.split(/\s+/)[0];
    const startMs = parseClock(startRaw);
    const endMs = parseClock(endRaw);
    const textLines = [];
    for (index += 1; index < lines.length && lines[index].trim(); index += 1) {
      if (!/^\d+$/.test(lines[index].trim())) textLines.push(lines[index]);
    }
    const text = normalizeCaptionText(textLines.join(' '));
    if (text) segments.push({ start_ms: startMs, duration_ms: Math.max(0, endMs - startMs), text });
  }
  if (!segments.length) fail('caption_segments_not_found');
  if (segments.length > MAX_SEGMENTS) fail('too_many_transcript_segments');
  return segments;
}

function normalizeFetchedSegments(raw) {
  if (!Array.isArray(raw) || !raw.length) fail('public_captions_empty');
  if (raw.length > MAX_SEGMENTS) fail('too_many_transcript_segments');
  return raw.map((segment, index) => {
    const text = normalizeCaptionText(segment.text);
    if (!text) fail(`caption_segment_empty:${index}`);
    const offset = Number(segment.offset ?? segment.start ?? 0);
    const duration = Number(segment.duration ?? 0);
    return {
      start_ms: Math.max(0, Math.round(offset)),
      duration_ms: Math.max(0, Math.round(duration)),
      text,
    };
  });
}

async function extractWithYoutubeTranscript(url, language) {
  let imported;
  try {
    imported = await import('youtube-transcript');
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    const candidates = [
      new URL('../vendor/youtube-transcript-1.3.1.mjs', import.meta.url),
      new URL('../plugins/threadify/skills/threadify-youtube-synthesizer/vendor/youtube-transcript-1.3.1.mjs', import.meta.url),
    ];
    const vendorUrl = candidates.find((candidate) => fs.existsSync(fileURLToPath(candidate)));
    if (!vendorUrl) fail('youtube_transcript_dependency_unavailable');
    const bytes = fs.readFileSync(fileURLToPath(vendorUrl));
    if (sha256(bytes) !== VENDORED_TRANSCRIPT_SHA256) fail('youtube_transcript_vendor_hash_mismatch');
    imported = await import(vendorUrl.href);
  }
  const fetchTranscript = imported.fetchTranscript ?? imported.YoutubeTranscript?.fetchTranscript;
  if (typeof fetchTranscript !== 'function') fail('youtube_transcript_api_unavailable');
  return normalizeFetchedSegments(await fetchTranscript(url, { lang: language }));
}

export function ytDlpCaptionArgs(url, language, outputTemplate) {
  parseYouTubeId(url);
  nonempty(language, 'caption_language_required');
  nonempty(outputTemplate, 'caption_output_template_required');
  return [
    '--no-playlist',
    '--skip-download',
    '--write-subs',
    '--write-auto-subs',
    '--sub-langs', language,
    '--sub-format', 'vtt',
    '--output', outputTemplate,
    '--', url,
  ];
}

async function extractWithYtDlp(url, language, executable = 'yt-dlp') {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'threadify-youtube-synthesizer-'));
  try {
    const outputTemplate = path.join(tempRoot, '%(id)s.%(ext)s');
    const args = ytDlpCaptionArgs(url, language, outputTemplate);
    await execFileAsync(executable, args, {
      timeout: 120_000,
      maxBuffer: 1_000_000,
      windowsHide: true,
    });
    const files = fs.readdirSync(tempRoot).filter((name) => name.toLowerCase().endsWith('.vtt'));
    if (!files.length) fail('yt_dlp_captions_not_found');
    files.sort();
    const file = path.join(tempRoot, files[0]);
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > MAX_TRANSCRIPT_BYTES) fail('yt_dlp_caption_file_invalid');
    return parsePastedTranscript(fs.readFileSync(file, 'utf8'), 'vtt');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

export function scanTranscriptWarnings(segments) {
  const joined = segments.map((segment) => segment.text).join('\n');
  const patterns = [
    [/ignore (all|any|the) previous instructions?/i, 'transcript_contains_instruction_override_language'],
    [/(system prompt|developer message|assistant role)/i, 'transcript_contains_role_or_prompt_language'],
    [/(run|execute|install|download) (this|the following|a) (command|script|file|program)/i, 'transcript_contains_execution_language'],
    [/https?:\/\/\S+/i, 'transcript_contains_url'],
  ];
  return patterns.filter(([pattern]) => pattern.test(joined)).map(([, warning]) => warning);
}

export async function extractVideoMetadata(url, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') fail('metadata_fetch_unavailable');
  const videoId = parseYouTubeId(url);
  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`;
  const response = await fetchImpl(endpoint, {
    method: 'GET',
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response?.ok) fail(`youtube_metadata_http_${response?.status ?? 'unknown'}`);
  const metadata = await response.json();
  return {
    title: nonempty(metadata?.title, 'youtube_metadata_title_missing'),
    channel: nonempty(metadata?.author_name, 'youtube_metadata_channel_missing'),
  };
}

export async function extractTranscript({
  url,
  language = 'en',
  pastedContent = null,
  pastedFormat = null,
  allowYtDlp = false,
  ytDlpExecutable = 'yt-dlp',
  fetchImpl = globalThis.fetch,
  includeMetadata = true,
} = {}) {
  const videoId = parseYouTubeId(url);
  let route;
  let segments;
  const attempts = [];

  if (pastedContent !== null) {
    const format = String(pastedFormat ?? 'txt').toLowerCase().replace(/^\./, '');
    segments = parsePastedTranscript(pastedContent, format);
    route = `pasted-${format}`;
  } else {
    try {
      segments = await extractWithYoutubeTranscript(url, language);
      route = 'youtube-transcript';
    } catch (error) {
      attempts.push({ route: 'youtube-transcript', error: error.message });
      if (!allowYtDlp) {
        const failure = new Error('public_captions_unavailable_paste_txt_vtt_or_srt');
        failure.attempts = attempts;
        throw failure;
      }
      try {
        segments = await extractWithYtDlp(url, language, ytDlpExecutable);
        route = 'yt-dlp-captions';
      } catch (error2) {
        attempts.push({ route: 'yt-dlp-captions', error: error2.message });
        const failure = new Error('caption_extractors_unavailable_paste_txt_vtt_or_srt');
        failure.attempts = attempts;
        throw failure;
      }
    }
  }

  if (!TRANSCRIPT_ROUTES.includes(route)) fail('invalid_transcript_route');
  let metadata = { title: null, channel: null };
  if (includeMetadata) {
    try {
      metadata = await extractVideoMetadata(url, fetchImpl);
    } catch (error) {
      attempts.push({ route: 'youtube-oembed-metadata', error: error.message });
    }
  }
  const warnings = scanTranscriptWarnings(segments);
  if (includeMetadata && (!metadata.title || !metadata.channel)) warnings.push('youtube_metadata_unavailable');
  return {
    video_id: videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title: metadata.title,
    channel: metadata.channel,
    language,
    route,
    segments,
    transcript_sha256: sha256(segments),
    warnings,
    attempts,
  };
}

export function loadTemplateLibrary(file = DEFAULT_TEMPLATE_FILE) {
  return readJson(file);
}

export function loadOriginalLibrary(file = DEFAULT_ORIGINAL_FILE) {
  return readJson(file);
}

export function loadIntegrityLock(file = DEFAULT_INTEGRITY_FILE) {
  return readJson(file);
}

export function validateIntegrityLock(templateLibrary, originalLibrary, integrityLock = loadIntegrityLock()) {
  const errors = [];
  if (integrityLock?.record_type !== 'YouTubeSynthesizerIntegrityLockV1') errors.push('integrity_lock_record_type_invalid');
  if (integrityLock?.template_library_sha256 !== sha256(templateLibrary)) errors.push('template_library_hash_mismatch');
  if (integrityLock?.original_library_sha256 !== sha256(originalLibrary)) errors.push('original_library_hash_mismatch');
  for (const template of templateLibrary.templates ?? []) {
    const material = {
      hook_template: template.hook_template,
      body_template: template.body_template,
      placeholders: template.placeholders,
      evidence_requirements: template.evidence_requirements,
      original_ids: template.original_ids,
    };
    if (integrityLock?.templates?.[template.id] !== sha256(material)) errors.push(`template_hash_mismatch:${template.id}`);
  }
  for (const original of originalLibrary.originals ?? []) {
    if (integrityLock?.originals?.[original.original_id] !== sha256(original.posts.join('\n\n'))) {
      errors.push(`original_hash_mismatch:${original.original_id}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

function placeholderNames(value) {
  return [...String(value).matchAll(PLACEHOLDER)].map((match) => match[1]);
}

export function validateTemplateLibrary(library, originalLibrary = null) {
  const errors = [];
  if (library?.record_type !== 'YouTubeSynthesizerTemplateLibraryV1') errors.push('template_library_record_type_invalid');
  if (!Array.isArray(library?.templates) || library.templates.length !== 12) errors.push('template_count_must_equal_12');
  const templates = Array.isArray(library?.templates) ? library.templates : [];
  const ids = new Set();
  const categoryCounts = Object.fromEntries(CATEGORY_IDS.map((id) => [id, 0]));
  for (const template of templates) {
    if (ids.has(template.id)) errors.push(`duplicate_template_id:${template.id}`);
    ids.add(template.id);
    if (!CATEGORY_IDS.includes(template.category)) errors.push(`unknown_template_category:${template.id}`);
    else categoryCounts[template.category] += 1;
    if (!nonemptyOrFalse(template.hook_template)) errors.push(`hook_missing:${template.id}`);
    if (!Array.isArray(template.body_template) || template.body_template.length < 7) errors.push(`body_too_short:${template.id}`);
    if (!Array.isArray(template.evidence_requirements) || template.evidence_requirements.length < 3) errors.push(`evidence_requirements_missing:${template.id}`);
    if (!Array.isArray(template.original_ids) || template.original_ids.length !== 3) errors.push(`template_original_count:${template.id}`);
    const declared = new Set((template.placeholders ?? []).map((item) => item.name));
    const actual = new Set([template.hook_template, ...(template.body_template ?? [])].flatMap(placeholderNames));
    for (const name of actual) if (!declared.has(name)) errors.push(`undeclared_placeholder:${template.id}:${name}`);
    for (const name of declared) if (!actual.has(name)) errors.push(`unused_placeholder:${template.id}:${name}`);
  }
  for (const [category, count] of Object.entries(categoryCounts)) {
    if (count !== 3) errors.push(`category_template_count:${category}:${count}`);
  }
  if (originalLibrary) errors.push(...validateOriginalLibrary(originalLibrary, library).errors);
  return { ok: errors.length === 0, errors, template_count: templates.length, category_counts: categoryCounts };
}

function nonemptyOrFalse(value) {
  return typeof value === 'string' && Boolean(value.trim());
}

export function validateOriginalLibrary(library, templateLibrary = loadTemplateLibrary()) {
  const errors = [];
  const originals = Array.isArray(library?.originals) ? library.originals : [];
  if (library?.record_type !== 'YouTubeSynthesizerOriginalLibraryV1') errors.push('original_library_record_type_invalid');
  if (originals.length !== 36) errors.push(`original_count_must_equal_36:${originals.length}`);
  const ids = new Set();
  const counts = new Map();
  const hashes = {};
  const templateIds = new Set((templateLibrary.templates ?? []).map((template) => template.id));
  for (const original of originals) {
    if (ids.has(original.original_id)) errors.push(`duplicate_original_id:${original.original_id}`);
    ids.add(original.original_id);
    if (!templateIds.has(original.template_id)) errors.push(`original_unknown_template:${original.original_id}`);
    counts.set(original.template_id, (counts.get(original.template_id) ?? 0) + 1);
    if (original.creator_handle !== '@lennox_saint') errors.push(`original_creator_invalid:${original.original_id}`);
    if (!Array.isArray(original.posts) || original.posts.length !== original.part_count || !original.posts.every(nonemptyOrFalse)) {
      errors.push(`original_parts_invalid:${original.original_id}`);
    } else hashes[original.original_id] = sha256(original.posts.join('\n\n'));
    if (!/^https:\/\/(www\.)?threads\.(com|net)\//.test(original.permalink ?? '')) errors.push(`original_permalink_invalid:${original.original_id}`);
    if (!String(original.rights_basis ?? '').includes('attested redistribution permission')) errors.push(`original_rights_missing:${original.original_id}`);
  }
  for (const templateId of templateIds) {
    if (counts.get(templateId) !== 3) errors.push(`originals_per_template:${templateId}:${counts.get(templateId) ?? 0}`);
  }
  return { ok: errors.length === 0, errors, original_count: originals.length, exact_text_sha256: hashes };
}

function validateInput(input) {
  if (input?.record_type !== 'YouTubeSynthesizerInputV1') fail('input_record_type_invalid');
  const videoId = parseYouTubeId(input.source?.url ?? input.source?.video_id);
  if (videoId !== input.source?.video_id) fail('source_video_id_mismatch');
  if (!TRANSCRIPT_ROUTES.includes(input.transcript?.route)) fail('transcript_route_invalid');
  if (!Array.isArray(input.transcript?.segments) || !input.transcript.segments.length) fail('transcript_required');
  if (input.transcript.segments.length > MAX_SEGMENTS) fail('too_many_transcript_segments');
  input.transcript.segments.forEach((segment, index) => {
    if (!Number.isInteger(segment.start_ms) || segment.start_ms < 0
      || !Number.isInteger(segment.duration_ms) || segment.duration_ms < 0
      || !nonemptyOrFalse(segment.text)) fail(`transcript_segment_invalid:${index}`);
  });
  if (input.voice?.mode === 'threadify_brain') {
    nonempty(input.voice.brain_context, 'brain_context_required');
  } else if (input.voice?.mode === 'approved_samples') {
    const samples = input.voice.samples ?? [];
    const unique = new Set(samples.filter((sample) => sample?.approved === true && nonemptyOrFalse(sample.text))
      .map((sample) => sha256(sample.text.trim())));
    if (unique.size < 3) fail('three_distinct_approved_voice_samples_required');
  } else fail('voice_mode_invalid');
  return input;
}

function validateEvidenceRef(ref, input) {
  if (typeof ref !== 'string') return false;
  const segment = ref.match(/^segment:(\d+)$/);
  if (segment) return Number(segment[1]) < input.transcript.segments.length;
  const metadata = ref.match(/^metadata:(video_id|url|title|channel|language|duration_ms)$/);
  if (metadata) return input.source[metadata[1]] !== null && input.source[metadata[1]] !== undefined;
  return /^interpretation:[A-Za-z0-9._-]+$/.test(ref);
}

function evidenceEntry(input, key) {
  const entry = input.evidence_map?.[key];
  if (!entry || typeof entry.value !== 'string' || !Array.isArray(entry.evidence_refs)) return null;
  if (!entry.evidence_refs.length || !entry.evidence_refs.every((ref) => validateEvidenceRef(ref, input))) return null;
  if (!entry.evidence_refs.some((ref) => /^segment:\d+$/.test(ref) || /^metadata:/.test(ref))) return null;
  return entry;
}

export function scoreTemplates(input, library = loadTemplateLibrary()) {
  validateInput(input);
  return library.templates.map((template, index) => {
    const missing = [];
    let requirementRefs = 0;
    for (const requirement of template.evidence_requirements) {
      const entry = evidenceEntry(input, requirement.id);
      if (!entry || !entry.value.trim() || new Set(entry.evidence_refs).size < requirement.minimum) missing.push(requirement.id);
      else requirementRefs += new Set(entry.evidence_refs).size;
    }
    const hookNames = placeholderNames(template.hook_template);
    const hookMissing = hookNames.filter((name) => !evidenceEntry(input, name));
    const bodyNames = [...new Set(template.body_template.flatMap(placeholderNames))]
      .filter((name) => !name.startsWith('OPTIONAL_'));
    const bodyMissing = bodyNames.filter((name) => !evidenceEntry(input, name));
    const eligible = missing.length === 0;
    const specificity = Math.min(15, requirementRefs * 2);
    const coverage = template.evidence_requirements.length
      ? Math.round(45 * (template.evidence_requirements.length - missing.length) / template.evidence_requirements.length)
      : 0;
    const hookCoverage = hookNames.length
      ? Math.round(20 * (hookNames.length - hookMissing.length) / hookNames.length)
      : 0;
    const bodyCoverage = bodyNames.length
      ? Math.round(15 * (bodyNames.length - bodyMissing.length) / bodyNames.length)
      : 0;
    return {
      template_id: template.id,
      eligible,
      score: Math.max(0, Math.min(100, coverage + hookCoverage + bodyCoverage + specificity)),
      reasons: [
        `${template.evidence_requirements.length - missing.length}/${template.evidence_requirements.length} evidence requirements met`,
        `${hookNames.length - hookMissing.length}/${hookNames.length} hook placeholders supported`,
        `${bodyNames.length - bodyMissing.length}/${bodyNames.length} required body placeholders supported`,
      ],
      missing_evidence: missing,
      missing_hook_placeholders: hookMissing,
      missing_body_placeholders: bodyMissing,
      library_order: index,
    };
  });
}

function renderString(templateText, input, { allowOptional = false } = {}) {
  const used = [];
  const text = templateText.replace(PLACEHOLDER, (token, name) => {
    const entry = evidenceEntry(input, name);
    if (!entry) {
      if (allowOptional && name.startsWith('OPTIONAL_')) return '';
      fail(`unresolved_placeholder:${name}`);
    }
    if (!entry.value && !(allowOptional && name.startsWith('OPTIONAL_'))) fail(`empty_placeholder:${name}`);
    used.push({ name, evidence_refs: entry.evidence_refs });
    return entry.value;
  });
  if (PLACEHOLDER.test(text)) fail('unresolved_placeholder_after_render');
  return { text, used };
}

export function renderHook(template, input) {
  const rendered = renderString(template.hook_template, input);
  if (rendered.text.length > THREADS_LIMIT) fail(`hook_too_long:${rendered.text.length}`);
  return {
    template_id: template.id,
    text: rendered.text,
    evidence_refs: [...new Set(rendered.used.flatMap((item) => item.evidence_refs))],
  };
}

export function renderThread(template, input) {
  const rendered = [template.hook_template, ...template.body_template].map((part) =>
    renderString(part, input, { allowOptional: true }));
  const posts = rendered.map((part) => part.text).filter((part) => part.trim());
  posts.forEach((post, index) => {
    if (post.length > THREADS_LIMIT) fail(`thread_post_too_long:${index + 1}:${post.length}`);
  });
  return {
    posts,
    evidence_refs: [...new Set(rendered.flatMap((part) => part.used.flatMap((item) => item.evidence_refs)))],
  };
}

export function synthesize(input, {
  templateLibrary = loadTemplateLibrary(),
  originalLibrary = loadOriginalLibrary(),
  integrityLock = loadIntegrityLock(),
  generatedAt = new Date().toISOString(),
} = {}) {
  validateInput(input);
  const libraryAudit = validateTemplateLibrary(templateLibrary, originalLibrary);
  if (!libraryAudit.ok) fail(`library_integrity_failed:${libraryAudit.errors.join('|')}`);
  const lockAudit = validateIntegrityLock(templateLibrary, originalLibrary, integrityLock);
  if (!lockAudit.ok) fail(`immutable_library_hash_failed:${lockAudit.errors.join('|')}`);
  const diagnosticScores = scoreTemplates(input, templateLibrary);
  const byId = new Map(templateLibrary.templates.map((template) => [template.id, template]));
  const ordered = [...diagnosticScores].sort((left, right) =>
    Number(right.eligible) - Number(left.eligible) || right.score - left.score || left.library_order - right.library_order);
  const warnings = scanTranscriptWarnings(input.transcript.segments);
  const hookReady = ordered.filter((score) => score.eligible && score.missing_hook_placeholders.length === 0);
  const hooks = [];
  for (const score of hookReady) {
    if (hooks.length === 3) break;
    try {
      hooks.push(renderHook(byId.get(score.template_id), input));
    } catch (error) {
      warnings.push(`hook_render_failed:${score.template_id}:${error.message}`);
    }
  }
  const fullReady = ordered.filter((score) => score.eligible
    && score.missing_hook_placeholders.length === 0 && score.missing_body_placeholders.length === 0);
  let status = 'abstained';
  let selectedTemplateId = null;
  let thread = null;
  let evidenceRefs = [];
  let renderedThread = null;
  for (const score of fullReady) {
    try {
      renderedThread = renderThread(byId.get(score.template_id), input);
      selectedTemplateId = score.template_id;
      break;
    } catch (error) {
      warnings.push(`thread_render_failed:${score.template_id}:${error.message}`);
    }
  }

  if (renderedThread && hooks.length === 3) {
    thread = renderedThread.posts;
    evidenceRefs = renderedThread.evidence_refs;
    status = 'ready';
  } else {
    selectedTemplateId = null;
    warnings.push(renderedThread
      ? 'fewer_than_three_templates_qualified_for_supported_hook_options'
      : 'no_template_qualified_for_a_complete_source_supported_thread');
  }
  if (hooks.length < 3) warnings.push(`only_${hooks.length}_fully_supported_hook_options`);

  const publicScores = diagnosticScores.map(({ library_order, missing_hook_placeholders, missing_body_placeholders, ...score }) => ({
    ...score,
    reasons: [...score.reasons,
      ...(missing_hook_placeholders.length ? [`missing hook placeholders: ${missing_hook_placeholders.join(', ')}`] : []),
      ...(missing_body_placeholders.length ? [`missing body placeholders: ${missing_body_placeholders.join(', ')}`] : [])],
  }));
  const transcriptHash = sha256(input.transcript.segments);
  const voiceHash = sha256(input.voice.mode === 'threadify_brain'
    ? input.voice.brain_context
    : input.voice.samples.map((sample) => sample.text));
  const draftHash = thread ? sha256(thread) : null;

  return {
    record_type: 'YouTubeSynthesizerOutputV1',
    status,
    scores: publicScores,
    hooks,
    selected_template_id: selectedTemplateId,
    thread,
    warnings: [...new Set(warnings)],
    receipt: {
      workflow_id: 'youtube-synthesizer',
      workflow_version: '0.1.0',
      action: 'local_private_draft',
      generated_at: generatedAt,
      source_video_id: input.source.video_id,
      transcript_route: input.transcript.route,
      transcript_sha256: transcriptHash,
      transcript_segment_count: input.transcript.segments.length,
      voice_route: input.voice.mode,
      approved_voice_sample_count: input.voice.mode === 'approved_samples' ? input.voice.samples.length : 0,
      voice_context_sha256: voiceHash,
      template_scores_sha256: sha256(publicScores),
      selected_template_id: selectedTemplateId,
      evidence_refs: evidenceRefs,
      draft_sha256: draftHash,
      provider_writes: 0,
      fallback_state: input.transcript.route === 'youtube-transcript' && input.voice.mode === 'threadify_brain'
        ? 'none'
        : [input.transcript.route, input.voice.mode].join('+'),
      abstention_reason: status === 'abstained'
        ? (renderedThread ? 'fewer_than_three_supported_hooks' : 'no_fully_supported_template')
        : null,
    },
  };
}

export function validateOutput(output) {
  const errors = [];
  if (output?.record_type !== 'YouTubeSynthesizerOutputV1') errors.push('output_record_type_invalid');
  if (!['ready', 'abstained'].includes(output?.status)) errors.push('output_status_invalid');
  if (!Array.isArray(output?.scores) || output.scores.length !== 12) errors.push('output_scores_must_equal_12');
  if (!Array.isArray(output?.hooks) || output.hooks.length > 3) errors.push('output_hooks_invalid');
  if (output?.status === 'ready') {
    if (output.hooks.length !== 3) errors.push('ready_output_requires_three_hooks');
    if (!output.selected_template_id || !Array.isArray(output.thread) || output.thread.length < 8) errors.push('ready_output_thread_invalid');
    (output.thread ?? []).forEach((post, index) => {
      if (!nonemptyOrFalse(post) || post.length > THREADS_LIMIT) errors.push(`ready_output_post_invalid:${index + 1}`);
    });
    if (output.receipt?.draft_sha256 !== sha256(output.thread)) errors.push('draft_hash_mismatch');
  } else if (output.thread !== null || output.selected_template_id !== null) errors.push('abstained_output_must_not_include_thread');
  if (output?.receipt?.provider_writes !== 0) errors.push('provider_writes_must_equal_zero');
  return { ok: errors.length === 0, errors };
}
