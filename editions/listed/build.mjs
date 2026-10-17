#!/usr/bin/env node
// Builds the listed edition: the package OpenAI's plugin directory receives.
// Usage: node editions/listed/build.mjs [--check] [--root <repo root>]
// The output under editions/listed/package/ is committed so a PR diff shows exactly what ships.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EDITION_RELATIVE = 'editions/listed';
export const PLUGIN_SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json';
export const MCP_SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json';
const DEFAULT_ROOT = fileURLToPath(new URL('../..', import.meta.url));

export function stableStringify(value) {
  const sort = (item) => {
    if (Array.isArray(item)) return item.map(sort);
    if (item && typeof item === 'object') {
      return Object.fromEntries(Object.keys(item).sort().map((key) => [key, sort(item[key])]));
    }
    return item;
  };
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}

const digest = (buffer) => `sha256-${crypto.createHash('sha256').update(buffer).digest('hex')}`;

function globToRegExp(glob) {
  let source = '';
  for (let index = 0; index < glob.length; index++) {
    const char = glob[index];
    if (char === '*' && glob[index + 1] === '*') { source += '.*'; index++; }
    else if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`);
}

function listFiles(directory, relative = '') {
  const files = [];
  for (const entry of fs.readdirSync(path.join(directory, relative), { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    if (entry.name === '.DS_Store') continue; // Finder noise, gitignored
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Refusing symlink: ${child}`);
    if (entry.isDirectory()) files.push(...listFiles(directory, child));
    else if (entry.isFile()) files.push(child);
    else throw new Error(`Unsupported entry: ${child}`);
  }
  return files;
}

// Inside the path's own tree only: rejects absolute paths and `..` escapes.
function inside(base, relative, label) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative)) throw new Error(`${label} must be a relative path.`);
  const full = path.resolve(base, relative);
  const back = path.relative(base, full);
  if (!back || back.startsWith('..') || path.isAbsolute(back)) throw new Error(`${label} escapes its folder: ${relative}`);
  return full;
}

