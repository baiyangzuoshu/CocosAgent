const MAX_NODES = 50000;
const MAX_DEPTH = 24;

/**
 * Creator 2.4 preview-scene.json serializes a cc.SceneAsset and a cc.Scene as
 * separate entries. The asset carries the scene name and a __id__ reference;
 * the referenced scene carries the runtime UUID. The scene object itself does
 * not carry _name in this serialization format.
 */
export function findSerializedSceneIdentity(value, sceneUuid, sceneName) {
  if (!Array.isArray(value) || typeof sceneUuid !== 'string' || typeof sceneName !== 'string') return null;
  let visited = 0;
  const matches = [];
  const seen = new WeakSet();
  function visit(item, depth) {
    if (!item || typeof item !== 'object' || depth > MAX_DEPTH || visited++ >= MAX_NODES || seen.has(item)) return;
    seen.add(item);
    if (!Array.isArray(item) && item.__type__ === 'cc.SceneAsset' && item._name === sceneName
      && Number.isInteger(item.scene?.__id__) && item.scene.__id__ >= 0 && item.scene.__id__ < value.length) {
      const scene = value[item.scene.__id__];
      if (scene && scene.__type__ === 'cc.Scene' && scene._id === sceneUuid)
        matches.push({ uuid: scene._id, name: item._name, type: scene.__type__, sceneAssetType: item.__type__ });
    }
    if (visited >= MAX_NODES || depth >= MAX_DEPTH) return;
    for (const child of Array.isArray(item) ? item : Object.values(item)) visit(child, depth + 1);
  }
  visit(value, 0);
  return matches.length === 1 ? matches[0] : null;
}
