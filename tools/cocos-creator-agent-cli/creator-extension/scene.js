'use strict';

const crypto = require('crypto');
const prefabPatch = require('./prefab-patch.cjs');

const MAX_NODES = 100;
const MAX_DEPTH = 6;
const MAX_NAME = 120;
const MAX_MUTATION_SCAN_NODES = 10000;
const MAX_MUTATION_SCAN_DEPTH = 64;
const MAX_COMPONENT_INSTANCES = 32;
const MAX_DELETE_SUBTREE_NODES = 256;
const MAX_PREFAB_INSTANCE_NODES = 256;
const UI_COMPONENT_CLASS_NAMES = new Set([
    'cc.Canvas', 'cc.Widget', 'cc.Layout', 'cc.Sprite', 'cc.Label', 'cc.Button',
    'cc.Toggle', 'cc.ToggleContainer', 'cc.Slider', 'cc.ProgressBar', 'cc.EditBox', 'cc.RichText',
    'cc.ScrollView', 'cc.Scrollbar', 'cc.Mask', 'cc.PageView', 'cc.PageViewIndicator', 'cc.BlockInputEvents',
]);
const UI_EVENT_PROPERTIES = Object.freeze({
    'cc.Button': ['clickEvents'],
    'cc.Toggle': ['checkEvents'],
    'cc.ToggleContainer': ['checkEvents'],
    'cc.Slider': ['slideEvents'],
    'cc.ScrollView': ['scrollEvents'],
    'cc.PageView': ['pageEvents'],
    'cc.EditBox': ['editingDidBegan', 'textChanged', 'editingDidEnded', 'editingReturn'],
});
const MAX_UI_COMPONENTS_PER_NODE = 16;
const MAX_UI_PROPERTIES_PER_COMPONENT = 48;

function editorManaged(object) {
    const flags = cc && cc.Object && cc.Object.Flags;
    if (!flags || typeof flags.DontSave !== 'number' || typeof flags.HideInHierarchy !== 'number')
        throw new Error('SCENE_AUTHORING_FLAGS_UNAVAILABLE');
    return !!(object && (object._objFlags & (flags.DontSave | flags.HideInHierarchy)));
}

function authoringChildren(node) {
    return (Array.isArray(node.children) ? node.children : []).filter((child) => child && !editorManaged(child));
}

function classNameOf(value) {
    const constructor = value && value.constructor;
    const name = constructor && cc && cc.js && typeof cc.js.getClassName === 'function'
        ? cc.js.getClassName(constructor) : constructor && constructor.name;
    return typeof name === 'string' && name ? name.slice(0, MAX_NAME) : null;
}

function serializedClassIdOf(constructor) {
    return cc && cc.js && typeof cc.js._getClassId === 'function'
        ? cc.js._getClassId(constructor, false) : null;
}

function ownDataValue(object, key) {
    if (!object || (typeof object !== 'object' && typeof object !== 'function')) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value') ? descriptor.value : undefined;
}

function semanticPropertyValue(value, depth = 0) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean')
        return typeof value === 'string' ? value.slice(0, 512) : value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (!value || typeof value !== 'object' || depth > 2) return null;
    const className = classNameOf(value);
    const assetUuid = typeof value._uuid === 'string' ? value._uuid : null;
    if (assetUuid) return { assetUuid, assetClass: className };
    if (Array.isArray(value)) {
        const result = [];
        const count = Math.min(value.length, 16);
        for (let index = 0; index < count; index += 1) {
            const item = ownDataValue(value, String(index));
            result.push(semanticPropertyValue(item, depth + 1));
        }
        return result;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return { objectClass: className };
    const result = {};
    for (const key of Object.keys(value).sort().slice(0, 12)) {
        if (!/^[$A-Za-z][A-Za-z0-9_$]{0,63}$/.test(key)) continue;
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) continue;
        const next = semanticPropertyValue(descriptor.value, depth + 1);
        if (next !== null) result[key] = next;
    }
    return result;
}

function componentSemanticDetail(component, index) {
    const className = classNameOf(component);
    const properties = {};
    const names = component && component.constructor && Array.isArray(component.constructor.__props__)
        ? component.constructor.__props__ : [];
    for (const property of names.slice(0, 48)) {
        if (typeof property !== 'string' || property.startsWith('_')
            || !/^[$A-Za-z][A-Za-z0-9_$]{0,63}$/.test(property)) continue;
        const descriptor = Object.getOwnPropertyDescriptor(component, property);
        if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) continue;
        properties[property] = semanticPropertyValue(descriptor.value);
    }
    const detail = { index, className, properties };
    const clickEvents = ownDataValue(component, 'clickEvents');
    if (Array.isArray(clickEvents)) {
        detail.clickEvents = [];
        const count = Math.min(clickEvents.length, 32);
        for (let eventIndex = 0; eventIndex < count; eventIndex += 1) {
            const event = ownDataValue(clickEvents, String(eventIndex));
            const target = ownDataValue(event, 'target');
            const targetUuid = ownDataValue(target, 'uuid');
            const eventComponent = ownDataValue(event, 'component');
            const handler = ownDataValue(event, 'handler');
            const customEventData = ownDataValue(event, 'customEventData');
            detail.clickEvents.push({
                targetUuid: typeof targetUuid === 'string' ? targetUuid : null,
                component: typeof eventComponent === 'string' ? eventComponent.slice(0, MAX_NAME) : '',
                handler: typeof handler === 'string' ? handler.slice(0, MAX_NAME) : '',
                customEventData: typeof customEventData === 'string' ? customEventData.slice(0, 512) : '',
            });
        }
    }
    return detail;
}

function transformSummary(node) {
    const fields = ['x', 'y', 'z', 'scaleX', 'scaleY', 'angle', 'width', 'height', 'anchorX', 'anchorY'];
    const result = {};
    for (const field of fields) {
        const value = node && node[field];
        if (typeof value === 'number' && Number.isFinite(value)) result[field] = value;
    }
    return result;
}

const TRANSFORM_FIELDS = new Set(['x', 'y', 'z', 'scaleX', 'scaleY', 'angle', 'width', 'height', 'anchorX', 'anchorY']);

function validTransformValue(field, value) {
    return Number.isFinite(value) && Math.abs(value) <= 1000000
        && (!['width', 'height'].includes(field) || value >= 0);
}

function nodeTransformState(params) {
    if (!params || typeof params.sceneUuid !== 'string' || typeof params.nodeUuid !== 'string')
        return { available: false, reason: 'SCENE_NODE_TRANSFORM_INPUT_INVALID' };
    const located = locateNode(params.sceneUuid, params.nodeUuid);
    if (!located.state.available) return located.state;
    const transform = transformSummary(located.node);
    if (!Object.keys(transform).length) return { ...located.state, available: false, reason: 'SCENE_NODE_TRANSFORM_UNAVAILABLE' };
    if (params.values !== undefined) {
        if (!params.values || typeof params.values !== 'object' || Array.isArray(params.values)
            || Object.keys(params.values).length < 1 || Object.keys(params.values).length > TRANSFORM_FIELDS.size
            || Object.keys(params.values).some((key) => !TRANSFORM_FIELDS.has(key)))
            return { ...located.state, available: false, reason: 'SCENE_NODE_TRANSFORM_FIELDS_INVALID', transform };
        for (const [field, value] of Object.entries(params.values)) {
            if (!Object.prototype.hasOwnProperty.call(transform, field) || !validTransformValue(field, value))
                return { ...located.state, available: false, reason: 'SCENE_NODE_TRANSFORM_VALUE_INVALID', field, transform };
        }
    }
    return { ...located.state, transform,
        ...(params.values === undefined ? {} : { requested: { ...params.values },
            changed: Object.keys(params.values).some((field) => transform[field] !== params.values[field]) }) };
}

function setNodeTransform(params) {
    if (!params || typeof params.sceneUuid !== 'string' || typeof params.nodeUuid !== 'string'
        || typeof params.nodePath !== 'string' || !params.expectedBefore || !params.values
        || typeof params.expectedBefore !== 'object' || typeof params.values !== 'object'
        || Array.isArray(params.expectedBefore) || Array.isArray(params.values))
        return { available: false, reason: 'SCENE_NODE_TRANSFORM_INPUT_INVALID' };
    const before = nodeTransformState({ sceneUuid: params.sceneUuid, nodeUuid: params.nodeUuid });
    if (!before.available) return before;
    if (before.nodePath !== params.nodePath) return { ...before, available: false, reason: 'SCENE_NODE_PATH_MISMATCH' };
    const fields = Object.keys(params.values).sort();
    if (!fields.length || fields.length !== Object.keys(params.expectedBefore).length
        || fields.some((field, index) => field !== Object.keys(params.expectedBefore).sort()[index]
            || !TRANSFORM_FIELDS.has(field) || !validTransformValue(field, params.values[field])
            || !Number.isFinite(params.expectedBefore[field]) || Math.abs(params.expectedBefore[field]) > 1000000))
        return { ...before, available: false, reason: 'SCENE_NODE_TRANSFORM_FIELDS_INVALID' };
    for (const field of fields) {
        if (!Object.prototype.hasOwnProperty.call(before.transform, field) || before.transform[field] !== params.expectedBefore[field])
            return { ...before, available: false, reason: 'SCENE_NODE_TRANSFORM_PRECONDITION_FAILED', field };
        if (before.transform[field] === params.values[field])
            return { ...before, available: false, reason: 'SCENE_NODE_TRANSFORM_NO_CHANGE', field };
    }
    const located = locateNode(params.sceneUuid, params.nodeUuid);
    if (!located.node) return { ...before, available: false, reason: 'SCENE_NODE_NOT_FOUND' };
    let mutationStarted = false;
    try {
        for (const field of fields) {
            mutationStarted = true;
            located.node[field] = params.values[field];
        }
    } catch (error) {
        return { ...before, available: false, reason: 'SCENE_NODE_TRANSFORM_SETTER_FAILED',
            mutationStarted, error: String(error && error.message || error), transform: transformSummary(located.node) };
    }
    const after = nodeTransformState({ sceneUuid: params.sceneUuid, nodeUuid: params.nodeUuid });
    if (!after.available || fields.some((field) => after.transform[field] !== params.values[field]))
        return { ...after, available: false, reason: 'SCENE_NODE_TRANSFORM_READBACK_FAILED', mutationStarted: true };
    return { available: true, sceneUuid: params.sceneUuid, nodeUuid: params.nodeUuid, nodePath: params.nodePath,
        before: Object.fromEntries(fields.map((field) => [field, before.transform[field]])),
        after: Object.fromEntries(fields.map((field) => [field, after.transform[field]])), transform: after.transform };
}

function normalizedButtonEvents(button) {
    if (!button || !Array.isArray(button.clickEvents) || button.clickEvents.length > 12)
        return { available: false, reason: 'SCENE_BUTTON_EVENT_LIMIT' };
    return { available: true, events: button.clickEvents.map((event) => ({
        targetUuid: event && event.target && typeof event.target.uuid === 'string' ? event.target.uuid : null,
        component: event && typeof event.component === 'string' ? event.component : '',
        handler: event && typeof event.handler === 'string' ? event.handler : '',
        customEventData: event && typeof event.customEventData === 'string' ? event.customEventData : '',
    })) };
}

function normalizedUiEvents(component, property) {
    const rawEvents = component && component[property];
    if (!Array.isArray(rawEvents) || rawEvents.length > 12)
        return { available: false, reason: 'SCENE_UI_EVENT_LIMIT' };
    const events = [];
    for (const event of rawEvents) {
        const target = event && event.target;
        if (!event || (target != null && (!cc.Node || !(target instanceof cc.Node)))
            || (event.component != null && typeof event.component !== 'string')
            || (event.handler != null && typeof event.handler !== 'string')
            || (event.customEventData != null && typeof event.customEventData !== 'string'))
            return { available: false, reason: 'SCENE_UI_EVENT_ENTRY_INVALID' };
        events.push({ targetUuid: target && typeof target.uuid === 'string' ? target.uuid : null,
            component: typeof event.component === 'string' ? event.component.slice(0, 120) : '',
            handler: typeof event.handler === 'string' ? event.handler.slice(0, 64) : '',
            customEventData: typeof event.customEventData === 'string' ? event.customEventData.slice(0, 512) : '' });
    }
    return { available: true, events };
}

function buttonEventsState(params) {
    if (!params || typeof params.sceneUuid !== 'string' || typeof params.nodeUuid !== 'string'
        || typeof params.nodePath !== 'string' || typeof params.componentInstanceId !== 'string')
        return { available: false, reason: 'SCENE_BUTTON_EVENTS_INPUT_INVALID' };
    const located = locateNode(params.sceneUuid, params.nodeUuid);
    if (!located.state.available) return located.state;
    if (located.state.nodePath !== params.nodePath) return { ...located.state, available: false, reason: 'SCENE_NODE_PATH_MISMATCH' };
    const buttonClass = componentClass('cc.Button');
    if (!buttonClass.available) return buttonClass;
    const query = exactComponentInstances(located.node, buttonClass.constructor);
    if (!query.available) return query;
    const button = query.components.find((item) => item && item._id != null
        && String(item._id) === params.componentInstanceId && cc.isValid(item, true));
    if (!button) return { ...located.state, available: false, reason: 'SCENE_BUTTON_INSTANCE_NOT_FOUND' };
    const current = normalizedButtonEvents(button);
    if (!current.available) return { ...located.state, ...current };
    if (params.events === undefined) return { ...located.state, componentClassName: 'cc.Button',
        componentInstanceId: params.componentInstanceId, events: current.events };
    if (!Array.isArray(params.events) || params.events.length > 12)
        return { ...located.state, available: false, reason: 'SCENE_BUTTON_EVENT_INPUT_INVALID' };
    for (const event of params.events) {
        if (!event || typeof event !== 'object' || Array.isArray(event)
            || Object.keys(event).sort().join(',') !== 'component,customEventData,handler,targetUuid'
            || !validUuid(event.targetUuid) || typeof event.component !== 'string' || event.component.length > MAX_NAME
            || !/^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/.test(event.handler)
            || typeof event.customEventData !== 'string' || event.customEventData.length > 512)
            return { ...located.state, available: false, reason: 'SCENE_BUTTON_EVENT_INVALID' };
        const target = locateNode(params.sceneUuid, event.targetUuid);
        if (!target.state.available) return { ...located.state, available: false, reason: 'SCENE_BUTTON_EVENT_TARGET_UNAVAILABLE', targetReason: target.state.reason };
        const handlerClass = componentClass(event.component);
        if (!handlerClass.available) return { ...located.state, available: false, reason: handlerClass.reason };
        const handlerComponents = exactComponentInstances(target.node, handlerClass.constructor);
        if (!handlerComponents.available || handlerComponents.components.length !== 1)
            return { ...located.state, available: false, reason: handlerComponents.reason || 'SCENE_BUTTON_HANDLER_COMPONENT_AMBIGUOUS' };
        if (!hasSafeComponentHandler(handlerClass.constructor, event.handler))
            return { ...located.state, available: false, reason: 'SCENE_COMPOSE_HANDLER_NOT_FOUND', handler: event.handler };
    }
    return { ...located.state, componentClassName: 'cc.Button', componentInstanceId: params.componentInstanceId,
        events: current.events, requestedEvents: params.events,
        changed: !sameValue(current.events, params.events) };
}

