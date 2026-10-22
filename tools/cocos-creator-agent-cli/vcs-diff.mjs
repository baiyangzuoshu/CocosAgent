import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { diffCreatorSerializedAssets, inspectCreatorSerializedAsset } from './creator-asset-diff.mjs';

const MAX_GIT_OUTPUT = 18 * 1024 * 1024;
const ASSET_PATH = /\.(?:fire|prefab)$/i;

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

function ensureProject(gitRoot, projectRoot) {
  const resolvedRoot = fs.realpathSync(git(gitRoot, ['rev-parse', '--show-toplevel']).stdout.toString('utf8').trim());
  if (resolvedRoot !== gitRoot) throw coded('GIT_ROOT_MISMATCH');
  if (!inside(gitRoot, projectRoot)) throw coded('PROJECT_OUTSIDE_GIT_ROOT');
  const projectFile = path.join(projectRoot, 'project.json');
  const stat = fs.lstatSync(projectFile);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) throw coded('PROJECT_JSON_UNSAFE');
  let project;
  try { project = JSON.parse(fs.readFileSync(projectFile, 'utf8')); }
  catch (_) { throw coded('PROJECT_JSON_INVALID'); }
  if (!project || typeof project !== 'object' || Array.isArray(project)) throw coded('PROJECT_JSON_INVALID');
  if (project.version !== '2.4.15') throw coded('CREATOR_VERSION_UNSUPPORTED');
}

function projectAssetPath(projectRoot, inputPath) {
  if (typeof inputPath !== 'string' || !inputPath || inputPath.includes('\0') || path.isAbsolute(inputPath))
    throw coded('VCS_DIFF_PATH_INVALID');
  const portable = inputPath.replaceAll('\\', '/');
  const normalized = path.posix.normalize(portable);
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../') || normalized.startsWith('/')
    || !normalized.startsWith('assets/')
    || !ASSET_PATH.test(normalized)) throw coded('VCS_DIFF_PATH_INVALID');
  const absolute = path.resolve(projectRoot, ...normalized.split('/'));
  if (!inside(projectRoot, absolute)) throw coded('VCS_DIFF_PATH_INVALID');
  return { relative: normalized, absolute };
}

function readWorkingFile(root, relative, maxBytes) {
  const segments = relative.split('/');
  let current = root;
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw coded('VCS_DIFF_SYMLINK_REFUSED');
    const final = index === segments.length - 1;
    if (!final && !stat.isDirectory()) throw coded('VCS_DIFF_PATH_NOT_REGULAR');
    if (final && (!stat.isFile() || stat.size > maxBytes)) throw coded('VCS_DIFF_FILE_UNSAFE_OR_TOO_LARGE');
  }
  const before = fs.lstatSync(current);
  const bytes = fs.readFileSync(current);
  const after = fs.lstatSync(current);
  if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size
    || before.mtimeMs !== after.mtimeMs || bytes.length !== after.size) throw coded('VCS_DIFF_FILE_CHANGED_DURING_READ');
  return bytes;
}

function commitForRevision(gitRoot, revision) {
  if (typeof revision !== 'string' || !revision || revision.length > 256 || revision.startsWith('-'))
    throw coded('VCS_DIFF_REVISION_INVALID');
  const result = git(gitRoot, ['rev-parse', '--verify', '--end-of-options', `${revision}^{commit}`], { allowFailure: true });
  if (result.status !== 0) throw coded('VCS_DIFF_REVISION_INVALID');
  const commit = result.stdout.toString('utf8').trim();
  if (!/^[0-9a-f]{40,64}$/i.test(commit)) throw coded('VCS_DIFF_REVISION_INVALID');
  return commit;
}

function readRevisionFile(gitRoot, commit, relative, maxBytes) {
  const object = git(gitRoot, ['cat-file', 'blob', `${commit}:${relative}`], { allowFailure: true });
  if (object.status !== 0) throw coded('VCS_DIFF_REVISION_PATH_NOT_FOUND');
  if (object.stdout.length > maxBytes) throw coded('VCS_DIFF_FILE_UNSAFE_OR_TOO_LARGE');
  return object.stdout;
}

function readRevisionFileIfPresent(gitRoot, commit, relative, maxBytes) {
  const object = git(gitRoot, ['cat-file', 'blob', `${commit}:${relative}`], { allowFailure: true });
  if (object.status !== 0) return null;
  if (object.stdout.length > maxBytes) throw coded('VCS_DIFF_FILE_UNSAFE_OR_TOO_LARGE');
  return object.stdout;
}

function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

