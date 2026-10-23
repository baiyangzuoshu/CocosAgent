import test from 'node:test';
import assert from 'node:assert/strict';
import prefabPatch from '../creator-extension/prefab-patch.cjs';
import prefabSource from '../creator-extension/prefab-source.cjs';
import { validateCommand } from '../bridge/contracts.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const prefabUuid = 'e98a93d5-9707-45a6-88f6-50a40a1511f4';
const nodeUuid = 'node_root_1';
const sourceHash = 'a'.repeat(64);
const inverseOperationId = '952f1ec7-668b-4e12-b45c-11090e1c1f67';

const node = {
  nodeUuid,
  nodePath: 'Root/Sprite',
  name: 'Sprite',
  active: true,
  transform: { x: 1, y: 2, scaleX: 1, scaleY: 1 },
  components: [{ className: 'cc.Sprite', enabled: true, spriteFrameUuid: null }],
};

function command(id) {
  const contractPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../creator-extension/command-contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  return contract.commands.find((entry) => entry.id === id);
}

test('Prefab source patch commands declare plan, explicit commit write, and non-replaying reconciliation contracts', () => {
  const plan = command('creator.prefab.source.patch.plan');
  const commit = command('creator.prefab.source.patch.commit');
  const reconcile = command('creator.prefab.source.patch.reconcile');
  const editableInspect = command('creator.prefab.source.editable.inspect');
  const input = { prefabUuid, targetNodePath: 'Root/Sprite', targetNodeUuid: nodeUuid, action: 'apply',
    expectedSourceSha256: sourceHash, expectedDiff: [{ path: 'node.active', before: true, after: false }] };
  assert.equal(plan.access, 'plan');
  assert.equal(validateCommand(plan.id, input).ok, true);
  assert.equal(validateCommand(plan.id, { ...input,
    expectedDiff: [{ path: 'component.cc.Sprite.spriteFrameUuid', before: null, after: prefabUuid }] }).ok, true);
  assert.equal(validateCommand(plan.id, { ...input, expectedDiff: [{ path: 'component.property',
    componentClassName: 'cc.Label', componentInstanceId: 'label-instance-1', componentIndex: 0, property: 'string',
    before: 'Before', after: 'After' }] }).ok, true);
  const assetArrayDiff = [{ path: 'component.property', componentClassName: 'cc.Label',
    componentInstanceId: 'label-instance-1', componentIndex: 0, property: 'materials',
    before: { kind: 'array', items: [{ kind: 'asset', assetClass: 'Material',
      assetUuid: '44444444-4444-4444-8444-444444444444' }] },
    after: { kind: 'array', items: [] } }];
  assert.equal(validateCommand(plan.id, { ...input, expectedDiff: assetArrayDiff }).ok, true);
  assert.equal(prefabPatch.validateDiff(assetArrayDiff), true);
  assert.equal(prefabPatch.validateDiff([{ ...assetArrayDiff[0], after: { kind: 'array', items: [
    { kind: 'asset', assetClass: 'Material', assetUuid: 'not-a-uuid' },
  ] } }]), false);
  const eventListDiff = [{ path: 'component.eventList', componentClassName: 'cc.Button',
    componentInstanceId: 'button-component', componentIndex: 0, eventProperty: 'clickEvents',
    before: { kind: 'ui-events', items: [] }, after: { kind: 'ui-events', items: [{ targetUuid: nodeUuid,
      component: 'game.Controller', handler: 'onClick', customEventData: 'open' }] } }];
  assert.equal(validateCommand(plan.id, { ...input, expectedDiff: eventListDiff }).ok, true);
  assert.equal(prefabPatch.validateDiff(eventListDiff), true);
  assert.equal(prefabPatch.validateDiff([{ ...eventListDiff[0], eventProperty: 'unknownEvents' }]), false);
  const unboundAfterDiff = [{ ...eventListDiff[0], after: { kind: 'ui-events', items: [{
    targetUuid: null, component: 'game.Controller', handler: 'onClick', customEventData: '' }] } }];
  assert.equal(prefabPatch.validateDiff(unboundAfterDiff), true);
  assert.equal(prefabPatch.validateDiff(prefabPatch.invertDiff(unboundAfterDiff)), true);
  assert.equal(prefabPatch.validateDiff([{ ...eventListDiff[0], after: { kind: 'ui-events', items: [{
    targetUuid: 'outside node', component: 'game.Controller', handler: 'onClick', customEventData: '' }] } }]), false);
  assert.equal(validateCommand(plan.id, { ...input, expectedDiff: [{ path: 'node.position.z', before: 0, after: 1 }] }).ok, false);
  assert.equal(commit.access, 'write');
  assert.equal(commit.approval, true);
  assert.equal(validateCommand(commit.id, { operationId: inverseOperationId, planHash: sourceHash }).ok, true);
  assert.equal(reconcile.access, 'plan');
  assert.equal(validateCommand(reconcile.id, { operationId: inverseOperationId }).ok, true);
  assert.equal(editableInspect.access, 'read');
  assert.equal(validateCommand(editableInspect.id, { prefabUuid, nodeUuid }).ok, true);
});

