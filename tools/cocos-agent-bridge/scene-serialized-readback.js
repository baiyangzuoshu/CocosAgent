'use strict';

function resolveSerializedNode(objects, sceneName, nodePath, expectedDiff, side) {
    if (!Array.isArray(objects) || typeof sceneName !== 'string' || typeof nodePath !== 'string') return null;
    const parts = nodePath.split('/');
    if (parts.length < 2 || parts[0] !== sceneName || parts.some((part) => !part || part === '.' || part === '..')) return null;
    const rename = (expectedDiff || []).find((item) => item.path === 'node.name');
    if (rename && side === 'after') parts[parts.length - 1] = rename.after;
    else if (rename && side === 'before') parts[parts.length - 1] = rename.before;

    const sceneRoots = [];
    for (let i = 0; i < objects.length; i += 1) {
        if (objects[i] && objects[i].__type__ === 'cc.Scene') sceneRoots.push({ index: i, object: objects[i] });
    }
    if (sceneRoots.length !== 1) return null;
    let parent = sceneRoots[0];
    for (const segment of parts.slice(1)) {
        const children = Array.isArray(parent.object._children) ? parent.object._children : [];
        const matches = children.map((ref) => Number.isInteger(ref && ref.__id__)
            ? { index: ref.__id__, object: objects[ref.__id__] } : null)
            .filter((entry) => entry && entry.object && entry.object.__type__ === 'cc.Node'
                && entry.object._name === segment && entry.object._parent
                && entry.object._parent.__id__ === parent.index);
        if (matches.length !== 1) return null;
        parent = matches[0];
    }
    return parent;
}

function serializedValue(objects, node, fieldPath) {
    const target = node && node.object;
    if (!target || target.__type__ !== 'cc.Node') return { found: false };
    if (fieldPath === 'node.name') return { found: true, value: target._name };
    if (fieldPath === 'node.active') return { found: true, value: target._active !== false };
    const transform = fieldPath.match(/^node\.(position|scale)\.(x|y)$/);
    if (transform) {
        const array = target._trs && target._trs.array;
        const index = transform[1] === 'position'
            ? (transform[2] === 'x' ? 0 : 1)
            : (transform[2] === 'x' ? 7 : 8);
        return Array.isArray(array) && Number.isFinite(array[index]) ? { found: true, value: array[index] } : { found: false };
    }
    const component = fieldPath.match(/^component\.(cc\.(?:Sprite|Label))\.(enabled|spriteFrameUuid)$/);
    if (!component) return { found: false };
    const refs = Array.isArray(target._components) ? target._components : [];
    const values = refs.map((ref) => ref && Number.isInteger(ref.__id__) ? objects[ref.__id__] : null)
        .filter((item) => item && item.__type__ === component[1]);
    if (values.length !== 1) return { found: false, ambiguous: values.length > 1 };
    const key = component[2] === 'enabled' ? '_enabled' : '_spriteFrame';
    const value = values[0][key];
    if (component[2] === 'spriteFrameUuid') return { found: true, value: value && value.__uuid__ || null };
    return Object.prototype.hasOwnProperty.call(values[0], key) ? { found: true, value } : { found: false };
}

function matchesSerializedDiff(objects, node, diff, side) {
    return Array.isArray(diff) && ['before', 'after'].includes(side) && diff.every((item) => {
        const actual = serializedValue(objects, node, item.path);
        if (!actual.found) return false;
        if (typeof actual.value === 'number' && typeof item[side] === 'number') return Math.abs(actual.value - item[side]) <= 1e-5;
        return Object.is(actual.value, item[side]);
    });
}

module.exports = { resolveSerializedNode, serializedValue, matchesSerializedDiff };
