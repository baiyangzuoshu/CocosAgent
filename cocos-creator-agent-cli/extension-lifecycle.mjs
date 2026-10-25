import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const EXTENSION_NAME = 'cocos-creator-agent-extension';
const INSTALL_MARKER = '.cocos-creator-agent-install.json';
const DATA_ROOT = path.join(os.homedir(), '.cocos-creator-agent');
const BACKUP_ROOT = path.join(DATA_ROOT, 'extension-backups');

function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

export function validateProjectRoot(projectRoot) {
  if (!projectRoot || !path.isAbsolute(projectRoot)) throw new Error('PROJECT_ROOT_MUST_BE_ABSOLUTE');
  const root = fs.realpathSync(projectRoot);
  const rootStat = fs.statSync(root);
  const projectFile = path.join(root, 'project.json');
  const projectStat = fs.lstatSync(projectFile);
  if (!rootStat.isDirectory() || !projectStat.isFile() || projectStat.isSymbolicLink()) throw new Error('TARGET_IS_NOT_COCOS_PROJECT');
  return root;
}

function packagePaths(projectRoot) {
  const packagesPath = path.join(projectRoot, 'packages');
  if (fs.existsSync(packagesPath)) {
    const stat = fs.lstatSync(packagesPath);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('PROJECT_PACKAGES_PATH_UNSAFE');
  }
  return { packagesPath, extensionPath: path.join(packagesPath, EXTENSION_NAME) };
}

function packageInfo(root) {
  const file = path.join(root, 'package.json');
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('EXTENSION_PACKAGE_METADATA_UNSAFE');
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (value.name !== EXTENSION_NAME || typeof value.version !== 'string') throw new Error('EXTENSION_PACKAGE_IDENTITY_INVALID');
  return value;
}

function listHashes(root, relative = '', result = {}) {
  for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (child === INSTALL_MARKER) continue;
    const absolute = path.join(root, child);
    if (entry.isSymbolicLink()) throw new Error(`EXTENSION_SYMLINK_REJECTED:${child}`);
    if (entry.isDirectory()) listHashes(root, child, result);
    else if (entry.isFile()) result[child] = sha256(fs.readFileSync(absolute));
    else throw new Error(`EXTENSION_ENTRY_TYPE_UNSUPPORTED:${child}`);
  }
  return result;
}

function diffHashes(expected, actual) {
  const names = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  return [...names].filter((name) => expected[name] !== actual[name]).sort();
}

function readMarker(extensionPath) {
  const markerPath = path.join(extensionPath, INSTALL_MARKER);
  try {
    const stat = fs.lstatSync(markerPath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 128 * 1024) return { valid: false, error: 'INSTALL_MARKER_UNSAFE' };
    const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    if (marker.schemaVersion !== 1 || marker.extensionName !== EXTENSION_NAME || typeof marker.files !== 'object'
      || !marker.files || Array.isArray(marker.files)
      || Object.values(marker.files).some((hash) => typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash))) {
      return { valid: false, error: 'INSTALL_MARKER_INVALID' };
    }
    return { valid: true, value: marker };
  } catch (error) {
    if (error.code === 'ENOENT') return { valid: false, missing: true };
    return { valid: false, error: error.message || 'INSTALL_MARKER_INVALID' };
  }
}

function sourceInfo(sourceRoot) {
  const metadata = packageInfo(sourceRoot);
  return { version: metadata.version, files: listHashes(sourceRoot) };
}

