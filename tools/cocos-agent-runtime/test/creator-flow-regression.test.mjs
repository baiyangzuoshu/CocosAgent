import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentKernel, CreatorRecoveryRegistry, createCreatorAgentPolicy, creatorTaskCriteria, verifyCreatorTaskReceipt,
    evaluateGoalEvidence, evaluateCreatorPlanAcceptance, projectCreatorPlanEvidence, estimateContextTokens } from '../dist/index.js';
import { CreatorMemoryToolRegistry } from '../dist/project-memory.js';

const tool = (name, access, role = 'task') => ({ name, access, role, description: name, inputSchema: { type: 'object' } });
const tools = [tool('cocos_2x_command_execute', 'write'), tool('cocos_2x_operation_get', 'read', 'recovery')];
const success = (operationId) => ({ structuredContent: { success: true, operationId, outcome: 'completed', phases: { editor: 'passed', disk: 'passed' } } });
const storage = () => ({ state: { revision: 0, pending: null }, async load() { return structuredClone(this.state); },
    async save(pending, revision) { assert.equal(revision, this.state.revision); this.state = { revision: revision + 1, pending }; } });

test('a write intent survives a lost response and a fresh run; only its exact terminal recovery clears it', async () => {
    const store = storage();
    let writes = 0;
    const registry = { listTools: async () => tools, callTool: async ({ name, arguments: args }) => {
        if (name === 'cocos_2x_command_execute') { writes++; throw new Error('lost response'); }
        return success(args.operationId);
    } };
    const first = await CreatorRecoveryRegistry.open(registry, store);
    const args = { command: 'scene.node.patch', input: {} };
    await assert.rejects(first.callTool({ name: tools[0].name, arguments: args, callId: 'write-1' }), /lost response/);
    assert.match(store.state.pending.value, /^[0-9a-f-]{36}$/);
    const second = await CreatorRecoveryRegistry.open(registry, store);
    const policy = createCreatorAgentPolicy({ mode: 'Agent', baseInstructions: '', pendingRecovery: second.pending(), approveWrite: async () => true });
    assert.equal(policy.createRunPolicy({}).recoveryRequired(), true);
    assert.equal((await second.callTool({ name: tools[0].name, arguments: args })).structuredContent.error.code, 'PROJECT_RECOVERY_REQUIRED');
    assert.equal((await second.callTool({ name: tools[1].name, arguments: { operationId: 'wrong' } })).structuredContent.error.code, 'PROJECT_RECOVERY_REQUIRED');
    assert.equal(writes, 1);
    await second.callTool({ name: tools[1].name, arguments: { operationId: args.input.operationId } });
    assert.equal(store.state.pending, null);
});

test('failure to persist intent prevents dispatch; nonterminal recovery never unlocks', async () => {
    let dispatched = false;
    const registry = { listTools: async () => tools, callTool: async () => { dispatched = true; return { structuredContent: { success: true, outcome: 'needs-review' } }; } };
    const broken = { load: async () => ({ revision: 0, pending: null }), save: async () => { throw new Error('disk full'); } };
    const guard = await CreatorRecoveryRegistry.open(registry, broken);
    await assert.rejects(guard.callTool({ name: tools[0].name, arguments: { command: 'scene.node.patch', input: {} } }), /disk full/);
    assert.equal(dispatched, false);
    const store = storage(); store.state.pending = { field: 'operationId', value: 'op-1', toolName: tools[0].name };
    const locked = await CreatorRecoveryRegistry.open(registry, store);
    await locked.callTool({ name: tools[1].name, arguments: { operationId: 'op-1' } });
    assert.equal(store.state.pending.value, 'op-1');
});

