'use strict';

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const childProcess = require('child_process');
const WebSocket = require('ws');
const { searchPngAssets } = require('./asset-search');
const { CredentialStore } = require('./credential-store.cjs');

const CREATOR_VERSION = '2.4.15';
const PROTOCOL_VERSION = '0.1';
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SESSION_PATH = path.join(PROJECT_ROOT, 'temp', 'cocos-agent-bridge', 'session.json');
const INBOX_PATH = path.join(PROJECT_ROOT, 'temp', 'cocos-agent-bridge', 'inbox');
let timer = null;
let socket = null;
let connecting = false;
let lastSessionId = null;
let activeSession = null;
let pendingSceneSave = null;
let assistantProcess = null;
let assistantRuntimeInfo = null;
let assistantKeyFingerprint = null;
let assistantStartupTimer = null;
let assistantCredentialRemembered = false;
let assistantStartPending = false;
let assistantStartSequence = 0;
let assistantForgetSequence = 0;
let assistantCredentialError = null;
const assistantCredentialStore = new CredentialStore();
let pendingSceneReady = null;
const instanceBytes = crypto.randomBytes(16);
instanceBytes[6] = (instanceBytes[6] & 0x0f) | 0x40;
instanceBytes[8] = (instanceBytes[8] & 0x3f) | 0x80;
const instanceHex = instanceBytes.toString('hex');
const INSTANCE_ID = `${instanceHex.slice(0, 8)}-${instanceHex.slice(8, 12)}-${instanceHex.slice(12, 16)}-${instanceHex.slice(16, 20)}-${instanceHex.slice(20)}`;
const COMMAND_INPUTS = {
    snapshot: { type: 'object', additionalProperties: false,
        properties: { targetNodeName: { type: 'string', minLength: 1, maxLength: 64 } } },
    nodeInspect: { type: 'object', additionalProperties: false, required: ['nodePath'],
        properties: { nodePath: { type: 'string', minLength: 1, maxLength: 240 } } },
    searchPng: { type: 'object', additionalProperties: false, required: ['query'],
        properties: { query: { type: 'string', minLength: 1, maxLength: 80, pattern: '^[^\\u0000-\\u001f\\u007f]+$' },
            limit: { type: 'integer', minimum: 1, maximum: 50 }, offset: { type: 'integer', minimum: 0, maximum: 100000 } } },
    importPng: { type: 'object', additionalProperties: false, required: ['sourcePath'],
        properties: { sourcePath: { type: 'string', minLength: 1 } } },
    removeImportedPng: { type: 'object', additionalProperties: false, required: ['assetName', 'textureUuid', 'spriteFrameUuid', 'sha256'],
        properties: {
            assetName: { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9_.-]{0,94}\\.png$' },
            textureUuid: { type: 'string', pattern: '^[0-9a-fA-F-]{36}$' },
            spriteFrameUuid: { type: 'string', pattern: '^[0-9a-fA-F-]{36}$' },
            sha256: { type: 'string', pattern: '^[0-9a-f]{64}$' },
        } },
    validatePng: { type: 'object', additionalProperties: false, required: ['pipelineId', 'assetName'],
        properties: { pipelineId: { type: 'string', format: 'uuid' },
            assetName: { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9_.-]{0,94}\\.png$' } } },
    refreshFolder: { type: 'object', additionalProperties: false, required: ['folderPath'],
        properties: { folderPath: { type: 'string', minLength: 1, maxLength: 240,
            pattern: '^[A-Za-z0-9][A-Za-z0-9_.-]*(?:/[A-Za-z0-9][A-Za-z0-9_.-]*){0,7}$' } } },
    refreshPng: { type: 'object', additionalProperties: false, required: ['pipelineId', 'assetName'],
        properties: { pipelineId: { type: 'string', format: 'uuid' },
            assetName: { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9_.-]{0,94}\\.png$' } } },
    pngSprite: { type: 'object', additionalProperties: false, required: ['assetName', 'action'],
        properties: {
            assetName: { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9_.-]{0,94}\\.png$' },
            action: { enum: ['apply', 'compensate', 'replay'] },
            operationId: { type: 'string', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' },
            position: { $ref: '#/$defs/canvasPosition' },
        } },
    nodeCreate: { type: 'object', additionalProperties: false, required: ['parentPath', 'parentUuid', 'nodeName', 'action'],
        properties: {
            parentPath: { type: 'string', minLength: 1, maxLength: 240 },
            parentUuid: { type: 'string', minLength: 1, maxLength: 64 },
            nodeName: { type: 'string', pattern: '^[A-Za-z0-9_ -]{1,64}$' },
            action: { enum: ['apply', 'compensate', 'replay'] },
            components: { type: 'array', maxItems: 1, items: { oneOf: [
                { type: 'object', additionalProperties: false, required: ['classId', 'spriteFrameUuid'], properties: {
                    classId: { const: 'cc.Sprite' }, spriteFrameUuid: { type: 'string', pattern: '^[0-9a-fA-F-]{36}$' } } },
                { type: 'object', additionalProperties: false, required: ['classId', 'text'], properties: {
                    classId: { const: 'cc.Label' }, text: { type: 'string', maxLength: 256 } } },
            ] } },
            transform: { type: 'object', additionalProperties: false, properties: {
                position: { $ref: '#/$defs/canvasPosition' }, scale: { $ref: '#/$defs/canvasPosition' },
            } },
            prefabMode: { enum: ['create', 'instantiate'] },
            prefabUuid: { type: 'string', pattern: '^[0-9a-fA-F-]{36}$' },
            sourceOperationId: { type: 'string', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' },
            operationId: { type: 'string', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' },
        },
        allOf: [
            { if: { properties: { prefabMode: { const: 'instantiate' } }, required: ['prefabMode'] }, then: { required: ['prefabUuid'] } },
            { if: { properties: { prefabMode: { const: 'create' } }, required: ['prefabMode'] }, then: { not: { required: ['prefabUuid'] } } },
        ] },
    nodePatch: { type: 'object', additionalProperties: false, required: ['targetNodePath', 'targetNodeUuid', 'action', 'expectedDiff'],
        properties: {
            targetNodePath: { type: 'string', minLength: 1, maxLength: 240 },
            targetNodeUuid: { type: 'string', minLength: 1, maxLength: 64, pattern: '^[A-Za-z0-9_+/=-]+$' },
            action: { enum: ['apply', 'compensate', 'replay'] },
            expectedDiff: { type: 'array', minItems: 1, maxItems: 16, items: { type: 'object', additionalProperties: false,
                required: ['path', 'before', 'after'], properties: { path: { enum: ['node.name', 'node.active', 'node.position.x', 'node.position.y',
                    'node.scale.x', 'node.scale.y', 'component.cc.Sprite.enabled', 'component.cc.Sprite.spriteFrameUuid',
                    'component.cc.Label.enabled'] }, before: {}, after: {} } } },
            sourceOperationId: { type: 'string', pattern: '^[0-9a-fA-F-]{36}$' },
            operationId: { type: 'string', pattern: '^[0-9a-fA-F-]{36}$' },
        } },
    prefabSourcePatch: { type: 'object', additionalProperties: false,
        required: ['prefabUuid', 'targetNodePath', 'targetNodeUuid', 'action', 'expectedDiff'],
        properties: {
            prefabUuid: { type: 'string', pattern: '^[0-9a-fA-F-]{36}$' },
            targetNodePath: { type: 'string', minLength: 1, maxLength: 240 },
            targetNodeUuid: { type: 'string', minLength: 1, maxLength: 64, pattern: '^[A-Za-z0-9_+/=-]+$' },
            expectedPrefabSha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
            action: { enum: ['apply', 'compensate', 'replay'] },
            expectedDiff: { type: 'array', minItems: 1, maxItems: 16, items: { type: 'object', additionalProperties: false,
                required: ['path', 'before', 'after'], properties: { path: { enum: ['node.name', 'node.active', 'node.position.x', 'node.position.y',
                    'node.scale.x', 'node.scale.y', 'component.cc.Sprite.enabled', 'component.cc.Sprite.spriteFrameUuid',
                    'component.cc.Label.enabled'] }, before: {}, after: {} } } },
            sourceOperationId: { type: 'string', pattern: '^[0-9a-fA-F-]{36}$' },
            operationId: { type: 'string', pattern: '^[0-9a-fA-F-]{36}$' },
        }, allOf: [
            { if: { properties: { action: { const: 'apply' } }, required: ['action'] },
                then: { required: ['expectedPrefabSha256'], not: { required: ['sourceOperationId'] } } },
            { if: { properties: { action: { enum: ['compensate', 'replay'] } }, required: ['action'] },
                then: { required: ['sourceOperationId'] } },
        ] },
    prefabSourceInspect: { type: 'object', additionalProperties: false, required: ['prefabUuid'],
        properties: { prefabUuid: { type: 'string', pattern: '^[0-9a-fA-F-]{36}$' } } },
    contentStressRun: { type: 'object', additionalProperties: false,
        required: ['buildId', 'resourcePaths', 'parseFixturePaths', 'failureResourcePath', 'cycles', 'nodeCount', 'packable', 'profileId', 'loadMode', 'budgetProfileId', 'budgets'],
        properties: {
            buildId: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{2,31}$' },
            resourcePaths: { type: 'array', minItems: 2, maxItems: 16, uniqueItems: true,
                items: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,64}(?:/[A-Za-z0-9_-]{1,64}){0,7}$' } },
            parseFixturePaths: { type: 'array', minItems: 2, maxItems: 16, uniqueItems: true,
                items: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,64}(?:/[A-Za-z0-9_-]{1,64}){0,7}$' } },
            failureResourcePath: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,64}(?:/[A-Za-z0-9_-]{1,64}){0,7}$' },
            cycles: { type: 'integer', minimum: 8, maximum: 256 },
            nodeCount: { type: 'integer', minimum: 32, maximum: 1024 },
            packable: { type: 'boolean' },
            profileId: { const: 'macos-arm64-chrome-headless-swiftshader-1280x800' },
            loadMode: { const: 'cold-and-warm' },
            budgetProfileId: { const: 'macos-arm64-headless-swiftshader-host-screening-v1' },
            budgets: { type: 'object', additionalProperties: false,
                required: ['targetFps', 'maxColdResourceLoadP95Ms', 'maxWarmResourceLoadP95Ms', 'maxImportParserP95Ms', 'maxPngParserP95Ms', 'maxReleaseCallP95Ms', 'maxEstimatedRgbaWorkingSetBytes'],
                properties: {
                    targetFps: { type: 'number', minimum: 1, maximum: 360 },
                    maxColdResourceLoadP95Ms: { type: 'number', minimum: 0.01, maximum: 60000 },
                    maxWarmResourceLoadP95Ms: { type: 'number', minimum: 0.01, maximum: 60000 },
                    maxImportParserP95Ms: { type: 'number', minimum: 0.01, maximum: 60000 },
                    maxPngParserP95Ms: { type: 'number', minimum: 0.01, maximum: 60000 },
                    maxReleaseCallP95Ms: { type: 'number', minimum: 0.01, maximum: 60000 },
                    maxEstimatedRgbaWorkingSetBytes: { type: 'integer', minimum: 1048576, maximum: 1073741824 },
                } },
        } },
};

function commandCatalog(context) {
    const sceneReady = typeof context.sceneName === 'string' && context.sceneName.length > 0;
    const spriteReady = sceneReady && context.hasCanvas === true;
    const assetDbReady = context.assetDbReady === true;
    return [
        { id: 'scene.snapshot', contractVersion: '0.1', access: 'read',
            inputSchema: 'catalog.schema.json#/$defs/snapshotInput', input: COMMAND_INPUTS.snapshot, preconditions: ['activeScene'],
            status: sceneReady ? 'available' : 'unavailable', reason: sceneReady ? null : 'NO_OPEN_SCENE' },
        { id: 'scene.node.inspect', contractVersion: '0.1', access: 'read',
            inputSchema: 'catalog.schema.json#/$defs/nodeInspectInput', input: COMMAND_INPUTS.nodeInspect, preconditions: ['activeScene'],
            status: sceneReady ? 'available' : 'unavailable', reason: sceneReady ? null : 'NO_OPEN_SCENE' },
        { id: 'asset.searchPng', contractVersion: '0.1', access: 'read',
            inputSchema: 'catalog.schema.json#/$defs/pngAssetSearchInput', input: COMMAND_INPUTS.searchPng, preconditions: ['assetDbReady'],
            status: assetDbReady ? 'available' : 'unavailable', reason: assetDbReady ? null : 'ASSETDB_UNAVAILABLE' },
        { id: 'asset.importPng', contractVersion: '0.1', access: 'write',
            inputSchema: 'catalog.schema.json#/$defs/importPngInput', input: COMMAND_INPUTS.importPng, preconditions: ['stagedPng', 'destinationFree'],
            status: 'available', reason: null },
        { id: 'asset.removeImportedPng', contractVersion: '0.1', access: 'write',
            inputSchema: 'catalog.schema.json#/$defs/removeImportedPngInput', input: COMMAND_INPUTS.removeImportedPng,
            preconditions: ['assetIdentityMatches', 'noSerializedReferences'], status: 'available', reason: null },
        { id: 'asset.validatePng', contractVersion: '0.1', access: 'read',
            inputSchema: 'catalog.schema.json#/$defs/pipelinePngInput', input: COMMAND_INPUTS.validatePng,
            preconditions: ['pipelineOwnedAsset', 'importedMetadata'], status: 'available', reason: null },
        { id: 'asset.refreshPng', contractVersion: '0.1', access: 'write',
            inputSchema: 'catalog.schema.json#/$defs/pipelinePngInput', input: COMMAND_INPUTS.refreshPng,
            preconditions: ['pipelineOwnedAsset', 'assetDbMappingStale', 'stableUuid'], status: 'available', reason: null },
        { id: 'asset.refreshFolder', contractVersion: '0.1', access: 'write',
            inputSchema: 'catalog.schema.json#/$defs/assetFolderRefreshInput', input: COMMAND_INPUTS.refreshFolder,
            preconditions: ['folderUnderAssets', 'assetDbRefreshAvailable'],
            status: context.assetFolderRefreshReady === true ? 'available' : 'unavailable',
            reason: context.assetFolderRefreshReady === true ? null : 'ASSETDB_REFRESH_UNAVAILABLE' },
        { id: 'scene.pngSprite', contractVersion: '0.1', access: 'write',
            inputSchema: 'catalog.schema.json#/$defs/pngSpriteInput2x', input: COMMAND_INPUTS.pngSprite, preconditions: ['activeScene', 'canvasExisting', 'spriteFrameImported'],
            status: spriteReady ? 'available' : 'unavailable', reason: spriteReady ? null : sceneReady ? 'CANVAS_NOT_FOUND' : 'NO_OPEN_SCENE' },
        { id: 'scene.node.create', contractVersion: '0.1', access: 'write',
            inputSchema: 'catalog.schema.json#/$defs/nodeCreateInput2x', input: COMMAND_INPUTS.nodeCreate, preconditions: ['activeScene', 'parentIdentity', 'componentTypesWhitelisted', 'componentSetCompatible', 'resourceReferencesResolvable', 'prefabAssetResolvableIfRequested'],
            status: sceneReady ? 'available' : 'unavailable', reason: sceneReady ? null : 'NO_OPEN_SCENE' },
        { id: 'scene.node.patch', contractVersion: '0.1', access: 'write',
            inputSchema: 'catalog.schema.json#/$defs/nodePatchInput2x', input: COMMAND_INPUTS.nodePatch,
            preconditions: ['activeScene', 'nodePathAndUuidMatch', 'expectedBeforeValues', 'propertyWhitelist', 'resourceReferencesResolvable'],
            status: sceneReady ? 'available' : 'unavailable', reason: sceneReady ? null : 'NO_OPEN_SCENE' },
        { id: 'prefab.source.patch', contractVersion: '0.1', access: 'write',
            inputSchema: 'catalog.schema.json#/$defs/prefabSourcePatchInput2x', input: COMMAND_INPUTS.prefabSourcePatch,
            preconditions: ['activeScene', 'prefabUuidResolvable', 'sourceShaMatches', 'prefabEditModeAvailable', 'nodePathAndUuidMatch', 'expectedBeforeValues'],
            status: sceneReady && context.prefabSourcePatchApiReady === true ? 'available' : 'unavailable',
            reason: !sceneReady ? 'NO_OPEN_SCENE' : context.prefabSourcePatchApiReady === true ? null : 'PREFAB_EDIT_MODE_API_UNAVAILABLE' },
        { id: 'prefab.source.inspect', contractVersion: '0.1', access: 'read',
            inputSchema: 'catalog.schema.json#/$defs/prefabSourceInspectInput2x', input: COMMAND_INPUTS.prefabSourceInspect,
            preconditions: ['prefabUuidResolvable', 'serializedPrefabReadable'],
            status: context.assetDbReady === true ? 'available' : 'unavailable',
            reason: context.assetDbReady === true ? null : 'ASSETDB_UNAVAILABLE' },
        { id: 'content.stress.run', contractVersion: '0.2', access: 'read',
            inputSchema: 'catalog.schema.json#/$defs/contentStressRunInput2x', input: COMMAND_INPUTS.contentStressRun,
            preconditions: ['completedWebMobileBuild', 'complexPackagedPngResources', 'coldCacheProfile', 'explicitDeviceScreeningBudget'],
            status: 'available', reason: null },
    ];
}

function send(value) {
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value));
}

function onMessage(raw) {
    let message;
    try { message = JSON.parse(raw.toString()); } catch (_) { return; }

    if (message.type === 'helloAck') {
        if (message.accepted !== true) {
            console.warn(`[COCOS_AGENT_BRIDGE_2] handshake rejected: ${message.reason || 'unknown'}`);
            socket.close();
        }
        return;
    }

    if (message.type !== 'request' || typeof message.id !== 'string') return;
    if (message.method === 'capabilities.list') {
        Editor.Scene.callSceneScript('cocos-agent-bridge', 'catalog-context', {}, (error, context) => {
            const sceneContext = error || !context ? { sceneName: null, hasCanvas: false } : context;
            const commands = commandCatalog({ ...sceneContext, assetDbReady: !!(Editor.assetdb && typeof Editor.assetdb.queryAssets === 'function'),
                assetFolderRefreshReady: !!(Editor.assetdb && typeof Editor.assetdb.refresh === 'function'),
                prefabSourcePatchApiReady: prefabEditModeApiReady() });
            send({ type: 'response', id: message.id, ok: true, result: {
                nonce: message.params && message.params.nonce, instanceId: INSTANCE_ID,
                projectRoot: PROJECT_ROOT, creatorVersion: CREATOR_VERSION,
                extensionVersion: '0.1.0', activeScene: sceneContext.sceneName,
                catalogRevision: crypto.createHash('sha256').update(JSON.stringify({ scene: sceneContext.sceneName, commands })).digest('hex'),
                commands,
            } });
        });
        return;
    }
    if (message.method === 'scene.preflightPngSprite') {
        preflightSceneOperation(message);
        return;
    }
    if (message.method === 'scene.pngSprite') {
        runSceneOperation(message);
        return;
    }
    if (message.method === 'scene.node.create.preflight' || message.method === 'scene.node.create') {
        runNodeCreate(message);
        return;
    }
    if (message.method === 'scene.node.patch.preflight' || message.method === 'scene.node.patch') {
        runNodePatch(message);
        return;
    }
    if (message.method === 'prefab.source.patch.preflight' || message.method === 'prefab.source.patch.execute') {
        runPrefabSourcePatch(message);
        return;
    }
    if (message.method === 'scene.node.patch.snapshot') {
        const params = message.params || {};
        const operation = activeSession && activeSession.nodePatchOperation;
        if (!operation || params.sessionId !== activeSession.sessionId || params.operationId !== activeSession.operationId
            || params.nonce !== operation.nonce || params.nodeUuid !== operation.targetNodeUuid) {
            send({ type: 'response', id: message.id, ok: false, error: { code: 'INVALID_NODE_PATCH_SESSION' } }); return;
        }
        Editor.Scene.callSceneScript('cocos-agent-bridge', 'node-patch-snapshot', { nodeUuid: params.nodeUuid }, (error, result) => {
            if (error) { send({ type: 'response', id: message.id, ok: false, error: { code: 'NODE_PATCH_SNAPSHOT_FAILED', message: String(error.message || error) } }); return; }
            send({ type: 'response', id: message.id, ok: true, result: Object.assign({ nonce: params.nonce,
                creatorVersion: CREATOR_VERSION, projectRoot: PROJECT_ROOT }, result) });
        });
        return;
    }
    if (message.method === 'scene.preview.start') {
        const params = message.params || {};
        if (!activeSession || params.sessionId !== activeSession.sessionId || typeof params.nonce !== 'string') {
            send({ type: 'response', id: message.id, ok: false, error: { code: 'INVALID_PREVIEW_SESSION' } }); return;
        }
        Editor.Ipc.sendToPanel('scene', 'scene:play-on-device');
        send({ type: 'response', id: message.id, ok: true, result: { nonce: params.nonce, started: true,
            creatorVersion: CREATOR_VERSION, projectRoot: PROJECT_ROOT } });
        return;
    }
    if (message.method === 'asset.importPng') {
        importPng(message);
        return;
    }
    if (message.method === 'asset.searchPng') {
        searchPng(message);
        return;
    }
    if (message.method === 'asset.removeImportedPng') {
        removeImportedPng(message);
        return;
    }
    if (message.method === 'asset.validatePng') {
        validateOwnedPng(message, false);
        return;
    }
    if (message.method === 'asset.refreshPng') {
        validateOwnedPng(message, true);
        return;
    }
    if (message.method === 'asset.refreshFolder') {
        refreshAssetFolder(message);
        return;
    }
    if (message.method === 'scene.snapshot') {
        const params = message.params || {};
        const nonce = params.nonce;
        Editor.Scene.callSceneScript('cocos-agent-bridge', 'snapshot', params, (error, snapshot) => {
            if (error) {
                send({ type: 'response', id: message.id, ok: false, error: { code: 'SCENE_SNAPSHOT_FAILED', message: String(error.message || error) } });
                return;
            }
            send({ type: 'response', id: message.id, ok: true, result: Object.assign({ nonce, creatorVersion: CREATOR_VERSION, projectRoot: PROJECT_ROOT }, snapshot) });
        });
        return;
    }

    if (message.method !== 'bridge.ping') {
        send({ type: 'response', id: message.id, ok: false, error: { code: 'METHOD_NOT_FOUND' } });
        return;
    }

    send({
        type: 'response',
        id: message.id,
        ok: true,
        result: {
            nonce: message.params && message.params.nonce,
            creatorVersion: CREATOR_VERSION,
            projectRoot: PROJECT_ROOT,
        },
    });
    console.log(`[COCOS_AGENT_BRIDGE_2] bridge.ping replied for Creator ${CREATOR_VERSION}`);
}

function runNodeCreate(message) {
    const params = message.params || {};
    const operation = activeSession && activeSession.nodeOperation;
    if (!operation || params.sessionId !== activeSession.sessionId || params.operationId !== activeSession.operationId
        || params.nonce !== operation.nonce || params.parentPath !== operation.parentPath
        || params.parentUuid !== operation.parentUuid || params.nodeName !== operation.nodeName
        || params.action !== operation.action || params.targetNodeUuid !== operation.targetNodeUuid
        || JSON.stringify(params.components || []) !== JSON.stringify(operation.components || [])
        || JSON.stringify(params.transform || {}) !== JSON.stringify(operation.transform || {})
        || (params.prefabMode || null) !== (operation.prefabMode || null)
        || (params.prefabUuid || null) !== (operation.prefabUuid || null)) {
        send({ type: 'response', id: message.id, ok: false, error: { code: 'INVALID_NODE_SESSION' } }); return;
    }
    const preflight = message.method.endsWith('.preflight');
    const fail = (code, error) => send({ type: 'response', id: message.id, ok: false,
        error: { code, message: String(error && error.message || error || code) } });
    const runSceneScript = () => Editor.Scene.callSceneScript('cocos-agent-bridge', preflight ? 'node-create-preflight' : 'node-create-mutate', operation, (error, result) => {
        if (error) { fail(error.code || 'NODE_OPERATION_FAILED', error); return; }
        const reply = () => send({ type: 'response', id: message.id, ok: true, result: Object.assign({
            nonce: params.nonce, operationId: params.operationId, creatorVersion: CREATOR_VERSION,
            projectRoot: PROJECT_ROOT, action: operation.action, parentPath: operation.parentPath,
            parentUuid: operation.parentUuid, nodeName: operation.nodeName,
        }, result) });
        if (preflight) { reply(); return; }
        const saveAndReply = () => saveActiveScene((saveError) => {
            if (saveError) { fail('SCENE_SAVE_UNVERIFIED', saveError); return; }
            result.saved = true; reply();
        });
        if (operation.prefabMode === 'create' && operation.action !== 'compensate') {
            if (!prefabDiskPath(operation.prefabUrl)) { fail('INVALID_PREFAB_URL'); return; }
            // 2.4.15 appends <node.name>.prefab to a destination directory.
            const assetNodeName = path.basename(operation.prefabUrl, '.prefab');
            Editor.Scene.callSceneScript('cocos-agent-bridge', 'node-prefab-create-name', {
                nodeUuid: result.nodeUuid, beforeName: operation.nodeName, afterName: assetNodeName,
            }, (renameError) => {
                if (renameError) { fail('PREFAB_PREPARE_FAILED', renameError); return; }
                Editor.Ipc.sendToPanel('scene', 'scene:create-prefab', result.nodeUuid, 'db://assets');
                waitForPrefab(operation.prefabUrl, (prefabError, identity) => {
                if (prefabError) { fail('PREFAB_CREATE_UNVERIFIED', prefabError); return; }
                Editor.Scene.callSceneScript('cocos-agent-bridge', 'node-patch-snapshot', { nodeUuid: result.nodeUuid }, (snapshotError, snapshot) => {
                    if (snapshotError || !snapshot || snapshot.status !== 'found' || snapshot.prefabUuid !== identity.uuid) {
                        fail('PREFAB_INSTANCE_READBACK_FAILED', snapshotError); return;
                    }
                    Editor.Scene.callSceneScript('cocos-agent-bridge', 'node-prefab-create-name', {
                        nodeUuid: result.nodeUuid, beforeName: assetNodeName, afterName: operation.nodeName,
                    }, (restoreError) => {
                        if (restoreError) { fail('PREFAB_RESTORE_NAME_FAILED', restoreError); return; }
                        result.prefabUuid = identity.uuid; result.prefabSha256 = identity.sha256;
                        saveAndReply();
                    });
                });
            });
            });
            return;
        }
        if (operation.prefabMode === 'create' && operation.action === 'compensate') {
            saveActiveScene((saveError) => {
                if (saveError) { fail('SCENE_SAVE_UNVERIFIED', saveError); return; }
                deleteOwnedPrefab(operation, (deleteError) => {
                    if (deleteError) { fail(deleteError.code || 'PREFAB_DELETE_UNVERIFIED', deleteError); return; }
                    result.prefabUuid = operation.prefabUuid; result.prefabRemoved = true; result.saved = true; reply();
                });
            });
            return;
        }
        saveAndReply();
    });
    if (operation.prefabMode === 'create') {
        const filename = prefabDiskPath(operation.prefabUrl);
        if (!filename) { fail('INVALID_PREFAB_URL'); return; }
        if (operation.action === 'compensate') {
            const identity = readOwnedPrefab(operation.prefabUrl);
            if (!identity || identity.uuid !== operation.prefabUuid || identity.sha256 !== operation.prefabSha256) {
                fail('PREFAB_ASSET_CHANGED'); return;
            }
            const references = prefabReferenceCount(operation.prefabUuid);
            if (references !== 1) { fail('PREFAB_REFERENCE_SET_CHANGED'); return; }
        } else if (Editor.assetdb.exists(operation.prefabUrl) || fs.existsSync(filename) || fs.existsSync(`${filename}.meta`)) {
            fail('PREFAB_DESTINATION_CONFLICT'); return;
        }
    }
    if (preflight && operation.prefabMode === 'instantiate') verifyPrefabUuid(operation.prefabUuid, (error) => error ? fail('PREFAB_ASSET_INVALID', error) : runSceneScript());
    else runSceneScript();
}

function prefabDiskPath(url) {
    if (typeof url !== 'string' || !/^db:\/\/assets\/CocosAgentPrefab_[0-9a-f-]{36}\.prefab$/i.test(url)) return null;
    return path.join(PROJECT_ROOT, 'assets', url.slice('db://assets/'.length));
}

function readOwnedPrefab(url) {
    const filename = prefabDiskPath(url);
    if (!filename) return null;
    try {
        const stat = fs.lstatSync(filename); const metaStat = fs.lstatSync(`${filename}.meta`);
        if (!stat.isFile() || stat.isSymbolicLink() || !metaStat.isFile() || metaStat.isSymbolicLink()) return null;
        const content = fs.readFileSync(filename); const meta = JSON.parse(fs.readFileSync(`${filename}.meta`, 'utf8'));
        if (meta.importer !== 'prefab' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(meta.uuid || '')) return null;
        return { uuid: meta.uuid, sha256: crypto.createHash('sha256').update(content).digest('hex') };
    } catch (_) { return null; }
}

function verifyPrefabUuid(uuid, callback) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid || '')) { callback(new Error('Invalid Prefab UUID.')); return; }
    Editor.assetdb.queryAssets('db://assets/**/*', 'prefab', (error, rows) => {
        if (error || !Array.isArray(rows) || !rows.some((row) => row && row.uuid === uuid && row.type === 'prefab')) {
            callback(new Error('AssetDB does not identify the requested Prefab UUID.')); return;
        }
        callback(null);
    });
}

function waitForPrefab(url, callback) {
    const deadline = Date.now() + 20000;
    const retry = () => Date.now() >= deadline ? callback(new Error('Timed out waiting for the Prefab AssetDB import.')) : setTimeout(poll, 150);
    const poll = () => {
        const identity = readOwnedPrefab(url);
        if (identity && Editor.assetdb.urlToUuid(url) === identity.uuid) {
            Editor.assetdb.queryAssets(url, 'prefab', (error, rows) => {
                if (!error && Array.isArray(rows) && rows.some((row) => row && row.url === url && row.uuid === identity.uuid && row.type === 'prefab')) callback(null, identity);
                else retry();
            });
            return;
        }
        retry();
    };
    poll();
}

function prefabReferenceCount(uuid) {
    const root = path.resolve(PROJECT_ROOT, 'assets'); let count = 0; let failed = false;
    function walk(directory, depth) {
        if (depth > 10 || failed) return;
        let entries; try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch (_) { failed = true; return; }
        for (const entry of entries) {
            if (entry.isSymbolicLink() || ['library', 'temp', 'local', 'build'].includes(entry.name)) continue;
            const filename = path.join(directory, entry.name);
            if (entry.isDirectory()) walk(filename, depth + 1);
            else if (entry.isFile() && /\.(?:fire|scene|prefab)$/i.test(entry.name)) {
                let data; try { data = fs.readFileSync(filename, 'utf8'); } catch (_) { failed = true; return; }
                let index = -1; while ((index = data.indexOf(uuid, index + 1)) >= 0) count++;
            }
        }
    }
    walk(root, 0);
    return failed ? null : count;
}

function deleteOwnedPrefab(operation, callback) {
    const filename = prefabDiskPath(operation.prefabUrl);
    const identity = readOwnedPrefab(operation.prefabUrl);
    if (!filename || !identity || identity.uuid !== operation.prefabUuid || identity.sha256 !== operation.prefabSha256
        || Editor.assetdb.urlToUuid(operation.prefabUrl) !== operation.prefabUuid || prefabReferenceCount(operation.prefabUuid) !== 0) {
        callback(Object.assign(new Error('Prefab identity changed or serialized references remain.'), { code: 'PREFAB_ASSET_CHANGED_OR_REFERENCED' })); return;
    }
    Editor.assetdb.delete([operation.prefabUrl], (error) => {
        if (error) { callback(error); return; }
        // AssetDB 2.4.15 may complete deletion without returning UUID rows.
        // The mapping, both files, and serialized-reference scan are the authoritative postconditions.
        if (Editor.assetdb.urlToUuid(operation.prefabUrl) || fs.existsSync(filename) || fs.existsSync(`${filename}.meta`)
            || prefabReferenceCount(operation.prefabUuid) !== 0) {
            callback(Object.assign(new Error('AssetDB delete did not prove Prefab removal.'), { code: 'PREFAB_DELETE_UNVERIFIED' })); return;
        }
        callback(null);
    });
}

function runNodePatch(message) {
    const params = message.params || {};
    const operation = activeSession && activeSession.nodePatchOperation;
    if (!operation || params.sessionId !== activeSession.sessionId || params.operationId !== activeSession.operationId
        || params.nonce !== operation.nonce || params.targetNodePath !== operation.targetNodePath
        || params.targetNodeUuid !== operation.targetNodeUuid || JSON.stringify(params.expectedDiff) !== JSON.stringify(operation.expectedDiff)) {
        send({ type: 'response', id: message.id, ok: false, error: { code: 'INVALID_NODE_PATCH_SESSION' } }); return;
    }
    const preflight = message.method.endsWith('.preflight');
    Editor.Scene.callSceneScript('cocos-agent-bridge', preflight ? 'node-patch-preflight' : 'node-patch-mutate', operation, (error, result) => {
        if (error) { send({ type: 'response', id: message.id, ok: false, error: { code: error.code || 'NODE_PATCH_FAILED', message: String(error.message || error) } }); return; }
        const reply = () => send({ type: 'response', id: message.id, ok: true, result: Object.assign({
            nonce: params.nonce, operationId: params.operationId, creatorVersion: CREATOR_VERSION,
            projectRoot: PROJECT_ROOT, targetNodePath: operation.targetNodePath,
            targetNodeUuid: operation.targetNodeUuid,
        }, result) });
        if (preflight) reply();
        else saveActiveScene((saveError) => {
            if (saveError) { send({ type: 'response', id: message.id, ok: false, error: { code: 'SCENE_SAVE_UNVERIFIED', message: String(saveError.message || saveError) } }); return; }
            result.saved = true; reply();
        });
    });
}

function prefabSourcePath(url) {
    if (typeof url !== 'string' || !url.startsWith('db://assets/')) return null;
    const relative = url.slice('db://assets/'.length);
    const segments = relative.split('/');
    if (!relative.toLowerCase().endsWith('.prefab') || segments.some((part) => !part || part === '.' || part === '..')) return null;
    const assetsRoot = path.resolve(PROJECT_ROOT, 'assets');
    const filename = path.resolve(assetsRoot, ...segments);
    if (!filename.startsWith(`${assetsRoot}${path.sep}`)) return null;
    let current = assetsRoot;
    try {
        for (const segment of segments) {
            current = path.join(current, segment);
            if (fs.lstatSync(current).isSymbolicLink()) return null;
        }
        if (!fs.lstatSync(filename).isFile() || !fs.lstatSync(`${filename}.meta`).isFile()
            || fs.lstatSync(`${filename}.meta`).isSymbolicLink()) return null;
        return filename;
    } catch (_) { return null; }
}

function prefabSourceIdentity(url) {
    const filename = prefabSourcePath(url);
    if (!filename) return null;
    try {
        const content = fs.readFileSync(filename);
        const meta = JSON.parse(fs.readFileSync(`${filename}.meta`, 'utf8'));
        if (meta.importer !== 'prefab' || !/^[0-9a-f-]{36}$/i.test(meta.uuid || '')) return null;
        return { filename, uuid: meta.uuid, sha256: crypto.createHash('sha256').update(content).digest('hex') };
    } catch (_) { return null; }
}

function verifyPrefabSourceAsset(operation, callback) {
    const identity = prefabSourceIdentity(operation.prefabUrl);
    if (!identity || identity.uuid !== operation.prefabUuid || identity.sha256 !== operation.expectedPrefabSha256
        || Editor.assetdb.urlToUuid(operation.prefabUrl) !== operation.prefabUuid) {
        callback(Object.assign(new Error('Prefab UUID or source hash changed after planning.'), { code: 'PREFAB_SOURCE_STALE' })); return;
    }
    Editor.assetdb.queryAssets(operation.prefabUrl, 'prefab', (error, rows) => {
        if (error || !Array.isArray(rows) || !rows.some((row) => row && row.url === operation.prefabUrl
            && row.uuid === operation.prefabUuid && row.type === 'prefab')) {
            callback(Object.assign(new Error('AssetDB no longer maps the requested UUID to this Prefab URL.'), { code: 'PREFAB_ASSET_IDENTITY_MISMATCH' })); return;
        }
        callback(null, identity);
    });
}

function callPrefabSceneScript(method, params, callback) {
    Editor.Scene.callSceneScript('cocos-agent-bridge', method, params || {}, (error, result) => callback(error || null, result));
}

function prefabEditModeModule() {
    try {
        const editMode = Editor.require('scene://edit-mode');
        return editMode && typeof editMode.curMode === 'function'
            && typeof editMode.save === 'function' && typeof editMode.pop === 'function' ? editMode : null;
    } catch (_) { return null; }
}

function prefabEditModeApiReady() { return !!prefabEditModeModule(); }

function waitForNextSceneReady(callback) {
    if (pendingSceneReady) { callback(new Error('A scene-ready wait is already in progress.')); return () => {}; }
    let settled = false;
    const finish = (error) => {
        if (settled) return;
        settled = true; clearTimeout(timeout); pendingSceneReady = null; callback(error || null);
    };
    const timeout = setTimeout(() => finish(new Error('Timed out waiting for scene:ready.')), 20000);
    pendingSceneReady = finish;
    return finish;
}

function currentPrefabMode(callback) {
    const editMode = prefabEditModeModule();
    if (!editMode) {
        callback(Object.assign(new Error('Prefab edit mode save/exit APIs are unavailable in the Creator main process.'), { code: 'PREFAB_EDIT_MODE_API_UNAVAILABLE' })); return;
    }
    let mode;
    try { mode = editMode.curMode(); }
    catch (error) { callback(Object.assign(error, { code: 'PREFAB_EDIT_MODE_QUERY_FAILED' })); return; }
    if (!mode || typeof mode.name !== 'string') {
        callback(Object.assign(new Error('Creator did not return the current editor mode.'), { code: 'PREFAB_EDIT_MODE_QUERY_FAILED' })); return;
    }
    callPrefabSceneScript('prefab-source-patch-mode', {}, (error, rootInfo) => {
        if (error) { callback(error); return; }
        const modeUuids = new Set();
        const visited = new Set();
        const addUuid = (value) => {
            if (typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)) modeUuids.add(value);
            else if (value && typeof value === 'object' && !visited.has(value)) {
                visited.add(value);
                for (const key of ['uuid', '_uuid', 'assetUuid', 'prefabUuid']) addUuid(value[key]);
            }
        };
        Object.keys(mode).forEach((key) => { if (/prefab|asset|uuid/i.test(key)) addUuid(mode[key]); });
        if (mode.name === 'prefab' && rootInfo && rootInfo.prefabUuid) modeUuids.add(rootInfo.prefabUuid);
        const prefabUuid = modeUuids.size === 1 ? [...modeUuids][0] : null;
        callback(null, { modeName: mode.name, prefabUuid,
            saveAvailable: typeof editMode.save === 'function', popAvailable: typeof editMode.pop === 'function' });
    });
}

