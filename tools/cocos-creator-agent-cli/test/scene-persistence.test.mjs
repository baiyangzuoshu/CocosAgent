import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { inspectSceneAssetIdentity, inspectSceneComposition, inspectSavedSceneNode, componentValueForDisk,
  validComponentDiskValue } = require('../creator-extension/scene-persistence.cjs');

const sceneUuid = '2c12110c-6f11-4a89-bcd4-1941dc757ca4';
const sceneRootUuid = '4b02b1e4-d163-47e2-91ad-2da0193a3907';
const sceneAssetUuid = sceneUuid;
const nodeUuid = 'df1bb94e-c8e6-41ba-b9c9-a04c6e86a581';
const spriteUuid = 'a3b51e35-a9f2-4552-b597-4731bbf7b119';
const handlerClassId = 'c8f27f4c-3728-4ce7-8db6-8fdc99e9a70a';
const sceneAssetRow = { url: 'db://assets/Scenes/Main.fire', uuid: sceneAssetUuid, importer: 'scene' };

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
    { __type__: 'cc.Scene', _id: sceneRootUuid, _children: [{ __id__: 2 }] },
    { __type__: 'cc.Node', _id: nodeUuid, _name: 'StartButton', _parent: { __id__: 1 }, _active: true,
      _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [12, 20, 0, 0, 0,
        Math.sin(Math.PI / 12), Math.cos(Math.PI / 12), 1.5, 0.75, 1] },
      _contentSize: { __type__: 'cc.Size', width: 180, height: 64 },
      _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 },
      _children: [],
      _components: [{ __id__: 3 }, { __id__: 4 }] },
    { __type__: 'cc.Button', clickEvents: [{ __id__: 5 }] },
    { __type__: handlerClassId, count: 0, spriteFrame: { __uuid__: spriteUuid } },
    { __type__: 'cc.ClickEvent', target: { __id__: 2 }, component: 'game.ButtonState',
      _componentId: handlerClassId, handler: 'onClick', customEventData: 'toggle' },
  ];
  return { operation, sceneBytes: Buffer.from(JSON.stringify(records)),
    metaBytes: Buffer.from(JSON.stringify({ uuid: sceneAssetUuid, importer: 'scene' })) };
}

test('scene asset identity keeps the scene root UUID separate from the AssetDB metadata UUID', () => {
  const source = fixture();
  assert.deepEqual(inspectSceneAssetIdentity({ ...source, sceneAssetRow }), {
    verified: true, sceneUuid, sceneAssetUuid, sceneRootUuid, sceneUrl: sceneAssetRow.url,
  });
});

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

function propertyFixture(value) {
  const source = fixture();
  const records = JSON.parse(source.sceneBytes.toString('utf8'));
  Object.assign(records[3], { _id: 'button-instance', node: { __id__: 2 } });
  Object.assign(records[4], { _id: 'handler-instance', node: { __id__: 2 }, state: value });
  return { ...source, sceneBytes: Buffer.from(JSON.stringify(records)),
    componentProperty: { serializedClassId: handlerClassId, componentInstanceId: 'handler-instance', property: 'state' } };
}

