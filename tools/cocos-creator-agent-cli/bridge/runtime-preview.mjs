import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { findSerializedSceneIdentity } from './preview-scene-identity.mjs';
import { readPreviewComponentProperty } from './preview-components.mjs';
import { normalizePreviewCoverage } from './preview-coverage.mjs';
import { createPreviewTestHarness, MAX_PREVIEW_TEST_CASES_PER_RUN, MAX_PREVIEW_TEST_INPUT_BYTES,
  MAX_PREVIEW_TEST_RESULT_BYTES, MAX_PREVIEW_TEST_TIMEOUT_MS, readPreviewTestSource } from './preview-test-script.mjs';

const DATA_ROOT = path.join(os.homedir(), '.cocos-creator-agent');
const SESSION_ROOT = path.join(DATA_ROOT, 'preview-sessions');
const CAPTURE_ROOT = path.join(DATA_ROOT, 'captures');
const MAX_LOGS = 500;
const MAX_LOG_TEXT = 2000;
const MAX_ACTIONS = 12;
const MAX_ASSERTIONS = 12;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const sessions = new Map();

function failure(code, detail) {
  const error = new Error(detail ? `${code}:${String(detail).slice(0, 240)}` : code);
  error.code = code;
  return error;
}

function ensurePrivateDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw failure('PREVIEW_DATA_DIRECTORY_UNSAFE');
  try { fs.chmodSync(directory, 0o700); } catch (_) {}
}

function validatePreviewUrl(raw) {
  let url;
  try { url = new URL(raw); } catch (_) { throw failure('PREVIEW_URL_INVALID'); }
  if (url.protocol !== 'http:' || !LOOPBACK_HOSTS.has(url.hostname) || url.username || url.password
    || url.search || url.hash || url.pathname !== '/') throw failure('PREVIEW_URL_MUST_BE_LOOPBACK_HTTP_ORIGIN');
  return url;
}

function browserCandidates() {
  if (process.env.COCOS_CREATOR_AGENT_BROWSER) return [process.env.COCOS_CREATOR_AGENT_BROWSER];
  if (process.platform === 'darwin') return [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
  ];
  if (process.platform === 'win32') {
    const roots = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
    return roots.flatMap((root) => [path.join(root, 'Google/Chrome/Application/chrome.exe'), path.join(root, 'Chromium/Application/chrome.exe')]);
  }
  const result = spawnSync('sh', ['-lc', 'command -v chromium || command -v chromium-browser || command -v google-chrome || command -v google-chrome-stable'],
    { encoding: 'utf8', timeout: 1500 });
  return result.status === 0 && result.stdout.trim() ? [result.stdout.trim()] : [];
}

function findBrowser() {
  for (const candidate of browserCandidates()) {
    try { if (fs.statSync(candidate).isFile()) return candidate; } catch (_) {}
  }
  throw failure('PREVIEW_BROWSER_NOT_FOUND', 'set COCOS_CREATOR_AGENT_BROWSER to a Chromium executable');
}

export function previewHostCapabilities(creatorPreviewAvailable = false) {
  let available = true;
  let reason;
  try { findBrowser(); } catch (error) { available = false; reason = error.code || 'PREVIEW_BROWSER_NOT_FOUND'; }
  const commands = ['creator.preview.observe', 'creator.preview.screenshot', 'creator.preview.interact', 'creator.preview.test-script',
    'creator.preview.refresh', 'creator.preview.stop'];
  const result = commands.map((id) => ({ id, status: available ? 'available' : 'unavailable', ...(available ? {} : { reason }) }));
  result.push({ id: 'creator.preview.start', status: available && creatorPreviewAvailable ? 'available' : 'unavailable',
    reason: available ? 'CREATOR_PREVIEW_API_UNAVAILABLE' : (reason || 'PREVIEW_BROWSER_NOT_FOUND') });
  return result;
}

function maskedFrame(payload, opcode = 1) {
  const bytes = Buffer.from(payload);
  const mask = randomBytes(4);
  let header;
  if (bytes.length < 126) {
    header = Buffer.from([0x80 | opcode, 0x80 | bytes.length]);
  } else if (bytes.length <= 0xffff) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(bytes.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(bytes.length), 2);
  }
  const masked = Buffer.alloc(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) masked[index] = bytes[index] ^ mask[index % 4];
  return Buffer.concat([header, mask, masked]);
}

