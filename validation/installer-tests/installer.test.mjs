import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  install,
  rollback,
  status,
  uninstall,
  update,
} from '../../lib/installer.mjs';

function hash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function fixtureRelease(directory, {
  version,
  changeClass = 'installer',
  skillText = `---\nname: threadify-qualified-buyer-research\n---\nversion ${version}\n`,
} = {}) {
  fs.mkdirSync(directory, { recursive: true });
  const commit = hash(Buffer.from(`commit-${version}`)).slice(0, 40);
  const fileContents = {
    'plugin/.codex-plugin/plugin.json': `${JSON.stringify({ name: 'threadify-workflows', version })}\n`,
    'plugin/.agents/plugins/marketplace.json': `${JSON.stringify({
      name: 'threadify-workflows',
      plugins: [{ name: 'threadify-workflows', source: { source: 'local', path: '.' } }],
    })}\n`,
    'plugin/plugins/threadify/skills/threadify-qualified-buyer-research/SKILL.md': skillText,
    'skill/SKILL.md': skillText,
    'skill/references/public-rules.v1.json': `${JSON.stringify({ rules_version: version })}\n`,
    'cli/bin/threadify-workflows.mjs': '#!/usr/bin/env node\n',
    'cli/lib/installer.mjs': 'export const installed = true;\n',
  };
  const files = {};
  for (const [relative, text] of Object.entries(fileContents)) {
    const content = Buffer.from(text);
    files[relative] = {
      sha256: hash(content),
      bytes: content.length,
      mode: relative.endsWith('.mjs') ? '0755' : '0644',
      content_base64: content.toString('base64'),
    };
  }
  const bundle = {
    record_type: 'ThreadifyWorkflowsInstallBundleV1',
    release: {
      release_version: version,
      skill_version: version,
      plugin_version: version,
      rules_version: version,
      commit,
      change_class: changeClass,
    },
    files,
  };
  const rawBundle = Buffer.from(`${JSON.stringify(bundle)}\n`);
  const bundleFile = path.join(directory, `bundle-${version}.json`);
  fs.writeFileSync(bundleFile, rawBundle);
  const manifest = {
    record_type: 'StableReleaseManifestV1',
    release_version: version,
    skill_version: version,
    plugin_version: version,
    rules_version: version,
    commit,
    change_class: changeClass,
    assets: [{
      name: 'threadify-workflows-bundle.json',
      sha256: hash(rawBundle),
      bytes: rawBundle.length,
    }],
  };
  const manifestFile = path.join(directory, `manifest-${version}.json`);
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  return { bundleFile, manifestFile };
}

function sandbox() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'threadify-updater-'));
  const home = path.join(directory, 'home');
  const root = path.join(home, '.threadify-workflows');
  fs.mkdirSync(home, { recursive: true });
  return {
    directory,
    home,
    root,
    env: {
      ...process.env,
      HOME: home,
      THREADIFY_WORKFLOWS_HOME: root,
      THREADIFY_WORKFLOWS_TEST_MODE: '1',
      THREADIFY_TEST_PLATFORM: 'darwin',
    },
  };
}

function nativeCodexFixture(box, failingCommand) {
  const bin = path.join(box.directory, 'bin');
  const calls = path.join(box.directory, 'codex-calls.jsonl');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'codex'), `#!${process.execPath}
import fs from 'node:fs';
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify(args) + '\\n');
if (args.join(' ').startsWith(${JSON.stringify(failingCommand)})) {
  process.stderr.write('synthetic removal denied');
  process.exit(1);
}
process.stdout.write('{}');
`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'package.json'), '{"type":"module"}');
  return {
    ...box.env,
    PATH: `${bin}${path.delimiter}${process.env.PATH}`,
    CODEX_HOME: path.join(box.home, '.codex'),
    THREADIFY_WORKFLOWS_TEST_MODE: '0',
    THREADIFY_TEST_CALLS: calls,
  };
}

