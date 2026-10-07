// Static contracts for the three hand-written listed skills (threadify-app#235 and #236): the tools each one
// names, in order, against the tool snapshot. Nothing here calls the server.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContract } from '../preflight.mjs';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const packageSkills = fileURLToPath(new URL('../package/threadify/skills', import.meta.url));
const contract = loadContract();
const skillText = (name) => fs.readFileSync(path.join(packageSkills, name, 'SKILL.md'), 'utf8');

// Backticked tool names in order of first mention. Some tools are one word, such as `remember`.
export function toolSequence(text) {
  const seen = [];
  for (const [, word] of text.matchAll(/`([a-z][a-z0-9]*(?:_[a-z0-9]+)*)`/g)) {
    if (contract.tools.has(word) && !seen.includes(word)) seen.push(word);
  }
  return seen;
}

// Returns the problems with a skill's text. `before` pairs: the first tool must be named before the second.
export function checkSkillContract(text, { tools, before = [], forbidden = [], needs = [] }) {
  const problems = [];
  const sequence = toolSequence(text);
  for (const [, word] of text.matchAll(/`([a-z][a-z0-9]*(?:_[a-z0-9]+)+)`/g)) {
    if (!contract.tools.has(word) && !contract.parameters.has(word) && !contract.terms.has(word)) problems.push(`unknown tool: ${word}`);
  }
  for (const name of sequence) if (!tools.includes(name)) problems.push(`tool outside the contract: ${name}`);
  for (const name of tools) if (!sequence.includes(name)) problems.push(`contract tool never named: ${name}`);
  for (const [first, second] of before) {
    const a = sequence.indexOf(first);
    const b = sequence.indexOf(second);
    if (a === -1 || b === -1 || a > b) problems.push(`${first} must come before ${second}`);
  }
  for (const name of forbidden) if (new RegExp(`\\b${name}\\b`).test(text)) problems.push(`names forbidden tool: ${name}`);
  for (const pattern of needs) if (!pattern.test(text)) problems.push(`missing: ${pattern}`);
  return problems;
}

const USER_FIRST = /person's own instructions come first/;
const NO_FILES = /Keep no notes in files and run no programs or local pages/;
const SEND_TOOLS = ['send_reply', 'send_replies', 'send_social_reply'];

