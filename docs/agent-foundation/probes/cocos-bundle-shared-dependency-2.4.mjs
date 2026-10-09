// Verify two low-priority Asset Bundle scenes share one resources SpriteFrame.
// Usage: node docs/agent-foundation/probes/cocos-bundle-shared-dependency-2.4.mjs <web-mobile-root>
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
    '2.4.15NewProject/build/cocos-agent/bundle-shared-dependency-20261009/web-mobile'));
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const frameUuid = '0683b14a-8790-4ecd-9ee5-4b83163e34ff';
const textureUuid = 'bf8602ca-5561-4eb5-8c63-9653d4c32a4f';
const bundles = [
    { name: 'cocos-agent-smoke', scene: 'BundleSharedA', sceneUuid: 'd86b9b2f-5d52-43b3-b2c7-5e345f9960e4' },
    { name: 'cocos-agent-sidecar', scene: 'BundleSharedB', sceneUuid: '53751717-051c-4b3d-abe7-19bfc2b3990a' },
];
const contentTypes = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.webp': 'image/webp' };

function readBundleConfig(name, sceneName) {
    const directory = path.join(webRoot, 'assets', name);
    const files = fs.readdirSync(directory).filter((filename) => /^config\..+\.json$/.test(filename));
    if (files.length !== 1) throw Error(`BUNDLE_CONFIG_COUNT_${name}_${files.length}`);
    const filename = path.join(directory, files[0]);
    const config = JSON.parse(fs.readFileSync(filename, 'utf8'));
    if (config.name !== name) throw Error(`BUNDLE_NAME_MISMATCH_${name}`);
    const sceneKeys = Object.keys(config.scenes || {});
    if (!sceneKeys.some((key) => key.includes(sceneName))) throw Error(`BUNDLE_SCENE_MISSING_${sceneName}`);
    if (!Array.isArray(config.deps) || !config.deps.includes('resources')) throw Error(`BUNDLE_RESOURCES_DEPENDENCY_MISSING_${name}`);
    if (!Array.isArray(config.redirect) || config.redirect.length < 2) throw Error(`BUNDLE_REDIRECT_MISSING_${name}`);
    return { filename: path.relative(webRoot, filename), sha256: require('node:crypto')
        .createHash('sha256').update(fs.readFileSync(filename)).digest('hex'),
    name: config.name, deps: config.deps, sceneKeys, redirectCount: Array.isArray(config.redirect) ? config.redirect.length : -1 };
}

if (!fs.existsSync(path.join(webRoot, 'index.html'))) throw Error('WEB_MOBILE_INDEX_NOT_FOUND');
if (!fs.existsSync(chromePath)) throw Error('CHROME_NOT_FOUND');
const builtBundles = bundles.map((bundle) => ({ ...bundle, build: readBundleConfig(bundle.name, bundle.scene) }));

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
let activeProfile;
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

async function startBrowser(url) {
    activeProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-bundle-shared-'));
    chrome = spawn(chromePath, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0',
        `--user-data-dir=${activeProfile}`, '--remote-allow-origins=*', '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader', '--window-size=1280,800', url], { stdio: 'ignore' });
    const marker = path.join(activeProfile, 'DevToolsActivePort');
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

