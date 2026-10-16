import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentKernel } from '../dist/agent-loop.js';
import { prepareAgentContext } from '../dist/context-compact.js';
import { ProviderError, DeepSeekProvider } from '../dist/index.js';

function tool(name, access = 'read', role = 'task') {
    return { name, description: `${name} schema`, inputSchema: { type: 'object', properties: {}, additionalProperties: false }, access, role };
}

function interaction(id, name, args, result, toolName = name) {
    const structuredContent = result;
    return [
        { role: 'assistant', content: null, toolCalls: [{ id, name, arguments: args }] },
        { role: 'tool', toolCallId: id, name: toolName, content: JSON.stringify({
            success: structuredContent.success !== false,
            structuredContent,
        }) },
    ];
}

test('compaction keeps operation identity and unfinished preview acceptance with exact call/result pairing', () => {
    const tools = [tool('scene.read'), tool('scene.node.create', 'write')];
    const messages = [
        { role: 'system', content: 'CocosAgent system instructions' },
        { role: 'user', content: 'Place a sprite and verify it in preview.' },
        ...interaction('read-old-0', 'scene.read', {}, { success: true, snapshot: 'old-scene-data'.repeat(1_500) }),
        ...interaction('write-pending-1', 'scene.node.create', { operationId: 'op-preview-42' }, {
            success: true, outcome: 'needs-preview', operationId: 'op-preview-42',
        }),
        ...interaction('read-old-2', 'scene.read', {}, { success: true, snapshot: 'intermediate-scene-data'.repeat(1_500) }),
        ...interaction('read-old-3', 'scene.read', {}, { success: true, snapshot: 'another-large-result'.repeat(1_500) }),
        ...interaction('read-new-4', 'scene.read', {}, { success: true, nodes: 4 }),
        ...interaction('read-new-5', 'scene.read', {}, { success: true, nodes: 5 }),
    ];
    const original = structuredClone(messages);

    const prepared = prepareAgentContext({
        messages,
        tools,
        activeTask: 'Place a sprite and verify it in preview.',
        options: { maxEstimatedTokens: 4_000, keepRecentMessages: 2, keepRecentToolInteractions: 1 },
    });

    assert.equal(prepared.fitsBudget, true);
    assert.equal(prepared.report.compacted, true);
    assert.ok(prepared.report.summarizedToolCalls >= 3);
    assert.ok(prepared.report.operationIdentities.includes('operationId=op-preview-42'));
    assert.deepEqual(prepared.report.outstandingAcceptance, [{
        key: 'operationId=op-preview-42', kind: 'preview', status: 'needs-preview',
        callId: 'write-pending-1', toolName: 'scene.node.create',
    }]);
    assert.ok(prepared.report.compactedInteractions.some((item) => item.callId === 'read-old-0'
        && item.resultCallId === 'read-old-0' && item.pairStatus === 'matched'));
    assert.ok(prepared.messages.some((message) => message.role === 'user'
        && typeof message.content === 'string'
        && message.content.includes('callId=read-old-0 -> resultCallId=read-old-0; pair=matched')));
    assert.ok(prepared.messages.some((message) => message.role === 'assistant'
        && message.toolCalls?.some((call) => call.id === 'write-pending-1')));
    assert.ok(prepared.messages.some((message) => message.role === 'tool'
        && message.toolCallId === 'write-pending-1'));
    assert.deepEqual(messages, original, 'preparing provider context must not mutate canonical run history');
});

