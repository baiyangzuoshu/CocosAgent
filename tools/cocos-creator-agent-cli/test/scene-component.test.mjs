import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sceneSource = fs.readFileSync(path.join(packageRoot, 'creator-extension/scene.js'), 'utf8');

function fixture() {
  class Component { destroy() { this.destroyed = true; } }
  Component.__props__ = ['enabled'];
  let nodeSequence = 0;
  class FakeNode {
    constructor(name) {
      this.name = name || 'New Node'; this._id = `new-node-${++nodeSequence}`; this.active = true;
      this.children = []; this._components = []; this.parent = null; this._objFlags = 0;
      this.x = 0; this.y = 0; this.scaleX = 1; this.scaleY = 1; this.angle = 0; this.width = 0; this.height = 0;
    }
    get uuid() { return this._id; }
    getComponents(type) { return this._components.filter((component) => component instanceof type); }
    getComponent(type) { return this.getComponents(type)[0] || null; }
    addComponent(type) {
      const component = new type(); component.node = this; component._id = `component-${++nodeSequence}`;
      this._components.push(component); return component;
    }
    addChild(child) { child.parent = this; this.children.push(child); }
    removeChild(child) { const index = this.children.indexOf(child); if (index >= 0) this.children.splice(index, 1); child.parent = null; }
    setPosition(x, y, z = 0) { this.x = x; this.y = y; this.z = z; }
    getPosition() { return { x: this.x, y: this.y, z: this.z || 0 }; }
    setContentSize(width, height) { this.width = typeof width === 'object' ? width.width : width; this.height = typeof width === 'object' ? width.height : height; }
    destroy() { this.destroyed = true; }
  }
  class BaseSprite extends Component {}
  BaseSprite.__props__ = ['enabled', 'inheritedValue'];
  class Vec2 { constructor(x = 0, y = 0) { this.x = x; this.y = y; } }
  class Vec3 { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } }
  class Size { constructor(width = 0, height = 0) { this.width = width; this.height = height; } }
  class Color { constructor(r = 0, g = 0, b = 0, a = 255) { this.r = r; this.g = g; this.b = b; this.a = a; } }
  class Sprite extends BaseSprite {
    constructor() {
      super();
      this._id = 'component-1';
      this.mode = 0;
      this.labelText = 'before';
      this.enabled = true;
      this.inheritedValue = 'parent';
      this._privateValue = 10;
      this.vector = { x: 0 };
      this.spriteFrame = null;
      this.position = new Vec2(1, 2);
      this.direction = new Vec3(1, 2, 3);
      this.size = new Size(10, 20);
      this.tint = new Color(1, 2, 3, 255);
      this.thresholds = [1, 'low'];
    }
  }
  Sprite.prototype.__classname__ = 'cc.Sprite';
  Sprite.$super = BaseSprite;
  Sprite.__props__ = ['mode', 'labelText', 'enabled', 'inheritedValue', '_privateValue', 'vector', 'spriteFrame',
    'position', 'direction', 'size', 'tint', 'thresholds'];
  class SpriteFrame { constructor(uuid = 'sprite-frame') { this._uuid = uuid; } }
  class Button extends Component { constructor() { super(); this._id = 'button-component'; this.clickEvents = []; } }
  Button.prototype.__classname__ = 'cc.Button';
  Button.__props__ = ['clickEvents'];
  class Controller extends Component { onClick() {} }
  Controller.prototype.__classname__ = 'sample.Controller';
  Controller.__props__ = [];
  class NeedsOther extends Component {}
  NeedsOther.prototype.__classname__ = 'sample.NeedsOther';
  NeedsOther._requireComponent = Component;
  class NotAComponent {}

  let componentSequence = 0;
  const root = {
    name: 'Scene', uuid: 'scene-uuid', active: true, children: [], _components: [],
    getComponents(type) { return this._components.filter((component) => component instanceof type); },
    getComponent(type) { return this.getComponents(type)[0] || null; },
    addChild(child) { child.parent = this; this.children.push(child); },
    removeChild(child) { const index = this.children.indexOf(child); if (index >= 0) this.children.splice(index, 1); child.parent = null; },
    addComponent(type) {
      const component = new type();
      component._id = `component-${++componentSequence}`;
      this._components.push(component);
      return component;
    },
  };
  const cc = {
    Component, Node: FakeNode, SpriteFrame, Button, Vec2, Vec3, Size, Color,
    Class: { attr(type, property, key) {
      if (key !== 'type') return null;
      if (type === Sprite && property === 'spriteFrame') return SpriteFrame;
      if (type === Sprite && property === 'position') return Vec2;
      if (type === Sprite && property === 'direction') return Vec3;
      if (type === Sprite && property === 'size') return Size;
      if (type === Sprite && property === 'tint') return Color;
      if (type === Sprite && property === 'thresholds') return Array;
      return null;
    } },
    assetManager: { loadAny(uuid, callback) { callback(null, new SpriteFrame(uuid)); } },
    Object: { Flags: { DontSave: 1 << 3, HideInHierarchy: 1 << 10 } },
    isValid(object) { return !!object && object.destroyed !== true; },
    director: { getScene: () => root },
    js: {
      getClassByName(name) { return ({ 'cc.Component': Component, 'cc.Sprite': Sprite, 'cc.Button': Button,
        'sample.Controller': Controller, 'sample.NeedsOther': NeedsOther, 'sample.NotAComponent': NotAComponent })[name]; },
      getClassName(type) { return type.prototype.__classname__ || ''; },
      isChildClassOf(type, base) { return type === base || type.prototype instanceof base; },
    },
  };
  cc.Component.EventHandler = class EventHandler { constructor() { this.target = null; this.component = ''; this.handler = ''; this.customEventData = ''; } };
  const module = { exports: {} };
  vm.runInNewContext(sceneSource, { module, exports: module.exports, cc, Array }, { filename: 'scene.js' });
  return { api: module.exports, root, Sprite, Vec2, Vec3, Size, Color, SpriteFrame, cc, FakeNode };
}