class DevToolsConnection extends EventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.pending = new Map();
    this.nextId = 0;
  }

  connect(webSocketUrl) {
    const url = new URL(webSocketUrl);
    if (url.protocol !== 'ws:' || !LOOPBACK_HOSTS.has(url.hostname)) throw failure('PREVIEW_DEVTOOLS_URL_UNSAFE');
    return new Promise((resolve, reject) => {
      const key = randomBytes(16).toString('base64');
      const request = http.request({ hostname: url.hostname, port: Number(url.port || 80), path: `${url.pathname}${url.search}`,
        headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': key, 'Sec-WebSocket-Version': '13' } });
      const timer = setTimeout(() => request.destroy(failure('PREVIEW_DEVTOOLS_CONNECT_TIMEOUT')), 8000);
      request.on('upgrade', (response, socket, head) => {
        clearTimeout(timer);
        const expected = createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
        if (response.headers['sec-websocket-accept'] !== expected) { socket.destroy(); reject(failure('PREVIEW_DEVTOOLS_HANDSHAKE_INVALID')); return; }
        this.socket = socket;
        socket.on('data', (chunk) => this.consume(chunk));
        socket.on('error', (error) => this.failPending(failure('PREVIEW_DEVTOOLS_SOCKET_ERROR', error.message)));
        socket.on('close', () => this.failPending(failure('PREVIEW_DEVTOOLS_DISCONNECTED')));
        if (head?.length) this.consume(head);
        resolve(this);
      });
      request.on('response', (response) => { clearTimeout(timer); reject(failure('PREVIEW_DEVTOOLS_REJECTED', response.statusCode)); });
      request.on('error', (error) => { clearTimeout(timer); reject(failure('PREVIEW_DEVTOOLS_CONNECT_FAILED', error.message)); });
      request.end();
    });
  }

  consume(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 2) {
      const first = this.buffer[0];
      const second = this.buffer[1];
      const opcode = first & 0x0f;
      let length = second & 0x7f;
      let offset = 2;
      if (length === 126) {
        if (this.buffer.length < 4) return;
        length = this.buffer.readUInt16BE(2); offset = 4;
      } else if (length === 127) {
        if (this.buffer.length < 10) return;
        const wide = this.buffer.readBigUInt64BE(2);
        if (wide > 16n * 1024n * 1024n) { this.close(); this.failPending(failure('PREVIEW_DEVTOOLS_FRAME_TOO_LARGE')); return; }
        length = Number(wide); offset = 10;
      }
      const masked = (second & 0x80) !== 0;
      if (masked) offset += 4;
      if (this.buffer.length < offset + length) return;
      const maskOffset = offset - 4;
      let payload = this.buffer.subarray(offset, offset + length);
      if (masked) {
        const mask = this.buffer.subarray(maskOffset, maskOffset + 4);
        const decoded = Buffer.alloc(length);
        for (let index = 0; index < length; index += 1) decoded[index] = payload[index] ^ mask[index % 4];
        payload = decoded;
      }
      this.buffer = this.buffer.subarray(offset + length);
      if (opcode === 0x8) { this.close(); this.failPending(failure('PREVIEW_DEVTOOLS_DISCONNECTED')); return; }
      if (opcode === 0x9) { this.socket?.write(maskedFrame(payload, 0xA)); continue; }
      if (opcode !== 0x1) continue;
      let message;
      try { message = JSON.parse(payload.toString('utf8')); } catch (_) { continue; }
      if (Number.isInteger(message.id) && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        clearTimeout(pending.timeout);
        if (message.error) pending.reject(failure('PREVIEW_DEVTOOLS_COMMAND_FAILED', message.error.message));
        else pending.resolve(message.result || {});
      } else if (typeof message.method === 'string') this.emit('event', message);
    }
  }

  command(method, params = {}, timeoutMs = 12000) {
    if (!this.socket || this.socket.destroyed) return Promise.reject(failure('PREVIEW_DEVTOOLS_DISCONNECTED'));
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(failure('PREVIEW_DEVTOOLS_COMMAND_TIMEOUT', method));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      this.socket.write(maskedFrame(JSON.stringify({ id, method, params })));
    });
  }

  failPending(error) {
    for (const pending of this.pending.values()) { clearTimeout(pending.timeout); pending.reject(error); }
    this.pending.clear();
  }

  close() {
    this.failPending(failure('PREVIEW_DEVTOOLS_DISCONNECTED'));
    try { if (this.socket && !this.socket.destroyed) this.socket.end(maskedFrame('', 0x8)); } catch (_) {}
    try { this.socket?.destroy(); } catch (_) {}
    this.socket = null;
  }
}

function describeConsoleArg(arg) {
  if (typeof arg?.value === 'string') return arg.value;
  if (arg?.unserializableValue) return String(arg.unserializableValue);
  if (arg?.description) return arg.description;
  return arg?.type || '';
}

function sanitizeLog(value) {
  return String(value).replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [redacted]')
    .replace(/((?:api[_-]?key|token|secret|authorization)\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]')
    .slice(0, MAX_LOG_TEXT);
}

function recordLog(session, level, text, source = 'browser') {
  session.consoleSequence += 1;
  session.console.push({ sequence: session.consoleSequence, at: new Date().toISOString(), level,
    source, text: sanitizeLog(text) });
  if (session.console.length > MAX_LOGS) session.console.splice(0, session.console.length - MAX_LOGS);
}

async function devToolsPort(profileDirectory, session, cancelled = () => false) {
  const activePort = path.join(profileDirectory, 'DevToolsActivePort');
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    if (cancelled()) throw failure('PREVIEW_ACTION_CANCELLED');
    if (session.browserExited) throw failure('PREVIEW_BROWSER_EXITED', session.browserSpawnError?.message);
    try {
      const parts = fs.readFileSync(activePort, 'utf8').trim().split(/\r?\n/);
      const port = Number(parts[0]);
      if (Number.isInteger(port) && port > 0 && port <= 65535 && parts[1]?.startsWith('/devtools/browser/')) return port;
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw failure('PREVIEW_DEVTOOLS_PORT_UNAVAILABLE');
}

async function getJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(4000), redirect: 'error' });
  if (!response.ok) throw failure('PREVIEW_SERVER_NOT_READY', response.status);
  return response.json();
}

async function waitForPreviewServer(previewUrl, timeoutMs = 25000, cancelled = () => false) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    if (cancelled()) throw failure('PREVIEW_ACTION_CANCELLED');
    try {
      const response = await fetch(previewUrl, { signal: AbortSignal.timeout(2500), redirect: 'error' });
      if (response.ok && (response.headers.get('content-type') || '').toLowerCase().includes('text/html')) {
        await response.body?.cancel();
        return;
      }
      await response.body?.cancel();
      lastError = failure('PREVIEW_SERVER_NOT_HTML', response.status);
    } catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw failure('PREVIEW_SERVER_NOT_READY', lastError?.message || 'timeout');
}

async function evaluate(session, expression, timeoutMs = 10000) {
  const response = await session.cdp.command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, timeoutMs);
  if (response.exceptionDetails) throw failure('PREVIEW_EVALUATION_FAILED', response.exceptionDetails.text);
  if (response.result?.subtype === 'error') throw failure('PREVIEW_EVALUATION_FAILED', response.result.description);
  return response.result?.value;
}

const PAGE_SNAPSHOT_EXPRESSION = `(() => {
  const scene = window.cc && cc.director && cc.director.getScene && cc.director.getScene();
  const canvas = document.querySelector('canvas');
  const rect = canvas && canvas.getBoundingClientRect();
  return { ready: !!scene, title: document.title || '', url: location.href, readyState: document.readyState,
    sceneName: scene && String(scene.name || ''), sceneUuid: scene && (typeof scene.uuid === 'string' ? scene.uuid : null),
    canvas: canvas ? { width: canvas.width, height: canvas.height, left: rect.left, top: rect.top, clientWidth: rect.width, clientHeight: rect.height } : null };
})()`;

async function waitForRuntime(session, timeoutMs = 30000, cancelled = () => false) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    if (cancelled()) throw failure('PREVIEW_ACTION_CANCELLED');
    try {
      last = await evaluate(session, PAGE_SNAPSHOT_EXPRESSION, 3000);
      if (last?.ready && last.sceneName === session.sceneName
        && (!last.sceneUuid || last.sceneUuid === session.sceneUuid) && last.canvas) return last;
      if (last?.ready && (last.sceneName !== session.sceneName || (last.sceneUuid && last.sceneUuid !== session.sceneUuid)))
        throw failure('PREVIEW_SCENE_IDENTITY_MISMATCH', `${last.sceneName}/${last.sceneUuid}`);
    } catch (error) {
      if (error.code === 'PREVIEW_SCENE_IDENTITY_MISMATCH') throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw failure('PREVIEW_RUNTIME_NOT_READY', last?.readyState || 'timeout');
}