test('accepted preview clears the outstanding checkpoint while its original operation remains indexed', () => {
    const tools = [tool('scene.node.create', 'write'), tool('cocos_2x_operation_preview_accept', 'write')];
    const messages = [
        { role: 'system', content: 'CocosAgent system instructions' },
        { role: 'user', content: 'Create and preview a node.' },
        ...interaction('write-1', 'scene.node.create', { operationId: 'op-accepted-1' }, {
            success: true, outcome: 'needs-preview', operationId: 'op-accepted-1',
        }),
        ...interaction('preview-1', 'cocos_2x_operation_preview_accept', { operationId: 'op-accepted-1' }, {
            success: true, outcome: 'completed', operationId: 'op-accepted-1', preview: 'passed',
        }),
        ...interaction('read-2', 'scene.node.create', {}, { success: true, outcome: 'completed', detail: 'long'.repeat(5_000) }),
        ...interaction('read-3', 'scene.node.create', {}, { success: true, outcome: 'completed', detail: 'large'.repeat(5_000) }),
        ...interaction('read-4', 'scene.node.create', {}, { success: true, outcome: 'completed' }),
        ...interaction('read-5', 'scene.node.create', {}, { success: true, outcome: 'completed' }),
    ];

    const prepared = prepareAgentContext({
        messages,
        tools,
        activeTask: 'Create and preview a node.',
        options: { maxEstimatedTokens: 2_000, keepRecentMessages: 2, keepRecentToolInteractions: 1 },
    });

    assert.equal(prepared.report.compacted, true);
    assert.deepEqual(prepared.report.outstandingAcceptance, []);
    assert.ok(prepared.report.compactedInteractions.some((item) => item.callId === 'write-1'
        && item.resultCallId === 'write-1' && item.operationIdentities.includes('operationId=op-accepted-1')));
    assert.ok(prepared.report.compactedInteractions.some((item) => item.callId === 'preview-1'
        && item.resultCallId === 'preview-1' && item.acceptance.includes('preview=passed')));
});

test('large older read results can shrink while the assistant call and matching result ID stay paired', () => {
    const tools = [tool('scene.read')];
    const messages = [
        { role: 'system', content: 'CocosAgent system instructions' },
        { role: 'user', content: 'Inspect the scene repeatedly.' },
        ...interaction('large-read-0', 'scene.read', {}, { success: true, snapshot: 'scene-node-'.repeat(2_000) }),
        ...interaction('read-1', 'scene.read', {}, { success: true, count: 1 }),
        ...interaction('read-2', 'scene.read', {}, { success: true, count: 2 }),
        ...interaction('read-3', 'scene.read', {}, { success: true, count: 3 }),
        ...interaction('read-4', 'scene.read', {}, { success: true, count: 4 }),
    ];

    const prepared = prepareAgentContext({
        messages,
        tools,
        activeTask: 'Inspect the scene repeatedly.',
        options: { maxEstimatedTokens: 2_000, keepRecentMessages: 128, keepRecentToolInteractions: 1 },
    });

    const call = prepared.messages.find((message) => message.role === 'assistant'
        && message.toolCalls?.some((item) => item.id === 'large-read-0'));
    const receipt = prepared.messages.find((message) => message.role === 'tool' && message.toolCallId === 'large-read-0');
    assert.equal(prepared.report.compacted, true);
    assert.ok(prepared.report.compactedToolResults >= 1);
    assert.equal(call.toolCalls[0].id, receipt.toolCallId);
    assert.match(receipt.content, /"callId":"large-read-0"/);
    assert.match(receipt.content, /"resultCallId":"large-read-0"/);
    assert.equal(receipt.content.includes('scene-node-'.repeat(50)), false);
});

