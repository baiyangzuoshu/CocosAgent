'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { dispatch } = require('./agent-dispatch');
const operationStore = require('./operation-store');

const projectRoot = path.resolve(os.tmpdir(), 'cocos-agent-dispatch-project');
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

for (const [command, input] of [['scene.snapshot', {}], ['scene.node.inspect', { nodePath: 'main/Canvas' }], ['asset.importPng', { sourcePath: path.resolve(os.tmpdir(), 'probe.png') }]]) {
    fixture = mock();
    result = dispatch({ ...request, command, input }, fixture.invoke);
    assert.strictEqual(result.outcome, 'completed');
    assert.strictEqual(result.result.verified, true);
    assert.strictEqual(result.operationId, null);
    assert.strictEqual(result.error, null);
}

const searchProject = path.resolve(os.tmpdir(), 'cocos-agent-dispatch-project-2x-search');
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
const nodeInstance = { ...instance, creatorVersion: '2.4.15', projectRoot: path.resolve(os.tmpdir(), 'cocos-agent-dispatch-project-2x') };
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
const prefabUuid = 'a95b3432-8b0f-41a5-83d7-4485249126b5';
const prefabInput = { ...nodeRequest.input, components: undefined, transform: { position: { x: 32, y: -16 } },
    prefabMode: 'instantiate', prefabUuid };
result = dispatch({ ...nodeRequest, input: prefabInput }, nodeInvoke);
assert.strictEqual(result.outcome, 'needs-preview');
assert(nodeInvokeCalls.some((call) => call.script === 'node-create-host.js' && call.args.includes('--prefab-mode')
    && call.args.includes('instantiate') && call.args.includes('--prefab-uuid') && call.args.includes(prefabUuid)));
assert.strictEqual(dispatch({ ...nodeRequest, input: { ...prefabInput, prefabUuid: undefined } }, nodeInvoke).error.code, 'INVALID_ARGUMENT');
assert.strictEqual(dispatch({ ...nodeRequest, input: { ...nodeRequest.input, prefabMode: 'create', prefabUuid } }, nodeInvoke).error.code, 'INVALID_ARGUMENT');
assert.strictEqual(dispatch({ ...request, input: { ...request.input, prefabMode: 'instantiate', prefabUuid } }, mock().invoke).error.code, 'INVALID_ARGUMENT');
assert.strictEqual(dispatch({ ...nodeRequest, input: { ...nodeRequest.input, components: [{ classId: 'cc.Camera' }] } }, nodeInvoke).error.code,
    'INVALID_ARGUMENT');
const stressProject = '/tmp/cocos-agent-dispatch-performance-2x';
const stressInstance = { ...instance, creatorVersion: '2.4.15', projectRoot: stressProject, activeScene: 'helloworld' };
const stressInput = { buildId: 'p1-web-20261009', resourcePaths: ['RedReleaseOct09', 'BlueReleaseOct09'],
    parseFixturePaths: ['cocos-agent-batch-red', 'cocos-agent-batch-blue'], failureResourcePath: 'cocos-agent-batch-blue',
    cycles: 96, nodeCount: 512, packable: true,
    profileId: 'macos-arm64-chrome-headless-swiftshader-1280x800',
    loadMode: 'cold-and-warm', budgetProfileId: 'macos-arm64-headless-swiftshader-host-screening-v1',
    budgets: { targetFps: 30, maxColdResourceLoadP95Ms: 150, maxWarmResourceLoadP95Ms: 10,
        maxImportParserP95Ms: 30, maxPngParserP95Ms: 60, maxReleaseCallP95Ms: 8,
        maxEstimatedRgbaWorkingSetBytes: 33554432 } };