test('saved component properties bind exact instance IDs and decode all supported serialized value types', () => {
  const cases = [
    [12, 12], ['saved', 'saved'], [false, false], [null, null],
    [{ __uuid__: spriteUuid }, { kind: 'asset', assetUuid: spriteUuid }],
    [{ __id__: 1 }, { kind: 'node-ref', nodeUuid: sceneUuid }],
    [{ __id__: 2 }, { kind: 'node-ref', nodeUuid }],
    [{ __id__: 3 }, { kind: 'component-ref', nodeUuid, componentInstanceId: 'button-instance', serializedClassId: 'cc.Button' }],
    ...[
      ['vec2', 'cc.Vec2', { x: 1, y: 2 }], ['vec3', 'cc.Vec3', { x: 1, y: 2, z: 3 }],
      ['vec4', 'cc.Vec4', { x: 1, y: 2, z: 3, w: 4 }], ['size', 'cc.Size', { width: 20, height: 30 }],
      ['rect', 'cc.Rect', { x: 1, y: 2, width: 20, height: 30 }], ['color', 'cc.Color', { r: 1, g: 2, b: 3, a: 255 }],
    ].map(([kind, type, fields]) => [{ __type__: type, ...fields }, { kind, ...fields }]),
    [[1, 'value', false, { __type__: 'cc.Vec2', x: 1, y: 2 }, { __id__: 2 }, { __id__: 3 }, null],
      { kind: 'array', items: [1, 'value', false, { kind: 'vec2', x: 1, y: 2 }, { kind: 'node-ref', nodeUuid },
        { kind: 'component-ref', nodeUuid, componentInstanceId: 'button-instance', serializedClassId: 'cc.Button' }, null] }],
  ];
  for (const [raw, expected] of cases) {
    const inspected = inspectSavedSceneNode({ ...propertyFixture(raw), sceneUuid, sceneAssetRow, nodeUuid });
    assert.equal(inspected.verified, true, JSON.stringify(raw));
    assert.deepEqual(inspected.componentProperty.value, expected);
  }
  const source = propertyFixture({ __id__: 6 });
  const records = JSON.parse(source.sceneBytes.toString('utf8'));
  records.push({ __type__: 'cc.Vec2', x: 8, y: 9 });
  source.sceneBytes = Buffer.from(JSON.stringify(records));
  assert.deepEqual(inspectSavedSceneNode({ ...source, sceneUuid, sceneAssetRow, nodeUuid }).componentProperty.value,
    { kind: 'vec2', x: 8, y: 9 });

  const exact = propertyFixture(10);
  const duplicates = JSON.parse(exact.sceneBytes.toString('utf8'));
  duplicates[2]._components.push({ __id__: duplicates.length });
  duplicates.push({ __type__: handlerClassId, _id: 'another-instance', node: { __id__: 2 }, state: 99 });
  exact.sceneBytes = Buffer.from(JSON.stringify(duplicates));
  assert.equal(inspectSavedSceneNode({ ...exact, sceneUuid, sceneAssetRow, nodeUuid }).componentProperty.value, 10);
});

test('saved component properties reject wrong identity, missing fields, unresolved references, and arbitrary objects', () => {
  for (const [mutate, reason] of [
    [(records) => { records[4]._id = 'other-instance'; }, 'SCENE_COMPONENT_SERIALIZED_IDENTITY_MISMATCH'],
    [(records) => { records[4].__type__ = 'cc.Sprite'; }, 'SCENE_COMPONENT_SERIALIZED_IDENTITY_MISMATCH'],
    [(records) => { records[4].node = { __id__: 1 }; }, 'SCENE_COMPONENT_SERIALIZED_IDENTITY_MISMATCH'],
    [(records) => { records.push({ ...records[4] }); }, 'SCENE_COMPONENT_SERIALIZED_IDENTITY_MISMATCH'],
    [(records) => { delete records[4].state; }, 'SCENE_COMPONENT_SERIALIZED_PROPERTY_MISSING'],
    [(records) => { records[4].state = { arbitrary: true }; }, 'SCENE_COMPONENT_SERIALIZED_VALUE_UNSUPPORTED'],
    [(records) => { records[4].state = { __id__: 999 }; }, 'SCENE_COMPONENT_SERIALIZED_VALUE_UNSUPPORTED'],
    [(records) => { records[4].state = [[1]]; }, 'SCENE_COMPONENT_SERIALIZED_VALUE_UNSUPPORTED'],
    [(records) => { records[4].state = [{ __uuid__: spriteUuid }]; }, 'SCENE_COMPONENT_SERIALIZED_VALUE_UNSUPPORTED'],
    [(records) => { records[4].state = { __id__: 6 }; records.push({ __id__: 6 }); }, 'SCENE_COMPONENT_SERIALIZED_VALUE_UNSUPPORTED'],
    [(records) => { records[4].state = { __id__: 6 }; records.push({ __type__: 'cc.Node', _id: spriteUuid, _parent: null }); },
      'SCENE_COMPONENT_SERIALIZED_VALUE_UNSUPPORTED'],
  ]) {
    const source = propertyFixture(1);
    const records = JSON.parse(source.sceneBytes.toString('utf8')); mutate(records);
    source.sceneBytes = Buffer.from(JSON.stringify(records));
    assert.equal(inspectSavedSceneNode({ ...source, sceneUuid, sceneAssetRow, nodeUuid }).reason, reason);
  }
});