test('unpaired tool calls and orphan results are summarized explicitly and never sent as broken message pairs', () => {
    const tools = [tool('scene.read')];
    const messages = [
        { role: 'system', content: 'CocosAgent system instructions' },
        { role: 'user', content: 'Inspect and validate the scene.' },
        { role: 'assistant', content: null, toolCalls: [{ id: 'missing-result-call', name: 'scene.read', arguments: { operationId: 'op-missing-result' } }] },
        { role: 'tool', toolCallId: 'orphan-result-id', name: 'scene.read', content: JSON.stringify({ success: false, error: { code: 'ORPHAN' } }) },
        ...interaction('large-read-1', 'scene.read', {}, { success: true, data: 'large'.repeat(8_000) }),
        ...interaction('read-2', 'scene.read', {}, { success: true, data: 2 }),
        ...interaction('read-3', 'scene.read', {}, { success: true, data: 3 }),
        ...interaction('read-4', 'scene.read', {}, { success: true, data: 4 }),
        ...interaction('read-5', 'scene.read', {}, { success: true, data: 5 }),
    ];

    const prepared = prepareAgentContext({
        messages,
        tools,
        activeTask: 'Inspect and validate the scene.',
        options: { maxEstimatedTokens: 2_500, keepRecentMessages: 2, keepRecentToolInteractions: 1 },
    });

    assert.equal(prepared.report.compacted, true);
    assert.equal(prepared.report.compactedInteractions.find((item) => item.callId === 'missing-result-call')?.pairStatus, 'missing');
    assert.ok(prepared.report.unpairedToolResults.some((item) => item.resultCallId === 'orphan-result-id'
        && item.reason === 'missing-call'));
    assert.ok(prepared.report.outstandingAcceptance.some((item) => item.key === 'operationId=op-missing-result'
        && item.kind === 'recovery' && item.status === 'tool-result-missing'));
    assert.equal(prepared.messages.some((message) => message.role === 'assistant'
        && message.toolCalls?.some((call) => call.id === 'missing-result-call')), false);
    assert.equal(prepared.messages.some((message) => message.role === 'tool'
        && message.toolCallId === 'orphan-result-id'), false);
    assert.ok(prepared.messages.some((message) => message.role === 'user'
        && typeof message.content === 'string'
        && message.content.includes('callId=missing-result-call -> resultCallId=missing; pair=missing')));
});

test('full tool receipts recover operation identity and acceptance state lost from a truncated provider result', () => {
    const tools = [tool('scene.node.create', 'write'), tool('scene.read')];
    const messages = [
        { role: 'system', content: 'CocosAgent system instructions' },
        { role: 'user', content: 'Create a node, then inspect the result.' },
        ...interaction('write-truncated-1', 'scene.node.create', {}, { truncated: true, preview: 'partial' }),
        ...interaction('large-read-2', 'scene.read', {}, { success: true, data: 'large'.repeat(8_000) }),
        ...interaction('read-3', 'scene.read', {}, { success: true, data: 3 }),
        ...interaction('read-4', 'scene.read', {}, { success: true, data: 4 }),
        ...interaction('read-5', 'scene.read', {}, { success: true, data: 5 }),
        ...interaction('read-6', 'scene.read', {}, { success: true, data: 6 }),
    ];
    const receipts = [{
        callId: 'write-truncated-1', toolName: 'scene.node.create', access: 'write', role: 'task',
        result: { structuredContent: { success: true, outcome: 'needs-preview', operationId: 'op-from-full-receipt-7' } },
    }];

    const prepared = prepareAgentContext({
        messages,
        tools,
        receipts,
        activeTask: 'Create a node, then inspect the result.',
        options: { maxEstimatedTokens: 2_500, keepRecentMessages: 2, keepRecentToolInteractions: 1 },
    });

    assert.equal(prepared.report.compacted, true);
    assert.ok(prepared.report.operationIdentities.includes('operationId=op-from-full-receipt-7'));
    assert.ok(prepared.report.outstandingAcceptance.some((item) => item.callId === 'write-truncated-1'
        && item.key === 'operationId=op-from-full-receipt-7' && item.kind === 'preview'));
    assert.ok(prepared.messages.some((message) => message.role === 'user'
        && typeof message.content === 'string'
        && message.content.includes('operationId=op-from-full-receipt-7; preview=needs-preview')));
});

