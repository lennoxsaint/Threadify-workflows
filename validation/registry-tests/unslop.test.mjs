import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { describeWorkflow, loadWorkflowRegistry } from '../../lib/workflow-registry.mjs';
import { findHedges, gate, gatePosts, scoreText } from '../../plugins/threadify/skills/threadify-unslop/scripts/hedge_gate.mjs';
import { scorePosts, NO_VIEWS_LABEL, hedgedLine } from '../../plugins/threadify/skills/threadify-unslop/scripts/unslop-score.mjs';
import { checkPosts, lowercasePosts } from '../../plugins/threadify/skills/threadify-unslop/scripts/casing-guard.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const skillDir = path.join(root, 'plugins/threadify/skills/threadify-unslop');
const source = path.join(skillDir, 'SKILL.md');
const markersFile = path.join(skillDir, 'references/slop-markers.md');
const gateScript = path.join(skillDir, 'scripts/hedge_gate.mjs');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'workflows/unslop/manifest.json'), 'utf8'));
const read = (file) => fs.readFileSync(file, 'utf8');

test('Unslop registers the scoring, generation and schedule tools and never publishes now', () => {
  const workflow = describeWorkflow(loadWorkflowRegistry({ root }), 'unslop');
  assert.equal(workflow.skill_name, 'threadify-unslop');
  assert.equal(workflow.title, 'Threadify Unslop');
  assert.deepEqual(workflow.required_mcp_tools, [
    'get_connection_defaults',
    'read_post_performance',
    'generate_content',
    'list_offers',
    'list_scheduled_posts',
    'best_time_to_post',
    'validate_post',
    'schedule_post',
    'get_schedule_status',
  ]);
  for (const tool of ['publish_now', 'edit_draft', 'reschedule_post', 'cancel_schedule', 'save_draft']) {
    assert.ok(![...workflow.required_mcp_tools, ...workflow.optional_mcp_tools].includes(tool), `must not use ${tool}`);
  }
  assert.deepEqual(manifest.triggers, ['unslop', 'which of my posts sound like slop', 'no hedging']);
});

