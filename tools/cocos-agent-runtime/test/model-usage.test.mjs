import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentKernel, DeepSeekProvider, parseDeepSeekUsage, requestCreatorTaskIntent,
    runCreatorAgent, summarizeModelUsage } from '../dist/index.js';

const counts = { prompt_tokens: 120, completion_tokens: 12, total_tokens: 132,
    prompt_cache_hit_tokens: 80, prompt_cache_miss_tokens: 40,
    prompt_tokens_details: { cached_tokens: 80 }, completion_tokens_details: { reasoning_tokens: 2 } };
const normalized = { inputTokens: 120, outputTokens: 12, totalTokens: 132,
    cacheHitTokens: 80, cacheMissTokens: 40, reasoningTokens: 2 };
const answer = (content = 'Done', usage = counts) => new Response(JSON.stringify({
    usage, choices: [{ message: { content }, finish_reason: 'stop' }],
}));

test('normalization preserves actual zero, missing fields and the cache alias without double counting', () => {
    assert.deepEqual(parseDeepSeekUsage(counts), normalized);
    assert.deepEqual(parseDeepSeekUsage({ prompt_tokens: 0, completion_tokens: -1, total_tokens: '9',
        prompt_tokens_details: { cached_tokens: 0 } }), {
        inputTokens: 0, outputTokens: null, totalTokens: null,
        cacheHitTokens: 0, cacheMissTokens: null, reasoningTokens: null,
    });
    assert.equal(parseDeepSeekUsage({}), null);
    assert.equal(parseDeepSeekUsage(undefined), null);
});

test('task interpretation, main-loop and both summary types each emit exactly one usage record', async () => {
    const records = [];
    const task = 'Explain how Cocos nodes work';
    const provider = new DeepSeekProvider({ apiKey: 'fixture-key-private', model: 'deepseek-flash',
        onUsage: (request) => records.push(request), fetcher: async (_url, init) => {
            const body = JSON.parse(init.body);
            if (body.messages[0]?.content?.startsWith('COCOS_TASK_INTENT_V1')) return answer(JSON.stringify({
                version: 1, task, kind: 'explain', sourceQuotes: [task], reads: [], targets: [], verification: 'none', question: '',
            }));
            return answer();
        } });
    await requestCreatorTaskIntent(provider, task, 'Agent');
    const reply = await provider.complete({ messages: [], tools: [], mode: 'Ask' });
    assert.deepEqual(reply.usage, normalized);
    await provider.summarizeContext({ task, dialogue: 'old history', summaryKind: 'context' });
    await provider.summarizeContext({ task, dialogue: 'old conversation', summaryKind: 'conversation' });
    await provider.summarizeContext({ task, dialogue: '' });
    assert.deepEqual(records.map((r) => r.purpose), ['task-understanding', 'main-loop', 'summary', 'summary']);
    assert.deepEqual(records.slice(-2).map((r) => r.summaryKind), ['context', 'conversation']);
    assert.equal(new Set(records.map((r) => r.requestId)).size, 4);
    assert.ok(records.every((r) => r.status === 'completed' && r.httpStatus === 200 && r.durationMs >= 0));
    assert.ok(!JSON.stringify(records).includes('fixture-key-private'));
    const summary = summarizeModelUsage(records);
    assert.equal(summary.totals.totalTokens, 528);
    assert.equal(summary.byPurpose.summary.totals.inputTokens, 240);
});

test('context-limit retry records both HTTP attempts and returns reported usage to the kernel event', async () => {
    const records = [], events = [];
    const provider = new DeepSeekProvider({ apiKey: 'fixture-key-private', model: 'deepseek-flash',
        onUsage: (request) => records.push(request), fetcher: async () => records.length === 0
            ? new Response(JSON.stringify({ error: { message: 'maximum context length exceeded' } }), { status: 400 })
            : answer() });
    const result = await new AgentKernel({ provider, tools: { listTools: async () => [], callTool: async () => ({}) },
        policy: { approveWrite: async () => false }, hooks: { onEvent: (event) => events.push(event) },
        systemPrompt: 'Fixture' }).run({ task: 'Explain', mode: 'Ask' });
    assert.equal(result.status, 'completed');
    assert.equal(records.length, 2);
    assert.equal(records[0].status, 'failed');
    assert.equal(records[0].usage, null);
    assert.equal(records[0].errorCode, 'PROVIDER_CONTEXT_LIMIT');
    assert.deepEqual(events.find((event) => event.type === 'model.responded').usage, normalized);
    const summary = summarizeModelUsage([...records, records[1]]);
    assert.equal(summary.requestCount, 2);
    assert.equal(summary.reportedRequestCount, 1);
    assert.equal(summary.totals.totalTokens, 132);
    assert.equal(summary.coverage.totalTokens, 1);
});

