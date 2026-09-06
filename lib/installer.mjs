import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const REPOSITORY = 'lennoxsaint/Threadify-workflows';
export const SKILL_NAME = 'threadify-qualified-buyer-research';
export const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const LOCK_STALE_MS = 15 * 60 * 1000;
const RETAIN_RELEASES = 3;
const CONTEXT_PATTERN = /(offer.?context|voice.?context|outcome|history|buyer.?language|lead.?desk)/i;

export const CLIENTS = {
  codex: { root: '.codex', skills: '.codex/skills', binaries: ['codex'], completePlugin: true },
  claude: { root: '.claude', skills: '.claude/skills', binaries: ['claude'] },
  cursor: { root: '.cursor', skills: '.cursor/skills', binaries: ['cursor'] },
  gemini: { root: '.gemini', skills: '.gemini/skills', binaries: ['gemini'] },
  openclaw: { root: '.openclaw', skills: '.openclaw/skills', binaries: ['openclaw'] },
  hermes: { root: '.hermes', skills: '.hermes/skills', binaries: ['hermes'] },
  agents: { root: '.agents', skills: '.agents/skills', binaries: [] },
};

export function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function stateRoot(env = process.env) {
  return env.THREADIFY_WORKFLOWS_HOME
    ? path.resolve(env.THREADIFY_WORKFLOWS_HOME)
    : path.join(os.homedir(), '.threadify-workflows');
}

export function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.next-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

function executableExists(name, env = process.env) {
  const result = spawnSync(process.platform === 'win32' ? 'where' : 'sh', process.platform === 'win32'
    ? [name]
    : ['-c', `command -v "${name}" >/dev/null 2>&1`], { env, stdio: 'ignore' });
  return result.status === 0;
}

export function detectClients({ home = os.homedir(), requested = null, env = process.env } = {}) {
  if (requested) {
    const names = requested === 'all'
      ? Object.keys(CLIENTS).filter((name) => name !== 'agents')
      : String(requested).split(',').map((item) => item.trim()).filter(Boolean);
    for (const name of names) {
      if (!CLIENTS[name]) throw new Error(`unsupported_client:${name}`);
    }
    return [...new Set(names)];
  }
  const detected = Object.entries(CLIENTS)
    .filter(([name, client]) => {
      if (name === 'agents') return fs.existsSync(path.join(home, client.root));
      return fs.existsSync(path.join(home, client.root))
        || client.binaries.some((binary) => executableExists(binary, env));
    })
    .map(([name]) => name);
  return detected.length ? detected : ['agents'];
}

function validateReleaseManifest(manifest) {
  if (manifest?.record_type !== 'StableReleaseManifestV1') throw new Error('invalid_release_manifest_type');
  for (const field of ['release_version', 'skill_version', 'plugin_version', 'rules_version', 'commit', 'change_class']) {
    if (!manifest[field]) throw new Error(`invalid_release_manifest_missing_${field}`);
  }
  if (!/^[0-9a-f]{40}$/.test(manifest.commit)) throw new Error('invalid_release_commit');
  if (!['rules_only', 'skill_logic', 'installer'].includes(manifest.change_class)) {
    throw new Error('invalid_release_change_class');
  }
  if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) throw new Error('invalid_release_assets');
}

function validateBundle(bundle, manifest, rawBundle) {
  if (bundle?.record_type !== 'ThreadifyWorkflowsInstallBundleV1') throw new Error('invalid_bundle_type');
  if (bundle.release?.release_version !== manifest.release_version) throw new Error('bundle_release_version_mismatch');
  if (bundle.release?.commit !== manifest.commit) throw new Error('bundle_commit_mismatch');
  const asset = manifest.assets.find((item) => item.name === 'threadify-workflows-bundle.json');
  if (!asset) throw new Error('bundle_asset_missing_from_manifest');
  if (sha256(rawBundle) !== asset.sha256) throw new Error('bundle_checksum_mismatch');
  if (rawBundle.length !== asset.bytes) throw new Error('bundle_size_mismatch');
  if (!bundle.files || typeof bundle.files !== 'object') throw new Error('bundle_files_missing');
  for (const [relative, entry] of Object.entries(bundle.files)) {
    if (path.isAbsolute(relative) || relative.split('/').includes('..')) throw new Error(`unsafe_bundle_path:${relative}`);
    const content = Buffer.from(entry.content_base64, 'base64');
    if (sha256(content) !== entry.sha256) throw new Error(`bundle_file_checksum_mismatch:${relative}`);
  }
}