const stressCalls = [];
const stressInvoke = (script, args) => {
    stressCalls.push({ script, args });
    if (script === 'catalog-host.js' && args.includes('instances.list'))
        return { status: 0, stdout: JSON.stringify({ success: true, data: [stressInstance] }) };
    if (script === 'catalog-host.js') return { status: 0, stdout: JSON.stringify({ success: true, data: {
        instance: stressInstance, commands: [{ id: 'content.stress.run', contractVersion: '0.2', access: 'read', status: 'available', reason: null }],
    } }) };
    return { status: 0, stdout: `command.result ${JSON.stringify({ command: 'content.stress.run', result: { acceptance: { success: true } } })}\n` };
};
const stressRequest = { targets: [{ creatorVersion: '2.4.15', projectRoot: stressProject }], projectRoot: stressProject,
    creatorVersion: '2.4.15', command: 'content.stress.run', input: stressInput };
result = dispatch(stressRequest, stressInvoke);
assert.strictEqual(result.outcome, 'completed');
assert.deepStrictEqual(result.result.acceptance, { success: true });
const stressExecution = stressCalls.find((call) => call.script === 'content-stress-host.js');
assert(stressExecution, 'diagnostic command must route to its local host runner');
assert.deepStrictEqual(JSON.parse(stressExecution.args[stressExecution.args.indexOf('--input') + 1]), stressInput);
for (const invalid of [
    { ...stressInput, resourcePaths: ['same', 'same'] },
    { ...stressInput, cycles: 8, resourcePaths: Array.from({ length: 8 }, (_, index) => `asset-${index}`) },
    { ...stressInput, budgets: { targetFps: 30 } },
]) assert.strictEqual(dispatch({ ...stressRequest, input: invalid }, stressInvoke).error.code, 'INVALID_ARGUMENT');
assert.strictEqual(dispatch({ ...stressRequest, creatorVersion: '3.8.7', targets: [{ creatorVersion: '3.8.7', projectRoot: stressProject }] }, stressInvoke).error.code,
    'COMMAND_UNAVAILABLE');
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

const patchProject = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-agent-dispatch-patch-'));
const patchInstance = { ...instance, projectRoot: patchProject, creatorVersion: '2.4.15' };
const patchOperationId = 'b6e210b5-8cd8-4955-b4a5-4df1710b5d91';
const patchDiff = [{ path: 'node.position.x', before: 0, after: 12 }];
const patchRecord = { capabilityId: 'scene.node.patch', operationId: patchOperationId, projectRoot: patchProject,
    creatorVersion: '2.4.15', intent: 'disk-verified', sceneName: 'helloworld',
    manifest: { action: 'apply', targetNodePath: 'helloworld/Canvas/Probe',
        targetNodeUuid: 'f8caa20c-2e39-4c1d-8aeb-03cc9b0b505d', expectedDiff: patchDiff },
    phases: { editor: 'passed', disk: 'passed', recovery: 'pending' } };
operationStore.write(patchProject, patchRecord, true);
const patchCalls = [];
const patchInvoke = (script, args) => {
    patchCalls.push({ script, args });
    if (script === 'catalog-host.js' && args.includes('instances.list'))
        return { status: 0, stdout: JSON.stringify({ success: true, data: [patchInstance] }) };
    if (script === 'catalog-host.js') return { status: 0, stdout: JSON.stringify({ success: true, data: {
        instance: patchInstance, commands: [{ id: 'scene.node.patch', contractVersion: '0.1', status: 'available', reason: null }],
    } }) };
    if (script === 'scene-node-patch-host.js' && args.includes('--operation-get'))
        return { status: 0, stdout: JSON.stringify({ success: true, data: patchRecord }) };
    return { status: 0, stdout: `command.result ${JSON.stringify({ command: 'scene.node.patch', result: { verified: true } })}\n` };
};
const patchRequest = { targets: [{ creatorVersion: '2.4.15', projectRoot: patchProject }], projectRoot: patchProject,
    creatorVersion: '2.4.15', command: 'scene.node.patch', input: { targetNodePath: patchRecord.manifest.targetNodePath,
        targetNodeUuid: patchRecord.manifest.targetNodeUuid, action: 'apply', expectedDiff: patchDiff, operationId: patchOperationId } };
