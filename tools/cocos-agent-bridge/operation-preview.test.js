'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const store = require('./operation-store');
const { acceptPreview } = require('./operation-preview');

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
    process.stdout.write('preview evidence validation and idempotent persistence passed\n');
} finally { fs.rmSync(projectRoot, { recursive: true, force: true }); }
