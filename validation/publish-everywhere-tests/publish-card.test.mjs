import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import test from 'node:test';
import {
  buildCard,
  checkConnections,
  isApproved,
  missingForCard,
  scheduleArgs,
  youtubeTitle,
} from '../../plugins/threadify/skills/threadify-publish-everywhere/scripts/publish-card.mjs';

const script = 'plugins/threadify/skills/threadify-publish-everywhere/scripts/publish-card.mjs';
const plan = () => JSON.parse(fs.readFileSync(new URL('./fixtures/approved-plan.json', import.meta.url), 'utf8'));
const fields = (value) => missingForCard(value).map((entry) => entry.field);

test('YouTube not connected stops the run and points to threadify.app (Brands)', () => {
  const result = checkConnections({ brand: 'Example Brand', handles: { threads: 'examplecreator', x: '@examplecreator' } });
  assert.equal(result.status, 'stop');
  assert.equal(result.message, 'YouTube is not connected to Example Brand. Connect it at threadify.app (Brands), then run this again. Nothing was uploaded or scheduled.');
  assert.match(result.readback, /YouTube: not connected/);
  assert.equal(checkConnections({ handles: { youtube: 'a' } }).status, 'stop', 'no brand is a stop too');
  const run = spawnSync(process.execPath, [script, 'connections'], { input: JSON.stringify({ brand: 'Example Brand', handles: {} }), encoding: 'utf8' });
  assert.equal(run.status, 1);
});

test('connected accounts are read back by handle, and a missing Threads or X is named', () => {
  const result = checkConnections({ brand: 'Example Brand', handles: { youtube: 'examplechannel', threads: '@examplecreator' } });
  assert.equal(result.status, 'ok');
  assert.equal(result.readback, 'Brand: Example Brand\nYouTube: @examplechannel\nThreads: @examplecreator\nX: not connected');
  assert.deepEqual(result.not_connected, ['x']);
});

test('the YouTube title is the first line of the post unless the owner supplies one', () => {
  const fromPost = youtubeTitle({ post_text: '\nI filmed one video.\n\nThen I scheduled it.' });
  assert.deepEqual(fromPost, { status: 'ok', source: 'first_line_of_post', title: 'I filmed one video.', length: 19 });
  const supplied = youtubeTitle({ post_text: 'I filmed one video.', supplied_title: ' My Title ' });
  assert.equal(supplied.title, 'My Title');
  assert.equal(supplied.source, 'owner');
});

test('a title over 100 characters is a question, never a cut', () => {
  assert.equal(youtubeTitle({ post_text: 'a'.repeat(100) }).status, 'ok');
  const long = youtubeTitle({ post_text: `${'a'.repeat(101)}\nsecond line` });
  assert.equal(long.status, 'ask');
  assert.equal(long.title.length, 101, 'the line is returned whole, not truncated');
  assert.match(long.ask, /first line is 101 characters and a YouTube title takes 100/);
  assert.equal(youtubeTitle({ supplied_title: 'b'.repeat(101) }).status, 'ask');
  assert.equal(youtubeTitle({ post_text: '   ' }).status, 'ask');
});

test('privacy must be asked: the card is blocked until the owner picks one', () => {
  for (const privacy of [undefined, null, '', 'Public', 'default', 'unlisted ']) {
    const draft = plan();
    draft.youtube.privacy = privacy;
    const result = buildCard(draft);
    assert.equal(result.status, 'blocked', `privacy ${JSON.stringify(privacy)} must block`);
    assert.deepEqual(result.missing.map((entry) => entry.field), ['youtube.privacy']);
    assert.deepEqual(result.ask, ['Who should see the video on YouTube: public, unlisted or private?']);
    assert.equal(result.card, undefined);
    assert.equal(scheduleArgs({ plan: draft, card_sha256: 'x', reply: 'yes' }).status, 'blocked', 'a yes cannot skip the question');
  }
  for (const privacy of ['public', 'unlisted', 'private']) {
    const draft = plan();
    draft.youtube.privacy = privacy;
    assert.equal(buildCard(draft).status, 'ready');
  }
});

test('made for kids is never set without asking, and times need an offset', () => {
  const kids = plan();
  kids.youtube.made_for_kids = false;
  assert.deepEqual(fields(kids), ['youtube.made_for_kids']);
  kids.youtube.made_for_kids_asked = true;
  assert.deepEqual(fields(kids), []);
  assert.match(buildCard(kids).card, /Made for kids: no \(you chose it\)/);

  const noOffset = plan();
  noOffset.times.threads.at = '2026-10-12T09:00:00';
  assert.deepEqual(fields(noOffset), ['times.threads']);
  const noTime = plan();
  delete noTime.times.x;
  assert.deepEqual(fields(noTime), ['times.x']);
  const guardFailed = plan();
  guardFailed.post.casing = 'FAIL';
  assert.deepEqual(fields(guardFailed), ['post.casing']);
  const notUploaded = plan();
  delete notUploaded.video.url;
  assert.deepEqual(fields(notUploaded), ['video.url']);
});

