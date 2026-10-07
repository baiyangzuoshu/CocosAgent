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
    assert.deepStrictEqual(commands.map((item) => item.id), ['scene.snapshot', 'scene.node.inspect', 'asset.importPng', 'scene.pngSprite']);
    assert.deepStrictEqual(commands.map((item) => item.contractVersion), ['0.1', '0.1', '0.1', '0.1']);
    assert.deepStrictEqual(commands.map((item) => item.access), ['read', 'read', 'write', 'write']);
    assert.ok(isDeepStrictEqual(commands[0].input, inputs.snapshotInput));
    assert.ok(isDeepStrictEqual(commands[1].input, inputs.nodeInspectInput));
    assert.ok(isDeepStrictEqual(commands[2].input, inputs.importPngInput));
    assert.ok(isDeepStrictEqual(commands[3].input, inputs.pngSpriteInput));
    assert.strictEqual(commands[3].status, 'available', version);
    assert.strictEqual(catalog({ sceneName: null, hasCanvas: false })[3].reason, 'NO_OPEN_SCENE');
}
assert.strictEqual(catalog2({ sceneName: 'example', hasCanvas: false })[3].reason, 'CANVAS_NOT_FOUND');
assert.strictEqual(catalog3({ sceneName: 'example', hasCanvas: false })[3].status, 'available');
process.stdout.write('both extension command catalogs match input and status contract\n');