export function runVcsDiff({ gitRoot: requestedGitRoot, projectRoot: requestedProjectRoot, assetPath: inputAssetPath,
  from = 'HEAD', to } = {}) {
  const gitRoot = canonicalDirectory(requestedGitRoot, 'GIT_ROOT');
  const projectRoot = canonicalDirectory(requestedProjectRoot, 'PROJECT_ROOT');
  ensureProject(gitRoot, projectRoot);
  const asset = projectAssetPath(projectRoot, inputAssetPath);
  const metaRelative = `${asset.relative}.meta`;
  const repoPrefix = path.relative(gitRoot, projectRoot).split(path.sep).filter(Boolean).join('/');
  const repoAssetPath = repoPrefix ? `${repoPrefix}/${asset.relative}` : asset.relative;
  const repoMetaPath = `${repoAssetPath}.meta`;

  const fromCommit = commitForRevision(gitRoot, from);
  const beforeBytes = readRevisionFile(gitRoot, fromCommit, repoAssetPath, 16 * 1024 * 1024);
  const beforeMetaBytes = readRevisionFile(gitRoot, fromCommit, repoMetaPath, 64 * 1024);
  let afterBytes;
  let afterMetaBytes;
  let toCommit = null;
  let afterScope;
  if (to === undefined || to === null || to === '') {
    afterBytes = readWorkingFile(projectRoot, asset.relative, 16 * 1024 * 1024);
    afterMetaBytes = readWorkingFile(projectRoot, metaRelative, 64 * 1024);
    const confirmedBytes = readWorkingFile(projectRoot, asset.relative, 16 * 1024 * 1024);
    const confirmedMetaBytes = readWorkingFile(projectRoot, metaRelative, 64 * 1024);
    if (sha256(confirmedBytes) !== sha256(afterBytes) || sha256(confirmedMetaBytes) !== sha256(afterMetaBytes))
      throw coded('VCS_DIFF_WORKTREE_CHANGED_DURING_READ');
    afterScope = 'working-tree';
  } else {
    toCommit = commitForRevision(gitRoot, to);
    afterBytes = readRevisionFile(gitRoot, toCommit, repoAssetPath, 16 * 1024 * 1024);
    afterMetaBytes = readRevisionFile(gitRoot, toCommit, repoMetaPath, 64 * 1024);
    afterScope = toCommit;
  }
  const semanticDiff = diffCreatorSerializedAssets({ beforeBytes, beforeMetaBytes,
    afterBytes, afterMetaBytes, assetPath: asset.relative });
  return { schemaVersion: 1, readOnly: true, projectRoot, gitRoot, creatorVersion: '2.4.15',
    asset: semanticDiff.asset,
    from: { revision: from, commit: fromCommit, scope: fromCommit,
      sourceSha256: sha256(beforeBytes), metaSha256: sha256(beforeMetaBytes) },
    to: { revision: to === undefined || to === null || to === '' ? null : to,
      commit: toCommit, scope: afterScope,
      sourceSha256: sha256(afterBytes), metaSha256: sha256(afterMetaBytes) },
    diff: semanticDiff };
}

function revisionAsset(gitRoot, commit, assetPath, metaPath) {
  const sourceBytes = readRevisionFileIfPresent(gitRoot, commit, assetPath, 16 * 1024 * 1024);
  const metaBytes = readRevisionFileIfPresent(gitRoot, commit, metaPath, 64 * 1024);
  if (sourceBytes === null && metaBytes === null) return null;
  if (sourceBytes === null || metaBytes === null) throw coded('VCS_BLAME_ASSET_PAIR_INCOMPLETE');
  return { sourceBytes, metaBytes,
    snapshot: inspectCreatorSerializedAsset({ sourceBytes, metaBytes, assetPath: path.posix.basename(assetPath) }) };
}

function nodeChange(before, after, nodeUuid, assetPath) {
  const beforeNode = before?.snapshot.nodes.find((node) => node.uuid === nodeUuid) || null;
  const afterNode = after?.snapshot.nodes.find((node) => node.uuid === nodeUuid) || null;
  if (!before && afterNode) return { type: 'added', node: afterNode };
  if (before && !after && beforeNode) return { type: 'asset-deleted', node: beforeNode };
  if (!before || !after) return null;
  const diff = diffCreatorSerializedAssets({ beforeBytes: before.sourceBytes, beforeMetaBytes: before.metaBytes,
    afterBytes: after.sourceBytes, afterMetaBytes: after.metaBytes, assetPath });
  const added = diff.added.find((node) => node.uuid === nodeUuid);
  if (added) return { type: 'added', node: added };
  const removed = diff.removed.find((node) => node.uuid === nodeUuid);
  if (removed) return { type: 'removed', node: removed };
  const changed = diff.changed.find((node) => node.uuid === nodeUuid);
  return changed ? { type: 'modified', change: changed } : null;
}

function commitDetails(gitRoot, commit) {
  const response = git(gitRoot, ['show', '-s', '--format=%H%x00%an%x00%ae%x00%aI%x00%s', commit]);
  const [hashValue, author, email, authoredAt, ...subject] = response.stdout.toString('utf8').split('\0');
  return { commit: hashValue, author, email, authoredAt,
    subject: subject.join('\0').replace(/[\r\n]+$/, '') };
}

function firstParent(gitRoot, commit) {
  const response = git(gitRoot, ['rev-list', '--parents', '-n', '1', commit]);
  const [current, parent] = response.stdout.toString('utf8').trim().split(/\s+/);
  if (current !== commit) throw coded('VCS_BLAME_HISTORY_INVALID');
  return parent || null;
}

