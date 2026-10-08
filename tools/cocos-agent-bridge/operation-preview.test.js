'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const store = require('./operation-store');
const { acceptPreview, acceptRuntimePreview } = require('./operation-preview');

const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-agent-preview-'));
const operationId = crypto.randomUUID();
const now = new Date().toISOString();
const request = { projectRoot, creatorVersion: '3.8.7', operationId,
    evidence: { url: 'http://127.0.0.1:7457/', observedAt: now, note: 'White test square visible in the scene.' } };
try {
    const record = { contractVersion: '0.1', operationId, sessionId: crypto.randomUUID(), projectRoot, creatorVersion: '3.8.7',
        manifest: { assetName: 'probe.png', assetUuid: crypto.randomUUID(), nodeName: 'CocosAgentAsset_probe', sceneAction: 'apply' },
        sceneName: 'main', intent: 'disk-verified', receipts: [], phases: { capability: 'passed', preflight: 'passed', editor: 'passed', disk: 'pending', preview: 'pending', recovery: 'pending' },
        createdAt: now, updatedAt: now };
    store.write(projectRoot, record, true);
    assert.strictEqual(acceptPreview(request).error.code, 'DISK_NOT_VERIFIED');
    record.phases.disk = 'passed';
    store.write(projectRoot, record);
    assert.strictEqual(acceptPreview({ ...request, evidence: { ...request.evidence, url: 'https://example.com/' } }).error.code, 'INVALID_PREVIEW_EVIDENCE');
    assert.strictEqual(acceptPreview({ ...request, creatorVersion: '2.4.15' }).error.code, 'OPERATION_TARGET_MISMATCH');
    const first = acceptPreview(request);
    assert.strictEqual(first.success, true);
    assert.strictEqual(first.alreadyAccepted, false);
    assert.strictEqual(first.data.phases.preview, 'passed');
    assert.strictEqual(first.data.receipts[0].evidence[0].kind, 'visual-preview');
    assert.strictEqual(first.data.receipts[0].evidence[0].previewUrl, request.evidence.url);
    const second = acceptPreview(request);
    assert.strictEqual(second.alreadyAccepted, true);
    assert.strictEqual(acceptPreview({ ...request, evidence: { ...request.evidence, note: 'Different observation.' } }).error.code, 'PREVIEW_ALREADY_ACCEPTED');
    assert.strictEqual(store.read(projectRoot, operationId).receipts.length, 1);

    const nodeOperationId = crypto.randomUUID();
    const spriteFrameUuid = crypto.randomUUID();
    const nodeUuid = crypto.randomUUID();
    const nodeRecord = { contractVersion: '0.1', capabilityId: 'scene.node.create', operationId: nodeOperationId,
        projectRoot, creatorVersion: '2.4.15', createdNodeUuid: nodeUuid,
        manifest: { action: 'apply', parentPath: 'helloworld/Canvas', parentUuid: crypto.randomUUID(), nodeName: 'P1Probe',
            components: [{ classId: 'cc.Sprite', spriteFrameUuid }],
            transform: { position: { x: 12, y: -4 }, scale: { x: 2, y: 3 } } },
        sceneName: 'helloworld', phases: { disk: 'passed', preview: 'pending' }, receipts: [], createdAt: now, updatedAt: now };
    store.write(projectRoot, nodeRecord, true);
    const runtimeState = { sceneName: 'helloworld', nodePath: 'helloworld/Canvas/P1Probe', nodeUuid,
        components: [{ classId: 'cc.Sprite', spriteFrameUuid }],
        transform: { position: { x: 12, y: -4 }, scale: { x: 2, y: 3 } } };
    const runtimeRequest = { projectRoot, creatorVersion: '2.4.15', operationId: nodeOperationId,
        previewUrl: 'http://127.0.0.1:7456/', observedAt: new Date(Date.now() + 1000).toISOString(), runtimeState };
    assert.strictEqual(acceptRuntimePreview({ ...runtimeRequest, runtimeState: { ...runtimeState, nodeUuid: crypto.randomUUID() } }).error.code,
        'RUNTIME_PREVIEW_MISMATCH');
    const runtimeAccepted = acceptRuntimePreview(runtimeRequest);
    assert.strictEqual(runtimeAccepted.success, true);
    assert.strictEqual(runtimeAccepted.data.phases.preview, 'passed');
    assert.strictEqual(runtimeAccepted.data.receipts[0].capabilityId, 'scene.node.create');
    assert.strictEqual(runtimeAccepted.data.receipts[0].evidence[0].kind, 'runtime-preview');
    assert.strictEqual(acceptRuntimePreview(runtimeRequest).alreadyAccepted, true);
    assert.strictEqual(acceptRuntimePreview({ ...runtimeRequest, previewUrl: 'https://example.com/' }).error.code,
        'INVALID_PREVIEW_EVIDENCE');
    process.stdout.write('preview evidence validation and idempotent persistence passed\n');
} finally { fs.rmSync(projectRoot, { recursive: true, force: true }); }
