import test from 'node:test';
import assert from 'node:assert/strict';
import prefabPatch from '../creator-extension/prefab-patch.cjs';
import prefabSource from '../creator-extension/prefab-source.cjs';
import { validateCommand } from '../bridge/contracts.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

test('Prefab source patch commands declare plan, approved write, and non-replaying reconciliation contracts', () => {
  const plan = command('creator.prefab.source.patch.plan');
  const commit = command('creator.prefab.source.patch.commit');
  const reconcile = command('creator.prefab.source.patch.reconcile');
  const input = { prefabUuid, targetNodePath: 'Root/Sprite', targetNodeUuid: nodeUuid, action: 'apply',
    expectedSourceSha256: sourceHash, expectedDiff: [{ path: 'node.active', before: true, after: false }] };
  assert.equal(plan.access, 'plan');
  assert.equal(validateCommand(plan.id, input).ok, true);
  assert.equal(validateCommand(plan.id, { ...input,
    expectedDiff: [{ path: 'component.cc.Sprite.spriteFrameUuid', before: null, after: prefabUuid }] }).ok, true);
  assert.equal(validateCommand(plan.id, { ...input, expectedDiff: [{ path: 'node.position.z', before: 0, after: 1 }] }).ok, false);
  assert.equal(commit.access, 'write');
  assert.equal(commit.approval, true);
  assert.equal(validateCommand(commit.id, { operationId: inverseOperationId, planHash: sourceHash }).ok, true);
  assert.equal(reconcile.access, 'plan');
  assert.equal(validateCommand(reconcile.id, { operationId: inverseOperationId }).ok, true);
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
