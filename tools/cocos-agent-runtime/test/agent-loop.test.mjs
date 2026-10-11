import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentKernel } from '../dist/agent-loop.js';
import { CocosReadOnlyToolRegistry } from '../dist/cocos-ask.js';

function tool(name, access, role = 'task') {
    return { name, description: name, inputSchema: { type: 'object', properties: {}, additionalProperties: false }, access, role };
}

function call(name, id = 'call-1', arguments_ = {}) {
    return { role: 'assistant', content: null, toolCalls: [{ id, name, arguments: arguments_ }] };
}

function provider(respond) {
    return {
        supportsImages: false,
        complete: async (input) => respond(input),
    };
}

function policy(approve = true) {
    return { approveWrite: async () => approve };
}

function sceneSnapshotDefinition(projectRoot) {
    return {
        name: 'cocos_2x_scene_snapshot',
        description: 'Read the active Creator 2.4.15 scene hierarchy and summary.',
        inputSchema: {
            type: 'object',
            properties: {
                projectRoot: { type: 'string', enum: [projectRoot] },
                input: {
                    type: 'object',
                    properties: { targetNodeName: { type: 'string', minLength: 1, maxLength: 64 } },
                    additionalProperties: false,
                },
            },
            required: ['projectRoot', 'input'],
            additionalProperties: false,
        },
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    };
}

test('Ask exposes read-only tools and never invokes a write tool', async () => {
    const write = tool('scene.write', 'write');
    const read = tool('scene.read', 'read');
    let invoked = false;
    const kernel = new AgentKernel({
        provider: provider(async ({ tools }) => {
            assert.deepEqual(tools.map(({ name }) => name), ['scene.read']);
            return { message: { role: 'assistant', content: '当前场景包含一个 Canvas。' }, finishReason: 'stop' };
        }),
        tools: {
            listTools: async () => [write, read],
            callTool: async () => { invoked = true; throw new Error('Ask must not execute tools in this case'); },
        },
        policy: policy(false),
        systemPrompt: 'CocosAgent test prompt',
    });

    const result = await kernel.run({ task: '检查场景', mode: 'Ask' });
    assert.equal(result.status, 'completed', result.reason);
    assert.equal(invoked, false);
});

test('a rejected write approval prevents the MCP call', async () => {
    let invoked = false;
    const kernel = new AgentKernel({
        provider: provider(async () => ({ message: call('scene.write'), finishReason: 'tool_calls' })),
        tools: {
            listTools: async () => [tool('scene.write', 'write')],
            callTool: async () => { invoked = true; return { structuredContent: { success: true } }; },
        },
        policy: policy(false),
        systemPrompt: 'CocosAgent test prompt',
    });

    const result = await kernel.run({ task: '修改场景', mode: 'Agent' });
    assert.equal(result.status, 'awaiting-approval');
    assert.equal(result.reason, 'write-not-approved');
    assert.equal(invoked, false);
});

test('a resolved read-only task receipt can complete Agent mode', async () => {
    let round = 0;
    const kernel = new AgentKernel({
        provider: provider(async () => ++round === 1
            ? { message: call('scene.read'), finishReason: 'tool_calls' }
            : { message: { role: 'assistant', content: '场景读取完成。' }, finishReason: 'stop' }),
        tools: {
            listTools: async () => [tool('scene.read', 'read')],
            callTool: async () => ({ structuredContent: { success: true, scene: 'helloworld' } }),
        },
        policy: policy(false),
        systemPrompt: 'CocosAgent test prompt',
    });

    const result = await kernel.run({ task: '检查当前场景', mode: 'Agent' });
    assert.equal(result.status, 'completed');
    assert.equal(result.reason, 'completed');
    assert.equal(result.receipts.length, 1);
});

test('a recovery-classified read can be the requested task when no recovery lock is active', async () => {
    let round = 0;
    const kernel = new AgentKernel({
        provider: provider(async () => ++round === 1
            ? { message: call('operation.get'), finishReason: 'tool_calls' }
            : { message: { role: 'assistant', content: '操作记录已核对。' }, finishReason: 'stop' }),
        tools: {
            listTools: async () => [tool('operation.get', 'read', 'recovery')],
            callTool: async () => ({ structuredContent: { success: true, outcome: 'completed' } }),
        },
        policy: policy(false),
        systemPrompt: 'CocosAgent test prompt',
    });

    const result = await kernel.run({ task: '读取操作记录', mode: 'Agent' });
    assert.equal(result.status, 'completed');
    assert.equal(result.receipts.length, 1);
});

