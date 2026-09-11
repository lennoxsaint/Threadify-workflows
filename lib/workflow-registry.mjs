import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const catalogRecordType = 'ThreadifyWorkflowCatalogV1';

function normalizePath(value) {
  return value.split(path.sep).join('/');
}

function markdownCell(value) {
  return String(value).replaceAll('|', '\\|').replace(/\r?\n/g, ' ');
}

function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function assertSafeRelativePath(root, relative, label) {
  if (typeof relative !== 'string' || relative.length === 0 || path.isAbsolute(relative)) {
    throw new Error(`${label}_must_be_a_relative_path`);
  }
  const resolved = path.resolve(root, relative);
  if (resolved === root || !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`${label}_escapes_registry_root`);
  }
  return resolved;
}

function assertRelativePath(root, relative, label) {
  const resolved = assertSafeRelativePath(root, relative, label);
  if (!fs.existsSync(resolved)) throw new Error(`${label}_not_found:${relative}`);
  if (!fs.lstatSync(resolved).isFile()) throw new Error(`${label}_must_be_a_file:${relative}`);
  const realRoot = fs.realpathSync(root);
  const realFile = fs.realpathSync(resolved);
  if (!realFile.startsWith(`${realRoot}${path.sep}`)) throw new Error(`${label}_resolves_outside_registry_root`);
  return resolved;
}

function readManifest(root, manifestPath) {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`invalid_workflow_manifest:${normalizePath(path.relative(root, manifestPath))}:${error.message}`);
  }
  const sourceManifest = normalizePath(path.relative(root, manifestPath));
  const directoryId = path.basename(path.dirname(manifestPath));
  if (!/^[a-z0-9-]+$/.test(manifest.workflow_id ?? '')) {
    throw new Error(`invalid_workflow_id:${sourceManifest}`);
  }
  if (manifest.workflow_id !== directoryId) {
    throw new Error(`workflow_id_directory_mismatch:${sourceManifest}`);
  }
  if (!['skill', 'recipe'].includes(manifest.kind)) throw new Error(`invalid_workflow_kind:${manifest.workflow_id}`);
  if (!['creator', 'advanced', 'conversation', 'recipe'].includes(manifest.bundle?.kind)) {
    throw new Error(`invalid_bundle_kind:${manifest.workflow_id}`);
  }
  if (!Array.isArray(manifest.dependencies?.workflows) || !Array.isArray(manifest.dependencies?.files)) {
    throw new Error(`invalid_dependencies:${manifest.workflow_id}`);
  }
  if (!Array.isArray(manifest.triggers) || manifest.triggers.length === 0) {
    throw new Error(`missing_triggers:${manifest.workflow_id}`);
  }
  if (!Array.isArray(manifest.io?.inputs) || !Array.isArray(manifest.io?.outputs)) {
    throw new Error(`invalid_io:${manifest.workflow_id}`);
  }
  const entrypointSource = assertRelativePath(root, manifest.entrypoint?.source, 'entrypoint_source');
  const installedEntrypoint = manifest.kind === 'skill'
    ? `skills/${manifest.entrypoint.skill_id}/SKILL.md`
    : manifest.entrypoint.source;
  if (manifest.kind === 'skill' && !manifest.entrypoint?.skill_id) {
    throw new Error(`skill_workflow_missing_skill_id:${manifest.workflow_id}`);
  }
  if (manifest.entrypoint?.skill_id && !/^threadify-[a-z0-9-]+$/.test(manifest.entrypoint.skill_id)) {
    throw new Error(`invalid_skill_id:${manifest.workflow_id}`);
  }
  if (manifest.kind === 'recipe' && manifest.entrypoint?.skill_id !== null) {
    throw new Error(`recipe_workflow_has_skill_id:${manifest.workflow_id}`);
  }
  for (const dependency of manifest.dependencies?.files ?? []) {
    assertRelativePath(root, dependency, `dependency_file:${manifest.workflow_id}`);
  }
  const bundleTargets = new Set();
  for (const reference of manifest.bundle?.references ?? []) {
    assertRelativePath(root, reference.source, `bundle_reference:${manifest.workflow_id}`);
    assertSafeRelativePath(root, reference.target, `bundle_target:${manifest.workflow_id}`);
    if (bundleTargets.has(reference.target)) throw new Error(`duplicate_bundle_target:${manifest.workflow_id}:${reference.target}`);
    bundleTargets.add(reference.target);
  }
  for (const record of [...(manifest.io?.inputs ?? []), ...(manifest.io?.outputs ?? [])]) {
    if (!record.schema_ref.startsWith('inline:')) {
      assertRelativePath(root, record.schema_ref, `schema_ref:${manifest.workflow_id}`);
    }
  }
  return Object.freeze({
    ...manifest,
    source_manifest: sourceManifest,
    source_entrypoint: normalizePath(path.relative(root, entrypointSource)),
    installed_entrypoint: installedEntrypoint,
    skill_name: manifest.entrypoint.skill_id,
  });
}