function setButtonEvents(params) {
    if (!params || !Array.isArray(params.expectedBefore) || !Array.isArray(params.events))
        return { available: false, reason: 'SCENE_BUTTON_EVENTS_INPUT_INVALID' };
    const before = buttonEventsState({ sceneUuid: params.sceneUuid, nodeUuid: params.nodeUuid,
        nodePath: params.nodePath, componentInstanceId: params.componentInstanceId });
    if (!before.available) return before;
    if (!sameValue(before.events, params.expectedBefore))
        return { ...before, available: false, reason: 'SCENE_BUTTON_EVENTS_PRECONDITION_FAILED' };
    if (sameValue(before.events, params.events))
        return { ...before, available: false, reason: 'SCENE_BUTTON_EVENTS_NO_CHANGE' };
    const validated = buttonEventsState({ sceneUuid: params.sceneUuid, nodeUuid: params.nodeUuid,
        nodePath: params.nodePath, componentInstanceId: params.componentInstanceId, events: params.events });
    if (!validated.available) return validated;
    if (typeof cc.Component.EventHandler !== 'function')
        return { ...before, available: false, reason: 'SCENE_BUTTON_EVENT_HANDLER_UNAVAILABLE' };
    const located = locateNode(params.sceneUuid, params.nodeUuid);
    const buttonClass = componentClass('cc.Button');
    const button = exactComponentInstances(located.node, buttonClass.constructor).components
        .find((item) => String(item._id) === params.componentInstanceId);
    const eventHandlers = params.events.map((event) => {
        const target = locateNode(params.sceneUuid, event.targetUuid).node;
        const handler = new cc.Component.EventHandler();
        handler.target = target;
        handler.component = event.component;
        handler.handler = event.handler;
        handler.customEventData = event.customEventData;
        return handler;
    });
    let mutationStarted = false;
    try {
        mutationStarted = true;
        button.clickEvents = eventHandlers;
    } catch (error) {
        return { ...before, available: false, reason: 'SCENE_BUTTON_EVENTS_WRITE_FAILED', mutationStarted,
            error: String(error && error.message || error) };
    }
    const after = normalizedButtonEvents(button);
    if (!after.available || !sameValue(after.events, params.events))
        return { ...before, available: false, reason: 'SCENE_BUTTON_EVENTS_READBACK_FAILED', mutationStarted: true,
            observedEvents: after.events || null };
    return { available: true, sceneUuid: params.sceneUuid, nodeUuid: params.nodeUuid, nodePath: params.nodePath,
        componentInstanceId: params.componentInstanceId, before: before.events, events: after.events };
}

function snapshot(maxNodes) {
    const scene = cc && cc.director && cc.director.getScene && cc.director.getScene();
    if (!scene) return { available: false, reason: 'NO_ACTIVE_SCENE', sceneName: null, sceneUuid: null, nodes: [] };
    if (editorManaged(scene)) return { available: false, reason: 'NO_AUTHORING_SCENE', sceneName: null, sceneUuid: null, nodes: [] };
    const limit = Number.isInteger(maxNodes) && maxNodes > 0 ? Math.min(maxNodes, MAX_NODES) : MAX_NODES;
    const nodes = [];
    let truncated = false;
    function visit(node, parentPath, parentUuid, depth) {
        if (!node || nodes.length >= limit || depth > MAX_DEPTH) { truncated = true; return; }
        const name = String(node.name || '').slice(0, MAX_NAME);
        const nodePath = parentPath ? `${parentPath}/${name}` : name;
        const components = typeof node.getComponents === 'function' && cc.Component ? node.getComponents(cc.Component) : [];
        const children = authoringChildren(node);
        const componentRows = Array.isArray(components) ? components.filter((item) => !editorManaged(item)) : [];
        nodes.push({ name, path: nodePath, uuid: typeof node.uuid === 'string' ? node.uuid : null,
            parentUuid: typeof parentUuid === 'string' ? parentUuid : null,
            active: node.active !== false, children: children.length,
            transform: transformSummary(node),
            components: componentRows.map((item) => classNameOf(item)).filter((item) => typeof item === 'string').slice(0, 16),
            componentDetails: componentRows.slice(0, 16).map((item, index) => componentSemanticDetail(item, index)) });
        for (const child of children) {
            if (nodes.length >= limit) { truncated = true; break; }
            visit(child, nodePath, node.uuid, depth + 1);
        }
    }
    visit(scene, '', null, 0);
    return { available: true, scope: 'authoring', editorHelpersExcluded: true, sceneName: String(scene.name || '').slice(0, MAX_NAME),
        sceneUuid: typeof scene.uuid === 'string' ? scene.uuid : null,
        nodeCount: nodes.length, truncated, nodes };
}

function locateNode(sceneUuid, nodeUuid) {
    const scene = cc && cc.director && cc.director.getScene && cc.director.getScene();
    if (!scene) return { state: { available: false, reason: 'NO_ACTIVE_SCENE' }, node: null };
    if (editorManaged(scene)) return { state: { available: false, reason: 'NO_AUTHORING_SCENE' }, node: null };
    if (typeof scene.uuid !== 'string' || scene.uuid !== sceneUuid)
        return { state: { available: false, reason: 'SCENE_IDENTITY_MISMATCH', sceneUuid: scene.uuid || null }, node: null };
    const stack = [{ node: scene, parentPath: '', depth: 0 }];
    let visited = 0;
    let truncated = false;
    const matches = [];
    while (stack.length) {
        const item = stack.pop();
        if (!item.node || item.depth > MAX_MUTATION_SCAN_DEPTH || visited >= MAX_MUTATION_SCAN_NODES) {
            truncated = true;
            continue;
        }
        visited += 1;
        const name = String(item.node.name || '').slice(0, MAX_NAME);
        const nodePath = item.parentPath ? `${item.parentPath}/${name}` : name;
        if (item.node.uuid === nodeUuid) matches.push({ node: item.node, path: nodePath });
        const children = authoringChildren(item.node);
        for (let index = children.length - 1; index >= 0; index -= 1) {
            if (item.depth >= MAX_MUTATION_SCAN_DEPTH || visited + stack.length >= MAX_MUTATION_SCAN_NODES) {
                truncated = true;
                break;
            }
            stack.push({ node: children[index], parentPath: nodePath, depth: item.depth + 1 });
        }
    }
    if (truncated) return { state: { available: false, reason: 'SCENE_SEARCH_LIMIT', sceneUuid: scene.uuid, visited }, node: null };
    if (matches.length === 0) return { state: { available: false, reason: 'SCENE_NODE_NOT_FOUND', sceneUuid: scene.uuid, visited }, node: null };
    if (matches.length !== 1) return { state: { available: false, reason: 'SCENE_NODE_UUID_AMBIGUOUS', sceneUuid: scene.uuid, visited }, node: null };
    const match = matches[0];
    if (match.path.length > 2048)
        return { state: { available: false, reason: 'SCENE_NODE_PATH_TOO_LONG', sceneUuid: scene.uuid, visited }, node: null };
    if (typeof match.node.active !== 'boolean')
        return { state: { available: false, reason: 'SCENE_NODE_ACTIVE_STATE_INVALID', sceneUuid: scene.uuid, visited }, node: null };
    const componentsAvailable = typeof match.node.getComponents === 'function' && !!cc.Component;
    const allComponents = componentsAvailable ? match.node.getComponents(cc.Component) : [];
    const components = Array.isArray(allComponents) ? allComponents.filter((item) => !editorManaged(item)) : [];
    const children = authoringChildren(match.node);
    const componentRows = components.slice(0, 32).map((component) => {
        const constructor = component && component.constructor;
        const className = constructor && cc.js && typeof cc.js.getClassName === 'function'
            ? cc.js.getClassName(constructor) : constructor && constructor.name;
        return { componentClassName: typeof className === 'string' ? className.slice(0, MAX_NAME) : null,
            serializedClassId: serializedClassIdOf(constructor),
            componentInstanceId: component && component._id != null ? String(component._id).slice(0, 128) : null };
    });
    return { node: match.node, state: { available: true, sceneName: String(scene.name || '').slice(0, MAX_NAME), sceneUuid: scene.uuid,
        nodeName: String(match.node.name || '').slice(0, MAX_NAME), nodeUuid: match.node.uuid,
        parentUuid: match.node.parent && typeof match.node.parent.uuid === 'string' ? match.node.parent.uuid : null,
        nodePath: match.path, active: match.node.active, children: children.length,
        componentsAvailable: componentsAvailable && Array.isArray(allComponents),
        componentCount: components.length, components: componentRows, componentsTruncated: components.length > componentRows.length, visited } };
}

function findNode(sceneUuid, nodeUuid) {
    return locateNode(sceneUuid, nodeUuid).state;
}

function nodeState(params) {
    const located = locateNode(params && params.sceneUuid, params && params.nodeUuid);
    if (!located.state.available) return located.state;
    return { ...located.state, transform: transformSummary(located.node) };
}

function prefabInstanceState(params) {
    if (!params || typeof params.sceneUuid !== 'string' || typeof params.nodeUuid !== 'string')
        return { available: false, reason: 'SCENE_PREFAB_INSTANCE_INPUT_INVALID' };
    const selected = locateNode(params.sceneUuid, params.nodeUuid);
    if (!selected.state.available) return selected.state;
    const selectedInfo = ownDataValue(selected.node, '_prefab');
    if (!selectedInfo || typeof selectedInfo !== 'object')
        return { available: true, linked: false, sceneName: selected.state.sceneName, sceneUuid: params.sceneUuid,
            nodeUuid: params.nodeUuid, nodePath: selected.state.nodePath, nodeName: selected.state.nodeName };
    const root = ownDataValue(selectedInfo, 'root') || selected.node;
    const rootUuid = root && typeof root.uuid === 'string' ? root.uuid : null;
    if (!rootUuid) return { available: false, reason: 'SCENE_PREFAB_INSTANCE_ROOT_IDENTITY_INVALID' };
    const locatedRoot = locateNode(params.sceneUuid, rootUuid);
    if (!locatedRoot.state.available || locatedRoot.node !== root)
        return { available: false, reason: 'SCENE_PREFAB_INSTANCE_ROOT_NOT_IN_SCENE' };
    const rootInfo = ownDataValue(root, '_prefab');
    if (!rootInfo || typeof rootInfo !== 'object' || (ownDataValue(rootInfo, 'root') || root) !== root)
        return { available: false, reason: 'SCENE_PREFAB_INSTANCE_ROOT_LINK_INVALID' };
    const asset = ownDataValue(rootInfo, 'asset');
    const prefabUuid = asset && (ownDataValue(asset, '_uuid') || ownDataValue(asset, 'uuid'));
    if (typeof prefabUuid !== 'string' || !prefabPatch.UUID.test(prefabUuid))
        return { available: false, reason: 'SCENE_PREFAB_INSTANCE_ASSET_IDENTITY_INVALID' };

    const nodes = [];
    const visited = new Set();
    const stack = [{ node: root, parentPath: '', parentUuid: null, depth: 0 }];
    while (stack.length) {
        const item = stack.pop();
        const node = item.node;
        if (!node || visited.has(node) || item.depth > MAX_MUTATION_SCAN_DEPTH)
            return { available: false, reason: 'SCENE_PREFAB_INSTANCE_HIERARCHY_INVALID' };
        visited.add(node);
        if (nodes.length >= MAX_PREFAB_INSTANCE_NODES)
            return { available: false, reason: 'SCENE_PREFAB_INSTANCE_NODE_LIMIT', maxNodes: MAX_PREFAB_INSTANCE_NODES };
        const nodeUuid = typeof node.uuid === 'string' ? node.uuid : null;
        const nodeName = typeof node.name === 'string' ? node.name.slice(0, MAX_NAME) : '';
        if (!nodeUuid || !nodeName) return { available: false, reason: 'SCENE_PREFAB_INSTANCE_NODE_IDENTITY_INVALID' };
        const nodePath = item.parentPath ? `${item.parentPath}/${nodeName}` : nodeName;
        if (nodePath.length > 2048) return { available: false, reason: 'SCENE_PREFAB_INSTANCE_PATH_TOO_LONG' };
        const info = ownDataValue(node, '_prefab');
        const infoRoot = info && ownDataValue(info, 'root');
        const linkedToRoot = node === root || infoRoot === root;
        const nodeAsset = info && ownDataValue(info, 'asset');
        const nodeAssetUuid = nodeAsset && (ownDataValue(nodeAsset, '_uuid') || ownDataValue(nodeAsset, 'uuid'));
        const rawFileId = info && ownDataValue(info, 'fileId');
        const allComponents = Array.isArray(node._components) ? node._components.filter((component) => component && !editorManaged(component)) : [];
        if (allComponents.length > MAX_COMPONENT_INSTANCES)
            return { available: false, reason: 'SCENE_PREFAB_INSTANCE_COMPONENT_LIMIT', nodeUuid };
        const components = allComponents.map((component, index) => {
            const detail = componentSemanticDetail(component, index);
            return { componentClassName: classNameOf(component),
                serializedClassId: component && component.constructor ? serializedClassIdOf(component.constructor) : null,
                componentInstanceId: component && component._id != null ? String(component._id).slice(0, 128) : null,
                stateSha256: crypto.createHash('sha256').update(JSON.stringify(detail), 'utf8').digest('hex') };
        });
        nodes.push({ nodeUuid, nodeName, nodePath, parentUuid: item.parentUuid,
            active: node.active !== false, transform: transformSummary(node),
            prefabLink: linkedToRoot ? { root: node === root, fileId: typeof rawFileId === 'string' ? rawFileId.slice(0, 128) : null,
                assetUuid: typeof nodeAssetUuid === 'string' && prefabPatch.UUID.test(nodeAssetUuid) ? nodeAssetUuid : null }
                : info ? { root: infoRoot === node, fileId: typeof rawFileId === 'string' ? rawFileId.slice(0, 128) : null,
                    assetUuid: typeof nodeAssetUuid === 'string' && prefabPatch.UUID.test(nodeAssetUuid) ? nodeAssetUuid : null }
                    : null,
            components });
        const children = authoringChildren(node);
        for (let index = children.length - 1; index >= 0; index -= 1)
            stack.push({ node: children[index], parentPath: nodePath, parentUuid: nodeUuid, depth: item.depth + 1 });
    }
    if (!visited.has(selected.node))
        return { available: false, reason: 'SCENE_PREFAB_INSTANCE_SELECTION_OUTSIDE_ROOT' };
    const stateSha256 = crypto.createHash('sha256').update(JSON.stringify(nodes), 'utf8').digest('hex');
    return { available: true, linked: true, sceneName: selected.state.sceneName, sceneUuid: params.sceneUuid,
        selectedNodeUuid: params.nodeUuid, selectedNodePath: selected.state.nodePath,
        prefabRootUuid: rootUuid, prefabRootPath: locatedRoot.state.nodePath, prefabUuid,
        prefabSync: ownDataValue(rootInfo, 'sync') === true, nodeCount: nodes.length, nodes,
        stateSha256, stateHashScope: 'instance-hierarchy-transforms-active-component-public-properties' };
}

