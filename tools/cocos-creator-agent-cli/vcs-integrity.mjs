import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const CACHE_DIRECTORIES = new Set(['library', 'temp', 'local', 'build']);
const MAX_FILES = 20000;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const TEXT_EXTENSIONS = new Set([
  '.anim', '.atlas', '.effect', '.fire', '.html', '.js', '.json', '.md', '.meta', '.mjs',
  '.prefab', '.scene', '.ts', '.txt', '.xml', '.yaml', '.yml',
]);
const IGNORED_NAMES = new Set(['.DS_Store', 'Thumbs.db']);

function absoluteDirectory(value, optionName) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) throw new Error(`${optionName}_MUST_BE_ABSOLUTE`);
  const canonical = fs.realpathSync(value);
  const stat = fs.statSync(canonical);
  if (!stat.isDirectory()) throw new Error(`${optionName}_MUST_BE_DIRECTORY`);
  return canonical;
}

function gitRootFor(requestedRoot) {
  const result = spawnSync('git', ['-C', requestedRoot, 'rev-parse', '--show-toplevel'], {
    encoding: 'utf8', timeout: 15000, windowsHide: true,
  });
  if (result.error) throw new Error(`GIT_UNAVAILABLE:${result.error.message}`);
  if (result.status !== 0) throw new Error(`GIT_ROOT_INVALID:${(result.stderr || '').trim()}`);
  return fs.realpathSync(result.stdout.trim());
}

function relativeInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function walk(root, { skipCaches = false } = {}) {
  const files = [];
  const directories = [];
  const symlinks = [];
  const stack = [root];
  let truncated = false;
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (IGNORED_NAMES.has(entry.name)) continue;
      const absolute = path.join(current, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      if (entry.isSymbolicLink()) { symlinks.push(relative); continue; }
      if (entry.isDirectory()) {
        if (entry.name === '.git' || entry.name === 'node_modules' || (skipCaches && CACHE_DIRECTORIES.has(entry.name))) continue;
        directories.push(relative);
        stack.push(absolute);
      } else if (entry.isFile()) {
        files.push({ absolute, relative, size: entry.size });
        if (files.length >= MAX_FILES) { truncated = true; stack.length = 0; break; }
      }
    }
  }
  return { files: files.sort((a, b) => a.relative.localeCompare(b.relative)), directories, symlinks, truncated };
}

