'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { dispatch } = require('./agent-dispatch');
const operationStore = require('./operation-store');

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
                    ...(options.includeAssetSearch ? [{ id: 'asset.searchPng', contractVersion: '0.1', status: 'available', reason: null, access: 'read' }] : []),
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
        const command = args.includes('--asset-search-png') ? 'asset.searchPng' : args.includes('--png') ? 'asset.importPng' : args.includes('--node-path') ? 'scene.node.inspect' : 'scene.snapshot';
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

const searchProject = '/tmp/cocos-agent-dispatch-project-2x-search';
const searchInstance = { ...instance, creatorVersion: '2.4.15', projectRoot: searchProject, activeScene: null };
const searchFixture = mock({ includeAssetSearch: true, instance: searchInstance });
const searchRequest = { targets: [{ creatorVersion: '2.4.15', projectRoot: searchProject }], projectRoot: searchProject,
    creatorVersion: '2.4.15', command: 'asset.searchPng', input: { query: 'smoke', limit: 10, offset: 20 } };
const originalMock = searchFixture.invoke;
const searchInvoke = (script, args) => {
    if (script === 'catalog-host.js' && args.includes('instances.list')) return { status: 0, stdout: JSON.stringify({ success: true, data: [searchInstance] }) };
    if (script === 'catalog-host.js') return { status: 0, stdout: JSON.stringify({ success: true, data: {
        instance: searchInstance, commands: [{ id: 'asset.searchPng', contractVersion: '0.1', status: 'available', reason: null, access: 'read' }],
    } }) };
    return originalMock(script, args);
};
result = dispatch(searchRequest, searchInvoke);
assert.strictEqual(result.outcome, 'completed', JSON.stringify(result));
const searchExecution = searchFixture.calls.find((call) => call.args.includes('--asset-search-png'));
assert(searchExecution, 'search command must reach the bridge host');
assert.deepStrictEqual(searchExecution.args.slice(searchExecution.args.indexOf('--asset-search-png'), searchExecution.args.indexOf('--asset-search-png') + 6),
    ['--asset-search-png', 'smoke', '--asset-search-limit', '10', '--asset-search-offset', '20']);
for (const invalid of [
    { ...searchRequest, creatorVersion: '3.8.7', targets: [{ creatorVersion: '3.8.7', projectRoot: searchProject }] },
    { ...searchRequest, input: { query: 'bad\nquery' } },
    { ...searchRequest, input: { query: 'smoke', limit: 51 } },
]) {
    const invalidFixture = mock({ includeAssetSearch: true, instance: searchInstance });
    assert.strictEqual(dispatch(invalid, invalidFixture.invoke).error.code,
        invalid.creatorVersion === '3.8.7' ? 'COMMAND_UNAVAILABLE' : 'INVALID_ARGUMENT');
    assert.strictEqual(invalidFixture.calls.length, 0, 'invalid search requests must be rejected before instance discovery');
}

const nodeOperationId = '4f89c7a5-40af-44f9-b526-2eb171e2e334';
const spriteFrameUuid = 'd5cce470-1e42-4917-a416-332e905525c0';
const nodeComponents = [{ classId: 'cc.Sprite', spriteFrameUuid }];
const nodeTransform = { position: { x: 12, y: -4 }, scale: { x: 2, y: 3 } };
const nodeInstance = { ...instance, creatorVersion: '2.4.15', projectRoot: '/tmp/cocos-agent-dispatch-project-2x' };
const nodeRecord = { capabilityId: 'scene.node.create', operationId: nodeOperationId, projectRoot: nodeInstance.projectRoot,
    creatorVersion: '2.4.15', createdNodeUuid: '51d83934-8f4a-47b6-99ee-df64a2f36712', intent: 'disk-verified',
    sceneName: 'helloworld', manifest: { action: 'apply', parentPath: 'helloworld/Canvas', parentUuid: 'parent-uuid',
        nodeName: 'P1Probe', components: nodeComponents, transform: nodeTransform },
    phases: { editor: 'passed', disk: 'passed', preview: 'pending' } };