test('Prefab instance inspection is read-only and binds exact scene and node UUIDs', () => {
  const inspect = command('creator.prefab.instance.inspect');
  assert.equal(inspect.access, 'read');
  assert.equal(validateCommand(inspect.id, {
    sceneUuid: '11111111-1111-4111-8111-111111111111',
    nodeUuid: '22222222-2222-4222-8222-222222222222',
  }).ok, true);
  assert.equal(validateCommand(inspect.id, {
    sceneUuid: '11111111-1111-4111-8111-111111111111', nodeUuid: 'not-a-node',
  }).ok, false);
  assert.equal(validateCommand(inspect.id, {
    sceneUuid: '11111111-1111-4111-8111-111111111111',
    nodeUuid: '22222222-2222-4222-8222-222222222222', change: true,
  }).ok, false);
});

test('Prefab patch validates only explicit supported before/after fields', () => {
  const diff = [
    { path: 'node.name', before: 'Sprite', after: 'Player Sprite' },
    { path: 'node.position.x', before: 1, after: 12.5 },
    { path: 'component.cc.Sprite.spriteFrameUuid', before: null, after: prefabUuid },
  ];
  assert.equal(prefabPatch.validateDiff(diff), true);
  assert.equal(prefabPatch.matchesDiff(node, diff, 'before'), true);
  assert.equal(prefabPatch.matchesDiff({ ...node, name: 'Player Sprite', transform: { ...node.transform, x: 12.5 },
    components: [{ ...node.components[0], spriteFrameUuid: prefabUuid }] }, diff, 'after'), true);
  assert.deepEqual(prefabPatch.invertDiff(diff), diff.map(({ path, before, after }) => ({ path, before: after, after: before })));
  assert.equal(prefabPatch.targetPathAt('Root/Sprite', diff, 'before'), 'Root/Sprite');
  assert.equal(prefabPatch.targetPathAt('Root/Sprite', diff, 'after'), 'Root/Player Sprite');
});

test('Prefab patch rejects duplicate, unsupported, malformed, and ambiguous changes', () => {
  assert.equal(prefabPatch.validateDiff([
    { path: 'node.active', before: true, after: false },
    { path: 'node.active', before: true, after: false },
  ]), false);
  assert.equal(prefabPatch.validateDiff([{ path: 'component.cc.Label.string', before: 'a', after: 'b' }]), false);
  assert.equal(prefabPatch.validateDiff([{ path: 'node.position.x', before: 1, after: 1 }]), false);
  assert.equal(prefabPatch.matchesDiff({ ...node, components: [{ ...node.components[0] }, { ...node.components[0] }] },
    [{ path: 'component.cc.Sprite.enabled', before: true, after: false }], 'before'), false);
  assert.equal(prefabPatch.targetPathAt('Root/Other', [{ path: 'node.name', before: 'Sprite', after: 'Renamed' }], 'after'), null);
  const property = { path: 'component.property', componentClassName: 'cc.Label', componentInstanceId: 'label-1',
    componentIndex: 0, property: 'string', before: 'A', after: 'B' };
  assert.equal(prefabPatch.validateDiff([property]), true);
  assert.equal(prefabPatch.validateDiff([property, { ...property, componentInstanceId: 'label-2' }]), true);
  assert.equal(prefabPatch.validateDiff([property, property]), false);
  assert.equal(prefabPatch.validateDiff([{ ...property, property: '_string' }]), false);
  assert.equal(prefabPatch.validateDiff([{ ...property, after: { arbitrary: 'object' } }]), false);
  assert.equal(prefabPatch.matchesDiff({ ...node, componentProperties: { 'label-1': { string: 'A' } } }, [property], 'before'), true);
  assert.equal(prefabPatch.matchesDiff({ ...node, componentProperties: { 'label-1': { color: {
    kind: 'color', r: 1, g: 2, b: 3, a: 255 } } } }, [{ path: 'component.property', componentClassName: 'cc.Label',
    componentInstanceId: 'label-1', componentIndex: 0, property: 'color', before: { kind: 'color', r: 1, g: 2, b: 3, a: 255 },
    after: { kind: 'color', r: 4, g: 5, b: 6, a: 255 } }], 'before'), true);
  assert.deepEqual(prefabPatch.invertDiff([property]), [{ ...property, before: 'B', after: 'A' }]);
});

