// Local-only source checks. No source text is executed and no provider is called.
const MODES = new Set(['structure_only', 'exact_repost', 'literal_fill_in']);
const KINDS = new Set(['person', 'brand', 'number', 'claim', 'example', 'topic', 'personal_proof', 'cta_destination']);
const TOKEN = /\{\{([A-Z][A-Z0-9_]*)\}\}/g;
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const partsValid = (parts) => Array.isArray(parts) && parts.length > 0 && parts.every(text);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sorted = (values) => [...values].sort();
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function current(evidence, now) {
  return evidence?.verified === true && text(evidence.evidence_ref)
    && Number.isFinite(Date.parse(evidence.valid_until))
    && Date.parse(evidence.valid_until) > now;
}

function lineage(source) {
  assert(source?.schema_version === 'creator-source.v1', 'Unsupported source schema.');
  assert(text(source.id) && text(source.author) && partsValid(source.parts), 'Complete source lineage and text required.');
  let url;
  try { url = new URL(source.url); } catch { throw new Error('Valid source URL required.'); }
  assert(['http:', 'https:'].includes(url.protocol) && !url.username && !url.password, 'Public HTTP source URL required.');
}

// Descriptive token overlap only: neither a rights test nor an originality score.
export function similarity(sourceParts, finalParts) {
  const tokenize = (parts) => parts.join('\n').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const original = tokenize(sourceParts);
  const final = tokenize(finalParts);
  const counts = new Map();
  for (const token of original) counts.set(token, (counts.get(token) ?? 0) + 1);
  let shared = 0;
  for (const token of final) {
    if ((counts.get(token) ?? 0) > 0) { shared++; counts.set(token, counts.get(token) - 1); }
  }
  let longest = null;
  if (same(original, final)) longest = original.length;
  else if (original.length * final.length <= 1_000_000) {
    let previous = new Uint32Array(final.length + 1); longest = 0;
    for (const token of original) {
      const current = new Uint32Array(final.length + 1);
      for (let index = 0; index < final.length; index++) {
        if (token === final[index]) current[index + 1] = previous[index] + 1;
        longest = Math.max(longest, current[index + 1]);
      }
      previous = current;
    }
  }
  return { token_ratio: final.length ? shared / final.length : 0, longest_shared_token_run: longest,
    longest_run_unavailable_reason: longest === null ? 'Comparison exceeds the local work limit; no longest-run value inferred.' : null,
    originality_proven: false };
}

/** Evidence is supplied by the host/user and must be refreshed, not invented.
 * Inventory completeness is an explicit human/host attestation; deterministic
 * checks verify its consistency, not semantic truth or legal permission.
 */
export function resolveAdaptation(input, context) {
  const { source, mode } = input;
  lineage(source);
  assert(MODES.has(mode), 'Unsupported adaptation mode.');
  const now = Date.parse(context.now);
  assert(Number.isFinite(now) && text(context.account_id), 'Explicit current time and creator account required.');
  const base = { source_id: source.id, source_url: source.url };
  const fallback = (reason) => ({ mode: 'structure_only', ...base, reason, parts: null });
  if (mode === 'structure_only') return fallback('Use source structure only; host-authored copy still requires review.');
  const rights = source.rights;
  const owns = rights?.basis === 'owned' && source.owner_account_id === context.account_id;
  const permitted = owns || ['licensed', 'permissioned'].includes(rights?.basis);
  if (!permitted || !current(rights, now) || (mode === 'exact_repost' && !owns)) {
    return fallback('Literal reuse requires current, evidenced ownership, license or permission.');
  }
  assert(current(source.claims_review, now), 'Current claims review required before reuse.');
  let parts = [...source.parts];
  if (mode === 'literal_fill_in') {
    const { template_parts: templates, placeholders, required_source_spans: inventory } = input;
    assert(partsValid(templates), 'Complete template parts required.');
    assert(Array.isArray(placeholders) && placeholders.length > 0, 'Placeholders required.');
    assert(input.all_specifics_replaced === true && Array.isArray(inventory) && inventory.length > 0 && inventory.every(text), 'Complete independent source-span inventory required.');
    const values = new Map();
    for (const p of placeholders) {
      assert(p && /^[A-Z][A-Z0-9_]*$/.test(p.key) && !values.has(p.key), 'Unique valid placeholder keys required.');
      assert(KINDS.has(p.kind) && text(p.source_text), 'Valid placeholder kind and source span required.');
      assert(typeof p.replacement === 'string' && (text(p.replacement) || p.kind === 'cta_destination'), 'Nonempty replacement required except CTA removal.');
      assert(p.replacement !== p.source_text, 'No-op placeholder rejected.');
      assert(!/[{}]/.test(p.replacement), 'Unresolved or malformed replacement tokens rejected.');
      const fact = Object.hasOwn(context.facts ?? {}, p.evidence_ref) ? context.facts[p.evidence_ref] : null;
      assert(current(fact, now) && fact.value === p.replacement, 'Replacement must match a current verified fact.');
      values.set(p.key, p);
    }
    assert(same(sorted(inventory), sorted(placeholders.map((p) => p.source_text))), 'Source-span inventory must match placeholders exactly.');
    const tokens = templates.flatMap((part) => [...part.matchAll(TOKEN)].map((m) => m[1]));
    assert(same(sorted(new Set(tokens)), sorted(values.keys())), 'Undeclared or unused template tokens.');
    assert(templates.every((part) => !/[{}]/.test(part.replace(TOKEN, ''))), 'Malformed template tokens.');
    // One replace pass prevents replacement strings from creating new tokens.
    const render = (field) => templates.map((part) => part.replace(TOKEN, (_, key) => values.get(key)[field]));
    assert(same(render('source_text'), source.parts), 'Template must reconstruct exact source bytes.');
    parts = render('replacement');
    assert(partsValid(parts), 'Resolved posts cannot be empty.');
    assert(inventory.every((span) => !parts.some((part) => part.includes(span))), 'Source-specific span survived substitution.');
  }
  return { ...base, mode, parts, permission_basis: rights.basis, similarity: similarity(source.parts, parts) };
}
