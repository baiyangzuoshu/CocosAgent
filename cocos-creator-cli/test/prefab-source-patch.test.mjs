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

test('Prefab source inspection returns bounded cc.PrefabInfo metadata separately from ordinary components', () => {
  const serialized = [{ __type__: 'cc.Prefab', data: { __id__: 1 } },
    { __type__: 'cc.Node', _name: 'Root', _active: true, _parent: null, _children: [], _components: [],
      _prefab: { __id__: 2 }, _trs: { array: [0, 0, 0, 0, 0, 0, 1, 1, 1] } },
    { __type__: 'cc.PrefabInfo', root: { __id__: 1 }, asset: { __id__: 0 }, fileId: '', sync: false }];
  const source = prefabSource.inspectPrefabSource({ prefabBytes: Buffer.from(JSON.stringify(serialized)),
    metaBytes: Buffer.from(JSON.stringify({ uuid: prefabUuid, importer: 'prefab' })), prefabUuid });
  assert.equal(source.available, true, JSON.stringify(source));
  assert.equal(source.nodes[0].componentCount, 0);
  assert.deepEqual(source.nodes[0].prefabInfo, { classId: 'cc.PrefabInfo',
    serializedProperties: ['__type__', 'root', 'asset', 'fileId', 'sync'], serializedPropertiesTruncated: false,
    fields: { root: { kind: 'node-ref', nodeUuid: source.nodes[0].nodeUuid, name: 'Root' },
      asset: { kind: 'asset-ref', serializedObjectIndex: 0, classId: 'cc.Prefab', assetUuid: prefabUuid },
      fileId: '', sync: false } });
});

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
  assert.equal(validateCommand(plan.id, { ...input, expectedDiff: [{ path: 'node.siblingIndex',
    parentUuid: 'parent-node-id', before: 0, after: 1 }] }).ok, true);
  assert.equal(validateCommand(plan.id, { ...input, expectedDiff: [{ path: 'node.parent',
    before: { parentUuid: 'parent-a', parentPath: 'Root/A', siblingIndex: 0 },
    after: { parentUuid: 'parent-b', parentPath: 'Root/B', siblingIndex: 1 } }] }).ok, true);
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
  assert.equal(validateCommand(plan.id, { ...input,
    expectedDiff: [{ path: 'node.size.width', before: 880, after: 879 }] }).ok, true);
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
  const sizeDiff = [{ path: 'node.size.width', before: 880, after: 879 }];
  const sizedNode = { ...node, transform: { ...node.transform, width: 880, height: 60 } };
  assert.equal(prefabPatch.validateDiff(sizeDiff), true);
  assert.equal(prefabPatch.matchesDiff(sizedNode, sizeDiff, 'before'), true);
  assert.equal(prefabPatch.matchesDiff({ ...sizedNode,
    transform: { ...sizedNode.transform, width: 879 } }, sizeDiff, 'after'), true);
  assert.equal(prefabPatch.matchesBeforeOrGeometryAfter(sizedNode, sizeDiff), true);
  assert.equal(prefabPatch.matchesBeforeOrGeometryAfter({ ...sizedNode,
    transform: { ...sizedNode.transform, width: 879 } }, sizeDiff), true);
  assert.equal(prefabPatch.matchesBeforeOrGeometryAfter({ ...sizedNode,
    transform: { ...sizedNode.transform, width: 878 } }, sizeDiff), false);
  const mixedGeometryDiff = [{ path: 'node.size.width', before: 880, after: 879 },
    { path: 'node.position.x', before: 480, after: 480.5 }];
  assert.equal(prefabPatch.matchesBeforeOrGeometryAfter({ ...sizedNode,
    transform: { ...sizedNode.transform, width: 879, x: 480.5 } }, mixedGeometryDiff), true);
  assert.deepEqual(prefabPatch.sourceInspectionDiff([
    { path: 'component.property', componentInstanceId: 'widget', property: 'left' },
    { path: 'node.position.x', before: 480, after: 480.5 },
    { path: 'node.size.width', before: 880, after: 879 },
  ]), [{ path: 'component.property', componentInstanceId: 'widget', property: 'left' }]);
  const transform = { x: 480, y: 0, scaleX: 1, scaleY: 1, width: 880, height: 60 };
  assert.equal(prefabPatch.validTransformSnapshot(transform), true);
  assert.equal(prefabPatch.matchesTransformSnapshot({ transform }, transform), true);
  assert.equal(prefabPatch.matchesTransformSnapshot({ transform: { ...transform, width: 879 } }, transform), false);
  const diskSource = { sourceSha256: 'b'.repeat(64), metaSha256: 'c'.repeat(64) };
  const readbackOperation = { plan: { prefabUuid }, afterSourceSha256: diskSource.sourceSha256,
    diskReadback: { verified: true, prefabUuid, sourceSha256: diskSource.sourceSha256,
      metaSha256: diskSource.metaSha256 } };
  assert.equal(prefabPatch.hasMatchingDiskReadback(readbackOperation, diskSource), true);
  assert.equal(prefabPatch.hasMatchingDiskReadback({ ...readbackOperation, diskReadback: null }, diskSource), false);
  assert.equal(prefabPatch.hasMatchingDiskReadback({ ...readbackOperation,
    afterSourceSha256: 'd'.repeat(64) }, diskSource), false);
  assert.equal(prefabPatch.validateDiff([{ path: 'node.size.height', before: 60, after: -1 }]), false);
  assert.deepEqual(prefabPatch.invertDiff(sizeDiff), [{ path: 'node.size.width', before: 879, after: 880 }]);
});

test('Prefab sibling-order patch binds the existing parent and exact before/after indexes', () => {
  const diff = [{ path: 'node.siblingIndex', parentUuid: 'parent-node-id', before: 0, after: 1 }];
  const beforeNode = { ...node, parentUuid: 'parent-node-id', siblingIndex: 0 };
  const afterNode = { ...node, parentUuid: 'parent-node-id', siblingIndex: 1 };
  assert.equal(prefabPatch.validateDiff(diff), true);
  assert.equal(prefabPatch.matchesDiff(beforeNode, diff, 'before'), true);
  assert.equal(prefabPatch.matchesDiff(afterNode, diff, 'after'), true);
  assert.equal(prefabPatch.matchesDiff({ ...afterNode, parentUuid: 'other-parent' }, diff, 'after'), false);
  assert.equal(prefabPatch.matchesDiff({ ...afterNode, siblingIndex: 0 }, diff, 'after'), false);
  assert.deepEqual(prefabPatch.invertDiff(diff), [{ ...diff[0], before: 1, after: 0 }]);
  assert.equal(prefabPatch.validateDiff([{ ...diff[0], parentUuid: null }]), false);
  assert.equal(prefabPatch.validateDiff([{ ...diff[0], before: -1 }]), false);
  assert.equal(prefabPatch.validateDiff([{ ...diff[0], after: 10000 }]), false);
  assert.equal(prefabPatch.validateDiff([{ ...diff[0], after: 0 }]), false);
});

test('Prefab reparent patch binds exact parent paths and child order and derives an exact inverse', () => {
  const diff = [{ path: 'node.parent', before: { parentUuid: 'parent-a', parentPath: 'Root/A', siblingIndex: 1 },
    after: { parentUuid: 'parent-b', parentPath: 'Root/B', siblingIndex: 0 } }];
  const beforeNode = { ...node, nodePath: 'Root/A/Child', parentUuid: 'parent-a', siblingIndex: 1 };
  const afterNode = { ...beforeNode, nodePath: 'Root/B/Child', parentUuid: 'parent-b', siblingIndex: 0 };
  assert.equal(prefabPatch.validateDiff(diff), true);
  assert.equal(prefabPatch.matchesDiff(beforeNode, diff, 'before'), true);
  assert.equal(prefabPatch.matchesDiff(afterNode, diff, 'after'), true);
  assert.equal(prefabPatch.targetPathAt(beforeNode.nodePath, diff, 'before'), beforeNode.nodePath);
  assert.equal(prefabPatch.targetPathAt(beforeNode.nodePath, diff, 'after'), afterNode.nodePath);
  const inverse = prefabPatch.invertDiff(diff);
  assert.deepEqual(inverse, [{ path: 'node.parent', before: diff[0].after, after: diff[0].before }]);
  assert.equal(prefabPatch.matchesDiff(afterNode, inverse, 'before'), true);
  assert.equal(prefabPatch.targetPathAt(afterNode.nodePath, inverse, 'after'), beforeNode.nodePath);
  assert.equal(prefabPatch.validateDiff([{ ...diff[0], after: { ...diff[0].after, parentPath: 'Root/A/Child/Nested' } }]), true);
  assert.equal(prefabPatch.validateDiff([{ ...diff[0], after: { ...diff[0].after, parentUuid: 'parent-a' } }]), false);
  assert.equal(prefabPatch.validateDiff([{ ...diff[0], after: { ...diff[0].after, siblingIndex: -1 } }]), false);
  assert.equal(prefabPatch.validateDiff([diff[0], { path: 'node.active', before: true, after: false }]), false);
  assert.equal(prefabPatch.targetPathAt('Root/C/Child', diff, 'before'), null);
});

