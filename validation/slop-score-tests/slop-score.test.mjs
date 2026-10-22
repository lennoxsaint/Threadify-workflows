import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  SCORE_RULE,
  TWIN_LABEL,
  casingGuard,
  collectCandidates,
  deal,
  fix,
  isCorrect,
  parseGuesses,
  plugCheck,
  renderCard,
  reusedHooks,
  reveal,
  seededShuffle,
  slopScore,
  verifyDeck,
} from '../../plugins/threadify/skills/threadify-slop-score/scripts/slop-score.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const skillDir = path.join(root, 'plugins/threadify/skills/threadify-slop-score');
const script = path.join(skillDir, 'scripts/slop-score.mjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'slop-score-'));
const NOW = '2026-10-22T12:00:00Z';
const LINK = 'https://www.threadify.app/start';

const ownPosts = [
  { id: 'p1', topic: 'shipping late at night', text: "i shipped the scheduler fix at 2am and nobody noticed. that's the job" },
  { id: 'p2', topic: 'first paid member', text: 'my first paid member came from a reply, not a post. reply more' },
  { id: 'p3', topic: 'posting times', text: 'stopped posting threads at 9am. 11pm posts get 3x the replies on my account' },
  { id: 'p4', topic: 'writing hooks', text: 'wrote 40 hooks before breakfast. kept two. both were the ugly ones' },
  { id: 'p5', topic: 'pricing pages', text: 'pricing page went from 6 plans to 2 and signups doubled in a week' },
];
const twins = [
  { topic: 'shipping late at night', text: "Here's the thing about shipping late at night — it might feel productive, but growth is a marathon. 🚀" },
  { topic: 'first paid member', text: "Landing your first paid member is a game-changer. It's not about the money, it's about the validation. What do you think?" },
  { topic: 'posting times', text: 'Timing matters when it comes to posting. Consider testing different windows to find your best slot.' },
  { topic: 'writing hooks', text: 'A great hook can make or break your post. Start with curiosity, keep it short, and deliver on the promise.' },
  { topic: 'pricing pages', text: 'Your pricing page is often the most important page on your site. Simplify your tiers and highlight the value.' },
];
const cards = { handle: '@creator', posts: ownPosts, twins };
const performance = {
  posts: [
    ...ownPosts.map((post, index) => ({ post_id: post.id, published_at: `2026-10-${20 - index * 3}T01:00:00Z`, text: post.text, metrics: { views: 100 } })),
    { post_id: 'old', published_at: '2026-08-01T01:00:00Z', text: 'an old post from outside the thirty day window for sure' },
    { post_id: 'p1-repost', published_at: '2026-10-21T01:00:00Z', text: ownPosts[0].text },
  ],
};
const truth = (deck) => deck.cards.map((card) => (card.source === 'you' ? 'human' : 'slop'));

test('the scorer flags known slop phrases with the exact words, family by family', () => {
  const scored = slopScore("Here's the thing — I think consistency is a game-changer. Let's dive in. Thoughts?");
  assert.ok(scored.flagged.hedging.includes('I think'));
  assert.ok(scored.flagged.hedging.includes('Thoughts?'));
  assert.ok(scored.flagged.ai_tells.includes("Here's the thing"));
  assert.ok(scored.flagged.ai_tells.includes("Let's dive in"));
  assert.ok(scored.flagged.corporate.includes('game-changer'));
  assert.ok(scored.flagged.over_formatting.includes('em dash'));
  assert.equal(scored.slop, 100, 'capped at 100');
  const hedgeOnly = slopScore('this might work on your account');
  assert.equal(hedgeOnly.slop, 30, 'one hedge costs 30');
  assert.equal(slopScore('i shipped it at 2am and nobody noticed').slop, 0);
  assert.equal(slopScore('we leverage robust ideas').slop, 20, 'two corporate tells cost 10 each');
});

test('Slop Score reuses Unslop\'s scorer unchanged', () => {
  for (const file of ['hedge_gate.mjs', 'casing-guard.mjs']) {
    const ours = fs.readFileSync(path.join(skillDir, 'scripts', file));
    const unslop = fs.readFileSync(path.join(root, 'plugins/threadify/skills/threadify-unslop/scripts', file));
    assert.ok(ours.equals(unslop), `${file} must stay identical to Unslop's copy`);
  }
});

test('candidates keep only the owner\'s own posts from the last 30 days, reposts removed', () => {
  const result = collectCandidates(performance, { now: NOW });
  assert.deepEqual(result.posts.map((post) => post.id), ['p1', 'p2', 'p3', 'p4', 'p5']);
  assert.ok(!result.posts.some((post) => post.id === 'old'));
  assert.equal(result.enough, true);
});

test('the shuffle is deterministic for a seed and changes with the seed', () => {
  const items = Array.from({ length: 10 }, (_, index) => index);
  assert.deepEqual(seededShuffle(items, 53), seededShuffle(items, 53));
  assert.notDeepEqual(seededShuffle(items, 53), seededShuffle(items, 54));
  assert.deepEqual([...seededShuffle(items, 53)].sort((a, b) => a - b), items);
  const first = deal(cards, { seed: 53, now: NOW });
  const second = deal(cards, { seed: 53, now: NOW });
  assert.equal(first.status, 'ok');
  assert.deepEqual(first.blind, second.blind);
  assert.equal(first.deck_sha256, second.deck_sha256);
  assert.equal(first.blind.length, 10);
  assert.ok(!JSON.stringify(first.blind).includes('twin'), 'the blind deck never says which is which');
  assert.ok(verifyDeck(first.deck));
  const tampered = structuredClone(first.deck);
  [tampered.cards[0].text, tampered.cards[1].text] = [tampered.cards[1].text, tampered.cards[0].text];
  assert.equal(verifyDeck(tampered), false);
  assert.ok(first.deck.cards.filter((card) => card.source === 'twin').every((card) => card.label === TWIN_LABEL));
});

test('deal refuses a bad batch: wrong counts, repeated topics, unmatched twins, reused hooks, foreign posts', () => {
  assert.equal(deal({ ...cards, twins: twins.slice(0, 4) }).status, 'FAIL');
  const sameTopic = { ...cards, posts: cards.posts.map((post, index) => (index === 1 ? { ...post, topic: 'posting times' } : post)) };
  assert.match(deal(sameTopic).errors.join(' '), /5 different topics/);
  const unmatched = { ...cards, twins: twins.map((twin, index) => (index === 0 ? { ...twin, topic: 'something else' } : twin)) };
  assert.match(deal(unmatched).errors.join(' '), /match exactly one/);
  const hookReuse = { ...cards, twins: twins.map((twin, index) => (index === 4 ? { ...twin, text: 'A great hook can make or break your launch too.' } : twin)) };
  assert.match(deal(hookReuse).errors.join(' '), /share a hook/);
  const candidates = collectCandidates(performance, { now: NOW });
  const foreign = { ...cards, posts: cards.posts.map((post, index) => (index === 0 ? { ...post, id: 'someone-else' } : post)) };
  assert.match(deal(foreign, { candidates }).errors.join(' '), /not one of your own posts/);
  assert.equal(reusedHooks(['one two three four five six', 'one two three four five seven']).length, 1);
});

test('hit-rate math: X of 10 correct, averages per side and the worst twin', () => {
  const { deck } = deal(cards, { seed: 7, now: NOW });
  const perfect = reveal(deck, truth(deck));
  assert.equal(perfect.hits, 10);
  assert.equal(perfect.hit_rate, 100);
  const flipped = reveal(deck, truth(deck).map((guess) => (guess === 'human' ? 'slop' : 'human')));
  assert.equal(flipped.hits, 0);
  const allHuman = reveal(deck, Array(10).fill('human'));
  assert.equal(allHuman.hits, 5);
  assert.equal(allHuman.hit_rate, 50);
  assert.equal(allHuman.average.your_posts, 0);
  assert.ok(allHuman.average.ai_twins > allHuman.average.your_posts);
  const twinScores = allHuman.cards.filter((card) => card.source === 'twin').map((card) => card.slop);
  assert.equal(allHuman.worst_twin.slop, Math.max(...twinScores));
  assert.equal(allHuman.worst_twin.prompt, `write a Threads post about ${allHuman.worst_twin.topic}`);
  assert.equal(reveal(deck, ['human']).status, 'FAIL');
  assert.deepEqual(parseGuesses('h,S,human,slop'), ['human', 'slop', 'human', 'slop']);
  assert.throws(() => parseGuesses('maybe'));
  assert.equal(isCorrect('you', 'human'), true);
  assert.equal(isCorrect('twin', 'human'), false);
});

test('the casing guard passes lowercasing only and rejects any word change', () => {
  assert.equal(casingGuard('Shipped It At 2am', 'shipped it at 2am').status, 'PASS');
  assert.equal(casingGuard('Threadify shipped it', 'Threadify shipped it').status, 'PASS');
  const changed = casingGuard('Shipped it at 2am', 'shipped it at 3am');
  assert.equal(changed.status, 'FAIL');
  assert.equal(changed.lower_equal, false);
  assert.equal(casingGuard('Shipped it at 2am', 'shipped it at 2am!').status, 'FAIL', 'punctuation is wording too');
  assert.equal(casingGuard('I use Threadify daily', 'i use threadify daily', ['Threadify']).status, 'FAIL', 'kept proper nouns stay capitalised');
  assert.match(casingGuard('A', 'a').line, /lower\(original\) == lower\(final\) PASS/);
});

test('fix re-scores Threadify\'s post with the same scorer and stops on a guard failure', () => {
  const { deck } = deal(cards, { seed: 7, now: NOW });
  const revealed = reveal(deck, Array(10).fill('slop'));
  const original = 'Signups doubled when I cut the pricing page to two plans';
  const ok = fix({ deck, revealed, original, final: original.toLowerCase() });
  assert.equal(ok.status, 'ok');
  assert.equal(ok.before, revealed.worst_twin.slop);
  assert.equal(ok.after, 0);
  assert.equal(ok.line, `slop ${revealed.worst_twin.slop} -> 0`);
  const edited = fix({ deck, revealed, original, final: 'signups tripled when i cut the pricing page to two plans' });
  assert.equal(edited.status, 'FAIL');
  assert.equal(edited.show, original);
  const reused = fix({ deck, revealed, original: ownPosts[3].text, final: ownPosts[3].text });
  assert.equal(reused.status, 'FAIL');
  assert.match(reused.errors[0], /reuses a hook/);
});

test('the Auto Plug check needs 100-250 characters ending with the plain offer link', () => {
  const good = `posting at 11pm doubled my replies. finding that took me months of guessing. threadify reads your own numbers and picks the time for you. free to try ${LINK}`;
  assert.equal(plugCheck(good, LINK).status, 'PASS', plugCheck(good, LINK).reasons.join('; '));
  assert.match(plugCheck('too short ' + LINK, LINK).reasons.join(' '), /too short/);
  assert.match(plugCheck(`${'x'.repeat(240)} ${LINK}`, LINK).reasons.join(' '), /too long/);
  const utm = `${good.slice(0, -LINK.length)}${LINK}?utm_source=threads`;
  assert.match(plugCheck(utm, LINK).reasons.join(' '), /utm_/);
  const wrongEnding = `${good} go now`;
  assert.match(plugCheck(wrongEnding, LINK).reasons.join(' '), /must end with/);
  const otherLink = good.replace('free to try', 'see https://example.com and');
  assert.match(plugCheck(otherLink, LINK).reasons.join(' '), /only the offer's own link/);
  const hedged = good.replace('threadify reads', 'if you want, threadify reads');
  assert.match(plugCheck(hedged, LINK).reasons.join(' '), /hedges found/);
});

test('the card renders the hit rate, every score with flagged words, both averages and the fix', () => {
  const { deck } = deal(cards, { seed: 7, now: NOW });
  const revealed = reveal(deck, truth(deck));
  const fixed = fix({ deck, revealed, original: 'Signups doubled when I cut the pricing page to two plans', final: 'signups doubled when i cut the pricing page to two plans' });
  const card = renderCard(revealed, fixed);
  assert.match(card, /You got 10 of 10 right\./);
  assert.match(card, /Your posts: average slop 0 · AI twins: average slop \d+/);
  assert.match(card, new RegExp(`${TWIN_LABEL}`));
  assert.match(card, /"game-changer"/);
  assert.match(card, /slop \d+ -> 0/);
  assert.ok(card.includes(SCORE_RULE));
  assert.equal(card.split('\n').filter((line) => /^#\d+ /.test(line)).length, 10);
  assert.doesNotMatch(card.replace(/"[^"]*"/g, ''), /—/, 'no em dashes in the card copy');
});

test('the CLI runs the whole flow from a run folder and fails loudly on bad input', () => {
  const dir = tmp();
  const perf = path.join(dir, 'perf.json');
  const cardsFile = path.join(dir, 'cards.json');
  fs.writeFileSync(perf, JSON.stringify(performance));
  fs.writeFileSync(cardsFile, JSON.stringify(cards));
  const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  const candidates = run('candidates', '--dir', dir, '--file', perf, '--now', NOW);
  assert.equal(candidates.status, 0, candidates.stdout);
  const dealt = run('deal', '--dir', dir, '--file', cardsFile, '--seed', '53', '--now', NOW);
  assert.equal(dealt.status, 0, dealt.stdout);
  assert.equal(JSON.parse(dealt.stdout).seed, 53);
  const deck = JSON.parse(fs.readFileSync(path.join(dir, 'deck.json'), 'utf8'));
  const revealed = run('reveal', '--dir', dir, '--guesses', truth(deck).join(','));
  assert.equal(revealed.status, 0, revealed.stdout);
  assert.match(JSON.parse(revealed.stdout).card, /You got 10 of 10 right/);
  const original = path.join(dir, 'original.txt');
  const final = path.join(dir, 'final.txt');
  fs.writeFileSync(original, 'Signups doubled when I cut the pricing page to two plans\n');
  fs.writeFileSync(final, 'signups doubled when i cut the pricing page to two plans\n');
  const fixed = run('fix', '--dir', dir, '--original', original, '--final', final);
  assert.equal(fixed.status, 0, fixed.stdout);
  assert.match(JSON.parse(run('card', '--dir', dir).stdout).card, /slop \d+ -> 0/);
  fs.writeFileSync(final, 'signups tripled when i cut the pricing page to two plans\n');
  assert.equal(run('guard', '--original', original, '--final', final).status, 1);
  assert.equal(run('plug-check', '--link', LINK, '--text', 'short').status, 1);
  assert.equal(run('nonsense').status, 1);
});