test('kernel stops before provider call when protected context cannot fit and reports the operation state', async () => {
    let providerCalls = 0;
    const events = [];
    const kernel = new AgentKernel({
        provider: { complete: async () => {
            providerCalls += 1;
            return { message: { role: 'assistant', content: 'unexpected' }, finishReason: 'stop' };
        } },
        tools: { listTools: async () => [tool('scene.read')], callTool: async () => ({}) },
        policy: { approveWrite: async () => false },
        contextBudget: { maxEstimatedTokens: 512 },
        hooks: { onEvent: (event) => events.push(event) },
        systemPrompt: 'CocosAgent system instructions',
    });
    const image = `data:image/jpeg;base64,${'a'.repeat(12_000)}`;

    const result = await kernel.run({
        task: 'Inspect this screenshot.',
        mode: 'Ask',
        history: [{ role: 'user', content: [
            { type: 'text', text: 'Previous screenshot for this task.' },
            { type: 'image_url', image_url: { url: image, detail: 'high' } },
        ] }],
    });

    assert.equal(providerCalls, 0);
    assert.equal(result.reason, 'context-budget-exceeded');
    assert.equal(result.status, 'stopped');
    assert.equal(result.contextCompactions.length, 1);
    assert.ok(events.some((event) => event.type === 'context.budget-exceeded'));
    assert.equal(events.some((event) => event.type === 'model.requested'), false);
    assert.match(result.finalText, /没有继续调用模型/);
});

test('default context budget admits the complete Creator tool catalog before the first Agent request', () => {
    const creatorTools = Array.from({ length: 51 }, (_, index) => {
        const properties = Object.fromEntries(Array.from({ length: 8 }, (_, propertyIndex) => [
            `field${propertyIndex}`,
            { type: 'string', description: `Creator 2.4 contract field ${propertyIndex}. `.repeat(4) },
        ]));
        return {
            name: `cocos_2x_tool_${index}`,
            description: `Creator 2.4.15 tool contract and access rules. `.repeat(24),
            inputSchema: { type: 'object', properties, additionalProperties: false },
            access: index % 4 === 0 ? 'write' : 'read',
            role: index < 3 ? 'setup' : 'task',
        };
    });
    const prepared = prepareAgentContext({
        messages: [
            { role: 'system', content: 'Creator Agent instructions and live tool catalog.' },
            { role: 'user', content: 'Inspect the active LinkUp scene.' },
        ],
        tools: creatorTools,
        activeTask: 'Inspect the active LinkUp scene.',
    });

    assert.ok(prepared.report.estimatedTokens > 24_000, 'regression fixture must exceed the previous default');
    assert.equal(prepared.report.maxEstimatedTokens, 64_000);
    assert.equal(prepared.fitsBudget, true);
    assert.equal(prepared.report.compacted, false);
});

test('kernel sends a compact view but returns the original complete call/result history', async () => {
    const sceneRead = tool('scene.read');
    const hugeReceipt = { success: true, structuredContent: { scene: 'old', nodes: 'node-data-'.repeat(2_000) } };
    const history = [
        { role: 'user', content: 'Earlier task context.' },
        ...interaction('history-read-1', 'scene.read', {}, hugeReceipt),
        ...interaction('history-read-2', 'scene.read', {}, { success: true, structuredContent: { scene: 'middle' } }),
        ...interaction('history-read-3', 'scene.read', {}, { success: true, structuredContent: { scene: 'recent' } }),
        ...interaction('history-read-4', 'scene.read', {}, { success: true, structuredContent: { scene: 'latest' } }),
    ];
    let providerMessages;
    const kernel = new AgentKernel({
        provider: { complete: async ({ messages }) => {
            providerMessages = messages;
            return { message: { role: 'assistant', content: '已检查。' }, finishReason: 'stop' };
        } },
        tools: { listTools: async () => [sceneRead], callTool: async () => ({}) },
        policy: { approveWrite: async () => false },
        contextBudget: { maxEstimatedTokens: 3_000, keepRecentMessages: 2, keepRecentToolInteractions: 1 },
        systemPrompt: 'CocosAgent system instructions',
    });

    const result = await kernel.run({ task: 'Check the active scene.', mode: 'Ask', history });

    assert.equal(result.status, 'completed');
    assert.ok(result.contextCompactions.some((report) => report.compacted));
    assert.ok(providerMessages.some((message) => message.role === 'user'
        && typeof message.content === 'string' && message.content.includes('CocosAgent compacted context')));
    assert.equal(providerMessages.some((message) => message.role === 'tool'
        && message.content.includes('node-data-'.repeat(20))), false);
    assert.ok(result.messages.some((message) => message.role === 'assistant'
        && message.toolCalls?.some((call) => call.id === 'history-read-1')));
    assert.ok(result.messages.some((message) => message.role === 'tool'
        && message.toolCallId === 'history-read-1' && message.content.includes('node-data-'.repeat(20))));
    assert.ok(result.messages.some((message) => message.role === 'user' && message.content === 'Check the active scene.'));
});