function nodeNameState(params) {
    if (!params || typeof params.sceneUuid !== 'string' || typeof params.nodeUuid !== 'string')
        return { available: false, reason: 'SCENE_NODE_NAME_INPUT_INVALID' };
    const located = locateNode(params.sceneUuid, params.nodeUuid);
    if (!located.state.available) return located.state;
    if (typeof cc.isValid !== 'function' || !cc.isValid(located.node, true))
        return { ...located.state, available: false, reason: 'SCENE_NODE_PENDING_DESTROY' };
    const parent = located.node.parent;
    if (!parent || typeof parent.uuid !== 'string')
        return { ...located.state, available: false, reason: 'SCENE_NODE_ROOT_RENAME_UNSUPPORTED' };
    const requestedName = params.newName;
    if (requestedName !== undefined) {
        if (typeof requestedName !== 'string' || !requestedName.trim() || requestedName.length > MAX_NAME
            || requestedName.includes('/') || requestedName.includes('\\') || requestedName.includes('\0'))
            return { ...located.state, available: false, reason: 'SCENE_NODE_NAME_INVALID' };
        if (requestedName === located.node.name)
            return { ...located.state, available: false, reason: 'SCENE_NODE_NAME_NO_CHANGE' };
        const collision = authoringChildren(parent).some((sibling) => sibling !== located.node && sibling.name === requestedName);
        if (collision) return { ...located.state, available: false, reason: 'SCENE_NODE_SIBLING_NAME_EXISTS',
            requestedName, nameAvailable: false };
    }
    return { ...located.state, parentUuid: parent.uuid,
        ...(requestedName === undefined ? {} : { requestedName, nameAvailable: true }) };
}

function renameNode(params) {
    if (!params || typeof params.sceneUuid !== 'string' || typeof params.nodeUuid !== 'string'
        || typeof params.nodePath !== 'string' || typeof params.expectedName !== 'string'
        || typeof params.expectedParentUuid !== 'string' || typeof params.newName !== 'string')
        return { available: false, reason: 'SCENE_NODE_NAME_INPUT_INVALID' };
    const before = nodeNameState({ sceneUuid: params.sceneUuid, nodeUuid: params.nodeUuid, newName: params.newName });
    if (!before.available) return before;
    if (before.nodePath !== params.nodePath || before.nodeName !== params.expectedName
        || before.parentUuid !== params.expectedParentUuid)
        return { ...before, available: false, reason: 'SCENE_NODE_NAME_PRECONDITION_FAILED' };
    const located = locateNode(params.sceneUuid, params.nodeUuid);
    if (!located.node) return { ...before, available: false, reason: 'SCENE_NODE_NOT_FOUND' };
    located.node.name = params.newName;
    if (located.node.name !== params.newName)
        return { ...before, available: false, reason: 'SCENE_NODE_NAME_WRITE_READBACK_FAILED' };
    const after = nodeNameState({ sceneUuid: params.sceneUuid, nodeUuid: params.nodeUuid });
    if (!after.available || after.nodeName !== params.newName || after.parentUuid !== params.expectedParentUuid)
        return { ...(after || before), available: false, reason: 'SCENE_NODE_NAME_WRITE_READBACK_FAILED' };
    return { ...after, beforeName: params.expectedName, requestedName: params.newName };
}

function nodeDeleteState(params) {
    if (!params || typeof params.sceneUuid !== 'string' || typeof params.nodeUuid !== 'string')
        return { available: false, reason: 'SCENE_NODE_DELETE_INPUT_INVALID' };
    const located = locateNode(params.sceneUuid, params.nodeUuid);
    if (!located.state.available) return located.state;
    const parent = located.node.parent;
    if (!parent || typeof parent.uuid !== 'string')
        return { ...located.state, available: false, reason: 'SCENE_NODE_ROOT_DELETE_UNSUPPORTED' };
    if (!Array.isArray(parent.children) || !parent.children.includes(located.node)
        || typeof parent.removeChild !== 'function' || typeof located.node.destroy !== 'function')
        return { ...located.state, available: false, reason: 'SCENE_NODE_DELETE_API_UNAVAILABLE' };
    const subtree = [];
    const stack = [{ node: located.node, parentUuid: parent.uuid, siblingIndex: authoringChildren(parent).indexOf(located.node), depth: 0 }];
    while (stack.length) {
        const item = stack.pop();
        if (subtree.length >= MAX_DELETE_SUBTREE_NODES || item.depth > MAX_MUTATION_SCAN_DEPTH)
            return { ...located.state, available: false, reason: 'SCENE_NODE_DELETE_SUBTREE_LIMIT' };
        const uuid = item.node && item.node.uuid;
        const name = item.node && item.node.name;
        if (typeof uuid !== 'string' || typeof name !== 'string' || name.length > MAX_NAME)
            return { ...located.state, available: false, reason: 'SCENE_NODE_DELETE_SUBTREE_IDENTITY_INVALID' };
        const children = authoringChildren(item.node);
        subtree.push({ nodeUuid: uuid, nodeName: name, parentUuid: item.parentUuid,
            siblingIndex: item.siblingIndex, childCount: children.length });
        if (subtree.length + stack.length + children.length > MAX_DELETE_SUBTREE_NODES)
            return { ...located.state, available: false, reason: 'SCENE_NODE_DELETE_SUBTREE_LIMIT' };
        for (let index = children.length - 1; index >= 0; index -= 1)
            stack.push({ node: children[index], parentUuid: uuid, siblingIndex: index, depth: item.depth + 1 });
    }
    return { available: true, sceneName: located.state.sceneName, sceneUuid: located.state.sceneUuid,
        nodeName: located.state.nodeName, nodeUuid: located.state.nodeUuid, nodePath: located.state.nodePath,
        parentUuid: parent.uuid, childCount: located.state.children, subtree };
}

function deleteNode(params) {
    if (!params || typeof params.sceneUuid !== 'string' || typeof params.nodeUuid !== 'string'
        || typeof params.nodePath !== 'string' || typeof params.expectedName !== 'string'
        || typeof params.expectedParentUuid !== 'string' || !Number.isInteger(params.expectedChildCount)
        || params.expectedChildCount < 0 || !Array.isArray(params.expectedSubtree))
        return { available: false, reason: 'SCENE_NODE_DELETE_INPUT_INVALID' };
    const before = nodeDeleteState(params);
    if (!before.available) return before;
    if (before.nodePath !== params.nodePath || before.nodeName !== params.expectedName
        || before.parentUuid !== params.expectedParentUuid || before.childCount !== params.expectedChildCount
        || JSON.stringify(before.subtree) !== JSON.stringify(params.expectedSubtree))
        return { ...before, available: false, reason: 'SCENE_NODE_DELETE_PRECONDITION_FAILED' };
    const located = locateNode(params.sceneUuid, params.nodeUuid);
    if (!located.node || !located.node.parent) return { ...before, available: false, reason: 'SCENE_NODE_NOT_FOUND' };
    try {
        located.node.parent.removeChild(located.node);
        located.node.destroy();
    } catch (_) {
        return { ...before, available: false, reason: 'SCENE_NODE_DELETE_FAILED', mutationStarted: true };
    }
    const after = locateNode(params.sceneUuid, params.nodeUuid).state;
    if (after.available || after.reason !== 'SCENE_NODE_NOT_FOUND')
        return { ...before, available: false, reason: 'SCENE_NODE_DELETE_READBACK_FAILED', mutationStarted: true };
    return { available: true, sceneUuid: params.sceneUuid, nodeUuid: params.nodeUuid,
        nodePath: params.nodePath, deleted: true, childCount: params.expectedChildCount };
}

function nodeReparentState(params) {
    if (!params || typeof params.sceneUuid !== 'string' || typeof params.nodeUuid !== 'string'
        || typeof params.targetParentUuid !== 'string')
        return { available: false, reason: 'SCENE_NODE_REPARENT_INPUT_INVALID' };
    const child = locateNode(params.sceneUuid, params.nodeUuid);
    if (!child.state.available) return child.state;
    const target = locateNode(params.sceneUuid, params.targetParentUuid);
    if (!target.state.available) return { ...target.state, reason: `TARGET_${target.state.reason || 'SCENE_NODE_NOT_FOUND'}` };
    if (!child.node.parent || typeof child.node.parent.uuid !== 'string')
        return { ...child.state, available: false, reason: 'SCENE_NODE_ROOT_REPARENT_UNSUPPORTED' };
    if (target.node === child.node) return { ...child.state, available: false, reason: 'SCENE_NODE_REPARENT_SELF' };
    let ancestor = target.node;
    let ancestorCount = 0;
    while (ancestor && ancestor !== child.node && ancestorCount < MAX_MUTATION_SCAN_DEPTH + 1) {
        ancestor = ancestor.parent;
        ancestorCount += 1;
    }
    if (ancestor === child.node) return { ...child.state, available: false, reason: 'SCENE_NODE_REPARENT_CYCLE' };
    if (ancestorCount > MAX_MUTATION_SCAN_DEPTH) return { ...child.state, available: false, reason: 'SCENE_NODE_REPARENT_DEPTH_LIMIT' };
    const oldParent = child.node.parent;
    const oldParentState = locateNode(params.sceneUuid, oldParent.uuid).state;
    if (!oldParentState.available) return { ...child.state, available: false, reason: 'SCENE_NODE_OLD_PARENT_STATE_UNAVAILABLE' };
    if (oldParent === target.node && params.allowCurrentTarget !== true)
        return { ...child.state, available: false, reason: 'SCENE_NODE_REPARENT_NO_CHANGE' };
    const nodeName = String(child.node.name || '');
    if (!nodeName || nodeName.length > MAX_NAME || nodeName.includes('/'))
        return { ...child.state, available: false, reason: 'SCENE_NODE_REPARENT_NAME_INVALID' };
    const collision = authoringChildren(target.node).some((sibling) => sibling !== child.node && sibling.name === child.node.name);
    if (collision) return { ...child.state, available: false, reason: 'SCENE_NODE_REPARENT_NAME_COLLISION',
        targetParentUuid: target.state.nodeUuid, targetParentPath: target.state.nodePath };
    const afterNodePath = `${target.state.nodePath}/${nodeName}`;
    if (afterNodePath.length > 2048) return { ...child.state, available: false, reason: 'SCENE_NODE_PATH_TOO_LONG' };
    return { available: true, sceneName: child.state.sceneName, sceneUuid: child.state.sceneUuid,
        nodeUuid: child.state.nodeUuid, nodeName: child.state.nodeName, nodePath: child.state.nodePath,
        parentUuid: oldParent.uuid, parentPath: oldParentState.nodePath,
        targetParentUuid: target.state.nodeUuid, targetParentPath: target.state.nodePath,
        afterNodePath, childIndex: authoringChildren(target.node).length,
        localTransformPreserved: true, worldTransformPreserved: false };
}

function reparentNode(params) {
    if (!params || typeof params.sceneUuid !== 'string' || typeof params.nodeUuid !== 'string'
        || typeof params.nodePath !== 'string' || typeof params.expectedName !== 'string'
        || typeof params.expectedParentUuid !== 'string' || typeof params.expectedParentPath !== 'string'
        || typeof params.targetParentUuid !== 'string' || typeof params.targetParentPath !== 'string'
        || typeof params.afterNodePath !== 'string')
        return { available: false, reason: 'SCENE_NODE_REPARENT_INPUT_INVALID' };
    const before = nodeReparentState({ sceneUuid: params.sceneUuid, nodeUuid: params.nodeUuid,
        targetParentUuid: params.targetParentUuid });
    if (!before.available) return before;
    if (before.nodePath !== params.nodePath || before.nodeName !== params.expectedName
        || before.parentUuid !== params.expectedParentUuid || before.parentPath !== params.expectedParentPath
        || before.targetParentPath !== params.targetParentPath || before.afterNodePath !== params.afterNodePath)
        return { ...before, available: false, reason: 'SCENE_NODE_REPARENT_PRECONDITION_FAILED' };
    const child = locateNode(params.sceneUuid, params.nodeUuid);
    const target = locateNode(params.sceneUuid, params.targetParentUuid);
    if (!child.node || !target.node) return { ...before, available: false, reason: 'SCENE_NODE_NOT_FOUND' };
    child.node.parent = target.node;
    const after = nodeReparentState({ sceneUuid: params.sceneUuid, nodeUuid: params.nodeUuid,
        targetParentUuid: params.targetParentUuid, allowCurrentTarget: true });
    if (!after.available || after.parentUuid !== params.targetParentUuid
        || after.nodePath !== params.afterNodePath || after.afterNodePath !== params.afterNodePath)
        return { ...(after || before), available: false, reason: 'SCENE_NODE_REPARENT_READBACK_FAILED', mutationStarted: true };
    return { ...after, beforeParentUuid: params.expectedParentUuid,
        beforeParentPath: params.expectedParentPath, afterParentUuid: params.targetParentUuid };
}

function setNodeActive(params) {
    if (!params || typeof params.sceneUuid !== 'string' || typeof params.nodeUuid !== 'string'
        || typeof params.nodePath !== 'string' || typeof params.expectedActive !== 'boolean'
        || typeof params.active !== 'boolean') return { available: false, reason: 'SCENE_NODE_INPUT_INVALID' };
    const located = locateNode(params && params.sceneUuid, params && params.nodeUuid);
    const before = located.state;
    if (!before.available) return before;
    if (before.nodePath !== params.nodePath) return { available: false, reason: 'SCENE_NODE_PATH_MISMATCH', ...before };
    if (before.active !== params.expectedActive)
        return { available: false, reason: 'SCENE_NODE_PRECONDITION_FAILED', ...before };
    if (before.active === params.active)
        return { available: false, reason: 'SCENE_NODE_NO_CHANGE', ...before };
    const node = located.node;
    if (!node) return { available: false, reason: 'SCENE_NODE_NOT_FOUND' };
    node.active = params.active;
    if (node.active !== params.active)
        return { available: false, reason: 'SCENE_NODE_WRITE_READBACK_FAILED' };
    return { available: true, sceneUuid: params.sceneUuid, nodeUuid: params.nodeUuid,
        nodePath: params.nodePath, beforeActive: before.active, active: node.active };
}

function componentClass(componentClassName) {
    if (typeof componentClassName !== 'string' || componentClassName.length < 1 || componentClassName.length > MAX_NAME
        || !/^[A-Za-z_$][A-Za-z0-9_$.]*$/.test(componentClassName))
        return { available: false, reason: 'SCENE_COMPONENT_CLASS_NAME_INVALID' };
    if (!cc || !cc.js || typeof cc.js.getClassByName !== 'function' || typeof cc.js.isChildClassOf !== 'function'
        || !cc.Component) return { available: false, reason: 'SCENE_COMPONENT_REGISTRY_UNAVAILABLE' };
    const constructor = cc.js.getClassByName(componentClassName);
    if (typeof constructor !== 'function') return { available: false, reason: 'SCENE_COMPONENT_CLASS_NOT_REGISTERED' };
    if (constructor === cc.Component || !cc.js.isChildClassOf(constructor, cc.Component))
        return { available: false, reason: 'SCENE_CLASS_IS_NOT_COMPONENT' };
    const registeredName = typeof cc.js.getClassName === 'function' ? cc.js.getClassName(constructor) : componentClassName;
    if (registeredName !== componentClassName)
        return { available: false, reason: 'SCENE_COMPONENT_CLASS_IDENTITY_MISMATCH' };
    return { available: true, constructor, componentClassName: registeredName,
        requiresComponent: !!constructor._requireComponent, disallowMultiple: !!constructor._disallowMultiple };
}

function exactComponentInstances(node, constructor) {
    if (!node || typeof node.getComponents !== 'function')
        return { available: false, reason: 'SCENE_NODE_COMPONENT_QUERY_UNAVAILABLE' };
    const candidates = node.getComponents(constructor);
    if (!Array.isArray(candidates)) return { available: false, reason: 'SCENE_COMPONENT_QUERY_INVALID' };
    if (candidates.length > MAX_COMPONENT_INSTANCES)
        return { available: false, reason: 'SCENE_COMPONENT_LIMIT', componentCount: candidates.length };
    const components = candidates.filter((component) => component && component.constructor === constructor);
    if (components.some(editorManaged)) return { available: false, reason: 'SCENE_EDITOR_COMPONENT_PROTECTED' };
    return { available: true, components };
}

