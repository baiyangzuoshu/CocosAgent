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

test('component-property contract accepts bounded scalars and typed Creator property descriptors', () => {
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
  for (const value of [
    { kind: 'vec2', x: 1, y: 2 },
    { kind: 'vec3', x: 1, y: 2, z: 3 },
    { kind: 'size', width: 64, height: 32 },
    { kind: 'color', r: 1, g: 2, b: 3, a: 255 },
    { kind: 'array', items: [1, 'two', false] },
    { kind: 'asset', assetClass: 'SpriteFrame' },
    { kind: 'asset', assetClass: 'SpriteFrame', assetUuid: '44444444-4444-4444-8444-444444444444' },
  ]) assert.equal(validateCommand(plan.id, { ...input, value }).ok, true, JSON.stringify(value));
  assert.equal(validateCommand(plan.id, { ...input, value: { text: 'bad' } }).code, 'INVALID_INPUT_FIELD');
  assert.equal(validateCommand(plan.id, { ...input, value: { kind: 'vec2', x: 1 } }).ok, false);
  assert.equal(validateCommand(plan.id, { ...input, value: { kind: 'vec2', x: 1, y: 2, z: 3 } }).ok, false);
  assert.equal(validateCommand(plan.id, { ...input, value: { kind: 'array', items: Array(33).fill(0) } }).ok, false);
  assert.equal(validateCommand(plan.id, { ...input, value: { kind: 'asset', assetClass: 'SpriteFrame',
    assetUuid: 'not-a-uuid' } }).ok, false);
  assert.equal(validateCommand(plan.id, { ...input, property: '_name' }).code, 'INVALID_INPUT_FIELD');
  assert.equal(validateCommand(plan.id, { ...input, value: 'x'.repeat(1025) }).code, 'INVALID_INPUT_FIELD');
  assert.equal(validateCommand(commit.id, { operationId: nodeUuid, planHash: 'c'.repeat(64) }).ok, true);
  assert.equal(validateCommand(reconcile.id, { operationId: nodeUuid }).ok, true);
});

test('scene deletion and component removal use exact plan, approved commit, and non-replaying reconcile contracts', () => {
  const nodePlan = COMMANDS.get('creator.scene.node.delete.plan');
  const nodeCommit = COMMANDS.get('creator.scene.node.delete.commit');
  const nodeReconcile = COMMANDS.get('creator.scene.node.delete.reconcile');
  const componentPlan = COMMANDS.get('creator.scene.node.remove-component.plan');
  const componentCommit = COMMANDS.get('creator.scene.node.remove-component.commit');
  const componentReconcile = COMMANDS.get('creator.scene.node.remove-component.reconcile');
  for (const command of [nodePlan, nodeCommit, nodeReconcile, componentPlan, componentCommit, componentReconcile])
    assert.ok(command);
  for (const command of [nodePlan, componentPlan, nodeReconcile, componentReconcile]) assert.equal(command.access, 'plan');
  for (const command of [nodeCommit, componentCommit]) {
    assert.equal(command.access, 'write');
    assert.equal(command.approval, true);
  }
  assert.equal(validateCommand(nodePlan.id, { sceneUuid, nodeUuid }).ok, true);
  assert.equal(validateCommand(nodePlan.id, { sceneUuid, nodeUuid, recursive: false }).code, 'UNKNOWN_INPUT_FIELD');
  assert.equal(validateCommand(componentPlan.id, { sceneUuid, nodeUuid, componentClassName: 'cc.Sprite',
    componentInstanceId: 'component-123' }).ok, true);
  assert.equal(validateCommand(componentPlan.id, { sceneUuid, nodeUuid, componentClassName: '../Sprite',
    componentInstanceId: 'component-123' }).ok, false);
  assert.equal(validateCommand(nodeCommit.id, { operationId: nodeUuid, planHash: 'a'.repeat(64) }).ok, true);
  assert.equal(validateCommand(componentCommit.id, { operationId: nodeUuid, planHash: 'a'.repeat(64) }).ok, true);
  assert.equal(validateCommand(nodeReconcile.id, { operationId: nodeUuid }).ok, true);
  assert.equal(validateCommand(componentReconcile.id, { operationId: nodeUuid }).ok, true);
});

test('scene composition contract bounds node, component, asset-reference, and click-handler input', () => {
  const plan = COMMANDS.get('creator.scene.compose.plan');
  const commit = COMMANDS.get('creator.scene.compose.commit');
  const reconcile = COMMANDS.get('creator.scene.compose.reconcile');
  assert.ok(plan);
  assert.equal(plan.access, 'plan');
  assert.equal(commit.access, 'write');
  assert.equal(commit.approval, true);
  assert.equal(reconcile.access, 'plan');
  const input = { sceneUuid,
    nodes: [{ id: 'button', name: 'StartButton',
      parentRef: `uuid:${nodeUuid}`, transform: { x: 10, y: 20, width: 180, height: 64 } }],
    components: [{ id: 'sprite', nodeRef: 'new:button', className: 'cc.Sprite', properties: [
      { name: 'spriteFrame', value: { assetUuid: '44444444-4444-4444-8444-444444444444', assetClass: 'SpriteFrame' } },
    ] }],
    buttonEvents: [{ buttonRef: 'new:button', handlerRef: 'new:button', handlerComponentClassName: 'example.ButtonState',
      handler: 'onClick', customEventData: 'toggle' }],
  };
  assert.equal(validateCommand(plan.id, input).ok, true);
  assert.equal(validateCommand(plan.id, { ...input, components: [{ ...input.components[0], properties: [
    { name: 'spriteFrame', value: { assetUuid: '44444444-4444-4444-8444-444444444444', assetClass: 'SpriteFrame', url: 'db://unsafe' } },
  ] }] }).code, 'UNKNOWN_INPUT_FIELD');
  assert.equal(validateCommand(plan.id, { ...input, nodes: [{ ...input.nodes[0], transform: { x: Infinity } }] }).ok, false);
  assert.equal(validateCommand(commit.id, { operationId: nodeUuid, planHash: 'd'.repeat(64) }).ok, true);
  assert.equal(validateCommand(reconcile.id, { operationId: nodeUuid }).ok, true);
});
