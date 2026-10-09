import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { createServer, parseArgs, runAgentWorker } from './mcp-server.mjs';

function fixture() {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-agent-mcp-'));
    const projects = ['2.4-project-a', '2.4-project-b'].map((name) => {
        const root = path.join(parent, name);
        fs.mkdirSync(root);
        return root;
    });
    return { parent, projects };
}

test('CLI requires existing absolute, unique, bounded registered project roots', () => {
    const value = fixture();
    try {
        assert.deepEqual(parseArgs(value.projects.flatMap((project) => ['--project', project])).projects,
            value.projects.map((project) => fs.realpathSync(project)));
        assert.throws(() => parseArgs([]), /At least one/);
        assert.throws(() => parseArgs(['--project', 'relative']), /absolute/);
        assert.throws(() => parseArgs(['--creator-version', '3.8.7']), /Use one or more/);
        assert.throws(() => parseArgs(['--project', value.projects[0], '--project', value.projects[0]]), /unique/);
        assert.throws(() => parseArgs(['--project', path.join(value.parent, 'missing')]), /ENOENT/);
    } finally { fs.rmSync(value.parent, { recursive: true, force: true }); }
});

test('MCP advertises fixed 2.4 tools and routes calls through the shared JSONL dispatcher contract', async () => {
    const value = fixture();
    const calls = [];
    const invokeAgent = async (request) => {
        calls.push(request);
        if (request.method === 'instances.list') return { id: request.id, result: { success: true,
            data: request.params.targets.map((target) => ({ ...target, state: 'ready' })) } };
        if (request.method === 'capabilities.list') return { id: request.id, result: { success: true,
            data: { instance: { creatorVersion: '2.4.15', projectRoot: request.params.projectRoot }, commands: [] } } };
        return { id: request.id, result: { success: true, outcome: 'completed', method: request.method,
            received: request.params } };
    };
    const server = createServer(value.projects, { invokeAgent });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'cocos-agent-test', version: '0.1.0' });
    try {
        await server.connect(serverTransport);
        await client.connect(clientTransport);
        const { tools } = await client.listTools();
        const names = tools.map((tool) => tool.name).sort();
        assert.deepEqual(names, [
            'cocos_2x_asset_search_png', 'cocos_2x_asset_validate_png', 'cocos_2x_assets_scene_cancel',
            'cocos_2x_assets_scene_compensate', 'cocos_2x_assets_scene_execute', 'cocos_2x_assets_scene_get',
            'cocos_2x_assets_scene_plan', 'cocos_2x_assets_scene_preview_accept', 'cocos_2x_assets_scene_repair',
            'cocos_2x_assets_scene_validate',
            'cocos_2x_capabilities_list', 'cocos_2x_command_execute',
            'cocos_2x_content_build_execute',
            'cocos_2x_content_build_get', 'cocos_2x_content_build_plan', 'cocos_2x_content_build_reconcile',
            'cocos_2x_content_bundle_plan', 'cocos_2x_content_bundle_stage',
            'cocos_2x_content_from_scene_plan', 'cocos_2x_content_from_scene_stage', 'cocos_2x_content_get',
            'cocos_2x_content_preview_get', 'cocos_2x_content_preview_start', 'cocos_2x_content_preview_stop',
            'cocos_2x_content_rollback', 'cocos_2x_content_select',
            'cocos_2x_instances_get', 'cocos_2x_instances_list', 'cocos_2x_operation_get',
            'cocos_2x_operation_preview_accept', 'cocos_2x_operation_reconcile',
            'cocos_2x_scene_node_inspect', 'cocos_2x_scene_snapshot', 'cocos_2x_workflow_compensate',
            'cocos_2x_workflow_execute', 'cocos_2x_workflow_get', 'cocos_2x_workflow_plan', 'cocos_2x_workflow_replay',
        ]);
        assert.equal(tools.length, 38);
        const commandTool = tools.find((tool) => tool.name === 'cocos_2x_command_execute');
        assert.equal(commandTool.annotations.readOnlyHint, false);
        assert.equal(commandTool.annotations.destructiveHint, true);
        const commandBranches = commandTool.inputSchema.oneOf || commandTool.inputSchema.anyOf;
        assert.equal(commandBranches.length, 11);
        const inspectBranch = commandBranches.find((branch) => branch.properties?.command?.const === 'scene.node.inspect');
        assert.deepEqual(inspectBranch.properties.input.required, ['nodePath']);
        const searchBranch = commandBranches.find((branch) => branch.properties?.command?.const === 'asset.searchPng');
        assert.deepEqual(searchBranch.properties.input.required, ['query']);
        const patchBranch = commandBranches.find((branch) => branch.properties?.command?.const === 'scene.node.patch');
        assert.deepEqual(patchBranch.properties.input.required, ['targetNodePath', 'targetNodeUuid', 'action', 'expectedDiff']);
        assert.equal(tools.find((tool) => tool.name === 'cocos_2x_instances_list').annotations.readOnlyHint, true);
        for (const name of ['cocos_2x_scene_snapshot', 'cocos_2x_scene_node_inspect',
            'cocos_2x_asset_search_png', 'cocos_2x_asset_validate_png']) {
            const tool = tools.find((candidate) => candidate.name === name);
            assert.equal(tool.annotations.readOnlyHint, true, `${name} must stay read-only`);
            assert.equal(tool.annotations.destructiveHint, false, `${name} must not be destructive`);
        }

        const { resources } = await client.listResources();
        assert.deepEqual(resources.map((resource) => resource.uri), ['cocos://2x/agent/mcp-tools', 'cocos://2x/skills/scene-composition']);
        const skill = await client.readResource({ uri: 'cocos://2x/agent/mcp-tools' });
        assert.match(skill.contents[0].text, /Creator \*\*2\.4\.15\*\*/);
        assert.match(skill.contents[0].text, /Do not repeat a possibly completed write/);
        const compositionSkill = await client.readResource({ uri: 'cocos://2x/skills/scene-composition' });
        assert.match(compositionSkill.contents[0].text, /cocos_2x_workflow_plan/);
        assert.match(compositionSkill.contents[0].text, /visually inspect/i);

        const { prompts } = await client.listPrompts();
        assert.deepEqual(prompts.map((prompt) => prompt.name), ['cocos_2x_resource_to_scene_workflow']);
        const workflow = await client.getPrompt({ name: prompts[0].name, arguments: {
            projectRoot: value.projects[0], request: 'Import the provided sprites into the active scene.',
        } });
        assert.match(workflow.messages[0].content.text, new RegExp(value.projects[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        assert.match(workflow.messages[0].content.text, /do not retry execute/i);
        assert.match(workflow.messages[0].content.text, /Never invent visual evidence/);
        assert.match(workflow.messages[0].content.text, /cocos_2x_asset_search_png/);
        assert.match(workflow.messages[0].content.text, /cocos_2x_scene_node_inspect/);
        assert.match(workflow.messages[0].content.text, /metadataStatus is valid/);
        assert.match(workflow.messages[0].content.text, /scene\.node\.create/);
        assert.match(workflow.messages[0].content.text, /multiple candidates fit.*stop and ask/i);

        const listed = await client.callTool({ name: 'cocos_2x_instances_list', arguments: {} });
        assert.equal(listed.structuredContent.data.length, 2);
        assert.equal(calls.at(-1).method, 'instances.list');
        assert.deepEqual(calls.at(-1).params.targets, value.projects.map((projectRoot) => ({
            creatorVersion: '2.4.15', projectRoot,
        })));

        const selected = await client.callTool({ name: 'cocos_2x_capabilities_list', arguments: { projectRoot: value.projects[1] } });
        assert.equal(selected.structuredContent.data.instance.projectRoot, value.projects[1]);
        assert.equal(calls.at(-1).params.creatorVersion, '2.4.15');
        const patchDiff = [{ path: 'node.position.x', before: 0, after: 12 }];
        const patched = await client.callTool({ name: 'cocos_2x_command_execute', arguments: {
            projectRoot: value.projects[0], command: 'scene.node.patch', input: {
                targetNodePath: 'helloworld/Canvas/Probe', targetNodeUuid: '11111111-1111-4111-8111-111111111111',
                action: 'apply', expectedDiff: patchDiff,
            },
        } });
        assert.equal(patched.structuredContent.method, 'command.execute');
        assert.deepEqual(calls.at(-1).params.input.expectedDiff, patchDiff);
        const clearSpriteFrame = await client.callTool({ name: 'cocos_2x_command_execute', arguments: {
            projectRoot: value.projects[0], command: 'scene.node.patch', input: {
                targetNodePath: 'helloworld/Canvas/Probe', targetNodeUuid: '11111111-1111-4111-8111-111111111111',
                action: 'apply', expectedDiff: [{ path: 'component.cc.Sprite.spriteFrameUuid',
                    before: '22222222-2222-4222-8222-222222222222', after: null }],
            },
        } });
        assert.equal(clearSpriteFrame.structuredContent.method, 'command.execute');
        assert.equal(calls.at(-1).params.input.expectedDiff[0].after, null);
        const invalidPatch = await client.callTool({ name: 'cocos_2x_command_execute', arguments: {
            projectRoot: value.projects[0], command: 'scene.node.patch', input: {
                targetNodePath: 'helloworld/Canvas/Probe', targetNodeUuid: '11111111-1111-4111-8111-111111111111',
                action: 'apply', expectedDiff: [{ path: 'node.rotation.z', before: 0, after: 10 }],
            },
        } });
        assert.equal(invalidPatch.isError, true);

        const workflowSteps = [
            { id: 'root', name: 'AgentShowcase', parent: { path: 'Canvas', uuid: 'a286bbGknJLZpRpxROV6M94' } },
            { id: 'red', name: 'RedSprite', parent: { ref: 'root' }, components: [
                { classId: 'cc.Sprite', spriteFrameUuid: '0683b14a-8790-4ecd-9ee5-4b83163e34ff' },
            ], transform: { position: { x: -64, y: 0 } } },
        ];
        const workflowPlan = await client.callTool({ name: 'cocos_2x_workflow_plan', arguments: {
            projectRoot: value.projects[0], steps: workflowSteps,
        } });
        assert.equal(workflowPlan.structuredContent.method, 'workflow.plan');
        assert.deepEqual(calls.at(-1).params.targets, value.projects.map((projectRoot) => ({ creatorVersion: '2.4.15', projectRoot })));
        assert.equal(calls.at(-1).params.creatorVersion, '2.4.15');
        assert.deepEqual(calls.at(-1).params.steps, workflowSteps);
        const invalidWorkflow = await client.callTool({ name: 'cocos_2x_workflow_plan', arguments: {
            projectRoot: value.projects[0], steps: [workflowSteps[0]],
        } });
        assert.equal(invalidWorkflow.isError, true);

        const workflowId = '85f27a88-8757-487a-8c4c-6e9d34b334d3';
        const workflowExecute = await client.callTool({ name: 'cocos_2x_workflow_execute', arguments: {
            projectRoot: value.projects[0], workflowId, steps: workflowSteps,
        } });
        assert.equal(workflowExecute.structuredContent.method, 'workflow.execute');
        assert.equal(calls.at(-1).params.workflowId, workflowId);
        assert.equal(calls.at(-1).params.creatorVersion, '2.4.15');
        const workflowGet = await client.callTool({ name: 'cocos_2x_workflow_get', arguments: {
            projectRoot: value.projects[0], workflowId,
        } });
        assert.equal(workflowGet.structuredContent.method, 'workflow.get');
        assert.equal(calls.at(-1).params.workflowId, workflowId);
        const workflowCompensate = await client.callTool({ name: 'cocos_2x_workflow_compensate', arguments: {
            projectRoot: value.projects[0], workflowId,
        } });
        assert.equal(workflowCompensate.structuredContent.method, 'workflow.compensate');
        assert.equal(calls.at(-1).params.workflowId, workflowId);
        const replayId = 'a75953e1-c0ce-4e5f-9526-4971df74fe52';
        const workflowReplay = await client.callTool({ name: 'cocos_2x_workflow_replay', arguments: {
            projectRoot: value.projects[0], sourceWorkflowId: workflowId, workflowId: replayId,
        } });
        assert.equal(workflowReplay.structuredContent.method, 'workflow.replay');
        assert.equal(calls.at(-1).params.sourceWorkflowId, workflowId);
        assert.equal(calls.at(-1).params.workflowId, replayId);

        const snapshot = await client.callTool({ name: 'cocos_2x_scene_snapshot', arguments: {
            projectRoot: value.projects[0], input: { targetNodeName: 'Canvas' },
        } });
        assert.equal(snapshot.structuredContent.method, 'command.execute');
        assert.equal(calls.at(-1).params.command, 'scene.snapshot');
        assert.deepEqual(calls.at(-1).params.input, { targetNodeName: 'Canvas' });
        const invalidSnapshot = await client.callTool({ name: 'cocos_2x_scene_snapshot', arguments: {
            projectRoot: value.projects[0], input: { command: 'scene.node.create' },
        } });
        assert.equal(invalidSnapshot.isError, true);

        const searched = await client.callTool({ name: 'cocos_2x_command_execute', arguments: {
            projectRoot: value.projects[0], command: 'asset.searchPng', input: { query: 'smoke', limit: 10, offset: 0 },
        } });
        assert.equal(searched.structuredContent.method, 'command.execute');
        assert.equal(calls.at(-1).params.command, 'asset.searchPng');
        assert.deepEqual(calls.at(-1).params.input, { query: 'smoke', limit: 10, offset: 0 });
        const invalidSearch = await client.callTool({ name: 'cocos_2x_command_execute', arguments: {
            projectRoot: value.projects[0], command: 'asset.searchPng', input: { query: '' },
        } });
        assert.equal(invalidSearch.isError, true);

        const refreshedFolder = await client.callTool({ name: 'cocos_2x_command_execute', arguments: {
            projectRoot: value.projects[0], command: 'asset.refreshFolder', input: { folderPath: 'CocosAgentBundleSmoke' },
        } });
        assert.equal(refreshedFolder.structuredContent.method, 'command.execute');
        assert.equal(calls.at(-1).params.command, 'asset.refreshFolder');
        assert.deepEqual(calls.at(-1).params.input, { folderPath: 'CocosAgentBundleSmoke' });
        const invalidFolder = await client.callTool({ name: 'cocos_2x_command_execute', arguments: {
            projectRoot: value.projects[0], command: 'asset.refreshFolder', input: { folderPath: '../outside' },
        } });
        assert.equal(invalidFolder.isError, true);

        const executed = await client.callTool({ name: 'cocos_2x_command_execute', arguments: {
            projectRoot: value.projects[0], command: 'scene.snapshot', input: {},
        } });
        assert.equal(executed.structuredContent.method, 'command.execute');
        assert.equal(executed.structuredContent.received.targets.length, 2);
        assert.equal(executed.structuredContent.received.projectRoot, value.projects[0]);
        assert.equal(executed.structuredContent.received.creatorVersion, '2.4.15');

        const planned = await client.callTool({ name: 'cocos_2x_content_build_plan', arguments: {
            projectRoot: value.projects[0], releaseId: 'release-a', expectedFingerprint: 'a'.repeat(64), buildId: 'web-build-01',
        } });
        assert.equal(planned.structuredContent.method, 'content.build.plan');
        assert.equal(calls.at(-1).params.creatorVersion, '2.4.15');
        assert.equal(calls.at(-1).params.projectRoot, value.projects[0]);

        const operationId = '5858dc80-32d0-4610-8291-f057fa13151e';
        const history = await client.callTool({ name: 'cocos_2x_operation_get', arguments: {
            projectRoot: value.projects[0], operationId,
        } });
        assert.equal(history.structuredContent.method, 'operation.get');
        assert.equal(calls.at(-1).params.operationId, operationId);

        const reconciled = await client.callTool({ name: 'cocos_2x_operation_reconcile', arguments: {
            projectRoot: value.projects[0], operationId,
        } });
        assert.equal(reconciled.structuredContent.method, 'operation.reconcile');
        assert.equal(calls.at(-1).params.operationId, operationId);
        assert.equal(calls.at(-1).params.targets.length, 2);

        const previewAccepted = await client.callTool({ name: 'cocos_2x_operation_preview_accept', arguments: {
            projectRoot: value.projects[0], operationId,
            evidence: { url: 'http://127.0.0.1:7457/', observedAt: '2026-10-08T16:00:00.000Z', note: 'Sprite visible in the scene.' },
        } });
        assert.equal(previewAccepted.structuredContent.method, 'preview.accept');
        assert.equal(calls.at(-1).params.evidence.url, 'http://127.0.0.1:7457/');

        const resourceSources = [path.join(value.parent, 'red.png'), path.join(value.parent, 'blue.png')];
        const pipelineId = 'e717fbc0-13a0-4d4c-8957-8439570be51a';
        const sceneOperationId = 'f12163cd-bf66-4210-9043-60f07c4ce07b';
        const repairId = '61f4b44d-8d91-4df8-bef3-6f07a23772fa';
        const plannedScene = await client.callTool({ name: 'cocos_2x_assets_scene_plan', arguments: {
            projectRoot: value.projects[0], sources: resourceSources, positions: [{ x: -32, y: 0 }, { x: 32, y: 0 }],
        } });
        assert.equal(plannedScene.structuredContent.method, 'assets.scene.plan');
        assert.deepEqual(calls.at(-1).params.targets, value.projects.map((projectRoot) => ({ creatorVersion: '2.4.15', projectRoot })));
        assert.equal(calls.at(-1).params.creatorVersion, '2.4.15');
        assert.deepEqual(calls.at(-1).params.sources, resourceSources);

        const executedScene = await client.callTool({ name: 'cocos_2x_assets_scene_execute', arguments: {
            projectRoot: value.projects[0], pipelineId, sources: resourceSources,
        } });
        assert.equal(executedScene.structuredContent.method, 'assets.scene.execute');
        assert.equal(calls.at(-1).params.pipelineId, pipelineId);
        assert.deepEqual(calls.at(-1).params.positions, undefined);

        const pipelineReceipt = await client.callTool({ name: 'cocos_2x_assets_scene_get', arguments: {
            projectRoot: value.projects[0], pipelineId,
        } });
        assert.equal(pipelineReceipt.structuredContent.method, 'assets.scene.get');
        assert.equal(calls.at(-1).params.projectRoot, value.projects[0]);

        const scenePreview = await client.callTool({ name: 'cocos_2x_assets_scene_preview_accept', arguments: {
            projectRoot: value.projects[0], pipelineId, operationId: sceneOperationId,
            evidence: { url: 'http://127.0.0.1:7457/', observedAt: '2026-10-09T01:00:00+08:00', note: 'Blue Sprite visible.' },
        } });
        assert.equal(scenePreview.structuredContent.method, 'assets.scene.preview.accept');
        assert.equal(calls.at(-1).params.operationId, sceneOperationId);
        assert.equal(calls.at(-1).params.evidence.note, 'Blue Sprite visible.');

        const validatedScene = await client.callTool({ name: 'cocos_2x_assets_scene_validate', arguments: {
            projectRoot: value.projects[0], pipelineId, assetName: 'blue.png',
        } });
        assert.equal(validatedScene.structuredContent.method, 'assets.scene.validate');
        assert.equal(calls.at(-1).params.assetName, 'blue.png');

        const repairedScene = await client.callTool({ name: 'cocos_2x_assets_scene_repair', arguments: {
            projectRoot: value.projects[0], pipelineId, assetName: 'blue.png', repairId,
        } });
        assert.equal(repairedScene.structuredContent.method, 'assets.scene.repair');
        assert.equal(calls.at(-1).params.repairId, repairId);

        const compensatedScene = await client.callTool({ name: 'cocos_2x_assets_scene_compensate', arguments: {
            projectRoot: value.projects[0], pipelineId,
        } });
        assert.equal(compensatedScene.structuredContent.method, 'assets.scene.compensate');
        assert.equal(calls.at(-1).params.pipelineId, pipelineId);

        const releaseId = 'mcp-release-blue-01';
        const contentMappings = [
            { assetName: 'red.png', id: 'red', dependsOn: [] },
            { assetName: 'blue.png', id: 'blue', dependsOn: ['red'] },
        ];
        const fromSceneInput = { projectRoot: value.projects[0], pipelineId, releaseId,
            entryAssetName: 'blue.png', assets: contentMappings };
        const contentPlan = await client.callTool({ name: 'cocos_2x_content_from_scene_plan', arguments: fromSceneInput });
        assert.equal(contentPlan.structuredContent.method, 'content.fromScene.plan');
        assert.deepEqual(calls.at(-1).params.targets, value.projects.map((projectRoot) => ({ creatorVersion: '2.4.15', projectRoot })));
        assert.equal(calls.at(-1).params.entryAssetName, 'blue.png');
        assert.deepEqual(calls.at(-1).params.assets, contentMappings);

        const contentStage = await client.callTool({ name: 'cocos_2x_content_from_scene_stage', arguments: fromSceneInput });
        assert.equal(contentStage.structuredContent.method, 'content.fromScene.stage');
        assert.equal(calls.at(-1).params.releaseId, releaseId);

        const bundleInput = { projectRoot: value.projects[0], releaseId: 'bundle-release-01',
            bundleRoot: 'assets/CocosAgentBundleSmoke', bundleName: 'cocos-agent-smoke',
            entryAssetName: 'BlueReleaseOct09.png', assets: [
                { assetName: 'RedReleaseOct09.png', id: 'red' },
                { assetName: 'BlueReleaseOct09.png', id: 'blue', dependsOn: ['red'] },
            ] };
        const bundlePlan = await client.callTool({ name: 'cocos_2x_content_bundle_plan', arguments: bundleInput });
        assert.equal(bundlePlan.structuredContent.method, 'content.bundle.plan');
        assert.equal(calls.at(-1).params.creatorVersion, '2.4.15');
        assert.equal(calls.at(-1).params.bundleName, 'cocos-agent-smoke');
        assert.deepEqual(calls.at(-1).params.assets, bundleInput.assets);

        const bundleStage = await client.callTool({ name: 'cocos_2x_content_bundle_stage', arguments: bundleInput });
        assert.equal(bundleStage.structuredContent.method, 'content.bundle.stage');
        assert.equal(calls.at(-1).params.bundleRoot, 'assets/CocosAgentBundleSmoke');

        const contentRead = await client.callTool({ name: 'cocos_2x_content_get', arguments: {
            projectRoot: value.projects[0], releaseId,
        } });
        assert.equal(contentRead.structuredContent.method, 'content.get');
        assert.equal(calls.at(-1).params.releaseId, releaseId);

        const contentSelected = await client.callTool({ name: 'cocos_2x_content_select', arguments: {
            projectRoot: value.projects[0], releaseId, expectedCurrent: null,
        } });
        assert.equal(contentSelected.structuredContent.method, 'content.select');
        assert.equal(calls.at(-1).params.expectedCurrent, null);

        const contentRollback = await client.callTool({ name: 'cocos_2x_content_rollback', arguments: {
            projectRoot: value.projects[0], expectedCurrent: releaseId,
        } });
        assert.equal(contentRollback.structuredContent.method, 'content.rollback');
        assert.equal(calls.at(-1).params.expectedCurrent, releaseId);

        const invalidProject = await client.callTool({ name: 'cocos_2x_command_execute', arguments: {
            projectRoot: path.join(value.parent, 'not-registered'), command: 'scene.snapshot', input: {},
        } });
        assert.equal(invalidProject.isError, true);
        const invalidCommand = await client.callTool({ name: 'cocos_2x_command_execute', arguments: {
            projectRoot: value.projects[0], command: 'runtime.eval', input: {},
        } });
        assert.equal(invalidCommand.isError, true);
        const invalidCommandInput = await client.callTool({ name: 'cocos_2x_command_execute', arguments: {
            projectRoot: value.projects[0], command: 'scene.node.inspect', input: {},
        } });
        assert.equal(invalidCommandInput.isError, true);
        assert.equal(calls.filter((call) => call.method === 'command.execute').length, 6);
    } finally {
        await client.close();
        await server.close();
        fs.rmSync(value.parent, { recursive: true, force: true });
    }
});

test('MCP forwards opted-in progress and prevents a duplicate scene pipeline while it is running', async () => {
    const value = fixture();
    let finishExecution;
    let signalProgress;
    const progressSeen = new Promise((resolve) => { signalProgress = resolve; });
    const invokeAgent = async (request, options = {}) => {
        if (request.method === 'assets.scene.execute') {
            await options.onProgress?.({ progress: 1, command: 'scene.snapshot', state: 'started' });
            await new Promise((resolve) => { finishExecution = resolve; });
        }
        if (request.method === 'assets.scene.get') return { id: request.id,
            result: { success: true, outcome: 'executing', pipelineId: request.params.pipelineId } };
        return { id: request.id, result: { success: true, outcome: 'completed', method: request.method } };
    };
    const server = createServer(value.projects, { invokeAgent });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'cocos-agent-progress-test', version: '0.1.0' });
    try {
        await server.connect(serverTransport);
        await client.connect(clientTransport);
        const args = { projectRoot: value.projects[0], pipelineId: '5858dc80-32d0-4610-8291-f057fa13151e',
            sources: [path.join(value.parent, 'one.png'), path.join(value.parent, 'two.png')] };
        const execution = client.callTool({ name: 'cocos_2x_assets_scene_execute', arguments: args }, {
            onprogress: (progress) => signalProgress(progress),
        });
        const progress = await progressSeen;
        assert.equal(progress.progress, 1);
        assert.equal(progress.message, 'scene.snapshot 开始');

        const duplicate = await client.callTool({ name: 'cocos_2x_assets_scene_execute', arguments: args });
        assert.equal(duplicate.isError, true);
        assert.equal(duplicate.structuredContent.error.code, 'PIPELINE_EXECUTION_IN_PROGRESS');
        const competingWrite = await client.callTool({ name: 'cocos_2x_content_select', arguments: {
            projectRoot: value.projects[0], releaseId: 'release-a', expectedCurrent: null,
        } });
        assert.equal(competingWrite.isError, true);
        assert.equal(competingWrite.structuredContent.error.code, 'EDITOR_BUSY');
        const receipt = await client.callTool({ name: 'cocos_2x_assets_scene_get', arguments: {
            projectRoot: value.projects[0], pipelineId: args.pipelineId,
        } });
        assert.equal(receipt.structuredContent.outcome, 'executing');

        finishExecution();
        const completed = await execution;
        assert.equal(completed.structuredContent.outcome, 'completed');
    } finally {
        finishExecution?.();
        await client.close();
        await server.close();
        fs.rmSync(value.parent, { recursive: true, force: true });
    }
});

