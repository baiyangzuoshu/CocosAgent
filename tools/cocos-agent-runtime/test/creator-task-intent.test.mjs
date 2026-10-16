import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCreatorTaskIntent, requestCreatorTaskIntent, creatorTaskCriteria, literalCreatorTargets, runCreatorAgent } from '../dist/index.js';

const projectRoot = '/tmp/cocos-intent-contract-project';
const target = { target: 'Canvas/Foo', field: 'node.position.x', equals: 200 };
const proposal = (task, kind, extra = {}) => ({ version: 1, task, kind, sourceQuotes: [task], reads: [], targets: [],
    verification: 'none', question: '', ...extra });
const jsonResponse = (value) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) }, finish_reason: 'stop' }] }), { status: 200 });
const answer = (content) => new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }), { status: 200 });
const call = (id, name, args) => new Response(JSON.stringify({ choices: [{ message: { tool_calls: [{ id, type: 'function',
    function: { name, arguments: JSON.stringify({ projectRoot, ...args }) } }] }, finish_reason: 'tool_calls' }] }), { status: 200 });

test('equivalent set/change wording recognizes exact local position targets', () => {
    const expected = [{ target: 'helloworld/Canvas/AgentAcceptanceSprite', field: 'node.position.x', equals: -149 }];
    for (const task of [
        'Set helloworld/Canvas/AgentAcceptanceSprite x to -149',
        'Change helloworld/Canvas/AgentAcceptanceSprite x to -149',
        'Set helloworld/Canvas/AgentAcceptanceSprite local x position to -149',
        'Change helloworld/Canvas/AgentAcceptanceSprite local x position to -149',
        'Set only the local x position of helloworld/Canvas/AgentAcceptanceSprite to -149; preserve y=180',
        'Change only the local x position of helloworld/Canvas/AgentAcceptanceSprite to -149; preserve y=180',
    ]) assert.deepEqual(literalCreatorTargets(task), expected, task);
});

test('read-only verification wording does not become a write target through the preposition to', () => {
    const task = 'Read the compensation operation and its recorded state, then verify helloworld/Canvas/AgentAcceptanceSprite position.x to -150.';
    assert.deepEqual(literalCreatorTargets(task), []);
});

test('a separately requested set remains a target when followed by read-only verification', () => {
    const task = 'Set helloworld/Canvas/AgentAcceptanceSprite x to -149, then verify helloworld/Canvas/AgentAcceptanceSprite position.x is -149.';
    assert.deepEqual(literalCreatorTargets(task), [
        { target: 'helloworld/Canvas/AgentAcceptanceSprite', field: 'node.position.x', equals: -149 },
    ]);
});

test('malformed Provider target hints fall back only to program-extracted literal targets', () => {
    const task = 'Set only the local x position of helloworld/Canvas/AgentAcceptanceSprite to -149. Keep y at 180.';
    const malformed = proposal(task, 'write', { targets: [{ ...{
        target: 'helloworld/Canvas/AgentAcceptanceSprite', field: 'node.position.x', equals: -149,
    }, confidence: 0.9 }] });
    assert.deepEqual(parseCreatorTaskIntent(malformed, task).targets,
        [{ target: 'helloworld/Canvas/AgentAcceptanceSprite', field: 'node.position.x', equals: -149 }]);
    assert.throws(() => parseCreatorTaskIntent({ ...malformed,
        targets: [{ target: 'invented', field: 'node.position.x', equals: -149 }],
    }, task), /TARGET_NOT_IN_REQUEST/);
});