test('a mismatched successful write receipt retains the original identity; pre-dispatch rejection has no effect', async () => {
    const store = storage();
    const inner = { listTools: async () => tools, callTool: async () => success('another-operation') };
    const guard = await CreatorRecoveryRegistry.open(inner, store);
    const result = await guard.callTool({ name: tools[0].name, arguments: { command: 'scene.node.patch', input: { operationId: 'original' } } });
    assert.equal(result.structuredContent.error.code, 'WRITE_RECEIPT_IDENTITY_MISMATCH');
    assert.equal(store.state.pending.value, 'original');
    const clean = storage();
    const rejected = await CreatorRecoveryRegistry.open({ listTools: inner.listTools, callTool: async () => ({
        isError: true, structuredContent: { success: false, error: { code: 'PROJECT_INSTRUCTIONS_REQUIRED', sideEffect: 'none' } },
    }) }, clean);
    await rejected.callTool({ name: tools[0].name, arguments: { command: 'scene.node.patch', input: {} } });
    assert.equal(clean.state.pending, null);
});

const receipt = (name, payload, access = 'read') => ({ name, toolName: name, callId: globalThis.crypto.randomUUID(), access, role: name.includes('operation_get') ? 'recovery' : 'task', result: { structuredContent: payload } });
const write = (x, id = 'op-1', action = 'apply') => receipt('cocos_2x_command_execute', {
    success: true, command: 'scene.node.patch', outcome: 'completed', operationId: id,
    phases: { editor: 'passed', disk: 'passed', recovery: action === 'compensate' ? 'passed' : 'pending' },
    result: { action, targetNodeUuid: 'node-1', expectedDiff: [{ path: 'node.position.x', before: action === 'compensate' ? 20 : 0, after: x }] },
}, 'write');
const ledger = (write) => receipt('cocos_2x_operation_get', write.result.structuredContent);
const inspect = (x) => receipt('cocos_2x_scene_node_inspect', { success: true, result: { node: { uuid: 'node-1', path: 'scene/Canvas/Node', status: 'found', transform: { position: { x, y: 0 } } } } });
const evaluate = (task, receipts) => evaluateGoalEvidence({ taskId: 'task', criteria: creatorTaskCriteria(task) }, receipts, verifyCreatorTaskReceipt);

test('literal user targets are independent of internally consistent but incorrect write receipts', () => {
    const wrong = write(20), right = write(200);
    assert.equal(evaluate('将 node-1 的 x 移动到200', [wrong, ledger(wrong), inspect(20)]).satisfied, false);
    assert.equal(evaluate('将 node-1 的 x 移动到200', [right, ledger(right), inspect(200)]).satisfied, true);
    assert.equal(evaluate('移动某个节点', [right, ledger(right), inspect(200)]).satisfied, false, 'unbound intent cannot complete');
});

test('final Plan step uses reviewed targets and fresh readback across prior steps', () => {
    const change = write(20);
    const plan = { version: 2, kind: 'read', userTask: '移动节点', finalStep: true,
        requiredTools: ['cocos_2x_scene_node_inspect'], targets: [],
        finalTargets: [{ target: 'node-1', field: 'node.position.x', equals: 200 }],
        priorEvidence: [projectCreatorPlanEvidence(change)] };
    assert.equal(evaluateCreatorPlanAcceptance(plan, [ledger(change), inspect(20)]).satisfied, false);
    const correct = write(200); plan.priorEvidence = [projectCreatorPlanEvidence(correct)];
    assert.equal(evaluateCreatorPlanAcceptance(plan, [ledger(correct), inspect(200)]).satisfied, true);
    assert.equal(evaluateCreatorPlanAcceptance(plan, [ledger(correct)]).satisfied, false);
    plan.userTask = '将 node-1 的 x 移动到200';
    plan.finalTargets[0].equals = 20;
    plan.priorEvidence = [projectCreatorPlanEvidence(change)];
    assert.equal(evaluateCreatorPlanAcceptance(plan, [ledger(change), inspect(20)]).satisfied, false,
        'a model Plan cannot replace the original literal user value');
});