function invoke(api, method, input) {
  let error;
  let result;
  api[method]({ reply: (nextError, nextResult) => { error = nextError; result = nextResult; } }, input);
  return { error, result };
}

function invokeAsync(api, method, input) {
  return new Promise((resolve, reject) => {
    api[method]({ reply: (error, result) => error ? reject(error) : resolve(result) }, input);
  });
}

test('scene queries and writes exclude editor-managed nodes and all descendants', () => {
  const { api, root } = fixture();
  const user = { name: 'Canvas', uuid: 'user-node', active: true, children: [], getComponents: () => [] };
  const hiddenChild = { name: 'gizmoRoot', uuid: 'gizmo-child', active: true, children: [] };
  const helper = { name: 'Editor Scene Foreground', uuid: 'editor-helper', active: true,
    _objFlags: 1 << 3, children: [hiddenChild] };
  const hidden = { name: 'hidden-helper', uuid: 'hidden', active: true, _objFlags: 1 << 10, children: [] };
  root.children = [user, helper, hidden];
  const snapshot = invoke(api, 'snapshot', {}).result;
  assert.deepEqual(Array.from(snapshot.nodes, (node) => node.name), ['Scene', 'Canvas']);
  assert.equal(snapshot.nodes[0].children, 1);
  for (const id of ['editor-helper', 'gizmo-child', 'hidden']) {
    assert.equal(invoke(api, 'nodeState', { sceneUuid: root.uuid, nodeUuid: id }).result.reason, 'SCENE_NODE_NOT_FOUND');
    assert.equal(invoke(api, 'setNodeActive', { sceneUuid: root.uuid, nodeUuid: id,
      nodePath: 'Scene/Editor Scene Foreground', expectedActive: true, active: false }).result.available, false);
  }
  assert.equal(helper.active, true);
  assert.equal(hiddenChild.active, true);
});

