import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { callCommand, listInstances } from './bridge/client.mjs';

const CREATOR_VERSION = '2.4.15';
const BUILD_PLATFORMS = new Set(['web-mobile', 'web-desktop', 'android', 'ios', 'mac', 'win32']);
const NATIVE_PLATFORMS = new Set(['android', 'ios', 'mac', 'win32']);
const MAX_LOG_BYTES = 128 * 1024;
const DATA_ROOT = path.join(os.homedir(), '.cocos-creator-agent');

function coded(code, detail) {
  return Object.assign(new Error(code), { code, detail });
}

function canonicalProjectRoot(projectRoot) {
  if (typeof projectRoot !== 'string' || !path.isAbsolute(projectRoot)) throw coded('PROJECT_ROOT_ABSOLUTE_PATH_REQUIRED');
  const root = fs.realpathSync(projectRoot);
  const stat = fs.statSync(root);
  const projectFile = path.join(root, 'project.json');
  const projectStat = fs.lstatSync(projectFile);
  if (!stat.isDirectory() || !projectStat.isFile() || projectStat.isSymbolicLink()) throw coded('PROJECT_ROOT_INVALID');
  const project = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
  if (project.version !== CREATOR_VERSION) throw coded('PROJECT_CREATOR_VERSION_MISMATCH');
  return { root, project };
}

function creatorBundleRoot(candidate) {
  let current = fs.statSync(candidate).isDirectory() ? candidate : path.dirname(candidate);
  for (let depth = 0; depth < 8; depth += 1) {
    if (path.basename(current).endsWith('.app') && fs.existsSync(path.join(current, 'Contents', 'Info.plist'))) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

export function resolveCreatorExecutable(creatorPath) {
  if (typeof creatorPath !== 'string' || !path.isAbsolute(creatorPath)) throw coded('CREATOR_ABSOLUTE_PATH_REQUIRED');
  const selected = path.resolve(creatorPath);
  const bundleRoot = creatorBundleRoot(selected);
  const executable = path.basename(selected).endsWith('.app')
    ? path.join(selected, 'Contents', 'MacOS', 'CocosCreator')
    : selected;
  const executableStat = fs.statSync(executable);
  if (!executableStat.isFile() || (process.platform !== 'win32' && !(executableStat.mode & 0o111)))
    throw coded('CREATOR_EXECUTABLE_INVALID');
  if (!bundleRoot) throw coded('CREATOR_APP_BUNDLE_REQUIRED');
  const plist = fs.readFileSync(path.join(bundleRoot, 'Contents', 'Info.plist'), 'utf8');
  const versionMatch = plist.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/);
  const version = versionMatch?.[1]?.trim();
  if (version !== CREATOR_VERSION) throw coded('CREATOR_VERSION_MISMATCH', version || 'unreadable bundle version');
  return { executable, bundleRoot, creatorVersion: version };
}

function creatorSearchRoots(searchRoots) {
  if (searchRoots !== undefined) {
    if (!Array.isArray(searchRoots) || searchRoots.some((root) => typeof root !== 'string' || !path.isAbsolute(root)))
      throw coded('CREATOR_SEARCH_ROOTS_INVALID');
    return searchRoots.map((root) => path.resolve(root));
  }
  if (process.platform !== 'darwin') return [];
  return [...new Set([
    '/Applications/Cocos/Creator',
    '/Applications/CocosCreator',
    path.join(os.homedir(), 'Applications', 'Cocos', 'Creator'),
    path.join(os.homedir(), 'Applications', 'CocosCreator'),
    '/Applications',
  ])];
}

function isRealDirectory(candidate) {
  try {
    const stat = fs.lstatSync(candidate);
    return stat.isDirectory() && !stat.isSymbolicLink();
  } catch (_) { return false; }
}

function listDirectoryNames(candidate) {
  if (!isRealDirectory(candidate)) return [];
  try { return fs.readdirSync(candidate).sort((left, right) => left.localeCompare(right)); }
  catch (_) { return []; }
}

function isRealAppBundle(candidate) {
  if (!candidate.endsWith('.app')) return false;
  try {
    const stat = fs.lstatSync(candidate);
    return stat.isDirectory() && !stat.isSymbolicLink()
      && fs.lstatSync(path.join(candidate, 'Contents', 'Info.plist')).isFile();
  } catch (_) { return false; }
}

function creatorBundlesWithin(searchRoot, { broadApplicationsRoot = false } = {}) {
  const candidates = new Set();
  if (isRealAppBundle(searchRoot)) candidates.add(path.resolve(searchRoot));
  else if (isRealDirectory(searchRoot)) {
    for (const firstName of listDirectoryNames(searchRoot)) {
      if (broadApplicationsRoot && !/^cocos/i.test(firstName)) continue;
      const first = path.join(searchRoot, firstName);
      if (isRealAppBundle(first)) {
        if (!broadApplicationsRoot || /^cocos/i.test(firstName)) candidates.add(path.resolve(first));
        continue;
      }
      if (!isRealDirectory(first)) continue;
      for (const secondName of listDirectoryNames(first)) {
        const second = path.join(first, secondName);
        if (isRealAppBundle(second)) candidates.add(path.resolve(second));
      }
    }
  }
  return [...candidates];
}

function inspectCreatorBundle(bundlePath) {
  const executable = path.join(bundlePath, 'Contents', 'MacOS', 'CocosCreator');
  let creatorVersion = null;
  let executableAvailable = false;
  try {
    const plist = fs.readFileSync(path.join(bundlePath, 'Contents', 'Info.plist'), 'utf8');
    creatorVersion = plist.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/)?.[1]?.trim() || null;
    const executableStat = fs.statSync(executable);
    executableAvailable = executableStat.isFile() && !!(executableStat.mode & 0o111);
  } catch (_) {}
  return { bundlePath, executable, creatorVersion, executableAvailable,
    supported: executableAvailable && creatorVersion === CREATOR_VERSION,
    status: !executableAvailable || !creatorVersion ? 'invalid' : creatorVersion === CREATOR_VERSION ? 'supported' : 'unsupported-version' };
}

