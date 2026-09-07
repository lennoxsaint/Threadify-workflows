import fs from 'node:fs';
import path from 'node:path';

/** Check identity before emitting candidate or stable assets. No state changes. */
export function readReleaseMetadata(root) {
  const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  const intent = read('release/release-intent.json');
  const pkg = read('package.json');
  const lock = read('package-lock.json');
  const plugin = read('.codex-plugin/plugin.json');
  const rules = read('public-rules/qualified-buyer-research.v1.json');
  const fail = (message) => { throw new Error(`Invalid release metadata: ${message}`); };
  if (intent.record_type !== 'StableReleaseIntentV1' || typeof intent.release !== 'boolean')
    fail('explicit boolean release intent required');
  for (const key of ['release_version', 'plugin_version', 'skill_version', 'rules_version']) {
    if (typeof intent[key] !== 'string' || !/^\d+\.\d+\.\d+$/.test(intent[key])) fail(key);
  }
  if (!['rules_only', 'skill_logic', 'installer'].includes(intent.change_class)) fail('change_class');
  if (pkg.version !== intent.release_version || lock.version !== pkg.version ||
      lock.packages?.['']?.version !== pkg.version) fail('package/lock/release version drift');
  if (pkg.name !== lock.name || pkg.name !== lock.packages?.['']?.name) fail('package/lock name drift');
  if (plugin.version !== intent.plugin_version) fail('plugin version drift');
  if (rules.rules_version !== intent.rules_version) fail('rules version drift');
  return intent;
}