const nodeInvokeCalls = [];
function nodeInvoke(script, args) {
    nodeInvokeCalls.push({ script, args });
    if (script === 'catalog-host.js' && args.includes('instances.list'))
        return { status: 0, stdout: JSON.stringify({ success: true, data: [nodeInstance] }) };
    if (script === 'catalog-host.js') return { status: 0, stdout: JSON.stringify({ success: true, data: {
        instance: nodeInstance, commands: [{ id: 'scene.node.create', contractVersion: '0.1', status: 'available', reason: null }],
    } }) };
    if (args.includes('--operation-get')) return { status: 0, stdout: JSON.stringify({ success: true, data: nodeRecord }) };
    return { status: 0, stdout: `command.result ${JSON.stringify({ command: 'scene.node.create', result: { verified: true } })}\n`, stderr: '' };
}
const nodeRequest = { targets: [{ creatorVersion: '2.4.15', projectRoot: nodeInstance.projectRoot }],
    projectRoot: nodeInstance.projectRoot, creatorVersion: '2.4.15', command: 'scene.node.create',
    input: { parentPath: 'helloworld/Canvas', parentUuid: 'parent-uuid', nodeName: 'P1Probe', action: 'apply',
        operationId: nodeOperationId, components: nodeComponents, transform: nodeTransform } };
result = dispatch(nodeRequest, nodeInvoke);
assert.strictEqual(result.outcome, 'needs-preview');
assert.deepStrictEqual(result.result.components, nodeComponents);
assert(nodeInvokeCalls.some((call) => call.script === 'node-create-host.js' && call.args.includes('--components')
    && call.args.includes(JSON.stringify(nodeComponents)) && call.args.includes('--transform') && call.args.includes(JSON.stringify(nodeTransform))));
assert.strictEqual(dispatch({ ...nodeRequest, input: { ...nodeRequest.input, components: [{ classId: 'cc.Camera' }] } }, nodeInvoke).error.code,
    'INVALID_ARGUMENT');
const labelComponents = [{ classId: 'cc.Label', text: 'P1 label' }];
const labelRecord = { ...nodeRecord, manifest: { ...nodeRecord.manifest, components: labelComponents, transform: {} } };
result = dispatch({ ...nodeRequest, input: { ...nodeRequest.input, components: labelComponents, transform: undefined } },
    (script, args) => script === 'node-create-host.js' && args.includes('--operation-get')
        ? { status: 0, stdout: JSON.stringify({ success: true, data: labelRecord }) }
        : nodeInvoke(script, args));
assert.strictEqual(result.outcome, 'needs-preview');
assert.deepStrictEqual(result.result.components, labelComponents);

const compensatedProject = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-agent-node-compensation-'));
const compensatedOperationId = 'b2765d36-d354-4c6f-ae12-a24f564bb310';
const compensatedRecord = { ...nodeRecord, operationId: compensatedOperationId, projectRoot: compensatedProject,
    manifest: { ...nodeRecord.manifest, action: 'compensate' },
    phases: { editor: 'passed', disk: 'passed', preview: 'skipped', recovery: 'passed' } };
try {
    operationStore.write(compensatedProject, compensatedRecord, true);
    result = dispatch({ projectRoot: compensatedProject, creatorVersion: '2.4.15', operationGetId: compensatedOperationId },
        (script, args) => script === 'node-create-host.js' && args.includes('--operation-get')
            ? { status: 0, stdout: JSON.stringify({ success: true, data: compensatedRecord }) }
            : { status: 1, stdout: '', stderr: 'Unexpected operation status request.' });
    assert.strictEqual(result.outcome, 'completed');
    assert.strictEqual(result.result.action, 'compensate');
    assert.strictEqual(result.phases.preview, 'skipped');
} finally { fs.rmSync(compensatedProject, { recursive: true, force: true }); }

const callsBeforeInvalidSet = nodeInvokeCalls.length;
assert.strictEqual(dispatch({ ...nodeRequest, input: { ...nodeRequest.input,
    components: [...nodeComponents, ...labelComponents] } }, nodeInvoke).error.code, 'INVALID_ARGUMENT');
assert.strictEqual(nodeInvokeCalls.length, callsBeforeInvalidSet, 'invalid component sets are rejected before target discovery');

const removalProject = '/tmp/cocos-agent-removal-project';
const removalInstance = { instanceId, projectRoot: removalProject, creatorVersion: '2.4.15', state: 'ready',
    activeScene: 'helloworld', catalogRevision: 'b'.repeat(64) };
const removalInput = { assetName: 'agent-created.png', textureUuid: 'f0b2e43c-7e8d-4e20-a5d3-a13458cf1c75',
    spriteFrameUuid: 'f0b2e43c-7e8d-4e20-a5d3-a13458cf1c76', sha256: 'a'.repeat(64) };
