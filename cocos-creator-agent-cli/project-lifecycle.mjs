import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { resolveCreatorExecutable, resolvePreferredCreatorExecutable } from './creator-workflows.mjs';
import { CREATOR_VERSION, SUPPORTED_CREATOR_VERSIONS, isSupportedCreatorVersion } from './bridge/contracts.mjs';

const DEFAULT_MAX_DEPTH = 3;
const MAX_SCAN_DIRECTORIES = 10000;
const MAX_PROJECT_JSON_BYTES = 64 * 1024;
const ALWAYS_SKIP_DIRECTORIES = new Set(['.git', 'node_modules']);
const ROOT_CACHE_DIRECTORIES = new Set(['library', 'temp', 'local', 'build']);
const TEMPLATE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function coded(code, detail) {
  return Object.assign(new Error(code), { code, ...(detail === undefined ? {} : { detail }) });
}

function defaultSearchRoots(home = os.homedir()) {
  return [...new Set([
    path.join(home, 'Documents', 'CocosProjects'),
    path.join(home, 'CocosProjects'),
    path.join(home, 'Projects'),
    path.join(home, 'Documents'),
  ])];
}

function normalizeSearchRoots(searchRoots) {
  if (searchRoots === undefined) return defaultSearchRoots();
  if (!Array.isArray(searchRoots) || searchRoots.length === 0
    || searchRoots.some((root) => typeof root !== 'string' || !path.isAbsolute(root)))
    throw coded('PROJECT_SEARCH_ROOTS_INVALID');
  return [...new Set(searchRoots.map((root) => path.resolve(root)))];
}

function inspectProject(projectRoot) {
  const projectFile = path.join(projectRoot, 'project.json');
  try {
    const stat = fs.lstatSync(projectFile);
    if (!stat.isFile() || stat.isSymbolicLink()) return { issue: 'PROJECT_FILE_NOT_REGULAR' };
    if (stat.size > MAX_PROJECT_JSON_BYTES) return { issue: 'PROJECT_FILE_TOO_LARGE' };
    const project = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
    if (!project || typeof project !== 'object' || Array.isArray(project)
      || typeof project.version !== 'string' || !project.version.trim()) return { issue: 'PROJECT_VERSION_MISSING' };
    return { project };
  } catch (error) {
    return { issue: error instanceof SyntaxError ? 'PROJECT_JSON_INVALID' : 'PROJECT_FILE_UNREADABLE' };
  }
}

