import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { install, rollback, status, sha256 } from '../../lib/installer.mjs';
import { discoveryCommand } from '../../lib/discovery.mjs';

const qbr = 'threadify-qualified-buyer-research';
const next = 'threadify-your-next-moves';
const rows = [qbr, next].map((skill_name) => ({ kind: 'skill', skill_name, workflow_id: skill_name.slice(9) }));
const catalog = { record_type: 'ThreadifyWorkflowCatalogV1', workflows: [...rows, { kind: 'recipe', workflow_id: 'recipe-only' }] };

function fixture(version, modern = true) {
  const contents = { 'skill/SKILL.md': `---\nname: ${qbr}\n---\nLegacy research`,
    'plugin/.codex-plugin/plugin.json': JSON.stringify({ name: 'threadify-workflows', version }) };
  if (modern) {
    contents['plugin/catalog.json'] = JSON.stringify(catalog);
    for (const name of [qbr, next]) contents[`plugin/skills/${name}/SKILL.md`] = `---\nname: ${name}\n---\nLocal preparation`;
  }
  const files = Object.fromEntries(Object.entries(contents).map(([file, value]) => {
    const content = Buffer.from(value);
    return [file, { content_base64: content.toString('base64'), sha256: sha256(content), mode: '0644' }];
  }));
  const manifest = { release_version: version, plugin_version: version, skill_version: '0.4.0', rules_version: '0.4.0',
    commit: 'a'.repeat(40), change_class: 'installer', assets: [] };
  return { bundle: { files }, manifest, releaseUrl: 'https://example.invalid/release' };
}

function isolated(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'threadify-catalog-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  return { home, root: path.join(home, '.threadify-workflows'),
    env: { ...process.env, THREADIFY_WORKFLOWS_TEST_MODE: '1' }, autoUpdate: false };
}

test('fresh standalone clients install every catalog skill, excluding recipes', async (t) => {
  const options = isolated(t);
  await install({ ...options, targets: 'claude,agents', release: fixture('0.8.0') });
  for (const client of ['.claude', '.agents']) {
    assert.deepEqual(fs.readdirSync(path.join(options.home, client, 'skills')).sort(), [qbr, next].sort());
  }
  assert.deepEqual(status(options).workflow_selection, { claude: 'all', agents: 'all' });
});

test('legacy selection survives upgrade; explicit all migration and rollback preserve private state', async (t) => {
  const options = isolated(t);
  await install({ ...options, targets: 'claude', release: fixture('0.7.0', false) });
  // Emulate a pre-catalog configuration with no selection fields.
  const configFile = path.join(options.root, 'config.json');
  const old = JSON.parse(fs.readFileSync(configFile));
  delete old.workflow_selection; delete old.selection_history;
  fs.writeFileSync(configFile, JSON.stringify(old));
  const privateDir = path.join(options.root, 'user-data', 'conversations');
  fs.mkdirSync(privateDir, { recursive: true });
  fs.writeFileSync(path.join(privateDir, 'proof.json'), 'private-state');
  await install({ ...options, release: fixture('0.8.0') });
  const skills = path.join(options.home, '.claude', 'skills');
  assert.deepEqual(fs.readdirSync(skills), [qbr]);
  assert.equal(status(options).workflow_selection.claude, 'legacy-qbr');
  await install({ ...options, workflows: 'all', release: fixture('0.8.0') });
  assert.ok(fs.existsSync(path.join(skills, next, 'SKILL.md')));
  rollback({ ...options, version: '0.7.0' });
  assert.deepEqual(fs.readdirSync(skills), [qbr]);
  assert.equal(fs.readFileSync(path.join(privateDir, 'proof.json'), 'utf8'), 'private-state');
});

test('explicit full catalog cannot silently fall back to old standalone assets', async (t) => {
  const options = isolated(t);
  await assert.rejects(install({ ...options, targets: 'claude', workflows: 'all', release: fixture('0.7.0', false) }), /full_catalog_unavailable/);
  assert.equal(status(options).status, 'not_installed');
});

test('discovery separates source inventory, legacy selection, and unverified native/provider state', async (t) => {
  const options = isolated(t);
  await install({ ...options, targets: 'claude', release: fixture('0.7.0', false) });
  const source = path.join(options.home, 'source'); fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, 'catalog.json'), JSON.stringify(catalog));
  const listed = await discoveryCommand(['list', '--json'], { root: source, installerOptions: options });
  assert.deepEqual(listed.workflows.find((row) => row.skill_name === next).availability.installed_clients, []);
  assert.deepEqual(listed.workflows.find((row) => row.skill_name === qbr).availability.installed_clients, ['claude']);
  const doctor = await discoveryCommand(['doctor'], { root: source, installerOptions: options });
  assert.equal(doctor.native_discovery.status, 'not_checked');
  assert.equal(doctor.connection.required_for_local_preparation, false);
  await assert.rejects(discoveryCommand(['describe', 'absent'], { root: source, installerOptions: options }), /unknown_workflow/);
});

test('a later unmanaged catalog target prevents all earlier skill-link mutations', async (t) => {
  const options = isolated(t);
  await install({ ...options, targets: 'claude', release: fixture('0.7.0', false) });
  const skillRoot = path.join(options.home, '.claude', 'skills');
  const before = fs.readlinkSync(path.join(skillRoot, qbr));
  fs.mkdirSync(path.join(skillRoot, next));
  fs.writeFileSync(path.join(skillRoot, next, 'SKILL.md'), 'user-owned');
  await assert.rejects(install({ ...options, workflows: 'all', release: fixture('0.8.0') }), /refusing_to_overwrite_unrelated_target/);
  assert.equal(fs.readlinkSync(path.join(skillRoot, qbr)), before);
  assert.equal(fs.readFileSync(path.join(skillRoot, next, 'SKILL.md'), 'utf8'), 'user-owned');
});
