// Measures the immutable Creator 2.4.15 Web-Mobile build without opening or mutating the editor project.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../..');
const projectRoot = path.join(root, '2.4.15NewProject');
const buildId = value('--build') || 'p1-web-20261009';
const cycles = numberFlag('--cycles', 48, 4, 256);
const nodeCount = numberFlag('--node-count', 32, 1, 128);
const packableFlag = value('--packable');
const packable = packableFlag === null ? true : packableFlag === 'true' ? true : packableFlag === 'false' ? false : null;
if (packable === null) throw Error('INVALID_PACKABLE_FLAG');
const budgets = {
    targetFps: optionalNumberFlag('--target-fps', 1, 360),
    maxResourceLoadP95Ms: optionalNumberFlag('--max-resource-load-p95-ms', 0.01, 60000),
    maxImportParserP95Ms: optionalNumberFlag('--max-import-parser-p95-ms', 0.01, 60000),
    maxPngParserP95Ms: optionalNumberFlag('--max-png-parser-p95-ms', 0.01, 60000),
    maxReleaseCallP95Ms: optionalNumberFlag('--max-release-call-p95-ms', 0.01, 60000),
};
const recordPath = path.join(projectRoot, '.cocos-agent', 'content-builds', `${buildId}.json`);
const buildRecord = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
if (buildRecord.creatorVersion !== '2.4.15' || buildRecord.platform !== 'web-mobile'
    || buildRecord.state !== 'completed' || !buildRecord.artifact?.success
    || path.resolve(buildRecord.outputRoot) !== path.join(projectRoot, 'build', 'cocos-agent', buildId)) {
    throw Error('BUILD_NOT_VERIFIED_2_4_WEB_MOBILE');
}
const webRoot = path.join(buildRecord.outputRoot, 'web-mobile');
const indexPath = path.join(webRoot, 'index.html');
if (!fs.existsSync(indexPath)) throw Error('BUILD_INDEX_MISSING');
const probePath = path.join(root, 'docs/agent-foundation/probes/cocos-content-stress-2.4.js');
const probeSource = fs.readFileSync(probePath, 'utf8');
const resourcePaths = ['cocos-agent-batch-red', 'cocos-agent-batch-blue'];
const resourceUuids = Object.fromEntries(resourcePaths.map((resourcePath) => {
    const meta = JSON.parse(fs.readFileSync(path.join(projectRoot, 'assets/resources', `${resourcePath}.png.meta`), 'utf8'));
    if (typeof meta.uuid !== 'string') throw Error(`RESOURCE_UUID_MISSING:${resourcePath}`);
    return [resourcePath, meta.uuid];
}));
const buildConfig = JSON.parse(fs.readFileSync(path.join(buildRecord.outputRoot, buildRecord.artifact.configPath), 'utf8'));
for (const resourcePath of resourcePaths) {
    if (!Object.values(buildConfig.paths || {}).some((entry) => Array.isArray(entry) && entry[0] === resourcePath))
        throw Error(`STRESS_ASSET_NOT_IN_BUILD:${resourcePath}`);
}
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}`;
const outputPath = path.join(root, 'docs/agent-foundation/traces', `cocos-agent-content-stress-2.4-web-${runId}.json`);
const visualDir = path.join(root, 'docs/agent-foundation/traces/visual');
fs.mkdirSync(visualDir, { recursive: true });
const screenshotPaths = {
    afterCycles: path.join(visualDir, `cocos-agent-content-stress-2.4-${runId}-after-cycles.png`),
    failureRetained: path.join(visualDir, `cocos-agent-content-stress-2.4-${runId}-failure-retained.png`),
};
const mime = new Map([
    ['.html', 'text/html; charset=utf-8'], ['.js', 'application/javascript; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
    ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'],
    ['.webp', 'image/webp'], ['.wasm', 'application/wasm'], ['.mp3', 'audio/mpeg'],
]);
const httpRequests = [];
const serverState = { failUuid: null };
const httpResponses = [];
const server = http.createServer((request, response) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); }
    catch (_) { response.writeHead(400); response.end(); return; }
    if (pathname === '/') pathname = '/index.html';
    const filename = path.resolve(webRoot, `.${pathname}`);
    if (filename !== webRoot && !filename.startsWith(`${webRoot}${path.sep}`)) {
        response.writeHead(403); response.end(); return;
    }
    const requestInfo = { path: pathname, method: request.method, startedAt: Date.now() };
    httpRequests.push(requestInfo);
    if (httpRequests.length > 10000) httpRequests.shift();
    const finish = (status, bytes) => {
        httpResponses.push({ path: pathname, method: request.method, status,
            durationMs: Date.now() - requestInfo.startedAt, responseBytes: bytes });
        if (httpResponses.length > 10000) httpResponses.shift();
    };
    if (serverState.failUuid && pathname.includes(serverState.failUuid)) {
        response.writeHead(503, { 'cache-control': 'no-store', 'access-control-allow-origin': '*' });
        response.end('Injected stress-test transport failure');
        finish(503, 37);
        return;
    }
    fs.readFile(filename, (error, bytes) => {
        if (error) {
            const status = error.code === 'ENOENT' ? 404 : 500;
            response.writeHead(status, { 'cache-control': 'no-store', 'access-control-allow-origin': '*' });
            response.end();
            finish(status, 0);
            return;
        }
        response.writeHead(200, { 'content-type': mime.get(path.extname(filename)) || 'application/octet-stream',
            'cache-control': 'no-store', 'access-control-allow-origin': '*' });
        response.end(bytes);
        finish(200, bytes.byteLength);
    });
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let chrome;
let socket;
let serial = 0;
let runFinished = false;
let runFailure = null;
const pending = new Map();
const browserEvents = [];
function value(flag) {
    const index = process.argv.indexOf(flag);
    return index < 0 ? null : process.argv[index + 1];
}
function numberFlag(flag, fallback, min, max) {
    const raw = value(flag);
    const parsed = raw === null ? fallback : Number(raw);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw Error(`INVALID_${flag.toUpperCase().slice(2).replace(/-/g, '_')}`);
    return parsed;
}
function optionalNumberFlag(flag, min, max) {
    const raw = value(flag);
    if (raw === null) return undefined;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) throw Error(`INVALID_${flag.toUpperCase().slice(2).replace(/-/g, '_')}`);
    return parsed;
}
function send(method, params = {}) {
    const id = ++serial;
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP_TIMEOUT:${method}`)); }, 120000);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
    });
}
async function evaluate(expression) {
    const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout: 120000 });
    if (response.exceptionDetails) throw Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    return response.result?.value;
}
async function attachBrowser(url) {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-stress-24-'));
    chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
        '--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0',
        `--user-data-dir=${profile}`, '--remote-allow-origins=*', '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader', '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
        '--disable-http-cache', '--window-size=1280,800', url,
    ], { stdio: 'ignore' });
    const marker = path.join(profile, 'DevToolsActivePort');
    let debugPort;
    for (let i = 0; i < 150; i++) {
        if (fs.existsSync(marker)) { debugPort = Number(fs.readFileSync(marker, 'utf8').split('\n')[0]); break; }
        if (chrome.exitCode !== null) throw Error(`CHROME_EXITED:${chrome.exitCode}`);
        await delay(100);
    }
    if (!debugPort) throw Error('CHROME_DEBUG_PORT_UNAVAILABLE');
    let page;
    for (let i = 0; i < 150; i++) {
        const pages = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
        page = pages.find((item) => item.type === 'page' && item.url.includes(new URL(url).port));
        if (page) break;
        await delay(100);
    }
    if (!page) throw Error('WEB_MOBILE_PAGE_UNAVAILABLE');
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.id && pending.has(message.id)) {
            const task = pending.get(message.id);
            clearTimeout(task.timer);
            pending.delete(message.id);
            message.error ? task.reject(Error(message.error.message)) : task.resolve(message.result);
        } else if (message.method === 'Runtime.exceptionThrown') {
            browserEvents.push({ type: 'exception', text: message.params.exceptionDetails.text });
        } else if (message.method === 'Runtime.consoleAPICalled' && browserEvents.length < 100) {
            browserEvents.push({ type: 'console', level: message.params.type,
                text: message.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' ').slice(0, 500) });
        }
    };
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Network.enable');
    for (let i = 0; i < 400; i++) {
        const ready = await evaluate('typeof cc !== "undefined" && !!cc.director && !!cc.director.getScene() && !cc.game.isPaused()');
        if (ready) return { pageUrl: page.url, profile };
        await delay(100);
    }
    throw Error('CREATOR_24_WEB_MOBILE_RUNTIME_NOT_READY');
}
async function capture(filename) {
    const image = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(filename, Buffer.from(image.data, 'base64'));
    return path.relative(root, filename);
}
async function waitForPhase(phase, screenshots) {
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline && !runFinished && !runFailure) {
        const state = await evaluate('window.__cocosAgentStress24State || null');
        if (state && state.phase === phase) {
            screenshots[phase] = await capture(phase === 'after-cycles' ? screenshotPaths.afterCycles : screenshotPaths.failureRetained);
            if (phase === 'after-cycles') {
                const inactiveIndex = cycles % 2 === 0 ? 1 : 0;
                serverState.failUuid = resourceUuids[resourcePaths[inactiveIndex]];
            } else {
                serverState.failUuid = null;
            }
            await evaluate('window.__cocosAgentStress24Continue && window.__cocosAgentStress24Continue()');
            return;
        }
        await delay(40);
    }
    if (runFailure) throw runFailure;
    if (runFinished) return;
    throw Error(`STRESS_PHASE_TIMEOUT:${phase}`);
}