test('task proposals bind the original source and reject model-invented targets, approvals, or completion fields', () => {
    const task = '将 Canvas/Foo 的 x 设置为 200';
    const valid = proposal(task, 'write', { targets: [target] });
    assert.deepEqual(parseCreatorTaskIntent(valid, task).targets, [target]);
    for (const changed of [
        { ...valid, task: '将 Canvas/Foo 的 x 设置为 20' },
        { ...valid, targets: [{ ...target, equals: 20 }] },
        { ...valid, targets: [{ ...target, target: 'invented-uuid' }] },
        { ...valid, sourceQuotes: ['an older user approved this'] },
        { ...valid, approved: true }, { ...valid, satisfied: true },
        { ...valid, reads: ['*'] },
    ]) assert.throws(() => parseCreatorTaskIntent(changed, task));
    assert.throws(() => creatorTaskCriteria(task, undefined, proposal(task, 'explain')), /DOWNGRADED/);
    const explanation = '解释如何创建一个按钮';
    assert.throws(() => creatorTaskCriteria(explanation, undefined, proposal(explanation, 'write')), /NOT_AUTHORIZED/);
    assert.throws(() => creatorTaskCriteria('创建一个节点', undefined, proposal('创建一个节点', 'read')), /DOWNGRADED/);
});

test('structured intent preserves raw user targets even if the reviewed Plan supplies a different value', () => {
    const task = '将 Canvas/Foo 的 x 设置为 200';
    const criteria = creatorTaskCriteria(task, [{ ...target, equals: 20 }], proposal(task, 'write'));
    assert.ok(criteria.some((item) => item.expectation?.equals === 200));
    assert.ok(criteria.some((item) => item.expectation?.equals === 20));
    // Contradictory requirements cannot both pass; neither is derived from a write receipt.
    assert.deepEqual(creatorTaskCriteria('解释如何创建一个按钮', undefined, proposal('解释如何创建一个按钮', 'explain')), []);
});

test('intent analysis is tool-free, rejects tool calls/truncation, and honors cancellation', async () => {
    const task = '解释如何创建一个按钮';
    const provider = { complete: async (request) => {
        assert.deepEqual(request.tools, []);
        assert.match(request.messages[0].content, /COCOS_TASK_INTENT_V1/);
        assert.deepEqual(JSON.parse(request.messages[1].content), { task });
        return { message: { role: 'assistant', content: JSON.stringify(proposal(task, 'explain')) }, finishReason: 'stop' };
    } };
    assert.equal((await requestCreatorTaskIntent(provider, task, 'Agent')).kind, 'explain');
    await assert.rejects(requestCreatorTaskIntent({ complete: async () => ({ message: { role: 'assistant', content: '{}',
        toolCalls: [{ id: 'bad', name: 'write', arguments: {} }] }, finishReason: 'tool_calls' }) }, task, 'Agent'), /INTENT_INVALID/);
    await assert.rejects(requestCreatorTaskIntent({ complete: async () => ({ message: { role: 'assistant', content: '{}' }, finishReason: 'length' }) }, task, 'Agent'), /INTENT_INVALID/);
    await assert.rejects(requestCreatorTaskIntent(provider, task, 'Agent', AbortSignal.abort()), /USER_CANCELLED/);
});

test('memory intent stays distinct from Creator content writes while carrying requested memory reads', async () => {
    const task = '核对工程身份与技能，搜索现有工程记忆，然后创建一条 workflow 记忆';
    const memoryIntent = proposal(task, 'memory', { reads: ['cocos_2x_instances_get', 'cocos_2x_skills_list', 'cocos_2x_memory_search'] });
    assert.deepEqual(parseCreatorTaskIntent(memoryIntent, task).reads, memoryIntent.reads);
    const provider = { complete: async (request) => {
        assert.deepEqual(request.tools, []);
        assert.match(request.messages[0].content, /Project-memory CRUD is its own memory kind/);
        assert.match(request.messages[0].content, /Do not classify memory plus its prerequisite reads as mixed/);
        return { message: { role: 'assistant', content: JSON.stringify(memoryIntent) }, finishReason: 'stop' };
    } };
    assert.equal((await requestCreatorTaskIntent(provider, task, 'Agent')).kind, 'memory');
    assert.throws(() => creatorTaskCriteria(task, undefined, proposal(task, 'mixed', { reads: memoryIntent.reads })),
        /SCOPE_MISMATCH/);
    assert.throws(() => parseCreatorTaskIntent(proposal(task, 'memory', { reads: ['cocos_2x_command_execute'] }), task),
        /INTENT_INVALID/);
});