test('needs-preview keeps Agent task tools available for preview acceptance', async () => {
    const offered = [];
    let round = 0;
    const kernel = new AgentKernel({
        provider: provider(async ({ tools }) => {
            offered.push(tools.map(({ name }) => name));
            round += 1;
            if (round === 1) return { message: call('scene.write', 'write'), finishReason: 'tool_calls' };
            if (round === 2) return { message: call('cocos_2x_operation_preview_accept', 'preview', { operationId: 'op-1' }), finishReason: 'tool_calls' };
            return { message: { role: 'assistant', content: '预览已验收。' }, finishReason: 'stop' };
        }),
        tools: {
            listTools: async () => [tool('scene.write', 'write'), tool('cocos_2x_operation_preview_accept', 'write')],
            callTool: async ({ name }) => name === 'scene.write'
                ? { structuredContent: { success: true, outcome: 'needs-preview', operationId: 'op-1' } }
                : { structuredContent: { success: true, outcome: 'completed', operationId: 'op-1', preview: 'passed' } },
        },
        policy: policy(true),
        systemPrompt: 'CocosAgent test prompt',
    });

    const result = await kernel.run({ task: '修改并验收场景', mode: 'Agent' });
    assert.deepEqual(offered[1], ['scene.write', 'cocos_2x_operation_preview_accept']);
    assert.equal(result.status, 'completed');
    assert.equal(result.receipts.length, 2);
});

test('Agent cannot finish while a write still needs preview acceptance', async () => {
    let round = 0;
    const kernel = new AgentKernel({
        provider: provider(async ({ messages }) => {
            round += 1;
            if (round === 1) return { message: call('scene.read', 'read'), finishReason: 'tool_calls' };
            if (round === 2) return { message: call('scene.write', 'write'), finishReason: 'tool_calls' };
            if (round === 3) return { message: { role: 'assistant', content: '修改已经完成。' }, finishReason: 'stop' };
            if (round === 4) {
                assert.match(messages.at(-1).content, /still require visual preview acceptance: \(operation ID missing\)/);
                return { message: { role: 'assistant', content: '我仍然认为已经完成。' }, finishReason: 'stop' };
            }
            return { message: { role: 'assistant', content: '完成。' }, finishReason: 'stop' };
        }),
        tools: {
            listTools: async () => [tool('scene.read', 'read'), tool('scene.write', 'write')],
            callTool: async ({ name }) => name === 'scene.read'
                ? { structuredContent: { success: true, scene: 'helloworld' } }
                : { structuredContent: { success: true, outcome: 'needs-preview' } },
        },
        policy: policy(true),
        systemPrompt: 'CocosAgent test prompt',
    });

    const result = await kernel.run({ task: '修改并验收场景', mode: 'Agent', maxTurns: 8 });
    assert.equal(result.status, 'stopped');
    assert.equal(result.reason, 'preview-acceptance-required');
    assert.deepEqual(result.receipts.map(({ toolName }) => toolName), ['scene.read', 'scene.write']);
});

test('Agent requires a matching installed skill before task tools when skill tools are available', async () => {
    const offered = [];
    const receipts = [];
    let round = 0;
    const kernel = new AgentKernel({
        provider: provider(async ({ tools }) => {
            offered.push(tools.map(({ name }) => name));
            round += 1;
            if (round === 1) return { message: call('scene.read', 'early'), finishReason: 'tool_calls' };
            if (round === 2) return { message: call('cocos_2x_skills_list', 'skills'), finishReason: 'tool_calls' };
            if (round === 3) return { message: call('cocos_2x_skill_read', 'skill', { name: 'cocos2-scene-node-operations' }), finishReason: 'tool_calls' };
            if (round === 4) return { message: call('scene.read', 'read'), finishReason: 'tool_calls' };
            return { message: { role: 'assistant', content: '已读取场景。' }, finishReason: 'stop' };
        }),
        tools: {
            listTools: async () => [
                tool('cocos_2x_skills_list', 'read', 'setup'),
                tool('cocos_2x_skill_read', 'read', 'setup'),
                tool('scene.read', 'read', 'task'),
            ],
            callTool: async ({ name }) => {
                let result;
                if (name === 'cocos_2x_skills_list') result = { structuredContent: { success: true,
                    data: { skills: [{ name: 'cocos2-scene-node-operations' }] } } };
                else if (name === 'cocos_2x_skill_read') result = { structuredContent: { success: true,
                    skillName: 'cocos2-scene-node-operations', references: [] } };
                else result = { structuredContent: { success: true, scene: 'helloworld' } };
                receipts.push({ name, result });
                return result;
            },
        },
        policy: policy(false),
        systemPrompt: 'CocosAgent test prompt',
    });

    const result = await kernel.run({ task: '检查场景', mode: 'Agent' });
    assert.equal(receipts.some(({ name }) => name === 'scene.read'), true);
    assert.ok(result.messages.some((message) => message.role === 'system'
        && /Before task-specific Creator tools, read cocos_2x_skills_list/.test(message.content)));
    assert.deepEqual(offered[2], ['cocos_2x_skills_list', 'cocos_2x_skill_read', 'scene.read']);
    assert.equal(result.status, 'completed');
    assert.equal(result.receipts.at(-1).toolName, 'scene.read');
});

