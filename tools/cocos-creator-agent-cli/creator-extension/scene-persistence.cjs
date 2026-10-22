'use strict';

const MAX_SCENE_BYTES = 16 * 1024 * 1024;
const MAX_META_BYTES = 16 * 1024;
const MAX_SERIALIZED_OBJECTS = 100000;
const TRANSFORM_TOLERANCE = 0.002;
const VALUE_TYPES = {
    vec2: { type: 'cc.Vec2', fields: ['x', 'y'] },
    vec3: { type: 'cc.Vec3', fields: ['x', 'y', 'z'] },
    vec4: { type: 'cc.Vec4', fields: ['x', 'y', 'z', 'w'] },
    size: { type: 'cc.Size', fields: ['width', 'height'] },
    rect: { type: 'cc.Rect', fields: ['x', 'y', 'width', 'height'] },
    color: { type: 'cc.Color', fields: ['r', 'g', 'b', 'a'] },
};
const UUID = /^(?:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[A-Za-z0-9+/]{22,23})$/;

function fail(reason, details = {}) { return { verified: false, reason, ...details }; }
function own(object, key) { return !!object && Object.prototype.hasOwnProperty.call(object, key); }
function close(actual, expected) {
    return Number.isFinite(actual) && Number.isFinite(expected)
        && Math.abs(actual - expected) <= TRANSFORM_TOLERANCE;
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
            && !(item && typeof item === 'object' && item.kind === 'asset'));
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

function isNodeInScene(record, records, sceneUuid) {
    const visited = new Set();
    let current = record;
    for (let depth = 0; current && depth <= 64; depth += 1) {
        if (current.__type__ === 'cc.Scene') return current._id === sceneUuid;
        if (current.__type__ !== 'cc.Node' || !UUID.test(current._id || '') || visited.has(current)) return false;
        visited.add(current);
        const parent = resolveRef(current._parent, records);
        if (!parent || !Array.isArray(parent._children)
            || parent._children.filter((reference) => resolveRef(reference, records) === current).length !== 1) return false;
        current = parent;
    }
    return false;
}