export function runVcsObjectBlame({ gitRoot: requestedGitRoot, projectRoot: requestedProjectRoot,
  assetPath: inputAssetPath, nodeUuid, revision = 'HEAD', maxCommits = 128 } = {}) {
  const gitRoot = canonicalDirectory(requestedGitRoot, 'GIT_ROOT');
  const projectRoot = canonicalDirectory(requestedProjectRoot, 'PROJECT_ROOT');
  ensureProject(gitRoot, projectRoot);
  const asset = projectAssetPath(projectRoot, inputAssetPath);
  if (typeof nodeUuid !== 'string' || !nodeUuid || nodeUuid.length > 128 || nodeUuid.includes('\0'))
    throw coded('VCS_BLAME_NODE_UUID_INVALID');
  if (!Number.isInteger(maxCommits) || maxCommits < 1 || maxCommits > 256)
    throw coded('VCS_BLAME_HISTORY_LIMIT_INVALID');
  if (git(gitRoot, ['rev-parse', '--is-shallow-repository']).stdout.toString('utf8').trim() === 'true')
    throw coded('VCS_BLAME_SHALLOW_REPOSITORY_UNSUPPORTED');
  const targetCommit = commitForRevision(gitRoot, revision);
  const repoPrefix = path.relative(gitRoot, projectRoot).split(path.sep).filter(Boolean).join('/');
  const repoAssetPath = repoPrefix ? `${repoPrefix}/${asset.relative}` : asset.relative;
  const repoMetaPath = `${repoAssetPath}.meta`;
  const targetAsset = revisionAsset(gitRoot, targetCommit, repoAssetPath, repoMetaPath);
  const targetNode = targetAsset?.snapshot.nodes.find((node) => node.uuid === nodeUuid) || null;
  const history = git(gitRoot, ['log', '--first-parent', `--max-count=${maxCommits + 1}`, '--format=%H',
    targetCommit, '--', `:(literal)${repoAssetPath}`, `:(literal)${repoMetaPath}`]);
  const commits = history.stdout.toString('utf8').split(/\r?\n/).filter(Boolean);
  const truncated = commits.length > maxCommits;
  let lastChange = null;
  let historyScanned = 0;
  for (const commit of commits.slice(0, maxCommits)) {
    historyScanned += 1;
    const parent = firstParent(gitRoot, commit);
    const before = parent ? revisionAsset(gitRoot, parent, repoAssetPath, repoMetaPath) : null;
    const after = revisionAsset(gitRoot, commit, repoAssetPath, repoMetaPath);
    const change = nodeChange(before, after, nodeUuid, asset.relative);
    if (change) {
      lastChange = { ...commitDetails(gitRoot, commit), ...change };
      break;
    }
  }
  return { schemaVersion: 1, readOnly: true, projectRoot, gitRoot, creatorVersion: '2.4.15',
    asset: { path: asset.relative, uuid: targetAsset?.snapshot.assetUuid || null,
      type: targetAsset?.snapshot.assetType || path.extname(asset.relative).slice(1) },
    nodeUuid, revision, revisionCommit: targetCommit, existsAtRevision: Boolean(targetNode),
    found: Boolean(targetNode || lastChange), lastChange, history: { strategy: 'first-parent-path',
      scannedCommits: historyScanned, maxCommits, truncated },
    limitations: { objectIdentity: 'Creator serialized node UUID', componentChanges: 'Reported with the owning node change.',
      renames: 'The path history does not follow asset renames.',
      prefabOverrides: 'Scene changes on linked Prefab instances remain attributed to the scene instance node.' } };
}

const INDEX_STAGES = new Map([[1, 'base'], [2, 'ours'], [3, 'theirs']]);
const MAX_CONFLICT_ROWS = 500;

function parseIndexEntries(buffer) {
  const byPath = new Map();
  for (const record of buffer.toString('utf8').split('\0').filter(Boolean)) {
    const separator = record.indexOf('\t');
    if (separator < 0) throw coded('VCS_CONFLICT_INDEX_OUTPUT_INVALID');
    const [mode, objectId, stageText] = record.slice(0, separator).split(' ');
    const relative = record.slice(separator + 1);
    const stage = Number(stageText);
    if (!/^[0-7]{6}$/.test(mode || '') || !/^[0-9a-f]{40,64}$/i.test(objectId || '')
      || !Number.isInteger(stage) || stage < 0 || stage > 3 || !relative || relative.startsWith('/')
      || relative.split('/').some((part) => part === '..' || part === '.'))
      throw coded('VCS_CONFLICT_INDEX_OUTPUT_INVALID');
    const entries = byPath.get(relative) || new Map();
    if (entries.has(stage)) throw coded('VCS_CONFLICT_INDEX_OUTPUT_INVALID');
    entries.set(stage, { mode, objectId, stage });
    byPath.set(relative, entries);
  }
  return byPath;
}

function indexEntriesForPath(gitRoot, relative) {
  const listed = git(gitRoot, ['ls-files', '--stage', '-z', '--', `:(literal)${relative}`]);
  return parseIndexEntries(listed.stdout).get(relative) || new Map();
}

function readIndexBlob(gitRoot, entry, maxBytes) {
  const blob = git(gitRoot, ['cat-file', 'blob', entry.objectId]);
  if (blob.stdout.length > maxBytes) throw coded('VCS_DIFF_FILE_UNSAFE_OR_TOO_LARGE');
  return blob.stdout;
}

function mergeContext(gitRoot) {
  const headResult = git(gitRoot, ['rev-parse', '--verify', 'HEAD'], { allowFailure: true });
  const mergeResult = git(gitRoot, ['rev-parse', '--verify', 'MERGE_HEAD'], { allowFailure: true });
  if (headResult.status !== 0 || mergeResult.status !== 0) return null;
  const head = headResult.stdout.toString('utf8').trim();
  const mergeHeads = mergeResult.stdout.toString('utf8').trim().split(/\r?\n/).filter(Boolean);
  if (!/^[0-9a-f]{40,64}$/i.test(head) || mergeHeads.length !== 1
    || !/^[0-9a-f]{40,64}$/i.test(mergeHeads[0])) return null;
  const baseResult = git(gitRoot, ['merge-base', '--all', head, mergeHeads[0]], { allowFailure: true });
  const bases = baseResult.stdout.toString('utf8').trim().split(/\r?\n/).filter(Boolean);
  if (baseResult.status !== 0 || bases.length !== 1 || !/^[0-9a-f]{40,64}$/i.test(bases[0])) return null;
  return { base: bases[0], ours: head, theirs: mergeHeads[0] };
}

