#!/usr/bin/env node
// Watch Any Creator: read a creator's whole YouTube archive from a local cache,
// rank the rules their numbers support, and compare them with an older rules
// file. It reuses the AI Content Forensics engine for dedupe and for the
// 20-item comparison rule, and adds only the YouTube pieces that engine lacks.
//
//   node watch-any-creator.mjs estimate --long 524 --shorts 4476 [--sorts 1]
//   node watch-any-creator.mjs analyse  --corpus <dir> --out <dir> [--prior <rules.md|json>]
//   node watch-any-creator.mjs compare  --rules <dir>/rules.json --prior <rules.md|json>
//   node watch-any-creator.mjs brief    --rules <dir>/rules.json --account @handle [--agent Claude]
//   node watch-any-creator.mjs check-thread  < {"posts": [...]}
//
// No network and no dependencies: Node 18+ only. Transcripts are read locally
// and never copied into the outputs; only measured features and quotes of at
// most twelve words leave this script.
import fs from 'node:fs';
import path from 'node:path';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { buildCoverage, dedupeItems, PLATFORM_LIMITS, sha256 } from './ai-content-forensics.mjs';

export const PLATFORM = 'youtube';
export const LONG = 'youtube_long';
export const SHORT = 'youtube_short';
export const FAMILY_LABEL = { [LONG]: 'long-form', [SHORT]: 'Shorts' };
// Same floor as the forensics engine: a comparison needs at least 20
// metric-valid items on each side, inside one format family.
export const MIN_GROUP = 20;
// A difference under 15% is reported as "no clear difference", never a rule.
export const MIN_LIFT = 1.15;
// Videos younger than this are too new for a fair views-per-day number.
export const MATURE_DAYS = 7;
export const HOOK_SECONDS = 60;
const HOOK_WORDS_UNTIMED = 150;
const QUOTE_WORDS = 12;
const MS_PER_DAY = 86_400_000;
// Page sizes observed on ScrapeCreators YouTube listings (Oct 2026).
export const PAGE_SIZE = { long: 30, shorts: 48 };

function fail(message) {
  throw new Error(message);
}

// ---------------------------------------------------------------- estimate

/** Calls and credits for a paid pull, shown to the owner before any call. */
export function estimateCredits({
  long_count: longCount,
  shorts_count: shortsCount,
  transcripts = longCount,
  sorts = 1,
  credits_per_call: perCall = 1,
  long_page_size: longPage = PAGE_SIZE.long,
  shorts_page_size: shortsPage = PAGE_SIZE.shorts,
} = {}) {
  for (const [label, value] of Object.entries({ long_count: longCount, shorts_count: shortsCount, transcripts, sorts })) {
    if (!Number.isInteger(value) || value < 0) fail(`${label}_must_be_a_whole_number`);
  }
  const calls = {
    channel: 1,
    long_pages: Math.ceil(longCount / longPage) * sorts,
    shorts_pages: Math.ceil(shortsCount / shortsPage) * sorts,
    transcripts,
  };
  const totalCalls = calls.channel + calls.long_pages + calls.shorts_pages + calls.transcripts;
  return {
    calls,
    total_calls: totalCalls,
    credits_per_call: perCall,
    estimated_credits: totalCalls * perCall,
    listing_credits: (calls.channel + calls.long_pages + calls.shorts_pages) * perCall,
    transcript_credits: calls.transcripts * perCall,
    stop_rule: 'Stop and report if the credits charged pass the approved estimate.',
  };
}

// ----------------------------------------------------------- normalisation

function integerOrNull(value) {
  if (Number.isInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && /^\d[\d,]*$/.test(value.trim())) return Number(value.trim().replaceAll(',', ''));
  return null;
}

function durationSeconds(entry) {
  if (Number.isFinite(entry.lengthSeconds) && entry.lengthSeconds >= 0) return Math.round(entry.lengthSeconds);
  if (Number.isFinite(entry.durationMs) && entry.durationMs >= 0) return Math.round(entry.durationMs / 1000);
  if (Number.isFinite(entry.duration) && entry.duration >= 0) return Math.round(entry.duration);
  for (const text of [entry.durationFormatted, entry.lengthText]) {
    if (typeof text === 'string' && /^\d+(:\d{1,2}){1,2}$/.test(text.trim())) {
      return text.trim().split(':').reduce((total, part) => total * 60 + Number(part), 0);
    }
  }
  return null;
}

