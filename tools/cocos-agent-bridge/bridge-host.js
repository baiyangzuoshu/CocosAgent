'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const WebSocket = require('./vendor/ws');
const operationStore = require('./operation-store');

const PROTOCOL_VERSION = '0.1';
const SUPPORTED_CREATORS = new Set(['2.4.15', '3.8.7']);
const MAX_PNG_BYTES = 10 * 1024 * 1024;
const MAX_PNG_DIMENSION = 4096;

function argument(name) {
    const index = process.argv.indexOf(name);
    return index < 0 ? undefined : process.argv[index + 1];
}

function fail(message) {
    process.stderr.write(`${message}\n`);
    process.exit(2);
}

const projectRootArg = argument('--project');
const creatorVersion = argument('--creator-version');
const pngSourceArg = argument('--png');
const assetSearchQuery = argument('--asset-search-png');
const assetSearchLimitArg = argument('--asset-search-limit');
const assetSearchOffsetArg = argument('--asset-search-offset');
const removeAssetName = argument('--asset-remove');
const removeTextureUuid = argument('--texture-uuid');
const removeSpriteFrameUuid = argument('--sprite-frame-uuid');
const removeSha256 = argument('--source-sha256');
const assetValidateName = argument('--asset-validate');
const assetRefreshName = argument('--asset-refresh');
const assetPipelineId = argument('--asset-pipeline-id');
const sceneAssetName = argument('--scene-asset');
const sceneAction = argument('--scene-action');
const requestedOperationId = argument('--operation-id');
const scenePositionArg = argument('--scene-position');
const operationGetId = argument('--operation-get');
const nodePath = argument('--node-path');
const interruptAfterEditor = process.argv.includes('--interrupt-after-editor');
const expectedInstanceId = argument('--expected-instance-id');
const expectedScene = argument('--expected-scene');
let assetSearch = null;
if (assetSearchQuery !== undefined) {
    const limit = assetSearchLimitArg === undefined ? 20 : Number(assetSearchLimitArg);
    const offset = assetSearchOffsetArg === undefined ? 0 : Number(assetSearchOffsetArg);
    if (creatorVersion !== '2.4.15' || assetSearchQuery.length < 1 || assetSearchQuery.length > 80
        || /[\u0000-\u001f\u007f]/.test(assetSearchQuery) || !Number.isInteger(limit) || limit < 1 || limit > 50
        || !Number.isInteger(offset) || offset < 0 || offset > 100000) {
        fail('--asset-search-png requires a bounded query and Creator 2.4.15; limit must be 1–50 and offset 0–100000.');
    }
    assetSearch = { query: assetSearchQuery, limit, offset };
} else if (assetSearchLimitArg !== undefined || assetSearchOffsetArg !== undefined) {
    fail('--asset-search-limit/offset require --asset-search-png.');
}
if (operationGetId && (sceneAssetName || sceneAction || scenePositionArg || pngSourceArg || assetSearch || removeAssetName || assetValidateName || assetRefreshName || requestedOperationId || interruptAfterEditor)) {
    fail('--operation-get is read-only and cannot be combined with write options.');
}
if (nodePath && (sceneAssetName || sceneAction || pngSourceArg || assetSearch || removeAssetName || assetValidateName || assetRefreshName || operationGetId)
    || (nodePath && (nodePath.length > 240 || nodePath.includes('\\') || nodePath.includes('//')))) {
    fail('--node-path requires a bounded scene path and cannot be combined with writes.');
}
if (requestedOperationId && !sceneAssetName) fail('--operation-id requires a scene operation.');
if (interruptAfterEditor && !sceneAssetName) fail('--interrupt-after-editor requires a scene operation.');
if (assetSearch && (pngSourceArg || removeAssetName || assetValidateName || assetRefreshName || sceneAssetName || sceneAction
    || scenePositionArg || requestedOperationId || interruptAfterEditor || operationGetId || nodePath))
    fail('--asset-search-png is a read-only action and cannot be combined with another command.');
if (removeAssetName && (pngSourceArg || assetSearch || sceneAssetName || sceneAction || scenePositionArg || requestedOperationId || interruptAfterEditor
    || creatorVersion !== '2.4.15' || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,94}\.png$/i.test(removeAssetName)
    || !/^[0-9a-f-]{36}$/i.test(removeTextureUuid || '') || !/^[0-9a-f-]{36}$/i.test(removeSpriteFrameUuid || '')
    || !/^[0-9a-f]{64}$/.test(removeSha256 || ''))) fail('--asset-remove requires one exact Creator 2.4.15 PNG identity and cannot be combined with another action.');
if (!removeAssetName && (removeTextureUuid || removeSpriteFrameUuid || removeSha256)) fail('Asset removal identity flags require --asset-remove.');
const assetActionCount = [assetValidateName, assetRefreshName].filter(Boolean).length;
if (assetActionCount && (assetActionCount !== 1 || pngSourceArg || assetSearch || removeAssetName || sceneAssetName || sceneAction || scenePositionArg
    || requestedOperationId || interruptAfterEditor || creatorVersion !== '2.4.15' || !assetPipelineId
    || !/^[0-9a-f-]{36}$/i.test(assetPipelineId)
    || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,94}\.png$/i.test(assetValidateName || assetRefreshName)))
    fail('--asset-validate or --asset-refresh requires one pipeline-owned PNG and a Creator 2.4.15 pipeline ID.');
if (!assetActionCount && assetPipelineId) fail('--asset-pipeline-id requires --asset-validate or --asset-refresh.');
if (expectedInstanceId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expectedInstanceId)) fail('Invalid expected instance ID.');
if (expectedScene && !/^[A-Za-z0-9_-]{1,64}$/.test(expectedScene)) fail('Invalid expected scene name.');
if (!projectRootArg || !creatorVersion) {
    fail('Usage: node bridge-host.js --project <project-root> --creator-version <2.4.15|3.8.7> [--png <local-png-file>]');
}
if (!SUPPORTED_CREATORS.has(creatorVersion)) {
    fail(`Unsupported Creator version: ${creatorVersion}`);
}
if ((sceneAssetName && !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,94}\.png$/i.test(sceneAssetName))
    || (sceneAction && !['apply', 'compensate', 'replay'].includes(sceneAction))
    || (sceneAction && !sceneAssetName)
    || (!sceneAction && sceneAssetName)) {
    fail('--scene-asset requires --scene-action apply|compensate|replay and a PNG filename in assets/resources/.');
}

let scenePosition = null;
if (scenePositionArg !== undefined) {
    try { scenePosition = JSON.parse(scenePositionArg); } catch (_) { fail('--scene-position must be a JSON object with numeric x and y.'); }
    if (creatorVersion !== '2.4.15' || !sceneAssetName || !['apply', 'replay'].includes(sceneAction) || !isCanvasPosition(scenePosition)) {
        fail('--scene-position is supported only for a 2.4.15 scene Sprite apply/replay and coordinates within ±4096.');
    }
}

const projectRoot = path.resolve(projectRootArg);
if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
    fail(`Project directory does not exist: ${projectRoot}`);
}

