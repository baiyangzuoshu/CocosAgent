'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const WebSocket = require('./vendor/ws');
const { discoverBrowser } = require('./browser-discovery');

const PREVIEW_URL = 'http://127.0.0.1:7456/';
const MAX_EVENTS = 24;
const MAX_EVENT_TEXT = 1200;

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function validSceneName(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value); }
function validSceneUuid(value) { return typeof value === 'string' && /^[0-9a-fA-F-]{36}$/.test(value); }
function validNodePath(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= 240
        && !value.includes('\\') && !value.includes('//')
        && value.split('/').every((part) => /^[A-Za-z0-9_ -]{1,64}$/.test(part));
}

function validPreviewUrl(value) {
    try {
        const url = new URL(value || PREVIEW_URL);
        return url.protocol === 'http:' && url.hostname === '127.0.0.1'
            && Number.isInteger(Number(url.port)) && Number(url.port) >= 1 && Number(url.port) <= 65535
            && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash;
    } catch (_) { return false; }
}

function sanitizeText(value) {
    return String(value || '')
        .replace(/\b(?:sk|key|token)-[A-Za-z0-9_-]{12,}\b/gi, '[REDACTED]')
        .replace(/\bBearer\s+\S+/gi, 'Bearer [REDACTED]')
        .replace(/\/Users\/[^/\s]+/g, '[USER]')
        .replace(/[A-Za-z]:\\Users\\[^\\\s]+/g, '[USER]')
        .slice(0, MAX_EVENT_TEXT);
}

function targetExpression(expectedScene, expectedSceneUuid, nodePath, previewUrl = PREVIEW_URL, assertionPaths = []) {
    const expected = JSON.stringify(expectedScene || null);
    const expectedUuid = JSON.stringify(expectedSceneUuid || null);
    const parts = JSON.stringify(nodePath ? nodePath.split('/') : null);
    const assertionTargets = JSON.stringify([...new Set(assertionPaths)]);
    return `(function(){
      if(location.origin!==${JSON.stringify(new URL(previewUrl).origin)}||location.pathname!=='/')return {pageMismatch:true};
      if(typeof cc==='undefined'||!cc.director)return null;
      var scene=cc.director.getScene();if(!scene)return null;
      var canvas=document.querySelector('#GameCanvas')||document.querySelector('canvas');
      var rect=canvas&&canvas.getBoundingClientRect();
      var result={sceneName:scene.name||'',sceneUuid:scene._id||scene.uuid||null,frameCount:cc.director.getTotalFrames(),paused:cc.director.isPaused(),
        canvas:canvas&&rect?{width:Math.round(rect.width),height:Math.round(rect.height),x:Math.max(0,rect.x),y:Math.max(0,rect.y)}:null};
      var expected=${expected};if(expected&&result.sceneName!==expected)return {sceneMismatch:true,actualScene:result.sceneName};
      var expectedUuid=${expectedUuid};if(expectedUuid&&result.sceneUuid!==expectedUuid)return {sceneUuidMismatch:true,actualSceneUuid:result.sceneUuid};
      var parts=${parts};var assertionTargets=${assertionTargets};
      function inspectNode(nodeParts){
        if(nodeParts[0]!==result.sceneName)return {status:'scene-path-mismatch'};
        var node=scene;
        for(var i=1;i<nodeParts.length;i++){var found=(node.children||[]).filter(function(child){return child.name===nodeParts[i];});
          if(found.length!==1)return {status:found.length?'ambiguous':'not-found'};node=found[0];}
        var rawComponents=node._components||[];var components=rawComponents.slice(0,32).map(function(component){
          var id=cc.js.getClassName(component);var item={classId:id,enabled:component.enabled};
          if(id==='cc.Label')item.text=String(component.string||'').slice(0,256);
          if(id==='cc.Sprite')item.spriteFrameUuid=component.spriteFrame&&component.spriteFrame._uuid||null;
          if(id==='cc.Button')item.interactable=!!component.interactable;
          return item;
        });
        return {status:'found',node:{path:nodeParts.join('/'),uuid:node.uuid,name:node.name,active:node.active,
          position:{x:node.x,y:node.y},components:components,componentsTruncated:rawComponents.length>32}};
      }
      if(parts){var inspected=inspectNode(parts);result.nodeStatus=inspected.status;if(inspected.node)result.targetNode=inspected.node;}
      if(assertionTargets.length){result.assertionNodes={};assertionTargets.forEach(function(targetPath){var inspected=inspectNode(targetPath.split('/'));
        result.assertionNodes[targetPath]=inspected.node?inspected.node:{status:inspected.status};});}
      return result;
    })()`;
}