test('component state resolves exact registered component class and scene node', () => {
  const { api } = fixture();
  const result = invoke(api, 'componentState', {
    sceneUuid: 'scene-uuid', nodeUuid: 'scene-uuid', nodePath: 'Scene', componentClassName: 'cc.Sprite',
  });
  assert.equal(result.error, null);
  assert.equal(result.result.available, true);
  assert.equal(result.result.componentCount, 0);
  assert.equal(result.result.canAdd, true);
  assert.equal(result.result.componentClassName, 'cc.Sprite');
});

test('component addition requires exact before count and refuses implicit dependencies', () => {
  const { api, root } = fixture();
  const mismatch = invoke(api, 'addNodeComponent', {
    sceneUuid: 'scene-uuid', nodeUuid: 'scene-uuid', nodePath: 'Scene',
    componentClassName: 'cc.Sprite', expectedComponentCount: 1,
  });
  assert.equal(mismatch.result.available, false);
  assert.equal(mismatch.result.reason, 'SCENE_COMPONENT_PRECONDITION_FAILED');
  assert.equal(root._components.length, 0);

  const requirement = invoke(api, 'addNodeComponent', {
    sceneUuid: 'scene-uuid', nodeUuid: 'scene-uuid', nodePath: 'Scene',
    componentClassName: 'sample.NeedsOther', expectedComponentCount: 0,
  });
  assert.equal(requirement.result.available, false);
  assert.equal(requirement.result.reason, 'SCENE_COMPONENT_HAS_UNAPPROVED_REQUIREMENT');
  assert.equal(root._components.length, 0);
});

test('component addition reads back exactly one new component and instance identity', () => {
  const { api, root } = fixture();
  const added = invoke(api, 'addNodeComponent', {
    sceneUuid: 'scene-uuid', nodeUuid: 'scene-uuid', nodePath: 'Scene',
    componentClassName: 'cc.Sprite', expectedComponentCount: 0,
  });
  assert.equal(added.error, null);
  assert.equal(added.result.available, true);
  assert.equal(added.result.beforeComponentCount, 0);
  assert.equal(added.result.componentCount, 1);
  assert.equal(added.result.componentInstanceId, 'component-1');
  assert.equal(root._components.length, 1);

  const duplicate = invoke(api, 'addNodeComponent', {
    sceneUuid: 'scene-uuid', nodeUuid: 'scene-uuid', nodePath: 'Scene',
    componentClassName: 'cc.Sprite', expectedComponentCount: 0,
  });
  assert.equal(duplicate.result.available, false);
  assert.equal(duplicate.result.reason, 'SCENE_COMPONENT_PRECONDITION_FAILED');
  assert.equal(root._components.length, 1);
});

test('component operations reject unknown classes and non-component classes', () => {
  const { api } = fixture();
  const unknown = invoke(api, 'componentState', {
    sceneUuid: 'scene-uuid', nodeUuid: 'scene-uuid', nodePath: 'Scene', componentClassName: 'sample.Missing',
  });
  assert.equal(unknown.result.reason, 'SCENE_COMPONENT_CLASS_NOT_REGISTERED');

  const invalid = invoke(api, 'componentState', {
    sceneUuid: 'scene-uuid', nodeUuid: 'scene-uuid', nodePath: 'Scene', componentClassName: 'sample.NotAComponent',
  });
  assert.equal(invalid.result.reason, 'SCENE_CLASS_IS_NOT_COMPONENT');

  const base = invoke(api, 'componentState', {
    sceneUuid: 'scene-uuid', nodeUuid: 'scene-uuid', nodePath: 'Scene', componentClassName: 'cc.Component',
  });
  assert.equal(base.result.reason, 'SCENE_CLASS_IS_NOT_COMPONENT');
});