function readSceneAssetManifest(assetName) {
    const metaPath = path.join(projectRoot, 'assets', 'resources', `${assetName}.meta`);
    let meta;
    try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch (_) { fail(`Cannot read imported asset metadata: ${metaPath}`); }
    const subMetas = meta && meta.subMetas && Object.values(meta.subMetas);
    if (!Array.isArray(subMetas)) fail(`No imported image subasset exists for ${assetName}.`);
    const subAsset = subMetas.find((item) => item && item.importer === 'sprite-frame');
    if (!subAsset || !/^[0-9a-f-]{36}(@[0-9a-f]+)?$/i.test(subAsset.uuid || '')) {
        fail(`No imported SpriteFrame subasset exists for ${assetName}. Set the PNG type to sprite-frame in Creator first.`);
    }
    return {
        assetName,
        nodeName: `CocosAgentAsset_${path.basename(assetName, '.png').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 16)}`,
        assetUuid: subAsset.uuid,
        sceneAction,
        ...(scenePosition ? { position: scenePosition } : {}),
    };
}

function scanAssetReferences(uuids, assetName) {
    const assetsRoot = path.join(projectRoot, 'assets');
    const ignored = new Set([
        path.resolve(assetsRoot, 'resources', assetName),
        path.resolve(assetsRoot, 'resources', `${assetName}.meta`),
    ]);
    const needles = uuids.map((value) => Buffer.from(value, 'ascii'));
    let filesSeen = 0;
    let reference = null;
    function visit(directory, depth) {
        if (depth > 12 || reference) return;
        let entries;
        try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch (_) { return; }
        for (const entry of entries) {
            const fullPath = path.join(directory, entry.name);
            if (entry.isSymbolicLink()) { reference = { path: fullPath, reason: 'SYMLINK_PRESENT' }; return; }
            if (entry.isDirectory()) visit(fullPath, depth + 1);
            else if (entry.isFile() && !ignored.has(path.resolve(fullPath))) {
                filesSeen++;
                if (filesSeen > 20000) { reference = { path: fullPath, reason: 'ASSET_SCAN_LIMIT' }; return; }
                let stat;
                try { stat = fs.statSync(fullPath); } catch (_) { reference = { path: fullPath, reason: 'ASSET_SCAN_UNAVAILABLE' }; return; }
                if (stat.size > 20 * 1024 * 1024) { reference = { path: fullPath, reason: 'ASSET_SCAN_LIMIT' }; return; }
                let contents;
                try { contents = fs.readFileSync(fullPath); } catch (_) { reference = { path: fullPath, reason: 'ASSET_SCAN_UNAVAILABLE' }; return; }
                if (needles.some((needle) => contents.indexOf(needle) !== -1)) { reference = { path: fullPath, reason: 'ASSET_STILL_REFERENCED' }; return; }
            }
            if (reference) return;
        }
    }
    visit(assetsRoot, 0);
    return reference;
}

function readAssetRemovalManifest() {
    if (!removeAssetName) return null;
    const filename = path.join(projectRoot, 'assets', 'resources', removeAssetName);
    const metaFilename = `${filename}.meta`;
    let data; let meta;
    try {
        const assetStat = fs.lstatSync(filename);
        const metaStat = fs.lstatSync(metaFilename);
        if (!assetStat.isFile() || assetStat.isSymbolicLink() || !metaStat.isFile() || metaStat.isSymbolicLink()) fail('ASSET_IDENTITY_UNAVAILABLE');
        data = fs.readFileSync(filename);
        meta = JSON.parse(fs.readFileSync(metaFilename, 'utf8'));
    } catch (_) { fail('ASSET_IDENTITY_UNAVAILABLE'); }
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    const frames = Object.values(meta.subMetas || {}).filter((item) => item && item.importer === 'sprite-frame');
    if (hash !== removeSha256 || meta.importer !== 'texture' || meta.uuid !== removeTextureUuid || frames.length !== 1
        || frames[0].uuid !== removeSpriteFrameUuid || frames[0].rawTextureUuid !== removeTextureUuid) fail('ASSET_IDENTITY_MISMATCH');
    const reference = scanAssetReferences([removeTextureUuid, removeSpriteFrameUuid], removeAssetName);
    if (reference) fail(`${reference.reason}:${path.relative(projectRoot, reference.path)}`);
    return { assetName: removeAssetName, textureUuid: removeTextureUuid, spriteFrameUuid: removeSpriteFrameUuid, sha256: removeSha256 };
}

function assetRemovalStillSafe(asset) {
    if (!asset) return true;
    const filename = path.join(projectRoot, 'assets', 'resources', asset.assetName);
    let data; let meta;
    try {
        const sourceStat = fs.lstatSync(filename);
        const metaStat = fs.lstatSync(`${filename}.meta`);
        if (!sourceStat.isFile() || sourceStat.isSymbolicLink() || !metaStat.isFile() || metaStat.isSymbolicLink()) return false;
        data = fs.readFileSync(filename);
        meta = JSON.parse(fs.readFileSync(`${filename}.meta`, 'utf8'));
    } catch (_) { return false; }
    const frames = Object.values(meta.subMetas || {}).filter((item) => item && item.importer === 'sprite-frame');
    if (crypto.createHash('sha256').update(data).digest('hex') !== asset.sha256 || meta.importer !== 'texture'
        || meta.uuid !== asset.textureUuid || frames.length !== 1 || frames[0].uuid !== asset.spriteFrameUuid
        || frames[0].rawTextureUuid !== asset.textureUuid) return false;
    return !scanAssetReferences([asset.textureUuid, asset.spriteFrameUuid], asset.assetName);
}

function readAssetAction(kind, assetName) {
    const filename = path.join(projectRoot, '.cocos-agent', 'asset-scene-pipelines', `${assetPipelineId}.json`);
    let record;
    try {
        const stat = fs.lstatSync(filename);
        if (!stat.isFile() || stat.isSymbolicLink()) fail('ASSET_PIPELINE_RECORD_INVALID');
        record = JSON.parse(fs.readFileSync(filename, 'utf8'));
    } catch (_) { fail('ASSET_PIPELINE_RECORD_UNAVAILABLE'); }
    if (record.pipelineId !== assetPipelineId || record.projectRoot !== projectRoot || record.creatorVersion !== '2.4.15')
        fail('ASSET_PIPELINE_TARGET_MISMATCH');
    const asset = record.items && record.items.find((item) => item.assetName === assetName);
    if (!asset || asset.importStatus !== 'imported' || !/^[0-9a-f-]{36}$/i.test(asset.textureUuid || '')
        || !/^[0-9a-f-]{36}$/i.test(asset.spriteFrameUuid || '') || !/^[0-9a-f]{64}$/.test(asset.sha256 || '')
        || asset.removalStatus === 'removed') fail('ASSET_NOT_OWNED_BY_PIPELINE');
    if (kind === 'refresh' && !['needs-preview', 'completed'].includes(record.state)) fail('ASSET_PIPELINE_NOT_REPAIRABLE');
    return { kind, pipelineId: record.pipelineId, assetName, sha256: asset.sha256, width: asset.width, height: asset.height,
        textureUuid: asset.textureUuid, spriteFrameUuid: asset.spriteFrameUuid, nodeName: asset.nodeName,
        sceneName: record.sceneName, sceneBatchId: record.sceneBatchId, projectRoot };
}

