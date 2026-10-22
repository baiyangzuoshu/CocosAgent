import path from 'node:path';

const MAX_SOURCE_BYTES = 16 * 1024 * 1024;
const MAX_RECORDS = 100000;
const MAX_NODES = 20000;
const MAX_COMPONENTS_PER_NODE = 128;
const MAX_VALUE_DEPTH = 12;
const MAX_VALUE_ITEMS = 512;
const UUID = /^(?:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[A-Za-z0-9+/]{22,23})$/;
const COMPONENT_IGNORED_FIELDS = new Set(['__type__', '_id', '_objFlags', '_name', 'node']);

function fail(code) { throw new Error(code); }
function own(value, key) { return !!value && Object.prototype.hasOwnProperty.call(value, key); }
function refIndex(value, records) {
  return value && typeof value === 'object' && Number.isInteger(value.__id__)
    && value.__id__ >= 0 && value.__id__ < records.length ? value.__id__ : null;
}
function resolveRef(value, records) {
  const index = refIndex(value, records);
  return index === null ? null : records[index];
}

function normalizeValue(value, records, { depth = 0, active = new Set() } = {}) {
  if (depth > MAX_VALUE_DEPTH) fail('CREATOR_ASSET_DIFF_VALUE_DEPTH_LIMIT');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (Array.isArray(value)) {
    if (value.length > MAX_VALUE_ITEMS) fail('CREATOR_ASSET_DIFF_ARRAY_LIMIT');
    return value.map((item) => normalizeValue(item, records, { depth: depth + 1, active }));
  }
  if (!value || typeof value !== 'object') return String(value);
  if (own(value, '__uuid__')) {
    if (typeof value.__uuid__ !== 'string' || !UUID.test(value.__uuid__)) fail('CREATOR_ASSET_DIFF_ASSET_UUID_INVALID');
    return { assetUuid: value.__uuid__ };
  }
  if (own(value, '__id__')) {
    const index = refIndex(value, records);
    if (index === null || Object.keys(value).length !== 1) fail('CREATOR_ASSET_DIFF_REFERENCE_INVALID');
  }
  const index = refIndex(value, records);
  if (index !== null && Object.keys(value).length === 1) {
    const record = records[index];
    if (record.__type__ === 'cc.Node') return { nodeUuid: record._id };
    if (record.__type__ === 'cc.Scene') return { sceneUuid: record._id };
    if (typeof record._id === 'string' && record._id && record.__type__)
      return { componentInstanceId: record._id, classId: record.__type__ };
    if (active.has(index)) return { serializedObject: record.__type__ || 'object' };
    active.add(index);
    const normalized = normalizeObject(record, records, { depth: depth + 1, active, skip: new Set(['_id', '_objFlags', 'node']) });
    active.delete(index);
    return normalized;
  }
  return normalizeObject(value, records, { depth, active });
}

function normalizeObject(value, records, { depth, active, skip = new Set() }) {
  const keys = Object.keys(value).filter((key) => !skip.has(key)).sort();
  if (keys.length > MAX_VALUE_ITEMS) fail('CREATOR_ASSET_DIFF_OBJECT_LIMIT');
  const result = {};
  for (const key of keys) result[key] = normalizeValue(value[key], records, { depth: depth + 1, active });
  return result;
}

function transformFor(node, records) {
  const array = node._trs && node._trs.array;
  const result = {};
  if (Array.isArray(array)) {
    if (array.length < 10 || array.slice(0, 10).some((value) => !Number.isFinite(value)))
      fail('CREATOR_ASSET_DIFF_TRANSFORM_INVALID');
    result.position = { x: array[0], y: array[1], z: array[2] };
    result.rotation = { x: array[3], y: array[4], z: array[5], w: array[6] };
    result.scale = { x: array[7], y: array[8], z: array[9] };
  }
  for (const [source, target] of [['_contentSize', 'size'], ['_anchorPoint', 'anchorPoint'],
    ['_color', 'color']]) {
    if (node[source] !== undefined) result[target] = normalizeValue(node[source], records);
  }
  for (const [source, target] of [['_opacity', 'opacity'], ['_skewX', 'skewX'], ['_skewY', 'skewY'],
    ['_zIndex', 'zIndex'], ['groupIndex', 'groupIndex']]) {
    if (node[source] !== undefined) result[target] = normalizeValue(node[source], records);
  }
  return result;
}

