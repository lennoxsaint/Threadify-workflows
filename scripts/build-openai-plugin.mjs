// Mirror the Claude plugin's skills into plugins/openai, the package submitted to OpenAI's plugin
// directory (ChatGPT and Codex). Same ingredients as the Claude plugin: the skills are copied from
// plugins/claude/skills, so both directories carry the same workflows, and only what the platform
// needs differs. It is packaged in OpenAI's Codex format (developers.openai.com/plugins/deploy/submission,
// "Codex format", read 2026-10-09): .codex-plugin/plugin.json, .mcp.json, skills/ and assets/, no apps or
// hooks (a ZIP with either cannot be submitted). `--check` verifies parity without writing.
// .codex-plugin/, README.md and assets/ are source files and are left untouched.
//
// NOT the portable Agent Plugins format (a root plugin.json declaring the agent-plugins.org schema, plus
// mcp.json). Shipped that way in 0.30.9 and replaced the same day: Codex treats such a package as an
// Agent Plugin and bounds its MCP tools to 8,000 bytes per tool and 64,000 bytes in total, hiding the
// rest (openai/codex codex-rs/core/src/mcp_tool_exposure.rs, MAX_AGENT_PLUGIN_MCP_SPEC_BYTES /
// MAX_AGENT_PLUGIN_MCP_TOTAL_BYTES, added in 56b82e676 "without changing legacy plugins"). Threadify's
// 91 tools are about 220,000 bytes, so Codex offered about 21 of them and hid get_connection_defaults,
// the tool every workflow calls first (measured in Codex 0.162.0-alpha.17.2, 2026-10-09). The format
// is chosen by codex-rs/utils/plugins/src/plugin_namespace.rs find_plugin_manifest_path: a root
// plugin.json with that schema wins, so the build refuses one here.
//
// Platform differences, each verified below:
// - The connection is Threadify's OpenAI address, /api/mcp/openai, which follows OpenAI's plugin rules
//   (no autopilot mode, no upgrade prompts). Every mention of the standard address points there.
// - No upgrade, plan or trial promotion. OpenAI's app submission guidelines (Commerce and
//   monetization, read 2026-10-09): users may sign in to an existing paid account, but a plugin "must
//   not display subscription plans, initiate new subscriptions, or promote upgrades", nor link to a
//   page that starts one. So the setup guide drops its plans-page link and "plan choices", the setup
//   question drops the free-trial option, Get Set Up starts from an existing account instead of
//   opening signup and purchase, Monetize My Week no longer states an upgrade URL (the OpenAI address
//   returns none), and Monetize My Week and Offer Builder no longer send the agent to the plans page
//   when Threadify is the user's offer (the user's saved offer destination still applies).
// - YouTube Synthesizer's example library quotes two @lennox_saint threads whose last post advertises
//   a Threadify plan. In this package that one post of each is replaced by OMITTED_POST, and the
//   library's integrity lock is recomputed with the skill's own sha256 and checked with its own
//   validators, so the skill still verifies itself. Nothing is exempt from the promotion guard
//   (lennoxsaint/Threadify-workflows#59 review: "these promotions should be removed or transformed
//   rather than blanket-exempted").
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  sha256,
  validateIntegrityLock,
  validateOriginalLibrary,
} from '../skills/threadify-youtube-synthesizer/scripts/youtube-synthesizer.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const check = process.argv.includes('--check');
const claudeSkills = path.join(root, 'plugins', 'claude', 'skills');
const pluginRoot = path.join(root, 'plugins', 'openai');
const SOURCE_ONLY = new Set(['.codex-plugin', 'README.md', 'assets']);
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
  {
    files: 1,
    from: ' If Threadify itself is the offer, require the current canonical plans destination with campaign attribution parameters; do not reuse an old episode URL or invent plan claims.',
    to: '',
  },
  {
    files: 1,
    from: " When Threadify itself is the offer, require current approved facts and the canonical /plans destination with the current brand's full attribution parameters; do not invent the attribution key set or use historical promotion URLs.",
    to: '',
  },
];
// After every change, nothing may link to Threadify's plans page, offer a free trial, quote a plan price
// or state an upgrade URL.
const PROMOTION = /threadify\.app\/plans|\/plans destination|plans destination|plans page|free trial|upgrade url|\$\d+\s*\/\s*mo\b/i;
const SYNTH = 'skills/threadify-youtube-synthesizer/references';
const OMITTED_POST = "[The creator's closing call to action for a paid plan is omitted from this package.]";
const PROMOTED_POSTS = 2;

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