function metadataSides(gitRoot, metadataPath, stages, context) {
  if ([1, 2, 3].every((stage) => stages.has(stage))) return Object.fromEntries([1, 2, 3].map((stage) =>
    [INDEX_STAGES.get(stage), readIndexBlob(gitRoot, stages.get(stage), 64 * 1024)]));
  if (!context) return null;
  const result = {};
  for (const side of ['base', 'ours', 'theirs']) {
    const bytes = readRevisionFileIfPresent(gitRoot, context[side], metadataPath, 64 * 1024);
    if (!bytes) return null;
    result[side] = bytes;
  }
  return result;
}

function conflictAssetSide(gitRoot, sourceStages, metaSides, stage) {
  const sourceEntry = sourceStages.get(stage);
  const side = INDEX_STAGES.get(stage);
  const metaBytes = metaSides?.[side];
  if (!sourceEntry || !metaBytes) return null;
  return { sourceBytes: readIndexBlob(gitRoot, sourceEntry, 16 * 1024 * 1024),
    metaBytes };
}

function metadataIdentity(bytes) {
  try {
    const value = JSON.parse(bytes.toString('utf8'));
    return { uuid: typeof value?.uuid === 'string' ? value.uuid : null,
      importer: typeof value?.importer === 'string' ? value.importer : null };
  } catch (_) { return null; }
}

function stableJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
}

function addMutation(mutations, key, before, after) {
  mutations.set(key, { before, after });
}

function flattenAssetMutations(diff) {
  const mutations = new Map();
  const nodeKey = (uuid) => `node:${uuid}`;
  const flattenNodeValues = (uuid, node, direction) => {
    const fields = ['name', 'parentUuid', 'active', 'transform', 'serializedProperties', 'prefabUuid'];
    for (const field of fields) {
      const value = { present: true, value: node[field] ?? null };
      addMutation(mutations, `${nodeKey(uuid)}:${field}`,
        direction === 'added' ? { present: false } : value,
        direction === 'removed' ? { present: false } : value);
    }
    for (const component of node.componentDetails || []) {
      const prefix = `${nodeKey(uuid)}:component:${component.key}`;
      addMutation(mutations, `${prefix}:classId`, direction === 'added'
        ? { present: false } : { present: true, value: component.classId },
      direction === 'removed' ? { present: false } : { present: true, value: component.classId });
      for (const [property, value] of Object.entries(component.properties || {}))
        addMutation(mutations, `${prefix}:property:${property}`, direction === 'added'
          ? { present: false } : { present: true, value },
        direction === 'removed' ? { present: false } : { present: true, value });
    }
  };
  for (const node of diff.added) {
    addMutation(mutations, `${nodeKey(node.uuid)}:exists`, { present: false }, { present: true });
    flattenNodeValues(node.uuid, node, 'added');
  }
  for (const node of diff.removed) {
    addMutation(mutations, `${nodeKey(node.uuid)}:exists`, { present: true }, { present: false });
    flattenNodeValues(node.uuid, node, 'removed');
  }
  for (const node of diff.changed) {
    addMutation(mutations, `${nodeKey(node.uuid)}:exists`, { present: true }, { present: true });
    for (const [field, values] of Object.entries(node.changes || {})) {
      if (field === 'path') continue;
      addMutation(mutations, `${nodeKey(node.uuid)}:${field}`,
        { present: true, value: values.before }, { present: true, value: values.after });
    }
    const prefix = nodeKey(node.uuid);
    for (const component of node.components.added) {
      const key = `${prefix}:component:${component.key}`;
      addMutation(mutations, `${key}:exists`, { present: false }, { present: true });
      addMutation(mutations, `${key}:classId`, { present: false }, { present: true, value: component.classId });
      for (const [property, value] of Object.entries(component.properties || {}))
        addMutation(mutations, `${key}:property:${property}`, { present: false }, { present: true, value });
    }
    for (const component of node.components.removed) {
      const key = `${prefix}:component:${component.key}`;
      addMutation(mutations, `${key}:exists`, { present: true }, { present: false });
      addMutation(mutations, `${key}:classId`, { present: true, value: component.classId }, { present: false });
      for (const [property, value] of Object.entries(component.properties || {}))
        addMutation(mutations, `${key}:property:${property}`, { present: true, value }, { present: false });
    }
    for (const component of node.components.changed) {
      const key = `${prefix}:component:${component.key}`;
      const existingClass = component.classId || component.beforeClassId;
      if (!component.replaced) addMutation(mutations, `${key}:classId`,
        { present: true, value: existingClass }, { present: true, value: existingClass });
      if (component.replaced) addMutation(mutations, `${key}:classId`,
        { present: true, value: component.beforeClassId }, { present: true, value: component.afterClassId });
      for (const [property, values] of Object.entries(component.properties || {}))
        addMutation(mutations, `${key}:property:${property}`,
          { present: true, value: values.before }, { present: true, value: values.after });
    }
  }
  return mutations;
}

