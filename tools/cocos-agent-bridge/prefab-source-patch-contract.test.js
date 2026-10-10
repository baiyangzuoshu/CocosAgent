'use strict';

const assert = require('assert');
const contract = require('./prefab-source-patch-contract');
const readback = require('./prefab-serialized-readback');

const prefabUuid = '9e1fb81b-6322-4c87-93e2-6b8a5d87a052';
const operationId = '7e1fb81b-6322-4c87-93e2-6b8a5d87a052';
const nodeUuid = 'node-root-01';
const sha256 = 'a'.repeat(64);
const diff = [{ path: 'node.active', before: true, after: false }];

const validApply = { prefabUuid, targetNodePath: 'Panel/Badge', targetNodeUuid: nodeUuid,
    expectedPrefabSha256: sha256, action: 'apply', expectedDiff: diff };
assert.equal(contract.validInput(validApply), true);
assert.equal(contract.validInput({ ...validApply, expectedPrefabSha256: undefined }), false);
assert.equal(contract.validInput({ ...validApply, expectedPrefabSha256: 'A'.repeat(64) }), false);
assert.equal(contract.validInput({ ...validApply, targetNodeUuid: '' }), false);
assert.equal(contract.validInput({ ...validApply, expectedDiff: [{ path: 'node.rotation.z', before: 0, after: 2 }] }), false);
assert.deepEqual(contract.invertDiff(diff), [{ path: 'node.active', before: false, after: true }]);
assert.equal(contract.validInput({ prefabUuid, targetNodePath: 'Panel/Badge', targetNodeUuid: nodeUuid,
    action: 'compensate', expectedDiff: contract.invertDiff(diff), sourceOperationId: operationId }), true);

const objects = [
    { __type__: 'cc.Prefab', data: { __id__: 1 } },
    { __type__: 'cc.Node', _name: 'Panel', _id: 'root-01', _children: [{ __id__: 2 }], _components: [], _trs: { array: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1] } },
    { __type__: 'cc.Node', _name: 'Badge', _id: nodeUuid, _parent: { __id__: 1 }, _children: [], _components: [], _active: false, _trs: { array: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1] } },
];
const target = readback.resolveNode(objects, 'Panel/Badge', nodeUuid);
assert.ok(target);
assert.equal(readback.matchesDiff(objects, target, diff, 'after'), true);
assert.equal(readback.resolveNode(objects, 'Panel/Badge', 'other-node'), null);
assert.equal(readback.resolveNode(objects, 'Panel/Other', nodeUuid), null);
assert.equal(readback.pathIndex([{ ...objects[0], data: { __id__: 99 } }, ...objects.slice(1)]), null);
const brokenParent = objects.map((item) => ({ ...item }));
brokenParent[2] = { ...brokenParent[2], _parent: { __id__: 0 } };
assert.equal(readback.pathIndex(brokenParent), null);
const orphanNode = objects.concat([{ __type__: 'cc.Node', _name: 'Orphan', _id: 'orphan-01', _children: [], _components: [] }]);
assert.equal(readback.pathIndex(orphanNode), null);
const sharedComponent = objects.map((item) => ({ ...item }));
sharedComponent[2] = { ...sharedComponent[2], _components: [{ __id__: 3 }] };
assert.equal(readback.pathIndex(sharedComponent), null);
process.stdout.write('prefab source patch input, inverse diff, node identity, and serialized relationship checks passed\n');
