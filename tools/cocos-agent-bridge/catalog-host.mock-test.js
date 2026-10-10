'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const WebSocket = require('./vendor/ws');
const inputs = require('./catalog.schema.json').$defs;

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-agent-catalog-'));
const projects = ['cocos2', 'cocos3'].map((name) => path.join(temporary, name));
projects.forEach((project) => fs.mkdirSync(project));
const versions = ['2.4.15', '3.8.7'];
const scenes = [path.join(projects[0], 'assets', 'Scene', 'helloworld.fire'), path.join(projects[1], 'assets', 'scene', 'main.scene')];
scenes.forEach((scene, index) => {
    fs.mkdirSync(path.dirname(scene), { recursive: true });
    fs.writeFileSync(scene, JSON.stringify({ version: versions[index], scene: path.basename(scene) }));
});
const sceneHashes = scenes.map((scene) => crypto.createHash('sha256').update(fs.readFileSync(scene)).digest('hex'));

function waitForSession(project) {
    const file = path.join(project, 'temp', 'cocos-agent-bridge', 'session.json');
    return new Promise((resolve, reject) => {
        const started = Date.now();
        const poll = () => {
            try { resolve(JSON.parse(fs.readFileSync(file, 'utf8'))); }
            catch (_) { if (Date.now() - started > 3000) reject(new Error(`Session missing: ${project}`)); else setTimeout(poll, 20); }
        };
        poll();
    });
}

