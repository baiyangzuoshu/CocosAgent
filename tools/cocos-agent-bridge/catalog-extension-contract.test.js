'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { isDeepStrictEqual } = require('util');
const inputs = require('./catalog.schema.json').$defs;

function loadCatalog(relativePath) {
    const filename = path.resolve(__dirname, '..', '..', relativePath);
    const module = { exports: {} };
    const localRequire = (name) => name === 'ws' ? {} : name.startsWith('./')
        ? require(path.resolve(path.dirname(filename), name)) : require(name);
    const source = `${fs.readFileSync(filename, 'utf8')}\nmodule.exports.testCatalog = commandCatalog;`;
    new Function('require', 'module', 'exports', '__dirname', source)(localRequire, module, module.exports, path.dirname(filename));
    return module.exports.testCatalog;
}

const catalog2 = loadCatalog('2.4.15NewProject/packages/cocos-agent-bridge/main.js');
const catalog3 = loadCatalog('3.8,7NewProject/extensions/cocos-agent-bridge/dist/main.js');
for (const [version, catalog] of [['2.4.15', catalog2], ['3.8.7', catalog3]]) {
    const commands = catalog({ sceneName: 'example', hasCanvas: true, assetDbReady: true, prefabSourcePatchApiReady: true });
    const expectedIds = ['scene.snapshot', 'scene.node.inspect', ...(version === '2.4.15' ? ['asset.searchPng'] : []), 'asset.importPng', ...(version === '2.4.15' ? ['asset.removeImportedPng', 'asset.validatePng', 'asset.refreshPng', 'asset.refreshFolder'] : []), 'scene.pngSprite', 'scene.node.create', ...(version === '2.4.15' ? ['scene.node.patch', 'prefab.source.patch', 'prefab.source.inspect', 'content.stress.run'] : [])];
    assert.deepStrictEqual(commands.map((item) => item.id), expectedIds);
    assert.ok(commands.every((item) => item.contractVersion === '0.1'));
    assert.deepStrictEqual(commands.map((item) => item.access), ['read', 'read', ...(version === '2.4.15' ? ['read'] : []), 'write', ...(version === '2.4.15' ? ['write', 'read', 'write', 'write'] : []), 'write', 'write', ...(version === '2.4.15' ? ['write', 'write', 'read', 'read'] : [])]);
    assert.ok(isDeepStrictEqual(commands[0].input, inputs.snapshotInput));
    assert.ok(isDeepStrictEqual(commands[1].input, inputs.nodeInspectInput));
    assert.ok(isDeepStrictEqual(commands.find((item) => item.id === 'asset.importPng').input, inputs.importPngInput));
    if (version === '2.4.15') {
        const search = commands.find((item) => item.id === 'asset.searchPng');
        assert.ok(isDeepStrictEqual(search.input, inputs.pngAssetSearchInput));
        assert.deepStrictEqual(search.preconditions, ['assetDbReady']);
        assert.equal(search.status, 'available');
        assert.ok(isDeepStrictEqual(commands.find((item) => item.id === 'asset.removeImportedPng').input, inputs.removeImportedPngInput));
        assert.ok(isDeepStrictEqual(commands.find((item) => item.id === 'asset.validatePng').input, inputs.pipelinePngInput));
        assert.ok(isDeepStrictEqual(commands.find((item) => item.id === 'asset.refreshPng').input, inputs.pipelinePngInput));
        assert.ok(isDeepStrictEqual(commands.find((item) => item.id === 'asset.refreshFolder').input, inputs.assetFolderRefreshInput));
        assert.deepStrictEqual(commands.find((item) => item.id === 'asset.validatePng').preconditions, ['pipelineOwnedAsset', 'importedMetadata']);
        assert.deepStrictEqual(commands.find((item) => item.id === 'asset.refreshPng').preconditions, ['pipelineOwnedAsset', 'assetDbMappingStale', 'stableUuid']);
        assert.deepStrictEqual(commands.find((item) => item.id === 'asset.refreshFolder').preconditions, ['folderUnderAssets', 'assetDbRefreshAvailable']);
    }
    const spriteCommand = commands.find((item) => item.id === 'scene.pngSprite');
    const nodeCommand = commands.find((item) => item.id === 'scene.node.create');
    const patchCommand = commands.find((item) => item.id === 'scene.node.patch');
    assert.ok(isDeepStrictEqual(spriteCommand.input, version === '2.4.15' ? inputs.pngSpriteInput2x : inputs.pngSpriteInput));
    assert.ok(isDeepStrictEqual(nodeCommand.input, version === '2.4.15' ? inputs.nodeCreateInput2x : inputs.nodeCreateInput));
    if (version === '2.4.15') {
        assert.ok(isDeepStrictEqual(patchCommand.input, inputs.nodePatchInput2x));
        assert.deepStrictEqual(patchCommand.preconditions, ['activeScene', 'nodePathAndUuidMatch', 'expectedBeforeValues', 'propertyWhitelist', 'resourceReferencesResolvable']);
        assert.strictEqual(patchCommand.status, 'available');
        const prefabPatch = commands.find((item) => item.id === 'prefab.source.patch');
        const prefabInspect = commands.find((item) => item.id === 'prefab.source.inspect');
        assert.ok(isDeepStrictEqual(prefabPatch.input, inputs.prefabSourcePatchInput2x));
        assert.deepStrictEqual(prefabPatch.preconditions, ['activeScene', 'prefabUuidResolvable', 'sourceShaMatches', 'prefabEditModeAvailable', 'nodePathAndUuidMatch', 'expectedBeforeValues']);
        assert.strictEqual(prefabPatch.status, 'available');
        assert.ok(isDeepStrictEqual(prefabInspect.input, inputs.prefabSourceInspectInput2x));
        assert.deepStrictEqual(prefabInspect.preconditions, ['prefabUuidResolvable', 'serializedPrefabReadable']);
        assert.strictEqual(prefabInspect.status, 'available');
        const stress = commands.find((item) => item.id === 'content.stress.run');
        assert.ok(isDeepStrictEqual(stress.input, inputs.contentStressRunInput2x));
        assert.deepStrictEqual(stress.preconditions, ['completedWebMobileBuild', 'packagedPngResources', 'headlessChromeProfile', 'explicitBudgets']);
        assert.strictEqual(stress.access, 'read');
        assert.strictEqual(stress.status, 'available');
        assert.strictEqual(catalog({ sceneName: 'example', hasCanvas: true, assetDbReady: true }).find((item) => item.id === 'prefab.source.patch').reason, 'PREFAB_EDIT_MODE_API_UNAVAILABLE');
    } else {
        assert.strictEqual(patchCommand, undefined, '3.8 must not advertise the 2.4 patch command');
        assert.strictEqual(commands.find((item) => item.id === 'prefab.source.patch'), undefined, '3.8 must not advertise 2.4 Prefab editing');
        assert.strictEqual(commands.find((item) => item.id === 'prefab.source.inspect'), undefined, '3.8 must not advertise 2.4 Prefab inspection');
        assert.strictEqual(commands.find((item) => item.id === 'content.stress.run'), undefined, '3.8 must not advertise the 2.4 runtime diagnostic');
    }
    assert.strictEqual(nodeCommand.status, 'available', version);
    assert.strictEqual(catalog({ sceneName: null, hasCanvas: false }).find((item) => item.id === 'scene.node.create').reason, 'NO_OPEN_SCENE');
    assert.strictEqual(spriteCommand.status, 'available', version);
    assert.strictEqual(catalog({ sceneName: null, hasCanvas: false }).find((item) => item.id === 'scene.pngSprite').reason, 'NO_OPEN_SCENE');
}
assert.strictEqual(catalog2({ sceneName: 'example', hasCanvas: true, assetDbReady: true }).find((item) => item.id === 'asset.removeImportedPng').inputSchema, 'catalog.schema.json#/$defs/removeImportedPngInput');
assert.strictEqual(catalog2({ sceneName: null, hasCanvas: false, assetDbReady: true }).find((item) => item.id === 'asset.searchPng').status, 'available');
assert.strictEqual(catalog2({ sceneName: null, hasCanvas: false, assetDbReady: false }).find((item) => item.id === 'asset.searchPng').reason, 'ASSETDB_UNAVAILABLE');
assert.strictEqual(catalog2({ sceneName: null, hasCanvas: false, assetFolderRefreshReady: true }).find((item) => item.id === 'asset.refreshFolder').status, 'available');
assert.strictEqual(catalog2({ sceneName: null, hasCanvas: false, assetFolderRefreshReady: false }).find((item) => item.id === 'asset.refreshFolder').reason, 'ASSETDB_REFRESH_UNAVAILABLE');
assert.strictEqual(catalog2({ sceneName: 'example', hasCanvas: true, assetDbReady: true }).find((item) => item.id === 'scene.pngSprite').inputSchema, 'catalog.schema.json#/$defs/pngSpriteInput2x');
assert.strictEqual(catalog3({ sceneName: 'example', hasCanvas: true }).find((item) => item.id === 'scene.pngSprite').inputSchema, 'catalog.schema.json#/$defs/pngSpriteInput');
assert.strictEqual(catalog2({ sceneName: 'example', hasCanvas: true, assetDbReady: true }).find((item) => item.id === 'scene.node.create').inputSchema, 'catalog.schema.json#/$defs/nodeCreateInput2x');
assert.strictEqual(catalog3({ sceneName: 'example', hasCanvas: true }).find((item) => item.id === 'scene.node.create').inputSchema, 'catalog.schema.json#/$defs/nodeCreateInput');
assert.strictEqual(catalog2({ sceneName: 'example', hasCanvas: false, assetDbReady: true }).find((item) => item.id === 'scene.pngSprite').reason, 'CANVAS_NOT_FOUND');
assert.strictEqual(catalog3({ sceneName: 'example', hasCanvas: false }).find((item) => item.id === 'scene.pngSprite').status, 'available');
process.stdout.write('both extension command catalogs match input and status contract\n');
