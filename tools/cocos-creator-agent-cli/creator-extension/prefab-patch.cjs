'use strict';

const crypto = require('crypto');

const UUID = /^(?:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[A-Za-z0-9+/]{22,23})$/;
const NODE_ID = /^[A-Za-z0-9_+/=-]{1,128}$/;
const SHA256 = /^[a-f0-9]{64}$/;
function rootNodeId(prefabUuid) { return UUID.test(prefabUuid || '') ? `prefab_root_${prefabUuid}` : null; }
function componentIdFor(prefabUuid, nodeUuid, index, classId, serializedId) {
    if (typeof serializedId === 'string' && serializedId) return serializedId;
    return `prefab_component_${crypto.createHash('sha256')
        .update(`${prefabUuid}\0${nodeUuid}\0${index}\0${classId}`).digest('hex').slice(0, 24)}`;
}
const PATHS = new Set([
    'node.name', 'node.active', 'node.position.x', 'node.position.y', 'node.scale.x', 'node.scale.y',
    'component.cc.Sprite.enabled', 'component.cc.Sprite.spriteFrameUuid', 'component.cc.Label.enabled',
]);

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

function validValue(fieldPath, value) {
    if (fieldPath === 'node.name') return typeof value === 'string' && value.length > 0 && value.length <= 120
        && !/[\/\\\u0000-\u001f\u007f]/.test(value);
    if (fieldPath === 'node.active' || fieldPath.endsWith('.enabled')) return typeof value === 'boolean';
    if (fieldPath === 'component.cc.Sprite.spriteFrameUuid') return value === null || typeof value === 'string' && UUID.test(value);
    if (fieldPath.endsWith('.x') || fieldPath.endsWith('.y')) return Number.isFinite(value) && Math.abs(value) <= 1000000;
    return false;
}

function validateDiff(diff) {
    if (!Array.isArray(diff) || diff.length < 1 || diff.length > 16) return false;
    const paths = new Set();
    return diff.every((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
        const key = item.path === 'component.property'
            ? `${item.componentClassName}\u0000${item.componentInstanceId}\u0000${item.property}` : item.path;
        if (!(PATHS.has(item.path) && Object.keys(item).length === 3
            && Object.keys(item).every((field) => ['path', 'before', 'after'].includes(field))
            && validValue(item.path, item.before) && validValue(item.path, item.after)
            && !Object.is(item.before, item.after))
            && !validPropertyDiff(item)) return false;
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
    if (item.path === 'component.property') {
        const properties = node.componentProperties && node.componentProperties[item.componentInstanceId];
        return properties && Object.prototype.hasOwnProperty.call(properties, item.property)
            ? { found: true, value: properties[item.property] } : { found: false };
    }
    const transform = item.path.match(/^node\.(position|scale)\.(x|y)$/);
    if (transform) {
        const key = transform[1] === 'position' ? transform[2] : `scale${transform[2].toUpperCase()}`;
        return node.transform && Object.prototype.hasOwnProperty.call(node.transform, key)
            ? { found: true, value: node.transform[key] } : { found: false };
    }
    const component = item.path.match(/^component\.(cc\.(?:Sprite|Label))\.(enabled|spriteFrameUuid)$/);
    if (!component) return { found: false };
    const matches = (node.components || []).filter((item) => item.className === component[1]);
    if (matches.length !== 1) return { found: false, ambiguous: matches.length > 1 };
    const key = component[2];
    return Object.prototype.hasOwnProperty.call(matches[0], key)
        ? { found: true, value: matches[0][key] } : { found: false };
}

function matchesDiff(node, diff, side) {
    if (!validateDiff(diff) || !['before', 'after'].includes(side)) return false;
    return diff.every((item) => {
        const actual = valueAt(node, item);
        return actual.found && canonicalValue(actual.value) === canonicalValue(item[side]);
    });
}

function invertDiff(diff) {
    if (!validateDiff(diff)) throw new TypeError('INVALID_EXPECTED_DIFF');
    return diff.map((item) => ({ ...item, before: item.after, after: item.before }));
}

function targetPathAt(nodePath, diff, side) {
    if (typeof nodePath !== 'string' || !['before', 'after'].includes(side) || !validateDiff(diff)) return null;
    const parts = nodePath.split('/');
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

module.exports = { UUID, NODE_ID, SHA256, PATHS, rootNodeId, componentIdFor, validValue,
    validateDiff, valueAt, matchesDiff, invertDiff, targetPathAt, validInput };
