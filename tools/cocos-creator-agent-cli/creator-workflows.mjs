import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';

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
  let killTimer = null;
  const timeout = setTimeout(() => {
    timedOut = true;
    try { child.kill('SIGTERM'); } catch (_) {}
    killTimer = setTimeout(() => { try { child.kill('SIGKILL'); } catch (_) {} }, 5000);
    killTimer.unref?.();
  }, timeoutMs);
  timeout.unref?.();
  child.stdout?.on('data', (chunk) => { stdout = appendTail(stdout, chunk); });
  child.stderr?.on('data', (chunk) => { stderr = appendTail(stderr, chunk); });

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, exitCode, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (killTimer) clearTimeout(killTimer);
      if (error) { reject(coded('CREATOR_PROCESS_START_FAILED', error.message || String(error))); return; }
      let outputExists = false;
      try { outputExists = fs.statSync(outputPath).isDirectory(); } catch (_) {}
      const completedAt = new Date().toISOString();
      resolve({ operation, projectName: project.project.name || path.basename(project.root), projectRoot: project.root,
        creatorVersion: creator.creatorVersion, platform, outputPath, outputExists, toolchain,
        command: [creator.executable, ...args], exitCode, signal: signal || null, timedOut,
        success: !timedOut && exitCode === 0 && outputExists,
        startedAt, completedAt, durationMs: Date.now() - startTime, stdout, stderr });
    };
    child.once('error', (error) => finish(error));
    child.once('close', (exitCode, signal) => finish(null, exitCode, signal));
  });
}