result = dispatch(patchRequest, patchInvoke);
assert.strictEqual(result.outcome, 'needs-preview', JSON.stringify(result));
assert.deepStrictEqual(result.result.expectedDiff, patchDiff);
assert(patchCalls.some((call) => call.script === 'scene-node-patch-host.js' && call.args.includes('--expected-diff')
    && call.args.includes(JSON.stringify(patchDiff))));
const patchInvalidCalls = patchCalls.length;
assert.strictEqual(dispatch({ ...patchRequest, creatorVersion: '3.8.7', targets: [{ creatorVersion: '3.8.7', projectRoot: patchProject }] }, patchInvoke).error.code,
    'INVALID_ARGUMENT');
assert.strictEqual(patchCalls.length, patchInvalidCalls, '2.4-only scene patch must be rejected before discovery on 3.8');
result = dispatch({ projectRoot: patchProject, creatorVersion: '2.4.15', operationGetId: patchOperationId }, patchInvoke);
assert.strictEqual(result.command, 'scene.node.patch');
assert.strictEqual(result.outcome, 'needs-preview');
patchRecord.phases.preview = 'passed';
result = dispatch({ projectRoot: patchProject, creatorVersion: '2.4.15', operationGetId: patchOperationId }, patchInvoke);
assert.strictEqual(result.outcome, 'completed');
assert(patchCalls.some((call) => call.script === 'scene-node-patch-host.js' && call.args.includes('--operation-get')));
fs.rmSync(patchProject, { recursive: true, force: true });

const prefabProject = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-agent-dispatch-prefab-'));
const prefabInstance = { ...instance, projectRoot: prefabProject, creatorVersion: '2.4.15' };
const sourcePrefabUuid = '33333333-3333-4333-8333-333333333333';
const prefabOperationId = 'c5b0eb39-1b83-4e80-bce8-dc0ac7c9a004';
const prefabDiff = [{ path: 'node.position.x', before: 0, after: 24 }];
const prefabRecord = { capabilityId: 'prefab.source.patch', operationId: prefabOperationId, projectRoot: prefabProject,
    creatorVersion: '2.4.15', intent: 'disk-verified', beforeSha256: 'a'.repeat(64), afterSha256: 'b'.repeat(64),
    manifest: { action: 'apply', prefabUuid: sourcePrefabUuid, prefabUrl: 'db://assets/Agent.prefab', targetNodePath: 'AgentPrefab/Badge',
        targetNodeUuid: 'AgentNode_01', expectedDiff: prefabDiff },
    phases: { capability: 'passed', preflight: 'passed', editor: 'passed', disk: 'passed', preview: 'skipped', recovery: 'pending' } };
operationStore.write(prefabProject, prefabRecord, true);
const prefabCalls = [];
const prefabInvoke = (script, args) => {
    prefabCalls.push({ script, args });
    if (script === 'catalog-host.js' && args.includes('instances.list'))
        return { status: 0, stdout: JSON.stringify({ success: true, data: [prefabInstance] }) };
    if (script === 'catalog-host.js') return { status: 0, stdout: JSON.stringify({ success: true, data: {
        instance: prefabInstance, commands: [
            { id: 'prefab.source.patch', contractVersion: '0.1', status: 'available', reason: null },
            { id: 'prefab.source.inspect', contractVersion: '0.1', status: 'available', reason: null },
        ],
    } }) };
    if (script === 'prefab-source-patch-host.js' && args.includes('--operation-get'))
        return { status: 0, stdout: JSON.stringify({ success: true, data: prefabRecord }) };
    return { status: 0, stdout: `command.result ${JSON.stringify({ command: script === 'prefab-source-inspect-host.js'
        ? 'prefab.source.inspect' : 'prefab.source.patch', result: { verified: true } })}\n` };
};
result = dispatch({ targets: [{ creatorVersion: '2.4.15', projectRoot: prefabProject }], projectRoot: prefabProject,
    creatorVersion: '2.4.15', command: 'prefab.source.patch', input: { prefabUuid: sourcePrefabUuid,
        targetNodePath: prefabRecord.manifest.targetNodePath, targetNodeUuid: prefabRecord.manifest.targetNodeUuid,
        action: 'apply', expectedPrefabSha256: 'a'.repeat(64), expectedDiff: prefabDiff, operationId: prefabOperationId } }, prefabInvoke);
