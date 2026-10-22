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

function regularFile(candidate) {
  try {
    const stat = fs.lstatSync(candidate);
    return stat.isFile() && !stat.isSymbolicLink();
  } catch (_) { return false; }
}

function windowsCreatorExecutable(candidate) {
  try {
    const stat = fs.lstatSync(candidate);
    if (stat.isSymbolicLink()) return null;
    if (stat.isFile()) return path.basename(candidate).toLowerCase() === 'cocoscreator.exe' ? candidate : null;
    if (!stat.isDirectory()) return null;
    const executable = path.join(candidate, 'CocosCreator.exe');
    return regularFile(executable) ? executable : null;
  } catch (_) { return null; }
}

function readPackageVersion(packagePath) {
  try {
    const stat = fs.lstatSync(packagePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 256 * 1024) return null;
    const value = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return typeof value.version === 'string' ? value.version.trim() : null;
  } catch (_) { return null; }
}

function readAsarPackageVersion(archivePath) {
  let descriptor;
  try {
    const archiveStat = fs.lstatSync(archivePath);
    if (!archiveStat.isFile() || archiveStat.isSymbolicLink() || archiveStat.size < 16) return null;
    descriptor = fs.openSync(archivePath, 'r');
    const prefix = Buffer.alloc(16);
    if (fs.readSync(descriptor, prefix, 0, prefix.length, 0) !== prefix.length || prefix.readUInt32LE(0) !== 4) return null;
    const headerPickleSize = prefix.readUInt32LE(4);
    const jsonSize = prefix.readUInt32LE(12);
    const dataStart = 16 + jsonSize;
    if (headerPickleSize < jsonSize || jsonSize < 2 || jsonSize > 8 * 1024 * 1024 || dataStart > archiveStat.size) return null;
    const headerBuffer = Buffer.alloc(jsonSize);
    if (fs.readSync(descriptor, headerBuffer, 0, jsonSize, 16) !== jsonSize) return null;
    const header = JSON.parse(headerBuffer.toString('utf8'));
    const entry = header?.files?.['package.json'];
    if (!entry || !Number.isSafeInteger(entry.size) || entry.size < 2 || entry.size > 256 * 1024) return null;
    const offset = Number(entry.offset);
    if (!Number.isSafeInteger(offset) || offset < 0 || dataStart + offset + entry.size > archiveStat.size) return null;
    const packageBuffer = Buffer.alloc(entry.size);
    if (fs.readSync(descriptor, packageBuffer, 0, entry.size, dataStart + offset) !== entry.size) return null;
    const packageInfo = JSON.parse(packageBuffer.toString('utf8'));
    return typeof packageInfo.version === 'string' ? packageInfo.version.trim() : null;
  } catch (_) { return null; }
  finally { if (descriptor !== undefined) { try { fs.closeSync(descriptor); } catch (_) {} } }
}

function windowsCreatorVersion(installRoot) {
  const resources = path.join(installRoot, 'resources');
  return readPackageVersion(path.join(resources, 'app', 'package.json'))
    || readPackageVersion(path.join(resources, 'package.json'))
    || readPackageVersion(path.join(installRoot, 'package.json'))
    || readAsarPackageVersion(path.join(resources, 'app.asar'));
}