test('Prefab patch reconciliation classifies exact before, after, and divergent live state', () => {
  const diff = [{ path: 'node.active', before: true, after: false }];
  assert.equal(prefabPatch.classifyDiffState({ ...node, active: true }, diff), 'before');
  assert.equal(prefabPatch.classifyDiffState({ ...node, active: false }, diff), 'after');
  assert.equal(prefabPatch.classifyDiffState({ ...node, active: null }, diff), 'conflict');
  assert.equal(prefabPatch.classifyDiffState(null, diff), 'conflict');
});

test('Prefab patch binds a supported UI event list to the exact component and stable target node', () => {
  const diff = [{ path: 'component.eventList', componentClassName: 'cc.Button',
    componentInstanceId: 'button-1', componentIndex: 0, eventProperty: 'clickEvents',
    before: { kind: 'ui-events', items: [] }, after: { kind: 'ui-events', items: [{
      targetUuid: nodeUuid, component: 'game.Controller', handler: 'onClick', customEventData: 'open' }] } }];
  const beforeNode = { ...node, components: [{ className: 'cc.Button', instanceId: 'button-1', index: 0, eventLists: { clickEvents: [] } }] };
  const afterNode = { ...node, components: [{ className: 'cc.Button', instanceId: 'button-1', index: 0,
    eventLists: { clickEvents: diff[0].after.items } }] };
  assert.equal(prefabPatch.matchesDiff(beforeNode, diff, 'before'), true);
  assert.equal(prefabPatch.matchesDiff(afterNode, diff, 'after'), true);
  assert.deepEqual(prefabPatch.invertDiff(diff), [{ ...diff[0], before: diff[0].after, after: diff[0].before }]);
  assert.equal(prefabPatch.matchesDiff({ ...afterNode, components: [{ ...afterNode.components[0], index: 1 }] }, diff, 'after'), false);
});

test('Prefab patch distinguishes apply from source-linked compensation and replay', () => {
  const apply = { prefabUuid, targetNodePath: 'Root/Sprite', targetNodeUuid: nodeUuid, action: 'apply',
    expectedSourceSha256: sourceHash, expectedDiff: [
      { path: 'node.name', before: 'Sprite', after: 'Renamed' },
      { path: 'node.active', before: true, after: false },
    ] };
  assert.equal(prefabPatch.validInput(apply), true);
  assert.equal(prefabPatch.validInput({ ...apply, targetNodePath: 'Root/Other' }), false);
  assert.equal(prefabPatch.validInput({ ...apply, expectedDiff: [{ path: 'node.active', before: true, after: false }],
    sourceOperationId: inverseOperationId }), false);
  assert.equal(prefabPatch.validInput({ prefabUuid, targetNodePath: 'Root/Sprite', targetNodeUuid: nodeUuid,
    action: 'compensate', sourceOperationId: inverseOperationId }), true);
  assert.equal(prefabPatch.validInput({ prefabUuid, targetNodePath: 'Root/Sprite', targetNodeUuid: nodeUuid,
    action: 'replay', sourceOperationId: inverseOperationId, expectedDiff: apply.expectedDiff }), false);
});