test('Prefab child edits bind the full sibling list and only insert or remove empty leaves', () => {
  const before = { childCount: 2, children: [
    { nodeUuid: 'first-child', name: 'First', siblingIndex: 0, childCount: 0, componentCount: 0 },
    { nodeUuid: 'second-child', name: 'Second', siblingIndex: 1, childCount: 0, componentCount: 0 },
  ] };
  const planned = { childCount: 3, children: [
    before.children[0], before.children[1],
    { nodeUuid: prefabPatch.AUTO_CHILD_NODE_ID, name: 'Added', siblingIndex: 2, childCount: 0, componentCount: 0 },
  ] };
  const plannedDiff = [{ path: 'node.child', before, after: planned }];
  assert.equal(prefabPatch.validateDiff(plannedDiff), true);
  assert.deepEqual(prefabPatch.childStateChange(before, planned), {
    kind: 'insert', index: 2, child: planned.children[2],
  });

  const created = { ...planned, children: [...planned.children.slice(0, 2),
    { ...planned.children[2], nodeUuid: 'new-child-id' }] };
  const createDiff = [{ path: 'node.child', before, after: created }];
  assert.equal(prefabPatch.validateDiff(createDiff), true);
  const parent = { childState: before };
  assert.equal(prefabPatch.matchesDiff(parent, createDiff, 'before'), true);
  parent.childState = created;
  assert.equal(prefabPatch.matchesDiff(parent, createDiff, 'after'), true);

  const inverse = prefabPatch.invertDiff(createDiff);
  assert.equal(prefabPatch.validateDiff(inverse), true);
  assert.equal(prefabPatch.childStateChange(inverse[0].before, inverse[0].after).kind, 'remove');
  assert.equal(prefabPatch.matchesDiff(parent, inverse, 'before'), true);
  parent.childState = before;
  assert.equal(prefabPatch.matchesDiff(parent, inverse, 'after'), true);

  const reordered = { childCount: 3, children: [
    created.children[1], created.children[0], created.children[2],
  ] };
  assert.equal(prefabPatch.validateDiff([{ path: 'node.child', before, after: reordered }]), false);
  const nonEmpty = [{ path: 'node.child', before: { childCount: 1, children: [
    { nodeUuid: 'target-child', name: 'Target', siblingIndex: 0, childCount: 1, componentCount: 0 },
  ] }, after: { childCount: 0, children: [] } }];
  assert.equal(prefabPatch.validateDiff(nonEmpty), false);
  assert.equal(prefabPatch.validateDiff([...createDiff, { path: 'node.active', before: true, after: false }]), false);
  assert.equal(prefabPatch.validateDiff([{ path: 'node.child', before: { childCount: 1, children: [
    { nodeUuid: 'AUTO', name: 'Invalid', siblingIndex: 0, childCount: 0, componentCount: 0 },
  ] }, after: { childCount: 0, children: [] } }]), false);
});

test('Prefab component structure accepts exact built-in and project script components with a removal inverse', () => {
  const before = { componentCount: 0, components: [] };
  const planned = { componentCount: 1, components: [{
    componentClassName: 'cc.BlockInputEvents', componentIndex: 0,
    componentInstanceId: prefabPatch.AUTO_COMPONENT_INSTANCE_ID, serializedClassId: 'cc.BlockInputEvents',
  }] };
  const plannedDiff = [{ path: 'component.structure', before, after: planned }];
  assert.equal(prefabPatch.validateDiff(plannedDiff), true);
  assert.deepEqual(prefabPatch.componentStateChange(before, planned), {
    kind: 'add', component: planned.components[0],
  });
  const scriptComponent = { componentClassName: '5a61a838-87a2-4b9d-a9d0-2f3a6bd05112',
    registeredClassName: 'CliAcceptanceButtonState', componentIndex: 0,
    componentInstanceId: prefabPatch.AUTO_COMPONENT_INSTANCE_ID,
    serializedClassId: '5a61a838-87a2-4b9d-a9d0-2f3a6bd05112' };
  const scriptDiff = [{ path: 'component.structure', before,
    after: { componentCount: 1, components: [scriptComponent] } }];
  assert.equal(prefabPatch.validateDiff(scriptDiff), true);
  assert.deepEqual(prefabPatch.componentStateChange(before, scriptDiff[0].after), {
    kind: 'add', component: scriptComponent,
  });
  const liveScriptState = { componentCount: 1, components: [{ ...scriptComponent,
    componentInstanceId: 'live-script-component-id' }] };
  delete liveScriptState.components[0].registeredClassName;
  const scriptRemovalDiff = [{ path: 'component.structure', before: liveScriptState, after: before }];
  assert.equal(prefabPatch.matchesBeforeOrGeometryAfter({ componentState: liveScriptState }, scriptRemovalDiff), true);
  assert.equal(prefabPatch.validateDiff([{ path: 'component.structure', before,
    after: { componentCount: 1, components: [{ ...scriptComponent, serializedClassId: 'unsafe id' }] } }]), false);

  const added = { componentCount: 1, components: [{ ...planned.components[0], componentInstanceId: 'planned-component-id' }] };
  const addDiff = [{ path: 'component.structure', before, after: added }];
  assert.equal(prefabPatch.validateDiff(addDiff), true);
  const target = { componentState: before };
  assert.equal(prefabPatch.matchesDiff(target, addDiff, 'before'), true);
  target.componentState = added;
  assert.equal(prefabPatch.matchesDiff(target, addDiff, 'after'), true);

  const inverse = prefabPatch.invertDiff(addDiff);
  assert.equal(prefabPatch.validateDiff(inverse), true);
  assert.equal(prefabPatch.componentStateChange(inverse[0].before, inverse[0].after).kind, 'remove');
  target.componentState = before;
  assert.equal(prefabPatch.matchesDiff(target, inverse, 'after'), true);

  const existingBlock = { componentCount: 1, components: [{ componentClassName: 'cc.BlockInputEvents',
    componentIndex: 0, componentInstanceId: 'existing-block-input-events',
    serializedClassId: 'cc.BlockInputEvents', enabled: false }] };
  const removeBlock = [{ path: 'component.structure', before: existingBlock, after: before }];
  assert.equal(prefabPatch.validateDiff(removeBlock), true);
  assert.deepEqual(prefabPatch.sourceInspectionDiff(removeBlock), removeBlock);
  assert.deepEqual(prefabPatch.componentStateChange(existingBlock, before), {
    kind: 'remove', component: existingBlock.components[0],
  });
  const restoreBlock = prefabPatch.invertDiff(removeBlock);
  assert.equal(prefabPatch.componentStateChange(restoreBlock[0].before, restoreBlock[0].after).kind, 'add');
  assert.equal(prefabPatch.componentStateChange(restoreBlock[0].before, restoreBlock[0].after).component.enabled, false);
  const existingToggleGroup = { componentCount: 1, components: [{ componentClassName: 'cc.ToggleGroup',
    componentIndex: 0, componentInstanceId: 'toggle-group-id', serializedClassId: 'cc.ToggleGroup', enabled: true,
    restoreProperties: [{ property: 'allowSwitchOff', value: true, serializedProperty: 'allowSwitchOff' }] }] };
  assert.equal(prefabPatch.validateDiff([{ path: 'component.structure', before: existingToggleGroup, after: before }]), true);
  assert.equal(prefabPatch.validateDiff([{ path: 'component.structure', before: { ...existingToggleGroup,
    components: [{ ...existingToggleGroup.components[0], restoreProperties: [{ property: 'items',
      value: { kind: 'array', items: [] }, serializedProperty: '_items' }] }] }, after: before }]), false);
  const diskBlockRow = { ...existingBlock.components[0] };
  delete diskBlockRow.enabled;
  const diskBlock = { componentState: { componentCount: 1, components: [diskBlockRow] },
    components: [{ index: 0, className: 'cc.BlockInputEvents', enabled: false }] };
  assert.equal(prefabPatch.matchesDiff(diskBlock, removeBlock, 'before'), true);

  const reordered = { componentCount: 2, components: [added.components[0], {
    componentClassName: 'cc.Sprite', componentIndex: 1, componentInstanceId: 'sprite-id', serializedClassId: 'cc.Sprite',
  }] };
  assert.equal(prefabPatch.validateDiff([{ path: 'component.structure', before, after: reordered }]), false);
  assert.equal(prefabPatch.validateDiff([{ path: 'component.structure', before: added, after: before },
    { path: 'node.active', before: true, after: false }]), false);
});