async function download(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'threadify-workflows-updater',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`download_failed_${response.status}:${url}`);
  return Buffer.from(await response.arrayBuffer());
}

export async function fetchLatestStable({ sourceBundle, sourceManifest } = {}) {
  if (sourceBundle) {
    const rawBundle = fs.readFileSync(path.resolve(sourceBundle));
    const bundle = JSON.parse(rawBundle.toString('utf8'));
    const manifest = sourceManifest
      ? JSON.parse(fs.readFileSync(path.resolve(sourceManifest), 'utf8'))
      : bundle.release_manifest;
    validateReleaseManifest(manifest);
    validateBundle(bundle, manifest, rawBundle);
    return { bundle, manifest, rawBundle, releaseUrl: `file://${path.resolve(sourceBundle)}` };
  }

  const releaseResponse = await fetch(`https://api.github.com/repos/${REPOSITORY}/releases/latest`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'threadify-workflows-updater',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!releaseResponse.ok) throw new Error(`release_lookup_failed_${releaseResponse.status}`);
  const release = await releaseResponse.json();
  const byName = new Map((release.assets ?? []).map((asset) => [asset.name, asset.browser_download_url]));
  const manifestUrl = byName.get('stable-release-manifest.json');
  const bundleUrl = byName.get('threadify-workflows-bundle.json');
  if (!manifestUrl || !bundleUrl) throw new Error('stable_release_assets_missing');
  const [rawManifest, rawBundle] = await Promise.all([download(manifestUrl), download(bundleUrl)]);
  const manifest = JSON.parse(rawManifest.toString('utf8'));
  const bundle = JSON.parse(rawBundle.toString('utf8'));
  validateReleaseManifest(manifest);
  validateBundle(bundle, manifest, rawBundle);
  return { bundle, manifest, rawBundle, releaseUrl: release.html_url };
}

function acquireLock(root) {
  fs.mkdirSync(root, { recursive: true });
  const lock = path.join(root, 'update.lock');
  try {
    fs.mkdirSync(lock);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const age = Date.now() - fs.statSync(lock).mtimeMs;
    if (age <= LOCK_STALE_MS) throw new Error('update_in_progress');
    fs.rmSync(lock, { recursive: true, force: true });
    fs.mkdirSync(lock);
  }
  fs.writeFileSync(path.join(lock, 'owner.json'), `${JSON.stringify({ pid: process.pid, created_at: new Date().toISOString() })}\n`);
  return () => fs.rmSync(lock, { recursive: true, force: true });
}

function materializeRelease(root, bundle, manifest) {
  const releases = path.join(root, 'releases');
  const destination = path.join(releases, manifest.release_version);
  if (fs.existsSync(destination)) return destination;
  fs.mkdirSync(releases, { recursive: true });
  const staging = path.join(releases, `.staging-${manifest.release_version}-${process.pid}`);
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });
  for (const [relative, entry] of Object.entries(bundle.files)) {
    const file = path.join(staging, ...relative.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(entry.content_base64, 'base64'));
    if (entry.mode) fs.chmodSync(file, Number.parseInt(entry.mode, 8));
  }
  writeJsonAtomic(path.join(staging, 'release-manifest.json'), manifest);
  writeJsonAtomic(path.join(staging, '.threadify-workflows-managed.json'), {
    managed: true,
    release_version: manifest.release_version,
  });
  fs.renameSync(staging, destination);
  return destination;
}