function componentRowsFor(node, records) {
  const references = node._components === undefined ? [] : node._components;
  if (!Array.isArray(references) || references.length > MAX_COMPONENTS_PER_NODE)
    fail('CREATOR_ASSET_DIFF_COMPONENT_LIST_INVALID');
  const seenIndexes = new Set();
  const seenIds = new Set();
  const classOrdinals = new Map();
  return references.map((reference, index) => {
    const componentIndex = refIndex(reference, records);
    const component = resolveRef(reference, records);
    if (componentIndex === null || seenIndexes.has(componentIndex) || !component
      || typeof component.__type__ !== 'string' || !component.__type__
      || (component.node !== undefined && resolveRef(component.node, records) !== node))
      fail('CREATOR_ASSET_DIFF_COMPONENT_IDENTITY_INVALID');
    seenIndexes.add(componentIndex);
    const classId = component.__type__;
    const ordinal = classOrdinals.get(classId) || 0;
    classOrdinals.set(classId, ordinal + 1);
    const instanceId = typeof component._id === 'string' && component._id ? component._id : null;
    if (instanceId && seenIds.has(instanceId)) fail('CREATOR_ASSET_DIFF_COMPONENT_ID_DUPLICATE');
    if (instanceId) seenIds.add(instanceId);
    const properties = normalizeObject(component, records, { depth: 0, active: new Set(), skip: COMPONENT_IGNORED_FIELDS });
    return { key: instanceId || `${classId}#${ordinal}`, instanceId, classId, className: classId, index, properties };
  });
}

function prefabUuidFor(node, records) {
  if (node._prefab === undefined || node._prefab === null) return null;
  const info = resolveRef(node._prefab, records);
  if (!info || info.__type__ !== 'cc.PrefabInfo') fail('CREATOR_ASSET_DIFF_PREFAB_LINK_INVALID');
  const assetUuid = info.asset && info.asset.__uuid__;
  if (typeof assetUuid !== 'string' || !UUID.test(assetUuid)) fail('CREATOR_ASSET_DIFF_PREFAB_ASSET_UUID_INVALID');
  return assetUuid;
}

