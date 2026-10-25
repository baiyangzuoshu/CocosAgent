'use strict';

const prefabPatch = require('./prefab-patch.cjs');
const { rootNodeId } = prefabPatch;

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_META_BYTES = 16 * 1024;
const MAX_OBJECTS = 20000;
const MAX_NODES = 10000;
const MAX_COMPONENTS_PER_NODE = 64;
const UUID_PATTERN = /^(?:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[A-Za-z0-9+/]{22,23})$/;
const NODE_ID = /^[A-Za-z0-9_+/=-]{1,128}$/;

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

function componentSummary(reference, records, index, nodeId, prefabUuid) {
    const componentIndex = refIndex(reference, records);
    const component = componentIndex === null ? null : records[componentIndex];
    if (!component || typeof component.__type__ !== 'string') return null;
    const classId = component.__type__.slice(0, 160);
    const row = { index, classId, className: classId };
    row.instanceId = prefabPatch.componentIdFor(prefabUuid, nodeId, index, classId, component._id);
    row.instanceIdSynthetic = !(typeof component._id === 'string' && component._id);
    const serializedProperties = Object.keys(component).filter((key) => /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/.test(key));
    row.serializedProperties = serializedProperties.slice(0, 256);
    row.serializedPropertiesTruncated = serializedProperties.length > row.serializedProperties.length;
    row.enabled = typeof component._enabled === 'boolean' ? component._enabled : true;
    if (component.__type__ === 'cc.Sprite' || component.__type__ === 'cc.Label') {
        row.className = component.__type__;
        if (component.__type__ === 'cc.Sprite') row.spriteFrameUuid = serializedAssetUuid(component._spriteFrame);
    }
    if (component.__type__ === 'cc.BlockInputEvents') {
        row.componentIdSynthetic = row.instanceIdSynthetic;
    }
    const eventProperties = prefabPatch.UI_EVENT_PROPERTIES[component.__type__] || [];
    if (eventProperties.length) {
        row.eventLists = {};
        row.eventListsUnavailable = {};
        for (const property of eventProperties) {
            const events = serializedUiEvents(component[property], records, prefabUuid);
            if (events) row.eventLists[property] = events;
            else row.eventListsUnavailable[property] = 'PREFAB_COMPONENT_EVENT_LIST_UNAVAILABLE';
        }
    }
    return row;
}

const WIDGET_ALIGN_FLAGS = Object.freeze({ isAlignTop: 1, isAlignVerticalCenter: 2, isAlignBottom: 4,
    isAlignLeft: 8, isAlignHorizontalCenter: 16, isAlignRight: 32 });
const LABEL_STYLE_FLAGS = Object.freeze({ enableBold: 1, enableItalic: 2, enableUnderline: 4 });

function prefabNodeId(record, records, prefabUuid) {
    if (typeof record._id === 'string' && record._id) return record._id;
    const info = prefabInfoFor(record, records);
    return info && typeof info.fileId === 'string' && info.fileId
        ? info.fileId : record._parent == null ? rootNodeId(prefabUuid) : null;
}

function serializedUiEvents(rawEvents, records, prefabUuid) {
    if (rawEvents === undefined) return [];
    if (!Array.isArray(rawEvents) || rawEvents.length > 12) return null;
    const events = [];
    for (const reference of rawEvents) {
        const eventIndex = refIndex(reference, records);
        const event = eventIndex === null ? null : records[eventIndex];
        if (!event || event.__type__ !== 'cc.ClickEvent'
            || (event.component != null && typeof event.component !== 'string')
            || (event.handler != null && typeof event.handler !== 'string')
            || (event.customEventData != null && typeof event.customEventData !== 'string')) return null;
        let targetUuid = null;
        if (event.target != null) {
            const targetIndex = refIndex(event.target, records);
            const target = targetIndex === null ? null : records[targetIndex];
            if (!target || target.__type__ !== 'cc.Node') return null;
            targetUuid = prefabNodeId(target, records, prefabUuid);
            if (!targetUuid) return null;
        }
        events.push({ targetUuid, component: typeof event.component === 'string' ? event.component : '',
            handler: typeof event.handler === 'string' ? event.handler : '',
            customEventData: typeof event.customEventData === 'string' ? event.customEventData : '' });
    }
    return events;
}

