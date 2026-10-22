import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { inspectSceneComposition, inspectSavedSceneNode } = require('../creator-extension/scene-persistence.cjs');

const sceneUuid = '4b02b1e4-d163-47e2-91ad-2da0193a3907';
const nodeUuid = 'df1bb94e-c8e6-41ba-b9c9-a04c6e86a581';
const spriteUuid = 'a3b51e35-a9f2-4552-b597-4731bbf7b119';
const handlerClassId = 'c8f27f4c-3728-4ce7-8db6-8fdc99e9a70a';
const sceneAssetRow = { url: 'db://assets/Scenes/Main.fire', uuid: sceneUuid, importer: 'scene' };

function fixture() {
  const request = {
    sceneUuid,
    nodes: [{ id: 'button', uuid: nodeUuid, name: 'StartButton', parentRef: `uuid:${sceneUuid}` }],
    components: [
      { id: 'button-ui', nodeRef: 'new:button', className: 'cc.Button', properties: [] },
      { id: 'handler', nodeRef: 'new:button', className: 'game.ButtonState', properties: [
        { name: 'count', value: 0 }, { name: 'spriteFrame', value: { assetUuid: spriteUuid, assetClass: 'SpriteFrame' } },
      ] },
    ],
    buttonEvents: [{ buttonRef: 'new:button', handlerRef: 'new:button', handlerComponentClassName: 'game.ButtonState',
      handler: 'onClick', customEventData: 'toggle' }],
  };
  const expectedState = { createdNodes: [{ id: 'button', uuid: nodeUuid, parentUuid: sceneUuid, name: 'StartButton',
    transform: { x: 12, y: 20, z: 0, scaleX: 1.5, scaleY: 0.75, angle: 30, width: 180, height: 64 } }] };
  const readback = { available: true, sceneUuid, nodes: [{ id: 'button', uuid: nodeUuid, name: 'StartButton',
    parentUuid: sceneUuid, transform: expectedState.createdNodes[0].transform,
    components: [
      { id: 'button-ui', componentClassName: 'cc.Button', serializedClassId: 'cc.Button' },
      { id: 'handler', componentClassName: 'game.ButtonState', serializedClassId: handlerClassId },
    ] }] };
  const operation = { plan: { sceneUuid, request, expectedState }, sceneReadback: readback };
  const records = [
    { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
    { __type__: 'cc.Scene', _id: sceneUuid, _children: [{ __id__: 2 }] },
    { __type__: 'cc.Node', _id: nodeUuid, _name: 'StartButton', _parent: { __id__: 1 }, _active: true,
      _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [12, 20, 0, 0, 0,
        Math.sin(Math.PI / 12), Math.cos(Math.PI / 12), 1.5, 0.75, 1] },
      _contentSize: { __type__: 'cc.Size', width: 180, height: 64 },
      _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 },
      _components: [{ __id__: 3 }, { __id__: 4 }] },
    { __type__: 'cc.Button', clickEvents: [{ __id__: 5 }] },
    { __type__: handlerClassId, count: 0, spriteFrame: { __uuid__: spriteUuid } },
    { __type__: 'cc.ClickEvent', target: { __id__: 2 }, component: 'game.ButtonState',
      _componentId: handlerClassId, handler: 'onClick', customEventData: 'toggle' },
  ];
  return { operation, sceneBytes: Buffer.from(JSON.stringify(records)),
    metaBytes: Buffer.from(JSON.stringify({ uuid: sceneUuid, importer: 'scene' })) };
}

test('saved scene node inspection resolves exact UUID, hierarchy, active state, and serialized transform', () => {
  const source = fixture();
  assert.deepEqual(inspectSavedSceneNode({ ...source, sceneUuid, sceneAssetRow, nodeUuid }), {
    verified: true, sceneUuid, sceneUrl: sceneAssetRow.url, nodeUuid, nodeName: 'StartButton',
    parentUuid: sceneUuid, nodePath: 'Scene/StartButton', active: true,
    buttonComponentCount: 1, buttonEvents: [{ targetUuid: nodeUuid, component: 'game.ButtonState',
      handler: 'onClick', customEventData: 'toggle' }],
    transform: { x: 12, y: 20, z: 0, angle: 30, scaleX: 1.5, scaleY: 0.75,
      width: 180, height: 64, anchorX: 0.5, anchorY: 0.5 },
  });
});