export function resolveCreatorExecutable(creatorPath, { platform = process.platform } = {}) {
  if (typeof creatorPath !== 'string' || !path.isAbsolute(creatorPath)) throw coded('CREATOR_ABSOLUTE_PATH_REQUIRED');
  const selected = path.resolve(creatorPath);
  const bundleRoot = creatorBundleRoot(selected);
  if (platform === 'win32') {
    const executable = windowsCreatorExecutable(selected);
    if (!executable) throw coded('CREATOR_EXECUTABLE_INVALID');
    const installRoot = path.dirname(executable);
    const version = windowsCreatorVersion(installRoot);
    if (!version) throw coded('CREATOR_VERSION_UNREADABLE');
    if (version !== CREATOR_VERSION) throw coded('CREATOR_VERSION_MISMATCH', version);
    return { executable, bundleRoot: installRoot, creatorVersion: version };
  }
  if (platform !== 'darwin') throw coded('CREATOR_EXECUTABLE_PLATFORM_UNSUPPORTED', platform);
  const executable = path.basename(selected).endsWith('.app')
    ? path.join(selected, 'Contents', 'MacOS', 'CocosCreator') : selected;
  let executableStat;
  try { executableStat = fs.statSync(executable); } catch (_) { throw coded('CREATOR_EXECUTABLE_INVALID'); }
  if (!executableStat.isFile() || !(executableStat.mode & 0o111)) throw coded('CREATOR_EXECUTABLE_INVALID');
  if (!bundleRoot) throw coded('CREATOR_APP_BUNDLE_REQUIRED');
  let plist;
  try { plist = fs.readFileSync(path.join(bundleRoot, 'Contents', 'Info.plist'), 'utf8'); }
  catch (_) { throw coded('CREATOR_VERSION_UNREADABLE'); }
  const versionMatch = plist.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/);
  const version = versionMatch?.[1]?.trim();
  if (version !== CREATOR_VERSION) throw coded('CREATOR_VERSION_MISMATCH', version || 'unreadable bundle version');
  return { executable, bundleRoot, creatorVersion: version };
}

function creatorSearchRoots(searchRoots, { platform = process.platform, home = os.homedir(), env = process.env } = {}) {
  if (searchRoots !== undefined) {
    if (!Array.isArray(searchRoots) || searchRoots.some((root) => typeof root !== 'string' || !path.isAbsolute(root)))
      throw coded('CREATOR_SEARCH_ROOTS_INVALID');
    return searchRoots.map((root) => path.resolve(root));
  }
  if (platform === 'darwin') return [...new Set([
    '/Applications/Cocos/Creator', '/Applications/CocosCreator',
    path.join(home, 'Applications', 'Cocos', 'Creator'), path.join(home, 'Applications', 'CocosCreator'), '/Applications',
  ])];
  if (platform === 'win32') {
    const drive = env.SystemDrive || 'C:';
    const userProfile = env.USERPROFILE || home;
    const dashboardRoot = env.COCOS_DASHBOARD_ROOT || path.join(drive, 'CocosDashboard');
    return [...new Set([
      path.join(drive, 'CocosCreator'),
      path.join(dashboardRoot, 'resources', '.editors', 'Creator'),
      path.join(userProfile, 'CocosCreator'),
      path.join(userProfile, 'CocosDashboard', 'resources', '.editors', 'Creator'),
    ])];
  }
  return [];
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

function creatorExecutablesWithin(searchRoot, { maxDepth = 6, maxDirectories = 5000 } = {}) {
  const direct = windowsCreatorExecutable(searchRoot);
  if (direct) return { executables: [path.resolve(direct)], truncated: false };
  if (!isRealDirectory(searchRoot)) return { executables: [], truncated: false };
  const candidates = new Set();
  const visited = new Set();
  const stack = [{ directory: path.resolve(searchRoot), depth: 0 }];
  while (stack.length && visited.size < maxDirectories) {
    const current = stack.pop();
    if (visited.has(current.directory)) continue;
    visited.add(current.directory);
    let entries;
    try { entries = fs.readdirSync(current.directory, { withFileTypes: true }); } catch (_) { continue; }
    const executableEntry = entries.find((entry) => entry.isFile() && entry.name.toLowerCase() === 'cocoscreator.exe');
    if (executableEntry) {
      const executable = path.join(current.directory, executableEntry.name);
      if (regularFile(executable)) candidates.add(path.resolve(executable));
      continue;
    }
    if (current.depth >= maxDepth) continue;
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || ['.git', 'node_modules', 'cache', 'temp', 'build'].includes(entry.name.toLowerCase())) continue;
      stack.push({ directory: path.join(current.directory, entry.name), depth: current.depth + 1 });
    }
  }
  return { executables: [...candidates], truncated: stack.length > 0 };
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

