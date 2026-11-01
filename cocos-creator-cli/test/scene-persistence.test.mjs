import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { sceneAssetIdentityMatches, inspectSceneAssetIdentity, inspectSceneComposition, inspectSavedSceneNode, componentValueForDisk,
  validComponentDiskValue, sceneDiskTransformMatches } = require('../creator-extension/scene-persistence.cjs');

const sceneUuid = '4b02b1e4-d163-47e2-91ad-2da0193a3907';
const sceneRootUuid = sceneUuid;
const sceneAssetUuid = '2c12110c-6f11-4a89-bcd4-1941dc757ca4';
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
  const inspected = inspectSceneAssetIdentity({ ...source, sceneAssetRow });
  assert.deepEqual(inspected, {
    verified: true, sceneUuid: sceneAssetUuid, sceneAssetUuid, sceneRootUuid, sceneUrl: sceneAssetRow.url,
  });
  assert.equal(sceneAssetIdentityMatches(sceneRootUuid, inspected), true);
  assert.equal(sceneAssetIdentityMatches(sceneAssetUuid, inspected), true);
  assert.equal(sceneAssetIdentityMatches(nodeUuid, inspected), false);
});

test('saved scene node inspection binds root UUID separately from AssetDB metadata UUID', () => {
  const source = fixture();
  const inspected = inspectSavedSceneNode({ ...source, sceneUuid: sceneRootUuid, sceneAssetRow, nodeUuid });
  assert.equal(inspected.verified, true, JSON.stringify(inspected));
  assert.equal(inspected.sceneUuid, sceneRootUuid);
  assert.equal(inspected.parentUuid, sceneRootUuid);
  const savedSceneId = inspectSavedSceneNode({ ...source, sceneUuid: sceneAssetUuid, sceneAssetRow, nodeUuid });
  assert.equal(savedSceneId.verified, true, JSON.stringify(savedSceneId));
});

test('saved scene node inspection rejects a mismatched serialized root UUID', () => {
  const source = fixture();
  const inspected = inspectSavedSceneNode({ ...source,
    sceneUuid: '853b0fb6-22e7-4a84-a044-9e82e6efea18', sceneAssetRow, nodeUuid });
  assert.equal(inspected.verified, false);
  assert.equal(inspected.reason, 'SCENE_ROOT_IDENTITY_MISMATCH');
});

test('layout-sensitive Label edits tolerate Creator-computed size changes but still bind stable transforms', () => {
  const saved = { x: 0, y: -40, z: 0, angle: 0, scaleX: 1, scaleY: 1,
    width: 80, height: 30, anchorX: 0.5, anchorY: 0.5 };
  const live = { ...saved, width: 346.84, height: 50.4 };
  assert.equal(sceneDiskTransformMatches(live, saved), false);
  assert.equal(sceneDiskTransformMatches(live, saved, { allowLayoutSizeMismatch: true }), true);
  assert.equal(sceneDiskTransformMatches({ ...live, x: 1 }, saved, { allowLayoutSizeMismatch: true }), false);
});

