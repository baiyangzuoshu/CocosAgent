import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentKernel, ProviderError } from '../dist/index.js';

const read = { name: 'fixture.read', description: 'Read a snapshot', inputSchema: { type: 'object' }, access: 'read', role: 'task' };
const done = { message: { role: 'assistant', content: 'Checked.' }, finishReason: 'stop' };
const call = (id) => ({ message: { role: 'assistant', content: null,
    toolCalls: [{ id, name: read.name, arguments: {} }] }, finishReason: 'tool_calls' });
const history = () => Array.from({ length: 12 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user',
    content: `Historical discussion ${index}: ${'portrait layout is required. '.repeat(200)}` }));
const options = { maxEstimatedTokens: 2_500, keepRecentMessages: 1, keepRecentToolInteractions: 1 };

async function inspectProjection(raw, extra = {}) {
    let round = 0, packet;
    const result = await new AgentKernel({ systemPrompt: 'Fixture', policy: { approveWrite: async () => false },
        ...extra, tools: { listTools: async () => [read], callTool: async () => raw }, provider: {
            complete: async ({ messages }) => {
                if (++round === 1) return call('read-json');
                packet = JSON.parse(messages.find((message) => message.role === 'tool').content);
                return done;
            },
        },
    }).run({ task: 'Read a snapshot', mode: 'Ask' });
    return { result, packet };
}

function assertPaired(messages) {
    const calls = messages.filter((message) => message.role === 'assistant')
        .flatMap((message) => message.toolCalls || []);
    const results = messages.filter((message) => message.role === 'tool');
    for (const item of calls) assert.equal(results.filter((result) => result.toolCallId === item.id && result.name === item.name).length, 1);
    for (const result of results) assert.equal(calls.filter((item) => item.id === result.toolCallId && item.name === result.name).length, 1);
}

test('model projection removes semantically identical JSON while retaining independent text and the full receipt', async () => {
    const structuredContent = { success: false, outcome: 'needs-review', operationId: 'op-uncertain',
        error: { code: 'COMPILE_TIMEOUT', sideEffect: 'unknown' }, values: [1, 2] };
    const raw = { isError: true, structuredContent, content: [
        { type: 'text', text: JSON.stringify({ values: [1, 2], error: { sideEffect: 'unknown', code: 'COMPILE_TIMEOUT' },
            operationId: 'op-uncertain', outcome: 'needs-review', success: false }, null, 2) },
        { type: 'text', text: 'Compiler output: see the exact original operation before recovery.' },
        { type: 'text', text: '{"additionalDiagnostic":"independent evidence"}' },
    ] };
    const original = structuredClone(raw);
    const { result, packet } = await inspectProjection(raw);
    assert.deepEqual(packet.structuredContent, structuredContent);
    assert.equal(packet.isError, true);
    assert.deepEqual(packet.content, raw.content.slice(1));
    assert.strictEqual(result.receipts[0].result, raw);
    assert.deepEqual(raw, original);
});

test('text-only output, non-equivalent JSON and significant array order are preserved', async () => {
    for (const raw of [
        { content: [{ type: 'text', text: '{"success":true,"data":"text only"}' }] },
        { structuredContent: { success: true, values: [1, 2] }, content: [{ type: 'text', text: '{"success":true,"values":[2,1]}' }] },
        { structuredContent: { success: true }, content: [{ type: 'text', text: '{"success":false}' }] },
        { structuredContent: { success: true }, content: [{ type: 'text', text: 'not JSON' }] },
    ]) {
        assert.deepEqual((await inspectProjection(raw)).packet.content, raw.content);
    }
});

test('duplicate JSON no longer causes unnecessary archival, while a genuinely large result is still archived', async () => {
    for (const size of [8_000, 16_000]) {
        const saved = [];
        const structuredContent = { success: true, data: 'x'.repeat(size) };
        const raw = { structuredContent, content: [{ type: 'text', text: JSON.stringify(structuredContent) }] };
        const { packet, result } = await inspectProjection(raw, { toolResultArchive: {
            save: async (entry) => saved.push(entry), read: async () => null,
        } });
        assert.strictEqual(result.receipts[0].result, raw);
        if (size === 8_000) {
            assert.equal(saved.length, 0);
            assert.equal(packet.structuredContent.data.length, 8_000);
        } else {
            assert.equal(saved.length, 1);
            assert.equal(packet.archived, true);
            assert.equal(packet.callId, 'read-json');
            const archived = JSON.parse(saved[0].payload);
            assert.equal(archived.structuredContent.data.length, 16_000);
            assert.deepEqual(archived.content, []);
        }
    }
});