for (const operation of ['uninstall', 'target migration']) {
  for (const command of ['plugin remove', 'plugin marketplace remove']) {
    test(`native ${operation} preserves its record when ${command} fails`, async (t) => {
      const box = sandbox();
      t.after(() => fs.rmSync(box.directory, { recursive: true, force: true }));
      const release = fixtureRelease(box.directory, { version: '0.4.1' });
      await install({ home: box.home, root: box.root, env: box.env, targets: 'codex',
        autoUpdate: false, sourceBundle: release.bundleFile, sourceManifest: release.manifestFile });
      const configFile = path.join(box.root, 'config.json');
      const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      config.installed_targets = ['codex-plugin:threadify-workflows@threadify-workflows'];
      fs.writeFileSync(configFile, JSON.stringify(config));
      const env = nativeCodexFixture(box, command);
      if (operation === 'uninstall') {
        assert.throws(() => uninstall({ home: box.home, root: box.root, env }), /synthetic removal denied/);
      } else {
        await assert.rejects(install({ home: box.home, root: box.root, env, targets: 'agents',
          autoUpdate: false, sourceBundle: release.bundleFile, sourceManifest: release.manifestFile }),
        /synthetic removal denied/);
      }
      assert.deepEqual(JSON.parse(fs.readFileSync(configFile, 'utf8')), config);
      const calls = fs.readFileSync(env.THREADIFY_TEST_CALLS, 'utf8').trim().split('\n').map(JSON.parse);
      assert.equal(calls.length, command === 'plugin remove' ? 1 : 2);
    });
  }
}

test('fresh install exposes exactly one native skill in every supported client and a complete Codex plugin', async (t) => {
  const box = sandbox();
  t.after(() => fs.rmSync(box.directory, { recursive: true, force: true }));
  const release = fixtureRelease(box.directory, { version: '0.4.0' });
  const receipt = await install({
    home: box.home,
    root: box.root,
    env: box.env,
    targets: 'all',
    autoUpdate: true,
    sourceBundle: release.bundleFile,
    sourceManifest: release.manifestFile,
  });
  assert.equal(receipt.status, 'installed');
  for (const client of ['codex', 'claude', 'cursor', 'gemini', 'openclaw', 'hermes']) {
    const skill = path.join(box.home, `.${client}`, 'skills', 'threadify-qualified-buyer-research', 'SKILL.md');
    assert.equal(fs.existsSync(skill), true, `${client} skill missing`);
  }
  assert.equal(fs.existsSync(path.join(box.home, '.agents', 'skills', 'threadify-qualified-buyer-research')), false);
  assert.equal(fs.existsSync(path.join(box.home, '.codex', 'plugins', 'threadify-workflows', '.codex-plugin', 'plugin.json')), true);
  assert.equal(fs.existsSync(path.join(box.home, 'Library', 'LaunchAgents', 'com.threadify.workflows.update.plist')), true);
  assert.equal(status({ root: box.root, env: box.env }).status, 'installed');
});

test('universal Agent Skills path remains explicitly supported', async (t) => {
  const box = sandbox();
  t.after(() => fs.rmSync(box.directory, { recursive: true, force: true }));
  const release = fixtureRelease(box.directory, { version: '0.4.1' });
  const receipt = await install({
    home: box.home,
    root: box.root,
    env: box.env,
    targets: 'agents',
    autoUpdate: false,
    sourceBundle: release.bundleFile,
    sourceManifest: release.manifestFile,
  });
  assert.equal(receipt.status, 'installed');
  assert.equal(fs.existsSync(path.join(box.home, '.agents', 'skills', 'threadify-qualified-buyer-research', 'SKILL.md')), true);
});