test('Widget alignment edits tolerate Creator-computed position changes but still bind size and anchor', () => {
  const saved = { x: -420, y: -120, z: 0, angle: 0, scaleX: 1, scaleY: 1,
    width: 100, height: 100, anchorX: 0.5, anchorY: 0.5 };
  const live = { ...saved, x: -410 };
  assert.equal(sceneDiskTransformMatches(live, saved), false);
  assert.equal(sceneDiskTransformMatches(live, saved, { allowLayoutPositionMismatch: true }), true);
  assert.equal(sceneDiskTransformMatches({ ...live, width: 101 }, saved,
    { allowLayoutPositionMismatch: true }), false);
  assert.equal(sceneDiskTransformMatches({ ...live, anchorX: 0.25 }, saved,
    { allowLayoutPositionMismatch: true }), false);
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

test('saved UI event inspection binds an exact non-Button component and event property', () => {
  const source = fixture();
  const records = JSON.parse(source.sceneBytes.toString('utf8'));
  records[2]._components = [{ __id__: 3 }];
  Object.assign(records[3], { __type__: 'cc.Toggle', _id: 'toggle-instance', node: { __id__: 2 },
    clickEvents: [], checkEvents: [{ __id__: 5 }] });
  source.sceneBytes = Buffer.from(JSON.stringify(records));
  const selector = { componentInstanceId: 'toggle-instance', serializedClassId: 'cc.Toggle', eventProperty: 'checkEvents' };
  const inspected = inspectSavedSceneNode({ ...source, sceneUuid, sceneAssetRow, nodeUuid, componentEvents: selector });
  assert.equal(inspected.verified, true);
  assert.deepEqual(inspected.componentEvents, { ...selector, events: [{ targetUuid: nodeUuid,
    component: 'game.ButtonState', handler: 'onClick', customEventData: 'toggle' }] });

  const inheritedButtonProperty = inspectSavedSceneNode({ ...source, sceneUuid, sceneAssetRow, nodeUuid,
    componentEvents: { ...selector, eventProperty: 'clickEvents' } });
  assert.equal(inheritedButtonProperty.verified, true);
  assert.deepEqual(inheritedButtonProperty.componentEvents.events, []);

  const wrongProperty = inspectSavedSceneNode({ ...source, sceneUuid, sceneAssetRow, nodeUuid,
    componentEvents: { ...selector, eventProperty: 'notAnEvent' } });
  assert.equal(wrongProperty.verified, false);
  assert.equal(wrongProperty.reason, 'SCENE_UI_EVENT_DISK_SELECTOR_INVALID');
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
    [[1, 'value', false, { __type__: 'cc.Vec2', x: 1, y: 2 }, { __id__: 2 }, { __id__: 3 },
      { __uuid__: spriteUuid }, null],
      { kind: 'array', items: [1, 'value', false, { kind: 'vec2', x: 1, y: 2 }, { kind: 'node-ref', nodeUuid },
        { kind: 'component-ref', nodeUuid, componentInstanceId: 'button-instance', serializedClassId: 'cc.Button' },
        { kind: 'asset', assetUuid: spriteUuid }, null] }],
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

test('saved component properties resolve a public field to an exact Creator backing-property alias', () => {
  const source = fixture();
  const records = JSON.parse(source.sceneBytes.toString('utf8'));
  Object.assign(records[3], { _id: 'button-instance', node: { __id__: 2 } });
  Object.assign(records[4], { _id: 'handler-instance', node: { __id__: 2 }, _N$state: 7 });
  const aliasedSource = { ...source, sceneBytes: Buffer.from(JSON.stringify(records)) };
  const inspected = inspectSavedSceneNode({ ...aliasedSource, sceneUuid, sceneAssetRow, nodeUuid,
    componentProperty: { serializedClassId: handlerClassId, componentInstanceId: 'handler-instance',
      property: 'state', serializedPropertyCandidates: ['state', '_N$state', '_state'] } });
  assert.equal(inspected.verified, true);
  assert.equal(inspected.componentProperty.property, 'state');
  assert.equal(inspected.componentProperty.serializedProperty, '_N$state');
  assert.equal(inspected.componentProperty.value, 7);

  const wrong = inspectSavedSceneNode({ ...aliasedSource, sceneUuid, sceneAssetRow, nodeUuid,
    componentProperty: { serializedClassId: handlerClassId, componentInstanceId: 'handler-instance',
      property: 'state', serializedProperty: '_state' } });
  assert.equal(wrong.verified, false);
  assert.equal(wrong.reason, 'SCENE_COMPONENT_SERIALIZED_PROPERTY_MISSING');
});

test('saved Widget alignment properties read the exact serialized align-flags bitfield', () => {
  const source = fixture();
  const records = JSON.parse(source.sceneBytes.toString('utf8'));
  records[2]._components = [{ __id__: 3 }];
  records[3] = { __type__: 'cc.Widget', _id: 'widget-instance', node: { __id__: 2 }, _alignFlags: 45 };
  source.sceneBytes = Buffer.from(JSON.stringify(records));

  const inspected = inspectSavedSceneNode({ ...source, sceneUuid, sceneAssetRow, nodeUuid,
    componentProperty: { serializedClassId: 'cc.Widget', componentInstanceId: 'widget-instance',
      property: 'isAlignLeft', serializedPropertyCandidates: ['_alignFlags'] } });
  assert.equal(inspected.verified, true);
  assert.deepEqual(inspected.componentProperty, { componentInstanceId: 'widget-instance',
    serializedClassId: 'cc.Widget', property: 'isAlignLeft', serializedProperty: '_alignFlags', value: 45 });
});

test('saved Layout type and resize properties read their exact Creator 2.4 backing fields', () => {
  const source = fixture();
  const records = JSON.parse(source.sceneBytes.toString('utf8'));
  records[2]._components = [{ __id__: 3 }];
  records[3] = { __type__: 'cc.Layout', _id: 'layout-instance', node: { __id__: 2 },
    _N$layoutType: 2, _resize: 1 };
  source.sceneBytes = Buffer.from(JSON.stringify(records));

  const type = inspectSavedSceneNode({ ...source, sceneUuid, sceneAssetRow, nodeUuid,
    componentProperty: { serializedClassId: 'cc.Layout', componentInstanceId: 'layout-instance',
      property: 'type', serializedPropertyCandidates: ['_N$layoutType'] } });
  assert.equal(type.verified, true);
  assert.deepEqual(type.componentProperty, { componentInstanceId: 'layout-instance',
    serializedClassId: 'cc.Layout', property: 'type', serializedProperty: '_N$layoutType', value: 2 });

  const resize = inspectSavedSceneNode({ ...source, sceneUuid, sceneAssetRow, nodeUuid,
    componentProperty: { serializedClassId: 'cc.Layout', componentInstanceId: 'layout-instance',
      property: 'resizeMode', serializedPropertyCandidates: ['_resize'] } });
  assert.equal(resize.verified, true);
  assert.deepEqual(resize.componentProperty, { componentInstanceId: 'layout-instance',
    serializedClassId: 'cc.Layout', property: 'resizeMode', serializedProperty: '_resize', value: 1 });
});

test('saved component inspection accepts an omitted field only when its declared default is supplied', () => {
  const source = propertyFixture(1);
  const records = JSON.parse(source.sceneBytes.toString('utf8'));
  delete records[4].state;
  const omitted = { ...source, sceneBytes: Buffer.from(JSON.stringify(records)) };
  const selector = { serializedClassId: handlerClassId, componentInstanceId: 'handler-instance',
    property: 'state', serializedPropertyCandidates: ['state', '_N$state'], defaultValue: { kind: 'array', items: [] } };
  const inspected = inspectSavedSceneNode({ ...omitted, sceneUuid, sceneAssetRow, nodeUuid, componentProperty: selector });
  assert.equal(inspected.verified, true);
  assert.deepEqual(inspected.componentProperty, { componentInstanceId: 'handler-instance',
    serializedClassId: handlerClassId, property: 'state', isDefaultOmitted: true,
    value: { kind: 'array', items: [] } });

  const withoutDefault = inspectSavedSceneNode({ ...omitted, sceneUuid, sceneAssetRow, nodeUuid,
    componentProperty: { ...selector, defaultValue: undefined } });
  assert.equal(withoutDefault.verified, false);
  assert.equal(withoutDefault.reason, 'SCENE_COMPONENT_SERIALIZED_PROPERTY_MISSING');
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
    nodeCount: 1, componentCount: 2, buttonEventCount: 1, uiEventGroupCount: 0, uiEventCount: 0, prefabInstanceCount: 0 });
});

test('persisted scene composition verifies optional anchor values and generic whitelisted UI event lists', () => {
  const source = fixture();
  const operation = source.operation;
  const request = operation.plan.request;
  request.nodes[0].transform = { x: 12, y: 20, z: 0, scaleX: 1.5, scaleY: 0.75,
    angle: 30, width: 180, height: 64, anchorX: 0.25, anchorY: 0.75 };
  request.components[0] = { id: 'toggle', nodeRef: 'new:button', className: 'cc.Toggle', properties: [] };
  request.buttonEvents = [];
  request.uiEvents = [{ componentRef: 'new:toggle', eventProperty: 'checkEvents', events: [
    { targetRef: 'new:button', component: 'game.ButtonState', handler: 'onClick', customEventData: 'checked' },
  ] }];
  operation.plan.expectedState.createdNodes[0].transform = request.nodes[0].transform;
  const toggleReadback = operation.sceneReadback.nodes[0].components[0];
  toggleReadback.id = 'toggle';
  toggleReadback.componentClassName = 'cc.Toggle';
  toggleReadback.serializedClassId = 'cc.Toggle';
  toggleReadback.componentInstanceId = 'toggle-instance';
  toggleReadback.eventLists = { checkEvents: [{ targetUuid: nodeUuid, component: 'game.ButtonState',
    handler: 'onClick', customEventData: 'checked' }] };
  operation.sceneReadback.nodes[0].transform = request.nodes[0].transform;
  const records = JSON.parse(source.sceneBytes.toString('utf8'));
  records[2]._anchorPoint = { __type__: 'cc.Vec2', x: 0.25, y: 0.75 };
  records[3].__type__ = 'cc.Toggle';
  records[3].checkEvents = [{ __id__: 5 }];
  delete records[3].clickEvents;
  records[5].customEventData = 'checked';
  source.sceneBytes = Buffer.from(JSON.stringify(records));
  const result = inspectSceneComposition({ ...source, sceneUuid, sceneAssetRow });
  assert.equal(result.verified, true);
  assert.equal(result.uiEventGroupCount, 1);
  assert.equal(result.uiEventCount, 1);

  records[2]._anchorPoint.y = 0.5;
  const staleAnchor = inspectSceneComposition({ ...source, sceneBytes: Buffer.from(JSON.stringify(records)), sceneUuid, sceneAssetRow });
  assert.equal(staleAnchor.reason, 'SCENE_COMPOSITION_ANCHOR_MISMATCH');
});

test('persisted scene composition verifies exact node and component reference properties', () => {
  const source = fixture();
  const operation = source.operation;
  const handler = operation.plan.request.components[1];
  handler.properties = [{ name: 'targetNode', value: { nodeRef: 'new:button' } },
    { name: 'buttonComponent', value: { componentRef: 'new:button-ui' } }];
  operation.sceneReadback.nodes[0].components[0].componentInstanceId = 'button-instance';
  operation.sceneReadback.nodes[0].components[1].propertyValues = {
    targetNode: `node:${nodeUuid}`, buttonComponent: 'component:button-ui',
  };
  operation.sceneReadback.nodes[0].components[1].serializedPropertyCandidates = {
    targetNode: ['targetNode'], buttonComponent: ['buttonComponent'],
  };
  const records = JSON.parse(source.sceneBytes.toString('utf8'));
  records[3]._id = 'button-instance';
  records[3].node = { __id__: 2 };
  records[4]._id = 'handler-instance';
  records[4].node = { __id__: 2 };
  records[4].targetNode = { __id__: 2 };
  records[4].buttonComponent = { __id__: 3 };
  source.sceneBytes = Buffer.from(JSON.stringify(records));
  const result = inspectSceneComposition({ ...source, sceneUuid, sceneAssetRow });
  assert.equal(result.verified, true);

  records[4].buttonComponent = { __id__: 4 };
  const wrongReference = inspectSceneComposition({ ...source, sceneBytes: Buffer.from(JSON.stringify(records)), sceneUuid, sceneAssetRow });
  assert.equal(wrongReference.reason, 'SCENE_COMPOSITION_COMPONENT_REFERENCE_MISMATCH');
});

test('persisted scene composition verifies a new Prefab instance child against its actual Prefab root', () => {
  const prefabUuid = 'f477dd52-5a0e-46c1-9810-ea8c2b2d7d9e';
  const prefabRootUuid = '375b8797-7a23-4f6a-95ce-e9b362e5a8c6';
  const childUuid = 'b9f3f5da-9c25-48d8-b3bb-84bc849c75ee';
  const transform = { x: 10, y: 15, z: 0, scaleX: 1, scaleY: 1, angle: 0, width: 40, height: 20 };
  const request = { sceneUuid, nodes: [{ id: 'override', uuid: childUuid, name: 'OverrideChild',
    parentRef: `uuid:${prefabRootUuid}`, transform }], components: [], buttonEvents: [] };
  const expectedNode = { id: 'override', uuid: childUuid, parentUuid: prefabRootUuid, name: 'OverrideChild',
    transform, prefabUuid, prefabRootUuid, prefabInstanceRoot: false, prefabOverride: true };
  const operation = { plan: { sceneUuid, request, expectedState: { createdNodes: [expectedNode] } },
    sceneReadback: { available: true, sceneUuid, nodes: [{ id: 'override', uuid: childUuid, name: 'OverrideChild',
      parentUuid: prefabRootUuid, transform, prefabUuid, prefabRootUuid, components: [] }] } };
  const rows = [
    { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
    { __type__: 'cc.Scene', _id: sceneRootUuid, _name: 'Scene', _children: [{ __id__: 2 }] },
    { __type__: 'cc.Node', _id: prefabRootUuid, _name: 'PrefabInstance', _parent: { __id__: 1 },
      _children: [{ __id__: 3 }], _components: [], _prefab: { __id__: 4 }, _active: true,
      _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1] },
      _contentSize: { __type__: 'cc.Size', width: 100, height: 100 },
      _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 } },
    { __type__: 'cc.Node', _id: childUuid, _name: 'OverrideChild', _parent: { __id__: 2 },
      _children: [], _components: [], _prefab: { __id__: 5 }, _active: true,
      _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [10, 15, 0, 0, 0, 0, 1, 1, 1, 1] },
      _contentSize: { __type__: 'cc.Size', width: 40, height: 20 },
      _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 } },
    { __type__: 'cc.PrefabInfo', root: { __id__: 2 }, asset: { __uuid__: prefabUuid }, fileId: '', sync: false },
    { __type__: 'cc.PrefabInfo', root: { __id__: 2 }, asset: { __uuid__: prefabUuid },
      fileId: 'override-child-file-id', sync: false },
  ];
  const source = { operation, sceneBytes: Buffer.from(JSON.stringify(rows)),
    metaBytes: Buffer.from(JSON.stringify({ uuid: sceneAssetUuid, importer: 'scene' })) };
  const result = inspectSceneComposition({ ...source, sceneUuid, sceneAssetRow });
  assert.deepEqual(result, { verified: true, sceneUuid, sceneUrl: sceneAssetRow.url,
    nodeCount: 1, componentCount: 0, buttonEventCount: 0, uiEventGroupCount: 0, uiEventCount: 0, prefabInstanceCount: 0 });
});