export function discoverCreatorInstallations({ searchRoots } = {}) {
  if (process.platform !== 'darwin' && searchRoots === undefined)
    return { platform: process.platform, supported: false, reason: 'CREATOR_APP_DISCOVERY_PLATFORM_UNSUPPORTED', installations: [] };
  const roots = creatorSearchRoots(searchRoots);
  const bundles = new Set();
  for (const root of roots) {
    const broadApplicationsRoot = path.resolve(root) === '/Applications';
    for (const candidate of creatorBundlesWithin(root, { broadApplicationsRoot })) bundles.add(candidate);
  }
  const installations = [...bundles].map(inspectCreatorBundle)
    .sort((left, right) => left.bundlePath.localeCompare(right.bundlePath));
  return { platform: process.platform, supported: true, searchedRoots: roots,
    installations, matchingCreatorVersion: CREATOR_VERSION,
    matches: installations.filter((item) => item.supported).length };
}

function resolveMatchingCreator(projectVersion, searchRoots) {
  const inventory = discoverCreatorInstallations(searchRoots ? { searchRoots } : {});
  const matches = inventory.installations.filter((item) => item.creatorVersion === projectVersion && item.executableAvailable);
  if (matches.length === 0) throw coded('CREATOR_INSTALLATION_NOT_FOUND', JSON.stringify({
    projectVersion, searchedRoots: inventory.searchedRoots || [],
    discoveredVersions: inventory.installations.map((item) => ({ path: item.bundlePath, version: item.creatorVersion, status: item.status })),
  }));
  if (matches.length > 1) throw coded('CREATOR_INSTALLATION_AMBIGUOUS', JSON.stringify({
    projectVersion, matches: matches.map((item) => item.bundlePath),
  }));
  return resolveCreatorExecutable(matches[0].bundlePath);
}

