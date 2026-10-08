'use strict';

const assert = require('assert');
const { dispatch } = require('./agent-dispatch');

const projectRoot = '/tmp/cocos-agent-dispatch-project';
const instanceId = 'dfc80898-3a3b-4ac1-8d28-bc6df6515c88';
const operationId = '5858dc80-32d0-4610-8291-f057fa13151e';
const instance = { instanceId, projectRoot, creatorVersion: '3.8.7', state: 'ready', activeScene: 'main', catalogRevision: 'a'.repeat(64) };
const request = { targets: [{ creatorVersion: '3.8.7', projectRoot }], projectRoot, creatorVersion: '3.8.7',
    command: 'scene.pngSprite', input: { assetName: 'probe.png', action: 'apply', operationId } };

function mock(options = {}) {
    const calls = [];
    const invoke = (script, args) => {
        calls.push({ script, args });
        if (script === 'catalog-host.js' && args.includes('instances.list')) {
            return { status: 0, stdout: JSON.stringify({ success: true, data: [instance] }) };
        }
        if (script === 'catalog-host.js') {
            return { status: 0, stdout: JSON.stringify({ success: true, data: {
                instance: { ...instance, ...(options.changedInstance || {}) }, commands: [
                    { id: 'scene.pngSprite', contractVersion: '0.1', status: options.unavailable ? 'unavailable' : 'available', reason: options.unavailable ? 'NO_OPEN_SCENE' : null },
                    { id: 'scene.snapshot', contractVersion: '0.1', status: 'available', reason: null },
                    { id: 'scene.node.inspect', contractVersion: '0.1', status: 'available', reason: null, access: 'read' },
                    { id: 'asset.importPng', contractVersion: '0.1', status: 'available', reason: null },
                ],
            } }) };
        }
        if (args.includes('--operation-get')) {
            return { status: 0, stdout: JSON.stringify({ success: true, data: { operationId, projectRoot, creatorVersion: '3.8.7',
                intent: options.pending ? 'editor-write-sent' : 'disk-verified',
                sceneName: 'main', manifest: { sceneAction: 'apply', assetName: 'probe.png', nodeName: 'CocosAgentAsset_probe', assetUuid: 'asset-uuid' },
                phases: { editor: options.pending ? 'pending' : 'passed', disk: options.pending ? 'pending' : 'passed', preview: options.previewPassed ? 'passed' : 'pending' },
            } }) };
        }
        const command = args.includes('--png') ? 'asset.importPng' : args.includes('--node-path') ? 'scene.node.inspect' : 'scene.snapshot';
        return { status: options.executionStatus || 0,
            stdout: args.includes('--scene-asset') ? '' : `command.result ${JSON.stringify({ command, result: { verified: true } })}\n`,
            stderr: options.executionStatus ? 'interrupted' : '' };
    };
    return { calls, invoke };
}

let fixture = mock();
let result = dispatch(request, fixture.invoke);
assert.strictEqual(result.outcome, 'needs-preview', JSON.stringify(result));
assert.strictEqual(fixture.calls.length, 4);
assert(fixture.calls[2].args.includes('--expected-instance-id'));
assert(fixture.calls[2].args.includes(instanceId));
assert(fixture.calls[2].args.includes('--expected-scene'));
assert(fixture.calls[2].args.includes('main'));

fixture = mock({ changedInstance: { instanceId: 'another-instance' } });
result = dispatch(request, fixture.invoke);
assert.strictEqual(result.error.code, 'CATALOG_CHANGED');
assert.strictEqual(fixture.calls.length, 2);

fixture = mock({ unavailable: true });
result = dispatch(request, fixture.invoke);
assert.strictEqual(result.error.code, 'COMMAND_UNAVAILABLE');
assert.strictEqual(fixture.calls.length, 2);

fixture = mock();
result = dispatch({ ...request, input: { ...request.input, position: { x: 64, y: 0 } } }, fixture.invoke);
assert.strictEqual(result.error.code, 'INVALID_ARGUMENT');
assert.strictEqual(fixture.calls.length, 0, '3.8 must reject the 2.4-only position input before target discovery');

fixture = mock({ pending: true, executionStatus: 1 });
result = dispatch(request, fixture.invoke);
assert.strictEqual(result.outcome, 'needs-review');
assert.strictEqual(result.error.code, 'WRITE_OUTCOME_UNCERTAIN');

fixture = mock();
result = dispatch({ ...request, input: { ...request.input, action: 'compensate' } }, fixture.invoke);
assert.strictEqual(result.outcome, 'completed');

fixture = mock({ previewPassed: true });
result = dispatch({ projectRoot, creatorVersion: '3.8.7', operationGetId: operationId }, fixture.invoke);
assert.strictEqual(result.outcome, 'completed');
assert.strictEqual(result.result.action, 'apply');
assert.strictEqual(result.error, null);
assert.strictEqual(fixture.calls.length, 1);

for (const [command, input] of [['scene.snapshot', {}], ['scene.node.inspect', { nodePath: 'main/Canvas' }], ['asset.importPng', { sourcePath: '/tmp/probe.png' }]]) {
    fixture = mock();
    result = dispatch({ ...request, command, input }, fixture.invoke);
    assert.strictEqual(result.outcome, 'completed');
    assert.strictEqual(result.result.verified, true);
    assert.strictEqual(result.operationId, null);
    assert.strictEqual(result.error, null);
}

process.stdout.write('agent dispatch selection, guards, and receipt decisions passed\n');