test('persisted scene composition resolves Creator backing-property names such as cc.Label.string', () => {
  const source = fixture();
  const operation = source.operation;
  operation.plan.request.components = [{ id: 'label', nodeRef: 'new:button', className: 'cc.Label',
    properties: [{ name: 'string', value: 'Prefab baseline' }] }];
  operation.plan.request.buttonEvents = [];
  operation.sceneReadback.nodes[0].components = [{ id: 'label', componentClassName: 'cc.Label',
    serializedClassId: 'cc.Label', componentInstanceId: 'label-instance',
    propertyValues: { string: 'Prefab baseline' }, serializedPropertyCandidates: {
      string: ['string', '_N$string'],
    } }];
  const records = JSON.parse(source.sceneBytes.toString('utf8'));
  records[2]._components = [{ __id__: 3 }];
  records[3] = { __type__: 'cc.Label', _N$string: 'Prefab baseline' };
  source.sceneBytes = Buffer.from(JSON.stringify(records));

  const result = inspectSceneComposition({ ...source, sceneUuid, sceneAssetRow });
  assert.equal(result.verified, true);
  assert.equal(result.componentCount, 1);
  assert.equal(result.buttonEventCount, 0);
});

test('persisted scene composition verifies Creator-resolved Label dimensions from the post-create snapshot', () => {
  const source = fixture();
  const operation = source.operation;
  operation.plan.request.components.push({ id: 'label', nodeRef: 'new:button', className: 'cc.Label',
    properties: [{ name: 'string', value: 'Settings' }] });
  operation.plan.expectedState.createdNodes[0].transform.width = 180;
  operation.plan.expectedState.createdNodes[0].transform.height = 64;
  operation.sceneReadback.nodes[0].transform.width = 346.84;
  operation.sceneReadback.nodes[0].transform.height = 50.4;
  operation.sceneReadback.nodes[0].components.push({ id: 'label', componentClassName: 'cc.Label',
    serializedClassId: 'cc.Label', componentInstanceId: 'label-instance',
    propertyValues: { string: 'Settings' }, serializedPropertyCandidates: { string: ['_N$string'] } });
  const records = JSON.parse(source.sceneBytes.toString('utf8'));
  records[2]._contentSize = { __type__: 'cc.Size', width: 346.84, height: 50.4 };
  records[2]._components.push({ __id__: 6 });
  records.push({ __type__: 'cc.Label', _id: 'label-instance', node: { __id__: 2 }, _N$string: 'Settings' });
  source.sceneBytes = Buffer.from(JSON.stringify(records));

  const result = inspectSceneComposition({ ...source, sceneUuid, sceneAssetRow });
  assert.equal(result.verified, true);
  assert.equal(result.componentCount, 3);
});

