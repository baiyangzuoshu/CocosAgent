'use strict';

const MAX_NODES = 100;
const MAX_DEPTH = 6;
const MAX_NAME = 120;
const MAX_MUTATION_SCAN_NODES = 10000;
const MAX_MUTATION_SCAN_DEPTH = 64;
const MAX_COMPONENT_INSTANCES = 32;

function snapshot(maxNodes) {
    const scene = cc && cc.director && cc.director.getScene && cc.director.getScene();
    if (!scene) return { available: false, reason: 'NO_ACTIVE_SCENE', sceneName: null, sceneUuid: null, nodes: [] };
    const limit = Number.isInteger(maxNodes) && maxNodes > 0 ? Math.min(maxNodes, MAX_NODES) : MAX_NODES;
    const nodes = [];
    let truncated = false;
    function visit(node, parentPath, depth) {
        if (!node || nodes.length >= limit || depth > MAX_DEPTH) { truncated = true; return; }
        const name = String(node.name || '').slice(0, MAX_NAME);
        const nodePath = parentPath ? `${parentPath}/${name}` : name;
        const components = typeof node.getComponents === 'function' && cc.Component ? node.getComponents(cc.Component) : [];
        nodes.push({ name, path: nodePath, uuid: typeof node.uuid === 'string' ? node.uuid : null,
            active: node.active !== false, children: Array.isArray(node.children) ? node.children.length : 0,
            components: Array.isArray(components) ? components.map((item) => item && item.constructor && item.constructor.name)
                .filter((item) => typeof item === 'string').slice(0, 16) : [] });
        const children = Array.isArray(node.children) ? node.children : [];
        for (const child of children) {
            if (nodes.length >= limit) { truncated = true; break; }
            visit(child, nodePath, depth + 1);
        }
    }
    visit(scene, '', 0);
    return { available: true, sceneName: String(scene.name || '').slice(0, MAX_NAME),
        sceneUuid: typeof scene.uuid === 'string' ? scene.uuid : null,
        nodeCount: nodes.length, truncated, nodes };
}

function locateNode(sceneUuid, nodeUuid) {
    const scene = cc && cc.director && cc.director.getScene && cc.director.getScene();
    if (!scene) return { state: { available: false, reason: 'NO_ACTIVE_SCENE' }, node: null };
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
        const children = Array.isArray(item.node.children) ? item.node.children : [];
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
    const components = Array.isArray(allComponents) ? allComponents : [];
    const componentRows = components.slice(0, 32).map((component) => {
        const constructor = component && component.constructor;
        const className = constructor && cc.js && typeof cc.js.getClassName === 'function'
            ? cc.js.getClassName(constructor) : constructor && constructor.name;
        return { componentClassName: typeof className === 'string' ? className.slice(0, MAX_NAME) : null,
            componentInstanceId: component && component._id != null ? String(component._id).slice(0, 128) : null };
    });
    return { node: match.node, state: { available: true, sceneName: String(scene.name || '').slice(0, MAX_NAME), sceneUuid: scene.uuid,
        nodeName: String(match.node.name || '').slice(0, MAX_NAME), nodeUuid: match.node.uuid,
        nodePath: match.path, active: match.node.active, componentsAvailable: componentsAvailable && Array.isArray(allComponents),
        componentCount: components.length, components: componentRows, componentsTruncated: components.length > componentRows.length, visited } };
}

function findNode(sceneUuid, nodeUuid) {
    return locateNode(sceneUuid, nodeUuid).state;
}

function nodeState(params) {
    return findNode(params && params.sceneUuid, params && params.nodeUuid);
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
    return { available: true, components: candidates.filter((component) => component && component.constructor === constructor) };
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
        componentClassName: resolved.componentClassName, componentCount: components.length,
        componentInstanceIds: components.map((component) => component && component._id != null ? String(component._id) : null),
        requiresComponent: resolved.requiresComponent, disallowMultiple: resolved.disallowMultiple,
        canAdd: components.length === 0 && !resolved.requiresComponent };
}