assert.strictEqual(result.outcome, 'completed', JSON.stringify(result));
assert.strictEqual(result.result.reopened, true);
assert(prefabCalls.some((call) => call.script === 'prefab-source-patch-host.js'
    && call.args.includes('--expected-prefab-sha256') && call.args.includes('a'.repeat(64))));
result = dispatch({ targets: [{ creatorVersion: '2.4.15', projectRoot: prefabProject }], projectRoot: prefabProject,
    creatorVersion: '2.4.15', command: 'prefab.source.inspect', input: { prefabUuid: sourcePrefabUuid } }, prefabInvoke);
assert.strictEqual(result.outcome, 'completed');
assert(prefabCalls.some((call) => call.script === 'prefab-source-inspect-host.js' && call.args.includes('--prefab-uuid')));
const prefabInvalidCalls = prefabCalls.length;
assert.strictEqual(dispatch({ targets: [{ creatorVersion: '3.8.7', projectRoot: prefabProject }], projectRoot: prefabProject,
    creatorVersion: '3.8.7', command: 'prefab.source.patch', input: { prefabUuid: sourcePrefabUuid,
        targetNodePath: prefabRecord.manifest.targetNodePath, targetNodeUuid: prefabRecord.manifest.targetNodeUuid,
        action: 'apply', expectedPrefabSha256: 'a'.repeat(64), expectedDiff: prefabDiff } }, prefabInvoke).error.code, 'COMMAND_UNAVAILABLE');
assert.strictEqual(prefabCalls.length, prefabInvalidCalls, 'Prefab source patch must remain unavailable on 3.8 before discovery');
fs.rmSync(prefabProject, { recursive: true, force: true });

const removalProject = path.resolve(os.tmpdir(), 'cocos-agent-removal-project');
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

const validationProject = path.resolve(os.tmpdir(), 'cocos-agent-validation-project');
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