test('component query rejects an oversized instance set', () => {
  const { api, root, Sprite } = fixture();
  root._components = Array.from({ length: 33 }, (_, index) => {
    const component = new Sprite();
    component._id = `component-${index}`;
    return component;
  });
  const result = invoke(api, 'componentState', {
    sceneUuid: 'scene-uuid', nodeUuid: 'scene-uuid', nodePath: 'Scene', componentClassName: 'cc.Sprite',
  });
  assert.equal(result.result.available, false);
  assert.equal(result.result.reason, 'SCENE_COMPONENT_LIMIT');
});

test('component property writes support declared public scalars with exact before-state', () => {
  const { api, root } = fixture();
  const added = invoke(api, 'addNodeComponent', {
    sceneUuid: 'scene-uuid', nodeUuid: 'scene-uuid', nodePath: 'Scene',
    componentClassName: 'cc.Sprite', expectedComponentCount: 0,
  });
  assert.equal(added.result.available, true);

  const nodeRead = invoke(api, 'nodeState', { sceneUuid: 'scene-uuid', nodeUuid: 'scene-uuid' });
  assert.equal(nodeRead.result.componentsAvailable, true);
  assert.equal(nodeRead.result.componentCount, 1);
  assert.equal(nodeRead.result.components[0].componentClassName, 'cc.Sprite');
  assert.equal(nodeRead.result.components[0].componentInstanceId, 'component-1');

  const stateInput = { sceneUuid: 'scene-uuid', nodeUuid: 'scene-uuid', nodePath: 'Scene',
    componentClassName: 'cc.Sprite', componentInstanceId: 'component-1', property: 'mode' };
  const state = invoke(api, 'componentPropertyState', stateInput);
  assert.equal(state.result.available, true);
  assert.equal(state.result.value, 0);
  assert.equal(state.result.propertyKind, 'number');

  const changed = invoke(api, 'setComponentProperty', { ...stateInput, expectedValue: 0, value: 1 });
  assert.equal(changed.result.available, true);
  assert.equal(changed.result.beforeValue, 0);
  assert.equal(changed.result.value, 1);

  const stale = invoke(api, 'setComponentProperty', { ...stateInput, expectedValue: 0, value: 2 });
  assert.equal(stale.result.available, false);
  assert.equal(stale.result.reason, 'SCENE_COMPONENT_PROPERTY_PRECONDITION_FAILED');
  assert.equal(root._components[0].mode, 1);
});

test('component property writes round-trip typed vectors, size, color, and bounded scalar arrays', () => {
  const { api, root, Vec2, Vec3, Size, Color } = fixture();
  invoke(api, 'addNodeComponent', {
    sceneUuid: 'scene-uuid', nodeUuid: 'scene-uuid', nodePath: 'Scene',
    componentClassName: 'cc.Sprite', expectedComponentCount: 0,
  });
  const input = { sceneUuid: 'scene-uuid', nodeUuid: 'scene-uuid', nodePath: 'Scene',
    componentClassName: 'cc.Sprite', componentInstanceId: 'component-1' };
  const changes = [
    { property: 'position', value: { kind: 'vec2', y: 9, x: 8 }, Type: Vec2, expected: { x: 8, y: 9 } },
    { property: 'direction', value: { kind: 'vec3', z: 12, x: 10, y: 11 }, Type: Vec3, expected: { x: 10, y: 11, z: 12 } },
    { property: 'size', value: { kind: 'size', height: 14, width: 13 }, Type: Size, expected: { width: 13, height: 14 } },
    { property: 'tint', value: { kind: 'color', a: 255, b: 23, g: 22, r: 21 }, Type: Color,
      expected: { r: 21, g: 22, b: 23, a: 255 } },
    { property: 'thresholds', value: { kind: 'array', items: [2, 'medium', false] }, Type: Array,
      expected: [2, 'medium', false] },
  ];
  for (const change of changes) {
    const state = invoke(api, 'componentPropertyState', { ...input, property: change.property }).result;
    assert.equal(state.available, true, `${change.property}: ${JSON.stringify(state)}`);
    assert.equal(state.propertyKind, change.value.kind);
    const result = invoke(api, 'setComponentProperty', { ...input, property: change.property,
      expectedValue: state.value, value: change.value }).result;
    assert.equal(result.available, true, `${change.property}: ${JSON.stringify(result)}`);
    const stored = root._components[0][change.property];
    if (change.Type === Array) assert.deepEqual(Array.from(stored), change.expected);
    else {
      assert.ok(stored instanceof change.Type, change.property);
      for (const [field, expected] of Object.entries(change.expected)) assert.equal(stored[field], expected);
    }
    assert.deepEqual(JSON.parse(JSON.stringify(result.value)), change.value.kind === 'array'
      ? { kind: 'array', items: change.expected }
      : { kind: change.value.kind, ...change.expected });
  }
  const positionState = invoke(api, 'componentPropertyState', { ...input, property: 'position' }).result;
  const noChange = invoke(api, 'setComponentProperty', { ...input, property: 'position',
    expectedValue: { kind: 'vec2', y: 9, x: 8 }, value: { kind: 'vec2', x: 8, y: 9 } }).result;
  assert.equal(positionState.available, true);
  assert.equal(noChange.reason, 'SCENE_COMPONENT_PROPERTY_NO_CHANGE');
});