function inspectCreatorWindowsExecutable(executable) {
  const installRoot = path.dirname(executable);
  const creatorVersion = windowsCreatorVersion(installRoot);
  const executableAvailable = regularFile(executable);
  return { bundlePath: installRoot, executable, creatorVersion, executableAvailable,
    supported: executableAvailable && creatorVersion === CREATOR_VERSION,
    status: !executableAvailable || !creatorVersion ? 'invalid' : creatorVersion === CREATOR_VERSION ? 'supported' : 'unsupported-version' };
}

export function discoverCreatorInstallations({ searchRoots, platform = process.platform, home, env } = {}) {
  if (!['darwin', 'win32'].includes(platform))
    return { platform, supported: false, reason: 'CREATOR_APP_DISCOVERY_PLATFORM_UNSUPPORTED', installations: [] };
  const roots = creatorSearchRoots(searchRoots, { platform, home, env });
  const candidates = new Set();
  let scanTruncated = false;
  if (platform === 'darwin') {
    for (const root of roots) {
      const broadApplicationsRoot = path.resolve(root) === '/Applications';
      for (const candidate of creatorBundlesWithin(root, { broadApplicationsRoot })) candidates.add(candidate);
    }
  } else {
    for (const root of roots) {
      const scan = creatorExecutablesWithin(root);
      scanTruncated ||= scan.truncated;
      for (const candidate of scan.executables) candidates.add(candidate);
    }
  }
  const installations = [...candidates].map((candidate) => platform === 'darwin'
    ? inspectCreatorBundle(candidate) : inspectCreatorWindowsExecutable(candidate))
    .sort((left, right) => left.bundlePath.localeCompare(right.bundlePath));
  return { platform, supported: true, searchedRoots: roots, scanTruncated,
    installations, matchingCreatorVersion: CREATOR_VERSION,
    matches: installations.filter((item) => item.supported).length };
}

