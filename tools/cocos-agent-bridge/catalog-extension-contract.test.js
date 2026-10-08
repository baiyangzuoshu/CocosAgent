'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { isDeepStrictEqual } = require('util');
const inputs = require('./catalog.schema.json').$defs;

function loadCatalog(relativePath) {
    const filename = path.resolve(__dirname, '..', '..', relativePath);
    const module = { exports: {} };
    const localRequire = (name) => name === 'ws' ? {} : require(name);
    const source = `${fs.readFileSync(filename, 'utf8')}\nmodule.exports.testCatalog = commandCatalog;`;
    new Function('require', 'module', 'exports', '__dirname', source)(localRequire, module, module.exports, path.dirname(filename));
    return module.exports.testCatalog;
}

const catalog2 = loadCatalog('2.4.15NewProject/packages/cocos-agent-bridge/main.js');
const catalog3 = loadCatalog('3.8,7NewProject/extensions/cocos-agent-bridge/dist/main.js');
for (const [version, catalog] of [['2.4.15', catalog2], ['3.8.7', catalog3]]) {
    const commands = catalog({ sceneName: 'example', hasCanvas: true });
    const expectedIds = ['scene.snapshot', 'scene.node.inspect', 'asset.importPng', ...(version === '2.4.15' ? ['asset.removeImportedPng', 'asset.validatePng', 'asset.refreshPng'] : []), 'scene.pngSprite', 'scene.node.create'];
    assert.deepStrictEqual(commands.map((item) => item.id), expectedIds);
    assert.ok(commands.every((item) => item.contractVersion === '0.1'));
    assert.deepStrictEqual(commands.map((item) => item.access), ['read', 'read', 'write', ...(version === '2.4.15' ? ['write', 'read', 'write'] : []), 'write', 'write']);
    assert.ok(isDeepStrictEqual(commands[0].input, inputs.snapshotInput));
    assert.ok(isDeepStrictEqual(commands[1].input, inputs.nodeInspectInput));
    assert.ok(isDeepStrictEqual(commands[2].input, inputs.importPngInput));
    if (version === '2.4.15') {
        assert.ok(isDeepStrictEqual(commands.find((item) => item.id === 'asset.removeImportedPng').input, inputs.removeImportedPngInput));
        assert.ok(isDeepStrictEqual(commands.find((item) => item.id === 'asset.validatePng').input, inputs.pipelinePngInput));
        assert.ok(isDeepStrictEqual(commands.find((item) => item.id === 'asset.refreshPng').input, inputs.pipelinePngInput));
        assert.deepStrictEqual(commands.find((item) => item.id === 'asset.validatePng').preconditions, ['pipelineOwnedAsset', 'importedMetadata']);
        assert.deepStrictEqual(commands.find((item) => item.id === 'asset.refreshPng').preconditions, ['pipelineOwnedAsset', 'assetDbMappingStale', 'stableUuid']);
    }
    const spriteCommand = commands.find((item) => item.id === 'scene.pngSprite');
    const nodeCommand = commands.find((item) => item.id === 'scene.node.create');
    assert.ok(isDeepStrictEqual(spriteCommand.input, version === '2.4.15' ? inputs.pngSpriteInput2x : inputs.pngSpriteInput));
    assert.ok(isDeepStrictEqual(nodeCommand.input, version === '2.4.15' ? inputs.nodeCreateInput2x : inputs.nodeCreateInput));
    assert.strictEqual(nodeCommand.status, 'available', version);
    assert.strictEqual(catalog({ sceneName: null, hasCanvas: false }).find((item) => item.id === 'scene.node.create').reason, 'NO_OPEN_SCENE');
    assert.strictEqual(spriteCommand.status, 'available', version);
    assert.strictEqual(catalog({ sceneName: null, hasCanvas: false }).find((item) => item.id === 'scene.pngSprite').reason, 'NO_OPEN_SCENE');
}
assert.strictEqual(catalog2({ sceneName: 'example', hasCanvas: true })[3].inputSchema, 'catalog.schema.json#/$defs/removeImportedPngInput');
assert.strictEqual(catalog2({ sceneName: 'example', hasCanvas: true }).find((item) => item.id === 'scene.pngSprite').inputSchema, 'catalog.schema.json#/$defs/pngSpriteInput2x');
assert.strictEqual(catalog3({ sceneName: 'example', hasCanvas: true }).find((item) => item.id === 'scene.pngSprite').inputSchema, 'catalog.schema.json#/$defs/pngSpriteInput');
assert.strictEqual(catalog2({ sceneName: 'example', hasCanvas: true }).find((item) => item.id === 'scene.node.create').inputSchema, 'catalog.schema.json#/$defs/nodeCreateInput2x');
assert.strictEqual(catalog3({ sceneName: 'example', hasCanvas: true }).find((item) => item.id === 'scene.node.create').inputSchema, 'catalog.schema.json#/$defs/nodeCreateInput');
assert.strictEqual(catalog2({ sceneName: 'example', hasCanvas: false }).find((item) => item.id === 'scene.pngSprite').reason, 'CANVAS_NOT_FOUND');
assert.strictEqual(catalog3({ sceneName: 'example', hasCanvas: false }).find((item) => item.id === 'scene.pngSprite').status, 'available');
process.stdout.write('both extension command catalogs match input and status contract\n');
