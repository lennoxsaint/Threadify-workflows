import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { preflight, onlineCheck, loadContract, CHALLENGE_PATH } from '../preflight.mjs';

const preflightScript = fileURLToPath(new URL('../preflight.mjs', import.meta.url));
const realPackage = fileURLToPath(new URL('../package/threadify', import.meta.url));
const manifest = () => JSON.parse(fs.readFileSync(path.join(realPackage, 'plugin.json'), 'utf8'));
const errors = (findings) => findings.filter((finding) => finding.level === 'error').map((finding) => finding.code);

// A throwaway copy of the real package with plugin.json changed by `change`.
function packageWith(t, change) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'listed-submission-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.cpSync(realPackage, dir, { recursive: true });
  const plugin = manifest();
  change(plugin, plugin.extensions['com.openai']);
  fs.writeFileSync(path.join(dir, 'plugin.json'), `${JSON.stringify(plugin, null, 2)}\n`);
  return dir;
}

test('the review packet holds 5 positive and 3 negative cases written against real tools', () => {
  const { review, publication, interface: ui } = manifest().extensions['com.openai'];
  const { tools } = loadContract();
  assert.equal(review.test_cases.positive.length, 5);
  assert.equal(review.test_cases.negative.length, 3);
  for (const item of review.test_cases.positive) {
    for (const name of item.tools_triggered.split(',').map((part) => part.trim())) assert.ok(tools.has(name), name);
  }
  const triggered = review.test_cases.positive.map((item) => item.tools_triggered).join(',');
  for (const name of ['get_connection_defaults', 'list_scheduled_posts', 'generate_content', 'review_post', 'schedule_post', 'get_schedule_status', 'greatest_hits', 'reschedule_post', 'cancel_schedule']) {
    assert.match(triggered, new RegExp(`\\b${name}\\b`));
  }
  assert.equal(review.commerce, false);
  assert.deepEqual(publication.countries, []);
  assert.ok(publication.release_notes.trim());
  assert.ok(ui.defaultPrompt.length >= 1 && ui.defaultPrompt.length <= 3);
  for (const prompt of ui.defaultPrompt) {
    assert.ok(prompt.length <= 128, prompt);
    assert.doesNotMatch(prompt, /@/);
  }
});

test('the negative upgrade prompt is quoted, so only that exact line skips the policy lint', (t) => {
  assert.match(JSON.stringify(manifest()), /Upgrade my Threadify plan/);
  assert.deepEqual(errors(preflight(realPackage)), []);
  const leaked = packageWith(t, (plugin, openai) => { openai.review.test_cases.negative[2].expected_behavior = 'Offers an upgrade.'; });
  assert.deepEqual(errors(preflight(leaked)), ['listed_policy_upgrade']);
});

test('review cases are checked: count, real tool names and rejected fields', (t) => {
  const unknownTool = packageWith(t, (plugin, openai) => { openai.review.test_cases.positive[0].tools_triggered = 'get_connection_defaults, open_dashboard'; });
  assert.deepEqual(errors(preflight(unknownTool)), ['listed_review_tool_unknown']);
  const short = packageWith(t, (plugin, openai) => { openai.review.test_cases.positive.pop(); });
  assert.deepEqual(errors(preflight(short)), ['listed_review_case_count']);
  const credentials = packageWith(t, (plugin, openai) => { openai.review.reviewer_instructions = 'Sign in as the test user.'; });
  assert.deepEqual(errors(preflight(credentials)), ['listed_review_field_rejected']);
  const incomplete = packageWith(t, (plugin, openai) => { delete openai.review.test_cases.positive[1].expected_behavior; });
  assert.deepEqual(errors(preflight(incomplete)), ['listed_review_case_incomplete']);
  const country = packageWith(t, (plugin, openai) => { openai.publication.countries = ['us']; });
  assert.deepEqual(errors(preflight(country)), ['listed_publication_country_invalid']);
});