test('Agent accepts an explicit no-match skill assessment and continues without skill-specific claims', async () => {
    let round = 0;
    const called = [];
    const kernel = new AgentKernel({
        provider: provider(async () => {
            round += 1;
            if (round === 1) return { message: call('cocos_2x_skills_list', 'skills'), finishReason: 'tool_calls' };
            if (round === 2) return { message: { role: 'assistant', content:
                'No matching installed Cocos skill applies: the catalog covers scene editing, while this is a general engine question.' }, finishReason: 'stop' };
            if (round === 3) return { message: call('scene.read', 'read'), finishReason: 'tool_calls' };
            return { message: { role: 'assistant', content: '已根据场景回执完成检查。' }, finishReason: 'stop' };
        }),
        tools: {
            listTools: async () => [tool('cocos_2x_skills_list', 'read', 'setup'),
                tool('cocos_2x_skill_read', 'read', 'setup'), tool('scene.read', 'read')],
            callTool: async ({ name }) => {
                called.push(name);
                if (name === 'cocos_2x_skills_list') return { structuredContent: { success: true,
                    data: { skills: [{ name: 'unrelated-skill' }] } } };
                return { structuredContent: { success: true, scene: 'helloworld' } };
            },
        },
        policy: policy(false),
        systemPrompt: 'CocosAgent test prompt',
    });

    const result = await kernel.run({ task: '检查当前场景', mode: 'Agent' });
    assert.equal(result.status, 'completed');
    assert.deepEqual(called, ['cocos_2x_skills_list', 'scene.read']);
    assert.equal(result.receipts.some((receipt) => receipt.toolName === 'cocos_2x_skill_read'), false);
});

test('Agent nudges a bounded retry after an empty model response and continues from its receipts', async () => {
    let round = 0;
    const called = [];
    const kernel = new AgentKernel({
        provider: provider(async ({ messages }) => {
            round += 1;
            if (round === 1) return { message: call('cocos_2x_skills_list', 'skills'), finishReason: 'tool_calls' };
            if (round === 2) return { message: call('cocos_2x_skill_read', 'skill', { name: 'cocos2-scene-node-operations' }), finishReason: 'tool_calls' };
            if (round === 3) return { message: call('cocos_2x_skill_reference_read', 'reference', {
                skillName: 'cocos2-scene-node-operations', referenceId: 'agent-foundation/scene-node-patch-prefab-0.1.md',
            }), finishReason: 'tool_calls' };
            if (round === 4) return { message: { role: 'assistant', content: null }, finishReason: 'stop' };
            if (round === 5) {
                assert.match(messages.at(-1).content, /Your last response was empty/);
                return { message: call('scene.read', 'scene'), finishReason: 'tool_calls' };
            }
            return { message: { role: 'assistant', content: '场景读取完成。' }, finishReason: 'stop' };
        }),
        tools: {
            listTools: async () => [
                tool('cocos_2x_skills_list', 'read', 'setup'),
                tool('cocos_2x_skill_read', 'read', 'setup'),
                tool('cocos_2x_skill_reference_read', 'read', 'setup'),
                tool('scene.read', 'read', 'task'),
            ],
            callTool: async ({ name }) => {
                called.push(name);
                if (name === 'cocos_2x_skills_list') return { structuredContent: { success: true,
                    data: { skills: [{ name: 'cocos2-scene-node-operations' }] } } };
                if (name === 'cocos_2x_skill_read') return { structuredContent: { success: true,
                    skillName: 'cocos2-scene-node-operations', references: ['agent-foundation/scene-node-patch-prefab-0.1.md'] } };
                if (name === 'cocos_2x_skill_reference_read') return { structuredContent: { success: true,
                    skillName: 'cocos2-scene-node-operations', referenceId: 'agent-foundation/scene-node-patch-prefab-0.1.md' } };
                return { structuredContent: { success: true, scene: 'helloworld' } };
            },
        },
        policy: policy(false),
        systemPrompt: 'CocosAgent test prompt',
    });

    const result = await kernel.run({ task: '读取当前场景', mode: 'Agent' });
    assert.equal(result.status, 'completed');
    assert.deepEqual(called, [
        'cocos_2x_skills_list', 'cocos_2x_skill_read', 'cocos_2x_skill_reference_read', 'scene.read',
    ]);
    assert.equal(result.receipts.at(-1).toolName, 'scene.read');
});

test('an uncertain write restricts the next model turn to recovery tools', async () => {
    const offered = [];
    let round = 0;
    const kernel = new AgentKernel({
        provider: provider(async ({ tools }) => {
            offered.push(tools.map(({ name }) => name));
            round += 1;
            if (round === 1) return { message: call('scene.write', 'write-1'), finishReason: 'tool_calls' };
            if (round === 2) return { message: call('operation.get', 'recover-1', { operationId: 'uncertain-op' }), finishReason: 'tool_calls' };
            if (round === 3) return { message: call('scene.read', 'read-1'), finishReason: 'tool_calls' };
            return { message: { role: 'assistant', content: '已停止并报告恢复结果。' }, finishReason: 'stop' };
        }),
        tools: {
            listTools: async () => [tool('scene.write', 'write', 'task'), tool('operation.get', 'read', 'recovery'), tool('scene.read', 'read')],
            callTool: async ({ name }) => name === 'scene.write'
                ? { structuredContent: { success: false, outcome: 'needs-review', operationId: 'uncertain-op', error: { sideEffect: 'unknown' } } }
                : name === 'operation.get'
                    ? { structuredContent: { success: true, outcome: 'reconciled', operationId: 'uncertain-op' } }
                    : { structuredContent: { success: true, scene: 'helloworld' } },
        },
        policy: policy(true),
        systemPrompt: 'CocosAgent test prompt',
    });

    const result = await kernel.run({ task: '修改并验证场景', mode: 'Agent' });
    assert.deepEqual(offered[0], ['scene.write', 'operation.get', 'scene.read']);
    assert.deepEqual(offered[1], ['operation.get']);
    assert.deepEqual(offered[2], ['scene.write', 'operation.get', 'scene.read']);
    assert.equal(result.status, 'completed');
    assert.deepEqual(result.receipts.map(({ toolName }) => toolName), ['scene.write', 'operation.get', 'scene.read']);
});