/**
 * Load the canonical workflow manifests and hide discovery/path checks behind one
 * interface. Callers receive deterministic, title-sorted records.
 */
export function loadWorkflowRegistry({ root = defaultRoot } = {}) {
  const absoluteRoot = path.resolve(root);
  const workflowsRoot = path.join(absoluteRoot, 'workflows');
  const manifestPaths = fs.readdirSync(workflowsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(workflowsRoot, entry.name, 'manifest.json'))
    .filter((file) => fs.existsSync(file));
  const workflows = manifestPaths.map((file) => readManifest(absoluteRoot, file))
    .sort((left, right) => compareText(left.title, right.title)
      || compareText(left.workflow_id, right.workflow_id));
  const ids = new Set();
  const skills = new Set();
  for (const workflow of workflows) {
    if (ids.has(workflow.workflow_id)) throw new Error(`duplicate_workflow_id:${workflow.workflow_id}`);
    ids.add(workflow.workflow_id);
    if (workflow.skill_name) {
      if (skills.has(workflow.skill_name)) throw new Error(`duplicate_skill_id:${workflow.skill_name}`);
      skills.add(workflow.skill_name);
    }
  }
  for (const workflow of workflows) {
    for (const dependency of workflow.dependencies.workflows) {
      if (!ids.has(dependency)) throw new Error(`unknown_workflow_dependency:${workflow.workflow_id}:${dependency}`);
    }
  }
  return Object.freeze({ root: absoluteRoot, workflows: Object.freeze(workflows) });
}

export function listWorkflows(registry, { adapter, kind, bundle } = {}) {
  return registry.workflows.filter((workflow) =>
    (!adapter || workflow.supported_adapters.includes(adapter))
    && (!kind || workflow.kind === kind)
    && (!bundle || workflow.bundle.kind === bundle));
}

export function describeWorkflow(registry, workflowId) {
  const workflow = registry.workflows.find((candidate) => candidate.workflow_id === workflowId);
  if (!workflow) throw new Error(`unknown_workflow:${workflowId}`);
  return workflow;
}

export function buildCatalogDocument(registry) {
  return {
    record_type: catalogRecordType,
    generated_from: 'workflows/*/manifest.json',
    workflows: registry.workflows.map((workflow) => ({
      workflow_id: workflow.workflow_id,
      version: workflow.version,
      title: workflow.title,
      summary: workflow.summary,
      kind: workflow.kind,
      skill_name: workflow.skill_name,
      entrypoint: workflow.installed_entrypoint,
      source_entrypoint: workflow.source_entrypoint,
      source_manifest: workflow.source_manifest,
      bundle: workflow.bundle,
      dependencies: workflow.dependencies,
      triggers: workflow.triggers,
      io: workflow.io,
      supported_adapters: workflow.supported_adapters,
    })),
  };
}

export function renderWorkflowCatalog(registry) {
  const lines = [
    '# Workflow catalog',
    '',
    'Generated from the canonical workflow manifests. Edit a workflow manifest, then rebuild the registry artifacts.',
    '',
    '| Workflow | Type | Skill or recipe | Bundle | Triggers |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const workflow of registry.workflows) {
    const entrypoint = workflow.skill_name
      ? `\`${workflow.skill_name}\``
      : `[recipe](../${workflow.entrypoint.source})`;
    lines.push(`| ${markdownCell(workflow.title)} (\`${workflow.workflow_id}\`) | ${workflow.kind} | ${entrypoint} | ${workflow.bundle.kind}${workflow.bundle.standalone ? ' + standalone' : ''} | ${markdownCell(workflow.triggers.join('; '))} |`);
  }
  return `${lines.join('\n')}\n`;
}

export function renderClientCompatibility(registry) {
  const adapters = [...new Set(registry.workflows.flatMap((workflow) => workflow.supported_adapters))].sort();
  const lines = [
    '# Client compatibility',
    '',
    'Generated from each workflow manifest. A check means the workflow declares an adapter; it does not prove a native client walkthrough or provider action.',
    '',
    `| Workflow | ${adapters.join(' | ')} |`,
    `| --- | ${adapters.map(() => '---').join(' | ')} |`,
  ];
  for (const workflow of registry.workflows) {
    lines.push(`| ${markdownCell(workflow.title)} | ${adapters.map((adapter) => workflow.supported_adapters.includes(adapter) ? 'yes' : '').join(' | ')} |`);
  }
  return `${lines.join('\n')}\n`;
}

export { catalogRecordType };
