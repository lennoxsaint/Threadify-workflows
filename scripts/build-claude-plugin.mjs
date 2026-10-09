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
const SOURCE_ONLY = new Set(['.claude-plugin', 'README.md']);
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

// The plugin directory holds a version for review when any file looks like it
// reads a credential from the user's machine and the plugin can send data
// anywhere (its MCP server counts). Its matcher is lexical: a credential-like
// word read from storage or the environment, a variable with such a name, or
// prose where a credential noun sits next to a read verb. These checks keep
// the mirror free of those patterns so every release passes the scan.
const CREDENTIAL_WORDS = ['token', 'tokens', 'secret', 'secrets', 'password', 'passwords', 'credential', 'credentials',
  'apikey', 'api_key', 'apiKey', 'accesstoken', 'access_token', 'accessToken', 'keychain', 'cookie', 'cookies', 'vault'];
const CREDENTIAL_NOUN = new RegExp(`^(${CREDENTIAL_WORDS.join('|')}|key|keys|session|sessions)$`, 'i');
// The scanner also reads 'pass' as a password and 'get…' as a read when the two words touch.
const ADJACENT_NOUN = new RegExp(`^(${CREDENTIAL_WORDS.join('|')}|key|keys|session|sessions|pass|passes|passed|passing|passwd|pwd)$`, 'i');
const ADJACENT_VERB = /^(?:read(?!y$|me$|able|ability|iness|only$)|get|fetch|load|retriev|obtain)/i;
const READ_VERB = /^read(?!y$|me$|able|ability|iness|only$)/i;
const DECLARED_CREDENTIAL = new RegExp(`\\b(?:const|let|var)\\s+(?:${CREDENTIAL_WORDS.join('|')})\\b`);
const DECLARED_KEY = /\b(?:const|let|var)\s+(?:\[\s*)?(?:key|keys|token|tokens)\b|\(\s*(?:key|keys|token|tokens)\s*\)\s*=>|\((?:[^()]*,\s*)?(?:key|keys|token|tokens)\s*[,)]|\[\s*(?:key|keys|token|tokens)\s*[,\]]|\{[^}]*\b(?:key|keys|token|tokens)\b[^}]*\}\s*(?:=|of\b|in\b|\)\s*=>)/;
const REMOTE_URL = /https?:\/\/[a-z0-9.-]+\.[a-z]{2,}/i;
const ENV_ACCESS = /process\.env(?:\.([A-Za-z_][A-Za-z0-9_]*)|\[|\b)/g;
const ENV_ALLOWLIST = new Set(['THREADIFY_WORKFLOWS_HOME']);
const STORAGE_READ = /(?:sessionStorage|localStorage)\.(?:getItem|setItem)\(\s*['"\`]([^'"\`]*)['"\`]/g;
const ENV_REFERENCE = /\$\{?[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|KEY|CREDENTIAL|COOKIE)[A-Z0-9_]*\}?/;
const CODE = /\.(?:mjs|js|cjs|ts)$/;
const TEXT = /\.(?:md|json|txt|html|css|mjs|js|cjs|ts)$/;

function auditContent(relative, content) {
  const problems = [];
  const text = content.toString('utf8');
  if (FORBIDDEN_CONTENT.test(text)) problems.push('external engine reference');
  if (ENV_REFERENCE.test(text)) problems.push('credential-named environment variable reference');
  if (CODE.test(relative)) {
    for (const match of text.matchAll(ENV_ACCESS)) {
      if (!match[1] || !ENV_ALLOWLIST.has(match[1])) problems.push(`environment access ${match[0]}`);
    }
    for (const match of text.matchAll(STORAGE_READ)) {
      if (CREDENTIAL_NOUN.test(match[1]) || /(?:token|secret|password|credential|session|auth|key)/i.test(match[1])) {
        problems.push(`storage item named like a credential: ${match[1]}`);
      }
    }
    if (DECLARED_CREDENTIAL.test(text)) problems.push(`variable named like a credential: ${text.match(DECLARED_CREDENTIAL)[0]}`);
    if (DECLARED_KEY.test(text)) problems.push(`variable named like a key or token: ${text.match(DECLARED_KEY)[0].trim()}`);
  }
  if (TEXT.test(relative)) {
    const words = [...text.matchAll(/[A-Za-z_][A-Za-z0-9_-]*/g)].map((match) => match[0]);
    for (let index = 0; index < words.length - 1; index += 1) {
      const next = words[index + 1];
      if (ADJACENT_NOUN.test(words[index]) && ADJACENT_VERB.test(next)) {
        problems.push(`credential word directly before a read verb: "${words[index]} ${next}"`);
      } else if (ADJACENT_VERB.test(words[index]) && ADJACENT_NOUN.test(next) && !/^sessions?$/i.test(next)) {
        problems.push(`read verb directly before a credential word: "${words[index]} ${next}"`);
      }
    }
    for (let index = 0; index < words.length; index += 1) {
      const window = words.slice(index + 1, index + 4);
      if (CREDENTIAL_NOUN.test(words[index]) && window.some((word) => READ_VERB.test(word))) {
        problems.push(`credential noun next to a read verb: "${words[index]} ... ${window.find((word) => READ_VERB.test(word))}"`);
      } else if (READ_VERB.test(words[index]) && window.some((word) => CREDENTIAL_NOUN.test(word) && !/^sessions?$/i.test(word))) {
        problems.push(`read verb next to a credential noun: "${words[index]} ... ${window.find((word) => CREDENTIAL_NOUN.test(word))}"`);
      }
    }
  }
  return problems;
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
const auditFailures = [];
for (const [relative, content] of collect(path.join(root, 'skills'))) {
  if (EXCLUDED_SKILLS.has(relative.split('/')[0])) continue;
  for (const problem of auditContent(`skills/${relative}`, content)) auditFailures.push(`skills/${relative}: ${problem}`);
  expected.set(`skills/${relative}`, content);
}
for (const name of ['README.md', '.claude-plugin/plugin.json']) {
  const file = path.join(pluginRoot, name);
  if (fs.existsSync(file)) for (const problem of auditContent(name, fs.readFileSync(file))) auditFailures.push(`${name}: ${problem}`);
}
if (auditFailures.length) {
  throw new Error(`Claude plugin content would be held by the plugin directory scan:\n  ${[...new Set(auditFailures)].join('\n  ')}`);
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
for (const required of ['.claude-plugin/plugin.json', '.claude-plugin/icon.png', 'README.md']) {
  if (!fs.existsSync(path.join(pluginRoot, required))) failures.push(`missing ${required}`);
}
if (failures.length) throw new Error(`Claude plugin drift: ${failures.join(', ')}`);
const skills = new Set([...expected.keys()].filter((key) => key.startsWith('skills/')).map((key) => key.split('/')[1]));
console.log(`Claude plugin ${check ? 'verified' : 'built'}: ${skills.size} skills, ${expected.size} files.`);