let staticUrl;
let runtime;
let result;
let screenshots = {};
let traceError = null;
try {
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    staticUrl = `http://127.0.0.1:${server.address().port}/`;
    runtime = await attachBrowser(staticUrl);
    await evaluate(probeSource);
    const inactiveIndex = cycles % 2 === 0 ? 1 : 0;
    const failurePath = resourcePaths[inactiveIndex];
    const runPromise = evaluate(`window.CocosAgentDynamicStress24.run(${JSON.stringify({
        cycles, nodeCount, packable, paths: resourcePaths, resourceUuids,
        failurePath, failureUuid: resourceUuids[failurePath], budgets,
    })})`)
        .then((value) => { result = value; runFinished = true; return { value }; },
            (error) => { runFailure = error; runFinished = true; return { error }; });
    await waitForPhase('after-cycles', screenshots);
    await waitForPhase('failure-retained', screenshots);
    const runOutcome = await runPromise;
    if (runOutcome.error) throw runOutcome.error;
    result = runOutcome.value;
    if (!result?.acceptance?.success) traceError = 'STRESS_ACCEPTANCE_FAILED';
} catch (error) {
    traceError = String(error && (error.stack || error.message || error) || error);
}

const trace = {
    schemaVersion: '0.1', runId, creatorVersion: '2.4.15', platform: 'web-mobile',
    buildId, releaseId: buildRecord.releaseId, buildFingerprint: buildRecord.fingerprint,
    buildOutputRoot: buildRecord.outputRoot,
    environment: { host: process.platform, architecture: process.arch, browser: 'Google Chrome headless + SwiftShader',
        baseUrl: staticUrl || null, testedAt: new Date().toISOString() },
    workload: { cycles, nodeCount, packable, assets: resourcePaths.map((name) => ({ name, uuid: resourceUuids[name] })),
        budgets, targetFps: budgets.targetFps ?? null, budgetVerdict: result?.budgetEvaluation?.verdict || 'not-set' },
    screenshots,
    result: result || null,
    httpRequestCount: httpRequests.length,
    network: {
        responseCount: httpResponses.length,
        statusCounts: httpResponses.reduce((counts, item) => {
            const key = String(item.status);
            counts[key] = (counts[key] || 0) + 1;
            return counts;
        }, {}),
        assetRequests: httpResponses.filter((item) => resourcePaths.some((name) => item.path.includes(resourceUuids[name]))),
        injectedFailureRequests: httpResponses.filter((item) => item.status === 503
            && resourcePaths.some((name) => item.path.includes(resourceUuids[name]))),
        missingResourceResponses: httpResponses.filter((item) => /CocosAgentStressMissingResource/.test(item.path)),
    },
    browserEvents: browserEvents.slice(0, 100),
    error: traceError,
};
const expectedFailureUuid = resourceUuids[resourcePaths[cycles % 2 === 0 ? 1 : 0]];
trace.network.failureTargetUuid = expectedFailureUuid;
trace.network.failureTransportConfirmed = trace.network.injectedFailureRequests.some((item) => item.path.includes(expectedFailureUuid));
if (!traceError && !trace.network.failureTransportConfirmed) {
    trace.error = 'STRESS_NETWORK_FAILURE_NOT_OBSERVED';
    traceError = trace.error;
}
fs.writeFileSync(outputPath, `${JSON.stringify(trace, null, 2)}\n`, { flag: 'wx' });
process.stdout.write(`${traceError ? 'CONTENT_STRESS_FAILED' : 'CONTENT_STRESS_ACCEPTED'} ${outputPath}\n`);
if (traceError) process.exitCode = 1;

if (socket?.readyState === WebSocket.OPEN) socket.close();
if (chrome) {
    const marker = chrome.spawnargs.find((arg) => arg.startsWith('--user-data-dir='));
    const profile = marker?.slice('--user-data-dir='.length);
    chrome.kill();
    if (chrome.exitCode === null) await Promise.race([new Promise((resolve) => chrome.once('exit', resolve)), delay(2000)]);
    if (profile) fs.rmSync(profile, { recursive: true, force: true });
}
if (server.listening) await new Promise((resolve) => server.close(resolve));
