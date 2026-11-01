import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { isSupportedCreatorVersion } from './bridge/contracts.mjs';

const MAX_GIT_OUTPUT = 32 * 1024 * 1024;
const MAX_REPORTED_FILES = 2000;

function coded(code) { const error = new Error(code); error.code = code; return error; }

function git(gitRoot, args, { allowFailure = false } = {}) {
  const result = spawnSync('git', ['--no-optional-locks', '-C', gitRoot, ...args], {
    encoding: 'buffer', timeout: 30000, maxBuffer: MAX_GIT_OUTPUT, windowsHide: true,
  });
  if (result.error) throw coded(`GIT_COMMAND_FAILED:${result.error.message}`);
  if (result.status !== 0 && !allowFailure)
    throw coded(`GIT_COMMAND_FAILED:${(result.stderr || Buffer.alloc(0)).toString('utf8').trim()}`);
  return { status: result.status, stdout: result.stdout || Buffer.alloc(0), stderr: result.stderr || Buffer.alloc(0) };
}

function canonicalDirectory(value, option) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) throw coded(`${option}_MUST_BE_ABSOLUTE`);
  const stat = fs.lstatSync(value);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw coded(`${option}_MUST_BE_DIRECTORY`);
  return fs.realpathSync(value);
}

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function ensureRoots(requestedGitRoot, requestedProjectRoot) {
  const gitRoot = canonicalDirectory(requestedGitRoot, 'GIT_ROOT');
  const projectRoot = canonicalDirectory(requestedProjectRoot, 'PROJECT_ROOT');
  const top = fs.realpathSync(git(gitRoot, ['rev-parse', '--show-toplevel']).stdout.toString('utf8').trim());
  if (top !== gitRoot) throw coded('GIT_ROOT_MISMATCH');
  if (!inside(gitRoot, projectRoot)) throw coded('PROJECT_OUTSIDE_GIT_ROOT');
  const projectFile = path.join(projectRoot, 'project.json');
  const stat = fs.lstatSync(projectFile);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) throw coded('PROJECT_JSON_UNSAFE');
  let project;
  try { project = JSON.parse(fs.readFileSync(projectFile, 'utf8')); }
  catch (_) { throw coded('PROJECT_JSON_INVALID'); }
  if (!project || typeof project !== 'object' || Array.isArray(project)) throw coded('PROJECT_JSON_INVALID');
  if (!isSupportedCreatorVersion(project.version)) throw coded('CREATOR_VERSION_UNSUPPORTED');
  return { gitRoot, projectRoot, project, projectPrefix: path.relative(gitRoot, projectRoot).split(path.sep).filter(Boolean).join('/') };
}

function resolveCommit(gitRoot, revision) {
  if (typeof revision !== 'string' || !revision || revision.length > 256 || revision.startsWith('-'))
    throw coded('VCS_IMPACT_TARGET_INVALID');
  const result = git(gitRoot, ['rev-parse', '--verify', '--end-of-options', `${revision}^{commit}`], { allowFailure: true });
  if (result.status !== 0) throw coded('VCS_IMPACT_TARGET_INVALID');
  const commit = result.stdout.toString('utf8').trim();
  if (!/^[0-9a-f]{40,64}$/i.test(commit)) throw coded('VCS_IMPACT_TARGET_INVALID');
  return commit;
}

function upstreamRef(gitRoot) {
  const result = git(gitRoot, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], { allowFailure: true });
  if (result.status !== 0) throw coded('VCS_IMPACT_UPSTREAM_NOT_CONFIGURED');
  const upstream = result.stdout.toString('utf8').trim();
  if (!upstream || upstream.length > 256) throw coded('VCS_IMPACT_UPSTREAM_NOT_CONFIGURED');
  return upstream;
}

function parseNameStatus(buffer) {
  const rows = buffer.toString('utf8').split('\0');
  const changes = [];
  for (let index = 0; index < rows.length;) {
    const status = rows[index++];
    if (!status) continue;
    const filePath = rows[index++];
    if (!filePath || path.posix.isAbsolute(filePath) || filePath.split('/').includes('..'))
      throw coded('VCS_IMPACT_DIFF_OUTPUT_INVALID');
    changes.push({ status: status[0], path: filePath });
  }
  return changes;
}

