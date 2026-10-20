import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sceneSource = fs.readFileSync(path.join(packageRoot, 'creator-extension/scene.js'), 'utf8');

function fixture() {
  class Component {}
  Component.__props__ = ['enabled'];
  class BaseSprite extends Component {}
  BaseSprite.__props__ = ['enabled', 'inheritedValue'];
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
    }
  }
  Sprite.prototype.__classname__ = 'cc.Sprite';
  Sprite.$super = BaseSprite;
  Sprite.__props__ = ['mode', 'labelText', 'enabled', 'inheritedValue', '_privateValue', 'vector'];
  class NeedsOther extends Component {}
  NeedsOther.prototype.__classname__ = 'sample.NeedsOther';
  NeedsOther._requireComponent = Component;
  class NotAComponent {}

  let componentSequence = 0;
  const root = {
    name: 'Scene', uuid: 'scene-uuid', active: true, children: [], _components: [],
    getComponents(type) { return this._components.filter((component) => component instanceof type); },
    addComponent(type) {
      const component = new type();
      component._id = `component-${++componentSequence}`;
      this._components.push(component);
      return component;
    },
  };
  const cc = {
    Component,
    director: { getScene: () => root },
    js: {
      getClassByName(name) { return ({ 'cc.Component': Component, 'cc.Sprite': Sprite,
        'sample.NeedsOther': NeedsOther, 'sample.NotAComponent': NotAComponent })[name]; },
      getClassName(type) { return type.prototype.__classname__ || ''; },
      isChildClassOf(type, base) { return type === base || type.prototype instanceof base; },
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(sceneSource, { module, exports: module.exports, cc }, { filename: 'scene.js' });
  return { api: module.exports, root, Sprite };
}

function invoke(api, method, input) {
  let error;
  let result;
  api[method]({ reply: (nextError, nextResult) => { error = nextError; result = nextResult; } }, input);
  return { error, result };
}

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

test('component property writes are restricted to declared public scalars with exact before-state', () => {
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
  assert.equal(state.result.valueType, 'number');

  const changed = invoke(api, 'setComponentProperty', { ...stateInput, expectedValue: 0, value: 1 });
  assert.equal(changed.result.available, true);
  assert.equal(changed.result.beforeValue, 0);
  assert.equal(changed.result.value, 1);

  const stale = invoke(api, 'setComponentProperty', { ...stateInput, expectedValue: 0, value: 2 });
  assert.equal(stale.result.available, false);
  assert.equal(stale.result.reason, 'SCENE_COMPONENT_PROPERTY_PRECONDITION_FAILED');
  assert.equal(root._components[0].mode, 1);
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
