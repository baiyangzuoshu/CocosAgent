'use strict';

const MAX_NODES = 100;
const MAX_DEPTH = 6;
const MAX_NAME = 120;
const MAX_MUTATION_SCAN_NODES = 10000;
const MAX_MUTATION_SCAN_DEPTH = 64;
const MAX_COMPONENT_INSTANCES = 32;

function editorManaged(object) {
    const flags = cc && cc.Object && cc.Object.Flags;
    if (!flags || typeof flags.DontSave !== 'number' || typeof flags.HideInHierarchy !== 'number')
        throw new Error('SCENE_AUTHORING_FLAGS_UNAVAILABLE');
    return !!(object && (object._objFlags & (flags.DontSave | flags.HideInHierarchy)));
}

function authoringChildren(node) {
    return (Array.isArray(node.children) ? node.children : []).filter((child) => child && !editorManaged(child));
}

function snapshot(maxNodes) {
    const scene = cc && cc.director && cc.director.getScene && cc.director.getScene();
    if (!scene) return { available: false, reason: 'NO_ACTIVE_SCENE', sceneName: null, sceneUuid: null, nodes: [] };
    if (editorManaged(scene)) return { available: false, reason: 'NO_AUTHORING_SCENE', sceneName: null, sceneUuid: null, nodes: [] };
    const limit = Number.isInteger(maxNodes) && maxNodes > 0 ? Math.min(maxNodes, MAX_NODES) : MAX_NODES;
    const nodes = [];
    let truncated = false;
    function visit(node, parentPath, depth) {
        if (!node || nodes.length >= limit || depth > MAX_DEPTH) { truncated = true; return; }
        const name = String(node.name || '').slice(0, MAX_NAME);
        const nodePath = parentPath ? `${parentPath}/${name}` : name;
        const components = typeof node.getComponents === 'function' && cc.Component ? node.getComponents(cc.Component) : [];
        const children = authoringChildren(node);
        nodes.push({ name, path: nodePath, uuid: typeof node.uuid === 'string' ? node.uuid : null,
            active: node.active !== false, children: children.length,
            components: Array.isArray(components) ? components.filter((item) => !editorManaged(item)).map((item) => item && item.constructor && item.constructor.name)
                .filter((item) => typeof item === 'string').slice(0, 16) : [] });
        for (const child of children) {
            if (nodes.length >= limit) { truncated = true; break; }
            visit(child, nodePath, depth + 1);
        }
    }
    visit(scene, '', 0);
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
            componentInstanceId: component && component._id != null ? String(component._id).slice(0, 128) : null };
    });
    return { node: match.node, state: { available: true, sceneName: String(scene.name || '').slice(0, MAX_NAME), sceneUuid: scene.uuid,
        nodeName: String(match.node.name || '').slice(0, MAX_NAME), nodeUuid: match.node.uuid,
        nodePath: match.path, active: match.node.active, children: children.length,
        componentsAvailable: componentsAvailable && Array.isArray(allComponents),
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
    const components = candidates.filter((component) => component && component.constructor === constructor);
    if (components.some(editorManaged)) return { available: false, reason: 'SCENE_EDITOR_COMPONENT_PROTECTED' };
    return { available: true, components };
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

function validUuid(value) {
    return typeof value === 'string' && (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value)
        || /^[A-Za-z0-9+/]{22,23}$/.test(value));
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
            parentUuid, transform: transform.value };
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
        const prototype = handler.constructor.prototype;
        if (!prototype || typeof prototype[event.handler] !== 'function')
            return { available: false, reason: 'SCENE_COMPOSE_HANDLER_NOT_FOUND', handler: event.handler };
    }

    const existingNodes = Array.from(existing.values()).map((entry) => ({ sceneUuid: entry.state.sceneUuid,
        nodeUuid: entry.state.nodeUuid, nodePath: entry.state.nodePath, active: entry.state.active,
        children: entry.state.children, components: entry.state.components }));
    existingNodes.sort((left, right) => left.nodeUuid.localeCompare(right.nodeUuid));
    return { available: true, sceneUuid: scene.uuid, sceneName: String(scene.name || '').slice(0, MAX_NAME),
        existingNodes, createdNodes: params.nodes.map((item) => ({ id: item.id, uuid: item.uuid,
            parentUuid: created.get(item.id).parentUuid, name: item.name, transform: created.get(item.id).transform })),
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
                componentInstanceId: instance._id != null ? String(instance._id) : null, propertyValues,
                clickEventCount: Array.isArray(clickEvents) ? clickEvents.length : null, clickEvents };
        });
        nodes.push({ id: item.id, uuid: located.state.nodeUuid, name: located.state.nodeName,
            nodePath: located.state.nodePath, parentUuid: parent && parent.uuid || null,
            transform: transformState(located.node), components });
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
    for (const component of params.components) for (const property of component.properties) {
        const value = property.value;
        if (value && typeof value === 'object' && typeof value.assetUuid === 'string') refs.set(value.assetUuid, value);
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
                const node = new cc.Node(item.name);
                if (!node || typeof node.addChild !== 'function') throw new Error('SCENE_NODE_CREATE_UNAVAILABLE');
                node._id = item.uuid;
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
    compositionState(event, params) {
        try { event.reply(null, compositionState(params || {})); }
        catch (error) { event.reply({ code: 'SCENE_COMPOSE_PREFLIGHT_FAILED', message: String(error && error.message || error) }); }
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
