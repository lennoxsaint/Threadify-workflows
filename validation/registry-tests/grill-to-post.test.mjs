import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { describeWorkflow, loadWorkflowRegistry } from '../../lib/workflow-registry.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const sourceDir = path.join(root, 'plugins/threadify/skills/threadify-grill-to-post');

function readAll(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? readAll(full) : [[full, fs.readFileSync(full, 'utf8')]];
  });
}

test('Grill To Post registers as a connection-optional workflow that cannot publish', () => {
  const workflow = describeWorkflow(loadWorkflowRegistry({ root }), 'grill-to-post');
  assert.equal(workflow.skill_name, 'threadify-grill-to-post');
  assert.deepEqual(workflow.required_mcp_tools, []);
  for (const tool of ['greatest_hits', 'generate_content', 'edit_draft', 'validate_post', 'list_scheduled_posts', 'schedule_post']) {
    assert.ok(workflow.optional_mcp_tools.includes(tool), `missing optional tool ${tool}`);
  }
  assert.ok(!workflow.optional_mcp_tools.includes('publish_now'));
});

test('Grill To Post questions first and leaves the writing to Threadify', () => {
  const skill = fs.readFileSync(path.join(sourceDir, 'SKILL.md'), 'utf8');
  assert.match(skill, /numbered rounds/);
  assert.match(skill, /your recommended answer on each one/);
  assert.match(skill, /Decisions are the creator's/);
  assert.match(skill, /Do not write post copy in this step/);
  assert.match(skill, /Threadify writes the posts\. You do not\./);
  assert.match(skill, /`longFormType: "synthesizer"`/);
  assert.match(skill, /`shortFormType: "listicle"`/);
  assert.match(skill, /`shortFormType: "one-liner"`/);
  assert.match(skill, /Show all three outputs exactly as returned/);
  assert.match(skill, /Never retype post text by hand/);
  assert.match(skill, /`greatest_hits` with `metric: "views"`/);
  assert.match(skill, /`include_full_text: true`/);
});

test('Grill To Post checks claims and gates scheduling on one exact packet', () => {
  const skill = fs.readFileSync(path.join(sourceDir, 'SKILL.md'), 'utf8');
  assert.match(skill, /Flag anything you cannot match/);
  assert.match(skill, /Unknown stays unknown/);
  assert.match(skill, /After every `edit_draft`, read the changed text and check it again/);
  assert.match(skill, /Connection is not permission/);
  assert.match(skill, /Ask for approval of that exact packet/);
  assert.match(skill, /what auto-repost will do/);
  assert.match(skill, /Never schedule twice/);
  assert.match(skill, /A scheduled post is not a published post/);
  assert.match(skill, /Never publish immediately/);
  assert.match(skill, /Say only the account/);
  assert.match(skill, /Never read the connection's timezone out as fact/);
  assert.match(skill, /Do not write the posts yourself as a substitute/);
  assert.doesNotMatch(skill, /guaranteed|guarantee/i);
});

test('Grill To Post shares the Threads Teach mission file and does not start other workflows', () => {
  const skill = fs.readFileSync(path.join(sourceDir, 'SKILL.md'), 'utf8');
  assert.match(skill, /one-time setup/);
  assert.match(skill, /Do not ask a question that is already answered/);
  assert.match(skill, /do not run Offer Builder/);
  assert.match(skill, /Do not start it for them/);
  const mission = fs.readFileSync(path.join(sourceDir, 'references/mission-format.md'), 'utf8');
  assert.match(mission, /Status: draft \| confirmed/);
  assert.match(mission, /Never replace an existing mission without asking/);
});

test('Grill To Post routes exact wording away from AI edits and blocks delivery on a capability gap', () => {
  const skill = fs.readFileSync(path.join(sourceDir, 'SKILL.md'), 'utf8');
  const edits = skill.split('## 6. First-line options')[1].split('## 7.')[0];
  assert.match(edits, /Do not use `edit_draft` for exact wording/);
  assert.match(edits, /schema explicitly supports verbatim replacement on the same `draft_id`/);
  assert.match(edits, /run `verify-draft` against the saved expected draft/);
  assert.match(edits, /every part and media/);
  assert.match(edits, /keep the selection and expected draft local/);
  assert.match(edits, /Block scheduling of the affected draft/);
  assert.match(skill, /An exact wording request uses the deterministic edit path in step 6/);
});

test('Grill To Post requires durable attempts before dispatch and reconciles accepted but lost responses', () => {
  const skill = fs.readFileSync(path.join(sourceDir, 'SKILL.md'), 'utf8');
  const protocol = fs.readFileSync(path.join(sourceDir, 'references/delivery-safety.md'), 'utf8');
  assert.match(skill, /Before any dispatch/);
  assert.match(skill, /call `begin` to durably persist/);
  assert.match(skill, /Only a successful `next_action: dispatch` permits one `schedule_post` call/);
  assert.match(skill, /A persistence error blocks the call/);
  assert.match(skill, /load the same saved packet and delivery directory/);
  assert.match(skill, /reconcile that same attempt before retrying/);
  assert.match(skill, /Never create a new key or directory/);
  assert.match(protocol, /accepted a row but the response was lost/);
  assert.match(protocol, /without a second scheduling call/);
  assert.match(protocol, /An empty calendar alone is also unknown/);
  assert.match(protocol, /Leave confirmed sibling rows intact/);
});

test('Grill To Post credits the adapted question method and carries its licence notice', () => {
  const attribution = fs.readFileSync(path.join(sourceDir, 'references/ATTRIBUTION.md'), 'utf8');
  assert.match(attribution, /github\.com\/mattpocock\/skills/);
  assert.match(attribution, /Copyright \(c\) 2026 Matt Pocock/);
  assert.match(attribution, /Permission is hereby granted, free of charge/);
  assert.match(attribution, /did not write, review or endorse/);
});

test('Grill To Post keeps held-back material and long dashes out of the public bundle', () => {
  const heldBack = /hookbook|viral vault|growth operating system|attribution model|experiment ledger|daily growth brief|skool|full circle|saints college|brand doctrine/i;
  for (const [file, text] of readAll(sourceDir)) {
    const relative = path.relative(root, file);
    assert.doesNotMatch(text, heldBack, `${relative} names held-back material`);
    assert.doesNotMatch(text, /—/, `${relative} contains an em dash`);
  }
});