function pathList(buffer) {
  return buffer.toString('utf8').split('\0').filter(Boolean).filter((item) =>
    !path.posix.isAbsolute(item) && !item.split('/').includes('..'));
}

function category(projectPath) {
  if (!projectPath) return 'outside-project';
  if (projectPath.endsWith('.meta')) return 'metadata';
  if (projectPath === 'project.json' || projectPath.startsWith('settings/') || projectPath.startsWith('packages/'))
    return 'project-configuration';
  const lower = projectPath.toLowerCase();
  if (/\.(fire|scene)$/.test(lower)) return 'scene';
  if (lower.endsWith('.prefab')) return 'prefab';
  if (/\.(js|ts|mjs|cjs)$/.test(lower)) return 'script';
  if (projectPath.startsWith('assets/')) return 'asset';
  return 'other';
}

function changeImpact(projectPath) {
  const underAssets = projectPath?.startsWith('assets/') === true;
  const metadata = underAssets && projectPath.endsWith('.meta');
  const assetPath = underAssets ? (metadata ? projectPath.slice(0, -'.meta'.length) : projectPath) : null;
  const assetExtension = assetPath ? path.posix.extname(assetPath).toLowerCase() : '';
  const sourceAsset = underAssets && /\.(?:[cm]?js|tsx?)$/.test(assetPath || '');
  return {
    assetPath,
    metadata,
    category: category(projectPath),
    requiresAssetDbImport: underAssets,
    requiresAssetIdentityReview: metadata,
    mayRequireScriptRecompile: sourceAsset,
    mayRequireSceneReload: ['.fire', '.scene', '.prefab'].includes(assetExtension),
  };
}

function targetProjectInfo(gitRoot, commit, projectPrefix) {
  const relative = projectPrefix ? `${projectPrefix}/project.json` : 'project.json';
  const result = git(gitRoot, ['cat-file', 'blob', `${commit}:${relative}`], { allowFailure: true });
  if (result.status !== 0) return { present: false, name: null, creatorVersion: null };
  if (result.stdout.length > 1024 * 1024) throw coded('VCS_IMPACT_PROJECT_FILE_TOO_LARGE');
  try {
    const project = JSON.parse(result.stdout.toString('utf8'));
    if (!project || typeof project !== 'object' || Array.isArray(project)) throw new Error();
    return { present: true, name: typeof project.name === 'string' ? project.name : null,
      creatorVersion: typeof project.version === 'string' ? project.version : null };
  } catch (_) { throw coded('VCS_IMPACT_TARGET_PROJECT_INVALID'); }
}

function dirtyPaths(gitRoot) {
  const tracked = pathList(git(gitRoot, ['diff', '--name-only', '-z', 'HEAD', '--']).stdout);
  const untracked = pathList(git(gitRoot, ['ls-files', '--others', '--exclude-standard', '-z']).stdout);
  return [...new Set([...tracked, ...untracked])].sort();
}

function overlapRisk(incoming, dirty) {
  const dirtySet = new Set(dirty);
  const risks = [];
  for (const item of incoming) {
    const repoPath = item.path;
    const pairedMeta = repoPath.endsWith('.meta') ? repoPath.slice(0, -5) : `${repoPath}.meta`;
    const pairedAsset = repoPath.endsWith('.meta') ? repoPath.slice(0, -5) : repoPath;
    const related = [...new Set([repoPath, pairedMeta, pairedAsset])];
    const overlapping = [...dirtySet].filter((candidate) => related.some((relatedPath) => candidate === relatedPath
      || candidate.startsWith(`${relatedPath}/`) || relatedPath.startsWith(`${candidate}/`)));
    if (overlapping.length) risks.push({ incomingPath: item.path, dirtyPaths: overlapping });
  }
  return risks;
}

