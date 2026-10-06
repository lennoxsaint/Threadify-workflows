#!/usr/bin/env node
// Mirrors OpenAI's automated plugin checks, as far as they apply to a folder, plus our stricter policy lint.
// Usage: node editions/listed/preflight.mjs <plugin dir> [--json]
// Tool names are checked against contract/tools.json (see contract/extract.mjs) and contract/terms.json.
// Codes match https://developers.openai.com/plugins/deploy/submission-errors where one exists;
// codes starting with `listed_` are ours. Exits 1 on any error.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN_SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json';
const MCP_SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json';
// Top-level keys allowed by the Agent Plugins 1.0.0 plugin schema (additionalProperties: false).
const PLUGIN_KEYS = new Set(['$schema', 'name', 'version', 'description', 'author', 'homepage', 'repository', 'license', 'keywords', 'extensions']);
const CATEGORIES = new Set(['Productivity', 'Creativity', 'Developer Tools', 'Business & Operations', 'Data & Analytics',
  'Communication', 'Education & Research', 'Security', 'Finance', 'Healthcare', 'Travel', 'Entertainment', 'Other']);
const LISTING_URLS = [
  ['websiteURL', 'website_url'], ['supportURL', 'support_url'],
  ['privacyPolicyURL', 'privacy_policy_url'], ['termsOfServiceURL', 'terms_of_service_url'],
];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const TEXT_FILE = /\.(?:md|markdown|txt|json|ya?ml|html?)$/i;
// Our policy, stricter than OpenAI's: listed copy carries no commercial funnel and no local helpers.
const POLICY = [
  ['listed_policy_plans_link', /threadify\.app\/(?:plans|home|pricing)/i, 'links to a Threadify plans, home or pricing page'],
  ['listed_policy_utm', /\butm(?:_|\b)/i, 'contains a UTM parameter or UTM wording'],
  ['listed_policy_trial', /\btrials?\b/i, 'mentions a trial'],
  ['listed_policy_upgrade', /\bupgrad/i, 'mentions an upgrade'],
  ['listed_policy_pricing', /\bpric(?:e|es|ed|ing)\b/i, 'mentions price or pricing'],
  ['listed_policy_subscription', /subscri/i, 'mentions a subscription'],
  ['listed_policy_price_amount', /\$\d/, 'contains a dollar amount'],
  ['listed_policy_local_helper', /\bnode |\.mjs\b|\bnpx\b|\bnpm |~\/|\bscripts\//, 'refers to a local helper or script'],
  ['listed_policy_shouting', /\b(?:ALWAYS|MUST|NEVER)\b/, 'uses all-caps ALWAYS, MUST or NEVER'],
];

// Unsupported text: control characters (tab included), Unicode line/paragraph separators, invisible formatting.
const UNSUPPORTED_TEXT = new RegExp(`[${[[0x00, 0x09], [0x0b, 0x0c], [0x0e, 0x1f], [0x7f, 0x7f], [0x200b, 0x200f], [0x2028, 0x202e], [0x2060, 0x2064], [0xfeff, 0xfeff]]
  .map(([from, to]) => `\\u{${from.toString(16)}}-\\u{${to.toString(16)}}`).join('')}]`, 'u');
const LINE_BREAK = /[\r\n]/;
const DEFAULT_CONTRACT = fileURLToPath(new URL('./contract/', import.meta.url));
// A backticked lowercase word. With an underscore it is snake_case and must be a known tool, parameter or term.
const BACKTICKED = /`([a-z][a-z0-9]*(?:_[a-z0-9]+)*)`/g;

// The tool snapshot plus the hand-kept list of backticked snake_case words that are not tools.
export function loadContract(directory = DEFAULT_CONTRACT) {
  const tools = new Map();
  for (const tool of JSON.parse(fs.readFileSync(path.join(directory, 'tools.json'), 'utf8')).tools) tools.set(tool.name, tool);
  const terms = new Set(JSON.parse(fs.readFileSync(path.join(directory, 'terms.json'), 'utf8')).terms);
  const parameters = new Set([...tools.values()].flatMap((tool) => tool.required));
  return { tools, terms, parameters };
}

export function pngSize(buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(signature) || buffer.toString('latin1', 12, 16) !== 'IHDR') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function sniffImage(buffer) {
  if (pngSize(buffer)) return 'png';
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (buffer.length > 12 && buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return null;
}

function luminance(hex) {
  const channel = (offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}
const contrast = (a, b) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};

function isHttps(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}

// A small YAML subset for SKILL.md front matter: `key: scalar` lines with plain, single- or double-quoted values.
export function parseFrontMatter(text) {
  if (!/^---\r?\n/.test(text)) return { error: 'skill_frontmatter_missing' };
  const end = /\r?\n---[ \t]*(?:\r?\n|$)/.exec(text.slice(3));
  if (!end) return { error: 'skill_frontmatter_unclosed' };
  const block = text.slice(text.indexOf('\n') + 1, 3 + end.index);
  const body = text.slice(3 + end.index + end[0].length);
  const data = {};
  for (const line of block.split(/\r?\n/)) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!match) {
      if (/^\s+\S/.test(line)) continue; // nested mapping or continuation; not interpreted here
      return { error: 'skill_frontmatter_yaml_malformed' };
    }
    let value = match[2].trim();
    if (value.startsWith('"')) {
      try { value = JSON.parse(value); } catch { return { error: 'skill_frontmatter_yaml_malformed' }; }
    } else if (value.startsWith("'")) {
      if (!/^'(?:[^']|'')*'$/.test(value)) return { error: 'skill_frontmatter_yaml_malformed' };
      value = value.slice(1, -1).replaceAll("''", "'");
    }
    data[match[1]] = value;
  }
  return { data, body };
}