function hasSafeComponentHandler(constructor, handler) {
    if (!constructor || !constructor.prototype || ['constructor', '__defineGetter__', '__defineSetter__',
        '__lookupGetter__', '__lookupSetter__', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable',
        'toLocaleString', 'toString', 'valueOf'].includes(handler)) return false;
    let prototype = constructor.prototype;
    while (prototype && prototype !== cc.Component.prototype) {
        const descriptor = Object.getOwnPropertyDescriptor(prototype, handler);
        if (descriptor) return Object.prototype.hasOwnProperty.call(descriptor, 'value') && typeof descriptor.value === 'function';
        prototype = Object.getPrototypeOf(prototype);
    }
    return false;
}

function componentRemoveState(params) {
    if (!params || typeof params.sceneUuid !== 'string' || typeof params.nodeUuid !== 'string'
        || typeof params.nodePath !== 'string' || typeof params.componentClassName !== 'string'
        || typeof params.componentInstanceId !== 'string')
        return { available: false, reason: 'SCENE_COMPONENT_REMOVE_INPUT_INVALID' };
    const located = locateNode(params.sceneUuid, params.nodeUuid);
    if (!located.state.available) return located.state;
    if (located.state.nodePath !== params.nodePath)
        return { available: false, reason: 'SCENE_NODE_PATH_MISMATCH', ...located.state };
    if (typeof cc.isValid !== 'function' || !cc.isValid(located.node, true))
        return { ...located.state, available: false, reason: 'SCENE_NODE_PENDING_DESTROY' };
    const resolved = componentClass(params.componentClassName);
    if (!resolved.available) return { ...resolved, sceneUuid: params.sceneUuid, nodeUuid: params.nodeUuid,
        nodePath: params.nodePath, componentClassName: params.componentClassName };
    const query = exactComponentInstances(located.node, resolved.constructor);
    if (!query.available) return query;
    const component = query.components.find((item) => item && item._id != null
        && String(item._id) === params.componentInstanceId && cc.isValid(item, true));
    if (!component) return { available: true, sceneName: located.state.sceneName,
        sceneUuid: located.state.sceneUuid, nodePath: located.state.nodePath, nodeUuid: located.state.nodeUuid,
        componentClassName: resolved.componentClassName, serializedClassId: serializedClassIdOf(resolved.constructor),
        componentInstanceId: params.componentInstanceId,
        present: false, dependentComponents: [] };
    const all = located.node.getComponents(cc.Component);
    if (!Array.isArray(all) || all.length > MAX_COMPONENT_INSTANCES)
        return { available: false, reason: 'SCENE_COMPONENT_LIMIT' };
    if (all.some(editorManaged)) return { available: false, reason: 'SCENE_EDITOR_COMPONENT_PROTECTED' };
    const dependents = all.filter((candidate) => candidate !== component && candidate && candidate.constructor
        && typeof candidate.constructor._requireComponent === 'function'
        && component instanceof candidate.constructor._requireComponent);
    return { available: true, sceneName: located.state.sceneName, sceneUuid: located.state.sceneUuid,
        nodePath: located.state.nodePath, nodeUuid: located.state.nodeUuid,
        componentClassName: resolved.componentClassName, serializedClassId: serializedClassIdOf(resolved.constructor),
        componentInstanceId: params.componentInstanceId,
        present: true, dependentComponents: dependents.map((candidate) => classNameOf(candidate)) };
}

function removeNodeComponent(params) {
    const before = componentRemoveState(params);
    if (!before.available) return before;
    if (!before.present) return { ...before, available: false, reason: 'SCENE_COMPONENT_INSTANCE_NOT_FOUND' };
    if (before.dependentComponents.length)
        return { ...before, available: false, reason: 'SCENE_COMPONENT_REQUIRED_BY_OTHER_COMPONENT' };
    if (params.expectedPresent !== true || before.present !== params.expectedPresent)
        return { ...before, available: false, reason: 'SCENE_COMPONENT_REMOVE_PRECONDITION_FAILED' };
    const located = locateNode(params.sceneUuid, params.nodeUuid);
    const resolved = componentClass(params.componentClassName);
    if (!located.node || !resolved.available) return { ...before, available: false, reason: 'SCENE_COMPONENT_INSTANCE_NOT_FOUND' };
    const query = exactComponentInstances(located.node, resolved.constructor);
    const component = query.available && query.components.find((item) => item && item._id != null
        && String(item._id) === params.componentInstanceId);
    if (!component || typeof component.destroy !== 'function')
        return { ...before, available: false, reason: 'SCENE_COMPONENT_DESTROY_UNAVAILABLE' };
    try { component.destroy(); }
    catch (_) { return { ...before, available: false, reason: 'SCENE_COMPONENT_REMOVE_FAILED', mutationStarted: true }; }
    const after = componentRemoveState(params);
    if (!after.available || after.present)
        return { ...before, available: false, reason: 'SCENE_COMPONENT_REMOVE_READBACK_FAILED', mutationStarted: true };
    return { ...after, beforePresent: true, present: false };
}

function componentState(params) {
    if (!params || typeof params.sceneUuid !== 'string' || typeof params.nodeUuid !== 'string'
        || typeof params.nodePath !== 'string' || typeof params.componentClassName !== 'string')
        return { available: false, reason: 'SCENE_COMPONENT_INPUT_INVALID' };
    const located = locateNode(params.sceneUuid, params.nodeUuid);
    if (!located.state.available) return located.state;
    if (located.state.nodePath !== params.nodePath)
        return { available: false, reason: 'SCENE_NODE_PATH_MISMATCH', ...located.state };
    const resolved = componentClass(params.componentClassName);
    if (!resolved.available) return { ...resolved, sceneUuid: params.sceneUuid, nodeUuid: params.nodeUuid,
        nodePath: params.nodePath, componentClassName: params.componentClassName };
    const query = exactComponentInstances(located.node, resolved.constructor);
    if (!query.available) return query;
    const components = query.components;
    return { available: true, sceneName: located.state.sceneName, sceneUuid: located.state.sceneUuid,
        nodePath: located.state.nodePath, nodeUuid: located.state.nodeUuid,
        componentClassName: resolved.componentClassName, serializedClassId: serializedClassIdOf(resolved.constructor),
        componentCount: components.length,
        componentInstanceIds: components.map((component) => component && component._id != null ? String(component._id) : null),
        requiresComponent: resolved.requiresComponent, disallowMultiple: resolved.disallowMultiple,
        canAdd: components.length === 0 && !resolved.requiresComponent };
}

function isScalar(value) {
    return typeof value === 'string' || typeof value === 'boolean'
        || (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1000000000);
}

const ASSET_CLASS_NAMES = ['SpriteFrame', 'Texture2D', 'AudioClip', 'Prefab', 'Font', 'BitmapFont', 'TTFFont'];

function sameValue(left, right) {
    if (isScalar(left) || isScalar(right) || left === null || right === null) return Object.is(left, right);
    function normalize(value) {
        if (Array.isArray(value)) return value.map(normalize);
        if (!value || typeof value !== 'object') return value;
        const result = {};
        for (const key of Object.keys(value).sort()) result[key] = normalize(value[key]);
        return result;
    }
    try { return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right)); }
    catch (_) { return false; }
}

function isComponentConstructor(constructor) {
    return typeof constructor === 'function' && !!cc && !!cc.Component && constructor !== cc.Component
        && !!cc.js && typeof cc.js.isChildClassOf === 'function' && cc.js.isChildClassOf(constructor, cc.Component);
}

function componentClassName(constructor) {
    const name = cc && cc.js && typeof cc.js.getClassName === 'function' ? cc.js.getClassName(constructor) : '';
    return typeof name === 'string' && name.length <= 120 ? name : null;
}

function typedReferenceValue(value, attrType) {
    if (Array.isArray(value)) return null;
    if (cc && cc.Node && attrType === cc.Node) {
        if (value == null) return { available: true, value: { kind: 'node-ref' }, kind: 'node-ref' };
        if (!(value instanceof cc.Node) || !validUuid(value.uuid))
            return { available: false, reason: 'SCENE_COMPONENT_PROPERTY_NODE_REFERENCE_INVALID' };
        return { available: true, value: { kind: 'node-ref', nodeUuid: value.uuid }, kind: 'node-ref' };
    }
    if (isComponentConstructor(attrType)) {
        const declaredClassName = componentClassName(attrType);
        if (!declaredClassName) return { available: false, reason: 'SCENE_COMPONENT_PROPERTY_COMPONENT_TYPE_UNAVAILABLE' };
        if (value == null) return { available: true,
            value: { kind: 'component-ref', componentClassName: declaredClassName }, kind: 'component-ref' };
        const actualClassName = componentClassName(value.constructor);
        if (!(value instanceof attrType) || !value.node || !validUuid(value.node.uuid)
            || value._id == null || !actualClassName)
            return { available: false, reason: 'SCENE_COMPONENT_PROPERTY_COMPONENT_REFERENCE_INVALID' };
        return { available: true, value: { kind: 'component-ref', nodeUuid: value.node.uuid,
            componentClassName: actualClassName, componentInstanceId: String(value._id) }, kind: 'component-ref' };
    }
    return null;
}

function componentValueKind(value, attrType) {
    if (isScalar(value)) {
        if ((attrType === String && typeof value !== 'string') || (attrType === Number && typeof value !== 'number')
            || (attrType === Boolean && typeof value !== 'boolean')
            || (attrType === 'String' && typeof value !== 'string')
            || (['Number', 'Integer', 'Float'].includes(attrType) && typeof value !== 'number')
            || (attrType === 'Boolean' && typeof value !== 'boolean')
            || (typeof attrType === 'function' && ![String, Number, Boolean].includes(attrType)))
            return { available: false, reason: 'SCENE_COMPONENT_PROPERTY_TYPE_MISMATCH' };
        return { available: true, value, kind: typeof value };
    }
    const typed = [
        ['vec2', cc && cc.Vec2, ['x', 'y']],
        ['vec3', cc && cc.Vec3, ['x', 'y', 'z']],
        ['vec4', cc && cc.Vec4, ['x', 'y', 'z', 'w']],
        ['size', cc && cc.Size, ['width', 'height']],
        ['rect', cc && cc.Rect, ['x', 'y', 'width', 'height']],
        ['color', cc && cc.Color, ['r', 'g', 'b', 'a']],
    ];
    for (const [kind, constructor, fields] of typed) {
        if (typeof constructor === 'function' && attrType === constructor && value instanceof constructor) {
            const result = { kind };
            for (const field of fields) {
                const number = value[field];
                if (typeof number !== 'number' || !Number.isFinite(number))
                    return { available: false, reason: 'SCENE_COMPONENT_PROPERTY_VALUE_UNSUPPORTED' };
                result[field] = number;
            }
            return { available: true, value: result, kind };
        }
    }
    const typedReference = typedReferenceValue(value, attrType);
    if (typedReference) return typedReference;
    if (Array.isArray(value) && (attrType === Array || attrType == null || typeof attrType === 'function'
        || ['String', 'Number', 'Boolean', 'Integer', 'Float'].includes(attrType))) {
        if (value.length > 32 || value.some((item) => Array.isArray(item)))
            return { available: false, reason: 'SCENE_COMPONENT_PROPERTY_TYPE_UNSUPPORTED' };
        const elementType = attrType === Array ? null : attrType;
        const items = [];
        for (const item of value) {
            if (isScalar(item)) {
                const stringType = elementType === String || elementType === 'String';
                const numberType = elementType === Number || ['Number', 'Integer', 'Float'].includes(elementType);
                const booleanType = elementType === Boolean || elementType === 'Boolean';
                if ((stringType && typeof item !== 'string') || (numberType && typeof item !== 'number')
                    || (booleanType && typeof item !== 'boolean')
                    || (typeof elementType === 'function' && ![String, Number, Boolean].includes(elementType)))
                    return { available: false, reason: 'SCENE_COMPONENT_PROPERTY_TYPE_MISMATCH' };
                items.push(item);
            } else {
                const encoded = componentValueKind(item, elementType);
                if (!encoded.available || encoded.kind === 'asset' || encoded.kind === 'array')
                    return { available: false, reason: encoded.reason || 'SCENE_COMPONENT_PROPERTY_TYPE_UNSUPPORTED' };
                items.push(encoded.value);
            }
        }
        return { available: true, value: { kind: 'array', items }, kind: 'array' };
    }
    for (const assetClass of ASSET_CLASS_NAMES) {
        const constructor = cc && cc[assetClass];
        if (typeof constructor === 'function' && attrType === constructor) {
            if (value == null) return { available: true, value: { kind: 'asset', assetClass }, kind: 'asset' };
            const assetUuid = value && (value._uuid || value.uuid);
            if (!(value instanceof constructor) || typeof assetUuid !== 'string')
                return { available: false, reason: 'SCENE_COMPONENT_PROPERTY_ASSET_TYPE_MISMATCH' };
            return { available: true, value: { kind: 'asset', assetUuid, assetClass }, kind: 'asset' };
        }
    }
    return { available: false, reason: 'SCENE_COMPONENT_PROPERTY_TYPE_UNSUPPORTED' };
}

function validComponentValue(value, depth = 0) {
    if (depth > 1) return false;
    if (isScalar(value)) return true;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (value.kind === 'vec2') return Object.keys(value).length === 3
        && ['x', 'y'].every((field) => Number.isFinite(value[field]) && Math.abs(value[field]) <= 1000000);
    if (value.kind === 'vec3') return Object.keys(value).sort().join(',') === 'kind,x,y,z'
        && ['x', 'y', 'z'].every((field) => Number.isFinite(value[field]) && Math.abs(value[field]) <= 1000000);
    if (value.kind === 'vec4') return Object.keys(value).sort().join(',') === 'kind,w,x,y,z'
        && ['x', 'y', 'z', 'w'].every((field) => Number.isFinite(value[field]) && Math.abs(value[field]) <= 1000000);
    if (value.kind === 'rect') return Object.keys(value).sort().join(',') === 'height,kind,width,x,y'
        && ['x', 'y', 'width', 'height'].every((field) => Number.isFinite(value[field]) && Math.abs(value[field]) <= 1000000);
    if (value.kind === 'size') return Object.keys(value).sort().join(',') === 'height,kind,width'
        && ['width', 'height'].every((field) => Number.isFinite(value[field]) && Math.abs(value[field]) <= 1000000);
    if (value.kind === 'color') return Object.keys(value).sort().join(',') === 'a,b,g,kind,r'
        && ['r', 'g', 'b', 'a'].every((field) => Number.isInteger(value[field]) && value[field] >= 0 && value[field] <= 255);
    if (value.kind === 'array') return Object.keys(value).sort().join(',') === 'items,kind' && Array.isArray(value.items)
        && value.items.length <= 32 && value.items.every((item) => isScalar(item) || validComponentValue(item, depth + 1)
            && item.kind !== 'array' && item.kind !== 'asset');
    if (value.kind === 'asset') return (Object.keys(value).length === 2 || Object.keys(value).length === 3)
        && ASSET_CLASS_NAMES.includes(value.assetClass)
        && (value.assetUuid === undefined || (typeof value.assetUuid === 'string'
            && (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value.assetUuid)
                || /^[A-Za-z0-9+/]{22,23}$/.test(value.assetUuid))));
    if (value.kind === 'node-ref') return (Object.keys(value).sort().join(',') === 'kind'
        || Object.keys(value).sort().join(',') === 'kind,nodeUuid')
        && (value.nodeUuid === undefined || validUuid(value.nodeUuid));
    if (value.kind === 'component-ref') return (Object.keys(value).sort().join(',') === 'componentClassName,kind'
        || Object.keys(value).sort().join(',') === 'componentClassName,componentInstanceId,kind,nodeUuid')
        && typeof value.componentClassName === 'string' && /^[A-Za-z_$][A-Za-z0-9_$.]{0,119}$/.test(value.componentClassName)
        && (value.nodeUuid === undefined || validUuid(value.nodeUuid))
        && (value.componentInstanceId === undefined || (typeof value.componentInstanceId === 'string'
            && value.componentInstanceId.length > 0 && value.componentInstanceId.length <= 128));
    return false;
}

