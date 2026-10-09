// Mirror the runnable catalog into plugins/claude, the Claude Code plugin root.
// The plugin directory scans only that folder, so it carries the self-contained
// skill bundles, the MCP server declaration and the manifest, and nothing else.
// `--check` verifies parity without writing. The manifest and icon under
// plugins/claude/.claude-plugin are source files and are left untouched.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadWorkflowRegistry, listWorkflows } from '../lib/workflow-registry.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const check = process.argv.includes('--check');
const pluginRoot = path.join(root, 'plugins', 'claude');
const SOURCE_ONLY = new Set(['.claude-plugin']);
const IGNORED = new Set(['.DS_Store']);
// Skills that drive an external engine (Eddy today) stay out of the Claude plugin:
// the plugin never ships the engine and the directory must list Threadify-only
// skills. The rule comes from each workflow manifest's external_engines, so a
// future engine-backed skill is excluded without editing this script.
const registry = loadWorkflowRegistry({ root });
const EXCLUDED_SKILLS = new Set(listWorkflows(registry, { kind: 'skill' })
  .filter((workflow) => (workflow.external_engines ?? []).length > 0)
  .map((workflow) => workflow.skill_name));
const FORBIDDEN_CONTENT = /eddy/i;

function collect(directory, relative = '') {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (IGNORED.has(entry.name)) continue;
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    const full = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink in canonical skill source: ${child}`);
    if (entry.isDirectory()) files.push(...collect(full, child));
    else if (entry.isFile()) files.push([child, fs.readFileSync(full)]);
    else throw new Error(`Unsupported canonical skill source: ${child}`);
  }
  return files;
}

const expected = new Map();
for (const [relative, content] of collect(path.join(root, 'skills'))) {
  if (EXCLUDED_SKILLS.has(relative.split('/')[0])) continue;
  if (FORBIDDEN_CONTENT.test(content.toString('utf8'))) throw new Error(`External engine reference in plugin content: skills/${relative}`);
  expected.set(`skills/${relative}`, content);
}
const rootMcp = JSON.parse(fs.readFileSync(path.join(root, '.mcp.json'), 'utf8'));
if (!rootMcp?.mcpServers?.threadify) throw new Error('.mcp.json must declare the threadify server');
expected.set('.mcp.json', Buffer.from(`${JSON.stringify({ mcpServers: { threadify: rootMcp.mcpServers.threadify } }, null, 2)}\n`));

const failures = [];
function audit(directory, relative = '') {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (IGNORED.has(entry.name)) continue;
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (!relative && SOURCE_ONLY.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink in plugin output: ${child}`);
    if (entry.isDirectory()) {
      audit(full, child);
      if (!check && fs.readdirSync(full).length === 0) fs.rmdirSync(full);
    } else if (!expected.has(child)) {
      if (check) failures.push(`unexpected ${child}`);
      else fs.rmSync(full);
    }
  }
}
audit(pluginRoot);
for (const [relative, content] of expected) {
  const file = path.join(pluginRoot, relative);
  if (check) {
    if (!fs.existsSync(file) || !fs.readFileSync(file).equals(content)) failures.push(relative);
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
}
for (const required of ['.claude-plugin/plugin.json', '.claude-plugin/icon.png']) {
  if (!fs.existsSync(path.join(pluginRoot, required))) failures.push(`missing ${required}`);
}
if (failures.length) throw new Error(`Claude plugin drift: ${failures.join(', ')}`);
const skills = new Set([...expected.keys()].filter((key) => key.startsWith('skills/')).map((key) => key.split('/')[1]));
console.log(`Claude plugin ${check ? 'verified' : 'built'}: ${skills.size} skills, ${expected.size} files.`);
