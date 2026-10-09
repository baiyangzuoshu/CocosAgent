'use strict';

const assert = require('assert');
const fs = require('fs');
const contract = require('./scene-patch-contract');
const serializedReadback = require('./scene-serialized-readback');
const sceneObjects = JSON.parse(fs.readFileSync(require('path').join(__dirname, '../../2.4.15NewProject/assets/Scene/helloworld.fire'), 'utf8'));

const uuidA = '11111111-1111-4111-8111-111111111111';
const uuidB = '22222222-2222-4222-8222-222222222222';
const before = { status: 'found', name: 'Button', active: true,
    transform: { position: { x: 0, y: 1 }, scale: { x: 1, y: 1 } },
    componentDetails: [{ classId: 'cc.Sprite', enabled: true, spriteFrameUuid: uuidA }] };
const diff = [
    { path: 'node.position.x', before: 0, after: 12 },
    { path: 'component.cc.Sprite.spriteFrameUuid', before: uuidA, after: uuidB },
];

assert.equal(contract.validateDiff(diff), true);
assert.equal(contract.matchesDiff(before, diff, 'before'), true);
const after = { ...before, transform: { ...before.transform, position: { x: 12, y: 1 } },
    componentDetails: [{ classId: 'cc.Sprite', enabled: true, spriteFrameUuid: uuidB }] };
assert.equal(contract.matchesDiff(after, diff, 'after'), true);
assert.deepEqual(contract.invertDiff(diff), [
    { path: 'node.position.x', before: 12, after: 0 },
    { path: 'component.cc.Sprite.spriteFrameUuid', before: uuidB, after: uuidA },
]);
for (const invalid of [
    [{ path: 'node.rotation.z', before: 0, after: 1 }],
    [{ path: 'node.position.x', before: 0, after: 1 }, { path: 'node.position.x', before: 1, after: 2 }],
    [{ path: 'component.cc.Sprite.spriteFrameUuid', before: uuidA, after: 'not-a-uuid' }],
    [{ path: 'node.position.x', before: 0, after: 5000 }],
    [{ path: 'node.name', before: 'A', after: 'A' }],
    [{ path: 'node.active', before: true, after: 'false' }],
    [{ path: 'component.cc.Label.string', before: 'Label', after: 'Changed' }],
]) assert.equal(contract.validateDiff(invalid), false);
assert.equal(contract.valueAt({ ...before, componentDetails: [{ classId: 'cc.Sprite' }, { classId: 'cc.Sprite' }] }, 'component.cc.Sprite.enabled').ambiguous, true);
assert.equal(contract.NODE_ID.test('4dchSq5ANGt5UhctfBHvoJ'), true);
assert.equal(contract.NODE_ID.test('not/a node id'), false);
const renameDiff = [{ path: 'node.name', before: 'Button', after: 'Renamed' }];
assert.equal(contract.targetPathAt('helloworld/Canvas/Button', renameDiff, 'before'), 'helloworld/Canvas/Button');
assert.equal(contract.targetPathAt('helloworld/Canvas/Button', contract.invertDiff(renameDiff), 'before'), 'helloworld/Canvas/Renamed');
assert.equal(contract.targetPathAt('helloworld/Canvas/Button', contract.invertDiff(contract.invertDiff(renameDiff)), 'before'), 'helloworld/Canvas/Button');
const canvas = serializedReadback.resolveSerializedNode(sceneObjects, 'helloworld', 'helloworld/Canvas', [], 'before');
assert.equal(canvas.index, 2);
assert.equal(serializedReadback.serializedValue(sceneObjects, canvas, 'node.position.x').value, 480);
const renamed = serializedReadback.resolveSerializedNode(sceneObjects, 'helloworld', 'helloworld/Canvas/label',
    [{ path: 'node.name', before: 'label', after: 'score' }], 'after');
assert.equal(renamed, null);
const sprite = serializedReadback.resolveSerializedNode(sceneObjects, 'helloworld', 'helloworld/Canvas/background', [], 'before');
assert.equal(serializedReadback.serializedValue(sceneObjects, sprite, 'component.cc.Sprite.spriteFrameUuid').value,
    '410fb916-8721-4663-bab8-34397391ace7');
const labelNode = sceneObjects.findIndex((item) => item && item.__type__ === 'cc.Node' && item._name === 'label');
const afterRenameFixture = sceneObjects.map((item, index) => index === labelNode ? { ...item, _name: 'score' } : item);
const renamedReadback = serializedReadback.resolveSerializedNode(afterRenameFixture, 'helloworld', 'helloworld/Canvas/label',
    [{ path: 'node.name', before: 'label', after: 'score' }], 'after');
assert.equal(renamedReadback.object._name, 'score');
process.stdout.write('scene patch diff contract and compensation checks passed\n');