test('the approval card shows everything the owner is approving', () => {
  const result = buildCard(plan());
  assert.equal(result.status, 'ready');
  assert.match(result.card_sha256, /^[0-9a-f]{64}$/);
  assert.equal(result.card, [
    'Publish Everywhere · Example Brand · Australia/Perth',
    'Video: clip.mov · 58 s · 1080 x 1920 · 70 MB · MOV (hevc)',
    'Post, written by Threadify (unchanged):',
    'I filmed one video and scheduled it in three places.',
    '',
    'One approval. No copy and paste.',
    "YouTube title (the post's first line): I filmed one video and scheduled it in three places.",
    'YouTube format: short (vertical video of 58 s (3 minutes or less), so YouTube format is short)',
    'YouTube privacy: unlisted (you chose it)',
    "Made for kids: not set, your channel's own setting applies",
    'Going to:',
    '- YouTube @examplechannel · Mon 12 Oct, 9:00 am · 2026-10-12T09:00:00+08:00 (Australia/Perth)',
    '- Threads @examplecreator · Mon 12 Oct, 9:00 am · 2026-10-12T09:00:00+08:00 (Australia/Perth)',
    '- X @examplecreator · Mon 12 Oct, 11:00 am · 2026-10-12T11:00:00+08:00 (Australia/Perth) · X is metered: this post counts against your X allowance',
    'Dropped: nothing',
    'Note: global auto-repost is on, so Threadify will also re-share this post later under your saved setting.',
    'Action: schedule this video exactly as shown. Nothing publishes now.',
    'Reply "yes" to schedule it, or "no" to schedule nothing.',
  ].join('\n'));
  assert.doesNotMatch(result.card, /posted/i);
});

test('dropped platforms and their reasons are on the card', () => {
  const draft = plan();
  draft.platforms = ['youtube', 'x'];
  draft.dropped = [{ platform: 'threads', reason: 'the video is 5 min 1 s and Threads takes up to 5 min' }];
  draft.global_auto_repost = false;
  const { card } = buildCard(draft);
  assert.match(card, /Dropped: Threads, because the video is 5 min 1 s and Threads takes up to 5 min/);
  assert.doesNotMatch(card, /- Threads @/);
  assert.doesNotMatch(card, /auto-repost/);
  draft.global_auto_repost = undefined;
  assert.match(buildCard(draft).card, /global auto-repost is unknown/);
});

test('only the exact reply "yes" approves', () => {
  for (const reply of ['yes', 'Yes', ' YES ', 'yes\n']) assert.equal(isApproved(reply), true, reply);
  for (const reply of ['y', 'ok', 'sure', 'yes please', 'yes.', 'go ahead', 'yep', 'no', '', null, undefined, true]) {
    assert.equal(isApproved(reply), false, String(reply));
  }
});

test('schedule arguments exist only after "yes" to the exact card', () => {
  const draft = plan();
  const { card_sha256: hash } = buildCard(draft);
  assert.equal(scheduleArgs({ plan: draft, card_sha256: hash, reply: 'ok' }).status, 'not_approved');
  assert.equal(scheduleArgs({ plan: draft, card_sha256: hash }).status, 'not_approved');
  assert.equal(scheduleArgs({ plan: draft, card_sha256: hash, reply: 'ok' }).arguments, undefined);

  const changed = plan();
  changed.youtube.privacy = 'public';
  assert.equal(scheduleArgs({ plan: changed, card_sha256: hash, reply: 'yes' }).status, 'card_changed', 'a changed plan needs a new card and a new yes');

  const approved = scheduleArgs({ plan: draft, card_sha256: hash, reply: 'yes' });
  assert.equal(approved.status, 'approved');
  assert.equal(approved.tool, 'schedule_post');
  const { idempotency_key: key, ...rest } = approved.arguments;
  assert.match(key, /^publish-everywhere-[0-9a-f]{32}$/);
  assert.deepEqual(rest, {
    text: draft.post.final,
    video: 'https://media.example.com/public/clip.mov',
    platforms: ['youtube', 'threads', 'x'],
    scheduled_at: '2026-10-12T09:00:00+08:00',
    platform_times: {
      youtube: '2026-10-12T09:00:00+08:00',
      threads: '2026-10-12T09:00:00+08:00',
      x: '2026-10-12T11:00:00+08:00',
    },
    youtube_options: { format: 'short', privacy: 'unlisted', title: 'I filmed one video and scheduled it in three places.' },
  });
  assert.equal(scheduleArgs({ plan: plan(), card_sha256: hash, reply: 'yes' }).arguments.idempotency_key, key, 'the key is stable for a retry');
  for (const never of ['auto_repost', 'auto_plug', 'draft_id']) assert.ok(!(never in approved.arguments), `never sends ${never}`);
  assert.ok(!('made_for_kids' in approved.arguments.youtube_options));
});

test('one shared time needs no per-platform times, and tags pass through', () => {
  const draft = plan();
  draft.times.x = { ...draft.times.youtube };
  draft.youtube.tags = ['threads', 'youtube'];
  const { card, card_sha256: hash } = buildCard(draft);
  assert.match(card, /YouTube tags: threads, youtube/);
  const { arguments: args } = scheduleArgs({ plan: draft, card_sha256: hash, reply: 'yes' });
  assert.equal(args.platform_times, undefined);
  assert.deepEqual(args.youtube_options.tags, ['threads', 'youtube']);
});

test('the CLI exits 1 until the step may continue', () => {
  const run = (command, input) => spawnSync(process.execPath, [script, command], { input: JSON.stringify(input), encoding: 'utf8' });
  const draft = plan();
  const card = run('card', draft);
  assert.equal(card.status, 0);
  const { card_sha256: hash } = JSON.parse(card.stdout);
  assert.equal(run('schedule', { plan: draft, card_sha256: hash, reply: 'yes' }).status, 0);
  assert.equal(run('schedule', { plan: draft, card_sha256: hash, reply: 'sure' }).status, 1);
  delete draft.youtube.privacy;
  assert.equal(run('card', draft).status, 1);
  assert.equal(run('nonsense', {}).status, 1);
});