const ASSERTION_FIELDS = new Set(['node.active', 'node.x', 'node.y', 'label.text', 'button.interactable', 'sprite.spriteFrameUuid']);
function validInteraction(interaction, session) {
    if (!interaction || typeof interaction !== 'object' || Array.isArray(interaction)
        || Object.keys(interaction).some((key) => !['interactionId', 'sessionId', 'pageId', 'pageGeneration', 'sceneName',
            'sceneUuid', 'previewUrl', 'observationIndex', 'action', 'before', 'after', 'noNewConsoleErrors', 'settleMs'].includes(key))) return false;
    if (typeof interaction.interactionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(interaction.interactionId)
        || interaction.sessionId !== session.id || interaction.pageId !== session.pageId
        || interaction.pageGeneration !== session.pageGeneration || interaction.observationIndex !== session.observationIndex
        || interaction.sceneName !== session.sceneName
        || interaction.sceneUuid !== session.sceneUuid || interaction.previewUrl !== session.previewUrl
        || !interaction.action || Object.keys(interaction.action).some((key) => !['type', 'x', 'y'].includes(key))
        || interaction.action.type !== 'pointer.click' || !Number.isInteger(interaction.action.x)
        || !Number.isInteger(interaction.action.y) || interaction.action.x < 0 || interaction.action.y < 0
        || interaction.action.x > 4096 || interaction.action.y > 4096
        || !Array.isArray(interaction.before) || interaction.before.length < 1 || interaction.before.length > 8
        || !Array.isArray(interaction.after) || interaction.after.length < 1 || interaction.after.length > 8
        || (interaction.noNewConsoleErrors !== undefined && interaction.noNewConsoleErrors !== true)
        || (interaction.settleMs !== undefined && (!Number.isInteger(interaction.settleMs) || interaction.settleMs < 0 || interaction.settleMs > 1500))) return false;
    return [...interaction.before, ...interaction.after].every((assertion) => assertion && typeof assertion === 'object'
        && Object.keys(assertion).length === 3 && Object.keys(assertion).every((key) => ['nodePath', 'field', 'equals'].includes(key))
        && validNodePath(assertion.nodePath) && ASSERTION_FIELDS.has(assertion.field)
        && (typeof assertion.equals === 'string' ? assertion.equals.length <= 256
            : typeof assertion.equals === 'boolean' || (typeof assertion.equals === 'number' && Number.isFinite(assertion.equals)
                && assertion.equals >= -100000 && assertion.equals <= 100000)));
}

function assertionValue(snapshot, assertion) {
    const target = snapshot && snapshot.assertionNodes && snapshot.assertionNodes[assertion.nodePath];
    if (!target || target.status !== 'found') return { available: false, reason: target && target.status || 'not-found' };
    if (assertion.field === 'node.active') return { available: true, value: target.active };
    if (assertion.field === 'node.x') return { available: true, value: target.position.x };
    if (assertion.field === 'node.y') return { available: true, value: target.position.y };
    const componentId = assertion.field === 'label.text' ? 'cc.Label'
        : assertion.field === 'button.interactable' ? 'cc.Button' : 'cc.Sprite';
    const components = target.components.filter((component) => component.classId === componentId);
    if (components.length !== 1) return { available: false, reason: components.length ? 'ambiguous-component' : 'component-not-found' };
    const property = assertion.field === 'label.text' ? 'text'
        : assertion.field === 'button.interactable' ? 'interactable' : 'spriteFrameUuid';
    return { available: true, value: components[0][property] === undefined ? null : components[0][property] };
}

