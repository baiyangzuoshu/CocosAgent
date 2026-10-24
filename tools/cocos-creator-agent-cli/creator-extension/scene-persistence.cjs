'use strict';

const MAX_SCENE_BYTES = 16 * 1024 * 1024;
const MAX_META_BYTES = 16 * 1024;
const MAX_SERIALIZED_OBJECTS = 100000;
const MAX_COMPONENTS = 32;
const MAX_SUBTREE_NODES = 256;
const TRANSFORM_TOLERANCE = 0.002;
const VALUE_TYPES = {
    vec2: { type: 'cc.Vec2', fields: ['x', 'y'] },
    vec3: { type: 'cc.Vec3', fields: ['x', 'y', 'z'] },
    vec4: { type: 'cc.Vec4', fields: ['x', 'y', 'z', 'w'] },
    size: { type: 'cc.Size', fields: ['width', 'height'] },
    rect: { type: 'cc.Rect', fields: ['x', 'y', 'width', 'height'] },
    color: { type: 'cc.Color', fields: ['r', 'g', 'b', 'a'] },
};
const UI_EVENT_PROPERTIES = Object.freeze({
    'cc.Button': ['clickEvents'], 'cc.Toggle': ['clickEvents', 'checkEvents'], 'cc.ToggleContainer': ['checkEvents'],
    'cc.Slider': ['slideEvents'], 'cc.ScrollView': ['scrollEvents'], 'cc.PageView': ['scrollEvents', 'pageEvents'],
    'cc.EditBox': ['editingDidBegan', 'textChanged', 'editingDidEnded', 'editingReturn'],
});
const WIDGET_ALIGN_FLAG_PROPERTIES = Object.freeze({
    isAlignTop: 1 << 0, isAlignVerticalCenter: 1 << 1, isAlignBottom: 1 << 2,
    isAlignLeft: 1 << 3, isAlignHorizontalCenter: 1 << 4, isAlignRight: 1 << 5,
});
const UUID = /^(?:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[A-Za-z0-9+/]{22,23})$/;

function fail(reason, details = {}) { return { verified: false, reason, ...details }; }
function own(object, key) { return !!object && Object.prototype.hasOwnProperty.call(object, key); }
function close(actual, expected) {
    return Number.isFinite(actual) && Number.isFinite(expected)
        && Math.abs(actual - expected) <= TRANSFORM_TOLERANCE;
}
function sceneDiskNumberMatches(field, actual, expected) {
    if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false;
    if (field !== 'angle') return Math.abs(actual - expected) <= TRANSFORM_TOLERANCE;
    const delta = ((actual - expected + 180) % 360 + 360) % 360 - 180;
    return Math.abs(delta) <= TRANSFORM_TOLERANCE;
}
function sceneDiskTransformMatches(actual, expected, { allowLayoutSizeMismatch = false,
    allowLayoutPositionMismatch = false } = {}) {
    if (!actual || !expected) return false;
    return Object.keys(expected).filter((field) => !(allowLayoutSizeMismatch && ['width', 'height'].includes(field))
        && !(allowLayoutPositionMismatch && ['x', 'y'].includes(field)))
        .every((field) => sceneDiskNumberMatches(field, actual[field], expected[field]));
}
function widgetAlignFlagsAfterProperties(properties) {
    let flags = 0;
    for (const property of properties) {
        const flag = WIDGET_ALIGN_FLAG_PROPERTIES[property.name];
        if (!flag) continue;
        if (typeof property.value !== 'boolean') return null;
        if (!property.value) {
            flags &= ~flag;
            continue;
        }
        flags |= flag;
        if (property.name === 'isAlignVerticalCenter')
            flags &= ~(WIDGET_ALIGN_FLAG_PROPERTIES.isAlignTop | WIDGET_ALIGN_FLAG_PROPERTIES.isAlignBottom);
        else if (property.name === 'isAlignHorizontalCenter')
            flags &= ~(WIDGET_ALIGN_FLAG_PROPERTIES.isAlignLeft | WIDGET_ALIGN_FLAG_PROPERTIES.isAlignRight);
        else if (property.name === 'isAlignTop' || property.name === 'isAlignBottom')
            flags &= ~WIDGET_ALIGN_FLAG_PROPERTIES.isAlignVerticalCenter;
        else if (property.name === 'isAlignLeft' || property.name === 'isAlignRight')
            flags &= ~WIDGET_ALIGN_FLAG_PROPERTIES.isAlignHorizontalCenter;
    }
    return flags;
}
function resolveRef(value, records) {
    if (!value || typeof value !== 'object' || !Number.isInteger(value.__id__)
        || value.__id__ < 0 || value.__id__ >= records.length) return null;
    return records[value.__id__];
}
function refIndex(value, records) {
    if (!value || typeof value !== 'object' || !Number.isInteger(value.__id__)
        || value.__id__ < 0 || value.__id__ >= records.length) return null;
    return value.__id__;
}

function inspectSerializedComponents(nodeRecord, records) {
    if (nodeRecord._components === undefined) return { verified: true, components: [] };
    if (!Array.isArray(nodeRecord._components) || nodeRecord._components.length > MAX_COMPONENTS)
        return fail('SCENE_COMPONENT_SERIALIZED_LIST_INVALID');
    const seenIndexes = new Set();
    const seenIds = new Set();
    const components = [];
    for (const reference of nodeRecord._components) {
        const index = refIndex(reference, records);
        const component = resolveRef(reference, records);
        if (index === null || seenIndexes.has(index) || !component || typeof component._id !== 'string'
            || !component._id || component._id.length > 128 || typeof component.__type__ !== 'string'
            || !component.__type__ || component.__type__.length > 128 || seenIds.has(component._id)
            || records.filter((record) => record._id === component._id).length !== 1
            || resolveRef(component.node, records) !== nodeRecord)
            return fail('SCENE_COMPONENT_SERIALIZED_IDENTITY_INVALID');
        seenIndexes.add(index);
        seenIds.add(component._id);
        components.push({ componentInstanceId: component._id, serializedClassId: component.__type__ });
    }
    return { verified: true, components };
}

