import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { createServer } from './mcp-server.mjs';
import { DEFAULT_BASE_URL, completionEndpoint, parseArgs, requestDeepSeek, runDeepSeekAgent } from './deepseek-agent.mjs';

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DEFAULT_SKILL = path.join(REPOSITORY_ROOT, 'plugins/cocos-agent-2x/skills/cocos-agent/SKILL.md');

function fixture() {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-agent-deepseek-'));
    const projects = ['creator-a', 'creator-b'].map((name) => {
        const project = path.join(parent, name);
        fs.mkdirSync(project);
        return fs.realpathSync(project);
    });
    return { parent, projects, tracePath: path.join(parent, 'run.jsonl') };
}

function toolCall(id, name, args) {
    return { id, type: 'function', function: { name, arguments: JSON.stringify(args) } };
}

function modelToolResponse(...toolCalls) {
    return { id: `response-${toolCalls[0]?.id || 'final'}`, choices: [{ finish_reason: 'tool_calls', message: {
        role: 'assistant', content: null, tool_calls: toolCalls,
    } }] };
}

async function withMcp(projects, invokeAgent, run) {
    const server = createServer(projects, { invokeAgent });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'deepseek-agent-test', version: '0.1.0' });
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try { return await run(client); }
    finally { await client.close(); }
}

