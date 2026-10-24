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

test('UI inspection is a bounded read command bound to one exact scene node', () => {
  const inspect = COMMANDS.get('creator.scene.ui.inspect');
  assert.ok(inspect);
  assert.equal(inspect.access, 'read');
  assert.equal(validateCommand(inspect.id, { sceneUuid, nodeUuid }).ok, true);
  assert.equal(validateCommand(inspect.id, { sceneUuid, nodeUuid, componentClassName: 'cc.Button' }).code,
    'UNKNOWN_INPUT_FIELD');
  assert.equal(validateCommand(inspect.id, { sceneUuid, nodeUuid: '../outside' }).ok, false);
});

test('existing node transform commands use a bounded field schema and approved reconcile lifecycle', () => {
  const plan = COMMANDS.get('creator.scene.node.set-transform.plan');
  const commit = COMMANDS.get('creator.scene.node.set-transform.commit');
  const reconcile = COMMANDS.get('creator.scene.node.set-transform.reconcile');
  assert.ok(plan);
  assert.ok(commit);
  assert.ok(reconcile);
  assert.equal(plan.access, 'plan');
  assert.equal(commit.access, 'write');
  assert.equal(commit.approval, true);
  assert.equal(reconcile.access, 'plan');
  assert.equal(validateCommand(plan.id, { sceneUuid, nodeUuid, values: { x: 12, y: -4, angle: 90, width: 300 } }).ok, true);
  assert.equal(validateCommand(plan.id, { sceneUuid, nodeUuid, values: {} }).ok, false);
  assert.equal(validateCommand(plan.id, { sceneUuid, nodeUuid, values: { pivot: 0 } }).code, 'UNKNOWN_INPUT_FIELD');
  assert.equal(validateCommand(plan.id, { sceneUuid, nodeUuid, values: { x: 1000001 } }).ok, false);
  assert.equal(validateCommand(plan.id, { sceneUuid, nodeUuid, values: { width: -1 } }).ok, false);
  assert.equal(validateCommand(commit.id, { operationId: nodeUuid, planHash: 'a'.repeat(64) }).ok, true);
  assert.equal(validateCommand(reconcile.id, { operationId: nodeUuid }).ok, true);
});

test('existing Button event commands use a bounded event list and approved reconcile lifecycle', () => {
  const plan = COMMANDS.get('creator.scene.button-events.set.plan');
  const commit = COMMANDS.get('creator.scene.button-events.set.commit');
  const reconcile = COMMANDS.get('creator.scene.button-events.set.reconcile');
  const input = { sceneUuid, nodeUuid, componentInstanceId: 'button-component', events: [
    { targetUuid: nodeUuid, component: 'game.Controller', handler: 'onClick', customEventData: 'select' },
  ] };
  assert.ok(plan);
  assert.ok(commit);
  assert.ok(reconcile);
  assert.equal(plan.access, 'plan');
  assert.equal(commit.access, 'write');
  assert.equal(commit.approval, true);
  assert.equal(reconcile.access, 'plan');
  assert.equal(validateCommand(plan.id, input).ok, true);
  assert.equal(validateCommand(plan.id, { ...input, events: Array(13).fill(input.events[0]) }).ok, false);
  assert.equal(validateCommand(plan.id, { ...input, events: [{ ...input.events[0], targetUuid: '../outside' }] }).ok, false);
  assert.equal(validateCommand(plan.id, { ...input, events: [{ ...input.events[0], handler: 'bad()' }] }).ok, false);
  assert.equal(validateCommand(commit.id, { operationId: nodeUuid, planHash: 'a'.repeat(64) }).ok, true);
  assert.equal(validateCommand(reconcile.id, { operationId: nodeUuid }).ok, true);
});

