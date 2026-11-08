// Mirror the runnable catalog into plugins/claude, the Claude Code plugin root.
// The plugin directory scans only that folder, so it carries the self-contained
// skill bundles, the MCP server declaration and the manifest, and nothing else.
// `--check` verifies parity without writing. The manifest, icon and README under
// plugins/claude are source files and are left untouched.
//
// Every run audits the whole folder against lib/claude-plugin-policy.mjs, the
// directory's rules, and refuses to build or pass when any rule is broken.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadWorkflowRegistry, listWorkflows } from '../lib/workflow-registry.mjs';
import { auditPluginFiles } from '../lib/claude-plugin-policy.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const check = process.argv.includes('--check');
const pluginRoot = path.join(root, 'plugins', 'claude');
const SOURCE_FILES = ['.claude-plugin/plugin.json', '.claude-plugin/icon.png', 'README.md'];
const SOURCE_ONLY = new Set(['.claude-plugin', 'README.md']);
const IGNORED = new Set(['.DS_Store']);

// Workflows the Claude plugin leaves out, declared in each workflow manifest:
// - external_engines: a separate engine no plugin ships (Eddy).
// - external_credentials: a third-party service whose own API key the owner
//   supplies (ScrapeCreators). The directory holds any skill that reads a key
//   from the user's machine, and a skill script cannot receive a sensitive
//   userConfig value, so these skills stay in the installer and the other
//   plugins only.
const registry = loadWorkflowRegistry({ root });
const EXCLUDED_SKILLS = new Map(listWorkflows(registry, { kind: 'skill' })
  .map((workflow) => [workflow.skill_name, [
    ...(workflow.external_engines ?? []).map((engine) => `engine ${engine}`),
    ...(workflow.external_credentials ?? []).map((service) => `${service} API key`),
  ]])
  .filter(([, reasons]) => reasons.length > 0));

// Files that belong to other clients and are never read by Claude.
const OTHER_CLIENT_FILES = /^[^/]+\/agents\//;