const probeExpression = `(${async function (specs, frameId, textureId) {
    const cc = globalThis.cc;
    const manager = cc.assetManager;
    const snapshot = () => {
        const names = [];
        manager.bundles.forEach((_bundle, name) => { if (typeof name === 'string') names.push(name); });
        names.sort();
        const frame = manager.assets.get(frameId);
        const texture = manager.assets.get(textureId);
        return { sampledAt: new Date().toISOString(), assetCacheCount: manager.assets.count,
            bundleCacheCount: manager.bundles.count, bundleNames: names,
            sharedFrame: frame ? { refCount: frame.refCount, valid: cc.isValid(frame, true) } : null,
            sharedTexture: texture ? { refCount: texture.refCount, valid: cc.isValid(texture, true) } : null };
    };
    const loadBundle = (name) => new Promise((resolve, reject) => {
        const cached = manager.getBundle(name);
        if (cached) { resolve(cached); return; }
        manager.loadBundle(name, (error, bundle) => error ? reject(error) : resolve(bundle));
    });
    const loadScene = (bundle, name) => new Promise((resolve, reject) => {
        bundle.loadScene(name, (error, sceneAsset) => error ? reject(error) : resolve(sceneAsset));
    });
    const spritesIn = (sceneAsset) => {
        const result = [];
        const visit = (node) => {
            for (const component of node._components || []) if (component instanceof cc.Sprite) result.push(component);
            for (const child of node._children || []) visit(child);
        };
        visit(sceneAsset.scene);
        return result;
    };
    const runScene = (sceneAsset) => new Promise((resolve, reject) => {
        try { cc.director.runSceneImmediate(sceneAsset, null, resolve); }
        catch (error) { reject(error); }
    });
    const delayFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
    const initialScene = cc.director.getScene();
    const baseline = snapshot();
    const baselineFrame = manager.assets.get(frameId);
    const baselineTexture = manager.assets.get(textureId);
    if (!baselineFrame || !baselineTexture) throw Error('SHARED_RESOURCE_NOT_IN_BASELINE_SCENE');
    if (initialScene.autoReleaseAssets !== false) throw Error('UNEXPECTED_BASELINE_SCENE_RELEASE_POLICY');
    const resourcesBefore = manager.getBundle('resources') || await loadBundle('resources');
    manager.removeBundle(resourcesBefore);
    const smokeBeforeHigh = await loadBundle(specs[0].name);
    let highBundleGateError = null;
    try { await loadScene(smokeBeforeHigh, specs[0].scene); }
    catch (error) { highBundleGateError = String(error && error.message || error); }
    if (!highBundleGateError || !highBundleGateError.includes('resources')) throw Error('HIGH_PRIORITY_BUNDLE_GATE_NOT_OBSERVED');
    const resources = await loadBundle('resources');
    const bundleRecords = [];
    for (const spec of specs) {
        const bundle = spec.name === specs[0].name ? smokeBeforeHigh : await loadBundle(spec.name);
        if (!Array.isArray(bundle.deps) || !bundle.deps.includes('resources')) throw Error(`RUNTIME_DEPENDENCY_MISSING_${spec.name}`);
        const redirected = bundle.getAssetInfo(frameId);
        if (!redirected || redirected.redirect !== 'resources') throw Error(`SHARED_ASSET_REDIRECT_MISSING_${spec.name}`);
        bundleRecords.push({ spec, bundle, redirect: redirected.redirect });
    }
    const scenes = [];
    for (const record of bundleRecords) {
        const sceneAsset = await loadScene(record.bundle, record.spec.scene);
        const sprites = spritesIn(sceneAsset);
        if (!sceneAsset.scene || !sceneAsset.scene.autoReleaseAssets || sprites.length !== 1) throw Error(`SCENE_FIXTURE_MISMATCH_${record.spec.scene}`);
        if (sceneAsset._uuid !== record.spec.sceneUuid) throw Error(`SCENE_UUID_MISMATCH_${record.spec.scene}`);
        if (sprites[0].spriteFrame._uuid !== frameId || sprites[0].spriteFrame.texture._uuid !== textureId)
            throw Error(`SCENE_REFERENCE_MISMATCH_${record.spec.scene}`);
        scenes.push({ record, sceneAsset, sprite: sprites[0] });
    }
    const sharedFrame = scenes[0].sprite.spriteFrame;
    const sharedTexture = sharedFrame.texture;
    if (sharedFrame !== scenes[1].sprite.spriteFrame || sharedTexture !== scenes[1].sprite.spriteFrame.texture)
        throw Error('SCENES_DID_NOT_SHARE_EXACT_ASSET_INSTANCES');
    const afterBothLoaded = snapshot();
    const baselineFrameRefs = baselineFrame.refCount;
    if (sharedFrame.refCount < baselineFrameRefs + 2) throw Error('SCENE_DEPENDENCY_REFS_NOT_BOTH_HELD');
    await runScene(scenes[0].sceneAsset);
    await delayFrame();
    const firstSceneActive = { name: cc.director.getScene().name, frameRefCount: sharedFrame.refCount,
        spriteFrameUuid: scenes[0].sprite.spriteFrame._uuid };
    scenes[0].record.bundle.releaseAll();
    await delayFrame();
    const afterFirstReleaseAll = snapshot();
    if (!cc.isValid(sharedFrame, true) || !cc.isValid(sharedTexture, true)
        || scenes[0].sprite.spriteFrame !== sharedFrame || scenes[1].sprite.spriteFrame !== sharedFrame)
        throw Error('FIRST_BUNDLE_RELEASE_ALL_DAMAGED_SHARED_RESOURCE');
    await runScene(scenes[1].sceneAsset);
    await delayFrame();
    const secondSceneActive = { name: cc.director.getScene().name, frameRefCount: sharedFrame.refCount,
        spriteFrameUuid: scenes[1].sprite.spriteFrame._uuid };
    if (!cc.isValid(sharedFrame, true) || scenes[1].sprite.spriteFrame !== sharedFrame)
        throw Error('SURVIVING_SCENE_LOST_SHARED_RESOURCE');
    scenes[1].record.bundle.releaseAll();
    await delayFrame();
    const afterSecondReleaseAll = snapshot();
    if (!cc.isValid(sharedFrame, true) || !cc.isValid(sharedTexture, true))
        throw Error('ACTIVE_SCENE_RELEASE_ALL_DAMAGED_SHARED_RESOURCE');
    const blankScene = new cc.Scene();
    blankScene._id = `cocos-agent-bundle-release-${Date.now()}`;
    cc.director.runSceneImmediate(blankScene);
    await delayFrame();
    const afterSceneExit = snapshot();
    if (sharedFrame.refCount !== baselineFrameRefs || sharedTexture.refCount !== baselineTexture.refCount)
        throw Error('SCENE_DEPENDENCY_REFS_DID_NOT_RETURN_TO_BASELINE');
    for (const record of bundleRecords) manager.removeBundle(record.bundle);
    await delayFrame();
    const afterBundleRemoval = snapshot();
    if (afterBundleRemoval.assetCacheCount !== baseline.assetCacheCount
        || afterBundleRemoval.bundleCacheCount !== baseline.bundleCacheCount
        || JSON.stringify(afterBundleRemoval.bundleNames) !== JSON.stringify(baseline.bundleNames))
        throw Error('CACHE_BASELINE_DID_NOT_RECOVER');
    return { creatorVersion: '2.4.15', baseline, highBundleGateError,
        bundleDependencies: bundleRecords.map(({ spec, redirect }) => ({ name: spec.name, scene: spec.scene, redirect })),
        sharedAssetIdentity: { spriteFrameUuid: sharedFrame._uuid, textureUuid: sharedTexture._uuid,
            sameSpriteFrameObject: scenes[0].sprite.spriteFrame === scenes[1].sprite.spriteFrame,
            sameTextureObject: scenes[0].sprite.spriteFrame.texture === scenes[1].sprite.spriteFrame.texture },
        afterBothLoaded, firstSceneActive, afterFirstReleaseAll, secondSceneActive, afterSecondReleaseAll,
        afterSceneExit, afterBundleRemoval,
        interpretation: 'Both scene assets resolve the shared SpriteFrame and Texture through resources. Loading a consumer Bundle before resources fails. Bundle.releaseAll leaves the shared redirect asset valid; switching away from autoReleaseAssets scenes returns its refs to the pre-test scene baseline.' };
}.toString()})(${JSON.stringify(bundles)},${JSON.stringify(frameUuid)},${JSON.stringify(textureUuid)})`;