test('a temporary apply followed by compensation validates each operation and the restored target', () => {
    const applied = write(20), restored = write(0, 'op-2', 'compensate');
    assert.equal(evaluate('将节点临时移动20像素，再补偿恢复原位', [applied, restored, ledger(applied), ledger(restored), inspect(0)]).satisfied, true);
    assert.equal(evaluate('将节点临时移动20像素，再补偿恢复原位', [applied, restored, ledger(applied), ledger(restored), inspect(20)]).satisfied, false);
    const criteria = creatorTaskCriteria('恢复内容', [{ target: 'node-1', field: 'node.position.x', equals: 200 }]);
    assert.equal(evaluateGoalEvidence({ taskId: 'restore', criteria }, [restored, ledger(restored), inspect(0)], verifyCreatorTaskReceipt).satisfied, false);
});

test('ordinary Chinese negations stay read-only, and named script reads cannot disappear behind snapshot evidence', () => {
    assert.deepEqual(creatorTaskCriteria('只读查看场景，不写入、不审批、不预览').map((item) => item.id), ['requested-read']);
    const task = '读取场景快照，并读取 HelloWorld.js 检查脚本内容';
    const snapshot = receipt('cocos_2x_scene_snapshot', { success: true });
    assert.equal(evaluate(task, [snapshot]).satisfied, false);
    assert.equal(evaluate(task, [snapshot, receipt('cocos_2x_script_read', { success: true, scriptPath: 'Script/Other.js' })]).satisfied, false);
    assert.equal(evaluate(task, [snapshot, receipt('cocos_2x_script_read', { success: true, scriptPath: 'Script/HelloWorld.js' })]).satisfied, true);
    assert.ok(creatorTaskCriteria('Inspect without changing existing nodes, then create a node').some((item) => item.id === 'content-written'));
});

test('context overflow retries with a smaller request and retains the smaller budget in later rounds', async () => {
    const estimates = [], reports = [];
    const readTool = tool('scene.read', 'read');
    const kernel = new AgentKernel({ provider: {
        summarizeContext: async () => 'Earlier constraints only.',
        complete: async ({ messages, tools }) => {
            estimates.push(estimateContextTokens(messages, tools));
            if (estimates.length === 1) throw Object.assign(new Error('too long'), { code: 'DEEPSEEK_CONTEXT_TOO_LONG' });
            if (estimates.length === 2) return { message: { role: 'assistant', content: null, toolCalls: [{ id: 'read-1', name: 'scene.read', arguments: {} }] }, finishReason: 'tool_calls' };
            return { message: { role: 'assistant', content: 'Read complete.' }, finishReason: 'stop' };
        },
    }, tools: { listTools: async () => [readTool], callTool: async () => ({ structuredContent: { success: true } }) },
    policy: { approveWrite: async () => false }, hooks: { onEvent: (event) => { if (event.report) reports.push(event.report); } },
    contextBudget: { maxEstimatedTokens: 4000, keepRecentMessages: 1, keepRecentToolInteractions: 1 }, systemPrompt: 'Creator' });
    const history = Array.from({ length: 24 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: `Note ${index}: ${'background '.repeat(36)}` }));
    const result = await kernel.run({ task: 'Inspect the scene.', mode: 'Ask', history });
    assert.equal(result.status, 'completed', result.reason);
    assert.equal(estimates.length, 3);
    assert.ok(estimates[1] < estimates[0]);
    assert.ok(estimates.slice(1).every((tokens) => tokens <= 2600));
    assert.ok(reports.some((report) => report.maxEstimatedTokens === 2600));
});

test('memory compaction cannot bypass the project instructions gate', async () => {
    let mutations = 0;
    const memory = { tools: () => [], call: async () => { mutations++; return {}; } };
    const registry = new CreatorMemoryToolRegistry({ listTools: async () => [], callTool: async () => ({}) }, memory, () => false);
    const result = await registry.callTool({ name: 'cocos_2x_memory_compact', arguments: {}, callId: 'compact-1' });
    assert.equal(result.structuredContent.error.code, 'PROJECT_INSTRUCTIONS_REQUIRED');
    assert.equal(mutations, 0);
});
