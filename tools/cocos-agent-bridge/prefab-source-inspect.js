'use strict';

const serialized = require('./prefab-serialized-readback');
const values = require('./scene-serialized-readback');

function inspect(objects) {
    const index = serialized.pathIndex(objects);
    if (!index) return null;
    const nodes = [...index.byPath.values()].map((entry) => {
        const object = entry.object;
        const transform = object._trs && object._trs.array || [];
        const components = [];
        for (const reference of object._components || []) {
            const component = reference && Number.isInteger(reference.__id__) ? objects[reference.__id__] : null;
            if (!component) return null;
            if (component.__type__ === 'cc.Sprite') components.push({ classId: 'cc.Sprite', enabled: component._enabled !== false,
                spriteFrameUuid: component._spriteFrame && component._spriteFrame.__uuid__ || null });
            else if (component.__type__ === 'cc.Label') components.push({ classId: 'cc.Label', enabled: component._enabled !== false });
            else components.push({ classId: component.__type__, enabled: component._enabled !== false, editableByPrefabSourcePatch: false });
        }
        const snapshot = { path: entry.path, uuid: object._id, name: object._name, active: object._active !== false,
            transform: { position: { x: transform[0], y: transform[1] }, scale: { x: transform[7], y: transform[8] } }, components,
            children: (object._children || []).map((ref) => objects[ref.__id__] && objects[ref.__id__]._name).filter((name) => typeof name === 'string') };
        const sprite = values.serializedValue(objects, entry, 'component.cc.Sprite.spriteFrameUuid');
        if (sprite.found && components.some((item) => item.classId === 'cc.Sprite')) components.find((item) => item.classId === 'cc.Sprite').spriteFrameUuid = sprite.value;
        return snapshot;
    });
    return nodes.some((node) => !node) ? null : nodes;
}

module.exports = { inspect };