export function listCreatorProjects({ searchRoots, maxDepth = DEFAULT_MAX_DEPTH, home } = {}) {
  if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 8) throw coded('PROJECT_SEARCH_DEPTH_INVALID');
  const roots = searchRoots === undefined && home !== undefined
    ? defaultSearchRoots(home) : normalizeSearchRoots(searchRoots);
  const projects = [];
  const issues = [];
  const visited = new Set();
  let scannedDirectories = 0;
  let truncated = false;

  for (const requestedRoot of roots) {
    let rootStat;
    try { rootStat = fs.lstatSync(requestedRoot); }
    catch (_) { continue; }
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
      issues.push({ path: requestedRoot, code: 'PROJECT_SEARCH_ROOT_NOT_REAL_DIRECTORY' });
      continue;
    }
    let canonicalRoot;
    try { canonicalRoot = fs.realpathSync(requestedRoot); }
    catch (_) { issues.push({ path: requestedRoot, code: 'PROJECT_SEARCH_ROOT_UNREADABLE' }); continue; }
    const stack = [{ directory: canonicalRoot, depth: 0 }];
    while (stack.length) {
      const current = stack.pop();
      if (visited.has(current.directory)) continue;
      visited.add(current.directory);
      scannedDirectories += 1;
      if (scannedDirectories > MAX_SCAN_DIRECTORIES) { truncated = true; break; }

      let entries;
      try { entries = fs.readdirSync(current.directory, { withFileTypes: true }); }
      catch (_) { issues.push({ path: current.directory, code: 'PROJECT_DIRECTORY_UNREADABLE' }); continue; }
      const candidate = entries.some((entry) => entry.name === 'project.json' && entry.isFile());
      if (candidate) {
        const inspected = inspectProject(current.directory);
        if (inspected.project) {
          const project = inspected.project;
          projects.push({
            name: typeof project.name === 'string' && project.name.trim() ? project.name : path.basename(current.directory),
            projectRoot: current.directory,
            creatorVersion: project.version,
            projectId: typeof project.id === 'string' ? project.id : null,
            supported: isSupportedCreatorVersion(project.version),
          });
          continue;
        }
        issues.push({ path: path.join(current.directory, 'project.json'), code: inspected.issue });
      }
      if (current.depth >= maxDepth) continue;
      for (const entry of entries.sort((left, right) => right.name.localeCompare(left.name))) {
        if (!entry.isDirectory() || entry.isSymbolicLink() || ALWAYS_SKIP_DIRECTORIES.has(entry.name)) continue;
        if (current.depth === 0 && ROOT_CACHE_DIRECTORIES.has(entry.name)) continue;
        stack.push({ directory: path.join(current.directory, entry.name), depth: current.depth + 1 });
      }
    }
    if (truncated) break;
  }

  projects.sort((left, right) => left.name.localeCompare(right.name) || left.projectRoot.localeCompare(right.projectRoot));
  return { schemaVersion: 1, supportedCreatorVersion: CREATOR_VERSION,
    creatorVersionPreference: SUPPORTED_CREATOR_VERSIONS, searchedRoots: roots,
    maxDepth, scannedDirectories: Math.min(scannedDirectories, MAX_SCAN_DIRECTORIES), truncated, projects, issues };
}

function requireProjectRoot(projectRoot) {
  if (typeof projectRoot !== 'string' || !path.isAbsolute(projectRoot)) throw coded('PROJECT_ROOT_ABSOLUTE_PATH_REQUIRED');
  let root;
  try { root = fs.realpathSync(projectRoot); } catch (_) { throw coded('PROJECT_ROOT_INVALID'); }
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw coded('PROJECT_ROOT_INVALID');
  const inspected = inspectProject(root);
  if (!inspected.project) throw coded(inspected.issue || 'PROJECT_ROOT_INVALID');
  if (!isSupportedCreatorVersion(inspected.project.version))
    throw coded('PROJECT_CREATOR_VERSION_MISMATCH', inspected.project.version);
  return { root, project: inspected.project };
}

function realDirectory(input, code) {
  if (typeof input !== 'string' || !path.isAbsolute(input)) throw coded(code);
  let stat;
  try { stat = fs.lstatSync(input); } catch (_) { throw coded(code); }
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw coded(code);
  try { return fs.realpathSync(input); } catch (_) { throw coded(code); }
}

function resolveTemplateRoot({ creatorPath, templateRoot, platform = process.platform } = {}) {
  if (creatorPath !== undefined && templateRoot !== undefined) throw coded('PROJECT_TEMPLATE_ROOT_EXCLUSIVE');
  if (templateRoot !== undefined) return { root: realDirectory(templateRoot, 'PROJECT_TEMPLATE_ROOT_INVALID'), creatorVersion: null };
  const creator = creatorPath !== undefined
    ? resolveCreatorExecutable(creatorPath, { platform })
    : resolvePreferredCreatorExecutable({ platform });
  const bundleRoot = creator.bundleRoot;
  const resourcesRoot = platform === 'win32'
    ? path.join(bundleRoot, 'resources') : path.join(bundleRoot, 'Contents', 'Resources');
  return { root: realDirectory(path.join(resourcesRoot, 'templates'), 'PROJECT_TEMPLATES_NOT_FOUND'),
    creatorVersion: creator.creatorVersion };
}