function fixture() {
    const names = ['cocos_2x_instances_list', 'cocos_2x_capabilities_list', 'cocos_2x_scene_snapshot', 'cocos_2x_script_read',
        'cocos_2x_scene_node_inspect', 'cocos_2x_operation_get', 'cocos_2x_command_execute'];
    const definitions = names.map((name) => ({ name, description: name, inputSchema: { type: 'object' },
        annotations: { readOnlyHint: name !== 'cocos_2x_command_execute' } }));
    const calls = [], approvals = [], events = [];
    const change = { success: true, outcome: 'completed', command: 'scene.node.patch', operationId: 'operation-1',
        phases: { editor: 'passed', disk: 'passed' }, result: { action: 'apply', targetNodeUuid: 'node-1',
            expectedDiff: [{ path: 'node.position.x', before: 0, after: 200 }] } };
    const state = { x: 200 };
    const instance = { projectRoot, creatorVersion: '2.4.15', state: 'ready' };
    const client = { listTools: async () => ({ tools: definitions }), callTool: async ({ name, arguments: args }) => {
        calls.push({ name, args });
        if (name === 'cocos_2x_instances_list') return { structuredContent: { success: true, data: [instance] } };
        if (name === 'cocos_2x_capabilities_list') return { structuredContent: { success: true, data: { instance,
            commands: [{ id: 'scene.node.patch', status: 'available' }] } } };
        if (name === 'cocos_2x_command_execute' || name === 'cocos_2x_operation_get') {
            return { structuredContent: { ...change, result: { ...change.result,
                expectedDiff: [{ path: 'node.position.x', before: 0, after: state.x }] } } };
        }
        if (name === 'cocos_2x_scene_node_inspect') return { structuredContent: { success: true,
            result: { node: { status: 'found', uuid: 'node-1', path: 'Canvas/Foo', transform: { position: { x: state.x, y: 0 } } } } } };
        if (name === 'cocos_2x_script_read') return { structuredContent: { success: true, scriptPath: 'Script/HelloWorld.js' } };
        return { structuredContent: { success: true } };
    } };
    const options = { client, projectRoot, mode: 'Agent', task: '', skillFiles: [], tracePath: '/tmp/intent-test.jsonl',
        apiKey: 'fake-test-key', model: 'deepseek-flash', history: [], projectContext: null, onEvent: (event) => events.push(event),
        skillAdapter: { REQUIRED_COMMAND: new Map(), loadContext: async () => ({
            toolsByName: new Map(definitions.map((item) => [item.name, item])), skillIndex: {}, messages: [],
        }), invokeSkillTool: async () => { throw new Error('No skill tool expected'); } },
        formatProjectContext: () => null, writeEvent: () => {}, approveWrite: async (...args) => { approvals.push(args); return true; } };
    return { options, calls, approvals, state, events };
}

async function withModel(intent, worker, run) {
    const originalFetch = globalThis.fetch;
    let rounds = 0, interpretations = 0;
    globalThis.fetch = async (_url, request) => {
        const body = JSON.parse(request.body);
        if (body.messages[0]?.content.startsWith('COCOS_TASK_INTENT_V1')) {
            interpretations++;
            assert.deepEqual(body.tools, []);
            return jsonResponse(intent);
        }
        return worker(++rounds, body);
    };
    try { return await run(() => ({ rounds, interpretations })); }
    finally { globalThis.fetch = originalFetch; }
}