test('component asset properties load exact resources and represent an empty reference without a UUID', () => {
  const { api, root, SpriteFrame } = fixture();
  invoke(api, 'addNodeComponent', {
    sceneUuid: 'scene-uuid', nodeUuid: 'scene-uuid', nodePath: 'Scene',
    componentClassName: 'cc.Sprite', expectedComponentCount: 0,
  });
  const input = { sceneUuid: 'scene-uuid', nodeUuid: 'scene-uuid', nodePath: 'Scene',
    componentClassName: 'cc.Sprite', componentInstanceId: 'component-1', property: 'spriteFrame' };
  const before = invoke(api, 'componentPropertyState', input).result;
  assert.deepEqual(JSON.parse(JSON.stringify(before.value)), { kind: 'asset', assetClass: 'SpriteFrame' });
  const uuid = '44444444-4444-4444-8444-444444444444';
  const assigned = invoke(api, 'setComponentProperty', { ...input, expectedValue: before.value,
    value: { kind: 'asset', assetClass: 'SpriteFrame', assetUuid: uuid } }).result;
  assert.equal(assigned.available, true, assigned.reason);
  assert.ok(root._components[0].spriteFrame instanceof SpriteFrame);
  assert.equal(root._components[0].spriteFrame._uuid, uuid);

  const cleared = invoke(api, 'setComponentProperty', { ...input,
    expectedValue: { kind: 'asset', assetClass: 'SpriteFrame', assetUuid: uuid },
    value: { kind: 'asset', assetClass: 'SpriteFrame' } }).result;
  assert.equal(cleared.available, true, cleared.reason);
  assert.equal(root._components[0].spriteFrame, null);
  assert.deepEqual(JSON.parse(JSON.stringify(cleared.value)), { kind: 'asset', assetClass: 'SpriteFrame' });
});

test('component property writes reject inherited, internal, and object-valued fields', () => {
  const { api } = fixture();
  invoke(api, 'addNodeComponent', {
    sceneUuid: 'scene-uuid', nodeUuid: 'scene-uuid', nodePath: 'Scene',
    componentClassName: 'cc.Sprite', expectedComponentCount: 0,
  });
  for (const property of ['enabled', 'inheritedValue', '_privateValue', 'vector']) {
    const state = invoke(api, 'componentPropertyState', {
      sceneUuid: 'scene-uuid', nodeUuid: 'scene-uuid', nodePath: 'Scene',
      componentClassName: 'cc.Sprite', componentInstanceId: 'component-1', property,
    });
    assert.equal(state.result.available, false, property);
    assert.match(state.result.reason, /^SCENE_COMPONENT_PROPERTY_/);
  }
});

