'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const WebSocket = require('./vendor/ws');

const PREVIEW_URL = 'http://127.0.0.1:7456/';
const CHROME_CANDIDATES = [
    process.env.COCOS_AGENT_CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
].filter(Boolean);
const MAX_EVENTS = 24;
const MAX_EVENT_TEXT = 1200;

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function chromePath() { return CHROME_CANDIDATES.find((filename) => fs.existsSync(filename)) || null; }

function validSceneName(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value); }
function validSceneUuid(value) { return typeof value === 'string' && /^[0-9a-fA-F-]{36}$/.test(value); }
function validNodePath(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= 240
        && !value.includes('\\') && !value.includes('//')
        && value.split('/').every((part) => /^[A-Za-z0-9_ -]{1,64}$/.test(part));
}

function sanitizeText(value) {
    return String(value || '')
        .replace(/\b(?:sk|key|token)-[A-Za-z0-9_-]{12,}\b/gi, '[REDACTED]')
        .replace(/\bBearer\s+\S+/gi, 'Bearer [REDACTED]')
        .replace(/\/Users\/[^/\s]+/g, '[USER]')
        .replace(/[A-Za-z]:\\Users\\[^\\\s]+/g, '[USER]')
        .slice(0, MAX_EVENT_TEXT);
}

function targetExpression(expectedScene, expectedSceneUuid, nodePath) {
    const expected = JSON.stringify(expectedScene || null);
    const expectedUuid = JSON.stringify(expectedSceneUuid || null);
    const parts = JSON.stringify(nodePath ? nodePath.split('/') : null);
    return `(function(){
      if(typeof cc==='undefined'||!cc.director)return null;
      var scene=cc.director.getScene();if(!scene)return null;
      var canvas=document.querySelector('#GameCanvas')||document.querySelector('canvas');
      var rect=canvas&&canvas.getBoundingClientRect();
      var result={sceneName:scene.name||'',sceneUuid:scene._id||scene.uuid||null,frameCount:cc.director.getTotalFrames(),paused:cc.director.isPaused(),
        canvas:canvas&&rect?{width:Math.round(rect.width),height:Math.round(rect.height),x:Math.max(0,rect.x),y:Math.max(0,rect.y)}:null};
      var expected=${expected};if(expected&&result.sceneName!==expected)return {sceneMismatch:true,actualScene:result.sceneName};
      var expectedUuid=${expectedUuid};if(expectedUuid&&result.sceneUuid!==expectedUuid)return {sceneUuidMismatch:true,actualSceneUuid:result.sceneUuid};
      var parts=${parts};if(parts){
        if(parts[0]!==result.sceneName)return {nodeStatus:'scene-path-mismatch',...result};
        var node=scene;
        for(var i=1;i<parts.length;i++){var found=(node.children||[]).filter(function(child){return child.name===parts[i];});
          if(found.length!==1)return {nodeStatus:found.length?'ambiguous':'not-found',...result};node=found[0];}
        var components=(node._components||[]).map(function(component){
          var id=cc.js.getClassName(component);var item={classId:id,enabled:component.enabled};
          if(id==='cc.Label')item.text=String(component.string||'').slice(0,256);
          if(id==='cc.Sprite')item.spriteFrameUuid=component.spriteFrame&&component.spriteFrame._uuid||null;
          if(id==='cc.Button')item.interactable=!!component.interactable;
          return item;
        });
        result.targetNode={path:parts.join('/'),uuid:node.uuid,name:node.name,active:node.active,
          position:{x:node.x,y:node.y},components:components};result.nodeStatus='found';
      }
      return result;
    })()`;
}

function eventText(event) {
    const args = Array.isArray(event.args) ? event.args : [];
    const text = args.map((arg) => {
        if (arg && typeof arg.value === 'string') return arg.value;
        if (arg && arg.value !== undefined) return JSON.stringify(arg.value);
        return arg && (arg.description || arg.unserializableValue || arg.type) || '';
    }).filter(Boolean).join(' ');
    return sanitizeText(text || event.type || 'Console event');
}