function listEntries(directory, relative = '', out = []) {
  for (const entry of fs.readdirSync(path.join(directory, relative), { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    out.push({ path: child, entry });
    if (entry.isDirectory()) listEntries(directory, child, out);
  }
  return out;
}

export function preflight(pluginDir, { contractDir = DEFAULT_CONTRACT } = {}) {
  const findings = [];
  const error = (code, where, message) => findings.push({ level: 'error', code, path: where, message });
  const warn = (code, where, message) => findings.push({ level: 'warning', code, path: where, message });
  const root = path.resolve(pluginDir);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    error('plugin_root_missing', '.', 'The selected path must exist and be a directory containing a plugin.');
    return findings;
  }
  const entries = listEntries(root);

  // Package shape.
  for (const { path: relative, entry } of entries) {
    if (entry.isSymbolicLink()) error('archive_member_type_unsupported', relative, 'Entries must be regular files or directories, not symlinks.');
    else if (!entry.isFile() && !entry.isDirectory()) error('archive_member_type_unsupported', relative, 'Entries must be regular files or directories.');
    if (relative.split('/').length > 19) error('archive_member_path_too_deep', relative, 'Paths must contain at most 20 segments.');
  }
  if (entries.length > 5000) error('archive_too_many_entries', '.', 'A package must not contain more than 5,000 entries.');
  const has = (relative) => fs.existsSync(path.join(root, relative));
  if (has('.app.json')) error('app_configuration_excluded', '.app.json', 'Submitted ZIPs must not include apps or .app.json.');
  if (has('.mcp.json')) error('listed_codex_mcp_manifest_present', '.mcp.json', 'Use the portable mcp.json only; .mcp.json is the Codex compatibility format.');
  if (has('.codex-plugin')) error('listed_codex_overlay_present', '.codex-plugin', 'A .codex-plugin overlay is not allowed; keep OpenAI settings in plugin.json extensions.');
  if (has('hooks')) error('listed_hooks_present', 'hooks', 'Plugin ZIPs with lifecycle hooks cannot currently be submitted.');

  // plugin.json.
  const manifestPath = path.join(root, 'plugin.json');
  let manifest = null;
  if (!fs.existsSync(manifestPath)) error('plugin_manifest_missing', 'plugin.json', 'Root plugin.json with the Agent Plugins schema is required.');
  else if (!fs.statSync(manifestPath).isFile()) error('plugin_manifest_not_file', 'plugin.json', 'Plugin manifest must be a regular JSON file.');
  else {
    try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
    catch (cause) { error('plugin_manifest_json_malformed', 'plugin.json', cause.message); }
    if (manifest !== null && (typeof manifest !== 'object' || Array.isArray(manifest))) {
      error('plugin_manifest_root_not_object', 'plugin.json', 'Plugin manifest must contain a JSON object.');
      manifest = null;
    }
  }
  let pluginName = '';
  if (manifest) {
    if (manifest.$schema !== PLUGIN_SCHEMA) error('listed_plugin_schema_missing', 'plugin.json', `$schema must be ${PLUGIN_SCHEMA}.`);
    for (const key of Object.keys(manifest)) if (!PLUGIN_KEYS.has(key)) error('listed_plugin_unknown_field', 'plugin.json', `Unknown top-level field "${key}" (the Agent Plugins schema forbids it).`);
    const { name, version, description, author } = manifest;
    if (name === undefined) error('plugin_name_missing', 'plugin.json', '`name` is required.');
    else if (typeof name !== 'string') error('plugin_name_wrong_type', 'plugin.json', '`name` must be a string.');
    else if (!name) error('plugin_name_empty', 'plugin.json', '`name` must be non-empty.');
    else if (name.length > 64) error('plugin_name_too_long', 'plugin.json', '`name` must be 64 characters or fewer.');
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) error('plugin_name_format', 'plugin.json', '`name` must use lowercase letters, digits and single hyphens.');
    else pluginName = name;
    if (version === undefined) error('plugin_version_missing', 'plugin.json', '`version` is required.');
    else if (typeof version !== 'string') error('plugin_version_wrong_type', 'plugin.json', '`version` must be a string.');
    else if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) error('plugin_version_not_semver', 'plugin.json', '`version` must use semantic versioning.');
    if (description === undefined) error('plugin_description_missing', 'plugin.json', '`description` is required.');
    else if (typeof description !== 'string') error('plugin_description_wrong_type', 'plugin.json', '`description` must be a string.');
    else if (!description.trim()) error('plugin_description_empty', 'plugin.json', '`description` must be non-empty.');
    else if (description.length > 1024) error('plugin_description_too_long', 'plugin.json', '`description` must be 1,024 characters or fewer.');
    if (author === undefined || author?.name === undefined) error('plugin_developer_missing', 'plugin.json', '`author.name` is required.');
    else if (typeof author !== 'object' || Array.isArray(author)) error('plugin_author_wrong_type', 'plugin.json', '`author` must be an object.');
    else {
      if (typeof author.name !== 'string') error('plugin_author_name_wrong_type', 'plugin.json', '`author.name` must be a string.');
      else if (!author.name.trim()) error('plugin_author_name_empty', 'plugin.json', '`author.name` must be non-empty.');
      else if (author.name.length > 120) error('plugin_author_name_too_long', 'plugin.json', '`author.name` must be 120 characters or fewer.');
      if (author.url !== undefined && !isHttps(author.url)) error('plugin_author_url_not_https', 'plugin.json', '`author.url` must be an HTTPS URL without credentials.');
    }
    if (manifest.homepage !== undefined && !isHttps(manifest.homepage)) error('plugin_homepage_format', 'plugin.json', '`homepage` must be an HTTPS URL.');

    const openai = manifest.extensions?.['com.openai'];
    const ui = openai?.interface;
    if (openai?.apps !== undefined) error('app_configuration_excluded', 'plugin.json', 'extensions.com.openai.apps is not allowed in a submitted package.');
    if (openai?.hooks !== undefined) error('listed_hooks_present', 'plugin.json', 'extensions.com.openai.hooks is not allowed in a submitted package.');
    if (!ui || typeof ui !== 'object' || Array.isArray(ui)) {
      error('listed_interface_missing', 'plugin.json', 'extensions["com.openai"].interface is required for the listing.');
    } else {
      const text = (value, field, { required, max, single, codes }) => {
        if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
          if (required) error(codes.required, 'plugin.json', `interface.${field} is required and must be non-empty.`);
          return;
        }
        if (typeof value !== 'string') { error(codes.type, 'plugin.json', `interface.${field} must be a string.`); return; }
        if (value.length > max) error(codes.long, 'plugin.json', `interface.${field} must be ${max} characters or fewer (has ${value.length}).`);
        if (UNSUPPORTED_TEXT.test(value) || (single && LINE_BREAK.test(value))) error(codes.chars, 'plugin.json', `interface.${field} must use supported text${single ? ' on one line' : ''}.`);
      };
      text(ui.displayName, 'displayName', { required: true, max: 30, single: true, codes: { required: 'submission_display_name_required', type: 'plugin_display_name_wrong_type', long: 'submission_display_name_too_long', chars: 'submission_display_name_character_unsupported' } });
      text(ui.shortDescription, 'shortDescription', { required: true, max: 30, single: true, codes: { required: 'submission_subtitle_required', type: 'plugin_short_description_wrong_type', long: 'submission_subtitle_too_long', chars: 'submission_subtitle_character_unsupported' } });
      text(ui.longDescription, 'longDescription', { required: true, max: 4000, single: false, codes: { required: 'submission_description_required', type: 'plugin_long_description_wrong_type', long: 'submission_description_too_long', chars: 'submission_description_character_unsupported' } });
      text(ui.developerName, 'developerName', { required: true, max: 80, single: true, codes: { required: 'submission_developer_name_required', type: 'plugin_developer_name_wrong_type', long: 'submission_developer_name_too_long', chars: 'submission_developer_name_character_unsupported' } });
      if (ui.category === undefined) error('listed_category_missing', 'plugin.json', 'interface.category is required for the listing.');
      else if (!CATEGORIES.has(ui.category)) error('plugin_category_unknown', 'plugin.json', `interface.category must be one of: ${[...CATEGORIES].join(', ')}.`);
      if (ui.capabilities !== undefined) {
        if (!Array.isArray(ui.capabilities)) error('plugin_capabilities_wrong_type', 'plugin.json', 'interface.capabilities must be a list of strings.');
        else {
          if (ui.capabilities.length > 20) error('plugin_capabilities_too_many', 'plugin.json', 'interface.capabilities must contain 20 entries or fewer.');
          for (const item of ui.capabilities) {
            if (typeof item !== 'string' || !item.trim() || item.length > 120 || UNSUPPORTED_TEXT.test(item) || LINE_BREAK.test(item)) error('plugin_capability_invalid', 'plugin.json', 'Each capability must be non-empty single-line text of 120 characters or fewer.');
          }
        }
      }
      // All four listing URLs are required for a plugin with an MCP server.
      for (const [field, code] of LISTING_URLS) {
        const value = ui[field];
        if (value === undefined || value === '') error(`plugin_${code}_empty`, 'plugin.json', `interface.${field} is required for MCP review.`);
        else if (typeof value !== 'string') error(`plugin_${code}_wrong_type`, 'plugin.json', `interface.${field} must be a string.`);
        else if (!isHttps(value)) error(`plugin_${code}_format`, 'plugin.json', `interface.${field} must be an HTTPS URL without credentials.`);
        else if (value.length > 1024) error(`plugin_${code}_too_long`, 'plugin.json', `interface.${field} must be 1,024 characters or fewer.`);
      }
      for (const [field, code, background, label] of [['brandColor', 'plugin_brand_color', '#FFFFFF', 'white'], ['brandColorDark', 'plugin_brand_color_dark', '#212121', '#212121']]) {
        const value = ui[field];
        if (value === undefined) continue;
        if (typeof value !== 'string') error(`${code}_wrong_type`, 'plugin.json', `interface.${field} must be a string.`);
        else if (!/^#[0-9A-Fa-f]{6}$/.test(value)) error(`${code}_format`, 'plugin.json', `interface.${field} must be a six-digit hex color.`);
        else if (contrast(value, background) < 2) error(`${code}_contrast`, 'plugin.json', `interface.${field} needs at least 2:1 contrast against ${label}.`);
      }
      if (ui.defaultPrompt !== undefined) {
        const prompts = typeof ui.defaultPrompt === 'string' ? [ui.defaultPrompt] : ui.defaultPrompt;
        if (!Array.isArray(prompts)) error('plugin_default_prompt_wrong_type', 'plugin.json', 'interface.defaultPrompt must be a string or list of strings.');
        else {
          if (prompts.length > 3) error('plugin_default_prompt_too_many', 'plugin.json', 'interface.defaultPrompt must contain at most three prompts.');
          const seen = new Set();
          for (const prompt of prompts) {
            if (typeof prompt !== 'string') { error('plugin_default_prompt_entry_wrong_type', 'plugin.json', 'Each starter prompt must be a string.'); continue; }
            if (!prompt.trim()) error('plugin_default_prompt_empty', 'plugin.json', 'Each starter prompt must be non-empty.');
            if (prompt.length > 128) error('plugin_default_prompt_too_long', 'plugin.json', 'Each starter prompt must be 128 characters or fewer.');
            if (UNSUPPORTED_TEXT.test(prompt) || LINE_BREAK.test(prompt)) error('plugin_default_prompt_character_unsupported', 'plugin.json', 'Each starter prompt must be supported single-line text.');
            if (/(^|\s)@\w/.test(prompt)) error('plugin_default_prompt_mention', 'plugin.json', 'Starter prompts must not contain @mentions.');
            const key = prompt.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
            if (seen.has(key)) error('plugin_default_prompt_duplicate', 'plugin.json', 'Starter prompts must be unique.');
            seen.add(key);
          }
        }
      }
      // Logo and composer icon: present, ./-relative, inside the package, square PNG, 48..4096 px.
      for (const [field, missingCode] of [['logo', 'plugin_logo_path_missing'], ['composerIcon', 'plugin_composer_icon_path_missing'], ['logoDark', null], ['composerIconDark', null]]) {
        const value = ui[field];
        if (value === undefined) { if (missingCode) error(missingCode, 'plugin.json', `interface.${field} is required and must reference a square image.`); continue; }
        checkImage(root, `interface.${field}`, value, error);
      }
      for (const [index, shot] of (Array.isArray(ui.screenshots) ? ui.screenshots : []).entries()) {
        error('screenshot_configuration_excluded', 'plugin.json', `interface.screenshots[${index}] (${shot}) needs a UI output template; not used by this edition.`);
      }
    }
  }

  // mcp.json: exactly one streamable-http server, declared with the portable schema.
  const mcpPath = path.join(root, 'mcp.json');
  if (!fs.existsSync(mcpPath)) error('listed_mcp_manifest_missing', 'mcp.json', 'The listed edition must ship exactly one remote MCP server in mcp.json.');
  else {
    let mcp = null;
    try { mcp = JSON.parse(fs.readFileSync(mcpPath, 'utf8')); }
    catch (cause) { error('mcp_manifest_json_malformed', 'mcp.json', cause.message); }
    if (mcp !== null && (typeof mcp !== 'object' || Array.isArray(mcp))) error('mcp_manifest_wrong_type', 'mcp.json', 'mcp.json must contain a JSON object.');
    else if (mcp) {
      // Codex silently drops a server when $schema or type is missing (verified by experiment), so both are errors.
      if (mcp.$schema !== MCP_SCHEMA) error('listed_mcp_schema_missing', 'mcp.json', `$schema must be ${MCP_SCHEMA}; Codex ignores the server without it.`);
      for (const key of Object.keys(mcp)) if (!['$schema', 'mcpServers'].includes(key)) error('listed_mcp_unknown_field', 'mcp.json', `Unknown top-level field "${key}".`);
      const servers = mcp.mcpServers;
      if (servers === undefined) error('mcp_servers_missing', 'mcp.json', 'mcp.json must contain the top-level mcpServers field.');
      else if (!servers || typeof servers !== 'object' || Array.isArray(servers)) error('mcp_servers_wrong_type', 'mcp.json', 'mcpServers must be an object.');
      else {
        const names = Object.keys(servers);
        if (names.length !== 1) error('listed_mcp_server_count', 'mcp.json', `Exactly one MCP server is required (found ${names.length}).`);
        for (const name of names) {
          const server = servers[name];
          if (!name.trim()) error('mcp_server_name_empty', 'mcp.json', 'Every MCP server name must contain a non-whitespace character.');
          if (!server || typeof server !== 'object' || Array.isArray(server)) { error('mcp_server_wrong_type', 'mcp.json', `mcpServers.${name} must be an object.`); continue; }
          if (server.type !== 'streamable-http') error('listed_mcp_server_type_invalid', 'mcp.json', `mcpServers.${name}.type must be "streamable-http"; Codex ignores the server without it.`);
          if (!isHttps(server.url)) error('listed_mcp_server_url_invalid', 'mcp.json', `mcpServers.${name}.url must be an HTTPS URL without credentials.`);
          for (const key of Object.keys(server)) if (!['type', 'url', 'headers'].includes(key)) error('listed_mcp_unknown_field', 'mcp.json', `Unknown field mcpServers.${name}.${key}.`);
        }
      }
    }
  }

  // Skills.
  const skillsDir = path.join(root, 'skills');
  const skillNames = new Set();
  let validSkills = 0;
  if (fs.existsSync(skillsDir) && fs.statSync(skillsDir).isDirectory()) {
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const where = `skills/${entry.name}`;
      if (entry.isSymbolicLink()) { warn('skill_symlink_ignored', where, 'Symlinks under skills/ are not imported.'); continue; }
      if (entry.isFile()) { if (entry.name !== '.DS_Store') warn('skill_file_ignored', where, 'Files directly under skills/ are not imported as skills.'); continue; }
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) { error('skill_directory_hidden', where, 'Skill directory names must not begin with ".".'); continue; }
      const skillDir = path.join(skillsDir, entry.name);
      const skillFile = path.join(skillDir, 'SKILL.md');
      if (!fs.existsSync(skillFile)) { error('skill_manifest_missing', where, 'Skill must contain a SKILL.md file.'); continue; }
      if (!fs.lstatSync(skillFile).isFile()) { error('skill_manifest_not_regular_file', `${where}/SKILL.md`, 'SKILL.md must be a regular file.'); continue; }
      const raw = fs.readFileSync(skillFile);
      const textValue = raw.toString('utf8');
      if (!Buffer.from(textValue, 'utf8').equals(raw)) { error('skill_manifest_invalid_utf8', `${where}/SKILL.md`, 'SKILL.md must be valid UTF-8.'); continue; }
      const parsed = parseFrontMatter(textValue);
      if (parsed.error) { error(parsed.error, `${where}/SKILL.md`, 'SKILL.md must start with valid YAML front matter between --- lines.'); continue; }
      const { name, description } = parsed.data;
      let ok = true;
      if (name === undefined || name === '') { error('skill_name_missing', `${where}/SKILL.md`, '`name` is required.'); ok = false; }
      else if (name !== entry.name) { error('listed_skill_name_mismatch', `${where}/SKILL.md`, `\`name\` (${name}) must equal the folder name (${entry.name}).`); ok = false; }
      if (description === undefined || description === '') { error('skill_description_missing', `${where}/SKILL.md`, '`description` is required.'); ok = false; }
      else if (description.length > 1024) { error('skill_description_too_long', `${where}/SKILL.md`, `\`description\` must be 1,024 characters or fewer (has ${description.length}).`); ok = false; }
      if (!parsed.body.trim()) { error('skill_body_empty', `${where}/SKILL.md`, 'Skill instructions must not be empty.'); ok = false; }
      if (name && skillNames.has(name)) { error('skill_identity_duplicate', `${where}/SKILL.md`, 'Each skill name must be unique.'); ok = false; }
      if (name) skillNames.add(name);
      if (pluginName && name && `${pluginName}:${name}`.length > 64) { error('skill_identity_too_long', `${where}/SKILL.md`, 'plugin-name:skill-name must be 64 characters or fewer.'); ok = false; }
      if (ok) validSkills++;
      // Every relative markdown link in the skill resolves to a file inside the skill.
      for (const { path: relative, entry: fileEntry } of listEntries(skillDir)) {
        if (!fileEntry.isFile() || !/\.md$/i.test(relative)) continue;
        const content = fs.readFileSync(path.join(skillDir, relative), 'utf8').replace(/```[\s\S]*?```/g, '');
        for (const match of content.matchAll(/!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
          const target = match[1];
          if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#')) continue;
          const clean = decodeURIComponent(target.split('#')[0]);
          const resolved = path.resolve(path.dirname(path.join(skillDir, relative)), clean);
          const back = path.relative(skillDir, resolved);
          if (back.startsWith('..') || path.isAbsolute(back)) error('listed_skill_link_outside', `${where}/${relative}`, `Link leaves the skill folder: ${target}`);
          else if (!fs.existsSync(resolved)) error('listed_skill_link_unresolved', `${where}/${relative}`, `Link target does not exist: ${target}`);
        }
      }
    }
  }
  if (validSkills === 0) error('plugin_runtime_surface_missing', 'skills', 'The package must contain at least one valid skill.');

  // Policy lint across every text file in the package.
  for (const { path: relative, entry } of entries) {
    if (!entry.isFile() || !TEXT_FILE.test(relative)) continue;
    const lines = fs.readFileSync(path.join(root, relative), 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const [code, pattern, message] of POLICY) if (pattern.test(line)) error(code, `${relative}:${index + 1}`, `Line ${message}.`);
    });
  }

  // Tool names: every backticked snake_case word is a real tool, a required parameter or a listed term,
  // and a skill that names a tool also names each of that tool's required parameters.
  let contract = null;
  try { contract = loadContract(contractDir); }
  catch (cause) { error('listed_tool_contract_missing', 'contract', `Cannot read the tool snapshot: ${cause.message}`); }
  if (contract) {
    for (const { path: relative, entry } of entries) {
      if (!entry.isFile() || !TEXT_FILE.test(relative)) continue;
      fs.readFileSync(path.join(root, relative), 'utf8').split(/\r?\n/).forEach((line, index) => {
        for (const [, word] of line.matchAll(BACKTICKED)) {
          if (!word.includes('_') || contract.tools.has(word) || contract.parameters.has(word) || contract.terms.has(word)) continue;
          error('listed_tool_unknown', `${relative}:${index + 1}`, `\`${word}\` is not a Threadify tool in contract/tools.json (add it to contract/terms.json only if it is not a tool).`);
        }
      });
    }
    const skillFolders = fs.existsSync(skillsDir) && fs.statSync(skillsDir).isDirectory()
      ? fs.readdirSync(skillsDir, { withFileTypes: true }).filter((item) => item.isDirectory() && !item.name.startsWith('.')).map((item) => item.name).sort()
      : [];
    for (const skill of skillFolders) {
      const skillDir = path.join(skillsDir, skill);
      const text = listEntries(skillDir).filter(({ path: relative, entry }) => entry.isFile() && /\.md$/i.test(relative))
        .map(({ path: relative }) => fs.readFileSync(path.join(skillDir, relative), 'utf8')).join('\n');
      const named = new Set([...text.matchAll(BACKTICKED)].map(([, word]) => word).filter((word) => contract.tools.has(word)));
      for (const tool of [...named].sort()) {
        for (const parameter of contract.tools.get(tool).required) {
          if (!new RegExp(`\\b${parameter}\\b`).test(text)) error('listed_tool_required_param_missing', `skills/${skill}`, `The skill uses \`${tool}\` but never names its required parameter \`${parameter}\`.`);
        }
      }
    }
  }
  return findings;
}

