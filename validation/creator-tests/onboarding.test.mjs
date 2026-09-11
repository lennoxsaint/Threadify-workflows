import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('../..', import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), 'utf8');
const buyerIds = [
  'your-next-moves',
  'agree-next-step',
  'follow-through',
  'buyer-questions-to-content',
  'weekly-buyer-outcomes',
];

test('root onboarding leads from benefit to one local-first start before connection help', () => {
  const body = read('README.md');
  const sections = [
    'Threadify Workflows turns an offer',
    '## A synthetic example',
    '## Start here',
    '## Install for your client',
    '## Find the supporting workflow',
    '## Connect Threadify when it helps',
  ].map((text) => body.indexOf(text));
  assert.ok(sections.every((index) => index >= 0));
  assert.deepEqual([...sections].sort((a, b) => a - b), sections);
  for (const text of [
    'example.invalid',
    'Fit rationale',
    'Suggested reply',
    '`draft` - nothing was sent',
    'Use Your Next Moves with my offer and the conversations I provide.',
    'npx --yes github:lennoxsaint/Threadify-workflows install --workflows all --targets codex',
    'docs/workflow-catalog.md',
    'node examples/conversations/walkthrough.mjs',
  ]) assert.ok(body.includes(text), text);
});

test('shared setup is local first and keeps provider actions gated', () => {
  const guide = read('docs/threadify-001.md');
  for (const text of [
    'Do not make provider choice, signup or connection the first question',
    'user already supplied',
    'get_connection_defaults',
    'Recipient interest and channel permission',
    'Never infer permission from silence',
    'Windows installation is not proof',
    '1HoIaLpB03A',
  ]) assert.ok(guide.includes(text), text);
  assert.doesNotMatch(guide, /card required|\$\d+|free trial/i);
  const url = new URL(guide.match(/https:\/\/www\.threadify\.app\/plans\?[^)]+/)[0]);
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'video_slug', 'cta_slot', 'entry_angle', 'lp_variant']) {
    assert.ok(url.searchParams.get(key), key);
  }
});

test('five buyer workflows and source skills share local-first contracts', () => {
  for (const id of buyerIds) {
    const workflow = read(`workflows/${id}/README.md`);
    const skill = read(`plugins/threadify/skills/threadify-${id}/SKILL.md`);
    assert.match(workflow, /\[Threadify-001\]\(\.\.\/\.\.\/docs\/threadify-001\.md\)/, id);
    assert.match(workflow, /~\/\.threadify-workflows\/current\/cli\/bin\/threadify-workflows\.mjs/, id);
    assert.doesNotMatch(workflow, /Would you like help starting with Threadify's free trial/, id);
    for (const reference of [
      '`references/threadify-001.md`',
      '`references/workflow-manifest.json`',
      '`references/workflow-readme.md`',
    ]) assert.ok(skill.includes(reference), `${id}: ${reference}`);
    assert.match(skill, /~\/\.threadify-workflows\/current\/cli\/bin\/threadify-workflows\.mjs/, id);
  }
});

test('adapter onboarding starts locally and labels native proof honestly', () => {
  for (const adapter of ['codex', 'claude', 'cursor', 'gemini', 'hermes', 'openclaw', 'generic-mcp']) {
    const body = read(`adapters/${adapter}/README.md`);
    assert.ok(body.includes('[Threadify-001](../../docs/threadify-001.md)'), adapter);
    assert.match(body, /local/i, adapter);
    assert.doesNotMatch(body, /ask the opening provider-choice question|Would you like help starting/, adapter);
  }
  for (const adapter of ['codex', 'claude']) {
    assert.match(read(`adapters/${adapter}/README.md`), /still pending/i, adapter);
  }
  for (const adapter of ['cursor', 'gemini', 'hermes', 'openclaw']) {
    assert.match(read(`adapters/${adapter}/README.md`), /structural guidance/i, adapter);
  }
});

test('glossary and architecture decisions stay in their intended docs', () => {
  assert.match(read('CONTEXT.md'), /^## Glossary$/m);
  const adrRoot = new URL('docs/adr/', root);
  assert.deepEqual(fs.readdirSync(adrRoot).sort(), [
    '0001-local-state-and-hosted-services.md',
    '0002-manifest-registry-compatibility.md',
  ]);
  for (const file of ['docs/getting-started.md', 'docs/threadify-001.md', 'docs/buyer-capability-gaps.md']) {
    assert.doesNotMatch(read(file), /^## Glossary$/m, file);
  }
});

test('buyer workflow links and generated reference targets resolve', () => {
  for (const id of buyerIds) {
    for (const file of [`workflows/${id}/README.md`, `plugins/threadify/skills/threadify-${id}/SKILL.md`]) {
      const directory = path.dirname(file);
      for (const match of read(file).matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
        if (/^(https?:|#)/.test(match[1])) continue;
        assert.ok(fs.existsSync(new URL(path.join(directory, match[1]), root)), `${file}: ${match[1]}`);
      }
    }
  }
});