function conflictDiffSummary(diff) {
  const nodes = (items) => items.slice(0, MAX_CONFLICT_ROWS).map((node) => ({ uuid: node.uuid,
    name: node.name, path: node.path, parentUuid: node.parentUuid,
    componentClasses: node.componentDetails?.map((component) => component.className) || [] }));
  return { counts: diff.counts, added: nodes(diff.added), removed: nodes(diff.removed),
    changed: diff.changed.slice(0, MAX_CONFLICT_ROWS),
    truncated: diff.added.length > MAX_CONFLICT_ROWS || diff.removed.length > MAX_CONFLICT_ROWS
      || diff.changed.length > MAX_CONFLICT_ROWS };
}

function semanticConflict(gitRoot, sourceStages, metaSides, projectAssetRelative) {
  const sides = Object.fromEntries([1, 2, 3].map((stage) => [INDEX_STAGES.get(stage),
    conflictAssetSide(gitRoot, sourceStages, metaSides, stage)]));
  if (Object.values(sides).some((side) => !side)) return { available: false, reason: 'CREATOR_ASSET_STAGES_INCOMPLETE',
    stageAvailability: Object.fromEntries(Object.entries(sides).map(([side, value]) => [side, Boolean(value)])) };
  const identities = Object.fromEntries(Object.entries(sides).map(([side, value]) => [side, metadataIdentity(value.metaBytes)]));
  try {
    const diffs = {
      ours: diffCreatorSerializedAssets({ beforeBytes: sides.base.sourceBytes, beforeMetaBytes: sides.base.metaBytes,
        afterBytes: sides.ours.sourceBytes, afterMetaBytes: sides.ours.metaBytes, assetPath: projectAssetRelative }),
      theirs: diffCreatorSerializedAssets({ beforeBytes: sides.base.sourceBytes, beforeMetaBytes: sides.base.metaBytes,
        afterBytes: sides.theirs.sourceBytes, afterMetaBytes: sides.theirs.metaBytes, assetPath: projectAssetRelative }),
    };
    const mutations = { ours: flattenAssetMutations(diffs.ours), theirs: flattenAssetMutations(diffs.theirs) };
    const overlapKeys = [...mutations.ours.keys()].filter((key) => mutations.theirs.has(key)).sort();
    const conflicts = [];
    const converged = [];
    for (const key of overlapKeys) {
      const ours = mutations.ours.get(key);
      const theirs = mutations.theirs.get(key);
      const row = { key, base: ours.before, ours: ours.after, theirs: theirs.after };
      if (stableJson(ours.after) === stableJson(theirs.after)) converged.push(row);
      else conflicts.push(row);
    }
    const oursOnly = [...mutations.ours.keys()].filter((key) => !mutations.theirs.has(key)).sort();
    const theirsOnly = [...mutations.theirs.keys()].filter((key) => !mutations.ours.has(key)).sort();
    const rows = (items) => items.slice(0, MAX_CONFLICT_ROWS);
    return { available: true, status: conflicts.length ? 'overlapping-changes' : 'disjoint-or-converged',
      metadataIdentities: identities, baseToOurs: conflictDiffSummary(diffs.ours),
      baseToTheirs: conflictDiffSummary(diffs.theirs),
      overlap: { conflictCount: conflicts.length, convergedCount: converged.length,
        conflicts: rows(conflicts), converged: rows(converged), truncated: conflicts.length > MAX_CONFLICT_ROWS
          || converged.length > MAX_CONFLICT_ROWS },
      nonOverlapping: { oursCount: oursOnly.length, theirsCount: theirsOnly.length,
        oursKeys: rows(oursOnly), theirsKeys: rows(theirsOnly), truncated: oursOnly.length > MAX_CONFLICT_ROWS
          || theirsOnly.length > MAX_CONFLICT_ROWS },
      resolution: { automatic: false, required: true,
        note: 'Semantic overlap explains the conflict but does not rewrite serialized files or resolve Git index stages.' } };
  } catch (error) {
    return { available: false, reason: error.code || error.message || 'CREATOR_ASSET_CONFLICT_ANALYSIS_FAILED',
      metadataIdentities: identities };
  }
}

