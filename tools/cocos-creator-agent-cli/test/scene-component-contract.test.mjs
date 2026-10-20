import assert from 'node:assert/strict';
import test from 'node:test';
import { COMMANDS, validateCommand } from '../bridge/contracts.mjs';

const sceneUuid = '11111111-1111-4111-8111-111111111111';
const nodeUuid = '22222222-2222-4222-8222-222222222222';

test('component-add command contract is plan/approved-write/reconcile and rejects unsafe input', () => {
  const plan = COMMANDS.get('creator.scene.node.add-component.plan');
  const commit = COMMANDS.get('creator.scene.node.add-component.commit');
  const reconcile = COMMANDS.get('creator.scene.node.add-component.reconcile');
  assert.ok(plan);
  assert.ok(commit);
  assert.ok(reconcile);
  assert.equal(plan.access, 'plan');
  assert.equal(commit.access, 'write');
  assert.equal(commit.approval, true);
  assert.equal(reconcile.access, 'plan');
  assert.equal(COMMANDS.size, 30);

  assert.equal(validateCommand(plan.id, { sceneUuid, nodeUuid, componentClassName: 'cc.Sprite' }).ok, true);
  assert.equal(validateCommand(plan.id, { sceneUuid, nodeUuid, componentClassName: '../Sprite' }).code, 'INVALID_INPUT_FIELD');
  assert.equal(validateCommand(plan.id, { sceneUuid, nodeUuid, componentClassName: 'cc.Sprite', source: 'unexpected' }).code,
    'UNKNOWN_INPUT_FIELD');
  assert.equal(validateCommand(commit.id, { operationId: nodeUuid, planHash: 'a'.repeat(64) }).ok, true);
  assert.equal(validateCommand(commit.id, { operationId: nodeUuid, planHash: 'a'.repeat(63) }).code, 'INVALID_INPUT_FIELD');
  assert.equal(validateCommand(reconcile.id, { operationId: nodeUuid }).ok, true);
});

test('component-property contract accepts only primitive values with required operation identity', () => {
  const plan = COMMANDS.get('creator.scene.node.set-component-property.plan');
  const commit = COMMANDS.get('creator.scene.node.set-component-property.commit');
  const reconcile = COMMANDS.get('creator.scene.node.set-component-property.reconcile');
  assert.ok(plan);
  assert.ok(commit);
  assert.ok(reconcile);
  assert.equal(plan.access, 'plan');
  assert.equal(commit.access, 'write');
  assert.equal(commit.approval, true);
  assert.equal(reconcile.access, 'plan');

  const input = { sceneUuid, nodeUuid, componentClassName: 'cc.Label', componentInstanceId: 'component-1',
    property: 'string', value: 'Ready' };
  assert.equal(validateCommand(plan.id, input).ok, true);
  assert.equal(validateCommand(plan.id, { ...input, value: { text: 'bad' } }).code, 'INVALID_INPUT_FIELD');
  assert.equal(validateCommand(plan.id, { ...input, property: '_name' }).code, 'INVALID_INPUT_FIELD');
  assert.equal(validateCommand(plan.id, { ...input, value: 'x'.repeat(1025) }).code, 'INVALID_INPUT_FIELD');
  assert.equal(validateCommand(commit.id, { operationId: nodeUuid, planHash: 'c'.repeat(64) }).ok, true);
  assert.equal(validateCommand(reconcile.id, { operationId: nodeUuid }).ok, true);
});