function decodeComponentValue(value, attrType, loadedAsset, sceneUuid) {
    if (isScalar(value)) {
        if ((attrType === String && typeof value !== 'string') || (attrType === Number && typeof value !== 'number')
            || (attrType === Boolean && typeof value !== 'boolean')
            || (attrType === 'String' && typeof value !== 'string')
            || (['Number', 'Integer', 'Float'].includes(attrType) && typeof value !== 'number')
            || (attrType === 'Boolean' && typeof value !== 'boolean')
            || (typeof attrType === 'function' && ![String, Number, Boolean].includes(attrType)))
            return { available: false, reason: 'SCENE_COMPONENT_PROPERTY_TYPE_MISMATCH' };
        return { available: true, value };
    }
    if (!validComponentValue(value)) return { available: false, reason: 'SCENE_COMPONENT_PROPERTY_VALUE_INVALID' };
    if (value.kind === 'vec2' && attrType === cc.Vec2) return { available: true, value: new cc.Vec2(value.x, value.y) };
    if (value.kind === 'vec3' && attrType === cc.Vec3) return { available: true, value: new cc.Vec3(value.x, value.y, value.z) };
    if (value.kind === 'vec4' && attrType === cc.Vec4) return { available: true, value: new cc.Vec4(value.x, value.y, value.z, value.w) };
    if (value.kind === 'size' && attrType === cc.Size) return { available: true, value: new cc.Size(value.width, value.height) };
    if (value.kind === 'rect' && attrType === cc.Rect) return { available: true, value: new cc.Rect(value.x, value.y, value.width, value.height) };
    if (value.kind === 'color' && attrType === cc.Color) return { available: true, value: new cc.Color(value.r, value.g, value.b, value.a) };
    if (value.kind === 'node-ref' && attrType === cc.Node) {
        if (value.nodeUuid === undefined) return { available: true, value: null };
        const located = locateNode(sceneUuid, value.nodeUuid);
        if (!located.state.available || !(located.node instanceof cc.Node) || typeof cc.isValid !== 'function'
            || !cc.isValid(located.node, true))
            return { available: false, reason: 'SCENE_COMPONENT_PROPERTY_NODE_REFERENCE_UNAVAILABLE' };
        return { available: true, value: located.node };
    }
    if (value.kind === 'component-ref' && isComponentConstructor(attrType)) {
        const declaredName = componentClassName(attrType);
        if (value.nodeUuid === undefined) return value.componentClassName === declaredName
            ? { available: true, value: null }
            : { available: false, reason: 'SCENE_COMPONENT_PROPERTY_COMPONENT_TYPE_MISMATCH' };
        const resolved = componentClass(value.componentClassName);
        if (!resolved.available || !cc.js.isChildClassOf(resolved.constructor, attrType))
            return { available: false, reason: 'SCENE_COMPONENT_PROPERTY_COMPONENT_TYPE_MISMATCH' };
        const located = locateNode(sceneUuid, value.nodeUuid);
        if (!located.state.available) return { available: false, reason: 'SCENE_COMPONENT_PROPERTY_COMPONENT_REFERENCE_UNAVAILABLE' };
        const query = exactComponentInstances(located.node, resolved.constructor);
        if (!query.available) return { available: false, reason: query.reason };
        const component = query.components.find((item) => item && item._id != null
            && String(item._id) === value.componentInstanceId && cc.isValid(item, true));
        if (!component) return { available: false, reason: 'SCENE_COMPONENT_PROPERTY_COMPONENT_REFERENCE_UNAVAILABLE' };
        return { available: true, value: component };
    }
    if (value.kind === 'array' && (attrType === Array || attrType == null || typeof attrType === 'function'
        || ['String', 'Number', 'Boolean', 'Integer', 'Float'].includes(attrType))) {
        const elementType = attrType === Array ? null : attrType;
        const decoded = [];
        for (const item of value.items) {
            if (isScalar(item)) {
                const result = decodeComponentValue(item, elementType, null, sceneUuid);
                if (!result.available) return result;
                decoded.push(result.value);
            } else {
                if (item.kind === 'asset') return { available: false, reason: 'SCENE_COMPONENT_PROPERTY_TYPE_UNSUPPORTED' };
                const result = decodeComponentValue(item, elementType, null, sceneUuid);
                if (!result.available) return result;
                decoded.push(result.value);
            }
        }
        return { available: true, value: decoded };
    }
    if (value.kind === 'asset' && attrType === cc[value.assetClass]) {
        if (value.assetUuid == null) return { available: true, value: null };
        if (!loadedAsset || !(loadedAsset instanceof attrType)
            || (loadedAsset._uuid || loadedAsset.uuid) !== value.assetUuid)
            return { available: false, reason: 'SCENE_COMPONENT_PROPERTY_ASSET_NOT_LOADED' };
        return { available: true, value: loadedAsset };
    }
    return { available: false, reason: 'SCENE_COMPONENT_PROPERTY_TYPE_MISMATCH' };
}

function componentPropertyState(params) {
    if (!params || typeof params.sceneUuid !== 'string' || typeof params.nodeUuid !== 'string'
        || typeof params.nodePath !== 'string' || typeof params.componentClassName !== 'string'
        || typeof params.componentInstanceId !== 'string' || typeof params.property !== 'string'
        || !/^[A-Za-z][A-Za-z0-9_]*$/.test(params.property))
        return { available: false, reason: 'SCENE_COMPONENT_PROPERTY_INPUT_INVALID' };
    const located = locateNode(params.sceneUuid, params.nodeUuid);
    if (!located.state.available) return located.state;
    if (located.state.nodePath !== params.nodePath)
        return { available: false, reason: 'SCENE_NODE_PATH_MISMATCH', ...located.state };
    const resolved = componentClass(params.componentClassName);
    if (!resolved.available) return { ...resolved, sceneUuid: params.sceneUuid, nodeUuid: params.nodeUuid,
        nodePath: params.nodePath, componentClassName: params.componentClassName };
    const query = exactComponentInstances(located.node, resolved.constructor);
    if (!query.available) return query;
    const components = query.components;
    const component = components.find((item) => item && item._id != null && String(item._id) === params.componentInstanceId);
    if (!component) return { available: false, reason: 'SCENE_COMPONENT_INSTANCE_NOT_FOUND' };
    const constructor = component.constructor;
    const declared = Array.isArray(constructor && constructor.__props__) ? constructor.__props__ : [];
    const inherited = Array.isArray(constructor && constructor.$super && constructor.$super.__props__)
        ? constructor.$super.__props__ : [];
    const baseProperties = Array.isArray(cc.Component.__props__) ? cc.Component.__props__ : [];
    if (!declared.includes(params.property) || inherited.includes(params.property)
        || baseProperties.includes(params.property) || params.property.startsWith('_')
        || (Array.isArray(constructor.__values__) && !constructor.__values__.includes(params.property))
        || (cc.Class && typeof cc.Class.attr === 'function'
            && cc.Class.attr(constructor, params.property, 'serializable') === false))
        return { available: false, reason: 'SCENE_COMPONENT_PROPERTY_NOT_SERIALIZABLE' };
    const attrType = cc.Class && typeof cc.Class.attr === 'function'
        ? cc.Class.attr(resolved.constructor, params.property, 'type') : null;
    let value;
    try { value = component[params.property]; }
    catch (_) { return { available: false, reason: 'SCENE_COMPONENT_PROPERTY_READ_FAILED' }; }
    const serialized = componentValueKind(value, attrType);
    if (!serialized.available) return { available: false, reason: serialized.reason };
    if (['node-ref', 'component-ref', 'array'].includes(serialized.kind)) {
        const currentReference = decodeComponentValue(serialized.value, attrType, null, params.sceneUuid);
        if (!currentReference.available) return { available: false, reason: currentReference.reason };
    }
    if (Object.prototype.hasOwnProperty.call(params, 'requestedValue')
        && !(params.requestedValue && params.requestedValue.kind === 'asset')) {
        const requested = decodeComponentValue(params.requestedValue, attrType, null, params.sceneUuid);
        if (!requested.available) return { available: false, reason: requested.reason };
    }
    const classId = (type) => cc.js && typeof cc.js._getClassId === 'function'
        ? cc.js._getClassId(type, false) : null;
    const referenceClasses = new Map();
    function collectReferenceClasses(descriptor) {
        if (!descriptor || typeof descriptor !== 'object') return;
        if (descriptor.kind === 'array') descriptor.items.forEach(collectReferenceClasses);
        else if (descriptor.kind === 'component-ref' && descriptor.nodeUuid !== undefined) {
            const reference = componentClass(descriptor.componentClassName);
            referenceClasses.set(descriptor.componentClassName, reference.available ? classId(reference.constructor) : null);
        }
    }
    collectReferenceClasses(serialized.value);
    collectReferenceClasses(params.requestedValue);
    return { available: true, sceneName: located.state.sceneName, sceneUuid: located.state.sceneUuid,
        nodePath: located.state.nodePath, nodeUuid: located.state.nodeUuid,
        componentClassName: resolved.componentClassName, componentInstanceId: params.componentInstanceId,
        serializedClassId: classId(constructor), referenceClasses: Array.from(referenceClasses, ([componentClassName, serializedClassId]) =>
            ({ componentClassName, serializedClassId })).sort((left, right) => left.componentClassName.localeCompare(right.componentClassName)),
        property: params.property, propertyKind: serialized.kind, value: serialized.value };
}

function uiComponentState(params) {
    if (!params || typeof params.sceneUuid !== 'string' || typeof params.nodeUuid !== 'string')
        return { available: false, reason: 'SCENE_UI_INSPECT_INPUT_INVALID' };
    const located = locateNode(params.sceneUuid, params.nodeUuid);
    if (!located.state.available) return located.state;
    if (!located.node || typeof located.node.getComponents !== 'function' || !cc.Component)
        return { ...located.state, available: false, reason: 'SCENE_UI_COMPONENTS_UNAVAILABLE' };
    const allComponents = located.node.getComponents(cc.Component);
    if (!Array.isArray(allComponents))
        return { ...located.state, available: false, reason: 'SCENE_UI_COMPONENTS_UNAVAILABLE' };
    const components = allComponents.filter((component) => component && !editorManaged(component)
        && UI_COMPONENT_CLASS_NAMES.has(classNameOf(component)));
    const truncated = components.length > MAX_UI_COMPONENTS_PER_NODE;
    const result = [];
    for (const component of components.slice(0, MAX_UI_COMPONENTS_PER_NODE)) {
        const componentClassName = classNameOf(component);
        const componentInstanceId = component && component._id != null ? String(component._id).slice(0, 128) : null;
        if (!componentClassName || !componentInstanceId)
            return { ...located.state, available: false, reason: 'SCENE_UI_COMPONENT_IDENTITY_INVALID' };
        const constructor = component.constructor;
        const declared = Array.isArray(constructor && constructor.__props__) ? constructor.__props__ : [];
        const inherited = new Set([
            ...(Array.isArray(constructor && constructor.$super && constructor.$super.__props__)
                ? constructor.$super.__props__ : []),
            ...(Array.isArray(cc.Component.__props__) ? cc.Component.__props__ : []),
        ]);
        const publicProperties = declared.filter((property) => typeof property === 'string'
            && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(property) && !property.startsWith('_')
            && !inherited.has(property)
            && !(Array.isArray(constructor.__values__) && !constructor.__values__.includes(property))
            && !(cc.Class && typeof cc.Class.attr === 'function'
                && cc.Class.attr(constructor, property, 'serializable') === false));
        const properties = [];
        const unsupportedProperties = [];
        const propertyNames = publicProperties.slice(0, MAX_UI_PROPERTIES_PER_COMPONENT);
        for (const property of propertyNames) {
            const state = componentPropertyState({ sceneUuid: params.sceneUuid, nodeUuid: params.nodeUuid,
                nodePath: located.state.nodePath, componentClassName, componentInstanceId, property });
            if (state.available) properties.push({ name: property, kind: state.propertyKind, value: state.value });
            else unsupportedProperties.push({ name: property, reason: state.reason || 'SCENE_UI_PROPERTY_UNAVAILABLE' });
        }
        const row = { componentClassName, componentInstanceId, properties,
            unsupportedProperties, propertiesTruncated: publicProperties.length > propertyNames.length };
        const eventProperties = UI_EVENT_PROPERTIES[componentClassName] || [];
        if (eventProperties.length) {
            row.eventLists = {};
            row.eventListsUnavailable = {};
            for (const property of eventProperties) {
                const events = normalizedUiEvents(component, property);
                if (events.available) row.eventLists[property] = events.events;
                else row.eventListsUnavailable[property] = events.reason;
            }
            if (componentClassName === 'cc.Button') {
                row.clickEvents = row.eventLists.clickEvents;
                if (row.eventListsUnavailable.clickEvents)
                    row.clickEventsUnavailableReason = row.eventListsUnavailable.clickEvents;
            }
        }
        result.push(row);
    }
    return { available: true, sceneName: located.state.sceneName, sceneUuid: params.sceneUuid,
        nodeName: located.state.nodeName, nodeUuid: params.nodeUuid, nodePath: located.state.nodePath,
        componentCount: result.length, componentsTruncated: truncated, components: result };
}

function setComponentProperty(params, loadedAsset) {
    if (!params || typeof params.sceneUuid !== 'string' || typeof params.nodeUuid !== 'string'
        || typeof params.nodePath !== 'string' || typeof params.componentClassName !== 'string'
        || typeof params.componentInstanceId !== 'string' || typeof params.property !== 'string'
        || !validComponentValue(params.expectedValue) || !validComponentValue(params.value))
        return { available: false, reason: 'SCENE_COMPONENT_PROPERTY_INPUT_INVALID' };
    const before = componentPropertyState(params);
    if (!before.available) return before;
    if (!sameValue(before.value, params.expectedValue))
        return { ...before, available: false, reason: 'SCENE_COMPONENT_PROPERTY_PRECONDITION_FAILED' };
    if (sameValue(before.value, params.value))
        return { ...before, available: false, reason: 'SCENE_COMPONENT_PROPERTY_NO_CHANGE' };
    const located = locateNode(params.sceneUuid, params.nodeUuid);
    const resolved = componentClass(params.componentClassName);
    if (!resolved.available) return { ...before, available: false, reason: resolved.reason };
    const query = exactComponentInstances(located.node, resolved.constructor);
    if (!query.available) return { ...before, available: false, reason: query.reason };
    const component = query.components.find((item) => item._id != null && String(item._id) === params.componentInstanceId);
    if (!component) return { ...before, available: false, reason: 'SCENE_COMPONENT_INSTANCE_NOT_FOUND' };
    const attrType = cc.Class && typeof cc.Class.attr === 'function'
        ? cc.Class.attr(resolved.constructor, params.property, 'type') : null;
    const decoded = decodeComponentValue(params.value, attrType, loadedAsset, params.sceneUuid);
    if (!decoded.available) return { ...before, available: false, reason: decoded.reason };
    try { component[params.property] = decoded.value; }
    catch (_) { return { ...before, available: false, reason: 'SCENE_COMPONENT_PROPERTY_WRITE_FAILED' }; }
    let value;
    try { value = component[params.property]; }
    catch (_) { return { ...before, available: false, reason: 'SCENE_COMPONENT_PROPERTY_READBACK_FAILED' }; }
    const serialized = componentValueKind(value, attrType);
    if (!serialized.available || !sameValue(serialized.value, params.value))
        return { ...before, available: false, reason: 'SCENE_COMPONENT_PROPERTY_READBACK_FAILED',
            observedValue: serialized.available ? serialized.value : null };
    return { available: true, sceneUuid: params.sceneUuid, nodeUuid: params.nodeUuid, nodePath: params.nodePath,
        componentClassName: params.componentClassName, componentInstanceId: params.componentInstanceId,
        property: params.property, propertyKind: serialized.kind, beforeValue: before.value, value: serialized.value };
}