test('a write failure without an explicit no-effect receipt remains needs-review', async () => {
    const offered = [];
    const kernel = new AgentKernel({
        provider: provider(async ({ tools }) => {
            offered.push(tools.map(({ name }) => name));
            return offered.length === 1
                ? { message: call('scene.write'), finishReason: 'tool_calls' }
                : { message: { role: 'assistant', content: '尚未完成对账。' }, finishReason: 'stop' };
        }),
        tools: {
            listTools: async () => [tool('scene.write', 'write', 'task'), tool('operation.get', 'read', 'recovery')],
            callTool: async ({ name }) => name === 'scene.write'
                ? { isError: true, content: [{ type: 'text', text: 'connection closed' }] }
                : { structuredContent: { success: true, status: 'needs-review' } },
        },
        policy: policy(true),
        systemPrompt: 'CocosAgent test prompt',
    });

    const result = await kernel.run({ task: '修改场景', mode: 'Agent' });
    assert.deepEqual(offered[1], ['operation.get']);
    assert.equal(result.status, 'needs-review');
    assert.equal(result.receipts[0].result.structuredContent.error.sideEffect, 'unknown');
});

test('a successful-looking recovery receipt with a pending ledger status does not unlock task tools', async () => {
    const offered = [];
    let round = 0;
    const kernel = new AgentKernel({
        provider: provider(async ({ tools }) => {
            offered.push(tools.map(({ name }) => name));
            round += 1;
            if (round === 1) return { message: call('scene.write', 'write-1'), finishReason: 'tool_calls' };
            if (round === 2) return { message: call('operation.get', 'recover-1', { operationId: 'uncertain-op' }), finishReason: 'tool_calls' };
            return { message: { role: 'assistant', content: '账本仍待核对。' }, finishReason: 'stop' };
        }),
        tools: {
            listTools: async () => [tool('scene.write', 'write', 'task'), tool('operation.get', 'read', 'recovery')],
            callTool: async ({ name }) => name === 'scene.write'
                ? { structuredContent: { success: false, outcome: 'needs-review', operationId: 'uncertain-op', error: { sideEffect: 'unknown' } } }
                : { structuredContent: { success: true, status: 'needs-review', operationId: 'uncertain-op' } },
        },
        policy: policy(true),
        systemPrompt: 'CocosAgent test prompt',
    });

    const result = await kernel.run({ task: '修改场景', mode: 'Agent' });
    assert.deepEqual(offered[1], ['operation.get']);
    assert.deepEqual(offered[2], ['operation.get']);
    assert.equal(result.status, 'needs-review');
});

test('a recovery call and its receipt must both match the uncertain operation identity', async () => {
    const offered = [];
    const invoked = [];
    let round = 0;
    const kernel = new AgentKernel({
        provider: provider(async ({ tools, messages }) => {
            offered.push(tools.map(({ name }) => name));
            round += 1;
            if (round === 1) return { message: call('scene.write', 'write', { operationId: 'operation-A' }), finishReason: 'tool_calls' };
            if (round === 2) return { message: call('operation.get', 'wrong-target', { operationId: 'operation-B' }), finishReason: 'tool_calls' };
            if (round === 3) {
                assert.match(messages.at(-1).content, /exact pending operationId operation-A/);
                return { message: call('operation.get', 'correct-target', { operationId: 'operation-A' }), finishReason: 'tool_calls' };
            }
            return { message: { role: 'assistant', content: '尚未获得当前操作的恢复回执。' }, finishReason: 'stop' };
        }),
        tools: {
            listTools: async () => [tool('scene.write', 'write', 'task'),
                tool('operation.get', 'read', 'recovery'), tool('scene.read', 'read', 'task')],
            callTool: async ({ name, arguments: args }) => {
                invoked.push({ name, args });
                if (name === 'scene.write') return { structuredContent: { success: false,
                    outcome: 'needs-review', operationId: 'operation-A', error: { sideEffect: 'unknown' } } };
                // Simulate a stale or misrouted Host returning another operation's receipt.
                return { structuredContent: { success: true, outcome: 'completed', operationId: 'operation-B' } };
            },
        },
        policy: policy(true),
        systemPrompt: 'CocosAgent test prompt',
    });

    const result = await kernel.run({ task: '修改并恢复场景', mode: 'Agent' });
    assert.equal(result.status, 'needs-review');
    assert.deepEqual(offered[1], ['operation.get']);
    assert.deepEqual(offered[2], ['operation.get']);
    assert.deepEqual(invoked.map(({ name }) => name), ['scene.write', 'operation.get']);
    assert.equal(invoked[1].args.operationId, 'operation-A');
    assert.equal(result.receipts.at(-1).result.structuredContent.operationId, 'operation-B');
});