const CONTRACTS = {
  'threadify-get-set-up': {
    tools: [
      'get_connection_defaults', 'get_brain_overview', 'list_drafts', 'list_scheduled_posts', 'greatest_hits',
      'read_post_performance', 'update_persona', 'remember', 'ingest_brain_source', 'query_brain', 'generate_content',
      'get_draft', 'edit_draft', 'best_time_to_post', 'validate_post', 'review_post', 'schedule_post', 'get_schedule_status',
    ],
    before: [['get_connection_defaults', 'get_brain_overview'], ['validate_post', 'review_post'], ['review_post', 'schedule_post'], ['schedule_post', 'get_schedule_status']],
    forbidden: ['publish_now', ...SEND_TOOLS, 'review_reply', 'set_automation_preference', 'create_offer', 'list_offers'],
    needs: [USER_FIRST, NO_FILES, /`account-not-ready`/, /Finish setting up your Threadify account at threadify\.app, then say continue\./, /`approval`/, /Silence is never a yes/, /tomorrow at 9am/, /two rounds of `edit_draft`/],
  },
  'threadify-inbound-replies': {
    tools: [
      'get_connection_defaults', 'list_comments', 'list_mentions', 'list_social_inbox', 'generate_replies',
      'generate_social_reply', 'review_reply', ...SEND_TOOLS, 'update_inbox_item',
    ],
    before: [['list_comments', 'review_reply'], ['list_mentions', 'review_reply'], ...SEND_TOOLS.map((tool) => ['review_reply', tool]), ['send_reply', 'update_inbox_item']],
    forbidden: ['publish_now', 'schedule_post', 'review_post', 'set_automation_preference', 'update_reply_settings'],
    needs: [USER_FIRST, NO_FILES, /`approval`/, /word for word/, /Silence is never a yes/, /One reply's approval cannot send a batch/, ...SEND_TOOLS.map((tool) => new RegExp(`tool: "${tool}"`))],
  },
  'threadify-create-my-week': {
    tools: [
      'get_connection_defaults', 'get_brain_overview', 'list_scheduled_posts', 'best_time_to_post', 'list_drafts',
      'generate_content', 'get_draft', 'edit_draft', 'validate_post', 'review_post', 'schedule_post', 'get_schedule_status',
    ],
    before: [['list_scheduled_posts', 'generate_content'], ['best_time_to_post', 'generate_content'], ['generate_content', 'review_post'], ['review_post', 'schedule_post'], ['schedule_post', 'get_schedule_status']],
    forbidden: ['publish_now', ...SEND_TOOLS, 'set_automation_preference', 'create_offer'],
    needs: [USER_FIRST, NO_FILES, /`approval`/, /Silence is never a yes/, /Posts without a yes stay as drafts/],
  },
};

for (const [name, rules] of Object.entries(CONTRACTS)) {
  test(`${name} names only snapshot tools, in the reviewed order, and nothing it must not`, () => {
    assert.deepEqual(checkSkillContract(skillText(name), rules), []);
  });
}

test('get set up reaches a first scheduled post in about 12 calls on the happy path', () => {
  // A new account with no history: defaults, three readbacks, persona, remember, query, generate, get draft,
  // calendar, best time, validate, review, schedule, status. Optional branches (greatest hits, pasted writing,
  // edit rounds) add calls only when the person needs them.
  const optional = new Set(['greatest_hits', 'read_post_performance', 'ingest_brain_source', 'edit_draft']);
  const happy = toolSequence(skillText('threadify-get-set-up')).filter((tool) => !optional.has(tool));
  assert.ok(happy.length >= 12 && happy.length <= 15, `${happy.length} calls: ${happy.join(', ')}`);
});

test('the three rewritten skills have distinct descriptions that name a Threads intent', () => {
  const descriptions = Object.keys(CONTRACTS).map((name) => /^description: (.*)$/m.exec(skillText(name))[1]);
  assert.equal(new Set(descriptions).size, descriptions.length);
  for (const description of descriptions) assert.match(description, /Use when the person asks to [^"]*Threads/);
});

// Red cases: the checker itself catches each fault.
test('the contract check catches scheduling before review, a forbidden tool, an unknown tool and a missing step', () => {
  const rules = { tools: ['review_post', 'schedule_post'], before: [['review_post', 'schedule_post']], forbidden: ['publish_now'], needs: [/`approval`/] };
  assert.deepEqual(checkSkillContract('Call `review_post`, then `schedule_post` with the `approval`.', rules), []);
  assert.deepEqual(checkSkillContract('Call `schedule_post`, then `review_post` with the `approval`.', rules), ['review_post must come before schedule_post']);
  assert.deepEqual(checkSkillContract('Call `review_post`, `schedule_post` with the `approval`, or publish_now.', rules), ['names forbidden tool: publish_now']);
  assert.deepEqual(checkSkillContract('Call `review_post`, `open_editor`, `schedule_post` with the `approval`.', rules), ['unknown tool: open_editor']);
  assert.deepEqual(checkSkillContract('Call `review_post`, `schedule_post`, `list_drafts` with the `approval`.', rules), ['tool outside the contract: list_drafts']);
  assert.deepEqual(checkSkillContract('Call `schedule_post` with the `approval`.', rules), ['contract tool never named: review_post', 'review_post must come before schedule_post']);
  assert.deepEqual(checkSkillContract('Call `review_post`, then `schedule_post`.', rules), ['missing: /`approval`/']);
});

test('the upstream self-installed skills fail these contracts, which is why the listed edition rewrites them', () => {
  for (const name of Object.keys(CONTRACTS)) {
    const upstream = fs.readFileSync(path.join(repoRoot, 'skills', name, 'SKILL.md'), 'utf8');
    assert.notDeepEqual(checkSkillContract(upstream, CONTRACTS[name]), [], name);
  }
});
