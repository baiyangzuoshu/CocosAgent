'use strict';

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_META_BYTES = 16 * 1024;
const MAX_OBJECTS = 20000;
const MAX_NODES = 10000;
const MAX_COMPONENTS_PER_NODE = 64;
const UUID_PATTERN = /^(?:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[A-Za-z0-9+/]{22,23})$/;

function fail(reason, details = {}) { return { available: false, reason, ...details }; }

function refIndex(value, records) {
    if (!value || typeof value !== 'object' || !Number.isInteger(value.__id__)
        || value.__id__ < 0 || value.__id__ >= records.length) return null;
    return value.__id__;
}

function serializedAssetUuid(value) {
    return value && typeof value === 'object' && typeof value.__uuid__ === 'string'
        ? value.__uuid__ : null;
}

function prefabInfoFor(node, records) {
    const index = refIndex(node._prefab, records);
    const info = index === null ? null : records[index];
    return info && info.__type__ === 'cc.PrefabInfo' ? info : null;
}

function componentSummary(reference, records, index) {
    const componentIndex = refIndex(reference, records);
    const component = componentIndex === null ? null : records[componentIndex];
    if (!component || typeof component.__type__ !== 'string') return null;
    const row = { index, classId: component.__type__.slice(0, 160) };
    if (component._id !== undefined && (typeof component._id === 'string' || Number.isInteger(component._id)))
        row.instanceId = String(component._id).slice(0, 128);
    if (component.__type__ === 'cc.Sprite' || component.__type__ === 'cc.Label') {
        row.className = component.__type__;
        row.enabled = typeof component._enabled === 'boolean' ? component._enabled : true;
        if (component.__type__ === 'cc.Sprite') row.spriteFrameUuid = serializedAssetUuid(component._spriteFrame);
    }
    return row;
}

