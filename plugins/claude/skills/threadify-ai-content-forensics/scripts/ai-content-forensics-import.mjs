#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from './ai-content-forensics.mjs';

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_ITEMS = 5000;

function values(name) {
  const out = [];
  for (let index = 2; index < process.argv.length; index += 1) {
    if (process.argv[index] === name) {
      const value = process.argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${name}_requires_value`);
      out.push(value);
      index += 1;
    }
  }
  return out;
}

function one(name, fallback = null) {
  const found = values(name);
  if (found.length > 1) throw new Error(`${name}_may_appear_once`);
  return found[0] ?? fallback;
}

function required(name) {
  const value = one(name);
  if (!value) throw new Error(`${name}_is_required`);
  return value;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') { row.push(field); field = ''; }
    else if (character === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += character;
  }
  if (quoted) throw new Error('csv_unclosed_quote');
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  const nonempty = rows.filter((candidate) => candidate.some((value) => value.trim()));
  if (nonempty.length < 2) throw new Error('csv_requires_header_and_row');
  const headers = nonempty[0].map((header) => header.trim());
  if (new Set(headers).size !== headers.length || headers.some((header) => !header)) throw new Error('csv_headers_invalid');
  return nonempty.slice(1).map((candidate) => Object.fromEntries(headers.map((header, index) => [header, candidate[index] ?? ''])));
}

function recordsFrom(file, body) {
  const extension = path.extname(file).toLowerCase();
  if (extension === '.jsonl' || extension === '.ndjson') {
    return body.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => {
      try { return JSON.parse(line); } catch (error) { throw new Error(`jsonl_line_${index + 1}:${error.message}`); }
    });
  }
  if (extension === '.csv') return parseCsv(body);
  const parsed = JSON.parse(body);
  if (Array.isArray(parsed)) return parsed;
  for (const key of ['items', 'posts', 'videos', 'data', 'results']) if (Array.isArray(parsed?.[key])) return parsed[key];
  throw new Error('json_export_needs_an_array_or_items_posts_videos_data_results');
}

function pick(record, aliases) {
  for (const alias of aliases) {
    if (record?.[alias] !== undefined && record[alias] !== null && record[alias] !== '') return record[alias];
  }
  return null;
}

function integer(record, aliases) {
  const value = pick(record, aliases);
  if (value === null) return null;
  const normalized = typeof value === 'string' ? value.replaceAll(',', '').trim() : value;
  const number = Number(normalized);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function isoDate(value, index) {
  if (typeof value === 'number' && value > 1_000_000_000) {
    const millis = value > 10_000_000_000 ? value : value * 1000;
    return new Date(millis).toISOString();
  }
  const raw = String(value ?? '').trim();
  const expanded = /^\d{8}$/.test(raw)
    ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T00:00:00Z`
    : raw;
  const date = new Date(expanded);
  if (!raw || Number.isNaN(date.valueOf())) throw new Error(`record_${index + 1}_missing_or_invalid_published_at`);
  return date.toISOString();
}

function normalizeRecord(record, index, config) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error(`record_${index + 1}_must_be_object`);
  const native = String(pick(record, ['native_id', 'id', 'post_id', 'video_id', 'shortcode', 'uri']) ?? '').trim();
  const title = pick(record, ['title', 'name', 'headline']);
  const body = pick(record, ['text', 'caption', 'body', 'content', 'description', 'transcript']);
  const url = pick(record, ['url', 'permalink', 'post_url', 'video_url', 'link']);
  const published = pick(record, ['published_at', 'created_at', 'timestamp', 'date', 'upload_date', 'publishedAt']);
  const stableNative = native || `derived-${sha256({ title, body, url, published }).slice(0, 24)}`;
  if (!title && !body) throw new Error(`record_${index + 1}_needs_title_or_text`);
  const evidenceId = `import:${config.platform}:${sha256(`${stableNative}\u0000${published}`).slice(0, 24)}`;
  return {
    evidence_id: evidenceId,
    source_id: config.sourceId,
    platform: config.platform,
    creator_handle: config.creator,
    native_id: stableNative,
    url: url === null ? null : String(url),
    published_at: isoDate(published, index),
    format_family: String(pick(record, ['format_family', 'post_type', 'media_type', 'type']) ?? 'unknown'),
    title: title === null ? null : String(title),
    text: body === null ? '' : String(body),
    metrics: {
      views: integer(record, ['views', 'view_count', 'viewCount', 'play_count', 'plays']),
      likes: integer(record, ['likes', 'like_count', 'likeCount', 'digg_count']),
      replies: integer(record, ['replies', 'reply_count', 'replyCount', 'comments', 'comment_count', 'commentCount']),
      reposts: integer(record, ['reposts', 'repost_count', 'repostCount', 'shares', 'share_count', 'shareCount']),
    },
    source_kind: config.sourceKind,
    rights_basis: config.rightsBasis,
  };
}

try {
  const file = path.resolve(required('--source'));
  const info = fs.lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error('source_must_be_a_regular_file');
  if (info.size > MAX_BYTES) throw new Error('source_exceeds_20mb');
  const body = fs.readFileSync(file, 'utf8');
  const bodyHash = sha256(Buffer.from(body));
  const config = {
    platform: required('--platform').toLowerCase(),
    creator: required('--creator'),
    sourceId: one('--source-id', `local-${bodyHash.slice(0, 12)}`),
    sourceKind: one('--source-kind', 'owned'),
    rightsBasis: required('--rights-basis'),
  };
  if (!['owned', 'public', 'licensed', 'permissioned'].includes(config.sourceKind)) throw new Error('source_kind_invalid');
  const observedAt = one('--observed-at', new Date().toISOString());
  if (Number.isNaN(Date.parse(observedAt))) throw new Error('observed_at_invalid');
  const records = recordsFrom(file, body);
  if (!records.length || records.length > MAX_ITEMS) throw new Error('source_item_count_out_of_range_1_to_5000');
  const items = records.map((record, index) => normalizeRecord(record, index, config));
  const output = {
    source: {
      source_id: config.sourceId,
      provider: 'local_export',
      platform: config.platform,
      auth_mode: 'local_export',
      observed_at: new Date(observedAt).toISOString(),
      requested_count: records.length,
      returned_count: items.length,
      complete: true,
      cache_status: null,
      endpoint: null,
      query_scope: 'bounded local export selected by the user',
      freshness_status: 'snapshot_observed_at_import',
      gaps: [],
      retention_policy: 'raw export remains user-controlled and local',
      evidence_ref: `local-file-sha256:${bodyHash}`,
    },
    items,
    limitations: [
      'Field aliases were normalized from a user-selected local export.',
      'The importer does not prove export completeness, account ownership, or metric comparability.',
      'Inspect creator, platform, rights basis, timestamps, and coverage before analysis.',
    ],
  };
  process.stdout.write(`${JSON.stringify(output)}\n`);
} catch (error) {
  process.stderr.write(`AI Content Forensics import failed: ${error.message}\n`);
  process.exitCode = 1;
}