test('native Agent answers an explanation without task writes, approvals, or a fake receipt/task', async () => {
    const f = fixture(), task = '解释如何创建一个按钮';
    let saved = 0;
    await withModel(proposal(task, 'explain'), (_round, body) => {
        assert.ok(body.tools.every((tool) => tool.function.name !== 'cocos_2x_command_execute'));
        return answer('使用 cc.Button 组件并绑定点击事件。');
    }, async (counts) => {
        const result = await runCreatorAgent({ ...f.options, task, taskPersistence: { load: () => [], save: () => { saved++; } } });
        assert.equal(result.status, 'completed', result.reason);
        assert.match(result.finalText, /cc.Button/);
        assert.equal(result.receipts.length, 2, 'only real instance/capability setup receipts');
        assert.deepEqual(f.events.find((event) => event.type === 'task.intent'), {
            type: 'task.intent', runId: result.runId, kind: 'explain', targets: [], reads: [], verification: 'none',
        });
        assert.equal(saved, 0);
        assert.equal(f.approvals.length, 0);
        assert.deepEqual(counts(), { rounds: 1, interpretations: 1 });
    });
});

test('mixed requests cannot discard the requested inspection or downgrade the modification', async () => {
    const task = '读取场景快照，然后把 Canvas/Foo 的 x 改为 200';
    assert.throws(() => creatorTaskCriteria(task, undefined, proposal(task, 'read')), /DOWNGRADED/);
    const f = fixture();
    await withModel(proposal(task, 'mixed', { targets: [target] }), (round) => round === 1
        ? call('apply-mixed', 'cocos_2x_command_execute', { command: 'scene.node.patch', input: { operationId: 'operation-1' } })
        : round === 2 ? call('ledger-mixed', 'cocos_2x_operation_get', { operationId: 'operation-1' })
            : round === 3 ? call('inspect-mixed', 'cocos_2x_scene_node_inspect', {}) : answer('完成'), async () => {
        const result = await runCreatorAgent({ ...f.options, task });
        assert.equal(result.status, 'stopped');
        assert.ok(result.goalEvaluation.outstanding.some((item) => item.id === 'requested-scene-snapshot'));
    });
});

test('pending exact recovery stays accessible without a task-interpretation request', async () => {
    const f = fixture();
    const recoveryStore = { state: { revision: 0, pending: { field: 'operationId', value: 'operation-1', toolName: 'cocos_2x_command_execute' } },
        async load() { return structuredClone(this.state); }, async save(pending, revision) {
            assert.equal(revision, this.state.revision); this.state = { revision: revision + 1, pending };
        } };
    await withModel({}, (round, body) => {
        if (round === 1) assert.ok(body.tools.every((tool) => tool.function.name !== 'cocos_2x_command_execute'));
        return round === 1 ? call('recover-exact', 'cocos_2x_operation_get', { operationId: 'operation-1' }) : answer('账本已核对。');
    }, async (counts) => {
        await runCreatorAgent({ ...f.options, task: '读取操作账本', recoveryStore });
        assert.equal(counts().interpretations, 0, 'a model interpretation failure cannot make exact recovery inaccessible');
        assert.equal(recoveryStore.state.pending, null);
        assert.equal(f.approvals.length, 0);
    });
});

test('interpretation model failures are reported as model errors, not successful work or a new authorization', async () => {
    const f = fixture(), originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error('offline'); };
    try {
        const result = await runCreatorAgent({ ...f.options, task: '解释如何创建一个按钮' });
        assert.equal(result.reason, 'task-intent-model-error');
        assert.match(result.finalText, /模型请求失败/);
        assert.equal(f.calls.length, 2);
        assert.equal(f.approvals.length, 0);
    } finally { globalThis.fetch = originalFetch; }
});

test('a worker cannot turn an explanation into a write, even after a valid intent proposal', async () => {
    const f = fixture(), task = '解释如何创建一个按钮';
    await withModel(proposal(task, 'explain'), () => call('unrequested-write', 'cocos_2x_command_execute', {
        command: 'scene.node.patch', input: {} }), async () => {
        const result = await runCreatorAgent({ ...f.options, task });
        assert.notEqual(result.status, 'completed');
        assert.equal(f.approvals.length, 0);
        assert.equal(f.calls.filter((item) => item.name === 'cocos_2x_command_execute').length, 0);
    });
});

