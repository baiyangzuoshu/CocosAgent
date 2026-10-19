import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { createServer } from './mcp-server.mjs';
import { DEFAULT_BASE_URL, appendToolImages, completionEndpoint, normalizeToolResult, parseArgs, requestDeepSeek,
    runDeepSeekAgent, SYSTEM_RULES, toolResultForModel, toolResultForTrace } from './deepseek-agent.mjs';
import { compactReceipt, compactResult, assistantAnswer, projectContextMatchesProject, readRecoveryReceipt } from './assistant-host.mjs';

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DEFAULT_SKILL = path.join(REPOSITORY_ROOT, 'plugins/cocos-agent-2x/skills/cocos-agent/SKILL.md');

test('general explanations distinguish mandatory read-only preflight from project inspection and writes', () => {
    assert.match(SYSTEM_RULES, /Never say that no Creator tools ran when those receipts exist/);
    assert.match(SYSTEM_RULES, /the Host performed read-only instance\/capability preflight/);
    const answer = assistantAnswer({ status: 'completed', finalText: 'Generic explanation. 按你的要求，本次未调用任何 Creator 工具、未读取项目内容。补充说明: Host 执行了预检。', receipts: [
        { name: 'cocos_2x_instances_list', access: 'read' },
        { name: 'cocos_2x_capabilities_list', access: 'read' },
    ] }, 'Ask');
    assert.equal(answer, 'Generic explanation. 本次没有读取项目内容或进行写入；Host 执行了只读实例/能力预检。');
});

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