test('cancellation waits for an in-flight write receipt', async () => {
    let enteredCall;
    const callEntered = new Promise((resolve) => { enteredCall = resolve; });
    let finishCall;
    const finishPendingCall = new Promise((resolve) => { finishCall = resolve; });
    const controller = new AbortController();
    const kernel = new AgentKernel({
        provider: provider(async () => ({ message: call('scene.write'), finishReason: 'tool_calls' })),
        tools: {
            listTools: async () => [tool('scene.write', 'write')],
            callTool: async () => {
                enteredCall();
                await finishPendingCall;
                return { structuredContent: { success: false, outcome: 'needs-review', error: { sideEffect: 'unknown' } } };
            },
        },
        policy: policy(true),
        systemPrompt: 'CocosAgent test prompt',
    });

    let settled = false;
    const running = kernel.run({ task: '写入场景', mode: 'Agent', signal: controller.signal }).finally(() => { settled = true; });
    await callEntered;
    controller.abort();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(settled, false);
    finishCall();
    const result = await running;
    assert.equal(result.status, 'needs-review');
    assert.equal(result.receipts.length, 1);
    assert.equal(result.receipts[0].result.structuredContent.outcome, 'needs-review');
});

test('Ask serializes a batched read-only tool response and records deferred calls as no-op', async () => {
    let invoked = 0;
    let round = 0;
    const kernel = new AgentKernel({
        provider: provider(async ({ messages, tools, mode }) => {
            round += 1;
            assert.equal(mode, 'Ask');
            assert.ok(tools.every((item) => item.access === 'read'));
            if (round === 1) return {
                message: { role: 'assistant', content: null, toolCalls: [
                    { id: 'one', name: 'a', arguments: {} },
                    { id: 'two', name: 'b', arguments: {} },
                ] },
                finishReason: 'tool_calls',
            };
            assert.equal(messages.at(-1).toolCallId, 'two');
            assert.match(messages.at(-1).content, /SINGLE_READ_TOOL_CALL_REQUIRED/);
            return { message: { role: 'assistant', content: '只使用已执行的读取结果。' }, finishReason: 'stop' };
        }),
        tools: {
            listTools: async () => [tool('a', 'read'), tool('b', 'read')],
            callTool: async ({ name }) => { invoked += 1; return { structuredContent: { success: true, tool: name } }; },
        },
        policy: policy(),
        systemPrompt: 'CocosAgent test prompt',
    });

    const result = await kernel.run({ task: '读取项目', mode: 'Ask' });
    assert.equal(result.status, 'completed');
    assert.equal(result.finalText, '只使用已执行的读取结果。');
    assert.equal(invoked, 1);
    assert.equal(result.receipts.length, 1);
    assert.equal(result.receipts[0].toolName, 'a');
    assert.ok(result.messages.some((message) => message.role === 'tool' && message.toolCallId === 'two'
        && message.content.includes('SINGLE_READ_TOOL_CALL_REQUIRED')));
});

test('Agent retries a batched tool response without executing it, then runs one tool', async () => {
    let round = 0;
    let providerAssertionError = '';
    const invoked = [];
    const kernel = new AgentKernel({
        provider: provider(async ({ messages }) => {
            round += 1;
            if (round === 1) return {
                message: { role: 'assistant', content: null, toolCalls: [
                    { id: 'one', name: 'a', arguments: {} },
                    { id: 'two', name: 'b', arguments: {} },
                ] },
                finishReason: 'tool_calls',
            };
            if (round === 2) {
                try {
                    assert.match(messages.at(-1).content, /requested multiple tools, and none were executed/);
                    assert.match(messages.at(-2).content, /SINGLE_TOOL_CALL_REQUIRED/);
                    const assistantCalls = messages.filter((message) => message.role === 'assistant')
                        .flatMap((message) => message.toolCalls || []);
                    const callIds = new Set(assistantCalls.map((item) => item.id));
                    const dangling = messages.filter((message) => message.role === 'tool'
                        && !callIds.has(message.toolCallId));
                    assert.equal(dangling.length, 0, 'every tool result must belong to a preserved assistant tool call');
                    assert.deepEqual(assistantCalls.slice(-2).map((item) => item.id), ['one', 'two']);
                } catch (error) {
                    providerAssertionError = error.message;
                    throw error;
                }
                return { message: call('a', 'single'), finishReason: 'tool_calls' };
            }
            return { message: { role: 'assistant', content: '完成单个工具调用。' }, finishReason: 'stop' };
        }),
        tools: {
            listTools: async () => [tool('a', 'read'), tool('b', 'read')],
            callTool: async ({ name }) => { invoked.push(name); return { structuredContent: { success: true, tool: name } }; },
        },
        policy: policy(),
        systemPrompt: 'CocosAgent test prompt',
    });

    const result = await kernel.run({ task: '写入项目', mode: 'Agent' });
    assert.equal(result.status, 'completed', `${result.reason}: ${providerAssertionError}`);
    assert.deepEqual(invoked, ['a']);
    assert.equal(result.receipts.length, 1);
    assert.equal(result.receipts[0].toolName, 'a');
});

