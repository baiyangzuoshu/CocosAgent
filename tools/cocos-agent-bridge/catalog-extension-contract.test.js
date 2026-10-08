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
    const expectedIds = ['scene.snapshot', 'scene.node.inspect', 'asset.importPng', ...(version === '2.4.15' ? ['asset.removeImportedPng'] : []), 'scene.pngSprite', 'scene.node.create'];
    assert.deepStrictEqual(commands.map((item) => item.id), expectedIds);
    assert.ok(commands.every((item) => item.contractVersion === '0.1'));
    assert.deepStrictEqual(commands.map((item) => item.access), ['read', 'read', 'write', ...(version === '2.4.15' ? ['write'] : []), 'write', 'write']);
    assert.ok(isDeepStrictEqual(commands[0].input, inputs.snapshotInput));
    assert.ok(isDeepStrictEqual(commands[1].input, inputs.nodeInspectInput));
    assert.ok(isDeepStrictEqual(commands[2].input, inputs.importPngInput));
    const offset = version === '2.4.15' ? 1 : 0;
    if (version === '2.4.15') assert.ok(isDeepStrictEqual(commands[3].input, inputs.removeImportedPngInput));
    assert.ok(isDeepStrictEqual(commands[3 + offset].input, version === '2.4.15' ? inputs.pngSpriteInput2x : inputs.pngSpriteInput));
    assert.ok(isDeepStrictEqual(commands[4 + offset].input, version === '2.4.15' ? inputs.nodeCreateInput2x : inputs.nodeCreateInput));
    assert.strictEqual(commands[4 + offset].status, 'available', version);
    assert.strictEqual(catalog({ sceneName: null, hasCanvas: false })[4 + offset].reason, 'NO_OPEN_SCENE');
    assert.strictEqual(commands[3 + offset].status, 'available', version);
    assert.strictEqual(catalog({ sceneName: null, hasCanvas: false })[3 + offset].reason, 'NO_OPEN_SCENE');
}
assert.strictEqual(catalog2({ sceneName: 'example', hasCanvas: true })[3].inputSchema, 'catalog.schema.json#/$defs/removeImportedPngInput');
assert.strictEqual(catalog2({ sceneName: 'example', hasCanvas: true })[4].inputSchema, 'catalog.schema.json#/$defs/pngSpriteInput2x');
assert.strictEqual(catalog3({ sceneName: 'example', hasCanvas: true })[3].inputSchema, 'catalog.schema.json#/$defs/pngSpriteInput');
assert.strictEqual(catalog2({ sceneName: 'example', hasCanvas: true })[5].inputSchema, 'catalog.schema.json#/$defs/nodeCreateInput2x');
assert.strictEqual(catalog3({ sceneName: 'example', hasCanvas: true })[4].inputSchema, 'catalog.schema.json#/$defs/nodeCreateInput');
assert.strictEqual(catalog2({ sceneName: 'example', hasCanvas: false })[4].reason, 'CANVAS_NOT_FOUND');
assert.strictEqual(catalog3({ sceneName: 'example', hasCanvas: false })[3].status, 'available');
process.stdout.write('both extension command catalogs match input and status contract\n');