async function mockEditor(index, options = {}) {
    const project = projects[index];
    const session = await waitForSession(project);
    const instanceId = crypto.randomUUID();
    const socket = new WebSocket(session.url, { headers: { 'x-cocos-agent-token': session.token } });
    await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
    socket.send(JSON.stringify({ type: 'hello', protocolVersion: '0.1', creatorVersion: options.wrongVersion && index === 0 ? versions[1] : versions[index],
        projectRoot: project, extension: 'cocos-agent-bridge', instanceId }));
    socket.on('message', (raw) => {
        const message = JSON.parse(raw.toString());
        if (message.type !== 'request') return;
        if (message.method === 'capabilities.list') {
            socket.send(JSON.stringify({ type: 'response', id: message.id, ok: true, result: {
                nonce: message.params.nonce, instanceId, creatorVersion: options.wrongCatalogVersion && index === 0 ? versions[1] : versions[index], projectRoot: project,
                extensionVersion: '0.1.0', activeScene: index === 0 ? options.sceneName || 'helloworld' : null,
                catalogRevision: crypto.createHash('sha256').update(`${index}:${options.sceneName || 'helloworld'}`).digest('hex'), commands: [
                    { id: 'scene.snapshot', contractVersion: '0.1', access: 'read', inputSchema: 'catalog.schema.json#/$defs/snapshotInput', input: inputs.snapshotInput, preconditions: ['activeScene'], status: index === 0 && !options.wrongStatus ? 'available' : 'unavailable', reason: index === 0 && !options.wrongStatus ? null : 'NO_OPEN_SCENE' },
                    { id: 'scene.node.inspect', contractVersion: '0.1', access: 'read', inputSchema: 'catalog.schema.json#/$defs/nodeInspectInput', input: inputs.nodeInspectInput, preconditions: ['activeScene'], status: index === 0 ? 'available' : 'unavailable', reason: index === 0 ? null : 'NO_OPEN_SCENE' },
                    ...(index === 0 ? [{ id: 'asset.searchPng', contractVersion: '0.1', access: 'read',
                        inputSchema: 'catalog.schema.json#/$defs/pngAssetSearchInput', input: inputs.pngAssetSearchInput,
                        preconditions: ['assetDbReady'], status: 'available', reason: null }] : []),
                    { id: 'asset.importPng', contractVersion: '0.1', access: 'write', inputSchema: 'catalog.schema.json#/$defs/importPngInput', input: inputs.importPngInput, preconditions: ['stagedPng', 'destinationFree'], status: 'available', reason: null },
                    ...(index === 0 ? [{ id: 'asset.removeImportedPng', contractVersion: '0.1', access: 'write',
                        inputSchema: 'catalog.schema.json#/$defs/removeImportedPngInput', input: inputs.removeImportedPngInput,
                        preconditions: ['assetIdentityMatches', 'noSerializedReferences'], status: 'available', reason: null },
                    { id: 'asset.validatePng', contractVersion: '0.1', access: 'read',
                        inputSchema: 'catalog.schema.json#/$defs/pipelinePngInput', input: inputs.pipelinePngInput,
                        preconditions: ['pipelineOwnedAsset', 'importedMetadata'], status: 'available', reason: null },
                    { id: 'asset.refreshPng', contractVersion: '0.1', access: 'write',
                        inputSchema: 'catalog.schema.json#/$defs/pipelinePngInput', input: inputs.pipelinePngInput,
                        preconditions: ['pipelineOwnedAsset', 'assetDbMappingStale', 'stableUuid'], status: 'available', reason: null },
                    { id: 'asset.refreshFolder', contractVersion: '0.1', access: 'write',
                        inputSchema: 'catalog.schema.json#/$defs/assetFolderRefreshInput', input: inputs.assetFolderRefreshInput,
                        preconditions: ['folderUnderAssets', 'assetDbRefreshAvailable'], status: options.refreshFolderUnavailable ? 'unavailable' : 'available',
                        reason: options.refreshFolderUnavailable ? 'ASSETDB_REFRESH_UNAVAILABLE' : null }] : []),
                    { id: 'scene.pngSprite', contractVersion: '0.1', access: 'write',
                        inputSchema: index === 0 ? 'catalog.schema.json#/$defs/pngSpriteInput2x' : 'catalog.schema.json#/$defs/pngSpriteInput',
                        input: options.wrongInput && index === 0 ? {} : index === 0 ? inputs.pngSpriteInput2x : inputs.pngSpriteInput,
                        preconditions: index === 0 ? ['activeScene', 'canvasExisting', 'spriteFrameImported'] : ['activeScene', 'spriteFrameImported'],
                        status: index === 0 && !options.noCanvas ? 'available' : 'unavailable', reason: index === 0 ? options.noCanvas ? 'CANVAS_NOT_FOUND' : null : 'NO_OPEN_SCENE' },
                    { id: 'scene.node.create', contractVersion: '0.1', access: 'write',
                        inputSchema: index === 0 ? 'catalog.schema.json#/$defs/nodeCreateInput2x' : 'catalog.schema.json#/$defs/nodeCreateInput',
                        input: index === 0 ? inputs.nodeCreateInput2x : inputs.nodeCreateInput,
                        preconditions: index === 0 ? ['activeScene', 'parentIdentity', 'componentTypesWhitelisted', 'componentSetCompatible', 'resourceReferencesResolvable', 'prefabAssetResolvableIfRequested'] : ['activeScene', 'parentIdentity'],
                        status: index === 0 ? 'available' : 'unavailable', reason: index === 0 ? null : 'NO_OPEN_SCENE' },
                    ...(index === 0 ? [{ id: 'scene.node.patch', contractVersion: '0.1', access: 'write',
                        inputSchema: 'catalog.schema.json#/$defs/nodePatchInput2x', input: inputs.nodePatchInput2x,
                        preconditions: ['activeScene', 'nodePathAndUuidMatch', 'expectedBeforeValues', 'propertyWhitelist', 'resourceReferencesResolvable'],
                        status: 'available', reason: null },
                    { id: 'prefab.source.patch', contractVersion: '0.1', access: 'write',
                        inputSchema: 'catalog.schema.json#/$defs/prefabSourcePatchInput2x', input: inputs.prefabSourcePatchInput2x,
                        preconditions: ['activeScene', 'prefabUuidResolvable', 'sourceShaMatches', 'prefabEditModeAvailable', 'nodePathAndUuidMatch', 'expectedBeforeValues'],
                        status: options.prefabPatchUnavailable ? 'unavailable' : 'available', reason: options.prefabPatchUnavailable ? 'PREFAB_EDIT_MODE_API_UNAVAILABLE' : null },
                    { id: 'prefab.source.inspect', contractVersion: '0.1', access: 'read',
                        inputSchema: 'catalog.schema.json#/$defs/prefabSourceInspectInput2x', input: inputs.prefabSourceInspectInput2x,
                        preconditions: ['prefabUuidResolvable', 'serializedPrefabReadable'], status: 'available', reason: null },
                    { id: 'content.stress.run', contractVersion: '0.1', access: 'read',
                        inputSchema: 'catalog.schema.json#/$defs/contentStressRunInput2x', input: inputs.contentStressRunInput2x,
                        preconditions: ['completedWebMobileBuild', 'packagedPngResources', 'headlessChromeProfile', 'explicitBudgets'],
                        status: 'available', reason: null }] : []),
                ],
            } }));
        } else if (message.method === 'scene.snapshot') {
            socket.send(JSON.stringify(index === 0
                ? { type: 'response', id: message.id, ok: true, result: {
                    nonce: message.params.nonce, creatorVersion: versions[index], projectRoot: project,
                    sceneName: options.snapshotSceneName || options.sceneName || 'helloworld', nodes: [{ name: 'Canvas' }],
                } }
                : { type: 'response', id: message.id, ok: false, error: { code: 'NO_OPEN_SCENE' } }));
        } else {
            throw new Error(`Unexpected write command: ${message.method}`);
        }
    });
    return socket;
}

async function run(query, project, options = {}) {
    const args = ['catalog-host.js', '--target', `2.4.15=${projects[0]}`, '--target', `3.8.7=${projects[1]}`, '--query', query];
    if (project) args.push('--project', project);
    if (options.selectedVersion) args.push('--creator-version', options.selectedVersion);
    const child = spawn(process.execPath, args, { cwd: __dirname });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });
    const sockets = await Promise.all([mockEditor(0, options), mockEditor(1, options)]);
    const exit = await new Promise((resolve) => child.on('exit', resolve));
    sockets.forEach((socket) => socket.close());
    assert.strictEqual(stderr, '');
    return { exit, data: JSON.parse(stdout.trim()) };
}