// The demo feedback rules are read before the first step of every workflow, so
// the plugin inlines them at the end of each SKILL.md instead of shipping 47
// copies of one file (the directory checks at most 512 files).
const DEMO_RULES_FILE = 'references/demo-feedback-rules.md';
const DEMO_RULES_LINK = `[demo feedback rules](${DEMO_RULES_FILE})`;
const demoRules = fs.readFileSync(path.join(root, 'docs', 'demo-feedback-rules.md'), 'utf8')
  .replace(/^# [^\n]*\n+/, '')
  .replace(/^## /gm, '### ')
  .trimEnd();

function inlineDemoRules(skillName, skill) {
  const text = skill.toString('utf8');
  if (!text.includes(DEMO_RULES_LINK)) throw new Error(`${skillName}/SKILL.md does not link the demo feedback rules`);
  const linked = text.split(DEMO_RULES_LINK).join('the demo feedback rules at the end of this file');
  return Buffer.from(`${linked.trimEnd()}\n\n## Demo feedback rules (full text)\n\n${demoRules}\n`);
}

// The installer's self-update (references/update-on-use.mjs runs the updater
// installed under ~/.threadify-workflows) is code from outside the plugin, and
// the directory updates plugin installs itself. The plugin drops the script and
// the steps that run it. Each replacement must match exactly once, so a
// reworded source fails the build instead of shipping the old steps.
const INSTALLER_UPDATE_FILE = 'references/update-on-use.mjs';
const INSTALLER_UPDATE_STEPS = [{
  skill: 'threadify-qualified-buyer-research',
  from: `1. Resolve all \`references/\` paths against the directory containing this \`SKILL.md\`, then run \`node <skill-directory>/references/update-on-use.mjs\`.
2. Read the JSON result.
   - \`rules_reloaded\`, \`up_to_date\`, or \`auto_update_disabled\`: continue.
   - \`updated_restart_required\`: stop and ask the user to start a new agent session.
   - \`update_failed_using_cached_version\`: continue with the installed last-known-good rules and report the fallback.
3. Read`,
  to: `1. Resolve all \`references/\` paths against the directory containing this \`SKILL.md\`. The plugin directory keeps these rules current, so there is no update step.
2. Read`,
}];

function dropInstallerUpdate(skillName, skill) {
  let text = skill.toString('utf8');
  for (const step of INSTALLER_UPDATE_STEPS.filter((entry) => entry.skill === skillName)) {
    if (text.split(step.from).length !== 2) throw new Error(`${skillName}/SKILL.md: the installer update steps changed; update INSTALLER_UPDATE_STEPS in scripts/build-claude-plugin.mjs`);
    text = text.replace(step.from, step.to).replace(/\n4\. Record the active/, '\n3. Record the active');
  }
  return Buffer.from(text);
}

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
  const [skillName, ...rest] = relative.split('/');
  const inSkill = rest.join('/');
  if (EXCLUDED_SKILLS.has(skillName) || OTHER_CLIENT_FILES.test(relative) || inSkill === DEMO_RULES_FILE) continue;
  if (inSkill === INSTALLER_UPDATE_FILE) continue;
  expected.set(`skills/${relative}`, inSkill === 'SKILL.md' ? dropInstallerUpdate(skillName, inlineDemoRules(skillName, content)) : content);
}
const rootMcp = JSON.parse(fs.readFileSync(path.join(root, '.mcp.json'), 'utf8'));
if (!rootMcp?.mcpServers?.threadify) throw new Error('.mcp.json must declare the threadify server');
expected.set('.mcp.json', Buffer.from(`${JSON.stringify({ mcpServers: { threadify: rootMcp.mcpServers.threadify } }, null, 2)}\n`));

// Audit the folder exactly as it will ship: generated files plus source files.
const missing = SOURCE_FILES.filter((name) => !fs.existsSync(path.join(pluginRoot, name)));
const shipped = [...expected, ...SOURCE_FILES.filter((name) => !missing.includes(name))
  .map((name) => [name, fs.readFileSync(path.join(pluginRoot, name))])];
const { problems, warnings } = auditPluginFiles(shipped);
for (const warning of warnings) console.warn(`Claude plugin warning: ${warning}`);
if (problems.length) {
  throw new Error(`Claude plugin would be held or blocked by the plugin directory:\n  ${problems.join('\n  ')}\n`
    + 'Fix the source files, or declare external_engines / external_credentials in the workflow manifest to keep a skill out of the Claude plugin. '
    + 'The rules live in lib/claude-plugin-policy.mjs.');
}

const failures = missing.map((name) => `missing ${name}`);
function sweep(directory, relative = '') {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (IGNORED.has(entry.name)) continue;
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (!relative && SOURCE_ONLY.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink in plugin output: ${child}`);
    if (entry.isDirectory()) {
      sweep(full, child);
      if (!check && fs.readdirSync(full).length === 0) fs.rmdirSync(full);
    } else if (!expected.has(child)) {
      if (check) failures.push(`unexpected ${child}`);
      else fs.rmSync(full);
    }
  }
}
sweep(pluginRoot);
for (const [relative, content] of expected) {
  const file = path.join(pluginRoot, relative);
  if (check) {
    if (!fs.existsSync(file) || !fs.readFileSync(file).equals(content)) failures.push(relative);
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
}
if (failures.length) throw new Error(`Claude plugin drift (run npm run bundle:build): ${failures.join(', ')}`);
const skills = new Set([...expected.keys()].filter((name) => name.startsWith('skills/')).map((name) => name.split('/')[1]));
const excluded = [...EXCLUDED_SKILLS].map(([name, reasons]) => `${name} (${reasons.join(', ')})`).join('; ');
console.log(`Claude plugin ${check ? 'verified' : 'built'}: ${skills.size} skills, ${shipped.length} files; excluded: ${excluded || 'none'}.`);