export function diagnoseCreatorModal(processId, { platform = process.platform, spawnSyncImpl = spawnSync } = {}) {
  if (platform !== 'darwin') return { status: 'unavailable', reason: 'MODAL_DIAGNOSTIC_PLATFORM_UNSUPPORTED' };
  if (!Number.isSafeInteger(processId) || processId < 1 || processId > 2147483647)
    return { status: 'unavailable', reason: 'CREATOR_PROCESS_ID_UNAVAILABLE' };
  const script = [
    'on run argv',
    '  set targetPid to (item 1 of argv) as integer',
    '  tell application "System Events"',
    '    set targetProcess to first process whose unix id is targetPid',
    '    set dialogCount to 0',
    '    repeat with targetWindow in (windows of targetProcess)',
    '      if (subrole of targetWindow is "AXDialog") or (subrole of targetWindow is "AXSheet") then',
    '        set dialogCount to dialogCount + 1',
    '      end if',
    '    end repeat',
    '    return dialogCount as text',
    '  end tell',
    'end run',
  ].join('\n');
  let result;
  try {
    result = spawnSyncImpl('/usr/bin/osascript', ['-e', script, String(processId)], {
      encoding: 'utf8', timeout: 2000, maxBuffer: 4096, windowsHide: true,
    });
  } catch (error) {
    if (error?.code === 'ETIMEDOUT') return { status: 'unavailable', reason: 'MODAL_DIAGNOSTIC_TIMEOUT' };
    return { status: 'unavailable', reason: 'MODAL_DIAGNOSTIC_FAILED' };
  }
  const stderr = String(result?.stderr || '').toLowerCase();
  if (result?.error?.code === 'ETIMEDOUT') return { status: 'unavailable', reason: 'MODAL_DIAGNOSTIC_TIMEOUT' };
  if (result?.status !== 0) {
    const permissionDenied = /not authorized|not allowed|assistive|accessibility/.test(stderr);
    return { status: 'unavailable', reason: permissionDenied
      ? 'ACCESSIBILITY_PERMISSION_REQUIRED' : 'MODAL_DIAGNOSTIC_FAILED' };
  }
  const output = String(result.stdout || '').trim();
  if (!/^(?:0|[1-9][0-9]{0,2})$/.test(output))
    return { status: 'unavailable', reason: 'MODAL_DIAGNOSTIC_RESULT_INVALID' };
  const dialogCount = Number(output);
  return dialogCount > 0 ? { status: 'detected', dialogCount }
    : { status: 'not-detected', dialogCount: 0 };
}

function projectInstances(inventory, projectRoot) {
  const matching = (inventory.instances || []).filter((instance) => sameProjectRoot(instance.projectRoot, projectRoot));
  const rejected = (inventory.rejectedInstances || []).filter((instance) => typeof instance.reportedProjectRoot === 'string'
    && sameProjectRoot(instance.reportedProjectRoot, projectRoot));
  return { matching, rejected };
}

function sameProjectRoot(candidate, canonicalRoot) {
  if (typeof candidate !== 'string' || !path.isAbsolute(candidate)) return false;
  try { return fs.realpathSync(candidate) === canonicalRoot; }
  catch (_) { return path.resolve(candidate) === canonicalRoot; }
}

function readyResult(receipt, instanceId, project) {
  const info = receipt?.result && typeof receipt.result === 'object' ? receipt.result : receipt;
  const reportedRoot = receipt?.projectRoot || info?.projectRoot;
  if (!sameProjectRoot(reportedRoot, project.root) || info?.creatorVersion !== CREATOR_VERSION)
    throw coded('CREATOR_OPEN_TARGET_IDENTITY_MISMATCH', JSON.stringify({
      expectedProjectRoot: project.root,
      actualProjectRoot: reportedRoot || null,
      expectedCreatorVersion: CREATOR_VERSION,
      actualCreatorVersion: info?.creatorVersion || receipt?.creatorVersion || null,
    }));
  return { instanceId: receipt?.instanceId || instanceId, projectName: info.projectName || project.project.name || path.basename(project.root),
    projectRoot: project.root, creatorVersion: info.creatorVersion, extensionVersion: info.extensionVersion || receipt?.extensionVersion || null };
}