function isScalar(value) {
    return typeof value === 'string' || typeof value === 'boolean'
        || (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1000000000);
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
        || baseProperties.includes(params.property) || params.property.startsWith('_'))
        return { available: false, reason: 'SCENE_COMPONENT_PROPERTY_NOT_SERIALIZABLE' };
    let value;
    try { value = component[params.property]; }
    catch (_) { return { available: false, reason: 'SCENE_COMPONENT_PROPERTY_READ_FAILED' }; }
    if (!isScalar(value)) return { available: false, reason: 'SCENE_COMPONENT_PROPERTY_TYPE_UNSUPPORTED' };
    return { available: true, sceneName: located.state.sceneName, sceneUuid: located.state.sceneUuid,
        nodePath: located.state.nodePath, nodeUuid: located.state.nodeUuid,
        componentClassName: resolved.componentClassName, componentInstanceId: params.componentInstanceId,
        property: params.property, value, valueType: typeof value };
}

function setComponentProperty(params) {
    if (!params || typeof params.sceneUuid !== 'string' || typeof params.nodeUuid !== 'string'
        || typeof params.nodePath !== 'string' || typeof params.componentClassName !== 'string'
        || typeof params.componentInstanceId !== 'string' || typeof params.property !== 'string'
        || !isScalar(params.expectedValue) || !isScalar(params.value) || typeof params.expectedValue !== typeof params.value)
        return { available: false, reason: 'SCENE_COMPONENT_PROPERTY_INPUT_INVALID' };
    const before = componentPropertyState(params);
    if (!before.available) return before;
    if (!Object.is(before.value, params.expectedValue))
        return { ...before, available: false, reason: 'SCENE_COMPONENT_PROPERTY_PRECONDITION_FAILED' };
    if (Object.is(before.value, params.value))
        return { ...before, available: false, reason: 'SCENE_COMPONENT_PROPERTY_NO_CHANGE' };
    const located = locateNode(params.sceneUuid, params.nodeUuid);
    const resolved = componentClass(params.componentClassName);
    if (!resolved.available) return { ...before, available: false, reason: resolved.reason };
    const query = exactComponentInstances(located.node, resolved.constructor);
    if (!query.available) return { ...before, available: false, reason: query.reason };
    const component = query.components.find((item) => item._id != null && String(item._id) === params.componentInstanceId);
    if (!component) return { ...before, available: false, reason: 'SCENE_COMPONENT_INSTANCE_NOT_FOUND' };
    try { component[params.property] = params.value; }
    catch (_) { return { ...before, available: false, reason: 'SCENE_COMPONENT_PROPERTY_WRITE_FAILED' }; }
    let value;
    try { value = component[params.property]; }
    catch (_) { return { ...before, available: false, reason: 'SCENE_COMPONENT_PROPERTY_READBACK_FAILED' }; }
    if (!Object.is(value, params.value))
        return { ...before, available: false, reason: 'SCENE_COMPONENT_PROPERTY_READBACK_FAILED', observedValue: isScalar(value) ? value : null };
    return { available: true, sceneUuid: params.sceneUuid, nodeUuid: params.nodeUuid, nodePath: params.nodePath,
        componentClassName: params.componentClassName, componentInstanceId: params.componentInstanceId,
        property: params.property, beforeValue: before.value, value };
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
        beforeComponentCount: params.expectedComponentCount, componentCount: components.length,
        componentInstanceId: component._id != null ? String(component._id) : null };
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
    setNodeActive(event, params) {
        try { event.reply(null, setNodeActive(params || {})); }
        catch (error) { event.reply({ code: 'SCENE_NODE_WRITE_FAILED', message: String(error && error.message || error) }); }
    },
    componentState(event, params) {
        try { event.reply(null, componentState(params || {})); }
        catch (error) { event.reply({ code: 'SCENE_COMPONENT_STATE_FAILED', message: String(error && error.message || error) }); }
    },
    addNodeComponent(event, params) {
        try { event.reply(null, addNodeComponent(params || {})); }
        catch (error) { event.reply({ code: 'SCENE_COMPONENT_WRITE_FAILED', message: String(error && error.message || error) }); }
    },
    componentPropertyState(event, params) {
        try { event.reply(null, componentPropertyState(params || {})); }
        catch (error) { event.reply({ code: 'SCENE_COMPONENT_PROPERTY_STATE_FAILED', message: String(error && error.message || error) }); }
    },
    setComponentProperty(event, params) {
        try { event.reply(null, setComponentProperty(params || {})); }
        catch (error) { event.reply({ code: 'SCENE_COMPONENT_PROPERTY_WRITE_FAILED', message: String(error && error.message || error) }); }
    },
};
