import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { describeWorkflow, loadWorkflowRegistry } from '../../lib/workflow-registry.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const sourceDir = path.join(root, 'plugins/threadify/skills/threadify-threads-teach');
const frameworksDir = path.join(sourceDir, 'references/frameworks');

function readAll(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? readAll(full) : [[full, fs.readFileSync(full, 'utf8')]];
  });
}

test('Threads Teach registers as a connection-optional teaching workflow', () => {
  const workflow = describeWorkflow(loadWorkflowRegistry({ root }), 'threads-teach');
  assert.equal(workflow.skill_name, 'threadify-threads-teach');
  assert.deepEqual(workflow.required_mcp_tools, []);
  for (const tool of ['greatest_hits', 'read_post_performance', 'get_growth_signal', 'save_draft', 'get_draft', 'schedule_post']) {
    assert.ok(workflow.optional_mcp_tools.includes(tool), `missing optional tool ${tool}`);
  }
  assert.ok(!workflow.optional_mcp_tools.includes('publish_now'));
});

test('Threads Teach coaches, keeps state and gates every write on exact approval', () => {
  const skill = fs.readFileSync(path.join(sourceDir, 'SKILL.md'), 'utf8');
  assert.match(skill, /You do not write the learner's lesson post for them/);
  assert.match(skill, /MISSION\.md/);
  assert.match(skill, /learning-records\//);
  assert.match(skill, /retrieval practice/i);
  assert.match(skill, /Connection is not permission/);
  assert.match(skill, /Approval to save is not approval to schedule/);
  assert.match(skill, /Never schedule twice/);
  assert.match(skill, /A scheduled post is not a published post/);
  assert.match(skill, /Say plainly what you cannot see/);
  assert.match(skill, /Never publish immediately/);
  assert.match(skill, /utm_source=threads_teach&utm_medium=skill&utm_campaign=proof_loops&utm_content=threadify_038/);
  assert.doesNotMatch(skill, /guaranteed|guarantee/i);
});

test('Threads Teach picks example posts by stated rules and keeps connection details private', () => {
  const skill = fs.readFileSync(path.join(sourceDir, 'SKILL.md'), 'utf8');
  assert.match(skill, /`greatest_hits` with `metric: "views"`/);
  assert.match(skill, /Never call it without a metric/);
  assert.match(skill, /at least 7 days old/);
  assert.match(skill, /at least 100 views/);
  assert.match(skill, /recorded views are higher than its likes/);
  assert.match(skill, /`include_full_text: true`/);
  assert.match(skill, /at least 3 days old/);
  assert.match(skill, /Do not call it their worst post/);
  assert.match(skill, /Never read the connection's timezone out as fact/);
  assert.match(skill, /Say only the account/);
  assert.match(skill, /not their reply instructions, other connected accounts/);
  assert.match(skill, /`get_draft`/);
  assert.match(skill, /Read whichever of these exist/);
});

test('Threads Teach mission setup is one-time, resumable and does not start other workflows', () => {
  const skill = fs.readFileSync(path.join(sourceDir, 'SKILL.md'), 'utf8');
  assert.match(skill, /one-time setup/);
  assert.match(skill, /`Status: draft`/);
  assert.match(skill, /Do not ask a question that is already answered/);
  assert.match(skill, /do not run Offer Builder/);
  assert.match(skill, /Before the learner has taken lesson 7, you run the five questions yourself/);
  const formats = fs.readFileSync(path.join(sourceDir, 'references/workspace-formats.md'), 'utf8');
  assert.match(formats, /Status: draft \| confirmed/);
  const notes = fs.readdirSync(frameworksDir).map((name) => fs.readFileSync(path.join(frameworksDir, name), 'utf8')).join('\n');
  assert.doesNotMatch(notes, /`greatest_hits`(?! \(`metric: "views"`\))/);
  assert.doesNotMatch(notes, /`read_post_performance`(?! \(`include_full_text: true`\))/);
});

test('Threads Teach ships ten framework notes with the four required parts', () => {
  const notes = fs.readdirSync(frameworksDir).filter((name) => name.endsWith('.md')).sort();
  assert.equal(notes.length, 10);
  for (const name of notes) {
    const note = fs.readFileSync(path.join(frameworksDir, name), 'utf8');
    for (const heading of ['## Principle', '## Worked example', '## Common mistake', '## Practice task', '## Lesson post']) {
      assert.ok(note.includes(heading), `${name} missing ${heading}`);
    }
    assert.match(note, /real posts? by @lennox_saint, quoted exactly/i, `${name} must source its example`);
    assert.match(note, /Published \d{1,2} [A-Z][a-z]+ 20\d\d/, `${name} must date its example`);
  }
});

test('Threads Teach credits the adapted teaching method and carries its licence notice', () => {
  const attribution = fs.readFileSync(path.join(sourceDir, 'references/ATTRIBUTION.md'), 'utf8');
  assert.match(attribution, /github\.com\/mattpocock\/skills/);
  assert.match(attribution, /Copyright \(c\) 2026 Matt Pocock/);
  assert.match(attribution, /Permission is hereby granted, free of charge/);
  assert.match(attribution, /did not write, review or endorse/);
});

test('Threads Teach keeps held-back material and long dashes out of the public bundle', () => {
  const heldBack = /hookbook|viral vault|growth operating system|attribution model|experiment ledger|daily growth brief|skool|full circle|saints college|brand doctrine/i;
  for (const [file, text] of readAll(sourceDir)) {
    const relative = path.relative(root, file);
    assert.doesNotMatch(text, heldBack, `${relative} names held-back material`);
    assert.doesNotMatch(text, /—/, `${relative} contains an em dash`);
  }
});