test('Agent stops after the bounded batched-call retry limit without executing calls', async () => {
    let callId = 0;
    let invoked = false;
    const kernel = new AgentKernel({
        provider: provider(async () => ({
            message: { role: 'assistant', content: null, toolCalls: [
                { id: `one-${++callId}`, name: 'a', arguments: {} },
                { id: `two-${callId}`, name: 'b', arguments: {} },
            ] },
            finishReason: 'tool_calls',
        })),
        tools: {
            listTools: async () => [tool('a', 'write'), tool('b', 'write')],
            callTool: async () => { invoked = true; return {}; },
        },
        policy: policy(),
        systemPrompt: 'CocosAgent test prompt',
    });

    const result = await kernel.run({ task: '写入项目', mode: 'Agent' });
    assert.equal(result.status, 'stopped');
    assert.equal(result.reason, 'multiple-tool-calls-rejected');
    assert.equal(invoked, false);
});

test('Creator Ask gates tools behind exact 2.4.15 instance and capability receipts', async () => {
    const root = '/tmp/cocos-ask-project';
    const calls = [];
    const definitions = [
        { name: 'cocos_2x_instances_list', description: 'instances', inputSchema: {}, annotations: { readOnlyHint: true } },
        { name: 'cocos_2x_capabilities_list', description: 'capabilities', inputSchema: {}, annotations: { readOnlyHint: true } },
        sceneSnapshotDefinition(root),
        { name: 'cocos_2x_scene_patch', description: 'write', inputSchema: {}, annotations: { readOnlyHint: false } },
        { name: 'cocos_2x_skill_read', description: 'skill', inputSchema: {}, annotations: { readOnlyHint: true } },
    ];
    const client = {
        callTool: async ({ name, arguments: args }) => {
            calls.push({ name, args });
            if (name === 'cocos_2x_instances_list') return { structuredContent: { success: true, data: [
                { projectRoot: root, creatorVersion: '2.4.15', state: 'ready' },
            ] } };
            if (name === 'cocos_2x_capabilities_list') return { structuredContent: { success: true, data: {
                instance: { projectRoot: root, creatorVersion: '2.4.15', state: 'ready' },
                commands: [{ id: 'scene.snapshot', status: 'available' }],
            } } };
            return { structuredContent: { success: true, scene: { name: 'main' } } };
        },
    };
    const registry = new CocosReadOnlyToolRegistry(client, definitions, root,
        { cocos_2x_scene_snapshot: 'scene.snapshot' }, async () => ({ structuredContent: { success: true } }));

    assert.deepEqual((await registry.listTools()).map(({ name }) => name), ['cocos_2x_instances_list']);
    await registry.callTool({ name: 'cocos_2x_instances_list', arguments: {} });
    assert.deepEqual((await registry.listTools()).map(({ name }) => name), ['cocos_2x_capabilities_list']);
    await registry.callTool({ name: 'cocos_2x_capabilities_list', arguments: { projectRoot: root } });
    const exposed = await registry.listTools();
    assert.ok(exposed.some(({ name }) => name === 'cocos_2x_scene_snapshot'));
    assert.ok(exposed.some(({ name }) => name === 'cocos_2x_skill_read'));
    assert.ok(!exposed.some(({ name }) => name === 'cocos_2x_scene_patch'));
    const result = await registry.callTool({ name: 'cocos_2x_scene_snapshot', arguments: { projectRoot: root, input: {} } });
    assert.equal(result.structuredContent.success, true);
    assert.equal(registry.isReady, true);
    assert.equal(calls.length, 3);
    assert.deepEqual(calls[2], { name: 'cocos_2x_scene_snapshot', args: { projectRoot: root, input: {} } });
});

test('Creator read-only preflight deterministically verifies the selected project before exposing task tools', async () => {
    const root = '/tmp/cocos-ask-project';
    const calls = [];
    const definitions = [
        { name: 'cocos_2x_instances_list', description: 'instances', inputSchema: {}, annotations: { readOnlyHint: true } },
        { name: 'cocos_2x_capabilities_list', description: 'capabilities', inputSchema: {}, annotations: { readOnlyHint: true } },
        sceneSnapshotDefinition(root),
    ];
    const registry = new CocosReadOnlyToolRegistry({
        callTool: async ({ name, arguments: args }) => {
            calls.push({ name, args });
            if (name === 'cocos_2x_instances_list') return { structuredContent: { success: true, data: [
                { projectRoot: root, creatorVersion: '2.4.15', state: 'ready' },
            ] } };
            if (name === 'cocos_2x_capabilities_list') return { structuredContent: { success: true, data: {
                instance: { projectRoot: root, creatorVersion: '2.4.15', state: 'ready' },
                commands: [{ id: 'scene.snapshot', status: 'available' }],
            } } };
            throw new Error('Task tools must not run during preflight');
        },
    }, definitions, root, { cocos_2x_scene_snapshot: 'scene.snapshot' });

    const preflight = await registry.verifyCreator();
    assert.equal(preflight.ready, true);
    assert.equal(preflight.reason, null);
    assert.deepEqual(preflight.receipts.map(({ name }) => name), [
        'cocos_2x_instances_list', 'cocos_2x_capabilities_list',
    ]);
    assert.deepEqual(calls, [
        { name: 'cocos_2x_instances_list', args: {} },
        { name: 'cocos_2x_capabilities_list', args: { projectRoot: root } },
    ]);
    assert.ok((await registry.listTools()).some(({ name }) => name === 'cocos_2x_scene_snapshot'));
});

