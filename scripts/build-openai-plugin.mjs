// Mirror the Claude plugin's skills into plugins/openai, the package submitted to OpenAI's plugin
// directory (ChatGPT and Codex). Same ingredients as the Claude plugin: the skills are copied from
// plugins/claude/skills, so both directories carry the same workflows, and only what the platform
// needs differs. The layout follows developers.openai.com/plugins (read 2026-10-09): plugin.json,
// mcp.json, skills/ and assets/ at the package root, no apps or hooks (a ZIP with either cannot be
// submitted). `--check` verifies parity without writing. plugin.json, README.md and assets/ are
// source files and are left untouched.
//
// Platform differences, each verified below:
// - The connection is Threadify's OpenAI address, /api/mcp/openai, which follows OpenAI's plugin rules
//   (no autopilot mode, no upgrade prompts). Every mention of the standard address points there.
// - No upgrade, plan or trial promotion. OpenAI's app submission guidelines (Commerce and
//   monetization, read 2026-10-09): users may sign in to an existing paid account, but a plugin "must
//   not display subscription plans, initiate new subscriptions, or promote upgrades", nor link to a
//   page that starts one. So the setup guide drops its plans-page link and "plan choices", the setup
//   question drops the free-trial option, Get Set Up starts from an existing account instead of
//   opening signup and purchase, and Monetize My Week no longer states an upgrade URL (the OpenAI
//   address returns none). Two attributed originals in YouTube Synthesizer quote real posts that
//   advertise a Threadify plan; they are immutable quotations of a creator's post, kept verbatim, and
//   are the only files the promotion guard allows.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const check = process.argv.includes('--check');
const claudeSkills = path.join(root, 'plugins', 'claude', 'skills');
const pluginRoot = path.join(root, 'plugins', 'openai');
const SOURCE_ONLY = new Set(['plugin.json', 'README.md', 'assets']);
const IGNORED = new Set(['.DS_Store']);
const TEXT = /\.(?:md|json|txt|html|css|mjs|js|cjs|ts|yaml|yml)$/;
const STANDARD_ADDRESS = 'https://www.threadify.app/api/mcp/threadify';
const OPENAI_ADDRESS = 'https://www.threadify.app/api/mcp/openai';
// Each rewrite must match exactly once in every file it changes and change exactly `files` files, so
// a reworded source fails the build instead of shipping the old sentence.
const REWRITES = [
  {
    files: 37,
    from: 'For Threadify setup and the current offer, open the fully attributed [Threadify plans page](https://www.threadify.app/plans?utm_source=threadify-workflows&utm_medium=github&utm_campaign=buyer-workflows&utm_content=onboarding__buyer_workflows__default&video_slug=threadify-001&cta_slot=onboarding&entry_angle=buyer_next_moves&lp_variant=plans). The [first-loop video',
    to: 'For Threadify setup, the [first-loop video',
  },
  {
    files: 37,
    from: 'The user completes signup, plan choices, login, OAuth and security steps in the provider interface.',
    to: 'The user completes login, OAuth and security steps in the provider interface.',
  },
  {
    files: 11,
    from: "Would you like help starting with Threadify's free trial, connecting an existing Threadify account, using another MCP/plugin, or working locally without a connection?",
    to: 'Would you like to connect an existing Threadify account, use another MCP/plugin, or work locally without a connection?',
  },
  {
    files: 1,
    from: 'install workflows, sign up, connect your account and agent,',
    to: 'install workflows, connect your existing Threadify account and agent,',
  },
  {
    files: 1,
    from: "Open official signup or reuse the customer's account. Customer completes login, consent and any purchase.",
    to: "Use the customer's existing Threadify account. Customer completes login and consent.",
  },
  {
    files: 1,
    from: 'One guided journey from signup to a personalized Brain and first week. The customer handles login, consent and purchases.',
    to: 'One guided journey from an existing Threadify account to a personalized Brain and first week. The customer handles login and consent.',
  },
  {
    files: 1,
    from: '"summary": "Go from signup to a personalized Brain, first week and verified agent routine."',
    to: '"summary": "Go from an existing Threadify account to a personalized Brain, first week and verified agent routine."',
  },
  {
    files: 1,
    from: 'state the returned current tier, required tier, allowed alternative and upgrade URL.',
    to: 'state the returned current tier, required tier and allowed alternative.',
  },
];
// After the rewrites, nothing may link to Threadify's plans page, offer a free trial or state an upgrade
// URL, except the two attributed originals (verbatim quotations of a creator's real posts).
const PROMOTION = /threadify\.app\/plans|free trial|upgrade url/i;
const QUOTED_ORIGINALS = new Set([
  'skills/threadify-youtube-synthesizer/references/originals.v1.json',
  'skills/threadify-youtube-synthesizer/references/template-gallery.md',
]);

