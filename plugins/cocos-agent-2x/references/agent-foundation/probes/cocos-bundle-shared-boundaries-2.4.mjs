// Verify missing-owner redirect behavior and autoReleaseAssets=false retention
// against the existing Creator 2.4.15 Web-Mobile fixture.
// Usage: node docs/agent-foundation/probes/cocos-bundle-shared-boundaries-2.4.mjs <web-mobile-root>
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
    '2.4.15NewProject/build/cocos-agent/shared-dependency-20261010-01/web-mobile'));
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const frameUuid = '0683b14a-8790-4ecd-9ee5-4b83163e34ff';
const textureUuid = 'bf8602ca-5561-4eb5-8c63-9653d4c32a4f';
const consumerNames = ['cocos-agent-smoke', 'cocos-agent-sidecar'];
const sceneSpecs = [
    { bundle: 'cocos-agent-smoke', scene: 'BundleSharedA', sceneUuid: 'd86b9b2f-5d52-43b3-b2c7-5e345f9960e4' },
    { bundle: 'cocos-agent-sidecar', scene: 'BundleSharedB', sceneUuid: '53751717-051c-4b3d-abe7-19bfc2b3990a' },
];
const contentTypes = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.webp': 'image/webp' };

function compactUuid(uuid) {
    const hex = uuid.replace(/-/g, '').toLowerCase();
    const encoded = Buffer.from(hex.slice(2), 'hex').toString('base64').replace(/=/g, '');
    return encoded.startsWith('/') ? `${hex.slice(0, 2)}/${encoded.slice(1)}` : `${hex.slice(0, 2)}${encoded}`;
}

function readConfig(name) {
    const directory = path.join(webRoot, 'assets', name);
    const files = fs.readdirSync(directory).filter((filename) => /^config\..+\.json$/.test(filename));
    if (files.length !== 1) throw Error(`BUNDLE_CONFIG_COUNT_${name}_${files.length}`);
    const filename = path.join(directory, files[0]);
    const bytes = fs.readFileSync(filename);
    return { file: path.relative(webRoot, filename), sha256: require('node:crypto').createHash('sha256').update(bytes).digest('hex'),
        config: JSON.parse(bytes.toString('utf8')) };
}

for (const file of ['index.html']) if (!fs.existsSync(path.join(webRoot, file))) throw Error(`WEB_MOBILE_${file}_NOT_FOUND`);
if (!fs.existsSync(chromePath)) throw Error('CHROME_NOT_FOUND');
const configEvidence = Object.fromEntries(['resources', ...consumerNames].map((name) => [name, readConfig(name)]));
const compressedFrameUuid = compactUuid(frameUuid);
const compressedTextureUuid = compactUuid(textureUuid);
function assetConfigRecord(config, uuid) {
    const compressed = compactUuid(uuid);
    const uuidIndex = config.uuids.indexOf(compressed);
    const pairIndex = (config.redirect || []).findIndex((value, index) => index % 2 === 0 && value === uuidIndex);
    const redirectBundle = pairIndex < 0 ? null : config.deps[config.redirect[pairIndex + 1]];
    return { uuid, compressedUuid: compressed, uuidIndex, pathRecord: uuidIndex < 0 ? null : config.paths?.[String(uuidIndex)] || null,
        redirectBundle };
}
const ownerConfig = configEvidence.resources.config;
if (ownerConfig.uuids.indexOf(compressedFrameUuid) < 0 || ownerConfig.uuids.indexOf(compressedTextureUuid) < 0
    || assetConfigRecord(ownerConfig, frameUuid).redirectBundle || assetConfigRecord(ownerConfig, textureUuid).redirectBundle)
    throw Error('BUILT_RESOURCES_CONFIG_DOES_NOT_OWN_SHARED_FRAME_AND_TEXTURE');
