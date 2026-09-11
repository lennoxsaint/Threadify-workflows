import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));

test('root plugin focuses on buyer conversations while preserving skill discovery and local references', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, '.codex-plugin/plugin.json')));
  assert.equal(manifest.skills, './skills/');
  assert.equal(manifest.mcpServers, './.mcp.json');
  assert.deepEqual(manifest.interface.defaultPrompt, ['Your Next Moves']);
  assert.ok(manifest.interface.shortDescription.length <= 30);
  const legacy = fs.readdirSync(path.join(root, 'plugins/threadify/skills')).sort();
  const core = ['threadify-vault-setup', 'threadify-create-my-day', 'threadify-create-my-week', 'threadify-create-my-month'];
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