test('scene pipeline worker returns through its message channel without touching an editor', async () => {
    const response = await runAgentWorker({ id: 31, method: 'unsupported.test.method', params: {} }, async () => {});
    assert.equal(response.id, 31);
    assert.equal(response.result.success, false);
    assert.equal(response.result.error.code, 'INVALID_ARGUMENT');
});

test('MCP cancellation sets the active pipeline shared flag and leaves compensation to the Worker', async () => {
    const value = fixture();
    let resolveWorker;
    let cancelView;
    let signalStarted;
    const started = new Promise((resolve) => { signalStarted = resolve; });
    const runScenePipelineWorker = async (request, onProgress, cancelBuffer) => {
        cancelView = new Int32Array(cancelBuffer);
        await onProgress({ progress: 1, command: 'scene.snapshot', state: 'started' });
        signalStarted();
        return new Promise((resolve) => { resolveWorker = () => resolve({ id: request.id,
            result: { success: false, outcome: 'failed', error: { code: 'EXECUTION_CANCELLED' } } }); });
    };
    const server = createServer(value.projects, { runScenePipelineWorker });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'cocos-agent-cancel-test', version: '0.1.0' });
    try {
        await server.connect(serverTransport);
        await client.connect(clientTransport);
        const pipelineId = '5858dc80-32d0-4610-8291-f057fa13151e';
        const execution = client.callTool({ name: 'cocos_2x_assets_scene_execute', arguments: {
            projectRoot: value.projects[0], pipelineId,
            sources: [path.join(value.parent, 'one.png'), path.join(value.parent, 'two.png')],
        } });
        await started;
        const cancelled = await client.callTool({ name: 'cocos_2x_assets_scene_cancel', arguments: {
            projectRoot: value.projects[0], pipelineId,
        } });
        assert.equal(cancelled.structuredContent.outcome, 'cancellation-requested');
        assert.equal(Atomics.load(cancelView, 0), 1);
        const repeated = await client.callTool({ name: 'cocos_2x_assets_scene_cancel', arguments: {
            projectRoot: value.projects[0], pipelineId,
        } });
        assert.equal(repeated.structuredContent.outcome, 'cancellation-already-requested');

        resolveWorker();
        const result = await execution;
        assert.equal(result.structuredContent.error.code, 'EXECUTION_CANCELLED');
        const after = await client.callTool({ name: 'cocos_2x_assets_scene_cancel', arguments: {
            projectRoot: value.projects[0], pipelineId,
        } });
        assert.equal(after.structuredContent.error.code, 'PIPELINE_NOT_RUNNING');
    } finally {
        resolveWorker?.();
        await client.close();
        await server.close();
        fs.rmSync(value.parent, { recursive: true, force: true });
    }
});

test('MCP converts dispatcher failures to structured tool errors without losing the Cocos error code', async () => {
    const value = fixture();
    const server = createServer([value.projects[0]], { invokeAgent: async (request) => ({ id: request.id,
        result: { success: false, error: { code: 'EDITOR_NOT_CONNECTED', message: 'Creator is not running.' } } }) });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'cocos-agent-test', version: '0.1.0' });
    try {
        await server.connect(serverTransport);
        await client.connect(clientTransport);
        const result = await client.callTool({ name: 'cocos_2x_instances_list', arguments: {} });
        assert.equal(result.isError, true);
        assert.equal(result.structuredContent.error.code, 'EDITOR_NOT_CONNECTED');
        assert.match(result.content[0].text, /EDITOR_NOT_CONNECTED/);
    } finally {
        await client.close();
        await server.close();
        fs.rmSync(value.parent, { recursive: true, force: true });
    }
});