function addNodeComponent(params) {
    if (!params || typeof params.sceneUuid !== 'string' || typeof params.nodeUuid !== 'string'
        || typeof params.nodePath !== 'string' || typeof params.componentClassName !== 'string'
        || !Number.isInteger(params.expectedComponentCount) || params.expectedComponentCount < 0)
        return { available: false, reason: 'SCENE_COMPONENT_INPUT_INVALID' };
    const before = componentState(params);
    if (!before.available) return before;
    if (before.componentCount !== params.expectedComponentCount)
        return { ...before, available: false, reason: 'SCENE_COMPONENT_PRECONDITION_FAILED' };
    if (!before.canAdd) return { ...before, available: false, reason: before.requiresComponent
        ? 'SCENE_COMPONENT_HAS_UNAPPROVED_REQUIREMENT' : 'SCENE_COMPONENT_ALREADY_PRESENT' };
    const located = locateNode(params.sceneUuid, params.nodeUuid);
    const resolved = componentClass(params.componentClassName);
    if (!located.node || !resolved.available || typeof located.node.addComponent !== 'function')
        return { ...before, available: false, reason: 'SCENE_COMPONENT_ADD_UNAVAILABLE' };
    const component = located.node.addComponent(resolved.constructor);
    if (!component) return { ...before, available: false, reason: 'SCENE_COMPONENT_ADD_REJECTED' };
    const query = exactComponentInstances(located.node, resolved.constructor);
    const components = query.available ? query.components : null;
    if (!Array.isArray(components) || components.length !== params.expectedComponentCount + 1)
        return { ...before, available: false, reason: 'SCENE_COMPONENT_WRITE_READBACK_FAILED',
            observedComponentCount: Array.isArray(components) ? components.length : null };
    return { available: true, sceneUuid: params.sceneUuid, nodeUuid: params.nodeUuid,
        nodePath: params.nodePath, componentClassName: resolved.componentClassName,
        serializedClassId: serializedClassIdOf(resolved.constructor),
        beforeComponentCount: params.expectedComponentCount, componentCount: components.length,
        componentInstanceId: component._id != null ? String(component._id) : null };
}

function validUuid(value) {
    return typeof value === 'string' && (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value)
        || /^[A-Za-z0-9+/]{22,23}$/.test(value));
}

function prefabAssetState(params, callback) {
    if (!params || !validUuid(params.prefabUuid) || !cc || !cc.assetManager
        || typeof cc.assetManager.loadAny !== 'function' || typeof cc.Prefab !== 'function') {
        callback(null, { available: false, reason: 'SCENE_PREFAB_ASSET_INPUT_INVALID' });
        return;
    }
    cc.assetManager.loadAny(params.prefabUuid, (error, asset) => {
        if (error || !asset) {
            callback(null, { available: false, reason: 'SCENE_PREFAB_ASSET_LOAD_FAILED' });
            return;
        }
        const assetUuid = asset._uuid || asset.uuid;
        if (!(asset instanceof cc.Prefab) || assetUuid !== params.prefabUuid
            || !asset.data || !(asset.data instanceof cc.Node)) {
            callback(null, { available: false, reason: 'SCENE_PREFAB_ASSET_IDENTITY_MISMATCH' });
            return;
        }
        callback(null, { available: true, prefabUuid: assetUuid, assetClassName: 'cc.Prefab',
            rootName: String(asset.data.name || '').slice(0, MAX_NAME) });
    });
}

function prefabRootUuid() {
    const scene = cc && cc.director && cc.director.getScene && cc.director.getScene();
    if (!scene) return null;
    const roots = Array.isArray(scene.children) && scene.children.length ? scene.children : [scene];
    const candidates = new Set();
    for (const root of roots) {
        const asset = root && root._prefab && root._prefab.asset;
        const uuid = asset && (asset._uuid || asset.uuid);
        if (typeof uuid === 'string' && prefabPatch.UUID.test(uuid)) candidates.add(uuid);
    }
    return candidates.size === 1 ? candidates.values().next().value : null;
}

function prefabEditModeState() {
    if (typeof Editor === 'undefined' || Editor.isMainProcess !== false || typeof Editor.require !== 'function')
        return { available: false, reason: 'PREFAB_EDIT_MODE_API_UNAVAILABLE' };
    let editMode;
    try { editMode = Editor.require('scene://edit-mode'); }
    catch (_) { return { available: false, reason: 'PREFAB_EDIT_MODE_API_UNAVAILABLE' }; }
    if (!editMode || typeof editMode.curMode !== 'function')
        return { available: false, reason: 'PREFAB_EDIT_MODE_API_UNAVAILABLE' };
    let mode;
    try { mode = editMode.curMode(); }
    catch (_) { return { available: false, reason: 'PREFAB_EDIT_MODE_QUERY_FAILED' }; }
    if (!mode || typeof mode.name !== 'string') return { available: false, reason: 'PREFAB_EDIT_MODE_QUERY_FAILED' };
    const scene = cc && cc.director && cc.director.getScene && cc.director.getScene();
    return { available: true, modeName: mode.name,
        prefabUuid: mode.name === 'prefab' ? prefabRootUuid() : null,
        sceneUuid: scene && (typeof scene.uuid === 'string' ? scene.uuid : scene._id) || null,
        saveAvailable: typeof editMode.save === 'function', popAvailable: typeof editMode.pop === 'function' };
}

function matchesPrefabPath(actualPath, expectedPath) {
    if (typeof actualPath !== 'string' || typeof expectedPath !== 'string') return false;
    const actual = actualPath.split('/');
    const expected = expectedPath.split('/');
    return actual.length >= expected.length && expected.every((part, index) => actual[actual.length - expected.length + index] === part);
}

function prefabPatchSnapshot(node, nodePath) {
    if (!node || !Array.isArray(node.children) || !Array.isArray(node._components)) return null;
    const components = node._components.map((component) => {
        const className = classNameOf(component);
        if (!['cc.Sprite', 'cc.Label'].includes(className)) return null;
        const frame = className === 'cc.Sprite' && component.spriteFrame;
        return { className, enabled: typeof component.enabled === 'boolean' ? component.enabled : true,
            ...(className === 'cc.Sprite' ? { spriteFrameUuid: frame && (frame._uuid || frame.uuid) || null } : {}) };
    }).filter(Boolean);
    const position = typeof node.getPosition === 'function' ? node.getPosition() : { x: node.x, y: node.y };
    return { nodeUuid: typeof node.uuid === 'string' ? node.uuid : null, nodePath,
        name: String(node.name || ''), active: node.active !== false,
        transform: { x: Number(position.x), y: Number(position.y), scaleX: Number(node.scaleX), scaleY: Number(node.scaleY) },
        components };
}

function locatePrefabPatchNode(params, side = 'before') {
    const mode = prefabEditModeState();
    if (!mode.available || mode.modeName !== 'prefab' || mode.prefabUuid !== params.prefabUuid)
        return { available: false, reason: 'PREFAB_MODE_TARGET_MISMATCH', mode };
    if (typeof mode.sceneUuid !== 'string') return { available: false, reason: 'PREFAB_EDIT_SCENE_UNAVAILABLE', mode };
    const located = locateNode(mode.sceneUuid, params.targetNodeUuid);
    if (!located.state.available || !matchesPrefabPath(located.state.nodePath, prefabPatch.targetPathAt(params.targetNodePath,
        params.expectedDiff, side))) return { available: false, reason: 'PREFAB_NODE_IDENTITY_MISMATCH', mode };
    const snapshot = prefabPatchSnapshot(located.node, located.state.nodePath);
    if (!snapshot || !prefabPatch.matchesDiff(snapshot, params.expectedDiff, side))
        return { available: false, reason: 'PREFAB_EXPECTED_STATE_MISMATCH', mode };
    return { available: true, mode, node: located.node, snapshot };
}

function prefabPatchNameConflict(node, diff) {
    const rename = diff.find((item) => item.path === 'node.name');
    return !!(rename && node.parent && node.parent.children.some((child) => child !== node && child.name === rename.after));
}

function prefabSourcePatchPreflight(params) {
    if (!params || !prefabPatch.UUID.test(params.prefabUuid || '') || !prefabPatch.NODE_ID.test(params.targetNodeUuid || '')
        || !prefabPatch.validateDiff(params.expectedDiff) || !['apply', 'compensate', 'replay'].includes(params.action))
        return { available: false, reason: 'PREFAB_PATCH_INPUT_INVALID' };
    const target = locatePrefabPatchNode(params, 'before');
    if (!target.available) return target;
    if (prefabPatchNameConflict(target.node, params.expectedDiff))
        return { available: false, reason: 'PREFAB_NODE_NAME_CONFLICT' };
    return { available: true, prefabUuid: params.prefabUuid, mode: target.mode, node: target.snapshot,
        expectedDiff: params.expectedDiff };
}

function prefabSourcePatchMutate(params, callback) {
    const before = prefabSourcePatchPreflight(params);
    if (!before.available) { callback(null, before); return; }
    const located = locatePrefabPatchNode(params, 'before');
    if (!located.available) { callback(null, located); return; }
    const node = located.node;
    const spriteFrames = params.expectedDiff.filter((item) => item.path === 'component.cc.Sprite.spriteFrameUuid' && item.after !== null);
    const loaded = Object.create(null);
    const apply = () => {
        const current = locatePrefabPatchNode(params, 'before');
        if (!current.available || current.node !== node || prefabPatchNameConflict(node, params.expectedDiff)) {
            callback(null, { available: false, reason: 'PREFAB_PATCH_PRECONDITION_CHANGED', mutationStarted: false });
            return;
        }
        try {
            for (const item of params.expectedDiff) {
                const field = item.path;
                if (field === 'node.name') node.name = item.after;
                else if (field === 'node.active') node.active = item.after;
                else if (field === 'node.position.x') node.setPosition(item.after, node.y);
                else if (field === 'node.position.y') node.setPosition(node.x, item.after);
                else if (field === 'node.scale.x') node.setScale(item.after, node.scaleY, node.scaleZ);
                else if (field === 'node.scale.y') node.setScale(node.scaleX, item.after, node.scaleZ);
                else if (field.startsWith('component.')) {
                    const [, className, property] = field.match(/^component\.(cc\.(?:Sprite|Label))\.(enabled|spriteFrameUuid)$/) || [];
                    const matches = node._components.filter((component) => classNameOf(component) === className);
                    if (matches.length !== 1) throw new Error('PREFAB_COMPONENT_IDENTITY_AMBIGUOUS');
                    if (property === 'enabled') matches[0].enabled = item.after;
                    else matches[0].spriteFrame = item.after === null ? null : loaded[item.after];
                }
            }
        } catch (error) {
            callback(null, { available: false, reason: error && error.message || 'PREFAB_PATCH_WRITE_FAILED', mutationStarted: true });
            return;
        }
        const after = locatePrefabPatchNode(params, 'after');
        if (!after.available || after.node !== node) {
            callback(null, { available: false, reason: 'PREFAB_PATCH_WRITE_READBACK_FAILED', mutationStarted: true });
            return;
        }
        callback(null, { available: true, mutationStarted: true, prefabUuid: params.prefabUuid, mode: after.mode,
            node: after.snapshot, expectedDiff: params.expectedDiff });
    };
    if (!spriteFrames.length) { apply(); return; }
    if (!cc || !cc.assetManager || typeof cc.assetManager.loadAny !== 'function' || typeof cc.SpriteFrame !== 'function') {
        callback(null, { available: false, reason: 'PREFAB_SPRITE_FRAME_LOAD_UNAVAILABLE', mutationStarted: false });
        return;
    }
    let remaining = spriteFrames.length;
    let settled = false;
    for (const item of spriteFrames) {
        cc.assetManager.loadAny(item.after, (error, asset) => {
            if (settled) return;
            if (error || !(asset instanceof cc.SpriteFrame) || (asset._uuid || asset.uuid) !== item.after) {
                settled = true;
                callback(null, { available: false, reason: 'PREFAB_SPRITE_FRAME_LOAD_FAILED', mutationStarted: false });
                return;
            }
            loaded[item.after] = asset;
            remaining -= 1;
            if (remaining === 0) { settled = true; apply(); }
        });
    }
}

function savePrefabSource(params, callback) {
    const mode = prefabEditModeState();
    if (!mode.available || mode.modeName !== 'prefab' || mode.prefabUuid !== (params && params.prefabUuid)
        || !mode.saveAvailable) { callback(null, { available: false, reason: 'PREFAB_SAVE_TARGET_MISMATCH' }); return; }
    let settled = false;
    const finish = (error) => {
        if (settled) return;
        settled = true;
        const after = prefabEditModeState();
        if (error || !after.available || after.modeName !== 'prefab' || after.prefabUuid !== params.prefabUuid) {
            callback(null, { available: false, reason: error && (error.code || error.message) || 'PREFAB_SAVE_TARGET_MISMATCH' });
            return;
        }
        callback(null, { available: true, prefabUuid: params.prefabUuid, saved: true });
    };
    try {
        const editMode = Editor.require('scene://edit-mode');
        editMode.save(finish);
    } catch (error) { finish(error); }
}

function exitPrefabSourceMode(params) {
    const mode = prefabEditModeState();
    if (!mode.available || mode.modeName !== 'prefab' || mode.prefabUuid !== (params && params.prefabUuid) || !mode.popAvailable)
        return { available: false, reason: 'PREFAB_EXIT_TARGET_MISMATCH' };
    try {
        Editor.require('scene://edit-mode').pop();
        return { available: true, prefabUuid: params.prefabUuid, exitRequested: true };
    } catch (error) { return { available: false, reason: error && (error.code || error.message) || 'PREFAB_EXIT_FAILED' }; }
}

function prefabSourcePatchSnapshot(params) {
    if (!params || !['before', 'after'].includes(params.side) || !prefabPatch.validateDiff(params.expectedDiff))
        return { available: false, reason: 'PREFAB_PATCH_INPUT_INVALID' };
    const target = locatePrefabPatchNode(params, params.side);
    if (!target.available) return target;
    return { available: true, prefabUuid: params.prefabUuid, mode: target.mode, node: target.snapshot,
        expectedDiff: params.expectedDiff, verifiedSide: params.side };
}

