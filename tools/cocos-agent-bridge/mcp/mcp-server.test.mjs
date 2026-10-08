import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { createServer, parseArgs } from './mcp-server.mjs';

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
            'cocos_2x_capabilities_list', 'cocos_2x_command_execute', 'cocos_2x_content_build_execute',
            'cocos_2x_content_build_get', 'cocos_2x_content_build_plan', 'cocos_2x_content_build_reconcile',
            'cocos_2x_content_preview_get', 'cocos_2x_content_preview_start', 'cocos_2x_content_preview_stop',
            'cocos_2x_instances_get', 'cocos_2x_instances_list',
        ]);
        const commandTool = tools.find((tool) => tool.name === 'cocos_2x_command_execute');
        assert.equal(commandTool.annotations.readOnlyHint, false);
        assert.equal(commandTool.annotations.destructiveHint, true);
        const commandBranches = commandTool.inputSchema.oneOf || commandTool.inputSchema.anyOf;
        assert.equal(commandBranches.length, 8);
        const inspectBranch = commandBranches.find((branch) => branch.properties?.command?.const === 'scene.node.inspect');
        assert.deepEqual(inspectBranch.properties.input.required, ['nodePath']);
        assert.equal(tools.find((tool) => tool.name === 'cocos_2x_instances_list').annotations.readOnlyHint, true);

        const listed = await client.callTool({ name: 'cocos_2x_instances_list', arguments: {} });
        assert.equal(listed.structuredContent.data.length, 2);
        assert.equal(calls.at(-1).method, 'instances.list');
        assert.deepEqual(calls.at(-1).params.targets, value.projects.map((projectRoot) => ({
            creatorVersion: '2.4.15', projectRoot,
        })));

        const selected = await client.callTool({ name: 'cocos_2x_capabilities_list', arguments: { projectRoot: value.projects[1] } });
        assert.equal(selected.structuredContent.data.instance.projectRoot, value.projects[1]);
        assert.equal(calls.at(-1).params.creatorVersion, '2.4.15');

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
        assert.equal(calls.filter((call) => call.method === 'command.execute').length, 1);
    } finally {
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