export function runVcsConflictReport({ gitRoot: requestedGitRoot, projectRoot: requestedProjectRoot } = {}) {
  const gitRoot = canonicalDirectory(requestedGitRoot, 'GIT_ROOT');
  const projectRoot = canonicalDirectory(requestedProjectRoot, 'PROJECT_ROOT');
  ensureProject(gitRoot, projectRoot);
  const unmerged = parseIndexEntries(git(gitRoot, ['ls-files', '--unmerged', '-z']).stdout);
  const repoPrefix = path.relative(gitRoot, projectRoot).split(path.sep).filter(Boolean).join('/');
  const projectPrefix = repoPrefix ? `${repoPrefix}/` : '';
  const conflicts = [];
  let outsideProjectCount = 0;
  const context = mergeContext(gitRoot);
  let projectConflictCount = 0;
  for (const [repoPath, stages] of unmerged) {
    if (repoPrefix && !repoPath.startsWith(projectPrefix)) { outsideProjectCount += 1; continue; }
    projectConflictCount += 1;
    if (conflicts.length >= MAX_CONFLICT_ROWS) continue;
    const projectRelative = repoPrefix ? repoPath.slice(projectPrefix.length) : repoPath;
    if (!projectRelative || projectRelative.startsWith('/') || projectRelative.split('/').some((part) => !part || part === '.' || part === '..'))
      throw coded('VCS_CONFLICT_INDEX_PATH_INVALID');
    const completeStages = [1, 2, 3].every((stage) => stages.has(stage));
    const assetType = /\.fire$/i.test(projectRelative) ? 'scene'
      : /\.prefab$/i.test(projectRelative) ? 'prefab' : null;
    const row = { path: projectRelative, kind: assetType || (projectRelative.endsWith('.meta') ? 'metadata' : 'other'),
      stages: Object.fromEntries([...stages].filter(([stage]) => stage > 0)
        .map(([stage, entry]) => [INDEX_STAGES.get(stage), { mode: entry.mode, objectId: entry.objectId }])),
      completeStages };
    if (assetType) {
      try {
        const asset = projectAssetPath(projectRoot, projectRelative);
        const metaPath = `${repoPath}.meta`;
        const metadataStages = indexEntriesForPath(gitRoot, metaPath);
        const metaSides = metadataSides(gitRoot, metaPath, metadataStages, context);
        row.semantic = metaSides
          ? semanticConflict(gitRoot, stages, metaSides, asset.relative)
          : { available: false, reason: 'VCS_CONFLICT_METADATA_SIDES_UNAVAILABLE' };
      } catch (error) {
        row.semantic = { available: false, reason: error.code || error.message || 'CREATOR_ASSET_CONFLICT_ANALYSIS_FAILED' };
      }
    }
    conflicts.push(row);
  }
  conflicts.sort((left, right) => left.path.localeCompare(right.path));
  return { schemaVersion: 1, readOnly: true, projectRoot, gitRoot, creatorVersion: '2.4.15',
    hasConflicts: projectConflictCount > 0 || outsideProjectCount > 0,
    summary: { projectConflicts: projectConflictCount, reportedProjectConflicts: conflicts.length,
      outsideProjectConflicts: outsideProjectCount, truncated: projectConflictCount > conflicts.length,
      semanticAssets: conflicts.filter((item) => item.semantic?.available).length,
      semanticOverlaps: conflicts.filter((item) => item.semantic?.overlap?.conflictCount > 0).length }, conflicts };
}

function safeConflictPath(projectRoot, inputPath) {
  if (typeof inputPath !== 'string' || !inputPath || inputPath.length > 1024 || inputPath.includes('\0')
    || inputPath.includes('\\') || path.posix.isAbsolute(inputPath)) throw coded('VCS_CONFLICT_PATH_INVALID');
  const parts = inputPath.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) throw coded('VCS_CONFLICT_PATH_INVALID');
  const absolute = path.resolve(projectRoot, ...parts);
  if (!inside(projectRoot, absolute)) throw coded('VCS_CONFLICT_PATH_INVALID');
  return { projectRelative: parts.join('/'), absolute };
}

function workingSnapshot(projectRoot, relative, maxBytes = 16 * 1024 * 1024) {
  const parts = relative.split('/');
  let current = projectRoot;
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    let stat;
    try { stat = fs.lstatSync(current); }
    catch (error) {
      if (error.code === 'ENOENT' && index === parts.length - 1) return { exists: false, bytes: null, sha256: null };
      throw coded('VCS_CONFLICT_WORKTREE_PATH_UNAVAILABLE');
    }
    if (stat.isSymbolicLink()) throw coded('VCS_CONFLICT_SYMLINK_REFUSED');
    const final = index === parts.length - 1;
    if (!final && !stat.isDirectory()) throw coded('VCS_CONFLICT_PATH_NOT_REGULAR');
    if (final && (!stat.isFile() || stat.size > maxBytes)) throw coded('VCS_CONFLICT_FILE_UNSAFE_OR_TOO_LARGE');
  }
  const before = fs.lstatSync(current);
  const bytes = fs.readFileSync(current);
  const after = fs.lstatSync(current);
  if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size
    || before.mtimeMs !== after.mtimeMs || bytes.length !== after.size) throw coded('VCS_CONFLICT_FILE_CHANGED_DURING_READ');
  return { exists: true, bytes, sha256: createHash('sha256').update(bytes).digest('hex'), mode: before.mode & 0o777 };
}

function stageSnapshot(entries) {
  return [...entries].sort(([left], [right]) => left - right).map(([stage, entry]) => ({
    stage, mode: entry.mode, objectId: entry.objectId,
  }));
}

function stageEntryBytes(gitRoot, entry, maxBytes = 16 * 1024 * 1024) {
  if (!entry) return null;
  if (!['100644', '100755'].includes(entry.mode)) throw coded('VCS_CONFLICT_NON_REGULAR_GIT_MODE');
  return readIndexBlob(gitRoot, entry, maxBytes);
}

function currentFileBytes(gitRoot, projectRoot, gitRelative, projectRelative, entries, selectedStage, maxBytes) {
  const hasConflictStages = [...entries.keys()].some((stage) => stage > 0);
  if (hasConflictStages) {
    const entry = entries.get(selectedStage);
    return stageEntryBytes(gitRoot, entry, maxBytes);
  }
  return workingSnapshot(projectRoot, projectRelative, maxBytes).bytes;
}

