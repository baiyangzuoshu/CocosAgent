import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentKernel } from '../dist/agent-loop.js';
import { AgentHookRegistry } from '../dist/lifecycle-hooks.js';

function provider(complete) { return { complete }; }
function readTool() { return { name: 'scene.read', description: 'read scene', inputSchema: { type: 'object' }, access: 'read', role: 'task' }; }
function call(name, id, args = {}) { return { message: { role: 'assistant', content: null,
    toolCalls: [{ id, name, arguments: args }] }, finishReason: 'tool_calls' }; }

test('all four lifecycle hooks are ordered and Stop can request a bounded continuation', async () => {
    const hooks = new AgentHookRegistry();
    const events = [];
    hooks.register('UserPromptSubmit', () => { events.push('input'); return 'hook context'; });
    hooks.register('PreToolUse', () => { events.push('pre'); });
    hooks.register('PostToolUse', ({ receipt }) => { events.push(`post:${receipt.callId}`); });
    let stopCount = 0;
    hooks.register('Stop', () => {
        events.push('stop');
        stopCount += 1;
        return stopCount === 1 ? { action: 'continue', message: 'One final inspection step remains.' } : { action: 'finish' };
    });
    let round = 0;
    const kernel = new AgentKernel({
        provider: provider(async ({ messages }) => {
            round += 1;
            if (round === 1) {
                assert.ok(messages.some((message) => message.role === 'system' && message.content === 'hook context'));
                return call('scene.read', 'read-1');
            }
            return { message: { role: 'assistant', content: 'done' }, finishReason: 'stop' };
        }),
        tools: { listTools: async () => [readTool()], callTool: async () => ({ structuredContent: { success: true } }) },
        policy: { approveWrite: async () => false }, lifecycleHooks: hooks, systemPrompt: 'test',
    });
    const result = await kernel.run({ task: 'inspect', mode: 'Agent' });
    assert.equal(result.status, 'completed');
    assert.deepEqual(events, ['input', 'pre', 'post:read-1', 'stop', 'stop']);
});

test('a PreToolUse hook blocks execution before approval or side effects', async () => {
    const hooks = new AgentHookRegistry();
    hooks.register('PreToolUse', () => 'blocked by test hook');
    let invoked = false;
    let approvals = 0;
    const kernel = new AgentKernel({
        provider: provider(async () => call('scene.write', 'write-1')),
        tools: { listTools: async () => [{ ...readTool(), name: 'scene.write', access: 'write' }],
            callTool: async () => { invoked = true; return { structuredContent: { success: true } }; } },
        policy: { approveWrite: async () => { approvals += 1; return true; } },
        lifecycleHooks: hooks, systemPrompt: 'test',
    });
    const result = await kernel.run({ task: 'write', mode: 'Agent' });
    assert.equal(result.reason, 'tool-blocked-by-hook');
    assert.equal(invoked, false);
    assert.equal(approvals, 0);
});

test('Agent TodoWrite is run-local, does not request Creator write approval, and survives a later model failure', async () => {
    const updates = [];
    let approvals = 0;
    let round = 0;
    const kernel = new AgentKernel({
        provider: provider(async ({ tools }) => {
            round += 1;
            if (round === 1) {
                const todo = tools.find((tool) => tool.name === 'agent_todo_write');
                assert.ok(todo);
                assert.equal(todo.access, 'read');
                assert.equal(todo.role, 'todo');
                return call('agent_todo_write', 'todo-1', { items: [
                    { content: 'Read the target scene', status: 'in_progress' },
                    { content: 'Validate the result', status: 'pending' },
                ] });
            }
            throw new Error('simulated provider failure');
        }),
        tools: { listTools: async () => [], callTool: async () => { throw new Error('internal todo must not reach MCP'); } },
        policy: { approveWrite: async () => { approvals += 1; return true; } },
        hooks: { onEvent: (event) => { if (event.type === 'todo.updated') updates.push(event.items); } },
        systemPrompt: 'test',
    });
    const result = await kernel.run({ task: 'two-step task', mode: 'Agent' });
    assert.equal(result.reason, 'model-error:Error');
    assert.equal(approvals, 0);
    assert.deepEqual(result.executionChecklist.map(({ status }) => status), ['in_progress', 'pending']);
    assert.deepEqual(updates, [result.executionChecklist]);
    assert.equal(result.receipts[0].role, 'todo');
});

test('cancellation keeps unfinished execution items in the final run result', async () => {
    const controller = new AbortController();
    let round = 0;
    const kernel = new AgentKernel({
        provider: provider(async () => {
            round += 1;
            if (round === 1) return call('agent_todo_write', 'todo-1', { items: [
                { content: 'Inspect the scene', status: 'completed' },
                { content: 'Apply the approved change', status: 'in_progress' },
                { content: 'Read back and preview', status: 'pending' },
            ] });
            controller.abort();
            return { message: { role: 'assistant', content: 'stopping' }, finishReason: 'stop' };
        }),
        tools: { listTools: async () => [], callTool: async () => ({}) },
        policy: { approveWrite: async () => false }, systemPrompt: 'test',
    });
    const result = await kernel.run({ task: 'multi-step task', mode: 'Agent', signal: controller.signal });
    assert.equal(result.status, 'cancelled');
    assert.deepEqual(result.executionChecklist.map(({ status }) => status), ['completed', 'in_progress', 'pending']);
});

test('TodoWrite rejects multiple in-progress tasks without erasing the previous list', async () => {
    const kernel = new AgentKernel({
        provider: provider(async ({ tools }) => {
            assert.ok(tools.some((tool) => tool.name === 'agent_todo_write'));
            return call('agent_todo_write', 'todo-invalid', { items: [
                { content: 'A', status: 'in_progress' }, { content: 'B', status: 'in_progress' },
            ] });
        }),
        tools: { listTools: async () => [], callTool: async () => ({}) },
        policy: { approveWrite: async () => false }, systemPrompt: 'test',
    });
    const result = await kernel.run({ task: 'invalid todo', mode: 'Agent' });
    assert.equal(result.receipts[0].result.isError, true);
    assert.deepEqual(result.executionChecklist, []);
});
