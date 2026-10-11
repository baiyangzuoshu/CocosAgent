import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { createServer } from './mcp-server.mjs';
import { DEFAULT_BASE_URL, completionEndpoint, parseArgs, requestDeepSeek, runDeepSeekAgent } from './deepseek-agent.mjs';
import { compactReceipt, assistantAnswer } from './assistant-host.mjs';

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

for (const mode of ['Ask', 'Plan']) {
    test(`${mode} exposes only read tools and supports a conversational answer with history`, async () => {
        const value = fixture();
        try {
            await withMcp(value.projects, async () => { throw new Error('Unexpected host call'); }, async (client) => {
                const catalog = (await client.listTools()).tools;
                const readonly = new Set([...catalog.filter((tool) => tool.annotations?.readOnlyHint === true).map((tool) => tool.name),
                    'cocos_2x_skills_list', 'cocos_2x_skill_read', 'cocos_2x_skill_reference_read']);
                const result = await runDeepSeekAgent({ client, mode, task: 'Explain the modes.',
                    projectRoots: value.projects, skillFiles: [DEFAULT_SKILL], tracePath: value.tracePath, apiKey: 'test-secret',
                    history: [{ role: 'user', content: 'Previous question' }, { role: 'assistant', content: 'Previous answer' }],
                    callModel: async (request) => {
                        assert.ok(request.tools.length > 0);
                        assert.ok(request.tools.every((tool) => readonly.has(tool.function.name)));
                        assert.ok(request.messages.some((message) => message.content === 'Previous answer'));
                        assert.equal(request.mode, mode);
                if (mode === 'Plan') {
                    assert.match(request.messages[0].content, /preconditions is an array of 0-4 non-empty strings/);
                    assert.match(request.messages[0].content, /summary <= 1200/);
                    assert.match(request.messages[0].content, /requiredTools is an array of 1-6 unique exact MCP tool names/);
                }
                        return { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'Answer' } }] };
                    } });
                assert.equal(result.status, 'completed');
                const blocked = await runDeepSeekAgent({ client, mode, task: 'Write anyway.',
                    projectRoots: value.projects, skillFiles: [DEFAULT_SKILL], tracePath: value.tracePath, apiKey: 'test-secret',
                    allowWrite: true, approveWrite: async () => { throw new Error('Must not request approval'); },
                    callModel: async () => modelToolResponse(toolCall('write', 'cocos_2x_content_select', { projectRoot: value.projects[0], releaseId: 'demo' })) });
                assert.equal(blocked.reason, 'model_requested_unknown_tool');
            });
        } finally { fs.rmSync(value.parent, { recursive: true, force: true }); }
    });
}

