import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { describeWorkflow, loadWorkflowRegistry } from '../../lib/workflow-registry.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const skill = fs.readFileSync(path.join(root, 'plugins/threadify/skills/threadify-watch-any-creator/SKILL.md'), 'utf8');
const bundle = path.join(root, 'skills/threadify-watch-any-creator');

test('Watch Any Creator registers released Threadify tools only and never publishes now', () => {
  const workflow = describeWorkflow(loadWorkflowRegistry({ root }), 'watch-any-creator');
  assert.equal(workflow.skill_name, 'threadify-watch-any-creator');
  assert.deepEqual(workflow.required_mcp_tools, [
    'get_connection_defaults',
    'generate_content',
    'get_draft',
    'validate_post',
    'best_time_to_post',
    'list_scheduled_posts',
    'schedule_post',
    'get_schedule_status',
  ]);
  assert.deepEqual(workflow.optional_mcp_tools, ['save_draft', 'list_offers']);
  for (const tool of ['publish_now', 'edit_draft', 'cancel_schedule', 'reschedule_post', 'send_reply']) {
    assert.ok(![...workflow.required_mcp_tools, ...workflow.optional_mcp_tools].includes(tool), `must not use ${tool}`);
    if (tool !== 'edit_draft') assert.ok(!skill.includes(tool), `skill must not mention ${tool}`);
  }
});

test('the skill bundle carries the forensics engine it reuses', () => {
  for (const file of ['SKILL.md', 'scripts/watch-any-creator.mjs', 'scripts/ai-content-forensics.mjs', 'scripts/watch-card.mjs', 'scripts/casing-guard.mjs', 'references/corpus-layout.md', 'references/workflow-manifest.json']) {
    assert.ok(fs.existsSync(path.join(bundle, file)), `bundle has ${file}`);
  }
  assert.equal(fs.readFileSync(path.join(bundle, 'scripts/ai-content-forensics.mjs'), 'utf8'), fs.readFileSync(path.join(root, 'lib/ai-content-forensics.mjs'), 'utf8'));
  assert.match(fs.readFileSync(path.join(bundle, 'scripts/watch-any-creator.mjs'), 'utf8'), /from '\.\/ai-content-forensics\.mjs'/);
});

test('the skill states its gates in plain words', () => {
  assert.match(skill, /Never hand-write or reword copy\. Never use `edit_draft`\./);
  assert.match(skill, /`lower\(original\) == lower\(final\)` must be true/);
  assert.match(skill, /Transcripts stay on this computer\. Never paste, post or share a transcript\. Quotes are twelve words at most\./);
  assert.match(skill, /at least 20 videos on each side inside one format family/);
  assert.match(skill, /Before any paid ScrapeCreators call, show the call and credit estimate and wait for "yes"/);
  assert.match(skill, /Never schedule the thread\. Never publish now\./);
  assert.match(skill, /Proceed only on the exact reply "yes"/);
  assert.match(skill, /`contentType: "long-form"`/);
  assert.match(skill, /`contentType: "short-form"`/);
  assert.match(skill, /`get_schedule_status`/);
  assert.match(skill, /Say "scheduled", never "posted"/);
  const steps = skill.match(/^\d+\. \*\*/gm) ?? [];
  assert.equal(steps.length, 9, 'nine numbered visible steps');
  const userFacing = skill.replace(/```[\s\S]*?```/g, '');
  for (const hedge of [/\bmight\b/i, /\bmaybe\b/i, /\bperhaps\b/i, /\bprobably\b/i, /\bpossibly\b/i, /\bit depends\b/i, /\bconsider\b/i]) {
    assert.doesNotMatch(userFacing, hedge);
  }
});