function writeMarker(extensionRoot, source, cliVersion) {
  const marker = {
    schemaVersion: 1,
    extensionName: EXTENSION_NAME,
    extensionVersion: source.version,
    installedByCliVersion: cliVersion,
    installedAt: new Date().toISOString(),
    files: source.files,
  };
  fs.writeFileSync(path.join(extensionRoot, INSTALL_MARKER), `${JSON.stringify(marker, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
}

function copyTree(sourceRoot, destinationRoot) {
  const sourceHashes = listHashes(sourceRoot);
  fs.cpSync(sourceRoot, destinationRoot, { recursive: true, errorOnExist: true, dereference: false });
  const copiedHashes = listHashes(destinationRoot);
  if (JSON.stringify(sourceHashes) !== JSON.stringify(copiedHashes)) throw new Error('EXTENSION_COPY_VERIFICATION_FAILED');
}

function inspectExtension(projectRoot, sourceRoot) {
  const source = sourceInfo(sourceRoot);
  const { extensionPath } = packagePaths(projectRoot);
  let stat;
  try { stat = fs.lstatSync(extensionPath); }
  catch (error) { if (error.code === 'ENOENT') return { installed: false, projectRoot, extensionPath, bundledVersion: source.version }; throw error; }
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('PROJECT_EXTENSION_PATH_UNSAFE');
  const installed = packageInfo(extensionPath);
  const installedFiles = listHashes(extensionPath);
  const marker = readMarker(extensionPath);
  const managed = marker.valid;
  const changedFiles = managed ? diffHashes(marker.value.files, installedFiles) : [];
  const bundleDifferences = diffHashes(source.files, installedFiles);
  const bundledBaselineChanges = managed ? diffHashes(marker.value.files, source.files) : [];
  return {
    installed: true,
    projectRoot,
    extensionPath,
    extensionVersion: installed.version,
    bundledVersion: source.version,
    creatorVersion: installed['cocos-creator-agent']?.creatorVersion || null,
    managed,
    markerError: marker.error || null,
    matchesBundle: bundleDifferences.length === 0,
    bundleDifferences,
    changedFiles,
    bundleContentChanged: managed ? bundledBaselineChanges.length > 0 : false,
    updateAvailable: installed.version !== source.version || bundledBaselineChanges.length > 0,
    safeToReplace: managed ? changedFiles.length === 0 : bundleDifferences.length === 0,
    reloadRequired: false,
  };
}

function ensureSafeDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('CLI_BACKUP_DIRECTORY_UNSAFE');
  try { fs.chmodSync(directory, 0o700); } catch (_) {}
}

function preserveBackup(extensionPath, projectRoot, version) {
  ensureSafeDirectory(DATA_ROOT);
  ensureSafeDirectory(BACKUP_ROOT);
  const projectKey = sha256(Buffer.from(projectRoot)).slice(0, 16);
  const projectBackupRoot = path.join(BACKUP_ROOT, projectKey);
  ensureSafeDirectory(projectBackupRoot);
  const backupPath = path.join(projectBackupRoot, `${Date.now()}-${version || 'unknown'}-${randomUUID().slice(0, 8)}`);
  copyTree(extensionPath, backupPath);
  return backupPath;
}

function replaceExtension(projectRoot, sourceRoot, source, cliVersion, extensionPath) {
  const stagePath = path.join(projectRoot, `.${EXTENSION_NAME}.stage-${randomUUID()}`);
  const previousPath = path.join(projectRoot, `.${EXTENSION_NAME}.previous-${randomUUID()}`);
  let movedPrevious = false;
  try {
    copyTree(sourceRoot, stagePath);
    writeMarker(stagePath, source, cliVersion);
    fs.renameSync(extensionPath, previousPath);
    movedPrevious = true;
    fs.renameSync(stagePath, extensionPath);
  } catch (error) {
    if (movedPrevious && !fs.existsSync(extensionPath) && fs.existsSync(previousPath)) fs.renameSync(previousPath, extensionPath);
    if (fs.existsSync(stagePath)) fs.rmSync(stagePath, { recursive: true, force: true });
    throw error;
  }
  try { fs.rmSync(previousPath, { recursive: true, force: true }); }
  catch (error) { return { cleanupWarning: error.message, previousPath }; }
  return {};
}

export function extensionStatus(projectRoot, sourceRoot) {
  const targetRoot = validateProjectRoot(projectRoot);
  return inspectExtension(targetRoot, sourceRoot);
}

export function installExtension(projectRoot, sourceRoot, cliVersion) {
  const targetRoot = validateProjectRoot(projectRoot);
  const source = sourceInfo(sourceRoot);
  const { packagesPath, extensionPath } = packagePaths(targetRoot);
  if (!fs.existsSync(packagesPath)) fs.mkdirSync(packagesPath);
  try {
    fs.lstatSync(extensionPath);
    throw new Error(`EXTENSION_ALREADY_INSTALLED:${extensionPath}`);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const stagePath = path.join(targetRoot, `.${EXTENSION_NAME}.stage-${randomUUID()}`);
  try {
    copyTree(sourceRoot, stagePath);
    writeMarker(stagePath, source, cliVersion);
    fs.renameSync(stagePath, extensionPath);
  } catch (error) {
    if (fs.existsSync(stagePath)) fs.rmSync(stagePath, { recursive: true, force: true });
    throw error;
  }
  return { installed: true, projectRoot: targetRoot, extensionPath, extensionVersion: source.version, reloadRequired: true };
}

export function updateExtension(projectRoot, sourceRoot, cliVersion, { force = false } = {}) {
  const targetRoot = validateProjectRoot(projectRoot);
  const source = sourceInfo(sourceRoot);
  const status = inspectExtension(targetRoot, sourceRoot);
  if (!status.installed) throw new Error('EXTENSION_NOT_INSTALLED');
  const legacyExactMatch = !status.managed && status.matchesBundle;
  if (!status.managed && !legacyExactMatch && !force) throw new Error('EXTENSION_UNMANAGED_USE_FORCE_TO_BACKUP_AND_UPDATE');
  if (status.managed && !status.safeToReplace && !force) throw new Error(`EXTENSION_LOCAL_CHANGES:${status.changedFiles.join(',')}`);
  if (status.extensionVersion === source.version && status.matchesBundle && status.managed) {
    return { updated: false, extensionVersion: source.version, reason: 'ALREADY_CURRENT', reloadRequired: false };
  }
  let backupPath = null;
  if (force && (!status.safeToReplace || (!status.managed && !legacyExactMatch))) {
    backupPath = preserveBackup(status.extensionPath, targetRoot, status.extensionVersion);
  }
  let replacement;
  try { replacement = replaceExtension(targetRoot, sourceRoot, source, cliVersion, status.extensionPath); }
  catch (error) {
    if (backupPath) throw new Error(`${error.message}; original extension backup: ${backupPath}`);
    throw error;
  }
  return { updated: true, projectRoot: targetRoot, extensionPath: status.extensionPath, previousVersion: status.extensionVersion,
    extensionVersion: source.version, ...(backupPath ? { backupPath } : {}), ...(replacement?.cleanupWarning ? { cleanupWarning: replacement.cleanupWarning, previousPath: replacement.previousPath } : {}),
    reloadRequired: true };
}

export function uninstallExtension(projectRoot, sourceRoot, { force = false } = {}) {
  const targetRoot = validateProjectRoot(projectRoot);
  const status = inspectExtension(targetRoot, sourceRoot);
  if (!status.installed) return { uninstalled: false, reason: 'NOT_INSTALLED', projectRoot: targetRoot };
  const legacyExactMatch = !status.managed && status.matchesBundle;
  if (!status.managed && !legacyExactMatch && !force) throw new Error('EXTENSION_UNMANAGED_USE_FORCE_TO_BACKUP_AND_UNINSTALL');
  if (status.managed && !status.safeToReplace && !force) throw new Error(`EXTENSION_LOCAL_CHANGES:${status.changedFiles.join(',')}`);
  let backupPath = null;
  if (force && (!status.safeToReplace || (!status.managed && !legacyExactMatch))) {
    backupPath = preserveBackup(status.extensionPath, targetRoot, status.extensionVersion);
  }
  const holdingPath = path.join(targetRoot, `.${EXTENSION_NAME}.uninstall-${randomUUID()}`);
  fs.renameSync(status.extensionPath, holdingPath);
  try { fs.rmSync(holdingPath, { recursive: true }); }
  catch (error) {
    if (!fs.existsSync(status.extensionPath) && fs.existsSync(holdingPath)) fs.renameSync(holdingPath, status.extensionPath);
    if (backupPath) throw new Error(`${error.message}; original extension backup: ${backupPath}`);
    throw error;
  }
  return { uninstalled: true, projectRoot: targetRoot, extensionPath: status.extensionPath,
    ...(backupPath ? { backupPath } : {}), reloadRequired: true };
}