test('Creator Ask blocks a command that the live capability receipt marks unavailable', async () => {
    const root = '/tmp/cocos-ask-project';
    const calls = [];
    const client = {
        callTool: async ({ name }) => {
            calls.push(name);
            if (name === 'cocos_2x_instances_list') return { structuredContent: { success: true, data: [
                { projectRoot: root, creatorVersion: '2.4.15', state: 'ready' },
            ] } };
            if (name === 'cocos_2x_capabilities_list') return { structuredContent: { success: true, data: {
                instance: { projectRoot: root, creatorVersion: '2.4.15', state: 'ready' },
                commands: [{ id: 'scene.snapshot', status: 'unavailable' }],
            } } };
            throw new Error('Unavailable command reached MCP');
        },
    };
    const definitions = [
        { name: 'cocos_2x_instances_list', description: 'instances', inputSchema: {}, annotations: { readOnlyHint: true } },
        { name: 'cocos_2x_capabilities_list', description: 'capabilities', inputSchema: {}, annotations: { readOnlyHint: true } },
        sceneSnapshotDefinition(root),
    ];
    const registry = new CocosReadOnlyToolRegistry(client, definitions, root,
        { cocos_2x_scene_snapshot: 'scene.snapshot' });
    await registry.listTools();
    await registry.callTool({ name: 'cocos_2x_instances_list', arguments: {} });
    await registry.listTools();
    await registry.callTool({ name: 'cocos_2x_capabilities_list', arguments: { projectRoot: root } });
    await registry.listTools();
    const result = await registry.callTool({ name: 'cocos_2x_scene_snapshot', arguments: { projectRoot: root, input: {} } });
    assert.equal(result.structuredContent.error.code, 'COMMAND_NOT_AVAILABLE');
    assert.deepEqual(calls, ['cocos_2x_instances_list', 'cocos_2x_capabilities_list']);
});