test('Prefab subtree patches accept only bounded componentless trees and derive an exact inverse', () => {
  const before = { childCount: 0, children: [] };
  const planned = { childCount: 1, children: [{ nodeUuid: 'AUTO', name: 'Panel', siblingIndex: 0,
    childCount: 1, componentCount: 0, children: [{ nodeUuid: 'AUTO', name: 'Caption', siblingIndex: 0,
      childCount: 0, componentCount: 0, children: [] }] }] };
  const invalid = [{ path: 'node.subtree', before, after: planned }];
  assert.equal(prefabPatch.validateDiff(invalid), true);
  const created = { childCount: 1, children: [{ ...planned.children[0], nodeUuid: 'panel-id', children: [
    { ...planned.children[0].children[0], nodeUuid: 'caption-id' },
  ] }] };
  const diff = [{ path: 'node.subtree', before, after: created }];
  assert.equal(prefabPatch.validateDiff(diff), true);
  assert.equal(prefabPatch.subtreeStateChange(before, created).nodeCount, 2);
  const target = { subtreeState: before };
  assert.equal(prefabPatch.matchesDiff(target, diff, 'before'), true);
  target.subtreeState = created;
  assert.equal(prefabPatch.matchesDiff(target, diff, 'after'), true);
  const inverse = prefabPatch.invertDiff(diff);
  assert.equal(prefabPatch.validateDiff(inverse), true);
  assert.equal(prefabPatch.subtreeStateChange(inverse[0].before, inverse[0].after).kind, 'remove');
  assert.equal(prefabPatch.matchesDiff(target, inverse, 'before'), true);

  const withComponent = structuredClone(created);
  withComponent.children[0].componentCount = 1;
  assert.equal(prefabPatch.validateDiff([{ path: 'node.subtree', before, after: withComponent }]), false);
  const tooDeep = { childCount: 1, children: [{ nodeUuid: 'a', name: 'a', siblingIndex: 0,
    childCount: 1, componentCount: 0, children: [{ nodeUuid: 'b', name: 'b', siblingIndex: 0,
      childCount: 1, componentCount: 0, children: [{ nodeUuid: 'c', name: 'c', siblingIndex: 0,
        childCount: 1, componentCount: 0, children: [{ nodeUuid: 'd', name: 'd', siblingIndex: 0,
          childCount: 1, componentCount: 0, children: [{ nodeUuid: 'e', name: 'e', siblingIndex: 0,
            childCount: 0, componentCount: 0, children: [] }] }] }] }] }] };
  assert.equal(prefabPatch.validateDiff([{ path: 'node.subtree', before, after: tooDeep }]), false);
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

test('read-only Prefab inspection identifies duplicate paths while patch preflight remains strict', () => {
  const rows = [{ __type__: 'cc.Prefab', data: { __id__: 1 } },
    { __type__: 'cc.Node', _name: 'Root', _id: 'root', _parent: null,
      _children: [{ __id__: 2 }, { __id__: 3 }], _components: [] },
    { __type__: 'cc.Node', _name: 'Item', _id: 'item-a', _parent: { __id__: 1 },
      _children: [], _components: [] },
    { __type__: 'cc.Node', _name: 'Item', _id: 'item-b', _parent: { __id__: 1 },
      _children: [], _components: [] }];
  const input = { prefabBytes: Buffer.from(JSON.stringify(rows)),
    metaBytes: Buffer.from(JSON.stringify({ uuid: prefabUuid, importer: 'prefab' })), prefabUuid };
  assert.equal(prefabSource.inspectPrefabSource(input).reason, 'PREFAB_NODE_PATH_AMBIGUOUS');
  const result = prefabSource.inspectPrefabSource({ ...input, allowAmbiguousPaths: true });
  assert.equal(result.available, true);
  assert.deepEqual(result.nodes.filter((item) => item.pathAmbiguous).map((item) => item.nodeUuid), ['item-a', 'item-b']);
  assert.equal(result.nodes[0].pathAmbiguous, undefined);
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

test('Prefab source inspection reports serialized node content size for exact size patches', () => {
  const serialized = [{ __type__: 'cc.Prefab', data: { __id__: 1 } },
    { __type__: 'cc.Node', _name: 'Root', _id: nodeUuid, _active: true, _parent: null,
      _children: [], _components: [], _contentSize: { __type__: 'cc.Size', width: 880, height: 60 },
      _prefab: { __id__: 2 }, _trs: { array: [480, 0, 0, 0, 0, 0, 1, 1, 1] } },
    { __type__: 'cc.PrefabInfo', fileId: 'root-file-id' }];
  const source = prefabSource.inspectPrefabSource({ prefabBytes: Buffer.from(JSON.stringify(serialized)),
    metaBytes: Buffer.from(JSON.stringify({ uuid: prefabUuid, importer: 'prefab' })), prefabUuid });
  assert.equal(source.available, true, JSON.stringify(source));
  assert.equal(source.nodes[0].transform.width, 880);
  assert.equal(source.nodes[0].transform.height, 60);
  assert.deepEqual(prefabPatch.valueAt(source.nodes[0], 'node.size.width'), { found: true, value: 880 });
});

test('Prefab source inspection accepts a validated component structure selector', () => {
  const serialized = [{ __type__: 'cc.Prefab', data: { __id__: 1 } },
    { __type__: 'cc.Node', _name: 'Root', _id: nodeUuid, _active: true, _parent: null,
      _children: [], _components: [], _prefab: { __id__: 2 }, _trs: { array: [0, 0, 0, 0, 0, 0, 1, 1, 1] } },
    { __type__: 'cc.PrefabInfo', fileId: 'root-file-id' }];
  const diff = { path: 'component.structure', before: { componentCount: 0, components: [] },
    after: { componentCount: 1, components: [{ componentClassName: 'cc.BlockInputEvents',
      componentIndex: 0, componentInstanceId: 'component-id-1', serializedClassId: 'cc.BlockInputEvents' }] } };
  const source = prefabSource.inspectPrefabSource({ prefabBytes: Buffer.from(JSON.stringify(serialized)),
    metaBytes: Buffer.from(JSON.stringify({ uuid: prefabUuid, importer: 'prefab' })), prefabUuid,
    expectedDiff: [diff], targetNodeUuid: nodeUuid });
  assert.equal(source.available, true, JSON.stringify(source));
  assert.deepEqual(source.nodes[0].componentState, { componentCount: 0, components: [] });
});

test('Prefab source inspection captures reversible BlockInputEvents state and synthetic identity', () => {
  const serialized = [{ __type__: 'cc.Prefab', data: { __id__: 1 } },
    { __type__: 'cc.Node', _name: 'Root', _id: nodeUuid, _active: true, _parent: null,
      _children: [], _components: [{ __id__: 3 }], _prefab: { __id__: 2 }, _trs: { array: [0, 0, 0, 0, 0, 0, 1, 1, 1] } },
    { __type__: 'cc.PrefabInfo', fileId: 'root-file-id' },
    { __type__: 'cc.BlockInputEvents', _enabled: false, _id: '' }];
  const source = prefabSource.inspectPrefabSource({ prefabBytes: Buffer.from(JSON.stringify(serialized)),
    metaBytes: Buffer.from(JSON.stringify({ uuid: prefabUuid, importer: 'prefab' })), prefabUuid });
  assert.equal(source.available, true, JSON.stringify(source));
  assert.deepEqual(source.nodes[0].componentState.components[0], {
    componentClassName: 'cc.BlockInputEvents', componentIndex: 0,
    componentInstanceId: prefabPatch.componentIdFor(prefabUuid, nodeUuid, 0, 'cc.BlockInputEvents', null),
    serializedClassId: 'cc.BlockInputEvents', enabled: false, componentIdSynthetic: true,
  });
  assert.equal(source.nodes[0].components[0].enabled, false);
  assert.equal(source.nodes[0].components[0].instanceIdSynthetic, true);
});

test('Prefab component removal readback binds and verifies every captured restorable property', () => {
  const serialized = [{ __type__: 'cc.Prefab', data: { __id__: 1 } },
    { __type__: 'cc.Node', _name: 'Root', _id: nodeUuid, _active: true, _parent: null,
      _children: [], _components: [{ __id__: 3 }], _prefab: { __id__: 2 }, _trs: { array: [0, 0, 0, 0, 0, 0, 1, 1, 1] } },
    { __type__: 'cc.PrefabInfo', fileId: 'root-file-id' },
    { __type__: 'cc.ToggleGroup', _enabled: true, _id: 'toggle-group-id', allowSwitchOff: true }];
  const before = { componentCount: 1, components: [{ componentClassName: 'cc.ToggleGroup', componentIndex: 0,
    componentInstanceId: 'toggle-group-id', serializedClassId: 'cc.ToggleGroup', enabled: true,
    restoreProperties: [{ property: 'allowSwitchOff', value: true, serializedProperty: 'allowSwitchOff' }] }] };
  const diff = { path: 'component.structure', before, after: { componentCount: 0, components: [] } };
  const inspect = (rows) => prefabSource.inspectPrefabSource({ prefabBytes: Buffer.from(JSON.stringify(rows)),
    metaBytes: Buffer.from(JSON.stringify({ uuid: prefabUuid, importer: 'prefab' })), prefabUuid,
    expectedDiff: [diff], targetNodeUuid: nodeUuid });
  const source = inspect(serialized);
  assert.equal(source.available, true, JSON.stringify(source));
  assert.equal(prefabPatch.matchesDiff(source.nodes[0], [diff], 'before'), true);
  const corrupted = structuredClone(serialized);
  corrupted[3].allowSwitchOff = false;
  const changedSource = inspect(corrupted);
  assert.equal(changedSource.available, true, JSON.stringify(changedSource));
  assert.equal(prefabPatch.matchesDiff(changedSource.nodes[0], [diff], 'before'), false);
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

test('Prefab source inspection reports serialized sibling order and stable parent IDs', () => {
  const serialized = [{ __type__: 'cc.Prefab', data: { __id__: 1 } },
    { __type__: 'cc.Node', _name: 'Root', _id: '', _active: true, _parent: null,
      _children: [{ __id__: 2 }, { __id__: 3 }], _components: [], _prefab: { __id__: 4 },
      _trs: { array: [0, 0, 0, 0, 0, 0, 1, 1, 1] } },
    { __type__: 'cc.Node', _name: 'First', _id: 'first-node', _active: true, _parent: { __id__: 1 },
      _children: [], _components: [], _prefab: { __id__: 5 }, _trs: { array: [0, 0, 0, 0, 0, 0, 1, 1, 1] } },
    { __type__: 'cc.Node', _name: 'Second', _id: 'second-node', _active: true, _parent: { __id__: 1 },
      _children: [], _components: [], _prefab: { __id__: 6 }, _trs: { array: [0, 0, 0, 0, 0, 0, 1, 1, 1] } },
    { __type__: 'cc.PrefabInfo', fileId: '', root: { __id__: 1 }, asset: { __id__: 0 } },
    { __type__: 'cc.PrefabInfo', fileId: 'first-file-id', root: { __id__: 1 }, asset: { __id__: 0 } },
    { __type__: 'cc.PrefabInfo', fileId: 'second-file-id', root: { __id__: 1 }, asset: { __id__: 0 } }];
  const source = prefabSource.inspectPrefabSource({ prefabBytes: Buffer.from(JSON.stringify(serialized)),
    metaBytes: Buffer.from(JSON.stringify({ uuid: prefabUuid, importer: 'prefab' })), prefabUuid });
  assert.equal(source.available, true, JSON.stringify(source));
  assert.deepEqual(source.nodes.map(({ nodeUuid, parentUuid, siblingIndex, siblingCount }) =>
    ({ nodeUuid, parentUuid, siblingIndex, siblingCount })), [
    { nodeUuid: prefabPatch.rootNodeId(prefabUuid), parentUuid: null, siblingIndex: null, siblingCount: 0 },
    { nodeUuid: 'first-node', parentUuid: prefabPatch.rootNodeId(prefabUuid), siblingIndex: 0, siblingCount: 2 },
    { nodeUuid: 'second-node', parentUuid: prefabPatch.rootNodeId(prefabUuid), siblingIndex: 1, siblingCount: 2 },
  ]);
  assert.deepEqual(source.nodes[0].childState, { childCount: 2, children: [
    { nodeUuid: 'first-node', name: 'First', siblingIndex: 0, childCount: 0, componentCount: 0 },
    { nodeUuid: 'second-node', name: 'Second', siblingIndex: 1, childCount: 0, componentCount: 0 },
  ] });
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

test('Prefab source readback preserves declared asset types for newly appended array references', () => {
  const materialUuid = '44444444-4444-4444-8444-444444444444';
  const serialized = [{ __type__: 'cc.Prefab', data: { __id__: 1 } },
    { __type__: 'cc.Node', _name: 'Root', _id: nodeUuid, _active: true, _parent: null,
      _children: [], _components: [{ __id__: 2 }], _prefab: { __id__: 3 },
      _trs: { array: [0, 0, 0, 0, 0, 0, 1, 1, 1] } },
    { __type__: 'cc.Sprite', _id: 'sprite-1', node: { __id__: 1 }, _enabled: true,
      _materials: [{ __uuid__: materialUuid }, { __uuid__: materialUuid }] },
    { __type__: 'cc.PrefabInfo', fileId: 'root-file-id' }];
  const asset = { kind: 'asset', assetClass: 'Material', assetUuid: materialUuid };
  const diff = { path: 'component.property', componentClassName: 'cc.Sprite', componentInstanceId: 'sprite-1',
    componentIndex: 0, property: 'materials', serializedProperty: '_materials',
    serializedPropertyCandidates: ['_materials'], before: { kind: 'array', items: [asset] },
    after: { kind: 'array', items: [asset, asset] } };
  const source = prefabSource.inspectPrefabSource({ prefabBytes: Buffer.from(JSON.stringify(serialized)),
    metaBytes: Buffer.from(JSON.stringify({ uuid: prefabUuid, importer: 'prefab' })), prefabUuid,
    targetNodeUuid: nodeUuid, expectedDiff: [diff] });
  assert.equal(source.available, true, JSON.stringify(source));
  assert.deepEqual(source.nodes[0].componentProperties['sprite-1'].materials, diff.after);
  assert.equal(prefabPatch.matchesDiff(source.nodes[0], [diff], 'after'), true,
    JSON.stringify(source.nodes[0].componentProperties['sprite-1']));
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

test('Prefab source readback derives stable component identities when referenced components omit serialized IDs', () => {
  const serialized = [{ __type__: 'cc.Prefab', data: { __id__: 1 } },
    { __type__: 'cc.Node', _name: 'Root', _id: '', _active: true, _parent: null,
      _children: [{ __id__: 2 }], _components: [{ __id__: 4 }], _prefab: { __id__: 5 },
      _trs: { array: [0, 0, 0, 0, 0, 0, 1, 1, 1] } },
    { __type__: 'cc.Node', _name: 'Child', _id: 'child-id', _active: true, _parent: { __id__: 1 },
      _children: [], _components: [{ __id__: 3 }], _prefab: { __id__: 6 },
      _trs: { array: [0, 0, 0, 0, 0, 0, 1, 1, 1] } },
    { __type__: 'cc.Sprite', node: { __id__: 2 }, _enabled: true },
    { __type__: 'Test.ReferenceHolder', _id: 'holder-id', node: { __id__: 1 }, targetComponent: { __id__: 3 } },
    { __type__: 'cc.PrefabInfo', fileId: '', root: { __id__: 1 }, asset: { __id__: 0 } },
    { __type__: 'cc.PrefabInfo', fileId: 'child-file-id', root: { __id__: 1 }, asset: { __id__: 0 } }];
  const componentInstanceId = prefabPatch.componentIdFor(prefabUuid, 'child-id', 0, 'cc.Sprite', null);
  const expectedDiff = [{ path: 'component.property', componentClassName: 'Test.ReferenceHolder',
    componentInstanceId: 'holder-id', componentIndex: 0, property: 'targetComponent',
    serializedProperty: 'targetComponent', serializedPropertyCandidates: ['targetComponent'],
    before: { kind: 'component-ref', componentClassName: 'cc.Sprite' },
    after: { kind: 'component-ref', componentClassName: 'cc.Sprite', componentInstanceId, nodeUuid: 'child-id' } }];
  const source = prefabSource.inspectPrefabSource({ prefabBytes: Buffer.from(JSON.stringify(serialized)),
    metaBytes: Buffer.from(JSON.stringify({ uuid: prefabUuid, importer: 'prefab' })), prefabUuid,
    targetNodeUuid: prefabPatch.rootNodeId(prefabUuid), expectedDiff });
  assert.equal(source.available, true, JSON.stringify(source));
  assert.deepEqual(source.nodes[0].componentProperties['holder-id'].targetComponent, expectedDiff[0].after);
  assert.equal(prefabPatch.matchesDiff(source.nodes[0], expectedDiff, 'after'), true);
});

test('Prefab source readback preserves typed empty node and component references', () => {
  const serialized = [{ __type__: 'cc.Prefab', data: { __id__: 1 } },
    { __type__: 'cc.Node', _name: 'Root', _id: '', _active: true, _parent: null,
      _children: [], _components: [{ __id__: 2 }], _prefab: { __id__: 3 },
      _trs: { array: [0, 0, 0, 0, 0, 0, 1, 1, 1] } },
    { __type__: 'Test.ReferenceHolder', _id: 'holder-id', node: { __id__: 1 },
      targetNode: null, targetComponent: null },
    { __type__: 'cc.PrefabInfo', fileId: '', root: { __id__: 1 }, asset: { __id__: 0 } }];
  const expectedDiff = [
    { path: 'component.property', componentClassName: 'Test.ReferenceHolder', componentInstanceId: 'holder-id',
      componentIndex: 0, property: 'targetNode', serializedProperty: 'targetNode',
      serializedPropertyCandidates: ['targetNode'], before: { kind: 'node-ref' },
      after: { kind: 'node-ref', nodeUuid: 'child-id' } },
    { path: 'component.property', componentClassName: 'Test.ReferenceHolder', componentInstanceId: 'holder-id',
      componentIndex: 0, property: 'targetComponent', serializedProperty: 'targetComponent',
      serializedPropertyCandidates: ['targetComponent'], before: { kind: 'component-ref', componentClassName: 'cc.Sprite' },
      after: { kind: 'component-ref', componentClassName: 'cc.Sprite', componentInstanceId: 'sprite-id', nodeUuid: 'child-id' } },
  ];
  const source = prefabSource.inspectPrefabSource({ prefabBytes: Buffer.from(JSON.stringify(serialized)),
    metaBytes: Buffer.from(JSON.stringify({ uuid: prefabUuid, importer: 'prefab' })), prefabUuid,
    targetNodeUuid: prefabPatch.rootNodeId(prefabUuid), expectedDiff });
  assert.equal(source.available, true, JSON.stringify(source));
  assert.deepEqual(source.nodes[0].componentProperties['holder-id'], {
    targetNode: { kind: 'node-ref' },
    targetComponent: { kind: 'component-ref', componentClassName: 'cc.Sprite' },
  });
  assert.equal(prefabPatch.matchesDiff(source.nodes[0], expectedDiff, 'before'), true,
    JSON.stringify(source.nodes[0].componentProperties['holder-id']));
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
    x: 1, y: 2, width: 880, height: 60, scaleX: 1, scaleY: 1,
    getPosition() { return { x: this.x, y: this.y }; },
    setPosition(x, y) { this.x = x; this.y = y; },
    setContentSize(width, height) { this.width = width; this.height = height; },
    getComponents() { return this._components; } };
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

  const sizeDiff = [{ path: 'node.size.width', before: 880, after: 879 }];
  const sizeInput = { ...input, expectedDiff: sizeDiff };
  assert.equal(invoke('prefabSourcePatchPreflight', sizeInput).available, true,
    JSON.stringify(invoke('prefabSourcePatchPreflight', sizeInput)));
  assert.equal(invoke('prefabSourcePatchMutate', sizeInput).node.transform.width, 879);
  const sizeCompensation = { ...sizeInput, action: 'compensate', expectedDiff: prefabPatch.invertDiff(sizeDiff) };
  assert.equal(invoke('prefabSourcePatchPreflight', sizeCompensation).available, true);
  assert.equal(invoke('prefabSourcePatchMutate', sizeCompensation).node.transform.width, 880);
  const persistLiveLayout = { ...input, expectedDiff: [{ path: 'node.size.width', before: 879, after: 880 }] };
  assert.equal(invoke('prefabSourcePatchPreflight', persistLiveLayout).available, true,
    'a geometry apply may persist a Creator-computed after-state that is already live');
  assert.equal(invoke('prefabSourcePatchMutate', persistLiveLayout).node.transform.width, 880);

  const readbackMismatch = { ...input, expectedDiff: [{ path: 'node.position.x', before: 3, after: 5 }] };
  node.setPosition = function setPosition(x, y) { this.x = Math.min(x, 4); this.y = y; };
  const rejectedWrite = invoke('prefabSourcePatchMutate', readbackMismatch);
  assert.equal(rejectedWrite.available, false);
  assert.equal(rejectedWrite.reason, 'PREFAB_EXPECTED_STATE_MISMATCH');
  assert.equal(rejectedWrite.diagnostic.fields[0].actual, 4,
    'a failed after-state readback must expose its actual bounded field value');
});

test('Widget compensation restores geometry before the explicitly compensated margin', () => {
  const scenePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../creator-extension/scene.js');
  class Node {
    constructor() { this.uuid = 'live-root'; this.name = 'Root'; this.active = true; this.children = [];
      this._components = []; this.x = 480.5; this.y = 0; this.width = 879; this.height = 60;
      this.scaleX = 1; this.scaleY = 1; this._objFlags = 0; }
    getComponents(type) { return type ? this._components.filter((component) => component instanceof type) : this._components; }
    getPosition() { return { x: this.x, y: this.y }; }
    setPosition(x, y) { this.x = x; this.y = y; if (x === 480 && this._components[0]) this._components[0]._left = 39; }
    setScale(x, y) { this.scaleX = x; this.scaleY = y; }
    setContentSize(width, height) { this.width = width; this.height = height; }
  }
  class Component {}
  class Widget extends Component {
    constructor(node) { super(); this.node = node; this._id = 'live-widget'; this._left = 41; this._enabled = true; }
    get left() { return this._left; }
    set left(value) { this._left = value; }
  }
  Widget.prototype.__classname__ = 'cc.Widget';
  Widget.__props__ = ['left'];
  Widget.__values__ = ['_left'];
  const root = new Node();
  root._prefab = { root, fileId: '', asset: { _uuid: prefabUuid } };
  const widget = new Widget(root);
  root._components.push(widget);
  const scene = { uuid: 'edit-scene', name: 'EditScene', children: [root] };
  root.parent = scene;
  const mode = { name: 'prefab', save(callback) { callback(); }, dirty() { return false; } };
  const classes = { 'cc.Component': Component, 'cc.Widget': Widget };
  const cc = { Node, Component, director: { getScene: () => scene },
    Class: { attr: () => ({ type: Number, default: 0 }) },
    Object: { Flags: { DontSave: 8, HideInHierarchy: 1024 } },
    isValid(value) { return value && value.destroyed !== true; },
    js: { getClassByName(name) { return classes[name]; }, getClassName(type) { return type.prototype.__classname__ || type.name; },
      _getClassId(type) { return type.prototype.__classname__ || type.name; },
      isChildClassOf(type, base) { return type === base || type.prototype instanceof base; } } };
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
  const componentInstanceId = prefabPatch.componentIdFor(prefabUuid, rootId, 0, 'cc.Widget', null);
  const input = { prefabUuid, targetNodeUuid: rootId, targetNodePath: 'Root', action: 'compensate',
    restoreTransform: { x: 480, y: 0, scaleX: 1, scaleY: 1, width: 880, height: 60 },
    expectedDiff: [{ path: 'component.property', componentClassName: 'cc.Widget', componentInstanceId,
      componentIndex: 0, serializedClassId: 'cc.Widget', property: 'left', serializedProperty: '_left',
      serializedPropertyCandidates: ['_left'], serializedWasOmitted: false, before: 41, after: 40 }] };
  const changed = invoke('prefabSourcePatchMutate', input);
  assert.equal(changed.available, true, JSON.stringify(changed));
  assert.equal(widget.left, 40);
  assert.deepEqual(JSON.parse(JSON.stringify(changed.node.transform)),
    { x: 480, y: 0, scaleX: 1, scaleY: 1, width: 880, height: 60 });

  widget._left = 41; root.x = 480.5; root.width = 879;
  root.setPosition = function setPosition(x, y) { this.x = x; this.y = y; if (x === 480) widget._left = 40; };
  const alreadyRestored = invoke('prefabSourcePatchMutate', input);
  assert.equal(alreadyRestored.available, true, JSON.stringify(alreadyRestored));
  assert.equal(widget.left, 40, 'a transform-induced exact after value is already the successful compensated result');
});

test('Prefab sibling order changes only the selected child within its exact Prefab parent', () => {
  const scenePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../creator-extension/scene.js');
  class Node {
    constructor(name, uuid, id) { this.name = name; this.uuid = uuid; this._id = id; this.children = [];
      this._components = []; this.parent = null; this._objFlags = 0; this.active = true; this.scaleX = 1; this.scaleY = 1; }
    getComponents() { return this._components; }
    getPosition() { return { x: 0, y: 0 }; }
    getSiblingIndex() { return this.parent ? this.parent.children.indexOf(this) : -1; }
    setSiblingIndex(index) {
      const siblings = this.parent.children;
      siblings.splice(siblings.indexOf(this), 1);
      siblings.splice(index, 0, this);
    }
  }
  const root = new Node('Root', 'live-root', '');
  root._prefab = { root, fileId: '', asset: { _uuid: prefabUuid } };
  const first = new Node('First', 'live-first', 'runtime-first-id');
  first._prefab = { root, fileId: 'first-node', asset: { _uuid: prefabUuid } };
  const second = new Node('Second', 'live-second', 'runtime-second-id');
  second._prefab = { root, fileId: 'second-node', asset: { _uuid: prefabUuid } };
  root.children = [first, second]; first.parent = root; second.parent = root;
  const scene = new Node('EditScene', 'edit-scene', 'scene-id');
  scene.children = [root]; root.parent = scene;
  const mode = { name: 'prefab', save(callback) { callback(); }, dirty() { return false; } };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(scenePath, 'utf8'), { module, exports: module.exports,
    require: createRequire(scenePath), cc: { Node, director: { getScene: () => scene },
      Object: { Flags: { DontSave: 8, HideInHierarchy: 1024 } },
      js: { getClassName: () => 'cc.Node' } }, Editor: { isMainProcess: false,
      require() { return { curMode: () => mode }; } } }, { filename: 'scene.js' });
  function invoke(method, input) {
    let value;
    module.exports[method]({ reply(error, result) { assert.equal(error, null); value = result; } }, input);
    return value;
  }
  const rootId = prefabPatch.rootNodeId(prefabUuid);
  const diff = [{ path: 'node.siblingIndex', parentUuid: rootId, before: 0, after: 1 }];
  const input = { prefabUuid, targetNodeUuid: 'first-node', targetNodePath: 'Root/First', action: 'apply', expectedDiff: diff };
  const preflight = invoke('prefabSourcePatchPreflight', input);
  assert.equal(preflight.available, true, JSON.stringify(preflight));
  assert.equal(preflight.node.nodeUuid, input.targetNodeUuid);
  assert.equal(preflight.node.liveNodeUuid, first.uuid);
  const changed = invoke('prefabSourcePatchMutate', input);
  assert.equal(changed.available, true, JSON.stringify(changed));
  assert.deepEqual(root.children, [second, first]);
  assert.equal(changed.node.nodeUuid, input.targetNodeUuid);
  assert.equal(changed.node.liveNodeUuid, first.uuid);
  assert.equal(changed.node.parentUuid, rootId);
  assert.equal(changed.node.siblingIndex, 1);

  const inverse = prefabPatch.invertDiff(diff);
  const compensate = { ...input, action: 'compensate', expectedDiff: inverse };
  assert.equal(invoke('prefabSourcePatchPreflight', compensate).available, true);
  const restored = invoke('prefabSourcePatchMutate', compensate);
  assert.equal(restored.available, true, JSON.stringify(restored));
  assert.deepEqual(root.children, [first, second]);
  assert.equal(restored.node.siblingIndex, 0);
});

test('Prefab reparent changes one node within the same asset and restores parent plus child order', () => {
  const scenePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../creator-extension/scene.js');
  class Node {
    constructor(name, uuid, id) { this.name = name; this.uuid = uuid; this._id = id; this.children = [];
      this._components = []; this._parent = null; this._objFlags = 0; this.active = true; this.scaleX = 1; this.scaleY = 1; }
    get parent() { return this._parent; }
    set parent(value) {
      if (this._parent && Array.isArray(this._parent.children)) {
        const previousIndex = this._parent.children.indexOf(this);
        if (previousIndex >= 0) this._parent.children.splice(previousIndex, 1);
      }
      this._parent = value;
      if (value && Array.isArray(value.children) && !value.children.includes(this)) value.children.push(this);
    }
    getComponents() { return this._components; }
    getPosition() { return { x: 0, y: 0 }; }
    getSiblingIndex() { return this.parent ? this.parent.children.indexOf(this) : -1; }
    setSiblingIndex(index) {
      const siblings = this.parent.children;
      siblings.splice(siblings.indexOf(this), 1);
      siblings.splice(index, 0, this);
    }
  }
  const root = new Node('Root', 'live-root', '');
  root._prefab = { root, fileId: '', asset: { _uuid: prefabUuid } };
  const folderA = new Node('A', 'live-a', 'runtime-a'); folderA._prefab = { root, fileId: 'parent-a' };
  const folderB = new Node('B', 'live-b', 'runtime-b'); folderB._prefab = { root, fileId: 'parent-b' };
  const mover = new Node('Mover', 'live-mover', 'runtime-mover'); mover._prefab = { root, fileId: 'mover-id' };
  const siblingA = new Node('SiblingA', 'live-sibling-a', 'runtime-sibling-a'); siblingA._prefab = { root, fileId: 'sibling-a' };
  const existingB = new Node('ExistingB', 'live-existing-b', 'runtime-existing-b'); existingB._prefab = { root, fileId: 'existing-b' };
  const nested = new Node('Nested', 'live-nested', 'runtime-nested'); nested._prefab = { root, fileId: 'nested-id' };
  root.children = [folderA, folderB]; folderA._parent = root; folderB._parent = root;
  folderA.children = [mover, siblingA]; mover._parent = folderA; siblingA._parent = folderA;
  folderB.children = [existingB]; existingB._parent = folderB;
  mover.children = [nested]; nested._parent = mover;
  const scene = new Node('EditScene', 'edit-scene', 'scene-id'); scene.uuid = 'edit-scene'; scene.children = [root]; root._parent = scene;
  const mode = { name: 'prefab', save(callback) { callback(); }, dirty() { return false; } };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(scenePath, 'utf8'), { module, exports: module.exports,
    require: createRequire(scenePath), cc: { Node, director: { getScene: () => scene },
      Object: { Flags: { DontSave: 8, HideInHierarchy: 1024 } }, js: { getClassName: () => 'cc.Node' } },
    Editor: { isMainProcess: false, require() { return { curMode: () => mode }; } } }, { filename: 'scene.js' });
  function invoke(method, input) {
    let value;
    module.exports[method]({ reply(error, result) { assert.equal(error, null); value = result; } }, input);
    return value;
  }
  const diff = [{ path: 'node.parent', before: { parentUuid: 'parent-a', parentPath: 'Root/A', siblingIndex: 0 },
    after: { parentUuid: 'parent-b', parentPath: 'Root/B', siblingIndex: 1 } }];
  const input = { prefabUuid, targetNodeUuid: 'mover-id', targetNodePath: 'Root/A/Mover', action: 'apply', expectedDiff: diff };
  const preflight = invoke('prefabSourcePatchPreflight', input);
  assert.equal(preflight.available, true, JSON.stringify(preflight));
  const moved = invoke('prefabSourcePatchMutate', input);
  assert.equal(moved.available, true, JSON.stringify(moved));
  assert.deepEqual(folderA.children, [siblingA]);
  assert.deepEqual(folderB.children, [existingB, mover]);
  assert.equal(moved.node.nodePath, 'Root/B/Mover');
  assert.equal(moved.node.parentUuid, 'parent-b');
  assert.equal(moved.node.siblingIndex, 1);

  const inverse = prefabPatch.invertDiff(diff);
  const compensate = { ...input, targetNodePath: 'Root/B/Mover', action: 'compensate', expectedDiff: inverse };
  assert.equal(invoke('prefabSourcePatchPreflight', compensate).available, true);
  const restored = invoke('prefabSourcePatchMutate', compensate);
  assert.equal(restored.available, true, JSON.stringify(restored));
  assert.deepEqual(folderA.children, [mover, siblingA]);
  assert.deepEqual(folderB.children, [existingB]);
  assert.equal(restored.node.nodePath, 'Root/A/Mover');
  assert.equal(restored.node.parentUuid, 'parent-a');
  assert.equal(restored.node.siblingIndex, 0);

  const cycleDiff = [{ path: 'node.parent', before: inverse[0].after,
    after: { parentUuid: 'nested-id', parentPath: 'Root/A/Mover/Nested', siblingIndex: 0 } }];
  const cycle = invoke('prefabSourcePatchPreflight', { ...input, expectedDiff: cycleDiff });
  assert.equal(cycle.available, false);
  assert.equal(cycle.reason, 'PREFAB_REPARENT_CYCLE');
});

test('Prefab patch creates and deletes one linked empty leaf child and compensates exactly', () => {
  const scenePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../creator-extension/scene.js');
  let nextNode = 0;
  class Node {
    constructor(name) {
      this.name = name; this.uuid = `live-node-${++nextNode}`; this._id = `runtime-node-${nextNode}`;
      this.children = []; this._components = []; this._parent = null; this._objFlags = 0;
      this.active = true; this.scaleX = 1; this.scaleY = 1; this.scaleZ = 1; this.x = 0; this.y = 0;
    }
    get parent() { return this._parent; }
    set parent(value) {
      if (this._parent && Array.isArray(this._parent.children)) {
        const previousIndex = this._parent.children.indexOf(this);
        if (previousIndex >= 0) this._parent.children.splice(previousIndex, 1);
      }
      this._parent = value;
      if (value && Array.isArray(value.children) && !value.children.includes(this)) value.children.push(this);
      if (value && value._prefab && !this._prefab) this._prefab = {
        root: value._prefab.root, fileId: this._id, asset: value._prefab.asset,
      };
      if (!value && this._prefab && this._prefab.root !== this) this._prefab = null;
    }
    addChild(child) { child.parent = this; }
    removeChild(child) { if (child.parent === this) child.parent = null; }
    getComponents() { return this._components; }
    getPosition() { return { x: this.x, y: this.y }; }
    getSiblingIndex() { return this.parent ? this.parent.children.indexOf(this) : -1; }
    setSiblingIndex(index) {
      const siblings = this.parent.children;
      siblings.splice(siblings.indexOf(this), 1);
      siblings.splice(index, 0, this);
    }
    destroy() { this.destroyed = true; }
  }
  const root = new Node('Root');
  root._prefab = { root, fileId: '', asset: { _uuid: prefabUuid } };
  const original = new Node('Original');
  original._prefab = { root, fileId: 'original-child', asset: root._prefab.asset };
  root.addChild(original);
  const scene = new Node('EditScene'); scene.uuid = 'edit-scene'; scene._id = 'scene-id';
  scene.addChild(root);
  const mode = { name: 'prefab', save(callback) { callback(); }, dirty() { return false; } };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(scenePath, 'utf8'), { module, exports: module.exports,
    require: createRequire(scenePath), cc: { Node, director: { getScene: () => scene },
      Object: { Flags: { DontSave: 8, HideInHierarchy: 1024 } }, js: { getClassName: () => 'cc.Node' } },
    Editor: { isMainProcess: false, require() { return { curMode: () => mode }; } } }, { filename: 'scene.js' });
  function invoke(method, input) {
    let value;
    module.exports[method]({ reply(error, result) { assert.equal(error, null); value = result; } }, input);
    return value;
  }
  const rootId = prefabPatch.rootNodeId(prefabUuid);
  const before = { childCount: 1, children: [
    { nodeUuid: 'original-child', name: 'Original', siblingIndex: 0, childCount: 0, componentCount: 0 },
  ] };
  const after = { childCount: 2, children: [before.children[0],
    { nodeUuid: 'planned-child-id', name: 'Added', siblingIndex: 1, childCount: 0, componentCount: 0 }] };
  const diff = [{ path: 'node.child', before, after }];
  const input = { prefabUuid, targetNodeUuid: rootId, targetNodePath: 'Root', action: 'apply', expectedDiff: diff };
  const preflight = invoke('prefabSourcePatchPreflight', input);
  assert.equal(preflight.available, true, JSON.stringify(preflight));
  const created = invoke('prefabSourcePatchMutate', input);
  assert.equal(created.available, true, JSON.stringify(created));
  assert.equal(created.node.childState.children[1].nodeUuid, 'planned-child-id');
  assert.equal(root.children[1]._prefab.root, root);
  assert.equal(root.children[1]._prefab.fileId, 'planned-child-id');

  const inverse = prefabPatch.invertDiff(diff);
  const compensate = { ...input, action: 'compensate', expectedDiff: inverse };
  assert.equal(invoke('prefabSourcePatchPreflight', compensate).available, true);
  const deleted = invoke('prefabSourcePatchMutate', compensate);
  assert.equal(deleted.available, true, JSON.stringify(deleted));
  assert.deepEqual(root.children, [original]);

  const subtreeBefore = { childCount: 1, children: [{ nodeUuid: 'original-child', name: 'Original',
    siblingIndex: 0, childCount: 0, componentCount: 0, children: [] }] };
  const subtreeAfter = { childCount: 2, children: [subtreeBefore.children[0], { nodeUuid: 'branch-id', name: 'Branch',
    siblingIndex: 1, childCount: 1, componentCount: 0, children: [{ nodeUuid: 'caption-id', name: 'Caption',
      siblingIndex: 0, childCount: 0, componentCount: 0, children: [] }] }] };
  const subtreeDiff = [{ path: 'node.subtree', before: subtreeBefore, after: subtreeAfter }];
  const subtreeInput = { ...input, expectedDiff: subtreeDiff };
  assert.equal(invoke('prefabSourcePatchPreflight', subtreeInput).available, true);
  const subtreeCreated = invoke('prefabSourcePatchMutate', subtreeInput);
  assert.equal(subtreeCreated.available, true, JSON.stringify(subtreeCreated));
  assert.equal(root.children[1].name, 'Branch');
  assert.equal(root.children[1]._prefab.fileId, 'branch-id');
  assert.equal(root.children[1].children[0]._prefab.fileId, 'caption-id');
  const subtreeInverse = prefabPatch.invertDiff(subtreeDiff);
  const subtreeCompensate = { ...input, action: 'compensate', expectedDiff: subtreeInverse };
  assert.equal(invoke('prefabSourcePatchPreflight', subtreeCompensate).available, true);
  const subtreeDeleted = invoke('prefabSourcePatchMutate', subtreeCompensate);
  assert.equal(subtreeDeleted.available, true, JSON.stringify(subtreeDeleted));
  assert.deepEqual(root.children, [original]);
});

test('Prefab patch appends one registered built-in or project script component and compensates that exact instance', () => {
  const scenePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../creator-extension/scene.js');
  class Component {
    constructor() { this._id = 'runtime-component-id'; this.node = null; this._objFlags = 0; this.enabled = true; }
    destroy() {
      if (this._objFlags & 4) return false;
      const index = this.node._components.indexOf(this);
      if (index >= 0) this.node._components.splice(index, 1);
      const attached = cc.engine.attachedObjsForEditor;
      if (attached[this._id] === this) delete attached[this._id];
      this.destroyed = true;
      return true;
    }
  }
  class BlockInputEvents extends Component {}
  BlockInputEvents.prototype.__classname__ = 'cc.BlockInputEvents';
  class ToggleGroup extends Component {
    constructor() { super(); this.allowSwitchOff = false; }
  }
  ToggleGroup.prototype.__classname__ = 'cc.ToggleGroup';
  ToggleGroup.__props__ = ['allowSwitchOff'];
  ToggleGroup.__values__ = ['allowSwitchOff'];
  class CliAcceptanceButtonState extends Component {}
  CliAcceptanceButtonState.prototype.__classname__ = 'CliAcceptanceButtonState';
  CliAcceptanceButtonState.prototype.__classId__ = '5a61a838-87a2-4b9d-a9d0-2f3a6bd05112';
  class Node {
    constructor(name, uuid, id) {
      this.name = name; this.uuid = uuid; this._id = id; this.children = []; this._components = [];
      this._parent = null; this._objFlags = 0; this.active = true; this.x = 0; this.y = 0; this.z = 0;
      this.scaleX = 1; this.scaleY = 1; this.angle = 0; this.width = 100; this.height = 100;
      this.anchorX = 0.5; this.anchorY = 0.5;
    }
    get parent() { return this._parent; }
    set parent(value) { this._parent = value; if (value && !value.children.includes(this)) value.children.push(this); }
    getComponents(type) { return this._components.filter((component) => component instanceof type); }
    addComponent(type) {
      const component = new type(); component.node = this; this._components.push(component);
      const attached = cc.engine.attachedObjsForEditor;
      if (this._id in attached) attached[component._id] = component;
      return component;
    }
    getPosition() { return { x: this.x, y: this.y }; }
    setPosition(x, y, z = this.z) { this.x = x; this.y = y; this.z = z; }
    setContentSize(width, height) { this.width = width; this.height = height; }
    setAnchorPoint(x, y) { this.anchorX = x; this.anchorY = y; }
    getSiblingIndex() { return this.parent ? this.parent.children.indexOf(this) : -1; }
  }
  const scene = new Node('EditScene', 'edit-scene', 'scene-id');
  const root = new Node('Root', 'live-root', 'root-runtime-id');
  root._prefab = { root, fileId: '', asset: { _uuid: prefabUuid } };
  scene.addChild = (node) => { node.parent = scene; };
  scene.addChild(root);
  const classes = { 'cc.Component': Component, 'cc.BlockInputEvents': BlockInputEvents, 'cc.ToggleGroup': ToggleGroup,
    CliAcceptanceButtonState };
  const cc = { Node, Component, director: { getScene: () => scene },
    Class: { attr(_constructor, property) { return property === 'allowSwitchOff' ? { type: Boolean, default: false } : null; } },
    Object: { Flags: { DontSave: 8, HideInHierarchy: 1024 }, _willDestroy(component) { return !!(component._objFlags & 4); } },
    engine: { attachedObjsForEditor: { 'root-runtime-id': root } },
    js: { getClassByName(name) { return classes[name]; },
      getClassName(type) { return type.prototype.__classname__ || type.name; },
      _getClassId(type) { return type.prototype.__classId__ || type.prototype.__classname__ || type.name; },
      isChildClassOf(type, base) { return type === base || type.prototype instanceof base; } } };
  const mode = { name: 'prefab', save(callback) { callback(); }, dirty() { return false; } };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(scenePath, 'utf8'), { module, exports: module.exports,
    require: createRequire(scenePath), cc,
    Editor: { isMainProcess: false, require() { return { curMode: () => mode }; } },
    setImmediate(callback) {
      for (const component of [...root._components]) if (cc.Object._willDestroy(component)) {
        const index = root._components.indexOf(component);
        if (index >= 0) root._components.splice(index, 1);
        if (cc.engine.attachedObjsForEditor[component._id] === component) delete cc.engine.attachedObjsForEditor[component._id];
      }
      callback();
    } }, { filename: 'scene.js' });
  function invoke(method, input) {
    let value;
    module.exports[method]({ reply(error, result) { assert.equal(error, null); value = result; } }, input);
    return value;
  }
  const rootId = prefabPatch.rootNodeId(prefabUuid);
  const before = { componentCount: 0, components: [] };
  const plannedAfter = { componentCount: 1, components: [{
    componentClassName: 'cc.BlockInputEvents', componentIndex: 0,
    componentInstanceId: 'planned-component-id', serializedClassId: 'cc.BlockInputEvents',
  }] };
  const diff = [{ path: 'component.structure', before, after: plannedAfter }];
  const input = { prefabUuid, targetNodeUuid: rootId, targetNodePath: 'Root', action: 'apply', expectedDiff: diff };
  assert.equal(prefabPatch.validateDiff(diff), true);
  const preflight = invoke('prefabSourcePatchPreflight', input);
  assert.equal(preflight.available, true, JSON.stringify(preflight));
  const added = invoke('prefabSourcePatchMutate', input);
  assert.equal(added.available, true, JSON.stringify(added));
  assert.equal(root._components.length, 1);
  assert.equal(root._components[0]._id, 'planned-component-id');
  assert.equal(cc.engine.attachedObjsForEditor['planned-component-id'], root._components[0]);
  assert.equal(added.node.componentState.components[0].componentInstanceId, 'planned-component-id');

  const inverse = prefabPatch.invertDiff(diff);
  const compensate = { ...input, action: 'compensate', expectedDiff: inverse };
  assert.equal(invoke('prefabSourcePatchPreflight', compensate).available, true);
  root._components[0]._objFlags |= 4;
  const removed = invoke('prefabSourcePatchMutate', compensate);
  assert.equal(removed.available, true, JSON.stringify(removed));
  assert.deepEqual(root._components, []);
  assert.equal(cc.engine.attachedObjsForEditor['planned-component-id'], undefined);

  const customDiff = [{ path: 'component.structure', before,
    after: { componentCount: 1, components: [{ componentClassName: '5a61a838-87a2-4b9d-a9d0-2f3a6bd05112',
      registeredClassName: 'CliAcceptanceButtonState', componentIndex: 0,
      componentInstanceId: 'custom-script-component-id', serializedClassId: '5a61a838-87a2-4b9d-a9d0-2f3a6bd05112' }] } }];
  const customInput = { ...input, expectedDiff: customDiff };
  assert.equal(prefabPatch.validateDiff(customDiff), true);
  const customPreflight = invoke('prefabSourcePatchPreflight', customInput);
  assert.equal(customPreflight.available, true, JSON.stringify(customPreflight));
  const customAdded = invoke('prefabSourcePatchMutate', customInput);
  assert.equal(customAdded.available, true, JSON.stringify(customAdded));
  assert.equal(root._components[0].constructor, CliAcceptanceButtonState);
  assert.equal(root._components[0]._id, 'custom-script-component-id');
  assert.equal(customAdded.node.componentState.components[0].serializedClassId,
    '5a61a838-87a2-4b9d-a9d0-2f3a6bd05112');

  const customInverse = prefabPatch.invertDiff(customDiff);
  const customCompensate = { ...customInput, action: 'compensate', expectedDiff: customInverse };
  assert.equal(invoke('prefabSourcePatchPreflight', customCompensate).available, true);
  root._components[0]._objFlags |= 4;
  const customRemoved = invoke('prefabSourcePatchMutate', customCompensate);
  assert.equal(customRemoved.available, true, JSON.stringify(customRemoved));
  assert.deepEqual(root._components, []);
  assert.equal(cc.engine.attachedObjsForEditor['custom-script-component-id'], undefined);

  const existingBlock = root.addComponent(BlockInputEvents);
  existingBlock._id = 'existing-block-input-events';
  existingBlock.enabled = false;
  cc.engine.attachedObjsForEditor[existingBlock._id] = existingBlock;
  const blockBefore = { componentCount: 1, components: [{ componentClassName: 'cc.BlockInputEvents',
    componentIndex: 0, componentInstanceId: 'existing-block-input-events',
    serializedClassId: 'cc.BlockInputEvents', enabled: false, restoreProperties: [] }] };
  const blockDiff = [{ path: 'component.structure', before: blockBefore, after: { componentCount: 0, components: [] } }];
  const blockInput = { ...input, action: 'apply', expectedDiff: blockDiff };
  const blockPreflight = invoke('prefabSourcePatchPreflight', blockInput);
  assert.equal(blockPreflight.available, true, JSON.stringify(blockPreflight));
  const blockRemoved = invoke('prefabSourcePatchMutate', blockInput);
  assert.equal(blockRemoved.available, true, JSON.stringify(blockRemoved));
  assert.deepEqual(root._components, []);
  assert.equal(cc.engine.attachedObjsForEditor['existing-block-input-events'], undefined);

  const blockInverse = prefabPatch.invertDiff(blockDiff);
  const blockCompensate = { ...blockInput, action: 'compensate', expectedDiff: blockInverse };
  const blockRestorePreflight = invoke('prefabSourcePatchPreflight', blockCompensate);
  assert.equal(blockRestorePreflight.available, true, JSON.stringify(blockRestorePreflight));
  const blockRestored = invoke('prefabSourcePatchMutate', blockCompensate);
  assert.equal(blockRestored.available, true, JSON.stringify(blockRestored));
  assert.equal(root._components.length, 1);
  assert.equal(root._components[0].constructor, BlockInputEvents);
  assert.equal(root._components[0]._id, 'existing-block-input-events');
  assert.equal(root._components[0].enabled, false);
  assert.equal(cc.engine.attachedObjsForEditor['existing-block-input-events'], root._components[0]);

  const toggleGroup = root.addComponent(ToggleGroup);
  toggleGroup._id = 'existing-toggle-group';
  toggleGroup.allowSwitchOff = true;
  cc.engine.attachedObjsForEditor[toggleGroup._id] = toggleGroup;
  const toggleGroupBefore = { componentCount: 2, components: [
    { componentClassName: 'cc.BlockInputEvents', componentIndex: 0,
      componentInstanceId: 'existing-block-input-events', serializedClassId: 'cc.BlockInputEvents', enabled: false },
    { componentClassName: 'cc.ToggleGroup', componentIndex: 1, componentInstanceId: 'existing-toggle-group',
      serializedClassId: 'cc.ToggleGroup', enabled: true,
      restoreProperties: [{ property: 'allowSwitchOff', value: true, serializedProperty: 'allowSwitchOff' }] },
  ] };
  const toggleGroupDiff = [{ path: 'component.structure', before: toggleGroupBefore,
    after: { componentCount: 1, components: [toggleGroupBefore.components[0]] } }];
  const toggleGroupInput = { ...input, action: 'apply', expectedDiff: toggleGroupDiff };
  const toggleGroupPreflight = invoke('prefabSourcePatchPreflight', toggleGroupInput);
  assert.equal(toggleGroupPreflight.available, true, JSON.stringify(toggleGroupPreflight));
  assert.equal(invoke('prefabSourcePatchMutate', toggleGroupInput).available, true);
  assert.equal(root._components.length, 1);
  assert.equal(root._components[0].constructor, BlockInputEvents);
  const toggleGroupRestore = { ...toggleGroupInput, action: 'compensate',
    expectedDiff: prefabPatch.invertDiff(toggleGroupDiff) };
  const toggleGroupRestorePreflight = invoke('prefabSourcePatchPreflight', toggleGroupRestore);
  assert.equal(toggleGroupRestorePreflight.available, true, JSON.stringify(toggleGroupRestorePreflight));
  const toggleGroupRestored = invoke('prefabSourcePatchMutate', toggleGroupRestore);
  assert.equal(toggleGroupRestored.available, true, JSON.stringify(toggleGroupRestored));
  assert.equal(root._components.length, 2);
  assert.equal(root._components[1].constructor, ToggleGroup);
  assert.equal(root._components[1]._id, 'existing-toggle-group');
  assert.equal(root._components[1].allowSwitchOff, true);
  assert.equal(cc.engine.attachedObjsForEditor['existing-toggle-group'], root._components[1]);

  root._components[1].allowSwitchOff = false;
  const toggleGroupFalseBefore = { componentCount: 2, components: [
    { componentClassName: 'cc.BlockInputEvents', componentIndex: 0,
      componentInstanceId: 'existing-block-input-events', serializedClassId: 'cc.BlockInputEvents', enabled: false },
    { componentClassName: 'cc.ToggleGroup', componentIndex: 1, componentInstanceId: 'existing-toggle-group',
      serializedClassId: 'cc.ToggleGroup', enabled: true,
      restoreProperties: [{ property: 'allowSwitchOff', value: false, serializedProperty: 'allowSwitchOff' }] },
  ] };
  const toggleGroupFalseDiff = [{ path: 'component.structure', before: toggleGroupFalseBefore,
    after: { componentCount: 1, components: [toggleGroupFalseBefore.components[0]] } }];
  const toggleGroupFalseRemoval = { ...toggleGroupInput, expectedDiff: toggleGroupFalseDiff };
  assert.equal(invoke('prefabSourcePatchPreflight', toggleGroupFalseRemoval).available, true);
  assert.equal(invoke('prefabSourcePatchMutate', toggleGroupFalseRemoval).available, true);
  const toggleGroupFalseCompensation = { ...toggleGroupFalseRemoval, action: 'compensate',
    expectedDiff: prefabPatch.invertDiff(toggleGroupFalseDiff) };
  assert.equal(invoke('prefabSourcePatchPreflight', toggleGroupFalseCompensation).available, true);
  const toggleGroupFalseRestored = invoke('prefabSourcePatchMutate', toggleGroupFalseCompensation);
  assert.equal(toggleGroupFalseRestored.available, true, JSON.stringify(toggleGroupFalseRestored));
  assert.equal(root._components[1].constructor, ToggleGroup);
  assert.equal(root._components[1].allowSwitchOff, false);
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