export function runVcsImpact({ gitRoot: requestedGitRoot, projectRoot: requestedProjectRoot,
  target, operation = 'switch' } = {}) {
  const roots = ensureRoots(requestedGitRoot, requestedProjectRoot);
  if (!['switch', 'sync'].includes(operation)) throw coded('VCS_IMPACT_OPERATION_INVALID');
  const targetRef = target === undefined || target === null || target === '' ? upstreamRef(roots.gitRoot) : target;
  const currentCommit = resolveCommit(roots.gitRoot, 'HEAD');
  const targetCommit = resolveCommit(roots.gitRoot, targetRef);
  let fastForwardPossible = null;
  let alreadyContainsTarget = null;
  if (operation === 'sync') {
    const forward = git(roots.gitRoot, ['merge-base', '--is-ancestor', currentCommit, targetCommit], { allowFailure: true });
    const reverse = git(roots.gitRoot, ['merge-base', '--is-ancestor', targetCommit, currentCommit], { allowFailure: true });
    if (![0, 1].includes(forward.status) || ![0, 1].includes(reverse.status)) throw coded('VCS_IMPACT_ANCESTRY_CHECK_FAILED');
    fastForwardPossible = forward.status === 0;
    alreadyContainsTarget = reverse.status === 0;
  }
  const nameStatus = git(roots.gitRoot, ['diff', '--name-status', '-z', '--no-renames', currentCommit, targetCommit, '--']);
  const allChanges = alreadyContainsTarget ? [] : parseNameStatus(nameStatus.stdout);
  const files = allChanges.map((change) => {
    const projectPath = roots.projectPrefix
      ? (change.path.startsWith(`${roots.projectPrefix}/`) ? change.path.slice(roots.projectPrefix.length + 1) : null)
      : change.path;
    return { ...change, projectPath, ...changeImpact(projectPath) };
  });
  const projectChanges = files.filter((item) => item.projectPath !== null);
  const outsideProjectChanges = files.filter((item) => item.projectPath === null).map((item) => item.path);
  const dirty = dirtyPaths(roots.gitRoot);
  const overlaps = overlapRisk(projectChanges, dirty);
  const targetProject = targetProjectInfo(roots.gitRoot, targetCommit, roots.projectPrefix);
  const currentBranch = git(roots.gitRoot, ['symbolic-ref', '--quiet', '--short', 'HEAD'], { allowFailure: true });
  const branch = currentBranch.status === 0 ? currentBranch.stdout.toString('utf8').trim() : null;
  const summary = { total: files.length, project: projectChanges.length, outsideProject: outsideProjectChanges.length,
    assetDbImport: projectChanges.filter((item) => item.requiresAssetDbImport).length,
    metadata: projectChanges.filter((item) => item.requiresAssetIdentityReview).length,
    scripts: projectChanges.filter((item) => item.mayRequireScriptRecompile).length,
    scenes: projectChanges.filter((item) => item.category === 'scene').length,
    prefabs: projectChanges.filter((item) => item.category === 'prefab').length,
    projectConfiguration: projectChanges.filter((item) => item.category === 'project-configuration').length };
  const editorWorkRequired = projectChanges.length > 0;
  return { schemaVersion: 1, readOnly: true, operation, gitRoot: roots.gitRoot, projectRoot: roots.projectRoot,
    projectName: roots.project.name || path.basename(roots.projectRoot), creatorVersion: roots.project.version,
    currentBranch: branch, fromCommit: currentCommit, targetRef, targetCommit,
    ...(operation === 'sync' ? { fastForwardPossible, alreadyContainsTarget,
      mergeRequired: !fastForwardPossible && !alreadyContainsTarget } : {}),
    targetProject, compatibleCreatorVersion: isSupportedCreatorVersion(targetProject.creatorVersion),
    dirtyRepository: dirty.length > 0, dirtyOverlapPaths: overlaps,
    importImpact: { assetDbImportRequired: summary.assetDbImport > 0,
      assetIdentityReviewRequired: summary.metadata > 0, scriptRecompileRecommended: summary.scripts > 0,
      sceneOrPrefabReloadRecommended: summary.scenes + summary.prefabs > 0,
      previewRefreshRecommended: summary.assetDbImport > 0,
      editorStateChecked: false, editorCloseRecommendedBeforeApply: editorWorkRequired },
    summary, files: files.slice(0, MAX_REPORTED_FILES), outsideProjectChanges: outsideProjectChanges.slice(0, MAX_REPORTED_FILES),
    truncated: files.length > MAX_REPORTED_FILES,
    limitations: ['Compares the current local HEAD tree with an already-resolved local target ref; it does not fetch or mutate Git.',
      'Does not inspect the live Creator Editor. Verify project identity in Dashboard and close or reload the Editor before applying a branch or sync change.',
      'AssetDB import, UUID, importer, compilation, and active-scene effects are classified from changed paths; Creator must confirm their actual results.'] };
}
