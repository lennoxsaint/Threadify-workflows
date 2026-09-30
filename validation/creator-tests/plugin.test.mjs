import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));

test('root plugin starts with customer setup while preserving skill discovery and local references', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, '.codex-plugin/plugin.json')));
  assert.equal(manifest.skills, './skills/');
  assert.equal(manifest.mcpServers, './.mcp.json');
  assert.deepEqual(manifest.interface.defaultPrompt, ['Get Set Up']);
  assert.ok(manifest.interface.shortDescription.length <= 30);
  const compatibilityManifest = JSON.parse(fs.readFileSync(path.join(root, 'plugins/threadify/.codex-plugin/plugin.json')));
  assert.equal(compatibilityManifest.name, manifest.name);
  assert.equal(compatibilityManifest.version, manifest.version);
  const legacy = fs.readdirSync(path.join(root, 'plugins/threadify/skills')).sort();
  const core = ['threadify-vault-setup', 'threadify-create-my-day', 'threadify-create-my-week', 'threadify-create-my-month',
    'threadify-30-day-viral-vault'];
  assert.deepEqual(fs.readdirSync(path.join(root, 'skills')).sort(), [...legacy, ...core].sort());
  for (const name of [...legacy, ...core]) {
    const directory = path.join(root, 'skills', name);
    const skill = fs.readFileSync(path.join(directory, 'SKILL.md'), 'utf8');
    assert.ok(skill.startsWith(`---\nname: ${name}\n`), name);
    assert.match(skill, /\ndescription: .+\n/);
    for (const [, ref] of skill.matchAll(/`(references\/[a-zA-Z0-9._/-]+)`/g)) {
      assert.ok(fs.existsSync(path.join(directory, ref)), `${name}: missing ${ref}`);
    }
    assert.doesNotMatch(skill, /`workflows\//, 'skill must not depend on checkout-relative manifests');
  }
  const mcp = JSON.parse(fs.readFileSync(path.join(root, '.mcp.json')));
  assert.equal(mcp.mcpServers.threadify.url, 'https://www.threadify.app/api/mcp/threadify');
});

test('single-file start stays short and Dot orchestration never impersonates native installation', () => {
  const installation = fs.readFileSync(path.join(root, 'installation.md'), 'utf8');
  const prompt = installation.match(/^> (Turn this AI[^\n]+)$/m)?.[1];
  assert.ok(prompt, 'customer prompt missing');
  assert.ok(prompt.length <= 180, `customer prompt is too long: ${prompt.length}`);
  assert.match(prompt, /social media operator/);
  assert.match(prompt, /run Get Set Up/);
  assert.match(installation, /OpenAI Dot/);
  assert.match(installation, /not a native installer target/);
  assert.match(installation, /browsing this repository alone is not an installation/);

  const setupSkill = fs.readFileSync(
    path.join(root, 'plugins/threadify/skills/threadify-get-set-up/SKILL.md'),
    'utf8',
  );
  assert.match(setupSkill, /Threadify operator proof/);
  assert.match(setupSkill, /Never fill an unverified field/);
});