function resolveTargetGroup(gitRoot, projectRoot, projectRelative, side) {
  const stage = side === 'ours' ? 2 : 3;
  const gitPrefix = path.relative(gitRoot, projectRoot).split(path.sep).filter(Boolean).join('/');
  const toGitPath = (relative) => gitPrefix ? `${gitPrefix}/${relative}` : relative;
  const assetMeta = projectRelative.match(/^(.*\.(?:fire|prefab))(?:\.meta)?$/i);
  if (assetMeta) {
    const assetRelative = assetMeta[1];
    projectAssetPath(projectRoot, assetRelative);
    const metaRelative = `${assetRelative}.meta`;
    const assetGitPath = toGitPath(assetRelative);
    const metaGitPath = toGitPath(metaRelative);
    const assetEntries = indexEntriesForPath(gitRoot, assetGitPath);
    const metaEntries = indexEntriesForPath(gitRoot, metaGitPath);
    const assetConflict = [...assetEntries.keys()].some((item) => item > 0);
    const metaConflict = [...metaEntries.keys()].some((item) => item > 0);
    if (!assetConflict && !metaConflict) throw coded('VCS_CONFLICT_PATH_NOT_UNMERGED');
    const assetEntry = assetConflict ? assetEntries.get(stage) : assetEntries.get(0);
    const metaEntry = metaConflict ? metaEntries.get(stage) : metaEntries.get(0);
    const assetBytes = currentFileBytes(gitRoot, projectRoot, assetGitPath, assetRelative,
      assetEntries, stage, 16 * 1024 * 1024);
    const metaBytes = currentFileBytes(gitRoot, projectRoot, metaGitPath, metaRelative,
      metaEntries, stage, 64 * 1024);
    const candidates = [];
    if (assetConflict) candidates.push({ projectRelative: assetRelative, gitRelative: assetGitPath,
      entries: assetEntries, selectedEntry: assetEntry, selectedBytes: assetBytes });
    if (metaConflict) candidates.push({ projectRelative: metaRelative, gitRelative: metaGitPath,
      entries: metaEntries, selectedEntry: metaEntry, selectedBytes: metaBytes, maxBytes: 64 * 1024 });
    return { assetRelative, files: candidates, guards: [
      { projectRelative: assetRelative, gitRelative: assetGitPath, entries: assetEntries },
      { projectRelative: metaRelative, gitRelative: metaGitPath, entries: metaEntries, maxBytes: 64 * 1024 },
    ] };
  }

  const gitRelative = toGitPath(projectRelative);
  const entries = indexEntriesForPath(gitRoot, gitRelative);
  if (![...entries.keys()].some((item) => item > 0)) throw coded('VCS_CONFLICT_PATH_NOT_UNMERGED');
  const selectedEntry = entries.get(stage) || null;
  const selectedBytes = stageEntryBytes(gitRoot, selectedEntry);
  if (/\.meta$/i.test(projectRelative) && selectedBytes) {
    try {
      const metadata = JSON.parse(selectedBytes.toString('utf8'));
      if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)
        || typeof metadata.uuid !== 'string' || typeof metadata.importer !== 'string')
        throw coded('VCS_CONFLICT_METADATA_INVALID');
    } catch (error) {
      if (error.code) throw error;
      throw coded('VCS_CONFLICT_METADATA_INVALID');
    }
  }
  return { files: [{ projectRelative, gitRelative, entries, selectedEntry, selectedBytes }],
    guards: [{ projectRelative, gitRelative, entries }] };
}

function atomicWriteResolved(projectRoot, file) {
  const absolute = path.join(projectRoot, ...file.projectRelative.split('/'));
  const current = workingSnapshot(projectRoot, file.projectRelative, file.maxBytes);
  if (file.beforeWorking && (current.exists !== file.beforeWorking.exists
    || current.sha256 !== file.beforeWorking.sha256)) throw coded('VCS_CONFLICT_RESOLUTION_STATE_CHANGED');
  if (!file.selectedBytes) {
    if (current.exists) fs.unlinkSync(absolute);
    return;
  }
  const parent = path.dirname(absolute);
  const temporary = path.join(parent, `.cocos-vcs-resolve-${randomUUID()}.tmp`);
  const mode = typeof file.selectedEntry?.mode === 'number'
    ? file.selectedEntry.mode & 0o777
    : file.selectedEntry?.mode === '100755' ? 0o755 : 0o644;
  try {
    fs.writeFileSync(temporary, file.selectedBytes, { flag: 'wx', mode });
    fs.renameSync(temporary, absolute);
  } catch (error) {
    try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch (_) {}
    throw error;
  }
}

function verifyResolvedFile(gitRoot, projectRoot, file) {
  const entries = indexEntriesForPath(gitRoot, file.gitRelative);
  const working = workingSnapshot(projectRoot, file.projectRelative, file.maxBytes);
  if (!file.selectedEntry) return entries.size === 0 && !working.exists;
  const indexEntry = entries.get(0);
  if (entries.size !== 1 || !indexEntry || indexEntry.objectId !== file.selectedEntry.objectId
    || indexEntry.mode !== file.selectedEntry.mode || !working.exists) return false;
  return createHash('sha256').update(working.bytes).digest('hex')
    === createHash('sha256').update(file.selectedBytes).digest('hex');
}