function readAssetMetadata(projectRoot, findings) {
  const assetsRoot = path.join(projectRoot, 'assets');
  let stat;
  try { stat = fs.lstatSync(assetsRoot); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    findings.push({ id: 'assets-root-unsafe', severity: 'error', path: 'assets', detail: 'The assets path is not a regular directory.' });
    return;
  }

  const tree = walk(assetsRoot);
  for (const relative of tree.symlinks) {
    findings.push({ id: 'asset-symlink-skipped', severity: 'warning', path: `assets/${relative}`, detail: 'Symbolic link was not followed during the read-only scan.' });
  }
  if (tree.truncated) findings.push({ id: 'asset-scan-truncated', severity: 'warning', path: 'assets', detail: `Asset scan stopped at ${MAX_FILES} files.` });

  const fileNames = new Set(tree.files.map((file) => file.relative));
  const directoryNames = new Set(tree.directories);
  const metaFiles = tree.files.filter((file) => file.relative.endsWith('.meta'));

  for (const file of tree.files) {
    if (file.relative.endsWith('.meta')) continue;
    const metaPath = `${file.relative}.meta`;
    if (!fileNames.has(metaPath)) findings.push({ id: 'asset-meta-missing', severity: 'error', path: `assets/${file.relative}`, detail: `Missing sidecar assets/${metaPath}.` });
  }
  for (const directory of tree.directories) {
    const metaPath = `${directory}.meta`;
    if (!fileNames.has(metaPath)) findings.push({ id: 'asset-meta-missing', severity: 'error', path: `assets/${directory}`, detail: `Missing folder metadata assets/${metaPath}.` });
  }

  const uuidLocations = new Map();
  let totalMetaBytes = 0;
  for (const metaFile of metaFiles) {
    const owner = metaFile.relative.slice(0, -'.meta'.length);
    if (!fileNames.has(owner) && !directoryNames.has(owner)) {
      findings.push({ id: 'asset-meta-orphaned', severity: 'error', path: `assets/${metaFile.relative}`, detail: `No asset file or directory exists at assets/${owner}.` });
    }
    if (metaFile.size > MAX_FILE_BYTES) {
      findings.push({ id: 'asset-meta-too-large', severity: 'warning', path: `assets/${metaFile.relative}`, detail: `Metadata exceeds the ${MAX_FILE_BYTES}-byte JSON scan limit.` });
      continue;
    }
    totalMetaBytes += metaFile.size;
    if (totalMetaBytes > MAX_TOTAL_BYTES) {
      findings.push({ id: 'asset-meta-scan-truncated', severity: 'warning', path: 'assets', detail: `Metadata scan stopped after ${MAX_TOTAL_BYTES} bytes.` });
      break;
    }
    let metadata;
    try { metadata = JSON.parse(fs.readFileSync(metaFile.absolute, 'utf8')); }
    catch (error) {
      findings.push({ id: 'asset-meta-unreadable', severity: 'warning', path: `assets/${metaFile.relative}`, detail: `Metadata could not be parsed as JSON: ${error.message}` });
      continue;
    }
    const entries = [];
    if (typeof metadata?.uuid === 'string' && metadata.uuid) entries.push({ uuid: metadata.uuid, location: 'uuid' });
    if (metadata?.subMetas && typeof metadata.subMetas === 'object' && !Array.isArray(metadata.subMetas)) {
      for (const [name, child] of Object.entries(metadata.subMetas)) {
        if (typeof child?.uuid === 'string' && child.uuid) entries.push({ uuid: child.uuid, location: `subMetas.${name}.uuid` });
      }
    }
    for (const item of entries) {
      const previous = uuidLocations.get(item.uuid) || [];
      previous.push({ path: `assets/${metaFile.relative}`, location: item.location });
      uuidLocations.set(item.uuid, previous);
    }
  }
  for (const [uuid, locations] of uuidLocations) {
    if (locations.length > 1) findings.push({ id: 'asset-uuid-duplicate', severity: 'error', path: locations[0].path, uuid, locations, detail: `UUID ${uuid} appears ${locations.length} times in scanned asset metadata.` });
  }
}

function trackedCacheFiles(gitRoot, projectRoot, findings) {
  const result = spawnSync('git', ['-C', gitRoot, 'ls-files', '-z'], {
    encoding: 'buffer', timeout: 30000, maxBuffer: 64 * 1024 * 1024, windowsHide: true,
  });
  if (result.error) throw new Error(`GIT_LIST_FILES_FAILED:${result.error.message}`);
  if (result.status !== 0) throw new Error(`GIT_LIST_FILES_FAILED:${(result.stderr || Buffer.alloc(0)).toString('utf8').trim()}`);
  const tracked = result.stdout.toString('utf8').split('\0').filter(Boolean);
  let trackedProjectFileCount = 0;
  const cachePaths = new Set();
  for (const gitRelative of tracked) {
    const absolute = path.resolve(gitRoot, gitRelative);
    if (!relativeInside(projectRoot, absolute)) continue;
    trackedProjectFileCount += 1;
    const projectRelative = path.relative(projectRoot, absolute).split(path.sep).join('/');
    const segments = projectRelative.split('/');
    for (let index = 0; index < segments.length; index += 1) {
      if (CACHE_DIRECTORIES.has(segments[index])) {
        cachePaths.add(segments.slice(0, index + 1).join('/'));
        break;
      }
    }
  }
  for (const cachePath of [...cachePaths].sort()) findings.push({ id: 'cache-tracked', severity: 'warning', path: cachePath, detail: `Git tracks files under Creator cache/output directory ${cachePath}.` });
  return trackedProjectFileCount;
}