function inspectSerializedSubtree(nodeRecord, records, sceneUuid) {
    const parent = resolveRef(nodeRecord._parent, records);
    if (!parent || !['cc.Node', 'cc.Scene'].includes(parent.__type__) || !Array.isArray(parent._children))
        return fail('SCENE_SUBTREE_PARENT_INVALID');
    const rootIndex = refIndex(nodeRecord._parent, records);
    const siblingIndexes = parent._children.map((reference, index) =>
        resolveRef(reference, records) === nodeRecord ? index : -1).filter((index) => index >= 0);
    if (rootIndex === null || siblingIndexes.length !== 1) return fail('SCENE_SUBTREE_PARENT_INVALID');
    const stack = [{ record: nodeRecord,
        parentUuid: parent.__type__ === 'cc.Scene' ? sceneUuid : parent._id,
        siblingIndex: siblingIndexes[0], depth: 0 }];
    const visited = new Set();
    const subtree = [];
    while (stack.length) {
        const item = stack.pop();
        const current = item.record;
        if (!current || current.__type__ !== 'cc.Node' || !UUID.test(current._id || '')
            || typeof current._name !== 'string' || !current._name || current._name.length > 120
            || visited.has(current) || item.depth > 64
            || (current._children !== undefined && !Array.isArray(current._children)))
            return fail('SCENE_SUBTREE_NODE_INVALID');
        visited.add(current);
        const serializedChildren = Array.isArray(current._children) ? current._children : [];
        if (subtree.length >= MAX_SUBTREE_NODES || serializedChildren.length > MAX_SUBTREE_NODES)
            return fail('SCENE_SUBTREE_LIMIT');
        const children = [];
        const childIndexes = new Set();
        for (let index = 0; index < serializedChildren.length; index += 1) {
            const childRef = serializedChildren[index];
            const child = resolveRef(childRef, records);
            const childIndex = refIndex(childRef, records);
            if (!child || child.__type__ !== 'cc.Node' || childIndex === null || childIndexes.has(childIndex)
                || resolveRef(child._parent, records) !== current)
                return fail('SCENE_SUBTREE_CHILD_INVALID');
            childIndexes.add(childIndex);
            children.push({ record: child, parentUuid: current._id, siblingIndex: index, depth: item.depth + 1 });
        }
        subtree.push({ nodeUuid: current._id, nodeName: current._name, parentUuid: item.parentUuid,
            siblingIndex: item.siblingIndex, childCount: children.length });
        if (subtree.length + stack.length + children.length > MAX_SUBTREE_NODES)
            return fail('SCENE_SUBTREE_LIMIT');
        for (let index = children.length - 1; index >= 0; index -= 1) stack.push(children[index]);
    }
    return { verified: true, subtree };
}

function validComponentDiskValue(value, depth = 0) {
    if (value === null || typeof value === 'boolean') return true;
    if (typeof value === 'string') return Buffer.byteLength(value, 'utf8') <= 1024;
    if (typeof value === 'number') return Number.isFinite(value) && Math.abs(value) <= 1000000000;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const keys = Object.keys(value).sort().join(',');
    const typed = own(VALUE_TYPES, value.kind) ? VALUE_TYPES[value.kind] : null;
    if (typed) return keys === ['kind', ...typed.fields].sort().join(',')
        && typed.fields.every((field) => value.kind === 'color'
            ? Number.isInteger(value[field]) && value[field] >= 0 && value[field] <= 255
            : Number.isFinite(value[field]) && Math.abs(value[field]) <= 1000000);
    if (value.kind === 'array') return depth === 0 && keys === 'items,kind' && Array.isArray(value.items)
        && value.items.length <= 32 && value.items.every((item) => validComponentDiskValue(item, depth + 1)
            && !(item && typeof item === 'object' && item.kind === 'array'));
    if (value.kind === 'asset') return keys === 'assetUuid,kind' && UUID.test(value.assetUuid || '');
    if (value.kind === 'node-ref') return keys === 'kind,nodeUuid' && UUID.test(value.nodeUuid || '');
    return value.kind === 'component-ref' && keys === 'componentInstanceId,kind,nodeUuid,serializedClassId'
        && UUID.test(value.nodeUuid || '') && typeof value.componentInstanceId === 'string'
        && value.componentInstanceId.length > 0 && value.componentInstanceId.length <= 128
        && typeof value.serializedClassId === 'string' && value.serializedClassId.length > 0
        && value.serializedClassId.length <= 128;
}

function componentValueForDisk(value, referenceClasses = []) {
    function normalize(item) {
        if (!item || typeof item !== 'object') return item;
        if (item.kind === 'asset') return item.assetUuid === undefined ? null : { kind: 'asset', assetUuid: item.assetUuid };
        if (item.kind === 'node-ref') return item.nodeUuid === undefined ? null : { kind: 'node-ref', nodeUuid: item.nodeUuid };
        if (item.kind === 'component-ref') {
            if (item.nodeUuid === undefined) return null;
            const matches = referenceClasses.filter((entry) => entry && entry.componentClassName === item.componentClassName);
            if (matches.length !== 1) return undefined;
            return { kind: 'component-ref', nodeUuid: item.nodeUuid,
                componentInstanceId: item.componentInstanceId, serializedClassId: matches[0].serializedClassId };
        }
        if (item.kind === 'array') return { kind: 'array', items: item.items.map(normalize) };
        return { ...item };
    }
    const normalized = normalize(value);
    return validComponentDiskValue(normalized) ? { verified: true, value: normalized }
        : fail('SCENE_COMPONENT_SERIALIZED_VALUE_UNAVAILABLE');
}

