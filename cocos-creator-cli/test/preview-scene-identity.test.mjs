import test from 'node:test';
import assert from 'node:assert/strict';
import { findSerializedSceneIdentity } from '../bridge/preview-scene-identity.mjs';

const sceneUuid = 'a0XObHorNAbIr2hxhGwXCb';
const sceneName = 'New Node';
const creator2415PreviewAsset = [
  { __type__: 'cc.SceneAsset', _name: sceneName, _objFlags: 0, _native: '', scene: { __id__: 1 }, asyncLoadAssets: false },
  { __type__: 'cc.Scene', _objFlags: 0, _parent: null, _children: [], _active: true, _id: sceneUuid },
];

test('Creator 2.4.15 serialized scene identity follows SceneAsset name and scene object reference', () => {
  assert.deepEqual(findSerializedSceneIdentity(creator2415PreviewAsset, sceneUuid, sceneName), {
    uuid: sceneUuid, name: sceneName, type: 'cc.Scene', sceneAssetType: 'cc.SceneAsset',
  });
});

test('serialized scene identity rejects wrong name, UUID, malformed references, and ambiguity', () => {
  assert.equal(findSerializedSceneIdentity(creator2415PreviewAsset, sceneUuid, 'Other Scene'), null);
  assert.equal(findSerializedSceneIdentity(creator2415PreviewAsset, 'other-scene-uuid', sceneName), null);
  assert.equal(findSerializedSceneIdentity([{ ...creator2415PreviewAsset[0], scene: { __id__: 8 } }, creator2415PreviewAsset[1]], sceneUuid, sceneName), null);
  assert.equal(findSerializedSceneIdentity([...
    creator2415PreviewAsset, { ...creator2415PreviewAsset[0] }], sceneUuid, sceneName), null);
});