async function main() {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const url = `http://127.0.0.1:${server.address().port}/`;
    await startBrowser(url);
    const result = await evaluate(probeExpression);
    const trace = { observedAt: new Date().toISOString(), creatorVersion: '2.4.15',
        buildOutput: path.relative(root, webRoot), sharedFrameUuid: frameUuid, sharedTextureUuid: textureUuid,
        bundles: builtBundles, result };
    const destination = path.join(root, 'docs/agent-foundation/traces/cocos-agent-shared-bundle-dependency-2.4-web.json');
    fs.writeFileSync(destination, `${JSON.stringify(trace, null, 2)}\n`);
    process.stdout.write(`SHARED_BUNDLE_DEPENDENCY_VERIFIED ${destination}\n`);
}

try { await main(); }
catch (error) { process.stderr.write(`SHARED_BUNDLE_DEPENDENCY_FAILED ${error.stack || error}\n`); process.exitCode = 1; }
finally {
    if (socket && socket.readyState === WebSocket.OPEN) socket.close();
    if (chrome) {
        chrome.kill();
        if (chrome.exitCode === null) await Promise.race([new Promise((resolve) => chrome.once('exit', resolve)), delay(2000)]);
    }
    await new Promise((resolve) => server.close(resolve));
    for (const item of pending.values()) item.reject(Error('PROBE_CLOSED'));
    if (activeProfile) fs.rmSync(activeProfile, { recursive: true, force: true });
}