test('--final refuses the demo video placeholder and flags the open country list', () => {
  const findings = preflight(realPackage, { final: true });
  assert.deepEqual(errors(findings), ['listed_final_placeholder']);
  assert.deepEqual(findings.filter((finding) => finding.level === 'warning').map((finding) => finding.code), ['listed_final_countries_unrestricted']);
  const result = spawnSync(process.execPath, [preflightScript, realPackage, '--final'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /demo_recording_url is still a placeholder/);
  assert.equal(spawnSync(process.execPath, [preflightScript, realPackage], { encoding: 'utf8' }).status, 0);
});

test('--final passes once the owner fills the demo video and countries', (t) => {
  const ready = packageWith(t, (plugin, openai) => {
    openai.review.demo_recording_url = 'https://www.youtube.com/watch?v=threadifydemo';
    openai.publication.countries = ['AU', 'US'];
  });
  assert.deepEqual(preflight(ready, { final: true }), []);
  const missing = packageWith(t, (plugin, openai) => { delete openai.review.demo_recording_url; });
  assert.deepEqual(errors(preflight(missing, { final: true })), ['listed_final_review_missing']);
});

// A stand-in for production: path -> { status, location, body }.
const fakeFetch = (pages) => async (url, options) => {
  assert.equal(options.redirect, 'manual');
  const page = pages[new URL(url).pathname];
  if (!page) throw new Error('getaddrinfo ENOTFOUND');
  return new Response(page.body ?? '', { status: page.status ?? 200, headers: page.location ? { location: page.location } : {} });
};
const goodSite = () => {
  const { interface: ui } = manifest().extensions['com.openai'];
  const at = (url) => new URL(url).pathname;
  return {
    [at(ui.websiteURL)]: { body: '<h1>Threadify in ChatGPT</h1>' },
    [at(ui.supportURL)]: { body: '<a href="mailto:learn@saintscoaching.com.au">learn@saintscoaching.com.au</a>' },
    [at(ui.privacyPolicyURL)]: { body: '<title>Privacy Policy | Threadify</title>' },
    [at(ui.termsOfServiceURL)]: { body: '<title>Terms of Service | Threadify</title>' },
    [CHALLENGE_PATH]: { body: 'wyQRNtbgcGrKhuMGZkWfgm5Df10\n' },
  };
};

test('--online passes when every listing page and the challenge answer 200 with the right content', async () => {
  assert.deepEqual(await onlineCheck(realPackage, { fetchImpl: fakeFetch(goodSite()) }), []);
});

test('--online catches a login redirect, a missing email or title, a bad challenge and a dead host', async () => {
  const { interface: ui } = manifest().extensions['com.openai'];
  const site = goodSite();
  site[new URL(ui.websiteURL).pathname] = { status: 303, location: '/login' };
  site[new URL(ui.supportURL).pathname] = { body: '<h1>Help</h1><p>Use the form.</p>' };
  site[new URL(ui.privacyPolicyURL).pathname] = { body: '<h1>Our data</h1>' };
  site[CHALLENGE_PATH] = { body: '{"tokens":["a","b"]}' };
  delete site[new URL(ui.termsOfServiceURL).pathname];
  const codes = errors(await onlineCheck(realPackage, { fetchImpl: fakeFetch(site) }));
  assert.deepEqual(codes, ['listed_online_login_redirect', 'listed_online_missing_email', 'listed_online_missing_title', 'listed_online_fetch_failed', 'listed_online_challenge_invalid']);
});

test('--online reports a plain redirect and a non-200 status', async () => {
  const { interface: ui } = manifest().extensions['com.openai'];
  const site = goodSite();
  site[new URL(ui.websiteURL).pathname] = { status: 301, location: 'https://www.threadify.app/' };
  site[new URL(ui.termsOfServiceURL).pathname] = { status: 404, body: 'Not found' };
  assert.deepEqual(errors(await onlineCheck(realPackage, { fetchImpl: fakeFetch(site) })), ['listed_online_redirect', 'listed_online_status']);
});

test('CI never runs the online check', () => {
  const workflow = fs.readFileSync(fileURLToPath(new URL('../../../.github/workflows/listed.yml', import.meta.url)), 'utf8');
  assert.doesNotMatch(workflow, /--online/);
  assert.doesNotMatch(workflow, /--final/);
});