function isNodeInScene(record, records, sceneRootUuid) {
    const visited = new Set();
    let current = record;
    for (let depth = 0; current && depth <= 64; depth += 1) {
        if (current.__type__ === 'cc.Scene') return current._id === sceneRootUuid;
        if (current.__type__ !== 'cc.Node' || !UUID.test(current._id || '') || visited.has(current)) return false;
        visited.add(current);
        const parent = resolveRef(current._parent, records);
        if (!parent || !Array.isArray(parent._children)
            || parent._children.filter((reference) => resolveRef(reference, records) === current).length !== 1) return false;
        current = parent;
    }
    return false;
}

function readComponentDiskValue(raw, records, sceneRootUuid, sceneUuid, depth = 0, visited = new Set()) {
    if (raw === null || typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') return raw;
    if (Array.isArray(raw)) {
        if (depth !== 0 || raw.length > 32) return undefined;
        return { kind: 'array', items: raw.map((item) => readComponentDiskValue(item, records,
            sceneRootUuid, sceneUuid, depth + 1, visited)) };
    }
    if (!raw || typeof raw !== 'object') return undefined;
    if (own(raw, '__uuid__')) return Object.keys(raw).length === 1 ? { kind: 'asset', assetUuid: raw.__uuid__ } : undefined;
    if (own(raw, '__id__')) {
        if (Object.keys(raw).length !== 1) return undefined;
        const record = resolveRef(raw, records);
        if (!record || visited.has(record) || visited.size >= 8) return undefined;
        if (['cc.Node', 'cc.Scene'].includes(record.__type__)) {
            if (!isNodeInScene(record, records, sceneRootUuid)) return undefined;
            return { kind: 'node-ref', nodeUuid: record.__type__ === 'cc.Scene' ? sceneUuid : record._id };
        }
        const owner = resolveRef(record.node, records);
        if (owner && isNodeInScene(owner, records, sceneRootUuid) && Array.isArray(owner._components)
            && owner._components.filter((reference) => resolveRef(reference, records) === record).length === 1) {
            if (records.filter((entry) => entry._id === record._id).length !== 1) return undefined;
            return { kind: 'component-ref', nodeUuid: owner._id,
                componentInstanceId: record._id, serializedClassId: record.__type__ };
        }
        const nextVisited = new Set(visited); nextVisited.add(record);
        return readComponentDiskValue(record, records, sceneRootUuid, sceneUuid, depth, nextVisited);
    }
    for (const [kind, typed] of Object.entries(VALUE_TYPES)) {
        if (raw.__type__ === typed.type
            && Object.keys(raw).sort().join(',') === ['__type__', ...typed.fields].sort().join(','))
            return Object.fromEntries([['kind', kind], ...typed.fields.map((field) => [field, raw[field]])]);
    }
    return undefined;
}

function inspectComponentProperty(nodeRecord, records, sceneRootUuid, sceneUuid, selector) {
    if (!selector || typeof selector.componentInstanceId !== 'string' || !selector.componentInstanceId
        || selector.componentInstanceId.length > 128 || typeof selector.serializedClassId !== 'string'
        || !selector.serializedClassId || selector.serializedClassId.length > 128
        || typeof selector.property !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(selector.property))
        return fail('SCENE_COMPONENT_DISK_SELECTOR_INVALID');
    if (selector.serializedProperty !== undefined && (typeof selector.serializedProperty !== 'string'
        || !/^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/.test(selector.serializedProperty)))
        return fail('SCENE_COMPONENT_DISK_SELECTOR_INVALID');
    if (selector.serializedPropertyCandidates !== undefined && (!Array.isArray(selector.serializedPropertyCandidates)
        || selector.serializedPropertyCandidates.length < 1 || selector.serializedPropertyCandidates.length > 4
        || selector.serializedPropertyCandidates.some((property) => typeof property !== 'string'
            || !/^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/.test(property))))
        return fail('SCENE_COMPONENT_DISK_SELECTOR_INVALID');
    if (selector.defaultValue !== undefined && !validComponentDiskValue(selector.defaultValue))
        return fail('SCENE_COMPONENT_DISK_SELECTOR_INVALID');
    const matches = Array.isArray(nodeRecord._components) ? nodeRecord._components.map((reference) => resolveRef(reference, records))
        .filter((record) => record && record._id === selector.componentInstanceId
            && record.__type__ === selector.serializedClassId) : [];
    if (matches.length !== 1 || records.filter((record) => record._id === selector.componentInstanceId).length !== 1
        || resolveRef(matches[0].node, records) !== nodeRecord) return fail('SCENE_COMPONENT_SERIALIZED_IDENTITY_MISMATCH');
    const candidates = selector.serializedProperty ? [selector.serializedProperty]
        : selector.serializedPropertyCandidates || [selector.property];
    const serializedProperty = candidates.find((property) => own(matches[0], property));
    if (!serializedProperty && selector.defaultValue === undefined)
        return fail('SCENE_COMPONENT_SERIALIZED_PROPERTY_MISSING');
    const value = serializedProperty
        ? readComponentDiskValue(matches[0][serializedProperty], records, sceneRootUuid, sceneUuid)
        : selector.defaultValue;
    if (!validComponentDiskValue(value)) return fail('SCENE_COMPONENT_SERIALIZED_VALUE_UNSUPPORTED');
    return { verified: true, componentProperty: { componentInstanceId: selector.componentInstanceId,
        serializedClassId: selector.serializedClassId, property: selector.property,
        ...(serializedProperty ? { serializedProperty } : { isDefaultOmitted: true }), value } };
}

function inspectButtonEvents(nodeRecord, records) {
    if (!Array.isArray(nodeRecord._components)) return { buttonComponentCount: 0, buttonEvents: null };
    const buttons = nodeRecord._components.map((reference) => resolveRef(reference, records))
        .filter((component) => component && component.__type__ === 'cc.Button');
    if (buttons.length !== 1)
        return { buttonComponentCount: buttons.length, buttonEvents: null };
    const clickEvents = buttons[0].clickEvents === undefined ? [] : buttons[0].clickEvents;
    if (!Array.isArray(clickEvents)) return { buttonComponentCount: buttons.length, buttonEvents: null };
    const events = [];
    for (const reference of clickEvents) {
        const event = resolveRef(reference, records);
        const target = event && resolveRef(event.target, records);
        if (!event || event.__type__ !== 'cc.ClickEvent' || !target || target.__type__ !== 'cc.Node'
            || typeof target._id !== 'string' || typeof event.component !== 'string'
            || typeof event.handler !== 'string'
            || (event.customEventData !== undefined && typeof event.customEventData !== 'string'))
            return { buttonComponentCount: buttons.length, buttonEvents: null };
        events.push({ targetUuid: target._id, component: event.component, handler: event.handler,
            customEventData: event.customEventData || '' });
    }
    return { buttonComponentCount: buttons.length, buttonEvents: events };
}

function inspectSerializedUiEvents(nodeRecord, records, sceneRootUuid, selector) {
    if (!selector || typeof selector.componentInstanceId !== 'string' || !selector.componentInstanceId
        || selector.componentInstanceId.length > 128 || typeof selector.serializedClassId !== 'string'
        || typeof selector.eventProperty !== 'string'
        || !(UI_EVENT_PROPERTIES[selector.serializedClassId] || []).includes(selector.eventProperty))
        return fail('SCENE_UI_EVENT_DISK_SELECTOR_INVALID');
    const matches = Array.isArray(nodeRecord._components) ? nodeRecord._components.map((reference) => resolveRef(reference, records))
        .filter((component) => component && component._id === selector.componentInstanceId
            && component.__type__ === selector.serializedClassId) : [];
    if (matches.length !== 1 || records.filter((record) => record._id === selector.componentInstanceId).length !== 1
        || resolveRef(matches[0].node, records) !== nodeRecord)
        return fail('SCENE_COMPONENT_SERIALIZED_IDENTITY_MISMATCH');
    const rawEvents = matches[0][selector.eventProperty] === undefined ? [] : matches[0][selector.eventProperty];
    if (!Array.isArray(rawEvents) || rawEvents.length > 12) return fail('SCENE_UI_EVENT_SERIALIZED_LIST_INVALID');
    const events = [];
    for (const reference of rawEvents) {
        const event = resolveRef(reference, records);
        const target = event && event.target == null ? null : event && resolveRef(event.target, records);
        if (!event || event.__type__ !== 'cc.ClickEvent'
            || (event.target != null && (!target || target.__type__ !== 'cc.Node'
                || !UUID.test(target._id || '') || !isNodeInScene(target, records, sceneRootUuid)))
            || (event.component !== undefined && typeof event.component !== 'string')
            || (event.handler !== undefined && typeof event.handler !== 'string')
            || (event.customEventData !== undefined && typeof event.customEventData !== 'string'))
            return fail('SCENE_UI_EVENT_SERIALIZED_ENTRY_INVALID');
        events.push({ targetUuid: target ? target._id : null, component: event.component || '',
            handler: event.handler || '', customEventData: event.customEventData || '' });
    }
    return { verified: true, componentEvents: { componentInstanceId: selector.componentInstanceId,
        serializedClassId: selector.serializedClassId, eventProperty: selector.eventProperty, events } };
}

function inspectSceneAssetIdentity({ sceneBytes, metaBytes, sceneAssetRow }) {
    if (!Buffer.isBuffer(sceneBytes) || sceneBytes.length < 2 || sceneBytes.length > MAX_SCENE_BYTES)
        return fail('SCENE_SERIALIZATION_SIZE_INVALID');
    if (!Buffer.isBuffer(metaBytes) || metaBytes.length < 2 || metaBytes.length > MAX_META_BYTES)
        return fail('SCENE_META_SIZE_INVALID');
    if (!sceneAssetRow || typeof sceneAssetRow.uuid !== 'string' || !UUID.test(sceneAssetRow.uuid)
        || typeof sceneAssetRow.url !== 'string' || !sceneAssetRow.url.startsWith('db://assets/')
        || !/\.fire$/i.test(sceneAssetRow.url)
        || (sceneAssetRow.importer && sceneAssetRow.importer !== 'scene'))
        return fail('SCENE_ASSETDB_IDENTITY_MISMATCH');

    let meta;
    let records;
    try {
        meta = JSON.parse(metaBytes.toString('utf8'));
        records = JSON.parse(sceneBytes.toString('utf8'));
    } catch (_) { return fail('SCENE_SERIALIZATION_INVALID'); }
    if (!meta || meta.uuid !== sceneAssetRow.uuid || meta.importer !== 'scene')
        return fail('SCENE_META_IDENTITY_MISMATCH');
    if (!Array.isArray(records) || records.length < 2 || records.length > MAX_SERIALIZED_OBJECTS
        || records.some((record) => !record || typeof record !== 'object' || Array.isArray(record)))
        return fail('SCENE_SERIALIZED_OBJECT_COUNT_INVALID');

    const scenes = records.filter((record) => record.__type__ === 'cc.Scene'
        && typeof record._id === 'string' && UUID.test(record._id));
    if (scenes.length !== 1) return fail('SCENE_ROOT_IDENTITY_MISMATCH');
    const sceneAssets = records.filter((record) => record.__type__ === 'cc.SceneAsset'
        && resolveRef(record.scene, records) === scenes[0]);
    if (sceneAssets.length !== 1) return fail('SCENE_ASSET_REFERENCE_MISMATCH');
    return { verified: true, sceneUuid: sceneAssetRow.uuid, sceneAssetUuid: sceneAssetRow.uuid,
        sceneRootUuid: scenes[0]._id, sceneUrl: sceneAssetRow.url };
}

function inspectSavedSceneNode({ sceneBytes, metaBytes, sceneUuid, sceneAssetRow, nodeUuid, componentProperty, componentEvents,
    includeComponents = false, includeSubtree = false, absentNodeUuids }) {
    if (!Buffer.isBuffer(sceneBytes) || sceneBytes.length < 2 || sceneBytes.length > MAX_SCENE_BYTES)
        return fail('SCENE_SERIALIZATION_SIZE_INVALID');
    if (!Buffer.isBuffer(metaBytes) || metaBytes.length < 2 || metaBytes.length > MAX_META_BYTES)
        return fail('SCENE_META_SIZE_INVALID');
    if (typeof sceneUuid !== 'string' || !UUID.test(sceneUuid) || typeof nodeUuid !== 'string' || !UUID.test(nodeUuid)
        || !sceneAssetRow || typeof sceneAssetRow.uuid !== 'string' || !UUID.test(sceneAssetRow.uuid)
        || sceneUuid !== sceneAssetRow.uuid
        || typeof sceneAssetRow.url !== 'string' || !sceneAssetRow.url.startsWith('db://assets/')
        || !/\.fire$/i.test(sceneAssetRow.url) || (sceneAssetRow.importer && sceneAssetRow.importer !== 'scene'))
        return fail('SCENE_ASSETDB_IDENTITY_MISMATCH');

    let meta;
    let records;
    try {
        meta = JSON.parse(metaBytes.toString('utf8'));
        records = JSON.parse(sceneBytes.toString('utf8'));
    } catch (_) { return fail('SCENE_SERIALIZATION_INVALID'); }
    if (!meta || meta.uuid !== sceneAssetRow.uuid || meta.importer !== 'scene') return fail('SCENE_META_IDENTITY_MISMATCH');
    if (!Array.isArray(records) || records.length < 2 || records.length > MAX_SERIALIZED_OBJECTS
        || records.some((record) => !record || typeof record !== 'object' || Array.isArray(record)))
        return fail('SCENE_SERIALIZED_OBJECT_COUNT_INVALID');

    const scenes = [];
    const nodes = new Map();
    for (let index = 0; index < records.length; index += 1) {
        const record = records[index];
        if (record.__type__ === 'cc.Scene' && typeof record._id === 'string' && UUID.test(record._id))
            scenes.push({ record, index });
        if (record.__type__ === 'cc.Node' && typeof record._id === 'string') {
            if (nodes.has(record._id)) return fail('SCENE_NODE_UUID_DUPLICATE', { nodeUuid: record._id });
            nodes.set(record._id, { record, index });
        }
    }
    if (scenes.length !== 1) return fail('SCENE_ROOT_IDENTITY_MISMATCH');
    const root = scenes[0].record;
    const sceneAssets = records.filter((record) => record.__type__ === 'cc.SceneAsset'
        && resolveRef(record.scene, records) === root);
    if (sceneAssets.length !== 1) return fail('SCENE_ASSET_REFERENCE_MISMATCH');
    const found = nodes.get(nodeUuid);
    if (absentNodeUuids !== undefined) {
        if (!Array.isArray(absentNodeUuids) || absentNodeUuids.length < 1 || absentNodeUuids.length > MAX_SUBTREE_NODES
            || absentNodeUuids.some((id) => typeof id !== 'string' || !UUID.test(id))
            || new Set(absentNodeUuids).size !== absentNodeUuids.length || !absentNodeUuids.includes(nodeUuid))
            return fail('SCENE_NODE_ABSENCE_SELECTOR_INVALID');
        if (found || absentNodeUuids.some((id) => nodes.has(id))) return fail('SCENE_NODE_STILL_PRESENT');
        return { verified: true, sceneUuid, sceneUrl: sceneAssetRow.url, nodeUuid,
            nodeAbsent: true, absentNodeUuids: [...absentNodeUuids] };
    }
    if (!found) return fail('SCENE_NODE_NOT_FOUND');

    const pathParts = [typeof found.record._name === 'string' ? found.record._name : ''];
    if (!pathParts[0]) return fail('SCENE_NODE_NAME_INVALID');
    const visited = new Set([found.index]);
    let cursor = found.record;
    let childIndex = found.index;
    let parentUuid = null;
    let reachedScene = false;
    for (let depth = 0; depth <= 64; depth += 1) {
        const parentIndex = refIndex(cursor._parent, records);
        if (parentIndex === null) break;
        if (visited.has(parentIndex)) return fail('SCENE_HIERARCHY_INVALID');
        visited.add(parentIndex);
        const parent = records[parentIndex];
        if (!Array.isArray(parent._children)
            || parent._children.filter((child) => refIndex(child, records) === childIndex).length !== 1)
            return fail('SCENE_HIERARCHY_INVALID');
        if (depth === 0) parentUuid = parent === root ? sceneUuid : parent._id;
        if (parent === root) { reachedScene = true; break; }
        if (parent.__type__ !== 'cc.Node' || typeof parent._name !== 'string' || !parent._name)
            return fail('SCENE_PARENT_REFERENCE_INVALID');
        pathParts.push(parent._name);
        childIndex = parentIndex;
        cursor = parent;
        if (depth === 64) return fail('SCENE_HIERARCHY_LIMIT');
    }
    if (!reachedScene) return fail('SCENE_NODE_OUTSIDE_TARGET_SCENE');
    const sceneName = typeof root._name === 'string' && root._name ? root._name : 'Scene';
    const nodePath = [sceneName, ...pathParts.reverse()].join('/');

    const record = found.record;
    const componentState = includeComponents ? inspectSerializedComponents(record, records) : null;
    if (componentState && !componentState.verified) return componentState;
    const subtreeState = includeSubtree ? inspectSerializedSubtree(record, records, sceneUuid) : null;
    if (subtreeState && !subtreeState.verified) return subtreeState;
    const propertyState = componentProperty === undefined ? null
        : inspectComponentProperty(record, records, root._id, sceneUuid, componentProperty);
    if (propertyState && !propertyState.verified) return propertyState;
    const eventState = componentEvents === undefined ? null
        : inspectSerializedUiEvents(record, records, root._id, componentEvents);
    if (eventState && !eventState.verified) return eventState;
    const buttonState = inspectButtonEvents(record, records);
    const trs = record._trs && record._trs.array;
    const size = record._contentSize;
    const anchor = record._anchorPoint;
    if (!Array.isArray(trs) || trs.length < 10 || !size || !Number.isFinite(size.width)
        || !Number.isFinite(size.height) || !anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)
        || trs.slice(0, 10).some((value) => !Number.isFinite(value))) return fail('SCENE_NODE_TRANSFORM_INVALID');
    const [qx, qy, qz, qw] = trs.slice(3, 7);
    const sinZ = 2 * (qw * qz + qx * qy);
    const cosZ = 1 - 2 * (qy * qy + qz * qz);
    const angle = Math.round(Math.atan2(sinZ, cosZ) * 180 / Math.PI * 1e6) / 1e6;
    return { verified: true, sceneUuid, sceneUrl: sceneAssetRow.url, nodeUuid,
        nodeName: record._name, parentUuid, nodePath,
        active: typeof record._active === 'boolean' ? record._active : true,
        ...buttonState,
        ...(componentState ? { components: componentState.components } : {}),
        ...(eventState ? { componentEvents: eventState.componentEvents } : {}),
        ...(subtreeState ? { subtree: subtreeState.subtree } : {}),
        ...(propertyState ? { componentProperty: propertyState.componentProperty } : {}),
        transform: { x: trs[0], y: trs[1], z: trs[2], angle, scaleX: trs[7], scaleY: trs[8],
            width: size.width, height: size.height, anchorX: anchor.x, anchorY: anchor.y } };
}