function refreshAssetStillSafe(asset) {
    const filename = path.join(projectRoot, 'assets', 'resources', asset.assetName);
    let data; let meta;
    try {
        const fileStat = fs.lstatSync(filename);
        const metaStat = fs.lstatSync(`${filename}.meta`);
        if (!fileStat.isFile() || fileStat.isSymbolicLink() || !metaStat.isFile() || metaStat.isSymbolicLink()) return false;
        data = fs.readFileSync(filename);
        meta = JSON.parse(fs.readFileSync(`${filename}.meta`, 'utf8'));
    } catch (_) { return false; }
    const frames = Object.values(meta.subMetas || {}).filter((sub) => sub && sub.importer === 'sprite-frame');
    if (crypto.createHash('sha256').update(data).digest('hex') !== asset.sha256
        || data.length < 24 || !data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
        || data.toString('ascii', 12, 16) !== 'IHDR' || data.readUInt32BE(16) !== asset.width || data.readUInt32BE(20) !== asset.height
        || meta.importer !== 'texture' || meta.uuid !== asset.textureUuid || frames.length !== 1
        || frames[0].uuid !== asset.spriteFrameUuid || frames[0].rawTextureUuid !== asset.textureUuid) return false;
    const batchPath = path.join(projectRoot, '.cocos-agent', 'scene-batches', `${asset.sceneBatchId}.json`);
    let batch;
    try { batch = JSON.parse(fs.readFileSync(batchPath, 'utf8')); } catch (_) { return false; }
    const item = (batch.items || []).find((candidate) => candidate.assetName === asset.assetName);
    if (!item || item.status !== 'applied' || item.assetUuid !== asset.spriteFrameUuid) return false;
    const { readSceneReference } = require('./asset-scene-validation');
    return readSceneReference(projectRoot, asset.sceneName, asset.nodeName, asset.spriteFrameUuid).success;
}

const sceneManifest = sceneAssetName ? readSceneAssetManifest(sceneAssetName) : null;
const assetRemoval = readAssetRemovalManifest();
const assetAction = assetValidateName ? readAssetAction('validate', assetValidateName)
    : assetRefreshName ? readAssetAction('refresh', assetRefreshName) : null;
if (assetAction && assetAction.kind === 'refresh' && !refreshAssetStillSafe(assetAction))
    fail('ASSET_REPAIR_PRECONDITION_FAILED: imported bytes, metadata UUIDs, or serialized scene reference changed.');
const operationId = requestedOperationId || crypto.randomUUID();
if ((requestedOperationId && !/^[0-9a-f-]{36}$/i.test(requestedOperationId))
    || (operationGetId && !/^[0-9a-f-]{36}$/i.test(operationGetId))) fail('Invalid operation ID.');

if (operationGetId) {
    let record;
    try { record = operationStore.read(projectRoot, operationGetId); }
    catch (error) { fail(`operation.get failed: ${error.code === 'ENOENT' ? 'OPERATION_NOT_FOUND' : error.message}`); }
    if (record.creatorVersion !== creatorVersion || record.projectRoot !== projectRoot) fail('OPERATION_TARGET_MISMATCH');
    if (record.intent === 'editor-write-sent' && record.sceneName && record.manifest) {
        const observed = verifySavedScene(record.manifest, record.sceneName);
        if (observed && !record.receipts.some((receipt) => receipt.phase === 'disk' && receipt.status === 'passed')) {
            record.receipts.push({ contractVersion: '0.1', operationId: record.operationId, capabilityId: 'scene.pngSprite', creatorVersion,
                phase: 'disk', status: 'passed', evidence: [{ kind: 'disk-readback', source: 'operation.get', sceneName: record.sceneName,
                    nodeName: record.manifest.nodeName, assetUuid: record.manifest.assetUuid, note: 'Recovered by disk readback after Host restart; editor acknowledgement may be unavailable.' }] });
            record.phases.disk = 'passed';
            record.intent = 'disk-recovered';
            record.updatedAt = new Date().toISOString();
            operationStore.write(projectRoot, record);
        }
    }
    process.stdout.write(`${JSON.stringify({ success: true, data: record })}\n`);
    process.exit(0);
}