function isoOrNull(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function videoId(entry) {
  const direct = entry.id ?? entry.videoId ?? entry.video_id;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const url = String(entry.url ?? '');
  return url.match(/[?&]v=([\w-]{6,})/)?.[1] ?? url.match(/\/shorts\/([\w-]{6,})/)?.[1] ?? null;
}

const handleOf = (value) => String(value ?? '').trim().replace(/^@/, '').toLowerCase();
const displayHandle = (value) => `@${String(value ?? '').trim().replace(/^@/, '')}`;

/**
 * One ScrapeCreators listing entry (channel-videos or channel shorts) to a
 * forensics corpus item plus the YouTube extras the engine has no field for.
 * Returns { item, extra } or { skipped: reason }.
 */
export function normalizeListing(entry, { list, creator, sourceId, rightsBasis, position }) {
  if (!entry || typeof entry !== 'object') return { skipped: 'not_an_object' };
  const id = videoId(entry);
  if (!id) return { skipped: 'no_video_id' };
  const title = typeof entry.title === 'string' ? entry.title.trim() : '';
  if (!title) return { skipped: 'no_title' };
  const ownerHandle = entry.channel?.handle;
  if (ownerHandle && handleOf(ownerHandle) !== handleOf(creator)) return { skipped: 'other_channel' };
  const family = entry.type === 'short' ? SHORT : entry.type === 'video' ? LONG : list === 'shorts' ? SHORT : LONG;
  const published = isoOrNull(entry.publishDate) ?? isoOrNull(entry.publishedTime) ?? isoOrNull(entry.published_at)
    ?? isoOrNull(entry.uploadDate) ?? isoOrNull(entry.createdAt);
  const item = {
    evidence_id: `youtube:${id}:${sha256(`${list}\u0000${position}`).slice(0, 10)}`,
    source_id: sourceId,
    platform: PLATFORM,
    creator_handle: displayHandle(creator),
    native_id: id,
    url: typeof entry.url === 'string' ? entry.url : `https://www.youtube.com/watch?v=${id}`,
    published_at: published,
    format_family: family,
    title,
    // Never the description (boilerplate) or a transcript body.
    text: '',
    metrics: {
      views: integerOrNull(entry.viewCountInt) ?? integerOrNull(entry.viewCountText) ?? integerOrNull(entry.views),
      likes: integerOrNull(entry.likeCountInt) ?? integerOrNull(entry.likes),
      replies: integerOrNull(entry.commentCountInt) ?? integerOrNull(entry.comments),
      reposts: null,
    },
    source_kind: 'public',
    rights_basis: rightsBasis,
  };
  return { item, extra: { duration_seconds: durationSeconds(entry) } };
}

/** Pull the first ~60 seconds of a transcript. Supports ScrapeCreators, Supadata and plain text. */
export function transcriptHead(raw, { seconds = HOOK_SECONDS } = {}) {
  const words = (text) => String(text).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const untimed = (text) => {
    const all = words(text);
    return { text: all.slice(0, HOOK_WORDS_UNTIMED).join(' '), timed: false, head_words: Math.min(all.length, HOOK_WORDS_UNTIMED), total_words: all.length };
  };
  if (typeof raw === 'string') return raw.trim() ? untimed(raw) : null;
  if (!raw || typeof raw !== 'object') return null;
  const segments = Array.isArray(raw.transcript) ? raw.transcript : Array.isArray(raw.content) ? raw.content : Array.isArray(raw.segments) ? raw.segments : null;
  if (segments?.length) {
    const startMs = (segment) => {
      if (segment.startMs !== undefined) return Number(segment.startMs);
      if (segment.offset !== undefined) return Number(segment.offset);
      if (segment.start !== undefined) return Number(segment.start) * 1000;
      return Number.NaN;
    };
    if (segments.every((segment) => Number.isFinite(startMs(segment)))) {
      const head = segments.filter((segment) => startMs(segment) < seconds * 1000).map((segment) => segment.text ?? '').join(' ');
      const total = segments.map((segment) => segment.text ?? '').join(' ');
      return { text: words(head).join(' '), timed: true, head_words: words(head).length, total_words: words(total).length };
    }
    return untimed(segments.map((segment) => segment.text ?? '').join(' '));
  }
  for (const field of ['transcript_only_text', 'content', 'text', 'transcript']) {
    if (typeof raw[field] === 'string' && raw[field].trim()) return untimed(raw[field]);
  }
  return null;
}

const firstSentence = (text) => {
  const cut = text.split(/(?<=[.?!])\s/)[0];
  const capped = cut.split(' ').slice(0, 25).join(' ');
  return capped;
};

/** Measured hook features of an opening. The quote is twelve words at most. */
export function hookFeatures(head) {
  const text = head.text.toLowerCase();
  const first = firstSentence(text);
  const wpm = head.timed && head.head_words ? Math.round(head.head_words / (HOOK_SECONDS / 60)) : null;
  return {
    hook_question: /\?/.test(first) || /^(so )?(what|why|how|do|does|did|are|is|have|can|would|should|who|which|ever)\b/.test(first),
    hook_number: /\d|\b(million|thousand|hundred|billion|percent)\b|\$/.test(first),
    hook_you: /\byou(r|'re|'ll)?\b/.test(first),
    hook_story: /^(so |and )?(when i|i was|i remember|back in|in (19|20)\d\d|years ago|last (year|week|month)|i used to|my first)/.test(first),
    hook_contrarian: /\b(most people|everyone|nobody|no one|stop|wrong|myth|lie|mistake|never)\b/.test(first),
    hook_promise: /\b(in this video|by the end of this|i'?m going to (show|teach|tell|walk|give)|today i|here'?s how|let me show)\b/.test(text),
    hook_fast: wpm === null ? null : wpm >= 170,
    hook_wpm: wpm,
    opening_quote: head.text.split(' ').slice(0, QUOTE_WORDS).join(' '),
  };
}

function readJsonFile(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`invalid_json:${path.basename(file)}:${error.message}`);
  }
}

function jsonFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter((name) => name.endsWith('.json')).sort().map((name) => path.join(directory, name));
}

function listingEntries(page) {
  if (Array.isArray(page)) return page;
  const entries = [];
  for (const field of ['videos', 'shorts', 'items', 'data']) if (Array.isArray(page?.[field])) entries.push(...page[field]);
  return entries;
}

/**
 * Read a corpus cache directory (layout in the skill README) into deduped
 * forensics items, YouTube extras and a source receipt.
 */
