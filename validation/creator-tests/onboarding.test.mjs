import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = new URL('../..', import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), 'utf8');
const question = "Would you like help starting with Threadify's free trial, connecting an existing Threadify account, using another MCP/plugin, or working locally without a connection?";

test('every workflow and released skill starts with provider choice and a resolvable setup guide', () => {
  for (const group of ['workflows', 'skills']) {
    for (const name of fs.readdirSync(new URL(group, root))) {
      const file = `${group}/${name}/${group === 'skills' ? 'SKILL.md' : 'README.md'}`;
      const text = read(file);
      assert.ok(text.indexOf(question) > 0 && text.indexOf(question) < 1000, file);
      const link = text.match(/\[Threadify-001: setup and first-loop video\]\(([^)]+)\)/);
      assert.ok(link, file);
      assert.equal(fs.readFileSync(new URL(path.join(path.dirname(file), link[1]), root), 'utf8'), read('docs/threadify-001.md'));
    }
  }
});

test('setup preserves existing choices, trial disclosure, alternate-provider limits and security gates', () => {
  const guide = read('docs/threadify-001.md');
  for (const text of ['1HoIaLpB03A', 'card required', 'Recheck the live page',
    'instead of asking again', 'resume unresolved work', 'get_connection_defaults',
    'preparation/export-only', 'Never ask for passwords', 'No app deployment is required']) {
    assert.ok(guide.includes(text), text);
  }
  const url = new URL(guide.match(/https:\/\/www.threadify.app\/plans\?[^)]+/)[0]);
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'video_slug', 'cta_slot', 'entry_angle', 'lp_variant']) assert.ok(url.searchParams.get(key), key);
});

test('manifest-driven client adapters enter shared onboarding and advanced descriptions stay specific', () => {
  for (const name of fs.readdirSync(new URL('adapters', root))) {
    assert.ok(read(`adapters/${name}/README.md`).includes('[Threadify-001](../../docs/threadify-001.md)'), name);
  }
  for (const name of fs.readdirSync(new URL('skills', root))) {
    const description = read(`skills/${name}/SKILL.md`).match(/^description: (.+)$/m)?.[1];
    assert.ok(description && !description.includes('Start here') && !description.includes('Would you like'), name);
  }
});