function enterPrefabSourceMode(uuid, callback) {
    const finishReady = waitForNextSceneReady((error) => {
        if (error) { callback(error); return; }
        currentPrefabMode((modeError, mode) => {
            if (modeError || mode.modeName !== 'prefab' || mode.prefabUuid !== uuid) {
                callback(modeError || Object.assign(new Error('Editor did not enter the requested Prefab edit mode.'), { code: 'PREFAB_MODE_TARGET_MISMATCH' })); return;
            }
            callback(null, mode);
        });
    });
    try { Editor.Ipc.sendToAll('scene:enter-prefab-edit-mode', uuid); }
    catch (error) { finishReady(error); }
}

function exitPrefabSourceMode(uuid, callback) {
    currentPrefabMode((modeError, current) => {
        if (modeError || !current || current.modeName !== 'prefab' || current.prefabUuid !== uuid) {
            callback(modeError || Object.assign(new Error('Refusing to exit a different editor mode or Prefab.'), { code: 'PREFAB_EXIT_TARGET_MISMATCH' })); return;
        }
        const finishReady = waitForNextSceneReady((error) => {
            if (error) { callback(error); return; }
            currentPrefabMode((afterError, mode) => {
                if (afterError || mode.modeName === 'prefab') {
                    callback(afterError || Object.assign(new Error('Editor remained in Prefab edit mode after exit.'), { code: 'PREFAB_EXIT_UNVERIFIED' })); return;
                }
                callback(null, mode);
            });
        });
        const editMode = prefabEditModeModule();
        if (!editMode) { finishReady(Object.assign(new Error('Prefab edit mode exit is unavailable.'), { code: 'PREFAB_EXIT_UNAVAILABLE' })); return; }
        try { editMode.pop(); }
        catch (error) { finishReady(Object.assign(error, { code: 'PREFAB_EXIT_FAILED' })); }
    });
}

