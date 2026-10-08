'use strict';

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const WebSocket = require('ws');

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
            sourceOperationId: { type: 'string', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' },
            operationId: { type: 'string', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' },
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
        { id: 'scene.pngSprite', contractVersion: '0.1', access: 'write',
            inputSchema: 'catalog.schema.json#/$defs/pngSpriteInput2x', input: COMMAND_INPUTS.pngSprite, preconditions: ['activeScene', 'canvasExisting', 'spriteFrameImported'],
            status: spriteReady ? 'available' : 'unavailable', reason: spriteReady ? null : sceneReady ? 'CANVAS_NOT_FOUND' : 'NO_OPEN_SCENE' },
        { id: 'scene.node.create', contractVersion: '0.1', access: 'write',
            inputSchema: 'catalog.schema.json#/$defs/nodeCreateInput2x', input: COMMAND_INPUTS.nodeCreate, preconditions: ['activeScene', 'parentIdentity', 'componentTypesWhitelisted', 'componentSetCompatible', 'resourceReferencesResolvable'],
            status: sceneReady ? 'available' : 'unavailable', reason: sceneReady ? null : 'NO_OPEN_SCENE' },
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
            const commands = commandCatalog({ ...sceneContext, assetDbReady: !!(Editor.assetdb && typeof Editor.assetdb.queryAssets === 'function') });
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
        || JSON.stringify(params.transform || {}) !== JSON.stringify(operation.transform || {})) {
        send({ type: 'response', id: message.id, ok: false, error: { code: 'INVALID_NODE_SESSION' } }); return;
    }
    const preflight = message.method.endsWith('.preflight');
    Editor.Scene.callSceneScript('cocos-agent-bridge', preflight ? 'node-create-preflight' : 'node-create-mutate', operation, (error, result) => {
        if (error) { send({ type: 'response', id: message.id, ok: false, error: { code: error.code || 'NODE_OPERATION_FAILED', message: String(error.message || error) } }); return; }
        const reply = () => send({ type: 'response', id: message.id, ok: true, result: Object.assign({
            nonce: params.nonce, operationId: params.operationId, creatorVersion: CREATOR_VERSION,
            projectRoot: PROJECT_ROOT, action: operation.action, parentPath: operation.parentPath,
            parentUuid: operation.parentUuid, nodeName: operation.nodeName,
        }, result) });
        if (preflight) reply();
        else saveActiveScene((saveError) => {
            if (saveError) { send({ type: 'response', id: message.id, ok: false, error: { code: 'SCENE_SAVE_UNVERIFIED', message: String(saveError.message || saveError) } }); return; }
            result.saved = true; reply();
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
    if (!Editor.assetdb || typeof Editor.assetdb.queryAssets !== 'function') { failSearch('ASSETDB_UNAVAILABLE'); return; }
    let assetsRoot;
    try { assetsRoot = fs.realpathSync(path.resolve(PROJECT_ROOT, 'assets')); }
    catch (error) { failSearch('ASSET_QUERY_FAILED', error); return; }
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const query = search.query.toLocaleLowerCase();
    try {
        Editor.assetdb.queryAssets('db://assets/**/*', 'texture', (error, results) => {
            if (error || !Array.isArray(results)) { failSearch('ASSET_QUERY_FAILED', error || 'AssetDB returned no result list.'); return; }
            try {
                const matches = results.filter((item) => item && item.isSubAsset !== true && item.type === 'texture'
                    && typeof item.url === 'string' && item.url.startsWith('db://assets/') && /\.png$/i.test(item.url)
                    && typeof item.uuid === 'string' && uuidPattern.test(item.uuid))
                    .map((item) => ({ item, relativeUrl: item.url.slice('db://assets/'.length) }))
                    .filter(({ relativeUrl }) => {
                        let decoded = relativeUrl;
                        try { decoded = decodeURIComponent(relativeUrl); } catch (_) { /* Keep the AssetDB URL for literal matching. */ }
                        return `${decoded} ${path.posix.basename(decoded)}`.toLocaleLowerCase().includes(query);
                    })
                    .sort((left, right) => left.item.url.localeCompare(right.item.url));
                const total = matches.length;
                const page = matches.slice(search.offset, search.offset + search.limit);
                const items = page.map(({ item, relativeUrl }) => {
                    let metadataStatus = 'unavailable';
                    let spriteFrameUuid = null;
                    let width = null;
                    let height = null;
                    let decoded = relativeUrl;
                    try { decoded = decodeURIComponent(relativeUrl); } catch (_) { /* Keep the AssetDB URL for display. */ }
                    try {
                        const segments = decoded.split('/');
                        if (!decoded || decoded.includes('\\') || segments.some((segment) => !segment || segment === '.' || segment === '..'))
                            throw new Error('Asset URL is not a safe project-relative path.');
                        const assetPath = path.resolve(assetsRoot, ...segments);
                        if (!assetPath.startsWith(`${assetsRoot}${path.sep}`)) throw new Error('Asset path escaped project assets.');
                        const realAssetPath = fs.realpathSync(assetPath);
                        if (!realAssetPath.startsWith(`${assetsRoot}${path.sep}`)) throw new Error('Asset path resolves outside project assets.');
                        const assetStat = fs.lstatSync(assetPath);
                        const metaStat = fs.lstatSync(`${assetPath}.meta`);
                        if (!assetStat.isFile() || assetStat.isSymbolicLink() || !metaStat.isFile() || metaStat.isSymbolicLink())
                            throw new Error('Asset and metadata must be regular files.');
                        const meta = JSON.parse(fs.readFileSync(`${assetPath}.meta`, 'utf8'));
                        if (meta.importer !== 'texture' || meta.uuid !== item.uuid) metadataStatus = 'identity-mismatch';
                        else {
                            width = Number.isInteger(meta.width) && meta.width > 0 ? meta.width : null;
                            height = Number.isInteger(meta.height) && meta.height > 0 ? meta.height : null;
                            const frames = Object.values(meta.subMetas || {}).filter((sub) => sub && sub.importer === 'sprite-frame');
                            if (frames.length === 1 && frames[0].rawTextureUuid === item.uuid && uuidPattern.test(frames[0].uuid || '')) {
                                spriteFrameUuid = frames[0].uuid;
                                metadataStatus = 'valid';
                            } else metadataStatus = 'sprite-frame-unavailable';
                        }
                    } catch (_) { metadataStatus = 'metadata-unavailable'; }
                    return { name: path.posix.basename(decoded), url: item.url, type: 'texture', textureUuid: item.uuid,
                        spriteFrameUuid, width, height, metadataStatus };
                });
                send({ type: 'response', id: message.id, ok: true, result: {
                    nonce: search.nonce, sessionId: activeSession.sessionId, creatorVersion: CREATOR_VERSION,
                    projectRoot: PROJECT_ROOT, query: search.query, total, offset: search.offset, limit: search.limit,
                    nextOffset: search.offset + items.length < total ? search.offset + items.length : null, items,
                } });
            } catch (queryError) { failSearch('ASSET_QUERY_FAILED', queryError); }
        });
    } catch (error) { failSearch('ASSET_QUERY_FAILED', error); }
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
            capabilities: ['bridge.ping', 'scene.snapshot', 'scene.node.inspect', 'asset.searchPng', 'asset.importPng', 'asset.removeImportedPng', 'asset.validatePng', 'asset.refreshPng', 'scene.preflightPngSprite', 'scene.placePngSprite', 'scene.removePngSprite', 'scene.node.create.preflight', 'scene.node.create'],
            operationContract: { id: 'scene.pngSprite', contractVersion: '0.1', creatorVersion: CREATOR_VERSION, access: 'scene-write', actions: ['apply', 'compensate', 'replay'], previewVerification: 'manual-web', compensation: 'identity-checked-node-removal', positionSpace: 'canvas-local-design-pixels' },
            assetRemovalContract: { id: 'asset.removeImportedPng', contractVersion: '0.1', creatorVersion: CREATOR_VERSION,
                access: 'write', implementation: 'Editor.assetdb.delete', verify: 'matching-texture-uuid-and-deleted-result' },
            assetValidationContract: { id: 'asset.validatePng', repairId: 'asset.refreshPng', contractVersion: '0.1', creatorVersion: CREATOR_VERSION,
                refreshImplementation: 'Editor.assetdb.refresh', refreshRequires: 'matching-pipeline-owned-file-meta-and-scene-reference' },
            assetSearchContract: { id: 'asset.searchPng', contractVersion: '0.1', creatorVersion: CREATOR_VERSION,
                access: 'read', implementation: 'Editor.assetdb.queryAssets', maximumPageSize: 50 },
        }));
        console.log(`[COCOS_AGENT_BRIDGE_2] connected to local Agent session ${session.sessionId}`);
    });
    socket.on('message', onMessage);
    socket.on('close', () => { connecting = false; socket = null; });
    socket.on('error', () => { connecting = false; });
}

module.exports = {
    messages: {
        'scene:saved'() {
            if (pendingSceneSave) pendingSceneSave(null);
        },
    },
    load() {
        connectFromSession();
        timer = setInterval(connectFromSession, 1000);
    },
    unload() {
        if (timer) clearInterval(timer);
        timer = null;
        if (socket) socket.close();
        socket = null;
        activeSession = null;
    },
};
