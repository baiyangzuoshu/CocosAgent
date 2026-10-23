'use strict';

function canCompleteAssetImport(operation) {
    if (!operation || typeof operation !== 'object') return false;
    if (['applying', 'needs-reconciliation', 'completed'].includes(operation.status)) return true;
    return operation.status === 'conflict'
        && ['ASSET_IMPORT_PARTIAL_TARGET_PRESENT', 'ASSET_IMPORT_TARGET_CHANGED'].includes(operation.reconcileReason)
        && typeof operation.plannedByInstanceId === 'string'
        && operation.plannedByInstanceId === operation.appliedByInstanceId;
}

function isPendingAssetImportReadback(error) {
    return !!error && error.code === 'ENOENT';
}

module.exports = { canCompleteAssetImport, isPendingAssetImportReadback };