for (const name of consumerNames) {
    const config = configEvidence[name].config;
    if (!config.deps.includes('resources') || assetConfigRecord(config, frameUuid).redirectBundle !== 'resources')
        throw Error(`BUILT_CONSUMER_FRAME_REDIRECT_MISMATCH_${name}`);
}
const sourceMeta = JSON.parse(fs.readFileSync(path.join(root, '2.4.15NewProject/assets/resources/RedReleaseOct09.png.meta'), 'utf8'));
const sourceFrameMeta = sourceMeta.subMetas && sourceMeta.subMetas.RedReleaseOct09;
if (sourceMeta.uuid !== textureUuid || !sourceFrameMeta || sourceFrameMeta.uuid !== frameUuid
    || sourceFrameMeta.rawTextureUuid !== textureUuid) throw Error('SOURCE_META_UUID_CHAIN_MISMATCH');
const sourceScenes = sceneSpecs.map((spec) => {
    const source = path.join(root, '2.4.15NewProject/assets', spec.bundle === 'cocos-agent-smoke'
        ? 'CocosAgentBundleSmoke/BundleSharedA.fire' : 'CocosAgentBundleSidecar/BundleSharedB.fire');
    const text = fs.readFileSync(source, 'utf8');
    const sourceMetaPath = `${source}.meta`;
    const sceneMeta = JSON.parse(fs.readFileSync(sourceMetaPath, 'utf8'));
    const sceneJson = JSON.parse(text);
    const serializedScene = sceneJson.find((entry) => entry && entry.__type__ === 'cc.Scene');
    if (!text.includes(frameUuid)) throw Error(`SOURCE_SCENE_FRAME_UUID_MISSING_${spec.scene}`);
    return { scene: spec.scene, file: path.relative(root, source), referencesSharedFrameUuid: true,
        sceneMetaAutoReleaseAssets: sceneMeta.autoReleaseAssets,
        serializedSceneAutoReleaseAssets: serializedScene && serializedScene.autoReleaseAssets };
});
const assetRoot = path.join(webRoot, 'assets');
const bundleInventory = fs.readdirSync(assetRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).flatMap((entry) => {
    const directory = path.join(assetRoot, entry.name);
    const filename = fs.readdirSync(directory).find((candidate) => /^config\..+\.json$/.test(candidate));
    if (!filename) return [];
    const bytes = fs.readFileSync(path.join(directory, filename));
    const config = JSON.parse(bytes.toString('utf8'));
    return [{ bundleName: config.name, file: path.relative(webRoot, path.join(directory, filename)),
        sha256: require('node:crypto').createHash('sha256').update(bytes).digest('hex'),
        frame: assetConfigRecord(config, frameUuid), texture: assetConfigRecord(config, textureUuid) }];
});
for (const [uuid, key] of [[frameUuid, 'frame'], [textureUuid, 'texture']]) {
    const present = bundleInventory.filter((entry) => entry[key].uuidIndex >= 0);
    const owners = present.filter((entry) => !entry[key].redirectBundle);
    if (owners.length !== 1 || owners[0].bundleName !== 'resources')
        throw Error(`BUILT_UUID_OWNER_NOT_UNIQUE_${uuid}_${JSON.stringify({ present, owners })}`);
    if (present.some((entry) => entry.redirectBundle && entry.redirectBundle !== 'resources'))
        throw Error(`BUILT_UUID_REDIRECT_MISMATCH_${uuid}`);
}

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
let activeProfile;
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

