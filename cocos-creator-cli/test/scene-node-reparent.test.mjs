import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sceneSource = fs.readFileSync(path.join(packageRoot, 'creator-extension/scene.js'), 'utf8');

function fixture() {
  class Node {
    constructor(name, uuid) {
      this.name = name; this.uuid = uuid; this.active = true; this.children = []; this._components = [];
      this._objFlags = 0; this.x = 7; this.y = 9; this._parent = null;
    }
    get parent() { return this._parent; }
    set parent(next) {
      if (this._parent) this._parent.children = this._parent.children.filter((item) => item !== this);
      this._parent = next || null;
      if (this._parent && !this._parent.children.includes(this)) this._parent.children.push(this);
    }
    getComponents() { return this._components; }
    add(child) { child.parent = this; }
  }
  const scene = new Node('Scene', 'scene-uuid');
  const oldParent = new Node('Old', 'old-parent');
  const targetParent = new Node('New', 'new-parent');
  const child = new Node('Child', 'child-node');
  scene.add(oldParent); scene.add(targetParent); oldParent.add(child);
  const cc = { Component: class Component {}, Object: { Flags: { DontSave: 8, HideInHierarchy: 1024 } },
    director: { getScene: () => scene }, js: { getClassName: () => 'FixtureNode' } };
  const module = { exports: {} };
  vm.runInNewContext(sceneSource, { module, exports: module.exports, cc,
    require: createRequire(path.join(packageRoot, 'creator-extension/scene.js')) }, { filename: 'scene.js' });
  return { api: module.exports, scene, oldParent, targetParent, child };
}

function invoke(api, method, input) {
  let result;
  let error;
  api[method]({ reply: (nextError, nextResult) => { error = nextError; result = nextResult; } }, input);
  return { error, result };
}

test('existing scene node reparent preserves UUID and local transform while changing the hierarchy', () => {
  const { api, child, oldParent, targetParent } = fixture();
  const before = invoke(api, 'nodeReparentState', { sceneUuid: 'scene-uuid', nodeUuid: 'child-node', targetParentUuid: 'new-parent' }).result;
  assert.equal(before.available, true);
  assert.equal(before.nodePath, 'Scene/Old/Child');
  assert.equal(before.parentUuid, 'old-parent');
  assert.equal(before.targetParentPath, 'Scene/New');
  assert.equal(before.afterNodePath, 'Scene/New/Child');
  assert.equal(before.localTransformPreserved, true);
  assert.equal(before.worldTransformPreserved, false);

  const result = invoke(api, 'reparentNode', { sceneUuid: 'scene-uuid', nodeUuid: 'child-node',
    nodePath: before.nodePath, expectedName: before.nodeName, expectedParentUuid: before.parentUuid,
    expectedParentPath: before.parentPath, targetParentUuid: before.targetParentUuid,
    targetParentPath: before.targetParentPath, afterNodePath: before.afterNodePath }).result;
  assert.equal(result.available, true, JSON.stringify(result));
  assert.equal(result.nodeUuid, 'child-node');
  assert.equal(result.nodePath, 'Scene/New/Child');
  assert.equal(result.parentUuid, 'new-parent');
  assert.equal(child.parent, targetParent);
  assert.equal(oldParent.children.length, 0);
  assert.equal(child.x, 7);
  assert.equal(child.y, 9);
});

test('scene reparent refuses root, self, descendants, same-parent no-ops, and sibling-name collisions', () => {
  const { api, scene, oldParent, targetParent, child } = fixture();
  assert.equal(invoke(api, 'nodeReparentState', { sceneUuid: scene.uuid,
    nodeUuid: scene.uuid, targetParentUuid: targetParent.uuid }).result.reason, 'SCENE_NODE_ROOT_REPARENT_UNSUPPORTED');
  assert.equal(invoke(api, 'nodeReparentState', { sceneUuid: scene.uuid,
    nodeUuid: child.uuid, targetParentUuid: child.uuid }).result.reason, 'SCENE_NODE_REPARENT_SELF');
  assert.equal(invoke(api, 'nodeReparentState', { sceneUuid: scene.uuid,
    nodeUuid: oldParent.uuid, targetParentUuid: child.uuid }).result.reason, 'SCENE_NODE_REPARENT_CYCLE');
  assert.equal(invoke(api, 'nodeReparentState', { sceneUuid: scene.uuid,
    nodeUuid: child.uuid, targetParentUuid: oldParent.uuid }).result.reason, 'SCENE_NODE_REPARENT_NO_CHANGE');
  child.name = 'Bad/Path';
  assert.equal(invoke(api, 'nodeReparentState', { sceneUuid: scene.uuid,
    nodeUuid: child.uuid, targetParentUuid: targetParent.uuid }).result.reason, 'SCENE_NODE_REPARENT_NAME_INVALID');
  child.name = 'Child';
  targetParent.add(new child.constructor('Child', 'collision-node'));
  assert.equal(invoke(api, 'nodeReparentState', { sceneUuid: scene.uuid,
    nodeUuid: child.uuid, targetParentUuid: targetParent.uuid }).result.reason, 'SCENE_NODE_REPARENT_NAME_COLLISION');
});

test('scene reparent rechecks the node path and parent immediately before mutation', () => {
  const { api, child, oldParent, targetParent } = fixture();
  const plan = invoke(api, 'nodeReparentState', { sceneUuid: 'scene-uuid', nodeUuid: child.uuid,
    targetParentUuid: targetParent.uuid }).result;
  child.name = 'RenamedElsewhere';
  const result = invoke(api, 'reparentNode', { sceneUuid: 'scene-uuid', nodeUuid: child.uuid,
    nodePath: plan.nodePath, expectedName: plan.nodeName, expectedParentUuid: plan.parentUuid,
    expectedParentPath: plan.parentPath, targetParentUuid: plan.targetParentUuid,
    targetParentPath: plan.targetParentPath, afterNodePath: plan.afterNodePath }).result;
  assert.equal(result.available, false);
  assert.equal(result.reason, 'SCENE_NODE_REPARENT_PRECONDITION_FAILED');
  assert.equal(child.parent, oldParent);
});