async function withMcp(projects, invokeAgent, run, options = {}) {
    const server = createServer(projects, { invokeAgent, ...options });
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

test('runtime screenshots are sent only as DeepSeek Flash user images and are omitted from tool JSON and traces', () => {
    const data = Buffer.from('jpeg-payload').toString('base64');
    const result = normalizeToolResult({ structuredContent: { success: true, runtime: { status: 'runtime-error' } },
        content: [{ type: 'image', mimeType: 'image/jpeg', data }] });
    const modelMessages = [{ role: 'tool', content: JSON.stringify(toolResultForModel(result)) }];
    assert.equal(appendToolImages(modelMessages, result, 'deepseek-flash', 'cocos_2x_runtime_observe'), true);
    assert.equal(modelMessages[1].role, 'user', 'DeepSeek Chat Completions accepts images in user messages');
    assert.equal(modelMessages[1].content[1].type, 'image_url');
    assert.equal(modelMessages[1].content[1].image_url.url, `data:image/jpeg;base64,${data}`);
    assert.equal(JSON.stringify(toolResultForModel(result)).includes(data), false);
    const traced = toolResultForTrace(result);
    assert.equal(JSON.stringify(traced).includes(data), false);
    assert.equal(traced.content[0].byteLength, Buffer.from(data, 'base64').byteLength);
    const otherModelMessages = [];
    assert.equal(appendToolImages(otherModelMessages, result, 'deepseek-v4-pro', 'cocos_2x_runtime_observe'), false);
    assert.deepEqual(otherModelMessages, []);
});

test('Creator panel context is bounded to the exact registered project', () => {
    const value = fixture();
    const context = { creatorVersion: '2.4.15', projectRoot: value.projects[0], projectName: 'LinkUpClient',
        activeScene: 'LinkUp', selectionStatus: 'read', selectedNodes: [], projectConventions: { status: 'available' } };
    try {
        assert.equal(projectContextMatchesProject(context, value.projects[0]), true);
        assert.equal(projectContextMatchesProject({ ...context, projectRoot: value.projects[1] }, value.projects[0]), false);
        assert.equal(projectContextMatchesProject({ ...context, creatorVersion: '3.8.7' }, value.projects[0]), false);
        assert.equal(projectContextMatchesProject({ ...context, projectRoot: null }, value.projects[0]), false);
        assert.equal(projectContextMatchesProject(undefined, value.projects[0]), true, 'older panel clients may omit this optional context');
    } finally { fs.rmSync(value.parent, { recursive: true, force: true }); }
});

test('Assistant runtime observation event keeps the diagnostic summary and a bounded panel-only screenshot URL', () => {
    const data = Buffer.from('jpeg-payload').toString('base64');
    const compact = compactResult({ structuredContent: { success: true, outcome: 'observed',
        scene: { name: 'helloworld' }, runtime: { status: 'runtime-error' },
        diagnostics: { errors: [{ message: 'TypeError' }], warnings: [], logs: [] },
        screenshot: { available: true, mimeType: 'image/jpeg' } },
    content: [{ type: 'image', mimeType: 'image/jpeg', data }] });
    assert.equal(compact.runtime.status, 'runtime-error');
    assert.equal(compact.diagnostics.errors[0].message, 'TypeError');
    assert.equal(compact.imageDataUrl, `data:image/jpeg;base64,${data}`);
});

test('Creator Agent observes a runtime error, gets approval for one script patch, then observes the same scene again', async () => {
    const value = fixture();
    const projectRoot = value.projects[0];
    const sceneUuid = '11111111-1111-4111-8111-111111111111';
    const scriptUuid = '22222222-2222-4222-8222-222222222222';
    const sourceSha256 = 'a'.repeat(64);
    const runtimeStatuses = ['runtime-error', 'running'];
    const commands = ['runtime.preview.start', 'script.read', 'script.patch.plan', 'script.patch', 'script.operation.get']
        .map((id) => ({ id, contractVersion: '0.1', access: id === 'script.patch' ? 'write' : 'read', status: 'available' }));
    const hostCalls = [];
    const approvals = [];
    const modelRequests = [];
    const observerInputs = [];
    const image = Buffer.from('bounded-fake-jpeg').toString('base64');
    const observeRuntime = async (input) => {
        observerInputs.push(input);
        const status = runtimeStatuses.shift();
        return { success: true, outcome: 'observed', creatorVersion: '2.4.15',
            scene: { name: 'helloworld', uuid: sceneUuid, matchesExpected: true },
            runtime: { status, frameCount: status === 'running' ? 148 : 83, frameDelta: 12, paused: false,
                capturedErrorCount: status === 'runtime-error' ? 1 : 0 },
            diagnostics: { errors: status === 'runtime-error' ? [{ source: 'console', level: 'error',
                message: 'TypeError: this.target is null', location: { resource: 'HelloWorld.js', line: 42 } }] : [],
                warnings: [], logs: [] }, screenshot: { available: true, mimeType: 'image/jpeg', width: 640, height: 360 },
            screenshotBase64: image };
    };
    const invokeAgent = async (request) => {
        hostCalls.push(request);
        if (request.method === 'instances.list') return { id: request.id, result: { success: true, data: [
            { projectRoot, creatorVersion: '2.4.15', state: 'ready', activeScene: 'helloworld', activeSceneUuid: sceneUuid },
        ] } };
        if (request.method === 'capabilities.list') return { id: request.id, result: { success: true, data: {
            instance: { projectRoot, creatorVersion: '2.4.15', state: 'ready', activeScene: 'helloworld', activeSceneUuid: sceneUuid },
            commands,
        } } };
        if (request.method === 'command.execute') {
            const command = request.params.command;
            if (command === 'script.read') return { id: request.id, result: { success: true, outcome: 'completed', command,
                result: { scriptPath: 'Script/HelloWorld.js', scriptUuid, sourceSha256, source: 'onLoad() { this.target.run(); }' } } };
            if (command === 'script.patch.plan') return { id: request.id, result: { success: true, outcome: 'ready', command,
                result: { expectedDiff: [{ before: 'this.target.run();', after: 'if (!this.target) return; this.target.run();' }], sourceSha256 } } };
            if (command === 'script.patch') return { id: request.id, result: { success: true, outcome: 'needs-runtime', command,
                result: { scriptPath: 'Script/HelloWorld.js', scriptUuid, afterSha256: 'b'.repeat(64),
                    compilation: { status: 'compiled' } } } };
        }
        throw new Error(`Unexpected host method ${request.method}`);
    };
    const calls = [
        toolCall('observe-list', 'cocos_2x_instances_list', {}),
        toolCall('observe-skills', 'cocos_2x_skills_list', {}),
        toolCall('observe-skill', 'cocos_2x_skill_read', { name: 'cocos2-runtime-observation' }),
        toolCall('observe-capabilities', 'cocos_2x_capabilities_list', { projectRoot }),
        toolCall('observe-contract', 'cocos_2x_skill_reference_read', {
            skillName: 'cocos2-runtime-observation', referenceId: 'agent-foundation/cocos-agent-runtime-observation-0.1.md',
        }),
        toolCall('observe-before', 'cocos_2x_runtime_observe', { projectRoot, expectedScene: 'helloworld' }),
        toolCall('read-script', 'cocos_2x_script_read', { projectRoot, input: { scriptPath: 'Script/HelloWorld.js' } }),
        toolCall('plan-patch', 'cocos_2x_script_patch_plan', { projectRoot, input: {
            scriptPath: 'Script/HelloWorld.js', scriptUuid, expectedSha256: sourceSha256,
            edits: [{ before: 'this.target.run();', after: 'if (!this.target) return; this.target.run();' }],
        } }),
        toolCall('apply-patch', 'cocos_2x_script_patch', { projectRoot, input: {
            action: 'apply', operationId: '33333333-3333-4333-8333-333333333333', scriptPath: 'Script/HelloWorld.js',
            scriptUuid, expectedSha256: sourceSha256,
            edits: [{ before: 'this.target.run();', after: 'if (!this.target) return; this.target.run();' }],
        } }),
        toolCall('observe-after', 'cocos_2x_runtime_observe', { projectRoot, expectedScene: 'helloworld' }),
    ];
    let modelRound = 0;
    try {
        const result = await withMcp([projectRoot], invokeAgent, (client) => runDeepSeekAgent({
            client, mode: 'Agent', task: '运行时报错，请依据证据做最小脚本修复并复查。',
            projectRoots: [projectRoot], skillFiles: [DEFAULT_SKILL], tracePath: value.tracePath, apiKey: 'test-secret-value',
            allowWrite: true,
            maxTurns: 12,
            approveWrite: async (tool, args) => { approvals.push({ tool: tool.name, args }); return true; },
            callModel: async (request) => {
                modelRequests.push(request);
                const call = calls[modelRound++];
                if (call) return modelToolResponse(call);
                return { id: 'runtime-repair-final', choices: [{ finish_reason: 'stop', message: { role: 'assistant',
                    content: '发现空引用错误；已批准并应用窄范围修复，Creator 编译成功。同一场景复查后无错误且帧继续推进。' } }] };
            },
        }), { observeRuntime });

        assert.equal(result.status, 'completed', JSON.stringify(result));
        assert.equal(result.reason, 'model_final');
        assert.equal(result.toolCalls, 10);
        assert.deepEqual(observerInputs.map((input) => [input.expectedScene, input.expectedSceneUuid]), [
            ['helloworld', sceneUuid], ['helloworld', sceneUuid],
        ]);
        assert.deepEqual(hostCalls.filter((call) => call.method === 'command.execute').map((call) => call.params.command), [
            'script.read', 'script.patch.plan', 'script.patch',
        ]);
        assert.equal(approvals.length, 1);
        assert.equal(approvals[0].tool, 'cocos_2x_script_patch');
        assert.equal(modelRequests.some((request) => request.messages.some((message) => message.role === 'user'
            && Array.isArray(message.content) && message.content.some((part) => part.type === 'image_url'))), true,
        'the vision model receives the runtime screenshot as an image input');
        const events = readTrace(value.tracePath);
        assert.deepEqual(events.filter((event) => event.event === 'tool.call').map((event) => event.name), calls.map((call) => call.function.name));
        assert.equal(events.filter((event) => event.event === 'tool.image-forwarded').length, 2);
        assert.doesNotMatch(fs.readFileSync(value.tracePath, 'utf8'), /bounded-fake-jpeg/);
    } finally { fs.rmSync(value.parent, { recursive: true, force: true }); }
});

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
                    projectContext: { creatorVersion: '2.4.15', projectName: 'LinkUpClient', activeScene: 'LinkUp',
                        selectionStatus: 'read', selectedNodes: [{ status: 'found', uuid: 'node-123', path: 'LinkUp/Canvas/Start',
                            name: 'Start', active: true, components: ['cc.Button'] }],
                        projectRoot: '/private/user/LinkUpClient', projectConventions: { status: 'available', sha256: 'a'.repeat(64) },
                        instructionsContent: 'do-not-send-this-project-file' },
                    callModel: async (request) => {
                        assert.ok(request.tools.length > 0);
                        assert.ok(request.tools.every((tool) => readonly.has(tool.function.name)));
                        assert.ok(request.messages.some((message) => message.content === 'Previous answer'));
                        const panelContext = request.messages.find((message) => message.role === 'user'
                            && typeof message.content === 'string' && message.content.includes('Current Creator panel context'));
                        assert.ok(panelContext, 'each turn receives the refreshed bounded panel context');
                        assert.match(panelContext.content, /"activeScene":"LinkUp"/);
                        assert.match(panelContext.content, /"path":"LinkUp\/Canvas\/Start"/);
                        assert.doesNotMatch(panelContext.content, /private\/user|do-not-send-this-project-file|"sha256"/);
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

test('each follow-up uses the refreshed selection context without persisting the previous selection hint', async () => {
    const value = fixture();
    const seen = [];
    const contextFor = (uuid, name) => ({ creatorVersion: '2.4.15', projectRoot: value.projects[0], projectName: 'LinkUpClient',
        activeScene: 'LinkUp', selectionStatus: 'read', selectedNodes: [{ status: 'found', uuid, path: `LinkUp/Canvas/${name}`,
            name, active: true, components: ['cc.Button'] }], projectConventions: { status: 'available' } });
    try {
        await withMcp([value.projects[0]], async () => { throw new Error('A conversational Ask should not need a tool call.'); }, async (client) => {
            const ask = (task, projectContext, history = []) => runDeepSeekAgent({ client, mode: 'Ask', task,
                projectRoots: [value.projects[0]], skillFiles: [DEFAULT_SKILL], tracePath: value.tracePath, apiKey: 'test-secret',
                projectContext, history, callModel: async (request) => {
                    seen.push(request.messages);
                    return { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: '只读回答。' } }] };
                } });
            const first = await ask('说明当前选择。', contextFor('old-selection-uuid', 'OldButton'));
            assert.equal(first.status, 'completed');
            const second = await ask('沿用刚才的上下文继续说明。', contextFor('new-selection-uuid', 'NewButton'), [
                { role: 'user', content: '说明当前选择。' }, { role: 'assistant', content: '上一轮只读回答。' },
            ]);
            assert.equal(second.status, 'completed');
        });
        const lastContext = seen[1].find((message) => message.role === 'user'
            && typeof message.content === 'string' && message.content.includes('Current Creator panel context'));
        assert.ok(lastContext);
        assert.match(lastContext.content, /new-selection-uuid/);
        assert.doesNotMatch(lastContext.content, /old-selection-uuid|OldButton/);
        assert.deepEqual(seen[1].filter((message) => typeof message.content === 'string'
            && message.content.includes('Current Creator panel context')).length, 1);
    } finally { fs.rmSync(value.parent, { recursive: true, force: true }); }
});

