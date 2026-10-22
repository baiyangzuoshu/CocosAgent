import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { validateCommand } from '../bridge/contracts.mjs';

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../creator-extension');
const contract = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'command-contract.json'), 'utf8'));
const sceneClassIds = { 'cc.Button': 'cc.Button', 'game.ButtonState': 'c8f27f4c-3728-4ce7-8db6-8fdc99e9a70a' };

function normalizedSceneTransform(value = {}) {
  return { x: value.x ?? 0, y: value.y ?? 0, z: value.z ?? 0,
    scaleX: value.scaleX ?? 1, scaleY: value.scaleY ?? 1,
    angle: value.angle ?? 0, width: value.width ?? 0, height: value.height ?? 0 };
}

function mockSceneCompositionState(params, sceneUuid) {
  const parentUuids = [...new Set(params.nodes.map((node) => node.parentRef.slice('uuid:'.length)))].sort();
  const existingNodes = parentUuids.map((nodeUuid) => ({ sceneUuid, nodeUuid,
    nodePath: 'Scene', active: true, children: 0, components: [] }));
  return { available: true, sceneUuid, sceneName: 'Scene', existingNodes,
    createdNodes: params.nodes.map((node) => ({ id: node.id, uuid: node.uuid,
      parentUuid: node.parentRef.startsWith('new:')
        ? params.nodes.find((candidate) => candidate.id === node.parentRef.slice(4))?.uuid
        : node.parentRef.slice('uuid:'.length),
      name: node.name, transform: normalizedSceneTransform(node.transform) })),
    componentCount: params.components.length, buttonEventCount: params.buttonEvents.length };
}

function mockSceneCompositionReadback(params, sceneUuid) {
  return { available: true, sceneUuid, nodes: params.nodes.map((node) => ({ id: node.id, uuid: node.uuid,
    name: node.name, nodePath: `Scene/${node.name}`,
    parentUuid: node.parentRef.startsWith('new:')
      ? params.nodes.find((candidate) => candidate.id === node.parentRef.slice(4))?.uuid
      : node.parentRef.slice('uuid:'.length),
    transform: normalizedSceneTransform(node.transform),
    components: params.components.filter((component) => component.nodeRef === `new:${node.id}`).map((component) => ({
      id: component.id, componentClassName: component.className, serializedClassId: sceneClassIds[component.className],
      componentInstanceId: `instance-${component.id}`,
      propertyValues: Object.fromEntries(component.properties.map((property) => [property.name,
        property.value && typeof property.value === 'object' ? property.value.assetUuid : property.value])),
      clickEvents: component.className === 'cc.Button' ? params.buttonEvents.filter((event) => event.buttonRef === `new:${node.id}`)
        .map((event) => ({ targetUuid: event.handlerRef.startsWith('new:')
          ? params.nodes.find((candidate) => candidate.id === event.handlerRef.slice(4))?.uuid
          : event.handlerRef.slice('uuid:'.length), component: event.handlerComponentClassName,
        handler: event.handler, customEventData: event.customEventData || '' })) : null,
    })) })) };
}

function serializeSceneComposition(params, sceneUuid) {
  const expected = mockSceneCompositionState(params, sceneUuid);
  const records = [{ __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
    { __type__: 'cc.Scene', _id: sceneUuid, _active: true, _children: [] }];
  const nodeIndices = new Map();
  for (const node of params.nodes) {
    const state = expected.createdNodes.find((item) => item.id === node.id);
    const transform = state.transform;
    const angle = transform.angle * Math.PI / 360;
    const index = records.length;
    nodeIndices.set(node.id, index);
    records.push({ __type__: 'cc.Node', _id: node.uuid, _name: node.name,
      _parent: node.parentRef.startsWith('new:') ? { __id__: nodeIndices.get(node.parentRef.slice(4)) } : { __id__: 1 },
      _children: [], _active: true, _components: [],
      _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [transform.x, transform.y, transform.z,
        0, 0, Math.sin(angle), Math.cos(angle), transform.scaleX, transform.scaleY, 1] },
      _contentSize: { __type__: 'cc.Size', width: transform.width, height: transform.height },
      _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 } });
    records[1]._children.push({ __id__: index });
  }
  const componentIndices = new Map();
  for (const component of params.components) {
    const nodeId = component.nodeRef.slice('new:'.length);
    const properties = Object.fromEntries(component.properties.map((property) => [property.name,
      property.value && typeof property.value === 'object' ? { __uuid__: property.value.assetUuid } : property.value]));
    const index = records.length;
    componentIndices.set(component.id, index);
    records.push({ __type__: sceneClassIds[component.className], ...properties,
      ...(component.className === 'cc.Button' ? { clickEvents: [] } : {}) });
    records[nodeIndices.get(nodeId)]._components.push({ __id__: index });
  }
  for (const event of params.buttonEvents) {
    const buttonComponent = params.components.find((component) => component.nodeRef === event.buttonRef
      && component.className === 'cc.Button');
    const handlerComponent = params.components.find((component) => component.nodeRef === event.handlerRef
      && component.className === event.handlerComponentClassName);
    const targetId = event.handlerRef.slice('new:'.length);
    const eventIndex = records.length;
    records.push({ __type__: 'cc.ClickEvent', target: { __id__: nodeIndices.get(targetId) },
      component: event.handlerComponentClassName, _componentId: sceneClassIds[event.handlerComponentClassName],
      handler: event.handler, customEventData: event.customEventData || '' });
    records[componentIndices.get(buttonComponent.id)].clickEvents.push({ __id__: eventIndex });
    assert.ok(handlerComponent);
  }
  return records;
}

function serializeExistingSceneNode({ transform, name = 'Button', active = true, parentUuid = null,
  buttonEvents = null },
  sceneUuid, nodeUuid, oldParentUuid, targetParentUuid, withParents = false) {
  const angle = transform.angle * Math.PI / 360;
  const records = [{ __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
    { __type__: 'cc.Scene', _id: sceneUuid, _name: 'Scene',
      _children: withParents ? [{ __id__: 2 }, { __id__: 3 }] : [{ __id__: 2 }] }];
  let parentIndex = 1;
  if (withParents) {
    const moved = parentUuid === targetParentUuid;
    records.push({ __type__: 'cc.Node', _id: oldParentUuid, _name: 'Old', _parent: { __id__: 1 },
      _children: moved ? [] : [{ __id__: 4 }] });
    records.push({ __type__: 'cc.Node', _id: targetParentUuid, _name: 'New', _parent: { __id__: 1 },
      _children: moved ? [{ __id__: 4 }] : [] });
    parentIndex = moved ? 3 : 2;
  }
  records.push({ __type__: 'cc.Node', _id: nodeUuid, _name: name, _parent: { __id__: parentIndex }, _children: [],
    _active: active, _components: [],
    _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [transform.x, transform.y, transform.z,
      0, 0, Math.sin(angle), Math.cos(angle), transform.scaleX, transform.scaleY, 1] },
    _contentSize: { __type__: 'cc.Size', width: transform.width, height: transform.height },
    _anchorPoint: { __type__: 'cc.Vec2', x: transform.anchorX, y: transform.anchorY } });
  if (Array.isArray(buttonEvents)) {
    const nodeIndex = records.length - 1;
    const buttonIndex = records.length;
    records[nodeIndex]._components.push({ __id__: buttonIndex });
    records.push({ __type__: 'cc.Button', clickEvents: [] });
    for (const event of buttonEvents) {
      const eventIndex = records.length;
      records.push({ __type__: 'cc.ClickEvent', target: { __id__: nodeIndex }, component: event.component,
        handler: event.handler, customEventData: event.customEventData });
      records[buttonIndex].clickEvents.push({ __id__: eventIndex });
    }
  }
  return records;
}

