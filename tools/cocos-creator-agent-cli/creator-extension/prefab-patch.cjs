'use strict';

const crypto = require('crypto');

const UUID = /^(?:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[A-Za-z0-9+/]{22,23})$/;
const NODE_ID = /^[A-Za-z0-9_+/=-]{1,128}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const UI_EVENT_PROPERTIES = Object.freeze({
    'cc.Button': ['clickEvents'],
    'cc.Toggle': ['clickEvents', 'checkEvents'],
    'cc.ToggleContainer': ['checkEvents'],
    'cc.Slider': ['slideEvents'],
    'cc.ScrollView': ['scrollEvents'],
    'cc.PageView': ['scrollEvents', 'pageEvents'],
    'cc.EditBox': ['editingDidBegan', 'textChanged', 'editingDidEnded', 'editingReturn'],
});
function rootNodeId(prefabUuid) { return UUID.test(prefabUuid || '') ? `prefab_root_${prefabUuid}` : null; }
function componentIdFor(prefabUuid, nodeUuid, index, classId, serializedId) {
    if (typeof serializedId === 'string' && serializedId) return serializedId;
    return `prefab_component_${crypto.createHash('sha256')
        .update(`${prefabUuid}\0${nodeUuid}\0${index}\0${classId}`).digest('hex').slice(0, 24)}`;
}
const PATHS = new Set([
    'node.name', 'node.active', 'node.parent', 'node.siblingIndex', 'node.child', 'node.subtree', 'node.position.x', 'node.position.y', 'node.scale.x', 'node.scale.y', 'node.size.width', 'node.size.height',
    'component.cc.Sprite.enabled', 'component.cc.Sprite.spriteFrameUuid', 'component.cc.Label.enabled',
]);
const MAX_DIRECT_CHILDREN = 128;
const AUTO_CHILD_NODE_ID = 'AUTO';
const AUTO_COMPONENT_INSTANCE_ID = 'AUTO';
const MAX_SUBTREE_NODES = 16;
const MAX_SUBTREE_DEPTH = 4;

function validPropertyValue(value, depth = 0) {
    if (value === null || typeof value === 'boolean') return true;
    if (typeof value === 'string') return value.length <= 512;
    if (typeof value === 'number') return Number.isFinite(value) && Math.abs(value) <= 1000000000;
    if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 1
        || Object.keys(value).some((key) => !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key))) return false;
    const fields = {
        vec2: ['x', 'y'], vec3: ['x', 'y', 'z'], vec4: ['x', 'y', 'z', 'w'],
        size: ['width', 'height'], rect: ['x', 'y', 'width', 'height'], color: ['r', 'g', 'b', 'a'],
    };
    if (fields[value.kind]) {
        const expected = ['kind', ...fields[value.kind]].sort().join(',');
        return Object.keys(value).sort().join(',') === expected
            && fields[value.kind].every((field) => value.kind === 'color'
                ? Number.isInteger(value[field]) && value[field] >= 0 && value[field] <= 255
                : Number.isFinite(value[field]) && Math.abs(value[field]) <= 1000000);
    }
    if (value.kind === 'asset') return (Object.keys(value).sort().join(',') === 'assetClass,assetUuid,kind'
        || Object.keys(value).sort().join(',') === 'assetClass,kind')
        && typeof value.assetClass === 'string' && /^[A-Za-z_$][A-Za-z0-9_$.]{0,119}$/.test(value.assetClass)
        && (value.assetUuid === undefined || UUID.test(value.assetUuid));
    if (value.kind === 'node-ref') return (Object.keys(value).sort().join(',') === 'kind'
        || Object.keys(value).sort().join(',') === 'kind,nodeUuid')
        && (value.nodeUuid === undefined || NODE_ID.test(value.nodeUuid));
    if (value.kind === 'component-ref') return (Object.keys(value).sort().join(',') === 'componentClassName,kind'
        || Object.keys(value).sort().join(',') === 'componentClassName,componentInstanceId,kind,nodeUuid')
        && typeof value.componentClassName === 'string' && /^[A-Za-z_$][A-Za-z0-9_$.]{0,119}$/.test(value.componentClassName)
        && (value.nodeUuid === undefined || NODE_ID.test(value.nodeUuid))
        && (value.componentInstanceId === undefined || NODE_ID.test(value.componentInstanceId));
    if (value.kind === 'array') return depth === 0 && Object.keys(value).sort().join(',') === 'items,kind'
        && Array.isArray(value.items) && value.items.length <= 32
        && value.items.every((item) => validPropertyValue(item, 1)
            && !(item && typeof item === 'object' && item.kind === 'array'));
    return false;
}

