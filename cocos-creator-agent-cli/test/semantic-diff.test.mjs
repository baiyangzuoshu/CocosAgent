import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { diffSceneSnapshots, diffSceneSnapshotFiles, readSceneSnapshotFile } from '../semantic-diff.mjs';

const root = (fields = {}) => ({ sceneUuid: 'scene-1', sceneName: 'Tank', available: true, truncated: false,
  nodes: [{ uuid: 'root', name: 'Canvas', path: 'Canvas', parentUuid: null, active: true, children: 1,
    transform: { x: 0, y: 0 }, components: [], componentDetails: [] },
  { uuid: 'button', name: 'Button', path: 'Canvas/Button', parentUuid: 'root', active: true, children: 0,
    transform: { x: 10, y: 20 }, components: ['cc.Button', 'game.State'], componentDetails: [
      { index: 0, className: 'cc.Button', properties: {}, clickEvents: [] },
      { index: 1, className: 'game.State', properties: { sprite: { assetUuid: 'sprite-1', assetClass: 'cc.SpriteFrame' } } },
    ] }], ...fields });

test('semantic scene diff detects node additions, removals, hierarchy, transforms, component values and asset references', () => {
  const before = root();
  const after = root({ nodes: [
    { uuid: 'root', name: 'Canvas', path: 'Canvas', parentUuid: null, active: true, children: 1,
      transform: { x: 0, y: 0 }, components: [], componentDetails: [] },
    { uuid: 'button', name: 'ActionButton', path: 'Canvas/ActionButton', parentUuid: 'root', active: false, children: 0,
      transform: { x: 40, y: 20 }, components: ['cc.Button', 'game.State'], componentDetails: [
        { index: 0, className: 'cc.Button', properties: {}, clickEvents: [
          { targetUuid: 'button', component: 'game.State', handler: 'onClick', customEventData: 'toggle' },
        ] },
        { index: 1, className: 'game.State', properties: { sprite: { assetClass: 'cc.SpriteFrame', assetUuid: 'sprite-2' } } },
      ] },
    { uuid: 'label', name: 'Label', path: 'Canvas/Label', parentUuid: 'root', active: true, children: 0,
      transform: {}, components: ['cc.Label'], componentDetails: [] },
  ] });
  const diff = diffSceneSnapshots(before, after);
  assert.deepEqual(diff.counts, { before: 2, after: 3, added: 1, removed: 0, changed: 1 });
  assert.equal(diff.added[0].uuid, 'label');
  assert.equal(diff.changed[0].uuid, 'button');
  assert.equal(diff.changed[0].changes.active.before, true);
  assert.equal(diff.changed[0].changes.transform.after.x, 40);
  assert.equal(diff.changed[0].changes.componentDetails.after[0].clickEvents[0].handler, 'onClick');
  assert.equal(diff.changed[0].changes.componentDetails.after[1].properties.sprite.assetUuid, 'sprite-2');

  const removed = diffSceneSnapshots(after, before);
  assert.equal(removed.removed[0].uuid, 'label');
  assert.equal(removed.changed[0].uuid, 'button');
});

test('semantic diff keys by stable UUID and ignores object-key order', () => {
  const before = root();
  const after = root({ nodes: [...before.nodes].reverse().map((node) => ({ ...node,
    componentDetails: node.componentDetails.map((item) => ({ ...item,
      properties: Object.fromEntries(Object.entries(item.properties).reverse()) })) })) });
  const diff = diffSceneSnapshots(before, after);
  assert.equal(diff.counts.changed, 0);
  assert.equal(diff.counts.added, 0);
  assert.equal(diff.counts.removed, 0);
});

test('semantic diff rejects mismatched scenes, truncated snapshots and duplicate UUIDs', () => {
  assert.throws(() => diffSceneSnapshots(root(), root({ sceneUuid: 'scene-2' })), /SCENE_IDENTITY_MISMATCH/);
  assert.throws(() => diffSceneSnapshots(root({ truncated: true }), root()), /TRUNCATED/);
  assert.throws(() => diffSceneSnapshots(root(), root({ nodes: [root().nodes[0], root().nodes[0]] })), /NODE_IDENTITY_INVALID/);
});

test('snapshot file diff records exact file hashes and refuses symlinks', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-scene-diff-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const beforePath = path.join(directory, 'before.json');
  const afterPath = path.join(directory, 'after.json');
  fs.writeFileSync(beforePath, `${JSON.stringify(root())}\n`);
  fs.writeFileSync(afterPath, `${JSON.stringify(root({ sceneName: 'TankScene' }))}\n`);
  const loaded = readSceneSnapshotFile(beforePath);
  assert.equal(loaded.path, beforePath);
  assert.match(loaded.sha256, /^[0-9a-f]{64}$/);
  const result = diffSceneSnapshotFiles(beforePath, afterPath);
  assert.equal(result.diff.scene.nameChanged, true);
  assert.equal(result.diff.counts.changed, 0);
  const symlink = path.join(directory, 'linked.json');
  fs.symlinkSync(beforePath, symlink);
  assert.throws(() => readSceneSnapshotFile(symlink), /SNAPSHOT_FILE_UNSAFE/);
});
