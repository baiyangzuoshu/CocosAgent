'use strict';

const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');
const { handle } = require('./agent-jsonl');
const { dispatch } = require('./agent-dispatch');

const projectRoot = '/tmp/cocos-agent-jsonl-test';
const operationId = '5858dc80-32d0-4610-8291-f057fa13151e';
const request = { id: 7, method: 'operation.get', params: { projectRoot, creatorVersion: '3.8.7', operationId } };
const invoked = [];
const invoke = (script, args) => {
    invoked.push({ script, args });
    return { status: 0, stdout: JSON.stringify({ success: true, data: { operationId, projectRoot, creatorVersion: '3.8.7',
        intent: 'disk-verified', sceneName: 'main', manifest: { sceneAction: 'apply', assetName: 'probe.png',
            nodeName: 'CocosAgentAsset_probe', assetUuid: 'asset-uuid' },
        phases: { disk: 'passed', preview: 'passed' } } }) };
};
const expected = dispatch({ projectRoot, creatorVersion: '3.8.7', operationGetId: operationId }, invoke);
assert.deepStrictEqual(handle(request, { dispatch: (value) => dispatch(value, invoke) }), { id: 7, result: expected });
assert.strictEqual(invoked.length, 2);
assert.deepStrictEqual(invoked[0], invoked[1]);

const invalid = handle({ id: 8, method: 'command.execute', params: { command: 'unknown' } },
    { dispatch: (value) => dispatch(value, invoke) });
assert.strictEqual(invalid.result.error.code, 'INVALID_ARGUMENT');
assert.strictEqual(handle({ id: 9, method: 'arbitrary.script', params: {} }).result.error.code, 'INVALID_ARGUMENT');

const script = path.join(__dirname, 'agent-jsonl.js');
const child = spawnSync(process.execPath, [script], { encoding: 'utf8', input: '{bad json}\n{"id":1,"method":"unknown","params":{}}\n' });
assert.strictEqual(child.status, 0);
assert.deepStrictEqual(child.stdout.trim().split('\n').map(JSON.parse).map((item) => item.result.error.code), ['INVALID_JSON', 'INVALID_ARGUMENT']);
assert.strictEqual(child.stderr, '');
process.stdout.write('JSONL adapter preserves dispatcher envelope and handles malformed requests\n');
