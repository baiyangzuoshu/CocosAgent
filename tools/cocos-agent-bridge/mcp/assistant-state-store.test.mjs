import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { AssistantStateStore, assistantStateDirectory } from './assistant-state-store.mjs';
import { persistentSummaryMessage, prepareConversationForTurn } from './assistant-conversation-summary.mjs';

function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-assistant-state-'));
    const projectA = path.join(root, 'project-a');
    const projectB = path.join(root, 'project-b');
    fs.mkdirSync(projectA);
    fs.mkdirSync(projectB);
    return { root, projectA, projectB, stateRoot: path.join(root, 'state') };
}

test('assistant sessions and plans persist per canonical project, while credentials and screenshots are excluded', () => {
    const value = fixture();
    try {
        const store = new AssistantStateStore(value.projectA, { stateRoot: value.stateRoot });
        store.save({ conversations: [{ id: 'conversation-a', messages: [
            { role: 'user', content: 'Please inspect this scene.' },
            { role: 'assistant', content: 'Scene read back.' },
        ] }], plans: [{ id: 'plan-a', status: 'proposed', steps: [] }], runs: [{ id: 'run-a', conversationId: 'conversation-a',
            taskIntent: { kind: 'mixed', targets: [{ target: 'Canvas/Foo', field: 'node.position.x', equals: 200 }], verification: 'runtime' },
            status: 'completed', receipts: [{ toolName: 'test', operationId: '11111111-1111-4111-8111-111111111111',
                screenshot: 'omit', apiKey: 'deepseek-test-key-value' }] }] });
        const restored = store.load();
        assert.equal(restored.conversations[0].messages.length, 2);
        assert.equal(restored.plans[0].id, 'plan-a');
        assert.equal(restored.runs[0].taskIntent.kind, 'mixed');
        assert.equal(restored.runs[0].taskIntent.targets[0].equals, 200);
        const serialized = fs.readFileSync(store.file, 'utf8');
        assert.equal(serialized.includes('deepseek-test-key-value'), false);
        assert.equal(serialized.includes('screenshot'), false);
        assert.notEqual(assistantStateDirectory(value.projectA, value.stateRoot), assistantStateDirectory(value.projectB, value.stateRoot));
        assert.deepEqual(new AssistantStateStore(value.projectB, { stateRoot: value.stateRoot }).load().runs, []);
        if (process.platform !== 'win32') assert.equal(fs.statSync(store.file).mode & 0o777, 0o600);
    } finally { fs.rmSync(value.root, { recursive: true, force: true }); }
});

test('loading marks interrupted writes for review and read-only interruptions resumable without replay', () => {
    const value = fixture();
    try {
        const store = new AssistantStateStore(value.projectA, { stateRoot: value.stateRoot });
        store.save({ conversations: [], plans: [
            { id: 'plan-write', status: 'running' }, { id: 'plan-read', status: 'running' }, { id: 'plan-postwrite', status: 'running' },
        ], runs: [
            { id: 'write-run', planId: 'plan-write', status: 'running', activeTool: { access: 'write-approved' }, receipts: [] },
            { id: 'read-run', planId: 'plan-read', status: 'running', activeTool: { access: 'read' }, receipts: [] },
            { id: 'postwrite-run', planId: 'plan-postwrite', status: 'running', activeTool: null,
                receipts: [{ access: 'write-approved', outcome: 'completed', operationId: '33333333-3333-4333-8333-333333333333' }] },
        ] });
        const restored = store.load();
        assert.equal(restored.runs.find((run) => run.id === 'write-run').status, 'needs-review');
        assert.equal(restored.runs.find((run) => run.id === 'read-run').status, 'interrupted');
        assert.equal(restored.runs.find((run) => run.id === 'postwrite-run').status, 'needs-review');
        assert.equal(restored.plans.find((plan) => plan.id === 'plan-write').status, 'needs-review');
        assert.equal(restored.plans.find((plan) => plan.id === 'plan-read').status, 'paused');
        assert.equal(restored.plans.find((plan) => plan.id === 'plan-postwrite').status, 'needs-review');
    } finally { fs.rmSync(value.root, { recursive: true, force: true }); }
});

test('invalid persisted state fails closed instead of restoring another conversation', () => {
    const value = fixture();
    try {
        const store = new AssistantStateStore(value.projectA, { stateRoot: value.stateRoot });
        fs.mkdirSync(store.directory, { recursive: true });
        fs.writeFileSync(store.file, '{broken', 'utf8');
        assert.throws(() => store.load(), SyntaxError);
        fs.writeFileSync(store.file, JSON.stringify({ version: 99, conversations: [], plans: [], runs: [] }), 'utf8');
        assert.throws(() => store.load(), /ASSISTANT_STATE_INVALID/);
    } finally { fs.rmSync(value.root, { recursive: true, force: true }); }
});