test('scene composition creates nodes, sets transforms, attaches resources, and binds Button handlers', async () => {
  const { api, root, FakeNode } = fixture();
  root.uuid = '11111111-1111-4111-8111-111111111111';
  const canvas = new FakeNode('Canvas');
  canvas._id = '22222222-2222-4222-8222-222222222222';
  root.addChild(canvas);
  const request = {
    sceneUuid: root.uuid,
    nodes: [{ id: 'button', uuid: '33333333-3333-4333-8333-333333333333', name: 'StartButton',
      parentRef: `uuid:${canvas.uuid}`, transform: { x: 12, y: -8, scaleX: 1, scaleY: 1, angle: 0, width: 180, height: 64 } }],
    components: [
      { id: 'sprite', nodeRef: 'new:button', className: 'cc.Sprite',
        properties: [{ name: 'spriteFrame', value: { assetUuid: '44444444-4444-4444-8444-444444444444', assetClass: 'SpriteFrame' } }] },
      { id: 'button', nodeRef: 'new:button', className: 'cc.Button', properties: [] },
      { id: 'controller', nodeRef: 'new:button', className: 'sample.Controller', properties: [] },
    ],
    buttonEvents: [{ buttonRef: 'new:button', handlerRef: 'new:button', handlerComponentClassName: 'sample.Controller',
      handler: 'onClick', customEventData: 'toggle' }],
  };
  const planned = invoke(api, 'compositionState', request).result;
  assert.equal(planned.available, true, JSON.stringify(planned));
  assert.equal(planned.createdNodes[0].parentUuid, canvas.uuid);

  const result = await invokeAsync(api, 'compose', { ...request, expectedState: planned });
  assert.equal(result.available, true, JSON.stringify(result));
  assert.equal(result.readback.nodes.length, 1);
  const created = result.readback.nodes[0];
  assert.equal(created.uuid, request.nodes[0].uuid);
  assert.equal(created.nodePath, 'Scene/Canvas/StartButton');
  assert.deepEqual(JSON.parse(JSON.stringify(created.transform)), { x: 12, y: -8, z: 0, scaleX: 1, scaleY: 1, angle: 0, width: 180, height: 64 });
  assert.equal(created.components.find((item) => item.id === 'sprite').propertyValues.spriteFrame,
    '44444444-4444-4444-8444-444444444444');
  assert.deepEqual(JSON.parse(JSON.stringify(created.components.find((item) => item.id === 'button').clickEvents)), [{
    targetUuid: request.nodes[0].uuid, component: 'sample.Controller', handler: 'onClick', customEventData: 'toggle',
  }]);
  assert.equal(canvas.children.length, 1);
});

test('scene composition rejects stale, ambiguous, and non-serializable inputs before adding nodes', () => {
  const { api, root, FakeNode } = fixture();
  root.uuid = '11111111-1111-4111-8111-111111111111';
  const parent = new FakeNode('Canvas');
  parent._id = '22222222-2222-4222-8222-222222222222';
  root.addChild(parent);
  const request = { sceneUuid: root.uuid,
    nodes: [{ id: 'button', uuid: '33333333-3333-4333-8333-333333333333', name: 'Button', parentRef: `uuid:${parent.uuid}` }],
    components: [{ id: 'sprite', nodeRef: 'new:button', className: 'cc.Sprite',
      properties: [{ name: 'inheritedValue', value: 1 }] }], buttonEvents: [] };
  const rejected = invoke(api, 'compositionState', request).result;
  assert.equal(rejected.available, false);
  assert.equal(rejected.reason, 'SCENE_COMPOSE_PROPERTY_NOT_SERIALIZABLE');
  assert.equal(parent.children.length, 0);
});