test('successive rounds reuse a compacted model view and one summary while retaining the complete audit history', async () => {
    let mainCalls = 0, summaryCalls = 0;
    const snapshots = [];
    const result = await new AgentKernel({ systemPrompt: 'Fixture', policy: { approveWrite: async () => false },
        contextBudget: options, tools: { listTools: async () => [read],
            callTool: async () => ({ structuredContent: { success: true, snapshot: 'current' } }) },
        provider: { summarizeContext: async () => { summaryCalls++; return 'Historical constraint: portrait layout.'; },
            complete: async ({ messages }) => {
                snapshots.push(structuredClone(messages));
                return ++mainCalls < 4 ? call('new-' + mainCalls) : done;
            } },
    }).run({ task: 'Read three snapshots', mode: 'Ask', history: history() });
    assert.equal(result.status, 'completed');
    assert.equal(mainCalls, 4);
    assert.equal(summaryCalls, 1);
    assert.equal(result.contextCompactions.length, 1);
    assert.equal(result.messages.length, 21);
    assert.ok(result.messages.some((message) => message.content?.includes?.('Historical discussion 0')));
    assert.equal(result.receipts.length, 3);
    for (const messages of snapshots) {
        assertPaired(messages);
        assert.ok(messages.some((message) => message.content?.includes?.('Historical constraint: portrait layout.')));
        assert.ok(!messages.some((message) => message.content?.includes?.('Historical discussion 0')));
    }
    assert.ok(snapshots.at(-1).some((message) => message.role === 'tool' && message.toolCallId === 'new-3'));
});

test('an overflow retry reuses the same exact dialogue summary instead of charging for it twice', async () => {
    let mainCalls = 0, summaryCalls = 0;
    const result = await new AgentKernel({ systemPrompt: 'Fixture', policy: { approveWrite: async () => false },
        contextBudget: options, tools: { listTools: async () => [], callTool: async () => ({}) },
        provider: { summarizeContext: async () => { summaryCalls++; return 'Portrait layout.'; },
            complete: async () => {
                if (++mainCalls === 1) throw new ProviderError('PROVIDER_CONTEXT_LIMIT', 'Fixture context limit');
                return done;
            } },
    }).run({ task: 'Inspect constraints', mode: 'Ask', history: history() });
    assert.equal(result.status, 'completed');
    assert.equal(mainCalls, 2);
    assert.equal(summaryCalls, 1);
    assert.equal(result.contextCompactions.length, 2);
});

test('a failed summary falls back deterministically and is not repeatedly requested for unchanged history', async () => {
    let mainCalls = 0, summaryCalls = 0;
    const result = await new AgentKernel({ systemPrompt: 'Fixture', policy: { approveWrite: async () => false },
        contextBudget: options, tools: { listTools: async () => [read], callTool: async () => ({ structuredContent: { success: true } }) },
        provider: { summarizeContext: async () => { summaryCalls++; throw new Error('summary offline'); },
            complete: async () => ++mainCalls < 4 ? call('fallback-' + mainCalls) : done },
    }).run({ task: 'Read three snapshots', mode: 'Ask', history: history() });
    assert.equal(result.status, 'completed');
    assert.equal(summaryCalls, 1);
    assert.ok(result.contextCompactions.every((report) => report.dialogueSummarySource === 'deterministic'));
});

