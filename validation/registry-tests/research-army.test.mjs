import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { describeWorkflow, loadWorkflowRegistry } from '../../lib/workflow-registry.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const source = path.join(root, 'plugins/threadify/skills/threadify-research-army/SKILL.md');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'workflows/research-army/manifest.json'), 'utf8'));

test('Research Army registers its schedule tools and never publishes now', () => {
  const workflow = describeWorkflow(loadWorkflowRegistry({ root }), 'research-army');
  assert.equal(workflow.skill_name, 'threadify-research-army');
  assert.equal(workflow.title, 'Research Army');
  for (const tool of ['get_connection_defaults', 'generate_content', 'best_time_to_post', 'validate_post', 'schedule_post', 'get_schedule_status', 'list_scheduled_posts']) {
    assert.ok(workflow.required_mcp_tools.includes(tool), `needs ${tool}`);
  }
  for (const tool of ['publish_now', 'send_reply', 'edit_draft', 'reschedule_post', 'cancel_schedule']) {
    assert.ok(![...workflow.required_mcp_tools, ...workflow.optional_mcp_tools].includes(tool), `must not use ${tool}`);
  }
  assert.ok(manifest.triggers.includes('research army'));
  assert.equal(manifest.approval_gate.required, true);
  assert.ok(manifest.receipt.must_prove.includes('Bash audit for both sides (offered and used)'));
  assert.ok(manifest.receipt.must_prove.includes('fallback state'));
});

test('Research Army keeps the race fair, the label honest and scheduling behind one exact yes', () => {
  const skill = fs.readFileSync(source, 'utf8');
  const post = fs.readFileSync(path.join(path.dirname(source), 'references/post.md'), 'utf8');
  assert.match(skill, /Get a research post on your niche\./);
  assert.match(skill, /Haiku 5\.5 agents and one Opus 5\.5/);
  assert.match(skill, /Call `get_connection_defaults` first/);
  assert.match(skill, /most-liked recent Threads posts from K keyword searches \(last 30 days\)/);
  assert.match(skill, /Never say "most viewed"/);
  assert.match(skill, /--disallowedTools Bash/);
  assert.match(skill, /bash_uses: 0/);
  assert.match(skill, /The checker owns the tests/);
  assert.match(skill, /most backed claims, then lower cost, then faster/);
  assert.match(skill, /Never change the brief, the prompts or the catalog to favour either side/);
  assert.match(skill, /scrapecreators-key\.mjs/);
  assert.match(skill, /references\/demo-feedback-rules\.md/);
  assert.match(skill, /owner-overlay\.md/);
  assert.match(skill, /research-army\.mjs/);
  assert.doesNotMatch(skill, /`publish_now`/);
  assert.match(post, /Never call `publish_now`/);
  assert.match(post, /Only on an exact "yes"/);
  assert.match(post, /Never reword it/);
  assert.match(post, /casing-guard\.mjs/);
  assert.match(post, /Done editing/);
  assert.match(post, /`get_schedule_status`/);
  assert.match(post, /winner's backed findings/);
  assert.match(post, /check-post/);
  assert.match(post, /delay_minutes: 50/);
  assert.match(post, /never create, rename or duplicate an offer for a run/);
  assert.match(post, /"auto_plugs": <true with an offer/);
  assert.match(post, /stored Auto Plug content, trigger and delay/);
  assert.match(post, /tier-blocked/);
  assert.match(post, /open -a "Google Chrome"/);
  assert.match(skill, /open -a "Google Chrome"/);
});
