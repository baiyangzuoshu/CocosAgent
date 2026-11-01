import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { collectDiagnosticAssetUuids, queryDiagnosticAssets, MAX_DIAGNOSTIC_ASSET_UUIDS } =
  require('../creator-extension/diagnostics-assets.cjs');

test('AssetDB diagnostics collect bounded, unique asset UUID references', () => {
  const shared = { assetUuid: 'asset-1' };
  const references = { nodes: [{ font: shared, spriteFrame: { assetUuid: 'asset-2' } }, { material: shared }] };
  references.circular = references;
  const result = collectDiagnosticAssetUuids(references);
  assert.deepEqual([...result.assetUuids], ['asset-1', 'asset-2']);
  assert.equal(result.complete, true);
  assert.ok(result.visitedObjects < 10);
});

test('AssetDB diagnostics keep sampled references when a wide object exceeds its completeness cap', () => {
  const references = { first: { assetUuid: 'sampled-uuid' } };
  for (let index = 0; index < 140; index += 1) references[`property${index}`] = { value: index };
  const result = collectDiagnosticAssetUuids(references);
  assert.equal(result.assetUuids.has('sampled-uuid'), true);
  assert.equal(result.complete, false);
  assert.ok(result.visitedObjects > 1);
});

test('AssetDB diagnostics query only referenced UUIDs and preserve exact type evidence', () => {
  const calls = [];
  const assetdb = {
    queryAssets() { throw new Error('whole-project query must not be used'); },
    assetInfoByUuid(uuid) {
      calls.push(uuid);
      return uuid === 'audio-uuid' ? { uuid, url: 'db://assets/music.mp3', type: 'cc.AudioClip', importer: 'audio-clip' } : null;
    },
  };
  const result = queryDiagnosticAssets(['audio-uuid', 'missing-uuid', 'audio-uuid'], assetdb);
  assert.deepEqual(calls, ['audio-uuid', 'missing-uuid']);
  assert.deepEqual(result.assets, [{ uuid: 'audio-uuid', url: 'db://assets/music.mp3', type: 'cc.AudioClip', importer: 'audio-clip' }]);
  assert.deepEqual(result.unresolvedUuids, ['missing-uuid']);
  assert.equal(result.complete, true);
});

test('AssetDB diagnostics cap UUID work and keep truncated evidence incomplete', () => {
  const references = Array.from({ length: MAX_DIAGNOSTIC_ASSET_UUIDS + 1 }, (_, index) => `uuid-${index}`);
  let calls = 0;
  const result = queryDiagnosticAssets(references, { assetInfoByUuid() { calls += 1; return null; } });
  assert.equal(calls, MAX_DIAGNOSTIC_ASSET_UUIDS);
  assert.equal(result.requestedCount, MAX_DIAGNOSTIC_ASSET_UUIDS + 1);
  assert.equal(result.complete, false);
  assert.equal(result.unresolvedUuids.length, MAX_DIAGNOSTIC_ASSET_UUIDS);
});

test('AssetDB diagnostics mark failed or unsupported UUID queries incomplete', () => {
  const failed = queryDiagnosticAssets(['bad-uuid'], { assetInfoByUuid() { throw new Error('unavailable'); } });
  assert.equal(failed.available, true);
  assert.equal(failed.complete, false);
  assert.equal(failed.reason, 'ASSETDB_QUERY_FAILED');
  assert.deepEqual(failed.failedUuids, ['bad-uuid']);

  const unsupported = queryDiagnosticAssets(['asset-uuid'], { queryAssets() {} });
  assert.equal(unsupported.available, false);
  assert.equal(unsupported.complete, false);
  assert.equal(unsupported.reason, 'ASSETDB_UUID_QUERY_UNAVAILABLE');
});