function attachConsole(session) {
  session.cdp.on('event', (event) => {
    if (event.method === 'Runtime.consoleAPICalled') {
      const params = event.params || {};
      const text = (params.args || []).map(describeConsoleArg).filter(Boolean).join(' ').slice(0, MAX_LOG_TEXT);
      recordLog(session, params.type === 'warning' ? 'warning' : params.type === 'error' ? 'error' : params.type || 'log', text);
    } else if (event.method === 'Runtime.exceptionThrown') {
      const details = event.params?.exceptionDetails || {};
      recordLog(session, 'error', details.exception?.description || details.text || 'Unhandled runtime exception', 'exception');
    } else if (event.method === 'Page.frameNavigated' && event.params?.frame?.parentId === undefined) {
      session.navigationCount += 1;
      session.lastNavigationAt = new Date().toISOString();
    }
  });
}

function waitForServedSceneAsset(session, timeoutMs = 25000) {
  const expectedUrl = new URL('preview-scene.json', session.previewUrl).href;
  return new Promise((resolve, reject) => {
    let requestId = null;
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      session.cdp.removeListener('event', onEvent);
      if (error) reject(error); else resolve(value);
    };
    const timeout = setTimeout(() => finish(failure('PREVIEW_SCENE_ASSET_NOT_OBSERVED', expectedUrl)), timeoutMs);
    const onEvent = (event) => {
      const params = event.params || {};
      if (event.method === 'Network.responseReceived' && params.response?.url === expectedUrl) {
        if (params.response.status !== 200) { finish(failure('PREVIEW_SCENE_ASSET_HTTP_ERROR', params.response.status)); return; }
        requestId = params.requestId;
      } else if (event.method === 'Network.loadingFailed' && params.requestId === requestId) {
        finish(failure('PREVIEW_SCENE_ASSET_LOAD_FAILED', params.errorText));
      } else if (event.method === 'Network.loadingFinished' && params.requestId === requestId) {
        session.cdp.command('Network.getResponseBody', { requestId }, 10000).then((body) => {
          const text = body.base64Encoded ? Buffer.from(body.body, 'base64').toString('utf8') : body.body;
          if (Buffer.byteLength(text, 'utf8') > 12 * 1024 * 1024) throw failure('PREVIEW_SCENE_ASSET_TOO_LARGE');
          let serialized;
          try { serialized = JSON.parse(text); } catch (_) { throw failure('PREVIEW_SCENE_ASSET_INVALID_JSON'); }
          const identity = findSerializedSceneIdentity(serialized, session.sceneUuid, session.sceneName);
          if (!identity) throw failure('PREVIEW_SCENE_ASSET_IDENTITY_MISMATCH');
          finish(null, identity);
        }).catch((error) => finish(error.code ? error : failure('PREVIEW_SCENE_ASSET_READBACK_FAILED', error.message)));
      }
    };
    session.cdp.on('event', onEvent);
  });
}

async function sessionFor(instance, previewSessionId, { allowExited = false } = {}) {
  if (typeof previewSessionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(previewSessionId)) throw failure('PREVIEW_SESSION_ID_INVALID');
  const session = sessions.get(previewSessionId);
  if (!session || session.instanceId !== instance.instanceId || session.creatorSessionId !== instance.sessionId)
    throw failure('PREVIEW_SESSION_NOT_FOUND');
  if (!allowExited && (session.browserExited || session.browserSpawnError || session.browser.exitCode !== null))
    throw failure('PREVIEW_BROWSER_EXITED', session.browserSpawnError?.message);
  return session;
}

async function launchBrowser(session, cancelled = () => false) {
  const browser = findBrowser();
  ensurePrivateDirectory(SESSION_ROOT);
  const profile = path.join(SESSION_ROOT, session.previewSessionId);
  fs.mkdirSync(profile, { recursive: true, mode: 0o700 });
  const args = ['--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-translate', 'about:blank'];
  if (process.platform === 'linux') args.push('--no-sandbox', '--disable-dev-shm-usage');
  const browserProcess = spawn(browser, args, { stdio: 'ignore', detached: false });
  session.browser = browserProcess;
  browserProcess.once('exit', () => { session.browserExited = true; });
  browserProcess.once('error', (error) => { session.browserSpawnError = error; session.browserExited = true; });
  const port = await devToolsPort(profile, session, cancelled);
  session.devToolsOrigin = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 10000;
  let targets = [];
  while (Date.now() < deadline) {
    try { targets = await getJson(`${session.devToolsOrigin}/json/list`); } catch (_) {}
    const page = Array.isArray(targets) && targets.find((target) => target.type === 'page' && target.url === 'about:blank' && target.webSocketDebuggerUrl);
    if (page) { session.target = page; break; }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!session.target) throw failure('PREVIEW_BROWSER_TARGET_UNAVAILABLE');
  session.cdp = await new DevToolsConnection().connect(session.target.webSocketDebuggerUrl.replace(/^ws:\/\/localhost/, 'ws://127.0.0.1'));
  attachConsole(session);
  await session.cdp.command('Page.enable');
  await session.cdp.command('Runtime.enable');
  await session.cdp.command('Network.enable');
  const sceneAssetVerification = waitForServedSceneAsset(session);
  await session.cdp.command('Page.navigate', { url: session.previewUrl });
  session.sceneAssetIdentity = await sceneAssetVerification;
  session.page = await waitForRuntime(session, 30000, cancelled);
}

function publicSession(session) {
  return { previewSessionId: session.previewSessionId, instanceId: session.instanceId,
    creatorSessionId: session.creatorSessionId, projectRoot: session.projectRoot,
    creatorVersion: session.creatorVersion, sceneName: session.sceneName, sceneUuid: session.sceneUuid,
    sceneAssetIdentity: session.sceneAssetIdentity || null,
    previewUrl: session.previewUrl, state: session.browserExited ? 'browser-exited' : 'running',
    startedAt: session.startedAt, navigationCount: session.navigationCount,
    lastNavigationAt: session.lastNavigationAt, consoleSequence: session.consoleSequence,
    consoleErrorCount: session.console.filter((entry) => entry.level === 'error').length };
}