export function loadCorpus(corpusDir) {
  const dir = path.resolve(corpusDir);
  const manifestFile = path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifestFile)) fail('corpus_manifest_missing:manifest.json');
  const manifest = readJsonFile(manifestFile);
  const creator = manifest.creator_handle;
  if (typeof creator !== 'string' || !creator.trim()) fail('manifest_creator_handle_required');
  if (typeof manifest.provider !== 'string' || !manifest.provider.trim()) fail('manifest_provider_required');
  const observedAt = isoOrNull(manifest.observed_at);
  if (!observedAt) fail('manifest_observed_at_must_be_iso');
  const rightsBasis = manifest.rights_basis || 'public metadata and transcripts, analysed privately; transcripts never redistributed';
  const channelFile = path.join(dir, 'channel.json');
  const channel = fs.existsSync(channelFile) ? readJsonFile(channelFile) : null;
  if (channel?.handle && handleOf(channel.handle) !== handleOf(creator)) fail(`wrong_creator:${channel.handle}`);
  const sourceId = `cache-${handleOf(creator)}-${observedAt.slice(0, 10)}`;
  const items = [];
  const extras = new Map();
  const skipped = {};
  const listed = { long: 0, shorts: 0 };
  let creditsCharged = 0;
  let pages = 0;
  for (const list of ['videos', 'shorts']) {
    for (const file of jsonFiles(path.join(dir, list))) {
      const page = readJsonFile(file);
      pages += 1;
      if (Number.isFinite(page?.credits_charged)) creditsCharged += page.credits_charged;
      listingEntries(page).forEach((entry, index) => {
        const result = normalizeListing(entry, { list, creator, sourceId, rightsBasis, position: `${path.basename(file)}#${index}` });
        if (result.skipped) { skipped[result.skipped] = (skipped[result.skipped] ?? 0) + 1; return; }
        listed[result.item.format_family === SHORT ? 'shorts' : 'long'] += 1;
        items.push(result.item);
        extras.set(result.item.evidence_id, result.extra);
      });
    }
  }
  if (!items.length) fail('corpus_has_no_listed_videos');
  // Transcripts: transcripts/<videoId>.json or .txt
  const transcripts = new Map();
  const transcriptDir = path.join(dir, 'transcripts');
  if (fs.existsSync(transcriptDir)) {
    for (const name of fs.readdirSync(transcriptDir).sort()) {
      const match = name.match(/^([\w-]{6,})\.(json|txt)$/);
      if (!match) continue;
      const file = path.join(transcriptDir, name);
      const raw = match[2] === 'json' ? readJsonFile(file) : fs.readFileSync(file, 'utf8');
      if (match[2] === 'json' && Number.isFinite(raw?.credits_charged)) creditsCharged += raw.credits_charged;
      const head = transcriptHead(raw);
      if (head) transcripts.set(match[1], head);
    }
  }
  // Dedupe with the forensics engine: the same video id first, then the same
  // title on the same channel (a re-upload). Undated items sort as ''.
  const uniqueIds = new Set(items.map((item) => `${item.format_family}\u0000${item.native_id}`));
  // Each format family is deduped on its own, so a Short never merges with
  // the long-form video it was cut from.
  const deduped = { items: [], duplicate_native_count: 0, duplicate_body_count: 0 };
  for (const family of [LONG, SHORT]) {
    const result = dedupeItems(items.filter((item) => item.format_family === family)
      .map((item) => ({ ...item, published_at: item.published_at ?? '' })));
    deduped.items.push(...result.items);
    deduped.duplicate_native_count += result.duplicate_native_count;
    deduped.duplicate_body_count += result.duplicate_body_count;
  }
  const unique = deduped.items.map((item) => ({ ...item, published_at: item.published_at || null }));
  for (const item of unique) {
    const head = transcripts.get(item.native_id);
    const extra = extras.get(item.evidence_id);
    if (head && item.format_family === LONG) extra.hook = hookFeatures(head);
    extra.views_per_day = viewsPerDay(item, observedAt);
  }
  const source = {
    source_id: sourceId,
    provider: manifest.provider,
    platform: PLATFORM,
    auth_mode: manifest.auth_mode === 'local_export' ? 'local_export' : 'byo_key',
    observed_at: observedAt,
    requested_count: items.length,
    returned_count: items.length,
    complete: true,
    cache_status: 'local_cache',
    endpoint: manifest.endpoints ? String(manifest.endpoints) : null,
    query_scope: `every listed long-form video and Short on ${displayHandle(creator)}`,
    freshness_status: 'snapshot_observed_at_pull',
    gaps: [],
    retention_policy: 'raw cache stays on this computer; transcripts are never redistributed',
    evidence_ref: `corpus-manifest-sha256:${sha256(fs.readFileSync(manifestFile))}`,
  };
  const limitations = [];
  const expected = manifest.counts ?? {};
  const countChecks = [
    ['long_listed', listed.long],
    ['shorts_listed', listed.shorts],
    ['transcripts', transcripts.size],
  ];
  for (const [field, found] of countChecks) {
    if (Number.isInteger(expected[field]) && expected[field] !== found) {
      source.complete = false;
      source.gaps.push(`manifest says ${field} ${expected[field]}, cache holds ${found}`);
    }
  }
  if (Object.keys(skipped).length) limitations.push(`Skipped listing entries: ${Object.entries(skipped).map(([reason, count]) => `${reason} ${count}`).join(', ')}.`);
  const longUnique = unique.filter((item) => item.format_family === LONG);
  const matched = longUnique.filter((item) => extras.get(item.evidence_id).hook).length;
  const undated = unique.filter((item) => !item.published_at).length;
  if (undated) limitations.push(`${undated} videos have no publish date, so they have no views-per-day number.`);
  if (matched < longUnique.length) limitations.push(`${longUnique.length - matched} long-form videos have no transcript in the cache; hook rules use the ${matched} that do.`);
  limitations.push('Views per day favours newer videos and raw views favour older ones; every rule compares videos inside one format family only.');
  limitations.push('These are patterns in this archive. A pattern is not proof that it caused the views.');
  return {
    manifest: { creator_handle: displayHandle(creator), provider: manifest.provider, observed_at: observedAt },
    channel: channel ? {
      handle: channel.handle ?? null,
      name: channel.name ?? null,
      video_count_header: integerOrNull(channel.videoCount),
      subscriber_count: integerOrNull(channel.subscriberCount),
      view_count: integerOrNull(channel.viewCount),
    } : null,
    source,
    items: unique,
    extras,
    counts: {
      pages_read: pages,
      listed_long: listed.long,
      listed_shorts: listed.shorts,
      listed_total: listed.long + listed.shorts,
      unique_videos: uniqueIds.size,
      duplicate_listings: deduped.duplicate_native_count,
      same_title_reuploads_collapsed: deduped.duplicate_body_count,
      analysed_videos: unique.length,
      analysed_long: longUnique.length,
      analysed_shorts: unique.length - longUnique.length,
      transcripts_in_cache: transcripts.size,
      transcripts_matched: matched,
      undated,
      credits_charged_in_cache: creditsCharged,
    },
    limitations,
  };
}

export function viewsPerDay(item, observedAt) {
  if (!item.published_at || !Number.isInteger(item.metrics.views)) return null;
  const days = (Date.parse(observedAt) - Date.parse(item.published_at)) / MS_PER_DAY;
  if (!(days >= MATURE_DAYS)) return null;
  return item.metrics.views / days;
}

// ------------------------------------------------------------------ rules

const ACRONYMS = new Set(['CEO', 'USA', 'LLC', 'ROI', 'SEO', 'SaaS', 'B2B', 'CPA', 'ADHD', 'MBA', 'FAQ', 'AMA', 'DIY', 'LTV', 'CAC']);
const wordsOf = (title) => title.split(/\s+/).filter(Boolean);