export function runVcsConflictResolve({ gitRoot: requestedGitRoot, projectRoot: requestedProjectRoot,
  assetPath: requestedPath, side, apply = false } = {}) {
  if (!['ours', 'theirs'].includes(side)) throw coded('VCS_CONFLICT_SIDE_INVALID');
  if (typeof apply !== 'boolean') throw coded('VCS_CONFLICT_APPLY_INVALID');
  const gitRoot = canonicalDirectory(requestedGitRoot, 'GIT_ROOT');
  const projectRoot = canonicalDirectory(requestedProjectRoot, 'PROJECT_ROOT');
  ensureProject(gitRoot, projectRoot);
  const requested = safeConflictPath(projectRoot, requestedPath);
  const canonicalAsset = requested.projectRelative.match(/^(.*\.(?:fire|prefab))\.meta$/i)?.[1]
    || requested.projectRelative;
  const canonical = safeConflictPath(projectRoot, canonicalAsset);
  if (/\.(?:fire|prefab)$/i.test(canonical.projectRelative)) projectAssetPath(projectRoot, canonical.projectRelative);
  const group = resolveTargetGroup(gitRoot, projectRoot, canonical.projectRelative, side);
  const guards = group.guards.map((guard) => ({ ...guard,
    beforeWorking: workingSnapshot(projectRoot, guard.projectRelative, guard.maxBytes),
    beforeStages: stageSnapshot(guard.entries) }));
  const guardByPath = new Map(guards.map((guard) => [guard.gitRelative, guard]));
  const files = group.files.map((file) => {
    const guard = guardByPath.get(file.gitRelative);
    return { ...file, beforeWorking: guard.beforeWorking, beforeStages: guard.beforeStages,
      action: file.selectedBytes ? 'write' : 'delete', selectedSha256: file.selectedBytes
        ? createHash('sha256').update(file.selectedBytes).digest('hex') : null,
      selectedObjectId: file.selectedEntry?.objectId || null };
  });
  if (group.assetRelative) {
    const selectedByPath = new Map(files.map((file) => [file.projectRelative, file.selectedBytes]));
    const assetRelative = group.assetRelative;
    const metaRelative = `${assetRelative}.meta`;
    const assetBytes = selectedByPath.has(assetRelative) ? selectedByPath.get(assetRelative)
      : guardByPath.get(group.guards.find((guard) => guard.projectRelative === assetRelative).gitRelative).beforeWorking.bytes;
    const metaBytes = selectedByPath.has(metaRelative) ? selectedByPath.get(metaRelative)
      : guardByPath.get(group.guards.find((guard) => guard.projectRelative === metaRelative).gitRelative).beforeWorking.bytes;
    if (Boolean(assetBytes) !== Boolean(metaBytes)) throw coded('VCS_CONFLICT_RESOLUTION_ASSET_METADATA_MISMATCH');
    if (assetBytes) inspectCreatorSerializedAsset({ sourceBytes: assetBytes, metaBytes, assetPath: assetRelative });
  }
  const base = { schemaVersion: 1, command: 'vcs conflicts resolve', projectRoot, gitRoot,
    creatorVersion: '2.4.15', assetPath: canonical.projectRelative, side,
    files: files.map((file) => ({ path: file.projectRelative, action: file.action,
      selectedObjectId: file.selectedObjectId, selectedSha256: file.selectedSha256,
      previousSha256: file.beforeWorking.sha256, previousStages: file.beforeStages })),
    guardedPaths: guards.map((guard) => ({ path: guard.projectRelative,
      previousSha256: guard.beforeWorking.sha256, previousStages: guard.beforeStages })) };
  if (!apply) return { ...base, status: 'planned', readOnly: true, applyRequired: true,
    note: 'This plan selects the exact Git index side and will update the working file and index only when --apply is supplied.' };

  for (const guard of guards) {
    const latest = indexEntriesForPath(gitRoot, guard.gitRelative);
    const working = workingSnapshot(projectRoot, guard.projectRelative, guard.maxBytes);
    if (JSON.stringify(stageSnapshot(latest)) !== JSON.stringify(guard.beforeStages)
      || working.sha256 !== guard.beforeWorking.sha256 || working.exists !== guard.beforeWorking.exists)
      throw coded('VCS_CONFLICT_RESOLUTION_STATE_CHANGED');
  }
  const originals = files.map((file) => ({ file, bytes: file.beforeWorking.bytes,
    exists: file.beforeWorking.exists, mode: file.beforeWorking.mode }));
  try {
    for (const file of files) atomicWriteResolved(projectRoot, file);
  } catch (error) {
    for (const original of originals) {
      try {
        if (original.exists) {
          const current = workingSnapshot(projectRoot, original.file.projectRelative, original.file.maxBytes);
          const file = { ...original.file, selectedBytes: original.bytes,
            selectedEntry: { mode: original.mode === 0o755 ? '100755' : '100644' }, beforeWorking: current };
          atomicWriteResolved(projectRoot, file);
        } else {
          const current = workingSnapshot(projectRoot, original.file.projectRelative, original.file.maxBytes);
          if (current.exists) atomicWriteResolved(projectRoot, { ...original.file, selectedBytes: null, beforeWorking: current });
        }
      } catch (_) {}
    }
    throw error;
  }
  try {
    for (const file of files) {
      const latest = indexEntriesForPath(gitRoot, file.gitRelative);
      if (JSON.stringify(stageSnapshot(latest)) !== JSON.stringify(file.beforeStages))
        throw coded('VCS_CONFLICT_RESOLUTION_STATE_CHANGED');
    }
    git(gitRoot, ['add', '--', ...files.map((file) => `:(literal)${file.gitRelative}`)]);
    if (files.some((file) => !verifyResolvedFile(gitRoot, projectRoot, file))) throw coded('VCS_CONFLICT_RESOLUTION_READBACK_MISMATCH');
  } catch (error) {
    return { ...base, status: 'needs-manual-review', readOnly: false, resolved: false,
      requiresManualReview: true, error: error.code || error.message || String(error),
      note: 'The selected bytes were written, but Git index readback did not confirm every path. Inspect git status before continuing.' };
  }
  return { ...base, status: 'resolved', readOnly: false, resolved: true, requiresManualReview: false,
    indexUpdated: true, workingTreeUpdated: true,
    note: 'The selected side was written and staged for the listed conflict paths. Review the staged result before committing.' };
}
