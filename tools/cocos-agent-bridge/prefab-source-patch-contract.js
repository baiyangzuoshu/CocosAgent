'use strict';

const scenePatch = require('./scene-patch-contract');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256 = /^[a-f0-9]{64}$/;

function validInput(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
    const keys = Object.keys(input);
    return keys.every((key) => ['prefabUuid', 'targetNodePath', 'targetNodeUuid', 'expectedPrefabSha256',
        'action', 'expectedDiff', 'sourceOperationId', 'operationId'].includes(key))
        && UUID.test(input.prefabUuid || '')
        && typeof input.targetNodePath === 'string' && input.targetNodePath.length > 0 && input.targetNodePath.length <= 240
        && !input.targetNodePath.includes('\\') && !input.targetNodePath.includes('//')
        && scenePatch.NODE_ID.test(input.targetNodeUuid || '')
        && (input.expectedPrefabSha256 === undefined || SHA256.test(input.expectedPrefabSha256))
        && (input.action !== 'apply' || SHA256.test(input.expectedPrefabSha256 || ''))
        && ['apply', 'compensate', 'replay'].includes(input.action)
        && scenePatch.validateDiff(input.expectedDiff)
        && (input.action === 'apply' ? input.sourceOperationId === undefined : UUID.test(input.sourceOperationId || ''))
        && (input.operationId === undefined || UUID.test(input.operationId));
}

function invertDiff(diff) { return scenePatch.invertDiff(diff); }

module.exports = { UUID, SHA256, validInput, invertDiff };