function checkImage(root, field, value, error) {
  if (typeof value !== 'string') { error('declared_asset_path_wrong_type', 'plugin.json', `${field} must be a file path string.`); return; }
  if (!value) { error('declared_asset_path_empty', 'plugin.json', `${field} must not be empty.`); return; }
  if (value !== value.trim()) { error('declared_asset_path_has_outer_whitespace', 'plugin.json', `${field} must not begin or end with whitespace.`); return; }
  if (!value.startsWith('./')) { error('branding_asset_path_missing_root_prefix', 'plugin.json', `${field} must start with ./`); return; }
  if (value.split('/').includes('..')) { error('declared_asset_path_unsafe', 'plugin.json', `${field} must not contain .. segments.`); return; }
  const full = path.resolve(root, value);
  const back = path.relative(root, full);
  if (back.startsWith('..') || path.isAbsolute(back)) { error('declared_asset_path_outside_package', 'plugin.json', `${field} must reference a file inside the plugin.`); return; }
  if (!fs.existsSync(full)) { error('declared_asset_file_missing', value, `${field} references a file that does not exist.`); return; }
  if (!fs.lstatSync(full).isFile()) { error('declared_asset_not_regular_file', value, `${field} must reference a regular file.`); return; }
  if (!/\.(?:png|jpe?g|webp|svg)$/i.test(value)) { error('image_file_format_unsupported', value, 'Images must be .png, .jpg, .jpeg, .webp or .svg.'); return; }
  const buffer = fs.readFileSync(full);
  if (buffer.length > MAX_IMAGE_BYTES) error('image_file_too_large', value, 'Images must not exceed 5 MiB.');
  if (!/\.png$/i.test(value)) { error('listed_image_png_required', value, 'This preflight measures PNG only; ship PNG icons.'); return; }
  const kind = sniffImage(buffer);
  if (kind && kind !== 'png') { error('raster_image_extension_content_mismatch', value, `File ends in .png but contains ${kind}.`); return; }
  const size = pngSize(buffer);
  if (!size) { error('raster_image_decode_failed', value, 'Not a decodable PNG (bad signature or IHDR).'); return; }
  if (size.width !== size.height) error('raster_image_not_square', value, `Image must be square (is ${size.width}x${size.height}).`);
  if (Math.min(size.width, size.height) < 48) error('raster_image_dimensions_too_small', value, `Image must be at least 48x48 (is ${size.width}x${size.height}).`);
  if (Math.max(size.width, size.height) > 4096) error('raster_image_dimensions_too_large', value, `Image must be at most 4096x4096 (is ${size.width}x${size.height}).`);
}

function main(argv) {
  const json = argv.includes('--json');
  const target = argv.find((arg) => !arg.startsWith('--'));
  if (!target) {
    console.error('Usage: node editions/listed/preflight.mjs <plugin dir> [--json]');
    return 2;
  }
  const findings = preflight(target);
  const errors = findings.filter((finding) => finding.level === 'error');
  if (json) console.log(JSON.stringify({ ok: errors.length === 0, plugin: path.resolve(target), findings }, null, 2));
  else {
    for (const finding of findings) console.log(`${finding.level.toUpperCase()} ${finding.code} ${finding.path}: ${finding.message}`);
    console.log(errors.length ? `Preflight failed: ${errors.length} error(s), ${findings.length - errors.length} warning(s).`
      : `Preflight passed: ${path.resolve(target)} (${findings.length} warning(s)).`);
  }
  return errors.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
