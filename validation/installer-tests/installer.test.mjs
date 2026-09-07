import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
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
      ...(process.platform === 'win32' ? { USERPROFILE: home } : {}),
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
  const handler = `const fs = require('node:fs');
function runFake(args) {
fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify(args) + '\\n');
fs.appendFileSync(${JSON.stringify(`${calls}.environment`)}, JSON.stringify({ home: process.env.HOME, codexHome: process.env.CODEX_HOME }) + '\\n');
if (args.join(' ').startsWith(process.env.THREADIFY_TEST_FAIL_COMMAND)) {
  process.stderr.write('synthetic removal denied');
  process.exit(1);
}
process.stdout.write(args.join(' ') === 'plugin marketplace list --json'
  ? (process.env.THREADIFY_TEST_MARKETPLACES || '{"marketplaces":[]}') : '{}');
process.exit(0);
}
`;
  let preload = {};
  if (process.platform === 'win32') {
    // spawnSync requires an executable, not a .cmd file with implicit shell use.
    // Run a private Node executable with a guarded preload instead of skipping native-path tests.
    fs.copyFileSync(process.execPath, path.join(bin, 'codex.exe'));
    const script = path.join(bin, 'codex-probe.cjs');
    fs.writeFileSync(script, handler + `if (require('node:path').basename(process.execPath).toLowerCase() === 'codex.exe') runFake(['plugin', ...process.argv.slice(2)]);\n`);
    preload = { NODE_OPTIONS: `--require "${script.replaceAll('\\', '/')}"` };
  } else {
    fs.writeFileSync(path.join(bin, 'codex'), `#!${process.execPath}\n${handler}runFake(process.argv.slice(2));\n`, { mode: 0o755 });
  }
  fs.writeFileSync(path.join(bin, 'package.json'), '{"type":"commonjs"}');
  return {
    ...box.env,
    ...preload,
    PATH: `${bin}${path.delimiter}${process.env.PATH}`,
    CODEX_HOME: path.join(box.home, '.codex'),
    THREADIFY_WORKFLOWS_TEST_MODE: '0',
    THREADIFY_TEST_CALLS: calls,
    THREADIFY_TEST_FAIL_COMMAND: failingCommand,
  };
}