test('scene composition rechecks the exact planned parent state before creating nodes', async () => {
  const { api, root, FakeNode } = fixture();
  root.uuid = '11111111-1111-4111-8111-111111111111';
  const parent = new FakeNode('Canvas');
  parent._id = '22222222-2222-4222-8222-222222222222';
  root.addChild(parent);
  const request = { sceneUuid: root.uuid,
    nodes: [{ id: 'button', uuid: '33333333-3333-4333-8333-333333333333', name: 'Button', parentRef: `uuid:${parent.uuid}` }],
    components: [], buttonEvents: [] };
  const planned = invoke(api, 'compositionState', request).result;
  parent.addChild(new FakeNode('InterveningNode'));
  const result = await invokeAsync(api, 'compose', { ...request, expectedState: planned });
  assert.equal(result.available, false, JSON.stringify(result));
  assert.equal(result.reason, 'SCENE_COMPOSE_PRECONDITION_FAILED');
  assert.equal(parent.children.length, 1);
});

test('existing scene node rename preserves UUID, binds the parent, and rejects stale or colliding names', () => {
  const { api, root, FakeNode } = fixture();
  root.uuid = '11111111-1111-4111-8111-111111111111';
  const parent = new FakeNode('Canvas');
  parent._id = '22222222-2222-4222-8222-222222222222';
  root.addChild(parent);
  const node = new FakeNode('Before');
  node._id = '33333333-3333-4333-8333-333333333333';
  parent.addChild(node);
  const sibling = new FakeNode('Taken');
  parent.addChild(sibling);
  const state = invoke(api, 'nodeNameState', { sceneUuid: root.uuid, nodeUuid: node.uuid }).result;
  assert.equal(state.available, true);
  assert.equal(state.parentUuid, parent.uuid);
  assert.equal(state.nodePath, 'Scene/Canvas/Before');

  const collision = invoke(api, 'renameNode', { sceneUuid: root.uuid, nodeUuid: node.uuid,
    nodePath: state.nodePath, expectedName: state.nodeName, expectedParentUuid: state.parentUuid, newName: 'Taken' }).result;
  assert.equal(collision.available, false);
  assert.equal(collision.reason, 'SCENE_NODE_SIBLING_NAME_EXISTS');
  assert.equal(node.name, 'Before');

  const stale = invoke(api, 'renameNode', { sceneUuid: root.uuid, nodeUuid: node.uuid,
    nodePath: 'Scene/Canvas/Old', expectedName: state.nodeName, expectedParentUuid: state.parentUuid, newName: 'After' }).result;
  assert.equal(stale.available, false);
  assert.equal(stale.reason, 'SCENE_NODE_NAME_PRECONDITION_FAILED');
  assert.equal(node.name, 'Before');

  const renamed = invoke(api, 'renameNode', { sceneUuid: root.uuid, nodeUuid: node.uuid,
    nodePath: state.nodePath, expectedName: state.nodeName, expectedParentUuid: state.parentUuid, newName: 'After' }).result;
  assert.equal(renamed.available, true, JSON.stringify(renamed));
  assert.equal(renamed.nodeUuid, '33333333-3333-4333-8333-333333333333');
  assert.equal(renamed.nodeName, 'After');
  assert.equal(renamed.nodePath, 'Scene/Canvas/After');
  assert.equal(node.uuid, '33333333-3333-4333-8333-333333333333');
});