function replaceLink(target, source, type = 'dir') {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const next = `${target}.next-${process.pid}`;
  const previous = `${target}.previous-${process.pid}`;
  fs.rmSync(next, { recursive: true, force: true });
  if (process.platform === 'win32') fs.symlinkSync(source, next, 'junction');
  else fs.symlinkSync(source, next, type);
  if (fs.existsSync(target) || fs.lstatSync(path.dirname(target)).isDirectory() && (() => {
    try { return fs.lstatSync(target).isSymbolicLink(); } catch { return false; }
  })()) {
    fs.renameSync(target, previous);
  }
  fs.renameSync(next, target);
  fs.rmSync(previous, { recursive: true, force: true });
}

function isManagedTarget(target, root) {
  if (!fs.existsSync(target)) return true;
  try {
    if (fs.lstatSync(target).isSymbolicLink()) {
      const resolved = fs.realpathSync(target);
      const releasesRoot = fs.existsSync(path.join(root, 'releases'))
        ? fs.realpathSync(path.join(root, 'releases'))
        : path.resolve(root, 'releases');
      return resolved.startsWith(`${releasesRoot}${path.sep}`);
    }
  } catch {
    return false;
  }
  if (fs.existsSync(path.join(target, '.threadify-workflows-managed.json'))) return true;
  const skill = path.join(target, 'SKILL.md');
  if (fs.existsSync(skill) && fs.readFileSync(skill, 'utf8').includes('name: threadify-qualified-buyer-research')) {
    return true;
  }
  return false;
}

function preserveLocalContext(target, root) {
  if (!fs.existsSync(target) || fs.lstatSync(target).isSymbolicLink()) return [];
  const preserved = [];
  const destinationRoot = path.join(root, 'user-data', 'legacy', `${Date.now()}-${path.basename(path.dirname(target))}`);
  function walk(current, relative = '') {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const nextRelative = path.join(relative, entry.name);
      const source = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (['state', 'data'].includes(entry.name.toLowerCase()) || CONTEXT_PATTERN.test(entry.name)) {
          const destination = path.join(destinationRoot, nextRelative);
          fs.mkdirSync(path.dirname(destination), { recursive: true });
          fs.cpSync(source, destination, { recursive: true });
          preserved.push(source);
        } else {
          walk(source, nextRelative);
        }
      } else if (CONTEXT_PATTERN.test(entry.name)) {
        const destination = path.join(destinationRoot, nextRelative);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(source, destination);
        preserved.push(source);
      }
    }
  }
  walk(target);
  return preserved;
}