test('single-node Prefab inspection can include a supported component after the default summary bound', () => {
  const componentRecords = Array.from({ length: 9 }, (_, index) => ({
    __type__: index === 8 ? 'cc.Sprite' : `cc.Component${index}`,
    _enabled: true,
    ...(index === 8 ? { _spriteFrame: { __uuid__: prefabUuid } } : {}),
  }));
  const root = { __type__: 'cc.Node', _name: 'Root', _id: nodeUuid, _active: true, _parent: null,
    _children: [], _components: componentRecords.map((_, index) => ({ __id__: index + 2 })),
    _prefab: { __id__: 11 }, _trs: { array: [0, 0, 0, 0, 0, 0, 1, 1, 1] } };
  const serialized = [{ __type__: 'cc.Prefab', data: { __id__: 1 } }, root,
    ...componentRecords, { __type__: 'cc.PrefabInfo', fileId: 'root-file-id' }];
  const input = { prefabBytes: Buffer.from(JSON.stringify(serialized)),
    metaBytes: Buffer.from(JSON.stringify({ uuid: prefabUuid, importer: 'prefab' })), prefabUuid };
  const bounded = prefabSource.inspectPrefabSource(input);
  assert.equal(bounded.available, true);
  assert.equal(bounded.nodes[0].components.length, 8);
  assert.equal(bounded.nodes[0].componentsTruncated, true);
  assert.equal(prefabPatch.valueAt(bounded.nodes[0], 'component.cc.Sprite.enabled').found, false);
  const focused = prefabSource.inspectPrefabSource({ ...input, maxComponentsPerNode: 64 });
  assert.equal(focused.available, true);
  assert.equal(focused.nodes[0].components.length, 9);
  assert.equal(focused.nodes[0].componentsTruncated, false);
  assert.deepEqual(prefabPatch.valueAt(focused.nodes[0], 'component.cc.Sprite.spriteFrameUuid'),
    { found: true, value: prefabUuid });
});

test('Creator-authored Prefab roots with empty IDs use an asset-bound identity', () => {
  const serialized = [{ __type__: 'cc.Prefab', data: { __id__: 1 } },
    { __type__: 'cc.Node', _name: 'Root', _id: '', _active: true, _parent: null,
      _children: [], _components: [], _prefab: { __id__: 2 }, _trs: { array: [0, 0, 0, 0, 0, 0, 1, 1, 1] } },
    { __type__: 'cc.PrefabInfo', fileId: '', root: { __id__: 1 }, asset: { __id__: 0 } }];
  const source = prefabSource.inspectPrefabSource({ prefabBytes: Buffer.from(JSON.stringify(serialized)),
    metaBytes: Buffer.from(JSON.stringify({ uuid: prefabUuid, importer: 'prefab' })), prefabUuid });
  assert.equal(source.available, true, JSON.stringify(source));
  assert.equal(source.nodes[0].nodeUuid, prefabPatch.rootNodeId(prefabUuid));
  assert.equal(source.nodes[0].identityKind, 'prefab-root');
  assert.equal(source.nodes[0].fileId, null);
});

test('Creator-authored Prefab components with empty IDs receive a stable asset-bound identity', () => {
  const serialized = [{ __type__: 'cc.Prefab', data: { __id__: 1 } },
    { __type__: 'cc.Node', _name: 'Root', _id: '', _active: true, _parent: null,
      _children: [], _components: [{ __id__: 2 }], _prefab: { __id__: 3 },
      _trs: { array: [0, 0, 0, 0, 0, 0, 1, 1, 1] } },
    { __type__: 'cc.BlockInputEvents', _id: '', node: { __id__: 1 }, _enabled: true },
    { __type__: 'cc.PrefabInfo', fileId: '', root: { __id__: 1 }, asset: { __id__: 0 } }];
  const source = prefabSource.inspectPrefabSource({ prefabBytes: Buffer.from(JSON.stringify(serialized)),
    metaBytes: Buffer.from(JSON.stringify({ uuid: prefabUuid, importer: 'prefab' })), prefabUuid });
  assert.equal(source.available, true, JSON.stringify(source));
  const component = source.nodes[0].components[0];
  assert.equal(component.classId, 'cc.BlockInputEvents');
  assert.equal(component.instanceIdSynthetic, true);
  assert.equal(component.instanceId, prefabPatch.componentIdFor(prefabUuid,
    prefabPatch.rootNodeId(prefabUuid), 0, 'cc.BlockInputEvents', ''));
});