export async function startPreview(instance, creatorResult, input = {}, cancelled = () => false) {
  if (!creatorResult || creatorResult.instanceId !== instance.instanceId || creatorResult.creatorSessionId !== instance.sessionId
    || creatorResult.projectRoot !== instance.projectRoot || creatorResult.creatorVersion !== instance.creatorVersion
    || typeof creatorResult.sceneName !== 'string' || typeof creatorResult.sceneUuid !== 'string')
    throw failure('PREVIEW_CREATOR_IDENTITY_INVALID');
  for (const existing of sessions.values()) {
    if (existing.instanceId === instance.instanceId && existing.creatorSessionId === instance.sessionId)
      await stopPreview(instance, { previewSessionId: existing.previewSessionId });
  }
  const port = input.port || 7456;
  if (creatorResult.previewPort !== port) throw failure('PREVIEW_PORT_IDENTITY_MISMATCH');
  const previewUrl = `http://127.0.0.1:${port}/`;
  validatePreviewUrl(previewUrl);
  await waitForPreviewServer(previewUrl, 25000, cancelled);
  if (cancelled()) throw failure('PREVIEW_ACTION_CANCELLED');
  const session = { previewSessionId: randomUUID(), instanceId: instance.instanceId,
    creatorSessionId: instance.sessionId, projectRoot: instance.projectRoot, creatorVersion: instance.creatorVersion,
    sceneName: creatorResult.sceneName, sceneUuid: creatorResult.sceneUuid, previewUrl,
    startedAt: new Date().toISOString(), navigationCount: 0, lastNavigationAt: null, consoleSequence: 0,
    console: [], browser: { exitCode: null }, browserExited: false };
  sessions.set(session.previewSessionId, session);
  try { await launchBrowser(session, cancelled); }
  catch (error) { await closeOwnedBrowser(session); sessions.delete(session.previewSessionId); throw error; }
  return { ...publicSession(session), page: session.page, controls: ['observe', 'screenshot', 'refresh', 'interact', 'stop'] };
}

export async function observePreview(instance, input) {
  if (input.cancelled?.()) throw failure('PREVIEW_ACTION_CANCELLED');
  const session = await sessionFor(instance, input.previewSessionId);
  session.page = await evaluate(session, PAGE_SNAPSHOT_EXPRESSION);
  const after = input.afterSequence || 0;
  const logs = session.console.filter((entry) => entry.sequence > after).slice(-100);
  return { ...publicSession(session), page: session.page, console: logs,
    oldestConsoleSequence: session.console[0]?.sequence || session.consoleSequence + 1,
    truncated: after > 0 && session.console[0] && after < session.console[0].sequence - 1 };
}

export async function screenshotPreview(instance, input) {
  if (input.cancelled?.()) throw failure('PREVIEW_ACTION_CANCELLED');
  const session = await sessionFor(instance, input.previewSessionId);
  const image = await session.cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  ensurePrivateDirectory(CAPTURE_ROOT);
  const directory = path.join(CAPTURE_ROOT, session.previewSessionId);
  ensurePrivateDirectory(directory);
  const filename = path.join(directory, `capture-${Date.now()}-${randomBytes(3).toString('hex')}.png`);
  const bytes = Buffer.from(image.data, 'base64');
  if (bytes.length < 8 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw failure('PREVIEW_SCREENSHOT_INVALID');
  if (input.cancelled?.()) throw failure('PREVIEW_ACTION_CANCELLED');
  fs.writeFileSync(filename, bytes, { flag: 'wx', mode: 0o600 });
  return { previewSessionId: session.previewSessionId, instanceId: session.instanceId,
    projectRoot: session.projectRoot, sceneUuid: session.sceneUuid, path: filename, sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length, page: await evaluate(session, PAGE_SNAPSHOT_EXPRESSION) };
}

const KEY_NAMES = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'Escape', 'Tab', 'KeyW', 'KeyA', 'KeyS', 'KeyD',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => `Key${letter}`), ...'0123456789'.split('').map((digit) => `Digit${digit}`)]);

function windowsVirtualKeyCode(key) {
  const namedCodes = { ArrowUp: 0x26, ArrowDown: 0x28, ArrowLeft: 0x25, ArrowRight: 0x27,
    Space: 0x20, Enter: 0x0d, Escape: 0x1b, Tab: 0x09 };
  if (Object.hasOwn(namedCodes, key)) return namedCodes[key];
  if (/^Key[A-Z]$/.test(key)) return key.charCodeAt(3);
  if (/^Digit[0-9]$/.test(key)) return key.charCodeAt(5);
  throw failure('PREVIEW_KEY_NOT_ALLOWED');
}

export function validatePreviewActions(actions) {
  if (!Array.isArray(actions) || actions.length < 1 || actions.length > MAX_ACTIONS) throw failure('PREVIEW_ACTIONS_INVALID');
  return actions.map((action) => {
    if (!action || typeof action !== 'object') throw failure('PREVIEW_ACTION_INVALID');
    if (action.type === 'key') {
      if (Object.keys(action).some((key) => !['type', 'key', 'durationMs'].includes(key))) throw failure('PREVIEW_ACTION_FIELD_INVALID');
      if (!KEY_NAMES.has(action.key)) throw failure('PREVIEW_KEY_NOT_ALLOWED');
      return { type: 'key', key: action.key, durationMs: Number.isInteger(action.durationMs) ? Math.max(1, Math.min(action.durationMs, 2000)) : 100 };
    }
    if (action.type === 'click') {
      if (Object.keys(action).some((key) => !['type', 'x', 'y'].includes(key))) throw failure('PREVIEW_ACTION_FIELD_INVALID');
      if (typeof action.x !== 'number' || typeof action.y !== 'number' || !Number.isFinite(action.x) || !Number.isFinite(action.y)
        || action.x < 0 || action.x > 1 || action.y < 0 || action.y > 1) throw failure('PREVIEW_CLICK_OUT_OF_BOUNDS');
      return { type: 'click', x: action.x, y: action.y };
    }
    if (action.type === 'drag') {
      if (Object.keys(action).some((key) => !['type', 'startX', 'startY', 'endX', 'endY', 'durationMs'].includes(key)))
        throw failure('PREVIEW_ACTION_FIELD_INVALID');
      const coords = [action.startX, action.startY, action.endX, action.endY];
      if (coords.some((value) => typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1))
        throw failure('PREVIEW_DRAG_OUT_OF_BOUNDS');
      return { type: 'drag', startX: action.startX, startY: action.startY, endX: action.endX, endY: action.endY,
        durationMs: Number.isInteger(action.durationMs) ? Math.max(1, Math.min(action.durationMs, 2000)) : 300 };
    }
    if (action.type === 'text') {
      if (Object.keys(action).some((key) => !['type', 'text'].includes(key))) throw failure('PREVIEW_ACTION_FIELD_INVALID');
      if (typeof action.text !== 'string' || action.text.length > 512 || action.text.includes('\0'))
        throw failure('PREVIEW_TEXT_INPUT_INVALID');
      return { type: 'text', text: action.text };
    }
    if (action.type === 'ui-refresh') {
      if (Object.keys(action).some((key) => !['type', 'path', 'componentType'].includes(key))) throw failure('PREVIEW_ACTION_FIELD_INVALID');
      if (typeof action.path !== 'string' || !action.path || action.path.length > 240
        || action.path.split('/').some((part) => !part || part === '.' || part === '..')
        || !['cc.Widget', 'cc.Layout'].includes(action.componentType)) throw failure('PREVIEW_UI_REFRESH_INPUT_INVALID');
      return { type: 'ui-refresh', path: action.path, componentType: action.componentType };
    }
    throw failure('PREVIEW_ACTION_TYPE_UNSUPPORTED');
  });
}