test('alternate-home native install does not inherit another Codex configuration target', async (t) => {
  const box = sandbox();
  t.after(() => fs.rmSync(box.directory, { recursive: true, force: true }));
  const release = fixtureRelease(box.directory, { version: '0.5.0' });
  const env = nativeCodexFixture(box, 'never-match');
  env.CODEX_HOME = path.join(box.directory, 'other-codex');
  await install({ home: box.home, root: box.root, env, targets: 'codex', autoUpdate: false,
    sourceBundle: release.bundleFile, sourceManifest: release.manifestFile });
  const environments = fs.readFileSync(`${env.THREADIFY_TEST_CALLS}.environment`, 'utf8').trim().split('\n').map(JSON.parse);
  assert.ok(environments.length > 0);
  for (const observed of environments) {
    assert.equal(observed.home, box.home);
    assert.equal(observed.codexHome, path.join(box.home, '.codex'));
  }
  assert.equal(fs.existsSync(env.CODEX_HOME), false);
  const calls = fs.readFileSync(env.THREADIFY_TEST_CALLS, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(calls.some((args) => args[1] === 'remove'), false, 'install must not uninstall the existing plugin');
  assert.equal(calls.some((args) => args[1] === 'marketplace' && args[2] === 'remove'), false);
});

test('native install refuses a same-name marketplace outside its managed releases', async (t) => {
  const box = sandbox();
  t.after(() => fs.rmSync(box.directory, { recursive: true, force: true }));
  const release = fixtureRelease(box.directory, { version: '0.5.0' });
  const env = nativeCodexFixture(box, 'never-match');
  env.THREADIFY_TEST_MARKETPLACES = JSON.stringify({ marketplaces: [{ name: 'threadify-workflows',
    root: box.directory, marketplaceSource: { sourceType: 'local', source: box.directory } }] });
  await assert.rejects(install({ home: box.home, root: box.root, env, targets: 'codex', autoUpdate: false,
    sourceBundle: release.bundleFile, sourceManifest: release.manifestFile }), /unmanaged_codex_marketplace/);
  const calls = fs.readFileSync(env.THREADIFY_TEST_CALLS, 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(calls, [['plugin', 'marketplace', 'list', '--json']]);
});

test('native update replaces only a verified managed marketplace without removing the plugin', async (t) => {
  const box = sandbox();
  t.after(() => fs.rmSync(box.directory, { recursive: true, force: true }));
  const oldRelease = fixtureRelease(box.directory, { version: '0.4.1' });
  const newRelease = fixtureRelease(box.directory, { version: '0.5.0' });
  await install({ home: box.home, root: box.root, env: box.env, targets: 'codex', autoUpdate: false,
    sourceBundle: oldRelease.bundleFile, sourceManifest: oldRelease.manifestFile });
  const env = nativeCodexFixture(box, 'never-match');
  const source = path.join(box.root, 'releases', '0.4.1', 'plugin');
  env.THREADIFY_TEST_MARKETPLACES = JSON.stringify({ marketplaces: [{ name: 'threadify-workflows',
    root: source, marketplaceSource: { sourceType: 'local', source } }] });
  await install({ home: box.home, root: box.root, env, targets: 'codex', autoUpdate: false,
    sourceBundle: newRelease.bundleFile, sourceManifest: newRelease.manifestFile });
  const calls = fs.readFileSync(env.THREADIFY_TEST_CALLS, 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(calls.map((args) => args.slice(0, 3)), [
    ['plugin', 'marketplace', 'list'], ['plugin', 'marketplace', 'remove'],
    ['plugin', 'marketplace', 'add'], ['plugin', 'add', 'threadify-workflows@threadify-workflows'],
  ]);
});

test('normal-home native install preserves an intentional custom CODEX_HOME', (t) => {
  const box = sandbox();
  t.after(() => fs.rmSync(box.directory, { recursive: true, force: true }));
  const release = fixtureRelease(box.directory, { version: '0.5.0' });
  const env = nativeCodexFixture(box, 'never-match');
  env.CODEX_HOME = path.join(box.directory, 'custom-codex');
  const options = { root: box.root, targets: 'codex', autoUpdate: false,
    sourceBundle: release.bundleFile, sourceManifest: release.manifestFile };
  const script = `import { install } from ${JSON.stringify(new URL('../../lib/installer.mjs', import.meta.url).href)};
await install(${JSON.stringify(options)});`;
  // The child's actual home is the sandbox. No operation addresses the test runner's home.
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const environments = fs.readFileSync(`${env.THREADIFY_TEST_CALLS}.environment`, 'utf8').trim().split('\n').map(JSON.parse);
  assert.ok(environments.length > 0);
  for (const observed of environments) {
    assert.equal(observed.home, box.home);
    assert.equal(observed.codexHome, env.CODEX_HOME);
  }
});

test('failed native update keeps the active pointer and requires reconciliation before another update', async (t) => {
  const box = sandbox();
  t.after(() => fs.rmSync(box.directory, { recursive: true, force: true }));
  const oldRelease = fixtureRelease(box.directory, { version: '0.4.1' });
  const newRelease = fixtureRelease(box.directory, { version: '0.5.0' });
  await install({ home: box.home, root: box.root, env: box.env, targets: 'codex',
    autoUpdate: false, sourceBundle: oldRelease.bundleFile, sourceManifest: oldRelease.manifestFile });
  const pointer = fs.realpathSync(path.join(box.root, 'current'));
  const env = nativeCodexFixture(box, 'plugin marketplace add');
  const options = { home: box.home, root: box.root, env,
    sourceBundle: newRelease.bundleFile, sourceManifest: newRelease.manifestFile };
  const failed = await update(options);
  assert.equal(failed.status, 'update_failed_requires_recovery');
  assert.equal(failed.new_versions, null);
  assert.deepEqual(failed.installed_targets, []);
  assert.equal(fs.realpathSync(path.join(box.root, 'current')), pointer);
  assert.equal(status({ root: box.root }).status, 'installation_requires_recovery');
  const calls = fs.readFileSync(env.THREADIFY_TEST_CALLS, 'utf8');
  assert.equal((await update(options)).status, 'update_failed_requires_recovery');
  assert.equal(fs.readFileSync(env.THREADIFY_TEST_CALLS, 'utf8'), calls);
  await install({ ...options, targets: 'codex', autoUpdate: false,
    env: { ...env, THREADIFY_TEST_FAIL_COMMAND: 'never-match' } });
  assert.equal(status({ root: box.root }).status, 'installed_unverified');
  assert.equal(fs.realpathSync(path.join(box.root, 'current')), fs.realpathSync(path.join(box.root, 'releases', '0.5.0')));
});

test('failed native rollback does not switch the pointer or claim a healthy installation', async (t) => {
  const box = sandbox();
  t.after(() => fs.rmSync(box.directory, { recursive: true, force: true }));
  for (const version of ['0.4.1', '0.5.0']) {
    const release = fixtureRelease(box.directory, { version });
    await install({ home: box.home, root: box.root, env: box.env, targets: 'codex',
      autoUpdate: false, sourceBundle: release.bundleFile, sourceManifest: release.manifestFile });
  }
  const pointer = fs.realpathSync(path.join(box.root, 'current'));
  const env = nativeCodexFixture(box, 'plugin add');
  assert.throws(() => rollback({ home: box.home, root: box.root, env, version: '0.4.1' }), /codex_plugin_install_failed/);
  assert.equal(fs.realpathSync(path.join(box.root, 'current')), pointer);
  assert.equal(status({ root: box.root }).status, 'installation_requires_recovery');
});

test('an unreadable mutation marker blocks automatic update without fetching or changing clients', async (t) => {
  const box = sandbox();
  t.after(() => fs.rmSync(box.directory, { recursive: true, force: true }));
  const release = fixtureRelease(box.directory, { version: '0.4.1' });
  await install({ home: box.home, root: box.root, env: box.env, targets: 'claude',
    autoUpdate: true, sourceBundle: release.bundleFile, sourceManifest: release.manifestFile });
  fs.writeFileSync(path.join(box.root, 'mutation.json'), '{broken');
  const result = await update({ home: box.home, root: box.root, env: box.env, onUse: true,
    sourceManifest: path.join(box.directory, 'must-not-read.json') });
  assert.equal(result.status, 'update_failed_requires_recovery');
  assert.equal(result.recovery.status, 'unreadable');
  assert.equal(status({ root: box.root }).status, 'installation_requires_recovery');
});

test('native targets remain unverified in local status and empty targets are not installed', async (t) => {
  const box = sandbox();
  t.after(() => fs.rmSync(box.directory, { recursive: true, force: true }));
  const release = fixtureRelease(box.directory, { version: '0.5.0' });
  await install({ home: box.home, root: box.root, env: box.env, targets: 'codex', autoUpdate: false,
    sourceBundle: release.bundleFile, sourceManifest: release.manifestFile });
  const file = path.join(box.root, 'config.json');
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  config.installed_targets = ['codex-plugin:threadify-workflows@threadify-workflows'];
  fs.writeFileSync(file, JSON.stringify(config));
  const result = status({ root: box.root });
  assert.equal(result.status, 'installed_unverified');
  assert.equal(result.targets[0].exists, null);
  assert.equal(result.targets[0].verification, 'native_readback_required');
  uninstall({ home: box.home, root: box.root, env: box.env });
  assert.equal(status({ root: box.root }).status, 'not_installed');
});

test('uninstall cannot mutate targets while another update holds the lock', async (t) => {
  const box = sandbox();
  t.after(() => fs.rmSync(box.directory, { recursive: true, force: true }));
  const release = fixtureRelease(box.directory, { version: '0.5.0' });
  await install({ home: box.home, root: box.root, env: box.env, targets: 'claude', autoUpdate: false,
    sourceBundle: release.bundleFile, sourceManifest: release.manifestFile });
  fs.mkdirSync(path.join(box.root, 'update.lock'));
  assert.throws(() => uninstall({ home: box.home, root: box.root, env: box.env }), /update_in_progress/);
  assert.equal(status({ root: box.root }).status, 'installed');
});

test('an aged lock owned by a live process cannot be stolen', async (t) => {
  const box = sandbox();
  t.after(() => fs.rmSync(box.directory, { recursive: true, force: true }));
  const release = fixtureRelease(box.directory, { version: '0.5.0' });
  const lock = path.join(box.root, 'update.lock');
  fs.mkdirSync(lock, { recursive: true });
  fs.writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ pid: process.pid }));
  const old = new Date(Date.now() - 60 * 60 * 1000);
  fs.utimesSync(lock, old, old);
  await assert.rejects(install({ home: box.home, root: box.root, env: box.env, targets: 'claude', autoUpdate: false,
    sourceBundle: release.bundleFile, sourceManifest: release.manifestFile }), /update_in_progress/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(lock, 'owner.json'), 'utf8')).pid, process.pid);
});