function transformState(node) {
    const position = typeof node.getPosition === 'function' ? node.getPosition() : { x: node.x, y: node.y, z: 0 };
    return { x: Number(position.x) || 0, y: Number(position.y) || 0, z: Number(position.z) || 0,
        scaleX: Number(node.scaleX) || 0, scaleY: Number(node.scaleY) || 0,
        angle: Number(node.angle) || 0, width: Number(node.width) || 0, height: Number(node.height) || 0 };
}

function normalizeTransform(value) {
    const input = value || {};
    const keys = ['x', 'y', 'z', 'scaleX', 'scaleY', 'angle', 'width', 'height'];
    const output = { x: 0, y: 0, z: 0, scaleX: 1, scaleY: 1, angle: 0, width: 0, height: 0 };
    for (const key of keys) {
        if (input[key] === undefined) continue;
        if (typeof input[key] !== 'number' || !Number.isFinite(input[key]) || Math.abs(input[key]) > 1000000
            || (['width', 'height'].includes(key) && input[key] < 0))
            return { available: false, reason: 'SCENE_COMPOSE_TRANSFORM_INVALID', field: key };
        output[key] = input[key];
    }
    return { available: true, value: output };
}

function compositionState(params) {
    if (!params || typeof params.sceneUuid !== 'string' || !Array.isArray(params.nodes)
        || params.nodes.length < 1 || params.nodes.length > 12 || !Array.isArray(params.components)
        || params.components.length > 24 || !Array.isArray(params.buttonEvents) || params.buttonEvents.length > 12)
        return { available: false, reason: 'SCENE_COMPOSE_INPUT_INVALID' };
    const scene = cc && cc.director && cc.director.getScene && cc.director.getScene();
    if (!scene) return { available: false, reason: 'NO_ACTIVE_SCENE' };
    if (editorManaged(scene)) return { available: false, reason: 'NO_AUTHORING_SCENE' };
    if (scene.uuid !== params.sceneUuid) return { available: false, reason: 'SCENE_IDENTITY_MISMATCH', sceneUuid: scene.uuid || null };

    const created = new Map();
    const existing = new Map();
    const reservedNames = new Map();
    const plannedUuids = new Set();
    function resolveRef(ref, allowNew) {
        if (typeof ref !== 'string' || ref.length > 100) return { available: false, reason: 'SCENE_COMPOSE_REFERENCE_INVALID' };
        if (ref.startsWith('new:')) {
            if (!allowNew) return { available: false, reason: 'SCENE_COMPOSE_REFERENCE_ORDER_INVALID' };
            const row = created.get(ref.slice(4));
            return row ? { available: true, created: true, row } : { available: false, reason: 'SCENE_COMPOSE_REFERENCE_NOT_FOUND' };
        }
        if (!ref.startsWith('uuid:') || !validUuid(ref.slice(5)))
            return { available: false, reason: 'SCENE_COMPOSE_REFERENCE_INVALID' };
        const nodeUuid = ref.slice(5);
        const located = locateNode(params.sceneUuid, nodeUuid);
        if (!located.state.available) return { available: false, reason: located.state.reason || 'SCENE_COMPOSE_REFERENCE_NOT_FOUND' };
        existing.set(nodeUuid, located);
        return { available: true, created: false, nodeUuid, node: located.node, state: located.state };
    }

    for (const item of params.nodes) {
        if (!item || typeof item.id !== 'string' || !/^[a-z][a-z0-9_-]{0,31}$/.test(item.id)
            || created.has(item.id) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > MAX_NAME
            || !validUuid(item.uuid) || item.uuid === scene.uuid || plannedUuids.has(item.uuid))
            return { available: false, reason: 'SCENE_COMPOSE_NODE_INVALID' };
        const prefabUuid = item.prefabUuid === undefined ? null : item.prefabUuid;
        if (prefabUuid !== null && !validUuid(prefabUuid))
            return { available: false, reason: 'SCENE_COMPOSE_PREFAB_UUID_INVALID' };
        if (prefabUuid && (!item.transform || !['x', 'y', 'z', 'scaleX', 'scaleY', 'angle', 'width', 'height']
            .every((field) => Object.prototype.hasOwnProperty.call(item.transform, field))))
            return { available: false, reason: 'SCENE_COMPOSE_PREFAB_TRANSFORM_REQUIRED' };
        const transform = normalizeTransform(item.transform);
        if (!transform.available) return transform;
        if (created.has(`uuid:${item.uuid}`)) return { available: false, reason: 'SCENE_COMPOSE_NODE_UUID_DUPLICATE' };
        const collision = locateNode(params.sceneUuid, item.uuid);
        if (collision.state.available) return { available: false, reason: 'SCENE_COMPOSE_NODE_UUID_EXISTS' };
        const parent = resolveRef(item.parentRef, true);
        if (!parent.available) return parent;
        const parentUuid = parent.created ? parent.row.uuid : parent.nodeUuid;
        const parentNames = reservedNames.get(item.parentRef) || new Set();
        if (parentNames.has(item.name) || (!parent.created && parent.node.children.some((child) => child && child.name === item.name && !editorManaged(child))))
            return { available: false, reason: 'SCENE_COMPOSE_NODE_NAME_EXISTS', name: item.name };
        parentNames.add(item.name);
        reservedNames.set(item.parentRef, parentNames);
        const row = { id: item.id, uuid: item.uuid, name: item.name, parentRef: item.parentRef,
            parentUuid, transform: transform.value, prefabUuid };
        plannedUuids.add(item.uuid);
        created.set(item.id, row);
        created.set(`uuid:${item.uuid}`, row);
    }

    const componentById = new Map();
    const classByNode = new Map();
    for (const item of params.components) {
        if (!item || typeof item.id !== 'string' || !/^[a-z][a-z0-9_-]{0,31}$/.test(item.id)
            || componentById.has(item.id) || typeof item.className !== 'string' || !Array.isArray(item.properties)
            || item.properties.length > 16)
            return { available: false, reason: 'SCENE_COMPOSE_COMPONENT_INVALID' };
        const node = resolveRef(item.nodeRef, true);
        if (!node.available) return node;
        if (!node.created) return { available: false, reason: 'SCENE_COMPOSE_COMPONENT_TARGET_MUST_BE_CREATED' };
        if (node.row.prefabUuid) return { available: false, reason: 'SCENE_COMPOSE_PREFAB_COMPONENTS_ARE_READ_ONLY' };
        const resolved = componentClass(item.className);
        if (!resolved.available) return resolved;
        if (resolved.requiresComponent) return { available: false, reason: 'SCENE_COMPOSE_COMPONENT_HAS_UNAPPROVED_REQUIREMENT' };
        const classes = classByNode.get(item.nodeRef) || new Set();
        if (classes.has(item.className)) return { available: false, reason: 'SCENE_COMPOSE_COMPONENT_DUPLICATE' };
        classes.add(item.className);
        classByNode.set(item.nodeRef, classes);
        const propertyNames = new Set();
        for (const property of item.properties) {
            if (!property || typeof property.name !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(property.name)
                || propertyNames.has(property.name)) return { available: false, reason: 'SCENE_COMPOSE_PROPERTY_INVALID' };
            propertyNames.add(property.name);
            const declared = Array.isArray(resolved.constructor.__props__) ? resolved.constructor.__props__ : [];
            const inherited = Array.isArray(resolved.constructor.$super && resolved.constructor.$super.__props__)
                ? resolved.constructor.$super.__props__ : [];
            const baseProperties = Array.isArray(cc.Component.__props__) ? cc.Component.__props__ : [];
            if (!declared.includes(property.name) || inherited.includes(property.name) || baseProperties.includes(property.name)
                || property.name.startsWith('_')) return { available: false, reason: 'SCENE_COMPOSE_PROPERTY_NOT_SERIALIZABLE', property: property.name };
            const value = property.value;
            const assetRef = value && typeof value === 'object' && !Array.isArray(value)
                && typeof value.assetUuid === 'string' && typeof value.assetClass === 'string'
                && Object.keys(value).length === 2;
            if (!assetRef && !isScalar(value)) return { available: false, reason: 'SCENE_COMPOSE_PROPERTY_VALUE_INVALID', property: property.name };
            const attrType = cc.Class && typeof cc.Class.attr === 'function'
                ? cc.Class.attr(resolved.constructor, property.name, 'type') : null;
            if (assetRef) {
                const assetClass = cc[value.assetClass];
                if (!validUuid(value.assetUuid) || typeof assetClass !== 'function' || attrType !== assetClass)
                    return { available: false, reason: 'SCENE_COMPOSE_ASSET_PROPERTY_TYPE_MISMATCH', property: property.name };
            } else if (attrType === String && typeof value !== 'string') {
                return { available: false, reason: 'SCENE_COMPOSE_PROPERTY_TYPE_MISMATCH', property: property.name };
            } else if (attrType === Number && typeof value !== 'number') {
                return { available: false, reason: 'SCENE_COMPOSE_PROPERTY_TYPE_MISMATCH', property: property.name };
            } else if (attrType === Boolean && typeof value !== 'boolean') {
                return { available: false, reason: 'SCENE_COMPOSE_PROPERTY_TYPE_MISMATCH', property: property.name };
            } else if (attrType && attrType !== String && attrType !== Number && attrType !== Boolean && !assetRef) {
                return { available: false, reason: 'SCENE_COMPOSE_PROPERTY_TYPE_UNSUPPORTED', property: property.name };
            }
        }
        componentById.set(item.id, { ...item, className: resolved.componentClassName, nodeUuid: node.row.uuid });
    }

    const buttonClass = componentClass('cc.Button');
    if (params.buttonEvents.length && !buttonClass.available) return { available: false, reason: buttonClass.reason };
    for (const event of params.buttonEvents) {
        if (!event || typeof event.buttonRef !== 'string' || typeof event.handlerRef !== 'string'
            || typeof event.handlerComponentClassName !== 'string' || typeof event.handler !== 'string'
            || !/^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/.test(event.handler))
            return { available: false, reason: 'SCENE_COMPOSE_BUTTON_EVENT_INVALID' };
        const buttonNode = resolveRef(event.buttonRef, true);
        const targetNode = resolveRef(event.handlerRef, true);
        if (!buttonNode.available) return buttonNode;
        if (!targetNode.available) return targetNode;
        if (buttonNode.created && buttonNode.row.prefabUuid)
            return { available: false, reason: 'SCENE_COMPOSE_PREFAB_BUTTON_MUTATION_UNSUPPORTED' };
        if (targetNode.created && targetNode.row.prefabUuid)
            return { available: false, reason: 'SCENE_COMPOSE_PREFAB_HANDLER_TARGET_UNSUPPORTED' };
        if (!buttonNode.created || !classByNode.get(event.buttonRef)?.has('cc.Button'))
            return { available: false, reason: 'SCENE_COMPOSE_BUTTON_COMPONENT_REQUIRED' };
        const handler = componentClass(event.handlerComponentClassName);
        if (!handler.available) return handler;
        const planned = params.components.filter((component) => component.nodeRef === event.handlerRef
            && component.className === event.handlerComponentClassName);
        if (targetNode.created && planned.length !== 1)
            return { available: false, reason: 'SCENE_COMPOSE_HANDLER_COMPONENT_REQUIRED' };
        if (!targetNode.created) {
            const matches = targetNode.state.components.filter((component) => component.componentClassName === event.handlerComponentClassName);
            if (matches.length !== 1) return { available: false, reason: 'SCENE_COMPOSE_HANDLER_COMPONENT_AMBIGUOUS' };
        }
        if (!hasSafeComponentHandler(handler.constructor, event.handler))
            return { available: false, reason: 'SCENE_COMPOSE_HANDLER_NOT_FOUND', handler: event.handler };
    }

    const existingNodes = Array.from(existing.values()).map((entry) => ({ sceneUuid: entry.state.sceneUuid,
        nodeUuid: entry.state.nodeUuid, nodePath: entry.state.nodePath, active: entry.state.active,
        children: entry.state.children, components: entry.state.components }));
    existingNodes.sort((left, right) => left.nodeUuid.localeCompare(right.nodeUuid));
    return { available: true, sceneUuid: scene.uuid, sceneName: String(scene.name || '').slice(0, MAX_NAME),
        existingNodes, createdNodes: params.nodes.map((item) => ({ id: item.id, uuid: item.uuid,
            parentUuid: created.get(item.id).parentUuid, name: item.name, transform: created.get(item.id).transform,
            ...(created.get(item.id).prefabUuid ? { prefabUuid: created.get(item.id).prefabUuid } : {}) })),
        componentCount: params.components.length, buttonEventCount: params.buttonEvents.length };
}

function compositionReadback(params) {
    if (!params || typeof params.sceneUuid !== 'string' || !Array.isArray(params.nodes))
        return { available: false, reason: 'SCENE_COMPOSE_INPUT_INVALID' };
    const nodes = [];
    for (const item of params.nodes) {
        const located = locateNode(params.sceneUuid, item.uuid);
        if (!located.state.available) return { available: false, reason: located.state.reason || 'SCENE_COMPOSE_NODE_NOT_FOUND', nodeId: item.id };
        const parent = located.node.parent;
        const components = params.components.filter((component) => component.nodeRef === `new:${item.id}`).map((component) => {
            const resolved = componentClass(component.className);
            if (!resolved.available) return { id: component.id, available: false, reason: resolved.reason };
            const query = exactComponentInstances(located.node, resolved.constructor);
            if (!query.available || query.components.length !== 1) return { id: component.id, available: false,
                reason: query.reason || 'SCENE_COMPOSE_COMPONENT_READBACK_FAILED' };
            const instance = query.components[0];
            const serializedClassId = cc && cc.js && typeof cc.js._getClassId === 'function'
                ? cc.js._getClassId(resolved.constructor, false) : null;
            const propertyValues = {};
            for (const property of component.properties) {
                const value = instance[property.name];
                if (property.value && typeof property.value === 'object' && typeof property.value.assetUuid === 'string')
                    propertyValues[property.name] = value && (value._uuid || value.uuid) || null;
                else propertyValues[property.name] = isScalar(value) ? value : null;
            }
            const clickEvents = component.className === 'cc.Button' && Array.isArray(instance.clickEvents)
                ? instance.clickEvents.map((entry) => ({ targetUuid: entry && entry.target && entry.target.uuid || null,
                    component: entry && entry.component || null, handler: entry && entry.handler || null,
                    customEventData: entry && entry.customEventData || '' })) : null;
            return { id: component.id, componentClassName: resolved.componentClassName,
                serializedClassId: typeof serializedClassId === 'string' ? serializedClassId : null,
                componentInstanceId: instance._id != null ? String(instance._id) : null, propertyValues,
                clickEventCount: Array.isArray(clickEvents) ? clickEvents.length : null, clickEvents };
        });
        nodes.push({ id: item.id, uuid: located.state.nodeUuid, name: located.state.nodeName,
            nodePath: located.state.nodePath, parentUuid: parent && parent.uuid || null,
            transform: transformState(located.node), prefabUuid: located.node._prefab && located.node._prefab.asset
                ? located.node._prefab.asset._uuid || located.node._prefab.asset.uuid || null : null, components });
    }
    return { available: true, sceneUuid: params.sceneUuid, nodes };
}