function inspectTemplate(templateRoot, templateId) {
  if (typeof templateId !== 'string' || !TEMPLATE_ID_PATTERN.test(templateId)) throw coded('PROJECT_TEMPLATE_ID_INVALID');
  const templatePath = path.join(templateRoot, templateId);
  let stat;
  try { stat = fs.lstatSync(templatePath); } catch (_) { throw coded('PROJECT_TEMPLATE_NOT_FOUND', templateId); }
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw coded('PROJECT_TEMPLATE_NOT_FOUND', templateId);
  const inspected = inspectProject(templatePath);
  if (!inspected.project) throw coded('PROJECT_TEMPLATE_INVALID', inspected.issue);
  if (!isSupportedCreatorVersion(inspected.project.version))
    throw coded('PROJECT_TEMPLATE_CREATOR_VERSION_UNSUPPORTED', inspected.project.version);
  return { templatePath: fs.realpathSync(templatePath), project: inspected.project };
}

export function listCreatorTemplates({ creatorPath, templateRoot, platform } = {}) {
  const resolved = resolveTemplateRoot({ creatorPath, templateRoot, platform });
  const root = resolved.root;
  const templates = [];
  const issues = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || !TEMPLATE_ID_PATTERN.test(entry.name)) continue;
    try {
      const inspected = inspectTemplate(root, entry.name);
      let metadata = {};
      const metadataPath = path.join(inspected.templatePath, 'template.json');
      try {
        const stat = fs.lstatSync(metadataPath);
        if (stat.isFile() && !stat.isSymbolicLink() && stat.size <= MAX_PROJECT_JSON_BYTES) {
          const parsed = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) metadata = parsed;
        }
      } catch (_) {}
      templates.push({ id: entry.name, nameKey: typeof metadata.name === 'string' ? metadata.name : null,
        descriptionKey: typeof metadata.desc === 'string' ? metadata.desc : null,
        templateCreatorVersion: inspected.project.version, compatible: true, templatePath: inspected.templatePath });
    } catch (error) {
      issues.push({ id: entry.name, code: error.code || 'PROJECT_TEMPLATE_INVALID' });
    }
  }
  return { schemaVersion: 1, creatorVersion: resolved.creatorVersion || CREATOR_VERSION,
    templateRoot: root, templates, issues };
}