async function startBrowser(url) {
    activeProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-bundle-boundaries-'));
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

const expression = `(${async function (sceneSpecs, frameId, textureId, expectedCompressedFrameId) {
    const cc = globalThis.cc;
    const manager = cc.assetManager;
    const snapshot = (label) => {
        const names = [];
        manager.bundles.forEach((_bundle, name) => { if (typeof name === 'string') names.push(name); });
        names.sort();
        const frame = manager.assets.get(frameId);
        const texture = manager.assets.get(textureId);
        return { label, sampledAt: new Date().toISOString(), bundleNames: names, assetCacheCount: manager.assets.count,
            bundleCacheCount: manager.bundles.count,
            frame: frame ? { uuid: frame._uuid, refCount: frame.refCount, valid: cc.isValid(frame, true) } : null,
            texture: texture ? { uuid: texture._uuid, refCount: texture.refCount, valid: cc.isValid(texture, true) } : null };
    };
    const delayFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
    const loadBundle = (name) => new Promise((resolve, reject) => {
        const cached = manager.getBundle(name);
        if (cached) { resolve(cached); return; }
        manager.loadBundle(name, (error, bundle) => error ? reject(error) : resolve(bundle));
    });
    const loadScene = (bundle, name) => new Promise((resolve, reject) => {
        bundle.loadScene(name, (error, sceneAsset) => error ? reject(error) : resolve(sceneAsset));
    });
    const loadSharedFrame = (bundle) => new Promise((resolve, reject) => {
        manager.loadAny({ uuid: frameId, bundle: bundle.name }, (error, frame) => error ? reject(error) : resolve(frame));
    });
    const spritesIn = (scene) => {
        const result = [];
        const visit = (node) => {
            for (const component of node._components || []) if (component instanceof cc.Sprite) result.push(component);
            for (const child of node._children || []) visit(child);
        };
        visit(scene);
        return result;
    };
    const runScene = (sceneAsset) => new Promise((resolve, reject) => {
        try { cc.director.runSceneImmediate(sceneAsset, null, resolve); } catch (error) { reject(error); }
    });
    const sourceTextureForFrame = (frame) => frame && (frame._original ? frame._original._texture : frame._texture);
    const initial = cc.director.getScene();
    const baseline = snapshot('startup');
    const cachedResources = manager.getBundle('resources');
    if (!cachedResources) throw Error('RESOURCE_OWNER_NOT_CACHED_AT_STARTUP');
    const baselineFrame = manager.assets.get(frameId);
    if (!baselineFrame) throw Error('SHARED_FRAME_NOT_CACHED_AT_STARTUP');
    const ownerManifest = cachedResources.getAssetInfo(frameId);
    if (!ownerManifest || ownerManifest.redirect) throw Error('RESOURCE_OWNER_CONFIG_DOES_NOT_OWN_SHARED_FRAME');

    // Run in a throwaway preview process. Release the owner-delivered resource and remove its Bundle object,
    // then observe the exact redirect error from a newly loaded consumer scene.
    const blank = new cc.Scene();
    blank._id = `cocos-agent-owner-missing-${Date.now()}`;
    cc.director.runSceneImmediate(blank);
    const resourceOwner = manager.getBundle('resources');
    manager.releaseAsset(baselineFrame);
    manager.removeBundle(resourceOwner);
    await delayFrame();
    const ownerMissingBeforeConsumer = snapshot('owner-removed-before-consumer');
    if (manager.getBundle('resources')) throw Error('OWNER_BUNDLE_STILL_CACHED_AFTER_REMOVE');
    if (manager.assets.has(frameId)) throw Error(`OWNER_FRAME_STILL_CACHED_AFTER_RELEASE_${JSON.stringify(ownerMissingBeforeConsumer)}`);
    for (const name of [...new Set(sceneSpecs.map((spec) => spec.bundle))]) {
        const cached = manager.getBundle(name);
        if (cached) manager.removeBundle(cached);
    }
    const consumer = await loadBundle(sceneSpecs[0].bundle);
    const consumerRedirect = consumer.getAssetInfo(frameId);
    if (!consumerRedirect || consumerRedirect.redirect !== 'resources') throw Error('CONSUMER_REDIRECT_NOT_RESOURCES');
    let missingOwnerError = null;
    let missingOwnerFrame = null;
    try { missingOwnerFrame = await loadSharedFrame(consumer); }
    catch (error) { missingOwnerError = String(error && error.message || error); }
    if (!missingOwnerError || !/load bundle resources first/i.test(missingOwnerError))
        throw Error(`OWNER_MISSING_LOAD_RESULT_${JSON.stringify({ error: missingOwnerError,
            frameUuid: missingOwnerFrame && missingOwnerFrame._uuid,
            consumerPathInfo: consumer.getInfoWithPath('RedReleaseOct09', cc.SpriteFrame),
            snapshot: snapshot('owner-absent-direct-load-result') })}`);
    const ownerMissingResult = { before: ownerMissingBeforeConsumer, consumerBundleLoaded: !!manager.getBundle(sceneSpecs[0].bundle),
        consumerRedirect: consumerRedirect.redirect, redirectedAssetLoadRejected: true, error: missingOwnerError };

    // Restore the required owner first; the same consumer request must now succeed.
    const ownerReloaded = await loadBundle('resources');
    const recoveredFrame = await loadSharedFrame(consumer);
    if (!recoveredFrame || recoveredFrame._uuid !== frameId) throw Error('OWNER_FIRST_RECOVERY_FRAME_MISMATCH');
    const recoveredSceneAsset = await loadScene(consumer, sceneSpecs[0].scene);
    if (!recoveredSceneAsset.scene || recoveredSceneAsset._uuid !== sceneSpecs[0].sceneUuid)
        throw Error('OWNER_FIRST_RECOVERY_SCENE_MISMATCH');
    const recovery = { loadedOwnerBeforeRetry: !!ownerReloaded, sharedFrameUuid: recoveredFrame._uuid,
        redirectedAssetLoadSucceeded: true, sceneUuid: recoveredSceneAsset._uuid,
        sceneLoadSucceeded: true, snapshot: snapshot('after-owner-first-recovery') };

    const records = [];
    for (const spec of sceneSpecs) {
        const bundle = manager.getBundle(spec.bundle) || await loadBundle(spec.bundle);
        const redirected = bundle.getAssetInfo(frameId);
        if (!redirected || redirected.redirect !== 'resources') throw Error(`REDIRECT_LOST_${spec.bundle}`);
        const sceneAsset = spec === sceneSpecs[0] ? recoveredSceneAsset : await loadScene(bundle, spec.scene);
        if (!sceneAsset.scene || sceneAsset._uuid !== spec.sceneUuid) throw Error(`SCENE_MISMATCH_${spec.scene}`);
        const sprites = spritesIn(sceneAsset.scene);
        if (sprites.length !== 1 || !sprites[0].spriteFrame || sprites[0].spriteFrame._uuid !== frameId)
            throw Error(`SHARED_SCENE_SPRITE_MISMATCH_${spec.scene}`);
        records.push({ spec, bundle, sceneAsset, sprite: sprites[0], importedAutoReleaseAssets: sceneAsset.scene.autoReleaseAssets });
    }
    const sharedFrame = records[0].sprite.spriteFrame;
    const sharedTexture = manager.assets.get(textureId);
    if (records[1].sprite.spriteFrame !== sharedFrame || sourceTextureForFrame(sharedFrame) !== sharedTexture)
        throw Error('SCENES_NOT_SHARING_OWNER_ASSET_INSTANCE');
    // The runtime scene flag is the value that controls _autoRelease; preserve the loaded value and assert false.
    if (records.some((record) => record.sceneAsset.scene.autoReleaseAssets !== false))
        throw Error(`SCENE_RUNTIME_AUTO_RELEASE_NOT_FALSE_${JSON.stringify(records.map((record) => ({scene:record.spec.scene, value:record.sceneAsset.scene.autoReleaseAssets, imported:record.importedAutoReleaseAssets})))}`);
    const beforeSceneRun = snapshot('both-scene-assets-loaded-runtime-auto-release-false');
    await runScene(records[0].sceneAsset);
    await delayFrame();
    await runScene(records[1].sceneAsset);
    await delayFrame();
    const afterSwitchWithFalse = snapshot('after-switch-to-second-scene-auto-release-false');
    if (cc.director.getScene()._id !== sceneSpecs[1].sceneUuid || !cc.isValid(sharedFrame, true)
        || !cc.isValid(sharedTexture, true) || !manager.assets.has(frameId) || !manager.assets.has(textureId)
        || records[1].sprite.spriteFrame !== sharedFrame || !records[1].sprite.enabledInHierarchy)
        throw Error('SHARED_RESOURCE_NOT_RETAINED_AFTER_SCENE_SWITCH_FALSE');

    const consumerUnload = [];
    for (const record of records) {
        record.bundle.releaseAll();
        manager.removeBundle(record.bundle);
        await delayFrame();
        const state = { removedConsumer: record.spec.bundle, bundleCached: !!manager.getBundle(record.spec.bundle),
            frameRefCount: sharedFrame.refCount, textureRefCount: sharedTexture.refCount,
            frameCached: manager.assets.has(frameId), textureCached: manager.assets.has(textureId),
            frameValid: cc.isValid(sharedFrame, true), textureValid: cc.isValid(sharedTexture, true),
            activeScene: cc.director.getScene().name, activeSpriteEnabled: records[1].sprite.enabledInHierarchy };
        if (state.bundleCached || !state.frameCached || !state.textureCached || !state.frameValid || !state.textureValid)
            throw Error(`SHARED_ASSET_DAMAGED_WHILE_CONSUMER_ACTIVE_${record.spec.bundle}`);
        consumerUnload.push(state);
    }

    const ownerBundle = manager.getBundle('resources');
    ownerBundle.releaseUnusedAssets();
    await delayFrame();
    await delayFrame();
    const ownerUnusedReleaseWhileActive = snapshot('owner-release-unused-while-consumer-active');
    if (!cc.isValid(sharedFrame, true) || !cc.isValid(sharedTexture, true)
        || !manager.assets.has(frameId) || !manager.assets.has(textureId)
        || cc.director.getScene()._id !== sceneSpecs[1].sceneUuid)
        throw Error('NONFORCED_OWNER_RELEASE_DAMAGED_ACTIVE_SHARED_ASSET');

    // Bundle object removal only: keep the shared assets untouched while the active consumer scene still uses them.
    manager.removeBundle(ownerBundle);
    await delayFrame();
    const activeSceneAfterOwnerBundleRemoval = snapshot('owner-bundle-object-removed-but-active-consumer-still-uses-asset');
    const checkpoint = { scene: cc.director.getScene().name, sceneUuid: cc.director.getScene()._id,
        frameUuid: records[1].sprite.spriteFrame && records[1].sprite.spriteFrame._uuid,
        sourceTextureUuid: sourceTextureForFrame(records[1].sprite.spriteFrame) && sourceTextureForFrame(records[1].sprite.spriteFrame)._uuid,
        spriteEnabled: records[1].sprite.enabledInHierarchy,
        frameValid: cc.isValid(sharedFrame, true), textureValid: cc.isValid(sharedTexture, true),
        frameCached: manager.assets.has(frameId), textureCached: manager.assets.has(textureId) };
    if (!checkpoint.spriteEnabled || checkpoint.frameUuid !== frameId || checkpoint.sourceTextureUuid !== textureId
        || !checkpoint.frameValid || !checkpoint.textureValid || !checkpoint.frameCached || !checkpoint.textureCached)
        throw Error('ACTIVE_SHARED_SCENE_DAMAGED_BY_BUNDLE_OBJECT_REMOVAL');
    globalThis.__cocosAgentBundleBoundaryCheckpoint = checkpoint;
    await new Promise((resolve) => { globalThis.__cocosAgentBundleBoundaryResume = resolve; });
    delete globalThis.__cocosAgentBundleBoundaryCheckpoint;
    delete globalThis.__cocosAgentBundleBoundaryResume;

    const blankAfter = new cc.Scene();
    blankAfter._id = `cocos-agent-auto-release-false-exit-${Date.now()}`;
    cc.director.runSceneImmediate(blankAfter);
    await delayFrame();
    await delayFrame();
    const afterExitAutoReleaseFalse = snapshot('after-exit-all-test-scenes-auto-release-false');
    const ownerReloadedForCleanup = await loadBundle('resources');
    ownerReloadedForCleanup.releaseUnusedAssets();
    await delayFrame();
    await delayFrame();
    const ownerCleanupAfterNoActiveScene = snapshot('owner-release-unused-after-all-scenes-exited');
    const screenState = { ownerMissing: ownerMissingResult, ownerFirstRecovery: recovery,
        loadedSceneSettings: records.map(({ spec, importedAutoReleaseAssets }) => ({ bundle: spec.bundle,
            scene: spec.scene, runtimeAutoReleaseAssets: false, initiallyLoadedValue: importedAutoReleaseAssets })),
        beforeSceneRun, afterSwitchWithFalse, consumerUnload, ownerUnusedReleaseWhileActive,
        activeSceneAfterOwnerBundleRemoval, visualCheckpoint: checkpoint,
        afterExitAutoReleaseFalse, ownerCleanupAfterNoActiveScene };
    return { creatorVersion: '2.4.15', baseline, sharedFrameUuid: frameId, sharedTextureUuid: textureId, screenState,
        interpretation: 'The owner-not-loaded case removes the resources Bundle and releases the owner SpriteFrame before loading a fresh consumer asset by UUID. The consumer Bundle config can load, but resolving its redirected asset fails until resources is loaded first. For autoReleaseAssets=false, the probe uses the loaded Scene runtime value without changing it; scene switches and consumer Bundle release leave the shared Frame and Texture valid. Owner releaseUnusedAssets preserves both while the consumer scene is active. Removing the resources Bundle object also leaves that scene intact, but must not be confused with releasing owner assets. After all test scenes exit, the probe retries non-forced owner cleanup and records its result. The preview process is isolated and discarded after the trace.' };
}.toString()})(${JSON.stringify(sceneSpecs)},${JSON.stringify(frameUuid)},${JSON.stringify(textureUuid)})`;

async function main() {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const url = `http://127.0.0.1:${server.address().port}/`;
    await startBrowser(url);
    const pendingProbe = evaluate(`(async () => { try { return await ${expression}; }
        catch (error) { return { probeError: String(error && error.stack || error) }; } })()`);
    let probeStatus = null;
    pendingProbe.then((result) => { probeStatus = result; });
    let checkpoint = null;
    for (let attempt = 0; attempt < 300; attempt++) {
        checkpoint = await evaluate('globalThis.__cocosAgentBundleBoundaryCheckpoint || null');
        if (checkpoint) break;
        if (probeStatus?.probeError) throw Error(probeStatus.probeError);
        await delay(100);
    }
    if (!checkpoint) throw Error('BOUNDARY_VISUAL_CHECKPOINT_TIMEOUT');
    const captured = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    const visualPath = path.join(root, 'docs/agent-foundation/traces/visual/cocos-agent-shared-boundary-auto-release-false.png');
    const visualBytes = Buffer.from(captured.data, 'base64');
    fs.writeFileSync(visualPath, visualBytes);
    await evaluate('globalThis.__cocosAgentBundleBoundaryResume()');
    const result = await pendingProbe;
    if (result && result.probeError) throw Error(result.probeError);
    const trace = { observedAt: new Date().toISOString(), creatorVersion: '2.4.15',
        buildOutput: path.relative(root, webRoot), sourceMeta: { textureUuid: sourceMeta.uuid,
            spriteFrameUuid: sourceFrameMeta.uuid, rawTextureUuid: sourceFrameMeta.rawTextureUuid }, sourceScenes, bundleInventory,
        configEvidence: Object.fromEntries(Object.entries(configEvidence).map(([name, evidence]) =>
            [name, { file: evidence.file, sha256: evidence.sha256, name: evidence.config.name, deps: evidence.config.deps,
                sceneKeys: Object.keys(evidence.config.scenes || {}), sharedFrame: assetConfigRecord(evidence.config, frameUuid),
                sourceTexture: assetConfigRecord(evidence.config, textureUuid) }])),
        visualEvidence: { checkpoint, file: path.relative(root, visualPath),
            sha256: require('node:crypto').createHash('sha256').update(visualBytes).digest('hex') }, result };
    const destination = path.join(root, 'docs/agent-foundation/traces/cocos-agent-shared-bundle-boundaries-2.4-web.json');
    fs.writeFileSync(destination, `${JSON.stringify(trace, null, 2)}\n`);
    process.stdout.write(`SHARED_BUNDLE_BOUNDARIES_VERIFIED ${destination}\n`);
}

try { await main(); }
catch (error) { process.stderr.write(`SHARED_BUNDLE_BOUNDARIES_FAILED ${error.stack || error}\n`); process.exitCode = 1; }
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
