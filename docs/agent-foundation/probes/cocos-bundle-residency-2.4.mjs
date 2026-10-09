// Load two independent local Asset Bundles together, then release them in both orders.
// Usage: node docs/agent-foundation/probes/cocos-bundle-residency-2.4.mjs <web-mobile-root>
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const WebSocket = require('../../../tools/cocos-agent-bridge/vendor/ws');
const root = path.resolve(import.meta.dirname, '../../..');
const webRoot = path.resolve(process.argv[2] || path.join(root,
    '2.4.15NewProject/build/cocos-agent/bundle-dual-residency-20261009/web-mobile'));
const creator = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const contentTypes = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.webp': 'image/webp' };
if (!fs.existsSync(path.join(webRoot, 'index.html'))) throw Error('WEB_MOBILE_INDEX_NOT_FOUND');
if (!fs.existsSync(creator)) throw Error('CHROME_NOT_FOUND');

const bundles = [
    { name: 'cocos-agent-smoke', path: 'BlueReleaseOct09', uuid: '0a19c5a6-a415-4278-8d9c-12f98bfe1bc8' },
    { name: 'cocos-agent-sidecar', path: 'SidecarRedOct09', uuid: '45542288-a90c-4cbe-93c8-5b4016596c95' },
];
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-bundle-residency-'));
const server = http.createServer((request, response) => {
    if (!['GET', 'HEAD'].includes(request.method || '')) { response.writeHead(405); response.end(); return; }
    let relative;
    try { relative = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname).replace(/^\/+/, ''); }
    catch (_) { response.writeHead(400); response.end(); return; }
    if (!relative) relative = 'index.html';
    const filename = path.resolve(webRoot, relative);
    if (filename !== webRoot && !filename.startsWith(webRoot + path.sep)) { response.writeHead(403); response.end(); return; }
    let real;
    try { real = fs.realpathSync(filename); } catch (_) { response.writeHead(404); response.end(); return; }
    if (real !== webRoot && !real.startsWith(webRoot + path.sep)) { response.writeHead(403); response.end(); return; }
    let stat;
    try { stat = fs.statSync(real); } catch (_) { response.writeHead(404); response.end(); return; }
    if (!stat.isFile()) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'Content-Type': contentTypes[path.extname(real)] || 'application/octet-stream',
        'Content-Length': stat.size, 'Cache-Control': 'no-store' });
    if (request.method === 'HEAD') response.end(); else fs.createReadStream(real).pipe(response);
});

