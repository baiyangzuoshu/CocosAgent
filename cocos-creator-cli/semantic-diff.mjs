import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;
const MAX_NODES = 100;
const SEMANTIC_FIELDS = ['name', 'path', 'parentUuid', 'active', 'transform', 'components', 'componentDetails'];

function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

function stableJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
}

export function diffSceneSnapshots(before, after) {
  for (const [label, snapshot] of [['before', before], ['after', after]]) {
    if (!snapshot || typeof snapshot !== 'object' || snapshot.available !== true
      || typeof snapshot.sceneUuid !== 'string' || !Array.isArray(snapshot.nodes)
      || snapshot.nodes.length > MAX_NODES || snapshot.truncated === true) {
      throw new Error(`SCENE_SNAPSHOT_${label.toUpperCase()}_INVALID_OR_TRUNCATED`);
    }
  }
  if (before.sceneUuid !== after.sceneUuid) throw new Error('SCENE_IDENTITY_MISMATCH');

  const indexNodes = (snapshot, label) => {
    const rows = new Map();
    for (const node of snapshot.nodes) {
      if (!node || typeof node.uuid !== 'string' || !node.uuid || rows.has(node.uuid))
        throw new Error(`SCENE_SNAPSHOT_${label.toUpperCase()}_NODE_IDENTITY_INVALID`);
      rows.set(node.uuid, node);
    }
    return rows;
  };
  const beforeNodes = indexNodes(before, 'before');
  const afterNodes = indexNodes(after, 'after');
  const added = [];
  const removed = [];
  const changed = [];

  for (const [uuid, node] of afterNodes) {
    const previous = beforeNodes.get(uuid);
    if (!previous) {
      added.push({ uuid, name: node.name || null, path: node.path || null,
        parentUuid: node.parentUuid || null, active: node.active !== false,
        transform: node.transform || {}, components: node.components || [],
        componentDetails: node.componentDetails || [] });
      continue;
    }
    const fields = {};
    for (const field of SEMANTIC_FIELDS) {
      const oldValue = previous[field] === undefined ? null : previous[field];
      const newValue = node[field] === undefined ? null : node[field];
      if (stableJson(oldValue) !== stableJson(newValue)) fields[field] = { before: oldValue, after: newValue };
    }
    if (Object.keys(fields).length) changed.push({ uuid, changes: fields });
  }
  for (const [uuid, node] of beforeNodes) {
    if (!afterNodes.has(uuid)) removed.push({ uuid, name: node.name || null, path: node.path || null,
      parentUuid: node.parentUuid || null, active: node.active !== false,
      transform: node.transform || {}, components: node.components || [],
      componentDetails: node.componentDetails || [] });
  }
  const sortUuid = (left, right) => left.uuid.localeCompare(right.uuid);
  added.sort(sortUuid); removed.sort(sortUuid); changed.sort(sortUuid);
  return {
    scene: { uuid: before.sceneUuid, nameBefore: before.sceneName || null, nameAfter: after.sceneName || null,
      nameChanged: (before.sceneName || null) !== (after.sceneName || null) },
    counts: { before: beforeNodes.size, after: afterNodes.size,
      added: added.length, removed: removed.length, changed: changed.length },
    added, removed, changed,
  };
}

export function readSceneSnapshotFile(filename) {
  if (typeof filename !== 'string' || !filename) throw new Error('SNAPSHOT_PATH_REQUIRED');
  const absolute = path.resolve(filename);
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > MAX_SNAPSHOT_BYTES)
    throw new Error('SNAPSHOT_FILE_UNSAFE_OR_TOO_LARGE');
  const bytes = fs.readFileSync(absolute);
  let snapshot;
  try { snapshot = JSON.parse(bytes.toString('utf8')); }
  catch (_) { throw new Error('SNAPSHOT_JSON_INVALID'); }
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error('SNAPSHOT_JSON_INVALID');
  return { path: absolute, sha256: sha256(bytes), snapshot };
}

export function diffSceneSnapshotFiles(beforePath, afterPath) {
  const before = readSceneSnapshotFile(beforePath);
  const after = readSceneSnapshotFile(afterPath);
  return { before: { path: before.path, sha256: before.sha256 },
    after: { path: after.path, sha256: after.sha256 },
    diff: diffSceneSnapshots(before.snapshot, after.snapshot) };
}