test('Creator Agent reads the selected skill and its declared reference on demand and traces verified hashes', async () => {
    const value = fixture();
    const hostMethods = [];
    const agentEvents = [];
    let round = 0;
    const skillName = 'cocos2-scene-composition';
    const referenceId = 'agent-foundation/scene-composition-0.1.md';
    try {
        await withMcp([value.projects[0]], async (request) => {
            hostMethods.push(request.method);
            if (request.method === 'instances.list') return { id: request.id, result: { success: true, data: [
                { projectRoot: value.projects[0], creatorVersion: '2.4.15', state: 'ready', activeScene: 'helloworld' },
            ] } };
            if (request.method === 'capabilities.list') return { id: request.id, result: { success: true, data: {
                instance: { projectRoot: value.projects[0], creatorVersion: '2.4.15', state: 'ready', activeScene: 'helloworld' },
                commands: [{ id: 'scene.snapshot', access: 'read', status: 'available' }],
            } } };
            if (request.method === 'command.execute') {
                assert.equal(request.params.command, 'scene.snapshot');
                return { id: request.id, result: { success: true, outcome: 'completed', command: 'scene.snapshot',
                    data: { sceneName: 'helloworld', nodeCount: 3 } } };
            }
            throw new Error(`Unexpected host method ${request.method}`);
        }, async (client) => {
            const result = await runDeepSeekAgent({ client, mode: 'Ask', task: 'Inspect the scene composition workflow and current scene.',
                projectRoots: [value.projects[0]], skillFiles: [DEFAULT_SKILL], tracePath: value.tracePath, apiKey: 'test-secret',
                onEvent: (event) => agentEvents.push(event),
                callModel: async ({ messages, tools }) => {
                    round += 1;
                    if (round === 1) {
                        assert.deepEqual(tools.map((tool) => tool.function.name), ['cocos_2x_instances_list']);
                        return modelToolResponse(toolCall('instances', 'cocos_2x_instances_list', {}));
                    }
                    if (round === 2) return modelToolResponse(toolCall('capabilities', 'cocos_2x_capabilities_list', { projectRoot: value.projects[0] }));
                    if (round === 3) {
                        const names = tools.map((tool) => tool.function.name);
                        assert.ok(names.includes('cocos_2x_skills_list'));
                        assert.ok(names.includes('cocos_2x_skill_read'));
                        assert.ok(names.includes('cocos_2x_skill_reference_read'));
                        assert.match(messages[0].content, /cocos2-scene-composition/);
                        return modelToolResponse(toolCall('skills', 'cocos_2x_skills_list', {}));
                    }
                    if (round === 4) {
                        const listed = JSON.parse(messages.at(-1).content).structuredContent;
                        const entry = listed.data.skills.find((skill) => skill.name === skillName);
                        assert.match(entry.sha256, /^[a-f0-9]{64}$/);
                        assert.ok(entry.references.some((reference) => reference.id === referenceId));
                        return modelToolResponse(toolCall('skill', 'cocos_2x_skill_read', { name: skillName }));
                    }
                    if (round === 5) {
                        const read = JSON.parse(messages.at(-1).content).structuredContent;
                        assert.equal(read.skillName, skillName);
                        assert.match(read.sha256, /^[a-f0-9]{64}$/);
                        assert.match(read.content, /cocos_2x_workflow_plan/);
                        return modelToolResponse(toolCall('reference', 'cocos_2x_skill_reference_read', { skillName, referenceId }));
                    }
                    if (round === 6) {
                        const read = JSON.parse(messages.at(-1).content).structuredContent;
                        assert.equal(read.referenceId, referenceId);
                        assert.match(read.sha256, /^[a-f0-9]{64}$/);
                        assert.match(read.content, /Creator 2\.4\.15/);
                        return modelToolResponse(toolCall('snapshot', 'cocos_2x_scene_snapshot', { projectRoot: value.projects[0], input: {} }));
                    }
                    assert.match(messages.at(-1).content, /nodeCount/);
                    return { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'The scene snapshot was read after loading the matching workflow skill and reference.' } }] };
                },
            });
            assert.equal(result.status, 'completed', JSON.stringify({ result, round, hostMethods,
                modelFailures: agentEvents.filter((event) => event.type === 'model.failed') }));
            assert.equal(result.toolCalls, 6);
            assert.deepEqual(hostMethods, ['instances.list', 'capabilities.list', 'command.execute']);
        });
        const traceText = fs.readFileSync(value.tracePath, 'utf8');
        const events = readTrace(value.tracePath);
        assert.ok(events.some((event) => event.event === 'skills.catalog.loaded' && event.packageVersion === '0.3.1'
            && /^[a-f0-9]{64}$/.test(event.skillsIndexSha256)));
        assert.ok(events.some((event) => event.event === 'skill.read' && event.source === 'model-requested'
            && event.skillName === skillName && /^[a-f0-9]{64}$/.test(event.sha256)));
        assert.ok(events.some((event) => event.event === 'skill.reference.read' && event.referenceId === referenceId
            && /^[a-f0-9]{64}$/.test(event.sha256)));
        assert.equal(traceText.includes('The Creator 2.4.15 multi-step scene composition'), false,
            'skill bodies remain in the model context and are not duplicated into the local run trace');
    } finally { fs.rmSync(value.parent, { recursive: true, force: true }); }
});