function inspectSceneComposition({ sceneBytes, metaBytes, sceneUuid, sceneAssetRow, operation, readback }) {
    if (!Buffer.isBuffer(sceneBytes) || sceneBytes.length < 2 || sceneBytes.length > MAX_SCENE_BYTES)
        return fail('SCENE_SERIALIZATION_SIZE_INVALID');
    if (!Buffer.isBuffer(metaBytes) || metaBytes.length < 2 || metaBytes.length > MAX_META_BYTES)
        return fail('SCENE_META_SIZE_INVALID');
    if (typeof sceneUuid !== 'string' || !UUID.test(sceneUuid) || !sceneAssetRow
        || typeof sceneAssetRow.uuid !== 'string' || !UUID.test(sceneAssetRow.uuid)
        || sceneUuid !== sceneAssetRow.uuid
        || typeof sceneAssetRow.url !== 'string' || !sceneAssetRow.url.startsWith('db://assets/')
        || !/\.fire$/i.test(sceneAssetRow.url) || (sceneAssetRow.importer && sceneAssetRow.importer !== 'scene'))
        return fail('SCENE_ASSETDB_IDENTITY_MISMATCH');
    const plan = operation && operation.plan;
    const currentReadback = readback || operation && operation.sceneReadback;
    if (!plan || plan.sceneUuid !== sceneUuid || !plan.request || !Array.isArray(plan.request.nodes)
        || !Array.isArray(plan.request.components) || !Array.isArray(plan.request.buttonEvents)
        || !currentReadback || currentReadback.available !== true || currentReadback.sceneUuid !== sceneUuid
        || !Array.isArray(currentReadback.nodes)) return fail('SCENE_PERSISTENCE_INPUT_INVALID');

    let meta;
    let records;
    try {
        meta = JSON.parse(metaBytes.toString('utf8'));
        records = JSON.parse(sceneBytes.toString('utf8'));
    } catch (_) { return fail('SCENE_SERIALIZATION_INVALID'); }
    if (!meta || meta.uuid !== sceneAssetRow.uuid || meta.importer !== 'scene') return fail('SCENE_META_IDENTITY_MISMATCH');
    if (!Array.isArray(records) || records.length < 2 || records.length > MAX_SERIALIZED_OBJECTS)
        return fail('SCENE_SERIALIZED_OBJECT_COUNT_INVALID');
    if (records.some((record) => !record || typeof record !== 'object' || Array.isArray(record)))
        return fail('SCENE_SERIALIZATION_RECORD_INVALID');

    const sceneRows = [];
    const nodeRows = new Map();
    for (let index = 0; index < records.length; index += 1) {
        const record = records[index];
        if (record.__type__ === 'cc.Scene' && typeof record._id === 'string' && UUID.test(record._id))
            sceneRows.push({ record, index });
        if (record.__type__ === 'cc.Node' && typeof record._id === 'string') {
            if (nodeRows.has(record._id)) return fail('SCENE_NODE_UUID_DUPLICATE', { nodeUuid: record._id });
            nodeRows.set(record._id, { record, index });
        }
    }
    if (sceneRows.length !== 1) return fail('SCENE_ROOT_IDENTITY_MISMATCH');
    const sceneAssetRows = records.filter((record) => record.__type__ === 'cc.SceneAsset'
        && resolveRef(record.scene, records) === sceneRows[0].record);
    if (sceneAssetRows.length !== 1) return fail('SCENE_ASSET_REFERENCE_MISMATCH');

    const expectedNodes = new Map(plan.request.nodes.map((node) => [node.id, node]));
    const observedNodes = new Map(currentReadback.nodes.map((node) => [node.id, node]));
    const expectedSceneNodes = new Map((plan.expectedState && plan.expectedState.createdNodes || [])
        .map((node) => [node.id, node]));
    if (expectedNodes.size !== plan.request.nodes.length || observedNodes.size !== currentReadback.nodes.length
        || expectedNodes.size !== observedNodes.size || expectedNodes.size !== expectedSceneNodes.size)
        return fail('SCENE_COMPOSITION_NODE_SET_MISMATCH');
    let verifiedComponentCount = 0;
    let verifiedButtonEventCount = 0;
    let verifiedPrefabInstanceCount = 0;
    const serializedComponents = new Map();

    for (const [nodeId, expected] of expectedNodes) {
        const observed = observedNodes.get(nodeId);
        const expectedState = expectedSceneNodes.get(nodeId);
        const found = nodeRows.get(expected.uuid);
        if (!observed || !found || observed.uuid !== expected.uuid || observed.name !== expected.name
            || found.record._name !== expected.name) return fail('SCENE_COMPOSITION_NODE_MISMATCH', { nodeId });
        const expectedPrefabUuid = expectedState && expectedState.prefabUuid || expected.prefabUuid || null;
        if ((observed.prefabUuid || null) !== expectedPrefabUuid) return fail('SCENE_COMPOSITION_PREFAB_READBACK_MISMATCH', { nodeId });
        if (expectedPrefabUuid) {
            const prefabInfo = resolveRef(found.record._prefab, records);
            const prefabAsset = prefabInfo && prefabInfo.asset;
            const prefabRoot = prefabInfo && resolveRef(prefabInfo.root, records);
            const expectedPrefabRootUuid = expectedState && expectedState.prefabRootUuid || expected.uuid;
            const expectedPrefabRoot = nodeRows.get(expectedPrefabRootUuid);
            if (!prefabInfo || prefabInfo.__type__ !== 'cc.PrefabInfo' || !prefabAsset
                || prefabAsset.__uuid__ !== expectedPrefabUuid || !expectedPrefabRoot || prefabRoot !== expectedPrefabRoot.record)
                return fail('SCENE_COMPOSITION_PREFAB_LINK_MISMATCH', { nodeId, expectedPrefabUuid,
                    expectedPrefabRootUuid });
            const prefabInstanceRoot = expectedState && typeof expectedState.prefabInstanceRoot === 'boolean'
                ? expectedState.prefabInstanceRoot : expectedPrefabRootUuid === expected.uuid;
            if (prefabInstanceRoot) verifiedPrefabInstanceCount += 1;
        } else if (own(found.record, '_prefab') && found.record._prefab != null)
            return fail('SCENE_COMPOSITION_UNEXPECTED_PREFAB_LINK', { nodeId });
        const parentRecord = resolveRef(found.record._parent, records);
        const parentUuid = parentRecord === sceneRows[0].record ? sceneUuid : parentRecord && parentRecord._id;
        const expectedParentUuid = expected.parentRef.startsWith('new:')
            ? expectedNodes.get(expected.parentRef.slice(4))?.uuid
            : expected.parentRef.slice('uuid:'.length);
        if (!parentRecord || parentUuid !== expectedParentUuid || observed.parentUuid !== expectedParentUuid)
            return fail('SCENE_COMPOSITION_PARENT_MISMATCH', { nodeId });
        if ((!expectedPrefabUuid || (expectedState && expectedState.prefabOverride)) && found.record._active !== true)
            return fail('SCENE_COMPOSITION_ACTIVE_STATE_MISMATCH', { nodeId });

        const transform = expectedState && expectedState.transform;
        const trs = found.record._trs && found.record._trs.array;
        const size = found.record._contentSize;
        if (!Array.isArray(trs) || trs.length < 10 || !size
            || !close(trs[0], transform.x) || !close(trs[1], transform.y) || !close(trs[2], transform.z)
            || !close(trs[7], transform.scaleX) || !close(trs[8], transform.scaleY)
            || !close(size.width, transform.width) || !close(size.height, transform.height))
            return fail('SCENE_COMPOSITION_TRANSFORM_MISMATCH', { nodeId });
        const halfAngle = transform.angle * Math.PI / 360;
        const expectedQz = Math.sin(halfAngle);
        const expectedQw = Math.cos(halfAngle);
        const directQuaternion = close(trs[3], 0) && close(trs[4], 0)
            && close(trs[5], expectedQz) && close(trs[6], expectedQw);
        const inverseQuaternion = close(trs[3], 0) && close(trs[4], 0)
            && close(trs[5], -expectedQz) && close(trs[6], -expectedQw);
        if (!directQuaternion && !inverseQuaternion)
            return fail('SCENE_COMPOSITION_ROTATION_MISMATCH', { nodeId });

        const expectedComponents = plan.request.components.filter((component) => component.nodeRef === `new:${nodeId}`);
        const componentRefs = found.record._components;
        if (!Array.isArray(componentRefs) || ((!expectedPrefabUuid || (expectedState && expectedState.prefabOverride))
            && componentRefs.length !== expectedComponents.length))
            return fail('SCENE_COMPOSITION_COMPONENT_COUNT_MISMATCH', { nodeId });
        const rawComponents = componentRefs.map((reference) => resolveRef(reference, records));
        if (rawComponents.some((component) => !component))
            return fail('SCENE_COMPOSITION_COMPONENT_REFERENCE_INVALID', { nodeId });

        for (const expectedComponent of expectedComponents) {
            const observedComponent = observed.components.find((component) => component.id === expectedComponent.id);
            const classId = observedComponent && observedComponent.serializedClassId;
            if (!observedComponent || observedComponent.componentClassName !== expectedComponent.className
                || typeof classId !== 'string' || !classId)
                return fail('SCENE_COMPONENT_SERIALIZED_CLASS_ID_UNAVAILABLE', { componentId: expectedComponent.id });
            const matches = rawComponents.filter((component) => component.__type__ === classId);
            if (matches.length !== 1) return fail('SCENE_COMPOSITION_COMPONENT_IDENTITY_MISMATCH',
                { componentId: expectedComponent.id, serializedClassId: classId });
            const rawComponent = matches[0];
            const widgetFlagProperties = expectedComponent.className === 'cc.Widget'
                ? expectedComponent.properties.filter((property) => own(WIDGET_ALIGN_FLAG_PROPERTIES, property.name)) : [];
            if (widgetFlagProperties.length) {
                const expectedFlags = widgetAlignFlagsAfterProperties(expectedComponent.properties);
                const actualFlags = own(rawComponent, '_alignFlags') ? rawComponent._alignFlags : 0;
                if (expectedFlags === null || !Number.isSafeInteger(actualFlags) || actualFlags !== expectedFlags)
                    return fail('SCENE_COMPOSITION_PROPERTY_MISMATCH', { componentId: expectedComponent.id,
                        property: '_alignFlags', expected: expectedFlags, actual: actualFlags });
            }
            for (const property of expectedComponent.properties) {
                if (expectedComponent.className === 'cc.Widget' && own(WIDGET_ALIGN_FLAG_PROPERTIES, property.name)) continue;
                const providedCandidates = observedComponent.serializedPropertyCandidates
                    && observedComponent.serializedPropertyCandidates[property.name];
                const candidates = Array.isArray(providedCandidates) ? providedCandidates
                    : [property.name, `_N$${property.name}`, `_${property.name}`];
                if (candidates.length < 1 || candidates.length > 4 || candidates.some((candidate) => typeof candidate !== 'string'
                    || !/^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/.test(candidate)))
                    return fail('SCENE_COMPOSITION_PROPERTY_SCHEMA_INVALID',
                        { componentId: expectedComponent.id, property: property.name });
                const serializedProperty = candidates.find((candidate) => own(rawComponent, candidate));
                if (!serializedProperty) return fail('SCENE_COMPOSITION_PROPERTY_MISSING',
                    { componentId: expectedComponent.id, property: property.name });
                const actual = rawComponent[serializedProperty];
                const value = property.value;
                if (value && typeof value === 'object' && typeof value.assetUuid === 'string') {
                    if (!actual || typeof actual !== 'object' || actual.__uuid__ !== value.assetUuid)
                        return fail('SCENE_COMPOSITION_ASSET_REFERENCE_MISMATCH',
                            { componentId: expectedComponent.id, property: property.name });
                } else if (!Object.is(actual, value)) return fail('SCENE_COMPOSITION_PROPERTY_MISMATCH',
                    { componentId: expectedComponent.id, property: property.name });
            }
            serializedComponents.set(expectedComponent.id, { classId, record: rawComponent });
            verifiedComponentCount += 1;
        }
    }

    const eventGroups = new Map();
    for (const event of plan.request.buttonEvents) {
        const buttonComponent = plan.request.components.find((component) => component.nodeRef === event.buttonRef
            && component.className === 'cc.Button');
        const buttonSerialized = buttonComponent && serializedComponents.get(buttonComponent.id);
        if (!buttonSerialized) return fail('SCENE_BUTTON_COMPONENT_MISSING');
        const expectedEvents = eventGroups.get(buttonComponent.id) || [];
        expectedEvents.push(event);
        eventGroups.set(buttonComponent.id, expectedEvents);
    }
    for (const [componentId, expectedEvents] of eventGroups) {
        const buttonSerialized = serializedComponents.get(componentId);
        const rawEvents = buttonSerialized && buttonSerialized.record.clickEvents;
        if (!Array.isArray(rawEvents) || rawEvents.length !== expectedEvents.length)
            return fail('SCENE_BUTTON_EVENT_COUNT_MISMATCH', { componentId });
        for (let index = 0; index < expectedEvents.length; index += 1) {
            const expectedEvent = expectedEvents[index];
            const rawEvent = resolveRef(rawEvents[index], records);
            const targetUuid = expectedEvent.handlerRef.startsWith('new:')
                ? expectedNodes.get(expectedEvent.handlerRef.slice('new:'.length))?.uuid
                : expectedEvent.handlerRef.slice('uuid:'.length);
            const rawTarget = rawEvent && resolveRef(rawEvent.target, records);
            const handlerComponent = plan.request.components.find((component) => component.nodeRef === expectedEvent.handlerRef
                && component.className === expectedEvent.handlerComponentClassName);
            const handlerSerialized = handlerComponent && serializedComponents.get(handlerComponent.id);
            const componentNameMatches = rawEvent && rawEvent.component === expectedEvent.handlerComponentClassName;
            const componentIdMatches = rawEvent && handlerSerialized && rawEvent._componentId === handlerSerialized.classId;
            if (!rawEvent || rawEvent.__type__ !== 'cc.ClickEvent' || !rawTarget || rawTarget._id !== targetUuid
                || (!componentNameMatches && !componentIdMatches) || rawEvent.handler !== expectedEvent.handler
                || (rawEvent.customEventData || '') !== (expectedEvent.customEventData || ''))
                return fail('SCENE_BUTTON_EVENT_MISMATCH', { componentId, eventIndex: index });
            verifiedButtonEventCount += 1;
        }
    }

    if (verifiedButtonEventCount !== plan.request.buttonEvents.length)
        return fail('SCENE_BUTTON_EVENT_COUNT_MISMATCH');
    return { verified: true, sceneUuid, sceneUrl: sceneAssetRow.url,
        nodeCount: expectedNodes.size, componentCount: verifiedComponentCount,
        buttonEventCount: verifiedButtonEventCount, prefabInstanceCount: verifiedPrefabInstanceCount };
}

module.exports = { inspectSceneAssetIdentity, inspectSceneComposition, inspectSavedSceneNode,
    componentValueForDisk, validComponentDiskValue, sceneDiskTransformMatches };