test('kernel uses a bounded provider dialogue summary during compaction and reports its source', async () => {
    const history = Array.from({ length: 12 }, (_, index) => ({
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `Old discussion ${index}: ${`background detail ${index} `.repeat(180)}`,
    }));
    let summarizedDialogue = '';
    let sentMessages;
    const kernel = new AgentKernel({
        provider: {
            summarizeContext: async ({ task, dialogue }) => {
                assert.equal(task, 'Inspect the current project constraints.');
                summarizedDialogue = dialogue;
                return 'Semantic summary: earlier discussion established a portrait project constraint.';
            },
            complete: async ({ messages }) => {
                sentMessages = messages;
                return { message: { role: 'assistant', content: 'Current constraints inspected.' }, finishReason: 'stop' };
            },
        },
        tools: { listTools: async () => [], callTool: async () => ({}) },
        policy: { approveWrite: async () => false },
        contextBudget: { maxEstimatedTokens: 2_000, keepRecentMessages: 1, keepRecentToolInteractions: 1 },
        systemPrompt: 'CocosAgent system instructions',
    });
    const result = await kernel.run({ task: 'Inspect the current project constraints.', mode: 'Ask', history });
    assert.equal(result.status, 'completed');
    assert.ok(summarizedDialogue.includes('Old discussion'));
    assert.ok(summarizedDialogue.length <= 24_000);
    assert.ok(sentMessages.some((message) => message.role === 'user'
        && typeof message.content === 'string'
        && message.content.includes('Semantic summary: earlier discussion established a portrait project constraint.')));
    assert.ok(result.contextCompactions.some((report) => report.dialogueSummarySource === 'provider'));
});

test('provider context overflow triggers exactly one retry after compaction', async () => {
    const history = Array.from({ length: 14 }, (_, index) => ({
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `Historical note ${index}: ${`project detail ${index} `.repeat(220)}`,
    }));
    let attempts = 0;
    const kernel = new AgentKernel({
        provider: {
            summarizeContext: async () => 'Earlier dialogue summary: preserve only relevant project constraints.',
            complete: async () => {
                attempts += 1;
                if (attempts === 1) {
                    throw new ProviderError('PROVIDER_CONTEXT_LIMIT', 'Context exceeded.', { provider: 'synthetic-a' });
                }
                return { message: { role: 'assistant', content: 'Completed after bounded retry.' }, finishReason: 'stop' };
            },
        },
        tools: { listTools: async () => [], callTool: async () => ({}) },
        policy: { approveWrite: async () => false },
        contextBudget: { maxEstimatedTokens: 4_000, keepRecentMessages: 1, keepRecentToolInteractions: 1 },
        systemPrompt: 'CocosAgent system instructions',
    });
    const result = await kernel.run({ task: 'Continue the current project task.', mode: 'Ask', history });
    assert.equal(result.status, 'completed', result.reason);
    assert.equal(attempts, 2);
    assert.ok(result.contextCompactions.some((report) => report.maxEstimatedTokens === 4_000));
});