function canonicalValue(value) {
    if (!value || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonicalValue).join(',')}]`;
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalValue(value[key])}`).join(',')}}`;
}

function validPropertyDiff(item) {
    const allowed = ['path', 'before', 'after', 'componentClassName', 'componentInstanceId', 'componentIndex', 'serializedClassId', 'property',
        'serializedProperty', 'serializedPropertyCandidates', 'serializedWasOmitted', 'serializedDefaultValue'];
    if (!item || Object.keys(item).some((key) => !allowed.includes(key))
        || item.path !== 'component.property' || typeof item.componentClassName !== 'string'
        || !/^[A-Za-z_$][A-Za-z0-9_$.]{0,119}$/.test(item.componentClassName)
        || !NODE_ID.test(item.componentInstanceId || '')
        || !Number.isInteger(item.componentIndex) || item.componentIndex < 0 || item.componentIndex >= 64
        || typeof item.property !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(item.property)
        || item.property.startsWith('_') || !validPropertyValue(item.before) || !validPropertyValue(item.after)
        || canonicalValue(item.before) === canonicalValue(item.after)) return false;
    if (item.serializedProperty !== undefined && !/^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/.test(item.serializedProperty)) return false;
    if (item.serializedClassId !== undefined && (typeof item.serializedClassId !== 'string'
        || item.serializedClassId.length < 1 || item.serializedClassId.length > 160)) return false;
    if (item.serializedPropertyCandidates !== undefined && (!Array.isArray(item.serializedPropertyCandidates)
        || item.serializedPropertyCandidates.length < 1 || item.serializedPropertyCandidates.length > 4
        || item.serializedPropertyCandidates.some((property) => typeof property !== 'string'
            || !/^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/.test(property)))) return false;
    if (item.serializedWasOmitted !== undefined && typeof item.serializedWasOmitted !== 'boolean') return false;
    if (item.serializedDefaultValue !== undefined && !validPropertyValue(item.serializedDefaultValue)) return false;
    if (item.serializedWasOmitted === true && !Object.prototype.hasOwnProperty.call(item, 'serializedDefaultValue')) return false;
    return true;
}

function validUiEventList(value, { allowUnbound = false } = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || Object.keys(value).sort().join(',') !== 'items,kind' || value.kind !== 'ui-events'
        || !Array.isArray(value.items) || value.items.length > 12) return false;
    return value.items.every((event) => event && typeof event === 'object' && !Array.isArray(event)
        && Object.keys(event).sort().join(',') === 'component,customEventData,handler,targetUuid'
        && (event.targetUuid === null ? allowUnbound : NODE_ID.test(event.targetUuid || ''))
        && typeof event.component === 'string' && /^[A-Za-z_$][A-Za-z0-9_$.]{0,119}$/.test(event.component)
        && typeof event.handler === 'string' && /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/.test(event.handler)
        && typeof event.customEventData === 'string' && event.customEventData.length <= 512);
}

function validEventListDiff(item) {
    const allowed = ['path', 'before', 'after', 'componentClassName', 'componentInstanceId', 'componentIndex', 'eventProperty'];
    return !!item && !Object.keys(item).some((key) => !allowed.includes(key))
        && item.path === 'component.eventList'
        && typeof item.componentClassName === 'string' && Object.prototype.hasOwnProperty.call(UI_EVENT_PROPERTIES, item.componentClassName)
        && NODE_ID.test(item.componentInstanceId || '')
        && Number.isInteger(item.componentIndex) && item.componentIndex >= 0 && item.componentIndex < 64
        && typeof item.eventProperty === 'string' && UI_EVENT_PROPERTIES[item.componentClassName].includes(item.eventProperty)
        && validUiEventList(item.before, { allowUnbound: true })
        && validUiEventList(item.after, { allowUnbound: true })
        && canonicalValue(item.before) !== canonicalValue(item.after);
}

function validSiblingIndexDiff(item) {
    return !!item && Object.keys(item).sort().join(',') === 'after,before,parentUuid,path'
        && item.path === 'node.siblingIndex' && NODE_ID.test(item.parentUuid || '')
        && Number.isInteger(item.before) && item.before >= 0 && item.before < 10000
        && Number.isInteger(item.after) && item.after >= 0 && item.after < 10000
        && item.before !== item.after;
}

function validParentState(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value)
        && Object.keys(value).sort().join(',') === 'parentPath,parentUuid,siblingIndex'
        && NODE_ID.test(value.parentUuid || '') && typeof value.parentPath === 'string'
        && value.parentPath.length > 0 && value.parentPath.length <= 512
        && !value.parentPath.startsWith('/') && !value.parentPath.endsWith('/')
        && !value.parentPath.includes('//') && !value.parentPath.includes('\\')
        && value.parentPath.split('/').every((part) => part && part !== '.' && part !== '..')
        && Number.isInteger(value.siblingIndex) && value.siblingIndex >= 0 && value.siblingIndex < 10000;
}

function validParentDiff(item) {
    return !!item && Object.keys(item).sort().join(',') === 'after,before,path'
        && item.path === 'node.parent' && validParentState(item.before) && validParentState(item.after)
        && item.before.parentUuid !== item.after.parentUuid;
}

function validChildRow(value, allowAuto = false) {
    return !!value && typeof value === 'object' && !Array.isArray(value)
        && Object.keys(value).sort().join(',') === 'childCount,componentCount,name,nodeUuid,siblingIndex'
        && (value.nodeUuid === AUTO_CHILD_NODE_ID ? allowAuto : NODE_ID.test(value.nodeUuid || ''))
        && typeof value.name === 'string' && value.name.length > 0 && value.name.length <= 120
        && !/[\/\\\u0000-\u001f\u007f]/.test(value.name)
        && Number.isInteger(value.siblingIndex) && value.siblingIndex >= 0 && value.siblingIndex < MAX_DIRECT_CHILDREN
        && Number.isInteger(value.childCount) && value.childCount >= 0 && value.childCount <= 10000
        && Number.isInteger(value.componentCount) && value.componentCount >= 0 && value.componentCount <= 64;
}

function validChildState(value, { allowAuto = false } = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || Object.keys(value).sort().join(',') !== 'childCount,children'
        || !Number.isInteger(value.childCount) || value.childCount < 0 || value.childCount > MAX_DIRECT_CHILDREN
        || !Array.isArray(value.children) || value.children.length !== value.childCount) return false;
    const ids = new Set();
    return value.children.every((child, index) => validChildRow(child, allowAuto)
        && child.siblingIndex === index && !ids.has(child.nodeUuid) && ids.add(child.nodeUuid));
}

function childStateChange(before, after) {
    if (!validChildState(before, { allowAuto: false }) || !validChildState(after, { allowAuto: true })) return null;
    if (after.childCount === before.childCount + 1) {
        for (let index = 0; index < after.children.length; index += 1) {
            const inserted = after.children[index];
            if (inserted.nodeUuid === AUTO_CHILD_NODE_ID && index !== after.children.length - 1) return null;
            if (inserted.childCount !== 0 || inserted.componentCount !== 0
                || before.children.some((child) => child.nodeUuid === inserted.nodeUuid)) continue;
            const remaining = after.children.filter((_, childIndex) => childIndex !== index);
            if (canonicalValue(remaining) === canonicalValue(before.children))
                return { kind: 'insert', index, child: inserted };
        }
    }
    if (after.childCount === before.childCount - 1) {
        for (let index = 0; index < before.children.length; index += 1) {
            const removed = before.children[index];
            if (removed.childCount !== 0 || removed.componentCount !== 0) continue;
            const remaining = before.children.filter((_, childIndex) => childIndex !== index);
            if (canonicalValue(remaining) === canonicalValue(after.children))
                return { kind: 'remove', index, child: removed };
        }
    }
    return null;
}

function validSubtreeRow(row, ids, depth, allowAuto) {
    if (!row || typeof row !== 'object' || Array.isArray(row)
        || Object.keys(row).sort().join(',') !== 'childCount,children,componentCount,name,nodeUuid,siblingIndex'
        || !(allowAuto && row.nodeUuid === AUTO_CHILD_NODE_ID || NODE_ID.test(row.nodeUuid || ''))
        || typeof row.name !== 'string' || !row.name || row.name.length > 120
        || !Number.isInteger(row.siblingIndex) || row.siblingIndex < 0
        || !Number.isInteger(row.componentCount) || row.componentCount < 0 || row.componentCount > 64
        || !Number.isInteger(row.childCount) || row.childCount < 0 || row.childCount > MAX_SUBTREE_NODES
        || !Array.isArray(row.children) || row.children.length !== row.childCount || depth > MAX_SUBTREE_DEPTH
        || row.nodeUuid !== AUTO_CHILD_NODE_ID && ids.has(row.nodeUuid)) return false;
    if (row.nodeUuid !== AUTO_CHILD_NODE_ID) ids.add(row.nodeUuid);
    return row.children.every((child, index) => child.siblingIndex === index
        && validSubtreeRow(child, ids, depth + 1, allowAuto));
}

function validSubtreeState(value, allowAuto = false) {
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || Object.keys(value).sort().join(',') !== 'childCount,children'
        || !Number.isInteger(value.childCount) || value.childCount < 0 || value.childCount > MAX_DIRECT_CHILDREN
        || !Array.isArray(value.children) || value.children.length !== value.childCount) return false;
    const ids = new Set();
    let count = 0;
    const countRows = (row) => { count += 1; row.children.forEach(countRows); };
    return value.children.every((row, index) => row.siblingIndex === index
        && validSubtreeRow(row, ids, 1, allowAuto) && (countRows(row), count <= MAX_SUBTREE_NODES));
}

function subtreeStateChange(before, after) {
    if (!validSubtreeState(before) || !validSubtreeState(after, true)) return null;
    const insertion = after.childCount === before.childCount + 1;
    const removal = after.childCount === before.childCount - 1;
    if (!insertion && !removal) return null;
    const source = insertion ? after.children : before.children;
    const target = insertion ? before.children : after.children;
    for (let index = 0; index < source.length; index += 1) {
        const row = source[index];
        if (row.nodeUuid === AUTO_CHILD_NODE_ID && (!insertion || index !== source.length - 1)) continue;
        if (canonicalValue(source.filter((_, i) => i !== index)) !== canonicalValue(target)) continue;
        const stack = [row];
        let nodes = 0;
        let componentCount = 0;
        while (stack.length) { const item = stack.pop(); nodes += 1; componentCount += item.componentCount; stack.push(...item.children); }
        if (nodes > MAX_SUBTREE_NODES || componentCount !== 0) return null;
        return { kind: insertion ? 'insert' : 'remove', index, subtree: row, nodeCount: nodes };
    }
    return null;
}

function validSubtreeDiff(item) {
    return !!item && Object.keys(item).sort().join(',') === 'after,before,path' && item.path === 'node.subtree'
        && !!subtreeStateChange(item.before, item.after);
}

function validChildDiff(item) {
    if (!item || Object.keys(item).sort().join(',') !== 'after,before,path' || item.path !== 'node.child'
        || !validChildState(item.before, { allowAuto: false })
        || !validChildState(item.after, { allowAuto: true })) return false;
    const change = childStateChange(item.before, item.after);
    return !!change && (change.child.nodeUuid !== AUTO_CHILD_NODE_ID || change.kind === 'insert');
}

function validComponentRow(value, allowAuto = false) {
    const serializedClassId = value && value.serializedClassId;
    const registeredClassName = value && value.registeredClassName;
    const builtinClassName = value && /^cc\.[A-Za-z_$][A-Za-z0-9_$.]{0,117}$/.test(value.componentClassName || '');
    return !!value && typeof value === 'object' && !Array.isArray(value)
        && ['componentClassName', 'componentIndex', 'componentInstanceId', 'serializedClassId']
            .every((key) => Object.prototype.hasOwnProperty.call(value, key))
        && Object.keys(value).every((key) => ['componentClassName', 'componentIndex', 'componentInstanceId',
            'serializedClassId', 'registeredClassName', 'enabled', 'componentIdSynthetic', 'restoreProperties'].includes(key))
        && typeof value.componentClassName === 'string'
        && (builtinClassName || NODE_ID.test(value.componentClassName))
        && typeof serializedClassId === 'string' && /^[A-Za-z0-9_$./+-]{1,160}$/.test(serializedClassId)
        && value.serializedClassId === value.componentClassName
        && (registeredClassName === undefined || typeof registeredClassName === 'string'
            && /^[A-Za-z_$][A-Za-z0-9_$.]{0,119}$/.test(registeredClassName))
        && (builtinClassName || value.componentInstanceId !== AUTO_COMPONENT_INSTANCE_ID
            || typeof registeredClassName === 'string')
        && (value.componentInstanceId === AUTO_COMPONENT_INSTANCE_ID
            ? allowAuto : NODE_ID.test(value.componentInstanceId || ''))
        && (value.enabled === undefined || typeof value.enabled === 'boolean')
        && (value.componentIdSynthetic === undefined || typeof value.componentIdSynthetic === 'boolean')
        && (value.restoreProperties === undefined || validRestorableComponentProperties(value.restoreProperties))
        && Number.isInteger(value.componentIndex) && value.componentIndex >= 0 && value.componentIndex < 64;
}

function validRestorableComponentProperties(properties) {
    if (!Array.isArray(properties) || properties.length > 64) return false;
    const names = new Set();
    const serializedNames = new Set();
    return properties.every((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)
            || Object.keys(item).some((key) => !['property', 'value', 'serializedProperty', 'serializedWasOmitted'].includes(key))
            || typeof item.property !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(item.property)
            || item.property.startsWith('_') || typeof item.serializedProperty !== 'string'
            || !/^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/.test(item.serializedProperty)
            || item.serializedWasOmitted !== undefined && typeof item.serializedWasOmitted !== 'boolean'
            || !validPropertyValue(item.value)) return false;
        const value = item.value;
        const restorable = value !== null && (typeof value !== 'object'
            || ['vec2', 'vec3', 'vec4', 'size', 'rect', 'color'].includes(value.kind));
        if (!restorable || names.has(item.property) || serializedNames.has(item.serializedProperty)) return false;
        names.add(item.property);
        serializedNames.add(item.serializedProperty);
        return true;
    });
}

function validComponentState(value, { allowAuto = false } = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || Object.keys(value).sort().join(',') !== 'componentCount,components'
        || !Number.isInteger(value.componentCount) || value.componentCount < 0 || value.componentCount > 64
        || !Array.isArray(value.components) || value.components.length !== value.componentCount) return false;
    const ids = new Set();
    return value.components.every((component, index) => validComponentRow(component, allowAuto)
        && component.componentIndex === index && !ids.has(component.componentInstanceId)
        && ids.add(component.componentInstanceId));
}

function componentStateChange(before, after) {
    if (!validComponentState(before) || !validComponentState(after, { allowAuto: true })) return null;
    if (after.componentCount === before.componentCount + 1) {
        const added = after.components[after.components.length - 1];
        const existing = after.components.slice(0, -1);
        if (added.componentIndex === before.componentCount && added.componentInstanceId !== AUTO_COMPONENT_INSTANCE_ID
            && canonicalValue(existing) === canonicalValue(before.components)) return { kind: 'add', component: added };
        if (added.componentIndex === before.componentCount && added.componentInstanceId === AUTO_COMPONENT_INSTANCE_ID
            && canonicalValue(existing) === canonicalValue(before.components)) return { kind: 'add', component: added };
    }
    if (after.componentCount === before.componentCount - 1) {
        const removed = before.components[before.components.length - 1];
        if (canonicalValue(before.components.slice(0, -1)) === canonicalValue(after.components))
            return { kind: 'remove', component: removed };
    }
    return null;
}

function validComponentStructureDiff(item) {
    if (!item || Object.keys(item).sort().join(',') !== 'after,before,path' || item.path !== 'component.structure'
        || !validComponentState(item.before) || !validComponentState(item.after, { allowAuto: true })) return false;
    const change = componentStateChange(item.before, item.after);
    return !!change && (change.component.componentInstanceId !== AUTO_COMPONENT_INSTANCE_ID || change.kind === 'add');
}

function validValue(fieldPath, value) {
    if (fieldPath === 'node.name') return typeof value === 'string' && value.length > 0 && value.length <= 120
        && !/[\/\\\u0000-\u001f\u007f]/.test(value);
    if (fieldPath === 'node.active' || fieldPath.endsWith('.enabled')) return typeof value === 'boolean';
    if (fieldPath === 'component.cc.Sprite.spriteFrameUuid') return value === null || typeof value === 'string' && UUID.test(value);
    if (fieldPath.endsWith('.x') || fieldPath.endsWith('.y')) return Number.isFinite(value) && Math.abs(value) <= 1000000;
    if (fieldPath === 'node.size.width' || fieldPath === 'node.size.height')
        return Number.isFinite(value) && value >= 0 && value <= 1000000;
    return false;
}

function validateDiff(diff) {
    if (!Array.isArray(diff) || diff.length < 1 || diff.length > 16) return false;
    if (diff.some((item) => item && ['node.parent', 'node.child', 'node.subtree', 'component.structure'].includes(item.path)) && diff.length !== 1) return false;
    const paths = new Set();
    return diff.every((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
        const key = ['component.property', 'component.eventList'].includes(item.path)
            ? `${item.path}\u0000${item.componentClassName}\u0000${item.componentInstanceId}\u0000${item.property || item.eventProperty}` : item.path;
        if (!(PATHS.has(item.path) && Object.keys(item).length === 3
            && Object.keys(item).every((field) => ['path', 'before', 'after'].includes(field))
            && validValue(item.path, item.before) && validValue(item.path, item.after)
            && !Object.is(item.before, item.after))
            && !validSiblingIndexDiff(item) && !validParentDiff(item) && !validChildDiff(item) && !validSubtreeDiff(item) && !validComponentStructureDiff(item)
            && !validPropertyDiff(item) && !validEventListDiff(item)) return false;
        if (paths.has(key)) return false;
        paths.add(key);
        return true;
    });
}

function valueAt(node, fieldPath) {
    if (!node || typeof node !== 'object') return { found: false };
    const item = typeof fieldPath === 'string' ? { path: fieldPath } : fieldPath;
    if (item.path === 'node.name') return { found: true, value: node.name };
    if (item.path === 'node.active') return { found: true, value: node.active };
    if (item.path === 'node.siblingIndex') return node.parentUuid === item.parentUuid
        && Number.isInteger(node.siblingIndex) ? { found: true, value: node.siblingIndex } : { found: false };
    if (item.path === 'node.parent') {
        const parts = typeof node.nodePath === 'string' ? node.nodePath.split('/') : [];
        if (parts.length < 2 || !NODE_ID.test(node.parentUuid || '') || !Number.isInteger(node.siblingIndex))
            return { found: false };
        return { found: true, value: { parentUuid: node.parentUuid,
            parentPath: parts.slice(0, -1).join('/'), siblingIndex: node.siblingIndex } };
    }
    if (item.path === 'node.child') return node.childState && validChildState(node.childState)
        ? { found: true, value: node.childState } : { found: false };
    if (item.path === 'node.subtree') return node.subtreeState && validSubtreeState(node.subtreeState)
        ? { found: true, value: node.subtreeState } : { found: false };
    if (item.path === 'component.structure') {
        if (!node.componentState || !validComponentState(node.componentState)) return { found: false };
        const expectsEnabled = [item.before, item.after].some((state) => state && Array.isArray(state.components)
            && state.components.some((component) => typeof component.enabled === 'boolean'));
        if (!expectsEnabled) return { found: true, value: node.componentState };
        const components = node.componentState.components.map((component, index) => {
            const inspected = node.components && node.components[index];
            return inspected && typeof inspected.enabled === 'boolean' ? { ...component, enabled: inspected.enabled } : component;
        });
        return { found: true, value: { ...node.componentState, components } };
    }
    if (item.path === 'component.property') {
        const properties = node.componentProperties && node.componentProperties[item.componentInstanceId];
        return properties && Object.prototype.hasOwnProperty.call(properties, item.property)
            ? { found: true, value: properties[item.property] } : { found: false };
    }
    if (item.path === 'component.eventList') {
        const liveLists = node.componentEventLists && node.componentEventLists[item.componentInstanceId];
        if (liveLists && Object.prototype.hasOwnProperty.call(liveLists, item.eventProperty)) {
            const value = liveLists[item.eventProperty];
            if (validUiEventList(value, { allowUnbound: true })) return { found: true, value };
            return Array.isArray(value)
                ? { found: true, value: { kind: 'ui-events', items: value } } : { found: false };
        }
        const matches = (node.components || []).filter((component) => component
            && component.className === item.componentClassName && component.instanceId === item.componentInstanceId
            && component.index === item.componentIndex);
        if (matches.length !== 1 || !matches[0].eventLists
            || !Object.prototype.hasOwnProperty.call(matches[0].eventLists, item.eventProperty)) return { found: false };
        return { found: true, value: { kind: 'ui-events', items: matches[0].eventLists[item.eventProperty] } };
    }
    const transform = item.path.match(/^node\.(position|scale)\.(x|y)$/);
    if (transform) {
        const key = transform[1] === 'position' ? transform[2] : `scale${transform[2].toUpperCase()}`;
        return node.transform && Object.prototype.hasOwnProperty.call(node.transform, key)
            ? { found: true, value: node.transform[key] } : { found: false };
    }
    const size = item.path.match(/^node\.size\.(width|height)$/);
    if (size) return node.transform && Object.prototype.hasOwnProperty.call(node.transform, size[1])
        ? { found: true, value: node.transform[size[1]] } : { found: false };
    const component = item.path.match(/^component\.(cc\.(?:Sprite|Label))\.(enabled|spriteFrameUuid)$/);
    if (!component) return { found: false };
    const matches = (node.components || []).filter((item) => item.className === component[1]);
    if (matches.length !== 1) return { found: false, ambiguous: matches.length > 1 };
    const key = component[2];
    return Object.prototype.hasOwnProperty.call(matches[0], key)
        ? { found: true, value: matches[0][key] } : { found: false };
}

function comparableComponentState(value) {
    return { ...value, components: value.components.map(({ registeredClassName, ...row }) => row) };
}

function comparableValue(item, value) {
    return item.path === 'component.structure' ? comparableComponentState(value) : value;
}

function matchesDiff(node, diff, side) {
    if (!validateDiff(diff) || !['before', 'after'].includes(side)) return false;
    return diff.every((item) => {
        const actual = valueAt(node, item);
        return actual.found && canonicalValue(comparableValue(item, actual.value))
            === canonicalValue(comparableValue(item, item[side]));
    });
}

function matchesBeforeOrGeometryAfter(node, diff) {
    if (!validateDiff(diff)) return false;
    const geometryPaths = new Set(['node.position.x', 'node.position.y', 'node.size.width', 'node.size.height']);
    return diff.every((item) => {
        const actual = valueAt(node, item);
        if (!actual.found) return false;
        const current = canonicalValue(comparableValue(item, actual.value));
        return current === canonicalValue(comparableValue(item, item.before))
            || geometryPaths.has(item.path) && current === canonicalValue(comparableValue(item, item.after));
    });
}

function sourceInspectionDiff(diff) {
    if (!Array.isArray(diff)) return [];
    return diff.filter((item) => item && ['component.property', 'component.eventList', 'component.structure'].includes(item.path));
}

function validTransformSnapshot(transform) {
    return !!transform && typeof transform === 'object' && !Array.isArray(transform)
        && Object.keys(transform).sort().join(',') === 'height,scaleX,scaleY,width,x,y'
        && Object.values(transform).every((value) => Number.isFinite(value) && Math.abs(value) <= 1000000)
        && transform.width >= 0 && transform.height >= 0;
}

function matchesTransformSnapshot(node, transform) {
    if (!validTransformSnapshot(transform) || !node || !node.transform) return false;
    return ['x', 'y', 'scaleX', 'scaleY', 'width', 'height']
        .every((key) => canonicalValue(node.transform[key]) === canonicalValue(transform[key]));
}

function hasMatchingDiskReadback(operation, source) {
    const readback = operation && operation.diskReadback;
    return !!(readback && readback.verified === true && source
        && readback.prefabUuid === operation.plan.prefabUuid
        && readback.sourceSha256 === source.sourceSha256
        && readback.metaSha256 === source.metaSha256
        && operation.afterSourceSha256 === source.sourceSha256);
}

function classifyDiffState(node, diff) {
    if (matchesDiff(node, diff, 'before')) return 'before';
    if (matchesDiff(node, diff, 'after')) return 'after';
    return 'conflict';
}

function invertDiff(diff) {
    if (!validateDiff(diff)) throw new TypeError('INVALID_EXPECTED_DIFF');
    return diff.map((item) => ({ ...item, before: item.after, after: item.before }));
}

function targetPathAt(nodePath, diff, side) {
    if (typeof nodePath !== 'string' || !['before', 'after'].includes(side) || !validateDiff(diff)) return null;
    const parts = nodePath.split('/');
    const parent = diff.find((item) => item.path === 'node.parent');
    if (parent) {
        const state = parent[side];
        if (parts.length < 2 || side === 'before' && parts.slice(0, -1).join('/') !== state.parentPath) return null;
        return `${state.parentPath}/${parts[parts.length - 1]}`;
    }
    const rename = diff.find((item) => item.path === 'node.name');
    if (rename) {
        if (parts[parts.length - 1] !== rename.before) return null;
        parts[parts.length - 1] = rename[side];
    }
    return parts.join('/');
}

function validInput(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
    const allowed = ['prefabUuid', 'targetNodePath', 'targetNodeUuid', 'action', 'expectedSourceSha256',
        'expectedDiff', 'sourceOperationId'];
    const pathParts = typeof input.targetNodePath === 'string' ? input.targetNodePath.split('/') : [];
    if (Object.keys(input).some((key) => !allowed.includes(key)) || !UUID.test(input.prefabUuid || '')
        || typeof input.targetNodePath !== 'string' || input.targetNodePath.length < 1 || input.targetNodePath.length > 512
        || input.targetNodePath.startsWith('/') || input.targetNodePath.endsWith('/') || input.targetNodePath.includes('//')
        || input.targetNodePath.includes('\\') || pathParts.some((part) => !part || part === '.' || part === '..')
        || !NODE_ID.test(input.targetNodeUuid || '')
        || !['apply', 'compensate', 'replay'].includes(input.action)) return false;
    if (input.action === 'apply') return SHA256.test(input.expectedSourceSha256 || '')
        && validateDiff(input.expectedDiff) && input.expectedDiff.every((item) => item.path !== 'node.name'
            || input.targetNodePath.split('/').pop() === item.before)
        && input.sourceOperationId === undefined;
    return input.expectedDiff === undefined && UUID.test(input.sourceOperationId || '')
        && (input.expectedSourceSha256 === undefined || SHA256.test(input.expectedSourceSha256));
}

module.exports = { UUID, NODE_ID, SHA256, PATHS, UI_EVENT_PROPERTIES, rootNodeId, componentIdFor,
    MAX_DIRECT_CHILDREN, MAX_SUBTREE_NODES, MAX_SUBTREE_DEPTH, AUTO_CHILD_NODE_ID, AUTO_COMPONENT_INSTANCE_ID, validValue, validUiEventList,
    canonicalValue, validateDiff, childStateChange, subtreeStateChange, validSubtreeState, componentStateChange,
    valueAt, matchesDiff, matchesBeforeOrGeometryAfter, sourceInspectionDiff,
    validTransformSnapshot, matchesTransformSnapshot, hasMatchingDiskReadback,
    classifyDiffState, invertDiff, targetPathAt, validInput };