test('repeated compaction rebuilds original identity indexes and retains pending write pairs', async () => {
    const oldRead = [
        { role: 'assistant', content: null, toolCalls: [{ id: 'old-read', name: read.name, arguments: { operationId: 'old-index-id' } }] },
        { role: 'tool', name: read.name, toolCallId: 'old-read', content: JSON.stringify({ structuredContent: { success: true, data: 'old data'.repeat(2_000) } }) },
    ];
    const pending = [
        { role: 'assistant', content: null, toolCalls: [{ id: 'pending-write', name: 'scene.write', arguments: { operationId: 'op-needs-preview' } }] },
        { role: 'tool', name: 'scene.write', toolCallId: 'pending-write', content: JSON.stringify({ structuredContent: {
            success: true, outcome: 'needs-preview', operationId: 'op-needs-preview', preview: 'needs-preview',
        } }) },
    ];
    let rounds = 0, summaryCalls = 0;
    const result = await new AgentKernel({ systemPrompt: 'Fixture', policy: { approveWrite: async () => false }, contextBudget: options,
        tools: { listTools: async () => [read], callTool: async () => ({ structuredContent: { success: true, data: 'x'.repeat(700) } }) },
        provider: { summarizeContext: async () => { summaryCalls++; return 'Portrait layout.'; }, complete: async ({ messages }) => {
            assertPaired(messages);
            const index = messages.find((message) => message.role === 'user' && typeof message.content === 'string'
                && message.content.includes('CocosAgent compacted context'));
            assert.ok(index.content.includes('old-index-id'));
            assert.ok(index.content.includes('op-needs-preview'));
            assert.ok(messages.some((message) => message.role === 'tool' && message.toolCallId === 'pending-write'));
            return ++rounds < 10 ? call('later-read-' + rounds) : done;
        } },
    }).run({ task: 'Inspect snapshots; preserve the unresolved preview', mode: 'Ask', history: [...history(), ...oldRead, ...pending] });
    assert.equal(result.status, 'completed', result.reason);
    assert.ok(result.contextCompactions.length >= 2);
    for (const report of result.contextCompactions) {
        assert.ok(report.operationIdentities.includes('operationId=old-index-id'));
        assert.ok(report.operationIdentities.includes('operationId=op-needs-preview'));
        assert.ok(report.outstandingAcceptance.some((item) => item.callId === 'pending-write' && item.kind === 'preview'));
    }
    assert.equal(summaryCalls, 1);
    assert.ok(result.messages.some((message) => message.role === 'tool' && message.toolCallId === 'old-read'));
});

test('summary caching is scoped to one run and does not reuse another task interpretation', async () => {
    let summaryCalls = 0;
    const kernel = new AgentKernel({ systemPrompt: 'Fixture', policy: { approveWrite: async () => false }, contextBudget: options,
        tools: { listTools: async () => [], callTool: async () => ({}) }, provider: {
            summarizeContext: async ({ task }) => { summaryCalls++; return 'Historical notes for ' + task; },
            complete: async () => done,
        } });
    for (const task of ['First task', 'Second task']) assert.equal((await kernel.run({ task, mode: 'Ask', history: history() })).status, 'completed');
    assert.equal(summaryCalls, 2);
});

test('new omitted dialogue invalidates the summary cache when a later compaction becomes necessary', async () => {
    const sources = [], snapshots = [];
    let stopped = 0;
    const result = await new AgentKernel({ systemPrompt: 'Fixture', contextBudget: options,
        policy: { approveWrite: async () => false, createRunPolicy: () => ({
            onAssistantStop: () => ++stopped === 1
                ? { action: 'continue', message: 'Continue checking. '.repeat(70) }
                : { action: 'finish', reason: 'completed' },
        }) },
        tools: { listTools: async () => [], callTool: async () => ({}) },
        provider: {
            summarizeContext: async ({ dialogue }) => {
                sources.push(dialogue);
                return dialogue.includes('new factual note') ? 'Updated summary: new factual note.' : 'Initial summary.';
            },
            complete: async ({ messages }) => {
                snapshots.push(structuredClone(messages));
                return snapshots.length === 1
                    ? { message: { role: 'assistant', content: 'new factual note: '.repeat(300) }, finishReason: 'stop' } : done;
            },
        },
    }).run({ task: 'Inspect context', mode: 'Ask', history: history().slice(0, 6) });
    assert.equal(result.status, 'completed');
    assert.equal(sources.length, 2);
    assert.ok(!sources[0].includes('new factual note'));
    assert.ok(sources[1].includes('new factual note'));
    assert.ok(snapshots[1].some((message) => message.content?.includes?.('Updated summary: new factual note.')));
});
