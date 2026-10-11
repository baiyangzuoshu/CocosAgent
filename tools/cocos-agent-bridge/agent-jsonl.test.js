'use strict';

const assert = require('assert');
const { spawnSync } = require('child_process');
const test = require('node:test');
const path = require('path');
const { handle, handleAsync, catalog } = require('./agent-jsonl');
const { dispatch } = require('./agent-dispatch');

const projectRoot = '/tmp/cocos-agent-jsonl-test';
const operationId = '5858dc80-32d0-4610-8291-f057fa13151e';
const mcpRuntime = { version: '0.2.0', agentPackageVersion: '0.3.0', agentPackageFingerprint: 'c'.repeat(64),
    sourceFingerprint: 'a'.repeat(64), contractSchemaFingerprint: 'b'.repeat(64) };
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

test('catalog forwards the MCP process fingerprint to the Host for runtime alignment checks', () => {
    let args;
    const response = catalog({ id: 20, method: 'instances.list', params: {
        targets: [{ creatorVersion: '2.4.15', projectRoot }], mcpRuntime,
    } }, (_executable, values) => {
        args = values;
        return { status: 0, stdout: JSON.stringify({ success: true, data: [] }) };
    });
    assert.deepStrictEqual(response, { success: true, data: [] });
    const index = args.indexOf('--mcp-runtime');
    assert.notEqual(index, -1);
    assert.deepStrictEqual(JSON.parse(args[index + 1]), mcpRuntime);
});

const invalid = handle({ id: 8, method: 'command.execute', params: { command: 'unknown' } },
    { dispatch: (value) => dispatch(value, invoke) });
assert.strictEqual(invalid.result.error.code, 'INVALID_ARGUMENT');
assert.strictEqual(handle({ id: 9, method: 'arbitrary.script', params: {} }).result.error.code, 'INVALID_ARGUMENT');
assert.deepStrictEqual(handle({ id: 10, method: 'workflow.plan', params: { steps: [] } },
    { workflow: (method, params) => ({ method, params }) }),
{ id: 10, result: { method: 'workflow.plan', params: { steps: [] } } });
assert.deepStrictEqual(handle({ id: 11, method: 'assets.batch.get', params: { batchId: operationId } },
    { assetBatch: (method, params) => ({ method, params }) }),
{ id: 11, result: { method: 'assets.batch.get', params: { batchId: operationId } } });
assert.deepStrictEqual(handle({ id: 12, method: 'scene.sprites.plan', params: { creatorVersion: '2.4.15' } },
    { sceneSpriteBatch: (method, params) => ({ method, params }) }),
{ id: 12, result: { method: 'scene.sprites.plan', params: { creatorVersion: '2.4.15' } } });
assert.deepStrictEqual(handle({ id: 14, method: 'assets.scene.execute', params: { creatorVersion: '2.4.15' } },
    { assetScenePipeline: (method, params) => ({ method, params }) }),
{ id: 14, result: { method: 'assets.scene.execute', params: { creatorVersion: '2.4.15' } } });
assert.deepStrictEqual(handle({ id: 15, method: 'assets.scene.validate', params: { creatorVersion: '2.4.15', pipelineId: operationId } },
    { assetSceneValidate: (params) => ({ method: 'validate', params }) }),
{ id: 15, result: { method: 'validate', params: { creatorVersion: '2.4.15', pipelineId: operationId } } });
assert.deepStrictEqual(handle({ id: 16, method: 'assets.scene.repair', params: { creatorVersion: '2.4.15', pipelineId: operationId } },
    { assetSceneRepair: (params) => ({ method: 'repair', params }) }),
{ id: 16, result: { method: 'repair', params: { creatorVersion: '2.4.15', pipelineId: operationId } } });
assert.deepStrictEqual(handle({ id: 18, method: 'content.bundle.plan', params: { creatorVersion: '2.4.15', bundleName: 'sample' } },
    { contentBundleRelease: (method, params) => ({ method, params }) }),
{ id: 18, result: { method: 'content.bundle.plan', params: { creatorVersion: '2.4.15', bundleName: 'sample' } } });
assert.deepStrictEqual(handle({ id: 19, method: 'content.bundle.dependencies.plan', params: { creatorVersion: '2.4.15' } },
    { contentBundleDependencies: (method, params) => ({ method, params }) }),
{ id: 19, result: { method: 'content.bundle.dependencies.plan', params: { creatorVersion: '2.4.15' } } });
assert.deepStrictEqual(handle({ id: 13, method: 'operation.reconcile', params: { projectRoot, creatorVersion: '2.4.15',
    operationId, targets: [{ projectRoot, creatorVersion: '2.4.15' }] } },
{ dispatch: (value) => value }), { id: 13, result: { targets: [{ projectRoot, creatorVersion: '2.4.15' }], projectRoot,
    creatorVersion: '2.4.15', operationReconcileId: operationId } });

const script = path.join(__dirname, 'agent-jsonl.js');
const child = spawnSync(process.execPath, [script], { encoding: 'utf8', input: '{bad json}\n{"id":1,"method":"unknown","params":{}}\n' });
assert.strictEqual(child.status, 0);
assert.deepStrictEqual(child.stdout.trim().split('\n').map(JSON.parse).map((item) => item.result.error.code), ['INVALID_JSON', 'INVALID_ARGUMENT']);
assert.strictEqual(child.stderr, '');
process.stdout.write('JSONL adapter preserves dispatcher envelope and handles malformed requests\n');

test('JSONL async adapter awaits preview lifecycle methods without changing synchronous dispatch', async () => {
    const calls = [];
    const response = await handleAsync({ id: 17, method: 'content.preview.start', params: { buildId: 'build-01' } }, {
        contentPreview: async (method, params) => { calls.push({ method, params }); return { success: true, outcome: 'ready' }; },
    });
    assert.deepStrictEqual(response, { id: 17, result: { success: true, outcome: 'ready' } });
    assert.deepStrictEqual(calls, [{ method: 'content.preview.start', params: { buildId: 'build-01' } }]);
});
