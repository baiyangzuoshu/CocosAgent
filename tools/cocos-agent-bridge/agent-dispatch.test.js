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
                ],
            } }) };
        }
        if (args.includes('--operation-get')) {
            return { status: 0, stdout: JSON.stringify({ success: true, data: { operationId, projectRoot, creatorVersion: '3.8.7',
                intent: options.pending ? 'editor-write-sent' : 'disk-verified',
                phases: { editor: options.pending ? 'pending' : 'passed', disk: options.pending ? 'pending' : 'passed', preview: 'pending' },
            } }) };
        }
        return { status: options.executionStatus || 0, stdout: '', stderr: options.executionStatus ? 'interrupted' : '' };
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

fixture = mock({ pending: true, executionStatus: 1 });
result = dispatch(request, fixture.invoke);
assert.strictEqual(result.outcome, 'needs-review');
assert.strictEqual(result.error.code, 'WRITE_OUTCOME_UNCERTAIN');

fixture = mock();
result = dispatch({ ...request, input: { ...request.input, action: 'compensate' } }, fixture.invoke);
assert.strictEqual(result.outcome, 'completed');

process.stdout.write('agent dispatch selection, guards, and receipt decisions passed\n');
