'use strict';

const assert = require('node:assert/strict');
const { expectedDiffFor, prefabRootName } = require('./scene-node-create-contract');

const common = { parentPath: 'helloworld/Canvas', parentUuid: 'parent-id', nodeName: 'GeneratedSprite',
    components: [{ classId: 'cc.Sprite', spriteFrameUuid: 'sprite-frame-uuid' }],
    transform: { position: { x: 1000, y: 1000 } } };

const created = expectedDiffFor({ ...common, action: 'apply', prefabMode: 'create',
    prefabUrl: 'db://assets/CocosAgentPrefab_11111111-1111-4111-8111-111111111111.prefab' });
assert.deepEqual(created.node.before, { exists: false });
assert.equal(created.node.after.prefabUuid, '$assetdb-generated');
assert.deepEqual(created.prefabAsset.before, { exists: false });
assert.deepEqual(created.prefabAsset.after, { exists: true, uuid: '$assetdb-generated' });
assert.equal(prefabRootName({ prefabMode: 'create', prefabUrl: created.prefabAsset.url }),
    'CocosAgentPrefab_11111111-1111-4111-8111-111111111111');
assert.equal(prefabRootName({ prefabMode: 'create', prefabUrl: 'db://assets/unowned.prefab' }), null);

const instanced = expectedDiffFor({ ...common, action: 'apply', prefabMode: 'instantiate',
    prefabUuid: '22222222-2222-4222-8222-222222222222' });
assert.equal(instanced.node.after.prefabUuid, '22222222-2222-4222-8222-222222222222');
assert.equal(Object.hasOwn(instanced, 'prefabAsset'), false);

const compensated = expectedDiffFor({ ...common, action: 'compensate', prefabMode: 'create',
    prefabUuid: '33333333-3333-4333-8333-333333333333',
    prefabUrl: 'db://assets/CocosAgentPrefab_44444444-4444-4444-8444-444444444444.prefab' });
assert.equal(compensated.node.before.prefabUuid, '33333333-3333-4333-8333-333333333333');
assert.deepEqual(compensated.node.after, { exists: false });
assert.deepEqual(compensated.prefabAsset.before, { exists: true, uuid: '33333333-3333-4333-8333-333333333333' });
assert.deepEqual(compensated.prefabAsset.after, { exists: false });

process.stdout.write('node create expected diffs cover prefab create, instantiate, and compensation identities\n');