test('rerunning native all removes a prior managed universal duplicate', async (t) => {
  const box = sandbox();
  t.after(() => fs.rmSync(box.directory, { recursive: true, force: true }));
  const release = fixtureRelease(box.directory, { version: '0.4.1' });
  await install({
    home: box.home,
    root: box.root,
    env: box.env,
    targets: 'claude,agents',
    autoUpdate: false,
    sourceBundle: release.bundleFile,
    sourceManifest: release.manifestFile,
  });
  const universal = path.join(box.home, '.agents', 'skills', 'threadify-qualified-buyer-research');
  assert.equal(fs.existsSync(universal), true);
  const receipt = await install({
    home: box.home,
    root: box.root,
    env: box.env,
    targets: 'all',
    autoUpdate: false,
    sourceBundle: release.bundleFile,
    sourceManifest: release.manifestFile,
  });
  assert.equal(fs.existsSync(universal), false);
  assert.equal(receipt.removed_stale_targets.includes(universal), true);
});

test('frozen beta migration preserves local Offer Context and creates no duplicate target', async (t) => {
  const box = sandbox();
  t.after(() => fs.rmSync(box.directory, { recursive: true, force: true }));
  const legacy = path.join(box.home, '.claude', 'skills', 'threadify-qualified-buyer-research');
  fs.mkdirSync(legacy, { recursive: true });
  fs.writeFileSync(path.join(legacy, 'SKILL.md'), '---\nname: threadify-qualified-buyer-research\n---\nfrozen beta\n');
  fs.writeFileSync(path.join(legacy, 'offer-context.json'), '{"private":"preserve"}\n');
  const release = fixtureRelease(box.directory, { version: '0.4.0' });
  const receipt = await install({
    home: box.home,
    root: box.root,
    env: box.env,
    targets: 'claude',
    autoUpdate: false,
    sourceBundle: release.bundleFile,
    sourceManifest: release.manifestFile,
  });
  assert.equal(receipt.migrated_legacy_installations.includes(legacy), true);
  assert.equal(fs.lstatSync(legacy).isSymbolicLink(), true);
  const preserved = fs.readdirSync(path.join(box.root, 'user-data', 'legacy'), { recursive: true })
    .some((name) => String(name).endsWith('offer-context.json'));
  assert.equal(preserved, true);
  assert.equal(fs.readFileSync(path.join(legacy, 'SKILL.md'), 'utf8').includes('version 0.4.0'), true);
});

test('installer refuses to overwrite an unrelated skill', async (t) => {
  const box = sandbox();
  t.after(() => fs.rmSync(box.directory, { recursive: true, force: true }));
  const target = path.join(box.home, '.claude', 'skills', 'threadify-qualified-buyer-research');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'SKILL.md'), '---\nname: unrelated-skill\n---\n');
  const release = fixtureRelease(box.directory, { version: '0.4.0' });
  await assert.rejects(
    install({
      home: box.home,
      root: box.root,
      env: box.env,
      targets: 'claude',
      autoUpdate: false,
      sourceBundle: release.bundleFile,
      sourceManifest: release.manifestFile,
    }),
    /refusing_to_overwrite_unrelated_target/,
  );
  assert.equal(fs.readFileSync(path.join(target, 'SKILL.md'), 'utf8').includes('unrelated-skill'), true);
});

