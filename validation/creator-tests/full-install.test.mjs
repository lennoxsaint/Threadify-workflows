import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { collectReleaseFiles } from '../../lib/release-files.mjs';
import { install, update, rollback } from '../../lib/installer.mjs';

const source = fileURLToPath(new URL('../..', import.meta.url));
const baseline = '9ff2be949a4fda7238f6ab7e77557cdad84e3925';
function run(command, args, cwd, options = {}) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', ...options });
  assert.equal(result.status, 0, String(result.stderr));
  return result.stdout;
}

test('full source bundles install and upgrade from the recorded v0.4.1 baseline with rollback and private data intact', async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-full-install-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const old = path.join(temp, 'baseline'); const next = path.join(temp, 'next');
  fs.mkdirSync(old); fs.mkdirSync(next);
  const archive = run('git', ['archive', baseline], source, { encoding: null, maxBuffer: 20_000_000 });
  run('tar', ['-xf', '-', '-C', old], temp, { input: archive });
  for (const file of collectReleaseFiles(source)) {
    const target = path.join(next, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(source, file), target, fs.constants.COPYFILE_EXCL);
  }
  // Only the disposable snapshot enables stable builds for installer simulation.
  // The real source keeps publication disabled; this is not a release.
  for (const relative of ['package.json', 'package-lock.json', '.codex-plugin/plugin.json', 'release/release-intent.json']) {
    const file = path.join(next, relative); const value = JSON.parse(fs.readFileSync(file));
    if (relative.startsWith('release/')) {
      value.release_version = '0.5.0'; value.plugin_version = '0.5.0'; value.change_class = 'installer';
      value.release = true;
    } else {
      value.version = '0.5.0';
      if (value.packages?.['']) value.packages[''].version = '0.5.0';
    }
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  }
  for (const script of ['build-qbr-bundle.mjs', 'build-advanced-bundles.mjs']) run(process.execPath, ['scripts/' + script], next);
  run('git', ['init', '-q'], next);
  run('git', ['add', '--all'], next);
  run('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'user.name=Synthetic Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Synthetic install snapshot'], next);
  const env = { ...process.env }; delete env.GITHUB_SHA;
  for (const [name, root] of [['old', old], ['next', next]]) {
    run(process.execPath, ['scripts/build-release-assets.mjs', '--out', path.join(temp, name + '-assets'), ...(name === 'old' ? ['--commit', baseline] : [])], root, { env });
  }
  const release = (name) => ({ sourceBundle: path.join(temp, name + '-assets/threadify-workflows-bundle.json'), sourceManifest: path.join(temp, name + '-assets/stable-release-manifest.json') });
  function box(name) {
    const home = path.join(temp, name); fs.mkdirSync(home);
    return { home, root: path.join(home, '.threadify-workflows'), targets: 'codex', autoUpdate: false,
      env: { ...env, THREADIFY_WORKFLOWS_TEST_MODE: '1', THREADIFY_TEST_PLATFORM: 'darwin' } };
  }
  function verifyCreator(options) {
    const plugin = path.join(options.home, '.codex/plugins/threadify-workflows');
    const manifest = JSON.parse(fs.readFileSync(path.join(plugin, '.codex-plugin/plugin.json')));
    assert.equal(path.resolve(plugin, manifest.skills), path.join(plugin, 'skills'));
    for (const name of ['threadify-vault-setup', 'threadify-create-my-day', 'threadify-create-my-week', 'threadify-create-my-month']) {
      assert.ok(fs.existsSync(path.join(plugin, 'skills', name, 'SKILL.md')));
    }
    const result = run(process.execPath, [path.join(plugin, 'bin/threadify-workflows.mjs'), 'creator', 'status', '--state', path.join(options.home, 'creator-state')], temp, { input: '{}' });
    assert.equal(JSON.parse(result).revision, 0);
  }
  const fresh = box('fresh');
  assert.equal((await install({ ...fresh, ...release('next') })).status, 'installed');
  verifyCreator(fresh);
  const existing = box('existing');
  assert.equal((await install({ ...existing, ...release('old') })).status, 'installed');
  const privateFile = path.join(existing.root, 'user-data', 'owner-note.txt');
  fs.mkdirSync(path.dirname(privateFile), { recursive: true }); fs.writeFileSync(privateFile, 'synthetic private data\n');
  assert.equal((await update({ ...existing, ...release('next') })).status, 'updated_restart_required');
  verifyCreator(existing);
  assert.equal(fs.readFileSync(privateFile, 'utf8'), 'synthetic private data\n');
  rollback(existing);
  const restored = JSON.parse(fs.readFileSync(path.join(existing.home, '.codex/plugins/threadify-workflows/.codex-plugin/plugin.json')));
  assert.equal(restored.version, '0.4.1');
  assert.equal(fs.readFileSync(privateFile, 'utf8'), 'synthetic private data\n');
});
