import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { describeWorkflow, loadWorkflowRegistry } from '../../lib/workflow-registry.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const source = path.join(root, 'plugins/threadify/skills/threadify-slop-score/SKILL.md');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'workflows/slop-score/manifest.json'), 'utf8'));

test('Slop Score registers its read, generate and schedule tools and never publishes now', () => {
  const workflow = describeWorkflow(loadWorkflowRegistry({ root }), 'slop-score');
  assert.equal(workflow.skill_name, 'threadify-slop-score');
  assert.equal(workflow.title, 'Slop Score');
  for (const tool of ['get_connection_defaults', 'read_post_performance', 'generate_content', 'list_offers', 'validate_post', 'schedule_post', 'get_schedule_status']) {
    assert.ok(workflow.required_mcp_tools.includes(tool), `needs ${tool}`);
  }
  assert.ok(workflow.optional_mcp_tools.includes('cancel_schedule'));
  for (const tool of ['publish_now', 'send_reply', 'create_offer', 'update_offer', 'delete_offer', 'edit_draft', 'reschedule_post']) {
    assert.ok(![...workflow.required_mcp_tools, ...(workflow.optional_mcp_tools ?? [])].includes(tool), `must not use ${tool}`);
  }
  assert.ok(manifest.triggers.includes('slop score'));
  assert.equal(manifest.approval_gate.required, true);
  assert.ok(manifest.receipt.must_prove.includes('shuffle seed and deck sha256'));
  assert.ok(manifest.receipt.must_prove.includes('casing guard'));
});

test('Slop Score keeps the spec: own posts, blind swipe, Unslop scorer, Threadify writes, one yes', () => {
  const skill = fs.readFileSync(source, 'utf8');
  assert.match(skill, /`read_post_performance` with `days: 30`/);
  assert.match(skill, /Never use, quote or score anyone else's posts/);
  assert.match(skill, /AI twin · plain Claude, no context/);
  assert.match(skill, /write a Threads post about <topic>/);
  assert.match(skill, /AskUserQuestion/);
  assert.match(skill, /"human" and "slop"/);
  assert.match(skill, /Never say which is which/);
  assert.match(skill, /Unslop's scorer/);
  assert.match(skill, /hedging, AI phrases, corporate voice, over-formatting/);
  assert.match(skill, /`lower\(original\) == lower\(final\)`/);
  assert.match(skill, /slop NN -> NN/);
  assert.match(skill, /Never create, rename or duplicate an offer/);
  assert.match(skill, /100 to 250 characters/);
  assert.match(skill, /no tracking tags/);
  assert.match(skill, /`validate_post`/);
  assert.match(skill, /`get_schedule_status`/);
  assert.match(skill, /`cancel_schedule`/);
  assert.match(skill, /Nothing is scheduled without it/);
  assert.match(skill, /Never route around it/);
  assert.match(skill, /never call(s)? `edit_draft`/);
  assert.match(skill, /references\/demo-feedback-rules\.md/);
  assert.match(skill, /~\/\.threadify\/owner-overlay\.md/);
  for (const command of ['candidates', 'deal', 'reveal', 'fix', 'guard', 'plug-check']) {
    assert.match(skill, new RegExp(`\`${command} --`), `SKILL uses ${command}`);
  }
  assert.doesNotMatch(skill, /`publish_now`/);
  assert.doesNotMatch(skill, /—/, 'no em dashes in user-facing text');
});

test('Slop Score README carries a working install line (the installer takes --workflows all only)', () => {
  const readme = fs.readFileSync(path.join(root, 'workflows/slop-score/README.md'), 'utf8');
  const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  const line = readme.match(/npx --yes github:lennoxsaint\/Threadify-workflows#v(\S+) install --version (\S+) --workflows (\S+) --targets \S+ --disable-auto-update/);
  assert.ok(line, 'README has the install line');
  assert.equal(line[1], version);
  assert.equal(line[2], version);
  assert.equal(line[3], 'all');
  assert.match(readme, /\/threadify-slop-score/);
  assert.doesNotMatch(readme, /—/);
});
