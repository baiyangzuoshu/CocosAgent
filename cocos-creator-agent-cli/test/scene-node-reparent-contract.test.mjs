import assert from 'node:assert/strict';
import test from 'node:test';
import { COMMANDS, validateCommand } from '../bridge/contracts.mjs';

const sceneUuid = '11111111-1111-4111-8111-111111111111';
const nodeUuid = '22222222-2222-4222-8222-222222222222';
const parentUuid = '33333333-3333-4333-8333-333333333333';

test('scene node reparent is plan, explicit commit write, reconcile and rejects malformed targets', () => {
  const plan = COMMANDS.get('creator.scene.node.reparent.plan');
  const commit = COMMANDS.get('creator.scene.node.reparent.commit');
  const reconcile = COMMANDS.get('creator.scene.node.reparent.reconcile');
  assert.ok(plan);
  assert.ok(commit);
  assert.ok(reconcile);
  assert.equal(plan.access, 'plan');
  assert.equal(commit.access, 'write');
  assert.equal(commit.approval, true);
  assert.equal(reconcile.access, 'plan');
  assert.equal(validateCommand(plan.id, { sceneUuid, nodeUuid, targetParentUuid: parentUuid }).ok, true);
  assert.equal(validateCommand(plan.id, { sceneUuid, nodeUuid, targetParentUuid: '../outside' }).code, 'INVALID_INPUT_FIELD');
  assert.equal(validateCommand(plan.id, { sceneUuid, nodeUuid, targetParentUuid: parentUuid, newName: 'unexpected' }).code,
    'UNKNOWN_INPUT_FIELD');
  assert.equal(validateCommand(commit.id, { operationId: nodeUuid, planHash: 'a'.repeat(64) }).ok, true);
  assert.equal(validateCommand(reconcile.id, { operationId: nodeUuid }).ok, true);
});