function collect(directory, relative = '') {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (IGNORED.has(entry.name)) continue;
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    const full = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink in Claude plugin skills: ${child}`);
    if (entry.isDirectory()) files.push(...collect(full, child));
    else if (entry.isFile()) files.push([child, fs.readFileSync(full)]);
    else throw new Error(`Unsupported Claude plugin skill entry: ${child}`);
  }
  return files;
}

if (!fs.existsSync(claudeSkills)) throw new Error('plugins/claude/skills is missing; run scripts/build-claude-plugin.mjs first');
const expected = new Map();
const changed = new Map(REWRITES.map((rewrite) => [rewrite, 0]));
let addressRewrites = 0;
for (const [relative, original] of collect(claudeSkills)) {
  const key = `skills/${relative}`;
  let content = original;
  if (TEXT.test(relative)) {
    const source = original.toString('utf8');
    const pieces = source.split(STANDARD_ADDRESS);
    addressRewrites += pieces.length - 1;
    let text = pieces.join(OPENAI_ADDRESS);
    for (const rewrite of REWRITES) {
      const matches = text.split(rewrite.from).length - 1;
      if (matches === 0) continue;
      if (matches !== 1) throw new Error(`OpenAI rewrite must match once per file; it matched ${matches} times in ${key}: ${rewrite.from.slice(0, 60)}`);
      text = text.replace(rewrite.from, rewrite.to);
      changed.set(rewrite, changed.get(rewrite) + 1);
    }
    if (text !== source) content = Buffer.from(text, 'utf8');
  }
  expected.set(key, content);
}
for (const [rewrite, count] of changed) {
  if (count !== rewrite.files) throw new Error(`OpenAI rewrite changed ${count} files, expected ${rewrite.files}: ${rewrite.from.slice(0, 60)}`);
}
if (addressRewrites === 0) throw new Error(`No skill mentions ${STANDARD_ADDRESS}; the address rewrite matched nothing`);
for (const [key, content] of expected) {
  if (!TEXT.test(key)) continue;
  const text = content.toString('utf8');
  if (text.includes('/api/mcp/threadify')) throw new Error(`${key} still names the standard Threadify address`);
  if (PROMOTION.test(text) && !QUOTED_ORIGINALS.has(key)) throw new Error(`${key} still promotes a Threadify plan, trial or upgrade: ${text.match(PROMOTION)[0]}`);
}
expected.set('mcp.json', Buffer.from(`${JSON.stringify({
  $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
  mcpServers: { threadify: { type: 'streamable-http', url: OPENAI_ADDRESS } },
}, null, 2)}\n`));

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
for (const required of ['plugin.json', 'README.md', 'assets/logo.png']) {
  if (!fs.existsSync(path.join(pluginRoot, required))) failures.push(`missing ${required}`);
}
if (failures.length) throw new Error(`OpenAI plugin drift: ${failures.join(', ')}`);
const skills = new Set([...expected.keys()].filter((key) => key.startsWith('skills/')).map((key) => key.split('/')[1]));
console.log(`OpenAI plugin ${check ? 'verified' : 'built'}: ${skills.size} skills, ${expected.size} files, ${addressRewrites} connection address rewrites, ${REWRITES.reduce((sum, rewrite) => sum + rewrite.files, 0)} platform rewrites.`);
