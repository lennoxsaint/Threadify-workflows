import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { status as installationStatus } from './installer.mjs';

const defaultRoot = fileURLToPath(new URL('..', import.meta.url));

function readCatalog(root) {
  const file = path.join(root, 'catalog.json');
  if (!fs.existsSync(file)) throw new Error('workflow_catalog_missing:build_or_install_the_current_release');
  const catalog = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (catalog.record_type !== 'ThreadifyWorkflowCatalogV1' || !Array.isArray(catalog.workflows)) {
    throw new Error('invalid_workflow_catalog');
  }
  return catalog;
}

/** Discovery reads the shipped inventory. It never guesses OAuth or native
 * routing readiness from a file, and never calls a provider or changes state. */
export async function discoveryCommand(argv, { root = defaultRoot, installerOptions = {} } = {}) {
  const [command, ...args] = argv;
  const parameters = args.filter((value) => value !== '--json');
  if (parameters.some((value) => value.startsWith('--')) || parameters.length !== (command === 'describe' ? 1 : 0)) {
    throw new Error('invalid_discovery_arguments');
  }
  const catalog = readCatalog(root);
  const installation = installationStatus(installerOptions);
  const versions = installation.active_versions ?? null;
  // Installed availability is derived from the install's catalog, not the
  // source CLI's newer catalog. Empty/null states stay explicit.
  let installedCatalog = null;
  if (versions?.release && installation.state_root) {
    const installedFile = path.join(installation.state_root, 'releases', versions.release, 'plugin', 'catalog.json');
    if (fs.existsSync(installedFile)) installedCatalog = JSON.parse(fs.readFileSync(installedFile, 'utf8'));
  }
  const selection = installation.workflow_selection ?? {};
  const workflows = catalog.workflows.map((workflow) => ({
    ...workflow,
    availability: {
      source: 'included_in_this_catalog',
      installed_release: versions?.release ?? null,
      installed_clients: Object.entries(selection).filter(([client, choice]) => {
        if (workflow.kind !== 'skill') return false;
        if (choice === 'legacy-qbr') return workflow.skill_name === 'threadify-qualified-buyer-research';
        return choice === 'all' && installedCatalog?.workflows?.some((item) => item.workflow_id === workflow.workflow_id && item.kind === 'skill');
      }).map(([client]) => client),
      native_discovery: 'not_checked',
      published_release: 'not_checked',
    },
  }));
  if (command === 'list') return { record_type: 'ThreadifyWorkflowListV1', status: 'ok', workflows };
  if (command === 'describe') {
    const workflow = workflows.find((item) => item.workflow_id === parameters[0]);
    if (!workflow) throw new Error(`unknown_workflow:${parameters[0]}`);
    return { record_type: 'ThreadifyWorkflowDescriptionV1', status: 'ok', workflow };
  }
  if (command !== 'doctor') throw new Error('unknown_discovery_command');
  const posix = process.platform !== 'win32';
  return {
    record_type: 'ThreadifyReadinessV1', status: 'inspection_complete',
    installation,
    catalog: { workflows: workflows.length, runnable_skills: workflows.filter((item) => item.kind === 'skill').length },
    platform: { os: process.platform, node: process.versions.node,
      resumable_private_state: posix ? 'supported' : 'unsupported',
      limitation: posix ? null : 'Use macOS or Linux for resumable private state; installation alone does not prove workflow execution.' },
    native_discovery: { status: 'not_checked', next_action: 'Start a fresh agent session and invoke Your Next Moves.' },
    connection: { status: 'not_checked', required_for_local_preparation: false,
      next_action: 'Check current Threadify tools and account access only when a hosted action would help.' },
    public_release: { status: 'not_checked', reason: 'This command does not make a network request.' },
  };
}
