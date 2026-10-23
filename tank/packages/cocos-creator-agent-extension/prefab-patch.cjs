'use strict';

const UUID = /^(?:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[A-Za-z0-9+/]{22,23})$/;
const NODE_ID = /^[A-Za-z0-9_+/=-]{1,128}$/;
const SHA256 = /^[a-f0-9]{64}$/;
function rootNodeId(prefabUuid) { return UUID.test(prefabUuid || '') ? `prefab_root_${prefabUuid}` : null; }
const PATHS = new Set([
    'node.name', 'node.active', 'node.position.x', 'node.position.y', 'node.scale.x', 'node.scale.y',
    'component.cc.Sprite.enabled', 'component.cc.Sprite.spriteFrameUuid', 'component.cc.Label.enabled',
]);

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
        if (!item || typeof item !== 'object' || Array.isArray(item)
            || Object.keys(item).length !== 3 || !Object.keys(item).every((key) => ['path', 'before', 'after'].includes(key))
            || !PATHS.has(item.path) || paths.has(item.path)
            || !validValue(item.path, item.before) || !validValue(item.path, item.after)
            || Object.is(item.before, item.after)) return false;
        paths.add(item.path);
        return true;
    });
}

function valueAt(node, fieldPath) {
    if (!node || typeof node !== 'object') return { found: false };
    if (fieldPath === 'node.name') return { found: true, value: node.name };
    if (fieldPath === 'node.active') return { found: true, value: node.active };
    const transform = fieldPath.match(/^node\.(position|scale)\.(x|y)$/);
    if (transform) {
        const key = transform[1] === 'position' ? transform[2] : `scale${transform[2].toUpperCase()}`;
        return node.transform && Object.prototype.hasOwnProperty.call(node.transform, key)
            ? { found: true, value: node.transform[key] } : { found: false };
    }
    const component = fieldPath.match(/^component\.(cc\.(?:Sprite|Label))\.(enabled|spriteFrameUuid)$/);
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
        const actual = valueAt(node, item.path);
        return actual.found && Object.is(actual.value, item[side]);
    });
}

function invertDiff(diff) {
    if (!validateDiff(diff)) throw new TypeError('INVALID_EXPECTED_DIFF');
    return diff.map(({ path, before, after }) => ({ path, before: after, after: before }));
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

module.exports = { UUID, NODE_ID, SHA256, PATHS, rootNodeId, validValue, validateDiff, valueAt, matchesDiff, invertDiff, targetPathAt, validInput };
