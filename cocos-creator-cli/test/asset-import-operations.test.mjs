import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { canCompleteAssetImport, isPendingAssetImportReadback } =
  require('../creator-extension/asset-import-operations.cjs');

test('AssetDB import can reconcile a previously partial target only after exact readback succeeds', () => {
  assert.equal(canCompleteAssetImport({ status: 'applying' }), true);
  assert.equal(canCompleteAssetImport({ status: 'needs-reconciliation', reconcileReason: 'ASSET_IMPORT_READBACK_TIMEOUT' }), true);
  assert.equal(canCompleteAssetImport({ status: 'completed' }), true);
  assert.equal(canCompleteAssetImport({ status: 'conflict', reconcileReason: 'ASSET_IMPORT_PARTIAL_TARGET_PRESENT',
    plannedByInstanceId: 'creator-instance', appliedByInstanceId: 'creator-instance' }), true);
  assert.equal(canCompleteAssetImport({ status: 'conflict', reconcileReason: 'ASSET_IMPORT_TARGET_CHANGED',
    plannedByInstanceId: 'creator-instance', appliedByInstanceId: 'creator-instance' }), true);
  assert.equal(canCompleteAssetImport({ status: 'conflict', reconcileReason: 'ASSET_IMPORT_TARGET_CHANGED',
    plannedByInstanceId: 'creator-instance', appliedByInstanceId: 'other-instance' }), false);
  assert.equal(canCompleteAssetImport({ status: 'conflict', reconcileReason: 'ASSET_IMPORT_UNRELATED_CONFLICT',
    plannedByInstanceId: 'creator-instance', appliedByInstanceId: 'creator-instance' }), false);
  assert.equal(canCompleteAssetImport({ status: 'cancelled' }), false);
});

test('only a missing AssetDB-generated file is treated as a pending import readback', () => {
  assert.equal(isPendingAssetImportReadback(Object.assign(new Error('not imported yet'), { code: 'ENOENT' })), true);
  assert.equal(isPendingAssetImportReadback(Object.assign(new Error('source mismatch'), {
    code: 'ASSET_IMPORT_SOURCE_READBACK_MISMATCH',
  })), false);
  assert.equal(isPendingAssetImportReadback(null), false);
});
