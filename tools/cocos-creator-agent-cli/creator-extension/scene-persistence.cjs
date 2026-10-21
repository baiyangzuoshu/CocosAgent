'use strict';

const MAX_SCENE_BYTES = 16 * 1024 * 1024;
const MAX_META_BYTES = 16 * 1024;
const MAX_SERIALIZED_OBJECTS = 100000;
const TRANSFORM_TOLERANCE = 0.002;

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

module.exports = { inspectSceneComposition };