test('persisted Prefab instance accepts position resolved by its internal Widget from the post-create snapshot', () => {
  const source = fixture();
  const prefabUuid = 'f477dd52-5a0e-46c1-9810-ea8c2b2d7d9e';
  const operation = source.operation;
  operation.plan.request.nodes[0].prefabUuid = prefabUuid;
  Object.assign(operation.plan.expectedState.createdNodes[0], { prefabUuid, prefabRootUuid: nodeUuid,
    prefabInstanceRoot: true });
  Object.assign(operation.sceneReadback.nodes[0], { prefabUuid, prefabRootUuid: nodeUuid, prefabInstanceRoot: true,
    transform: { ...operation.sceneReadback.nodes[0].transform, x: 0, y: 0, width: 100, height: 100 },
    allComponents: [{ componentClassName: 'cc.Widget' }] });
  const records = JSON.parse(source.sceneBytes.toString('utf8'));
  records[2]._trs.array[0] = 0;
  records[2]._trs.array[1] = 0;
  records[2]._contentSize = { __type__: 'cc.Size', width: 100, height: 100 };
  records[2]._prefab = { __id__: 6 };
  records[2]._components.push({ __id__: 7 });
  records.push({ __type__: 'cc.PrefabInfo', root: { __id__: 2 }, asset: { __uuid__: prefabUuid }, fileId: '', sync: false });
  records.push({ __type__: 'cc.Widget', _id: 'prefab-widget', node: { __id__: 2 }, _alignFlags: 45 });
  source.sceneBytes = Buffer.from(JSON.stringify(records));

  const result = inspectSceneComposition({ ...source, sceneUuid, sceneAssetRow });
  assert.equal(result.verified, true, result.reason);
  assert.equal(result.prefabInstanceCount, 1);
});