function readComponentDiskValue(raw, records, sceneUuid, depth = 0, visited = new Set()) {
    if (raw === null || typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') return raw;
    if (Array.isArray(raw)) {
        if (depth !== 0 || raw.length > 32) return undefined;
        return { kind: 'array', items: raw.map((item) => readComponentDiskValue(item, records, sceneUuid, depth + 1, visited)) };
    }
    if (!raw || typeof raw !== 'object') return undefined;
    if (own(raw, '__uuid__')) return Object.keys(raw).length === 1 ? { kind: 'asset', assetUuid: raw.__uuid__ } : undefined;
    if (own(raw, '__id__')) {
        if (Object.keys(raw).length !== 1) return undefined;
        const record = resolveRef(raw, records);
        if (!record || visited.has(record) || visited.size >= 8) return undefined;
        if (['cc.Node', 'cc.Scene'].includes(record.__type__))
            return isNodeInScene(record, records, sceneUuid) ? { kind: 'node-ref', nodeUuid: record._id } : undefined;
        const owner = resolveRef(record.node, records);
        if (owner && isNodeInScene(owner, records, sceneUuid) && Array.isArray(owner._components)
            && owner._components.filter((reference) => resolveRef(reference, records) === record).length === 1) {
            if (records.filter((entry) => entry._id === record._id).length !== 1) return undefined;
            return { kind: 'component-ref', nodeUuid: owner._id,
                componentInstanceId: record._id, serializedClassId: record.__type__ };
        }
        const nextVisited = new Set(visited); nextVisited.add(record);
        return readComponentDiskValue(record, records, sceneUuid, depth, nextVisited);
    }
    for (const [kind, typed] of Object.entries(VALUE_TYPES)) {
        if (raw.__type__ === typed.type
            && Object.keys(raw).sort().join(',') === ['__type__', ...typed.fields].sort().join(','))
            return Object.fromEntries([['kind', kind], ...typed.fields.map((field) => [field, raw[field]])]);
    }
    return undefined;
}

function inspectComponentProperty(nodeRecord, records, sceneUuid, selector) {
    if (!selector || typeof selector.componentInstanceId !== 'string' || !selector.componentInstanceId
        || selector.componentInstanceId.length > 128 || typeof selector.serializedClassId !== 'string'
        || !selector.serializedClassId || selector.serializedClassId.length > 128
        || typeof selector.property !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(selector.property))
        return fail('SCENE_COMPONENT_DISK_SELECTOR_INVALID');
    const matches = Array.isArray(nodeRecord._components) ? nodeRecord._components.map((reference) => resolveRef(reference, records))
        .filter((record) => record && record._id === selector.componentInstanceId
            && record.__type__ === selector.serializedClassId) : [];
    if (matches.length !== 1 || records.filter((record) => record._id === selector.componentInstanceId).length !== 1
        || resolveRef(matches[0].node, records) !== nodeRecord) return fail('SCENE_COMPONENT_SERIALIZED_IDENTITY_MISMATCH');
    if (!own(matches[0], selector.property)) return fail('SCENE_COMPONENT_SERIALIZED_PROPERTY_MISSING');
    const value = readComponentDiskValue(matches[0][selector.property], records, sceneUuid);
    if (!validComponentDiskValue(value)) return fail('SCENE_COMPONENT_SERIALIZED_VALUE_UNSUPPORTED');
    return { verified: true, componentProperty: { componentInstanceId: selector.componentInstanceId,
        serializedClassId: selector.serializedClassId, property: selector.property, value } };
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

function inspectSavedSceneNode({ sceneBytes, metaBytes, sceneUuid, sceneAssetRow, nodeUuid, componentProperty }) {
    if (!Buffer.isBuffer(sceneBytes) || sceneBytes.length < 2 || sceneBytes.length > MAX_SCENE_BYTES)
        return fail('SCENE_SERIALIZATION_SIZE_INVALID');
    if (!Buffer.isBuffer(metaBytes) || metaBytes.length < 2 || metaBytes.length > MAX_META_BYTES)
        return fail('SCENE_META_SIZE_INVALID');
    if (typeof sceneUuid !== 'string' || typeof nodeUuid !== 'string' || !sceneAssetRow
        || sceneAssetRow.uuid !== sceneUuid || typeof sceneAssetRow.url !== 'string'
        || !sceneAssetRow.url.startsWith('db://assets/') || !/\.fire$/i.test(sceneAssetRow.url))
        return fail('SCENE_ASSETDB_IDENTITY_MISMATCH');

    let meta;
    let records;
    try {
        meta = JSON.parse(metaBytes.toString('utf8'));
        records = JSON.parse(sceneBytes.toString('utf8'));
    } catch (_) { return fail('SCENE_SERIALIZATION_INVALID'); }
    if (!meta || meta.uuid !== sceneUuid || meta.importer !== 'scene') return fail('SCENE_META_IDENTITY_MISMATCH');
    if (!Array.isArray(records) || records.length < 2 || records.length > MAX_SERIALIZED_OBJECTS
        || records.some((record) => !record || typeof record !== 'object' || Array.isArray(record)))
        return fail('SCENE_SERIALIZED_OBJECT_COUNT_INVALID');

    const scenes = [];
    const nodes = new Map();
    for (let index = 0; index < records.length; index += 1) {
        const record = records[index];
        if (record.__type__ === 'cc.Scene' && record._id === sceneUuid) scenes.push({ record, index });
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
    const propertyState = componentProperty === undefined ? null
        : inspectComponentProperty(record, records, sceneUuid, componentProperty);
    if (propertyState && !propertyState.verified) return propertyState;
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
        ...(propertyState ? { componentProperty: propertyState.componentProperty } : {}),
        transform: { x: trs[0], y: trs[1], z: trs[2], angle, scaleX: trs[7], scaleY: trs[8],
            width: size.width, height: size.height, anchorX: anchor.x, anchorY: anchor.y } };
}

function inspectSceneComposition({ sceneBytes, metaBytes, sceneUuid, sceneAssetRow, operation, readback }) {
    if (!Buffer.isBuffer(sceneBytes) || sceneBytes.length < 2 || sceneBytes.length > MAX_SCENE_BYTES)
        return fail('SCENE_SERIALIZATION_SIZE_INVALID');
    if (!Buffer.isBuffer(metaBytes) || metaBytes.length < 2 || metaBytes.length > MAX_META_BYTES)
        return fail('SCENE_META_SIZE_INVALID');
    if (typeof sceneUuid !== 'string' || !sceneAssetRow || sceneAssetRow.uuid !== sceneUuid
        || typeof sceneAssetRow.url !== 'string' || !sceneAssetRow.url.startsWith('db://assets/')
        || !/\.fire$/i.test(sceneAssetRow.url)) return fail('SCENE_ASSETDB_IDENTITY_MISMATCH');
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
    if (!meta || meta.uuid !== sceneUuid || meta.importer !== 'scene') return fail('SCENE_META_IDENTITY_MISMATCH');
    if (!Array.isArray(records) || records.length < 2 || records.length > MAX_SERIALIZED_OBJECTS)
        return fail('SCENE_SERIALIZED_OBJECT_COUNT_INVALID');
    if (records.some((record) => !record || typeof record !== 'object' || Array.isArray(record)))
        return fail('SCENE_SERIALIZATION_RECORD_INVALID');

    const sceneRows = [];
    const nodeRows = new Map();
    for (let index = 0; index < records.length; index += 1) {
        const record = records[index];
        if (record.__type__ === 'cc.Scene' && record._id === sceneUuid) sceneRows.push({ record, index });
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
        const expectedPrefabUuid = expected.prefabUuid || null;
        if ((observed.prefabUuid || null) !== expectedPrefabUuid) return fail('SCENE_COMPOSITION_PREFAB_READBACK_MISMATCH', { nodeId });
        if (expectedPrefabUuid) {
            const prefabInfo = resolveRef(found.record._prefab, records);
            const prefabAsset = prefabInfo && prefabInfo.asset;
            const prefabRoot = prefabInfo && resolveRef(prefabInfo.root, records);
            if (!prefabInfo || prefabInfo.__type__ !== 'cc.PrefabInfo' || !prefabAsset
                || prefabAsset.__uuid__ !== expectedPrefabUuid || prefabRoot !== found.record)
                return fail('SCENE_COMPOSITION_PREFAB_LINK_MISMATCH', { nodeId, expectedPrefabUuid });
            verifiedPrefabInstanceCount += 1;
        } else if (own(found.record, '_prefab') && found.record._prefab != null)
            return fail('SCENE_COMPOSITION_UNEXPECTED_PREFAB_LINK', { nodeId });
        const parentRecord = resolveRef(found.record._parent, records);
        const parentUuid = parentRecord && parentRecord._id;
        const expectedParentUuid = expected.parentRef.startsWith('new:')
            ? expectedNodes.get(expected.parentRef.slice(4))?.uuid
            : expected.parentRef.slice('uuid:'.length);
        if (!parentRecord || parentUuid !== expectedParentUuid || observed.parentUuid !== expectedParentUuid)
            return fail('SCENE_COMPOSITION_PARENT_MISMATCH', { nodeId });
        if (!expectedPrefabUuid && found.record._active !== true)
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
        if (!Array.isArray(componentRefs) || (!expectedPrefabUuid && componentRefs.length !== expectedComponents.length))
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
            for (const property of expectedComponent.properties) {
                if (!own(rawComponent, property.name)) return fail('SCENE_COMPOSITION_PROPERTY_MISSING',
                    { componentId: expectedComponent.id, property: property.name });
                const actual = rawComponent[property.name];
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

module.exports = { inspectSceneComposition, inspectSavedSceneNode, componentValueForDisk, validComponentDiskValue };