function conflictMarkers(projectRoot, findings) {
  const tree = walk(projectRoot, { skipCaches: true });
  for (const relative of tree.symlinks) {
    findings.push({ id: 'project-symlink-skipped', severity: 'warning', path: relative, detail: 'Symbolic link was not followed during the conflict-marker scan.' });
  }
  let totalBytes = 0;
  for (const file of tree.files) {
    const extension = path.extname(file.relative).toLowerCase();
    if (!TEXT_EXTENSIONS.has(extension)) continue;
    if (file.size > MAX_FILE_BYTES) {
      findings.push({ id: 'text-file-skipped-too-large', severity: 'warning', path: file.relative, detail: `Conflict-marker scan skipped a file over ${MAX_FILE_BYTES} bytes.` });
      continue;
    }
    totalBytes += file.size;
    if (totalBytes > MAX_TOTAL_BYTES) {
      findings.push({ id: 'text-scan-truncated', severity: 'warning', path: '.', detail: `Conflict-marker scan stopped after ${MAX_TOTAL_BYTES} bytes.` });
      break;
    }
    const bytes = fs.readFileSync(file.absolute);
    if (bytes.includes(0)) continue;
    const lines = bytes.toString('utf8').split(/\r?\n/);
    const markers = [];
    lines.forEach((line, index) => {
      if (/^\s*<{7}(?:\s|$)/.test(line)) markers.push({ marker: '<<<<<<<', line: index + 1 });
      else if (/^\s*>{7}(?:\s|$)/.test(line)) markers.push({ marker: '>>>>>>>', line: index + 1 });
    });
    if (markers.some((marker) => marker.marker === '<<<<<<<') && markers.some((marker) => marker.marker === '>>>>>>>')) {
      findings.push({ id: 'conflict-markers', severity: 'error', path: file.relative, markers, detail: 'Text file contains Git conflict start and end markers.' });
    }
  }
  if (tree.truncated) findings.push({ id: 'text-scan-truncated', severity: 'warning', path: '.', detail: `Conflict-marker scan stopped at ${MAX_FILES} files.` });
}

export function runVcsDoctor({ gitRoot: requestedGitRoot, projectRoot: requestedProjectRoot } = {}) {
  const gitRootInput = absoluteDirectory(requestedGitRoot, 'GIT_ROOT');
  const projectRoot = absoluteDirectory(requestedProjectRoot, 'PROJECT_ROOT');
  const actualGitRoot = gitRootFor(gitRootInput);
  if (actualGitRoot !== gitRootInput) throw new Error(`GIT_ROOT_MISMATCH:expected ${gitRootInput}, actual ${actualGitRoot}`);
  const projectFile = path.join(projectRoot, 'project.json');
  const projectStat = fs.lstatSync(projectFile);
  if (!projectStat.isFile() || projectStat.isSymbolicLink()) throw new Error('TARGET_IS_NOT_COCOS_PROJECT');
  const project = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
  if (!relativeInside(gitRootInput, projectRoot)) throw new Error('PROJECT_OUTSIDE_GIT_ROOT');

  const findings = [];
  const trackedFileCount = trackedCacheFiles(gitRootInput, projectRoot, findings);
  readAssetMetadata(projectRoot, findings);
  conflictMarkers(projectRoot, findings);
  findings.sort((a, b) => a.path.localeCompare(b.path) || a.id.localeCompare(b.id));
  const errors = findings.filter((finding) => finding.severity === 'error').length;
  const warnings = findings.filter((finding) => finding.severity === 'warning').length;
  return {
    schemaVersion: 1,
    readOnly: true,
    ok: errors === 0,
    gitRoot: gitRootInput,
    projectRoot,
    projectName: project.name || path.basename(projectRoot),
    checks: {
      trackedFileCount,
      scannedAssetRoot: fs.existsSync(path.join(projectRoot, 'assets')),
      limits: { maxFiles: MAX_FILES, maxFileBytes: MAX_FILE_BYTES, maxTotalBytes: MAX_TOTAL_BYTES },
    },
    findings,
    summary: { errors, warnings, findings: findings.length },
  };
}