test('failed network and malformed responses retain request records without inventing zero usage', async () => {
    const records = [];
    const provider = new DeepSeekProvider({ apiKey: 'fixture-key-private', model: 'deepseek-flash',
        onUsage: (request) => records.push(request), fetcher: async () => { throw new Error('offline'); } });
    await assert.rejects(provider.summarizeContext({ task: 'task', dialogue: 'history' }), { code: 'PROVIDER_NETWORK_ERROR' });
    assert.equal(records[0].purpose, 'summary');
    assert.equal(records[0].httpStatus, null);
    assert.equal(records[0].usage, null);
    const malformed = new DeepSeekProvider({ apiKey: 'fixture-key-private', model: 'deepseek-flash',
        onUsage: (request) => records.push(request), fetcher: async () => new Response(JSON.stringify({ usage: counts })) });
    await assert.rejects(malformed.complete({ messages: [], tools: [], mode: 'Ask' }), { code: 'PROVIDER_INVALID_RESPONSE' });
    assert.equal(records[1].status, 'failed');
    assert.deepEqual(records[1].usage, normalized);
    const unknown = summarizeModelUsage(records.slice(0, 1));
    assert.equal(unknown.totals.totalTokens, null);
    assert.equal(unknown.coverage.totalTokens, 0);
});

test('telemetry consumer failure cannot cause a second model request or fail an otherwise successful result', async () => {
    let calls = 0;
    const provider = new DeepSeekProvider({ apiKey: 'fixture-key-private', model: 'deepseek-flash',
        onUsage: () => { throw new Error('state unavailable'); }, fetcher: async () => { calls += 1; return answer(); } });
    assert.equal((await provider.complete({ messages: [], tools: [], mode: 'Ask' })).message.content, 'Done');
    assert.equal(calls, 1);
});

test('native Creator adapter returns usage even when task interpretation stops before the main loop', async () => {
    const projectRoot = '/tmp/cocos-usage-project';
    const instance = { projectRoot, creatorVersion: '2.4.15', state: 'ready' };
    const names = ['cocos_2x_instances_list', 'cocos_2x_capabilities_list'];
    const definitions = names.map((name) => ({ name, description: name, inputSchema: { type: 'object' },
        annotations: { readOnlyHint: true } }));
    const original = globalThis.fetch;
    const events = [], trace = [];
    globalThis.fetch = async () => answer('invalid task interpretation');
    try {
        const result = await runCreatorAgent({ projectRoot, task: 'Explain the node model', mode: 'Agent',
            apiKey: 'fixture-key-private', model: 'deepseek-flash', history: [], projectContext: null,
            skillFiles: [], tracePath: '/tmp/unused-usage-trace.jsonl',
            client: { listTools: async () => ({ tools: definitions }), callTool: async ({ name }) => ({
                structuredContent: { success: true, data: name === names[0] ? [instance] : { instance, commands: [] } },
            }) },
            skillAdapter: { REQUIRED_COMMAND: new Map(), invokeSkillTool: async () => ({}),
                loadContext: async () => ({ toolsByName: new Map(definitions.map((d) => [d.name, d])),
                    skillIndex: {}, messages: [{ role: 'system', content: 'Fixture' }] }) },
            formatProjectContext: () => null, writeEvent: (_path, event) => trace.push(event),
            onEvent: (event) => events.push(event), approveWrite: async () => false });
        assert.equal(result.reason, 'task-intent-needs-clarification');
        assert.equal(result.modelUsage.requestCount, 1);
        assert.equal(result.modelUsage.byPurpose['task-understanding'].totals.totalTokens, 132);
        assert.equal(result.modelUsage.byPurpose['main-loop'].requestCount, 0);
        assert.equal(events.filter((event) => event.type === 'model.usage').length, 1);
        assert.equal(trace.filter((event) => event.event === 'model.usage').length, 1);
    } finally { globalThis.fetch = original; }
});
