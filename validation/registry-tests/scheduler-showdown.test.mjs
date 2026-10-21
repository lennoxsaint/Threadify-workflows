import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { describeWorkflow, loadWorkflowRegistry } from '../../lib/workflow-registry.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const source = path.join(root, 'plugins/threadify/skills/threadify-scheduler-showdown/SKILL.md');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'workflows/scheduler-showdown/manifest.json'), 'utf8'));

test('Scheduler Showdown registers its read, schedule and cleanup tools and never publishes now', () => {
  const workflow = describeWorkflow(loadWorkflowRegistry({ root }), 'scheduler-showdown');
  assert.equal(workflow.skill_name, 'threadify-scheduler-showdown');
  assert.equal(workflow.title, 'Scheduler Showdown');
  for (const tool of ['get_connection_defaults', 'read_post_performance', 'generate_content', 'best_time_to_post', 'list_offers', 'schedule_post', 'get_schedule_status', 'cancel_schedule', 'read_link_attribution']) {
    assert.ok(workflow.required_mcp_tools.includes(tool), `needs ${tool}`);
  }
  for (const tool of ['publish_now', 'send_reply', 'create_offer', 'update_offer', 'reschedule_post']) {
    assert.ok(![...workflow.required_mcp_tools, ...(workflow.optional_mcp_tools ?? [])].includes(tool), `must not use ${tool}`);
  }
  assert.ok(manifest.triggers.includes('scheduler showdown'));
  assert.equal(manifest.approval_gate.required, true);
  assert.ok(manifest.receipt.must_prove.includes('key sha256 sealed before judging'));
  assert.ok(manifest.receipt.must_prove.includes('scorecard with price, free plan and networks rows'));
});

test('Scheduler Showdown keeps the honesty contract: disclosure, locked rules, blind outside judge, losses shown', () => {
  const skill = fs.readFileSync(source, 'utf8');
  assert.match(skill, /Threadify Workflows are made by Threadify's founder, so this test is built to be checked, not trusted\./);
  assert.match(skill, /BEFORE the first tool call/);
  assert.match(skill, /word for word/);
  assert.match(skill, /no AI connection connected/);
  assert.match(skill, /codex exec -s read-only/);
  assert.match(skill, /fresh Claude instance/);
  assert.match(skill, /price, free plan and networks/);
  assert.match(skill, /Never hide a row Threadify loses/);
  assert.match(skill, /60 days out/);
  assert.match(skill, /Never create, rename or duplicate an offer/);
  assert.match(skill, /Never route around a host gate/);
  assert.match(skill, /lowercase-guard/);
  assert.match(skill, /`get_schedule_status`/);
  assert.match(skill, /not found/);
  assert.match(skill, /references\/demo-feedback-rules\.md/);
  assert.match(skill, /references\/rules\.md/);
  for (const command of ['rules', 'record', 'anonymise', 'judge-prompt', 'scorecard', 'unblind', 'lowercase-guard', 'report']) {
    assert.match(skill, new RegExp(`${command} --`), `SKILL uses ${command}`);
  }
  for (const url of ['mcp.buffer.com/mcp', 'mcp.typefully.com/mcp', 'mcp.eden.so/mcp', 'blacktwist.app/api/mcp']) assert.ok(skill.includes(url));
  assert.doesNotMatch(skill, /`publish_now`/);
  assert.doesNotMatch(skill, /—/, 'no em dashes in user-facing text');
});

test('Scheduler Showdown README carries a working install line (the installer takes --workflows all only)', () => {
  const readme = fs.readFileSync(path.join(root, 'workflows/scheduler-showdown/README.md'), 'utf8');
  const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  const line = readme.match(/npx --yes github:lennoxsaint\/Threadify-workflows#v(\S+) install --version (\S+) --workflows (\S+) --targets \S+ --disable-auto-update/);
  assert.ok(line, 'README has the install line');
  assert.equal(line[1], version);
  assert.equal(line[2], version);
  assert.equal(line[3], 'all');
  assert.match(readme, /\/threadify-scheduler-showdown/);
  assert.doesNotMatch(readme, /—/);
});