test('Plan mode corrects a final answer until this run has fresh setup receipts', async () => {
    const value = fixture();
    const hostMethods = [];
    let rounds = 0;
    const invokeAgent = async (request) => {
        hostMethods.push(request.method);
        if (request.method === 'instances.list') return { id: request.id, result: { success: true, data: [
            { projectRoot: value.projects[0], creatorVersion: '2.4.15', state: 'ready', activeScene: 'helloworld' },
        ] } };
        if (request.method === 'capabilities.list') return { id: request.id, result: { success: true, data: {
            instance: { projectRoot: value.projects[0], creatorVersion: '2.4.15', state: 'ready', activeScene: 'helloworld' },
            commands: [],
        } } };
        throw new Error(`Unexpected host method ${request.method}`);
    };
    try {
        const result = await withMcp([value.projects[0]], invokeAgent, (client) => runDeepSeekAgent({
            client, mode: 'Plan', task: 'Create a reviewable plan.', projectRoots: [value.projects[0]],
            skillFiles: [DEFAULT_SKILL], tracePath: value.tracePath, apiKey: 'test-secret-value',
            callModel: async ({ messages, tools }) => {
                rounds += 1;
                if (rounds === 1) {
                    assert.deepEqual(tools.map((tool) => tool.function.name), ['cocos_2x_instances_list']);
                    return { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: '{"version":1}' } }] };
                }
                if (rounds === 2) {
                    assert.ok(messages.some((message) => message.role === 'system' && message.content.includes('fresh successful instance-list')));
                    return modelToolResponse(toolCall('list', 'cocos_2x_instances_list', {}));
                }
                if (rounds === 3) return modelToolResponse(toolCall('caps', 'cocos_2x_capabilities_list', { projectRoot: value.projects[0] }));
                return { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: '{"version":1,"title":"Plan","summary":"Reviewable.","steps":[{"title":"Step","description":"Review.","preconditions":[],"requiredTools":["cocos_2x_scene_snapshot"],"validation":"Check.","recovery":"Stop if unclear."}]}' } }] };
            },
        }));
        assert.equal(result.status, 'completed', JSON.stringify(result));
        assert.equal(result.reason, 'model_final');
        assert.equal(result.toolCalls, 2);
        assert.deepEqual(hostMethods, ['instances.list', 'capabilities.list']);
        assert.equal(rounds, 4);
        assert.deepEqual(result.receipts.map((receipt) => receipt.name), ['cocos_2x_instances_list', 'cocos_2x_capabilities_list']);
    } finally { fs.rmSync(value.parent, { recursive: true, force: true }); }
});

test('Assistant preserves flattened and wrapped operation receipts', () => {
    const payload = { isError: false, structuredContent: { success: true, outcome: 'completed', operationId: 'op-123' } };
    for (const receipt of [{ name: 'write', callId: 'call', ...payload }, { name: 'write', callId: 'call', result: payload }]) {
        assert.equal(compactReceipt(receipt).operationId, 'op-123');
        assert.equal(compactReceipt(receipt).success, true);
    }
});

test('Assistant never displays an Agent completion claim without a task receipt', () => {
    const text = assistantAnswer({ status: 'stopped', reason: 'model_final_without_success_receipt', finalText: 'Created fake-node with fake-operation-id.' }, 'Agent');
    assert.doesNotMatch(text, /fake-node|fake-operation-id/);
    assert.match(text, /未确认完成/);
});

test('A batched model response is corrected before any tool executes', async () => {
    const value = fixture();
    let rounds = 0;
    let hostCalls = 0;
    try {
        await withMcp(value.projects, async () => { hostCalls += 1; return { result: { success: true, data: [] } }; }, async (client) => {
            const result = await runDeepSeekAgent({ client, mode: 'Ask', task: 'Explain.', projectRoots: value.projects,
                skillFiles: [DEFAULT_SKILL], tracePath: value.tracePath, apiKey: 'test-secret',
                callModel: async ({ messages }) => {
                    rounds += 1;
                    if (rounds === 1) return modelToolResponse(toolCall('a', 'cocos_2x_instances_list', {}), toolCall('b', 'cocos_2x_instances_list', {}));
                    assert.equal(messages.filter((message) => message.role === 'tool' && message.content.includes('SINGLE_TOOL_CALL_REQUIRED')).length, 2);
                    return { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'Explanation only.' } }] };
                } });
            assert.equal(result.status, 'completed');
            assert.equal(hostCalls, 0);
            assert.equal(result.toolCalls, 0);
            assert.equal(rounds, 2);
        });
    } finally { fs.rmSync(value.parent, { recursive: true, force: true }); }
});