async function waitForProjectReady(project, { timeoutMs, listInstancesImpl, probeProjectImpl, sleepImpl, nowImpl }) {
  const deadline = nowImpl() + timeoutMs;
  let lastError = null;
  while (nowImpl() < deadline) {
    let inventory;
    try { inventory = await listInstancesImpl(); }
    catch (error) {
      lastError = error;
      await sleepImpl(Math.min(400, Math.max(0, deadline - nowImpl())));
      continue;
    }

    const { matching, rejected } = projectInstances(inventory, project.root);
    if (matching.length > 1) throw coded('CREATOR_PROJECT_INSTANCE_AMBIGUOUS', matching.map((item) => item.instanceId).join(', '));
    if (!matching.length && rejected.length) {
      const rejectedInstance = rejected[0];
      throw coded('CREATOR_OPEN_EXTENSION_INCOMPATIBLE', JSON.stringify({
        projectRoot: project.root,
        reason: rejectedInstance.reason || rejectedInstance.code || 'CREATOR_HANDSHAKE_REJECTED',
        creatorVersion: rejectedInstance.creatorVersion || null,
        extensionVersion: rejectedInstance.extensionVersion || null,
      }));
    }
    const instance = matching[0];
    if (instance) {
      const remaining = Math.max(1, deadline - nowImpl());
      try {
        const receipt = await probeProjectImpl(instance.instanceId, 'creator.project.info', {}, {
          timeoutMs: Math.min(10000, remaining),
        });
        return { status: 'ready', ...readyResult(receipt, instance.instanceId, project) };
      } catch (error) {
        lastError = error;
        const code = error?.code || error?.message;
        if (!['CREATOR_INSTANCE_BUSY', 'CREATOR_COMMAND_TIMEOUT', 'BRIDGE_REQUEST_TIMEOUT',
          'CREATOR_INSTANCE_DISCONNECTED', 'CREATOR_SESSION_REPLACED'].includes(code)) throw error;
      }
    }
    await sleepImpl(Math.min(400, Math.max(0, deadline - nowImpl())));
  }
  const lastErrorCode = lastError?.code || lastError?.message || null;
  return { status: 'timeout', reason: lastErrorCode || 'CREATOR_EXTENSION_NOT_CONNECTED', lastErrorCode };
}

