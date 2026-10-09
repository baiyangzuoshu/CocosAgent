'use strict';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NODE_ID = /^[A-Za-z0-9_+/=-]{1,64}$/;
const PATHS = new Set([
    'node.name', 'node.active', 'node.position.x', 'node.position.y', 'node.scale.x', 'node.scale.y',
    'component.cc.Sprite.enabled', 'component.cc.Sprite.spriteFrameUuid',
    'component.cc.Label.enabled',
]);

function validValue(path, value) {
    if (path === 'node.name') return typeof value === 'string' && /^[A-Za-z0-9_ -]{1,64}$/.test(value);
    if (path === 'node.active' || path.endsWith('.enabled')) return typeof value === 'boolean';
    if (path === 'component.cc.Sprite.spriteFrameUuid') return value === null || typeof value === 'string' && UUID.test(value);
    if (path.endsWith('.x') || path.endsWith('.y')) return Number.isFinite(value) && Math.abs(value) <= 4096;
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

function valueAt(snapshot, fieldPath) {
    if (!snapshot || snapshot.status && snapshot.status !== 'found') return { found: false };
    if (fieldPath === 'node.name') return { found: true, value: snapshot.name };
    if (fieldPath === 'node.active') return { found: true, value: snapshot.active };
    const transform = fieldPath.match(/^node\.(position|scale)\.(x|y)$/);
    if (transform) return snapshot.transform && snapshot.transform[transform[1]]
        ? { found: true, value: snapshot.transform[transform[1]][transform[2]] } : { found: false };
    const component = fieldPath.match(/^component\.(cc\.(?:Sprite|Label))\.(enabled|spriteFrameUuid)$/);
    if (!component) return { found: false };
    const matches = (snapshot.componentDetails || []).filter((item) => item.classId === component[1]);
    if (matches.length !== 1) return { found: false, ambiguous: matches.length > 1 };
    const key = component[2] === 'string' ? 'text' : component[2];
    return Object.prototype.hasOwnProperty.call(matches[0], key)
        ? { found: true, value: matches[0][key] } : { found: false };
}

function matchesDiff(snapshot, diff, side) {
    if (!validateDiff(diff) || !['before', 'after'].includes(side)) return false;
    return diff.every((item) => {
        const actual = valueAt(snapshot, item.path);
        return actual.found && Object.is(actual.value, item[side]);
    });
}

function invertDiff(diff) {
    if (!validateDiff(diff)) throw new TypeError('INVALID_EXPECTED_DIFF');
    return diff.map(({ path, before, after }) => ({ path, before: after, after: before }));
}

function targetPathAt(nodePath, diff, side) {
    const parts = nodePath.split('/');
    const rename = diff.find((item) => item.path === 'node.name');
    if (rename) parts[parts.length - 1] = rename[side];
    return parts.join('/');
}

module.exports = { PATHS, UUID, NODE_ID, validValue, validateDiff, valueAt, matchesDiff, invertDiff, targetPathAt };