function overrideDescription(skillText, skill) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(skillText);
  if (!match) throw new Error(`${skill.name}/SKILL.md has no front matter.`);
  const lines = match[1].split(/\r?\n/);
  const nameLines = lines.filter((line) => /^name:/.test(line));
  if (nameLines.length !== 1 || nameLines[0].replace(/^name:\s*/, '').replace(/^["']|["']$/g, '') !== skill.name) {
    throw new Error(`${skill.name}/SKILL.md front matter name must be ${skill.name}.`);
  }
  const descriptionIndexes = lines.flatMap((line, index) => (/^description:/.test(line) ? [index] : []));
  if (descriptionIndexes.length !== 1) throw new Error(`${skill.name}/SKILL.md must have exactly one description line.`);
  const next = lines[descriptionIndexes[0] + 1];
  if (next !== undefined && /^\s/.test(next)) throw new Error(`${skill.name}/SKILL.md description must be a single line.`);
  lines[descriptionIndexes[0]] = `description: ${JSON.stringify(skill.description)}`;
  return `---\n${lines.join('\n')}\n---\n${skillText.slice(match[0].length)}`;
}

function applyReplace(text, rule, label) {
  if (typeof rule.find !== 'string' || !rule.find || typeof rule.replace !== 'string') {
    throw new Error(`${label} needs non-empty find text and replace text.`);
  }
  const count = text.split(rule.find).length - 1;
  if (count !== 1) throw new Error(`${label} matched ${count} times; it must match exactly once.`);
  return text.replace(rule.find, () => rule.replace);
}

export function loadEdition(root = DEFAULT_ROOT) {
  const editionDir = path.join(root, EDITION_RELATIVE);
  const edition = JSON.parse(fs.readFileSync(path.join(editionDir, 'edition.json'), 'utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(edition.version ?? '')) throw new Error('edition.json version must be x.y.z.');
  if (!Array.isArray(edition.skills) || edition.skills.length === 0) throw new Error('edition.json must select at least one skill.');
  return { edition, editionDir };
}

// Returns every generated file keyed by its path under editions/listed/package/, plus the lock.
export function buildEdition({ root = DEFAULT_ROOT } = {}) {
  const { edition, editionDir } = loadEdition(root);
  const files = new Map();
  const inputs = {};
  const pluginRoot = edition.plugin.name;
  const track = (repoRelative, buffer) => { inputs[repoRelative] = digest(buffer); return buffer; };
  const editionInput = (relative, label) => {
    const full = inside(editionDir, relative, label);
    return track(`${EDITION_RELATIVE}/${relative}`, fs.readFileSync(full));
  };
  track(`${EDITION_RELATIVE}/edition.json`, fs.readFileSync(path.join(editionDir, 'edition.json')));

  const names = new Set();
  for (const skill of edition.skills) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.name ?? '')) throw new Error(`Invalid skill name: ${skill.name}`);
    if (names.has(skill.name)) throw new Error(`Duplicate skill: ${skill.name}`);
    names.add(skill.name);
    if (typeof skill.description !== 'string' || !skill.description.trim()) throw new Error(`${skill.name} needs a description override.`);
    const sourceDir = inside(root, skill.source, `${skill.name} source`);
    const output = new Map();
    for (const relative of listFiles(sourceDir)) {
      output.set(relative, track(`${skill.source}/${relative}`, fs.readFileSync(path.join(sourceDir, relative))));
    }
    for (const glob of skill.drop ?? []) {
      const pattern = globToRegExp(glob);
      const matched = [...output.keys()].filter((relative) => pattern.test(relative));
      if (matched.length === 0) throw new Error(`${skill.name} drop glob matched nothing: ${glob}`);
      for (const relative of matched) output.delete(relative);
    }
    if (!output.has('SKILL.md')) throw new Error(`${skill.name} has no SKILL.md after drops.`);
    // The override runs first so replace rules see the final front matter.
    output.set('SKILL.md', Buffer.from(overrideDescription(output.get('SKILL.md').toString('utf8'), skill)));
    (skill.replace ?? []).forEach((rule, index) => {
      const label = `${skill.name} replace rule #${index + 1} (${rule.file})`;
      if (!output.has(rule.file)) throw new Error(`${label} targets a file that is not in the package.`);
      output.set(rule.file, Buffer.from(applyReplace(output.get(rule.file).toString('utf8'), rule, label)));
    });
    for (const [target, source] of Object.entries(skill.add ?? {}).sort(([a], [b]) => (a < b ? -1 : 1))) {
      inside(sourceDir, target, `${skill.name} add target`);
      if (output.has(target)) throw new Error(`${skill.name} add target already exists: ${target}`);
      output.set(target, editionInput(source, `${skill.name} add source`));
    }
    for (const [relative, content] of output) files.set(`${pluginRoot}/skills/${skill.name}/${relative}`, content);
  }

  const assetPaths = {};
  for (const [field, asset] of Object.entries(edition.assets ?? {}).sort(([a], [b]) => (a < b ? -1 : 1))) {
    inside(path.join(editionDir, 'package', pluginRoot), asset.to, `${field} target`);
    files.set(`${pluginRoot}/${asset.to}`, editionInput(asset.from, `${field} source`));
    assetPaths[field] = `./${asset.to}`;
  }

  const plugin = {
    $schema: PLUGIN_SCHEMA,
    name: edition.plugin.name,
    version: edition.version,
    description: edition.plugin.description,
    author: edition.plugin.author,
    extensions: { 'com.openai': { interface: { ...edition.listing, ...assetPaths } } },
  };
  files.set(`${pluginRoot}/plugin.json`, Buffer.from(stableStringify(plugin)));
  files.set(`${pluginRoot}/mcp.json`, Buffer.from(stableStringify({ $schema: MCP_SCHEMA, mcpServers: edition.mcpServers })));
  files.set('.agents/plugins/marketplace.json', Buffer.from(stableStringify({
    name: edition.marketplace.name,
    interface: { displayName: edition.marketplace.displayName },
    plugins: [{
      name: pluginRoot,
      source: { source: 'local', path: `./${pluginRoot}` },
      policy: { installation: 'AVAILABLE', authentication: 'ON_USE' },
      category: edition.listing.category,
    }],
  })));

  const sorted = new Map([...files.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  const lock = {
    edition: edition.edition,
    version: edition.version,
    inputs,
    outputs: Object.fromEntries([...sorted].map(([relative, content]) => [relative, digest(content)])),
  };
  return { files: sorted, lock: Buffer.from(stableStringify(lock)), editionDir };
}

// Compares a fresh in-memory build with the committed package and lock. Returns drift messages.
export function checkEdition({ root = DEFAULT_ROOT } = {}) {
  const { files, lock, editionDir } = buildEdition({ root });
  const packageDir = path.join(editionDir, 'package');
  const problems = [];
  const present = fs.existsSync(packageDir) ? listFiles(packageDir) : [];
  for (const relative of present) {
    if (!files.has(relative)) problems.push(`unexpected file in package: ${relative}`);
    else if (!fs.readFileSync(path.join(packageDir, relative)).equals(files.get(relative))) problems.push(`package file differs from build: ${relative}`);
  }
  for (const relative of files.keys()) if (!present.includes(relative)) problems.push(`package file missing: ${relative}`);
  const lockFile = path.join(editionDir, 'package.lock.json');
  const committed = fs.existsSync(lockFile) ? fs.readFileSync(lockFile) : null;
  if (!committed) problems.push('package.lock.json missing');
  else if (!committed.equals(lock)) {
    let changed = [];
    try {
      const before = JSON.parse(committed.toString('utf8')).inputs ?? {};
      const after = JSON.parse(lock.toString('utf8')).inputs;
      changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort().filter((key) => before[key] !== after[key]);
    } catch { /* reported below */ }
    problems.push(changed.length
      ? `source changed since the last build (review, then rebuild): ${changed.join(', ')}`
      : 'package.lock.json differs from build');
  }
  return problems;
}

export function writeEdition({ root = DEFAULT_ROOT } = {}) {
  const { files, lock, editionDir } = buildEdition({ root });
  const packageDir = path.join(editionDir, 'package');
  if (fs.lstatSync(packageDir, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error('Refusing symlinked package folder.');
  // The package folder is generated output only: prune stale generated files, never anything outside it.
  if (fs.existsSync(packageDir)) {
    for (const relative of listFiles(packageDir)) if (!files.has(relative)) fs.unlinkSync(path.join(packageDir, relative));
    const prune = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory()) prune(path.join(directory, entry.name));
      }
      if (directory !== packageDir && fs.readdirSync(directory).length === 0) fs.rmdirSync(directory);
    };
    prune(packageDir);
  }
  for (const [relative, content] of files) {
    const target = path.join(packageDir, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  fs.writeFileSync(path.join(editionDir, 'package.lock.json'), lock);
  return files.size;
}

function main(argv) {
  const check = argv.includes('--check');
  const rootIndex = argv.indexOf('--root');
  const root = rootIndex === -1 ? DEFAULT_ROOT : path.resolve(argv[rootIndex + 1] ?? '');
  if (check) {
    const problems = checkEdition({ root });
    if (problems.length) {
      console.error('Listed edition is out of date. Run: node editions/listed/build.mjs');
      for (const problem of problems) console.error(`- ${problem}`);
      return 1;
    }
    console.log('Listed edition verified: committed package matches a fresh build.');
    return 0;
  }
  const count = writeEdition({ root });
  console.log(`Listed edition built: ${count} files in ${EDITION_RELATIVE}/package.`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`Listed edition build failed: ${error.message}`);
    process.exitCode = 1;
  }
}