export async function openCreatorProject({ projectRoot, creatorPath, waitReady = false, timeoutMs = 120000 }, {
  spawnImpl = spawn, listInstancesImpl = listInstances, probeProjectImpl = callCommand,
  installationSearchRoots, diagnoseModalImpl = diagnoseCreatorModal, nowImpl = Date.now,
  sleepImpl = (duration) => new Promise((resolve) => setTimeout(resolve, duration)),
} = {}) {
  const project = canonicalProjectRoot(projectRoot);
  const creator = creatorPath ? resolveCreatorExecutable(creatorPath)
    : resolveMatchingCreator(project.project.version, installationSearchRoots);
  if (waitReady && (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 600000))
    throw coded('CREATOR_OPEN_TIMEOUT_INVALID');

  let existingInstance = null;
  if (waitReady) {
    const inventory = await listInstancesImpl();
    const { matching, rejected } = projectInstances(inventory, project.root);
    if (matching.length > 1) throw coded('CREATOR_PROJECT_INSTANCE_AMBIGUOUS', matching.map((item) => item.instanceId).join(', '));
    if (!matching.length && rejected.length) {
      const rejectedInstance = rejected[0];
      throw coded('CREATOR_OPEN_EXTENSION_INCOMPATIBLE', JSON.stringify({
        projectRoot: project.root,
        reason: rejectedInstance.reason || rejectedInstance.code || 'CREATOR_HANDSHAKE_REJECTED',
        creatorVersion: rejectedInstance.creatorVersion || null,
        extensionVersion: rejectedInstance.extensionVersion || null,
      }));
    }
    existingInstance = matching[0] || null;
  }

  const args = ['--path', project.root];
  let child = null;
  if (!existingInstance) {
    child = spawnImpl(creator.executable, args, {
      cwd: project.root,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });

    await new Promise((resolve, reject) => {
      let settled = false;
      child.once('error', (error) => {
        if (settled) return;
        settled = true;
        reject(coded('CREATOR_OPEN_START_FAILED', error.message || String(error)));
      });
      child.once('spawn', () => {
        if (settled) return;
        settled = true;
        child.unref?.();
        resolve();
      });
    });
  }

  const base = {
    operation: 'open',
    launched: !existingInstance,
    alreadyOpen: !!existingInstance,
    projectName: project.project.name || path.basename(project.root),
    projectRoot: project.root,
    creatorVersion: creator.creatorVersion,
    processId: child?.pid ?? null,
    ...(child ? { command: [creator.executable, ...args] } : {}),
  };
  if (!waitReady) return { ...base, success: true, editorReady: false, readiness: { status: 'not-checked' } };

  const readiness = await waitForProjectReady(project, { timeoutMs, listInstancesImpl, probeProjectImpl, sleepImpl, nowImpl });
  if (readiness.status !== 'ready') {
    const modalDiagnosis = await diagnoseModalImpl(existingInstance?.processId || child?.pid);
    return {
    ...base,
    success: false,
    editorReady: false,
    readiness: {
      ...readiness,
      command: 'creator.project.info',
      modalDiagnosis,
      possibleBlocker: modalDiagnosis?.status === 'detected'
        ? `macOS accessibility detected ${modalDiagnosis.dialogCount} Creator modal dialog(s); dismissing it may allow startup to continue.`
        : 'Creator may still be starting, its extension may not be loaded, or a long-running editor operation may be blocking the main process. Modal-dialog detection can be unavailable when macOS accessibility permission is missing.',
    },
    };
  }
  return { ...base, success: true, editorReady: true, readiness };
}

function pathInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function ensureOutputPath(projectRoot, requestedPath, { mustExist = false } = {}) {
  if (requestedPath !== undefined && !path.isAbsolute(requestedPath)) throw coded('BUILD_PATH_ABSOLUTE_REQUIRED');
  if (mustExist && requestedPath === undefined) throw coded('NATIVE_BUILD_OUTPUT_REQUIRED');
  const projectHash = createHash('sha256').update(projectRoot).digest('hex').slice(0, 16);
  const outputPath = requestedPath === undefined
    ? path.join(DATA_ROOT, 'builds', projectHash, randomUUID())
    : path.resolve(requestedPath);
  if (/[;\r\n]/.test(outputPath)) throw coded('BUILD_PATH_UNSUPPORTED_CHARACTERS');
  if (pathInside(projectRoot, outputPath)) throw coded('BUILD_PATH_MUST_BE_OUTSIDE_PROJECT');
  if (mustExist) {
    let stat;
    try { stat = fs.lstatSync(outputPath); }
    catch (error) {
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') throw coded('NATIVE_BUILD_OUTPUT_INVALID');
      throw error;
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw coded('NATIVE_BUILD_OUTPUT_INVALID');
    const canonicalPath = fs.realpathSync(outputPath);
    if (pathInside(projectRoot, canonicalPath)) throw coded('BUILD_PATH_MUST_BE_OUTSIDE_PROJECT');
    return canonicalPath;
  }
  const parent = path.dirname(outputPath);
  fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
  const canonicalOutputPath = path.join(fs.realpathSync(parent), path.basename(outputPath));
  if (pathInside(projectRoot, canonicalOutputPath)) throw coded('BUILD_PATH_MUST_BE_OUTSIDE_PROJECT');
  if (fs.existsSync(canonicalOutputPath)) throw coded('BUILD_PATH_ALREADY_EXISTS');
  return canonicalOutputPath;
}

function nativeToolchain(platform) {
  const missing = [];
  const details = {};
  if (platform === 'android') {
    const sdk = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME;
    const java = process.env.JAVA_HOME;
    if (!sdk || !fs.existsSync(sdk) || !fs.statSync(sdk).isDirectory()) missing.push('ANDROID_SDK_ROOT or ANDROID_HOME');
    if (!java || !fs.existsSync(java) || !fs.statSync(java).isDirectory()) missing.push('JAVA_HOME');
    details.androidSdk = sdk || null;
    details.javaHome = java || null;
  } else if (platform === 'ios' || platform === 'mac') {
    if (process.platform !== 'darwin') missing.push('macOS');
    else {
      const result = spawnSync('xcodebuild', ['-version'], { encoding: 'utf8', timeout: 5000 });
      if (result.status !== 0) missing.push('Xcode command line tools');
      else details.xcodeVersion = String(result.stdout || '').trim().slice(0, 160);
    }
  } else if (platform === 'win32' && process.platform !== 'win32') missing.push('Windows host');
  return { status: missing.length ? 'missing' : 'ready', missing, ...details };
}

function appendTail(current, chunk) {
  const next = current + chunk.toString('utf8');
  const bytes = Buffer.from(next, 'utf8');
  if (bytes.length <= MAX_LOG_BYTES) return next;
  return bytes.subarray(bytes.length - MAX_LOG_BYTES).toString('utf8');
}

export async function runCreatorWorkflow({ operation, projectRoot, creatorPath, platform, buildPath,
  debug = false, autoCompile = false, timeoutMs = 1200000 }, { spawnImpl = spawn } = {}) {
  if (!['build', 'compile'].includes(operation)) throw coded('CREATOR_WORKFLOW_INVALID');
  const allowedPlatforms = operation === 'build' ? BUILD_PLATFORMS : NATIVE_PLATFORMS;
  if (!allowedPlatforms.has(platform)) throw coded(operation === 'build' ? 'BUILD_PLATFORM_UNSUPPORTED' : 'COMPILE_PLATFORM_UNSUPPORTED');
  if (autoCompile && (operation !== 'build' || !NATIVE_PLATFORMS.has(platform))) throw coded('AUTO_COMPILE_NATIVE_BUILD_ONLY');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 3600000) throw coded('CREATOR_WORKFLOW_TIMEOUT_INVALID');
  const project = canonicalProjectRoot(projectRoot);
  const creator = resolveCreatorExecutable(creatorPath);
  const toolchain = NATIVE_PLATFORMS.has(platform) ? nativeToolchain(platform) : { status: 'not-required', missing: [] };
  if (toolchain.status === 'missing') throw coded('CREATOR_TOOLCHAIN_MISSING', toolchain.missing.join(', '));
  const outputPath = ensureOutputPath(project.root, buildPath, { mustExist: operation === 'compile' });
  const startedAt = new Date().toISOString();
  const startTime = Date.now();
  const parameters = [`platform=${platform}`, `buildPath=${outputPath}`, `debug=${debug ? 'true' : 'false'}`];
  if (operation === 'build' && autoCompile) parameters.push('autoCompile=true');
  const args = ['--path', project.root, operation === 'build' ? '--build' : '--compile', parameters.join(';')];
  const child = spawnImpl(creator.executable, args, { cwd: project.root, windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  let timedOut = false;
  let builderFinished = false;
  let sawBuilderFinished = false;
  let builderFailureReason = null;
  let scanTail = '';
  let shutdownTimer = null;
  let killTimer = null;
  const recordOutput = (stream, chunk) => {
    const text = chunk.toString('utf8');
    if (stream === 'stdout') stdout = appendTail(stdout, chunk);
    else stderr = appendTail(stderr, chunk);
    if (operation !== 'build') return;
    const combined = scanTail + text;
    if (!builderFailureReason) {
      const failure = combined.match(/\bBuild Failed:\s*([^\r\n]+)/i)?.[1]?.trim();
      if (failure) builderFailureReason = failure.slice(0, 1000);
    }
    if (!sawBuilderFinished && /Builder: do custom process \[build-finished\]/i.test(combined))
      sawBuilderFinished = true;
    scanTail = combined.slice(-2048);
  };
  const hasBuilderFailure = () => builderFailureReason !== null;
  const outputExistsNow = () => {
    try { return fs.statSync(outputPath).isDirectory(); } catch (_) { return false; }
  };
  const maybeStopAfterBuild = () => {
    if (operation !== 'build' || builderFinished || shutdownTimer || hasBuilderFailure()
      || !sawBuilderFinished || !outputExistsNow()) return;
    // Creator 2.4 leaves the Editor process alive after the Builder's documented
    // build-finished event. Give both output streams a short drain window, then
    // stop only the process this workflow launched and report the completed build.
    shutdownTimer = setTimeout(() => {
      shutdownTimer = null;
      if (hasBuilderFailure() || !outputExistsNow()) return;
      builderFinished = true;
      try { child.kill('SIGTERM'); } catch (_) {}
      killTimer = setTimeout(() => { try { child.kill('SIGKILL'); } catch (_) {} }, 5000);
      killTimer.unref?.();
    }, 250);
  };
  const timeout = setTimeout(() => {
    timedOut = true;
    try { child.kill('SIGTERM'); } catch (_) {}
    killTimer = setTimeout(() => { try { child.kill('SIGKILL'); } catch (_) {} }, 5000);
    killTimer.unref?.();
  }, timeoutMs);
  timeout.unref?.();
  child.stdout?.on('data', (chunk) => { recordOutput('stdout', chunk); maybeStopAfterBuild(); });
  child.stderr?.on('data', (chunk) => { recordOutput('stderr', chunk); maybeStopAfterBuild(); });

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, exitCode, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (shutdownTimer) clearTimeout(shutdownTimer);
      if (killTimer) clearTimeout(killTimer);
      if (error) { reject(coded('CREATOR_PROCESS_START_FAILED', error.message || String(error))); return; }
      const outputExists = outputExistsNow();
      const builderFailure = operation === 'build' ? builderFailureReason : null;
      const failureCode = builderFailure ? 'CREATOR_BUILD_REPORTED_FAILURE'
        : builderFinished ? (!outputExists ? `CREATOR_${operation.toUpperCase()}_OUTPUT_MISSING` : null)
          : timedOut ? 'CREATOR_WORKFLOW_TIMEOUT'
            : signal ? `CREATOR_PROCESS_${signal}`
              : exitCode !== 0 ? `CREATOR_PROCESS_EXIT_${exitCode ?? 'UNKNOWN'}`
                : !outputExists ? `CREATOR_${operation.toUpperCase()}_OUTPUT_MISSING` : null;
      const completedAt = new Date().toISOString();
      resolve({ operation, projectName: project.project.name || path.basename(project.root), projectRoot: project.root,
        creatorVersion: creator.creatorVersion, platform, outputPath, outputExists, toolchain,
        command: [creator.executable, ...args], exitCode, signal: signal || null, timedOut, builderFinished,
        success: failureCode === null, failureCode, failureReason: builderFailure,
        startedAt, completedAt, durationMs: Date.now() - startTime, stdout, stderr });
    };
    child.once('error', (error) => finish(error));
    child.once('close', (exitCode, signal) => finish(null, exitCode, signal));
  });
}