test('rules-only update reloads, logic update requires restart, and rollback restores exact prior skill', async (t) => {
  const box = sandbox();
  t.after(() => fs.rmSync(box.directory, { recursive: true, force: true }));
  const v040 = fixtureRelease(box.directory, { version: '0.4.0', changeClass: 'installer' });
  const v041 = fixtureRelease(box.directory, { version: '0.4.1', changeClass: 'rules_only' });
  const v050 = fixtureRelease(box.directory, { version: '0.5.0', changeClass: 'skill_logic' });
  await install({ home: box.home, root: box.root, env: box.env, targets: 'claude', autoUpdate: true, sourceBundle: v040.bundleFile, sourceManifest: v040.manifestFile });
  const rulesReceipt = await update({ home: box.home, root: box.root, env: box.env, sourceBundle: v041.bundleFile, sourceManifest: v041.manifestFile });
  assert.equal(rulesReceipt.status, 'rules_reloaded', JSON.stringify(rulesReceipt));
  const logicReceipt = await update({ home: box.home, root: box.root, env: box.env, sourceBundle: v050.bundleFile, sourceManifest: v050.manifestFile });
  assert.equal(logicReceipt.status, 'updated_restart_required');
  assert.equal(fs.readFileSync(path.join(box.home, '.claude', 'skills', 'threadify-qualified-buyer-research', 'SKILL.md'), 'utf8').includes('version 0.5.0'), true);
  const rollbackReceipt = rollback({ home: box.home, root: box.root, env: box.env, version: '0.4.1' });
  assert.equal(rollbackReceipt.status, 'rolled_back');
  assert.equal(fs.readFileSync(path.join(box.home, '.claude', 'skills', 'threadify-qualified-buyer-research', 'SKILL.md'), 'utf8').includes('version 0.4.1'), true);
});

test('offline, checksum mismatch, and process lock preserve last-known-good', async (t) => {
  const box = sandbox();
  t.after(() => fs.rmSync(box.directory, { recursive: true, force: true }));
  const v040 = fixtureRelease(box.directory, { version: '0.4.0' });
  const v041 = fixtureRelease(box.directory, { version: '0.4.1', changeClass: 'rules_only' });
  await install({ home: box.home, root: box.root, env: box.env, targets: 'claude', autoUpdate: true, sourceBundle: v040.bundleFile, sourceManifest: v040.manifestFile });
  const offline = await update({ home: box.home, root: box.root, env: box.env, sourceBundle: path.join(box.directory, 'missing.json'), sourceManifest: v041.manifestFile });
  assert.equal(offline.status, 'update_failed_using_cached_version');
  fs.appendFileSync(v041.bundleFile, 'tamper');
  const mismatch = await update({ home: box.home, root: box.root, env: box.env, sourceBundle: v041.bundleFile, sourceManifest: v041.manifestFile });
  assert.equal(mismatch.status, 'update_failed_using_cached_version');
  const cleanV041 = fixtureRelease(path.join(box.directory, 'clean'), { version: '0.4.1', changeClass: 'rules_only' });
  fs.mkdirSync(path.join(box.root, 'update.lock'));
  const locked = await update({ home: box.home, root: box.root, env: box.env, sourceBundle: cleanV041.bundleFile, sourceManifest: cleanV041.manifestFile });
  assert.equal(locked.status, 'update_failed_using_cached_version');
  assert.equal(locked.fallback, 'update_in_progress');
  assert.equal(status({ root: box.root, env: box.env }).active_versions.release, '0.4.0');
});

test('disabled auto-update performs no on-use mutation and uninstall leaves receipts', async (t) => {
  const box = sandbox();
  t.after(() => fs.rmSync(box.directory, { recursive: true, force: true }));
  const v040 = fixtureRelease(box.directory, { version: '0.4.0' });
  const v041 = fixtureRelease(box.directory, { version: '0.4.1', changeClass: 'rules_only' });
  await install({ home: box.home, root: box.root, env: box.env, targets: 'claude', autoUpdate: false, sourceBundle: v040.bundleFile, sourceManifest: v040.manifestFile });
  const result = await update({ home: box.home, root: box.root, env: box.env, onUse: true, sourceBundle: v041.bundleFile, sourceManifest: v041.manifestFile });
  assert.equal(result.status, 'auto_update_disabled');
  assert.equal(status({ root: box.root, env: box.env }).active_versions.release, '0.4.0');
  const receipt = uninstall({ home: box.home, root: box.root, env: box.env });
  assert.equal(receipt.status, 'uninstalled');
  assert.equal(fs.existsSync(path.join(box.root, 'receipts')), true);
  assert.equal(fs.existsSync(path.join(box.home, '.claude', 'skills', 'threadify-qualified-buyer-research')), false);
});