test('Prefab source inspection reads exact serialized component properties by component ID', () => {
  const component = { __type__: 'cc.Label', _id: 'label-1', node: { __id__: 1 }, _enabled: true,
    _string: 'Title', _styleFlags: 1, _N$fontColor: { __type__: 'cc.Color', r: 4, g: 5, b: 6, a: 255 },
    _N$file: { __uuid__: prefabUuid } };
  const serialized = [{ __type__: 'cc.Prefab', data: { __id__: 1 } },
    { __type__: 'cc.Node', _name: 'Root', _id: nodeUuid, _active: true, _parent: null,
      _children: [], _components: [{ __id__: 2 }], _prefab: { __id__: 3 },
      _trs: { array: [0, 0, 0, 0, 0, 0, 1, 1, 1] } },
    component, { __type__: 'cc.PrefabInfo', fileId: 'root-file-id' }];
  const expectedDiff = [
    { path: 'component.property', componentClassName: 'cc.Label', componentInstanceId: 'label-1', property: 'string',
      componentIndex: 0,
      serializedProperty: '_string', serializedPropertyCandidates: ['_string'], before: 'Title', after: 'Next' },
    { path: 'component.property', componentClassName: 'cc.Label', componentInstanceId: 'label-1', property: 'enableBold',
      componentIndex: 0,
      serializedProperty: '_styleFlags', serializedPropertyCandidates: ['_styleFlags'], before: true, after: false },
    { path: 'component.property', componentClassName: 'cc.Label', componentInstanceId: 'label-1', property: 'fontColor',
      componentIndex: 0,
      serializedProperty: '_N$fontColor', serializedPropertyCandidates: ['_N$fontColor'],
      before: { kind: 'color', r: 4, g: 5, b: 6, a: 255 }, after: { kind: 'color', r: 7, g: 8, b: 9, a: 255 } },
    { path: 'component.property', componentClassName: 'cc.Label', componentInstanceId: 'label-1', property: 'font',
      componentIndex: 0,
      serializedProperty: '_N$file', serializedPropertyCandidates: ['_N$file'],
      before: { kind: 'asset', assetClass: 'cc.Font', assetUuid: prefabUuid },
      after: { kind: 'asset', assetClass: 'cc.Font' } },
  ];
  const source = prefabSource.inspectPrefabSource({ prefabBytes: Buffer.from(JSON.stringify(serialized)),
    metaBytes: Buffer.from(JSON.stringify({ uuid: prefabUuid, importer: 'prefab' })), prefabUuid,
    targetNodeUuid: nodeUuid, expectedDiff });
  assert.equal(source.available, true);
  assert.deepEqual(source.nodes[0].componentProperties['label-1'], {
    string: 'Title', enableBold: true,
    fontColor: { kind: 'color', r: 4, g: 5, b: 6, a: 255 },
    font: { kind: 'asset', assetUuid: prefabUuid, assetClass: 'cc.Font' },
  });
  assert.ok(source.nodes[0].components[0].serializedProperties.includes('_string'));
});

test('Prefab source property readback resolves Prefab-local node and component references to stable IDs', () => {
  const serialized = [{ __type__: 'cc.Prefab', data: { __id__: 1 } },
    { __type__: 'cc.Node', _name: 'Root', _id: '', _active: true, _parent: null,
      _children: [{ __id__: 2 }], _components: [{ __id__: 4 }], _prefab: { __id__: 5 },
      _trs: { array: [0, 0, 0, 0, 0, 0, 1, 1, 1] } },
    { __type__: 'cc.Node', _name: 'Child', _id: 'child-id', _active: true, _parent: { __id__: 1 },
      _children: [], _components: [{ __id__: 3 }], _prefab: { __id__: 6 },
      _trs: { array: [0, 0, 0, 0, 0, 0, 1, 1, 1] } },
    { __type__: 'cc.Sprite', _id: 'sprite-id', node: { __id__: 2 }, _enabled: true },
    { __type__: 'Test.ReferenceHolder', _id: 'holder-id', node: { __id__: 1 },
      targetNode: { __id__: 2 }, targetComponent: { __id__: 3 } },
    { __type__: 'cc.PrefabInfo', fileId: '', root: { __id__: 1 }, asset: { __id__: 0 } },
    { __type__: 'cc.PrefabInfo', fileId: 'child-file-id', root: { __id__: 1 }, asset: { __id__: 0 } }];
  const expectedDiff = [
    { path: 'component.property', componentClassName: 'Test.ReferenceHolder', componentInstanceId: 'holder-id',
      componentIndex: 0, property: 'targetNode', serializedProperty: 'targetNode', serializedPropertyCandidates: ['targetNode'],
      before: { kind: 'node-ref', nodeUuid: 'child-id' }, after: { kind: 'node-ref' } },
    { path: 'component.property', componentClassName: 'Test.ReferenceHolder', componentInstanceId: 'holder-id',
      componentIndex: 0, property: 'targetComponent', serializedProperty: 'targetComponent', serializedPropertyCandidates: ['targetComponent'],
      before: { kind: 'component-ref', componentClassName: 'cc.Sprite', componentInstanceId: 'sprite-id', nodeUuid: 'child-id' },
      after: { kind: 'component-ref', componentClassName: 'cc.Sprite' } },
  ];
  const source = prefabSource.inspectPrefabSource({ prefabBytes: Buffer.from(JSON.stringify(serialized)),
    metaBytes: Buffer.from(JSON.stringify({ uuid: prefabUuid, importer: 'prefab' })), prefabUuid,
    targetNodeUuid: prefabPatch.rootNodeId(prefabUuid), expectedDiff });
  assert.equal(source.available, true, JSON.stringify(source));
  assert.deepEqual(source.nodes[0].componentProperties['holder-id'], {
    targetNode: { kind: 'node-ref', nodeUuid: 'child-id' },
    targetComponent: { kind: 'component-ref', componentClassName: 'cc.Sprite',
      componentInstanceId: 'sprite-id', nodeUuid: 'child-id' },
  });
});