function checkAssertions(snapshot, assertions) {
    return assertions.map((assertion) => {
        const actual = assertionValue(snapshot, assertion);
        return { ...assertion, passed: actual.available && actual.value === assertion.equals,
            ...(actual.available ? { actual: actual.value } : { unavailable: actual.reason }) };
    });
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

function addBounded(list, item) {
    if (list.length === MAX_EVENTS) { list.shift(); list.dropped = (list.dropped || 0) + 1; }
    list.push(item);
}

function previewPageUrl(value, previewUrl = PREVIEW_URL) {
    try { const url = new URL(value); return url.origin === new URL(previewUrl).origin && url.pathname === '/'; }
    catch (_) { return false; }
}

function localDebuggerUrl(value, port) {
    try { const url = new URL(value); return url.protocol === 'ws:' && url.hostname === '127.0.0.1'
        && Number(url.port) === port && /^\/devtools\/page\/[^/]+$/.test(url.pathname); }
    catch (_) { return false; }
}

async function closeRuntimeSession(session) {
    if (!session || session.closing) return session && session.closing;
    session.closed = true;
    session.closing = (async () => {
        if (session.send && session.socket && session.socket.readyState === WebSocket.OPEN) {
            await Promise.race([session.send('Browser.close').catch(() => {}), delay(800)]);
        }
        if (session.socket) { try { session.socket.close(); } catch (_) {} }
        if (session.child && session.child.exitCode === null && !session.childExited && !session.childError) {
            try { session.child.kill(); } catch (_) {}
            await Promise.race([new Promise((resolve) => session.child.once('exit', resolve)), delay(1500)]);
        }
        if (session.pending) {
            for (const settle of session.pending.values()) settle({ error: { message: 'PREVIEW_CLOSED' } });
            session.pending.clear();
        }
        // Delete only our own generated profile, and only after the browser exits.
        const profile = session.profile;
        if (profile && (!session.child || session.childError || session.childExited || session.child.exitCode !== null)) {
            try {
                if (path.dirname(profile) === session.tempRoot && /^cocos-agent-runtime-observe-[A-Za-z0-9]+$/.test(path.basename(profile))
                    && fs.realpathSync(profile) === profile) fs.rmSync(profile, { recursive: true, force: true });
            } catch (_) { /* Windows may retain a lock; never delete a wider directory. */ }
        }
    })();
    return session.closing;
}

async function observeRuntime(input, options = {}) {
    const expectedScene = input && input.expectedScene;
    const expectedSceneUuid = input && input.expectedSceneUuid;
    const nodePath = input && input.nodePath;
    const previewUrl = input && input.previewUrl || PREVIEW_URL;
    const timeoutMs = input && input.timeoutMs !== undefined ? input.timeoutMs : 20000;
    const interaction = input && input.interaction;
    const interactionPaths = interaction && Array.isArray(interaction.before) && Array.isArray(interaction.after)
        ? [...new Set([...interaction.before, ...interaction.after].filter((assertion) => assertion && typeof assertion.nodePath === 'string')
            .map((assertion) => assertion.nodePath))] : [];
    if (!input || typeof input !== 'object' || !validSceneName(expectedScene) || !validSceneUuid(expectedSceneUuid)
        || !validPreviewUrl(previewUrl)
        || (nodePath !== undefined && !validNodePath(nodePath))
        || !Number.isInteger(timeoutMs) || timeoutMs < 3000 || timeoutMs > 30000) {
        return { success: false, error: { code: 'INVALID_RUNTIME_OBSERVATION_INPUT' } };
    }
    const stopAt = Date.now() + timeoutMs;
    const session = options.session || { id: randomUUID(), persistent: false };
    if (interaction && (!validInteraction(interaction, session) || !session.persistent || !session.initialized
        || session.refreshRequested || session.requiresReload || session.sceneName !== expectedScene
        || session.sceneUuid !== expectedSceneUuid || session.previewUrl !== previewUrl)) {
        return { success: false, outcome: 'precondition-failed', inputDispatched: false,
            error: { code: 'PREVIEW_INTERACTION_SESSION_MISMATCH' } };
    }
    if (session.closed || session.childExited || session.disconnected) {
        return { success: false, error: { code: 'PREVIEW_SESSION_CLOSED', message: 'Approve runtime.preview.start to open a new Agent preview session.' } };
    }
    const executable = session.executable || options.chromePath || discoverBrowser({ deadline: stopAt });
    if (!executable) return { success: false, error: { code: Date.now() >= stopAt ? 'PREVIEW_RUNTIME_TIMEOUT' : 'CHROME_NOT_FOUND' } };
    const fetchImpl = options.fetch || fetch;
    const previewDeadline = Math.min(stopAt, Date.now() + 10000);
    let previewReady = false;
    let previewStatus = null;
    while (Date.now() < previewDeadline) {
        try {
            const response = await fetchImpl(previewUrl, { signal: AbortSignal.timeout(750) });
            previewStatus = response.status;
            if (response.ok) { previewReady = true; break; }
        } catch (_) { /* Creator may still be starting its preview server. */ }
        await delay(150);
    }
    if (!previewReady) return { success: false, error: { code: 'PREVIEW_SERVER_UNAVAILABLE',
        ...(previewStatus ? { statusCode: previewStatus } : {}),
        message: `Creator 2.4.15 Web preview is not reachable at ${previewUrl}.` } };
    if (session.closed || Date.now() >= stopAt) return { success: false, error: { code: session.closed ? 'PREVIEW_SESSION_CLOSED' : 'PREVIEW_RUNTIME_TIMEOUT' } };

    session.tempRoot = session.tempRoot || fs.realpathSync(options.tempRoot || os.tmpdir());
    const profile = session.profile || (session.profile = fs.mkdtempSync(path.join(session.tempRoot, 'cocos-agent-runtime-observe-')));
    const spawnImpl = options.spawn || spawn;
    const socketApi = options.WebSocket || WebSocket;
    if (!session.child) {
        try {
            session.executable = executable;
            session.child = spawnImpl(executable, [...(session.persistent ? ['--new-window'] : ['--headless=new']),
                '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
                '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
                `--user-data-dir=${profile}`, '--window-size=1280,800',
                ...(!session.persistent ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []), 'about:blank'],
            { stdio: 'ignore', windowsHide: true, shell: false });
        } catch (_) {
            await closeRuntimeSession(session);
            return { success: false, error: { code: 'CHROME_START_FAILED' } };
        }
        session.child.once('exit', () => { session.childExited = true; session.closed = true; });
        session.child.once('error', () => { session.childError = true; session.closed = true; });
    }
    let socket = session.socket || null;
    session.nextId = session.nextId || 0;
    const pending = session.pending || (session.pending = new Map());
    const errors = session.errors || (session.errors = []);
    const warnings = session.warnings || (session.warnings = []);
    const logs = session.logs || (session.logs = []);
    const pageErrors = session.pageErrors || (session.pageErrors = []);
    const now = Date.now;
    const send = (method, params = {}, requestTimeout = 10000) => new Promise((resolve, reject) => {
        if (!socket || socket.readyState !== socketApi.OPEN) { reject(new Error('PREVIEW_CDP_DISCONNECTED')); return; }
        const id = ++session.nextId;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP_TIMEOUT_${method}`)); },
            method === 'Browser.close' ? requestTimeout : Math.max(1, Math.min(requestTimeout, stopAt - now())));
        pending.set(id, (message) => { clearTimeout(timer); message.error ? reject(new Error(message.error.message)) : resolve(message.result || {}); });
        try { socket.send(JSON.stringify({ id, method, params })); }
        catch (error) { const settle = pending.get(id); pending.delete(id); settle({ error: { message: error.message } }); }
    });
    session.send = (method, params) => send(method, params, 1000);
    const evaluate = async (expression) => {
        const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout: 5000 });
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'PREVIEW_EVALUATION_FAILED');
        return result.result && result.result.value;
    };
    let dispatchedInteraction = null;
    try {
        if (!socket) {
            let port = null;
            while (now() < stopAt && !session.childExited && !session.childError) {
                const marker = path.join(profile, 'DevToolsActivePort');
                if (fs.existsSync(marker)) { port = Number(fs.readFileSync(marker, 'utf8').split('\n')[0]); if (Number.isInteger(port) && port > 0 && port <= 65535) break; port = null; }
                await delay(50);
            }
            if (!port) return { success: false, error: { code: session.childError ? 'CHROME_START_FAILED' : session.childExited ? 'CHROME_EXITED' : 'CHROME_DEVTOOLS_NOT_READY' } };

            let page = null;
            while (now() < stopAt && !session.childExited && !session.childError) {
                try {
                    const response = await fetchImpl(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) });
                    const pages = await response.json();
                    const matching = Array.isArray(pages) ? pages.filter((item) => item.type === 'page' && item.url === 'about:blank') : [];
                    page = matching.length === 1 ? matching[0] : null;
                    if (page) break;
                } catch (_) { /* DevTools is still starting. */ }
                await delay(50);
            }
            if (!page) return { success: false, error: { code: 'PREVIEW_PAGE_NOT_FOUND' } };
            if (!localDebuggerUrl(page.webSocketDebuggerUrl, port)) return { success: false, error: { code: 'PREVIEW_DEBUGGER_IDENTITY_MISMATCH' } };
            session.port = port;
            session.pageId = typeof page.id === 'string' ? page.id : new URL(page.webSocketDebuggerUrl).pathname.split('/').pop();
            socket = session.socket = new socketApi(page.webSocketDebuggerUrl);
            socket.on('error', () => { session.disconnected = true; });
            socket.on('close', () => {
                session.disconnected = true;
                for (const settle of pending.values()) settle({ error: { message: 'PREVIEW_CDP_DISCONNECTED' } });
                pending.clear();
            });
            await new Promise((resolve, reject) => {
                const timer = setTimeout(() => finish(new Error('CDP_TIMEOUT_CONNECT')), Math.max(1, Math.min(5000, stopAt - now())));
                const onOpen = () => finish();
                const onError = (error) => finish(error);
                const onClose = () => finish(new Error('PREVIEW_CDP_DISCONNECTED'));
                const finish = (error) => {
                    clearTimeout(timer); socket.removeListener('open', onOpen); socket.removeListener('error', onError); socket.removeListener('close', onClose);
                    error ? reject(error) : resolve();
                };
                socket.once('open', onOpen); socket.once('error', onError); socket.once('close', onClose);
            });
            socket.on('message', (raw) => {
                let message;
                try { message = JSON.parse(raw.toString()); } catch (_) { return; }
                if (message.id && pending.has(message.id)) { const settle = pending.get(message.id); pending.delete(message.id); settle(message); return; }
                if (message.method === 'Page.frameNavigated' && message.params && message.params.frame && !message.params.frame.parentId) {
                    session.pageGeneration = (session.pageGeneration || 0) + 1;
                    session.pageUrl = message.params.frame.url;
                    session.pageErrorCount = 0; pageErrors.length = 0; pageErrors.dropped = 0;
                    errors.length = 0; warnings.length = 0; logs.length = 0;
                    errors.dropped = 0; warnings.dropped = 0; logs.dropped = 0;
                    session.lastObservationAt = null;
                } else if (message.method === 'Runtime.exceptionThrown') {
                    const details = message.params && message.params.exceptionDetails || {};
                    const item = { source: 'uncaught-exception', message: sanitizeText(details.exception && details.exception.description || details.text || 'Uncaught exception'),
                        location: locationFromStack(details.stackTrace) };
                    addBounded(errors, item); addBounded(pageErrors, item); session.pageErrorCount = (session.pageErrorCount || 0) + 1;
                } else if (message.method === 'Runtime.consoleAPICalled') {
                    const params = message.params || {};
                    const level = params.type === 'warning' ? 'warning' : params.type === 'error' || params.type === 'assert' ? 'error' : 'log';
                    const item = { source: 'console', level, message: eventText(params), location: locationFromStack(params.stackTrace) };
                    if (level === 'error') { addBounded(errors, item); addBounded(pageErrors, item); session.pageErrorCount = (session.pageErrorCount || 0) + 1; }
                    else if (level === 'warning') addBounded(warnings, item);
                    else addBounded(logs, item);
                } else if (message.method === 'Log.entryAdded') {
                    const entry = message.params && message.params.entry || {};
                    const item = { source: 'browser', level: entry.level || 'error', message: sanitizeText(entry.text || 'Browser runtime error'),
                        ...(entry.url ? { location: { resource: sanitizeText(String(entry.url).split(/[/?#]/).filter(Boolean).pop()).slice(0, 100) } } : {}) };
                    if (entry.level === 'warning') addBounded(warnings, item);
                    else if (entry.level === 'error') { addBounded(errors, item); addBounded(pageErrors, item); session.pageErrorCount = (session.pageErrorCount || 0) + 1; }
                }
            });
            await send('Runtime.enable');
            await send('Log.enable');
            await send('Page.enable');
        }
        const reused = session.initialized === true;
        const navigated = !session.initialized || session.refreshRequested;
        if (navigated) {
            if (session.persistent) {
                errors.length = 0; warnings.length = 0; logs.length = 0;
                errors.dropped = 0; warnings.dropped = 0; logs.dropped = 0;
            }
            session.initialized = true;
            session.refreshRequested = false;
            session.awaitingNavigationGeneration = session.persistent ? (session.pageGeneration || 0) + 1 : null;
            const navigation = await send('Page.navigate', { url: previewUrl });
            if (navigation.errorText) throw new Error('PREVIEW_NAVIGATION_FAILED');
            session.lastObservationAt = null;
        } else {
            const response = await fetchImpl(`http://127.0.0.1:${session.port}/json/list`, { signal: AbortSignal.timeout(1000) });
            const pages = await response.json();
            const page = Array.isArray(pages) && pages.find((item) => item.type === 'page' && item.id === session.pageId);
            if (!page) return { success: false, error: { code: 'PREVIEW_SESSION_PAGE_CLOSED' } };
            if (!previewPageUrl(page.url, previewUrl)) return { success: false, error: { code: 'PREVIEW_SESSION_PAGE_NAVIGATED' } };
        }

        let first = null;
        while (now() < stopAt && !session.childExited) {
            if (session.awaitingNavigationGeneration && ((session.pageGeneration || 0) < session.awaitingNavigationGeneration
                || !previewPageUrl(session.pageUrl, previewUrl))) { await delay(50); continue; }
            first = await evaluate(targetExpression(expectedScene, expectedSceneUuid, nodePath, previewUrl, interactionPaths));
            if (first && first.pageMismatch) return { success: false, error: { code: 'PREVIEW_SESSION_PAGE_NAVIGATED' } };
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
            return { success: false, error: { code: session.childExited ? 'CHROME_EXITED' : 'PREVIEW_RUNTIME_TIMEOUT', expectedScene } };
        }
        session.awaitingNavigationGeneration = null;
        if (session.persistent && (navigated || session.titleGeneration !== (session.pageGeneration || 0))) {
            await evaluate(`(function(){if(location.origin===${JSON.stringify(new URL(previewUrl).origin)}
                &&cc.director.getScene()&&(cc.director.getScene()._id||cc.director.getScene().uuid)===${JSON.stringify(expectedSceneUuid)})
                document.title=${JSON.stringify(`CocosAgent 预览 · ${expectedScene}`)};})()`);
            session.titleGeneration = session.pageGeneration || 0;
            if (!reused) await send('Page.bringToFront');
        }
        const interactionStartedAt = interaction ? new Date().toISOString() : null;
        const pageErrorCountBefore = session.pageErrorCount || 0;
        let interactionResult = null;
        if (interaction) {
            const before = checkAssertions(first, interaction.before);
            if (before.some((item) => !item.passed)) {
                interactionResult = { interactionId: interaction.interactionId, outcome: 'precondition-failed', inputDispatched: false, before };
            } else if (interaction.action.x >= Math.min(first.canvas.width, 1280)
                || interaction.action.y >= Math.min(first.canvas.height, 720)) {
                interactionResult = { interactionId: interaction.interactionId, outcome: 'precondition-failed', inputDispatched: false,
                    before, error: 'INPUT_COORDINATE_OUTSIDE_CANVAS' };
            } else {
                const x = first.canvas.x + interaction.action.x;
                const y = first.canvas.y + interaction.action.y;
                let pressAttempted = false;
                try {
                    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' });
                    dispatchedInteraction = { interactionId: interaction.interactionId, inputDispatched: 'uncertain', action: interaction.action };
                    pressAttempted = true;
                    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
                    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
                    dispatchedInteraction = { interactionId: interaction.interactionId, inputDispatched: true, action: interaction.action };
                    interactionResult = { interactionId: interaction.interactionId, outcome: 'input-dispatched', inputDispatched: true,
                        action: interaction.action, canvas: { width: Math.min(first.canvas.width, 1280), height: Math.min(first.canvas.height, 720) }, before,
                        dispatchedAt: new Date().toISOString(), startedAt: interactionStartedAt };
                } catch (_) {
                    if (pressAttempted) await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y,
                        button: 'left', buttons: 0, clickCount: 1 }).catch(() => {});
                    session.interactionNeedsReview = true;
                    return { success: false, outcome: 'needs-review', interaction: { interactionId: interaction.interactionId,
                        inputDispatched: 'uncertain', action: interaction.action }, session: { id: session.id, pageId: session.pageId,
                        pageGeneration: session.pageGeneration, instanceId: session.instanceId },
                    error: { code: 'INPUT_DISPATCH_UNCERTAIN', message: 'Do not repeat this input. Observe the current session first.' } };
                }
            }
        }
        const pageGeneration = session.pageGeneration || 0;
        await delay(interaction ? (interaction.settleMs === undefined ? 300 : interaction.settleMs)
            : Math.min(700, Math.max(300, timeoutMs / 20)));
        const second = await evaluate(targetExpression(expectedScene, expectedSceneUuid, nodePath, previewUrl, interactionPaths));
        if (!second || second.sceneName !== expectedScene || second.sceneUuid !== expectedSceneUuid || !second.canvas
            || (session.pageGeneration || 0) !== pageGeneration) {
            if (dispatchedInteraction) session.interactionNeedsReview = true;
            return { success: false, outcome: dispatchedInteraction ? 'needs-review' : undefined,
                ...(dispatchedInteraction ? { interaction: dispatchedInteraction } : {}),
                error: { code: 'PREVIEW_SCENE_CHANGED', expectedScene, expectedSceneUuid } };
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
        const finalIdentity = await evaluate(targetExpression(expectedScene, expectedSceneUuid, undefined, previewUrl));
        if (!finalIdentity || finalIdentity.sceneName !== expectedScene || finalIdentity.sceneUuid !== expectedSceneUuid
            || (session.pageGeneration || 0) !== pageGeneration) {
            if (dispatchedInteraction) session.interactionNeedsReview = true;
            return { success: false, outcome: dispatchedInteraction ? 'needs-review' : undefined,
                ...(dispatchedInteraction ? { interaction: dispatchedInteraction } : {}),
                error: { code: 'PREVIEW_SCENE_CHANGED', expectedScene, expectedSceneUuid } };
        }
        const status = session.pageErrorCount ? 'runtime-error' : runtimeStatus;
        const observedAt = new Date().toISOString();
        if (interaction && interactionResult && interactionResult.inputDispatched === true) {
            const after = checkAssertions(second, interaction.after);
            const newConsoleErrorCount = Math.max(0, (session.pageErrorCount || 0) - pageErrorCountBefore);
            const consoleAssertion = interaction.noNewConsoleErrors === true
                ? [{ field: 'console.noNewErrors', expected: 0, actual: newConsoleErrorCount, passed: newConsoleErrorCount === 0 }] : [];
            const assertions = [...after, ...consoleAssertion];
            interactionResult = { ...interactionResult, outcome: assertions.every((item) => item.passed)
                ? 'assertions-passed' : 'assertions-failed', after: assertions,
                pageErrorCountBefore, pageErrorCountAfter: session.pageErrorCount || 0,
                observedAt };
        }
        const result = {
            success: true, outcome: interactionResult ? interactionResult.outcome : 'observed', creatorVersion: '2.4.15', previewUrl,
            observedAt, scene: { name: second.sceneName, uuid: second.sceneUuid, matchesExpected: true },
            session: { id: session.id, pageId: session.pageId, reused, visible: session.persistent === true,
                pageGeneration, observationIndex: (session.observationIndex || 0) + 1 },
            runtime: { status, frameCount: second.frameCount, frameDelta, paused: second.paused,
                capturedErrorCount: errors.length, pageErrorCount: session.pageErrorCount || 0 },
            diagnostics: { errors: [...errors], warnings: [...warnings], logs: [...logs],
                pageErrors: [...pageErrors], pageErrorsTruncated: !!pageErrors.dropped,
                since: session.lastObservationAt || 'page-start', until: observedAt,
                truncated: { errors: !!errors.dropped, warnings: !!warnings.dropped, logs: !!logs.dropped } },
            ...(second.targetNode ? { targetNode: second.targetNode, targetNodeStatus: second.nodeStatus } : {}),
            ...(interactionResult ? { interaction: interactionResult } : {}),
            screenshot: { available: !!screenshotBase64, mimeType: screenshotBase64 ? 'image/jpeg' : null,
                width: clip.width, height: clip.height, ...(screenshotError ? { error: screenshotError } : {}) },
            ...(screenshotBase64 ? { screenshotBase64 } : {}),
        };
        session.lastObservationAt = observedAt;
        session.observationIndex = result.session.observationIndex;
        errors.length = 0; warnings.length = 0; logs.length = 0;
        errors.dropped = 0; warnings.dropped = 0; logs.dropped = 0;
        return result;
    } catch (error) {
        if (dispatchedInteraction) {
            session.interactionNeedsReview = true;
            return { success: false, outcome: 'needs-review', interaction: dispatchedInteraction,
                error: { code: 'PREVIEW_INTERACTION_RESULT_UNCERTAIN', message: 'Do not repeat this input. Observe the current session first.' } };
        }
        return { success: false, error: { code: String(error && error.message || error).startsWith('CDP_TIMEOUT_') ? 'PREVIEW_CDP_TIMEOUT' : 'PREVIEW_OBSERVATION_FAILED' } };
    } finally {
        if (session.awaitingNavigationGeneration) session.requiresReload = true;
        if (!session.persistent) await closeRuntimeSession(session);
    }
}