function validateProjectName(name) {
  if (name === undefined) return undefined;
  if (typeof name !== 'string' || !name.trim() || name.length > 128 || /[\u0000-\u001f\u007f]/.test(name))
    throw coded('PROJECT_NAME_INVALID');
  return name.trim();
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function excludedDirectory(relative, name) {
  if (ALWAYS_SKIP_DIRECTORIES.has(name)) return true;
  return !relative && ROOT_CACHE_DIRECTORIES.has(name);
}

function copyProjectTree(sourceRoot, targetRoot, name, projectId, creatorVersion) {
  let copiedFiles = 0;
  let copiedBytes = 0;
  const skippedDirectories = [];

  const copyDirectory = (sourceDirectory, targetDirectory, relativeDirectory) => {
    const sourceStat = fs.lstatSync(sourceDirectory);
    if (!sourceStat.isDirectory() || sourceStat.isSymbolicLink()) throw coded('PROJECT_CLONE_SOURCE_CHANGED');
    fs.mkdirSync(targetDirectory, { mode: sourceStat.mode & 0o777 });
    const entries = fs.readdirSync(sourceDirectory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw coded('PROJECT_CLONE_SYMLINK_UNSUPPORTED', relativePath);
      if (entry.isDirectory()) {
        if (excludedDirectory(relativeDirectory, entry.name)) {
          skippedDirectories.push(relativePath);
          continue;
        }
        copyDirectory(path.join(sourceDirectory, entry.name), path.join(targetDirectory, entry.name), relativePath);
        continue;
      }
      if (!entry.isFile()) throw coded('PROJECT_CLONE_SPECIAL_FILE_UNSUPPORTED', relativePath);
      const sourceFile = path.join(sourceDirectory, entry.name);
      const before = fs.lstatSync(sourceFile);
      if (!before.isFile() || before.isSymbolicLink()) throw coded('PROJECT_CLONE_SOURCE_CHANGED', relativePath);
      if (relativePath === 'project.json') {
        const project = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
        project.id = projectId;
        project.name = name;
        project.version = creatorVersion;
        const serializedProject = `${JSON.stringify(project, null, 2)}\n`;
        fs.writeFileSync(path.join(targetDirectory, entry.name), serializedProject, { mode: before.mode & 0o777, flag: 'wx' });
        copiedBytes += Buffer.byteLength(serializedProject);
      } else {
        fs.copyFileSync(sourceFile, path.join(targetDirectory, entry.name), fs.constants.COPYFILE_EXCL);
        copiedBytes += before.size;
      }
      copiedFiles += 1;
    }
  };

  copyDirectory(sourceRoot, targetRoot, '');
  return { copiedFiles, copiedBytes, skippedDirectories };
}

function materializeProject({ sourceRoot, targetPath, name, operation }) {
  if (typeof targetPath !== 'string' || !path.isAbsolute(targetPath)) throw coded('PROJECT_TARGET_ABSOLUTE_PATH_REQUIRED');
  const requestedTarget = path.resolve(targetPath);
  const targetName = path.basename(requestedTarget);
  if (!targetName || targetName === '.' || targetName === path.parse(requestedTarget).root) throw coded('PROJECT_TARGET_PATH_INVALID');
  const targetParent = path.dirname(requestedTarget);
  let canonicalParent;
  try {
    const parentStat = fs.statSync(targetParent);
    if (!parentStat.isDirectory()) throw new Error('not a directory');
    canonicalParent = fs.realpathSync(targetParent);
  } catch (_) { throw coded('PROJECT_TARGET_PARENT_INVALID'); }
  const targetRoot = path.join(canonicalParent, targetName);
  if (isWithin(sourceRoot, targetRoot) || isWithin(targetRoot, sourceRoot)) throw coded(`PROJECT_${operation.toUpperCase()}_PATH_OVERLAP`);
  try { fs.lstatSync(targetRoot); throw coded('PROJECT_TARGET_ALREADY_EXISTS'); }
  catch (error) { if (error?.code !== 'ENOENT') throw error; }

  const projectName = validateProjectName(name) || targetName;
  const projectId = randomUUID();
  const sourceProject = inspectProject(sourceRoot);
  if (!sourceProject.project || !isSupportedCreatorVersion(sourceProject.project.version))
    throw coded('PROJECT_CREATOR_VERSION_MISMATCH', sourceProject.project?.version || sourceProject.issue);
  const creatorVersion = sourceProject.project.version;
  const stagingRoot = path.join(canonicalParent, `.${targetName}.cocos-${operation}-${randomUUID()}`);
  try {
    const copied = copyProjectTree(sourceRoot, stagingRoot, projectName, projectId, creatorVersion);
    try { fs.lstatSync(targetRoot); throw coded('PROJECT_TARGET_ALREADY_EXISTS'); }
    catch (error) { if (error?.code !== 'ENOENT') throw error; }
    fs.renameSync(stagingRoot, targetRoot);
    return { schemaVersion: 1, success: true, projectRoot: targetRoot, projectName, projectId,
      creatorVersion, ...copied, opened: false,
      note: 'The project was created locally and is not open. Verify its name, path, and Creator version in Cocos Dashboard before opening it.' };
  } catch (error) {
    try { fs.rmSync(stagingRoot, { recursive: true, force: true }); } catch (_) {}
    throw error;
  }
}

export function cloneCreatorProject({ projectRoot, targetPath, name } = {}) {
  const source = requireProjectRoot(projectRoot);
  return { sourceProjectRoot: source.root, ...materializeProject({ sourceRoot: source.root, targetPath, name, operation: 'clone' }) };
}

export function createCreatorProject({ templateId, targetPath, name, creatorPath, templateRoot, platform } = {}) {
  const root = resolveTemplateRoot({ creatorPath, templateRoot, platform }).root;
  const source = inspectTemplate(root, templateId);
  return { sourceTemplateId: templateId, sourceTemplateRoot: source.templatePath,
    ...materializeProject({ sourceRoot: source.templatePath, targetPath, name, operation: 'create' }) };
}