test('Creator panel uses messages IPC and resets approval UI after a disconnect', () => {
    let panel;
    const sent = [];
    const sockets = [];
    class FakeSocket {
        static OPEN = 1;
        constructor() { this.readyState = 1; this.listeners = {}; sockets.push(this); }
        addEventListener(name, listener) { this.listeners[name] = listener; }
        send() {}
        close() { this.readyState = 3; this.listeners.close?.(); }
    }
    vm.runInNewContext(fs.readFileSync(path.join(REPOSITORY_ROOT, '2.4.15NewProject/packages/cocos-agent-bridge/panel/index.js'), 'utf8'), {
        Editor: { Panel: { extend(value) { panel = value; } }, Ipc: { sendToMain(...args) { sent.push(args); } } },
        window: { crypto: { randomUUID: () => 'conversation-id' } },
        localStorage: { getItem: () => null, setItem() {} }, WebSocket: FakeSocket,
    });
    for (const name of Object.keys(panel.$)) panel[`$${name}`] = {
        value: '', dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {},
    };
    panel.addActivity = () => {};
    panel.ready();
    assert.equal(sent[0][0], 'cocos-agent-bridge:assistantState');
    panel.messages['assistant-runtime-error'].call(panel, {}, { message: 'Failed' });
    assert.equal(panel.$connect.disabled, false);
    panel.$apiKey.value = 'session-secret';
    panel.messages['assistant-runtime-ready'].call(panel, {}, { port: 1234, token: 'test-token', model: 'deepseek-flash' });
    assert.equal(panel.$apiKey.value, '');
    panel._busy = true;
    panel._pendingApproval = 'approval';
    panel.$send.disabled = true;
    sockets[0].close();
    assert.equal(panel._busy, false);
    assert.equal(panel._pendingApproval, null);
    assert.equal(panel.$send.disabled, false);
    assert.ok(panel._modeButtons.every((button) => button.disabled === false));
});

for (const approved of [false, true]) {
    test(`Agent ${approved ? 'accepts' : 'rejects'} explicit write approval and stops uncertain writes`, async () => {
        const value = fixture();
        let approvalCount = 0;
        let writeCount = 0;
        let round = 0;
        const events = [];
        try {
            await withMcp([value.projects[0]], async (request) => {
                if (request.method === 'instances.list') return { id: request.id, result: { success: true, data: [
                    { projectRoot: value.projects[0], creatorVersion: '2.4.15', state: 'ready', activeScene: 'helloworld' }] } };
                if (request.method === 'capabilities.list') return { id: request.id, result: { success: true, data: {
                    instance: { projectRoot: value.projects[0], creatorVersion: '2.4.15', state: 'ready' },
                    commands: [{ id: 'content.select', access: 'write', status: 'available' }] } } };
                writeCount += 1;
                throw new Error('Transport disconnected');
            }, async (client) => {
                const result = await runDeepSeekAgent({ client, mode: 'Agent', task: 'Select a release.',
                    projectRoots: [value.projects[0]], skillFiles: [DEFAULT_SKILL], tracePath: value.tracePath,
                    apiKey: 'test-secret', allowWrite: true, onEvent: (event) => events.push(event),
                    approveWrite: async () => { approvalCount += 1; return approved; },
                    callModel: async () => {
                        round += 1;
                        if (round === 1) return modelToolResponse(toolCall('instances', 'cocos_2x_instances_list', {}));
                        if (round === 2) return modelToolResponse(toolCall('caps', 'cocos_2x_capabilities_list', { projectRoot: value.projects[0] }));
                        return modelToolResponse(toolCall(`write-${round}`, 'cocos_2x_content_select', { projectRoot: value.projects[0], releaseId: 'demo', expectedCurrent: null }));
                    } });
                assert.equal(approvalCount, 1);
                assert.equal(writeCount, approved ? 1 : 0);
                assert.equal(result.status, approved ? 'needs-review' : 'awaiting-approval');
                if (approved) {
                    const receipt = events.find((event) => event.type === 'tool.finished' && event.toolName === 'cocos_2x_content_select');
                    assert.equal(receipt.result.structuredContent.success, false);
                    assert.equal(receipt.result.structuredContent.error.sideEffect, 'unknown');
                }
            });
        } finally { fs.rmSync(value.parent, { recursive: true, force: true }); }
    });
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
        // Windows chmod only controls the writable attribute, not POSIX owner/group permissions.
        if (process.platform !== 'win32') assert.equal(fs.statSync(value.tracePath).mode & 0o777, 0o600);
        else assert.ok(fs.statSync(value.tracePath).mode & 0o200);
        assert.doesNotMatch(fs.readFileSync(value.tracePath, 'utf8'), /test-secret-value/);
    } finally { fs.rmSync(value.parent, { recursive: true, force: true }); }
});

