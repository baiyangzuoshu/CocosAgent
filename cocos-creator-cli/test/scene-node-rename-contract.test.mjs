import assert from 'node:assert/strict';
import test from 'node:test';
import { COMMANDS, validateCommand } from '../bridge/contracts.mjs';

const sceneUuid = '11111111-1111-4111-8111-111111111111';
const nodeUuid = '22222222-2222-4222-8222-222222222222';

test('scene node rename is an exact plan, explicit commit write, and read-only reconcile contract', () => {
  const plan = COMMANDS.get('creator.scene.node.rename.plan');
  const commit = COMMANDS.get('creator.scene.node.rename.commit');
  const reconcile = COMMANDS.get('creator.scene.node.rename.reconcile');
  assert.ok(plan);
  assert.ok(commit);
  assert.ok(reconcile);
  assert.equal(plan.access, 'plan');
  assert.equal(commit.access, 'write');
  assert.equal(commit.approval, true);
  assert.equal(reconcile.access, 'plan');
  assert.equal(validateCommand(plan.id, { sceneUuid, nodeUuid, newName: 'StartButton' }).ok, true);
  assert.equal(validateCommand(plan.id, { sceneUuid, nodeUuid, newName: '../outside' }).ok, false);
  assert.equal(validateCommand(plan.id, { sceneUuid, nodeUuid, newName: 'valid', path: '/tmp/x' }).code, 'UNKNOWN_INPUT_FIELD');
  assert.equal(validateCommand(commit.id, { operationId: nodeUuid, planHash: 'a'.repeat(64) }).ok, true);
  assert.equal(validateCommand(reconcile.id, { operationId: nodeUuid }).ok, true);
});