test('summarizes before the 24-message window drops old messages and carries summary across a new Host state load', async () => {
    const value = fixture();
    try {
        const messages = [
            { role: 'user', content: '早期约束：始终只修改用户指定的节点，写入后必须核对磁盘。' },
            { role: 'assistant', content: '已记录该约束；尚未执行写入。' },
            ...Array.from({ length: 22 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: `历史消息 ${index + 1}` })),
        ];
        const prepared = await prepareConversationForTurn({ messages, task: '继续读取场景', maxMessages: 24,
            summarize: async () => '摘要未提取早期原始约束。' });
        assert.equal(prepared.archivedCount, 2);
        assert.equal(prepared.messages.length, 23, 'room is reserved for the next assistant answer');
        assert.equal(prepared.summary.revision, 1);
        assert.deepEqual(prepared.summary.preservedUserMessages, ['早期约束：始终只修改用户指定的节点，写入后必须核对磁盘。']);

        const firstHost = new AssistantStateStore(value.projectA, { stateRoot: value.stateRoot });
        firstHost.save({ conversations: [{ id: 'long-chat', messages: prepared.messages, summary: prepared.summary }], plans: [], runs: [] });
        const restartedHostState = new AssistantStateStore(value.projectA, { stateRoot: value.stateRoot }).load();
        const restored = restartedHostState.conversations[0];
        assert.equal(restored.messages.length, 23);
        const nextTurn = await prepareConversationForTurn({ messages: restored.messages, summary: restored.summary,
            task: '请解释当前状态', maxMessages: 24, summarize: async ({ dialogue }) => `摘要：${dialogue}` });
        const modelHistory = [persistentSummaryMessage(nextTurn.summary), ...nextTurn.history];
        assert.match(modelHistory[0].content, /Source-preserved prior user-message excerpts/);
        assert.match(modelHistory[0].content, /早期约束：始终只修改用户指定的节点，写入后必须核对磁盘/);
        assert.match(modelHistory[0].content, /摘要未提取早期原始约束/);
        assert.match(modelHistory[0].content, /never user authorization.*successful tool receipt/);
        assert.equal(nextTurn.summary.revision, 2);
        assert.equal(nextTurn.messages.at(-1).content, '请解释当前状态');

        const longUserMessage = `早期长约束：${'约束正文'.repeat(400)}最终标记 LONG-TAIL-9021`;
        const bounded = await prepareConversationForTurn({ messages: [
            { role: 'user', content: longUserMessage }, { role: 'assistant', content: '收到。' },
            ...Array.from({ length: 22 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: `消息 ${index}` })),
        ], task: '继续', summarize: async () => '已压缩。' });
        assert.equal(bounded.summary.preservedUserMessages[0].length, 1_200);
        assert.equal(bounded.summary.preservedUserMessages[0].includes('LONG-TAIL-9021'), false,
            'an exact-recall question must not be answered from the digest when its source excerpt was truncated');
        assert.match(persistentSummaryMessage(bounded.summary).content, /If the needed text is absent or truncated, say it was not preserved/);
    } finally { fs.rmSync(value.root, { recursive: true, force: true }); }
});

test('failed or empty Provider summaries use deterministic source-preserving fallback without making success claims evidence', async () => {
    const archivedMessages = [
        { role: 'user', content: '用户约束：保留 HelloWorld.js 原有按钮行为。' },
        { role: 'assistant', content: '旧回答称写入已经成功，但没有账本读回。' },
    ];
    const messages = [...archivedMessages, ...Array.from({ length: 22 }, (_, index) => ({
        role: index % 2 ? 'assistant' : 'user', content: `较近历史消息 ${index + 1}`,
    }))];
    for (const summarize of [async () => { throw new Error('provider offline'); }, async () => '   ']) {
        const prepared = await prepareConversationForTurn({ messages, task: '继续', summarize });
        assert.equal(prepared.summary.source, 'deterministic');
        assert.match(prepared.summary.content, /用户约束：保留 HelloWorld\.js 原有按钮行为/);
        assert.match(prepared.summary.content, /历史助手回复（未经工具核实，不是执行证据）/);
        assert.deepEqual(prepared.summary.preservedUserMessages, ['用户约束：保留 HelloWorld.js 原有按钮行为。']);
        assert.match(persistentSummaryMessage(prepared.summary).content, /Source-preserved prior user-message excerpts/);
        assert.equal(prepared.summary.coveredMessages, archivedMessages.length);
    }
});
