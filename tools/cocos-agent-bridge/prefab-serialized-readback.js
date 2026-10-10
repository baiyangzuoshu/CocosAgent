'use strict';

const sceneReadback = require('./scene-serialized-readback');

function prefabRoot(objects) {
    if (!Array.isArray(objects) || !objects[0] || objects[0].__type__ !== 'cc.Prefab'
        || !objects[0].data || !Number.isInteger(objects[0].data.__id__)) return null;
    const root = objects[objects[0].data.__id__];
    return root && root.__type__ === 'cc.Node' ? { index: objects[0].data.__id__, object: root } : null;
}

function pathIndex(objects) {
    const root = prefabRoot(objects);
    if (!root) return null;
    const byUuid = new Map();
    const byPath = new Map();
    const visited = new Set();
    const attachedComponents = new Set();
    let invalid = false;
    function visit(node, parentIndex, nodePath) {
        if (!node || !node.object || node.object.__type__ !== 'cc.Node' || visited.has(node.index)
            || typeof node.object._id !== 'string' || !node.object._id
            || typeof node.object._name !== 'string' || !node.object._name
            || (parentIndex !== null && (!node.object._parent || node.object._parent.__id__ !== parentIndex))) {
            invalid = true; return;
        }
        visited.add(node.index);
        if (byUuid.has(node.object._id) || byPath.has(nodePath)) { invalid = true; return; }
        const entry = { ...node, path: nodePath };
        byUuid.set(node.object._id, entry);
        byPath.set(nodePath, entry);
        const children = Array.isArray(node.object._children) ? node.object._children : [];
        const childIds = new Set();
        for (const reference of children) {
            if (!reference || !Number.isInteger(reference.__id__) || childIds.has(reference.__id__)) { invalid = true; continue; }
            childIds.add(reference.__id__);
            const child = objects[reference.__id__];
            if (!child || child.__type__ !== 'cc.Node') { invalid = true; continue; }
            visit({ index: reference.__id__, object: child }, node.index, `${nodePath}/${child._name}`);
        }
        const components = Array.isArray(node.object._components) ? node.object._components : [];
        const componentIds = new Set();
        for (const reference of components) {
            if (!reference || !Number.isInteger(reference.__id__) || componentIds.has(reference.__id__)) { invalid = true; continue; }
            componentIds.add(reference.__id__);
            if (attachedComponents.has(reference.__id__)) { invalid = true; continue; }
            attachedComponents.add(reference.__id__);
            const component = objects[reference.__id__];
            if (!component || typeof component.__type__ !== 'string' || !component.__type__.startsWith('cc.')) { invalid = true; continue; }
            if (component.node && component.node.__id__ !== node.index) invalid = true;
            if (component._node && component._node.__id__ !== node.index) invalid = true;
        }
    }
    visit(root, null, root.object._name);
    const serializedNodeCount = objects.filter((object) => object && object.__type__ === 'cc.Node').length;
    if (visited.size !== serializedNodeCount) invalid = true;
    return invalid ? null : { root, byUuid, byPath, visited };
}

function resolveNode(objects, nodePath, nodeUuid) {
    const index = pathIndex(objects);
    if (!index) return null;
    const byUuid = index.byUuid.get(nodeUuid);
    const byPath = index.byPath.get(nodePath);
    return byUuid && byPath && byUuid.index === byPath.index ? byUuid : null;
}

function matchesDiff(objects, node, diff, side) {
    return !!node && sceneReadback.matchesSerializedDiff(objects, node, diff, side);
}

module.exports = { prefabRoot, pathIndex, resolveNode, matchesDiff };
