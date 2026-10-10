// Measures the immutable Creator 2.4.15 Web-Mobile build without opening or mutating the editor project.
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../..');
const projectRoot = path.join(root, '2.4.15NewProject');
const buildId = value('--build');
const cycles = numberFlag('--cycles', Number.NaN, 8, 256);
const nodeCount = numberFlag('--node-count', Number.NaN, 32, 1024);
const failureHttpStatus = numberFlag('--failure-http-status', 503, 400, 599);
const experimentalPermanent4xxPatch = process.argv.includes('--experimental-permanent-4xx-retry-patch');
const packableFlag = value('--packable');
const packable = packableFlag === null ? true : packableFlag === 'true' ? true : packableFlag === 'false' ? false : null;
if (packable === null || packableFlag === null) throw Error('INVALID_PACKABLE_FLAG');
const resourcePaths = jsonFlag('--resource-paths');
const parseFixturePaths = jsonFlag('--parse-fixture-paths');
const failurePath = value('--failure-resource-path');
const testProfile = value('--test-profile');
const loadMode = value('--load-mode');
const budgetProfileId = value('--budget-profile');
const budgets = jsonFlag('--budgets');
if (!/^[a-z0-9][a-z0-9-]{2,31}$/.test(buildId || '')
    || !Array.isArray(resourcePaths) || resourcePaths.length < 2 || resourcePaths.length > 16
    || !resourcePaths.every((item) => typeof item === 'string' && /^[A-Za-z0-9_-]{1,64}(?:\/[A-Za-z0-9_-]{1,64}){0,7}$/.test(item))
    || new Set(resourcePaths).size !== resourcePaths.length
    || !Array.isArray(parseFixturePaths) || parseFixturePaths.length < 2 || parseFixturePaths.length > 16
    || !parseFixturePaths.every((item) => typeof item === 'string' && /^[A-Za-z0-9_-]{1,64}(?:\/[A-Za-z0-9_-]{1,64}){0,7}$/.test(item))
    || new Set(parseFixturePaths).size !== parseFixturePaths.length
    || parseFixturePaths.some((item) => resourcePaths.includes(item))
    || typeof failurePath !== 'string' || !parseFixturePaths.includes(failurePath) || resourcePaths.includes(failurePath)
    || cycles < resourcePaths.length + 1
    || testProfile !== 'macos-arm64-chrome-headless-swiftshader-1280x800'
    || loadMode !== 'cold-and-warm' || budgetProfileId !== 'macos-arm64-headless-swiftshader-host-screening-v1'
    || !budgets || typeof budgets !== 'object' || Array.isArray(budgets)
    || Object.keys(budgets).length !== 7
    || !['targetFps', 'maxColdResourceLoadP95Ms', 'maxWarmResourceLoadP95Ms', 'maxImportParserP95Ms', 'maxPngParserP95Ms',
        'maxReleaseCallP95Ms', 'maxEstimatedRgbaWorkingSetBytes'].every((key) => Number.isFinite(budgets[key]))
    || budgets.targetFps < 1 || budgets.targetFps > 360
    || ['maxColdResourceLoadP95Ms', 'maxWarmResourceLoadP95Ms', 'maxImportParserP95Ms', 'maxPngParserP95Ms', 'maxReleaseCallP95Ms']
        .some((key) => budgets[key] < 0.01 || budgets[key] > 60000)
    || !Number.isInteger(budgets.maxEstimatedRgbaWorkingSetBytes)
    || budgets.maxEstimatedRgbaWorkingSetBytes < 1048576 || budgets.maxEstimatedRgbaWorkingSetBytes > 1073741824) {
    throw Error('INVALID_STRESS_PROFILE');
}
if (process.platform !== 'darwin' || process.arch !== 'arm64') throw Error('TEST_PROFILE_UNAVAILABLE');
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
const buildConfig = JSON.parse(fs.readFileSync(path.join(buildRecord.outputRoot, buildRecord.artifact.configPath), 'utf8'));
function readPngInfo(filename) {
    const bytes = fs.readFileSync(filename);
    if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
        || bytes.toString('ascii', 12, 16) !== 'IHDR') throw Error(`PNG_INVALID:${filename}`);
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    return { width, height, bytes: bytes.length, estimatedRgbaBytes: width * height * 4,
        bitDepth: bytes[24], colorType: bytes[25],
        sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
}
function readResource(resourcePath) {
    const imagePath = path.join(projectRoot, 'assets/resources', `${resourcePath}.png`);
    const metaPath = `${imagePath}.meta`;
    if (!fs.existsSync(imagePath) || !fs.existsSync(metaPath)) throw Error(`RESOURCE_SOURCE_OR_META_MISSING:${resourcePath}`);
    if (!Object.values(buildConfig.paths || {}).some((entry) => Array.isArray(entry) && entry[0] === resourcePath))
        throw Error(`STRESS_ASSET_NOT_IN_BUILD:${resourcePath}`);
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    if (typeof meta.uuid !== 'string' || !meta.uuid) throw Error(`RESOURCE_UUID_MISSING:${resourcePath}`);
    const png = readPngInfo(imagePath);
    if (png.width < 512 || png.height < 512 || png.bytes < 262144)
        throw Error(`STRESS_ASSET_NOT_COMPLEX_ENOUGH:${resourcePath}`);
    return { name: resourcePath, uuid: meta.uuid, png };
}
const resourceAssets = resourcePaths.map(readResource);
const parseFixtureAssets = parseFixturePaths.map(readResource);
const failureAsset = parseFixtureAssets.find((item) => item.name === failurePath);
const allAssets = [...resourceAssets, ...parseFixtureAssets];
if (!failureAsset || new Set(allAssets.map((item) => item.uuid)).size !== allAssets.length) throw Error('STRESS_ASSET_UUID_COLLISION_OR_FAILURE_FIXTURE_MISSING');
const allResourcePaths = allAssets.map((item) => item.name);
const resourceUuids = Object.fromEntries(resourceAssets.map((item) => [item.name, item.uuid]));
const resourceInfo = Object.fromEntries(allAssets.map((item) => [item.name, {
    width: item.png.width, height: item.png.height, encodedBytes: item.png.bytes,
    estimatedRgbaBytes: item.png.estimatedRgbaBytes,
}]));
for (const asset of parseFixtureAssets) resourceUuids[asset.name] = asset.uuid;
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
const serverState = { failUuid: null, failureHttpStatus };
const httpResponses = [];
const runtimePatchState = { applied: false, originalSha256: null, patchedSha256: null };
function patchPermanentHttpErrors(sourceBytes) {
    const source = sourceBytes.toString('utf8');
    const originalRetry = 'retry:function(t,e,i,n,r){t(r=r||0,(function(s,a){r++,!s||r>e?n&&n(s,a):setTimeout((function(){l.retry(t,e,i,n,r)}),i)}))}';
    const patchedRetry = 'retry:function(t,e,i,n,r){t(r=r||0,(function(s,a){r++;var o=s&&s.status,c=o>=400&&o<500&&408!==o&&425!==o&&429!==o;!s||r>e||c?n&&n(s,a):setTimeout((function(){l.retry(t,e,i,n,r)}),i)}))}';
    const originalHttpError = 'r&&r(new Error(o+a.status+"(no response)"))';
    const patchedHttpError = 'r&&(function(t){t.status=a.status,r(t)})(new Error(o+a.status+"(no response)"))';
    if (source.split(originalRetry).length !== 2 || source.split(originalHttpError).length !== 2)
        throw Error('EXPERIMENTAL_RETRY_PATCH_SOURCE_MISMATCH');
    const patched = source.replace(originalRetry, patchedRetry).replace(originalHttpError, patchedHttpError);
    if (patched === source) throw Error('EXPERIMENTAL_RETRY_PATCH_NOT_APPLIED');
    runtimePatchState.applied = true;
    runtimePatchState.originalSha256 = crypto.createHash('sha256').update(sourceBytes).digest('hex');
    runtimePatchState.patchedSha256 = crypto.createHash('sha256').update(patched).digest('hex');
    return Buffer.from(patched);
}
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
        response.writeHead(serverState.failureHttpStatus, { 'cache-control': 'no-store', 'access-control-allow-origin': '*' });
        response.end('Injected stress-test transport failure');
        finish(serverState.failureHttpStatus, 37);
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
        if (experimentalPermanent4xxPatch && /^\/cocos2d-js-min\.[a-f0-9]+\.js$/.test(pathname)) {
            bytes = patchPermanentHttpErrors(bytes);
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
function jsonFlag(flag) {
    const raw = value(flag);
    if (raw === null) return null;
    try { return JSON.parse(raw); } catch (_) { throw Error(`INVALID_${flag.toUpperCase().slice(2).replace(/-/g, '_')}`); }
}
function numberFlag(flag, fallback, min, max) {
    const raw = value(flag);
    const parsed = raw === null ? fallback : Number(raw);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw Error(`INVALID_${flag.toUpperCase().slice(2).replace(/-/g, '_')}`);
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
    const browserVersion = spawnSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--version'], { encoding: 'utf8' });
    if (browserVersion.status !== 0) throw Error('CHROME_VERSION_UNAVAILABLE');
    for (let i = 0; i < 400; i++) {
        const ready = await evaluate('typeof cc !== "undefined" && !!cc.director && !!cc.director.getScene() && !cc.game.isPaused()');
        if (ready) return { pageUrl: page.url, profile, browserVersion: browserVersion.stdout.trim() };
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
                serverState.failUuid = resourceUuids[failurePath];
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
    const runPromise = evaluate(`window.CocosAgentDynamicStress24.run(${JSON.stringify({
        cycles, nodeCount, packable, paths: resourcePaths, parseFixturePaths, resourceUuids, resourceInfo,
        failurePath, failureUuid: resourceUuids[failurePath], loadMode, budgetProfileId, budgets,
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
    schemaVersion: '0.2', runId, creatorVersion: '2.4.15', platform: 'web-mobile',
    buildId, releaseId: buildRecord.releaseId, buildFingerprint: buildRecord.fingerprint,
    buildOutputRoot: buildRecord.outputRoot,
    environment: { host: process.platform, architecture: process.arch, osRelease: os.release(),
        deviceClass: 'development-host-headless-screening', cpuModel: os.cpus()[0]?.model || null,
        logicalCpuCount: os.cpus().length, totalMemoryBytes: os.totalmem(),
        browser: runtime?.browserVersion || 'Google Chrome headless', renderer: 'SwiftShader',
        viewport: { width: 1280, height: 800 }, profileId: testProfile,
        baseUrl: staticUrl || null, testedAt: new Date().toISOString() },
    runtimePatch: experimentalPermanent4xxPatch ? {
        kind: 'permanent-http-4xx-no-retry', applied: runtimePatchState.applied,
        sourceFiles: ['2.4.15engine/cocos2d/core/asset-manager/download-file.js',
            '2.4.15engine/cocos2d/core/asset-manager/utilities.js'],
        servedBundleOriginalSha256: runtimePatchState.originalSha256,
        servedBundlePatchedSha256: runtimePatchState.patchedSha256,
        note: 'Experimental in-memory patch for comparison; the immutable build output on disk was not modified.',
    } : null,
    workload: { cycles, nodeCount, packable, loadMode, budgetProfileId,
        assets: resourceAssets, parseFixtureAssets, failureAsset, budgets, targetFps: budgets.targetFps ?? null,
        budgetVerdict: result?.budgetEvaluation?.verdict || 'not-set' },
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
        assetRequests: httpResponses.filter((item) => allResourcePaths.some((name) => item.path.includes(resourceUuids[name]))),
        coldLoadEvidence: allAssets.map((asset) => {
            const requests = httpResponses.filter((item) => item.path.includes(asset.uuid));
            const firstSuccess = requests.find((item) => item.status === 200);
            return { name: asset.name, uuid: asset.uuid, coldCacheMiss: result?.resourceCache?.coldCacheReadback?.some((item) =>
                    item.phase === 'preflight' && item.path === asset.name && item.cached === false) === true,
                firstNativeResponseStatus: firstSuccess?.status ?? null,
                firstNativeResponseBytes: firstSuccess?.responseBytes ?? null,
                confirmed: firstSuccess?.status === 200 && firstSuccess.responseBytes === asset.png.bytes };
        }),
        failureHttpStatus,
        injectedFailureRequests: httpResponses.filter((item) => item.status === failureHttpStatus
            && allResourcePaths.some((name) => item.path.includes(resourceUuids[name]))),
        missingResourceResponses: httpResponses.filter((item) => /CocosAgentStressMissingResource/.test(item.path)),
    },
    browserEvents: browserEvents.slice(0, 100),
    error: traceError,
};
const expectedFailureUuid = resourceUuids[failurePath];
trace.network.failureTargetUuid = expectedFailureUuid;
trace.network.failureTransportConfirmed = trace.network.injectedFailureRequests.some((item) => item.path.includes(expectedFailureUuid));
if (!traceError && !trace.network.failureTransportConfirmed) {
    trace.error = 'STRESS_NETWORK_FAILURE_NOT_OBSERVED';
    traceError = trace.error;
}
if (!traceError && !trace.network.coldLoadEvidence.every((item) => item.confirmed && item.coldCacheMiss)) {
    trace.error = 'STRESS_COLD_NETWORK_EVIDENCE_MISSING';
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
