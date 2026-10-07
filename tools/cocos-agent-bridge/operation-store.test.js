'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const store = require('./operation-store');

const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-agent-recovery-'));
const operationId = crypto.randomUUID();
const sessionId = crypto.randomUUID();
const assetUuid = crypto.randomUUID();
const nodeName = 'CocosAgentAsset_probe';
const sceneName = 'recovery';
const manifest = { sceneAction: 'apply', assetName: 'probe.png', assetUuid, nodeName };
const phases = Object.fromEntries(['capability', 'preflight', 'editor', 'disk', 'preview', 'recovery'].map((phase) => [phase, 'pending']));
try {
    fs.mkdirSync(path.join(projectRoot, 'assets', 'Scene'), { recursive: true });
    const record = { contractVersion: '0.1', operationId, sessionId, creatorVersion: '2.4.15', projectRoot,
        manifest, sceneName, intent: 'editor-write-sent', receipts: [], phases, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    store.write(projectRoot, record, true);
    assert.notStrictEqual(operationId, sessionId);
    assert.throws(() => store.write(projectRoot, record, true), { code: 'EEXIST' });
    const args = ['bridge-host.js', '--project', projectRoot, '--creator-version', '2.4.15', '--operation-get', operationId];
    const missingDisk = spawnSync(process.execPath, args, { cwd: __dirname, encoding: 'utf8' });
    assert.strictEqual(missingDisk.status, 0, missingDisk.stderr);
    assert.strictEqual(JSON.parse(missingDisk.stdout).data.phases.disk, 'pending');
    fs.writeFileSync(path.join(projectRoot, 'assets', 'Scene', `${sceneName}.fire`), JSON.stringify([
        { __type__: 'cc.Node', _name: nodeName, _parent: { __id__: 1 }, _components: [{ __id__: 2 }] },
        { __type__: 'cc.Node', _name: 'Canvas' },
        { __type__: 'cc.Sprite', _spriteFrame: { __uuid__: assetUuid } },
    ]));
    const first = spawnSync(process.execPath, args, { cwd: __dirname, encoding: 'utf8' });
    assert.strictEqual(first.status, 0, first.stderr);
    const recovered = JSON.parse(first.stdout).data;
    assert.strictEqual(recovered.intent, 'disk-recovered');
    assert.strictEqual(recovered.phases.disk, 'passed');
    assert.strictEqual(recovered.receipts.length, 1);
    const second = spawnSync(process.execPath, args, { cwd: __dirname, encoding: 'utf8' });
    assert.strictEqual(second.status, 0, second.stderr);
    assert.strictEqual(JSON.parse(second.stdout).data.receipts.length, 1);
    process.stdout.write('operation store recovery and idempotent get passed\n');
} finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
}