test('Creator Plan runs through the TypeScript kernel after fresh read-only instance and capability checks', async () => {
    const root = '/tmp/cocos-plan-project';
    const calls = [];
    const definitions = [
        { name: 'cocos_2x_instances_list', description: 'instances', inputSchema: {}, annotations: { readOnlyHint: true } },
        { name: 'cocos_2x_capabilities_list', description: 'capabilities', inputSchema: {}, annotations: { readOnlyHint: true } },
        { name: 'cocos_2x_skills_list', description: 'List skills', inputSchema: {}, annotations: { readOnlyHint: true } },
        { name: 'cocos_2x_skill_read', description: 'Read skill', inputSchema: {}, annotations: { readOnlyHint: true } },
        { name: 'cocos_2x_skill_reference_read', description: 'Read reference', inputSchema: {}, annotations: { readOnlyHint: true } },
        sceneSnapshotDefinition(root),
        { name: 'cocos_2x_scene_patch', description: 'write', inputSchema: {}, annotations: { readOnlyHint: false } },
    ];
    const registry = new CocosReadOnlyToolRegistry({
        callTool: async ({ name, arguments: args }) => {
            calls.push({ name, args });
            if (name === 'cocos_2x_instances_list') return { structuredContent: { success: true, data: [
                { projectRoot: root, creatorVersion: '2.4.15', state: 'ready' },
            ] } };
            if (name === 'cocos_2x_capabilities_list') return { structuredContent: { success: true, data: {
                instance: { projectRoot: root, creatorVersion: '2.4.15', state: 'ready' },
                commands: [{ id: 'scene.snapshot', status: 'available' }],
            } } };
            if (name === 'cocos_2x_skills_list') return { structuredContent: { success: true, data: { skills: [] } } };
            if (name === 'cocos_2x_skill_read') return { structuredContent: { success: true,
                skillName: 'cocos2-scene-node-operations', references: [{ id: 'agent-foundation/scene-node-patch-prefab-0.1.md' }] } };
            if (name === 'cocos_2x_skill_reference_read') return { structuredContent: { success: true,
                skillName: args.skillName, referenceId: args.referenceId } };
            return { structuredContent: { success: true, data: { scene: 'main' } } };
        },
    }, definitions, root, { cocos_2x_scene_snapshot: 'scene.snapshot' }, async (name, args) => {
        calls.push({ name, args });
        if (name === 'cocos_2x_skills_list') return { structuredContent: { success: true, data: { skills: [] } } };
        if (name === 'cocos_2x_skill_read') return { structuredContent: { success: true,
            skillName: 'cocos2-scene-node-operations', references: [{ id: 'agent-foundation/scene-node-patch-prefab-0.1.md' }] } };
        if (name === 'cocos_2x_skill_reference_read') return { structuredContent: { success: true,
            skillName: args.skillName, referenceId: args.referenceId } };
        return { isError: true, structuredContent: { success: false } };
    });

    let round = 0;
    const kernel = new AgentKernel({
        provider: provider(async ({ tools, messages, mode }) => {
            assert.equal(mode, 'Plan');
            assert.ok(tools.every((item) => item.access === 'read'));
            round += 1;
            if (round === 1) return { message: call('cocos_2x_instances_list', 'instances'), finishReason: 'tool_calls' };
            if (round === 2) return { message: call('cocos_2x_capabilities_list', 'capabilities', { projectRoot: root }), finishReason: 'tool_calls' };
            if (round === 3) {
                const snapshot = tools.find((item) => item.name === 'cocos_2x_scene_snapshot');
                assert.deepEqual(snapshot.inputSchema.required, ['projectRoot', 'input']);
                assert.deepEqual(snapshot.inputSchema.properties.projectRoot.enum, [root]);
                assert.deepEqual(snapshot.inputSchema.properties.input.properties.targetNodeName,
                    { type: 'string', minLength: 1, maxLength: 64 });
                return { message: call('cocos_2x_scene_snapshot', 'snapshot', { projectRoot: root, input: {} }), finishReason: 'tool_calls' };
            }
            if (round === 4) return { message: { role: 'assistant', content: '{"version":1,"title":"Inspect scene","summary":"Read current scene state.","steps":[]}' }, finishReason: 'stop' };
            if (round === 5) {
                assert.match(messages.at(-1).content, /Plan cannot be accepted yet/);
                return { message: call('cocos_2x_skills_list', 'skills'), finishReason: 'tool_calls' };
            }
            if (round === 6) return { message: call('cocos_2x_skill_read', 'skill', { name: 'cocos2-scene-node-operations' }), finishReason: 'tool_calls' };
            if (round === 7) return { message: call('cocos_2x_skill_reference_read', 'reference', {
                skillName: 'cocos2-scene-node-operations', referenceId: 'agent-foundation/scene-node-patch-prefab-0.1.md',
            }), finishReason: 'tool_calls' };
            assert.match(messages[0].content, /ONLY a JSON object/);
            return { message: { role: 'assistant', content: '{"version":1,"title":"Inspect scene","summary":"Read current scene state.","steps":[]}' }, finishReason: 'stop' };
        }),
        tools: registry,
        policy: policy(false),
        systemPrompt: 'Plan system prompt',
    });

    const result = await kernel.run({ task: '先检查场景', mode: 'Plan' });
    assert.equal(result.status, 'completed');
    assert.equal(result.receipts.length, 6);
    assert.deepEqual(calls.map(({ name }) => name), [
        'cocos_2x_instances_list', 'cocos_2x_capabilities_list', 'cocos_2x_scene_snapshot',
        'cocos_2x_skills_list', 'cocos_2x_skill_read', 'cocos_2x_skill_reference_read',
    ]);
    assert.deepEqual(calls[2].args, { projectRoot: root, input: {} });
    assert.deepEqual(calls.slice(3).map(({ name }) => name), [
        'cocos_2x_skills_list', 'cocos_2x_skill_read', 'cocos_2x_skill_reference_read',
    ]);
});

test('Creator Plan cannot finish without a task-specific skill and its declared reference', async () => {
    let round = 0;
    const kernel = new AgentKernel({
        provider: provider(async () => {
            round += 1;
            return { message: { role: 'assistant', content: '{"version":1,"title":"Plan","summary":"No writes.","steps":[]}' }, finishReason: 'stop' };
        }),
        tools: { listTools: async () => [], callTool: async () => { throw new Error('No tool should be called'); } },
        policy: policy(false),
        systemPrompt: 'CocosAgent test prompt',
        maxTurns: 8,
    });

    const result = await kernel.run({ task: '规划场景写入', mode: 'Plan' });
    assert.equal(result.status, 'stopped');
    assert.equal(result.reason, 'plan-task-catalog-not-read');
    assert.equal(result.finalText, null);
    assert.equal(round, 3);
});

test('Creator Plan accepts an explicit no-match skill assessment in its summary', async () => {
    let round = 0;
    const kernel = new AgentKernel({
        provider: provider(async () => {
            round += 1;
            if (round === 1) return { message: call('cocos_2x_skills_list', 'skills'), finishReason: 'tool_calls' };
            return { message: { role: 'assistant', content: JSON.stringify({ version: 1, title: '只读检查',
                summary: 'No matching installed Cocos skill applies: this task only asks for a general architecture explanation.',
                steps: [{ title: '读取场景', description: '检查场景内容。', preconditions: [],
                    requiredTools: ['cocos_2x_scene_snapshot'], validation: '取得场景快照。', recovery: '只读任务无需恢复。' }] }) },
                finishReason: 'stop' };
        }),
        tools: {
            listTools: async () => [tool('cocos_2x_skills_list', 'read', 'setup')],
            callTool: async () => ({ structuredContent: { success: true,
                data: { skills: [{ name: 'unrelated-skill' }] } } }),
        },
        policy: policy(false),
        systemPrompt: 'CocosAgent test prompt',
    });

    const result = await kernel.run({ task: '规划只读检查', mode: 'Plan' });
    assert.equal(result.status, 'completed');
    assert.equal(round, 2);
});