test('Unslop shows one exact approval packet before any scheduling', () => {
  assert.equal(manifest.approval_gate.required, true);
  assert.equal(manifest.approval_gate.type, 'explicit-final-approval');
  const skill = read(source);
  assert.match(skill, /Never publish now/);
  assert.match(skill, /Schedule only on an explicit "yes"/);
  assert.match(skill, /Never schedule without the owner's "yes" to the exact packet/);
  assert.match(skill, /schedule_post` three times/);
  assert.match(skill, /get_schedule_status`/);
  assert.match(skill, /without `draft_id`, because Threadify schedules a draft's stored text/);
  assert.match(skill, /saying only the @handle and timezone/);
  assert.match(skill, /`days: 90`/);
  assert.match(skill, /`list_offers`/);
  assert.match(skill, /Threadify links on Threads are auto-tracked, so add no UTM tags/);
  assert.match(skill, /Never print credentials/);
  assert.doesNotMatch(skill, /`publish_now`/);
});

test('Unslop states the zero-hedge rule, the override and the truth rule explicitly', () => {
  const skill = read(source);
  const markers = read(markersFile);
  assert.match(skill, /\*\*Zero hedging\.\*\* Not fewer hedges: zero\. One hedge fails a post\./);
  assert.match(skill, /overrides any other anti-slop guidance that keeps "may", cuts only "excessive" hedging or recommends uncertainty markers/);
  assert.match(skill, /A claim the owner's data does not back gets cut, not softened/);
  assert.match(skill, /scripts\/hedge_gate\.mjs/);
  assert.match(skill, /Three `generate_content` calls per post, total/);
  assert.match(skill, /The agent never edits words/);
  assert.match(skill, /`lower\(original\) == lower\(final\)` must be true/);
  assert.match(skill, /If the guard fails, show the original unchanged/);
  assert.match(skill, /Claude Opus 5\.5 when the plan allows it, Gemini as fallback/);
  assert.match(markers, /\*\*Rule: zero hedges\. Not fewer hedges\. Zero\.\*\*/);
  assert.match(markers, /overrides every other anti-slop source/);
  assert.match(markers, /gets cut, not softened/);
  assert.match(markers, /## Sources/);
  assert.match(markers, /https:\/\/en\.wikipedia\.org\/wiki\/Wikipedia:Signs_of_AI_writing/);
  assert.match(markers, /MIT License, Copyright \(c\) 2025 Siqi Chen/);
  assert.match(markers, /MIT License, Copyright \(c\) 2026 Peter Yang/);
  const models = JSON.parse(read(path.join(skillDir, 'references/generation-models.json')));
  assert.deepEqual(models.fallback_chain, ['claude-opus', 'gemini']);
  assert.equal(models.tool, 'generate_content');
});

const KNOWN_HEDGES = [
  ['This might work for you.', 'might'],
  ['You may want to post at night.', 'you may want to'],
  ['That could double your reach.', 'could'],
  ['Perhaps raw wins.', 'perhaps'],
  ['Maybe post less.', 'maybe'],
  ['This is possibly the best hook.', 'possibly'],
  ['Raw posts probably win.', 'probably'],
  ['Raw is likely better.', 'likely'],
  ['Arguably the best format.', 'arguably'],
  ['i think polish is dead.', 'i think'],
  ['I feel like polish is dead.', 'i feel like'],
  ['I believe raw wins.', 'i believe'],
  ['In my opinion raw wins.', 'in my opinion'],
  ['raw wins imo.', 'imo'],
  ["It's kind of weird.", 'kind of'],
  ['It sort of works.', 'sort of'],
  ['It is somewhat better.', 'somewhat'],
  ['It got a bit more views.', 'a bit'],
  ['It is fairly simple.', 'fairly'],
  ['That is pretty much it.', 'pretty much'],
  ['It seems polished posts lose.', 'seems'],
  ['Raw appears to win.', 'appears to'],
  ['Raw tends to win.', 'tends to'],
  ['Raw generally wins.', 'generally'],
  ['This works for some people.', 'for some people'],
  ['This is not for everyone.', 'not for everyone'],
  ['It depends on your niche.', 'it depends'],
  ['This can be useful.', 'can be'],
  ['Try posting raw for a week.', 'try'],
  ['Consider posting daily.', 'consider'],
  ['Results may vary.', 'results may vary'],
  ['I could be wrong, but raw wins.', 'i could be wrong'],
  ['To be fair, polish has fans.', 'to be fair'],
  ['Just my two cents.', 'just my two cents'],
  ['Polish is dead. On the other hand, it pays.', 'both-sides balancing'],
  ['Polish is dead. Thoughts?', 'closing question that dodges a stance'],
  ['Polish is dead. What do you think?', 'closing question that dodges a stance'],
  ['Not financial advice, but raw wins.', 'disclaimer'],
  ['Raw wins, at least for me.', 'trailing qualifier'],
  ['If you want, grab the guide.', 'softened CTA'],
  ["Some posts flop, and that's okay.", '"and that\'s okay"'],
];

test('the gate FAILs every known hedge and quotes the phrase', () => {
  for (const [text, marker] of KNOWN_HEDGES) {
    const result = gate(text, { hedgesOnly: true });
    assert.equal(result.status, 'FAIL', `should fail: ${text}`);
    assert.ok(result.hedges.some((hit) => hit.marker === marker), `${text} should flag ${marker}, got ${JSON.stringify(result.hedges)}`);
    for (const hit of result.hedges) assert.ok(text.includes(hit.phrase), `phrase is quoted exactly: ${hit.phrase}`);
  }
});

const CLEAN_BOLD = [
  'Threads is for unfiltered thoughts. fuck professionalism.',
  'professional is the new slop. nobody wants your polished posts. they want what you actually think.',
  'I posted 40 raw takes in 30 days. The polished ones lost every single week.',
  'Stop sanding the edges off your posts. Say the thing. Post it.',
  'Polish kills reach. Post what you actually think.',
];

const FALSE_POSITIVES = [
  'In May I posted 40 times and the raw ones won.',
  'may 3rd was my best day on Threads.',
  'May was my best month.',
  'last may i stopped polishing my posts.',
  'You can schedule a week of posts in 15 minutes.',
  'I can write a post in 4 minutes flat.',
  'I watched "You Might Be Wrong" last night and it was garbage.',
  'I binged Might and Magic all weekend.',
  'I try to reply to every comment.',
  'It worked on the first try.',
  "Don't try to go viral. Post the take.",
  'This kind of post wins every time.',
  'I consider that a win.',
  'Write it in a way your mom gets.',
  'i feel sick posting corporate copy.',
  'Dismay is not a strategy.',
];

test('clean bold copy and the known false positives PASS', () => {
  for (const text of [...CLEAN_BOLD, ...FALSE_POSITIVES]) {
    const result = gate(text);
    assert.equal(result.status, 'PASS', `should pass: ${text} -> ${result.reasons.join('; ')}`);
  }
  assert.equal(gate('This Might Work For You').status, 'FAIL', 'Title Case lines get no proper-noun pass');
  assert.equal(gate('May be the best post I wrote.').status, 'FAIL', '"May be" at a sentence start is a hedge');
});

test('the marker scan flags the other three families', () => {
  const corporate = gate('Excited to announce our new feature. Total game changer.');
  assert.equal(corporate.status, 'FAIL');
  assert.ok(corporate.markers.some((hit) => hit.family === 'corporate' && hit.phrase === 'Excited to announce'));
  const aiTells = gate("Let's dive in. This tool is a testament to craft.");
  assert.ok(aiTells.markers.some((hit) => hit.family === 'ai_tells' && hit.phrase === 'testament'));
  const formatting = gate('Raw wins — every time.\n**Polish loses.**');
  assert.deepEqual(formatting.markers.map((hit) => hit.marker).sort(), ['em dash', 'markdown bold']);
  const scored = scoreText('This might be a game changer.');
  assert.equal(scored.score, 4, 'one hedge weighs 3, one marker weighs 1');
});

test('the gate CLI runs standalone and prints PASS or FAIL with the matched phrases', () => {
  const fail = spawnSync(process.execPath, [gateScript, 'Raw probably wins. Thoughts?'], { encoding: 'utf8' });
  assert.equal(fail.status, 1);
  assert.match(fail.stdout, /^FAIL {2}hedges: 2/);
  assert.match(fail.stdout, /"probably"/);
  assert.match(fail.stdout, /"Thoughts\?"/);
  const pass = spawnSync(process.execPath, [gateScript], { input: 'Raw wins. Post the take.', encoding: 'utf8' });
  assert.equal(pass.status, 0);
  assert.match(pass.stdout, /^PASS {2}hedges: 0 · markers: 0/);
  const json = spawnSync(process.execPath, [gateScript, '--json'], {
    input: JSON.stringify({ posts: [{ id: 'a', text: 'Raw wins.' }, { id: 'b', text: ['Raw wins.', 'Maybe.'] }] }),
    encoding: 'utf8',
  });
  assert.equal(json.status, 1);
  const parsed = JSON.parse(json.stdout);
  assert.deepEqual(parsed.posts.map((post) => post.status), ['PASS', 'FAIL']);
  assert.match(parsed.posts[1].reasons[0], /^part 2: hedging · maybe · "Maybe"/);
  assert.equal(gatePosts({ posts: [{ text: 'Raw wins.' }] }).status, 'PASS');
});

const performance = {
  total_matched: 12,
  posts: [
    ...Array.from({ length: 6 }, (_, index) => ({ post_id: `r${index}`, text: `raw take number ${index}. polish is dead.`, published_at: '2026-09-01T00:00:00Z', metrics: { views: 1000 + index * 100 } })),
    ...Array.from({ length: 5 }, (_, index) => ({ post_id: `p${index}`, text: `This might help you leverage your brand. Thoughts?`, published_at: '2026-09-02T00:00:00Z', metrics: { views: 200 + index * 10 } })),
    { post_id: 'u1', text: 'I think this is unknown.', published_at: '2026-09-03T00:00:00Z', metrics: {} },
  ],
};

test('the verdict compares raw vs polished medians on your account and keeps unknown views unknown', () => {
  const result = scorePosts({ handle: '@creator', window_days: 90, performance });
  assert.equal(result.mode, 'account');
  assert.equal(result.label, 'on your account');
  assert.equal(result.counts.raw, 6);
  assert.equal(result.counts.polished, 6);
  assert.equal(result.counts.unknown_views, 1);
  assert.equal(result.verdict.raw.median_views, 1250);
  assert.equal(result.verdict.polished.median_views, 220);
  assert.equal(result.verdict.winner, 'raw');
  assert.equal(result.verdict.multiple, 5.7);
  assert.equal(result.verdict.small_sample, false);
  assert.match(result.verdict_table, /Unslop verdict · @creator · last 90 days · on your account/);
  assert.match(result.verdict_table, /Raw beat polished 5\.7x on your account\./);
  assert.equal(result.offenders.length, 2, 'five identical reposts collapse into one row');
  assert.equal(result.offenders[0].repeats, 5);
  assert.deepEqual(result.offenders[0].families.hedging, ['might help', 'Thoughts?']);
  assert.match(result.offenders_table, /"might help", "Thoughts\?", "leverage"/);
  assert.equal(result.raw_lowercase_share, 1);
  const unknown = result.posts.find((post) => post.id === 'u1');
  assert.equal(unknown.views, null);
});

const row = (id, text, views) => ({ post_id: id, text, published_at: '2026-09-01T00:00:00Z', metrics: { views } });
const rawRows = Array.from({ length: 6 }, (_, index) => row(`r${index}`, `raw take ${index}. polish is dead.`, 1000 + index * 100));
const listicle = "If you're drawn to:\n— calm\n— craft\n— code\n— coffee\n— quiet\n— books\n— walks";

test('offenders collapse reposts into one row with a repeat count, keeping the most-viewed copy', () => {
  const result = scorePosts({
    handle: '@creator',
    performance: {
      posts: [
        ...rawRows,
        row('d1', listicle, 2452),
        row('d2', listicle, 2946),
        row('d3', listicle.toUpperCase().replace(/\n/g, '\n\n'), 2569),
        row('d4', `${listicle.replace('quiet', 'rain')}`, 2945),
      ],
    },
  });
  assert.equal(result.counts.polished, 4, 'every copy still counts as a post');
  assert.equal(result.offenders.length, 1);
  const [offender] = result.offenders;
  assert.equal(offender.id, 'd2');
  assert.equal(offender.views, 2946);
  assert.equal(offender.repeats, 4, 'same text, normalised case and spacing, and same first line plus phrases all collapse');
  assert.deepEqual(offender.repeat_ids.sort(), ['d1', 'd3', 'd4']);
  assert.match(result.offenders_table, /\| 1 \| If you're drawn to: \(x4\) \| 2,946 \| 8 \|/);
  assert.doesNotMatch(result.offenders_table, /\| 2 \|/);
});

test('a hedged post outranks a higher-score marker-only post', () => {
  const result = scorePosts({
    handle: '@creator',
    performance: { posts: [...rawRows, row('m1', listicle, 9000), row('h1', 'SCOOP\nthis might ship tonight.', 300), row('h2', 'creator to creator. try this, it could help.', 100)] },
  });
  assert.deepEqual(result.offenders.map((post) => post.id), ['h2', 'h1', 'm1']);
  assert.ok(result.offenders[2].score > result.offenders[0].score, 'the marker-only post has the higher slop score');
  assert.equal(result.offenders[2].hedges, 0);
  assert.match(result.offenders_table.split('\n')[2], /^\| 1 \| creator to creator/);
});

test('polished_with_hedges counts every polished post with a hedge and prints one plain line', () => {
  const result = scorePosts({
    handle: '@creator',
    performance: { posts: [...rawRows, row('m1', listicle, 9000), row('m2', listicle, 8000), row('h1', 'this might ship tonight.', 300), row('h2', 'this might ship tonight.', 200), row('h3', 'Raw probably wins.', 100)] },
  });
  assert.equal(result.counts.polished, 5);
  assert.equal(result.polished_with_hedges, 3, 'reposts count once per post, not once per row');
  assert.match(result.verdict_table, /\| Polished \| 5 \| [^\n]+\n\n3 of 5 polished posts had a hedge\.\n\nRaw beat polished/);
  assert.deepEqual(findHedges(hedgedLine(30, 39)), [], 'the hedged-count line has zero hedge words');
  const pasted = scorePosts({ posts: ['raw one.', 'raw two.', 'This might work.', 'Maybe.', 'polish is dead.'].map((text) => ({ text })) });
  assert.equal(pasted.polished_with_hedges, 2);
  const none = scorePosts({ handle: '@creator', performance: { posts: rawRows } });
  assert.equal(none.polished_with_hedges, 0);
  assert.doesNotMatch(none.verdict_table, /polished posts had a hedge/, 'no line when there are no polished posts');
});

test('the dedupe leaves the verdict medians unchanged', () => {
  const polishedViews = [2452, 2946, 2569, 2945, 300, 100];
  const posts = [...rawRows, ...polishedViews.slice(0, 4).map((views, index) => row(`d${index}`, listicle, views)), row('h1', 'this might ship.', 300), row('h2', 'Raw probably wins.', 100)];
  const result = scorePosts({ handle: '@creator', performance: { posts } });
  assert.equal(result.offenders.length, 3, 'four reposts are one offender row');
  assert.equal(result.verdict.polished.posts, 6);
  assert.equal(result.verdict.polished.posts_with_views, 6);
  assert.equal(result.verdict.polished.median_views, (2452 + 2569) / 2, 'median of all six polished posts, reposts included');
  assert.equal(result.verdict.raw.median_views, 1250);
});

test('a polished win is reported, never hidden', () => {
  const flipped = { posts: performance.posts.map((post) => ({ ...post, metrics: { views: post.post_id.startsWith('p') ? 9000 : 100 } })) };
  const result = scorePosts({ handle: '@creator', performance: flipped });
  assert.equal(result.verdict.winner, 'polished');
  assert.match(result.verdict.headline, /^Polished beat raw/);
});

test('the no-data path scores pasted posts with no view comparison, clearly labelled', () => {
  const posts = ['raw take one.', 'raw take two.', 'This might work.', 'Excited to announce — a game changer.', 'polish is dead.'].map((text) => ({ text }));
  const result = scorePosts({ posts });
  assert.equal(result.mode, 'pasted');
  assert.equal(result.label, NO_VIEWS_LABEL);
  assert.equal(result.label, 'pasted posts: no view data, no view comparison');
  assert.equal(result.verdict, null);
  assert.equal(result.verdict_table, null);
  assert.doesNotMatch(result.offenders_table, /Views/);
  assert.equal(result.offenders.length, 2);
  assert.throws(() => scorePosts({ posts: posts.slice(0, 4) }), /paste 5-20 posts/);
  assert.throws(() => scorePosts({ posts: Array.from({ length: 21 }, () => ({ text: 'raw.' })) }), /paste 5-20 posts/);
  const skill = read(source);
  assert.match(skill, /paste 5-20 posts or drafts/);
  assert.match(skill, /Label the result "pasted posts: no view data, no view comparison"/);
  assert.match(skill, /never a verdict table/);
  assert.match(skill, /Connect Threadify at threadify\.app/);
});

test('the casing guard allows lowercasing only, keeping proper nouns', () => {
  const original = 'Threadify Unslop found 3 Hedges in May. Raw wins.';
  const lowered = lowercasePosts({ posts: [{ id: '1', original, keep: ['Threadify', 'Unslop', 'May'] }] });
  assert.equal(lowered.status, 'PASS');
  assert.equal(lowered.posts[0].final, 'Threadify Unslop found 3 hedges in May. raw wins.');
  assert.equal(lowered.posts[0].lower_equal, true);
  const edited = checkPosts({ posts: [{ id: '1', original, final: 'Threadify Unslop found 3 hedges in May. Raw always wins.' }] });
  assert.equal(edited.status, 'FAIL', 'a word change fails the guard');
  const nounLowered = checkPosts({ posts: [{ id: '1', original, final: original.toLowerCase(), keep: ['Threadify'] }] });
  assert.equal(nounLowered.status, 'FAIL', 'a lowercased proper noun fails the guard');
});

/** Prose minus inline code spans: the lexical list is quoted in backticks on purpose. */
const prose = (text) => text.replace(/`[^`\n]+`/g, '');

test('the skill, its references and its templates contain zero hedges', () => {
  const files = [
    source,
    markersFile,
    path.join(root, 'workflows/unslop/README.md'),
    path.join(skillDir, 'agents/openai.yaml'),
  ];
  for (const file of files) {
    const hedges = findHedges(prose(read(file)));
    assert.deepEqual(hedges, [], `${path.relative(root, file)} hedges: ${hedges.map((hit) => hit.phrase).join(', ')}`);
  }
  for (const text of [manifest.summary, ...manifest.fallback.instructions, ...manifest.free_capabilities]) {
    assert.deepEqual(findHedges(text), [], `manifest hedges in: ${text}`);
  }
  const template = read(source).match(/```text\n([\s\S]+?)```/)[1];
  assert.deepEqual(findHedges(template), [], 'approval packet template has zero hedges');
});

test('the bundled skill ships the gate, the score script, the guard and the rules', () => {
  const bundle = path.join(root, 'skills/threadify-unslop');
  for (const file of ['SKILL.md', 'agents/openai.yaml', 'scripts/hedge_gate.mjs', 'scripts/unslop-score.mjs', 'scripts/casing-guard.mjs', 'references/slop-markers.md', 'references/generation-models.json', 'references/workflow-manifest.json', 'references/threadify-001.md']) {
    assert.ok(fs.existsSync(path.join(bundle, file)), `bundle has ${file}`);
  }
});