test('persisted scene composition verifies Widget alignment booleans against the serialized _alignFlags bitfield', () => {
  const source = fixture();
  source.operation.plan.request.components = [{ id: 'widget', nodeRef: 'new:button', className: 'cc.Widget', properties: [
    { name: 'isAlignLeft', value: true }, { name: 'isAlignRight', value: true },
    { name: 'left', value: 10 }, { name: 'right', value: 850 },
  ] }];
  source.operation.plan.request.buttonEvents = [];
  source.operation.sceneReadback.nodes[0].components = [{ id: 'widget', componentClassName: 'cc.Widget',
    serializedClassId: 'cc.Widget', componentInstanceId: 'widget-instance',
    propertyValues: { isAlignLeft: true, isAlignRight: true, left: 10, right: 850 },
    serializedPropertyCandidates: { isAlignLeft: ['_alignFlags'], isAlignRight: ['_alignFlags'],
      left: ['_left'], right: ['_right'] } }];
  const records = JSON.parse(source.sceneBytes.toString('utf8'));
  records[2]._components = [{ __id__: 6 }];
  records.push({ __type__: 'cc.Widget', node: { __id__: 2 }, _id: 'widget-instance',
    _alignFlags: (1 << 3) | (1 << 5), _left: 10, _right: 850 });
  source.sceneBytes = Buffer.from(JSON.stringify(records));

  const result = inspectSceneComposition({ ...source, sceneUuid, sceneAssetRow });
  assert.equal(result.verified, true);
  assert.equal(result.componentCount, 1);

  records[6]._alignFlags = 1 << 5;
  source.sceneBytes = Buffer.from(JSON.stringify(records));
  const mismatch = inspectSceneComposition({ ...source, sceneUuid, sceneAssetRow });
  assert.equal(mismatch.reason, 'SCENE_COMPOSITION_PROPERTY_MISMATCH');
  assert.equal(mismatch.property, '_alignFlags');
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
    'SCENE_META_IDENTITY_MISMATCH');
  assert.equal(inspectSceneComposition({ ...source, sceneUuid,
    sceneAssetRow: { ...sceneAssetRow, uuid: 'not-a-uuid' } }).reason, 'SCENE_ASSETDB_IDENTITY_MISMATCH');
  assert.equal(inspectSceneComposition({ ...source, sceneUuid,
    metaBytes: Buffer.from(JSON.stringify({ uuid: nodeUuid, importer: 'scene' })), sceneAssetRow }).reason,
  'SCENE_META_IDENTITY_MISMATCH');
});