test('Prefab source readback parses UI event targets into stable Prefab node identities', () => {
  const rootId = prefabPatch.rootNodeId(prefabUuid);
  const serialized = [{ __type__: 'cc.Prefab', data: { __id__: 1 } },
    { __type__: 'cc.Node', _name: 'Root', _id: '', _active: true, _parent: null,
      _children: [{ __id__: 3 }], _components: [{ __id__: 2 }], _prefab: { __id__: 5 },
      _trs: { array: [0, 0, 0, 0, 0, 0, 1, 1, 1] } },
    { __type__: 'cc.Button', _id: 'button-instance', node: { __id__: 1 }, _enabled: true,
      clickEvents: [{ __id__: 6 }] },
    { __type__: 'cc.Node', _name: 'Target', _id: 'target-node', _active: true, _parent: { __id__: 1 },
      _children: [], _components: [{ __id__: 4 }], _prefab: { __id__: 7 },
      _trs: { array: [0, 0, 0, 0, 0, 0, 1, 1, 1] } },
    { __type__: 'game.Controller', _id: 'controller-instance', node: { __id__: 3 }, _enabled: true },
    { __type__: 'cc.PrefabInfo', fileId: '', root: { __id__: 1 }, asset: { __id__: 0 } },
    { __type__: 'cc.ClickEvent', target: { __id__: 3 }, component: 'game.Controller', handler: 'onClick', customEventData: 'open' },
    { __type__: 'cc.PrefabInfo', fileId: 'target-file-id', root: { __id__: 1 }, asset: { __id__: 0 } }];
  const expectedDiff = [{ path: 'component.eventList', componentClassName: 'cc.Button',
    componentInstanceId: 'button-instance', componentIndex: 0, eventProperty: 'clickEvents',
    before: { kind: 'ui-events', items: [{ targetUuid: 'target-node', component: 'game.Controller',
      handler: 'onClick', customEventData: 'open' }] },
    after: { kind: 'ui-events', items: [{ targetUuid: rootId, component: 'game.Controller',
      handler: 'onClick', customEventData: 'open' }] } }];
  const source = prefabSource.inspectPrefabSource({ prefabBytes: Buffer.from(JSON.stringify(serialized)),
    metaBytes: Buffer.from(JSON.stringify({ uuid: prefabUuid, importer: 'prefab' })), prefabUuid,
    targetNodeUuid: rootId, expectedDiff });
  assert.equal(source.available, true, JSON.stringify(source));
  const root = source.nodes.find((entry) => entry.nodeUuid === rootId);
  assert.deepEqual(root.components[0].eventLists.clickEvents, expectedDiff[0].before.items);
  assert.equal(prefabPatch.matchesDiff(root, expectedDiff, 'before'), true, JSON.stringify({ root,
    valid: prefabPatch.validateDiff(expectedDiff), value: prefabPatch.valueAt(root, expectedDiff[0]), expected: expectedDiff[0].before }));
  assert.equal(prefabPatch.matchesDiff(root, expectedDiff, 'after'), false);
});