function runCodex(args, home, env) {
  const result = spawnSync('codex', args, {
    encoding: 'utf8',
    env: { ...env, HOME: home },
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: String(result.stdout ?? '').trim(),
    stderr: String(result.stderr ?? '').trim(),
  };
}

function installCodexPlugin({ home, releaseDir, root, env, testMode }) {
  const pluginSource = path.join(releaseDir, 'plugin');
  if (testMode || !executableExists('codex', env)) {
    const pluginTarget = path.join(home, '.codex', 'plugins', 'threadify-workflows');
    if (!isManagedTarget(pluginTarget, root)) throw new Error(`refusing_to_overwrite_unrelated_target:${pluginTarget}`);
    preserveLocalContext(pluginTarget, root);
    replaceLink(pluginTarget, pluginSource);
    const skillTarget = path.join(home, '.codex', 'skills', SKILL_NAME);
    if (!isManagedTarget(skillTarget, root)) throw new Error(`refusing_to_overwrite_unrelated_target:${skillTarget}`);
    preserveLocalContext(skillTarget, root);
    replaceLink(skillTarget, path.join(releaseDir, 'skill'));
    return [pluginTarget, skillTarget];
  }

  runCodex(['plugin', 'remove', 'threadify-workflows@threadify-workflows', '--json'], home, env);
  runCodex(['plugin', 'marketplace', 'remove', 'threadify-workflows', '--json'], home, env);
  const addMarketplace = runCodex(['plugin', 'marketplace', 'add', pluginSource, '--json'], home, env);
  if (!addMarketplace.ok) throw new Error(`codex_marketplace_install_failed:${addMarketplace.stderr || addMarketplace.stdout}`);
  const addPlugin = runCodex(['plugin', 'add', 'threadify-workflows@threadify-workflows', '--json'], home, env);
  if (!addPlugin.ok) throw new Error(`codex_plugin_install_failed:${addPlugin.stderr || addPlugin.stdout}`);
  return ['codex-plugin:threadify-workflows@threadify-workflows'];
}

function installTargets({ home, clients, releaseDir, root, env, testMode }) {
  const installed = [];
  for (const name of clients) {
    if (name === 'codex') {
      installed.push(...installCodexPlugin({ home, releaseDir, root, env, testMode }));
      continue;
    }
    const target = path.join(home, CLIENTS[name].skills, SKILL_NAME);
    if (!isManagedTarget(target, root)) throw new Error(`refusing_to_overwrite_unrelated_target:${target}`);
    preserveLocalContext(target, root);
    replaceLink(target, path.join(releaseDir, 'skill'));
    installed.push(target);
  }
  return installed;
}

function removeCodexPlugin({ home, env, testMode }) {
  if (testMode) return;
  if (!executableExists('codex', env)) throw new Error('codex_plugin_removal_unavailable:codex_not_found');
  const plugin = runCodex(['plugin', 'remove', 'threadify-workflows@threadify-workflows', '--json'], home, env);
  if (!plugin.ok) throw new Error(`codex_plugin_removal_failed:${plugin.stderr || plugin.stdout || plugin.status}`);
  const marketplace = runCodex(['plugin', 'marketplace', 'remove', 'threadify-workflows', '--json'], home, env);
  if (!marketplace.ok) throw new Error(`codex_marketplace_removal_failed:${marketplace.stderr || marketplace.stdout || marketplace.status}`);
}

function removeStaleTargets({ previousTargets, installedTargets, root, home, env, testMode }) {
  const current = new Set(installedTargets);
  const removed = [];
  for (const target of previousTargets ?? []) {
    if (current.has(target)) continue;
    if (target.startsWith('codex-plugin:')) {
      if (!installedTargets.some((item) => item.startsWith('codex-plugin:'))) {
        removeCodexPlugin({ home, env, testMode });
        removed.push(target);
      }
      continue;
    }
    if (isManagedTarget(target, root)) {
      fs.rmSync(target, { recursive: true, force: true });
      removed.push(target);
    }
  }
  return removed;
}

function schedulerFiles(home) {
  return {
    launchAgent: path.join(home, 'Library', 'LaunchAgents', 'com.threadify.workflows.update.plist'),
    systemd: path.join(home, '.config', 'systemd', 'user', 'threadify-workflows-update.service'),
    timer: path.join(home, '.config', 'systemd', 'user', 'threadify-workflows-update.timer'),
    cron: path.join(home, '.threadify-workflows', 'scheduler', 'cron.txt'),
  };
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function installScheduler({ home, root, env, testMode }) {
  const cli = path.join(root, 'current', 'cli', 'bin', 'threadify-workflows.mjs');
  const node = process.execPath;
  const files = schedulerFiles(home);
  fs.mkdirSync(path.join(root, 'scheduler'), { recursive: true });
  if (process.platform === 'darwin' || env.THREADIFY_TEST_PLATFORM === 'darwin') {
    fs.mkdirSync(path.dirname(files.launchAgent), { recursive: true });
    fs.writeFileSync(files.launchAgent, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.threadify.workflows.update</string>
<key>ProgramArguments</key><array><string>${node}</string><string>${cli}</string><string>update</string><string>--scheduled</string><string>--json</string></array>
<key>StartCalendarInterval</key><dict><key>Hour</key><integer>9</integer><key>Minute</key><integer>0</integer></dict>
<key>RunAtLoad</key><false/>
<key>StandardOutPath</key><string>${path.join(root, 'scheduler', 'stdout.log')}</string>
<key>StandardErrorPath</key><string>${path.join(root, 'scheduler', 'stderr.log')}</string>
</dict></plist>
`);
    if (!testMode) {
      spawnSync('launchctl', ['bootout', `gui/${process.getuid?.() ?? 0}`, files.launchAgent], { stdio: 'ignore' });
      const result = spawnSync('launchctl', ['bootstrap', `gui/${process.getuid?.() ?? 0}`, files.launchAgent], { encoding: 'utf8' });
      if (result.status !== 0) throw new Error(`launchagent_install_failed:${String(result.stderr).trim()}`);
    }
    return { type: 'launchagent', files: [files.launchAgent] };
  }
  if (process.platform === 'win32' || env.THREADIFY_TEST_PLATFORM === 'win32') {
    const command = `"${node}" "${cli}" update --scheduled --json`;
    if (!testMode) {
      const result = spawnSync('schtasks', ['/Create', '/F', '/SC', 'DAILY', '/ST', '09:00', '/TN', 'ThreadifyWorkflowsUpdate', '/TR', command], { encoding: 'utf8' });
      if (result.status !== 0) throw new Error(`task_scheduler_install_failed:${String(result.stderr).trim()}`);
    }
    writeJsonAtomic(path.join(root, 'scheduler', 'windows-task.json'), { task: 'ThreadifyWorkflowsUpdate', command });
    return { type: 'task_scheduler', files: [path.join(root, 'scheduler', 'windows-task.json')] };
  }

  fs.mkdirSync(path.dirname(files.systemd), { recursive: true });
  fs.writeFileSync(files.systemd, `[Unit]\nDescription=Update Threadify Workflows stable skills\n\n[Service]\nType=oneshot\nExecStart=${node} ${cli} update --scheduled --json\n`);
  fs.writeFileSync(files.timer, '[Unit]\nDescription=Daily Threadify Workflows stable update\n\n[Timer]\nOnCalendar=*-*-* 09:00:00\nPersistent=true\nRandomizedDelaySec=1800\n\n[Install]\nWantedBy=timers.target\n');
  if (!testMode) {
    const result = spawnSync('systemctl', ['--user', 'enable', '--now', 'threadify-workflows-update.timer'], { encoding: 'utf8' });
    if (result.status !== 0) {
      const cron = `0 9 * * * ${shellQuote(node)} ${shellQuote(cli)} update --scheduled --json\n`;
      fs.writeFileSync(files.cron, cron);
      return { type: 'cron_fallback', files: [files.cron] };
    }
  }
  return { type: 'systemd_user_timer', files: [files.systemd, files.timer] };
}

function removeScheduler({ home, env, testMode }) {
  const files = schedulerFiles(home);
  if (!testMode && process.platform === 'darwin' && fs.existsSync(files.launchAgent)) {
    spawnSync('launchctl', ['bootout', `gui/${process.getuid?.() ?? 0}`, files.launchAgent], { stdio: 'ignore' });
  }
  if (!testMode && process.platform === 'win32') {
    spawnSync('schtasks', ['/Delete', '/F', '/TN', 'ThreadifyWorkflowsUpdate'], { stdio: 'ignore' });
  }
  if (!testMode && process.platform === 'linux') {
    spawnSync('systemctl', ['--user', 'disable', '--now', 'threadify-workflows-update.timer'], { stdio: 'ignore' });
  }
  for (const file of Object.values(files)) fs.rmSync(file, { force: true });
  fs.rmSync(path.join(stateRoot(env), 'scheduler', 'windows-task.json'), { force: true });
}

function writeReceipt(root, receipt) {
  const complete = {
    record_type: 'UpdateReceiptV1',
    checked_at: new Date().toISOString(),
    previous_versions: null,
    new_versions: null,
    installed_targets: [],
    verified_hashes: [],
    fallback: null,
    rollback_state: {},
    ...receipt,
  };
  const directory = path.join(root, 'receipts');
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, `${complete.checked_at.replaceAll(':', '-')}-${complete.status}.json`);
  writeJsonAtomic(file, complete);
  return { ...complete, receipt_file: file };
}

function activateRelease(root, releaseDir) {
  replaceLink(path.join(root, 'current'), releaseDir);
}

function pendingMutation(root) {
  const file = path.join(root, 'mutation.json');
  if (!fs.existsSync(file)) return null;
  const record = readJson(file);
  return record?.status === 'completed' ? null : (record ?? { status: 'unreadable' });
}

function recordMutation(root, operation, status, release = null) {
  writeJsonAtomic(path.join(root, 'mutation.json'), {
    operation, status, release, recorded_at: new Date().toISOString(),
  });
}

function recoveryReceipt(root, config, reason = 'unresolved_installation_mutation') {
  return writeReceipt(root, {
    status: 'update_failed_requires_recovery',
    previous_versions: config.active_versions ?? null,
    new_versions: null,
    installed_targets: [],
    fallback: reason,
    recovery: pendingMutation(root),
    rollback_state: { available: (config.release_history ?? []).map((item) => item.release) },
  });
}

function versions(manifest) {
  return {
    release: manifest.release_version,
    skill: manifest.skill_version,
    plugin: manifest.plugin_version,
    rules: manifest.rules_version,
    commit: manifest.commit,
    change_class: manifest.change_class,
  };
}

function cleanupOldReleases(root, history) {
  const keep = new Set(history.slice(0, RETAIN_RELEASES).map((item) => item.release));
  const releases = path.join(root, 'releases');
  if (!fs.existsSync(releases)) return;
  for (const name of fs.readdirSync(releases)) {
    if (name.startsWith('.')) continue;
    if (!keep.has(name)) fs.rmSync(path.join(releases, name), { recursive: true, force: true });
  }
}

function migrationCandidates(home) {
  return Object.values(CLIENTS).map((client) => path.join(home, client.skills, SKILL_NAME));
}

export async function install(options = {}) {
  const env = options.env ?? process.env;
  const home = options.home ?? os.homedir();
  const root = options.root ?? stateRoot(env);
  const testMode = env.THREADIFY_WORKFLOWS_TEST_MODE === '1';
  const release = options.release ?? await fetchLatestStable(options);
  const releaseLock = acquireLock(root);
  try {
    const configFile = path.join(root, 'config.json');
    const prior = readJson(configFile, {});
    const previousVersions = prior.active_versions ?? null;
    const clients = detectClients({ home, requested: options.targets, env });
    const legacy = migrationCandidates(home).filter((target) => fs.existsSync(target));
    const releaseDir = materializeRelease(root, release.bundle, release.manifest);
    recordMutation(root, 'install', 'pending', release.manifest.release_version);
    const installedTargets = installTargets({ home, clients, releaseDir, root, env, testMode });
    const removedStaleTargets = removeStaleTargets({
      previousTargets: prior.installed_targets,
      installedTargets,
      root,
      home,
      env,
      testMode,
    });
    const activeVersions = versions(release.manifest);
    const history = [
      activeVersions,
      ...(prior.release_history ?? []).filter((item) => item.release !== activeVersions.release),
    ].slice(0, RETAIN_RELEASES);
    const autoUpdateEnabled = options.autoUpdate === true
      ? true
      : options.autoUpdate === false
        ? false
        : prior.auto_update_enabled === true;
    const scheduler = autoUpdateEnabled
      ? installScheduler({ home, root, env, testMode })
      : (removeScheduler({ home, env, testMode }), null);
    const config = {
      record_type: 'ThreadifyWorkflowsUpdaterConfigV1',
      repository: REPOSITORY,
      stable_channel: 'github_release',
      auto_update_enabled: autoUpdateEnabled,
      auto_update_consent_recorded_at: autoUpdateEnabled ? new Date().toISOString() : null,
      active_versions: activeVersions,
      release_history: history,
      installed_clients: clients,
      installed_targets: installedTargets,
      scheduler,
      legacy_installations_detected: legacy,
      last_successful_check: new Date().toISOString(),
      last_release_url: release.releaseUrl,
    };
    activateRelease(root, releaseDir);
    writeJsonAtomic(configFile, config);
    cleanupOldReleases(root, history);
    const receipt = writeReceipt(root, {
      status: previousVersions ? (release.manifest.change_class === 'rules_only' ? 'rules_reloaded' : 'updated_restart_required') : 'installed',
      previous_versions: previousVersions,
      new_versions: activeVersions,
      installed_targets: installedTargets,
      verified_hashes: release.manifest.assets.map((asset) => asset.sha256),
      rollback_state: { available: history.slice(1).map((item) => item.release) },
      auto_update_enabled: autoUpdateEnabled,
      scheduler,
      migrated_legacy_installations: legacy,
      removed_stale_targets: removedStaleTargets,
    });
    recordMutation(root, 'install', 'completed', release.manifest.release_version);
    return receipt;
  } finally {
    releaseLock();
  }
}

export async function update(options = {}) {
  const env = options.env ?? process.env;
  const root = options.root ?? stateRoot(env);
  const configFile = path.join(root, 'config.json');
  const config = readJson(configFile);
  if (!config) throw new Error('not_installed');
  if (pendingMutation(root)) return recoveryReceipt(root, config);
  if (options.onUse && config.auto_update_enabled !== true) {
    return { status: 'auto_update_disabled', active_versions: config.active_versions };
  }
  const last = Date.parse(config.last_successful_check ?? 0);
  if (options.onUse && Number.isFinite(last) && Date.now() - last < UPDATE_INTERVAL_MS) {
    return writeReceipt(root, {
      status: 'up_to_date',
      previous_versions: config.active_versions,
      new_versions: config.active_versions,
      installed_targets: config.installed_targets ?? [],
      rollback_state: { available: (config.release_history ?? []).slice(1).map((item) => item.release) },
      freshness: 'checked_within_24h',
    });
  }
  if (options.scheduled && env.THREADIFY_WORKFLOWS_TEST_MODE !== '1' && options.skipJitter !== true) {
    const milliseconds = Math.floor(Math.random() * 30 * 60 * 1000);
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
  try {
    const latest = await fetchLatestStable(options);
    if (latest.manifest.release_version === config.active_versions?.release) {
      config.last_successful_check = new Date().toISOString();
      config.last_release_url = latest.releaseUrl;
      writeJsonAtomic(configFile, config);
      return writeReceipt(root, {
        status: 'up_to_date',
        previous_versions: config.active_versions,
        new_versions: config.active_versions,
        installed_targets: config.installed_targets ?? [],
        verified_hashes: latest.manifest.assets.map((asset) => asset.sha256),
        rollback_state: { available: (config.release_history ?? []).slice(1).map((item) => item.release) },
      });
    }
    return await install({
      ...options,
      home: options.home ?? os.homedir(),
      root,
      targets: (config.installed_clients ?? []).join(','),
      autoUpdate: config.auto_update_enabled === true,
      release: latest,
    });
  } catch (error) {
    if (pendingMutation(root)) return recoveryReceipt(root, config, String(error.message ?? error));
    return writeReceipt(root, {
      status: 'update_failed_using_cached_version',
      previous_versions: config.active_versions,
      new_versions: config.active_versions,
      installed_targets: config.installed_targets ?? [],
      fallback: String(error.message ?? error),
      rollback_state: { available: (config.release_history ?? []).slice(1).map((item) => item.release) },
    });
  }
}

export function status(options = {}) {
  const env = options.env ?? process.env;
  const root = options.root ?? stateRoot(env);
  const config = readJson(path.join(root, 'config.json'));
  const recovery = pendingMutation(root);
  if (recovery) return {
    status: 'installation_requires_recovery', state_root: root,
    recorded_versions: config?.active_versions ?? null, recovery,
  };
  if (!config) return { status: 'not_installed', state_root: root };
  const targets = (config.installed_targets ?? []).map((target) => ({
    target,
    exists: target.startsWith('codex-plugin:') ? true : fs.existsSync(target),
  }));
  return {
    status: targets.every((target) => target.exists) ? 'installed' : 'installed_with_missing_targets',
    state_root: root,
    active_versions: config.active_versions,
    auto_update_enabled: config.auto_update_enabled,
    last_successful_check: config.last_successful_check,
    installed_clients: config.installed_clients,
    targets,
    rollback_available: (config.release_history ?? []).slice(1).map((item) => item.release),
  };
}

export function rollback(options = {}) {
  const env = options.env ?? process.env;
  const home = options.home ?? os.homedir();
  const root = options.root ?? stateRoot(env);
  const releaseLock = acquireLock(root);
  try {
    const configFile = path.join(root, 'config.json');
    const config = readJson(configFile);
    if (!config) throw new Error('not_installed');
    const targetVersion = options.version ?? config.release_history?.[1]?.release;
    const target = (config.release_history ?? []).find((item) => item.release === targetVersion);
    if (!target) throw new Error('rollback_release_not_available');
    const releaseDir = path.join(root, 'releases', targetVersion);
    const manifest = readJson(path.join(releaseDir, 'release-manifest.json'));
    if (!manifest) throw new Error('rollback_manifest_missing');
    const previous = config.active_versions;
    recordMutation(root, 'rollback', 'pending', targetVersion);
    const installedTargets = installTargets({
      home,
      clients: config.installed_clients ?? ['agents'],
      releaseDir,
      root,
      env,
      testMode: env.THREADIFY_WORKFLOWS_TEST_MODE === '1',
    });
    config.active_versions = versions(manifest);
    config.installed_targets = installedTargets;
    config.release_history = [
      config.active_versions,
      ...(config.release_history ?? []).filter((item) => item.release !== targetVersion),
    ].slice(0, RETAIN_RELEASES);
    activateRelease(root, releaseDir);
    writeJsonAtomic(configFile, config);
    const receipt = writeReceipt(root, {
      status: 'rolled_back',
      previous_versions: previous,
      new_versions: config.active_versions,
      installed_targets: installedTargets,
      rollback_state: { available: config.release_history.slice(1).map((item) => item.release) },
    });
    recordMutation(root, 'rollback', 'completed', targetVersion);
    return receipt;
  } finally {
    releaseLock();
  }
}

export function uninstall(options = {}) {
  const env = options.env ?? process.env;
  const home = options.home ?? os.homedir();
  const root = options.root ?? stateRoot(env);
  const configFile = path.join(root, 'config.json');
  const config = readJson(configFile, {});
  const testMode = env.THREADIFY_WORKFLOWS_TEST_MODE === '1';
  const removed = [];
  recordMutation(root, 'uninstall', 'pending');
  for (const target of config.installed_targets ?? []) {
    if (target.startsWith('codex-plugin:')) {
      removeCodexPlugin({ home, env, testMode });
      removed.push(target);
      continue;
    }
    if (isManagedTarget(target, root)) {
      fs.rmSync(target, { recursive: true, force: true });
      removed.push(target);
    }
  }
  removeScheduler({ home, env, testMode });
  const receipt = writeReceipt(root, {
    status: 'uninstalled',
    previous_versions: config.active_versions ?? null,
    new_versions: null,
    installed_targets: removed,
    rollback_state: { available: [] },
  });
  if (options.purgeState) fs.rmSync(root, { recursive: true, force: true });
  else {
    config.installed_targets = [];
    config.installed_clients = [];
    config.auto_update_enabled = false;
    config.scheduler = null;
    writeJsonAtomic(configFile, config);
    recordMutation(root, 'uninstall', 'completed');
  }
  return receipt;
}