function readTrace(filename) {
    return fs.readFileSync(filename, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
}

test('DeepSeek agent discovers instances, selects a ready project, queries live capabilities, then inspects read-only', async () => {
    const value = fixture();
    const hostCalls = [];
    const modelRequests = [];
    const invokeAgent = async (request) => {
        hostCalls.push(request);
        if (request.method === 'instances.list') return { id: request.id, result: { success: true, data: [
            { projectRoot: value.projects[0], creatorVersion: '2.4.15', state: 'disconnected', activeScene: null },
            { projectRoot: value.projects[1], creatorVersion: '2.4.15', state: 'ready', activeScene: 'helloworld' },
        ] } };
        if (request.method === 'capabilities.list') return { id: request.id, result: { success: true, data: {
            instance: { projectRoot: value.projects[1], creatorVersion: '2.4.15', state: 'ready', activeScene: 'helloworld' },
            commands: [{ id: 'scene.node.inspect', contractVersion: '0.1', access: 'read', status: 'available', reason: null }],
        } } };
        return { id: request.id, result: { success: true, outcome: 'completed', command: request.params.command,
            node: { path: request.params.input.nodePath, name: 'Canvas', children: ['HelloWorld'] } } };
    };

    try {
        const result = await withMcp(value.projects, invokeAgent, (client) => runDeepSeekAgent({
            client, task: '只读检查就绪的 Creator 2.4.15 实例，并读取 helloworld/Canvas。不要修改项目。',
            projectRoots: value.projects, skillFiles: [DEFAULT_SKILL], tracePath: value.tracePath,
            apiKey: 'test-secret-value-that-must-not-be-logged',
            callModel: async (request) => {
                modelRequests.push(request);
                if (modelRequests.length === 1) return modelToolResponse(toolCall('call-1', 'cocos_2x_instances_list', {}));
                if (modelRequests.length === 2) return modelToolResponse(toolCall('call-2', 'cocos_2x_capabilities_list', { projectRoot: value.projects[1] }));
                if (modelRequests.length === 3) return modelToolResponse(toolCall('call-3', 'cocos_2x_scene_node_inspect', {
                    projectRoot: value.projects[1], input: { nodePath: 'helloworld/Canvas' },
                }));
                return { id: 'response-final', choices: [{ finish_reason: 'stop', message: {
                    role: 'assistant', content: 'Creator 2.4.15 实例已就绪；scene.node.inspect 可用。Canvas 下有 HelloWorld 子节点。全程只读。',
                } }] };
            },
        }));

        assert.equal(result.status, 'completed', JSON.stringify(result));
        assert.equal(result.reason, 'model_final');
        assert.equal(result.toolCalls, 3);
        assert.deepEqual(hostCalls.map((call) => call.method), ['instances.list', 'capabilities.list', 'command.execute']);
        assert.equal(hostCalls[1].params.projectRoot, value.projects[1]);
        assert.equal(hostCalls[2].params.command, 'scene.node.inspect');
        assert.equal(hostCalls[2].params.input.nodePath, 'helloworld/Canvas');
        assert.match(modelRequests[0].messages[0].content, /Creator 2\.4\.15/);
        assert.match(modelRequests[0].messages[0].content, /cocos-agent/);
        assert.ok(modelRequests[3].messages.some((message) => message.role === 'tool' && message.content.includes('Canvas')));

        const events = readTrace(value.tracePath);
        assert.deepEqual(events.filter((event) => event.event === 'tool.call').map((event) => event.name), [
            'cocos_2x_instances_list', 'cocos_2x_capabilities_list', 'cocos_2x_scene_node_inspect',
        ]);
        assert.equal(events.at(-1).event, 'run.stop');
        assert.equal(events.at(-1).reason, 'model_final');
        assert.equal(events.at(-1).receipts.at(-1).outcome, 'completed');
        assert.equal(fs.statSync(value.tracePath).mode & 0o777, 0o600);
        assert.doesNotMatch(fs.readFileSync(value.tracePath, 'utf8'), /test-secret-value/);
    } finally { fs.rmSync(value.parent, { recursive: true, force: true }); }
});

test('DeepSeek agent blocks writes without local approval and records why it stopped', async () => {
    const value = fixture();
    const hostMethods = [];
    let modelRound = 0;
    const invokeAgent = async (request) => {
        hostMethods.push(request.method);
        if (request.method === 'instances.list') return { id: request.id, result: { success: true, data: [
            { projectRoot: value.projects[0], creatorVersion: '2.4.15', state: 'ready', activeScene: 'helloworld' },
        ] } };
        if (request.method === 'capabilities.list') return { id: request.id, result: { success: true, data: {
            instance: { projectRoot: value.projects[0], creatorVersion: '2.4.15', state: 'ready', activeScene: 'helloworld' },
            commands: [{ id: 'content.select', contractVersion: '0.1', access: 'write', status: 'available', reason: null }],
        } } };
        return { id: request.id, result: { success: true, outcome: 'completed' } };
    };
    try {
        const result = await withMcp([value.projects[0]], invokeAgent, (client) => runDeepSeekAgent({
            client, task: '只读任务。', projectRoots: [value.projects[0]], skillFiles: [DEFAULT_SKILL], tracePath: value.tracePath,
            apiKey: 'test-secret-value', allowWrite: false,
            callModel: async () => {
                modelRound += 1;
                if (modelRound === 1) return modelToolResponse(toolCall('list', 'cocos_2x_instances_list', {}));
                if (modelRound === 2) return modelToolResponse(toolCall('caps', 'cocos_2x_capabilities_list', { projectRoot: value.projects[0] }));
                return modelToolResponse(toolCall('write', 'cocos_2x_content_select', { projectRoot: value.projects[0], releaseId: 'demo-release' }));
            },
        }));
        assert.equal(result.status, 'awaiting-approval', JSON.stringify(result));
        assert.equal(result.reason, 'write_requires_explicit_confirmation');
        assert.deepEqual(hostMethods, ['instances.list', 'capabilities.list']);
        const stop = readTrace(value.tracePath).at(-1);
        assert.equal(stop.status, 'awaiting-approval');
        assert.equal(stop.reason, 'write_requires_explicit_confirmation');
    } finally { fs.rmSync(value.parent, { recursive: true, force: true }); }
});

test('DeepSeek agent rejects batched tool calls so every choice follows its preceding receipt', async () => {
    const value = fixture();
    const invokedMethods = [];
    const invokeAgent = async (request) => {
        invokedMethods.push(request.method);
        return { id: request.id, result: { success: true, data: [] } };
    };
    try {
        const result = await withMcp([value.projects[0]], invokeAgent, (client) => runDeepSeekAgent({
            client, task: 'Inspect only.', projectRoots: [value.projects[0]], skillFiles: [DEFAULT_SKILL], tracePath: value.tracePath,
            apiKey: 'test-secret-value',
            callModel: async () => modelToolResponse(
                toolCall('list-first', 'cocos_2x_instances_list', {}),
                toolCall('capabilities-too-early', 'cocos_2x_capabilities_list', { projectRoot: value.projects[0] }),
            ),
        }));
        assert.equal(result.status, 'stopped');
        assert.equal(result.reason, 'multiple_tool_calls_not_allowed');
        assert.deepEqual(invokedMethods, []);
        assert.equal(readTrace(value.tracePath).at(-1).reason, 'multiple_tool_calls_not_allowed');
    } finally { fs.rmSync(value.parent, { recursive: true, force: true }); }
});

test('DeepSeek agent cannot mark the task complete without a successful task-tool receipt', async () => {
    const value = fixture();
    const invokeAgent = async () => { throw new Error('No MCP call should be made.'); };
    try {
        const result = await withMcp([value.projects[0]], invokeAgent, (client) => runDeepSeekAgent({
            client, task: 'Inspect a scene.', projectRoots: [value.projects[0]], skillFiles: [DEFAULT_SKILL], tracePath: value.tracePath,
            apiKey: 'test-secret-value',
            callModel: async () => ({ id: 'early-final', choices: [{ finish_reason: 'stop', message: {
                role: 'assistant', content: 'Inspection succeeded.',
            } }] }),
        }));
        assert.equal(result.status, 'stopped');
        assert.equal(result.reason, 'model_final_without_success_receipt');
        assert.match(result.finalText, /Inspection succeeded/);
        assert.equal(result.toolCalls, 0);
    } finally { fs.rmSync(value.parent, { recursive: true, force: true }); }
});

test('DeepSeek request uses the OpenAI-compatible HTTPS tool-call endpoint without exposing the key in errors', async () => {
    const secret = 'deepseek-test-secret-value';
    assert.equal(completionEndpoint(DEFAULT_BASE_URL).href, `${DEFAULT_BASE_URL}/chat/completions`);
    const requestBodies = [];
    const response = await requestDeepSeek({ apiKey: secret, messages: [{ role: 'user', content: 'read-only' }], tools: [],
        fetchImpl: async (url, init) => {
            assert.equal(url.href, `${DEFAULT_BASE_URL}/chat/completions`);
            assert.equal(init.headers.authorization, `Bearer ${secret}`);
            requestBodies.push(JSON.parse(init.body));
            return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'done' } }] }) };
        } });
    assert.equal(response.choices[0].message.content, 'done');
    assert.equal(requestBodies[0].tool_choice, 'auto');
    assert.deepEqual(requestBodies[0].thinking, { type: 'disabled' });

    await assert.rejects(requestDeepSeek({ apiKey: secret, messages: [], tools: [], fetchImpl: async () => ({
        ok: false, status: 401, json: async () => ({ error: { code: 'invalid_key', message: `rejected ${secret}` } }),
    }) }), (error) => !error.message.includes(secret) && error.message.includes('[REDACTED]'));
});

test('CLI accepts only explicit absolute, unique project roots and keeps credentials out of arguments', () => {
    const value = fixture();
    try {
        assert.deepEqual(parseArgs(['--project', value.projects[0], '--project', value.projects[1], '--task', 'inspect']).projects,
            value.projects.map((project) => fs.realpathSync(project)));
        assert.throws(() => parseArgs(['--project', 'relative', '--task', 'inspect']), /absolute/);
        assert.throws(() => parseArgs(['--project', value.projects[0], '--project', value.projects[0], '--task', 'inspect']), /unique/);
        assert.throws(() => parseArgs(['--api-key', 'secret']), /Unrecognized/);
    } finally { fs.rmSync(value.parent, { recursive: true, force: true }); }
});