test('Prefab root patches bind the exact live asset and survive a new editor node UUID', () => {
  const scenePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../creator-extension/scene.js');
  const node = { uuid: 'live-root-before', name: 'Root', active: true, children: [], _components: [],
    x: 1, y: 2, scaleX: 1, scaleY: 1, getPosition() { return { x: this.x, y: this.y }; },
    setPosition(x, y) { this.x = x; this.y = y; }, getComponents() { return this._components; } };
  node._prefab = { root: node, asset: { _uuid: prefabUuid } };
  const scene = { uuid: 'edit-scene', name: 'EditScene', children: [node], getComponents() { return []; } };
  node.parent = scene;
  const module = { exports: {} };
  let saveCalls = 0;
  let dirty = false;
  let popOptions;
  const mode = { name: 'prefab', save(callback) { saveCalls += 1; callback(); }, dirty: () => dirty };
  vm.runInNewContext(fs.readFileSync(scenePath, 'utf8'), {
    module, exports: module.exports, require: createRequire(scenePath),
    cc: { director: { getScene: () => scene }, js: { getClassName: () => 'cc.Node' },
      Object: { Flags: { DontSave: 8, HideInHierarchy: 1024 } } },
    Editor: { isMainProcess: false, require() { return { curMode: () => mode,
      save() { throw new Error('generic save wrapper must not be used'); }, pop(name, options) { popOptions = options; } }; } },
  });
  const input = { prefabUuid, targetNodeUuid: prefabPatch.rootNodeId(prefabUuid), targetNodePath: 'Root',
    action: 'apply', expectedDiff: [{ path: 'node.position.x', before: 1, after: 3 }] };
  function invoke(method, params) {
    let value;
    module.exports[method]({ reply(error, result) { assert.equal(error, null); value = result; } }, params);
    return value;
  }
  const preflight = invoke('prefabSourcePatchPreflight', input);
  assert.equal(preflight.available, true, JSON.stringify(preflight));
  assert.equal(invoke('prefabSourcePatchMutate', input).node.transform.x, 3);
  node.uuid = 'live-root-after-reopen';
  const reopened = invoke('prefabSourcePatchSnapshot', { ...input, side: 'after' });
  assert.equal(reopened.available, true);
  assert.equal(reopened.node.nodeUuid, input.targetNodeUuid);
  assert.equal(reopened.node.liveNodeUuid, node.uuid);
  node._prefab.asset._uuid = '11111111-1111-4111-8111-111111111111';
  assert.equal(invoke('prefabSourcePatchSnapshot', { ...input, side: 'after' }).available, false);
  node._prefab.asset._uuid = prefabUuid;
  scene.children.push(node);
  assert.equal(invoke('prefabSourcePatchSnapshot', { ...input, side: 'after' }).reason, 'PREFAB_ROOT_IDENTITY_AMBIGUOUS');
  scene.children.pop();
  assert.equal(invoke('savePrefabSource', { prefabUuid }).saved, true);
  assert.equal(saveCalls, 1);
  dirty = true;
  assert.equal(invoke('exitPrefabSourceMode', { prefabUuid }).reason, 'PREFAB_EXIT_UNSAVED_CHANGES');
  assert.equal(popOptions, undefined);
  dirty = false;
  assert.equal(invoke('exitPrefabSourceMode', { prefabUuid }).exitRequested, true);
  assert.equal(popOptions.closeResult, 2);
});