let chrome;
let socket;
let serial = 0;
const pending = new Map();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function send(method, params = {}) {
    const id = ++serial;
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP_TIMEOUT_${method}`)); }, 15000);
        pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value); },
            reject: (error) => { clearTimeout(timer); reject(error); } });
        socket.send(JSON.stringify({ id, method, params }));
    });
}
async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout: 30000 });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.text || 'BROWSER_EVALUATION_FAILED');
    return result.result && result.result.value;
}
async function connectBrowser(url) {
    chrome = spawn(creator, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0',
        `--user-data-dir=${profile}`, '--remote-allow-origins=*', '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader', '--window-size=1280,800', url], { stdio: 'ignore' });
    const marker = path.join(profile, 'DevToolsActivePort');
    let port;
    for (let i = 0; i < 150; i++) {
        if (fs.existsSync(marker)) { port = Number(fs.readFileSync(marker, 'utf8').split('\n')[0]); break; }
        if (chrome.exitCode !== null) throw Error(`CHROME_EXITED_${chrome.exitCode}`);
        await delay(100);
    }
    if (!port) throw Error('CHROME_DEVTOOLS_PORT_UNAVAILABLE');
    let page;
    for (let i = 0; i < 150; i++) {
        const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        page = pages.find((item) => item.type === 'page' && item.url.startsWith(url));
        if (page) break;
        await delay(100);
    }
    if (!page) throw Error('PREVIEW_PAGE_UNAVAILABLE');
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
    socket.on('message', (raw) => {
        let message;
        try { message = JSON.parse(raw.toString()); } catch (_) { return; }
        if (message.id && pending.has(message.id)) {
            const item = pending.get(message.id); pending.delete(message.id);
            message.error ? item.reject(Error(message.error.message)) : item.resolve(message.result);
        }
    });
    await send('Runtime.enable');
    await send('Page.enable');
    for (let i = 0; i < 300; i++) {
        if (await evaluate('typeof cc!=="undefined"&&cc.assetManager&&cc.director&&cc.director.getScene()&&!cc.game.isPaused()')) return;
        await delay(100);
    }
    throw Error('CREATOR_WEB_RUNTIME_NOT_READY');
}

const probeExpression = `(${async function (expected) {
    const cc = globalThis.cc;
    const manager = cc.assetManager;
    const delayDraw = () => new Promise((resolve) => cc.director.once(cc.Director.EVENT_AFTER_DRAW, resolve));
    const snapshot = () => {
        const names = [];
        manager.bundles.forEach((_bundle, name) => { if (typeof name === 'string') names.push(name); });
        names.sort();
        return { sampledAt: new Date().toISOString(), assetCacheCount: manager.assets.count,
            bundleCacheCount: manager.bundles.count, bundleNames: names };
    };
    const loadBundle = (name) => new Promise((resolve, reject) => {
        const cached = manager.getBundle(name);
        if (cached) { resolve(cached); return; }
        manager.loadBundle(name, (error, bundle) => error ? reject(error) : resolve(bundle));
    });
    const loadTexture = (bundle, path) => new Promise((resolve, reject) => {
        bundle.load(path, cc.Texture2D, (error, texture) => error ? reject(error) : resolve(texture));
    });
    const acquire = async (spec) => {
        const bundle = await loadBundle(spec.name);
        const texture = await loadTexture(bundle, spec.path);
        const loadedRefCount = texture.refCount;
        texture.addRef();
        if (texture.refCount !== loadedRefCount + 1) throw Error('EXPLICIT_HOLD_NOT_OBSERVED');
        return { spec, bundle, texture, loadedRefCount };
    };
    const release = async (record, survivor) => {
        const before = { refCount: record.texture.refCount, valid: cc.isValid(record.texture, true),
            cached: manager.assets.has(record.spec.uuid), bundleCached: manager.getBundle(record.spec.name) === record.bundle };
        if (before.refCount !== record.loadedRefCount + 1) throw Error('UNEXPECTED_EXTERNAL_REFERENCE');
        record.texture.decRef();
        if (record.texture.refCount !== record.loadedRefCount) throw Error('EXPLICIT_HOLD_NOT_RELEASED');
        if (record.texture.refCount !== 0) throw Error('ASSET_HAS_EXTERNAL_REFERENCES');
        record.bundle.release(record.spec.path, cc.Texture2D);
        await delayDraw();
        const assetAfterRelease = { refCount: record.texture.refCount,
            valid: cc.isValid(record.texture, true), cached: manager.assets.has(record.spec.uuid) };
        if (assetAfterRelease.cached || assetAfterRelease.valid) throw Error('RELEASED_TEXTURE_REMAINS_CACHED');
        manager.removeBundle(record.bundle);
        await delayDraw();
        const bundleAfterRemove = !manager.getBundle(record.spec.name);
        const survivorState = survivor ? { valid: cc.isValid(survivor.texture, true),
            cached: manager.assets.has(survivor.spec.uuid), refCount: survivor.texture.refCount,
            bundleCached: manager.getBundle(survivor.spec.name) === survivor.bundle } : null;
        if (!bundleAfterRemove) throw Error('REMOVED_BUNDLE_REMAINS_CACHED');
        if (survivor && (!survivorState.valid || !survivorState.cached || !survivorState.bundleCached || survivorState.refCount <= 0))
            throw Error('UNRELATED_BUNDLE_OR_ASSET_WAS_AFFECTED');
        return { releasedBundle: record.spec.name, before, assetAfterRelease, bundleAfterRemove,
            survivor: survivorState, cacheAfterRelease: snapshot() };
    };
    const baseline = snapshot();
    for (const spec of expected) if (manager.getBundle(spec.name)) throw Error('PROBE_BUNDLE_WAS_ALREADY_CACHED');
    const cycles = [];
    for (let index = 0; index < 2; index++) {
        const first = await acquire(expected[0]);
        const second = await acquire(expected[1]);
        const together = snapshot();
        if (!together.bundleNames.includes(expected[0].name) || !together.bundleNames.includes(expected[1].name))
            throw Error('BOTH_BUNDLES_NOT_RESIDENT');
        if (!manager.assets.has(expected[0].uuid) || !manager.assets.has(expected[1].uuid))
            throw Error('BOTH_TEXTURES_NOT_CACHED');
        const order = index === 0 ? [first, second] : [second, first];
        const releaseSteps = [];
        for (let i = 0; i < order.length; i++) {
            const record = order[i];
            const next = order[i + 1] || null;
            releaseSteps.push(await release(record, next));
        }
        const after = snapshot();
        if (after.assetCacheCount !== baseline.assetCacheCount || after.bundleCacheCount !== baseline.bundleCacheCount
            || JSON.stringify(after.bundleNames) !== JSON.stringify(baseline.bundleNames)) throw Error('CACHE_BASELINE_DID_NOT_RECOVER');
        cycles.push({ order: order.map((record) => record.spec.name), together, releaseSteps, after });
    }
    return { creatorVersion: '2.4.15', baseline, cycles, final: snapshot(),
        interpretation: 'Two independent PNG Texture assets can stay cached in separate loaded Bundles. Releasing/removing one Bundle leaves the other Bundle and its held Texture valid; both release orders return caches to baseline.' };
} .toString()})(${JSON.stringify(bundles)})`;

async function main() {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const url = `http://127.0.0.1:${server.address().port}/`;
    await connectBrowser(url);
    const result = await evaluate(probeExpression);
    const trace = { observedAt: new Date().toISOString(), creatorVersion: '2.4.15',
        buildOutput: path.relative(root, webRoot), bundleSpecs: bundles, result };
    const destination = path.join(root, 'docs/agent-foundation/traces/cocos-agent-multi-bundle-residency-2.4-web.json');
    fs.writeFileSync(destination, `${JSON.stringify(trace, null, 2)}\n`);
    process.stdout.write(`MULTI_BUNDLE_RESIDENCY_VERIFIED ${destination}\n`);
}
try { await main(); }
catch (error) { process.stderr.write(`MULTI_BUNDLE_RESIDENCY_FAILED ${error.stack || error}\n`); process.exitCode = 1; }
finally {
    if (socket && socket.readyState === WebSocket.OPEN) socket.close();
    if (chrome) {
        chrome.kill();
        if (chrome.exitCode === null) await Promise.race([new Promise((resolve) => chrome.once('exit', resolve)), delay(2000)]);
    }
    await new Promise((resolve) => server.close(resolve));
    for (const item of pending.values()) item.reject(Error('PROBE_CLOSED'));
    fs.rmSync(profile, { recursive: true, force: true });
}