export function validatePreviewAssertions(assertions) {
  if (!Array.isArray(assertions) || assertions.length < 1 || assertions.length > MAX_ASSERTIONS) throw failure('PREVIEW_ASSERTIONS_INVALID');
  return assertions.map((assertion) => {
    if (!assertion || typeof assertion !== 'object') throw failure('PREVIEW_ASSERTION_INVALID');
    if (assertion.type === 'no-errors') {
      if (Object.keys(assertion).some((key) => key !== 'type')) throw failure('PREVIEW_ASSERTION_FIELD_INVALID');
      return { type: assertion.type };
    }
    if (assertion.type === 'console-contains') {
      if (Object.keys(assertion).some((key) => !['type', 'text'].includes(key))) throw failure('PREVIEW_ASSERTION_FIELD_INVALID');
      if (typeof assertion.text !== 'string' || !assertion.text || assertion.text.length > 240) throw failure('PREVIEW_ASSERTION_INVALID');
      return { type: assertion.type, text: assertion.text };
    }
    if (assertion.type === 'scene') {
      if (Object.keys(assertion).some((key) => !['type', 'name', 'uuid'].includes(key))) throw failure('PREVIEW_ASSERTION_FIELD_INVALID');
      if ((assertion.name !== undefined && (typeof assertion.name !== 'string' || assertion.name.length > 120))
        || (assertion.uuid !== undefined && (typeof assertion.uuid !== 'string' || assertion.uuid.length > 80))) throw failure('PREVIEW_ASSERTION_INVALID');
      return { type: assertion.type, ...(assertion.name === undefined ? {} : { name: assertion.name }),
        ...(assertion.uuid === undefined ? {} : { uuid: assertion.uuid }) };
    }
    if (assertion.type === 'node-exists') {
      if (Object.keys(assertion).some((key) => !['type', 'path'].includes(key))) throw failure('PREVIEW_ASSERTION_FIELD_INVALID');
      if (typeof assertion.path !== 'string' || !assertion.path || assertion.path.length > 240
        || assertion.path.split('/').some((part) => !part || part === '.' || part === '..')) throw failure('PREVIEW_ASSERTION_INVALID');
      return { type: assertion.type, path: assertion.path };
    }
    if (assertion.type === 'node-property') {
      if (Object.keys(assertion).some((key) => !['type', 'path', 'property', 'expected', 'tolerance'].includes(key))) throw failure('PREVIEW_ASSERTION_FIELD_INVALID');
      if (typeof assertion.path !== 'string' || !assertion.path || assertion.path.length > 240
        || !['active', 'x', 'y', 'width', 'height', 'anchorX', 'anchorY'].includes(assertion.property)
        || (assertion.property === 'active' && typeof assertion.expected !== 'boolean')
        || (['x', 'y', 'width', 'height', 'anchorX', 'anchorY'].includes(assertion.property) && typeof assertion.expected !== 'number')
        || !['string', 'number', 'boolean'].includes(typeof assertion.expected)) throw failure('PREVIEW_ASSERTION_INVALID');
      return { type: assertion.type, path: assertion.path, property: assertion.property, expected: assertion.expected,
        tolerance: Number.isFinite(assertion.tolerance) ? Math.max(0, Math.min(assertion.tolerance, 100)) : 0.01 };
    }
    if (assertion.type === 'component-property') {
      if (Object.keys(assertion).some((key) => !['type', 'path', 'componentType', 'componentProperty', 'expected', 'tolerance'].includes(key))) throw failure('PREVIEW_ASSERTION_FIELD_INVALID');
      if (typeof assertion.path !== 'string' || !assertion.path || assertion.path.length > 240
        || assertion.path.split('/').some((part) => !part || part === '.' || part === '..')
        || typeof assertion.componentType !== 'string'
        || !/^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*$/.test(assertion.componentType)
        || assertion.componentType.length > 120
        || typeof assertion.componentProperty !== 'string' || !/^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/.test(assertion.componentProperty)
        || (assertion.tolerance !== undefined && (typeof assertion.expected !== 'number' || !Number.isFinite(assertion.tolerance) || assertion.tolerance < 0 || assertion.tolerance > 100))
        || !['string', 'number', 'boolean'].includes(typeof assertion.expected)) throw failure('PREVIEW_ASSERTION_INVALID');
      return { type: assertion.type, path: assertion.path, componentType: assertion.componentType,
        componentProperty: assertion.componentProperty, expected: assertion.expected,
        ...(assertion.tolerance === undefined ? {} : { tolerance: assertion.tolerance }) };
    }
    throw failure('PREVIEW_ASSERTION_TYPE_UNSUPPORTED');
  });
}

function assertionExpression(assertion) {
  const encoded = JSON.stringify(assertion);
  return `(() => { const a = ${encoded}; const root = window.cc && cc.director && cc.director.getScene && cc.director.getScene();
    const find = (path) => { if (!root) return null; const parts = path.split('/'); let node = root;
      if (parts[0] === String(root.name || '')) parts.shift();
      for (const part of parts) { node = (node.children || []).find((child) => String(child.name || '') === part); if (!node) return null; }
      return node; };
    if (a.type === 'scene') return { actual: root ? { name: String(root.name || ''), uuid: root.uuid || null } : null,
      pass: !!root && (a.name === undefined || String(root.name || '') === a.name) && (a.uuid === undefined || root.uuid === a.uuid) };
    if (a.type === 'node-exists') { const node = find(a.path); return { actual: !!node, pass: !!node }; }
    if (a.type === 'node-property') { const node = find(a.path); let actual = null;
      if (node && a.property === 'active') actual = node.active !== false;
      else if (node && ['x', 'y', 'width', 'height', 'anchorX', 'anchorY'].includes(a.property)) actual = Number(node[a.property]);
      const pass = typeof a.expected === 'number' ? typeof actual === 'number' && Math.abs(actual - a.expected) <= a.tolerance : actual === a.expected;
      return { actual, pass }; }
    if (a.type === 'component-property') { const node = find(a.path);
      const readComponentProperty = ${readPreviewComponentProperty.toString()};
      const result = readComponentProperty(node, a.componentType, a.componentProperty);
      const pass = typeof a.expected === 'number' && typeof result.actual === 'number'
        ? Math.abs(result.actual - a.expected) <= (a.tolerance || 0) : result.actual === a.expected;
      return { actual: result.actual, pass: result.found && pass }; }
    return { pass: false, actual: null }; })()`;
}