function assetSnapshot(sourceBytes, metaBytes, assetPath) {
  if (!Buffer.isBuffer(sourceBytes) || sourceBytes.length < 2 || sourceBytes.length > MAX_SOURCE_BYTES
    || !Buffer.isBuffer(metaBytes) || metaBytes.length < 2 || metaBytes.length > 64 * 1024)
    fail('CREATOR_ASSET_DIFF_SOURCE_SIZE_INVALID');
  const extension = path.extname(assetPath).toLowerCase();
  const assetType = extension === '.fire' ? 'scene' : extension === '.prefab' ? 'prefab' : null;
  if (!assetType) fail('CREATOR_ASSET_DIFF_TYPE_UNSUPPORTED');
  let meta;
  let records;
  try {
    meta = JSON.parse(metaBytes.toString('utf8'));
    const parsed = JSON.parse(sourceBytes.toString('utf8'));
    records = Array.isArray(parsed) ? parsed : [parsed];
  } catch (_) { fail('CREATOR_ASSET_DIFF_JSON_INVALID'); }
  if (!meta || meta.importer !== assetType || typeof meta.uuid !== 'string' || !UUID.test(meta.uuid))
    fail('CREATOR_ASSET_DIFF_META_IDENTITY_INVALID');
  if (!Array.isArray(records) || records.length < 1 || records.length > MAX_RECORDS
    || records.some((record) => !record || typeof record !== 'object' || Array.isArray(record)))
    fail('CREATOR_ASSET_DIFF_RECORDS_INVALID');

  const nodeRecords = new Map();
  const sceneRecords = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (record.__type__ === 'cc.Scene') sceneRecords.push({ index, record });
    if (record.__type__ !== 'cc.Node') continue;
    if (typeof record._id !== 'string' || !record._id || record._id.length > 128 || nodeRecords.has(record._id))
      fail('CREATOR_ASSET_DIFF_NODE_ID_INVALID');
    nodeRecords.set(record._id, { index, record });
  }
  if (!nodeRecords.size || nodeRecords.size > MAX_NODES) fail('CREATOR_ASSET_DIFF_NODE_COUNT_INVALID');
  let sceneRoot = null;
  if (assetType === 'scene') {
    if (sceneRecords.length !== 1 || sceneRecords[0].record._id !== meta.uuid)
      fail('CREATOR_ASSET_DIFF_SCENE_ROOT_INVALID');
    sceneRoot = sceneRecords[0].record;
    if (!Array.isArray(sceneRoot._children)) fail('CREATOR_ASSET_DIFF_SCENE_CHILDREN_INVALID');
    const sceneAssets = records.filter((record) => record.__type__ === 'cc.SceneAsset'
      && resolveRef(record.scene, records) === sceneRoot);
    if (sceneAssets.length !== 1) fail('CREATOR_ASSET_DIFF_SCENE_ASSET_INVALID');
  } else if (sceneRecords.length !== 0) fail('CREATOR_ASSET_DIFF_PREFAB_SCENE_RECORD_INVALID');

  const parents = new Map();
  const children = new Map();
  for (const [uuid, item] of nodeRecords) {
    const node = item.record;
    if (typeof node._name !== 'string' || !node._name || node._name.length > 512
      || (node._children !== undefined && !Array.isArray(node._children))) fail('CREATOR_ASSET_DIFF_NODE_RECORD_INVALID');
    const parent = node._parent == null ? null : resolveRef(node._parent, records);
    if (node._parent != null && (!parent || !['cc.Node', 'cc.Scene'].includes(parent.__type__)))
      fail('CREATOR_ASSET_DIFF_PARENT_INVALID');
    parents.set(uuid, parent && (parent.__type__ === 'cc.Node' || parent.__type__ === 'cc.Scene') ? parent._id : null);
    if (parent && Array.isArray(parent._children)
      && parent._children.filter((reference) => resolveRef(reference, records) === node).length !== 1)
      fail('CREATOR_ASSET_DIFF_PARENT_CHILD_MISMATCH');
    if (parent && !Array.isArray(parent._children)) fail('CREATOR_ASSET_DIFF_PARENT_CHILDREN_INVALID');
    const refs = node._children === undefined ? [] : node._children;
    const row = [];
    const seen = new Set();
    for (const reference of refs) {
      const child = resolveRef(reference, records);
      if (!child || child.__type__ !== 'cc.Node' || seen.has(child._id) || resolveRef(child._parent, records) !== node)
        fail('CREATOR_ASSET_DIFF_CHILD_IDENTITY_INVALID');
      seen.add(child._id);
      row.push(child._id);
    }
    children.set(uuid, row);
  }

  const roots = [...nodeRecords.keys()].filter((uuid) => {
    const parent = nodeRecords.get(uuid).record._parent;
    return parent == null || (assetType === 'scene' && resolveRef(parent, records) === sceneRoot);
  });
  if (sceneRoot) {
    const seenSceneChildren = new Set();
    for (const reference of sceneRoot._children) {
      const child = resolveRef(reference, records);
      if (!child || child.__type__ !== 'cc.Node' || seenSceneChildren.has(child._id)
        || resolveRef(child._parent, records) !== sceneRoot)
        fail('CREATOR_ASSET_DIFF_SCENE_CHILD_IDENTITY_INVALID');
      seenSceneChildren.add(child._id);
    }
    if (seenSceneChildren.size !== roots.length || roots.some((uuid) => !seenSceneChildren.has(uuid)))
      fail('CREATOR_ASSET_DIFF_SCENE_CHILDREN_MISMATCH');
  }
  if (assetType === 'prefab' && roots.length !== 1) fail('CREATOR_ASSET_DIFF_PREFAB_ROOT_INVALID');
  if (assetType === 'scene' && [...nodeRecords.values()].some(({ record }) => record._parent == null))
    fail('CREATOR_ASSET_DIFF_SCENE_NODE_PARENT_INVALID');
  const reachable = new Set();
  const stack = [...roots];
  while (stack.length) {
    const uuid = stack.pop();
    if (reachable.has(uuid)) fail('CREATOR_ASSET_DIFF_HIERARCHY_CYCLE');
    reachable.add(uuid);
    stack.push(...(children.get(uuid) || []));
  }
  if (reachable.size !== nodeRecords.size) fail('CREATOR_ASSET_DIFF_HIERARCHY_UNREACHABLE');
  const prefix = path.basename(assetPath, extension);
  const pathCache = new Map();
  function nodePath(uuid, visiting = new Set()) {
    if (pathCache.has(uuid)) return pathCache.get(uuid);
    if (visiting.has(uuid)) fail('CREATOR_ASSET_DIFF_HIERARCHY_CYCLE');
    visiting.add(uuid);
    const node = nodeRecords.get(uuid).record;
    const parentUuid = parents.get(uuid);
    const parentPath = parentUuid && nodeRecords.has(parentUuid) ? nodePath(parentUuid, visiting)
      : assetType === 'scene' ? prefix : '';
    visiting.delete(uuid);
    const result = parentPath ? `${parentPath}/${node._name}` : node._name;
    pathCache.set(uuid, result);
    return result;
  }

  const nodes = [];
  if (sceneRoot) {
    const properties = normalizeObject(sceneRoot, records, { depth: 0, active: new Set(),
      skip: new Set(['__type__', '_id', '_objFlags', '_name', '_children']) });
    nodes.push({ uuid: meta.uuid, name: prefix, path: prefix, parentUuid: null, active: true,
      transform: {}, components: [], componentDetails: [], serializedProperties: properties, prefabUuid: null });
  }
  for (const [uuid, item] of nodeRecords) {
    const node = item.record;
    const parent = node._parent == null ? null : resolveRef(node._parent, records);
    const parentUuid = parent && typeof parent._id === 'string' ? parent._id : null;
    const components = componentRowsFor(node, records);
    nodes.push({ uuid, name: node._name, path: nodePath(uuid), parentUuid,
      active: typeof node._active === 'boolean' ? node._active : true,
      transform: transformFor(node, records),
      components: components.map((component) => component.className),
      componentDetails: components,
      prefabUuid: prefabUuidFor(node, records) });
  }
  return { assetUuid: meta.uuid, assetType, assetName: prefix, nodes };
}

function stableJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
}

function changedFields(before, after, fields) {
  const changes = {};
  for (const field of fields) {
    const oldValue = before[field] === undefined ? null : before[field];
    const newValue = after[field] === undefined ? null : after[field];
    if (stableJson(oldValue) !== stableJson(newValue)) changes[field] = { before: oldValue, after: newValue };
  }
  return changes;
}

function diffComponents(before, after) {
  const previous = new Map(before.map((component) => [component.key, component]));
  const current = new Map(after.map((component) => [component.key, component]));
  const added = [];
  const removed = [];
  const changed = [];
  for (const [key, component] of current) {
    const oldComponent = previous.get(key);
    if (!oldComponent) { added.push(component); continue; }
    if (oldComponent.classId !== component.classId) {
      changed.push({ key, beforeClassId: oldComponent.classId, afterClassId: component.classId,
        replaced: true, properties: changedFields(oldComponent.properties, component.properties,
          [...new Set([...Object.keys(oldComponent.properties), ...Object.keys(component.properties)])]) });
      continue;
    }
    const properties = changedFields(oldComponent.properties, component.properties,
      [...new Set([...Object.keys(oldComponent.properties), ...Object.keys(component.properties)])]);
    if (Object.keys(properties).length) changed.push({ key, classId: component.classId, properties });
  }
  for (const [key, component] of previous) if (!current.has(key)) removed.push(component);
  return { added, removed, changed };
}

export function diffCreatorSerializedAssets({ beforeBytes, beforeMetaBytes, afterBytes, afterMetaBytes, assetPath }) {
  const before = assetSnapshot(beforeBytes, beforeMetaBytes, assetPath);
  const after = assetSnapshot(afterBytes, afterMetaBytes, assetPath);
  if (before.assetType !== after.assetType || before.assetUuid !== after.assetUuid)
    fail('CREATOR_ASSET_DIFF_IDENTITY_MISMATCH');
  const beforeNodes = new Map(before.nodes.map((node) => [node.uuid, node]));
  const afterNodes = new Map(after.nodes.map((node) => [node.uuid, node]));
  const added = [];
  const removed = [];
  const changed = [];
  let addedComponents = 0;
  let removedComponents = 0;
  let changedComponents = 0;
  for (const [uuid, node] of afterNodes) {
    const previous = beforeNodes.get(uuid);
    if (!previous) { added.push(node); addedComponents += node.componentDetails.length; continue; }
    const fields = changedFields(previous, node,
      ['name', 'path', 'parentUuid', 'active', 'transform', 'serializedProperties', 'prefabUuid']);
    const components = diffComponents(previous.componentDetails, node.componentDetails);
    addedComponents += components.added.length;
    removedComponents += components.removed.length;
    changedComponents += components.changed.length;
    if (Object.keys(fields).length || components.added.length || components.removed.length || components.changed.length)
      changed.push({ uuid, name: node.name, pathBefore: previous.path, pathAfter: node.path,
        prefabInstanceUuid: node.prefabUuid, changes: fields, components });
  }
  for (const [uuid, node] of beforeNodes) {
    if (!afterNodes.has(uuid)) { removed.push(node); removedComponents += node.componentDetails.length; }
  }
  const sortByPath = (left, right) => left.path.localeCompare(right.path) || left.uuid.localeCompare(right.uuid);
  added.sort(sortByPath); removed.sort(sortByPath); changed.sort((left, right) => left.pathAfter.localeCompare(right.pathAfter));
  return { asset: { type: before.assetType, path: assetPath, uuid: before.assetUuid },
    counts: { beforeNodes: before.nodes.length, afterNodes: after.nodes.length,
      addedNodes: added.length, removedNodes: removed.length, changedNodes: changed.length,
      addedComponents, removedComponents, changedComponents },
    added, removed, changed,
    limitations: { nodeMatching: 'Creator serialized node UUID',
      prefabOverrides: 'Scene changes on linked Prefab instances are reported at the instance node; this diff does not infer source Prefab attribution.' } };
}