function compose(params, callback) {
    const state = compositionState(params);
    if (!state.available) return callback(null, state);
    if (!params.expectedState || JSON.stringify(state) !== JSON.stringify(params.expectedState))
        return callback(null, { available: false, reason: 'SCENE_COMPOSE_PRECONDITION_FAILED', preflight: state, mutationStarted: false });
    const assets = new Map();
    const refs = new Map();
    const addAssetRef = (assetUuid, assetClass) => {
        const old = refs.get(assetUuid);
        if (old && old.assetClass !== assetClass)
            throw new Error('SCENE_COMPOSE_ASSET_CLASS_CONFLICT');
        refs.set(assetUuid, { assetUuid, assetClass });
    };
    for (const node of params.nodes) if (node.prefabUuid) addAssetRef(node.prefabUuid, 'Prefab');
    for (const component of params.components) for (const property of component.properties) {
        const value = property.value;
        if (value && typeof value === 'object' && typeof value.assetUuid === 'string')
            addAssetRef(value.assetUuid, value.assetClass);
    }
    const loadAsset = (ref) => new Promise((resolve, reject) => {
        if (!cc.assetManager || typeof cc.assetManager.loadAny !== 'function') { reject(new Error('SCENE_ASSET_MANAGER_UNAVAILABLE')); return; }
        const expectedClass = cc[ref.assetClass];
        cc.assetManager.loadAny(ref.assetUuid, (error, asset) => {
            if (error || !asset) { reject(new Error('SCENE_ASSET_LOAD_FAILED')); return; }
            if (typeof expectedClass !== 'function' || !(asset instanceof expectedClass)) {
                reject(new Error('SCENE_ASSET_TYPE_MISMATCH')); return;
            }
            assets.set(ref.assetUuid, asset);
            resolve();
        });
    });
    Promise.all(Array.from(refs.values(), loadAsset)).then(() => {
        const fresh = compositionState(params);
        if (!fresh.available || JSON.stringify(fresh) !== JSON.stringify(params.expectedState)) {
            callback(null, { available: false, reason: 'SCENE_COMPOSE_PRECONDITION_FAILED', preflight: fresh });
            return;
        }
        const created = new Map();
        const addedComponents = new Map();
        const rows = [];
        const buttonClass = componentClass('cc.Button');
        let mutationStarted = false;
        try {
            for (const item of params.nodes) {
                const prefab = item.prefabUuid ? assets.get(item.prefabUuid) : null;
                if (prefab && (!cc || typeof cc.instantiate !== 'function')) throw new Error('SCENE_PREFAB_INSTANTIATE_UNAVAILABLE');
                const node = prefab ? cc.instantiate(prefab) : new cc.Node(item.name);
                if (!node || typeof node.addChild !== 'function') throw new Error('SCENE_NODE_CREATE_UNAVAILABLE');
                node._id = item.uuid;
                node.name = item.name;
                const t = normalizeTransform(item.transform).value;
                node.setPosition(t.x, t.y, t.z);
                node.scaleX = t.scaleX;
                node.scaleY = t.scaleY;
                node.angle = t.angle;
                node.setContentSize(t.width, t.height);
                created.set(item.id, node);
                rows.push({ id: item.id, node, parentRef: item.parentRef });
            }
            for (const spec of params.components) {
                const node = created.get(spec.nodeRef.slice(4));
                const resolved = componentClass(spec.className);
                if (!node || !resolved.available || typeof node.addComponent !== 'function') throw new Error('SCENE_COMPOSE_COMPONENT_ADD_UNAVAILABLE');
                const component = node.addComponent(resolved.constructor);
                if (!component) throw new Error('SCENE_COMPOSE_COMPONENT_ADD_REJECTED');
                addedComponents.set(spec.id, component);
                for (const property of spec.properties) {
                    const value = property.value && typeof property.value === 'object' && typeof property.value.assetUuid === 'string'
                        ? assets.get(property.value.assetUuid) : property.value;
                    if (property.value && typeof property.value === 'object' && typeof property.value.assetUuid === 'string' && !value)
                        throw new Error('SCENE_ASSET_READBACK_MISSING');
                    component[property.name] = value;
                    const observed = component[property.name];
                    if (value && typeof value === 'object') {
                        if (!(observed === value || (observed && (observed._uuid || observed.uuid) === property.value.assetUuid)))
                            throw new Error('SCENE_COMPOSE_PROPERTY_READBACK_FAILED');
                    } else if (!Object.is(observed, value)) throw new Error('SCENE_COMPOSE_PROPERTY_READBACK_FAILED');
                }
            }
            for (const event of params.buttonEvents) {
                const button = created.get(event.buttonRef.slice(4));
                const target = event.handlerRef.startsWith('new:') ? created.get(event.handlerRef.slice(4))
                    : locateNode(params.sceneUuid, event.handlerRef.slice(5)).node;
                const buttonComponent = button && button.getComponent(buttonClass.constructor);
                if (!buttonComponent || !target || !cc.Component || typeof cc.Component.EventHandler !== 'function')
                    throw new Error('SCENE_COMPOSE_BUTTON_BIND_UNAVAILABLE');
                const eventHandler = new cc.Component.EventHandler();
                eventHandler.target = target;
                eventHandler.component = event.handlerComponentClassName;
                eventHandler.handler = event.handler;
                eventHandler.customEventData = typeof event.customEventData === 'string' ? event.customEventData : '';
                buttonComponent.clickEvents = Array.isArray(buttonComponent.clickEvents) ? buttonComponent.clickEvents.concat([eventHandler]) : [eventHandler];
                const last = buttonComponent.clickEvents[buttonComponent.clickEvents.length - 1];
                if (!last || last.target !== target || last.component !== event.handlerComponentClassName || last.handler !== event.handler)
                    throw new Error('SCENE_COMPOSE_BUTTON_BIND_READBACK_FAILED');
            }
            for (const row of rows) {
                const parent = row.parentRef.startsWith('new:') ? created.get(row.parentRef.slice(4))
                    : locateNode(params.sceneUuid, row.parentRef.slice(5)).node;
                if (!parent || typeof parent.addChild !== 'function') throw new Error('SCENE_COMPOSE_PARENT_UNAVAILABLE');
                mutationStarted = true;
                parent.addChild(row.node);
            }
        } catch (error) {
            if (!mutationStarted) for (const node of created.values()) {
                try { if (node && typeof node.destroy === 'function') node.destroy(); } catch (_) {}
            }
            callback(null, { available: false, reason: error && error.message || 'SCENE_COMPOSE_FAILED',
                mutationStarted, created: rows.filter((row) => row.node && row.node.parent).map((row) => ({ id: row.id, uuid: row.node.uuid })) });
            return;
        }
        const readback = compositionReadback(params);
        if (!readback.available) { callback(null, { ...readback, mutationStarted: true }); return; }
        callback(null, { available: true, mutationStarted: true, state, readback });
    }).catch((error) => callback(null, { available: false, reason: error && error.message || 'SCENE_ASSET_LOAD_FAILED', mutationStarted: false }));
}

module.exports = {
    snapshot(event, params) {
        try { event.reply(null, snapshot(params && params.maxNodes)); }
        catch (error) { event.reply({ code: 'SCENE_SNAPSHOT_FAILED', message: String(error && error.message || error) }); }
    },
    nodeState(event, params) {
        try { event.reply(null, nodeState(params || {})); }
        catch (error) { event.reply({ code: 'SCENE_NODE_STATE_FAILED', message: String(error && error.message || error) }); }
    },
    prefabInstanceState(event, params) {
        try { event.reply(null, prefabInstanceState(params || {})); }
        catch (error) { event.reply(null, { available: false, reason: error && (error.code || error.message) || 'SCENE_PREFAB_INSTANCE_INSPECT_FAILED' }); }
    },
    nodeTransformState(event, params) {
        try { event.reply(null, nodeTransformState(params || {})); }
        catch (error) { event.reply({ code: 'SCENE_NODE_TRANSFORM_STATE_FAILED', message: String(error && error.message || error) }); }
    },
    setNodeTransform(event, params) {
        try { event.reply(null, setNodeTransform(params || {})); }
        catch (error) { event.reply({ code: 'SCENE_NODE_TRANSFORM_WRITE_FAILED', message: String(error && error.message || error) }); }
    },
    buttonEventsState(event, params) {
        try { event.reply(null, buttonEventsState(params || {})); }
        catch (error) { event.reply({ code: 'SCENE_BUTTON_EVENTS_STATE_FAILED', message: String(error && error.message || error) }); }
    },
    setButtonEvents(event, params) {
        try { event.reply(null, setButtonEvents(params || {})); }
        catch (error) { event.reply({ code: 'SCENE_BUTTON_EVENTS_WRITE_FAILED', message: String(error && error.message || error) }); }
    },
    nodeNameState(event, params) {
        try { event.reply(null, nodeNameState(params || {})); }
        catch (error) { event.reply({ code: 'SCENE_NODE_NAME_STATE_FAILED', message: String(error && error.message || error) }); }
    },
    renameNode(event, params) {
        try { event.reply(null, renameNode(params || {})); }
        catch (error) { event.reply({ code: 'SCENE_NODE_RENAME_FAILED', message: String(error && error.message || error) }); }
    },
    nodeDeleteState(event, params) {
        try { event.reply(null, nodeDeleteState(params || {})); }
        catch (error) { event.reply({ code: 'SCENE_NODE_DELETE_STATE_FAILED', message: String(error && error.message || error) }); }
    },
    deleteNode(event, params) {
        try { event.reply(null, deleteNode(params || {})); }
        catch (error) { event.reply({ code: 'SCENE_NODE_DELETE_FAILED', message: String(error && error.message || error) }); }
    },
    nodeReparentState(event, params) {
        try { event.reply(null, nodeReparentState(params || {})); }
        catch (error) { event.reply({ code: 'SCENE_NODE_REPARENT_STATE_FAILED', message: String(error && error.message || error) }); }
    },
    reparentNode(event, params) {
        try { event.reply(null, reparentNode(params || {})); }
        catch (error) { event.reply({ code: 'SCENE_NODE_REPARENT_FAILED', message: String(error && error.message || error) }); }
    },
    setNodeActive(event, params) {
        try { event.reply(null, setNodeActive(params || {})); }
        catch (error) { event.reply({ code: 'SCENE_NODE_WRITE_FAILED', message: String(error && error.message || error) }); }
    },
    componentState(event, params) {
        try { event.reply(null, componentState(params || {})); }
        catch (error) { event.reply({ code: 'SCENE_COMPONENT_STATE_FAILED', message: String(error && error.message || error) }); }
    },
    componentRemoveState(event, params) {
        try { event.reply(null, componentRemoveState(params || {})); }
        catch (error) { event.reply({ code: 'SCENE_COMPONENT_REMOVE_STATE_FAILED', message: String(error && error.message || error) }); }
    },
    removeNodeComponent(event, params) {
        try { event.reply(null, removeNodeComponent(params || {})); }
        catch (error) { event.reply({ code: 'SCENE_COMPONENT_REMOVE_FAILED', message: String(error && error.message || error) }); }
    },
    addNodeComponent(event, params) {
        try { event.reply(null, addNodeComponent(params || {})); }
        catch (error) { event.reply({ code: 'SCENE_COMPONENT_WRITE_FAILED', message: String(error && error.message || error) }); }
    },
    componentPropertyState(event, params) {
        try { event.reply(null, componentPropertyState(params || {})); }
        catch (error) { event.reply({ code: 'SCENE_COMPONENT_PROPERTY_STATE_FAILED', message: String(error && error.message || error) }); }
    },
    uiComponentState(event, params) {
        try { event.reply(null, uiComponentState(params || {})); }
        catch (error) { event.reply({ code: 'SCENE_UI_INSPECT_FAILED', message: String(error && error.message || error) }); }
    },
    setComponentProperty(event, params) {
        try {
            const input = params || {};
            const value = input.value;
            if (value && value.kind === 'asset' && typeof value.assetUuid === 'string') {
                const constructor = cc && cc[value.assetClass];
                if (typeof constructor !== 'function' || !cc.assetManager
                    || typeof cc.assetManager.loadAny !== 'function') {
                    event.reply(null, { available: false, reason: 'SCENE_ASSET_MANAGER_UNAVAILABLE' });
                    return;
                }
                cc.assetManager.loadAny(value.assetUuid, (error, asset) => {
                    if (error || !asset) {
                        event.reply(null, { available: false, reason: 'SCENE_COMPONENT_PROPERTY_ASSET_LOAD_FAILED' });
                        return;
                    }
                    if (!(asset instanceof constructor) || (asset._uuid || asset.uuid) !== value.assetUuid) {
                        event.reply(null, { available: false, reason: 'SCENE_COMPONENT_PROPERTY_ASSET_TYPE_MISMATCH' });
                        return;
                    }
                    try { event.reply(null, setComponentProperty(input, asset)); }
                    catch (writeError) { event.reply({ code: 'SCENE_COMPONENT_PROPERTY_WRITE_FAILED', message: String(writeError && writeError.message || writeError) }); }
                });
                return;
            }
            event.reply(null, setComponentProperty(input));
        }
        catch (error) { event.reply({ code: 'SCENE_COMPONENT_PROPERTY_WRITE_FAILED', message: String(error && error.message || error) }); }
    },
    compositionState(event, params) {
        try { event.reply(null, compositionState(params || {})); }
        catch (error) { event.reply({ code: 'SCENE_COMPOSE_PREFLIGHT_FAILED', message: String(error && error.message || error) }); }
    },
    prefabAssetState(event, params) {
        try { prefabAssetState(params || {}, (error, result) => event.reply(error || null, result)); }
        catch (error) { event.reply({ code: 'SCENE_PREFAB_ASSET_STATE_FAILED', message: String(error && error.message || error) }); }
    },
    prefabEditModeState(event) {
        try { event.reply(null, prefabEditModeState()); }
        catch (error) { event.reply(null, { available: false, reason: error && (error.code || error.message) || 'PREFAB_EDIT_MODE_QUERY_FAILED' }); }
    },
    prefabSourcePatchPreflight(event, params) {
        try { event.reply(null, prefabSourcePatchPreflight(params || {})); }
        catch (error) { event.reply(null, { available: false, reason: error && (error.code || error.message) || 'PREFAB_PATCH_PREFLIGHT_FAILED' }); }
    },
    prefabSourcePatchMutate(event, params) {
        try { prefabSourcePatchMutate(params || {}, (error, result) => event.reply(error || null, result)); }
        catch (error) { event.reply(null, { available: false, reason: error && (error.code || error.message) || 'PREFAB_PATCH_WRITE_FAILED', mutationStarted: false }); }
    },
    savePrefabSource(event, params) {
        try { savePrefabSource(params || {}, (error, result) => event.reply(error || null, result)); }
        catch (error) { event.reply(null, { available: false, reason: error && (error.code || error.message) || 'PREFAB_SAVE_FAILED' }); }
    },
    exitPrefabSourceMode(event, params) {
        try { event.reply(null, exitPrefabSourceMode(params || {})); }
        catch (error) { event.reply(null, { available: false, reason: error && (error.code || error.message) || 'PREFAB_EXIT_FAILED' }); }
    },
    prefabSourcePatchSnapshot(event, params) {
        try { event.reply(null, prefabSourcePatchSnapshot(params || {})); }
        catch (error) { event.reply(null, { available: false, reason: error && (error.code || error.message) || 'PREFAB_PATCH_READBACK_FAILED' }); }
    },
    compositionReadback(event, params) {
        try { event.reply(null, compositionReadback(params || {})); }
        catch (error) { event.reply({ code: 'SCENE_COMPOSE_READBACK_FAILED', message: String(error && error.message || error) }); }
    },
    compose(event, params) {
        try { compose(params || {}, (error, result) => event.reply(error || null, result)); }
        catch (error) { event.reply({ code: 'SCENE_COMPOSE_FAILED', message: String(error && error.message || error) }); }
    },
};