function resolveMatchingCreator(projectVersion, searchRoots, platform = process.platform) {
  const inventory = discoverCreatorInstallations({ ...(searchRoots ? { searchRoots } : {}), platform });
  const matches = inventory.installations.filter((item) => item.creatorVersion === projectVersion && item.executableAvailable);
  if (matches.length === 0) throw coded('CREATOR_INSTALLATION_NOT_FOUND', JSON.stringify({
    projectVersion, searchedRoots: inventory.searchedRoots || [],
    discoveredVersions: inventory.installations.map((item) => ({ path: item.bundlePath, version: item.creatorVersion, status: item.status })),
  }));
  if (matches.length > 1) throw coded('CREATOR_INSTALLATION_AMBIGUOUS', JSON.stringify({
    projectVersion, matches: matches.map((item) => item.bundlePath),
  }));
  return resolveCreatorExecutable(matches[0].bundlePath, { platform });
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

export function requestCreatorProjectClose(processId, { platform = process.platform, spawnSyncImpl = spawnSync } = {}) {
  if (!['darwin', 'win32'].includes(platform)) throw coded('CREATOR_CLOSE_PLATFORM_UNSUPPORTED');
  if (!Number.isSafeInteger(processId) || processId < 1 || processId > 2147483647)
    throw coded('CREATOR_CLOSE_PROCESS_ID_UNAVAILABLE');
  if (platform === 'win32') {
    const script = String.raw`
$ErrorActionPreference = 'Stop'
$source = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
public static class CocosCreatorCloseWin32 {
  private delegate bool EnumWindowsProc(IntPtr window, IntPtr state);
  [DllImport("user32.dll")] private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr state);
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
  [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr window);
  [DllImport("user32.dll")] private static extern IntPtr GetMenu(IntPtr window);
  [DllImport("user32.dll")] private static extern int GetMenuItemCount(IntPtr menu);
  [DllImport("user32.dll")] private static extern IntPtr GetSubMenu(IntPtr menu, int position);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetMenuString(IntPtr menu, uint item, StringBuilder text, int maxCount, uint flags);
  [DllImport("user32.dll")] private static extern uint GetMenuItemID(IntPtr menu, int position);
  [DllImport("user32.dll")] private static extern bool PostMessage(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);
  private const uint MF_BYPOSITION = 0x00000400;
  private const uint WM_COMMAND = 0x00000111;
  private static string Label(IntPtr menu, int position) {
    var text = new StringBuilder(256);
    GetMenuString(menu, (uint)position, text, text.Capacity, MF_BYPOSITION);
    string label = text.ToString().Replace("&", "").Trim();
    int shortcut = label.IndexOf('\t');
    if (shortcut >= 0) label = label.Substring(0, shortcut).Trim();
    label = label.TrimEnd('.');
    if (label.EndsWith("…", StringComparison.Ordinal)) label = label.Substring(0, label.Length - 1);
    return Regex.Replace(label, @"\s*\([A-Za-z]\)$", "").Trim();
  }
  private static bool IsFileMenu(string text) { return text == "File" || text == "文件"; }
  private static bool IsOpenProject(string text) {
    return text == "Open Project" || text == "打开项目";
  }
  public static bool RequestOpenProject(uint targetProcessId) {
    bool posted = false;
    EnumWindowsProc callback = delegate(IntPtr window, IntPtr state) {
      uint windowProcessId;
      GetWindowThreadProcessId(window, out windowProcessId);
      if (windowProcessId != targetProcessId || !IsWindowVisible(window)) return true;
      IntPtr menu = GetMenu(window);
      if (menu == IntPtr.Zero) return true;
      int menuCount = GetMenuItemCount(menu);
      for (int i = 0; i < menuCount; i++) {
        if (!IsFileMenu(Label(menu, i))) continue;
        IntPtr fileMenu = GetSubMenu(menu, i);
        if (fileMenu == IntPtr.Zero) continue;
        int itemCount = GetMenuItemCount(fileMenu);
        for (int j = 0; j < itemCount; j++) {
          if (!IsOpenProject(Label(fileMenu, j))) continue;
          uint commandId = GetMenuItemID(fileMenu, j);
          if (commandId == 0 || commandId == UInt32.MaxValue) continue;
          posted = PostMessage(window, WM_COMMAND, new IntPtr((int)commandId), IntPtr.Zero);
          return false;
        }
      }
      return true;
    };
    EnumWindows(callback, IntPtr.Zero);
    return posted;
  }
}
'@
Add-Type -TypeDefinition $source -Language CSharp
if ([CocosCreatorCloseWin32]::RequestOpenProject(${processId}u)) {
  [Console]::Out.WriteLine('requested')
  exit 0
}
[Console]::Error.WriteLine('CREATOR_CLOSE_MENU_ITEM_NOT_FOUND')
exit 3
`;
    let result;
    try {
      const encoded = Buffer.from(script, 'utf16le').toString('base64');
      result = spawnSyncImpl('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
        encoding: 'utf8', timeout: 5000, maxBuffer: 4096, windowsHide: true,
      });
    } catch (error) {
      if (error?.code === 'ETIMEDOUT') throw coded('CREATOR_CLOSE_REQUEST_TIMEOUT');
      throw coded('CREATOR_CLOSE_REQUEST_FAILED', error.message || String(error));
    }
    if (result?.error?.code === 'ETIMEDOUT') throw coded('CREATOR_CLOSE_REQUEST_TIMEOUT');
    if (result?.status !== 0 || String(result?.stdout || '').trim() !== 'requested') {
      const output = String(result?.stderr || result?.stdout || '').slice(0, 1000);
      if (/CREATOR_CLOSE_MENU_ITEM_NOT_FOUND/.test(output)) throw coded('CREATOR_CLOSE_MENU_ITEM_NOT_FOUND');
      throw coded('CREATOR_CLOSE_REQUEST_FAILED', output || 'PowerShell menu request failed');
    }
    return { requested: true };
  }
  const script = [
    'on run argv',
    '  set targetPid to (item 1 of argv) as integer',
    '  tell application "System Events"',
    '    set targetProcess to first process whose unix id is targetPid',
    '    tell targetProcess',
    '      set frontmost to true',
    '      set targetMenu to missing value',
    '      repeat with menuBarItem in menu bar items of menu bar 1',
    '        if (name of menuBarItem is "File") or (name of menuBarItem is "文件") then',
    '          set targetMenu to menu 1 of menuBarItem',
    '        end if',
    '      end repeat',
    '      if targetMenu is missing value then error "CREATOR_CLOSE_FILE_MENU_NOT_FOUND"',
    '      repeat with menuItem in menu items of targetMenu',
    '        set itemName to name of menuItem',
    '        if itemName is "Open Project..." or itemName is "Open Project…" or itemName is "打开项目..." or itemName is "打开项目…" then',
    '          click menuItem',
    '          return "requested"',
    '        end if',
    '      end repeat',
    '      error "CREATOR_CLOSE_OPEN_PROJECT_MENU_ITEM_NOT_FOUND"',
    '    end tell',
    '  end tell',
    'end run',
  ].join('\n');
  let result;
  try {
    result = spawnSyncImpl('/usr/bin/osascript', ['-e', script, String(processId)], {
      encoding: 'utf8', timeout: 5000, maxBuffer: 4096, windowsHide: true,
    });
  } catch (error) {
    if (error?.code === 'ETIMEDOUT') throw coded('CREATOR_CLOSE_REQUEST_TIMEOUT');
    throw coded('CREATOR_CLOSE_REQUEST_FAILED', error.message || String(error));
  }
  if (result?.error?.code === 'ETIMEDOUT') throw coded('CREATOR_CLOSE_REQUEST_TIMEOUT');
  if (result?.status !== 0 || String(result?.stdout || '').trim() !== 'requested') {
    const stderr = String(result?.stderr || '').toLowerCase();
    if (/not authorized|not allowed|assistive|accessibility/.test(stderr))
      throw coded('CREATOR_CLOSE_ACCESSIBILITY_PERMISSION_REQUIRED');
    if (/CREATOR_CLOSE_FILE_MENU_NOT_FOUND/.test(stderr)) throw coded('CREATOR_CLOSE_FILE_MENU_NOT_FOUND');
    if (/CREATOR_CLOSE_OPEN_PROJECT_MENU_ITEM_NOT_FOUND/.test(stderr)) throw coded('CREATOR_CLOSE_MENU_ITEM_NOT_FOUND');
    throw coded('CREATOR_CLOSE_REQUEST_FAILED', String(result?.stderr || result?.stdout || 'osascript failed'));
  }
  return { requested: true };
}