function locationFromStack(stack) {
    const frame = stack && Array.isArray(stack.callFrames) ? stack.callFrames[0] : null;
    if (!frame) return undefined;
    const resource = String(frame.url || '').split(/[/?#]/).filter(Boolean).pop() || 'runtime';
    return { resource: sanitizeText(resource).slice(0, 100), line: Number.isInteger(frame.lineNumber) ? frame.lineNumber + 1 : null };
}

function addBounded(list, item) { if (list.length < MAX_EVENTS) list.push(item); }

async function observeRuntime(input, options = {}) {
    const expectedScene = input && input.expectedScene;
    const expectedSceneUuid = input && input.expectedSceneUuid;
    const nodePath = input && input.nodePath;
    const timeoutMs = input && input.timeoutMs !== undefined ? input.timeoutMs : 20000;
    if (!input || typeof input !== 'object' || !validSceneName(expectedScene) || !validSceneUuid(expectedSceneUuid)
        || (nodePath !== undefined && !validNodePath(nodePath))
        || !Number.isInteger(timeoutMs) || timeoutMs < 3000 || timeoutMs > 30000) {
        return { success: false, error: { code: 'INVALID_RUNTIME_OBSERVATION_INPUT' } };
    }
    const executable = options.chromePath || chromePath();
    if (!executable) return { success: false, error: { code: 'CHROME_NOT_FOUND' } };
    const fetchImpl = options.fetch || fetch;
    const previewDeadline = Date.now() + Math.min(timeoutMs, 10000);
    let previewReady = false;
    let previewStatus = null;
    while (Date.now() < previewDeadline) {
        try {
            const response = await fetchImpl(PREVIEW_URL, { signal: AbortSignal.timeout(750) });
            previewStatus = response.status;
            if (response.ok) { previewReady = true; break; }
        } catch (_) { /* Creator may still be starting its preview server. */ }
        await delay(150);
    }
    if (!previewReady) return { success: false, error: { code: 'PREVIEW_SERVER_UNAVAILABLE',
        ...(previewStatus ? { statusCode: previewStatus } : {}),
        message: 'Creator 2.4.15 Web preview is not reachable on 127.0.0.1:7456.' } };

    const profile = fs.mkdtempSync(path.join(options.tempRoot || os.tmpdir(), 'cocos-agent-runtime-observe-'));
    const spawnImpl = options.spawn || spawn;
    const socketApi = options.WebSocket || WebSocket;
    const child = spawnImpl(executable, ['--headless=new', '--no-first-run', '--no-default-browser-check',
        '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--remote-allow-origins=*',
        '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,800', 'about:blank'], { stdio: 'ignore' });
    let socket = null;
    let nextId = 0;
    const pending = new Map();
    const errors = [];
    const warnings = [];
    const logs = [];
    const now = Date.now;
    const stopAt = now() + timeoutMs;
    let childExited = false;
    child.once('exit', () => { childExited = true; });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
        if (!socket || socket.readyState !== socketApi.OPEN) { reject(new Error('PREVIEW_CDP_DISCONNECTED')); return; }
        const id = ++nextId;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP_TIMEOUT_${method}`)); }, 10000);
        pending.set(id, (message) => { clearTimeout(timer); message.error ? reject(new Error(message.error.message)) : resolve(message.result || {}); });
        socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async (expression) => {
        const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout: 5000 });
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'PREVIEW_EVALUATION_FAILED');
        return result.result && result.result.value;
    };
    try {
        let port = null;
        while (now() < stopAt && !childExited) {
            const marker = path.join(profile, 'DevToolsActivePort');
            if (fs.existsSync(marker)) { port = Number(fs.readFileSync(marker, 'utf8').split('\n')[0]); if (port) break; }
            await delay(50);
        }
        if (!port) return { success: false, error: { code: childExited ? 'CHROME_EXITED' : 'CHROME_DEVTOOLS_NOT_READY' } };

        let page = null;
        while (now() < stopAt && !childExited) {
            try {
                const response = await fetchImpl(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) });
                const pages = await response.json();
                page = pages.find((item) => item.type === 'page' && item.url === 'about:blank');
                if (page) break;
            } catch (_) { /* DevTools is still starting. */ }
            await delay(50);
        }
        if (!page) return { success: false, error: { code: 'PREVIEW_PAGE_NOT_FOUND' } };
        socket = new socketApi(page.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
        socket.on('message', (raw) => {
            let message;
            try { message = JSON.parse(raw.toString()); } catch (_) { return; }
            if (message.id && pending.has(message.id)) { const settle = pending.get(message.id); pending.delete(message.id); settle(message); return; }
            if (message.method === 'Runtime.exceptionThrown') {
                const details = message.params && message.params.exceptionDetails || {};
                addBounded(errors, { source: 'uncaught-exception', message: sanitizeText(details.exception && details.exception.description || details.text || 'Uncaught exception'),
                    location: locationFromStack(details.stackTrace) });
            } else if (message.method === 'Runtime.consoleAPICalled') {
                const params = message.params || {};
                const level = params.type === 'warning' ? 'warning' : params.type === 'error' || params.type === 'assert' ? 'error' : 'log';
                const item = { source: 'console', level, message: eventText(params), location: locationFromStack(params.stackTrace) };
                if (level === 'error') addBounded(errors, item);
                else if (level === 'warning') addBounded(warnings, item);
                else addBounded(logs, item);
            } else if (message.method === 'Log.entryAdded') {
                const entry = message.params && message.params.entry || {};
                const item = { source: 'browser', level: entry.level || 'error', message: sanitizeText(entry.text || 'Browser runtime error'),
                    ...(entry.url ? { location: { resource: String(entry.url).split(/[/?#]/).filter(Boolean).pop() } } : {}) };
                if (entry.level === 'warning') addBounded(warnings, item);
                else if (entry.level === 'error') addBounded(errors, item);
            }
        });
        await send('Runtime.enable');
        await send('Log.enable');
        await send('Page.enable');
        await send('Page.navigate', { url: PREVIEW_URL });

        let first = null;
        while (now() < stopAt && !childExited) {
            first = await evaluate(targetExpression(expectedScene, expectedSceneUuid, nodePath));
            if (first && first.sceneMismatch) {
                return { success: false, error: { code: 'PREVIEW_SCENE_MISMATCH', expectedScene, actualScene: first.actualScene || null } };
            }
            if (first && first.sceneUuidMismatch) {
                return { success: false, error: { code: 'PREVIEW_SCENE_IDENTITY_MISMATCH', expectedSceneUuid,
                    actualSceneUuid: first.actualSceneUuid || null } };
            }
            if (first && typeof first.sceneName === 'string' && first.sceneName === expectedScene
                && Number.isInteger(first.frameCount) && first.canvas && first.canvas.width > 0 && first.canvas.height > 0) break;
            await delay(150);
        }
        if (!first || first.sceneName !== expectedScene || first.sceneUuid !== expectedSceneUuid || !first.canvas) {
            return { success: false, error: { code: childExited ? 'CHROME_EXITED' : 'PREVIEW_RUNTIME_TIMEOUT', expectedScene } };
        }
        await delay(Math.min(700, Math.max(300, timeoutMs / 20)));
        const second = await evaluate(targetExpression(expectedScene, expectedSceneUuid, nodePath));
        if (!second || second.sceneName !== expectedScene || second.sceneUuid !== expectedSceneUuid) {
            return { success: false, error: { code: 'PREVIEW_SCENE_CHANGED', expectedScene, expectedSceneUuid } };
        }
        const frameDelta = Math.max(0, second.frameCount - first.frameCount);
        const runtimeStatus = second.paused ? 'paused' : frameDelta > 0 ? 'running' : 'stalled';
        const rect = second.canvas;
        const clip = { x: rect.x, y: rect.y, width: Math.min(rect.width, 1280), height: Math.min(rect.height, 720), scale: 1 };
        let screenshotBase64 = null;
        let screenshotError = null;
        try {
            const screenshot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 55, fromSurface: true,
                captureBeyondViewport: true, clip });
            screenshotBase64 = typeof screenshot.data === 'string' ? screenshot.data : null;
            if (!screenshotBase64) screenshotError = 'SCREENSHOT_DATA_MISSING';
        } catch (_) { screenshotError = 'SCREENSHOT_CAPTURE_FAILED'; }
        const status = errors.length ? 'runtime-error' : runtimeStatus;
        return {
            success: true, outcome: 'observed', creatorVersion: '2.4.15', previewUrl: PREVIEW_URL,
            observedAt: new Date().toISOString(), scene: { name: second.sceneName, uuid: second.sceneUuid, matchesExpected: true },
            runtime: { status, frameCount: second.frameCount, frameDelta, paused: second.paused,
                capturedErrorCount: errors.length },
            diagnostics: { errors, warnings, logs, truncated: { errors: errors.length === MAX_EVENTS,
                warnings: warnings.length === MAX_EVENTS, logs: logs.length === MAX_EVENTS } },
            ...(second.targetNode ? { targetNode: second.targetNode, targetNodeStatus: second.nodeStatus } : {}),
            screenshot: { available: !!screenshotBase64, mimeType: screenshotBase64 ? 'image/jpeg' : null,
                width: clip.width, height: clip.height, ...(screenshotError ? { error: screenshotError } : {}) },
            ...(screenshotBase64 ? { screenshotBase64 } : {}),
        };
    } catch (error) {
        return { success: false, error: { code: String(error && error.message || error).startsWith('CDP_TIMEOUT_') ? 'PREVIEW_CDP_TIMEOUT' : 'PREVIEW_OBSERVATION_FAILED' } };
    } finally {
        if (socket && socket.readyState === socketApi.OPEN) socket.close();
        try { child.kill(); } catch (_) {}
        if (child.exitCode === null) await Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(1500)]);
        for (const settle of pending.values()) { try { settle({ error: { message: 'PREVIEW_CLOSED' } }); } catch (_) {} }
        fs.rmSync(profile, { recursive: true, force: true });
    }
}

module.exports = { observeRuntime, targetExpression, sanitizeText, validNodePath, validSceneName, validSceneUuid, PREVIEW_URL };