function diskPropertyValue(raw, records, prefabUuid, expected, depth = 0, visited = new Set(), alternateExpected) {
    if (raw === null || typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
        if (raw === null && expected && expected.kind === 'asset') return { kind: 'asset', assetClass: expected.assetClass };
        if (raw === null && expected && expected.kind === 'node-ref') return { kind: 'node-ref' };
        if (raw === null && expected && expected.kind === 'component-ref')
            return { kind: 'component-ref', componentClassName: expected.componentClassName };
        return raw;
    }
    if (Array.isArray(raw)) {
        if (depth !== 0 || raw.length > 32) return undefined;
        const templates = expected && expected.kind === 'array' ? expected.items : [];
        const alternateTemplates = alternateExpected && alternateExpected.kind === 'array' ? alternateExpected.items : [];
        return { kind: 'array', items: raw.map((item, index) => {
            const itemExpected = templates[index] || alternateTemplates[index]
                || templates[0] || alternateTemplates[0];
            return diskPropertyValue(item, records, prefabUuid, itemExpected, depth + 1, visited);
        }) };
    }
    if (!raw || typeof raw !== 'object') return undefined;
    if (typeof raw.__uuid__ === 'string' && Object.keys(raw).length === 1)
        return { kind: 'asset', assetUuid: raw.__uuid__,
            ...(expected && expected.kind === 'asset' && expected.assetClass ? { assetClass: expected.assetClass } : {}) };
    if (Number.isInteger(raw.__id__) && Object.keys(raw).length === 1) {
        const record = records[raw.__id__];
        if (!record || visited.has(record) || visited.size >= 8) return undefined;
        if (record.__type__ === 'cc.Node') {
            const nodeUuid = prefabNodeId(record, records, prefabUuid);
            return nodeUuid ? { kind: 'node-ref', nodeUuid } : undefined;
        }
        const owner = Number.isInteger(record.node && record.node.__id__) ? records[record.node.__id__] : null;
        if (owner && owner.__type__ === 'cc.Node') {
            const nodeUuid = prefabNodeId(owner, records, prefabUuid);
            const componentIndex = Array.isArray(owner._components)
                ? owner._components.findIndex((reference) => refIndex(reference, records) === raw.__id__) : -1;
            if (!nodeUuid || componentIndex < 0) return undefined;
            const componentInstanceId = typeof record._id === 'string' && record._id
                ? record._id : prefabPatch.componentIdFor(prefabUuid, nodeUuid, componentIndex, record.__type__, null);
            return { kind: 'component-ref', componentClassName: expected && expected.kind === 'component-ref'
                ? expected.componentClassName : record.__type__, componentInstanceId, nodeUuid };
        }
        const next = new Set(visited); next.add(record);
        return diskPropertyValue(record, records, prefabUuid, expected, depth, next);
    }
    const typed = {
        'cc.Vec2': ['vec2', ['x', 'y']], 'cc.Vec3': ['vec3', ['x', 'y', 'z']],
        'cc.Vec4': ['vec4', ['x', 'y', 'z', 'w']], 'cc.Size': ['size', ['width', 'height']],
        'cc.Rect': ['rect', ['x', 'y', 'width', 'height']], 'cc.Color': ['color', ['r', 'g', 'b', 'a']],
    }[raw.__type__];
    if (typed && Object.keys(raw).sort().join(',') === ['__type__', ...typed[1]].sort().join(','))
        return { kind: typed[0], ...Object.fromEntries(typed[1].map((field) => [field, raw[field]])) };
    return undefined;
}

function valueForExpectedProperty(component, records, prefabUuid, diff) {
    const candidates = diff.serializedProperty ? [diff.serializedProperty] : diff.serializedPropertyCandidates || [];
    const serializedProperty = candidates.find((property) => Object.prototype.hasOwnProperty.call(component, property));
    let value;
    if (serializedProperty) value = diskPropertyValue(component[serializedProperty], records, prefabUuid,
        diff.before, 0, new Set(), diff.after);
    else if (diff.serializedWasOmitted === true && Object.prototype.hasOwnProperty.call(diff, 'serializedDefaultValue'))
        value = diff.serializedDefaultValue;
    else return { found: false };
    if (value === undefined) return { found: false };
    if (diff.componentClassName === 'cc.Label' && LABEL_STYLE_FLAGS[diff.property]) {
        const flags = serializedProperty ? component[serializedProperty] : null;
        if (Number.isSafeInteger(flags) && flags >= 0) value = (flags & LABEL_STYLE_FLAGS[diff.property]) !== 0;
    } else if (diff.componentClassName === 'cc.Widget' && WIDGET_ALIGN_FLAGS[diff.property]) {
        const flags = serializedProperty ? component[serializedProperty] : null;
        if (Number.isSafeInteger(flags) && flags >= 0) value = (flags & WIDGET_ALIGN_FLAGS[diff.property]) !== 0;
    }
    return { found: true, value };
}

