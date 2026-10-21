import assert from 'node:assert/strict';
import test from 'node:test';
import { COMMANDS, validateCommand } from '../bridge/contracts.mjs';

const sceneUuid = '11111111-1111-4111-8111-111111111111';
const nodeUuid = '22222222-2222-4222-8222-222222222222';

test('scene contracts accept real Creator compact object UUIDs without accepting arbitrary IDs', () => {
  const input = { sceneUuid: 'a0XObHorNAbIr2hxhGwXCb', nodeUuid: 'fajmfI4k5PkbS2JhUsJP0d', active: false };
  assert.equal(validateCommand('creator.scene.node.set-active.plan', input).ok, true);
  assert.equal(validateCommand('creator.scene.node.set-active.plan', { ...input, nodeUuid: '../arbitrary-path' }).ok, false);
  assert.equal(validateCommand('creator.scene.node.read', { sceneUuid, nodeUuid }).ok, true);
  assert.equal(validateCommand('creator.scene.node.set-active.commit', { operationId: input.nodeUuid, planHash: 'a'.repeat(64) }).ok, false);
});

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
  assert.ok(COMMANDS.has('creator.script.modify.plan'));
  assert.ok(COMMANDS.has('creator.script.modify.commit'));
  assert.ok(COMMANDS.has('creator.script.modify.reconcile'));

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