for (const lockState of ['dead owner', 'unknown owner', 'recovery already held']) {
  test(`aged update lock recovery handles ${lockState}`, async (t) => {
    const box = sandbox();
    t.after(() => fs.rmSync(box.directory, { recursive: true, force: true }));
    const release = fixtureRelease(box.directory, { version: '0.5.0' });
    const lock = path.join(box.root, 'update.lock');
    fs.mkdirSync(lock, { recursive: true });
    if (lockState === 'dead owner') {
      const child = spawnSync(process.execPath, ['-e', 'console.log(process.pid)'], { encoding: 'utf8' });
      assert.equal(child.status, 0);
      fs.writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ pid: Number(child.stdout.trim()) }));
    }
    if (lockState === 'recovery already held') fs.mkdirSync(path.join(box.root, 'update-recovery.lock'));
    const old = new Date(Date.now() - 60 * 60 * 1000);
    fs.utimesSync(lock, old, old);
    const attempt = install({ home: box.home, root: box.root, env: box.env, targets: 'claude', autoUpdate: false,
      sourceBundle: release.bundleFile, sourceManifest: release.manifestFile });
    if (lockState === 'dead owner') {
      assert.equal((await attempt).status, 'installed');
      assert.equal(fs.existsSync(lock), false);
      assert.equal(fs.existsSync(path.join(box.root, 'update-recovery.lock')), false);
    } else {
      await assert.rejects(attempt, lockState === 'unknown owner' ? /update_lock_owner_unverified/ : /update_in_progress/);
      assert.equal(fs.existsSync(lock), true);
    }
  });
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
