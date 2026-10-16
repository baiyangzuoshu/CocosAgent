import assert from 'node:assert/strict';
import test from 'node:test';
import { runCreatorAgent, runCreatorReadOnly } from '../dist/creator-host-adapter.js';
import { hasPlanSetupReceipts } from '../../cocos-agent-bridge/mcp/assistant-plan-service.mjs';

const projectRoot = '/tmp/cocos-creator-adapter-project';

function intentResponse(request, kind, reads = [], verification = 'none') {
    const body = JSON.parse(request.body);
    if (!body.messages[0]?.content.startsWith('COCOS_TASK_INTENT_V1')) return null;
    assert.deepEqual(body.tools, []);
    const { task } = JSON.parse(body.messages.at(-1).content);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ version: 1,
        task, kind, sourceQuotes: [task], reads, targets: [], verification, question: '' }) }, finish_reason: 'stop' }] }), { status: 200 });
}

function definition(name, readOnlyHint = true) {
    return {
        name,
        description: name,
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint },
    };
}

test('Creator Plan adapter returns preflight receipts and the live tool catalog for strict plan validation', async () => {
    const definitions = [
        definition('cocos_2x_instances_list'),
        definition('cocos_2x_capabilities_list'),
        definition('cocos_2x_skills_list'),
        definition('cocos_2x_skill_read'),
        definition('cocos_2x_skill_reference_read'),
        definition('cocos_2x_asset_search_png'),
        definition('cocos_2x_command_execute', false),
        definition('cocos_2x_operation_get'),
    ];
    const calls = [];
    const skillCalls = [];
    const events = [];
    const trace = [];
    const client = {
        listTools: async () => ({ tools: definitions }),
        callTool: async ({ name, arguments: args }) => {
            calls.push({ name, args });
            if (name === 'cocos_2x_instances_list') return { structuredContent: { success: true, data: [
                { projectRoot, creatorVersion: '2.4.15', state: 'ready' },
            ] } };
            if (name === 'cocos_2x_capabilities_list') return { structuredContent: { success: true, data: {
                instance: { projectRoot, creatorVersion: '2.4.15', state: 'ready' }, commands: [],
            } } };
            throw new Error(`Unexpected MCP call: ${name}`);
        },
    };
    const skillAdapter = {
        REQUIRED_COMMAND: new Map(),
        loadContext: async () => ({
            toolsByName: new Map(definitions.map((item) => [item.name, item])),
            skillIndex: {},
            messages: [{ role: 'system', content: 'Creator test prompt' }],
        }),
        invokeSkillTool: async (_client, _skillIndex, name, args) => {
            skillCalls.push({ name, args });
            if (name === 'cocos_2x_skills_list') return { structuredContent: { success: true, data: { skills: [] } } };
            if (name === 'cocos_2x_skill_read') return { structuredContent: { success: true,
                skillName: 'cocos2-resource-scene-pipeline', references: [{ id: 'agent-foundation/cocos-agent-resource-scene-pipeline-0.1.md' }] } };
            if (name === 'cocos_2x_skill_reference_read') return { structuredContent: { success: true,
                skillName: args.skillName, referenceId: args.referenceId } };
            throw new Error(`Unexpected skill tool: ${name}`);
        },
    };
    const plan = JSON.stringify({
        version: 1,
        title: '审查现有 PNG',
        summary: '只读核对候选图片和场景条件。',
        steps: [{
            title: '核对候选资源',
            description: '查询现有 PNG 与 AssetDB 身份。',
            preconditions: ['Creator 2.4.15 工程已就绪。'],
            requiredTools: ['cocos_2x_asset_search_png'],
            validation: '确认 UUID 与元数据一致。',
            recovery: '只读步骤失败时停止并报告。',
        }],
    });
    let requestRound = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, request) => {
        const body = JSON.parse(request.body);
        requestRound += 1;
        assert.equal(body.model, 'deepseek-flash');
        assert.ok(body.messages.some((message) => message.content.includes('Host-verified read-only Creator preflight receipts')));
        const systemPrompt = body.messages.find((message) => message.role === 'system').content;
        assert.match(systemPrompt, /cocos_2x_command_execute \[write\]/);
        assert.match(systemPrompt, /cocos_2x_operation_get \[read\]/);
        assert.match(systemPrompt, /never list cocos_2x_instances_list, cocos_2x_instances_get, or cocos_2x_capabilities_list/);
        assert.match(systemPrompt, /Before finalizing a task-specific plan, use cocos_2x_skills_list/);
        assert.match(systemPrompt, /asset\.validatePng tool requires an existing pipelineId/);
        assert.match(systemPrompt, /workflow\.plan is only for its supported multi-node workflow/);
        assert.match(systemPrompt, /runtime\.preview\.start through command execution/);
        const toolResponse = (id, name, args) => ({ choices: [{ message: { tool_calls: [{ id, type: 'function',
            function: { name, arguments: JSON.stringify(args) } }] }, finish_reason: 'tool_calls' }] });
        const payload = requestRound === 1 ? { choices: [{ message: { content: plan }, finish_reason: 'stop' }] }
            : requestRound === 2 ? toolResponse('skills-list', 'cocos_2x_skills_list', {})
                : requestRound === 3 ? toolResponse('skill-read', 'cocos_2x_skill_read', { name: 'cocos2-resource-scene-pipeline' })
                    : requestRound === 4 ? toolResponse('reference-read', 'cocos_2x_skill_reference_read', {
                        skillName: 'cocos2-resource-scene-pipeline',
                        referenceId: 'agent-foundation/cocos-agent-resource-scene-pipeline-0.1.md',
                    })
                        : { choices: [{ message: { content: plan }, finish_reason: 'stop' }] };
        return new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'content-type': 'application/json' },
        });
    };
    try {
        const result = await runCreatorReadOnly({
            client,
            task: '只读检查 PNG 并制定计划',
            projectRoot,
            skillFiles: [],
            tracePath: '/tmp/cocos-agent-adapter-test.jsonl',
            apiKey: 'test-key-for-adapter-only',
            model: 'deepseek-flash',
            mode: 'Plan',
            history: [],
            projectContext: null,
            onEvent: (event) => events.push(event),
            skillAdapter,
            formatProjectContext: () => null,
            writeEvent: (_path, event) => trace.push(event),
        });

        assert.equal(result.status, 'completed', `reason=${result.reason}; skills=${JSON.stringify(skillCalls)}`);
        assert.equal(hasPlanSetupReceipts(result.receipts), true);
        assert.deepEqual(result.availableToolNames, definitions.map(({ name }) => name));
        assert.deepEqual(result.receipts.slice(0, 2).map(({ name }) => name), [
            'cocos_2x_instances_list', 'cocos_2x_capabilities_list',
        ]);
        assert.ok(result.receipts.slice(0, 2).every((receipt) => receipt.structuredContent?.success === true));
        assert.ok(result.receipts.slice(0, 2).every((receipt) => receipt.result?.structuredContent?.success === true));
        assert.deepEqual(calls.map(({ name }) => name), [
            'cocos_2x_instances_list', 'cocos_2x_capabilities_list',
        ]);
        assert.deepEqual(skillCalls.map(({ name }) => name), [
            'cocos_2x_skills_list', 'cocos_2x_skill_read', 'cocos_2x_skill_reference_read',
        ]);
        assert.ok(events.some((event) => event.type === 'tool.started' && event.toolName === 'cocos_2x_instances_list'));
        assert.ok(events.some((event) => event.type === 'tool.finished' && event.toolName === 'cocos_2x_capabilities_list'));
        assert.equal(trace[0].event, 'run.start');
        assert.equal(trace.at(-1).event, 'run.stop');
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('Creator Agent persists approved project memory and recalls it in a later request', async () => {
    const projectKey = 'c'.repeat(64);
    const task = "Remember that this project's Canvas uses a 720 by 1280 portrait design size.";
    const definitions = [
        definition('cocos_2x_instances_list'),
        definition('cocos_2x_capabilities_list'),
    ];
    const client = {
        listTools: async () => ({ tools: definitions }),
        callTool: async ({ name }) => name === 'cocos_2x_instances_list'
            ? { structuredContent: { success: true, data: [{ projectRoot, creatorVersion: '2.4.15', state: 'ready' }] } }
            : { structuredContent: { success: true, data: {
                instance: { projectRoot, creatorVersion: '2.4.15', state: 'ready' }, commands: [],
            } } },
    };
    const skillAdapter = {
        REQUIRED_COMMAND: new Map(),
        loadContext: async () => ({
            toolsByName: new Map(definitions.map((item) => [item.name, item])),
            skillIndex: {}, messages: [{ role: 'system', content: 'Creator memory integration test' }],
        }),
        invokeSkillTool: async () => { throw new Error('No skill tools are expected in this test.'); },
    };
    const persistence = {
        value: null,
        async load() { return this.value === null ? null : structuredClone(this.value); },
        async save(next, expectedRevision) {
            assert.equal(this.value?.revision ?? 0, expectedRevision);
            this.value = structuredClone(next);
        },
    };
    const originalFetch = globalThis.fetch;
    let requestRound = 0;
    globalThis.fetch = async (_url, request) => {
        const interpretation = intentResponse(request, 'memory');
        if (interpretation) return interpretation;
        requestRound += 1;
        const body = JSON.parse(request.body);
        if (requestRound === 1) {
            assert.ok(body.tools.some((tool) => tool.function.name === 'cocos_2x_memory_remember'));
            return new Response(JSON.stringify({ choices: [{ message: { tool_calls: [{ id: 'memory-create-call', type: 'function',
                function: { name: 'cocos_2x_memory_remember', arguments: JSON.stringify({
                    title: 'Canvas design size',
                    body: 'The project Canvas design size is 720 by 1280 in portrait orientation.',
                    category: 'project-fact',
                    sources: [{ kind: 'user', messageIndex: 0, quote: 'Canvas uses a 720 by 1280 portrait design size' }],
                }) } }] }, finish_reason: 'tool_calls' }] }), { status: 200 });
        }
        if (requestRound === 2) return new Response(JSON.stringify({ choices: [{ message: { content: 'Saved the project Canvas size.' }, finish_reason: 'stop' }] }), { status: 200 });
        if (requestRound === 3) {
            assert.ok(body.messages.some((message) => message.role === 'user'
                && message.content.includes('The project Canvas design size is 720 by 1280 in portrait orientation.')));
            return new Response(JSON.stringify({ choices: [{ message: { content: 'The Canvas is portrait 720 by 1280.' }, finish_reason: 'stop' }] }), { status: 200 });
        }
        throw new Error(`Unexpected provider request ${requestRound}`);
    };
    try {
        const writeRun = await runCreatorAgent({
            client, task, projectRoot, skillFiles: [], tracePath: '/tmp/cocos-agent-memory-write.jsonl',
            apiKey: 'test-key-for-adapter-only', model: 'deepseek-flash', mode: 'Agent', history: [],
            projectContext: null, onEvent: () => {}, skillAdapter, formatProjectContext: () => null,
            writeEvent: () => {}, approveWrite: async () => true,
            projectMemory: { projectKey, persistence },
        });
        assert.equal(writeRun.status, 'completed', `reason=${writeRun.reason}`);
        assert.equal(persistence.value.memories[0].sources[0].runId, writeRun.runId);

        const askRun = await runCreatorReadOnly({
            client, task: 'What is the Canvas portrait design size?', projectRoot, skillFiles: [],
            tracePath: '/tmp/cocos-agent-memory-recall.jsonl', apiKey: 'test-key-for-adapter-only',
            model: 'deepseek-flash', mode: 'Ask', history: [], projectContext: null,
            onEvent: () => {}, skillAdapter, formatProjectContext: () => null, writeEvent: () => {},
            projectMemory: { projectKey, persistence },
        });
        assert.equal(askRun.status, 'completed');
        assert.equal(requestRound, 3);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('Creator Agent creates a durable project task and only closes it after successful receipt evidence', async () => {
    const definitions = [definition('cocos_2x_instances_list'), definition('cocos_2x_capabilities_list'), definition('cocos_2x_scene_snapshot')];
    const client = {
        listTools: async () => ({ tools: definitions }),
        callTool: async ({ name }) => name === 'cocos_2x_instances_list'
            ? { structuredContent: { success: true, data: [{ projectRoot, creatorVersion: '2.4.15', state: 'ready' }] } }
            : name === 'cocos_2x_capabilities_list'
                ? { structuredContent: { success: true, data: { instance: { projectRoot, creatorVersion: '2.4.15', state: 'ready' }, commands: [] } } }
                : { structuredContent: { success: true, outcome: 'completed', scene: { name: 'helloworld' } } },
    };
    const skillAdapter = {
        REQUIRED_COMMAND: new Map(),
        loadContext: async () => ({ toolsByName: new Map(definitions.map((item) => [item.name, item])), skillIndex: {},
            messages: [{ role: 'system', content: 'Task integration test' }] }),
        invokeSkillTool: async () => { throw new Error('No skill tools expected.'); },
    };
    let savedTasks = [];
    let round = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, request) => {
        const interpretation = intentResponse(request, 'read', ['cocos_2x_capabilities_list', 'cocos_2x_scene_snapshot']);
        if (interpretation) return interpretation;
        round += 1;
        const body = JSON.parse(request.body);
        assert.ok(body.tools.some((tool) => tool.function.name === 'agent_task_list'));
        if (round === 1) return new Response(JSON.stringify({ choices: [{ message: { tool_calls: [{ id: 'snapshot-call', type: 'function',
            function: { name: 'cocos_2x_scene_snapshot', arguments: JSON.stringify({ projectRoot }) } }] }, finish_reason: 'tool_calls' }] }), { status: 200 });
        return new Response(JSON.stringify({ choices: [{ message: { content: '场景已读回。' }, finish_reason: 'stop' }] }), { status: 200 });
    };
    try {
        const events = [];
        const result = await runCreatorAgent({ client, task: 'Read the capability catalog and scene snapshot', projectRoot, skillFiles: [],
            tracePath: '/tmp/cocos-agent-task-system.jsonl', apiKey: 'test-key-for-adapter-only', model: 'deepseek-flash',
            mode: 'Agent', history: [], projectContext: null, onEvent: (event) => events.push(event), skillAdapter,
            formatProjectContext: () => null, writeEvent: () => {}, approveWrite: async () => true,
            taskPersistence: { load: () => savedTasks, save: (tasks) => { savedTasks = structuredClone(tasks); } } });
        assert.equal(result.status, 'completed', result.reason);
        assert.equal(result.goalEvaluation.satisfied, true);
        assert.equal(savedTasks.length, 1);
        assert.match(savedTasks[0].id, /^task_[0-9a-f]{8}$/);
        assert.equal(savedTasks[0].status, 'completed');
        assert.deepEqual(savedTasks[0].acceptanceCriteria.map((criterion) => criterion.status), ['satisfied', 'satisfied'],
            'fresh Host preflight capability receipts satisfy only the explicitly requested read criterion');
        assert.ok(events.some((event) => event.type === 'goal.evaluated' && event.satisfied));
    } finally { globalThis.fetch = originalFetch; }
});

test('free Agent modification requests cannot complete after scene inspection, with or without task persistence', async () => {
    const definitions = [definition('cocos_2x_instances_list'), definition('cocos_2x_capabilities_list'), definition('cocos_2x_scene_snapshot')];
    const client = { callTool: async ({ name }) => name === 'cocos_2x_instances_list'
        ? { structuredContent: { success: true, data: [{ projectRoot, creatorVersion: '2.4.15', state: 'ready' }] } }
        : name === 'cocos_2x_capabilities_list'
            ? { structuredContent: { success: true, data: { instance: { projectRoot, creatorVersion: '2.4.15', state: 'ready' }, commands: [] } } }
            : { structuredContent: { success: true, outcome: 'completed', scene: { name: 'helloworld' } } } };
    const skillAdapter = { REQUIRED_COMMAND: new Map(), loadContext: async () => ({
        toolsByName: new Map(definitions.map((item) => [item.name, item])), skillIndex: {}, messages: [],
    }), invokeSkillTool: async () => { throw new Error('No skill tools expected.'); } };
    const originalFetch = globalThis.fetch;
    try {
        for (const { persistent, repeatTools } of [{ persistent: false, repeatTools: false },
            { persistent: true, repeatTools: false }, { persistent: false, repeatTools: true }]) {
            let round = 0, tasks = [];
            globalThis.fetch = async (_url, request) => {
                const interpretation = intentResponse(request, 'write', [], 'interaction');
                if (interpretation) return interpretation;
                round += 1;
                const useTool = round === 1 || repeatTools;
                return new Response(JSON.stringify({ choices: [{ message: useTool
                    ? { tool_calls: [{ id: `snapshot-only-${round}`, type: 'function', function: { name: 'cocos_2x_scene_snapshot', arguments: JSON.stringify({ projectRoot }) } }] }
                    : { content: '网络连接弹窗已完成。' }, finish_reason: useTool ? 'tool_calls' : 'stop' }] }), { status: 200 });
            };
            const result = await runCreatorAgent({ client, task: '创建一个网络连接弹窗', projectRoot, skillFiles: [],
                tracePath: '/tmp/cocos-agent-modification-test.jsonl', apiKey: 'test-key-only', model: 'deepseek-flash', mode: 'Agent',
                history: [], projectContext: null, onEvent: () => {}, skillAdapter, formatProjectContext: () => null,
                writeEvent: () => {}, approveWrite: async () => true,
                ...(persistent ? { taskPersistence: { load: () => tasks, save: (value) => { tasks = structuredClone(value); } } } : {}) });
            assert.equal(result.status, 'stopped');
            assert.equal(result.goalEvaluation.satisfied, false);
            assert.match(result.finalText, /任务尚未完成/);
            assert.match(result.finalText, /交互验收入口/);
            assert.doesNotMatch(result.finalText, /弹窗已完成/);
            if (repeatTools) assert.ok(round > 4 && round <= 16, 'budget exhaustion still reports unmet acceptance');
            else assert.equal(round, 4, 'continuation stays bounded and performs no further tools');
            if (persistent) assert.equal(tasks[0].status, 'in_progress');
        }
    } finally { globalThis.fetch = originalFetch; }
});
