'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('./vendor/ws');

const PREVIEW_URL = 'http://127.0.0.1:7456/';
const CHROME_CANDIDATES = [
    process.env.COCOS_AGENT_CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
].filter(Boolean);

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function chromePath() { return CHROME_CANDIDATES.find((filename) => fs.existsSync(filename)) || null; }
function expressionFor(expected) {
    const pathParts = JSON.stringify(expected.nodePath.split('/'));
    return `(function(){
      var scene=cc.director.getScene();if(!scene)return null;
      var parts=${pathParts};if(parts[0]!==scene.name)return {sceneName:scene.name,nodePath:parts.join('/'),missing:'scene'};
      var node=scene;
      for(var i=1;i<parts.length;i++){var found=(node.children||[]).filter(function(child){return child.name===parts[i];});if(found.length!==1)return {sceneName:scene.name,nodePath:parts.join('/'),missing:found.length?'ambiguous':'node'};node=found[0];}
      var components=(node._components||[]).map(function(component){var classId=cc.js.getClassName(component);if(classId==='cc.Sprite')return {classId:classId,spriteFrameUuid:component.spriteFrame&&component.spriteFrame._uuid||null};if(classId==='cc.Label')return {classId:classId,text:component.string};return {classId:classId};});
      return {sceneName:scene.name,nodePath:parts.join('/'),nodeUuid:node.uuid,components:components,transform:{position:{x:node.x,y:node.y},scale:{x:node.scaleX,y:node.scaleY}}};
    })()`;
}

async function verify(expected, options = {}) {
    if (!expected || expected.creatorVersion !== '2.4.15' || typeof expected.projectRoot !== 'string'
        || typeof expected.nodePath !== 'string' || typeof expected.nodeUuid !== 'string') throw Error('INVALID_RUNTIME_PREVIEW_TARGET');
    const executable = options.chromePath || chromePath();
    if (!executable) throw Error('CHROME_NOT_FOUND');
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-agent-preview-'));
    const child = spawn(executable, ['--headless=new', '--no-first-run', '--no-default-browser-check',
        '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--remote-allow-origins=*',
        '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,800', PREVIEW_URL], { stdio: 'ignore' });
    let socket = null;
    let nextId = 0;
    const pending = new Map();
    const timeoutMs = options.timeoutMs || 45000;
    const stopAt = Date.now() + timeoutMs;
    const send = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++nextId;
        const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP_TIMEOUT_${method}`)); }, 15000);
        pending.set(id, (message) => { clearTimeout(timer); message.error ? reject(Error(message.error.message)) : resolve(message.result); });
        socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async (expression) => {
        const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout: 10000 });
        if (result.exceptionDetails) throw Error(result.exceptionDetails.text || 'PREVIEW_EVALUATION_FAILED');
        return result.result && result.result.value;
    };
    try {
        let port = null;
        while (Date.now() < stopAt && child.exitCode === null) {
            const marker = path.join(profile, 'DevToolsActivePort');
            if (fs.existsSync(marker)) { port = Number(fs.readFileSync(marker, 'utf8').split('\n')[0]); if (port) break; }
            await delay(100);
        }
        if (!port) throw Error(child.exitCode === null ? 'CHROME_DEVTOOLS_NOT_READY' : `CHROME_EXITED_${child.exitCode}`);
        let page = null;
        while (Date.now() < stopAt && child.exitCode === null) {
            try {
                const response = await fetch(`http://127.0.0.1:${port}/json/list`);
                const pages = await response.json();
                page = pages.find((item) => item.type === 'page' && item.url.startsWith(PREVIEW_URL));
                if (page) break;
            } catch (_) { /* DevTools is still starting. */ }
            await delay(100);
        }
        if (!page) throw Error('PREVIEW_PAGE_NOT_FOUND');
        socket = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
        socket.on('message', (raw) => {
            let message;
            try { message = JSON.parse(raw.toString()); } catch (_) { return; }
            if (message.id && pending.has(message.id)) {
                const settle = pending.get(message.id); pending.delete(message.id); settle(message);
            }
        });
        await send('Runtime.enable');
        await send('Page.enable');
        const expression = expressionFor(expected);
        while (Date.now() < stopAt && child.exitCode === null) {
            const state = await evaluate(`(function(){return typeof cc!=='undefined'&&cc.director&&cc.director.getScene()?${expression}:null})()`);
            if (state && state.nodeUuid) {
                const transform = expected.transform || {};
                const matches = state.sceneName === expected.sceneName && state.nodePath === expected.nodePath
                    && state.nodeUuid === expected.nodeUuid
                    && JSON.stringify(state.components) === JSON.stringify(expected.components || [])
                    && (!transform.position || (Math.abs(state.transform.position.x - transform.position.x) <= 1e-5
                        && Math.abs(state.transform.position.y - transform.position.y) <= 1e-5))
                    && (!transform.scale || (Math.abs(state.transform.scale.x - transform.scale.x) <= 1e-5
                        && Math.abs(state.transform.scale.y - transform.scale.y) <= 1e-5));
                if (!matches) throw Error(`RUNTIME_PREVIEW_MISMATCH:${JSON.stringify(state)}`);
                return { previewUrl: page.url, observedAt: new Date().toISOString(), runtimeState: state };
            }
            await delay(150);
        }
        throw Error('PREVIEW_SCENE_NOT_READY');
    } finally {
        if (socket && socket.readyState === WebSocket.OPEN) socket.close();
        child.kill();
        if (child.exitCode === null) await Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(2000)]);
        for (const item of pending.values()) { try { item({ error: { message: 'PREVIEW_CLOSED' } }); } catch (_) { /* already settled */ } }
        fs.rmSync(profile, { recursive: true, force: true });
    }
}

module.exports = { verify, expressionFor, chromePath, PREVIEW_URL };
