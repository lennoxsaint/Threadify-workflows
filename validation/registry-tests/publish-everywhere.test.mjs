import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { describeWorkflow, loadWorkflowRegistry } from '../../lib/workflow-registry.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const skillDir = path.join(root, 'plugins/threadify/skills/threadify-publish-everywhere');
const read = (file) => fs.readFileSync(file, 'utf8');
const skill = read(path.join(skillDir, 'SKILL.md'));
const manifest = JSON.parse(read(path.join(root, 'workflows/publish-everywhere/manifest.json')));
const summary = 'Hand your agent one video. It checks where the video can go, has Threadify write the post and the YouTube title in your voice, and schedules it to YouTube, Threads and X only after one exact approval.';

test('Publish Everywhere registers the account, upload and schedule tools and never publishes now or deletes', () => {
  const workflow = describeWorkflow(loadWorkflowRegistry({ root }), 'publish-everywhere');
  assert.equal(workflow.skill_name, 'threadify-publish-everywhere');
  assert.equal(workflow.title, 'Publish Everywhere');
  assert.equal(workflow.version, '0.1.0');
  assert.equal(workflow.summary, summary);
  assert.deepEqual(workflow.required_mcp_tools, [
    'get_connection_defaults',
    'list_brands',
    'generate_content',
    'create_media_upload',
    'validate_post',
    'schedule_post',
    'get_schedule_status',
    'list_scheduled_posts',
  ]);
  for (const tool of ['publish_now', 'edit_draft', 'save_draft', 'reschedule_post', 'cancel_schedule', 'delete_draft']) {
    assert.ok(![...workflow.required_mcp_tools, ...workflow.optional_mcp_tools].includes(tool), `must not use ${tool}`);
    assert.doesNotMatch(skill.replace('Never use `edit_draft`', ''), new RegExp(`\`${tool}\``), `skill must not call ${tool}`);
  }
  assert.deepEqual(manifest.triggers, [
    'publish everywhere',
    'post this video to youtube',
    'upload this video',
    'schedule this video on youtube threads and x',
  ]);
  assert.ok(skill.startsWith(`---\nname: threadify-publish-everywhere\ndescription: ${summary} Use when`));
  for (const trigger of manifest.triggers) assert.ok(skill.includes(`"${trigger}"`), `description names ${trigger}`);
});

test('Publish Everywhere reads back accounts first and stops when YouTube is not connected', () => {
  assert.match(skill, /Call `get_connection_defaults` first, then `list_brands`/);
  assert.match(skill, /the brand and each connected handle/);
  assert.match(skill, /If YouTube is not connected, stop and say: "YouTube is not connected to <brand>\. Connect it at threadify\.app \(Brands\), then run this again\."/);
  assert.match(skill, /Never continue without it/);
  assert.match(skill, /Never switch brand or account without the owner's confirmation/);
});

test('Publish Everywhere measures one MP4 or MOV and drops platforms with a reason from the limits table', () => {
  const limits = JSON.parse(read(path.join(skillDir, 'references/platform-limits.json')));
  assert.equal(limits.platforms.threads.max_duration_seconds, 300);
  assert.match(skill, /One video per run/);
  assert.match(skill, /scripts\/video-fit\.mjs probe/);
  assert.match(skill, /If it returns `ffprobe_missing`, ask its questions \(length, shape\)/);
  assert.match(skill, /Only MP4 or MOV/);
  assert.match(skill, /\| Threads \| 300 seconds \(5 minutes\) \|/);
  assert.match(skill, /\| X \| 20 minutes by default \|/);
  assert.match(skill, /\| YouTube \| 12 hours; a channel not cleared for long uploads is held to 15 minutes \|/);
  assert.match(skill, /\| Threadify storage, every platform \| 1 GB \(1024 MB\) \|/);
  assert.match(skill, /vertical or square and 3 minutes or less is `short`; everything else is `long`/);
  assert.match(skill, /dropped with a plain-English reason/);
  assert.match(skill, /Never drop one silently/);
});

test('Publish Everywhere never hand-writes copy and proves lowercasing with the casing guard', () => {
  assert.match(skill, /Threadify writes the post with `generate_content`/);
  assert.match(skill, /`contentType: "short-form"`/);
  assert.match(skill, /Never hand-write or reword the post or the title/);
  assert.match(skill, /The only permitted change is lowercasing, keeping proper nouns/);
  assert.match(skill, /scripts\/casing-guard\.mjs/);
  assert.match(skill, /`lower\(original\) == lower\(final\)` must be true/);
  assert.match(skill, /If the guard fails, show the original unchanged/);
  assert.match(skill, /first line of Threadify's post unless the owner supplied one, 100 characters at most/);
  assert.match(skill, /Never write the post yourself instead/);
});

test('Publish Everywhere asks for privacy and never defaults it', () => {
  assert.match(skill, /YouTube privacy \(public, unlisted or private\) is asked on every run/);
  assert.match(skill, /Ask every run, even when a past run used one/);
  assert.match(skill, /Never set `made_for_kids` without asking/);
  assert.match(skill, /ISO with the offset/);
  assert.ok(manifest.fallback.instructions.includes('Never default YouTube privacy and never set made_for_kids without asking.'));
});

test('Publish Everywhere uploads without printing the URL, then shows one card and waits for the exact yes', () => {
  assert.equal(manifest.approval_gate.required, true);
  assert.equal(manifest.approval_gate.type, 'explicit-final-approval');
  assert.deepEqual(manifest.approval_gate.must_show, [
    'brand and timezone',
    'exact post text',
    'YouTube title, format and privacy',
    'each platform with its handle and time',
    'anything dropped and why',
    'global auto-repost note',
    'action',
  ]);
  assert.match(skill, /`create_media_upload` with the filename and `content_type` `video\/mp4` \(MP4\) or `video\/quicktime` \(MOV\)/);
  assert.match(skill, /HTTP PUT the file's bytes to the one-time URL/);
  assert.match(skill, /Never print the upload URL/);
  assert.match(skill, /Then call `validate_post`/);
  assert.match(skill, /Proceed only on the exact reply "yes"/);
  assert.match(skill, /needs a new card and a new "yes"/);
  assert.match(skill, /X is metered: say so on the card/);
  assert.match(skill, /global auto-repost is on/);
  assert.match(skill, /Never publish now/);
});

test('Publish Everywhere schedules once, inspects before any retry and says scheduled', () => {
  assert.match(skill, /`youtube_options` `\{format, privacy, title, tags\?\}`/);
  assert.match(skill, /one stable `idempotency_key`/);
  assert.match(skill, /Call `schedule_post` once/);
  assert.match(skill, /look first with `get_schedule_status` or `list_scheduled_posts`/);
  assert.match(skill, /Never repeat blind/);
  assert.match(skill, /Say "scheduled", never "posted"/);
  assert.match(skill, /Stop on HTTP 402 or a quota error/);
  assert.match(skill, /Never delete anything/);
  assert.match(skill, /Never print the upload URL, credentials, tokens or account ids/);
  assert.ok(skill.split('\n').length <= 90, 'SKILL.md stays short');
});