// YouTube Synthesizer: the promoted posts are found in the library itself, never retyped. Each is
// replaced in originals.v1.json (as its JSON string) and in template-gallery.md (as its text), exactly
// once, then the integrity lock is recomputed for the changed originals and the library.
{
  const originalsKey = `${SYNTH}/originals.v1.json`;
  const galleryKey = `${SYNTH}/template-gallery.md`;
  const lockKey = `${SYNTH}/integrity.v1.json`;
  const templates = JSON.parse(expected.get(`${SYNTH}/templates.v1.json`).toString('utf8'));
  const before = JSON.parse(expected.get(originalsKey).toString('utf8'));
  const lockBefore = JSON.parse(expected.get(lockKey).toString('utf8'));
  const beforeAudit = validateIntegrityLock(templates, before, lockBefore);
  if (!beforeAudit.ok) throw new Error(`YouTube Synthesizer library does not verify before the change: ${beforeAudit.errors.join(', ')}`);
  const promoted = before.originals.flatMap((original) => original.posts
    .filter((post) => PROMOTION.test(post))
    .map((post) => ({ id: original.original_id, post })));
  if (promoted.length !== PROMOTED_POSTS) throw new Error(`Expected ${PROMOTED_POSTS} promoted posts in the YouTube Synthesizer library, found ${promoted.length}`);
  let originalsText = expected.get(originalsKey).toString('utf8');
  let galleryText = expected.get(galleryKey).toString('utf8');
  for (const { post } of promoted) {
    for (const [label, text, needle] of [['originals', originalsText, JSON.stringify(post)], ['gallery', galleryText, post]]) {
      const matches = text.split(needle).length - 1;
      if (matches !== 1) throw new Error(`Promoted post must appear once in the ${label} file; found ${matches}: ${post.slice(0, 50)}`);
    }
    originalsText = originalsText.replace(JSON.stringify(post), JSON.stringify(OMITTED_POST));
    galleryText = galleryText.replace(post, OMITTED_POST);
  }
  const contractFrom = 'The validator computes SHA-256 over each posts array joined by two newline characters.';
  if (originalsText.split(contractFrom).length !== 2) throw new Error('YouTube Synthesizer integrity_contract wording changed');
  originalsText = originalsText.replace(contractFrom, `${contractFrom} In the OpenAI plugin package, a closing call to action for a paid plan is replaced by an omission marker and the lock is recomputed.`);
  const after = JSON.parse(originalsText);
  let lockText = expected.get(lockKey).toString('utf8');
  const replaceHash = (oldHash, newHash) => {
    if (lockText.split(oldHash).length !== 2) throw new Error(`Integrity hash ${oldHash} must appear once in the lock`);
    lockText = lockText.replace(oldHash, newHash);
  };
  replaceHash(lockBefore.original_library_sha256, sha256(after));
  for (const id of new Set(promoted.map((item) => item.id))) {
    const original = after.originals.find((item) => item.original_id === id);
    replaceHash(lockBefore.originals[id], sha256(original.posts.join('\n\n')));
  }
  const lockAfter = JSON.parse(lockText);
  const afterAudit = validateIntegrityLock(templates, after, lockAfter);
  const libraryAudit = validateOriginalLibrary(after, templates);
  if (!afterAudit.ok || !libraryAudit.ok) {
    throw new Error(`YouTube Synthesizer library fails its own checks after the change: ${[...afterAudit.errors, ...libraryAudit.errors].join(', ')}`);
  }
  expected.set(originalsKey, Buffer.from(originalsText, 'utf8'));
  expected.set(galleryKey, Buffer.from(galleryText, 'utf8'));
  expected.set(lockKey, Buffer.from(lockText, 'utf8'));
}
if (addressRewrites === 0) throw new Error(`No skill mentions ${STANDARD_ADDRESS}; the address rewrite matched nothing`);
for (const [key, content] of expected) {
  if (!TEXT.test(key)) continue;
  const text = content.toString('utf8');
  if (text.includes('/api/mcp/threadify')) throw new Error(`${key} still names the standard Threadify address`);
  if (PROMOTION.test(text)) throw new Error(`${key} still promotes a Threadify plan, trial or upgrade: ${text.match(PROMOTION)[0]}`);
}
expected.set('.mcp.json', Buffer.from(`${JSON.stringify({
  mcpServers: { threadify: { url: OPENAI_ADDRESS } },
}, null, 2)}\n`));
for (const agentPluginFile of ['plugin.json', 'mcp.json']) {
  if (fs.existsSync(path.join(pluginRoot, agentPluginFile))) {
    throw new Error(`plugins/openai/${agentPluginFile} would make Codex load this package as an Agent Plugin and hide most Threadify tools; use .codex-plugin/plugin.json and .mcp.json`);
  }
}

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
for (const required of ['.codex-plugin/plugin.json', 'README.md', 'assets/logo.png']) {
  if (!fs.existsSync(path.join(pluginRoot, required))) failures.push(`missing ${required}`);
}
if (failures.length) throw new Error(`OpenAI plugin drift: ${failures.join(', ')}`);
const skills = new Set([...expected.keys()].filter((key) => key.startsWith('skills/')).map((key) => key.split('/')[1]));
console.log(`OpenAI plugin ${check ? 'verified' : 'built'}: ${skills.size} skills, ${expected.size} files, ${addressRewrites} connection address rewrites, ${REWRITES.reduce((sum, rewrite) => sum + rewrite.files, 0)} platform rewrites.`);