test('Agent must read the current project conventions before an approved project write', async () => {
    const value = fixture();
    const hostMethods = [];
    const approvals = [];
    const conventionText = '# Project convention fixture\nAll LinkUpClient changes use existing naming and avoid unrelated scene edits.\n';
    fs.writeFileSync(path.join(value.projects[0], 'AGENTS.md'), conventionText);
    const conventionSha = crypto.createHash('sha256').update(conventionText).digest('hex');
    let round = 0;
    const calls = [];
    try {
        const invokeAgent = async (request) => {
            hostMethods.push(request.method);
            if (request.method === 'instances.list') return { id: request.id, result: { success: true, data: [
                { projectRoot: value.projects[0], creatorVersion: '2.4.15', state: 'ready', activeScene: 'LinkUp' },
            ] } };
            if (request.method === 'capabilities.list') return { id: request.id, result: { success: true, data: {
                instance: { projectRoot: value.projects[0], creatorVersion: '2.4.15', state: 'ready' },
                commands: [{ id: 'content.select', access: 'write', status: 'available' }],
            } } };
            if (request.method === 'content.select') return { id: request.id, result: { success: true, outcome: 'completed',
                command: 'content.select', data: { releaseId: 'demo-release' } } };
            throw new Error(`Unexpected Host method: ${request.method}`);
        };
        const result = await withMcp([value.projects[0]], invokeAgent, (client) => runDeepSeekAgent({
            client, mode: 'Agent', task: 'Select the requested release after reviewing this project.',
            projectRoots: [value.projects[0]], skillFiles: [DEFAULT_SKILL], tracePath: value.tracePath, apiKey: 'test-secret',
            projectContext: { creatorVersion: '2.4.15', projectRoot: value.projects[0], projectName: 'LinkUpClient',
                activeScene: 'LinkUp', selectionStatus: 'read', selectedNodes: [],
                projectConventions: { status: 'available', sha256: conventionSha } },
            allowWrite: true,
            approveWrite: async (tool) => { approvals.push(tool.name); return true; },
            callModel: async ({ messages, tools }) => {
                round += 1;
                if (round === 1) return modelToolResponse(toolCall('list', 'cocos_2x_instances_list', {}));
                if (round === 2) return modelToolResponse(toolCall('capabilities', 'cocos_2x_capabilities_list', { projectRoot: value.projects[0] }));
                if (round === 3) return modelToolResponse(toolCall('premature-write', 'cocos_2x_content_select', {
                    projectRoot: value.projects[0], releaseId: 'demo-release', expectedCurrent: null,
                }));
                if (round === 4) {
                    assert.ok(messages.some((message) => typeof message.content === 'string'
                        && message.content.includes('PROJECT_INSTRUCTIONS_REQUIRED')));
                    assert.equal(approvals.length, 0, 'the blocked write must not request user approval');
                    return modelToolResponse(toolCall('read-conventions', 'cocos_2x_project_instructions_read', { projectRoot: value.projects[0] }));
                }
                if (round === 5) {
                    assert.match(messages.at(-1).content, /All LinkUpClient changes use existing naming/);
                    return modelToolResponse(toolCall('approved-write', 'cocos_2x_content_select', {
                        projectRoot: value.projects[0], releaseId: 'demo-release', expectedCurrent: null,
                    }));
                }
                assert.match(messages.at(-1).content, /demo-release/);
                return { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: '已根据工程约定完成选择并读回回执。' } }] };
            },
        }));
        assert.equal(result.status, 'completed', JSON.stringify(result));
        assert.deepEqual(approvals, ['cocos_2x_content_select']);
        assert.deepEqual(hostMethods, ['instances.list', 'capabilities.list', 'content.select']);
        const trace = fs.readFileSync(value.tracePath, 'utf8');
        assert.match(trace, /project_instructions_not_read/);
        assert.match(trace, /"event":"tool\.call"[^\n]*"name":"cocos_2x_project_instructions_read"/);
        assert.doesNotMatch(trace, /All LinkUpClient changes use existing naming/);

        let staleRound = 0;
        const stale = await withMcp([value.projects[0]], invokeAgent, (client) => runDeepSeekAgent({
            client, mode: 'Agent', task: 'Plan a project write.', projectRoots: [value.projects[0]],
            skillFiles: [DEFAULT_SKILL], tracePath: path.join(value.parent, 'stale-run.jsonl'), apiKey: 'test-secret',
            projectContext: { creatorVersion: '2.4.15', projectRoot: value.projects[0], projectName: 'LinkUpClient',
                activeScene: 'LinkUp', selectionStatus: 'read', selectedNodes: [],
                projectConventions: { status: 'available', sha256: '0'.repeat(64) } },
            allowWrite: true,
            callModel: async () => {
                staleRound += 1;
                if (staleRound === 1) return modelToolResponse(toolCall('stale-list', 'cocos_2x_instances_list', {}));
                if (staleRound === 2) return modelToolResponse(toolCall('stale-capabilities', 'cocos_2x_capabilities_list', { projectRoot: value.projects[0] }));
                return modelToolResponse(toolCall('stale-instructions', 'cocos_2x_project_instructions_read', { projectRoot: value.projects[0] }));
            },
        }));
        assert.equal(stale.reason, 'project_context_stale');
        assert.deepEqual(approvals, ['cocos_2x_content_select'], 'a changed project convention file must stop before another write approval');
        assert.deepEqual(hostMethods, ['instances.list', 'capabilities.list', 'content.select', 'instances.list', 'capabilities.list'],
            'stale context must not reach a second write command');
    } finally { fs.rmSync(value.parent, { recursive: true, force: true }); }
});

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
                        return modelToolResponse(toolCall('wrong-reference', 'cocos_2x_skill_reference_read', {
                            skillName, referenceId: 'agent-foundation/cocos-agent-plan-business-acceptance-0.1.md',
                        }));
                    }
                    if (round === 6) {
                        const failed = JSON.parse(messages.at(-1).content).structuredContent;
                        assert.equal(failed.error.code, 'SKILL_REFERENCE_NOT_DECLARED');
                        assert.deepEqual(failed.error.allowedReferenceIds, ['agent-foundation/scene-composition-0.1.md']);
                        return modelToolResponse(toolCall('reference', 'cocos_2x_skill_reference_read', { skillName, referenceId }));
                    }
                    if (round === 7) {
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
            assert.equal(result.toolCalls, 7);
            assert.deepEqual(hostMethods, ['instances.list', 'capabilities.list', 'command.execute']);
        });
        const traceText = fs.readFileSync(value.tracePath, 'utf8');
        const events = readTrace(value.tracePath);
        assert.ok(events.some((event) => event.event === 'skills.catalog.loaded' && event.packageVersion === JSON.parse(fs.readFileSync(path.join(REPOSITORY_ROOT, 'plugins/cocos-agent-2x/agent-package.json'), 'utf8')).version
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

test('recovery reads the live instance and capability contract before the exact operation receipt', async () => {
    const projectRoot = '/tmp/cocos-recovery-project';
    const operationId = '33333333-3333-4333-8333-333333333333';
    const calls = [];
    const client = { async callTool(request) {
        calls.push(request);
        if (request.name === 'cocos_2x_instances_list') return { structuredContent: { success: true, data: [
            { projectRoot, creatorVersion: '2.4.15', state: 'ready' },
        ] } };
        if (request.name === 'cocos_2x_capabilities_list') return { structuredContent: { success: true, data: {
            instance: { projectRoot, creatorVersion: '2.4.15', state: 'ready' },
            commands: [{ id: 'script.operation.get', status: 'available' }],
        } } };
        return { structuredContent: { success: true, outcome: 'completed', operationId } };
    } };
    const receipt = await readRecoveryReceipt(client, projectRoot, 'cocos_2x_script_operation_get', operationId);
    assert.equal(receipt.outcome, 'completed');
    assert.deepEqual(calls.map((call) => call.name), [
        'cocos_2x_instances_list', 'cocos_2x_capabilities_list', 'cocos_2x_script_operation_get',
    ]);
    assert.deepEqual(calls[1].arguments, { projectRoot });
    assert.deepEqual(calls[2].arguments, { projectRoot, input: { operationId } },
        'script operation tool receives its required projectRoot and nested input contract');
});

test('scene ledger recovery does not require Host operation.get to appear in the Creator command catalog', async () => {
    const projectRoot = '/tmp/cocos-recovery-project';
    const operationId = '33333333-3333-4333-8333-333333333333';
    const calls = [];
    const client = { async callTool(request) {
        calls.push(request);
        if (request.name === 'cocos_2x_instances_list') return { structuredContent: { success: true, data: [
            { projectRoot, creatorVersion: '2.4.15', state: 'ready' },
        ] } };
        if (request.name === 'cocos_2x_capabilities_list') return { structuredContent: { success: true, data: {
            instance: { projectRoot, creatorVersion: '2.4.15', state: 'ready' },
            commands: [{ id: 'script.operation.get', status: 'available' }],
        } } };
        return { structuredContent: { success: true, outcome: 'completed', operationId } };
    } };
    const receipt = await readRecoveryReceipt(client, projectRoot, 'cocos_2x_operation_get', operationId);
    assert.equal(receipt.outcome, 'completed');
    assert.deepEqual(calls.map((call) => call.name), [
        'cocos_2x_instances_list', 'cocos_2x_capabilities_list', 'cocos_2x_operation_get',
    ]);
    assert.deepEqual(calls[2].arguments, { projectRoot, operationId });
});

test('memory recovery reads only the canonical project memory ledger and accepts exact provider call IDs', async () => {
    const value = fixture();
    const operationId = 'call-memory-write-73';
    const projectKey = crypto.createHash('sha256').update(fs.realpathSync(value.projects[0])).digest('hex');
    const memoryStore = {
        projectKey,
        async load() {
            return {
                version: 1, projectKey, revision: 1,
                memories: [{ id: 'memory-1', revision: 1, title: 'Canvas design', body: '640 by 960 portrait.',
                    category: 'project-fact', sources: [{ kind: 'user', runId: 'run-1', messageIndex: 0,
                        quote: '640 by 960 portrait', recordedAt: '2026-10-12T12:00:00.000Z' }] }],
                operations: [{ operationId, action: 'remember', memoryId: 'memory-1', outcome: 'remembered', revision: 1,
                    timestamp: '2026-10-12T12:00:00.000Z' }],
                tombstones: [],
            };
        },
    };
    try {
        const receipt = await readRecoveryReceipt({ callTool: async () => { throw new Error('Creator must not be queried for local memory recovery'); } },
            value.projects[0], 'cocos_2x_memory_operation_get', operationId, memoryStore);
        assert.equal(receipt.operationId, operationId);
        assert.equal(receipt.outcome, 'remembered');
        assert.equal(receipt.memory.sources[0].runId, 'run-1');
        await assert.rejects(readRecoveryReceipt({}, value.projects[1], 'cocos_2x_memory_operation_get', operationId, memoryStore),
            /MEMORY_RECOVERY_PROJECT_MISMATCH/);
        const noEffect = await readRecoveryReceipt({}, value.projects[0], 'cocos_2x_memory_operation_get', 'call-not-written', memoryStore);
        assert.equal(noEffect.outcome, 'no-effect');
    } finally { fs.rmSync(value.parent, { recursive: true, force: true }); }
});

test('script ledger recovery still requires the Creator script.operation.get capability', async () => {
    const projectRoot = '/tmp/cocos-recovery-project';
    const operationId = '33333333-3333-4333-8333-333333333333';
    const calls = [];
    const client = { async callTool(request) {
        calls.push(request.name);
        if (request.name === 'cocos_2x_instances_list') return { structuredContent: { success: true, data: [
            { projectRoot, creatorVersion: '2.4.15', state: 'ready' },
        ] } };
        return { structuredContent: { success: true, data: {
            instance: { projectRoot, creatorVersion: '2.4.15', state: 'ready' },
            commands: [{ id: 'script.operation.get', status: 'unavailable' }],
        } } };
    } };
    await assert.rejects(readRecoveryReceipt(client, projectRoot, 'cocos_2x_script_operation_get', operationId), /RECOVERY_CAPABILITY_NOT_AVAILABLE/);
    assert.deepEqual(calls, ['cocos_2x_instances_list', 'cocos_2x_capabilities_list']);
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

test('uncertain script.create permits only its original reconcile action without a second write approval', async () => {
    const value = fixture();
    const operationId = '7a7aa726-71e8-4ce9-867f-27d89b350130';
    const calls = [];
    let round = 0;
    let approvalCount = 0;
    const invokeAgent = async (request) => {
        calls.push(request);
        if (request.method === 'instances.list') return { id: request.id, result: { success: true, data: [
            { projectRoot: value.projects[0], creatorVersion: '2.4.15', state: 'ready', activeScene: 'TankArena' },
        ] } };
        if (request.method === 'capabilities.list') return { id: request.id, result: { success: true, data: {
            instance: { projectRoot: value.projects[0], creatorVersion: '2.4.15', state: 'ready' },
            commands: [{ id: 'script.create', access: 'write', status: 'available' }],
        } } };
        if (request.method === 'command.execute' && request.params.command === 'script.create') {
            if (request.params.input.action === 'apply') return { id: request.id, result: { success: false, outcome: 'needs-review', command: 'script.create',
                operationId, error: { code: 'SCRIPT_COMPILE_TIMEOUT', sideEffect: 'possible' } } };
            if (request.params.input.action === 'reconcile') return { id: request.id, result: { success: true, outcome: 'needs-runtime', command: 'script.create',
                operationId, record: { state: 'completed' } } };
        }
        throw new Error(`Unexpected dispatch ${request.method}`);
    };
    try {
        const result = await withMcp([value.projects[0]], invokeAgent, (client) => runDeepSeekAgent({
            client, mode: 'Agent', task: 'Create a script and reconcile its exact operation after an uncertain receipt.',
            projectRoots: [value.projects[0]], skillFiles: [DEFAULT_SKILL], tracePath: value.tracePath,
            apiKey: 'test-secret', allowWrite: true, approveWrite: async () => { approvalCount += 1; return true; },
            callModel: async () => {
                round += 1;
                if (round === 1) return modelToolResponse(toolCall('instances', 'cocos_2x_instances_list', {}));
                if (round === 2) return modelToolResponse(toolCall('caps', 'cocos_2x_capabilities_list', { projectRoot: value.projects[0] }));
                if (round === 3) return modelToolResponse(toolCall('create', 'cocos_2x_command_execute', { projectRoot: value.projects[0],
                    command: 'script.create', input: { action: 'apply', operationId, scriptPath: 'TankGame.ts', source: 'cc.Class({ extends: cc.Component });' } }));
                if (round === 4) return modelToolResponse(toolCall('reconcile', 'cocos_2x_script_create_reconcile', {
                    projectRoot: value.projects[0], operationId }));
                return { id: 'final', choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'The original operation is reconciled.' } }] };
            },
        }));
        assert.equal(result.status, 'completed');
        assert.equal(approvalCount, 2, 'the original write and its recovery each pass the local approval gate');
        const writes = calls.filter((call) => call.method === 'command.execute');
        assert.equal(writes.length, 2);
        assert.deepEqual(writes.map((call) => call.params.input.action), ['apply', 'reconcile']);
        assert.ok(writes.every((call) => call.params.input.operationId === operationId));
    } finally { fs.rmSync(value.parent, { recursive: true, force: true }); }
});

test('uncertain script.create blocks a different operation ID while recovery is required', async () => {
    const value = fixture();
    const operationId = '7a7aa726-71e8-4ce9-867f-27d89b350131';
    const calls = [];
    let round = 0;
    const invokeAgent = async (request) => {
        calls.push(request);
        if (request.method === 'instances.list') return { id: request.id, result: { success: true, data: [
            { projectRoot: value.projects[0], creatorVersion: '2.4.15', state: 'ready', activeScene: 'TankArena' },
        ] } };
        if (request.method === 'capabilities.list') return { id: request.id, result: { success: true, data: {
            instance: { projectRoot: value.projects[0], creatorVersion: '2.4.15', state: 'ready' },
            commands: [{ id: 'script.create', access: 'write', status: 'available' }, { id: 'scene.node.create', access: 'write', status: 'available' }],
        } } };
        if (request.method === 'command.execute') return { id: request.id, result: { success: false, outcome: 'needs-review', command: 'script.create',
            operationId, error: { code: 'SCRIPT_COMPILE_TIMEOUT', sideEffect: 'possible' } } };
        throw new Error(`Unexpected dispatch ${request.method}`);
    };
    try {
        const result = await withMcp([value.projects[0]], invokeAgent, (client) => runDeepSeekAgent({
            client, mode: 'Agent', task: 'Create a script.', projectRoots: [value.projects[0]],
            skillFiles: [DEFAULT_SKILL], tracePath: value.tracePath, apiKey: 'test-secret', allowWrite: true,
            approveWrite: async () => true,
            callModel: async () => {
                round += 1;
                if (round === 1) return modelToolResponse(toolCall('instances', 'cocos_2x_instances_list', {}));
                if (round === 2) return modelToolResponse(toolCall('caps', 'cocos_2x_capabilities_list', { projectRoot: value.projects[0] }));
                if (round === 3) return modelToolResponse(toolCall('create', 'cocos_2x_command_execute', { projectRoot: value.projects[0],
                    command: 'script.create', input: { action: 'apply', operationId, scriptPath: 'TankGame.ts', source: 'cc.Class({ extends: cc.Component });' } }));
                return modelToolResponse(toolCall('wrong-operation', 'cocos_2x_command_execute', { projectRoot: value.projects[0],
                    command: 'script.create', input: { action: 'compensate', operationId: '8a8a8a8a-8888-4888-8888-888888888888' } }));
            },
        }));
        assert.equal(result.status, 'needs-review');
        assert.equal(calls.filter((call) => call.method === 'command.execute').length, 1, 'blocked write never reaches Creator');
        assert.equal(result.reason, 'unresolved_operation_receipt');
    } finally { fs.rmSync(value.parent, { recursive: true, force: true }); }
});

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

test('DeepSeek agent accepts a sanitized project alias while validating canonical instance identity', async (t) => {
    const value = fixture();
    const projectRoot = value.projects[0];
    const projectAlias = path.join(value.parent, 'registered-project');
    try { fs.symlinkSync(projectRoot, projectAlias, process.platform === 'win32' ? 'junction' : 'dir'); }
    catch (error) {
        fs.rmSync(value.parent, { recursive: true, force: true });
        if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) {
            t.skip('The Windows sandbox does not permit directory aliases; run this case on a host with junction/symlink permission.');
            return;
        }
        throw error;
    }
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

test('cancel during an in-flight approved write waits for its receipt and prevents subsequent model calls', async () => {
    const value = fixture();
    const projectRoot = value.projects[0];
    const controller = new AbortController();
    let writeStarted;
    const started = new Promise((resolve) => { writeStarted = resolve; });
    let releaseWrite;
    const writeGate = new Promise((resolve) => { releaseWrite = resolve; });
    let modelCalls = 0;
    const operationId = '33333333-3333-4333-8333-333333333333';
    const invokeAgent = async (request) => {
        if (request.method === 'instances.list') return { id: request.id, result: { success: true, data: [
            { projectRoot, creatorVersion: '2.4.15', state: 'ready' },
        ] } };
        if (request.method === 'capabilities.list') return { id: request.id, result: { success: true, data: {
            instance: { projectRoot, creatorVersion: '2.4.15', state: 'ready' },
            commands: [{ id: 'script.patch', access: 'write', status: 'available' }],
        } } };
        if (request.method === 'command.execute') {
            writeStarted();
            await writeGate;
            return { id: request.id, result: { success: true, outcome: 'completed', command: 'script.patch', operationId } };
        }
        throw new Error(`Unexpected method ${request.method}`);
    };
    const runPromise = withMcp([projectRoot], invokeAgent, (client) => runDeepSeekAgent({
        client, mode: 'Agent', task: 'Apply this approved script patch.', projectRoots: [projectRoot],
        skillFiles: [DEFAULT_SKILL], tracePath: value.tracePath, apiKey: 'test-secret-value', allowWrite: true,
        signal: controller.signal, approveWrite: async () => true,
        callModel: async () => {
            modelCalls += 1;
            if (modelCalls === 1) return modelToolResponse(toolCall('instances', 'cocos_2x_instances_list', {}));
            if (modelCalls === 2) return modelToolResponse(toolCall('capabilities', 'cocos_2x_capabilities_list', { projectRoot }));
            if (modelCalls === 3) return modelToolResponse(toolCall('write', 'cocos_2x_command_execute', { projectRoot,
                command: 'script.patch', input: { action: 'apply', operationId, scriptPath: 'Script/HelloWorld.js',
                    scriptUuid: '22222222-2222-4222-8222-222222222222', expectedSha256: 'a'.repeat(64),
                    edits: [{ before: 'old();', after: 'new();' }] } }));
            throw new Error('a follow-up model turn must not occur after cancel');
        },
    }));
    try {
        await started;
        controller.abort();
        releaseWrite();
        const result = await runPromise;
        assert.equal(result.status, 'cancelled');
        assert.equal(result.reason, 'user_cancelled');
        assert.equal(modelCalls, 3);
        assert.equal(result.receipts.at(-1).structuredContent.operationId, operationId);
    } finally { releaseWrite(); fs.rmSync(value.parent, { recursive: true, force: true }); }
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