function valuesForRestorableProperties(component, records, prefabUuid, properties) {
    if (!Array.isArray(properties)) return null;
    const result = [];
    for (const property of properties) {
        if (!property || typeof property.property !== 'string' || typeof property.serializedProperty !== 'string') return null;
        let value;
        if (Object.prototype.hasOwnProperty.call(component, property.serializedProperty)) {
            value = diskPropertyValue(component[property.serializedProperty], records, prefabUuid, property.value);
            if (value === undefined) return null;
        } else if (property.serializedWasOmitted === true) value = property.value;
        else return null;
        result.push({ ...property, value });
    }
    return result;
}

function inspectPrefabSource({ prefabBytes, metaBytes, prefabUuid, maxComponentsPerNode = 8, expectedDiff, targetNodeUuid }) {
    if (!Buffer.isBuffer(prefabBytes) || prefabBytes.length < 2 || prefabBytes.length > MAX_BYTES)
        return fail('PREFAB_SERIALIZATION_SIZE_INVALID');
    if (!Buffer.isBuffer(metaBytes) || metaBytes.length < 2 || metaBytes.length > MAX_META_BYTES)
        return fail('PREFAB_META_SIZE_INVALID');
    if (typeof prefabUuid !== 'string' || !UUID_PATTERN.test(prefabUuid))
        return fail('PREFAB_UUID_INVALID');
    if (!Number.isInteger(maxComponentsPerNode) || maxComponentsPerNode < 1 || maxComponentsPerNode > MAX_COMPONENTS_PER_NODE)
        return fail('PREFAB_COMPONENT_LIMIT_INVALID');
    if (expectedDiff !== undefined && (!Array.isArray(expectedDiff) || expectedDiff.length < 1 || expectedDiff.length > 16
        || !NODE_ID.test(targetNodeUuid || '')
        || expectedDiff.some((item) => !item || typeof item !== 'object'
            || !['component.property', 'component.eventList', 'component.structure'].includes(item.path)
            || (item.path === 'component.structure'
                ? !prefabPatch.validateDiff([item])
                : typeof item.componentInstanceId !== 'string' || typeof (item.serializedClassId || item.componentClassName) !== 'string'
                    || (item.path === 'component.property'
                        ? typeof item.property !== 'string' || typeof item.before === 'undefined'
                        : typeof item.eventProperty !== 'string')))))
        return fail('PREFAB_COMPONENT_PROPERTY_SELECTOR_INVALID');

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
    const stack = [{ index: roots[0][0], parentPath: '', parentId: null,
        siblingIndex: null, siblingCount: 0, depth: 0 }];
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
        const serializedNodeId = typeof record._id === 'string' && record._id ? record._id : fileId;
        // Creator 2.4.15 intentionally saves an empty _id/fileId for a Prefab root.
        // Bind that root to the exact asset rather than inventing serialized data.
        const nodeId = serializedNodeId || (item.depth === 0 ? rootNodeId(prefabUuid) : null);
        if (nodeId && identities.has(nodeId)) return fail('PREFAB_NODE_ID_DUPLICATE', { nodeId });
        if (nodeId) identities.add(nodeId);

        const trs = record._trs && Array.isArray(record._trs.array) ? record._trs.array : null;
        const transform = trs && trs.length >= 9 ? {
            x: Number.isFinite(trs[0]) ? trs[0] : null,
            y: Number.isFinite(trs[1]) ? trs[1] : null,
            scaleX: Number.isFinite(trs[7]) ? trs[7] : null,
            scaleY: Number.isFinite(trs[8]) ? trs[8] : null,
            width: record._contentSize && Number.isFinite(record._contentSize.width) ? record._contentSize.width : null,
            height: record._contentSize && Number.isFinite(record._contentSize.height) ? record._contentSize.height : null,
        } : null;
        const componentRefs = Array.isArray(record._components) ? record._components : [];
        if (componentRefs.length > MAX_COMPONENTS_PER_NODE) return fail('PREFAB_COMPONENT_LIMIT', { nodePath });
        const allComponents = componentRefs.map((reference, index) => componentSummary(reference, records, index, nodeId, prefabUuid));
        if (allComponents.some((component) => !component)) return fail('PREFAB_COMPONENT_REFERENCE_INVALID', { nodePath });
        const components = allComponents.slice(0, maxComponentsPerNode);
        const componentProperties = {};
        const componentEventLists = {};
        if (Array.isArray(expectedDiff) && nodeId === targetNodeUuid) {
            for (const diff of expectedDiff.filter((item) => item && item.path === 'component.property')) {
                if (!Number.isInteger(diff.componentIndex) || diff.componentIndex < 0
                    || diff.componentIndex >= componentRefs.length) return fail('PREFAB_COMPONENT_PROPERTY_SELECTOR_INVALID');
                const componentIndex = refIndex(componentRefs[diff.componentIndex], records);
                const component = componentIndex === null ? null : records[componentIndex];
                const serializedClassId = diff.serializedClassId || diff.componentClassName;
                if (!component || component.__type__ !== serializedClassId)
                    return fail('PREFAB_COMPONENT_PROPERTY_IDENTITY_MISMATCH');
                const serializedId = prefabPatch.componentIdFor(prefabUuid, nodeId, diff.componentIndex,
                    serializedClassId, component._id);
                if (serializedId !== diff.componentInstanceId) return fail('PREFAB_COMPONENT_PROPERTY_IDENTITY_MISMATCH');
                const value = valueForExpectedProperty(component, records, prefabUuid, diff);
                if (!value.found) return fail('PREFAB_COMPONENT_PROPERTY_UNAVAILABLE', {
                    componentInstanceId: diff.componentInstanceId, property: diff.property });
                componentProperties[diff.componentInstanceId] = componentProperties[diff.componentInstanceId] || {};
                componentProperties[diff.componentInstanceId][diff.property] = value.value;
            }
            for (const diff of expectedDiff.filter((item) => item && item.path === 'component.eventList')) {
                if (!Number.isInteger(diff.componentIndex) || diff.componentIndex < 0
                    || diff.componentIndex >= componentRefs.length) return fail('PREFAB_COMPONENT_EVENT_LIST_SELECTOR_INVALID');
                const componentIndex = refIndex(componentRefs[diff.componentIndex], records);
                const component = componentIndex === null ? null : records[componentIndex];
                const serializedClassId = diff.serializedClassId || diff.componentClassName;
                if (!component || component.__type__ !== serializedClassId
                    || !(prefabPatch.UI_EVENT_PROPERTIES[diff.componentClassName] || []).includes(diff.eventProperty))
                    return fail('PREFAB_COMPONENT_EVENT_LIST_IDENTITY_MISMATCH');
                const serializedId = prefabPatch.componentIdFor(prefabUuid, nodeId, diff.componentIndex,
                    serializedClassId, component._id);
                if (serializedId !== diff.componentInstanceId) return fail('PREFAB_COMPONENT_EVENT_LIST_IDENTITY_MISMATCH');
                const events = serializedUiEvents(component[diff.eventProperty], records, prefabUuid);
                if (!events || !prefabPatch.validUiEventList({ kind: 'ui-events', items: events }, { allowUnbound: true }))
                    return fail('PREFAB_COMPONENT_EVENT_LIST_UNAVAILABLE', {
                        componentInstanceId: diff.componentInstanceId, eventProperty: diff.eventProperty });
                componentEventLists[diff.componentInstanceId] = componentEventLists[diff.componentInstanceId] || {};
                componentEventLists[diff.componentInstanceId][diff.eventProperty] = events;
            }
        }
        const structureDiff = Array.isArray(expectedDiff)
            ? expectedDiff.find((entry) => entry && entry.path === 'component.structure') : null;
        const expectedComponentState = structureDiff && [structureDiff.before, structureDiff.after]
            .find((state) => state && state.componentCount === allComponents.length
                && state.components.every((expected, index) => expected.componentIndex === index
                    && expected.serializedClassId === allComponents[index].classId
                    && expected.componentInstanceId === allComponents[index].instanceId));
        const componentStateRows = allComponents.map((component, index) => {
            const expected = expectedComponentState && expectedComponentState.components[index];
            const rawIndex = refIndex(componentRefs[index], records);
            const raw = rawIndex === null ? null : records[rawIndex];
            const restoreProperties = expected && Array.isArray(expected.restoreProperties)
                ? valuesForRestorableProperties(raw, records, prefabUuid, expected.restoreProperties) : null;
            if (expected && Array.isArray(expected.restoreProperties) && !restoreProperties) return null;
            return { componentClassName: component.className, componentIndex: component.index,
                componentInstanceId: component.instanceId, serializedClassId: component.classId,
                ...(component.className === 'cc.BlockInputEvents' || expected && typeof expected.enabled === 'boolean'
                    ? { enabled: component.enabled } : {}),
                ...(component.className === 'cc.BlockInputEvents' || expected && typeof expected.componentIdSynthetic === 'boolean'
                    ? { componentIdSynthetic: component.instanceIdSynthetic } : {}),
                ...(restoreProperties ? { restoreProperties } : {}) };
        });
        if (componentStateRows.some((row) => !row)) return fail('PREFAB_COMPONENT_RESTORE_STATE_UNAVAILABLE');
        const node = { nodeUuid: nodeId, fileId, name, nodePath, parentUuid: item.parentId,
            identityKind: serializedNodeId ? 'serialized-node-id' : item.depth === 0 ? 'prefab-root' : null,
            siblingIndex: item.siblingIndex, siblingCount: item.siblingCount,
            childCount: Array.isArray(record._children) ? record._children.length : 0,
            componentCount: allComponents.length,
            componentState: { componentCount: allComponents.length, components: componentStateRows },
            active: typeof record._active === 'boolean' ? record._active : true,
            transform, components, componentsTruncated: allComponents.length > components.length,
            ...(Object.keys(componentProperties).length ? { componentProperties } : {}),
            ...(Object.keys(componentEventLists).length ? { componentEventLists } : {}) };
        const children = Array.isArray(record._children) ? record._children : [];
        if (children.length > MAX_NODES) return fail('PREFAB_CHILD_LIMIT', { nodePath });
        const childRows = [];
        for (let siblingIndex = 0; siblingIndex < children.length; siblingIndex += 1) {
            const childRef = children[siblingIndex];
            const childIndex = refIndex(childRef, records);
            const child = childIndex === null ? null : nodeRows.get(childIndex);
            const parentIndex = child && refIndex(child._parent, records);
            if (!child || parentIndex !== item.index) return fail('PREFAB_PARENT_CHILD_MISMATCH', { nodePath });
            const childInfo = prefabInfoFor(child, records);
            const childId = typeof child._id === 'string' && child._id
                ? child._id : childInfo && typeof childInfo.fileId === 'string' && childInfo.fileId ? childInfo.fileId : null;
            childRows.push({ index: childIndex, id: childId, siblingIndex, siblingCount: children.length });
        }
        nodes.push(node);
        for (let index = childRows.length - 1; index >= 0; index -= 1) {
            const child = childRows[index];
            stack.push({ index: child.index, parentPath: nodePath, parentId: nodeId,
                siblingIndex: child.siblingIndex, siblingCount: child.siblingCount, depth: item.depth + 1 });
        }
    }
    if (visited.size !== nodeRows.size) return fail('PREFAB_UNREACHABLE_NODE_RECORDS', {
        reachableNodeCount: visited.size, serializedNodeCount: nodeRows.size,
    });
    const childrenByParent = new Map();
    for (const child of nodes) {
        if (typeof child.parentUuid !== 'string') continue;
        const siblings = childrenByParent.get(child.parentUuid) || [];
        siblings.push(child);
        childrenByParent.set(child.parentUuid, siblings);
    }
    for (const node of nodes) {
        const children = (childrenByParent.get(node.nodeUuid) || []).sort((a, b) => a.siblingIndex - b.siblingIndex);
        if (children.length !== node.childCount) return fail('PREFAB_PARENT_CHILD_MISMATCH', { nodePath: node.nodePath });
        node.childState = { childCount: children.length, children: children.map((child) => ({
            nodeUuid: child.nodeUuid, name: child.name, siblingIndex: child.siblingIndex,
            childCount: child.childCount, componentCount: child.componentCount,
        })) };
    }
    const subtreeRows = new Map();
    for (const node of [...nodes].reverse()) {
        const children = (childrenByParent.get(node.nodeUuid) || []).sort((a, b) => a.siblingIndex - b.siblingIndex);
        const rows = children.map((child) => subtreeRows.get(child.nodeUuid));
        const count = rows.reduce((sum, row) => sum + (row ? row.nodeCount : MAX_NODES), 0);
        const complete = count <= prefabPatch.MAX_SUBTREE_NODES && rows.every(Boolean);
        const row = complete ? { nodeUuid: node.nodeUuid, name: node.name, siblingIndex: node.siblingIndex,
            childCount: rows.length, componentCount: node.componentCount, children: rows.map((child) => child.row) } : null;
        subtreeRows.set(node.nodeUuid, { row, nodeCount: complete ? count + 1 : MAX_NODES });
        node.subtreeState = complete ? { childCount: rows.length, children: rows.map((child) => child.row) } : null;
    }
    return { available: true, prefabUuid, rootName: nodes[0].name, nodeCount: nodes.length, nodes };
}

module.exports = { inspectPrefabSource };