function createRuntimeObserver(options = {}) {
    const sessions = new Map();
    const restarts = new Set();
    let closed = false;
    const key = (projectRoot) => {
        if (typeof projectRoot !== 'string' || !path.isAbsolute(projectRoot)) throw new Error('INVALID_RUNTIME_PROJECT_ROOT');
        return fs.realpathSync(projectRoot);
    };
    const killOnExit = () => {
        for (const session of sessions.values()) { try { session.child && session.child.kill(); } catch (_) {} }
    };
    process.once('exit', killOnExit);
    return {
        async observe(input) {
            if (closed) return { success: false, error: { code: 'PREVIEW_OBSERVER_CLOSED' } };
            let project;
            try { project = key(input && input.projectRoot); }
            catch (_) { return { success: false, error: { code: 'INVALID_RUNTIME_PROJECT_ROOT' } }; }
            if (!validSceneUuid(input.instanceId) || !validSceneUuid(input.expectedSceneUuid) || !validSceneName(input.expectedScene)) {
                return { success: false, error: { code: 'INVALID_RUNTIME_SESSION_IDENTITY' } };
            }
            let session = sessions.get(project);
            if (session && session.busy) return { success: false, error: { code: 'PREVIEW_OBSERVATION_IN_PROGRESS' } };
            const restart = restarts.has(project);
            const previewUrl = input.previewUrl || PREVIEW_URL;
            if (session && (session.closed || session.disconnected || session.childExited || session.instanceId !== input.instanceId
                || session.sceneUuid !== input.expectedSceneUuid || session.sceneName !== input.expectedScene
                || session.previewUrl !== previewUrl)) {
                if (!restart) return { success: false, error: { code: 'PREVIEW_SESSION_RESTART_REQUIRED',
                    message: 'The Agent preview was closed or its Creator/scene identity changed. Approve runtime.preview.start before observing again.' } };
                session.busy = true;
                await closeRuntimeSession(session);
                sessions.delete(project); session = null;
            }
            if (session && session.requiresReload && !restart) return { success: false, error: { code: 'PREVIEW_RELOAD_REQUIRED',
                message: 'Creator content changed. Approve runtime.preview.start to refresh this Agent preview before observing the new code or assets.' } };
            if (!session) {
                if (sessions.size >= 8) return { success: false, error: { code: 'PREVIEW_SESSION_LIMIT' } };
                session = { id: randomUUID(), persistent: true, instanceId: input.instanceId,
                    sceneUuid: input.expectedSceneUuid, sceneName: input.expectedScene, previewUrl };
                sessions.set(project, session);
            }
            if (restart) { session.refreshRequested = session.initialized === true; session.requiresReload = false; restarts.delete(project); }
            session.busy = true;
            session.contentRevision = session.contentRevision || 0;
            const revision = session.contentRevision;
            try {
                const result = await observeRuntime(input, { ...options, session });
                if (closed) return { success: false, error: { code: 'PREVIEW_OBSERVER_CLOSED' } };
                if (result.success === true && session.closed) return { success: false, error: { code: 'PREVIEW_SESSION_CLOSED' } };
                if (result.success === true && (session.requiresReload || session.contentRevision !== revision)) {
                    return { success: false, error: { code: 'PREVIEW_CONTENT_CHANGED_DURING_CAPTURE' } };
                }
                if (result.success === true) session.interactionNeedsReview = false;
                if (result.session) result.session.instanceId = session.instanceId;
                return result;
            } catch (_) {
                return { success: false, error: { code: 'PREVIEW_OBSERVATION_FAILED' } };
            } finally { session.busy = false; }
        },
        async interact(input) {
            if (closed) return { success: false, outcome: 'failed', inputDispatched: false, error: { code: 'PREVIEW_OBSERVER_CLOSED' } };
            let project;
            try { project = key(input && input.projectRoot); }
            catch (_) { return { success: false, outcome: 'failed', inputDispatched: false, error: { code: 'INVALID_RUNTIME_PROJECT_ROOT' } }; }
            const session = sessions.get(project);
            if (!session || !session.initialized) return { success: false, outcome: 'precondition-failed', inputDispatched: false,
                error: { code: 'PREVIEW_SESSION_NOT_ESTABLISHED', message: 'Observe the running preview before sending input.' } };
            if (session.busy) return { success: false, outcome: 'precondition-failed', inputDispatched: false,
                error: { code: 'PREVIEW_OBSERVATION_IN_PROGRESS' } };
            const interaction = input && input.interaction;
            if (!validSceneUuid(input.instanceId) || !validSceneUuid(input.expectedSceneUuid) || !validSceneName(input.expectedScene)
                || !validInteraction(interaction, session) || session.closed || session.disconnected || session.childExited
                || session.requiresReload || session.interactionNeedsReview || restarts.has(project) || session.instanceId !== input.instanceId
                || session.sceneUuid !== input.expectedSceneUuid || session.sceneName !== input.expectedScene
                || session.previewUrl !== (input.previewUrl || PREVIEW_URL)) {
                return { success: false, outcome: 'precondition-failed', inputDispatched: false,
                    error: { code: 'PREVIEW_INTERACTION_SESSION_MISMATCH', message: 'Refresh and observe the exact current session before interacting.' } };
            }
            session.interactionIds = session.interactionIds || new Set();
            if (session.interactionIds.has(interaction.interactionId)) return { success: false, outcome: 'precondition-failed',
                inputDispatched: false, error: { code: 'INTERACTION_ID_REUSED' } };
            if (session.interactionIds.size >= 128) return { success: false, outcome: 'precondition-failed', inputDispatched: false,
                error: { code: 'PREVIEW_INTERACTION_LIMIT', message: 'Restart and observe a new preview session before more interactions.' } };
            session.interactionIds.add(interaction.interactionId);
            session.busy = true;
            const revision = session.contentRevision || 0;
            try {
                const result = await observeRuntime(input, { ...options, session });
                if (closed) return { success: false, outcome: 'needs-review', error: { code: 'PREVIEW_OBSERVER_CLOSED' },
                    ...(result.interaction ? { interaction: result.interaction } : {}) };
                if (session.requiresReload || session.contentRevision !== revision) {
                    if (result.interaction) session.interactionNeedsReview = true;
                    return { success: false, outcome: 'needs-review', error: { code: 'PREVIEW_CONTENT_CHANGED_DURING_INTERACTION' },
                        ...(result.interaction ? { interaction: result.interaction } : {}) };
                }
                if (result.outcome === 'needs-review') session.interactionNeedsReview = true;
                return result;
            } catch (_) {
                return { success: false, outcome: 'needs-review', error: { code: 'PREVIEW_INTERACTION_FAILED' },
                    interactionId: interaction && interaction.interactionId };
            } finally { session.busy = false; }
        },
        previewStarted(projectRoot) {
            if (closed) return;
            const project = key(projectRoot);
            restarts.add(project);
            const session = sessions.get(project);
            if (session && session.busy) { session.requiresReload = true; session.contentRevision = (session.contentRevision || 0) + 1; }
        },
        contentChanged(projectRoot) {
            const project = key(projectRoot);
            restarts.delete(project);
            const session = sessions.get(project);
            if (session) { session.requiresReload = true; session.contentRevision = (session.contentRevision || 0) + 1; }
        },
        async closeAll() {
            closed = true;
            await Promise.allSettled([...sessions.values()].map(closeRuntimeSession));
            process.removeListener('exit', killOnExit);
            sessions.clear(); restarts.clear();
        },
    };
}

module.exports = { observeRuntime, createRuntimeObserver, discoverBrowser, targetExpression, sanitizeText,
    validNodePath, validSceneName, validSceneUuid, validPreviewUrl, PREVIEW_URL };
