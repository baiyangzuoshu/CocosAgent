'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

function fixture() {
    const scene = { name: 'helloworld', uuid: 'scene-id', children: [] };
    const canvas = { name: 'Canvas', uuid: 'canvas-id', children: [], parent: scene };
    scene.children.push(canvas);
    const context = { module: { exports: {} }, cc: {
        director: { getScene: () => scene }, js: { getClassName: (component) => component.classId },
    } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../2.4.15NewProject/packages/cocos-agent-bridge/scene.js'), 'utf8'), context);
    const invoke = (method, params) => {
        let response;
        context.module.exports[method]({ reply: (error, value) => { response = { error, value }; } }, params);
        return response;
    };
    const addNode = (name, uuid) => {
        const node = { name, uuid, parent: canvas, active: true, children: [], _components: [],
            x: 0, y: 0, scaleX: 1, scaleY: 1 };
        canvas.children.push(node);
        return node;
    };
    return { invoke, addNode };
}

test('scene preflight accepts the Host null representation of absent Prefab fields', () => {
    const { invoke } = fixture();
    const params = { parentPath: 'helloworld/Canvas', parentUuid: 'canvas-id', nodeName: 'Probe', action: 'apply',
        components: [], transform: {}, prefabMode: null, prefabUuid: null };
    assert.equal(invoke('node-create-preflight', params).value.decision, 'create');
    assert.equal(invoke('node-create-preflight', { ...params, prefabMode: 'create' }).value.decision, 'create');
    assert.equal(invoke('node-create-preflight', { ...params, prefabUuid: 'unexpected' }).error.code, 'INVALID_NODE_REQUEST');
});

test('compensation accepts a linked Prefab instance with inherited components and guards its transform', () => {
    const { invoke, addNode } = fixture();
    const uuid = '11111111-1111-4111-8111-111111111111';
    const node = addNode('Instance', 'instance-id');
    node._prefab = { asset: { _uuid: uuid } };
    node._components.push({ classId: 'cc.Sprite', enabled: true, spriteFrame: { _uuid: uuid } });
    const params = { parentPath: 'helloworld/Canvas', parentUuid: 'canvas-id', nodeName: 'Instance',
        action: 'compensate', targetNodeUuid: 'instance-id', components: [],
        transform: { position: { x: 0, y: 0 } }, prefabMode: 'instantiate', prefabUuid: uuid };
    assert.equal(invoke('node-create-preflight', params).value.decision, 'remove');
    node.x = 12;
    assert.equal(invoke('node-create-preflight', params).error.code, 'SCENE_OBJECT_CHANGED');
});

test('rename compensation derives the current name but still requires an exact path and UUID', () => {
    const { invoke, addNode } = fixture();
    addNode('Renamed', 'node-id');
    const params = { targetNodePath: 'helloworld/Canvas/Original', targetNodeUuid: 'node-id',
        expectedDiff: [{ path: 'node.name', before: 'Renamed', after: 'Original' }] };
    assert.equal(invoke('node-patch-preflight', params).value.node.name, 'Renamed');
    assert.equal(invoke('node-patch-preflight', { ...params, targetNodeUuid: 'wrong-id' }).error.code, 'TARGET_CHANGED');
    assert.equal(invoke('node-patch-preflight', { ...params,
        expectedDiff: [{ path: 'node.active', before: true, after: false }] }).error.code, 'TARGET_CHANGED');
    addNode('Original', 'other-id');
    assert.equal(invoke('node-patch-preflight', params).error.code, 'SCENE_NODE_CONFLICT');
});

test('Prefab temporary asset name changes require the same root identity and do not collide with siblings', () => {
    const { invoke, addNode } = fixture();
    const node = addNode('Probe', 'node-id');
    const params = { nodeUuid: 'node-id', beforeName: 'Probe', afterName: 'CocosAgentPrefab_operation' };
    assert.equal(invoke('node-prefab-create-name', params).value.name, params.afterName);
    assert.equal(invoke('node-prefab-create-name', params).error.code, 'PREFAB_NODE_CHANGED');
    addNode('Probe', 'other-id');
    assert.equal(invoke('node-prefab-create-name', { ...params, beforeName: node.name, afterName: 'Probe' }).error.code, 'PREFAB_NODE_CHANGED');
});
