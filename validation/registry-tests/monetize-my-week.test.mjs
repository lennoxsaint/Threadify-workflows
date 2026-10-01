import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { describeWorkflow, loadWorkflowRegistry } from '../../lib/workflow-registry.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const source = path.join(root, 'plugins/threadify/skills/threadify-monetize-my-week/SKILL.md');

test('Monetize My Week registers a seven-post unchanged-copy campaign', () => {
  const workflow = describeWorkflow(loadWorkflowRegistry({ root }), 'monetize-my-week');
  assert.equal(workflow.skill_name, 'threadify-monetize-my-week');
  assert.ok(workflow.required_mcp_tools.includes('list_drafts'));
  assert.ok(workflow.required_mcp_tools.includes('schedule_post'));
  assert.ok(workflow.optional_mcp_tools.includes('read_link_attribution'));

  const skill = fs.readFileSync(source, 'utf8');
  assert.match(skill, /exactly seven unposted drafts/i);
  assert.match(skill, /Leave every selected draft's post text, thread parts and media unchanged/i);
  assert.match(skill, /delay_minutes: 50/);
  assert.match(skill, /Say “attributed,” not “caused.”/);
  assert.match(skill, /Never create a fresh key to force a duplicate/);
  assert.doesNotMatch(skill, /guaranteed sales|guarantee sales/i);
});
