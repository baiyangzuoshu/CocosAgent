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
function compactUuid(uuid) {
    const hex = uuid.replace(/-/g, '').toLowerCase();
    const encoded = Buffer.from(hex.slice(2), 'hex').toString('base64').replace(/=/g, '');
    return encoded.startsWith('/') ? `${hex.slice(0, 2)}/${encoded.slice(1)}` : `${hex.slice(0, 2)}${encoded}`;
}
const compressedFrameUuid = compactUuid(frameUuid);
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
    const sharedFrameIndex = config.uuids.indexOf(compressedFrameUuid);
    const redirectPairIndex = config.redirect.indexOf(sharedFrameIndex);
    const sharedFrameRedirect = redirectPairIndex < 0 ? null : config.deps[config.redirect[redirectPairIndex + 1]];
    if (sharedFrameIndex < 0 || sharedFrameRedirect !== 'resources') throw Error(`BUNDLE_SHARED_FRAME_REDIRECT_MISSING_${name}`);
    return { filename: path.relative(webRoot, filename), sha256: require('node:crypto')
        .createHash('sha256').update(fs.readFileSync(filename)).digest('hex'),
    name: config.name, deps: config.deps, sceneKeys, redirectCount: Array.isArray(config.redirect) ? config.redirect.length : -1,
    sharedFrameUuid: frameUuid, sharedFrameCompressedUuid: compressedFrameUuid, sharedFrameRedirect };
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
let chromeDiagnostics = '';
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
        '--enable-unsafe-swiftshader', '--window-size=1280,800', url], { stdio: ['ignore', 'ignore', 'pipe'] });
    chrome.stderr.on('data', (chunk) => { chromeDiagnostics = `${chromeDiagnostics}${chunk.toString()}`.slice(-6000); });
    chrome.on('error', (error) => { chromeDiagnostics = `${chromeDiagnostics}${String(error)}`.slice(-6000); });
    const marker = path.join(activeProfile, 'DevToolsActivePort');
    let port;
    for (let i = 0; i < 150; i++) {
        if (fs.existsSync(marker)) { port = Number(fs.readFileSync(marker, 'utf8').split('\n')[0]); break; }
        if (chrome.exitCode !== null) throw Error(`CHROME_EXITED_${chrome.exitCode}`);
        await delay(100);
    }
    if (!port) throw Error(`CHROME_DEVTOOLS_PORT_UNAVAILABLE_${chromeDiagnostics}`);
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
    const sourceTextureForFrame = (frame) => frame && (frame._original ? frame._original._texture : frame._texture);
    const renderTextureForFrame = (frame) => frame && frame._texture;
    const visualCheckpoint = async (id, sprite) => {
        await delayFrame();
        await delayFrame();
        const frame = sprite.spriteFrame;
        const texture = sourceTextureForFrame(frame);
        const renderTexture = renderTextureForFrame(frame);
        globalThis.__cocosAgentBundleCheckpoint = { id, scene: cc.director.getScene().name,
            spriteFrameUuid: frame && frame._uuid,
            sourceTextureUuid: texture && texture._uuid,
            renderTextureUuid: renderTexture && renderTexture._uuid || null,
            sourceTextureLoaded: Boolean(texture && texture.loaded),
            renderTextureLoaded: Boolean(renderTexture && renderTexture.loaded),
            renderBackendTexturePresent: Boolean(renderTexture && renderTexture._texture),
            spriteEnabled: sprite.enabledInHierarchy };
        await new Promise((resolve) => { globalThis.__cocosAgentBundleResume = resolve; });
        delete globalThis.__cocosAgentBundleCheckpoint;
        delete globalThis.__cocosAgentBundleResume;
    };
    const initialScene = cc.director.getScene();
    const baseline = snapshot();
    const baselineFrame = manager.assets.get(frameId);
    const baselineTexture = manager.assets.get(textureId);
    if (!baselineFrame || !baselineTexture || sourceTextureForFrame(baselineFrame) !== baselineTexture) {
        const baselineSprites = spritesIn({ scene: initialScene }).map((sprite) => ({
            node: sprite.node && sprite.node.name, frameUuid: sprite.spriteFrame && sprite.spriteFrame._uuid,
            sourceTextureUuid: sourceTextureForFrame(sprite.spriteFrame) && sourceTextureForFrame(sprite.spriteFrame)._uuid,
        }));
        throw Error(`SHARED_RESOURCE_NOT_IN_BASELINE_SCENE_${JSON.stringify({ frame: baselineFrame && {
            uuid: baselineFrame._uuid, type: baselineFrame.constructor && baselineFrame.constructor.name,
            keys: Object.keys(baselineFrame), textureProperty: baselineFrame.texture && baselineFrame.texture._uuid,
            internalTexture: baselineFrame._texture && { uuid: baselineFrame._texture._uuid,
                type: baselineFrame._texture.constructor && baselineFrame._texture.constructor.name,
                loaded: baselineFrame._texture.loaded, name: baselineFrame._texture._name,
                nativeUrl: baselineFrame._texture._nativeUrl, sameAsCache: baselineFrame._texture === baselineTexture,
                rendererTexture: baselineFrame._texture._texture && { width: baselineFrame._texture._texture.width,
                    height: baselineFrame._texture._texture.height },
                originalFrame: baselineFrame._original && { uuid: baselineFrame._original._uuid,
                    textureUuid: baselineFrame._original._texture && baselineFrame._original._texture._uuid } },
            textureUuidField: baselineFrame._textureUuid, rawTextureUuid: baselineFrame._rawTextureUuid,
            dependencies: cc.assetManager.dependUtil.getDeps(frameId),
        }, texture: baselineTexture && { uuid: baselineTexture._uuid, type: baselineTexture.constructor && baselineTexture.constructor.name,
            loaded: baselineTexture.loaded, valid: cc.isValid(baselineTexture, true), name: baselineTexture._name,
            nativeUrl: baselineTexture._nativeUrl, sameAsFrameTexture: baselineFrame && baselineTexture === baselineFrame._texture,
            keys: Object.keys(baselineTexture) },
            sprites: baselineSprites })}`);
    }
    if (initialScene.autoReleaseAssets !== false) throw Error('UNEXPECTED_BASELINE_SCENE_RELEASE_POLICY');
    const initialSceneSummary = { name: initialScene.name || initialScene._name || '', id: initialScene._id || null,
        autoReleaseAssets: initialScene.autoReleaseAssets, sharedFrameUuid: baselineFrame._uuid,
        sharedTextureUuid: baselineTexture._uuid,
        sourceTextureUuid: sourceTextureForFrame(baselineFrame) && sourceTextureForFrame(baselineFrame)._uuid,
        renderTextureUuid: renderTextureForFrame(baselineFrame) && renderTextureForFrame(baselineFrame)._uuid || null,
        renderTextureLoaded: Boolean(renderTextureForFrame(baselineFrame) && renderTextureForFrame(baselineFrame).loaded) };
    baselineFrame.addRef();
    baselineTexture.addRef();
    const blankBeforeTest = new cc.Scene();
    blankBeforeTest._id = `cocos-agent-bundle-baseline-${Date.now()}`;
    cc.director.runSceneImmediate(blankBeforeTest);
    await delayFrame();
    await delayFrame();
    const baselineAfterInitialSceneExit = snapshot();
    if (!manager.assets.has(frameId) || !manager.assets.has(textureId)
        || baselineFrame.refCount < 1 || baselineTexture.refCount < 1)
        throw Error('EXPLICIT_BASELINE_HOLD_DID_NOT_RETAIN_SHARED_ASSETS');
    const resources = manager.getBundle('resources') || await loadBundle('resources');
    const beforeSharedLoad = snapshot();
    const retainedBaseline = snapshot();
    const baselineFrameRefs = baselineFrame.refCount;
    const baselineTextureRefs = baselineTexture.refCount;
    const cycles = [];
    for (let cycleIndex = 0; cycleIndex < 2; cycleIndex++) {
        const bundleRecords = [];
        for (const spec of specs) {
            const bundle = await loadBundle(spec.name);
            if (!Array.isArray(bundle.deps) || !bundle.deps.includes('resources')) throw Error(`RUNTIME_DEPENDENCY_MISSING_${spec.name}`);
            const redirected = bundle.getAssetInfo(frameId);
            if (!redirected || redirected.redirect !== 'resources')
                throw Error(`SHARED_ASSET_REDIRECT_MISSING_${spec.name}_info=${JSON.stringify(redirected)}`);
            bundleRecords.push({ spec, bundle, redirect: redirected.redirect });
        }
        const scenes = [];
        for (const record of bundleRecords) {
            const sceneAsset = await loadScene(record.bundle, record.spec.scene);
            const sprites = spritesIn(sceneAsset);
            if (!sceneAsset.scene || sprites.length !== 1)
                throw Error(`SCENE_FIXTURE_MISMATCH_${record.spec.scene}_scene=${!!sceneAsset.scene}_autoRelease=${sceneAsset.scene && sceneAsset.scene.autoReleaseAssets}_sprites=${sprites.length}`);
            if (sceneAsset._uuid !== record.spec.sceneUuid) throw Error(`SCENE_UUID_MISMATCH_${record.spec.scene}`);
            const referencedFrame = sprites[0].spriteFrame;
            if (!referencedFrame) throw Error(`SCENE_REFERENCE_MISSING_${record.spec.scene}_cached=${manager.assets.has(frameId)}_assetUuid=${manager.assets.get(frameId) && manager.assets.get(frameId)._uuid}`);
            if (referencedFrame._uuid !== frameId)
                throw Error(`SCENE_REFERENCE_MISMATCH_${record.spec.scene}_frame=${referencedFrame._uuid}`);
            scenes.push({ record, sceneAsset, sprite: sprites[0] });
        }
        const sharedFrame = scenes[0].sprite.spriteFrame;
        const sharedTexture = manager.assets.get(textureId);
        if (sharedFrame !== scenes[1].sprite.spriteFrame || !sharedTexture || sharedTexture !== manager.assets.get(textureId))
            throw Error('SCENES_DID_NOT_SHARE_EXACT_ASSET_INSTANCES');
        const sharedAssetIdentity = { spriteFrameUuid: sharedFrame._uuid, textureUuid: sharedTexture._uuid,
            sameSpriteFrameObject: scenes[0].sprite.spriteFrame === scenes[1].sprite.spriteFrame,
            sameTextureCacheObject: manager.assets.get(textureId) === sharedTexture,
            sourceTextureUuids: scenes.map(({ sprite }) => sourceTextureForFrame(sprite.spriteFrame) && sourceTextureForFrame(sprite.spriteFrame)._uuid) };
        const importedAutoReleaseSettings = scenes.map(({ record, sceneAsset }) => ({
            scene: record.spec.scene, importedValue: sceneAsset.scene.autoReleaseAssets,
        }));
        for (const { sceneAsset } of scenes) sceneAsset.scene.autoReleaseAssets = true;
        const afterBothLoaded = snapshot();
        if (sharedFrame.refCount < baselineFrameRefs + 2) throw Error('SCENE_DEPENDENCY_REFS_NOT_BOTH_HELD');
        await runScene(scenes[0].sceneAsset);
        await delayFrame();
        if (sourceTextureForFrame(scenes[0].sprite.spriteFrame) !== sharedTexture
            || !renderTextureForFrame(scenes[0].sprite.spriteFrame)?.loaded
            || !scenes[0].sprite.enabledInHierarchy)
            throw Error(`FIRST_SCENE_VISIBLE_RESOURCE_CHAIN_FAILED_${JSON.stringify({ sourceTextureUuid: sourceTextureForFrame(scenes[0].sprite.spriteFrame) && sourceTextureForFrame(scenes[0].sprite.spriteFrame)._uuid, renderTextureLoaded: renderTextureForFrame(scenes[0].sprite.spriteFrame)?.loaded, spriteEnabled: scenes[0].sprite.enabledInHierarchy })}`);
        await visualCheckpoint(`cycle-${cycleIndex + 1}-first-scene`, scenes[0].sprite);
        const firstSceneActive = { name: cc.director.getScene().name, frameRefCount: sharedFrame.refCount,
            sourceTextureUuid: sourceTextureForFrame(sharedFrame) && sourceTextureForFrame(sharedFrame)._uuid,
            renderTextureUuid: renderTextureForFrame(sharedFrame) && renderTextureForFrame(sharedFrame)._uuid || null,
            textureRefCount: sharedTexture.refCount,
            textureLoaded: sharedTexture.loaded, spriteEnabled: scenes[0].sprite.enabledInHierarchy };
        const releaseOrder = cycleIndex === 0 ? bundleRecords : [...bundleRecords].reverse();
        const unloadSteps = [];
        for (const record of releaseOrder) {
            record.bundle.releaseAll();
            manager.removeBundle(record.bundle);
            await delayFrame();
            const surviving = bundleRecords.find((candidate) => candidate !== record && manager.getBundle(candidate.spec.name) === candidate.bundle);
            const state = { unloaded: record.spec.name, sharedFrameRefCount: sharedFrame.refCount,
                sharedTextureRefCount: sharedTexture.refCount, sharedFrameValid: cc.isValid(sharedFrame, true),
                sharedTextureValid: cc.isValid(sharedTexture, true), frameCached: manager.assets.has(frameId),
                textureCached: manager.assets.has(textureId), bundleCached: !!manager.getBundle(record.spec.name),
                survivingBundle: surviving ? surviving.spec.name : null };
            if (!state.sharedFrameValid || !state.sharedTextureValid || !state.frameCached || !state.textureCached)
                throw Error(`SHARED_DEPENDENCY_DAMAGED_AFTER_${record.spec.name}`);
            if (state.bundleCached) throw Error(`UNLOADED_BUNDLE_REMAINS_CACHED_${record.spec.name}`);
            if (unloadSteps.length === 0 && !state.survivingBundle) throw Error('SURVIVING_BUNDLE_NOT_CACHED');
            unloadSteps.push(state);
        }
        await runScene(scenes[1].sceneAsset);
        await delayFrame();
        if (cc.director.getScene()._id !== scenes[1].record.spec.sceneUuid
            || scenes[1].sprite.spriteFrame !== sharedFrame || sourceTextureForFrame(scenes[1].sprite.spriteFrame) !== sharedTexture
            || !renderTextureForFrame(scenes[1].sprite.spriteFrame)?.loaded
            || !cc.isValid(sharedTexture, true) || !scenes[1].sprite.enabledInHierarchy)
            throw Error('SCENE_COULD_NOT_RUN_AFTER_BUNDLE_UNLOAD');
        await visualCheckpoint(`cycle-${cycleIndex + 1}-second-scene`, scenes[1].sprite);
        const secondSceneActive = { name: cc.director.getScene().name, id: cc.director.getScene()._id,
            frameRefCount: sharedFrame.refCount, sourceTextureUuid: sourceTextureForFrame(sharedFrame) && sourceTextureForFrame(sharedFrame)._uuid,
            renderTextureUuid: renderTextureForFrame(sharedFrame) && renderTextureForFrame(sharedFrame)._uuid || null,
            textureRefCount: sharedTexture.refCount, textureLoaded: sharedTexture.loaded,
            spriteEnabled: scenes[1].sprite.enabledInHierarchy };
        const blankScene = new cc.Scene();
        blankScene._id = `cocos-agent-bundle-release-${Date.now()}-${cycleIndex}`;
        cc.director.runSceneImmediate(blankScene);
        await delayFrame();
        const afterSceneExit = snapshot();
        if (sharedFrame.refCount !== baselineFrameRefs || sharedTexture.refCount !== baselineTextureRefs)
            throw Error(`SCENE_DEPENDENCY_REFS_DID_NOT_RETURN_TO_BASELINE_${JSON.stringify({ baselineFrameRefs,
                currentFrameRefs: sharedFrame.refCount, baselineTextureRefs, currentTextureRefs: sharedTexture.refCount,
                sceneAssetRefs: scenes.map(({ sceneAsset }) => sceneAsset.refCount), afterSceneExit })}`);
        const afterBundleRemoval = snapshot();
        if (afterBundleRemoval.assetCacheCount !== retainedBaseline.assetCacheCount
            || afterBundleRemoval.bundleCacheCount !== retainedBaseline.bundleCacheCount
            || JSON.stringify(afterBundleRemoval.bundleNames) !== JSON.stringify(retainedBaseline.bundleNames))
            throw Error(`CACHE_BASELINE_DID_NOT_RECOVER_baseline=${JSON.stringify(retainedBaseline)}_actual=${JSON.stringify(afterBundleRemoval)}`);
        cycles.push({ releaseOrder: releaseOrder.map((record) => record.spec.name), bundleDependencies: bundleRecords.map(({ spec, redirect }) => ({ name: spec.name, scene: spec.scene, redirect })), importedAutoReleaseSettings,
            sharedAssetIdentity,
            afterBothLoaded, firstSceneActive, unloadSteps, secondSceneActive, afterSceneExit, afterBundleRemoval });
    }
    baselineFrame.decRef();
    baselineTexture.decRef();
    await delayFrame();
    await delayFrame();
    const afterProbeHoldsReleased = snapshot();
    if (manager.assets.has(frameId) || manager.assets.has(textureId))
        throw Error(`SHARED_ASSETS_REMAIN_AFTER_FINAL_PROBE_HOLD_${JSON.stringify(afterProbeHoldsReleased)}`);
    return { creatorVersion: '2.4.15', beforeSharedLoad, baseline, baselineAfterInitialSceneExit,
        retainedBaseline, cycles, afterProbeHoldsReleased,
        initialScene: initialSceneSummary,
        interpretation: 'Both Bundle scenes resolve the same SpriteFrame and its source Texture already held by the initial resources scene. In this Creator 2.4.15 preview, frame._original._texture identifies the source asset while frame._texture may be a dynamic-atlas render texture. Screenshots capture the visible Sprite before and after each release order. The probe explicitly enables autoReleaseAssets on loaded Bundle scene objects and records imported metadata values separately.' };
}.toString()})(${JSON.stringify(bundles)},${JSON.stringify(frameUuid)},${JSON.stringify(textureUuid)})`;

async function main() {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const url = `http://127.0.0.1:${server.address().port}/`;
    await startBrowser(url);
    const pendingProbe = evaluate(`(async () => {
        try { return await ${probeExpression}; }
        catch (error) { return { probeError: String(error && error.stack || error) }; }
    })()`).then((result) => ({ result }), (error) => ({ error }));
    let probeStatus = null;
    pendingProbe.then((status) => { probeStatus = status; });
    const visualEvidence = [];
    const visualDirectory = path.join(root, 'docs/agent-foundation/traces/visual');
    fs.mkdirSync(visualDirectory, { recursive: true });
    const checkpointIds = ['cycle-1-first-scene', 'cycle-1-second-scene', 'cycle-2-first-scene', 'cycle-2-second-scene'];
    for (const checkpointId of checkpointIds) {
        let checkpoint = null;
        for (let attempt = 0; attempt < 300; attempt++) {
            checkpoint = await evaluate('globalThis.__cocosAgentBundleCheckpoint || null');
            if (checkpoint) break;
            if (probeStatus?.error) throw probeStatus.error;
            if (probeStatus?.result?.probeError) throw Error(probeStatus.result.probeError);
            await delay(100);
        }
        if (!checkpoint) throw Error(`VISUAL_CHECKPOINT_TIMEOUT_${checkpointId}`);
        if (checkpoint.id !== checkpointId) throw Error(`VISUAL_CHECKPOINT_ORDER_${checkpoint.id}_EXPECTED_${checkpointId}`);
        const captured = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
        const filename = `cocos-agent-shared-bundle-${checkpointId}.png`;
        const screenshotPath = path.join(visualDirectory, filename);
        const screenshotBytes = Buffer.from(captured.data, 'base64');
        fs.writeFileSync(screenshotPath, screenshotBytes);
        visualEvidence.push({ checkpoint, file: path.relative(root, screenshotPath),
            sha256: require('node:crypto').createHash('sha256').update(screenshotBytes).digest('hex') });
        await evaluate('globalThis.__cocosAgentBundleResume()');
    }
    const pendingResult = await pendingProbe;
    if (pendingResult.error) throw pendingResult.error;
    const result = pendingResult.result;
    if (result && result.probeError) throw Error(result.probeError);
    const trace = { observedAt: new Date().toISOString(), creatorVersion: '2.4.15',
        buildOutput: path.relative(root, webRoot), sharedFrameUuid: frameUuid, sharedTextureUuid: textureUuid,
        bundles: builtBundles, visualEvidence, result };
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
