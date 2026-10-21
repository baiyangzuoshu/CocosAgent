import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';
import { COMMANDS, validateCommand } from '../bridge/contracts.mjs';

const require = createRequire(import.meta.url);
const { scanAssetReferences } = require('../creator-extension/asset-references.cjs');
const uuid = '71a19e64-85c2-4c52-a5b3-87d9f9d7341c';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-asset-references-'));
  const assets = path.join(root, 'assets');
  fs.mkdirSync(assets);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return assets;
}

test('asset reference command accepts only one Creator UUID and is read-only', () => {
  const command = COMMANDS.get('creator.asset.references');
  assert.ok(command);
  assert.equal(command.access, 'read');
  assert.equal(validateCommand(command.id, { assetUuid: uuid }).ok, true);
  assert.equal(validateCommand(command.id, { assetUuid: 'not-a-uuid' }).ok, false);
  assert.equal(validateCommand(command.id, { assetUuid: uuid, path: '/outside' }).code, 'UNKNOWN_INPUT_FIELD');
});

test('asset reference scan finds exact UUID occurrences in text and skips known binary files', (t) => {
  const assets = fixture(t);
  fs.mkdirSync(path.join(assets, 'scenes'));
  fs.writeFileSync(path.join(assets, 'scenes', 'main.fire'), JSON.stringify([{ __uuid__: uuid }, { uuid: uuid.toUpperCase() }]));
  fs.writeFileSync(path.join(assets, 'code.js'), `const texture = '${uuid}';\n`);
  fs.writeFileSync(path.join(assets, 'texture.png'), Buffer.from(uuid, 'utf8'));
  const result = scanAssetReferences(assets, uuid);
  assert.equal(result.complete, true);
  assert.equal(result.referenceCount, 2);
  assert.deepEqual(result.references, [
    { assetPath: 'code.js', occurrences: 1 },
    { assetPath: 'scenes/main.fire', occurrences: 2 },
  ]);
  assert.equal(result.binaryFiles, 1);
});

test('asset reference scan can exclude the target asset and its metadata identity', (t) => {
  const assets = fixture(t);
  fs.writeFileSync(path.join(assets, 'target.png'), Buffer.from('image'));
  fs.writeFileSync(path.join(assets, 'target.png.meta'), JSON.stringify({ uuid }));
  fs.writeFileSync(path.join(assets, 'scene.fire'), JSON.stringify([{ __uuid__: uuid }]));
  const result = scanAssetReferences(assets, uuid, { ignorePaths: ['target.png', 'target.png.meta'] });
  assert.equal(result.complete, true);
  assert.deepEqual(result.references, [{ assetPath: 'scene.fire', occurrences: 1 }]);
});

test('asset reference scan reports bounded or symlinked scans as incomplete', (t) => {
  const assets = fixture(t);
  fs.writeFileSync(path.join(assets, 'a.json'), `{"ref":"${uuid}"}`);
  fs.writeFileSync(path.join(assets, 'b.json'), '{"other":true}');
  const bounded = scanAssetReferences(assets, uuid, { maxFiles: 1 });
  assert.equal(bounded.complete, false);
  assert.ok(bounded.scannedFiles >= 1);
  const linked = path.join(assets, 'external-link');
  try { fs.symlinkSync(os.tmpdir(), linked, 'dir'); }
  catch (error) { if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return; throw error; }
  const symlinked = scanAssetReferences(assets, uuid);
  assert.equal(symlinked.complete, false);
  assert.equal(symlinked.references.some((item) => item.assetPath.startsWith('external-link/')), false);
});

test('asset reference scan rejects missing targets and invalid UUID inputs', (t) => {
  const assets = fixture(t);
  assert.throws(() => scanAssetReferences(assets, '../invalid'), { code: 'ASSET_REFERENCE_INPUT_INVALID' });
  assert.throws(() => scanAssetReferences(path.join(assets, 'missing'), uuid), { code: 'ASSET_REFERENCE_ROOT_UNAVAILABLE' });
});