(async () => {
    const list = await run('instances.list');
    assert.strictEqual(list.exit, 0);
    assert.strictEqual(list.data.data.length, 2);
    assert.deepStrictEqual(list.data.data.map((item) => item.activeScene), ['helloworld', null]);
    const catalog = await run('capabilities.list', projects[1]);
    assert.strictEqual(catalog.exit, 0);
    assert.strictEqual(catalog.data.data.instance.projectRoot, projects[1]);
    assert.strictEqual(catalog.data.data.commands.find((item) => item.id === 'scene.pngSprite').status, 'unavailable');
    assert.strictEqual(catalog.data.data.commands.some((item) => item.id === 'asset.refreshFolder'), false, '3.8 must not inherit the 2.4 AssetDB folder command');
    assert.deepStrictEqual(catalog.data.data.commands.find((item) => item.id === 'scene.pngSprite').input.required, ['assetName', 'action']);
    const exact = await run('instances.get', projects[0], { selectedVersion: versions[0] });
    assert.strictEqual(exact.data.data.creatorVersion, versions[0]);
    const first = await run('capabilities.list', projects[0]);
    const switched = await run('capabilities.list', projects[0], { sceneName: 'stage4-empty', noCanvas: true });
    assert.notStrictEqual(first.data.data.instance.catalogRevision, switched.data.data.instance.catalogRevision);
    assert.notStrictEqual(first.data.data.instance.instanceId, switched.data.data.instance.instanceId);
    assert.strictEqual(switched.data.data.commands.find((item) => item.id === 'scene.pngSprite').reason, 'CANVAS_NOT_FOUND');
    const refreshUnavailable = await run('capabilities.list', projects[0], { refreshFolderUnavailable: true });
    const folderRefreshCommand = refreshUnavailable.data.data.commands.find((item) => item.id === 'asset.refreshFolder');
    assert.strictEqual(folderRefreshCommand.status, 'unavailable');
    assert.strictEqual(folderRefreshCommand.reason, 'ASSETDB_REFRESH_UNAVAILABLE');
    const changedDuringRead = await run('instances.get', projects[0], { snapshotSceneName: 'another-scene' });
    assert.strictEqual(changedDuringRead.data.error.code, 'SCENE_CHANGED');
    const missing = spawnSync(process.execPath, ['catalog-host.js', '--target', `2.4.15=${projects[0]}`, '--query', 'instances.get', '--project', temporary], { cwd: __dirname, encoding: 'utf8' });
    assert.strictEqual(missing.status, 1);
    assert.strictEqual(JSON.parse(missing.stdout).error.code, 'EDITOR_NOT_FOUND');
    const mismatch = await run('instances.get', projects[0], { wrongVersion: true });
    assert.strictEqual(mismatch.exit, 1);
    assert.strictEqual(mismatch.data.error.code, 'CREATOR_VERSION_MISMATCH');
    const catalogMismatch = await run('instances.get', projects[0], { wrongCatalogVersion: true });
    assert.strictEqual(catalogMismatch.data.error.code, 'CREATOR_VERSION_MISMATCH');
    const wrongInput = await run('capabilities.list', projects[0], { wrongInput: true });
    assert.strictEqual(wrongInput.data.error.code, 'CAPABILITY_CATALOG_INVALID');
    const wrongStatus = await run('capabilities.list', projects[0], { wrongStatus: true });
    assert.strictEqual(wrongStatus.data.error.code, 'CAPABILITY_CATALOG_INVALID');
    const earlyArgs = ['catalog-host.js', '--target', `2.4.15=${projects[0]}`, '--target', `3.8.7=${projects[1]}`, '--query', 'instances.get', '--project', projects[0]];
    const wrongSelection = spawnSync(process.execPath, earlyArgs.concat('--creator-version', '3.8.7'), { cwd: __dirname, encoding: 'utf8' });
    assert.strictEqual(wrongSelection.status, 1);
    assert.strictEqual(JSON.parse(wrongSelection.stdout).error.code, 'CREATOR_VERSION_MISMATCH');
    const duplicate = spawnSync(process.execPath, ['catalog-host.js', '--target', `2.4.15=${projects[0]}`, '--target', `3.8.7=${projects[0]}`], { cwd: __dirname, encoding: 'utf8' });
    assert.strictEqual(duplicate.status, 1);
    assert.strictEqual(JSON.parse(duplicate.stdout).error.code, 'AMBIGUOUS_EDITOR');
    assert.deepStrictEqual(scenes.map((scene) => crypto.createHash('sha256').update(fs.readFileSync(scene)).digest('hex')), sceneHashes);
    process.stdout.write('catalog host multi-instance and selection checks passed\n');
})().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; }).finally(() => {
    fs.rmSync(temporary, { recursive: true, force: true });
});