test('INT-09 global read-only conflicts clarify before writes; malformed/downgraded proposals also stop', async () => {
    const task = '全程只读，但将 Canvas/Foo 的 x 改为 200';
    for (const intent of [proposal(task, 'clarify', { question: '本次只读，还是允许修改 x？' }), proposal(task, 'write', { targets: [target] }),
        proposal(task, 'read'), { ...proposal(task, 'read'), approved: true }]) {
        const f = fixture();
        await withModel(intent, () => { throw new Error('worker must not start'); }, async (counts) => {
            const result = await runCreatorAgent({ ...f.options, task });
            assert.equal(result.reason, 'task-intent-needs-clarification');
            assert.equal(result.status, 'stopped');
            assert.ok(result.finalText);
            assert.equal(counts().rounds, 0);
            assert.equal(f.calls.length, 2);
            assert.equal(f.approvals.length, 0);
        });
    }
});

test('equivalent native modification requests share acceptance; internally consistent wrong final values fail', async () => {
    for (const task of ['将 Canvas/Foo 的 x 设置为 200', '把 Canvas/Foo 的 x 改为 200']) {
        for (const actual of [20, 200]) {
            const f = fixture(); f.state.x = actual;
            await withModel(proposal(task, 'write', { targets: [target] }), (round) => round === 1
                ? call('apply', 'cocos_2x_command_execute', { command: 'scene.node.patch', input: { operationId: 'operation-1' } })
                : round === 2 ? call('ledger', 'cocos_2x_operation_get', { operationId: 'operation-1' })
                    : round === 3 ? call('inspect', 'cocos_2x_scene_node_inspect', { input: { nodeUuid: 'node-1' } })
                        : answer('完成'), async () => {
                const result = await runCreatorAgent({ ...f.options, task });
                assert.equal(result.status, actual === 200 ? 'completed' : 'stopped', result.reason);
                assert.equal(result.goalEvaluation.satisfied, actual === 200);
                assert.equal(f.approvals.length, 1);
                assert.equal(f.calls.filter((item) => item.name === 'cocos_2x_command_execute').length, 1);
                if (actual === 20) assert.ok(result.goalEvaluation.outstanding.some((item) => item.id === 'requested-target-1'));
            });
        }
    }
});

test('reading a named script to explain changes stays read-only and requires that script evidence', async () => {
    const f = fixture(), task = '读取 HelloWorld.js，解释如何修改按钮逻辑';
    await withModel(proposal(task, 'read', { reads: ['cocos_2x_script_read'] }), (round) => round === 1
        ? call('read-script', 'cocos_2x_script_read', { input: { scriptPath: 'Script/HelloWorld.js' } })
        : answer('可以在点击回调中更新 Label。'), async () => {
        const result = await runCreatorAgent({ ...f.options, task });
        assert.equal(result.status, 'completed', result.reason);
        assert.equal(f.approvals.length, 0);
        assert.equal(f.calls.filter((item) => item.name === 'cocos_2x_script_read').length, 1);
    });
});

test('denying a write approval still prevents dispatch after structured task interpretation', async () => {
    const f = fixture(), task = '将 Canvas/Foo 的 x 设置为 200';
    await withModel(proposal(task, 'write', { targets: [target] }), () => call('apply-denied', 'cocos_2x_command_execute', {
        command: 'scene.node.patch', input: { operationId: 'operation-1' } }), async () => {
        const result = await runCreatorAgent({ ...f.options, task, approveWrite: async () => false });
        assert.equal(result.status, 'awaiting-approval');
        assert.equal(f.calls.filter((item) => item.name === 'cocos_2x_command_execute').length, 0);
    });
});