test('a repeated generic context-limit error stops after the single allowed retry', async () => {
    let attempts = 0;
    const kernel = new AgentKernel({
        provider: {
            complete: async () => {
                attempts += 1;
                throw new ProviderError('PROVIDER_CONTEXT_LIMIT', 'Context exceeded.', { provider: 'synthetic-b' });
            },
        },
        tools: { listTools: async () => [], callTool: async () => ({}) },
        policy: { approveWrite: async () => false },
        contextBudget: { maxEstimatedTokens: 4_000, keepRecentMessages: 1, keepRecentToolInteractions: 1 },
        systemPrompt: 'CocosAgent system instructions',
    });
    const result = await kernel.run({ task: 'Continue the project task.', mode: 'Ask' });
    assert.equal(result.status, 'stopped');
    assert.equal(result.reason, 'provider-context-limit-retry-exhausted');
    assert.equal(attempts, 2);
    assert.equal(result.receipts.length, 0);
});

test('non-context Provider failures do not trigger compaction retries', async () => {
    let attempts = 0;
    const kernel = new AgentKernel({
        provider: { complete: async () => {
            attempts += 1;
            throw new ProviderError('PROVIDER_NETWORK_ERROR', 'Network unavailable.', { provider: 'synthetic' });
        } },
        tools: { listTools: async () => [], callTool: async () => ({}) },
        policy: { approveWrite: async () => false },
        systemPrompt: 'CocosAgent system instructions',
    });
    const result = await kernel.run({ task: 'Inspect the project.', mode: 'Ask' });
    assert.equal(result.status, 'stopped');
    assert.equal(result.reason, 'provider-error:provider_network_error');
    assert.match(result.finalText, /Provider 网络请求失败/);
    assert.equal(attempts, 1);
    assert.equal(result.contextCompactions.length, 0);
});

test('cancellation during overflow compaction prevents the retry request', async () => {
    const controller = new AbortController();
    let completeCalls = 0;
    let summaryCalls = 0;
    const history = Array.from({ length: 14 }, (_, index) => ({
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `Historical note ${index}: ${`project detail ${index} `.repeat(220)}`,
    }));
    const kernel = new AgentKernel({
        provider: {
            summarizeContext: async () => {
                summaryCalls += 1;
                if (summaryCalls > 1) controller.abort();
                return 'Compacted historical constraints.';
            },
            complete: async () => {
                completeCalls += 1;
                throw new ProviderError('PROVIDER_CONTEXT_LIMIT', 'Context exceeded.');
            },
        },
        tools: { listTools: async () => [], callTool: async () => ({}) },
        policy: { approveWrite: async () => false },
        contextBudget: { maxEstimatedTokens: 4_000, keepRecentMessages: 1, keepRecentToolInteractions: 1 },
        systemPrompt: 'CocosAgent system instructions',
    });
    const result = await kernel.run({ task: 'Continue the project task.', mode: 'Ask', history, signal: controller.signal });
    assert.equal(result.status, 'cancelled');
    assert.equal(result.reason, 'cancelled');
    assert.equal(completeCalls, 1);
    assert.ok(summaryCalls > 1);
});

test('DeepSeek context-limit responses are normalized to the generic ProviderError contract', async () => {
    const provider = new DeepSeekProvider({
        apiKey: 'test-api-key-valid', model: 'deepseek-flash',
        fetcher: async () => new Response(JSON.stringify({ error: { message: 'maximum context length exceeded' } }), {
            status: 400, headers: { 'content-type': 'application/json' },
        }),
    });
    await assert.rejects(provider.complete({ messages: [{ role: 'user', content: 'hello' }], tools: [], mode: 'Ask' }),
        (error) => error instanceof ProviderError && error.code === 'PROVIDER_CONTEXT_LIMIT'
            && error.provider === 'deepseek' && error.status === 400);
});
