import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { describeWorkflow, loadWorkflowRegistry } from '../../lib/workflow-registry.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const skill = fs.readFileSync(path.join(root, 'plugins/threadify/skills/threadify-reverse-engineer-my-app/SKILL.md'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'workflows/reverse-engineer-my-app/README.md'), 'utf8');
const bundle = path.join(root, 'skills/threadify-reverse-engineer-my-app');

test('Reverse Engineer My App registers released Threadify tools only and never publishes now', () => {
  const workflow = describeWorkflow(loadWorkflowRegistry({ root }), 'reverse-engineer-my-app');
  assert.equal(workflow.skill_name, 'threadify-reverse-engineer-my-app');
  assert.deepEqual(workflow.required_mcp_tools, [
    'get_connection_defaults',
    'generate_content',
    'list_offers',
    'validate_post',
    'best_time_to_post',
    'list_scheduled_posts',
    'schedule_post',
    'get_schedule_status',
  ]);
  assert.deepEqual(workflow.optional_mcp_tools, ['get_draft', 'save_draft', 'list_viral_items', 'get_viral_item', 'list_vault_items', 'get_vault_item', 'greatest_hits']);
  for (const tool of ['publish_now', 'edit_draft', 'cancel_schedule', 'reschedule_post', 'send_reply']) {
    assert.ok(![...workflow.required_mcp_tools, ...workflow.optional_mcp_tools].includes(tool), `must not use ${tool}`);
    if (tool !== 'edit_draft') assert.ok(!skill.includes(tool), `skill must not mention ${tool}`);
  }
});

test('the skill bundle carries its scripts and references', () => {
  for (const file of ['SKILL.md', 'agents/openai.yaml', 'scripts/feature-map.mjs', 'scripts/app-card.mjs', 'scripts/casing-guard.mjs', 'references/generation-models.json', 'references/workflow-manifest.json', 'references/workflow-readme.md', 'references/threadify-001.md']) {
    assert.ok(fs.existsSync(path.join(bundle, file)), `bundle has ${file}`);
  }
});

test('the skill states its gates in plain words', () => {
  assert.match(skill, /Ask exactly: "Do you own this app, or have written permission to analyse it\?/);
  assert.match(skill, /software you own or are authorized to examine/);
  assert.match(skill, /Never analyse a third-party app/);
  assert.match(skill, /official npm package `rea-agents`, published from github\.com\/morluto\/rea/);
  assert.match(skill, /`npx rea-agents setup`/);
  assert.match(skill, /`rea analyze-web-bundle http:\/\/127\.0\.0\.1:9333 <targetId> --observation-ms 5000 --format json/);
  assert.match(skill, /fresh, empty browser profile that is signed in to nothing/);
  assert.match(skill, /Never claim anything about the app's server/);
  assert.match(skill, /Never hand-write or reword copy\. Never use `edit_draft`\./);
  assert.match(skill, /`lower\(original\) == lower\(final\)` must be true/);
  assert.match(skill, /A post may state only features and numbers from the map/);
  assert.match(skill, /Proceed only on the exact reply "yes"/);
  assert.match(skill, /`contentType: "short-form"`/);
  assert.match(skill, /`get_schedule_status`/);
  assert.match(skill, /Say "scheduled", never "posted"/);
  assert.match(skill, /Every post is built on a proven outlier template/);
  assert.match(skill, /A post is 100-350 characters and ends on one bold, clear, polarizing "so what" line/);
  assert.match(skill, /Every Auto Plug is 100-250 characters and passes the RSS test/);
  assert.match(skill, /`check-plug`/);
  assert.match(skill, /`greatest_hits` with `metric: "views"`/);
  assert.match(skill, /continue in this same run without a restart/);
  assert.match(skill, /`npx -y rea-agents analyze-web-bundle http:\/\/127\.0\.0\.1:9333 <targetId> --observation-ms 5000 --format json`/);
  assert.match(skill, /written by your agent at your request \(not Threadify\)/);
  const steps = skill.match(/^\d+\. \*\*/gm) ?? [];
  assert.equal(steps.length, 9, 'nine numbered visible steps');
  const userFacing = skill.replace(/```[\s\S]*?```/g, '');
  for (const hedge of [/\bmight\b/i, /\bmaybe\b/i, /\bperhaps\b/i, /\bprobably\b/i, /\bpossibly\b/i, /\bit depends\b/i, /\bconsider\b/i]) {
    assert.doesNotMatch(userFacing, hedge);
  }
});

test('no em dashes in the skill, the README or the scripts', () => {
  const scripts = path.join(root, 'plugins/threadify/skills/threadify-reverse-engineer-my-app/scripts');
  const texts = [skill, readme, ...fs.readdirSync(scripts).map((file) => fs.readFileSync(path.join(scripts, file), 'utf8'))];
  for (const text of texts) assert.ok(!text.includes('—'));
});