function savePrefabSource(uuid, callback) {
    if (pendingSceneSave) { callback(new Error('A scene save is already in progress.')); return; }
    let scriptDone = false; let eventDone = false; let settled = false; let failure = null;
    const finish = (error) => {
        if (settled) return;
        settled = true; clearTimeout(timeout); pendingSceneSave = null; callback(error || null);
    };
    const maybeFinish = () => { if (failure) finish(failure); else if (scriptDone && eventDone) finish(null); };
    const timeout = setTimeout(() => finish(Object.assign(new Error('Timed out waiting for Prefab save and scene:saved.'), { code: 'PREFAB_SAVE_UNVERIFIED' })), 20000);
    pendingSceneSave = (error) => { if (error) failure = error; else eventDone = true; maybeFinish(); };
    currentPrefabMode((modeError, mode) => {
        if (modeError || !mode || mode.modeName !== 'prefab' || mode.prefabUuid !== uuid) {
            failure = modeError || Object.assign(new Error('Refusing to save a different Prefab edit target.'), { code: 'PREFAB_SAVE_TARGET_MISMATCH' });
            maybeFinish(); return;
        }
        const editMode = prefabEditModeModule();
        if (!editMode) { failure = Object.assign(new Error('Prefab edit mode save is unavailable.'), { code: 'PREFAB_SAVE_UNAVAILABLE' }); maybeFinish(); return; }
        try {
            editMode.save((error) => {
                if (error) failure = Object.assign(error, { code: 'PREFAB_SAVE_FAILED' });
                else scriptDone = true;
                maybeFinish();
            });
        } catch (error) {
            failure = Object.assign(error, { code: 'PREFAB_SAVE_FAILED' });
            maybeFinish();
        }
    });
}