function inspectPrefabSource({ prefabBytes, metaBytes, prefabUuid }) {
    if (!Buffer.isBuffer(prefabBytes) || prefabBytes.length < 2 || prefabBytes.length > MAX_BYTES)
        return fail('PREFAB_SERIALIZATION_SIZE_INVALID');
    if (!Buffer.isBuffer(metaBytes) || metaBytes.length < 2 || metaBytes.length > MAX_META_BYTES)
        return fail('PREFAB_META_SIZE_INVALID');
    if (typeof prefabUuid !== 'string' || !UUID_PATTERN.test(prefabUuid))
        return fail('PREFAB_UUID_INVALID');

    let meta;
    let parsed;
    try {
        meta = JSON.parse(metaBytes.toString('utf8'));
        parsed = JSON.parse(prefabBytes.toString('utf8'));
    } catch (_) { return fail('PREFAB_SERIALIZATION_INVALID'); }
    if (!meta || meta.uuid !== prefabUuid || meta.importer !== 'prefab')
        return fail('PREFAB_META_IDENTITY_MISMATCH');
    const records = Array.isArray(parsed) ? parsed : [parsed];
    if (!records.length || records.length > MAX_OBJECTS
        || records.some((record) => !record || typeof record !== 'object' || Array.isArray(record)))
        return fail('PREFAB_OBJECT_COUNT_INVALID');

    const nodeRows = new Map();
    for (let index = 0; index < records.length; index += 1) {
        const record = records[index];
        if (record.__type__ !== 'cc.Node') continue;
        nodeRows.set(index, record);
    }
    if (!nodeRows.size || nodeRows.size > MAX_NODES) return fail('PREFAB_NODE_COUNT_INVALID');
    const roots = Array.from(nodeRows.entries()).filter(([, node]) => node._parent == null);
    if (roots.length !== 1) return fail('PREFAB_ROOT_IDENTITY_AMBIGUOUS', { rootCount: roots.length });

    const visited = new Set();
    const identities = new Set();
    const paths = new Set();
    const nodes = [];
    const stack = [{ index: roots[0][0], parentPath: '', parentId: null, depth: 0 }];
    while (stack.length) {
        const item = stack.pop();
        if (item.depth > 64 || visited.has(item.index)) return fail('PREFAB_HIERARCHY_INVALID');
        visited.add(item.index);
        const record = nodeRows.get(item.index);
        if (!record) return fail('PREFAB_CHILD_REFERENCE_INVALID');
        const name = typeof record._name === 'string' ? record._name : '';
        if (!name || name.length > 120) return fail('PREFAB_NODE_NAME_INVALID');
        const nodePath = item.parentPath ? `${item.parentPath}/${name}` : name;
        if (nodePath.length > 512 || paths.has(nodePath)) return fail('PREFAB_NODE_PATH_AMBIGUOUS', { nodePath: nodePath.slice(0, 512) });
        paths.add(nodePath);

        const info = prefabInfoFor(record, records);
        const fileId = info && typeof info.fileId === 'string' && info.fileId ? info.fileId : null;
        const nodeId = typeof record._id === 'string' && record._id ? record._id : fileId;
        if (nodeId && identities.has(nodeId)) return fail('PREFAB_NODE_ID_DUPLICATE', { nodeId });
        if (nodeId) identities.add(nodeId);

        const trs = record._trs && Array.isArray(record._trs.array) ? record._trs.array : null;
        const transform = trs && trs.length >= 9 ? {
            x: Number.isFinite(trs[0]) ? trs[0] : null,
            y: Number.isFinite(trs[1]) ? trs[1] : null,
            scaleX: Number.isFinite(trs[7]) ? trs[7] : null,
            scaleY: Number.isFinite(trs[8]) ? trs[8] : null,
        } : null;
        const componentRefs = Array.isArray(record._components) ? record._components : [];
        if (componentRefs.length > MAX_COMPONENTS_PER_NODE) return fail('PREFAB_COMPONENT_LIMIT', { nodePath });
        const allComponents = componentRefs.map((reference, index) => componentSummary(reference, records, index));
        if (allComponents.some((component) => !component)) return fail('PREFAB_COMPONENT_REFERENCE_INVALID', { nodePath });
        const components = allComponents.slice(0, 8);
        const node = { nodeUuid: nodeId, fileId, name, nodePath, parentUuid: item.parentId,
            active: typeof record._active === 'boolean' ? record._active : true,
            transform, components, componentsTruncated: allComponents.length > components.length };
        const children = Array.isArray(record._children) ? record._children : [];
        if (children.length > MAX_NODES) return fail('PREFAB_CHILD_LIMIT', { nodePath });
        const childRows = [];
        for (const childRef of children) {
            const childIndex = refIndex(childRef, records);
            const child = childIndex === null ? null : nodeRows.get(childIndex);
            const parentIndex = child && refIndex(child._parent, records);
            if (!child || parentIndex !== item.index) return fail('PREFAB_PARENT_CHILD_MISMATCH', { nodePath });
            const childInfo = prefabInfoFor(child, records);
            const childId = typeof child._id === 'string' && child._id
                ? child._id : childInfo && typeof childInfo.fileId === 'string' && childInfo.fileId ? childInfo.fileId : null;
            childRows.push({ index: childIndex, id: childId });
        }
        nodes.push(node);
        for (let index = childRows.length - 1; index >= 0; index -= 1) {
            const child = childRows[index];
            stack.push({ index: child.index, parentPath: nodePath, parentId: nodeId, depth: item.depth + 1 });
        }
    }
    if (visited.size !== nodeRows.size) return fail('PREFAB_UNREACHABLE_NODE_RECORDS', {
        reachableNodeCount: visited.size, serializedNodeCount: nodeRows.size,
    });
    return { available: true, prefabUuid, rootName: nodes[0].name, nodeCount: nodes.length, nodes };
}

module.exports = { inspectPrefabSource };
