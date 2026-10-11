import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { AssistantStateStore, assistantStateDirectory } from './assistant-state-store.mjs';

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
            status: 'completed', receipts: [{ toolName: 'test', operationId: '11111111-1111-4111-8111-111111111111',
                screenshot: 'omit', apiKey: 'deepseek-test-key-value' }] }] });
        const restored = store.load();
        assert.equal(restored.conversations[0].messages.length, 2);
        assert.equal(restored.plans[0].id, 'plan-a');
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