test('existing scene node deletion is exact, rejects the scene root, and detaches a subtree', () => {
  const { api, root, FakeNode } = fixture();
  const parent = new FakeNode('Canvas');
  const child = new FakeNode('Dialog');
  const descendant = new FakeNode('Title');
  root.addChild(parent);
  parent.addChild(child);
  child.addChild(descendant);
  const rootDelete = invoke(api, 'nodeDeleteState', { sceneUuid: root.uuid, nodeUuid: root.uuid }).result;
  assert.equal(rootDelete.reason, 'SCENE_NODE_ROOT_DELETE_UNSUPPORTED');
  const state = invoke(api, 'nodeDeleteState', { sceneUuid: root.uuid, nodeUuid: child.uuid }).result;
  assert.equal(state.available, true);
  assert.equal(state.childCount, 1);
  const stale = invoke(api, 'deleteNode', { sceneUuid: root.uuid, nodeUuid: child.uuid,
    nodePath: state.nodePath, expectedName: state.nodeName, expectedParentUuid: 'stale-parent', expectedChildCount: 1,
    expectedSubtree: state.subtree }).result;
  assert.equal(stale.reason, 'SCENE_NODE_DELETE_PRECONDITION_FAILED');
  assert.equal(child.parent, parent);
  const result = invoke(api, 'deleteNode', { sceneUuid: root.uuid, nodeUuid: child.uuid,
    nodePath: state.nodePath, expectedName: state.nodeName,
    expectedParentUuid: state.parentUuid, expectedChildCount: state.childCount,
    expectedSubtree: state.subtree }).result;
  assert.equal(result.available, true);
  assert.equal(result.deleted, true);
  assert.equal(child.parent, null);
  assert.equal(parent.children.length, 0);
  assert.equal(invoke(api, 'nodeState', { sceneUuid: root.uuid, nodeUuid: descendant.uuid }).result.reason,
    'SCENE_NODE_NOT_FOUND');
});

test('component removal targets one current-session instance and refuses required components', () => {
  const { api, root, Sprite, cc } = fixture();
  const sprite = new Sprite();
  const node = { name: 'Icon', uuid: 'icon-node', active: true, children: [], parent: root,
    _components: [sprite], getComponents(type) { return this._components.filter((component) => component instanceof type); } };
  sprite.node = node;
  root.children.push(node);
  const state = invoke(api, 'componentRemoveState', { sceneUuid: root.uuid, nodeUuid: node.uuid,
    nodePath: 'Scene/Icon', componentClassName: 'cc.Sprite', componentInstanceId: sprite._id }).result;
  assert.equal(state.available, true);
  assert.equal(state.present, true);
  const removed = invoke(api, 'removeNodeComponent', { sceneUuid: root.uuid, nodeUuid: node.uuid,
    nodePath: 'Scene/Icon', componentClassName: 'cc.Sprite', componentInstanceId: sprite._id,
    expectedPresent: true }).result;
  assert.equal(removed.available, true);
  assert.equal(removed.present, false);
  assert.equal(cc.isValid(sprite, true), false);

  class RequiresSprite extends cc.Component {}
  RequiresSprite._requireComponent = Sprite;
  RequiresSprite.prototype.__classname__ = 'sample.RequiresSprite';
  cc.js.getClassByName = ((original) => (name) => name === 'sample.RequiresSprite' ? RequiresSprite : original(name))(cc.js.getClassByName);
  const requiredSprite = new Sprite();
  const dependent = new RequiresSprite();
  node._components = [requiredSprite, dependent];
  const blocked = invoke(api, 'componentRemoveState', { sceneUuid: root.uuid, nodeUuid: node.uuid,
    nodePath: 'Scene/Icon', componentClassName: 'cc.Sprite', componentInstanceId: requiredSprite._id }).result;
  assert.deepEqual(Array.from(blocked.dependentComponents), ['sample.RequiresSprite']);
  const refused = invoke(api, 'removeNodeComponent', { sceneUuid: root.uuid, nodeUuid: node.uuid,
    nodePath: 'Scene/Icon', componentClassName: 'cc.Sprite', componentInstanceId: requiredSprite._id,
    expectedPresent: true }).result;
  assert.equal(refused.reason, 'SCENE_COMPONENT_REQUIRED_BY_OTHER_COMPONENT');
  assert.equal(cc.isValid(requiredSprite, true), true);
});