export async function closeCreatorProject({ instanceId, timeoutMs = 30000 }, {
  listInstancesImpl = listInstances, requestCloseImpl = requestCreatorProjectClose,
  diagnoseModalImpl = diagnoseCreatorModal, platform = process.platform, nowImpl = Date.now,
  sleepImpl = (duration) => new Promise((resolve) => setTimeout(resolve, duration)),
} = {}) {
  if (typeof instanceId !== 'string' || !/^[0-9a-f-]{36}$/i.test(instanceId)) throw coded('CREATOR_INSTANCE_ID_INVALID');
  if (!['darwin', 'win32'].includes(platform)) throw coded('CREATOR_CLOSE_PLATFORM_UNSUPPORTED');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000)
    throw coded('CREATOR_CLOSE_TIMEOUT_INVALID');
  const inventory = await listInstancesImpl({ start: false });
  const instance = inventory.instances?.find((item) => item.instanceId === instanceId);
  if (!instance || instance.connected !== true) throw coded('CREATOR_CLOSE_INSTANCE_NOT_CONNECTED');
  const isAbsoluteProjectPath = platform === 'win32' ? path.win32.isAbsolute(instance.projectRoot) : path.isAbsolute(instance.projectRoot);
  if (instance.creatorVersion !== CREATOR_VERSION || !isAbsoluteProjectPath)
    throw coded('CREATOR_CLOSE_INSTANCE_IDENTITY_INVALID');
  if (!Number.isSafeInteger(instance.processId) || instance.processId < 1)
    throw coded('CREATOR_CLOSE_PROCESS_ID_UNAVAILABLE');
  requestCloseImpl(instance.processId, { platform });
  const closeRoute = 'file.open-project';
  const deadline = nowImpl() + timeoutMs;
  let lastError = null;
  while (nowImpl() < deadline) {
    try {
      const current = await listInstancesImpl({ start: false });
      const remaining = current.instances?.find((item) => item.instanceId === instanceId);
      if (!remaining || remaining.connected !== true)
        return { operation: 'close', success: true, closed: true, instanceId,
          projectName: instance.projectName, projectRoot: instance.projectRoot,
          creatorVersion: instance.creatorVersion, processId: instance.processId,
          closeRoute };
    } catch (error) { lastError = error; }
    await sleepImpl(Math.min(400, Math.max(0, deadline - nowImpl())));
  }
  const modalDiagnosis = diagnoseModalImpl(instance.processId);
  return { operation: 'close', success: false, closed: false, instanceId,
    projectName: instance.projectName, projectRoot: instance.projectRoot,
    creatorVersion: instance.creatorVersion, processId: instance.processId,
    closeRoute, modalDiagnosis,
    possibleBlocker: modalDiagnosis?.status === 'detected'
      ? 'Creator is showing a modal dialog; resolve its save or close prompt in the Editor.'
      : 'Creator remains connected; close may be waiting for a save prompt or a long-running Editor operation.',
    ...(lastError ? { lastErrorCode: lastError.code || lastError.message || String(lastError) } : {}) };
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
  installationSearchRoots, installationPlatform = process.platform, diagnoseModalImpl = diagnoseCreatorModal, nowImpl = Date.now,
  sleepImpl = (duration) => new Promise((resolve) => setTimeout(resolve, duration)),
} = {}) {
  const project = canonicalProjectRoot(projectRoot);
  const creator = creatorPath ? resolveCreatorExecutable(creatorPath, { platform: installationPlatform })
    : resolveMatchingCreator(project.project.version, installationSearchRoots, installationPlatform);
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
  debug = false, autoCompile = false, excludedModules, timeoutMs = 1200000 }, { spawnImpl = spawn } = {}) {
  if (!['build', 'compile'].includes(operation)) throw coded('CREATOR_WORKFLOW_INVALID');
  const allowedPlatforms = operation === 'build' ? BUILD_PLATFORMS : NATIVE_PLATFORMS;
  if (!allowedPlatforms.has(platform)) throw coded(operation === 'build' ? 'BUILD_PLATFORM_UNSUPPORTED' : 'COMPILE_PLATFORM_UNSUPPORTED');
  if (autoCompile && (operation !== 'build' || !NATIVE_PLATFORMS.has(platform))) throw coded('AUTO_COMPILE_NATIVE_BUILD_ONLY');
  if (excludedModules !== undefined) {
    if (operation !== 'build') throw coded('BUILD_MODULES_EXCLUDED_BUILD_ONLY');
    if (!Array.isArray(excludedModules) || excludedModules.length > 128
      || excludedModules.some((name) => typeof name !== 'string' || !/^[A-Za-z0-9_.-]{1,80}$/.test(name))
      || new Set(excludedModules).size !== excludedModules.length) throw coded('BUILD_EXCLUDED_MODULES_INVALID');
  }
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
  if (excludedModules?.length) parameters.push(`excludedModules=[${excludedModules.map((name) => `'${name}'`).join(',')}]`);
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
        ...(excludedModules === undefined ? {} : { excludedModules }),
        command: [creator.executable, ...args], exitCode, signal: signal || null, timedOut, builderFinished,
        success: failureCode === null, failureCode, failureReason: builderFailure,
        startedAt, completedAt, durationMs: Date.now() - startTime, stdout, stderr });
    };
    child.once('error', (error) => finish(error));
    child.once('close', (exitCode, signal) => finish(null, exitCode, signal));
  });
}
