'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const WebSocket = require('./vendor/ws');

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
const sceneAssetName = argument('--scene-asset');
const sceneAction = argument('--scene-action');
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
    };
}

const sceneManifest = sceneAssetName ? readSceneAssetManifest(sceneAssetName) : null;

const sessionDirectory = path.join(projectRoot, 'temp', 'cocos-agent-bridge');
const sessionPath = path.join(sessionDirectory, 'session.json');
const token = crypto.randomBytes(32).toString('hex');
const sessionId = crypto.randomUUID();
const requestId = crypto.randomUUID();
const snapshotRequestId = crypto.randomUUID();
const nonce = crypto.randomBytes(12).toString('hex');
const snapshotNonce = crypto.randomBytes(12).toString('hex');
const assetImportRequestId = crypto.randomUUID();
const assetImportNonce = crypto.randomBytes(12).toString('hex');
const sceneRequestId = crypto.randomUUID();
const sceneNonce = crypto.randomBytes(12).toString('hex');
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
let connectedSocket = null;
let finished = false;
let activeSceneName = null;
let pendingSceneResult = null;
let handshakeTimer = null;
let requestTimer = null;

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
            const capabilityMatches = Array.isArray(message.capabilities)
                && message.capabilities.includes('scene.snapshot')
                && (!stagedPng || message.capabilities.includes('asset.importPng'))
                && (!sceneManifest || (message.capabilities.includes('scene.placePngSprite') && message.capabilities.includes('scene.removePngSprite')));
            if (!projectMatches || !versionMatches || !protocolMatches || !extensionMatches || !capabilityMatches) {
                send(socket, {
                    type: 'helloAck',
                    accepted: false,
                    reason: !projectMatches ? 'project-mismatch' : !versionMatches ? 'creator-version-mismatch' : !protocolMatches ? 'protocol-version-mismatch' : !extensionMatches ? 'extension-mismatch' : 'capability-mismatch',
                });
                process.stderr.write(`Handshake rejected (project=${projectMatches}, creator=${versionMatches}, protocol=${protocolMatches}, extension=${extensionMatches}, required capabilities=${capabilityMatches}).\n`);
                cleanUp(1);
                return;
            }

            clearTimeout(handshakeTimer);
            send(socket, { type: 'helloAck', accepted: true, sessionId, protocolVersion: PROTOCOL_VERSION });
            process.stdout.write(`Handshake accepted: Creator ${creatorVersion}, project ${projectRoot}.\n`);
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
            send(socket, { type: 'request', id: snapshotRequestId, method: 'scene.snapshot', params: { nonce: snapshotNonce } });
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
            } else if (sceneManifest) {
                requestSceneOperation();
            } else {
                cleanUp(0);
            }
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
            if (sceneManifest && sceneManifest.sceneAction === 'apply') requestSceneOperation();
            else cleanUp(0);
            return;
        }

        if (message.type === 'response' && message.id === sceneRequestId) {
            clearTimeout(requestTimer);
            const result = message.result || {};
            const savedOnDisk = message.ok === true && await waitForSavedScene();
            const valid = message.ok === true
                && result.nonce === sceneNonce
                && result.creatorVersion === creatorVersion
                && path.resolve(result.projectRoot || '') === projectRoot
                && result.action === sceneManifest.sceneAction
                && result.assetName === sceneManifest.assetName
                && result.nodeName === sceneManifest.nodeName
                && result.saved === true
                && savedOnDisk
                && ((sceneManifest.sceneAction === 'compensate' && (result.removed === true || result.alreadyAbsent === true))
                    || (sceneManifest.sceneAction !== 'compensate' && typeof result.nodeUuid === 'string' && result.nodeUuid.length > 0));
            if (!valid) {
                const errorCode = message.error && message.error.code;
                const errorMessage = message.error && message.error.message;
                process.stderr.write(`scene operation failed validation (ok=${message.ok === true}, error=${String(errorCode || 'none')}, detail=${String(errorMessage || 'none').slice(0, 500)}).\n`);
                cleanUp(1);
                return;
            }
            pendingSceneResult = result;
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
                cleanUp(1);
                return;
            }
            process.stdout.write(`scene.${sceneManifest.sceneAction} verified in memory and on disk: ${pendingSceneResult.nodeName}${pendingSceneResult.nodeUuid ? ` (${pendingSceneResult.nodeUuid})` : ''}, saved=${pendingSceneResult.saved}, alreadyApplied=${pendingSceneResult.alreadyApplied === true}.\n`);
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

function verifySavedScene(result) {
    if (!activeSceneName || !/^[A-Za-z0-9_-]{1,64}$/.test(activeSceneName)) return false;
    const sceneFiles = [];
    function visit(directory, depth) {
        if (depth > 8) return;
        let entries;
        try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch (_) { return; }
        for (const entry of entries) {
            if (entry.name === 'library' || entry.name === 'temp' || entry.name === 'build' || entry.name === 'local') continue;
            const fullPath = path.join(directory, entry.name);
            if (entry.isDirectory()) visit(fullPath, depth + 1);
            else if (entry.isFile() && entry.name === `${activeSceneName}.${creatorVersion === '2.4.15' ? 'fire' : 'scene'}`) sceneFiles.push(fullPath);
        }
    }
    visit(path.join(projectRoot, 'assets'), 0);
    if (sceneFiles.length !== 1) return false;
    let objects;
    try { objects = JSON.parse(fs.readFileSync(sceneFiles[0], 'utf8')); } catch (_) { return false; }
    if (!Array.isArray(objects)) return false;
    const matches = objects.filter((item) => item && item.__type__ === 'cc.Node' && item._name === sceneManifest.nodeName);
    const agentCanvases = objects.filter((item) => item && item.__type__ === 'cc.Node' && item._name === 'CocosAgentCanvas');
    if (sceneManifest.sceneAction === 'compensate') {
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
    return Boolean(sprite && sprite._spriteFrame && sprite._spriteFrame.__uuid__ === sceneManifest.assetUuid);
}

async function waitForSavedScene() {
    const deadline = Date.now() + 3000;
    do {
        if (verifySavedScene()) return true;
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
        creatorVersion,
        projectRoot,
        url: `ws://127.0.0.1:${address.port}/cocos-agent-bridge`,
        token,
        expiresAt: Date.now() + 1800000,
        assetImport: stagedPng ? Object.assign({}, stagedPng) : null,
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
    process.stdout.write(`Bridge ready for Creator ${creatorVersion}${stagedPng ? ' with one PNG import request' : ''}. Open or refresh the matching project extension.\n`);
    process.stdout.write(`Session discovery file: ${sessionPath}\n`);
});

process.on('SIGINT', () => cleanUp(130));
process.on('SIGTERM', () => cleanUp(143));