function makeHarness(t, { approved = true, onApproval = () => {}, refreshResults, refreshFailure = null,
  ipcMode = 'electron', assetCreateMode = 'complete', sceneCompose = false, sceneActive = false,
  sceneRename = false, sceneReparent = false,
  sceneNodeDelete = false, sceneComponentRemove = false,
  sceneTransform = false, sceneButtonEvents = false,
  sceneProperty = null,
  assetMove = false, assetDelete = false, assetDeleteHasSubAssets = false,
  assetTexture = false, assetTextureSaveMode = 'complete', sceneSaveMode = 'write', prefabPatch = false } = {}) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-script-modify-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
  const home = path.join(tempRoot, 'home');
  const projectRoot = path.join(tempRoot, 'project');
  const assets = path.join(projectRoot, 'assets', 'Scripts');
  fs.mkdirSync(assets, { recursive: true });
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'project.json'), JSON.stringify({ name: 'fixture' }));
  const scriptPath = 'Scripts/Player.ts';
  const scriptFile = path.join(projectRoot, 'assets', scriptPath);
  const metaFile = `${scriptFile}.meta`;
  const beforeSource = 'const value = 1;\n';
  const meta = { importer: 'typescript', uuid: 'c8f27f4c-3728-4ce7-8db6-8fdc99e9a70a' };
  fs.writeFileSync(scriptFile, beforeSource);
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));
  const assetRecords = new Map([['db://assets/Scripts/Player.ts', { url: 'db://assets/Scripts/Player.ts',
    uuid: meta.uuid, importer: meta.importer, type: 'typescript' }]]);
  const importedAssetUuid = 'a3b51e35-a9f2-4552-b597-4731bbf7b119';
  const prefabAssetUuid = 'dbce40c1-5298-4e0e-9bc3-670d31a650e4';
  const sceneUuid = '4b02b1e4-d163-47e2-91ad-2da0193a3907';
  const nodeUuid = 'df1bb94e-c8e6-41ba-b9c9-a04c6e86a581';
  const oldParentUuid = '9303f25a-11c9-44f5-8b4e-2872b7227a88';
  const targetParentUuid = 'ad1632bf-19b1-4976-8f36-930d57113e55';
  const movableAssetUuid = '2ae6ee78-ec7d-4a24-8b09-9f9b12f59d42';
  const movableAssetPath = 'Sprites/Icon.png';
  const movableAssetFile = path.join(projectRoot, 'assets', movableAssetPath);
  const deletableAssetUuid = 'e55a59bf-0b59-48bb-a2c4-ae31f225ec5d';
  const deletableAssetPath = 'Textures/Unused.png';
  const deletableAssetFile = path.join(projectRoot, 'assets', deletableAssetPath);
  const textureAssetUuid = '9c05b7f8-1bd4-4c52-9610-172bfabca890';
  const textureAssetPath = 'Textures/Atlas.png';
  const textureAssetFile = path.join(projectRoot, 'assets', textureAssetPath);
  const spriteUuid = 'a4cfe1a2-2b74-4ff6-a1dc-257b5ba22122';
  const prefabPatchUuid = 'e98a93d5-9707-45a6-88f6-50a40a1511f4';
  const prefabPatchNodeUuid = 'prefab-node-root-1';
  const prefabPatchPath = 'Prefabs/PatchFixture.prefab';
  const prefabPatchFile = path.join(projectRoot, 'assets', prefabPatchPath);
  let reparentApplied = false;
  let sceneNodeActive = true;
  let sceneNodeName = 'Button';
  let sceneNodeDeleted = false;
  let sceneComponentRemoved = false;
  let buttonEvents = [];
  const sceneFile = path.join(projectRoot, 'assets', 'Scenes', 'Main.fire');
  const sceneMetaFile = `${sceneFile}.meta`;
  if (sceneCompose || sceneTransform || sceneActive || sceneRename || sceneReparent || sceneButtonEvents) {
    fs.mkdirSync(path.dirname(sceneFile), { recursive: true });
    fs.writeFileSync(sceneFile, JSON.stringify(serializeExistingSceneNode({
      transform: { x: 1, y: 2, z: 0, scaleX: 1, scaleY: 1, angle: 0,
        width: 50, height: 20, anchorX: 0.5, anchorY: 0.5 },
      name: sceneNodeName, active: sceneNodeActive,
      parentUuid: sceneReparent ? oldParentUuid : sceneUuid,
      buttonEvents: sceneButtonEvents ? buttonEvents : null,
    }, sceneUuid, nodeUuid, oldParentUuid, targetParentUuid, sceneReparent)));
    fs.writeFileSync(sceneMetaFile, JSON.stringify({ uuid: sceneUuid, importer: 'scene' }));
    assetRecords.set('db://assets/Scenes/Main.fire', { url: 'db://assets/Scenes/Main.fire',
      uuid: sceneUuid, importer: 'scene', type: 'cc.SceneAsset' });
    assetRecords.set('db://assets/Sprites/Icon.png', { url: 'db://assets/Sprites/Icon.png',
      uuid: spriteUuid, importer: 'image', type: 'cc.SpriteFrame' });
  }
  if (prefabPatch) {
    fs.mkdirSync(path.dirname(prefabPatchFile), { recursive: true });
    fs.writeFileSync(prefabPatchFile, JSON.stringify([
      { __type__: 'cc.Prefab', data: { __id__: 1 } },
      { __type__: 'cc.Node', _id: prefabPatchNodeUuid, _name: 'Root', _active: true,
        _parent: null, _children: [], _components: [{ __id__: 2 }],
        _trs: { __type__: 'TypedArray', ctor: 'Float64Array', array: [1, 2, 0, 0, 0, 0, 1, 1, 1] } },
      { __type__: 'cc.Sprite', _enabled: true, _spriteFrame: null },
    ]));
    fs.writeFileSync(`${prefabPatchFile}.meta`, JSON.stringify({ uuid: prefabPatchUuid, importer: 'prefab' }));
    assetRecords.set(`db://assets/${prefabPatchPath}`, { url: `db://assets/${prefabPatchPath}`,
      uuid: prefabPatchUuid, importer: 'prefab', type: 'cc.Prefab' });
  }
  if (assetMove) {
    fs.mkdirSync(path.dirname(movableAssetFile), { recursive: true });
    fs.writeFileSync(movableAssetFile, Buffer.from('fixture-image-bytes'));
    fs.writeFileSync(`${movableAssetFile}.meta`, JSON.stringify({ uuid: movableAssetUuid, importer: 'image' }));
    assetRecords.set('db://assets/Sprites/Icon.png', { url: 'db://assets/Sprites/Icon.png',
      uuid: movableAssetUuid, importer: 'image', type: 'image' });
  }
  if (assetDelete) {
    fs.mkdirSync(path.dirname(deletableAssetFile), { recursive: true });
    fs.writeFileSync(deletableAssetFile, Buffer.from('fixture-unused-image'));
    fs.writeFileSync(`${deletableAssetFile}.meta`, JSON.stringify({ uuid: deletableAssetUuid, importer: 'image' }));
    assetRecords.set(`db://assets/${deletableAssetPath}`, { url: `db://assets/${deletableAssetPath}`,
      uuid: deletableAssetUuid, importer: 'image', type: 'image' });
  }
  const textureMeta = { uuid: textureAssetUuid, importer: 'texture', wrapMode: 'clamp',
    filterMode: 'bilinear', premultiplyAlpha: false, genMipmaps: false, packable: true,
    userData: { preserve: 'yes' } };
  if (assetTexture) {
    fs.mkdirSync(path.dirname(textureAssetFile), { recursive: true });
    fs.writeFileSync(textureAssetFile, Buffer.from('fixture-texture-image'));
    fs.writeFileSync(`${textureAssetFile}.meta`, JSON.stringify(textureMeta, null, 2));
    assetRecords.set(`db://assets/${textureAssetPath}`, { url: `db://assets/${textureAssetPath}`,
      uuid: textureAssetUuid, importer: 'texture', type: 'texture' });
  }

  const fakeHttp = {
    request(_options, onResponse) {
      const request = new EventEmitter();
      request.setTimeout = () => {};
      request.write = () => {};
      request.end = () => {
        const response = new EventEmitter();
        response.statusCode = 200;
        process.nextTick(() => {
          onResponse(response);
          response.emit('data', Buffer.from('{}'));
          response.emit('end');
          request.emit('close');
        });
      };
      request.destroy = (error) => {
        if (error) request.emit('error', error);
        request.emit('close');
      };
      return request;
    },
  };

  let saveCount = 0;
  let textureMetaSaveCount = 0;
  let sceneSaveCount = 0;
  let currentSceneComposition = null;
  const currentTransform = { x: 1, y: 2, z: 0, scaleX: 1, scaleY: 1, angle: 0,
    width: 50, height: 20, anchorX: 0.5, anchorY: 0.5 };
  const editorIpc = new EventEmitter();
  const electronIpc = new EventEmitter();
  const editorBuilder = new EventEmitter();
  editorIpc.sendToPanel = (panel, message, sourceNodeUuid, targetUrl) => {
    assert.equal(panel, 'scene');
    if (message === 'scene:stash-and-save') {
      assert.ok(sceneCompose || sceneActive || sceneRename || sceneReparent || sceneNodeDelete
        || sceneComponentRemove || sceneTransform || sceneButtonEvents);
      sceneSaveCount += 1;
      if (sceneSaveMode === 'write' && currentSceneComposition) {
        fs.writeFileSync(sceneFile, JSON.stringify(serializeSceneComposition(currentSceneComposition, sceneUuid)));
        fs.writeFileSync(sceneMetaFile, JSON.stringify({ uuid: sceneUuid, importer: 'scene' }));
      } else if (sceneSaveMode === 'write' && (sceneActive || sceneRename || sceneReparent || sceneTransform || sceneButtonEvents)) {
        fs.writeFileSync(sceneFile, JSON.stringify(serializeExistingSceneNode({ transform: currentTransform,
          name: sceneNodeName, active: sceneNodeActive,
          parentUuid: sceneReparent ? (reparentApplied ? targetParentUuid : oldParentUuid) : sceneUuid,
          buttonEvents: sceneButtonEvents ? buttonEvents : null,
        }, sceneUuid, nodeUuid, oldParentUuid, targetParentUuid, sceneReparent)));
        fs.writeFileSync(sceneMetaFile, JSON.stringify({ uuid: sceneUuid, importer: 'scene' }));
      }
      return;
    }
    assert.equal(message, 'scene:create-prefab');
    assert.equal(sourceNodeUuid, nodeUuid);
    const relative = targetUrl.replace(/^db:\/\/assets\//, '');
    const filename = path.join(projectRoot, 'assets', ...relative.split('/'));
    const serialized = [{ __type__: 'cc.Prefab' }, { __type__: 'cc.Node', _name: 'Button' },
      { __type__: 'cc.Button' }];
    fs.writeFileSync(filename, JSON.stringify(serialized));
    fs.writeFileSync(`${filename}.meta`, JSON.stringify({ uuid: prefabAssetUuid, importer: 'prefab' }));
    assetRecords.set(targetUrl, { command: 'create', url: targetUrl, uuid: prefabAssetUuid, importer: 'prefab', type: 'cc.Prefab' });
  };
  const Editor = {
    Project: { path: projectRoot },
    App: { version: '2.4.15' },
    Scene: { callSceneScript(_packageName, method, params, callback) {
      if (method === 'prefabEditModeState' && prefabPatch) {
        callback(null, { available: true, modeName: 'scene', prefabUuid: null, sceneUuid,
          saveAvailable: true, popAvailable: true });
        return;
      }
      if (method === 'nodeState') {
        assert.equal(params.sceneUuid, sceneUuid);
        assert.equal(params.nodeUuid, nodeUuid);
        callback(null, { available: true, sceneName: 'Scene', sceneUuid, nodeName: sceneNodeName, nodeUuid,
          nodePath: `Scene/${sceneNodeName}`, active: sceneNodeActive, children: 0, componentsAvailable: true,
          componentCount: sceneButtonEvents ? 2 : 0,
          components: sceneButtonEvents ? [{ componentClassName: 'cc.Button', componentInstanceId: 'button-instance' },
            { componentClassName: 'game.ButtonState', componentInstanceId: 'handler-instance' }] : [],
          componentsTruncated: false, visited: 2,
          ...(sceneTransform ? { transform: { ...currentTransform } } : {}) });
        return;
      }
      if (method === 'buttonEventsState' && sceneButtonEvents) {
        assert.equal(params.sceneUuid, sceneUuid);
        assert.equal(params.nodeUuid, nodeUuid);
        assert.equal(params.nodePath, 'Scene/Button');
        assert.equal(params.componentInstanceId, 'button-instance');
        callback(null, { available: true, sceneName: 'Scene', sceneUuid, nodeUuid,
          nodePath: 'Scene/Button', componentClassName: 'cc.Button', componentInstanceId: 'button-instance',
          events: [...buttonEvents], ...(params.events ? { requestedEvents: params.events,
            changed: JSON.stringify(buttonEvents) !== JSON.stringify(params.events) } : {}) });
        return;
      }
      if (method === 'setButtonEvents' && sceneButtonEvents) {
        if (JSON.stringify(buttonEvents) !== JSON.stringify(params.expectedBefore)) {
          callback(null, { available: false, reason: 'SCENE_BUTTON_EVENTS_PRECONDITION_FAILED' });
          return;
        }
        buttonEvents = [...params.events];
        callback(null, { available: true, sceneUuid, nodeUuid, nodePath: 'Scene/Button',
          componentInstanceId: 'button-instance', before: params.expectedBefore, events: [...buttonEvents] });
        return;
      }
      if (method === 'nodeTransformState' && sceneTransform) {
        assert.equal(params.sceneUuid, sceneUuid);
        assert.equal(params.nodeUuid, nodeUuid);
        callback(null, { available: true, sceneName: 'Scene', sceneUuid, nodeUuid, nodePath: 'Scene/Button',
          transform: { ...currentTransform }, ...(params.values ? { requested: params.values,
            changed: Object.keys(params.values).some((field) => currentTransform[field] !== params.values[field]) } : {}) });
        return;
      }
      if (method === 'nodeNameState' && sceneRename) {
        callback(null, { available: true, sceneName: 'Scene', sceneUuid, nodeUuid,
          nodeName: sceneNodeName, nodePath: `Scene/${sceneNodeName}`, parentUuid: sceneUuid,
          nameAvailable: true });
        return;
      }
      if (method === 'renameNode' && sceneRename) {
        if (params.expectedName !== sceneNodeName || params.expectedParentUuid !== sceneUuid) {
          callback(null, { available: false, reason: 'SCENE_NODE_NAME_PRECONDITION_FAILED' });
          return;
        }
        sceneNodeName = params.newName;
        callback(null, { available: true, sceneUuid, nodeUuid, nodeName: sceneNodeName,
          nodePath: `Scene/${sceneNodeName}`, parentUuid: sceneUuid });
        return;
      }
      if (method === 'setNodeActive' && sceneActive) {
        if (params.expectedActive !== sceneNodeActive) {
          callback(null, { available: false, reason: 'SCENE_NODE_ACTIVE_PRECONDITION_FAILED' });
          return;
        }
        sceneNodeActive = params.active;
        callback(null, { available: true, sceneUuid, nodeUuid, active: sceneNodeActive });
        return;
      }
      if (method === 'setNodeTransform' && sceneTransform) {
        assert.equal(params.sceneUuid, sceneUuid);
        assert.equal(params.nodeUuid, nodeUuid);
        const before = Object.fromEntries(Object.keys(params.values).map((field) => [field, currentTransform[field]]));
        if (Object.keys(before).some((field) => before[field] !== params.expectedBefore[field])) {
          callback(null, { available: false, reason: 'SCENE_NODE_TRANSFORM_PRECONDITION_FAILED', transform: { ...currentTransform } });
          return;
        }
        Object.assign(currentTransform, params.values);
        callback(null, { available: true, sceneUuid, nodeUuid, nodePath: 'Scene/Button', before,
          after: Object.fromEntries(Object.keys(params.values).map((field) => [field, currentTransform[field]])),
          transform: { ...currentTransform } });
        return;
      }
      if (method === 'componentPropertyState' && sceneProperty) {
        callback(null, { available: true, sceneName: 'Scene', sceneUuid, nodeUuid, nodePath: 'Scene/Button',
          componentClassName: params.componentClassName, componentInstanceId: params.componentInstanceId,
          property: params.property, propertyKind: sceneProperty.propertyKind, value: sceneProperty.value });
        return;
      }
      if (method === 'nodeReparentState' && sceneReparent) {
        assert.equal(params.sceneUuid, sceneUuid);
        assert.equal(params.nodeUuid, nodeUuid);
        assert.equal(params.targetParentUuid, targetParentUuid);
        callback(null, {
          available: true, sceneName: 'Scene', sceneUuid, nodeUuid, nodeName: 'Button',
          nodePath: reparentApplied ? 'Scene/New/Button' : 'Scene/Old/Button',
          parentUuid: reparentApplied ? targetParentUuid : oldParentUuid,
          parentPath: reparentApplied ? 'Scene/New' : 'Scene/Old',
          targetParentUuid, targetParentPath: 'Scene/New', afterNodePath: 'Scene/New/Button',
          localTransformPreserved: true, worldTransformPreserved: false,
        });
        return;
      }
      if (method === 'reparentNode' && sceneReparent) {
        reparentApplied = true;
        callback(null, {
          available: true, sceneName: 'Scene', sceneUuid, nodeUuid, nodeName: 'Button',
          nodePath: 'Scene/New/Button', parentUuid: targetParentUuid, parentPath: 'Scene/New',
          targetParentUuid, targetParentPath: 'Scene/New', afterNodePath: 'Scene/New/Button',
          localTransformPreserved: true, worldTransformPreserved: false,
        });
        return;
      }
      if (method === 'nodeDeleteState' && sceneNodeDelete) {
        assert.equal(params.sceneUuid, sceneUuid);
        assert.equal(params.nodeUuid, nodeUuid);
        callback(null, sceneNodeDeleted ? { available: false, reason: 'SCENE_NODE_NOT_FOUND' }
          : { available: true, sceneName: 'Scene', sceneUuid, nodeName: 'Button', nodeUuid,
            nodePath: 'Scene/Button', parentUuid: oldParentUuid, childCount: 2,
            subtree: [{ nodeUuid, nodeName: 'Button', parentUuid: oldParentUuid, siblingIndex: 0, childCount: 2 },
              { nodeUuid: 'child-node-one', nodeName: 'Icon', parentUuid: nodeUuid, siblingIndex: 0, childCount: 0 },
              { nodeUuid: 'child-node-two', nodeName: 'Label', parentUuid: nodeUuid, siblingIndex: 1, childCount: 0 }] });
        return;
      }
      if (method === 'deleteNode' && sceneNodeDelete) {
        sceneNodeDeleted = true;
        callback(null, { available: true, sceneUuid, nodeUuid, nodePath: 'Scene/Button', deleted: true, childCount: 2 });
        return;
      }
      if (method === 'componentRemoveState' && sceneComponentRemove) {
        assert.equal(params.sceneUuid, sceneUuid);
        assert.equal(params.nodeUuid, nodeUuid);
        callback(null, { available: true, sceneName: 'Scene', sceneUuid, nodeUuid, nodePath: 'Scene/Button',
          componentClassName: params.componentClassName, componentInstanceId: params.componentInstanceId,
          present: !sceneComponentRemoved, dependentComponents: [] });
        return;
      }
      if (method === 'removeNodeComponent' && sceneComponentRemove) {
        sceneComponentRemoved = true;
        callback(null, { available: true, sceneUuid, nodeUuid, nodePath: 'Scene/Button',
          componentClassName: params.componentClassName, componentInstanceId: params.componentInstanceId,
          beforePresent: true, present: false });
        return;
      }
      assert.ok(sceneCompose, `unexpected scene method: ${method}`);
      if (method === 'compositionState') callback(null, mockSceneCompositionState(params, sceneUuid));
      else if (method === 'compose') {
        currentSceneComposition = params;
        callback(null, { available: true, readback: mockSceneCompositionReadback(params, sceneUuid) });
      } else if (method === 'compositionReadback') {
        callback(null, currentSceneComposition
          ? mockSceneCompositionReadback(currentSceneComposition, sceneUuid)
          : { available: false, reason: 'SCENE_NODE_NOT_FOUND' });
      } else throw new Error(`unexpected scene method: ${method}`);
    } },
    assetdb: {
      queryAssets(url, _types, callback) {
        if (url === 'db://assets/**/*') callback(null, [...assetRecords.values()]);
        else callback(null, assetRecords.has(url) ? [assetRecords.get(url)] : []);
      },
      exists(url) { return assetRecords.has(url); },
      create(url, data, callback) {
        const relative = url.replace(/^db:\/\/assets\//, '');
        const filename = path.join(projectRoot, 'assets', ...relative.split('/'));
        const bytes = Buffer.from(data);
        fs.writeFileSync(filename, bytes);
        fs.writeFileSync(`${filename}.meta`, JSON.stringify({ uuid: importedAssetUuid, importer: 'image' }));
        const row = { command: 'create', url, uuid: importedAssetUuid, importer: 'image', type: 'image' };
        assetRecords.set(url, row);
        callback(assetCreateMode === 'callback-error-after-write' ? new Error('injected callback loss') : null, [row]);
      },
      saveExists(url, source, callback) {
        saveCount += 1;
        assert.equal(url, 'db://assets/Scripts/Player.ts');
        fs.writeFileSync(scriptFile, source);
        callback(null, { uuid: meta.uuid });
      },
      saveMeta(assetUuid, jsonString, callback) {
        assert.ok(assetTexture, 'unexpected texture metadata save');
        assert.equal(assetUuid, textureAssetUuid);
        textureMetaSaveCount += 1;
        fs.writeFileSync(`${textureAssetFile}.meta`, jsonString);
        callback(assetTextureSaveMode === 'callback-error-after-write' ? new Error('injected callback loss') : null,
          assetRecords.get(`db://assets/${textureAssetPath}`));
      },
      refresh(url, callback) {
        assert.equal(url, 'db://assets/Scripts/Player.ts');
        if (refreshFailure) electronIpc.emit('asset-db:script-import-failed', url, refreshFailure);
        callback(null, refreshResults || [{ command: 'change', url, uuid: meta.uuid, type: 'typescript' }]);
      },
      move(sourceUrl, destinationUrl, callback) {
        assert.ok(assetMove, 'unexpected AssetDB move');
        const record = assetRecords.get(sourceUrl);
        assert.ok(record, `missing source record ${sourceUrl}`);
        const sourceRelative = sourceUrl.replace(/^db:\/\/assets\//, '');
        const destinationRelative = destinationUrl.replace(/^db:\/\/assets\//, '');
        const source = path.join(projectRoot, 'assets', ...sourceRelative.split('/'));
        const destination = path.join(projectRoot, 'assets', ...destinationRelative.split('/'));
        fs.renameSync(source, destination);
        fs.renameSync(`${source}.meta`, `${destination}.meta`);
        assetRecords.delete(sourceUrl);
        const moved = { ...record, url: destinationUrl };
        assetRecords.set(destinationUrl, moved);
        callback(null, [{ ...moved, command: 'move', sourceUrl, destinationUrl }]);
      },
      isSubAsset() { return false; },
      containsSubAssets() { return assetDeleteHasSubAssets; },
      delete(urls, callback) {
        assert.ok(assetDelete, 'unexpected AssetDB deletion');
        const removed = [];
        for (const url of urls) {
          const relative = url.replace(/^db:\/\/assets\//, '');
          const filename = path.join(projectRoot, 'assets', ...relative.split('/'));
          fs.rmSync(filename, { force: true });
          fs.rmSync(`${filename}.meta`, { force: true });
          const row = assetRecords.get(url);
          if (row) removed.push({ ...row, command: 'delete' });
          assetRecords.delete(url);
        }
        callback(null, removed);
      },
    },
    Ipc: ipcMode === 'editor' ? editorIpc : {},
    Builder: editorBuilder,
    Dialog: { messageBox: () => approved ? 1 : 0 },
  };
  const baseRequire = createRequire(path.join(extensionRoot, 'main.js'));
  const module = { exports: {} };
  const localRequire = (id) => {
    if (id === 'http') return fakeHttp;
    if (id === 'os') return { ...os, homedir: () => home };
    if (id === 'electron') return { ipcMain: electronIpc };
    if (id === './approval.cjs') return async () => { onApproval(); return approved; };
    return baseRequire(id);
  };
  // Keep the save-timeout branch deterministic and fast in the mocked editor process.
  const source = fs.readFileSync(path.join(extensionRoot, 'main.js'), 'utf8')
    .replace('const SCENE_SAVE_READBACK_TIMEOUT_MS = 15000;', 'const SCENE_SAVE_READBACK_TIMEOUT_MS = 1;')
    + `\nmodule.exports.__test = {
    createScriptModifyPlan, commitScriptModify, reconcileScriptModify,
    createPrefabSourcePatchPlan,
    createScriptRecompilePlan, commitScriptRecompile, reconcileScriptRecompile, setupDiagnosticListeners,
    createAssetImportPlan, commitAssetImport, reconcileAssetImport,
    createPrefabPlan, commitPrefabCreate, reconcilePrefabCreate,
    createSceneComposePlan, commitSceneCompose, reconcileSceneCompose,
    createSceneNodeActivePlan, commitSceneNodeActive, reconcileSceneNodeActive,
    createSceneNodeTransformPlan, commitSceneNodeTransform, reconcileSceneNodeTransform,
    createSceneButtonEventsPlan, commitSceneButtonEvents, reconcileSceneButtonEvents,
    createSceneNodeRenamePlan, commitSceneNodeRename, reconcileSceneNodeRename,
    createSceneNodeReparentPlan, commitSceneNodeReparent, reconcileSceneNodeReparent,
    createSceneNodeDeletePlan, createSceneComponentRemovePlan, createSceneComponentPropertyPlan,
    commitSceneNodeDelete(input, context) { return commitSceneDestructiveOperation(readSceneNodeDeleteOperation(input.operationId), input, context); },
    reconcileSceneNodeDelete(input) { return reconcileSceneDestructiveOperation(readSceneNodeDeleteOperation(input.operationId)); },
    commitSceneComponentRemove(input, context) { return commitSceneDestructiveOperation(readSceneComponentRemoveOperation(input.operationId), input, context); },
    reconcileSceneComponentRemove(input) { return reconcileSceneDestructiveOperation(readSceneComponentRemoveOperation(input.operationId)); },
    createAssetMovePlan, commitAssetMove, reconcileAssetMove,
    createAssetDeletePlan, commitAssetDelete, reconcileAssetDelete,
    createTextureImportSettingsPlan, commitTextureImportSettings, reconcileTextureImportSettings,
    setBridgeSession(value) { bridgeSession = value; },
  };`;
  vm.runInNewContext(source, {
    module, exports: module.exports, require: localRequire, __dirname: extensionRoot,
    Buffer, console, process, setTimeout, clearTimeout, Editor,
  }, { filename: 'creator-extension/main.js' });
  const api = module.exports.__test;
  const stateDirectory = path.join(home, '.cocos-creator-agent');
  fs.mkdirSync(stateDirectory, { recursive: true });
  fs.writeFileSync(path.join(stateDirectory, 'third-party-bridge.json'), JSON.stringify({
    protocolVersion: '0.1', host: '127.0.0.1', port: 43210, token: 't'.repeat(48), bridgeId: 'bridge-fixture',
  }));
  api.setBridgeSession({ bridgeId: 'bridge-fixture', sessionId: 'session-fixture', projectRoot });
  return { api, scriptFile, metaFile, beforeSource, projectRoot, scriptPath, meta, editorIpc, electronIpc,
    importedAssetUuid, prefabAssetUuid, sceneUuid, nodeUuid,
    prefabPatchUuid, prefabPatchNodeUuid, prefabPatchFile,
    currentTransform, getButtonEvents: () => [...buttonEvents],
    oldParentUuid, targetParentUuid, isReparentApplied: () => reparentApplied,
    setReparentApplied(value) { reparentApplied = value; },
    movableAssetUuid, movableAssetPath, movableAssetFile,
    deletableAssetUuid, deletableAssetPath, deletableAssetFile,
    textureAssetUuid, textureAssetPath, textureAssetFile,
    isSceneNodeDeleted: () => sceneNodeDeleted,
    isSceneComponentRemoved: () => sceneComponentRemoved,
    getSaveCount: () => saveCount, getSceneSaveCount: () => sceneSaveCount,
    getTextureMetaSaveCount: () => textureMetaSaveCount,
    readTextureMeta: () => JSON.parse(fs.readFileSync(`${textureAssetFile}.meta`, 'utf8')),
    sceneFile, sceneMetaFile, spriteUuid };
}

const sourceHash = (value) => import('node:crypto').then(({ createHash }) =>
  createHash('sha256').update(Buffer.from(value)).digest('hex'));

function command(id) { return contract.commands.find((entry) => entry.id === id); }

test('script modification commands declare approved write and bounded inputs', () => {
  const plan = command('creator.script.modify.plan');
  const commit = command('creator.script.modify.commit');
  const reconcile = command('creator.script.modify.reconcile');
  assert.equal(plan.access, 'plan');
  assert.deepEqual(plan.input.required, ['scriptPath', 'expectedSourceSha256', 'source']);
  assert.equal(commit.access, 'write');
  assert.equal(commit.approval, true);
  assert.equal(reconcile.access, 'plan');
  assert.equal(validateCommand(plan.id, { scriptPath: 'Scripts/Player.ts', expectedSourceSha256: 'a'.repeat(64),
    source: 'const value = 1;' }).ok, true);
  assert.equal(validateCommand(plan.id, { scriptPath: '../outside.ts', expectedSourceSha256: 'a'.repeat(64),
    source: 'const value = 1;' }).ok, false);
  const recompilePlan = command('creator.script.recompile.plan');
  const recompileCommit = command('creator.script.recompile.commit');
  assert.equal(recompilePlan.access, 'plan');
  assert.equal(recompileCommit.access, 'control');
  assert.equal(recompileCommit.approval, true);
  assert.equal(validateCommand(recompilePlan.id, { scriptPath: 'Scripts/Player.ts', expectedSourceSha256: 'b'.repeat(64) }).ok, true);
  assert.equal(validateCommand(recompilePlan.id, { scriptPath: 'Scripts/Player.ts', expectedSourceSha256: 'x'.repeat(64) }).ok, false);
  const importPlan = command('creator.asset.import.plan');
  const importCommit = command('creator.asset.import.commit');
  const importReconcile = command('creator.asset.import.reconcile');
  assert.equal(importPlan.access, 'plan');
  assert.equal(importCommit.access, 'write');
  assert.equal(importCommit.approval, true);
  assert.equal(importReconcile.access, 'plan');
  assert.equal(validateCommand(importPlan.id, { sourcePath: '/tmp/tank.png', assetPath: 'Textures/tank.png' }).ok, true);
  assert.equal(validateCommand(importPlan.id, { sourcePath: '/tmp/tank.png', assetPath: '../tank.png' }).ok, false);
  const movePlan = command('creator.asset.move.plan');
  const moveCommit = command('creator.asset.move.commit');
  const moveReconcile = command('creator.asset.move.reconcile');
  assert.equal(movePlan.access, 'plan');
  assert.equal(moveCommit.access, 'write');
  assert.equal(moveCommit.approval, true);
  assert.equal(moveReconcile.access, 'plan');
  assert.equal(validateCommand(movePlan.id, { sourceAssetPath: 'Sprites/Icon.png',
    destinationAssetPath: 'Sprites/Renamed.png' }).ok, true);
  assert.equal(validateCommand(movePlan.id, { sourceAssetPath: 'Sprites/Icon.png',
    destinationAssetPath: '../Renamed.png' }).ok, false);
  const deletePlan = command('creator.asset.delete.plan');
  const deleteCommit = command('creator.asset.delete.commit');
  const deleteReconcile = command('creator.asset.delete.reconcile');
  assert.equal(deletePlan.access, 'plan');
  assert.equal(deleteCommit.access, 'write');
  assert.equal(deleteCommit.approval, true);
  assert.equal(deleteReconcile.access, 'plan');
  assert.equal(validateCommand(deletePlan.id, { assetUuid: 'e55a59bf-0b59-48bb-a2c4-ae31f225ec5d' }).ok, true);
  assert.equal(validateCommand(deletePlan.id, { assetUuid: '../outside' }).ok, false);
  const texturePlan = command('creator.asset.import-settings.plan');
  const textureCommit = command('creator.asset.import-settings.commit');
  const textureReconcile = command('creator.asset.import-settings.reconcile');
  assert.equal(texturePlan.access, 'plan');
  assert.equal(textureCommit.access, 'write');
  assert.equal(textureCommit.approval, true);
  assert.equal(textureReconcile.access, 'plan');
  assert.equal(validateCommand(texturePlan.id, { assetUuid: '9c05b7f8-1bd4-4c52-9610-172bfabca890',
    settings: { wrapMode: 'repeat', genMipmaps: true } }).ok, true);
  assert.equal(validateCommand(texturePlan.id, { assetUuid: '9c05b7f8-1bd4-4c52-9610-172bfabca890',
    settings: { wrapMode: 'mirror' } }).ok, false);
  assert.equal(validateCommand(texturePlan.id, { assetUuid: '9c05b7f8-1bd4-4c52-9610-172bfabca890',
    settings: { filterMode: 'point' } }).ok, true);
  assert.equal(validateCommand(texturePlan.id, { assetUuid: '9c05b7f8-1bd4-4c52-9610-172bfabca890',
    settings: { filterMode: 'nearest' } }).ok, false);
  assert.equal(validateCommand(texturePlan.id, { assetUuid: '9c05b7f8-1bd4-4c52-9610-172bfabca890',
    settings: { importer: 'texture' } }).ok, false);
  const prefabPlan = command('creator.prefab.create.plan');
  const prefabCommit = command('creator.prefab.create.commit');
  const prefabReconcile = command('creator.prefab.create.reconcile');
  assert.equal(prefabPlan.access, 'plan');
  assert.equal(prefabCommit.access, 'write');
  assert.equal(prefabCommit.approval, true);
  assert.equal(prefabReconcile.access, 'plan');
  assert.equal(validateCommand(prefabPlan.id, { sceneUuid: '4b02b1e4-d163-47e2-91ad-2da0193a3907',
    nodeUuid: 'df1bb94e-c8e6-41ba-b9c9-a04c6e86a581', prefabPath: 'Prefabs/Button.prefab' }).ok, true);
  assert.equal(validateCommand(prefabPlan.id, { sceneUuid: '4b02b1e4-d163-47e2-91ad-2da0193a3907',
    nodeUuid: 'df1bb94e-c8e6-41ba-b9c9-a04c6e86a581', prefabPath: '../Button.prefab' }).ok, false);
});

test('Prefab source patch planning binds Creator mode, serialized identity, source hash, and exact before state', async (t) => {
  const harness = makeHarness(t, { prefabPatch: true });
  const expectedSourceSha256 = await sourceHash(fs.readFileSync(harness.prefabPatchFile, 'utf8'));
  const input = { prefabUuid: harness.prefabPatchUuid, targetNodePath: 'Root',
    targetNodeUuid: harness.prefabPatchNodeUuid, action: 'apply', expectedSourceSha256,
    expectedDiff: [{ path: 'node.name', before: 'Root', after: 'RootRenamed' }] };
  const plan = await harness.api.createPrefabSourcePatchPlan(input);
  assert.equal(plan.status, 'planned');
  assert.equal(plan.prefabUuid, harness.prefabPatchUuid);
  assert.equal(plan.targetNodePath, 'Root');
  assert.deepEqual(plan.diff, input.expectedDiff);
  await assert.rejects(harness.api.createPrefabSourcePatchPlan({ ...input, expectedSourceSha256: 'a'.repeat(64) }),
    (error) => error.code === 'PREFAB_SOURCE_STALE');
  await assert.rejects(harness.api.createPrefabSourcePatchPlan({ ...input, targetNodePath: 'Other',
    expectedDiff: [{ path: 'node.active', before: true, after: false }] }),
    (error) => error.code === 'PREFAB_EXPECTED_STATE_MISMATCH');
});

test('scene-node reparent binds the hierarchy, commits once, requests save, and reconciles by readback', async (t) => {
  const harness = makeHarness(t, { sceneReparent: true, ipcMode: 'editor' });
  const plan = await harness.api.createSceneNodeReparentPlan({ sceneUuid: harness.sceneUuid,
    nodeUuid: harness.nodeUuid, targetParentUuid: harness.targetParentUuid });
  assert.equal(plan.status, 'planned');
  assert.equal(plan.expectedBefore.parentUuid, harness.oldParentUuid);
  assert.equal(plan.expectedBefore.parentPath, 'Scene/Old');
  assert.equal(plan.expectedAfter.parentUuid, harness.targetParentUuid);
  assert.equal(plan.expectedAfter.nodePath, 'Scene/New/Button');
  assert.equal(plan.localTransformPreserved, true);
  assert.equal(plan.worldTransformPreserved, false);
  assert.equal(harness.isReparentApplied(), false);

  const receipt = await harness.api.commitSceneNodeReparent({ operationId: plan.operationId, planHash: plan.planHash },
    { requestId: 'request-fixture' });
  assert.equal(receipt.status, 'completed');
  assert.equal(receipt.after.nodePath, 'Scene/New/Button');
  assert.equal(receipt.after.parentUuid, harness.targetParentUuid);
  assert.equal(receipt.sceneSaveRequestSent, true);
  assert.equal(receipt.sceneSaveCompletionConfirmed, false);
  assert.equal(receipt.scenePersistenceConfirmed, true);
  assert.equal(receipt.diskReadback.parentUuid, harness.targetParentUuid);
  assert.equal(receipt.diskReadback.nodePath, 'Scene/New/Button');
  assert.equal(harness.isReparentApplied(), true);
  assert.equal(harness.getSceneSaveCount(), 1);

  const reconciled = await harness.api.reconcileSceneNodeReparent({ operationId: plan.operationId });
  assert.equal(reconciled.status, 'completed');
  assert.equal(reconciled.observed.nodeUuid, harness.nodeUuid);
  assert.equal(reconciled.observed.parentUuid, harness.targetParentUuid);
});

test('set-active and rename require exact serialized scene readback before completion', async (t) => {
  const active = makeHarness(t, { sceneActive: true, ipcMode: 'editor' });
  const activePlan = await active.api.createSceneNodeActivePlan({ sceneUuid: active.sceneUuid,
    nodeUuid: active.nodeUuid, active: false });
  const activeReceipt = await active.api.commitSceneNodeActive({ operationId: activePlan.operationId,
    planHash: activePlan.planHash }, { requestId: 'request-fixture' });
  assert.equal(activeReceipt.status, 'completed');
  assert.equal(activeReceipt.active, false);
  assert.equal(activeReceipt.scenePersistenceConfirmed, true);
  assert.equal(activeReceipt.diskReadback.active, false);
  assert.equal((await active.api.reconcileSceneNodeActive({ operationId: activePlan.operationId })).status, 'completed');

  const rename = makeHarness(t, { sceneRename: true, ipcMode: 'editor' });
  const renamePlan = await rename.api.createSceneNodeRenamePlan({ sceneUuid: rename.sceneUuid,
    nodeUuid: rename.nodeUuid, newName: 'PrimaryButton' });
  const renameReceipt = await rename.api.commitSceneNodeRename({ operationId: renamePlan.operationId,
    planHash: renamePlan.planHash }, { requestId: 'request-fixture' });
  assert.equal(renameReceipt.status, 'completed');
  assert.equal(renameReceipt.after.name, 'PrimaryButton');
  assert.equal(renameReceipt.scenePersistenceConfirmed, true);
  assert.equal(renameReceipt.diskReadback.nodeName, 'PrimaryButton');
  assert.equal(renameReceipt.diskReadback.nodePath, 'Scene/PrimaryButton');
  assert.equal((await rename.api.reconcileSceneNodeRename({ operationId: renamePlan.operationId })).status, 'completed');
});

test('set-active reports save-required when memory changes but the serialized scene stays unchanged', async (t) => {
  const harness = makeHarness(t, { sceneActive: true, sceneSaveMode: 'ignore', ipcMode: 'editor' });
  const plan = await harness.api.createSceneNodeActivePlan({ sceneUuid: harness.sceneUuid,
    nodeUuid: harness.nodeUuid, active: false });
  await assert.rejects(harness.api.commitSceneNodeActive({ operationId: plan.operationId,
    planHash: plan.planHash }, { requestId: 'request-fixture' }),
  (error) => error.code === 'SCENE_DISK_READBACK_UNCONFIRMED');
  const reconciled = await harness.api.reconcileSceneNodeActive({ operationId: plan.operationId });
  assert.equal(reconciled.status, 'save-required');
  assert.equal(reconciled.scenePersistenceConfirmed, false);
  assert.equal(reconciled.observed.disk.matchesBefore, true);
  assert.equal(reconciled.observed.disk.matchesAfter, false);
});

test('scene-node reparent stops if the hierarchy changes during approval and does not replay a cancelled plan', async (t) => {
  let stale;
  stale = makeHarness(t, { sceneReparent: true, ipcMode: 'editor', onApproval() {
    stale.setReparentApplied(true);
  } });
  const plan = await stale.api.createSceneNodeReparentPlan({ sceneUuid: stale.sceneUuid,
    nodeUuid: stale.nodeUuid, targetParentUuid: stale.targetParentUuid });
  await assert.rejects(stale.api.commitSceneNodeReparent({ operationId: plan.operationId, planHash: plan.planHash },
    { requestId: 'request-fixture' }), (error) => error.code === 'OPERATION_PRECONDITION_FAILED');
  assert.equal(stale.getSceneSaveCount(), 0);

  const cancelled = makeHarness(t, { sceneReparent: true, ipcMode: 'editor', approved: false });
  const cancelledPlan = await cancelled.api.createSceneNodeReparentPlan({ sceneUuid: cancelled.sceneUuid,
    nodeUuid: cancelled.nodeUuid, targetParentUuid: cancelled.targetParentUuid });
  await assert.rejects(cancelled.api.commitSceneNodeReparent({ operationId: cancelledPlan.operationId,
    planHash: cancelledPlan.planHash }, { requestId: 'request-fixture' }),
  (error) => error.code === 'OPERATION_NOT_APPROVED');
  assert.equal(cancelled.isReparentApplied(), false);
  assert.equal(cancelled.getSceneSaveCount(), 0);
});

test('existing node transform plan, approval, mutation, save request and reconcile use exact before-state', async (t) => {
  const harness = makeHarness(t, { sceneTransform: true, ipcMode: 'editor' });
  const plan = await harness.api.createSceneNodeTransformPlan({ sceneUuid: harness.sceneUuid,
    nodeUuid: harness.nodeUuid, values: { x: 128, y: -32, angle: 45, width: 320, anchorX: 0 } });
  assert.equal(plan.status, 'planned');
  assert.deepEqual({ ...plan.expectedBefore }, { x: 1, y: 2, angle: 0, width: 50, anchorX: 0.5 });
  assert.deepEqual({ ...plan.expectedAfter }, { x: 128, y: -32, angle: 45, width: 320, anchorX: 0 });
  assert.equal(harness.currentTransform.x, 1);

  const receipt = await harness.api.commitSceneNodeTransform({ operationId: plan.operationId, planHash: plan.planHash },
    { requestId: 'request-fixture' });
  assert.equal(receipt.status, 'completed');
  assert.deepEqual({ ...receipt.after }, { x: 128, y: -32, angle: 45, width: 320, anchorX: 0 });
  assert.equal(receipt.sceneSaveRequestSent, true);
  assert.equal(receipt.sceneSaveCompletionConfirmed, false);
  assert.equal(receipt.scenePersistenceConfirmed, true);
  assert.equal(receipt.diskReadback.verified, true);
  assert.equal(harness.currentTransform.y, -32);
  assert.equal(harness.getSceneSaveCount(), 1);

  const reconciled = await harness.api.reconcileSceneNodeTransform({ operationId: plan.operationId });
  assert.equal(reconciled.status, 'completed');
  assert.deepEqual({ ...reconciled.observed.transform }, { x: 128, y: -32, angle: 45, width: 320, anchorX: 0 });
  assert.equal(reconciled.scenePersistenceConfirmed, true);
});

test('existing node transform reports save-required when memory changes but saved scene does not', async (t) => {
  const harness = makeHarness(t, { sceneTransform: true, sceneSaveMode: 'no-write', ipcMode: 'editor' });
  const plan = await harness.api.createSceneNodeTransformPlan({ sceneUuid: harness.sceneUuid,
    nodeUuid: harness.nodeUuid, values: { x: 128 } });
  await assert.rejects(harness.api.commitSceneNodeTransform({ operationId: plan.operationId, planHash: plan.planHash },
    { requestId: 'request-fixture' }), (error) => error.code === 'SCENE_DISK_READBACK_UNCONFIRMED');
  assert.equal(harness.currentTransform.x, 128);
  assert.equal(harness.getSceneSaveCount(), 1);

  const reconciled = await harness.api.reconcileSceneNodeTransform({ operationId: plan.operationId });
  assert.equal(reconciled.status, 'save-required');
  assert.equal(reconciled.scenePersistenceConfirmed, false);
  assert.equal(reconciled.observed.disk.matchesBefore, true);
  assert.equal(reconciled.observed.disk.matchesAfter, false);
});

test('existing node transform stops on stale approval state and on user cancellation', async (t) => {
  let stale;
  stale = makeHarness(t, { sceneTransform: true, ipcMode: 'editor', onApproval() {
    stale.currentTransform.x = 99;
  } });
  const stalePlan = await stale.api.createSceneNodeTransformPlan({ sceneUuid: stale.sceneUuid,
    nodeUuid: stale.nodeUuid, values: { x: 128 } });
  await assert.rejects(stale.api.commitSceneNodeTransform({ operationId: stalePlan.operationId,
    planHash: stalePlan.planHash }, { requestId: 'request-fixture' }),
  (error) => error.code === 'OPERATION_PRECONDITION_FAILED');
  assert.equal(stale.getSceneSaveCount(), 0);
  assert.equal(stale.currentTransform.x, 99);

  const cancelled = makeHarness(t, { sceneTransform: true, ipcMode: 'editor', approved: false });
  const cancelledPlan = await cancelled.api.createSceneNodeTransformPlan({ sceneUuid: cancelled.sceneUuid,
    nodeUuid: cancelled.nodeUuid, values: { angle: 90 } });
  await assert.rejects(cancelled.api.commitSceneNodeTransform({ operationId: cancelledPlan.operationId,
    planHash: cancelledPlan.planHash }, { requestId: 'request-fixture' }),
  (error) => error.code === 'OPERATION_NOT_APPROVED');
  assert.equal(cancelled.currentTransform.angle, 0);
  assert.equal(cancelled.getSceneSaveCount(), 0);
});

test('existing Button events require an exact plan, native approval, one save request and non-replaying reconcile', async (t) => {
  const harness = makeHarness(t, { sceneButtonEvents: true, ipcMode: 'editor' });
  const events = [{ targetUuid: harness.nodeUuid, component: 'game.ButtonState', handler: 'onClick', customEventData: 'open' }];
  const plan = await harness.api.createSceneButtonEventsPlan({ sceneUuid: harness.sceneUuid,
    nodeUuid: harness.nodeUuid, componentInstanceId: 'button-instance', events });
  assert.equal(plan.status, 'planned');
  assert.deepEqual(Array.from(plan.expectedBefore), []);
  assert.deepEqual(Array.from(plan.expectedAfter, (event) => ({ ...event })), events);
  assert.deepEqual(Array.from(plan.savedSceneBaseline.buttonEvents), []);
  assert.deepEqual(harness.getButtonEvents(), []);

  const receipt = await harness.api.commitSceneButtonEvents({ operationId: plan.operationId, planHash: plan.planHash },
    { requestId: 'request-fixture' });
  assert.equal(receipt.status, 'completed');
  assert.deepEqual(Array.from(receipt.events, (event) => ({ ...event })), events);
  assert.equal(receipt.sceneSaveRequestSent, true);
  assert.equal(receipt.sceneSaveCompletionConfirmed, false);
  assert.equal(receipt.scenePersistenceConfirmed, true);
  assert.deepEqual(Array.from(receipt.diskReadback.buttonEvents, (event) => ({ ...event })), events);
  assert.equal(harness.getSceneSaveCount(), 1);

  const reconciled = await harness.api.reconcileSceneButtonEvents({ operationId: plan.operationId });
  assert.equal(reconciled.status, 'completed');
  assert.deepEqual(Array.from(reconciled.observed.events, (event) => ({ ...event })), events);
  assert.equal(reconciled.observed.disk.matchesAfter, true);
  assert.equal(harness.getSceneSaveCount(), 1);
});

test('Button events report save-required when memory changes but the serialized scene stays unchanged', async (t) => {
  const harness = makeHarness(t, { sceneButtonEvents: true, sceneSaveMode: 'ignore', ipcMode: 'editor' });
  const events = [{ targetUuid: harness.nodeUuid, component: 'game.ButtonState', handler: 'onClick', customEventData: 'open' }];
  const plan = await harness.api.createSceneButtonEventsPlan({ sceneUuid: harness.sceneUuid,
    nodeUuid: harness.nodeUuid, componentInstanceId: 'button-instance', events });

  await assert.rejects(harness.api.commitSceneButtonEvents({ operationId: plan.operationId, planHash: plan.planHash },
    { requestId: 'request-fixture' }), (error) => error.code === 'SCENE_DISK_READBACK_UNCONFIRMED');
  assert.deepEqual(Array.from(harness.getButtonEvents(), (event) => ({ ...event })), events);
  assert.equal(harness.getSceneSaveCount(), 1);

  const reconciled = await harness.api.reconcileSceneButtonEvents({ operationId: plan.operationId });
  assert.equal(reconciled.status, 'save-required');
  assert.equal(reconciled.scenePersistenceConfirmed, false);
  assert.equal(reconciled.observed.disk.matchesBefore, true);
  assert.equal(reconciled.observed.disk.matchesAfter, false);
  assert.equal(harness.getSceneSaveCount(), 1);
});

test('asset move uses AssetDB and preserves file, meta, importer and UUID across rename', async (t) => {
  const harness = makeHarness(t, { assetMove: true });
  const beforeBytes = fs.readFileSync(harness.movableAssetFile);
  const beforeMeta = fs.readFileSync(`${harness.movableAssetFile}.meta`);
  const plan = await harness.api.createAssetMovePlan({ sourceAssetPath: harness.movableAssetPath,
    destinationAssetPath: 'Sprites/Renamed.png' });
  assert.equal(plan.status, 'planned');
  assert.equal(plan.expectedBefore.assetUuid, harness.movableAssetUuid);
  assert.equal(fs.readFileSync(harness.movableAssetFile).equals(beforeBytes), true);

  const receipt = await harness.api.commitAssetMove({ operationId: plan.operationId, planHash: plan.planHash },
    { requestId: 'request-fixture' });
  const destination = path.join(path.dirname(harness.movableAssetFile), 'Renamed.png');
  assert.equal(receipt.status, 'completed');
  assert.equal(receipt.after.assetUuid, harness.movableAssetUuid);
  assert.equal(receipt.after.fileSha256, plan.expectedBefore.fileSha256);
  assert.equal(receipt.after.metaSha256, plan.expectedBefore.metaSha256);
  assert.equal(fs.existsSync(harness.movableAssetFile), false);
  assert.equal(fs.readFileSync(destination).equals(beforeBytes), true);
  assert.equal(fs.readFileSync(`${destination}.meta`).equals(beforeMeta), true);

  const reconciled = await harness.api.reconcileAssetMove({ operationId: plan.operationId });
  assert.equal(reconciled.status, 'completed');
  assert.equal(reconciled.observed.sourcePresent, false);
  assert.equal(reconciled.observed.destinationAssetUuid, harness.movableAssetUuid);
});

test('asset move refuses stale source bytes after approval and cancelled plans leave the source intact', async (t) => {
  let stale;
  stale = makeHarness(t, { assetMove: true, onApproval() {
    fs.writeFileSync(stale.movableAssetFile, Buffer.from('changed-after-plan'));
  } });
  const plan = await stale.api.createAssetMovePlan({ sourceAssetPath: stale.movableAssetPath,
    destinationAssetPath: 'Sprites/Renamed.png' });
  await assert.rejects(stale.api.commitAssetMove({ operationId: plan.operationId, planHash: plan.planHash },
    { requestId: 'request-fixture' }), (error) => error.code === 'ASSET_MOVE_PRECONDITION_FAILED');
  assert.equal(fs.existsSync(stale.movableAssetFile), true);
  assert.equal(fs.existsSync(`${stale.movableAssetFile}.meta`), true);
  assert.equal(fs.existsSync(path.join(path.dirname(stale.movableAssetFile), 'Renamed.png')), false);

  const cancelled = makeHarness(t, { assetMove: true, approved: false });
  const cancelledPlan = await cancelled.api.createAssetMovePlan({ sourceAssetPath: cancelled.movableAssetPath,
    destinationAssetPath: 'Sprites/Renamed.png' });
  await assert.rejects(cancelled.api.commitAssetMove({ operationId: cancelledPlan.operationId,
    planHash: cancelledPlan.planHash }, { requestId: 'request-fixture' }),
  (error) => error.code === 'OPERATION_NOT_APPROVED');
  assert.equal(fs.existsSync(cancelled.movableAssetFile), true);
  assert.equal(fs.existsSync(path.join(path.dirname(cancelled.movableAssetFile), 'Renamed.png')), false);
});

test('asset delete requires a complete no-reference scan, uses AssetDB, and reconciles without replay', async (t) => {
  const harness = makeHarness(t, { assetDelete: true });
  const beforeBytes = fs.readFileSync(harness.deletableAssetFile);
  const beforeMeta = fs.readFileSync(`${harness.deletableAssetFile}.meta`);
  const plan = await harness.api.createAssetDeletePlan({ assetUuid: harness.deletableAssetUuid });
  assert.equal(plan.status, 'planned');
  assert.equal(plan.referenceScan.complete, true);
  assert.equal(plan.referenceScan.referenceCount, 0);
  assert.equal(plan.diff.irreversible, true);
  assert.equal(fs.readFileSync(harness.deletableAssetFile).equals(beforeBytes), true);
  assert.equal(fs.readFileSync(`${harness.deletableAssetFile}.meta`).equals(beforeMeta), true);

  const receipt = await harness.api.commitAssetDelete({ operationId: plan.operationId, planHash: plan.planHash },
    { requestId: 'request-fixture' });
  assert.equal(receipt.status, 'completed');
  assert.equal(receipt.observed.filePresent, false);
  assert.equal(fs.existsSync(harness.deletableAssetFile), false);
  assert.equal(fs.existsSync(`${harness.deletableAssetFile}.meta`), false);
  const reconciled = await harness.api.reconcileAssetDelete({ operationId: plan.operationId });
  assert.equal(reconciled.status, 'completed');
  assert.equal(reconciled.observed.assetPresent, false);
});

test('asset delete refuses references, sub-assets, stale post-approval scans, and cancellation', async (t) => {
  const referenced = makeHarness(t, { assetDelete: true });
  fs.writeFileSync(path.join(referenced.projectRoot, 'assets', 'Scripts', 'UsesTexture.js'),
    `const texture = '${referenced.deletableAssetUuid}';`);
  await assert.rejects(referenced.api.createAssetDeletePlan({ assetUuid: referenced.deletableAssetUuid }),
    (error) => error.code === 'ASSET_DELETE_HAS_REFERENCES');
  assert.equal(fs.existsSync(referenced.deletableAssetFile), true);

  const parentAsset = makeHarness(t, { assetDelete: true, assetDeleteHasSubAssets: true });
  await assert.rejects(parentAsset.api.createAssetDeletePlan({ assetUuid: parentAsset.deletableAssetUuid }),
    (error) => error.code === 'ASSET_DELETE_HAS_SUB_ASSETS');

  const incomplete = makeHarness(t, { assetDelete: true });
  fs.writeFileSync(path.join(incomplete.projectRoot, 'assets', 'oversized-text.json'), Buffer.alloc(1024 * 1024 + 1, 0x61));
  await assert.rejects(incomplete.api.createAssetDeletePlan({ assetUuid: incomplete.deletableAssetUuid }),
    (error) => error.code === 'ASSET_DELETE_REFERENCE_SCAN_INCOMPLETE');

  let stale;
  stale = makeHarness(t, { assetDelete: true, onApproval() {
    fs.writeFileSync(path.join(stale.projectRoot, 'assets', 'Scripts', 'NewReference.ts'),
      `const texture = '${stale.deletableAssetUuid}';`);
  } });
  const plan = await stale.api.createAssetDeletePlan({ assetUuid: stale.deletableAssetUuid });
  await assert.rejects(stale.api.commitAssetDelete({ operationId: plan.operationId, planHash: plan.planHash },
    { requestId: 'request-fixture' }), (error) => error.code === 'ASSET_DELETE_HAS_REFERENCES');
  assert.equal(fs.existsSync(stale.deletableAssetFile), true);

  const cancelled = makeHarness(t, { assetDelete: true, approved: false });
  const cancelledPlan = await cancelled.api.createAssetDeletePlan({ assetUuid: cancelled.deletableAssetUuid });
  await assert.rejects(cancelled.api.commitAssetDelete({ operationId: cancelledPlan.operationId,
    planHash: cancelledPlan.planHash }, { requestId: 'request-fixture' }),
  (error) => error.code === 'OPERATION_NOT_APPROVED');
  assert.equal(fs.existsSync(cancelled.deletableAssetFile), true);
});

test('texture import settings use AssetDB, preserve unrelated metadata, and reconcile without replay', async (t) => {
  const harness = makeHarness(t, { assetTexture: true });
  const beforeMeta = harness.readTextureMeta();
  const beforeSource = fs.readFileSync(harness.textureAssetFile);
  const plan = await harness.api.createTextureImportSettingsPlan({ assetUuid: harness.textureAssetUuid,
    settings: { wrapMode: 'repeat', genMipmaps: true } });
  assert.equal(plan.status, 'planned');
  assert.deepEqual(JSON.parse(JSON.stringify(plan.changedFields)), {
    wrapMode: { before: 'clamp', after: 'repeat' },
    genMipmaps: { before: false, after: true },
  });
  assert.deepEqual(harness.readTextureMeta(), beforeMeta);
  assert.equal(fs.readFileSync(harness.textureAssetFile).equals(beforeSource), true);
  assert.equal(harness.getTextureMetaSaveCount(), 0);

  const receipt = await harness.api.commitTextureImportSettings({ operationId: plan.operationId, planHash: plan.planHash },
    { requestId: 'request-fixture' });
  assert.equal(receipt.status, 'completed');
  assert.equal(receipt.assetUuid, harness.textureAssetUuid);
  assert.deepEqual(JSON.parse(JSON.stringify(receipt.currentSettings)), { wrapMode: 'repeat', genMipmaps: true });
  assert.deepEqual(harness.readTextureMeta(), { ...beforeMeta, wrapMode: 'repeat', genMipmaps: true });
  assert.equal(fs.readFileSync(harness.textureAssetFile).equals(beforeSource), true);
  assert.equal(harness.getTextureMetaSaveCount(), 1);
  const reconciled = await harness.api.reconcileTextureImportSettings({ operationId: plan.operationId });
  assert.equal(reconciled.status, 'completed');
  assert.equal(harness.getTextureMetaSaveCount(), 1);
});

test('texture import settings reject stale or cancelled plans and reconcile an uncertain AssetDB callback without replay', async (t) => {
  let stale;
  stale = makeHarness(t, { assetTexture: true, onApproval() {
    const changed = stale.readTextureMeta();
    changed.userData.preserve = 'changed during approval';
    fs.writeFileSync(`${stale.textureAssetFile}.meta`, JSON.stringify(changed, null, 2));
  } });
  const stalePlan = await stale.api.createTextureImportSettingsPlan({ assetUuid: stale.textureAssetUuid,
    settings: { packable: false } });
  await assert.rejects(stale.api.commitTextureImportSettings({ operationId: stalePlan.operationId,
    planHash: stalePlan.planHash }, { requestId: 'request-fixture' }),
  (error) => error.code === 'ASSET_TEXTURE_SETTINGS_PRECONDITION_FAILED');
  assert.equal(stale.getTextureMetaSaveCount(), 0);

  const cancelled = makeHarness(t, { assetTexture: true, approved: false });
  const cancelledPlan = await cancelled.api.createTextureImportSettingsPlan({ assetUuid: cancelled.textureAssetUuid,
    settings: { filterMode: 'point' } });
  await assert.rejects(cancelled.api.commitTextureImportSettings({ operationId: cancelledPlan.operationId,
    planHash: cancelledPlan.planHash }, { requestId: 'request-fixture' }),
  (error) => error.code === 'OPERATION_NOT_APPROVED');
  assert.equal(cancelled.readTextureMeta().filterMode, 'bilinear');
  assert.equal(cancelled.getTextureMetaSaveCount(), 0);

  const interrupted = makeHarness(t, { assetTexture: true, assetTextureSaveMode: 'callback-error-after-write' });
  const interruptedPlan = await interrupted.api.createTextureImportSettingsPlan({ assetUuid: interrupted.textureAssetUuid,
    settings: { premultiplyAlpha: true } });
  await assert.rejects(interrupted.api.commitTextureImportSettings({ operationId: interruptedPlan.operationId,
    planHash: interruptedPlan.planHash }, { requestId: 'request-fixture' }),
  (error) => error.code === 'OPERATION_RECONCILIATION_REQUIRED');
  assert.equal(interrupted.readTextureMeta().premultiplyAlpha, true);
  const reconciled = await interrupted.api.reconcileTextureImportSettings({ operationId: interruptedPlan.operationId });
  assert.equal(reconciled.status, 'completed');
  assert.equal(interrupted.getTextureMetaSaveCount(), 1);
});

test('Creator AssetDB script modification preserves metadata and reconciles without replay', async (t) => {
  const harness = makeHarness(t);
  const replacement = 'const value = 2;\n';
  const plan = await harness.api.createScriptModifyPlan({ scriptPath: harness.scriptPath,
    expectedSourceSha256: await sourceHash(harness.beforeSource), source: replacement });
  assert.equal(plan.status, 'planned');
  assert.equal(plan.scriptUuid, harness.meta.uuid);
  assert.equal(fs.readFileSync(harness.scriptFile, 'utf8'), harness.beforeSource);

  const receipt = await harness.api.commitScriptModify({ operationId: plan.operationId, planHash: plan.planHash },
    { requestId: 'request-fixture' });
  assert.equal(receipt.status, 'completed');
  assert.equal(receipt.sourceSha256, await sourceHash(replacement));
  assert.equal(receipt.metaSha256, plan.expectedBefore.metaSha256);
  assert.equal(receipt.compile.status, 'pending');
  assert.match(receipt.compile.attribution, /not attributed/);
  assert.equal(fs.readFileSync(harness.scriptFile, 'utf8'), replacement);

  const reconciled = await harness.api.reconcileScriptModify({ operationId: plan.operationId });
  assert.equal(reconciled.status, 'completed');
  assert.equal(reconciled.observed.scriptUuid, harness.meta.uuid);
  assert.equal(fs.readFileSync(harness.metaFile, 'utf8'), JSON.stringify(harness.meta, null, 2));
});

test('script modification rejects stale preconditions and never writes after approval cancellation', async (t) => {
  const stale = makeHarness(t);
  await assert.rejects(stale.api.createScriptModifyPlan({ scriptPath: stale.scriptPath,
    expectedSourceSha256: '0'.repeat(64), source: 'const value = 3;\n' }),
  (error) => error.code === 'SCRIPT_SOURCE_PRECONDITION_FAILED');

  const cancelled = makeHarness(t, { approved: false });
  const plan = await cancelled.api.createScriptModifyPlan({ scriptPath: cancelled.scriptPath,
    expectedSourceSha256: await sourceHash(cancelled.beforeSource), source: 'const value = 4;\n' });
  await assert.rejects(cancelled.api.commitScriptModify({ operationId: plan.operationId, planHash: plan.planHash },
    { requestId: 'request-fixture' }), (error) => error.code === 'OPERATION_NOT_APPROVED');
  assert.equal(fs.readFileSync(cancelled.scriptFile, 'utf8'), cancelled.beforeSource);
});

test('a source change between planning and commit turns the operation into conflict', async (t) => {
  const harness = makeHarness(t);
  const plan = await harness.api.createScriptModifyPlan({ scriptPath: harness.scriptPath,
    expectedSourceSha256: await sourceHash(harness.beforeSource), source: 'const value = 5;\n' });
  fs.writeFileSync(harness.scriptFile, 'const value = 99;\n');
  await assert.rejects(harness.api.commitScriptModify({ operationId: plan.operationId, planHash: plan.planHash },
    { requestId: 'request-fixture' }), (error) => error.code === 'SCRIPT_MODIFY_PRECONDITION_FAILED');
  assert.equal(fs.readFileSync(harness.scriptFile, 'utf8'), 'const value = 99;\n');
});

test('a source change while the native approval dialog is open is rechecked before AssetDB write', async (t) => {
  let harness;
  harness = makeHarness(t, { onApproval() { fs.writeFileSync(harness.scriptFile, 'const value = 88;\n'); } });
  const plan = await harness.api.createScriptModifyPlan({ scriptPath: harness.scriptPath,
    expectedSourceSha256: await sourceHash(harness.beforeSource), source: 'const value = 6;\n' });
  await assert.rejects(harness.api.commitScriptModify({ operationId: plan.operationId, planHash: plan.planHash },
    { requestId: 'request-fixture' }), (error) => error.code === 'SCRIPT_MODIFY_PRECONDITION_FAILED');
  assert.equal(fs.readFileSync(harness.scriptFile, 'utf8'), 'const value = 88;\n');
  assert.equal(harness.getSaveCount(), 0);
});

test('script recompile reports AssetDB completion and correlated script-import-failed errors without changing source or meta', async (t) => {
  const harness = makeHarness(t);
  harness.api.setupDiagnosticListeners();
  const plan = await harness.api.createScriptRecompilePlan({ scriptPath: harness.scriptPath,
    expectedSourceSha256: await sourceHash(harness.beforeSource) });
  assert.equal(plan.status, 'planned');
  const passed = await harness.api.commitScriptRecompile({ operationId: plan.operationId, planHash: plan.planHash },
    { requestId: 'request-fixture' });
  assert.equal(passed.status, 'completed');
  assert.equal(passed.compile.status, 'passed');
  assert.equal(passed.assetDbResult[0].uuid, harness.meta.uuid);
  assert.equal(fs.readFileSync(harness.scriptFile, 'utf8'), harness.beforeSource);
  const reconciled = await harness.api.reconcileScriptRecompile({ operationId: plan.operationId });
  assert.equal(reconciled.status, 'completed');
  assert.equal(reconciled.observed.metaSha256, plan.metaSha256);

  const failed = makeHarness(t, { refreshFailure: 'SyntaxError: unexpected token' });
  failed.api.setupDiagnosticListeners();
  const failedPlan = await failed.api.createScriptRecompilePlan({ scriptPath: failed.scriptPath,
    expectedSourceSha256: await sourceHash(failed.beforeSource) });
  const failedReceipt = await failed.api.commitScriptRecompile({ operationId: failedPlan.operationId,
    planHash: failedPlan.planHash }, { requestId: 'request-fixture' });
  assert.equal(failedReceipt.status, 'failed');
  assert.equal(failedReceipt.compile.status, 'error-observed');
  assert.match(failedReceipt.compile.diagnostics[0].text, /SyntaxError/);
  assert.equal(fs.readFileSync(failed.scriptFile, 'utf8'), failed.beforeSource);
});

test('script recompile remains unconfirmed when AssetDB does not return the exact planned script', async (t) => {
  const harness = makeHarness(t, { refreshResults: [] });
  harness.api.setupDiagnosticListeners();
  const plan = await harness.api.createScriptRecompilePlan({ scriptPath: harness.scriptPath,
    expectedSourceSha256: await sourceHash(harness.beforeSource) });
  const receipt = await harness.api.commitScriptRecompile({ operationId: plan.operationId, planHash: plan.planHash },
    { requestId: 'request-fixture' });
  assert.equal(receipt.status, 'unconfirmed');
  assert.equal(receipt.compile.status, 'unconfirmed');
  assert.equal(fs.readFileSync(harness.scriptFile, 'utf8'), harness.beforeSource);
});

test('asset import uses Creator AssetDB, preserves the selected bytes, and reads generated identity back', async (t) => {
  const harness = makeHarness(t);
  const sourcePath = path.join(harness.projectRoot, '..', 'tank.png');
  const sourceBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
  fs.writeFileSync(sourcePath, sourceBytes);
  fs.mkdirSync(path.join(harness.projectRoot, 'assets', 'Textures'));
  const plan = await harness.api.createAssetImportPlan({ sourcePath, assetPath: 'Textures/tank.png' });
  assert.equal(plan.status, 'planned');
  assert.equal(plan.targetUrl, 'db://assets/Textures/tank.png');
  assert.equal(plan.sourceBytes, sourceBytes.length);
  assert.equal(fs.existsSync(path.join(harness.projectRoot, 'assets', 'Textures', 'tank.png')), false);

  const receipt = await harness.api.commitAssetImport({ operationId: plan.operationId, planHash: plan.planHash },
    { requestId: 'request-fixture' });
  assert.equal(receipt.status, 'completed');
  assert.equal(receipt.assetUuid, harness.importedAssetUuid);
  assert.equal(receipt.importer, 'image');
  assert.equal(receipt.sourceSha256, await sourceHash(sourceBytes));
  assert.match(receipt.metaSha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(fs.readFileSync(path.join(harness.projectRoot, 'assets', 'Textures', 'tank.png')), sourceBytes);
  const reconciled = await harness.api.reconcileAssetImport({ operationId: plan.operationId });
  assert.equal(reconciled.status, 'completed');
  assert.equal(reconciled.observed.assetUuid, harness.importedAssetUuid);
});

test('asset import rechecks source identity after approval and never overwrites a target', async (t) => {
  let harness;
  const sourcePath = path.join(os.tmpdir(), `cocos-import-${Date.now()}-${Math.random()}.png`);
  fs.writeFileSync(sourcePath, Buffer.from('before'));
  t.after(() => { try { fs.unlinkSync(sourcePath); } catch (_) {} });
  harness = makeHarness(t, { onApproval() { fs.writeFileSync(sourcePath, Buffer.from('after')); } });
  fs.mkdirSync(path.join(harness.projectRoot, 'assets', 'Textures'));
  const plan = await harness.api.createAssetImportPlan({ sourcePath, assetPath: 'Textures/tank.png' });
  await assert.rejects(harness.api.commitAssetImport({ operationId: plan.operationId, planHash: plan.planHash },
    { requestId: 'request-fixture' }), (error) => error.code === 'ASSET_IMPORT_SOURCE_CHANGED');
  assert.equal(fs.existsSync(path.join(harness.projectRoot, 'assets', 'Textures', 'tank.png')), false);
});

test('asset import reconciles a callback failure after the AssetDB write without replaying it', async (t) => {
  const harness = makeHarness(t, { assetCreateMode: 'callback-error-after-write' });
  const sourcePath = path.join(harness.projectRoot, '..', 'tank.png');
  fs.writeFileSync(sourcePath, Buffer.from('tank-texture'));
  fs.mkdirSync(path.join(harness.projectRoot, 'assets', 'Textures'));
  const plan = await harness.api.createAssetImportPlan({ sourcePath, assetPath: 'Textures/tank.png' });
  await assert.rejects(harness.api.commitAssetImport({ operationId: plan.operationId, planHash: plan.planHash },
    { requestId: 'request-fixture' }), (error) => error.code === 'OPERATION_RECONCILIATION_REQUIRED');
  const reconciled = await harness.api.reconcileAssetImport({ operationId: plan.operationId });
  assert.equal(reconciled.status, 'completed');
  assert.equal(reconciled.assetUuid, harness.importedAssetUuid);
  assert.equal(reconciled.observed.filePresent, true);
  assert.equal(reconciled.observed.metaPresent, true);
});

test('scene composition reports completion only after the saved .fire and .meta semantically match', async (t) => {
  const harness = makeHarness(t, { sceneCompose: true, ipcMode: 'editor' });
  const input = { sceneUuid: harness.sceneUuid,
    nodes: [{ id: 'button', name: 'StartButton', parentRef: `uuid:${harness.sceneUuid}`,
      transform: { x: 12, y: 20, scaleX: 1.5, scaleY: 0.75, angle: 30, width: 180, height: 64 } }],
    components: [
      { id: 'button-ui', nodeRef: 'new:button', className: 'cc.Button', properties: [] },
      { id: 'handler', nodeRef: 'new:button', className: 'game.ButtonState', properties: [
        { name: 'count', value: 0 },
        { name: 'spriteFrame', value: { assetUuid: harness.spriteUuid, assetClass: 'SpriteFrame' } },
      ] },
    ],
    buttonEvents: [{ buttonRef: 'new:button', handlerRef: 'new:button',
      handlerComponentClassName: 'game.ButtonState', handler: 'onClick', customEventData: 'start' }] };
  const plan = await harness.api.createSceneComposePlan(input);
  assert.equal(plan.status, 'planned');
  assert.equal(plan.assetIdentities[0].assetUuid, harness.spriteUuid);
  assert.equal(fs.existsSync(harness.sceneFile), true);

  const receipt = await harness.api.commitSceneCompose({ operationId: plan.operationId, planHash: plan.planHash },
    { requestId: 'request-fixture' });
  assert.equal(receipt.status, 'completed');
  assert.equal(receipt.sceneSaveRequestSent, true);
  assert.equal(receipt.sceneSaveCompletionConfirmed, false);
  assert.equal(receipt.scenePersistenceConfirmed, true);
  assert.deepEqual({ nodes: receipt.scenePersistenceReadback.nodeCount,
    components: receipt.scenePersistenceReadback.componentCount,
    events: receipt.scenePersistenceReadback.buttonEventCount }, { nodes: 1, components: 2, events: 1 });
  assert.equal(harness.getSceneSaveCount(), 1);

  const reconciled = await harness.api.reconcileSceneCompose({ operationId: plan.operationId });
  assert.equal(reconciled.status, 'completed');
  assert.equal(reconciled.observed.verified, true);
});

test('Prefab creation routes through the Creator Scene panel and reads its AssetDB identity back', async (t) => {
  const harness = makeHarness(t, { ipcMode: 'editor' });
  fs.mkdirSync(path.join(harness.projectRoot, 'assets', 'Prefabs'));
  const plan = await harness.api.createPrefabPlan({ sceneUuid: harness.sceneUuid,
    nodeUuid: harness.nodeUuid, prefabPath: 'Prefabs/Button.prefab' });
  assert.equal(plan.status, 'planned');
  assert.equal(plan.targetUrl, 'db://assets/Prefabs/Button.prefab');
  assert.equal(fs.existsSync(path.join(harness.projectRoot, 'assets', 'Prefabs', 'Button.prefab')), false);

  const receipt = await harness.api.commitPrefabCreate({ operationId: plan.operationId, planHash: plan.planHash },
    { requestId: 'request-fixture' });
  assert.equal(receipt.status, 'completed');
  assert.equal(receipt.assetUuid, harness.prefabAssetUuid);
  assert.equal(receipt.importer, 'prefab');
  assert.equal(receipt.semanticSummary.nodeCount, 1);
  assert.equal(receipt.semanticSummary.typeCounts['cc.Button'], 1);
  const reconciled = await harness.api.reconcilePrefabCreate({ operationId: plan.operationId });
  assert.equal(reconciled.status, 'completed');
  assert.equal(reconciled.observed.assetUuid, harness.prefabAssetUuid);
});

test('scene subtree deletion and component removal require approval, save once, and reconcile without replay', async (t) => {
  const deletion = makeHarness(t, { sceneNodeDelete: true, ipcMode: 'editor' });
  const nodePlan = await deletion.api.createSceneNodeDeletePlan({ sceneUuid: deletion.sceneUuid, nodeUuid: deletion.nodeUuid });
  assert.equal(nodePlan.status, 'planned');
  assert.equal(nodePlan.diff.directChildren, 2);
  assert.equal(nodePlan.diff.subtreeNodeCount, 3);
  const deleted = await deletion.api.commitSceneNodeDelete({ operationId: nodePlan.operationId, planHash: nodePlan.planHash },
    { requestId: 'delete-request' });
  assert.equal(deleted.status, 'completed');
  assert.equal(deleted.action, 'delete-node-subtree');
  assert.equal(deleted.sceneSaveRequestSent, true);
  assert.equal(deleted.sceneSaveCompletionConfirmed, false);
  assert.equal(deletion.isSceneNodeDeleted(), true);
  const deleteReconcile = await deletion.api.reconcileSceneNodeDelete({ operationId: nodePlan.operationId });
  assert.equal(deleteReconcile.status, 'completed');
  assert.equal(deletion.getSceneSaveCount(), 1);

  const removal = makeHarness(t, { sceneComponentRemove: true, ipcMode: 'editor' });
  const componentPlan = await removal.api.createSceneComponentRemovePlan({ sceneUuid: removal.sceneUuid,
    nodeUuid: removal.nodeUuid, componentClassName: 'cc.Sprite', componentInstanceId: 'sprite-instance' });
  const removed = await removal.api.commitSceneComponentRemove({ operationId: componentPlan.operationId,
    planHash: componentPlan.planHash }, { requestId: 'remove-request' });
  assert.equal(removed.status, 'completed');
  assert.equal(removed.action, 'remove-component');
  assert.equal(removed.componentInstanceId, 'sprite-instance');
  assert.equal(removed.sceneSaveCompletionConfirmed, false);
  assert.equal(removal.isSceneComponentRemoved(), true);
  const removeReconcile = await removal.api.reconcileSceneComponentRemove({ operationId: componentPlan.operationId });
  assert.equal(removeReconcile.status, 'completed');
  assert.equal(removal.getSceneSaveCount(), 1);
});

test('component-property plans preserve typed before/after values and reject kind or resource-class changes', async (t) => {
  const vector = makeHarness(t, { sceneProperty: { propertyKind: 'vec2', value: { kind: 'vec2', x: 1, y: 2 } } });
  const request = { sceneUuid: vector.sceneUuid, nodeUuid: vector.nodeUuid, componentClassName: 'cc.Sprite',
    componentInstanceId: 'sprite-instance', property: 'position', value: { kind: 'vec2', y: 4, x: 3 } };
  const plan = await vector.api.createSceneComponentPropertyPlan(request);
  assert.equal(plan.status, 'planned');
  assert.equal(plan.propertyKind, 'vec2');
  assert.deepEqual(JSON.parse(JSON.stringify(plan.expectedBefore.value)), { kind: 'vec2', x: 1, y: 2 });
  assert.deepEqual(JSON.parse(JSON.stringify(plan.expectedAfter.value)), { kind: 'vec2', y: 4, x: 3 });

  await assert.rejects(vector.api.createSceneComponentPropertyPlan({ ...request,
    value: { kind: 'vec3', x: 3, y: 4, z: 5 } }), { code: 'SCENE_COMPONENT_PROPERTY_TYPE_MISMATCH' });

  const asset = makeHarness(t, { sceneProperty: { propertyKind: 'asset',
    value: { kind: 'asset', assetClass: 'SpriteFrame' } } });
  const assetPlan = await asset.api.createSceneComponentPropertyPlan({ sceneUuid: asset.sceneUuid,
    nodeUuid: asset.nodeUuid, componentClassName: 'cc.Sprite', componentInstanceId: 'sprite-instance',
    property: 'spriteFrame', value: { kind: 'asset', assetClass: 'SpriteFrame',
      assetUuid: '44444444-4444-4444-8444-444444444444' } });
  assert.equal(assetPlan.expectedBefore.value.assetUuid, undefined);
  await assert.rejects(asset.api.createSceneComponentPropertyPlan({ sceneUuid: asset.sceneUuid,
    nodeUuid: asset.nodeUuid, componentClassName: 'cc.Sprite', componentInstanceId: 'sprite-instance',
    property: 'spriteFrame', value: { kind: 'asset', assetClass: 'Texture2D',
      assetUuid: '55555555-5555-4555-8555-555555555555' } }),
  { code: 'SCENE_COMPONENT_PROPERTY_TYPE_MISMATCH' });
});