const sessionDirectory = path.join(projectRoot, 'temp', 'cocos-agent-bridge');
const sessionPath = path.join(sessionDirectory, 'session.json');
const token = crypto.randomBytes(32).toString('hex');
const sessionId = crypto.randomUUID();
let operationRecord = null;
const requestId = crypto.randomUUID();
const snapshotRequestId = crypto.randomUUID();
const nonce = crypto.randomBytes(12).toString('hex');
const snapshotNonce = crypto.randomBytes(12).toString('hex');
const assetImportRequestId = crypto.randomUUID();
const assetImportNonce = crypto.randomBytes(12).toString('hex');
const assetRemovalRequestId = crypto.randomUUID();
const assetRemovalNonce = crypto.randomBytes(12).toString('hex');
const assetActionRequestId = crypto.randomUUID();
const assetActionNonce = crypto.randomBytes(12).toString('hex');
const assetSearchRequestId = crypto.randomUUID();
const assetSearchNonce = crypto.randomBytes(12).toString('hex');
const sceneRequestId = crypto.randomUUID();
const sceneNonce = crypto.randomBytes(12).toString('hex');
const preflightRequestId = crypto.randomUUID();
const preflightNonce = crypto.randomBytes(12).toString('hex');
const verifySnapshotRequestId = crypto.randomUUID();
const verifySnapshotNonce = crypto.randomBytes(12).toString('hex');
let stagedPngPath = null;
let stagedPng = null;
if (pngSourceArg) {
    const sourcePath = path.resolve(pngSourceArg);
    let sourceStat;
    try { sourceStat = fs.lstatSync(sourcePath); } catch (_) { fail('--png file does not exist.'); }
    const assetName = path.basename(sourcePath);
    if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) fail('--png must point to a regular file, not a symlink.');
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,94}\.png$/i.test(assetName)) fail('--png filename must use letters, numbers, dot, underscore, or hyphen and end in .png.');
    if (sourceStat.size < 24 || sourceStat.size > MAX_PNG_BYTES) fail(`PNG size must be between 24 bytes and ${MAX_PNG_BYTES} bytes.`);
    if (!fs.existsSync(path.join(projectRoot, 'assets', 'resources'))) fail('The project must contain an assets/resources folder.');
    const sourceData = fs.readFileSync(sourcePath);
    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const width = sourceData.readUInt32BE(16);
    const height = sourceData.readUInt32BE(20);
    if (!sourceData.subarray(0, 8).equals(pngSignature) || sourceData.toString('ascii', 12, 16) !== 'IHDR'
        || width < 1 || height < 1 || width > MAX_PNG_DIMENSION || height > MAX_PNG_DIMENSION) {
        fail(`--png must have a valid PNG header with dimensions from 1 to ${MAX_PNG_DIMENSION} pixels.`);
    }
    stagedPngPath = path.join(sessionDirectory, 'inbox', sessionId, assetName);
    stagedPng = {
        fileName: `${sessionId}/${assetName}`,
        assetName,
        sha256: crypto.createHash('sha256').update(sourceData).digest('hex'),
        byteLength: sourceData.length,
        width,
        height,
        destinationFolder: 'db://assets/resources',
        destinationUrl: `db://assets/resources/${assetName}`,
    };
}
if (sceneManifest) {
    operationRecord = { contractVersion: '0.1', operationId, sessionId, projectRoot, creatorVersion,
        manifest: sceneManifest, sceneName: null, intent: 'created', receipts: [],
        phases: { capability: 'pending', preflight: 'pending', editor: 'pending', disk: 'pending', preview: 'pending', recovery: 'pending' },
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    try { operationStore.write(projectRoot, operationRecord, true); }
    catch (error) { fail(`Cannot create operation record: ${error.code === 'EEXIST' ? 'OPERATION_ALREADY_EXISTS' : error.message}`); }
}
let connectedSocket = null;
let finished = false;
let activeSceneName = null;
let pendingSceneResult = null;
let preflightDecision = null;
let handshakeTimer = null;
let requestTimer = null;

function emitReceipt(phase, status, evidence, error) {
    if (!sceneManifest) return;
    const receipt = {
        contractVersion: '0.1',
        operationId,
        capabilityId: 'scene.pngSprite',
        creatorVersion,
        phase,
        status,
        evidence,
    };
    if (error) receipt.error = error;
    operationRecord.receipts.push(receipt);
    operationRecord.phases[phase] = status;
    operationRecord.updatedAt = new Date().toISOString();
    operationStore.write(projectRoot, operationRecord);
    process.stdout.write(`operation.receipt ${JSON.stringify(receipt)}\n`);
    if (phase === 'disk' && status === 'passed') {
        operationRecord.intent = 'disk-verified';
        operationStore.write(projectRoot, operationRecord);
    }
}

function errorCodeOr(value, fallback) {
    return typeof value === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(value) ? value : fallback;
}

function sameSecret(candidate) {
    if (typeof candidate !== 'string') return false;
    const expected = Buffer.from(token, 'utf8');
    const received = Buffer.from(candidate, 'utf8');
    return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function cleanUp(exitCode) {
    if (finished) return;
    finished = true;
    clearTimeout(handshakeTimer);
    clearTimeout(requestTimer);
    try {
        const current = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
        if (current.sessionId === sessionId) fs.unlinkSync(sessionPath);
    } catch (_) {
        // The session may already have been removed by the editor or user.
    }
    if (stagedPngPath) {
        try { fs.unlinkSync(stagedPngPath); } catch (_) { /* The import may already have consumed the staged file. */ }
        try { fs.rmdirSync(path.dirname(stagedPngPath)); } catch (_) { /* Keep unrelated files. */ }
        try { fs.rmdirSync(path.dirname(path.dirname(stagedPngPath))); } catch (_) { /* Keep unrelated files. */ }
    }
    try { fs.rmdirSync(sessionDirectory); } catch (_) { /* Keep unrelated files. */ }
    if (connectedSocket && connectedSocket.readyState === WebSocket.OPEN) connectedSocket.close();
    try { server.close(); } catch (_) { /* Server may not have started. */ }
    process.exitCode = exitCode;
}

function send(socket, value) {
    if (socket.readyState !== WebSocket.OPEN) throw new Error('WebSocket is not open');
    socket.send(JSON.stringify(value));
}

const server = http.createServer((request, response) => {
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('Not found');
});

const webSocketServer = new WebSocket.Server({
    server,
    path: '/cocos-agent-bridge',
    maxPayload: 16 * 1024,
    verifyClient: (info, done) => done(sameSecret(info.req.headers['x-cocos-agent-token'])),
});

webSocketServer.on('error', (error) => {
    process.stderr.write(`Bridge WebSocket server error: ${error.message}\n`);
    cleanUp(1);
});

webSocketServer.on('connection', (socket) => {
    if (connectedSocket) {
        socket.close(1008, 'A bridge client is already connected');
        return;
    }
    connectedSocket = socket;
    process.stdout.write('Extension connected; waiting for version and project handshake.\n');
    handshakeTimer = setTimeout(() => {
        process.stderr.write('Handshake timed out.\n');
        cleanUp(1);
    }, 15000);

    socket.on('message', async (raw) => {
        let message;
        try { message = JSON.parse(raw.toString()); } catch (_) {
            process.stderr.write('Received invalid JSON.\n');
            cleanUp(1);
            return;
        }

        if (message.type === 'hello') {
            const projectMatches = path.resolve(message.projectRoot || '') === projectRoot;
            const versionMatches = message.creatorVersion === creatorVersion;
            const protocolMatches = message.protocolVersion === PROTOCOL_VERSION;
            const extensionMatches = message.extension === 'cocos-agent-bridge';
            const instanceMatches = !expectedInstanceId || message.instanceId === expectedInstanceId;
            const capabilityMatches = Array.isArray(message.capabilities)
                && message.capabilities.includes('scene.snapshot')
                && (!stagedPng || message.capabilities.includes('asset.importPng'))
                && (!assetSearch || message.capabilities.includes('asset.searchPng'))
                && (!assetRemoval || message.capabilities.includes('asset.removeImportedPng'))
                && (!assetAction || (message.capabilities.includes('asset.validatePng')
                    && (assetAction.kind !== 'refresh' || message.capabilities.includes('asset.refreshPng'))))
                && (!sceneManifest || (message.capabilities.includes('scene.preflightPngSprite')
                    && message.capabilities.includes('scene.placePngSprite') && message.capabilities.includes('scene.removePngSprite')));
            const contract = message.operationContract;
            const contractMatches = !sceneManifest || (contract && contract.id === 'scene.pngSprite'
                && contract.contractVersion === '0.1' && contract.creatorVersion === creatorVersion
                && contract.access === 'scene-write'
                && Array.isArray(contract.actions) && contract.actions.join(',') === 'apply,compensate,replay'
                && contract.previewVerification === 'manual-web'
                && contract.compensation === 'identity-checked-node-removal'
                && (!sceneManifest.position || contract.positionSpace === 'canvas-local-design-pixels'));
            const assetRemovalContract = message.assetRemovalContract;
            const removalContractMatches = !assetRemoval || (assetRemovalContract && assetRemovalContract.id === 'asset.removeImportedPng'
                && assetRemovalContract.contractVersion === '0.1' && assetRemovalContract.creatorVersion === creatorVersion
                && assetRemovalContract.access === 'write' && assetRemovalContract.implementation === 'Editor.assetdb.delete'
                && assetRemovalContract.verify === 'matching-texture-uuid-and-deleted-result');
            const assetValidationContract = message.assetValidationContract;
            const assetValidationContractMatches = !assetAction || (assetValidationContract && assetValidationContract.id === 'asset.validatePng'
                && assetValidationContract.repairId === 'asset.refreshPng' && assetValidationContract.contractVersion === '0.1'
                && assetValidationContract.creatorVersion === creatorVersion
                && assetValidationContract.refreshImplementation === 'Editor.assetdb.refresh'
                && assetValidationContract.refreshRequires === 'matching-pipeline-owned-file-meta-and-scene-reference');
            const assetSearchContract = message.assetSearchContract;
            const assetSearchContractMatches = !assetSearch || (assetSearchContract && assetSearchContract.id === 'asset.searchPng'
                && assetSearchContract.contractVersion === '0.1' && assetSearchContract.creatorVersion === creatorVersion
                && assetSearchContract.access === 'read' && assetSearchContract.implementation === 'Editor.assetdb.queryAssets'
                && assetSearchContract.maximumPageSize === 50);
            if (!projectMatches || !versionMatches || !protocolMatches || !extensionMatches || !instanceMatches || !capabilityMatches || !contractMatches || !removalContractMatches || !assetValidationContractMatches || !assetSearchContractMatches) {
                send(socket, {
                    type: 'helloAck',
                    accepted: false,
                    reason: !projectMatches ? 'project-mismatch' : !versionMatches ? 'creator-version-mismatch' : !protocolMatches ? 'protocol-version-mismatch' : !extensionMatches ? 'extension-mismatch' : !instanceMatches ? 'instance-mismatch' : !capabilityMatches ? 'capability-mismatch' : !contractMatches ? 'operation-contract-mismatch' : !removalContractMatches ? 'asset-removal-contract-mismatch' : !assetValidationContractMatches ? 'asset-validation-contract-mismatch' : 'asset-search-contract-mismatch',
                });
                process.stderr.write(`Handshake rejected (project=${projectMatches}, creator=${versionMatches}, protocol=${protocolMatches}, extension=${extensionMatches}, instance=${instanceMatches}, required capabilities=${capabilityMatches}, contract=${contractMatches}, assetRemoval=${removalContractMatches}, assetValidation=${assetValidationContractMatches}, assetSearch=${assetSearchContractMatches}).\n`);
                cleanUp(1);
                return;
            }

            clearTimeout(handshakeTimer);
            send(socket, { type: 'helloAck', accepted: true, sessionId, protocolVersion: PROTOCOL_VERSION });
            process.stdout.write(`Handshake accepted: Creator ${creatorVersion}, project ${projectRoot}.\n`);
            emitReceipt('capability', 'passed', [{ kind: 'capability-declaration', source: 'Creator extension hello', note: 'scene.pngSprite contract 0.1' }]);
            send(socket, { type: 'request', id: requestId, method: 'bridge.ping', params: { nonce } });
            requestTimer = setTimeout(() => {
                process.stderr.write('bridge.ping timed out.\n');
                cleanUp(1);
            }, 10000);
            return;
        }

        if (message.type === 'response' && message.id === requestId) {
            clearTimeout(requestTimer);
            const result = message.result || {};
            const valid = message.ok === true
                && result.nonce === nonce
                && result.creatorVersion === creatorVersion
                && path.resolve(result.projectRoot || '') === projectRoot;
            if (!valid) {
                process.stderr.write(`bridge.ping validation failed (ok=${message.ok === true}, nonce=${result.nonce === nonce}, version=${result.creatorVersion === creatorVersion}, project=${path.resolve(result.projectRoot || '') === projectRoot}).\n`);
                cleanUp(1);
                return;
            }
            process.stdout.write(`bridge.ping verified: ${result.creatorVersion}, project identity confirmed, nonce echoed.\n`);
            if (assetSearch) {
                send(socket, { type: 'request', id: assetSearchRequestId, method: 'asset.searchPng',
                    params: { nonce: assetSearchNonce, sessionId, query: assetSearch.query, limit: assetSearch.limit, offset: assetSearch.offset } });
                requestTimer = setTimeout(() => {
                    process.stderr.write('asset.searchPng timed out.\n');
                    cleanUp(1);
                }, 30000);
                return;
            }
            send(socket, { type: 'request', id: snapshotRequestId, method: 'scene.snapshot', params: { nonce: snapshotNonce, ...(nodePath ? { targetNodePath: nodePath } : {}) } });
            requestTimer = setTimeout(() => {
                process.stderr.write('scene.snapshot timed out.\n');
                cleanUp(1);
            }, 15000);
            return;
        }

        if (message.type === 'response' && message.id === snapshotRequestId) {
            clearTimeout(requestTimer);
            const result = message.result || {};
            const valid = message.ok === true
                && result.nonce === snapshotNonce
                && result.creatorVersion === creatorVersion
                && path.resolve(result.projectRoot || '') === projectRoot
                && typeof result.sceneName === 'string'
                && Array.isArray(result.nodes)
                && result.nodeCount === result.nodes.length
                && typeof result.truncated === 'boolean'
                && result.nodes.length <= 30
                && result.sceneName.length <= 32
                && result.nodes.every((node) => node
                    && typeof node.path === 'string'
                    && node.path.length <= 80
                    && typeof node.name === 'string'
                    && node.name.length <= 32
                    && typeof node.active === 'boolean'
                    && Number.isInteger(node.childCount)
                    && node.childCount >= 0);
            if (!valid) {
                const errorCode = message.error && (message.error.code || message.error.message);
                process.stderr.write(`scene.snapshot response failed validation (ok=${message.ok === true}, error=${String(errorCode || 'none')}).\n`);
                cleanUp(1);
                return;
            }
            process.stdout.write(`scene.snapshot verified: ${result.sceneName || '(unnamed)'}, ${result.nodeCount} nodes${result.truncated ? ', truncated' : ''}.\n`);
            activeSceneName = result.sceneName;
            if (expectedScene && activeSceneName !== expectedScene) {
                process.stderr.write(`SCENE_CHANGED: expected ${expectedScene}, got ${activeSceneName}.\n`);
                cleanUp(1);
                return;
            }
            if (operationRecord) {
                operationRecord.sceneName = activeSceneName;
                operationRecord.updatedAt = new Date().toISOString();
                operationStore.write(projectRoot, operationRecord);
            }
            if (assetRemoval && !assetRemovalStillSafe(assetRemoval)) {
                process.stderr.write('ASSET_REMOVAL_PRECONDITION_CHANGED: the resource identity or serialized reference scan changed before delete.\n');
                cleanUp(1);
                return;
            }
            if (stagedPng) {
                send(socket, {
                    type: 'request',
                    id: assetImportRequestId,
                    method: 'asset.importPng',
                    params: { nonce: assetImportNonce, sessionId },
                });
                requestTimer = setTimeout(() => {
                    process.stderr.write('asset.importPng timed out.\n');
                    cleanUp(1);
                }, 30000);
            } else if (assetRemoval) {
                send(socket, { type: 'request', id: assetRemovalRequestId, method: 'asset.removeImportedPng',
                    params: { nonce: assetRemovalNonce, sessionId, ...assetRemoval } });
                requestTimer = setTimeout(() => {
                    process.stderr.write('asset.removeImportedPng timed out.\n');
                    cleanUp(1);
                }, 30000);
            } else if (assetAction) {
                if (assetAction.kind === 'refresh' && !refreshAssetStillSafe(assetAction)) {
                    process.stderr.write('ASSET_REPAIR_PRECONDITION_CHANGED: asset identity or scene reference changed before refresh.\n');
                    cleanUp(1);
                    return;
                }
                send(socket, { type: 'request', id: assetActionRequestId,
                    method: assetAction.kind === 'refresh' ? 'asset.refreshPng' : 'asset.validatePng',
                    params: { nonce: assetActionNonce, sessionId, pipelineId: assetAction.pipelineId, assetName: assetAction.assetName } });
                requestTimer = setTimeout(() => {
                    process.stderr.write(`asset ${assetAction.kind} timed out.\n`);
                    cleanUp(1);
                }, 30000);
            } else if (sceneManifest) {
                requestPreflight();
            } else if (nodePath) {
                const target = result.targetNode;
                if (!target || target.path !== nodePath || !['found', 'not-found', 'ambiguous'].includes(target.status)
                    || (target.status === 'found' && (typeof target.uuid !== 'string' || target.uuid.length === 0
                        || !Array.isArray(target.components) || target.components.length > 32))) {
                    process.stderr.write('scene.node.inspect response failed validation.\n');
                    cleanUp(1);
                    return;
                }
                process.stdout.write(`command.result ${JSON.stringify({ command: 'scene.node.inspect', result: { sceneName: activeSceneName, node: target } })}\n`);
                cleanUp(0);
            } else {
                process.stdout.write(`command.result ${JSON.stringify({ command: 'scene.snapshot', result })}\n`);
                cleanUp(0);
            }
            return;
        }

        if (message.type === 'response' && message.id === assetSearchRequestId) {
            clearTimeout(requestTimer);
            const result = message.result || {};
            const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            const expectedNextOffset = Array.isArray(result.items) && result.offset + result.items.length < result.total
                ? result.offset + result.items.length : null;
            const valid = message.ok === true && result.nonce === assetSearchNonce && result.sessionId === sessionId
                && result.creatorVersion === creatorVersion && path.resolve(result.projectRoot || '') === projectRoot
                && result.query === assetSearch.query && result.offset === assetSearch.offset && result.limit === assetSearch.limit
                && Number.isSafeInteger(result.total) && result.total >= 0
                && Array.isArray(result.items) && result.items.length <= assetSearch.limit
                && result.nextOffset === expectedNextOffset
                && result.items.every((item) => item && typeof item.name === 'string' && item.name.length <= 255
                    && !/[\/\\\u0000-\u001f\u007f]/.test(item.name)
                    && typeof item.url === 'string' && item.url.startsWith('db://assets/') && item.url.length <= 1024
                    && /\.png$/i.test(item.url) && !/[\\\u0000-\u001f\u007f]/.test(item.url)
                    && !item.url.slice('db://assets/'.length).split('/').some((part) => !part || part === '.' || part === '..')
                    && item.type === 'texture' && uuidPattern.test(item.textureUuid || '')
                    && (item.spriteFrameUuid === null || uuidPattern.test(item.spriteFrameUuid))
                    && (item.spriteFrameUuid === null ? item.metadataStatus !== 'valid' : item.metadataStatus === 'valid')
                    && ['valid', 'sprite-frame-unavailable', 'identity-mismatch', 'metadata-unavailable'].includes(item.metadataStatus)
                    && (item.width === null || Number.isInteger(item.width) && item.width > 0)
                    && (item.height === null || Number.isInteger(item.height) && item.height > 0));
            if (!valid) {
                const errorCode = message.error && (message.error.code || message.error.message);
                process.stderr.write(`asset.searchPng response failed validation (ok=${message.ok === true}, error=${String(errorCode || 'none')}).\n`);
                cleanUp(1);
                return;
            }
            process.stdout.write(`command.result ${JSON.stringify({ command: 'asset.searchPng', result })}\n`);
            cleanUp(0);
            return;
        }

        if (message.type === 'response' && message.id === assetImportRequestId) {
            clearTimeout(requestTimer);
            const result = message.result || {};
            const valid = message.ok === true
                && result.nonce === assetImportNonce
                && result.creatorVersion === creatorVersion
                && path.resolve(result.projectRoot || '') === projectRoot
                && result.sessionId === sessionId
                && result.sourceName === stagedPng.assetName
                && result.assetName === stagedPng.assetName
                && result.url === stagedPng.destinationUrl
                && typeof result.uuid === 'string'
                && result.uuid.length > 0
                && typeof result.type === 'string'
                && result.type.length > 0
                && result.imported === true
                && result.invalid === false
                && result.sha256 === stagedPng.sha256
                && result.byteLength === stagedPng.byteLength
                && result.width === stagedPng.width
                && result.height === stagedPng.height;
            if (!valid) {
                const errorCode = message.error && message.error.code;
                const errorMessage = message.error && message.error.message;
                process.stderr.write(`asset.importPng response failed validation (ok=${message.ok === true}, error=${String(errorCode || 'none')}, detail=${String(errorMessage || 'none').slice(0, 500)}).\n`);
                cleanUp(1);
                return;
            }
            process.stdout.write(`asset.importPng verified: ${result.url}, UUID ${result.uuid}, type ${result.type}, ${result.width}x${result.height}.\n`);
            if (sceneManifest && sceneManifest.sceneAction === 'apply') requestPreflight();
            else {
                process.stdout.write(`command.result ${JSON.stringify({ command: 'asset.importPng', result })}\n`);
                cleanUp(0);
            }
            return;
        }

        if (message.type === 'response' && message.id === assetRemovalRequestId) {
            clearTimeout(requestTimer);
            const result = message.result || {};
            const filename = path.join(projectRoot, 'assets', 'resources', assetRemoval.assetName);
            const diskAbsent = !fs.existsSync(filename) && !fs.existsSync(`${filename}.meta`);
            const valid = message.ok === true && result.nonce === assetRemovalNonce && result.sessionId === sessionId
                && result.creatorVersion === creatorVersion && path.resolve(result.projectRoot || '') === projectRoot
                && result.assetName === assetRemoval.assetName && result.textureUuid === assetRemoval.textureUuid
                && result.spriteFrameUuid === assetRemoval.spriteFrameUuid && result.sha256 === assetRemoval.sha256
                && result.removed === true && result.assetDbUuidAfter === null && diskAbsent;
            if (!valid) {
                const errorCode = message.error && message.error.code;
                process.stderr.write(`asset removal failed verification (ok=${message.ok === true}, error=${String(errorCode || 'none')}, diskAbsent=${diskAbsent}).\n`);
                cleanUp(1);
                return;
            }
            process.stdout.write(`command.result ${JSON.stringify({ command: 'asset.removeImportedPng', result: { ...assetRemoval,
                removed: true, assetDbUuidAfter: null, sourceAbsent: true, metaAbsent: true } })}\n`);
            cleanUp(0);
            return;
        }

        if (message.type === 'response' && message.id === assetActionRequestId) {
            clearTimeout(requestTimer);
            const result = message.result || {};
            const validEnvelope = result.nonce === assetActionNonce && result.sessionId === sessionId
                && result.creatorVersion === creatorVersion && path.resolve(result.projectRoot || '') === projectRoot
                && result.pipelineId === assetAction.pipelineId && result.assetName === assetAction.assetName;
            if (message.ok !== true || !validEnvelope || !['valid', 'repairable', 'needs-review'].includes(result.status)) {
                const errorCode = message.error && message.error.code || 'ASSET_VALIDATION_UNVERIFIED';
                process.stderr.write(`asset validation command failed (ok=${message.ok === true}, envelope=${validEnvelope}, error=${errorCode}).\n`);
                cleanUp(1);
                return;
            }
            if (assetAction.kind === 'refresh' && (result.status !== 'valid' || typeof result.refreshed !== 'boolean'
                || !result.checks || !Object.values(result.checks).every(Boolean) || !refreshAssetStillSafe(assetAction))) {
                process.stderr.write('ASSET_REFRESH_READBACK_FAILED: refresh did not preserve the recorded identity.\n');
                cleanUp(1);
                return;
            }
            process.stdout.write(`command.result ${JSON.stringify({ command: assetAction.kind === 'refresh' ? 'asset.refreshPng' : 'asset.validatePng', result })}\n`);
            cleanUp(0);
            return;
        }

        if (message.type === 'response' && message.id === preflightRequestId) {
            clearTimeout(requestTimer);
            const result = message.result || {};
            const allowedDecisions = sceneManifest.sceneAction === 'compensate'
                ? ['remove', 'alreadyAbsent'] : ['create', 'alreadyApplied'];
            const valid = message.ok === true
                && result.nonce === preflightNonce
                && result.creatorVersion === creatorVersion
                && path.resolve(result.projectRoot || '') === projectRoot
                && result.sceneName === activeSceneName
                && result.nodeName === sceneManifest.nodeName
                && (!sceneManifest.position || sameCanvasPosition(result.position, sceneManifest.position))
                && allowedDecisions.includes(result.decision)
                && typeof result.canvasName === 'string';
            if (!valid) {
                const errorCode = message.error && message.error.code;
                process.stderr.write(`scene preflight failed (ok=${message.ok === true}, error=${String(errorCode || 'invalid-response')}).\n`);
                emitReceipt('preflight', 'failed', [], {
                    code: errorCodeOr(errorCode, 'PREFLIGHT_FAILED'), phase: 'preflight',
                    message: String(message.error && message.error.message || 'The preflight response failed validation.').slice(0, 500),
                    retryable: false, sideEffect: 'none',
                });
                cleanUp(1);
                return;
            }
            process.stdout.write(`scene preflight verified: ${result.decision}, canvas=${result.canvasName}.\n`);
            preflightDecision = result.decision;
            emitReceipt('preflight', 'passed', [{ kind: 'scene-snapshot', source: 'Creator scene script', sceneName: result.sceneName, nodeName: result.nodeName, note: `decision=${result.decision}; canvas=${result.canvasName}${result.position ? `; position=(${result.position.x},${result.position.y})` : ''}` }]);
            requestSceneOperation();
            return;
        }

        if (message.type === 'response' && message.id === sceneRequestId) {
            clearTimeout(requestTimer);
            const result = message.result || {};
            const editorValid = message.ok === true
                && result.nonce === sceneNonce
                && result.creatorVersion === creatorVersion
                && path.resolve(result.projectRoot || '') === projectRoot
                && result.action === sceneManifest.sceneAction
                && result.assetName === sceneManifest.assetName
                && result.nodeName === sceneManifest.nodeName
                && (!sceneManifest.position || sameCanvasPosition(result.position, sceneManifest.position))
                && result.saved === true
                && ((sceneManifest.sceneAction === 'compensate' && (result.removed === true || result.alreadyAbsent === true))
                    || (sceneManifest.sceneAction !== 'compensate' && typeof result.nodeUuid === 'string' && result.nodeUuid.length > 0));
            if (!editorValid) {
                const errorCode = message.error && message.error.code;
                const errorMessage = message.error && message.error.message;
                process.stderr.write(`scene operation failed validation (ok=${message.ok === true}, error=${String(errorCode || 'none')}, detail=${String(errorMessage || 'none').slice(0, 500)}).\n`);
                emitReceipt('editor', 'failed', [], {
                    code: errorCodeOr(errorCode, 'SCENE_OPERATION_FAILED'), phase: 'editor',
                    message: String(errorMessage || 'The editor result failed validation.').slice(0, 500),
                    retryable: false, sideEffect: message.ok === true ? 'possible' : 'unknown',
                });
                cleanUp(1);
                return;
            }
            pendingSceneResult = result;
            emitReceipt('editor', 'passed', [{ kind: 'editor-result', source: 'Creator scene operation', sceneName: activeSceneName, nodeName: result.nodeName, assetUuid: sceneManifest.assetUuid, note: `action=${sceneManifest.sceneAction}; preflight=${preflightDecision}${result.position ? `; position=(${result.position.x},${result.position.y})` : ''}` }]);
            if (interruptAfterEditor) {
                process.stderr.write('Deliberate interruption after editor receipt; use operation.get for disk readback.\n');
                cleanUp(75);
                return;
            }
            const savedOnDisk = await waitForSavedScene();
            if (!savedOnDisk) {
                emitReceipt('disk', 'failed', [], {
                    code: 'SCENE_SAVE_UNVERIFIED', phase: 'disk',
                    message: 'The saved scene did not pass disk readback.',
                    retryable: true, sideEffect: 'possible',
                });
                cleanUp(1);
                return;
            }
            send(socket, { type: 'request', id: verifySnapshotRequestId, method: 'scene.snapshot', params: { nonce: verifySnapshotNonce, targetNodeName: sceneManifest.nodeName } });
            requestTimer = setTimeout(() => {
                process.stderr.write('post-write scene.snapshot timed out.\n');
                cleanUp(1);
            }, 15000);
            return;
        }

        if (message.type === 'response' && message.id === verifySnapshotRequestId) {
            clearTimeout(requestTimer);
            const result = message.result || {};
            const nodePresent = Array.isArray(result.targetNodeMatches) && result.targetNodeMatches.length > 0;
            const shouldExist = sceneManifest.sceneAction !== 'compensate';
            const valid = message.ok === true
                && result.nonce === verifySnapshotNonce
                && result.creatorVersion === creatorVersion
                && path.resolve(result.projectRoot || '') === projectRoot
                && result.targetNodeName === sceneManifest.nodeName
                && Array.isArray(result.targetNodeMatches)
                && result.targetNodeMatches.length <= 2
                && result.targetSearchComplete === true
                && (shouldExist ? nodePresent : !nodePresent)
                && pendingSceneResult;
            if (!valid) {
                process.stderr.write(`post-write scene.snapshot verification failed (ok=${message.ok === true}, expectedNode=${shouldExist}, foundNode=${nodePresent}).\n`);
                emitReceipt('disk', 'failed', [], {
                    code: 'SCENE_SNAPSHOT_MISMATCH', phase: 'disk',
                    message: 'The post-write scene snapshot did not match the saved scene operation.',
                    retryable: true, sideEffect: 'confirmed',
                });
                cleanUp(1);
                return;
            }
            process.stdout.write(`scene.${sceneManifest.sceneAction} verified in memory and on disk: ${pendingSceneResult.nodeName}${pendingSceneResult.nodeUuid ? ` (${pendingSceneResult.nodeUuid})` : ''}, saved=${pendingSceneResult.saved}, alreadyApplied=${pendingSceneResult.alreadyApplied === true}.\n`);
            emitReceipt('disk', 'passed', [{ kind: 'disk-readback', source: `${activeSceneName}.${creatorVersion === '2.4.15' ? 'fire' : 'scene'}`, sceneName: activeSceneName, nodeName: sceneManifest.nodeName, assetUuid: sceneManifest.assetUuid, note: `action=${sceneManifest.sceneAction}; scene snapshot cross-check passed` }]);
            emitReceipt('preview', 'pending', []);
            emitReceipt('recovery', sceneManifest.sceneAction === 'compensate' ? 'passed' : 'pending',
                sceneManifest.sceneAction === 'compensate'
                    ? [{ kind: 'recovery-readback', source: 'Creator scene snapshot and saved scene', sceneName: activeSceneName, nodeName: sceneManifest.nodeName, note: 'Target node absent after compensation.' }]
                    : []);
            cleanUp(0);
            return;
        }

        process.stderr.write(`Unexpected bridge message: ${String(message.type || 'unknown')}\n`);
        cleanUp(1);
    });

    socket.on('error', (error) => {
        process.stderr.write(`Bridge socket error: ${error.message}\n`);
        cleanUp(1);
    });
});

function requestSceneOperation() {
    operationRecord.intent = 'editor-write-sent';
    operationRecord.updatedAt = new Date().toISOString();
    operationStore.write(projectRoot, operationRecord);
    send(connectedSocket, {
        type: 'request',
        id: sceneRequestId,
        method: 'scene.pngSprite',
        params: Object.assign({ nonce: sceneNonce, sessionId }, sceneManifest),
    });
    requestTimer = setTimeout(() => {
        process.stderr.write('scene.pngSprite timed out.\n');
        cleanUp(1);
    }, 30000);
}

function requestPreflight() {
    const operation = {
        contractVersion: '0.1', operationId, capabilityId: 'scene.pngSprite',
        action: sceneManifest.sceneAction, assetName: sceneManifest.assetName,
        assetUuid: sceneManifest.assetUuid, nodeName: sceneManifest.nodeName,
        ...(sceneManifest.position ? { position: sceneManifest.position } : {}),
        sceneName: activeSceneName,
    };
    send(connectedSocket, {
        type: 'request',
        id: preflightRequestId,
        method: 'scene.preflightPngSprite',
        params: Object.assign({ nonce: preflightNonce, sessionId, operation }, sceneManifest),
    });
    requestTimer = setTimeout(() => {
        process.stderr.write('scene.preflightPngSprite timed out.\n');
        cleanUp(1);
    }, 15000);
}

function verifySavedScene(manifest, sceneName) {
    if (!sceneName || !/^[A-Za-z0-9_-]{1,64}$/.test(sceneName)) return false;
    const sceneFiles = [];
    function visit(directory, depth) {
        if (depth > 8) return;
        let entries;
        try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch (_) { return; }
        for (const entry of entries) {
            if (entry.name === 'library' || entry.name === 'temp' || entry.name === 'build' || entry.name === 'local') continue;
            const fullPath = path.join(directory, entry.name);
            if (entry.isDirectory()) visit(fullPath, depth + 1);
            else if (entry.isFile() && entry.name === `${sceneName}.${creatorVersion === '2.4.15' ? 'fire' : 'scene'}`) sceneFiles.push(fullPath);
        }
    }
    visit(path.join(projectRoot, 'assets'), 0);
    if (sceneFiles.length !== 1) return false;
    let objects;
    try { objects = JSON.parse(fs.readFileSync(sceneFiles[0], 'utf8')); } catch (_) { return false; }
    if (!Array.isArray(objects)) return false;
    const matches = objects.filter((item) => item && item.__type__ === 'cc.Node' && item._name === manifest.nodeName);
    const agentCanvases = objects.filter((item) => item && item.__type__ === 'cc.Node' && item._name === 'CocosAgentCanvas');
    if (manifest.sceneAction === 'compensate') {
        return matches.length === 0 && (creatorVersion === '2.4.15' || agentCanvases.length === 0);
    }
    if (matches.length !== 1) return false;
    const parentRef = matches[0]._parent;
    const parent = parentRef && Number.isInteger(parentRef.__id__) ? objects[parentRef.__id__] : null;
    if (!parent || parent.__type__ !== 'cc.Node'
        || (creatorVersion === '2.4.15' && parent._name !== 'Canvas')
        || (creatorVersion === '3.8.7' && !['Canvas', 'CocosAgentCanvas'].includes(parent._name))) return false;
    const sprite = (matches[0]._components || [])
        .map((ref) => ref && Number.isInteger(ref.__id__) ? objects[ref.__id__] : null)
        .find((component) => component && component.__type__ === 'cc.Sprite');
    if (!sprite || !sprite._spriteFrame || sprite._spriteFrame.__uuid__ !== manifest.assetUuid) return false;
    if (manifest.position) {
        const transform = matches[0]._trs && matches[0]._trs.array;
        if (!Array.isArray(transform) || transform.length < 2
            || Math.abs(transform[0] - manifest.position.x) > 1e-6
            || Math.abs(transform[1] - manifest.position.y) > 1e-6) return false;
    }
    return true;
}

function isCanvasPosition(position) {
    return position && typeof position === 'object' && !Array.isArray(position)
        && Object.keys(position).length === 2 && Number.isFinite(position.x) && Number.isFinite(position.y)
        && Math.abs(position.x) <= 4096 && Math.abs(position.y) <= 4096;
}
function sameCanvasPosition(actual, expected) {
    return isCanvasPosition(actual) && Math.abs(actual.x - expected.x) <= 1e-6
        && Math.abs(actual.y - expected.y) <= 1e-6;
}

async function waitForSavedScene() {
    const deadline = Date.now() + 3000;
    do {
        if (verifySavedScene(sceneManifest, activeSceneName)) return true;
        await new Promise((resolve) => setTimeout(resolve, 100));
    } while (Date.now() < deadline);
    return false;
}

server.on('error', (error) => {
    process.stderr.write(`Bridge server error: ${error.message}\n`);
    cleanUp(1);
});

server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    const session = {
        protocolVersion: PROTOCOL_VERSION,
        sessionId,
        operationId: sceneManifest ? operationId : null,
        creatorVersion,
        projectRoot,
        url: `ws://127.0.0.1:${address.port}/cocos-agent-bridge`,
        token,
        expiresAt: Date.now() + 1800000,
        assetImport: stagedPng ? Object.assign({}, stagedPng) : null,
        assetSearch: assetSearch ? { ...assetSearch, nonce: assetSearchNonce } : null,
        assetRemoval,
        assetAction,
        sceneOperation: sceneManifest,
    };
    fs.mkdirSync(sessionDirectory, { recursive: true });
    if (stagedPngPath) {
        fs.mkdirSync(path.dirname(stagedPngPath), { recursive: true });
        fs.copyFileSync(path.resolve(pngSourceArg), stagedPngPath, fs.constants.COPYFILE_EXCL);
    }
    const temporaryPath = `${sessionPath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(session), { mode: 0o600 });
    fs.renameSync(temporaryPath, sessionPath);
    try { fs.chmodSync(sessionPath, 0o600); } catch (_) { /* ACLs apply on platforms without POSIX modes. */ }
    process.stdout.write(`Bridge ready for Creator ${creatorVersion}${stagedPng ? ' with one PNG import request' : assetRemoval ? ' with one identity-checked asset removal' : assetAction ? ` with one asset ${assetAction.kind}` : ''}. Open or refresh the matching project extension.\n`);
    if (operationRecord) process.stdout.write(`operationId: ${operationId}\n`);
    process.stdout.write(`Session discovery file: ${sessionPath}\n`);
});

process.on('SIGINT', () => cleanUp(130));
process.on('SIGTERM', () => cleanUp(143));