export function previewUiRefreshExpression(action) {
  const encoded = JSON.stringify(action);
  return `(() => { const a = ${encoded}; const cc = window.cc;
    const root = cc && cc.director && cc.director.getScene && cc.director.getScene();
    if (!root) return { available: false, applied: false, reason: 'NO_ACTIVE_SCENE' };
    const parts = a.path.split('/');
    if (parts[0] === String(root.name || '')) parts.shift();
    let node = root;
    for (const part of parts) {
      const flags = cc.Object && cc.Object.Flags;
      const hidden = flags ? flags.DontSave | flags.HideInHierarchy : 0;
      const matches = (node.children || []).filter((child) => String(child.name || '') === part
        && !(Number(child._objFlags || 0) & hidden));
      if (matches.length !== 1) return { available: false, applied: false,
        reason: matches.length ? 'PREVIEW_UI_NODE_PATH_AMBIGUOUS' : 'PREVIEW_UI_NODE_NOT_FOUND' };
      node = matches[0];
    }
    const componentType = a.componentType === 'cc.Widget' ? cc.Widget : cc.Layout;
    if (typeof componentType !== 'function' || !node || typeof node.getComponent !== 'function')
      return { available: false, applied: false, reason: 'PREVIEW_UI_COMPONENT_UNAVAILABLE' };
    const component = node.getComponent(componentType);
    const method = a.componentType === 'cc.Widget' ? 'updateAlignment' : 'updateLayout';
    if (!component || typeof component[method] !== 'function')
      return { available: false, applied: false, reason: 'PREVIEW_UI_REFRESH_METHOD_UNAVAILABLE' };
    const children = Array.isArray(node.children) ? node.children : [];
    if (a.componentType === 'cc.Layout' && children.length > 128)
      return { available: false, applied: false, reason: 'PREVIEW_UI_LAYOUT_CHILD_LIMIT' };
    const metrics = (item) => ({ x: Number.isFinite(item.x) ? item.x : null, y: Number.isFinite(item.y) ? item.y : null,
      width: Number.isFinite(item.width) ? item.width : null, height: Number.isFinite(item.height) ? item.height : null,
      anchorX: Number.isFinite(item.anchorX) ? item.anchorX : null, anchorY: Number.isFinite(item.anchorY) ? item.anchorY : null });
    const before = metrics(node);
    const childrenBefore = children.map((child) => ({ name: String(child.name || ''), uuid: child.uuid || null, ...metrics(child) }));
    let error = null;
    try { component[method](); } catch (caught) { error = String(caught && caught.message || caught).slice(0, 240); }
    const after = metrics(node);
    const childrenAfter = children.map((child) => ({ name: String(child.name || ''), uuid: child.uuid || null, ...metrics(child) }));
    return { available: true, applied: error === null, path: a.path, componentType: a.componentType, method,
      error, changed: JSON.stringify([before, childrenBefore]) !== JSON.stringify([after, childrenAfter]),
      before, after, childrenBefore, childrenAfter };
  })()`;
}