const removalCalls = [];
const removalInvoke = (script, args) => {
    removalCalls.push({ script, args });
    if (script === 'catalog-host.js' && args.includes('instances.list'))
        return { status: 0, stdout: JSON.stringify({ success: true, data: [removalInstance] }) };
    if (script === 'catalog-host.js') return { status: 0, stdout: JSON.stringify({ success: true, data: {
        instance: removalInstance, commands: [{ id: 'asset.removeImportedPng', contractVersion: '0.1', access: 'write', status: 'available', reason: null }],
    } }) };
    return { status: 0, stdout: `command.result ${JSON.stringify({ command: 'asset.removeImportedPng', result: { ...removalInput, removed: true } })}\n`, stderr: '' };
};
result = dispatch({ targets: [{ creatorVersion: '2.4.15', projectRoot: removalProject }], projectRoot: removalProject,
    creatorVersion: '2.4.15', command: 'asset.removeImportedPng', input: removalInput }, removalInvoke);
assert.strictEqual(result.outcome, 'completed');
assert.deepStrictEqual(removalCalls[2].args.slice(-8), ['--asset-remove', removalInput.assetName,
    '--texture-uuid', removalInput.textureUuid, '--sprite-frame-uuid', removalInput.spriteFrameUuid, '--source-sha256', removalInput.sha256]);
assert.strictEqual(dispatch({ targets: [{ creatorVersion: '3.8.7', projectRoot }], projectRoot, creatorVersion: '3.8.7',
    command: 'asset.removeImportedPng', input: removalInput }, removalInvoke).error.code, 'INVALID_ARGUMENT');
assert.strictEqual(removalCalls.length, 3, '3.8 rejects this 2.4-only capability before editor discovery');

const validationProject = '/tmp/cocos-agent-validation-project';
const validationInstance = { ...removalInstance, projectRoot: validationProject };
const validationPipelineId = '77777777-7777-4777-8777-777777777777';
const validationInput = { assetName: 'probe.png', pipelineId: validationPipelineId };
const validationCalls = [];
let validationCommand = 'asset.validatePng';
const validationInvoke = (script, args) => {
    validationCalls.push({ script, args });
    if (script === 'catalog-host.js' && args.includes('instances.list'))
        return { status: 0, stdout: JSON.stringify({ success: true, data: [validationInstance] }) };
    if (script === 'catalog-host.js') return { status: 0, stdout: JSON.stringify({ success: true, data: {
        instance: validationInstance, commands: [{ id: validationCommand,
            contractVersion: '0.1', access: validationCommand === 'asset.validatePng' ? 'read' : 'write', status: 'available', reason: null }],
    } }) };
    const command = args.includes('--asset-validate') ? 'asset.validatePng' : 'asset.refreshPng';
    const result = command === 'asset.validatePng' ? { status: 'valid' }
        : { status: 'valid', refreshed: true, checks: { filePresent: true, assetDbUrlUuidMatches: true } };
    return { status: 0, stdout: `command.result ${JSON.stringify({ command, result })}\n`, stderr: '' };
};
const validateRequest = { targets: [{ creatorVersion: '2.4.15', projectRoot: validationProject }],
    projectRoot: validationProject, creatorVersion: '2.4.15', command: 'asset.validatePng', input: validationInput };
let validationResult = dispatch(validateRequest, validationInvoke);
assert.equal(validationResult.outcome, 'completed');
assert.deepEqual(validationCalls[2].args.slice(-4), ['--asset-validate', 'probe.png', '--asset-pipeline-id', validationPipelineId]);
validationCalls.length = 0;
validationCommand = 'asset.refreshPng';
validationResult = dispatch({ ...validateRequest, command: 'asset.refreshPng' }, validationInvoke);
assert.equal(validationResult.outcome, 'completed');
assert.deepEqual(validationCalls[2].args.slice(-4), ['--asset-refresh', 'probe.png', '--asset-pipeline-id', validationPipelineId]);
assert.equal(dispatch({ ...validateRequest, creatorVersion: '3.8.7',
    targets: [{ creatorVersion: '3.8.7', projectRoot: validationProject }] }, validationInvoke).error.code, 'INVALID_ARGUMENT');
assert.equal(validationCalls.length, 3, '2.4 validation and refresh are unavailable to 3.8 before instance discovery');

process.stdout.write('agent dispatch selection, guards, and receipt decisions passed\n');