const folderProject = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-agent-folder-refresh-'));
const folderPath = 'CocosAgentBundleSmoke';
fs.mkdirSync(path.join(folderProject, 'assets', folderPath), { recursive: true });
const folderInstance = { ...removalInstance, projectRoot: folderProject, activeScene: null };
const folderCalls = [];
const folderInvoke = (script, args) => {
    folderCalls.push({ script, args });
    if (script === 'catalog-host.js' && args.includes('instances.list'))
        return { status: 0, stdout: JSON.stringify({ success: true, data: [folderInstance] }) };
    if (script === 'catalog-host.js') return { status: 0, stdout: JSON.stringify({ success: true, data: {
        instance: folderInstance, commands: [{ id: 'asset.refreshFolder', contractVersion: '0.1', access: 'write', status: 'available', reason: null }],
    } }) };
    return { status: 0, stdout: `command.result ${JSON.stringify({ command: 'asset.refreshFolder', result: {
        folderPath, url: `db://assets/${folderPath}/`, refreshed: true, resultCount: 1, truncated: false,
        results: [{ command: 'create', uuid: 'b3864af7-bb13-40c9-8f73-3ef22bd8e307', url: `db://assets/${folderPath}/BundleSharedA`, type: 'scene' }],
    } })}\n`, stderr: '' };
};
const folderRequest = { targets: [{ creatorVersion: '2.4.15', projectRoot: folderProject }], projectRoot: folderProject,
    creatorVersion: '2.4.15', command: 'asset.refreshFolder', input: { folderPath } };
try {
    const folderResult = dispatch(folderRequest, folderInvoke);
    assert.equal(folderResult.outcome, 'completed');
    assert.equal(folderResult.result.results[0].type, 'scene');
    assert.deepEqual(folderCalls[2].args.slice(-2), ['--asset-refresh-folder', folderPath]);
    const beforeInvalidFolder = folderCalls.length;
    assert.equal(dispatch({ ...folderRequest, input: { folderPath: '../outside' } }, folderInvoke).error.code, 'INVALID_ARGUMENT');
    assert.equal(folderCalls.length, beforeInvalidFolder, 'path traversal is rejected before target discovery');
    assert.equal(dispatch({ ...folderRequest, input: { folderPath: 'MissingFolder' } }, folderInvoke).error.code, 'ASSET_FOLDER_UNAVAILABLE');
    assert.equal(folderCalls.length, beforeInvalidFolder, 'missing target folder is rejected before editor discovery');
    fs.symlinkSync(path.join(folderProject, 'assets', folderPath), path.join(folderProject, 'assets', 'LinkedFolder'),
        process.platform === 'win32' ? 'junction' : 'dir');
    assert.equal(dispatch({ ...folderRequest, input: { folderPath: 'LinkedFolder' } }, folderInvoke).error.code, 'ASSET_FOLDER_UNAVAILABLE');
    assert.equal(folderCalls.length, beforeInvalidFolder, 'symlink target is rejected before editor discovery');
    assert.equal(dispatch({ ...folderRequest, creatorVersion: '3.8.7',
        targets: [{ creatorVersion: '3.8.7', projectRoot: folderProject }] }, folderInvoke).error.code, 'COMMAND_UNAVAILABLE');
    assert.equal(folderCalls.length, beforeInvalidFolder, 'folder refresh remains 2.4-only');
} finally { fs.rmSync(folderProject, { recursive: true, force: true }); }

const previewProject = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-agent-preview-start-'));
const previewSceneUuid = '280c3aec-6492-4a9d-9f51-a9b00b570b4a';
let previewInstance = { ...removalInstance, projectRoot: previewProject, activeScene: 'helloworld', activeSceneUuid: previewSceneUuid };
const previewCalls = [];
const previewInvoke = (script, args) => {
    previewCalls.push({ script, args });
    if (script === 'catalog-host.js' && args.includes('instances.list'))
        return { status: 0, stdout: JSON.stringify({ success: true, data: [previewInstance] }) };
    if (script === 'catalog-host.js') return { status: 0, stdout: JSON.stringify({ success: true, data: {
        instance: previewInstance, commands: [{ id: 'runtime.preview.start', contractVersion: '0.1', access: 'write', status: 'available', reason: null }],
    } }) };
    return { status: 0, stdout: `command.result ${JSON.stringify({ command: 'runtime.preview.start', result: {
        started: true, sceneName: 'helloworld', sceneUuid: previewSceneUuid, creatorVersion: '2.4.15',
        projectRoot: previewProject, instanceId,
    } })}\n`, stderr: '' };
};
const previewRequest = { targets: [{ creatorVersion: '2.4.15', projectRoot: previewProject }], projectRoot: previewProject,
    creatorVersion: '2.4.15', command: 'runtime.preview.start', input: {} };
const previewResult = dispatch(previewRequest, previewInvoke);
assert.equal(previewResult.outcome, 'completed', JSON.stringify(previewResult));
const previewExecution = previewCalls.find((call) => call.script === 'bridge-host.js');
assert(previewExecution.args.includes('--runtime-preview-start'));
assert(previewExecution.args.includes('--expected-scene-uuid'));
assert(previewExecution.args.includes(previewSceneUuid));
previewCalls.length = 0;
previewInstance = { ...previewInstance, activeSceneUuid: null };
const unboundPreview = dispatch(previewRequest, previewInvoke);
assert.equal(unboundPreview.error.code, 'SCENE_IDENTITY_UNAVAILABLE');
assert.equal(previewCalls.some((call) => call.script === 'bridge-host.js'), false,
    'preview start must stop before editor action when the scene identity is unavailable');
fs.rmSync(previewProject, { recursive: true, force: true });

process.stdout.write('agent dispatch selection, guards, and receipt decisions passed\n');