async function performAction(session, action) {
  if (action.type === 'ui-refresh') {
    const result = await evaluate(session, previewUiRefreshExpression(action));
    if (!result || result.available !== true) throw failure(result && result.reason || 'PREVIEW_UI_REFRESH_FAILED');
    return result;
  }
  if (action.type === 'key') {
    const key = action.key === 'Space' ? ' ' : action.key.startsWith('Key') ? action.key.slice(3).toLowerCase() : action.key;
    const code = action.key;
    const windowsCode = windowsVirtualKeyCode(action.key);
    await session.cdp.command('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: windowsCode });
    try { await new Promise((resolve) => setTimeout(resolve, action.durationMs)); }
    finally { await session.cdp.command('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: windowsCode }); }
  } else if (action.type === 'text') {
    await session.cdp.command('Input.insertText', { text: action.text });
  } else {
    const canvas = await evaluate(session, `(() => { const c = document.querySelector('canvas'); if (!c) return null; const r = c.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height }; })()`);
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) throw failure('PREVIEW_CANVAS_NOT_FOUND');
    if (action.type === 'click') {
      const x = canvas.x + canvas.width * action.x;
      const y = canvas.y + canvas.height * action.y;
      await session.cdp.command('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' });
      await session.cdp.command('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await session.cdp.command('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    } else {
      const start = { x: canvas.x + canvas.width * action.startX, y: canvas.y + canvas.height * action.startY };
      const end = { x: canvas.x + canvas.width * action.endX, y: canvas.y + canvas.height * action.endY };
      await session.cdp.command('Input.dispatchMouseEvent', { type: 'mouseMoved', ...start, button: 'none' });
      await session.cdp.command('Input.dispatchMouseEvent', { type: 'mousePressed', ...start, button: 'left', buttons: 1, clickCount: 1 });
      let releaseRequired = true;
      try {
        const steps = 8;
        const stepDelay = Math.max(1, Math.floor(action.durationMs / steps));
        for (let index = 1; index <= steps; index += 1) {
          const progress = index / steps;
          await session.cdp.command('Input.dispatchMouseEvent', { type: 'mouseMoved',
            x: start.x + (end.x - start.x) * progress, y: start.y + (end.y - start.y) * progress,
            button: 'left', buttons: 1 });
          await new Promise((resolve) => setTimeout(resolve, stepDelay));
        }
      } finally {
        if (releaseRequired) {
          releaseRequired = false;
          await session.cdp.command('Input.dispatchMouseEvent', { type: 'mouseReleased', ...end, button: 'left', clickCount: 1 });
        }
      }
    }
  }
}

export async function interactPreview(instance, input) {
  const session = await sessionFor(instance, input.previewSessionId);
  const actions = validatePreviewActions(input.actions);
  const assertions = validatePreviewAssertions(input.assertions || []);
  if (input.coverage !== undefined && typeof input.coverage !== 'boolean') throw failure('PREVIEW_COVERAGE_OPTION_INVALID');
  const collectCoverage = input.coverage === true;
  let coverageStarted = false;
  const sequenceBefore = session.consoleSequence;
  const actionResults = [];
  try {
    if (collectCoverage) {
      await session.cdp.command('Profiler.enable', {});
      await session.cdp.command('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
      coverageStarted = true;
    }
    await session.cdp.command('Page.bringToFront', {});
    for (const action of actions) {
      if (input.cancelled?.()) throw failure('PREVIEW_ACTION_CANCELLED');
      const observation = await performAction(session, action);
      actionResults.push({ ...action, applied: observation ? observation.applied : true,
        ...(observation ? { observation } : {}) });
    }
    await new Promise((resolve) => setTimeout(resolve, Math.max(100, Math.min(input.settleMs || 350, 3000))));
    session.page = await evaluate(session, PAGE_SNAPSHOT_EXPRESSION);
    const results = [];
    for (const assertion of assertions) {
      if (assertion.type === 'no-errors') {
        const newErrors = session.console.filter((entry) => entry.level === 'error' && entry.sequence > sequenceBefore);
        results.push({ type: assertion.type, pass: newErrors.length === 0, actual: newErrors.slice(-10) });
      } else if (assertion.type === 'console-contains') {
        const hit = session.console.find((entry) => entry.sequence > sequenceBefore && entry.text.includes(assertion.text));
        results.push({ type: assertion.type, expected: assertion.text, pass: !!hit, actual: hit || null });
      } else {
        const actual = await evaluate(session, assertionExpression(assertion));
        results.push({ ...assertion, ...actual });
      }
    }
    let coverage;
    if (collectCoverage) {
      const raw = await session.cdp.command('Profiler.takePreciseCoverage', {});
      coverage = normalizePreviewCoverage(raw.result, new URL(session.previewUrl).origin);
    }
    return { previewSessionId: session.previewSessionId, instanceId: session.instanceId, projectRoot: session.projectRoot,
      sceneUuid: session.sceneUuid, navigationCount: session.navigationCount, actions: actionResults,
      assertions: results, passed: results.every((item) => item.pass) && actionResults.every((item) => item.applied), page: session.page,
      consoleSequence: session.consoleSequence, newErrors: session.console.filter((entry) => entry.sequence > sequenceBefore && entry.level === 'error').slice(-20),
      ...(coverage ? { coverage } : {}) };
  } finally {
    if (coverageStarted) {
      try { await session.cdp.command('Profiler.stopPreciseCoverage', {}); } catch (_) {}
      try { await session.cdp.command('Profiler.disable', {}); } catch (_) {}
    }
  }
}

export function previewTestExpression(source, input, testIds, timeoutMs) {
  const sourceLiteral = JSON.stringify(source);
  const inputLiteral = JSON.stringify(input);
  const idsLiteral = JSON.stringify(testIds);
  const harnessSource = createPreviewTestHarness.toString();
  return `(() => {
    const input = ${inputLiteral};
    const selectedIds = ${idsLiteral};
    const cc = window.cc;
    if (!cc) throw new Error('PREVIEW_CREATOR_RUNTIME_UNAVAILABLE');
    const context = Object.freeze({ cc, input });
    const CreatorTest = (${harnessSource})(selectedIds, ${timeoutMs}, ${MAX_PREVIEW_TEST_RESULT_BYTES}, context);
    const run = new Function('cc', 'input', 'CreatorTest', '"use strict";\\n' + ${sourceLiteral});
    return Promise.resolve().then(() => run(cc, input, CreatorTest)).then((result) => {
      if (!CreatorTest.isReport(result)) throw new Error('PREVIEW_TEST_REPORT_NOT_FROM_HARNESS');
      return result;
    });
  })()`;
}

function validatePreviewTestReport(report, selectedIds) {
  if (!report || report.schemaVersion !== 1 || typeof report.requiresManualReview !== 'boolean'
    || !Array.isArray(report.tests) || report.tests.length !== selectedIds.length)
    throw failure('PREVIEW_TEST_REPORT_INVALID');
  const seen = new Set();
  for (const test of report.tests) {
    if (!test || typeof test.id !== 'string' || !selectedIds.includes(test.id) || seen.has(test.id)
      || typeof test.name !== 'string' || !['passed', 'failed', 'skipped'].includes(test.status)
      || !Number.isFinite(test.durationMs) || test.durationMs < 0 || typeof test.message !== 'string')
      throw failure('PREVIEW_TEST_REPORT_INVALID');
    seen.add(test.id);
  }
  if (seen.size !== selectedIds.length || selectedIds.some((id) => !seen.has(id)))
    throw failure('PREVIEW_TEST_CASE_RESULTS_MISMATCH');
  if (Buffer.byteLength(JSON.stringify(report), 'utf8') > MAX_PREVIEW_TEST_RESULT_BYTES)
    throw failure('PREVIEW_TEST_RESULT_TOO_LARGE');
  return report;
}

export async function testPreviewScript(instance, input) {
  if (input.cancelled?.()) throw failure('PREVIEW_ACTION_CANCELLED');
  const session = await sessionFor(instance, input.previewSessionId);
  const selectedIds = input.testIds;
  if (!Array.isArray(selectedIds) || !selectedIds.length || selectedIds.length > MAX_PREVIEW_TEST_CASES_PER_RUN
    || selectedIds.some((id) => typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(id))
    || new Set(selectedIds).size !== selectedIds.length) throw failure('PREVIEW_TEST_SELECTION_INVALID');
  const timeoutMs = input.timeoutMs === undefined ? MAX_PREVIEW_TEST_TIMEOUT_MS : input.timeoutMs;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > MAX_PREVIEW_TEST_TIMEOUT_MS)
    throw failure('PREVIEW_TEST_TIMEOUT_INVALID');
  const testInput = input.input === undefined ? {} : input.input;
  if (!testInput || typeof testInput !== 'object' || Array.isArray(testInput)
    || Buffer.byteLength(JSON.stringify(testInput), 'utf8') > MAX_PREVIEW_TEST_INPUT_BYTES)
    throw failure('PREVIEW_TEST_INPUT_INVALID');
  const source = readPreviewTestSource(session.projectRoot, input.scriptPath);
  if (source.sha256 !== input.sourceSha256) throw failure('PREVIEW_TEST_SOURCE_CHANGED');
  const before = await evaluate(session, PAGE_SNAPSHOT_EXPRESSION);
  if (!before?.ready || before.sceneName !== session.sceneName || before.sceneUuid !== session.sceneUuid
    || !before.url || new URL(before.url).origin !== new URL(session.previewUrl).origin)
    throw failure('PREVIEW_SCENE_IDENTITY_MISMATCH');

  const sequenceBefore = session.consoleSequence;
  let coverageStarted = false;
  let executionDispatched = false;
  let executionUncertain = false;
  let report;
  let coverage;
  let cancellationTimer;
  try {
    if (input.coverage === true) {
      await session.cdp.command('Profiler.enable', {});
      await session.cdp.command('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
      coverageStarted = true;
    }
    executionDispatched = true;
    const evaluation = evaluate(session, previewTestExpression(source.source, testInput, selectedIds, timeoutMs), timeoutMs + 1500);
    const cancellation = new Promise((resolve, reject) => {
      cancellationTimer = setInterval(() => {
        if (input.cancelled?.()) reject(failure('PREVIEW_TEST_CANCELLED_AFTER_DISPATCH'));
      }, 50);
    });
    const value = await Promise.race([evaluation, cancellation]);
    clearInterval(cancellationTimer);
    cancellationTimer = undefined;
    report = validatePreviewTestReport(value, selectedIds);
    const current = readPreviewTestSource(session.projectRoot, input.scriptPath);
    if (current.sha256 !== source.sha256) throw failure('PREVIEW_TEST_SOURCE_CHANGED_DURING_RUN');
    const after = await evaluate(session, PAGE_SNAPSHOT_EXPRESSION);
    if (!after?.ready || after.sceneName !== session.sceneName || after.sceneUuid !== session.sceneUuid
      || !after.url || new URL(after.url).origin !== new URL(session.previewUrl).origin)
      throw failure('PREVIEW_TEST_SCENE_IDENTITY_CHANGED');
    session.page = after;
    if (coverageStarted) {
      const raw = await session.cdp.command('Profiler.takePreciseCoverage', {});
      coverage = normalizePreviewCoverage(raw.result, new URL(session.previewUrl).origin);
    }
  } catch (error) {
    executionUncertain = executionDispatched;
    clearInterval(cancellationTimer);
    if (executionUncertain) {
      await closeOwnedBrowser(session);
      sessions.delete(session.previewSessionId);
    }
    throw failure(executionUncertain ? 'PREVIEW_TEST_EXECUTION_UNCONFIRMED' : (error.code || 'PREVIEW_TEST_FAILED'),
      error.code || error.message);
  } finally {
    if (coverageStarted && !executionUncertain) {
      try { await session.cdp.command('Profiler.stopPreciseCoverage', {}); } catch (_) {}
      try { await session.cdp.command('Profiler.disable', {}); } catch (_) {}
    }
  }

  const result = { previewSessionId: session.previewSessionId, instanceId: session.instanceId,
    projectRoot: session.projectRoot, creatorSessionId: session.creatorSessionId, sceneName: session.sceneName,
    sceneUuid: session.sceneUuid, sceneAssetIdentity: session.sceneAssetIdentity || null,
    navigationCount: session.navigationCount, scriptPath: source.projectPath, sourceSha256: source.sha256,
    tests: report.tests, requiresManualReview: report.requiresManualReview,
    consoleSequence: session.consoleSequence,
    newErrors: session.console.filter((entry) => entry.sequence > sequenceBefore && entry.level === 'error').slice(-20),
    ...(coverage ? { coverage } : {}) };
  if (report.requiresManualReview) {
    await closeOwnedBrowser(session);
    sessions.delete(session.previewSessionId);
    result.browserTerminatedForManualReview = true;
  }
  return result;
}

export async function refreshPreview(instance, input) {
  if (input.cancelled?.()) throw failure('PREVIEW_ACTION_CANCELLED');
  const session = await sessionFor(instance, input.previewSessionId);
  const sceneAssetVerification = waitForServedSceneAsset(session);
  await session.cdp.command('Page.reload', { ignoreCache: false });
  session.sceneAssetIdentity = await sceneAssetVerification;
  session.page = await waitForRuntime(session, 30000, input.cancelled || (() => false));
  return { ...publicSession(session), page: session.page, refreshed: true };
}

async function closeOwnedBrowser(session) {
  try { session.cdp?.close(); } catch (_) {}
  if (session.browser && session.browser.exitCode === null && session.browser.signalCode === null) {
    try { session.browser.kill('SIGTERM'); } catch (_) {}
    await new Promise((resolve) => {
      const timeout = setTimeout(() => { try { session.browser.kill('SIGKILL'); } catch (_) {} resolve(); }, 2500);
      session.browser.once('exit', () => { clearTimeout(timeout); resolve(); });
    });
  }
  try {
    const root = fs.realpathSync(SESSION_ROOT);
    const profile = path.join(SESSION_ROOT, session.previewSessionId);
    const real = fs.realpathSync(profile);
    if (real.startsWith(`${root}${path.sep}`)) fs.rmSync(real, { recursive: true, force: true });
  } catch (_) {}
}

export async function stopPreview(instance, input) {
  const session = await sessionFor(instance, input.previewSessionId, { allowExited: true });
  await closeOwnedBrowser(session);
  sessions.delete(session.previewSessionId);
  return { previewSessionId: session.previewSessionId, instanceId: session.instanceId,
    projectRoot: session.projectRoot, stopped: true, creatorPreviewServerStopped: false };
}

export async function stopAllPreviews() {
  await Promise.allSettled([...sessions.values()].map((session) => closeOwnedBrowser(session)));
  sessions.clear();
}

export async function stopInstancePreviews(instanceId, creatorSessionId) {
  const owned = [...sessions.values()].filter((session) => session.instanceId === instanceId
    && (!creatorSessionId || session.creatorSessionId === creatorSessionId));
  await Promise.allSettled(owned.map(async (session) => {
    await closeOwnedBrowser(session);
    sessions.delete(session.previewSessionId);
  }));
}

export function previewCommand(command, instance, input, cancelled = () => false) {
  if (cancelled()) throw failure('PREVIEW_ACTION_CANCELLED');
  const scopedInput = { ...input, cancelled };
  switch (command) {
    case 'creator.preview.observe': return observePreview(instance, input);
    case 'creator.preview.screenshot': return screenshotPreview(instance, input);
    case 'creator.preview.interact': return interactPreview(instance, scopedInput);
    case 'creator.preview.test-script': return testPreviewScript(instance, scopedInput);
    case 'creator.preview.refresh': return refreshPreview(instance, scopedInput);
    case 'creator.preview.stop': return stopPreview(instance, input);
    default: throw failure('PREVIEW_COMMAND_UNKNOWN');
  }
}

export function hasPreviewSession(instanceId, creatorSessionId) {
  return [...sessions.values()].some((session) => session.instanceId === instanceId && session.creatorSessionId === creatorSessionId);
}
