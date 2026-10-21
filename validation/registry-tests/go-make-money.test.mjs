import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { describeWorkflow, loadWorkflowRegistry } from '../../lib/workflow-registry.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const source = path.join(root, 'plugins/threadify/skills/threadify-go-make-money/SKILL.md');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'workflows/go-make-money/manifest.json'), 'utf8'));

test('Go Make Money registers its read, offer and schedule tools and never publishes now', () => {
  const workflow = describeWorkflow(loadWorkflowRegistry({ root }), 'go-make-money');
  assert.equal(workflow.skill_name, 'threadify-go-make-money');
  assert.equal(workflow.title, 'Go Make Money');
  for (const tool of ['get_connection_defaults', 'read_post_performance', 'read_link_attribution', 'get_growth_signal', 'list_offers', 'generate_content', 'best_time_to_post', 'schedule_post', 'get_schedule_status']) {
    assert.ok(workflow.required_mcp_tools.includes(tool), `needs ${tool}`);
  }
  for (const tool of ['update_offer', 'create_offer', 'read_conversion_setup', 'check_conversion_tracking']) assert.ok(workflow.optional_mcp_tools.includes(tool), `may use ${tool}`);
  for (const tool of ['publish_now', 'send_reply', 'edit_draft', 'reschedule_post', 'cancel_schedule', 'delete_offer']) {
    assert.ok(![...workflow.required_mcp_tools, ...workflow.optional_mcp_tools].includes(tool), `must not use ${tool}`);
  }
  assert.ok(manifest.triggers.includes('go make money'));
  assert.equal(manifest.approval_gate.required, true);
  assert.ok(manifest.receipt.must_prove.includes('judge label, model and verdict'));
  assert.ok(manifest.receipt.must_prove.includes('fallback state'));
});

test('Go Make Money keeps numbers raw, unknowns unknown, the judge outside and the fix behind one exact yes', () => {
  const skill = fs.readFileSync(source, 'utf8');
  const fix = fs.readFileSync(path.join(path.dirname(source), 'references/fix.md'), 'utf8');
  assert.match(skill, /Call `get_connection_defaults` first/);
  assert.match(skill, /go make money: get me to <N> paying <customers\/members> by <date>/);
  assert.match(skill, /required_net_new_per_week = ceil\(\(goal - current\) \/ weeks_left\)/);
  assert.match(skill, /needs real baseline/);
  assert.match(skill, /Raw rows, never summaries/);
  assert.match(skill, /Why do you think this happens\?/);
  assert.match(skill, /codex exec -s read-only/);
  assert.match(skill, /fresh Claude instance with no prior context/);
  assert.match(skill, /never hide it/);
  assert.match(skill, /short seller/);
  assert.match(skill, /impact on paid conversion x speed x reversibility/);
  assert.match(skill, /~\/\.threadify\/go-make-money\/ledger\.json/);
  assert.match(skill, /read the ledger first/);
  assert.match(skill, /references\/demo-feedback-rules\.md/);
  assert.match(skill, /owner-overlay\.md/);
  assert.match(skill, /Never merge a pull request/);
  assert.match(skill, /signup names or emails/);
  assert.match(skill, /open -a "Google Chrome"/);
  assert.match(skill, /Never create a new offer per run/);
  assert.match(skill, /Here's what I'll do, in this order, and why\. OK\?/);
  assert.match(skill, /Never route around it/);
  assert.match(skill, /Print every post and Auto Plug in full/);
  assert.match(skill, /turn the WHOLE post into a template/);
  assert.match(skill, /`celebrate --dir <run>`/);
  assert.match(skill, /`create_scheduled_task` with `fireAt`/);
  assert.match(skill, /Star|star for Threadify Workflows on GitHub/);
  assert.doesNotMatch(skill, /`publish_now`/);
  assert.match(fix, /Never create a new offer per run/);
  assert.match(fix, /--channel site/);
  assert.match(fix, /Never call `publish_now`/);
  assert.match(fix, /Never merge a pull request/);
  assert.match(fix, /lower\(original\) == lower\(final\)/);
  assert.match(fix, /delay_minutes: 50/);
  assert.match(fix, /gh pr create/);
  assert.match(fix, /tier-blocked/);
  assert.match(fix, /`get_schedule_status`/);
  for (const text of [skill, fix]) assert.doesNotMatch(text, /—/, 'no em dashes in user-facing text');
});

test('Go Make Money README carries a working install line (the installer takes --workflows all only)', () => {
  const readme = fs.readFileSync(path.join(root, 'workflows/go-make-money/README.md'), 'utf8');
  const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  const line = readme.match(/npx --yes github:lennoxsaint\/Threadify-workflows#v(\S+) install --version (\S+) --workflows (\S+) --targets \S+ --disable-auto-update/);
  assert.ok(line, 'README has the install line');
  assert.equal(line[1], version);
  assert.equal(line[2], version);
  assert.equal(line[3], 'all');
  assert.match(readme, /--workflows go-make-money` is not supported/);
});