test('DeepSeek agent accepts a sanitized project alias while validating canonical instance identity', async () => {
    const value = fixture();
    const projectRoot = value.projects[0];
    const projectAlias = path.join(value.parent, 'registered-project');
    fs.symlinkSync(projectRoot, projectAlias, 'dir');
    const toolCalls = [];
    const modelRequests = [];
    const invokeAgent = async (request) => {
        toolCalls.push(request);
        if (request.method === 'instances.list') return { id: request.id, result: { success: true, data: [
            { projectRoot, creatorVersion: '2.4.15', state: 'ready', activeScene: 'LinkUp' },
        ] } };
        if (request.method === 'capabilities.list') return { id: request.id, result: { success: true, data: {
            instance: { projectRoot, creatorVersion: '2.4.15', state: 'ready', activeScene: 'LinkUp' },
            commands: [{ id: 'scene.snapshot', contractVersion: '0.1', access: 'read', status: 'available' }],
        } } };
        if (request.method === 'command.execute') return { id: request.id, result: { success: true, outcome: 'completed',
            command: 'scene.snapshot', data: { sceneName: 'LinkUp', selectedNodes: [] } } };
        throw new Error(`Unexpected host method ${request.method}`);
    };
    const replaceProjectRoot = (valueToReplace) => {
        if (typeof valueToReplace === 'string') return valueToReplace.split(projectRoot).join(projectAlias);
        if (Array.isArray(valueToReplace)) return valueToReplace.map(replaceProjectRoot);
        if (!valueToReplace || typeof valueToReplace !== 'object') return valueToReplace;
        return Object.fromEntries(Object.entries(valueToReplace).map(([key, item]) => [key, replaceProjectRoot(item)]));
    };
    try {
        const result = await withMcp([projectRoot], invokeAgent, async (client) => runDeepSeekAgent({
            client: {
                listTools: async () => replaceProjectRoot(await client.listTools()),
                readResource: async (request) => replaceProjectRoot(await client.readResource(request)),
                callTool: async (request) => replaceProjectRoot(await client.callTool(request)),
            },
            task: 'Read the active scene from the registered project alias.', projectRoots: [projectRoot],
            skillFiles: [DEFAULT_SKILL], tracePath: value.tracePath, apiKey: 'test-secret',
            callModel: async (request) => {
                modelRequests.push(request);
                const serialized = JSON.stringify(request);
                assert.equal(serialized.includes(projectRoot), false);
                if (modelRequests.length === 1) return modelToolResponse(toolCall('instances', 'cocos_2x_instances_list', {}));
                if (modelRequests.length === 2) return modelToolResponse(toolCall('capabilities', 'cocos_2x_capabilities_list', { projectRoot: projectAlias }));
                if (modelRequests.length === 3) return modelToolResponse(toolCall('snapshot', 'cocos_2x_scene_snapshot', { projectRoot: projectAlias, input: {} }));
                assert.match(modelRequests.at(-1).messages.at(-1).content, /LinkUp/);
                return { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'Active scene: LinkUp. No object is selected.' } }] };
            },
        }));
        assert.equal(result.status, 'completed', JSON.stringify(result));
        assert.deepEqual(toolCalls.map((call) => call.method), ['instances.list', 'capabilities.list', 'command.execute']);
        assert.equal(toolCalls[1].params.projectRoot, projectRoot);
        assert.equal(toolCalls[2].params.projectRoot, projectRoot);
        assert.equal(result.finalText, 'Active scene: LinkUp. No object is selected.');
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
    assert.equal(requestBodies[0].max_tokens, 2048);
    assert.deepEqual(requestBodies[0].thinking, { type: 'disabled' });

    await requestDeepSeek({ apiKey: secret, mode: 'Plan', messages: [{ role: 'user', content: 'Generate a short plan.' }], tools: [],
        fetchImpl: async (_url, init) => {
            requestBodies.push(JSON.parse(init.body));
            return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: '{}' } }] }) };
        } });
    assert.equal(requestBodies[1].max_tokens, 4096);

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