// Fixed features. `do` and `avoid` are the plain-English rule; `copy` is the
// template for a `do` rule and `avoid_copy` the template for an `avoid` rule,
// so a rule never tells the viewer to copy the thing it says to skip;
// `aliases` let an older rules file match the feature.
export const FEATURES = [
  { id: 'title_number', axis: 'title', test: (t) => /\d/.test(t), do: 'Put a specific number in the title', avoid: 'Leave numbers out of the title', copy: '[number] [things] that [result]', avoid_copy: 'say the result in words, no digits', aliases: ['number', 'numbers', 'digit', 'stat', 'specific'] },
  { id: 'title_money', axis: 'title', test: (t) => /\$|\b(million|billion|money|rich|wealth|income|revenue|profit)\b|\b\d+k\b/i.test(t), do: 'Name money or a dollar figure in the title', avoid: 'Keep money out of the title', copy: 'how i went from $[a] to $[b]', avoid_copy: 'name the result, not the dollar figure', aliases: ['money', 'dollar', 'dollars', 'rich', 'revenue', 'income', 'wealth', '$'] },
  { id: 'title_question', axis: 'title', test: (t) => /\?/.test(t) || /^(why|what|how come|is|are|do|does|can|should)\b/i.test(t), do: 'Ask a question in the title', avoid: 'State it, do not ask it, in the title', copy: 'why [surprising thing] happens', avoid_copy: '[surprising thing] happens because [reason]', aliases: ['question', 'questions', 'ask'] },
  { id: 'title_how_to', axis: 'title', test: (t) => /^how (to|i|we|you)\b/i.test(t), do: 'Start the title with "how to" or "how i"', avoid: 'Skip the "how to" title opener', copy: 'how i [result] in [time]', avoid_copy: 'i [result] in [time]', aliases: ['how to', 'how-to', 'how i', 'tutorial'] },
  { id: 'title_you', axis: 'title', test: (t) => /\byou(r|'re|'ll)?\b/i.test(t), do: 'Talk to the viewer: "you" in the title', avoid: 'Leave "you" out of the title', copy: 'you [common mistake] (fix this)', avoid_copy: 'i [result] (tell it as your story)', aliases: ['"you"', 'second person', 'viewer', 'talk to the viewer'] },
  { id: 'title_first_person', axis: 'title', test: (t) => /\b(i|my|i'm|i've|me)\b/i.test(t), do: 'Tell it as yourself: "i" or "my" in the title', avoid: 'Keep "i" and "my" out of the title', copy: 'i [did hard thing] so you do not have to', avoid_copy: '[result] for [audience]', aliases: ['"i"', '"my"', 'first person', 'personal title'] },
  { id: 'title_caps_word', axis: 'title', test: (t) => (t.match(/\b[A-Z]{3,}\b/g) ?? []).some((word) => !ACRONYMS.has(word)), do: 'Put one word in CAPS in the title', avoid: 'Drop the CAPS words from the title', copy: 'the ONE [thing] that [result]', avoid_copy: 'the one [thing] that [result]', aliases: ['caps', 'capital', 'uppercase', 'all caps'] },
  { id: 'title_brackets', axis: 'title', test: (t) => /[([]/.test(t), do: 'Add a bracket tag to the title', avoid: 'Drop the bracket tag from the title', copy: '[promise] ([proof or format])', avoid_copy: '[promise], no bracket tag', aliases: ['bracket', 'brackets', 'parentheses', 'tag'] },
  { id: 'title_warning', axis: 'title', test: (t) => /\b(stop|never|don'?t|mistakes?|wrong|worst|avoid|nobody|lies?|fail(ing|ed)?|quit)\b/i.test(t), do: 'Lead with a warning or a mistake', avoid: 'Skip warning words in the title', copy: 'stop [common habit] (do this instead)', avoid_copy: 'do [better habit] to get [result]', aliases: ['warning', 'mistake', 'mistakes', 'negative', 'stop', 'never', 'avoid'] },
  { id: 'title_extreme', axis: 'title', test: (t) => /\b(best|most|every|all|only|always|fastest|easiest|ultimate|everything)\b/i.test(t), do: 'Use an extreme word: best, every, only', avoid: 'Skip the extreme words in the title', copy: 'the only [thing] you need to [result]', avoid_copy: 'the [thing] that [result]', aliases: ['extreme', 'superlative', 'best', 'ultimate'] },
  { id: 'title_short', axis: 'title', test: (t) => wordsOf(t).length <= 6, do: 'Keep the title to six words or fewer', avoid: 'Give the title more than six words', copy: '[result] in [number] words', avoid_copy: '[who] [did what] [and the surprising result]', aliases: ['short title', 'shorter titles', 'title length', 'few words'] },
  { id: 'title_long', axis: 'title', test: (t) => wordsOf(t).length >= 11, do: 'Write long titles: eleven words or more', avoid: 'Keep the title under eleven words', copy: '[who] [did what] [and the surprising result]', avoid_copy: '[result] in [number] words', aliases: ['long title', 'longer titles', 'title length'] },
  { id: 'hook_question', axis: 'hook', hook: true, do: 'Open the video with a question', avoid: 'Open with a statement, not a question', copy: 'open with: "why do [audience] still [mistake]?"', avoid_copy: 'open with: "[audience] [mistake]. here is the fix."', aliases: ['question hook', 'open with a question', 'opening question'] },
  { id: 'hook_number', axis: 'hook', hook: true, do: 'Say a number in the first sentence', avoid: 'Keep numbers out of the first sentence', copy: 'open with: "[number] [result] in [time]."', avoid_copy: 'open with: "[audience] [problem]."', aliases: ['number hook', 'stat', 'statistic', 'open with a number'] },
  { id: 'hook_you', axis: 'hook', hook: true, do: 'Say "you" in the first sentence', avoid: 'Start with the story, not "you"', copy: 'open with: "if you [situation], this is for you."', avoid_copy: 'open with: "when i [situation], i [did thing]."', aliases: ['you hook', 'talk to the viewer', 'second person'] },
  { id: 'hook_story', axis: 'hook', hook: true, do: 'Open with a story: "when i..."', avoid: 'Skip the story opener', copy: 'open with: "when i was [low point], i [did thing]."', avoid_copy: 'open with: "[the result], straight away."', aliases: ['story', 'storytelling', 'anecdote', 'personal story'] },
  { id: 'hook_contrarian', axis: 'hook', hook: true, do: 'Open by calling out what most people get wrong', avoid: 'Skip the contrarian opener', copy: 'open with: "most people [belief]. they are wrong."', avoid_copy: 'open with: "here is how to [result]."', aliases: ['contrarian', 'myth', 'most people', 'wrong', 'controversial'] },
  { id: 'hook_promise', axis: 'hook', hook: true, do: 'Promise the payoff in the first minute', avoid: 'Skip the "in this video" promise', copy: 'say in minute one: "by the end of this you will [result]."', avoid_copy: 'open on the first step, no "in this video"', aliases: ['promise', 'payoff', 'in this video', 'by the end'] },
  { id: 'hook_fast', axis: 'hook', hook: true, do: 'Talk fast in minute one: 170+ words', avoid: 'Slow down in minute one', copy: 'cut every pause from the first minute', avoid_copy: 'let minute one breathe: under 170 words', aliases: ['fast', 'pace', 'pacing', 'speed', 'talk fast'] },
];

const STOPWORDS = new Set(('this that with your from what have will they them their there about into just like when then than were been more most make made does dont doesnt cant wont youre heres whats every only best ever over under after before while because could should would which these those here very much many some ways things thing people want need know really still also even going gets get got how why who the and for you are not but all any can out its was has had our use one two three four five six seven eight nine ten first last year years day days time times video videos full part episode shorts short live new now doing trying getting making using worth said says tell told take give look think feel keep watch number').split(' '));

function topicTerms(items, minCount = MIN_GROUP) {
  const frequency = new Map();
  for (const item of items) {
    const terms = new Set((item.title.toLowerCase().normalize('NFKC').match(/[a-z][a-z']{3,}/g) ?? []).map((term) => term.replace(/'/g, '')));
    for (const term of terms) if (!STOPWORDS.has(term)) frequency.set(term, (frequency.get(term) ?? 0) + 1);
  }
  return [...frequency.entries()]
    .filter(([, count]) => count >= minCount && count <= items.length / 2)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 40)
    .map(([term]) => term);
}

const LENGTH_BUCKETS = {
  [LONG]: [[0, 600, 'under 10 min'], [600, 1200, '10-20 min'], [1200, 2400, '20-40 min'], [2400, 3600, '40-60 min'], [3600, Infinity, '60+ min']],
  [SHORT]: [[0, 20, 'under 20s'], [20, 40, '20-40s'], [40, 61, '40-60s'], [61, Infinity, 'over 60s']],
};

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const round = (value, places = 1) => (value === null || value === undefined ? null : Number(value.toFixed(places)));

function featureList(family, items) {
  const list = FEATURES.filter((feature) => !feature.hook || family === LONG).map((feature) => ({ ...feature }));
  for (const [low, high, label] of LENGTH_BUCKETS[family]) {
    list.push({
      id: `length:${label}`,
      axis: 'length',
      length: [low, high],
      do: family === LONG ? `Make long-form videos ${label}` : `Keep Shorts ${label}`,
      avoid: family === LONG ? `Avoid long-form videos ${label}` : `Avoid Shorts ${label}`,
      copy: family === LONG ? `plan the video at ${label}` : `cut the Short to ${label}`,
      // No avoid template: "avoid 10 to 20 min" only restates the winning
      // length bucket, so an avoid length rule never enters the ranking.
      // It can still fill the brief when a small archive has too few rules.
      avoid_copy: null,
      fallback_copy: family === LONG ? `keep the video out of ${label}` : `keep the Short out of ${label}`,
      aliases: [label],
    });
  }
  for (const term of topicTerms(items)) {
    list.push({ id: `topic:${term}`, axis: 'topic', term, do: `Make more videos about "${term}"`, avoid: `Make fewer videos about "${term}"`, copy: `your take on ${term}, with one number`, avoid_copy: null, fallback_copy: `make fewer videos about ${term}`, aliases: [term] });
  }
  return list;
}

function hasFeature(feature, item, extra) {
  if (feature.axis === 'length') {
    const seconds = extra.duration_seconds;
    if (seconds === null || seconds === undefined) return null;
    return seconds >= feature.length[0] && seconds < feature.length[1];
  }
  if (feature.axis === 'topic') return new RegExp(`\\b${feature.term}`, 'i').test(item.title.replace(/'/g, ''));
  if (feature.hook) {
    if (!extra.hook) return null;
    return extra.hook[feature.id];
  }
  return feature.test(item.title);
}

function example(item, extra) {
  return {
    id: item.native_id,
    title: item.title.length > 80 ? `${item.title.slice(0, 77)}...` : item.title,
    views: item.metrics.views,
    views_per_day: round(extra.views_per_day, 0),
    published: item.published_at ? item.published_at.slice(0, 10) : null,
    ...(extra.hook ? { opening_quote: extra.hook.opening_quote } : {}),
  };
}

/** Compare videos with and without one feature, inside one format family. */
export function compareFeature(feature, family, items, extras, cohortComparative) {
  const withGroup = [];
  const withoutGroup = [];
  for (const item of items) {
    const extra = extras.get(item.evidence_id);
    if (extra.views_per_day === null) continue;
    const present = hasFeature(feature, item, extra);
    if (present === null) continue;
    (present ? withGroup : withoutGroup).push({ item, extra });
  }
  const medianWith = median(withGroup.map((entry) => entry.extra.views_per_day));
  const medianWithout = median(withoutGroup.map((entry) => entry.extra.views_per_day));
  const comparative = cohortComparative && withGroup.length >= MIN_GROUP && withoutGroup.length >= MIN_GROUP && medianWithout > 0 && medianWith > 0;
  const lift = comparative ? medianWith / medianWithout : null;
  const direction = lift === null ? null : lift >= 1 ? 'do' : 'avoid';
  const strength = lift === null ? 0 : Math.abs(Math.log(lift));
  const clear = lift !== null && strength >= Math.log(MIN_LIFT);
  const winners = (direction === 'avoid' ? withoutGroup : withGroup)
    .sort((left, right) => right.extra.views_per_day - left.extra.views_per_day || left.item.native_id.localeCompare(right.item.native_id))
    .slice(0, 3)
    .map(({ item, extra }) => example(item, extra));
  const share = withGroup.length + withoutGroup.length ? withGroup.length / (withGroup.length + withoutGroup.length) : null;
  return {
    feature: feature.id,
    axis: feature.axis,
    family,
    status: !comparative ? 'descriptive_only' : clear ? 'rule' : 'no_clear_difference',
    direction,
    statement: direction === 'avoid' ? feature.avoid : feature.do,
    copy_this: direction === 'avoid' ? feature.avoid_copy : feature.copy,
    fallback_copy: direction === 'avoid' ? feature.fallback_copy ?? null : null,
    evidence: {
      metric: 'median views per day',
      n_with: withGroup.length,
      n_without: withoutGroup.length,
      median_with: round(medianWith, 0),
      median_without: round(medianWithout, 0),
      lift: lift === null ? null : round(direction === 'avoid' ? 1 / lift : lift, 2),
      share_with: share === null ? null : round(share * 100, 0),
    },
    // Thin evidence ranks lower: full weight from 100 videos on the smaller side.
    score: clear ? round(strength * Math.min(1, Math.sqrt(Math.min(withGroup.length, withoutGroup.length) / 100)), 4) : 0,
    winning_ids: (direction === 'avoid' ? withoutGroup : withGroup).map((entry) => entry.item.native_id),
    example_ids: winners.map((entry) => entry.id),
    examples: winners,
  };
}

const AXIS_ORDER = ['title', 'hook', 'length', 'topic'];
const REDUNDANT_OVERLAP = 0.8;

/** Jaccard overlap of two lists of video ids. */
function overlap(left, right) {
  const a = new Set(left);
  let shared = 0;
  for (const id of right) if (a.has(id)) shared += 1;
  const union = a.size + right.length - shared;
  return union ? shared / union : 0;
}

function evidenceLine(rule) {
  const { evidence: e } = rule;
  const fmt = (value) => (value === null ? 'unknown' : Math.round(value).toLocaleString('en-US'));
  const [better, worse, nBetter, nWorse] = rule.direction === 'avoid'
    ? [e.median_without, e.median_with, e.n_without, e.n_with]
    : [e.median_with, e.median_without, e.n_with, e.n_without];
  return `${fmt(better)} vs ${fmt(worse)} median views/day (${nBetter} vs ${nWorse} ${FAMILY_LABEL[rule.family]} videos) = ${e.lift}x`;
}

/** Every aggregate and the ranked rules for one loaded corpus. */
export function analyseCorpus(corpus) {
  const coverage = buildCoverage(corpus.items, [corpus.source]);
  const families = {};
  const comparisons = [];
  const allViews = corpus.items.reduce((sum, item) => sum + (item.metrics.views ?? 0), 0);
  for (const family of [LONG, SHORT]) {
    const items = corpus.items.filter((item) => item.format_family === family);
    if (!items.length) continue;
    const cohort = coverage.cohorts.find((entry) => entry.format_family === family);
    const vpd = items.map((item) => corpus.extras.get(item.evidence_id).views_per_day).filter((value) => value !== null);
    const durations = items.map((item) => corpus.extras.get(item.evidence_id).duration_seconds).filter(Number.isFinite);
    const views = items.reduce((sum, item) => sum + (item.metrics.views ?? 0), 0);
    families[family] = {
      label: FAMILY_LABEL[family],
      videos: items.length,
      metric_valid: vpd.length,
      comparison_status: cohort?.comparison_status ?? 'descriptive_only',
      total_views: views,
      share_of_videos_pct: round((items.length / corpus.items.length) * 100, 1),
      share_of_views_pct: allViews ? round((views / allViews) * 100, 1) : null,
      median_views: cohort?.median ?? null,
      median_views_per_day: round(median(vpd), 0),
      median_duration_seconds: median(durations),
      length_buckets: LENGTH_BUCKETS[family].map(([low, high, label]) => {
        const bucket = items.filter((item) => {
          const seconds = corpus.extras.get(item.evidence_id).duration_seconds;
          return Number.isFinite(seconds) && seconds >= low && seconds < high;
        });
        const values = bucket.map((item) => corpus.extras.get(item.evidence_id).views_per_day).filter((value) => value !== null);
        return { bucket: label, videos: bucket.length, median_views_per_day: round(median(values), 0) };
      }),
    };
    const comparative = cohort?.comparison_status === 'comparative';
    for (const feature of featureList(family, items)) comparisons.push(compareFeature(feature, family, items, corpus.extras, comparative));
  }
  // A rule with no copyable template (an avoid length bucket, a topic to make
  // fewer of) is not a rule anyone can act on, so it stays out of the ranking;
  // then-vs-now still sees it through `comparisons`.
  // A rule that splits the same videos as a stronger rule says nothing new
  // (a topic word that only appears in numbered titles, say), so it is kept
  // out of the ranking and listed as redundant. Fixed features win ties.
  const kept = [];
  const redundant = [];
  for (const entry of comparisons
    .filter((candidate) => candidate.status === 'rule' && candidate.copy_this)
    .sort((left, right) => right.score - left.score || AXIS_ORDER.indexOf(left.axis) - AXIS_ORDER.indexOf(right.axis)
      || left.family.localeCompare(right.family) || left.feature.localeCompare(right.feature))) {
    const twin = kept.find((rule) => rule.family === entry.family && overlap(rule.winning_ids, entry.winning_ids) >= REDUNDANT_OVERLAP);
    if (twin) redundant.push({ feature: entry.feature, family: entry.family, same_videos_as: twin.feature });
    else kept.push(entry);
  }
  const ranked = kept.map(({ winning_ids: _ids, ...entry }, index) => ({ rank: index + 1, rule_id: `${entry.family}:${entry.feature}`, ...entry, evidence_line: evidenceLine(entry) }));
  // Avoid rules left out of the ranking, strongest first. The brief uses them
  // only when a small archive has fewer ranked rules than the thread needs.
  const reserve = comparisons
    .filter((entry) => entry.status === 'rule' && !entry.copy_this && entry.fallback_copy)
    .sort((left, right) => right.score - left.score || left.family.localeCompare(right.family) || left.feature.localeCompare(right.feature))
    .map(({ winning_ids: _ids, ...entry }) => ({ rule_id: `${entry.family}:${entry.feature}`, ...entry, copy_this: entry.fallback_copy, evidence_line: evidenceLine(entry) }));
  const hooks = corpus.items.filter((item) => corpus.extras.get(item.evidence_id).hook);
  const hookShares = Object.fromEntries(FEATURES.filter((feature) => feature.hook).map((feature) => {
    const known = hooks.filter((item) => corpus.extras.get(item.evidence_id).hook[feature.id] !== null);
    const yes = known.filter((item) => corpus.extras.get(item.evidence_id).hook[feature.id]);
    return [feature.id, known.length ? round((yes.length / known.length) * 100, 0) : null];
  }));
  return {
    record_type: 'WatchAnyCreatorRulesV1',
    schema_version: 1,
    creator: corpus.manifest.creator_handle,
    provider: corpus.manifest.provider,
    observed_at: corpus.manifest.observed_at,
    channel: corpus.channel,
    counts: corpus.counts,
    source_receipt: { ...corpus.source, evidence_ref_sha256: sha256(corpus.source.evidence_ref), evidence_ref: undefined },
    coverage: { cohorts: coverage.cohorts, duplicate_native_count: corpus.counts.duplicate_listings },
    families,
    shorts_vs_long: families[LONG] && families[SHORT] ? {
      status: 'descriptive_only',
      line: `Shorts are ${families[SHORT].share_of_videos_pct}% of the videos and ${families[SHORT].share_of_views_pct}% of the views; long-form is ${families[LONG].share_of_videos_pct}% of the videos and ${families[LONG].share_of_views_pct}% of the views.`,
    } : null,
    hooks: { long_form_with_transcript: hooks.length, feature_share_pct: hookShares, seconds_read: HOOK_SECONDS },
    rules: ranked,
    reserve_rules: reserve,
    redundant,
    no_clear_difference: comparisons.filter((entry) => entry.status === 'no_clear_difference').map(({ feature, family, evidence }) => ({ feature, family, lift: evidence.lift === null ? null : round(Math.max(evidence.lift, 1 / evidence.lift), 2) })),
    descriptive_only: comparisons.filter((entry) => entry.status === 'descriptive_only').map(({ feature, family, evidence }) => ({ feature, family, n_with: evidence.n_with, n_without: evidence.n_without })),
    method: `Each rule compares median views per day of videos with and without one feature, inside one format family. A rule needs at least ${MIN_GROUP} videos on each side and a difference of at least ${Math.round((MIN_LIFT - 1) * 100)}%. Videos younger than ${MATURE_DAYS} days are left out. Rank = strength of the difference, weighted down when the smaller side has fewer than 100 videos.`,
    limitations: corpus.limitations,
    // Every comparison, so then-vs-now can test a rule that did not make the list.
    comparisons: comparisons.map(({ examples: _examples, winning_ids: _ids, ...rest }) => rest),
  };
}

export function rulesMarkdown(analysis, top = 10) {
  const c = analysis.counts;
  const lines = [
    `# ${analysis.creator}: the rules in ${c.analysed_videos.toLocaleString('en-US')} videos`,
    '',
    `Watched: ${c.unique_videos.toLocaleString('en-US')} videos (${c.listed_long.toLocaleString('en-US')} long-form listings, ${c.listed_shorts.toLocaleString('en-US')} Shorts listings), ${c.transcripts_matched.toLocaleString('en-US')} transcripts, observed ${analysis.observed_at.slice(0, 10)} via ${analysis.provider}.`,
    '',
    '| # | Rule | Evidence | Examples |',
    '| --- | --- | --- | --- |',
    ...analysis.rules.slice(0, top).map((rule) => `| ${rule.rank} | ${rule.statement} (${FAMILY_LABEL[rule.family]}) | ${rule.evidence_line} | ${rule.example_ids.join(', ')} |`),
    '',
  ];
  if (analysis.shorts_vs_long) lines.push(`Shorts vs long-form (descriptive): ${analysis.shorts_vs_long.line}`, '');
  lines.push(`Method: ${analysis.method}`, '', ...analysis.limitations.map((line) => `- ${line}`), '');
  return lines.join('\n');
}

// ------------------------------------------------------------ then vs now

/** Read an older rules file: JSON (array or {rules}) or Markdown/text list items. */
export function parsePriorRules(body, filename = 'rules.md') {
  const text = String(body);
  if (/\.json$/i.test(filename) || /^\s*[[{]/.test(text)) {
    const parsed = JSON.parse(text);
    const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.rules) ? parsed.rules : null;
    if (!list) fail('prior_rules_json_needs_an_array_or_rules');
    return list.map((entry, index) => {
      if (typeof entry === 'string') return { id: `prior-${index + 1}`, text: entry.trim() };
      const statement = entry.text ?? entry.rule ?? entry.statement ?? entry.claim;
      if (typeof statement !== 'string' || !statement.trim()) fail(`prior_rule_${index + 1}_needs_text`);
      return { id: entry.id ?? `prior-${index + 1}`, text: statement.trim(), feature: entry.feature, direction: entry.direction };
    });
  }
  const rules = text.split(/\r?\n/)
    .map((line) => line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.+)$/)?.[1]?.replace(/\*\*/g, '').trim())
    .filter(Boolean)
    .map((statement, index) => ({ id: `prior-${index + 1}`, text: statement }));
  if (!rules.length) fail('prior_rules_file_has_no_list_items');
  return rules;
}

function priorDirection(rule) {
  if (rule.direction === 'do' || rule.direction === 'avoid') return rule.direction;
  return /^(don'?t|do not|never|avoid|stop|skip|no)\b/i.test(rule.text) || /\bavoid\b/i.test(rule.text) ? 'avoid' : 'do';
}

function matchFeature(rule, comparisons) {
  if (rule.feature !== undefined) return rule.feature;
  const lower = ` ${rule.text.toLowerCase()} `;
  let best = null;
  let bestScore = 0;
  const seen = new Set();
  for (const entry of comparisons) {
    if (seen.has(entry.feature)) continue;
    seen.add(entry.feature);
    const feature = FEATURES.find((candidate) => candidate.id === entry.feature);
    // A topic word only counts when the older rule is about that topic ("talk about pricing"),
    // never because the word appears in passing ("must work as a post", "not hard rules").
    const aliases = feature?.aliases ?? (entry.feature.startsWith('topic:') ? [`about ${entry.feature.slice(6)}`, `videos on ${entry.feature.slice(6)}`] : entry.feature.startsWith('length:') ? [entry.feature.slice(7)] : []);
    const score = aliases.filter((alias) => {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`).test(lower);
    }).reduce((sum, alias) => sum + alias.length, 0);
    if (score > bestScore) { best = entry.feature; bestScore = score; }
  }
  return best;
}

/** held / broke / new, every verdict tied to the current evidence numbers. */
export function compareRules(priorRules, analysis, { top = 7, mapping = null } = {}) {
  const rows = [];
  const matchedFeatures = new Set();
  const known = new Set(analysis.comparisons.map((entry) => entry.feature));
  const mapped = mapping ? new Map(mapping.map((entry) => [entry.prior_id, entry])) : null;
  for (const original of priorRules) {
    let rule = original;
    if (mapped) {
      const entry = mapped.get(rule.id);
      if (!entry) fail(`mapping_missing_${rule.id}`);
      if (entry.feature !== null && !known.has(entry.feature)) fail(`mapping_unknown_feature_${entry.feature}`);
      rule = { ...rule, feature: entry.feature, direction: entry.direction ?? rule.direction };
    }
    const direction = priorDirection(rule);
    const feature = matchFeature(rule, analysis.comparisons);
    if (!feature) {
      rows.push({ prior_id: rule.id, prior: rule.text, verdict: 'untestable', reason: 'This data has no measure for this rule.' });
      continue;
    }
    matchedFeatures.add(feature);
    const tested = analysis.comparisons.filter((entry) => entry.feature === feature && entry.status !== 'descriptive_only');
    if (!tested.length) {
      rows.push({ prior_id: rule.id, prior: rule.text, feature, verdict: 'untestable', reason: `Fewer than ${MIN_GROUP} videos on one side.` });
      continue;
    }
    for (const entry of tested) {
      const evidence = { family: entry.family, n_with: entry.evidence.n_with, n_without: entry.evidence.n_without, median_with: entry.evidence.median_with, median_without: entry.evidence.median_without, lift: entry.evidence.lift, now: entry.status === 'rule' ? entry.direction : 'no clear difference' };
      if (entry.status === 'rule' && entry.direction === direction) rows.push({ prior_id: rule.id, prior: rule.text, feature, verdict: 'held', reason: `Still true in ${FAMILY_LABEL[entry.family]}: ${entry.evidence.lift}x.`, evidence });
      else if (entry.status === 'rule') rows.push({ prior_id: rule.id, prior: rule.text, feature, verdict: 'broke', reason: `Flipped in ${FAMILY_LABEL[entry.family]}: the opposite now wins by ${entry.evidence.lift}x.`, evidence });
      else rows.push({ prior_id: rule.id, prior: rule.text, feature, verdict: 'broke', reason: `No clear difference in ${FAMILY_LABEL[entry.family]} any more (under ${Math.round((MIN_LIFT - 1) * 100)}%).`, evidence });
    }
  }
  const fresh = analysis.rules.slice(0, top).filter((rule) => !matchedFeatures.has(rule.feature)).map((rule) => ({
    verdict: 'new', rank: rule.rank, rule: `${rule.statement} (${FAMILY_LABEL[rule.family]})`, evidence_line: rule.evidence_line, example_ids: rule.example_ids,
  }));
  const tally = (verdict) => rows.filter((row) => row.verdict === verdict).length;
  return {
    record_type: 'WatchAnyCreatorThenVsNowV1',
    matched_by: mapped ? 'mapping' : 'keywords',
    prior_rule_count: priorRules.length,
    summary: { held: tally('held'), broke: tally('broke'), untestable: tally('untestable'), new: fresh.length },
    rows,
    new_rules: fresh,
  };
}

/** Every measurable feature in this analysis, so an agent can map older rules by meaning. */
export function listFeatures(analysis) {
  const seen = new Map();
  for (const entry of analysis.comparisons) {
    const known = FEATURES.find((candidate) => candidate.id === entry.feature);
    const row = seen.get(entry.feature) ?? {
      feature: entry.feature,
      measures: known ? `${known.do} / ${known.avoid}` : entry.feature.startsWith('topic:') ? `Videos about "${entry.feature.slice(6)}"` : entry.feature.startsWith('length:') ? `Video length ${entry.feature.slice(7)}` : entry.feature,
      families: [],
    };
    row.families.push(FAMILY_LABEL[entry.family]);
    seen.set(entry.feature, row);
  }
  return { record_type: 'WatchAnyCreatorFeaturesV1', features: [...seen.values()] };
}

/** Older rules with stable ids, the starting point for a mapping file. */
export function priorList(priorRules) {
  return { record_type: 'WatchAnyCreatorPriorRulesV1', rules: priorRules.map(({ id, text }) => ({ prior_id: id, text })) };
}

// ---------------------------------------------------- Threadify brief/check

/**
 * The generation briefs for Threadify. These are instructions and evidence,
 * never post copy: Threadify writes every word of the thread and the post.
 */
export function generationBriefs(analysis, { account, agent = 'my AI agent', then_vs_now: thenVsNow = null, top = 7 } = {}) {
  const rules = [...analysis.rules, ...(analysis.reserve_rules ?? [])].slice(0, top);
  if (rules.length < top) fail(`need_${top}_rules_have_${rules.length}`);
  const c = analysis.counts;
  const facts = [
    `Facts (use these numbers exactly, invent none): ${analysis.creator} has ${c.unique_videos} public videos listed (${c.analysed_long} long-form, ${c.analysed_shorts} Shorts after removing re-uploads); ${c.transcripts_matched} long-form transcripts were read; observed ${analysis.observed_at.slice(0, 10)}.`,
    ...rules.map((rule, index) => `Rule ${index + 1}: ${rule.statement} (${FAMILY_LABEL[rule.family]}). Evidence: ${rule.evidence_line}. Template: ${rule.copy_this}`),
  ];
  if (thenVsNow) facts.push(`Then vs now: ${thenVsNow.summary.held} older rules held, ${thenVsNow.summary.broke} broke, ${thenVsNow.summary.new} new.`);
  const thread = [
    `Write a ten-post Threads thread in my voice for ${account}.`,
    `Post 1: the hook. My audience does not have time to watch ${c.unique_videos} ${analysis.creator} videos, so I had ${agent} watch them; this thread is what the numbers say.`,
    'Posts 2-8: one rule each, numbered 1 to 7, in the order below. Each states the rule, gives its evidence number, and ends with a line that starts "copy this:" followed by the template.',
    'Post 9: one action for the reader to take today.',
    'Post 10: the CTA: comment the next creator they want watched.',
    'Every post under 500 characters. No links. No hedging words. Patterns, not promises: never say a rule will get views.',
    ...facts,
  ].join('\n');
  const post = [
    `Write one standalone Threads post in my voice for ${account}.`,
    `The single strongest rule from ${c.unique_videos} ${analysis.creator} videos, with its evidence number, and why it saves my audience time.`,
    'Under 500 characters. No links. No hedging words. Never say it will get views.',
    facts[0],
    facts[1],
  ].join('\n');
  return { thread_input_text: thread, post_input_text: post, rule_ids: rules.map((rule) => rule.rule_id) };
}

const postText = (post) => (typeof post === 'string' ? post : post?.text ?? '');

/** Structure gate for Threadify's thread. Reasons go back to Threadify; nobody hand-fixes the copy. */
export function checkThread(input) {
  const posts = (Array.isArray(input) ? input : input?.posts ?? []).map(postText);
  const reasons = [];
  const limit = PLATFORM_LIMITS.threads;
  if (posts.length !== 10) reasons.push(`needs exactly 10 posts, got ${posts.length}`);
  posts.forEach((post, index) => {
    if (!post.trim()) reasons.push(`post ${index + 1} is empty`);
    if (post.length > limit) reasons.push(`post ${index + 1} is ${post.length} characters (limit ${limit})`);
    if (index >= 1 && index <= 7 && !/copy this:/i.test(post)) reasons.push(`post ${index + 1} has no "copy this:" line`);
  });
  return { status: reasons.length ? 'FAIL' : 'PASS', post_count: posts.length, reasons, thread_sha256: sha256(JSON.stringify(posts)) };
}

// --------------------------------------------------------------------- CLI

function argument(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return null;
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) fail(`${name}_requires_value`);
  return value;
}

function required(argv, name) {
  const value = argument(argv, name);
  if (!value) fail(`${name}_is_required`);
  return value;
}

async function stdinJson() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  if (!data.trim()) fail('input_json_required_on_stdin');
  return JSON.parse(data);
}

function writePrivate(directory, name, content) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, name);
  fs.writeFileSync(file, content, { mode: 0o600 });
  return file;
}

async function main(argv) {
  const [command] = argv;
  if (command === 'estimate') {
    const whole = (name, fallback) => (argument(argv, name) === null ? fallback : Number(argument(argv, name)));
    const longCount = whole('--long', null);
    return estimateCredits({
      long_count: longCount,
      shorts_count: whole('--shorts', null),
      transcripts: whole('--transcripts', longCount),
      sorts: whole('--sorts', 1),
    });
  }
  if (command === 'analyse' || command === 'analyze') {
    const started = Date.now();
    const corpus = loadCorpus(required(argv, '--corpus'));
    const out = path.resolve(required(argv, '--out'));
    const analysis = analyseCorpus(corpus);
    writePrivate(out, 'rules.json', `${JSON.stringify(analysis, null, 2)}\n`);
    writePrivate(out, 'rules.md', rulesMarkdown(analysis));
    let thenVsNow = null;
    const prior = argument(argv, '--prior');
    if (prior) {
      thenVsNow = compareRules(parsePriorRules(fs.readFileSync(prior, 'utf8'), prior), analysis);
      writePrivate(out, 'then-vs-now.json', `${JSON.stringify(thenVsNow, null, 2)}\n`);
    }
    return {
      status: 'analysed',
      seconds: round((Date.now() - started) / 1000, 1),
      creator: analysis.creator,
      counts: analysis.counts,
      families: Object.fromEntries(Object.entries(analysis.families).map(([family, value]) => [family, { videos: value.videos, metric_valid: value.metric_valid, comparison_status: value.comparison_status, median_views_per_day: value.median_views_per_day }])),
      shorts_vs_long: analysis.shorts_vs_long?.line ?? null,
      top_rules: analysis.rules.slice(0, 10).map((rule) => ({ rank: rule.rank, rule: `${rule.statement} (${FAMILY_LABEL[rule.family]})`, evidence: rule.evidence_line, examples: rule.example_ids })),
      then_vs_now: thenVsNow ? thenVsNow.summary : null,
      gaps: corpus.source.gaps,
      files: ['rules.json', 'rules.md', ...(thenVsNow ? ['then-vs-now.json'] : [])].map((name) => path.join(out, name)),
    };
  }
  if (command === 'features') return listFeatures(JSON.parse(fs.readFileSync(required(argv, '--rules'), 'utf8')));
  if (command === 'prior') {
    const prior = required(argv, '--prior');
    return priorList(parsePriorRules(fs.readFileSync(prior, 'utf8'), prior));
  }
  if (command === 'compare') {
    const analysis = JSON.parse(fs.readFileSync(required(argv, '--rules'), 'utf8'));
    const prior = required(argv, '--prior');
    const mapFile = argument(argv, '--map');
    const mapBody = mapFile ? JSON.parse(fs.readFileSync(mapFile, 'utf8')) : null;
    const mapping = mapBody ? (Array.isArray(mapBody) ? mapBody : mapBody.mapping) : null;
    if (mapBody && !Array.isArray(mapping)) fail('mapping_needs_an_array');
    const result = compareRules(parsePriorRules(fs.readFileSync(prior, 'utf8'), prior), analysis, { mapping });
    const out = argument(argv, '--out');
    if (out) writePrivate(path.resolve(out), 'then-vs-now.json', `${JSON.stringify(result, null, 2)}\n`);
    return result;
  }
  if (command === 'brief') {
    const analysis = JSON.parse(fs.readFileSync(required(argv, '--rules'), 'utf8'));
    const thenFile = argument(argv, '--then-vs-now');
    return generationBriefs(analysis, { account: required(argv, '--account'), agent: argument(argv, '--agent') ?? undefined, then_vs_now: thenFile ? JSON.parse(fs.readFileSync(thenFile, 'utf8')) : null });
  }
  if (command === 'check-thread') return checkThread(await stdinJson());
  fail('usage: watch-any-creator.mjs estimate|analyse|features|prior|compare|brief|check-thread');
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main(process.argv.slice(2)).then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result?.status === 'FAIL') process.exitCode = 1;
  }).catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: 'failed', error: error.message })}\n`);
    process.exitCode = 1;
  });
}