function runPrefabSourcePatch(message) {
    const params = message.params || {};
    const operation = activeSession && activeSession.prefabSourcePatchOperation;
    if (!operation || params.sessionId !== activeSession.sessionId || params.operationId !== activeSession.operationId
        || params.nonce !== operation.nonce || params.prefabUuid !== operation.prefabUuid
        || params.targetNodePath !== operation.targetNodePath || params.targetNodeUuid !== operation.targetNodeUuid
        || params.action !== operation.action || params.expectedPrefabSha256 !== operation.expectedPrefabSha256
        || JSON.stringify(params.expectedDiff) !== JSON.stringify(operation.expectedDiff)) {
        send({ type: 'response', id: message.id, ok: false, error: { code: 'INVALID_PREFAB_SOURCE_PATCH_SESSION' } }); return;
    }
    const preflight = message.method.endsWith('.preflight');
    const fail = (error, sideEffect = 'none') => send({ type: 'response', id: message.id, ok: false,
        error: { code: error && error.code || 'PREFAB_SOURCE_PATCH_FAILED', message: String(error && error.message || error), sideEffect } });
    verifyPrefabSourceAsset(operation, (assetError, identity) => {
        if (assetError) { fail(assetError); return; }
        currentPrefabMode((modeError, mode) => {
            if (modeError) { fail(modeError); return; }
            if (mode.modeName !== 'scene') {
                fail(Object.assign(new Error('Close the current editor sub-mode before editing a Prefab source.'), { code: 'EDITOR_BUSY' })); return;
            }
            enterPrefabSourceMode(operation.prefabUuid, (enterError) => {
                if (enterError) { fail(enterError); return; }
                callPrefabSceneScript('prefab-source-patch-preflight', operation, (editorError, before) => {
                    if (editorError || !before || before.prefabUuid !== operation.prefabUuid
                        || !before.node || before.node.uuid !== operation.targetNodeUuid) {
                        exitPrefabSourceMode(operation.prefabUuid, () => fail(editorError || new Error('Prefab preflight did not identify the target node.')));
                        return;
                    }
                    if (preflight) {
                        exitPrefabSourceMode(operation.prefabUuid, (exitError) => {
                            if (exitError) { fail(exitError); return; }
                            send({ type: 'response', id: message.id, ok: true, result: Object.assign({
                                nonce: params.nonce, operationId: params.operationId, creatorVersion: CREATOR_VERSION,
                                projectRoot: PROJECT_ROOT, prefabUuid: operation.prefabUuid, sourceSha256: identity.sha256,
                            }, before) });
                        });
                        return;
                    }
                    callPrefabSceneScript('prefab-source-patch-mutate', operation, (mutateError, changed) => {
                        if (mutateError || !changed || changed.prefabUuid !== operation.prefabUuid
                            || !changed.node || changed.node.uuid !== operation.targetNodeUuid) {
                            fail(mutateError || new Error('Prefab mutation did not return the target node.'), 'possible'); return;
                        }
                        savePrefabSource(operation.prefabUuid, (saveError) => {
                            if (saveError) { fail(saveError, 'possible'); return; }
                            const afterIdentity = prefabSourceIdentity(operation.prefabUrl);
                            if (!afterIdentity || afterIdentity.uuid !== operation.prefabUuid
                                || afterIdentity.sha256 === operation.expectedPrefabSha256
                                || Editor.assetdb.urlToUuid(operation.prefabUrl) !== operation.prefabUuid) {
                                fail(Object.assign(new Error('Saved Prefab did not preserve its UUID and produce a new source hash.'), { code: 'PREFAB_DISK_READBACK_MISMATCH' }), 'possible'); return;
                            }
                            exitPrefabSourceMode(operation.prefabUuid, (exitError) => {
                                if (exitError) { fail(exitError, 'possible'); return; }
                                enterPrefabSourceMode(operation.prefabUuid, (reopenError) => {
                                    if (reopenError) { fail(reopenError, 'possible'); return; }
                                    callPrefabSceneScript('prefab-source-patch-snapshot', { prefabUuid: operation.prefabUuid,
                                        targetNodePath: operation.targetNodePath, targetNodeUuid: operation.targetNodeUuid,
                                        expectedDiff: operation.expectedDiff, side: 'after' }, (readbackError, reopened) => {
                                        exitPrefabSourceMode(operation.prefabUuid, (finalExitError) => {
                                            if (readbackError || finalExitError) { fail(readbackError || finalExitError, 'possible'); return; }
                                            send({ type: 'response', id: message.id, ok: true, result: {
                                                nonce: params.nonce, operationId: params.operationId, creatorVersion: CREATOR_VERSION,
                                                projectRoot: PROJECT_ROOT, action: operation.action, prefabUuid: operation.prefabUuid,
                                                targetNodePath: operation.targetNodePath, targetNodeUuid: operation.targetNodeUuid,
                                                expectedDiff: operation.expectedDiff, saved: true, reopened: true,
                                                beforeSha256: identity.sha256, afterSha256: afterIdentity.sha256,
                                                node: reopened.node,
                                            } });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}

function runSceneOperation(message) {
    const params = message.params || {};
    const operation = activeSession && activeSession.sceneOperation;
    if (!operation || params.sessionId !== activeSession.sessionId || params.assetName !== operation.assetName
        || params.assetUuid !== operation.assetUuid || params.nodeName !== operation.nodeName
        || JSON.stringify(params.position || null) !== JSON.stringify(operation.position || null)
        || params.sceneAction !== operation.sceneAction || typeof params.nonce !== 'string') {
        send({ type: 'response', id: message.id, ok: false, error: { code: 'INVALID_SCENE_SESSION' } });
        return;
    }
    const method = params.sceneAction === 'compensate' ? 'remove-png-sprite' : 'place-png-sprite';
    Editor.Scene.callSceneScript('cocos-agent-bridge', method, { spriteFrameUuid: operation.assetUuid, nodeName: operation.nodeName,
        ...(operation.position ? { position: operation.position } : {}) }, (error, result) => {
        if (error) {
            send({ type: 'response', id: message.id, ok: false, error: { code: error.code || 'SCENE_OPERATION_FAILED', message: String(error.message || error) } });
            return;
        }
        Editor.Ipc.sendToPanel('scene', 'scene:query-dirty-state', (dirtyError, dirty) => {
            console.log(`[COCOS_AGENT_BRIDGE_2] dirty after edit: ${dirtyError ? String(dirtyError) : JSON.stringify(dirty)}`);
        });
        saveActiveScene((saveError) => {
            if (saveError) {
                send({ type: 'response', id: message.id, ok: false, error: { code: 'SCENE_SAVE_UNVERIFIED', message: String(saveError.message || saveError) } });
                return;
            }
            send({
                type: 'response', id: message.id, ok: true,
                result: Object.assign({
                    nonce: params.nonce,
                    sessionId: activeSession.sessionId,
                    creatorVersion: CREATOR_VERSION,
                    projectRoot: PROJECT_ROOT,
                    action: params.sceneAction,
                    assetName: operation.assetName,
                    nodeName: operation.nodeName,
                    saved: true,
                }, result),
            });
        });
    });
}

function preflightSceneOperation(message) {
    const params = message.params || {};
    const operation = activeSession && activeSession.sceneOperation;
    const contract = params.operation || {};
    if (!operation || params.sessionId !== activeSession.sessionId || params.assetName !== operation.assetName
        || params.assetUuid !== operation.assetUuid || params.nodeName !== operation.nodeName
        || JSON.stringify(params.position || null) !== JSON.stringify(operation.position || null)
        || params.sceneAction !== operation.sceneAction || typeof params.nonce !== 'string'
        || contract.contractVersion !== '0.1' || contract.operationId !== activeSession.operationId
        || contract.capabilityId !== 'scene.pngSprite' || contract.action !== operation.sceneAction
        || contract.assetName !== operation.assetName || contract.assetUuid !== operation.assetUuid
        || JSON.stringify(contract.position || null) !== JSON.stringify(operation.position || null)
        || contract.nodeName !== operation.nodeName || typeof contract.sceneName !== 'string') {
        send({ type: 'response', id: message.id, ok: false, error: { code: 'INVALID_SCENE_SESSION', phase: 'preflight', message: 'Session manifest mismatch.', retryable: false, sideEffect: 'none' } });
        return;
    }
    Editor.Scene.callSceneScript('cocos-agent-bridge', 'preflight-png-sprite', {
        spriteFrameUuid: operation.assetUuid, nodeName: operation.nodeName, action: operation.sceneAction,
        ...(operation.position ? { position: operation.position } : {}),
    }, (error, result) => {
        if (error) {
            send({ type: 'response', id: message.id, ok: false, error: { code: error.code || 'PREFLIGHT_FAILED', phase: 'preflight', message: String(error.message || error), retryable: false, sideEffect: 'none' } });
            return;
        }
        send({ type: 'response', id: message.id, ok: true, result: Object.assign({ nonce: params.nonce, creatorVersion: CREATOR_VERSION, projectRoot: PROJECT_ROOT }, result) });
    });
}

function saveActiveScene(callback) {
    if (pendingSceneSave) {
        callback(new Error('A scene save is already in progress.'));
        return;
    }
    let settled = false;
    const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        pendingSceneSave = null;
        callback(error || null);
    };
    const timeout = setTimeout(() => finish(new Error('Timed out waiting for scene:saved.')), 15000);
    pendingSceneSave = finish;
    Editor.Ipc.sendToPanel('scene', 'scene:stash-and-save');
}

function importPng(message) {
    const params = message.params || {};
    const staged = activeSession && activeSession.assetImport;
    if (!staged || params.sessionId !== activeSession.sessionId || typeof params.nonce !== 'string') {
        send({ type: 'response', id: message.id, ok: false, error: { code: 'INVALID_IMPORT_SESSION' } });
        return;
    }
    const failImport = (code, error) => send({
        type: 'response', id: message.id, ok: false,
        error: { code, message: String(error && error.message || error || code) },
    });
    if (!/^[0-9a-f-]{36}$/i.test(activeSession.sessionId)
        || staged.destinationFolder !== 'db://assets/resources'
        || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,94}\.png$/i.test(staged.assetName)
        || staged.destinationUrl !== `${staged.destinationFolder}/${staged.assetName}`
        || staged.fileName !== `${activeSession.sessionId}/${staged.assetName}`) {
        failImport('INVALID_IMPORT_MANIFEST');
        return;
    }
    const sourcePath = path.join(INBOX_PATH, staged.fileName);
    let data;
    try {
        const stat = fs.lstatSync(sourcePath);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== staged.byteLength || stat.size > 10 * 1024 * 1024) {
            failImport('INVALID_STAGED_FILE');
            return;
        }
        data = fs.readFileSync(sourcePath);
    } catch (error) {
        failImport('STAGED_FILE_UNAVAILABLE', error);
        return;
    }
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const width = data.length >= 24 ? data.readUInt32BE(16) : 0;
    const height = data.length >= 24 ? data.readUInt32BE(20) : 0;
    const sha256 = crypto.createHash('sha256').update(data).digest('hex');
    if (!data.subarray(0, 8).equals(signature) || data.toString('ascii', 12, 16) !== 'IHDR'
        || sha256 !== staged.sha256 || width !== staged.width || height !== staged.height) {
        failImport('STAGED_FILE_MISMATCH');
        return;
    }
    if (Editor.assetdb.exists(staged.destinationUrl)) {
        failImport('ASSET_CONFLICT', `Asset already exists: ${staged.destinationUrl}`);
        return;
    }

    Editor.assetdb.import([sourcePath], staged.destinationFolder, (error, results) => {
        if (error) {
            failImport('ASSET_IMPORT_FAILED', error);
            return;
        }
        const imported = Array.isArray(results) && results.find((item) => item && item.url === staged.destinationUrl);
        const uuid = imported && imported.uuid || Editor.assetdb.urlToUuid(staged.destinationUrl);
        const type = imported && imported.type;
        if (!uuid || typeof type !== 'string' || !type) {
            const resultShape = Array.isArray(results)
                ? results.map((item) => item && ({ url: item.url, uuid: item.uuid, type: item.type, command: item.command }))
                : String(results);
            failImport('ASSET_IMPORT_UNVERIFIED', JSON.stringify({ url: staged.destinationUrl, exists: Editor.assetdb.exists(staged.destinationUrl), uuid, results: resultShape }));
            return;
        }
        send({
            type: 'response', id: message.id, ok: true,
            result: {
                nonce: params.nonce,
                sessionId: activeSession.sessionId,
                creatorVersion: CREATOR_VERSION,
                projectRoot: PROJECT_ROOT,
                sourceName: staged.assetName,
                assetName: staged.assetName,
                url: staged.destinationUrl,
                uuid,
                type,
                imported: true,
                invalid: false,
                sha256,
                byteLength: data.length,
                width,
                height,
            },
        });
    });
}

function searchPng(message) {
    const params = message.params || {};
    const search = activeSession && activeSession.assetSearch;
    if (!search || params.sessionId !== activeSession.sessionId || params.nonce !== search.nonce
        || params.query !== search.query || params.limit !== search.limit || params.offset !== search.offset) {
        send({ type: 'response', id: message.id, ok: false, error: { code: 'INVALID_ASSET_SEARCH_SESSION' } });
        return;
    }
    const failSearch = (code, error) => send({ type: 'response', id: message.id, ok: false,
        error: { code, message: String(error && error.message || error || code).slice(0, 400) } });
    searchPngAssets(Editor.assetdb, path.resolve(PROJECT_ROOT, 'assets'), search, (error, result) => {
        if (error) { failSearch(error.code || 'ASSET_QUERY_FAILED', error); return; }
        send({ type: 'response', id: message.id, ok: true, result: Object.assign({
            nonce: search.nonce, sessionId: activeSession.sessionId, creatorVersion: CREATOR_VERSION,
            projectRoot: PROJECT_ROOT,
        }, result) });
    });
}

function removeImportedPng(message) {
    const params = message.params || {};
    const asset = activeSession && activeSession.assetRemoval;
    if (!asset || params.sessionId !== activeSession.sessionId || typeof params.nonce !== 'string'
        || params.assetName !== asset.assetName || params.textureUuid !== asset.textureUuid
        || params.spriteFrameUuid !== asset.spriteFrameUuid || params.sha256 !== asset.sha256) {
        send({ type: 'response', id: message.id, ok: false, error: { code: 'INVALID_ASSET_REMOVAL_SESSION' } });
        return;
    }
    const url = `db://assets/resources/${asset.assetName}`;
    const filename = path.join(PROJECT_ROOT, 'assets', 'resources', asset.assetName);
    let diskData; let meta;
    try {
        const sourceStat = fs.lstatSync(filename);
        const metaStat = fs.lstatSync(`${filename}.meta`);
        if (!sourceStat.isFile() || sourceStat.isSymbolicLink() || !metaStat.isFile() || metaStat.isSymbolicLink()) throw new Error('not a regular imported asset');
        diskData = fs.readFileSync(filename);
        meta = JSON.parse(fs.readFileSync(`${filename}.meta`, 'utf8'));
    } catch (_) {
        send({ type: 'response', id: message.id, ok: false, error: { code: 'ASSET_IDENTITY_UNAVAILABLE' } });
        return;
    }
    const frames = Object.values(meta.subMetas || {}).filter((item) => item && item.importer === 'sprite-frame');
    const diskHash = crypto.createHash('sha256').update(diskData).digest('hex');
    if (diskHash !== asset.sha256 || meta.importer !== 'texture' || meta.uuid !== asset.textureUuid || frames.length !== 1
        || frames[0].uuid !== asset.spriteFrameUuid || frames[0].rawTextureUuid !== asset.textureUuid) {
        send({ type: 'response', id: message.id, ok: false, error: { code: 'ASSET_IDENTITY_CHANGED' } });
        return;
    }
    const currentUuid = Editor.assetdb.urlToUuid(url);
    if (currentUuid !== asset.textureUuid) {
        send({ type: 'response', id: message.id, ok: false,
            error: { code: 'ASSET_IDENTITY_CHANGED', message: 'AssetDB no longer maps the URL to the recorded texture UUID.' } });
        return;
    }
    Editor.assetdb.delete([url], (error, results) => {
        if (error) {
            send({ type: 'response', id: message.id, ok: false,
                error: { code: 'ASSETDB_DELETE_FAILED', message: String(error.message || error) } });
            return;
        }
        const uuidAfter = Editor.assetdb.urlToUuid(url);
        const resultRows = Array.isArray(results) ? results : [];
        const deletedIdentity = resultRows.some((item) => item && item.uuid === asset.textureUuid);
        if (uuidAfter || !deletedIdentity || fs.existsSync(filename) || fs.existsSync(`${filename}.meta`)) {
            send({ type: 'response', id: message.id, ok: false,
                error: { code: 'ASSETDB_DELETE_UNVERIFIED', message: `uuidAfter=${String(uuidAfter || '')}; deletedIdentity=${deletedIdentity}` } });
            return;
        }
        send({ type: 'response', id: message.id, ok: true, result: {
            nonce: params.nonce, sessionId: activeSession.sessionId, creatorVersion: CREATOR_VERSION,
            projectRoot: PROJECT_ROOT, assetName: asset.assetName, textureUuid: asset.textureUuid,
            spriteFrameUuid: asset.spriteFrameUuid, sha256: asset.sha256, removed: true,
            assetDbUuidAfter: uuidAfter || null,
        } });
    });
}

function inspectOwnedPng(asset) {
    const filename = path.join(PROJECT_ROOT, 'assets', 'resources', asset.assetName);
    const checks = { filePresent: false, sourceHashMatches: false, pngSignatureValid: false, dimensionsMatch: false,
        metaReadable: false, textureUuidMatches: false, spriteFrameUuidMatches: false, rawTextureUuidMatches: false,
        assetDbUrlUuidMatches: false };
    const issues = [];
    let data; let meta;
    try {
        const stat = fs.lstatSync(filename);
        if (!stat.isFile() || stat.isSymbolicLink()) issues.push('ASSET_FILE_NOT_REGULAR');
        else { data = fs.readFileSync(filename); checks.filePresent = true; }
    } catch (_) { issues.push('ASSET_FILE_MISSING'); }
    if (data) {
        checks.sourceHashMatches = crypto.createHash('sha256').update(data).digest('hex') === asset.sha256;
        if (!checks.sourceHashMatches) issues.push('ASSET_HASH_MISMATCH');
        checks.pngSignatureValid = data.length >= 24 && data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
            && data.toString('ascii', 12, 16) === 'IHDR';
        if (!checks.pngSignatureValid) issues.push('INVALID_PNG');
        if (checks.pngSignatureValid) {
            checks.dimensionsMatch = data.readUInt32BE(16) === asset.width && data.readUInt32BE(20) === asset.height;
            if (!checks.dimensionsMatch) issues.push('PNG_DIMENSIONS_MISMATCH');
        }
    }
    try {
        const metaPath = `${filename}.meta`;
        const stat = fs.lstatSync(metaPath);
        if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('meta is not a regular file');
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        checks.metaReadable = true;
    } catch (_) { issues.push('META_UNREADABLE'); }
    if (meta) {
        checks.textureUuidMatches = meta.importer === 'texture' && meta.uuid === asset.textureUuid;
        if (!checks.textureUuidMatches) issues.push('TEXTURE_UUID_MISMATCH');
        const frames = Object.values(meta.subMetas || {}).filter((sub) => sub && sub.importer === 'sprite-frame');
        checks.spriteFrameUuidMatches = frames.length === 1 && frames[0].uuid === asset.spriteFrameUuid;
        if (!checks.spriteFrameUuidMatches) issues.push('SPRITEFRAME_UUID_MISMATCH');
        checks.rawTextureUuidMatches = frames.length === 1 && frames[0].rawTextureUuid === asset.textureUuid;
        if (!checks.rawTextureUuidMatches) issues.push('RAWTEXTURE_UUID_MISMATCH');
    }
    const url = `db://assets/resources/${asset.assetName}`;
    const dbUuid = Editor.assetdb.urlToUuid(url);
    checks.assetDbUrlUuidMatches = dbUuid === asset.textureUuid;
    if (!checks.assetDbUrlUuidMatches) issues.push('ASSETDB_MAPPING_STALE');
    const diskIssues = issues.filter((code) => code !== 'ASSETDB_MAPPING_STALE');
    const repairable = diskIssues.length === 0 && !checks.assetDbUrlUuidMatches;
    return { status: diskIssues.length ? 'needs-review' : repairable ? 'repairable' : 'valid', checks,
        issues, repairable, assetDbUrlUuid: dbUuid || null };
}

function validateOwnedPng(message, refresh) {
    const params = message.params || {};
    const asset = activeSession && activeSession.assetAction;
    if (!asset || asset.kind !== (refresh ? 'refresh' : 'validate') || params.sessionId !== activeSession.sessionId
        || typeof params.nonce !== 'string' || params.pipelineId !== asset.pipelineId || params.assetName !== asset.assetName) {
        send({ type: 'response', id: message.id, ok: false, error: { code: 'INVALID_ASSET_VALIDATION_SESSION' } });
        return;
    }
    const initial = inspectOwnedPng(asset);
    if (!refresh) {
        send({ type: 'response', id: message.id, ok: true, result: { nonce: params.nonce, sessionId: activeSession.sessionId,
            projectRoot: PROJECT_ROOT, creatorVersion: CREATOR_VERSION, pipelineId: asset.pipelineId,
            assetName: asset.assetName, status: initial.status, checks: initial.checks, issues: initial.issues,
            repairable: initial.repairable, assetDbUrlUuid: initial.assetDbUrlUuid } });
        return;
    }
    if (initial.status === 'valid') {
        send({ type: 'response', id: message.id, ok: true, result: { nonce: params.nonce, sessionId: activeSession.sessionId,
            projectRoot: PROJECT_ROOT, creatorVersion: CREATOR_VERSION, pipelineId: asset.pipelineId,
            assetName: asset.assetName, status: 'valid', refreshed: false, checks: initial.checks,
            assetDbUrlUuid: initial.assetDbUrlUuid, issues: [] } });
        return;
    }
    if (initial.status !== 'repairable') {
        send({ type: 'response', id: message.id, ok: false, error: { code: 'ASSET_REPAIR_UNSAFE',
            message: 'Source bytes or imported metadata do not match the recorded pipeline identity.' } });
        return;
    }
    const url = `db://assets/resources/${asset.assetName}`;
    Editor.assetdb.refresh(url, (error, results) => {
        if (error) {
            send({ type: 'response', id: message.id, ok: false, error: { code: 'ASSETDB_REFRESH_FAILED', message: String(error.message || error) } });
            return;
        }
        const after = inspectOwnedPng(asset);
        const rows = Array.isArray(results) ? results : [];
        const identityChanges = rows.filter((row) => row && row.command === 'uuid-change').map((row) => ({ oldUuid: row.oldUuid, uuid: row.uuid }));
        if (after.status !== 'valid' || identityChanges.length) {
            send({ type: 'response', id: message.id, ok: false, error: { code: 'ASSET_REFRESH_IDENTITY_UNVERIFIED',
                message: JSON.stringify({ status: after.status, issues: after.issues, identityChanges }) } });
            return;
        }
        send({ type: 'response', id: message.id, ok: true, result: { nonce: params.nonce, sessionId: activeSession.sessionId,
            projectRoot: PROJECT_ROOT, creatorVersion: CREATOR_VERSION, pipelineId: asset.pipelineId,
            assetName: asset.assetName, status: 'valid', refreshed: true,
            refreshCommands: rows.map((row) => row && row.command).filter(Boolean), checks: after.checks } });
    });
}

function refreshAssetFolder(message) {
    const params = message.params || {};
    const request = activeSession && activeSession.assetFolderRefresh;
    if (!request || params.sessionId !== activeSession.sessionId || params.nonce !== request.nonce
        || params.folderPath !== request.folderPath) {
        send({ type: 'response', id: message.id, ok: false, error: { code: 'INVALID_ASSET_FOLDER_REFRESH_SESSION' } });
        return;
    }
    const segments = request.folderPath.split('/');
    if (!segments.length || segments.length > 8 || segments.some((part) => !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(part) || part === '.' || part === '..')) {
        send({ type: 'response', id: message.id, ok: false, error: { code: 'INVALID_ASSET_FOLDER_PATH' } });
        return;
    }
    let currentPath = path.join(PROJECT_ROOT, 'assets');
    try {
        const rootStat = fs.lstatSync(currentPath);
        if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('assets root is not a regular directory');
        for (const segment of segments) {
            currentPath = path.join(currentPath, segment);
            const stat = fs.lstatSync(currentPath);
            if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('target path contains a non-directory or symbolic link');
        }
    } catch (_) {
        send({ type: 'response', id: message.id, ok: false, error: { code: 'ASSET_FOLDER_UNAVAILABLE' } });
        return;
    }
    const url = `db://assets/${request.folderPath}/`;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:@[0-9a-f]+)?$/i;
    Editor.assetdb.refresh(url, (error, results) => {
        if (error) {
            send({ type: 'response', id: message.id, ok: false,
                error: { code: 'ASSETDB_REFRESH_FAILED', message: String(error.message || error).slice(0, 400) } });
            return;
        }
        if (!Array.isArray(results) || results.length > 20000) {
            send({ type: 'response', id: message.id, ok: false, error: { code: 'ASSETDB_REFRESH_RESULT_INVALID' } });
            return;
        }
        const sanitized = [];
        for (const row of results.slice(0, 16)) {
            const rootUrl = `db://assets/${request.folderPath}`;
            const rowUrlValid = row && typeof row.url === 'string'
                && (row.url === rootUrl || row.url === `${rootUrl}/` || row.url.startsWith(`${rootUrl}/`))
                && row.url.length <= 512 && !/[\\\u0000-\u001f\u007f?#]/.test(row.url)
                && row.url.slice('db://assets/'.length).replace(/\/$/, '').split('/').every((part) => part && part !== '.' && part !== '..');
            if (!row || !['create', 'change', 'delete', 'uuid-change'].includes(row.command)
                || !uuidPattern.test(row.uuid || '') || typeof row.url !== 'string' || row.url.length > 512
                || !rowUrlValid || typeof row.type !== 'string' || !/^[A-Za-z0-9._-]{1,96}$/.test(row.type)
                || (row.command === 'uuid-change' && !uuidPattern.test(row.oldUuid || ''))) {
                send({ type: 'response', id: message.id, ok: false, error: { code: 'ASSETDB_REFRESH_RESULT_INVALID' } });
                return;
            }
            sanitized.push({ command: row.command, uuid: row.uuid, ...(row.command === 'uuid-change' ? { oldUuid: row.oldUuid } : {}), url: row.url, type: row.type });
        }
        send({ type: 'response', id: message.id, ok: true, result: {
            nonce: params.nonce, sessionId: activeSession.sessionId, creatorVersion: CREATOR_VERSION,
            projectRoot: PROJECT_ROOT, folderPath: request.folderPath, url,
            refreshed: true, resultCount: results.length, truncated: results.length > sanitized.length,
            results: sanitized,
        } });
    });
}

function connectFromSession() {
    if (connecting || (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING))) return;
    let session;
    try {
        session = JSON.parse(fs.readFileSync(SESSION_PATH, 'utf8'));
    } catch (_) {
        return;
    }
    if (session.protocolVersion !== PROTOCOL_VERSION
        || session.creatorVersion !== CREATOR_VERSION
        || path.resolve(session.projectRoot || '') !== PROJECT_ROOT
        || typeof session.token !== 'string'
        || !/^ws:\/\/127\.0\.0\.1:\d+\/cocos-agent-bridge$/.test(session.url)
        || session.expiresAt < Date.now()) {
        if (lastSessionId !== session.sessionId) {
            lastSessionId = session.sessionId;
            console.warn('[COCOS_AGENT_BRIDGE_2] ignored incompatible or expired local session');
        }
        return;
    }

    activeSession = session;
    connecting = true;
    socket = new WebSocket(session.url, { headers: { 'x-cocos-agent-token': session.token } });
    socket.on('open', () => {
        connecting = false;
        lastSessionId = session.sessionId;
        socket.send(JSON.stringify({
            type: 'hello',
            protocolVersion: PROTOCOL_VERSION,
            creatorVersion: CREATOR_VERSION,
            projectRoot: PROJECT_ROOT,
            extension: 'cocos-agent-bridge',
            instanceId: INSTANCE_ID,
            capabilities: ['bridge.ping', 'scene.snapshot', 'scene.node.inspect', 'asset.searchPng', 'asset.importPng', 'asset.removeImportedPng', 'asset.validatePng', 'asset.refreshPng', 'asset.refreshFolder', 'scene.preflightPngSprite', 'scene.placePngSprite', 'scene.removePngSprite', 'scene.node.create.preflight', 'scene.node.create', 'scene.node.patch.preflight', 'scene.node.patch', 'scene.node.patch.snapshot', 'prefab.source.patch.preflight', 'prefab.source.patch.execute'],
            operationContract: { id: 'scene.pngSprite', contractVersion: '0.1', creatorVersion: CREATOR_VERSION, access: 'scene-write', actions: ['apply', 'compensate', 'replay'], previewVerification: 'manual-web', compensation: 'identity-checked-node-removal', positionSpace: 'canvas-local-design-pixels' },
            assetRemovalContract: { id: 'asset.removeImportedPng', contractVersion: '0.1', creatorVersion: CREATOR_VERSION,
                access: 'write', implementation: 'Editor.assetdb.delete', verify: 'matching-texture-uuid-and-deleted-result' },
            assetValidationContract: { id: 'asset.validatePng', repairId: 'asset.refreshPng', contractVersion: '0.1', creatorVersion: CREATOR_VERSION,
                refreshImplementation: 'Editor.assetdb.refresh', refreshRequires: 'matching-pipeline-owned-file-meta-and-scene-reference' },
            assetSearchContract: { id: 'asset.searchPng', contractVersion: '0.1', creatorVersion: CREATOR_VERSION,
                access: 'read', implementation: 'Editor.assetdb.queryAssets', maximumPageSize: 50 },
            assetFolderRefreshContract: { id: 'asset.refreshFolder', contractVersion: '0.1', creatorVersion: CREATOR_VERSION,
                access: 'write', implementation: 'Editor.assetdb.refresh', target: 'db://assets/<relative-folder>/' },
        }));
        console.log(`[COCOS_AGENT_BRIDGE_2] connected to local Agent session ${session.sessionId}`);
    });
    socket.on('message', onMessage);
    socket.on('close', () => { connecting = false; socket = null; });
    socket.on('error', () => { connecting = false; });
}

function sendAssistantPanel(message, payload) {
    try { Editor.Ipc.sendToPanel('cocos-agent-bridge', message, payload); } catch (_) {}
}

function stopAssistantRuntime() {
    if (assistantStartupTimer) clearTimeout(assistantStartupTimer);
    assistantStartupTimer = null;
    assistantRuntimeInfo = null;
    assistantKeyFingerprint = null;
    if (assistantProcess) {
        const child = assistantProcess;
        assistantProcess = null;
        try { child.kill(); } catch (_) {}
    }
}

async function startAssistantRuntime(payload) {
    const request = payload || {};
    const sequence = ++assistantStartSequence;
    assistantStartPending = true;
    let apiKey = typeof request.apiKey === 'string' ? request.apiKey.trim() : '';
    let model = request.model;
    let remembered = false;

    try {
        if (!apiKey && request.remember !== false) {
            const saved = await assistantCredentialStore.load();
            if (sequence !== assistantStartSequence) return;
            if (saved) {
                apiKey = saved.apiKey;
                model = ['deepseek-flash', 'deepseek-v4-pro'].includes(request.model) ? request.model : saved.model;
                remembered = true;
            } else if (request.automatic) {
                assistantCredentialError = null;
                assistantStartPending = false;
                return;
            }
        }
        if (apiKey && request.remember === true) {
            await assistantCredentialStore.save(apiKey, model);
            remembered = true;
        } else if (apiKey && request.remember === false) {
            await assistantCredentialStore.clear();
        }
        if (sequence !== assistantStartSequence) return;
    } catch (_) {
        if (sequence !== assistantStartSequence) return;
        assistantStartPending = false;
        assistantCredentialError = '无法读取或保存项目根目录的 .env.local；请检查文件权限后重试。';
        sendAssistantPanel('assistant-runtime-error', { message: assistantCredentialError });
        return;
    }

    if (apiKey.length < 8 || /[\r\n\u0000]/.test(apiKey)) {
        assistantStartPending = false;
        assistantCredentialError = apiKey ? 'DeepSeek API Key 无效。' : '请先输入 DeepSeek API Key，或在项目根目录 .env.local 中设置 DEEPSEEK_API_KEY。';
        sendAssistantPanel('assistant-runtime-error', { message: assistantCredentialError });
        return;
    }
    if (!['deepseek-flash', 'deepseek-v4-pro'].includes(model)) {
        assistantStartPending = false;
        assistantCredentialError = '所选 DeepSeek 模型暂不支持。';
        sendAssistantPanel('assistant-runtime-error', { message: assistantCredentialError });
        return;
    }
    assistantCredentialError = null;

    const keyFingerprint = crypto.createHash('sha256').update(apiKey).digest('hex');
    if (assistantRuntimeInfo && assistantProcess && assistantKeyFingerprint === keyFingerprint
        && assistantRuntimeInfo.model === model) {
        assistantCredentialRemembered = remembered;
        assistantRuntimeInfo.credentialRemembered = remembered;
        assistantStartPending = false;
        sendAssistantPanel('assistant-runtime-ready', assistantRuntimeInfo);
        return;
    }
    stopAssistantRuntime();

    const hostScript = path.resolve(__dirname, '../../../tools/cocos-agent-bridge/mcp/assistant-host.mjs');
    if (!fs.existsSync(hostScript)) {
        assistantStartPending = false;
        sendAssistantPanel('assistant-runtime-error', { message: '找不到 CocosAgent Assistant 服务入口。' });
        return;
    }
    const nodeCommand = process.env.COCOS_AGENT_NODE || 'node';
    const env = Object.assign({}, process.env, { DEEPSEEK_API_KEY: apiKey });
    const child = childProcess.spawn(nodeCommand, [hostScript, '--project', PROJECT_ROOT, '--model', model], {
        cwd: path.dirname(hostScript), env, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'],
    });
    assistantProcess = child;
    assistantKeyFingerprint = keyFingerprint;
    assistantCredentialRemembered = remembered;
    let output = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
        output += chunk;
        let newline = output.indexOf('\n');
        while (newline >= 0) {
            const line = output.slice(0, newline).trim();
            output = output.slice(newline + 1);
            newline = output.indexOf('\n');
            if (!line.startsWith('READY ')) continue;
            try {
                const ready = JSON.parse(line.slice(6));
                if (assistantProcess !== child || !Number.isInteger(ready.port) || typeof ready.token !== 'string') return;
                assistantRuntimeInfo = { ready: true, port: ready.port, token: ready.token, model: ready.model,
                    creatorVersion: ready.creatorVersion, credentialRemembered: assistantCredentialRemembered };
                if (assistantStartupTimer) clearTimeout(assistantStartupTimer);
                assistantStartupTimer = null;
                assistantStartPending = false;
                sendAssistantPanel('assistant-runtime-ready', assistantRuntimeInfo);
            } catch (_) {}
        }
    });
    child.on('error', () => {
        if (assistantProcess !== child) return;
        stopAssistantRuntime();
        sendAssistantPanel('assistant-runtime-error', { message: '无法启动 Node.js Assistant 服务；请确认 Node.js 20+ 可用。' });
    });
    child.on('close', () => {
        if (assistantProcess !== child) return;
        const wasReady = !!assistantRuntimeInfo;
        assistantProcess = null;
        assistantRuntimeInfo = null;
        assistantKeyFingerprint = null;
        assistantCredentialRemembered = false;
        assistantStartPending = false;
        if (assistantStartupTimer) clearTimeout(assistantStartupTimer);
        assistantStartupTimer = null;
        sendAssistantPanel(wasReady ? 'assistant-runtime-stopped' : 'assistant-runtime-error', {
            message: wasReady ? 'Agent 服务已停止。' : 'Agent 服务未能启动；请确认 Node.js 20+ 可用并已安装 MCP 依赖。',
        });
    });
    assistantStartupTimer = setTimeout(() => {
        if (assistantProcess !== child || assistantRuntimeInfo) return;
        stopAssistantRuntime();
        assistantStartPending = false;
        sendAssistantPanel('assistant-runtime-error', { message: 'Assistant 服务启动超时。' });
    }, 20000);
}

async function forgetAssistantCredential() {
    const sequence = ++assistantForgetSequence;
    ++assistantStartSequence;
    assistantStartPending = false;
    try {
        await assistantCredentialStore.clear();
    } catch (_) {
        stopAssistantRuntime();
        assistantCredentialRemembered = false;
        assistantCredentialError = '未能清除项目根目录 .env.local 中的 DeepSeek 配置；请检查文件权限。';
        sendAssistantPanel('assistant-runtime-error', { message: assistantCredentialError });
        return;
    }
    if (sequence !== assistantForgetSequence) return;
    stopAssistantRuntime();
    assistantCredentialRemembered = false;
    assistantCredentialError = null;
    sendAssistantPanel('assistant-credential-forgotten', { forgotten: true });
}

module.exports = {
    messages: {
        openAssistant() {
            Editor.Panel.open('cocos-agent-bridge');
        },
        assistantState() {
            sendAssistantPanel('assistant-runtime-state', assistantRuntimeInfo
                ? Object.assign({ ready: true }, assistantRuntimeInfo)
                : { ready: false, connecting: assistantStartPending, credentialRemembered: assistantCredentialRemembered,
                    error: assistantCredentialError });
        },
        assistantStart(_event, payload) {
            void startAssistantRuntime(payload);
        },
        assistantCredentialForget() {
            void forgetAssistantCredential();
        },
        'scene:saved'() {
            if (pendingSceneSave) pendingSceneSave(null);
        },
        'scene:ready'() {
            if (pendingSceneReady) pendingSceneReady(null);
        },
    },
    load() {
        connectFromSession();
        timer = setInterval(connectFromSession, 1000);
        void startAssistantRuntime({ automatic: true });
    },
    unload() {
        if (timer) clearInterval(timer);
        timer = null;
        if (socket) socket.close();
        socket = null;
        activeSession = null;
        stopAssistantRuntime();
    },
};