test('Prefab UI event lists use stable in-Prefab targets and reject external target nodes', () => {
  const scenePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../creator-extension/scene.js');
  class Component {}
  class Node {
    constructor(name, uuid) { this.name = name; this.uuid = uuid; this._id = uuid; this.children = [];
      this._components = []; this.parent = null; this._objFlags = 0; this.active = true; this.scaleX = 1; this.scaleY = 1; }
    getComponents(type) { return this._components.filter((component) => component instanceof type); }
    getPosition() { return { x: 0, y: 0 }; }
  }
  class Button extends Component { constructor() { super(); this._id = 'button-instance'; this.clickEvents = [
    { target: null, component: 'game.Controller', handler: 'onClick', customEventData: 'legacy' }]; } }
  Button.prototype.__classname__ = 'cc.Button'; Button.__props__ = ['clickEvents'];
  class Controller extends Component { onClick() {} }
  Controller.prototype.__classname__ = 'game.Controller'; Controller.__props__ = [];
  const root = new Node('Root', 'live-root');
  root._prefab = { root, asset: { _uuid: prefabUuid } };
  const scene = new Node('EditScene', 'edit-scene'); scene.uuid = 'edit-scene'; scene.children = [root]; root.parent = scene;
  const button = new Button(); button.node = root;
  const controller = new Controller(); controller._id = 'controller-instance'; controller.node = root;
  root._components.push(button, controller);
  const mode = { name: 'prefab', save(callback) { callback(); }, dirty() { return false; } };
  const classes = { 'cc.Component': Component, 'cc.Button': Button, 'game.Controller': Controller };
  const cc = { Node, Component, director: { getScene: () => scene },
    Object: { Flags: { DontSave: 8, HideInHierarchy: 1024 } },
    isValid(value) { return value && value.destroyed !== true; },
    js: { getClassByName(name) { return classes[name]; }, getClassName(type) { return type.prototype.__classname__ || type.name; },
      _getClassId(type) { return type.prototype.__classname__ || type.name; },
      isChildClassOf(type, base) { return type === base || type.prototype instanceof base; } } };
  cc.Component.EventHandler = class EventHandler { constructor() { this.target = null; this.component = '';
    this.handler = ''; this.customEventData = ''; } };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(scenePath, 'utf8'), { module, exports: module.exports,
    require: createRequire(scenePath), cc, Editor: { isMainProcess: false,
      require() { return { curMode: () => mode }; } } }, { filename: 'scene.js' });
  function invoke(method, input) {
    let value;
    module.exports[method]({ reply(error, result) { assert.equal(error, null); value = result; } }, input);
    return value;
  }
  const rootId = prefabPatch.rootNodeId(prefabUuid);
  const diff = [{ path: 'component.eventList', componentClassName: 'cc.Button', componentInstanceId: 'button-instance',
    componentIndex: 0, eventProperty: 'clickEvents', before: { kind: 'ui-events', items: [
      { targetUuid: null, component: 'game.Controller', handler: 'onClick', customEventData: 'legacy' }] },
    after: { kind: 'ui-events', items: [{ targetUuid: rootId, component: 'game.Controller',
      handler: 'onClick', customEventData: 'open' }] } }];
  const input = { prefabUuid, targetNodeUuid: rootId, targetNodePath: 'Root', action: 'apply', expectedDiff: diff };
  const editable = invoke('prefabSourceEditableState', { ...input, targetNodeUuid: rootId });
  assert.equal(editable.available, true, JSON.stringify(editable));
  assert.equal(editable.components[0].serializedClassId, 'cc.Button');
  assert.equal(editable.components[1].serializedClassId, 'game.Controller');
  assert.deepEqual(JSON.parse(JSON.stringify(editable.components[0].eventLists.clickEvents)), diff[0].before.items);
  const eventPreflight = invoke('prefabSourcePatchPreflight', input);
  assert.equal(eventPreflight.available, true, JSON.stringify(eventPreflight));
  const mutation = invoke('prefabSourcePatchMutate', input);
  assert.equal(mutation.available, true, JSON.stringify({ mutation,
    after: invoke('prefabSourceEditableState', { prefabUuid, targetNodeUuid: rootId, targetNodePath: 'Root' }) }));
  assert.deepEqual(JSON.parse(JSON.stringify(mutation.node.componentEventLists['button-instance'].clickEvents)), diff[0].after);
  assert.equal(button.clickEvents.length, 1);
  assert.equal(button.clickEvents[0].target, root);
  assert.equal(invoke('prefabSourceEditableState', { prefabUuid, targetNodeUuid: rootId,
    targetNodePath: 'Root' }).components[0].eventLists.clickEvents[0].targetUuid, rootId);

  const inverseDiff = prefabPatch.invertDiff(diff);
  assert.equal(prefabPatch.validateDiff(inverseDiff), true);
  const compensateInput = { ...input, action: 'compensate', expectedDiff: inverseDiff };
  const compensatePreflight = invoke('prefabSourcePatchPreflight', compensateInput);
  assert.equal(compensatePreflight.available, true, JSON.stringify(compensatePreflight));
  const compensated = invoke('prefabSourcePatchMutate', compensateInput);
  assert.equal(compensated.available, true, JSON.stringify(compensated));
  assert.deepEqual(JSON.parse(JSON.stringify(compensated.node.componentEventLists['button-instance'].clickEvents)), inverseDiff[0].after);
  assert.equal(button.clickEvents[0].target, null);
  assert.equal(button.clickEvents[0].customEventData, 'legacy');

  const outside = new Node('Outside', 'outside-node'); outside.parent = scene; scene.children.push(outside);
  const unsafeDiff = [{ ...diff[0], before: inverseDiff[0].after,
    after: { kind: 'ui-events', items: [{ targetUuid: 'outside-node', component: 'game.Controller',
      handler: 'onClick', customEventData: 'outside' }] } }];
  const rejected = invoke('prefabSourcePatchPreflight', { ...input, expectedDiff: unsafeDiff });
  assert.equal(rejected.available, false);
  assert.equal(rejected.reason, 'PREFAB_NODE_NOT_FOUND');
});