test('saved component identity sets and deletion subtrees are read back by persistent IDs', () => {
  const source = propertyFixture(1);
  const components = inspectSavedSceneNode({ ...source, sceneUuid, sceneAssetRow, nodeUuid, includeComponents: true });
  assert.equal(components.verified, true);
  assert.deepEqual(components.components, [
    { componentInstanceId: 'button-instance', serializedClassId: 'cc.Button' },
    { componentInstanceId: 'handler-instance', serializedClassId: handlerClassId },
  ]);

  const subtreeUuid = '21b763df-9648-4f56-b1a7-d08bd1f629b2';
  const childUuid = '585df788-f08e-43c1-bfad-55798ed7c64f';
  const rows = [
    { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
    { __type__: 'cc.Scene', _id: sceneRootUuid, _name: 'Scene', _children: [{ __id__: 2 }] },
    { __type__: 'cc.Node', _id: subtreeUuid, _name: 'Root', _parent: { __id__: 1 }, _children: [{ __id__: 3 }],
      _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1] },
      _contentSize: { __type__: 'cc.Size', width: 1, height: 1 }, _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 } },
    { __type__: 'cc.Node', _id: childUuid, _name: 'Child', _parent: { __id__: 2 }, _children: [],
      _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1] },
      _contentSize: { __type__: 'cc.Size', width: 1, height: 1 }, _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 } },
  ];
  const subtree = inspectSavedSceneNode({ ...source, sceneBytes: Buffer.from(JSON.stringify(rows)),
    sceneUuid, sceneAssetRow, nodeUuid: subtreeUuid, componentProperty: undefined, includeSubtree: true });
  assert.equal(subtree.verified, true, subtree.reason);
  assert.deepEqual(subtree.subtree, [
    { nodeUuid: subtreeUuid, nodeName: 'Root', parentUuid: sceneUuid, siblingIndex: 0, childCount: 1 },
    { nodeUuid: childUuid, nodeName: 'Child', parentUuid: subtreeUuid, siblingIndex: 0, childCount: 0 },
  ]);
  const deleted = [{ __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
    { __type__: 'cc.Scene', _id: sceneRootUuid, _name: 'Scene', _children: [] }];
  const absence = inspectSavedSceneNode({ ...source, sceneBytes: Buffer.from(JSON.stringify(deleted)), sceneUuid,
    sceneAssetRow, nodeUuid: subtreeUuid, componentProperty: undefined, absentNodeUuids: [subtreeUuid, childUuid] });
  assert.equal(absence.verified, true);
  assert.deepEqual(absence.absentNodeUuids, [subtreeUuid, childUuid]);
  assert.equal(inspectSavedSceneNode({ ...source, sceneBytes: Buffer.from(JSON.stringify(rows)), sceneUuid,
    sceneAssetRow, nodeUuid: subtreeUuid, componentProperty: undefined, absentNodeUuids: [subtreeUuid, childUuid] }).reason,
  'SCENE_NODE_STILL_PRESENT');
});

test('planned property values normalize resource types and persistent component references without losing array order', () => {
  const reference = { kind: 'component-ref', componentClassName: 'game.ButtonState', nodeUuid, componentInstanceId: 'handler-instance' };
  const classes = [{ componentClassName: 'game.ButtonState', serializedClassId: handlerClassId }];
  assert.deepEqual(componentValueForDisk({ kind: 'asset', assetClass: 'SpriteFrame', assetUuid: spriteUuid }),
    { verified: true, value: { kind: 'asset', assetUuid: spriteUuid } });
  assert.deepEqual(componentValueForDisk({ kind: 'array', items: [{ kind: 'node-ref' }, reference, 1] }, classes),
    { verified: true, value: { kind: 'array', items: [null,
      { kind: 'component-ref', nodeUuid, componentInstanceId: 'handler-instance', serializedClassId: handlerClassId }, 1] } });
  assert.equal(componentValueForDisk(reference).verified, false);
  assert.equal(componentValueForDisk(reference, [...classes, ...classes]).verified, false);
  assert.equal(validComponentDiskValue({ kind: '__proto__' }), false);
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
    sceneAssetRow: { ...sceneAssetRow, uuid: 'not-a-uuid' } }).reason, 'SCENE_ASSETDB_IDENTITY_MISMATCH');
  assert.equal(inspectSceneComposition({ ...source, sceneUuid,
    metaBytes: Buffer.from(JSON.stringify({ uuid: nodeUuid, importer: 'scene' })), sceneAssetRow }).reason,
  'SCENE_META_IDENTITY_MISMATCH');
});