test('saved scene node inspection reads an exact serialized Button event list and refuses ambiguous instances', () => {
  const source = fixture();
  const inspected = inspectSavedSceneNode({ ...source, sceneUuid, sceneAssetRow, nodeUuid });
  assert.equal(inspected.buttonComponentCount, 1);
  assert.deepEqual(inspected.buttonEvents, [{ targetUuid: nodeUuid, component: 'game.ButtonState',
    handler: 'onClick', customEventData: 'toggle' }]);

  const records = JSON.parse(source.sceneBytes.toString('utf8'));
  records[2]._components.push({ __id__: records.length });
  records.push({ __type__: 'cc.Button', clickEvents: [] });
  source.sceneBytes = Buffer.from(JSON.stringify(records));
  const ambiguous = inspectSavedSceneNode({ ...source, sceneUuid, sceneAssetRow, nodeUuid });
  assert.equal(ambiguous.verified, true);
  assert.equal(ambiguous.buttonComponentCount, 2);
  assert.equal(ambiguous.buttonEvents, null);
});

test('saved scene node inspection rejects wrong metadata, detached nodes, and missing node UUIDs', () => {
  const source = fixture();
  assert.equal(inspectSavedSceneNode({ ...source, sceneUuid, sceneAssetRow, nodeUuid,
    metaBytes: Buffer.from(JSON.stringify({ uuid: sceneUuid, importer: 'prefab' })) }).reason,
  'SCENE_META_IDENTITY_MISMATCH');
  const detached = fixture();
  const records = JSON.parse(detached.sceneBytes.toString('utf8'));
  records[2]._parent = null;
  detached.sceneBytes = Buffer.from(JSON.stringify(records));
  assert.equal(inspectSavedSceneNode({ ...detached, sceneUuid, sceneAssetRow, nodeUuid }).reason,
    'SCENE_NODE_OUTSIDE_TARGET_SCENE');
  assert.equal(inspectSavedSceneNode({ ...source, sceneUuid, sceneAssetRow, nodeUuid: spriteUuid }).reason,
    'SCENE_NODE_NOT_FOUND');
  const inconsistentHierarchy = fixture();
  const hierarchyRows = JSON.parse(inconsistentHierarchy.sceneBytes.toString('utf8'));
  hierarchyRows[1]._children = [];
  inconsistentHierarchy.sceneBytes = Buffer.from(JSON.stringify(hierarchyRows));
  assert.equal(inspectSavedSceneNode({ ...inconsistentHierarchy, sceneUuid, sceneAssetRow, nodeUuid }).reason,
    'SCENE_HIERARCHY_INVALID');
});

test('persisted scene verification matches nodes, transforms, resource UUIDs, components, and Button events', () => {
  const source = fixture();
  const result = inspectSceneComposition({ ...source, sceneUuid, sceneAssetRow });
  assert.deepEqual(result, { verified: true, sceneUuid, sceneUrl: sceneAssetRow.url,
    nodeCount: 1, componentCount: 2, buttonEventCount: 1, prefabInstanceCount: 0 });
});

test('persisted scene verification rejects stale transforms, wrong resources, and mismatched Button targets', () => {
  const staleTransform = fixture();
  const rows = JSON.parse(staleTransform.sceneBytes.toString('utf8'));
  rows[2]._trs.array[0] = 13;
  staleTransform.sceneBytes = Buffer.from(JSON.stringify(rows));
  assert.equal(inspectSceneComposition({ ...staleTransform, sceneUuid, sceneAssetRow }).reason,
    'SCENE_COMPOSITION_TRANSFORM_MISMATCH');

  const wrongAsset = fixture();
  const wrongAssetRows = JSON.parse(wrongAsset.sceneBytes.toString('utf8'));
  wrongAssetRows[4].spriteFrame.__uuid__ = sceneUuid;
  wrongAsset.sceneBytes = Buffer.from(JSON.stringify(wrongAssetRows));
  assert.equal(inspectSceneComposition({ ...wrongAsset, sceneUuid, sceneAssetRow }).reason,
    'SCENE_COMPOSITION_ASSET_REFERENCE_MISMATCH');

  const wrongTarget = fixture();
  const targetRows = JSON.parse(wrongTarget.sceneBytes.toString('utf8'));
  targetRows[5].target = { __id__: 1 };
  wrongTarget.sceneBytes = Buffer.from(JSON.stringify(targetRows));
  assert.equal(inspectSceneComposition({ ...wrongTarget, sceneUuid, sceneAssetRow }).reason,
    'SCENE_BUTTON_EVENT_MISMATCH');
});

test('persisted scene verification binds the AssetDB scene identity and generated metadata UUID', () => {
  const source = fixture();
  assert.equal(inspectSceneComposition({ ...source, sceneUuid, sceneAssetRow: { ...sceneAssetRow, uuid: nodeUuid } }).reason,
    'SCENE_ASSETDB_IDENTITY_MISMATCH');
  assert.equal(inspectSceneComposition({ ...source, sceneUuid,
    metaBytes: Buffer.from(JSON.stringify({ uuid: nodeUuid, importer: 'scene' })), sceneAssetRow }).reason,
  'SCENE_META_IDENTITY_MISMATCH');
});
