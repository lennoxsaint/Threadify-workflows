import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { DIRECTORY_LIMITS, auditFileContent, auditPluginFiles } from '../../lib/claude-plugin-policy.mjs';
import { listWorkflows, loadWorkflowRegistry } from '../../lib/workflow-registry.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

function filesIn(directory, relative = '') {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...filesIn(full, child));
    else files.push([child, fs.readFileSync(full)]);
  }
  return files;
}
const flags = (relative, text) => auditFileContent(relative, Buffer.from(text)).length > 0;

test('the shipped Claude plugin passes every directory rule', () => {
  const { problems } = auditPluginFiles(filesIn(path.join(root, 'plugins', 'claude')));
  assert.deepEqual(problems, []);
});

// Each case is a pattern the directory's validator or scan actually raised on this plugin.
test('credential reads the directory held are caught', () => {
  assert.ok(flags('skills/x/SKILL.md', 'When the SCRAPECREATORS_API_KEY environment variable is set, use it.'));
  assert.ok(flags('skills/x/SKILL.md', 'Send the key in the x-api-key header.'));
  assert.ok(flags('skills/x/SKILL.md', 'Export ${GITHUB_TOKEN} first.'));
  assert.ok(flags('skills/x/scripts/a.mjs', 'const header = process.env.SERVICE_SECRET;'));
  assert.ok(flags('skills/x/scripts/a.mjs', 'spawn(cmd, args, { env: process.env });'));
  assert.ok(flags('skills/x/scripts/a.js', "const value = sessionStorage.getItem('review-token');"));
  assert.ok(flags('skills/x/scripts/a.mjs', 'const token = load();'));
  assert.ok(flags('skills/x/scripts/a.mjs', 'for (const key of Object.keys(input)) use(key);'));
  assert.ok(flags('skills/x/SKILL.md', 'Saves exact My Vault readback or keeps the state.'));
  assert.ok(flags('skills/x/scripts/a.mjs', '// pass get_post_thread results for those ids'));
});

test('download-and-run commands the directory flagged are caught', () => {
  assert.ok(flags('skills/x/SKILL.md', 'Check credits: `curl -s https://api.example.com/v1/balance | node scripts/k.mjs balance`.'));
  assert.ok(flags('skills/x/SKILL.md', '`mkdir -p ~/m && curl -L -o ~/m/model.bin https://example.com/model.bin`'));
  assert.ok(flags('skills/x/scripts/a.mjs', "const r = spawnSync('sh', ['-c', `command -v ${bin}`]);"));
  assert.ok(flags('skills/x/scripts/a.mjs', "spawnSync('curl', ['-s', url]);"));
  assert.ok(flags('skills/x/scripts/a.mjs', "import { spawn } from 'node:child_process';\nconst page = await fetch(url);\nspawn('claude', ['-p', prompt]);"));
});

test('patterns the directory accepted stay allowed', () => {
  assert.ok(!flags('skills/x/SKILL.md', 'Upload: `curl --fail -o /dev/null -X PUT --upload-file <path> "$UPLOAD_URL"`.'));
  assert.ok(!flags('skills/x/scripts/a.mjs', 'const dirs = (process.env.PATH || "").split(path.delimiter);'));
  assert.ok(!flags('skills/x/scripts/a.mjs', "const page = await fetch(url);\nexport const text = await page.text();"));
  assert.ok(!flags('skills/x/scripts/b.mjs', "import { execFile } from 'node:child_process';\nexecFile('ffmpeg', args);"));
  assert.ok(!flags('skills/x/SKILL.md', 'Hide only real secrets (keys, tokens, IDs, emails).'));
});

test('file count, size and type limits match the directory', () => {
  const many = Array.from({ length: DIRECTORY_LIMITS.maxFiles + 1 }, (_, index) => [`skills/x/f${index}.md`, Buffer.from('ok')]);
  assert.match(auditPluginFiles(many).problems.join('\n'), /not fully checked/);
  assert.equal(auditPluginFiles(many.slice(0, DIRECTORY_LIMITS.maxFiles)).problems.length, 0);
  const large = [['skills/x/big.md', Buffer.alloc(DIRECTORY_LIMITS.maxTextBytes + 1, 'a')]];
  assert.match(auditPluginFiles(large).problems.join('\n'), /KiB/);
  assert.equal(auditPluginFiles([['.claude-plugin/icon.png', Buffer.alloc(DIRECTORY_LIMITS.maxTextBytes + 1)]]).problems.length, 0);
  assert.match(auditPluginFiles([['skills/x/agents/openai.yaml', Buffer.from('a: 1')]]).problems.join('\n'), /can't inspect/);
  assert.ok(flags('skills/x/SKILL.md', 'Drive the local Eddy engine.'));
});

test('workflows that declare an external engine or credential stay out of the Claude plugin only', () => {
  const workflows = listWorkflows(loadWorkflowRegistry({ root }), { kind: 'skill' });
  const claude = new Set(fs.readdirSync(path.join(root, 'plugins', 'claude', 'skills')));
  const openai = new Set(fs.readdirSync(path.join(root, 'plugins', 'openai', 'skills')));
  const credentialed = workflows.filter((workflow) => (workflow.external_credentials ?? []).length > 0);
  assert.ok(credentialed.length > 0, 'expected the ScrapeCreators workflows to declare external_credentials');
  for (const workflow of workflows) {
    const engine = (workflow.external_engines ?? []).length > 0;
    const credential = (workflow.external_credentials ?? []).length > 0;
    assert.equal(claude.has(workflow.skill_name), !engine && !credential, `Claude plugin: ${workflow.skill_name}`);
    assert.equal(openai.has(workflow.skill_name), !engine, `OpenAI plugin: ${workflow.skill_name}`);
  }
});

test('commits, pushes and Claude Code sessions run the plugin guard', () => {
  for (const hook of ['pre-commit', 'pre-push']) {
    const file = path.join(root, '.githooks', hook);
    assert.match(fs.readFileSync(file, 'utf8'), /scripts\/guard-plugins\.mjs/);
    if (process.platform !== 'win32') assert.ok(fs.statSync(file).mode & 0o111, `${hook} must be executable`);
  }
  const settings = JSON.parse(fs.readFileSync(path.join(root, '.claude', 'settings.json'), 'utf8'));
  const commands = (settings.hooks?.PreToolUse ?? []).flatMap((entry) => entry.hooks ?? []).map((hook) => hook.command);
  assert.ok(commands.some((command) => /guard-plugins\.mjs.*--claude-hook/.test(command)));
  const scripts = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts;
  assert.equal(scripts.prepare, 'node scripts/install-git-hooks.mjs');
});