test('generic UI event commands constrain supported component-property pairs and transaction lifecycle', () => {
  const plan = COMMANDS.get('creator.scene.ui-events.set.plan');
  const commit = COMMANDS.get('creator.scene.ui-events.set.commit');
  const reconcile = COMMANDS.get('creator.scene.ui-events.set.reconcile');
  const input = { sceneUuid, nodeUuid, componentClassName: 'cc.Toggle', eventProperty: 'checkEvents',
    componentInstanceId: 'toggle-component', events: [{ targetUuid: nodeUuid,
      component: 'game.Controller', handler: 'onToggle', customEventData: 'checked' }] };
  assert.ok(plan);
  assert.ok(commit);
  assert.ok(reconcile);
  assert.equal(plan.access, 'plan');
  assert.equal(commit.access, 'write');
  assert.equal(commit.approval, true);
  assert.equal(reconcile.access, 'plan');
  assert.equal(validateCommand(plan.id, input).ok, true);
  assert.equal(validateCommand(plan.id, { ...input, componentClassName: 'cc.Toggle', eventProperty: 'clickEvents' }).ok, true);
  assert.equal(validateCommand(plan.id, { ...input, componentClassName: 'cc.PageView', eventProperty: 'scrollEvents' }).ok, true);
  assert.equal(validateCommand(plan.id, { ...input, componentClassName: 'cc.Sprite' }).ok, false);
  assert.equal(validateCommand(plan.id, { ...input, eventProperty: 'notAnEvent' }).ok, false);
  assert.equal(validateCommand(plan.id, { ...input, events: Array(13).fill(input.events[0]) }).ok, false);
  assert.equal(validateCommand(commit.id, { operationId: nodeUuid, planHash: 'a'.repeat(64) }).ok, true);
  assert.equal(validateCommand(reconcile.id, { operationId: nodeUuid }).ok, true);
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
  assert.equal(validateCommand(plan.id, { sceneUuid, nodeUuid, componentClassName: 'cc.Label' }).ok, true);
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
    { kind: 'vec4', x: 1, y: 2, z: 3, w: 4 },
    { kind: 'size', width: 64, height: 32 },
    { kind: 'rect', x: 1, y: 2, width: 64, height: 32 },
    { kind: 'color', r: 1, g: 2, b: 3, a: 255 },
    { kind: 'array', items: [1, 'two', false] },
    { kind: 'array', items: [{ kind: 'vec2', x: 1, y: 2 }, { kind: 'vec2', x: 3, y: 4 }] },
    { kind: 'array', items: [{ kind: 'node-ref', nodeUuid }, { kind: 'node-ref' }] },
    { kind: 'array', items: [{ kind: 'asset', assetClass: 'SpriteFrame', assetUuid: nodeUuid }] },
    { kind: 'node-ref', nodeUuid },
    { kind: 'node-ref' },
    { kind: 'component-ref', componentClassName: 'game.Controller' },
    { kind: 'component-ref', componentClassName: 'game.Controller', nodeUuid,
      componentInstanceId: 'component-1' },
    { kind: 'asset', assetClass: 'SpriteFrame' },
    { kind: 'asset', assetClass: 'Font' },
    { kind: 'asset', assetClass: 'SpriteFrame', assetUuid: '44444444-4444-4444-8444-444444444444' },
  ]) assert.equal(validateCommand(plan.id, { ...input, value }).ok, true, JSON.stringify(value));
  assert.equal(validateCommand(plan.id, { ...input, value: { text: 'bad' } }).code, 'INVALID_INPUT_FIELD');
  assert.equal(validateCommand(plan.id, { ...input, value: { kind: 'vec2', x: 1 } }).ok, false);
  assert.equal(validateCommand(plan.id, { ...input, value: { kind: 'vec2', x: 1, y: 2, z: 3 } }).ok, false);
  assert.equal(validateCommand(plan.id, { ...input, value: { kind: 'array', items: Array(33).fill(0) } }).ok, false);
  assert.equal(validateCommand(plan.id, { ...input, value: { kind: 'array', items: [{ kind: 'node-ref', nodeUuid: '../outside' }] } }).ok, false);
  assert.equal(validateCommand(plan.id, { ...input, value: { kind: 'array', items: [
    { kind: 'component-ref', componentClassName: 'game.Controller', nodeUuid },
  ] } }).ok, false);
  assert.equal(validateCommand(plan.id, { ...input, value: { kind: 'array', items: [
    { kind: 'asset', assetClass: 'SpriteFrame', assetUuid: 'not-a-uuid' },
  ] } }).ok, false);
  assert.equal(validateCommand(plan.id, { ...input, value: { kind: 'component-ref', componentClassName: '../Component' } }).ok, false);
  assert.equal(validateCommand(plan.id, { ...input, value: { kind: 'asset', assetClass: 'SpriteFrame',
    assetUuid: 'not-a-uuid' } }).ok, false);
  assert.equal(validateCommand(plan.id, { ...input, property: '_name' }).code, 'INVALID_INPUT_FIELD');
  assert.equal(validateCommand(plan.id, { ...input, value: 'x'.repeat(1025) }).code, 'INVALID_INPUT_FIELD');
  assert.equal(validateCommand(commit.id, { operationId: nodeUuid, planHash: 'c'.repeat(64) }).ok, true);
  assert.equal(validateCommand(reconcile.id, { operationId: nodeUuid }).ok, true);
});

test('component-property compensation is source-linked and accepts no caller-selected value', () => {
  const plan = COMMANDS.get('creator.scene.node.set-component-property.compensate.plan');
  const commit = COMMANDS.get('creator.scene.node.set-component-property.compensate.commit');
  const reconcile = COMMANDS.get('creator.scene.node.set-component-property.compensate.reconcile');
  assert.ok(plan);
  assert.ok(commit);
  assert.ok(reconcile);
  assert.equal(plan.access, 'plan');
  assert.equal(commit.access, 'write');
  assert.equal(commit.approval, true);
  assert.equal(reconcile.access, 'plan');
  assert.equal(validateCommand(plan.id, { sourceOperationId: nodeUuid }).ok, true);
  assert.equal(validateCommand(plan.id, { sourceOperationId: nodeUuid, value: 0.25 }).code, 'UNKNOWN_INPUT_FIELD');
  assert.equal(validateCommand(plan.id, { sourceOperationId: '../outside' }).ok, false);
  assert.equal(validateCommand(commit.id, { operationId: nodeUuid, planHash: 'a'.repeat(64) }).ok, true);
  assert.equal(validateCommand(reconcile.id, { operationId: nodeUuid }).ok, true);
});

test('scene deletion and component removal use exact plans, explicit commits, and non-replaying reconcile contracts', () => {
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
